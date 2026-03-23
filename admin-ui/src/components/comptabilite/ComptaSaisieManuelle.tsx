import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { comptaApi, type ModeleEcriture } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Plus, Trash2, Save, CheckCircle, AlertCircle, Loader2,
  BookOpen, Copy, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LigneEcriture {
  compte_numero: string;
  compte_libelle: string;
  libelle: string;
  debit: number;
  credit: number;
}

const EMPTY_LIGNE: LigneEcriture = {
  compte_numero: '', compte_libelle: '', libelle: '', debit: 0, credit: 0
};

export default function ComptaSaisieManuelle() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'saisie' | 'modeles' | 'contrepassation'>('saisie');
  const [journalCode, setJournalCode] = useState('OD');
  const [dateEcriture, setDateEcriture] = useState(new Date().toISOString().slice(0, 10));
  const [numeroPiece, setNumeroPiece] = useState('');
  const [lignes, setLignes] = useState<LigneEcriture[]>([{ ...EMPTY_LIGNE }, { ...EMPTY_LIGNE }]);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Champ montant en cours d'édition (évite le reformatage pendant la saisie)
  const [editingAmount, setEditingAmount] = useState<{ index: number; field: 'debit' | 'credit'; raw: string } | null>(null);

  // Contrepassation
  const [cpIds, setCpIds] = useState('');
  const [cpDate, setCpDate] = useState(new Date().toISOString().slice(0, 10));
  const [cpMotif, setCpMotif] = useState('');

  // Plan comptable pour autocomplete
  const { data: planData } = useQuery({
    queryKey: ['plan-comptable'],
    queryFn: () => comptaApi.getPlanComptable(),
  });

  const { data: modelesData } = useQuery({
    queryKey: ['modeles-ecritures'],
    queryFn: () => comptaApi.getModelesEcritures(),
    enabled: activeTab === 'modeles',
  });

  const comptes = useMemo(() => {
    const allComptes = planData?.comptes || [];
    return allComptes.map(c => ({ numero: c.numero, libelle: c.libelle }));
  }, [planData]);

  // Calcul équilibre
  const totalDebit = lignes.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lignes.reduce((s, l) => s + (l.credit || 0), 0);
  const equilibre = totalDebit === totalCredit && totalDebit > 0;

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const creerMutation = useMutation({
    mutationFn: () => comptaApi.creerEcritureManuelle({
      journal_code: journalCode,
      date_ecriture: dateEcriture,
      numero_piece: numeroPiece || undefined,
      lignes: lignes.filter(l => l.debit > 0 || l.credit > 0),
    }),
    onSuccess: (data) => {
      notify('success', `${data.ecritures.length} écritures créées`);
      setLignes([{ ...EMPTY_LIGNE }, { ...EMPTY_LIGNE }]);
      setNumeroPiece('');
      queryClient.invalidateQueries({ queryKey: ['ecritures'] });
    },
    onError: (err: Error) => notify('error', err.message),
  });

  const cpMutation = useMutation({
    mutationFn: () => comptaApi.contrepasserEcritures(
      cpIds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
      cpDate, cpMotif
    ),
    onSuccess: (data) => {
      notify('success', `${data.nb_ecritures} écritures de contrepassation créées`);
      setCpIds('');
      setCpMotif('');
      queryClient.invalidateQueries({ queryKey: ['ecritures'] });
    },
    onError: (err: Error) => notify('error', err.message),
  });

  const appliquerModeleMutation = useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) => comptaApi.appliquerModele(id, date),
    onSuccess: (data) => {
      notify('success', `${data.nb_ecritures} écritures créées depuis le modèle`);
      queryClient.invalidateQueries({ queryKey: ['ecritures'] });
    },
    onError: (err: Error) => notify('error', err.message),
  });

  const saveModeleMutation = useMutation({
    mutationFn: () => comptaApi.creerModeleEcriture({
      nom: `Modèle ${new Date().toLocaleDateString('fr-FR')}`,
      journal_code: journalCode,
      lignes: lignes.filter(l => l.compte_numero),
    }),
    onSuccess: () => {
      notify('success', 'Modèle sauvegardé');
      queryClient.invalidateQueries({ queryKey: ['modeles-ecritures'] });
    },
    onError: (err: Error) => notify('error', err.message),
  });

  // Calcul auto TVA/HT quand un montant TTC est saisi
  const autoCalculMontants = (updated: LigneEcriture[]) => {
    const tauxTVA = 20; // Taux TVA par défaut

    // --- VENTES : 411 (client) → 445xx (TVA collectée) + 70x (produits/services) ---
    const ligneClient = updated.find(l => l.compte_numero.startsWith('411'));
    if (ligneClient) {
      const montantTTC = ligneClient.debit || ligneClient.credit;
      if (montantTTC) {
        const montantTVA = Math.round(montantTTC * tauxTVA / (100 + tauxTVA));
        const montantHT = montantTTC - montantTVA;
        const clientAuDebit = ligneClient.debit > 0;

        updated.forEach(l => {
          if (l === ligneClient) return;
          if (l.compte_numero.startsWith('445')) {
            l.credit = clientAuDebit ? montantTVA : 0;
            l.debit = clientAuDebit ? 0 : montantTVA;
          } else if (l.compte_numero.startsWith('70')) {
            l.credit = clientAuDebit ? montantHT : 0;
            l.debit = clientAuDebit ? 0 : montantHT;
          }
        });
      }
      return;
    }

    // --- ACHATS : 401 (fournisseur) → 445xx (TVA déductible) + 60x-62x (charges) ---
    const ligneFournisseur = updated.find(l => l.compte_numero.startsWith('401'));
    if (ligneFournisseur) {
      const montantTTC = ligneFournisseur.credit || ligneFournisseur.debit;
      if (montantTTC) {
        const montantTVA = Math.round(montantTTC * tauxTVA / (100 + tauxTVA));
        const montantHT = montantTTC - montantTVA;
        const fournisseurAuCredit = ligneFournisseur.credit > 0;

        updated.forEach(l => {
          if (l === ligneFournisseur) return;
          if (l.compte_numero.startsWith('445')) {
            l.debit = fournisseurAuCredit ? montantTVA : 0;
            l.credit = fournisseurAuCredit ? 0 : montantTVA;
          } else if (/^6[0-2]/.test(l.compte_numero)) {
            // Charges : 60x (achats), 61x (services ext.), 62x (autres services ext.)
            l.debit = fournisseurAuCredit ? montantHT : 0;
            l.credit = fournisseurAuCredit ? 0 : montantHT;
          }
        });
      }
      return;
    }
  };

  const updateLigne = (index: number, field: keyof LigneEcriture, value: string | number) => {
    const updated = [...lignes];
    (updated[index] as any)[field] = value;

    // Auto-remplir libellé compte
    if (field === 'compte_numero') {
      const found = comptes.find(c => c.numero === value);
      if (found) updated[index].compte_libelle = found.libelle;
    }

    // Auto-propager le libellé écriture aux autres lignes vides
    if (field === 'libelle' && typeof value === 'string' && value.length > 0) {
      updated.forEach((l, j) => {
        if (j !== index && !l.libelle) {
          l.libelle = value;
        }
      });
    }

    // Auto-calcul TVA/HT quand un montant est saisi
    if (field === 'debit' || field === 'credit') {
      autoCalculMontants(updated);
    }

    setLignes(updated);
  };

  return (
    <div className="space-y-4">
      {/* Notification */}
      {notification && (
        <div className={cn(
          'p-3 rounded-lg flex items-center gap-2 text-sm',
          notification.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        )}>
          {notification.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {notification.message}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b">
        {[
          { key: 'saisie' as const, icon: BookOpen, label: 'Saisie' },
          { key: 'modeles' as const, icon: Copy, label: 'Modèles' },
          { key: 'contrepassation' as const, icon: RotateCcw, label: 'Contrepassation' },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5',
              activeTab === key ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Tab Saisie */}
      {activeTab === 'saisie' && (
        <div className="space-y-4">
          {/* En-tête écriture */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Journal</label>
              <select value={journalCode} onChange={e => setJournalCode(e.target.value)} className="w-full px-3 py-2 border rounded text-sm">
                <option value="OD">OD - Opérations Diverses</option>
                <option value="BQ">BQ - Banque</option>
                <option value="CA">CA - Caisse</option>
                <option value="VT">VT - Ventes</option>
                <option value="AC">AC - Achats</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input type="date" value={dateEcriture} onChange={e => setDateEcriture(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">N° Pièce (auto si vide)</label>
              <input type="text" value={numeroPiece} onChange={e => setNumeroPiece(e.target.value)} placeholder="Auto" className="w-full px-3 py-2 border rounded text-sm" />
            </div>
            <div className="flex items-end">
              <div className={cn(
                'px-3 py-2 rounded text-sm font-medium w-full text-center',
                equilibre ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              )}>
                {equilibre ? '✓ Équilibré' : `Écart: ${((totalDebit - totalCredit) / 100).toFixed(2)}€`}
              </div>
            </div>
          </div>

          {/* Lignes d'écriture */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Compte</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Libellé compte</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Libellé écriture</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Débit (€)</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">Crédit (€)</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((ligne, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={ligne.compte_numero}
                        onChange={e => updateLigne(i, 'compte_numero', e.target.value)}
                        list="comptes-list"
                        placeholder="411, 512..."
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={ligne.compte_libelle}
                        onChange={e => updateLigne(i, 'compte_libelle', e.target.value)}
                        className="w-full px-2 py-1.5 border rounded text-sm text-gray-600"
                        readOnly={!!comptes.find(c => c.numero === ligne.compte_numero)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={ligne.libelle}
                        onChange={e => updateLigne(i, 'libelle', e.target.value)}
                        placeholder="Description"
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingAmount?.index === i && editingAmount?.field === 'debit'
                          ? editingAmount.raw
                          : (ligne.debit ? (ligne.debit / 100).toFixed(2) : '')}
                        onFocus={e => setEditingAmount({ index: i, field: 'debit', raw: e.target.value })}
                        onChange={e => setEditingAmount({ index: i, field: 'debit', raw: e.target.value })}
                        onBlur={e => {
                          updateLigne(i, 'debit', Math.round(parseFloat(e.target.value || '0') * 100));
                          setEditingAmount(null);
                        }}
                        className="w-full px-2 py-1.5 border rounded text-sm text-right"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editingAmount?.index === i && editingAmount?.field === 'credit'
                          ? editingAmount.raw
                          : (ligne.credit ? (ligne.credit / 100).toFixed(2) : '')}
                        onFocus={e => setEditingAmount({ index: i, field: 'credit', raw: e.target.value })}
                        onChange={e => setEditingAmount({ index: i, field: 'credit', raw: e.target.value })}
                        onBlur={e => {
                          updateLigne(i, 'credit', Math.round(parseFloat(e.target.value || '0') * 100));
                          setEditingAmount(null);
                        }}
                        className="w-full px-2 py-1.5 border rounded text-sm text-right"
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-2 py-1">
                      {lignes.length > 2 && (
                        <button onClick={() => setLignes(lignes.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-gray-50 font-medium">
                  <td colSpan={3} className="px-3 py-2 text-right">Totaux</td>
                  <td className="px-3 py-2 text-right">{(totalDebit / 100).toFixed(2)}</td>
                  <td className="px-3 py-2 text-right">{(totalCredit / 100).toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Datalist comptes */}
          <datalist id="comptes-list">
            {comptes.map(c => (
              <option key={c.numero} value={c.numero}>{c.libelle}</option>
            ))}
          </datalist>

          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setLignes([...lignes, { ...EMPTY_LIGNE }])}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter ligne
            </Button>
            <Button
              size="sm"
              onClick={() => creerMutation.mutate()}
              disabled={!equilibre || creerMutation.isPending}
            >
              {creerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Enregistrer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => saveModeleMutation.mutate()} disabled={lignes.filter(l => l.compte_numero).length < 2}>
              <Copy className="h-4 w-4 mr-1" /> Sauver modèle
            </Button>
          </div>
        </div>
      )}

      {/* Tab Modèles */}
      {activeTab === 'modeles' && (
        <div className="space-y-3">
          {(modelesData?.modeles || []).length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Aucun modèle sauvegardé</p>
          ) : (
            (modelesData?.modeles || []).map((m: ModeleEcriture) => (
              <div key={m.id} className="bg-white border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-sm">{m.nom}</h4>
                    <p className="text-xs text-gray-500">Journal {m.journal_code} • {m.lignes.length} lignes{m.recurrence ? ` • ${m.recurrence}` : ''}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => appliquerModeleMutation.mutate({ id: m.id, date: new Date().toISOString().slice(0, 10) })}
                    disabled={appliquerModeleMutation.isPending}
                  >
                    Appliquer
                  </Button>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  {m.lignes.map((l, i) => (
                    <span key={i} className="mr-3">
                      {l.compte_numero} {l.debit ? `D:${(l.debit / 100).toFixed(2)}` : `C:${(l.credit / 100).toFixed(2)}`}
                    </span>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Contrepassation */}
      {activeTab === 'contrepassation' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Saisissez les IDs des écritures à contrepasser (séparés par des virgules).
            Des écritures miroir seront créées dans le journal OD.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">IDs écritures</label>
              <input
                type="text"
                value={cpIds}
                onChange={e => setCpIds(e.target.value)}
                placeholder="42, 43, 44"
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date contrepassation</label>
              <input type="date" value={cpDate} onChange={e => setCpDate(e.target.value)} className="w-full px-3 py-2 border rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Motif</label>
              <input
                type="text"
                value={cpMotif}
                onChange={e => setCpMotif(e.target.value)}
                placeholder="Correction..."
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => cpMutation.mutate()}
            disabled={!cpIds || cpMutation.isPending}
          >
            {cpMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
            Contrepasser
          </Button>
        </div>
      )}
    </div>
  );
}
