import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { comptaApi, type CompteComptable } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Plus, Trash2, Save, CheckCircle, AlertCircle, Loader2,
  Search, ChevronDown, ChevronRight, Pencil, X, Download, EyeOff, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CLASSES_LABELS: Record<string, string> = {
  '1': 'Classe 1 — Capitaux',
  '2': 'Classe 2 — Immobilisations',
  '3': 'Classe 3 — Stocks et en-cours',
  '4': 'Classe 4 — Tiers',
  '5': 'Classe 5 — Trésorerie',
  '6': 'Classe 6 — Charges',
  '7': 'Classe 7 — Produits',
};

export default function ComptaPlanComptable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [openClasses, setOpenClasses] = useState<Set<string>>(new Set(['4', '5', '6', '7']));
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showInactifs, setShowInactifs] = useState(false);

  // Formulaire ajout/édition
  const [formMode, setFormMode] = useState<'closed' | 'add' | 'edit'>('closed');
  const [formData, setFormData] = useState({ numero: '', libelle: '', type: 'general', nature: '' });
  const [editingNumero, setEditingNumero] = useState('');

  const { data: planData, isLoading } = useQuery({
    queryKey: ['plan-comptable'],
    queryFn: () => comptaApi.getPlanComptable(),
  });

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['plan-comptable'] });

  const createMutation = useMutation({
    mutationFn: () => comptaApi.createCompte({
      numero: formData.numero,
      libelle: formData.libelle,
      type: formData.type,
      nature: formData.nature || undefined,
    }),
    onSuccess: () => { notify('success', `Compte ${formData.numero} créé`); closeForm(); invalidate(); },
    onError: (err: Error) => notify('error', err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () => comptaApi.updateCompte(editingNumero, {
      libelle: formData.libelle,
      type: formData.type,
      nature: formData.nature || undefined,
    }),
    onSuccess: () => { notify('success', `Compte ${editingNumero} modifié`); closeForm(); invalidate(); },
    onError: (err: Error) => notify('error', err.message),
  });

  const toggleActifMutation = useMutation({
    mutationFn: ({ numero, actif }: { numero: string; actif: boolean }) =>
      comptaApi.updateCompte(numero, { actif }),
    onSuccess: (_, vars) => { notify('success', `Compte ${vars.numero} ${vars.actif ? 'activé' : 'désactivé'}`); invalidate(); },
    onError: (err: Error) => notify('error', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (numero: string) => comptaApi.deleteCompte(numero),
    onSuccess: (_, numero) => { notify('success', `Compte ${numero} supprimé`); invalidate(); },
    onError: (err: Error) => notify('error', err.message),
  });

  const initMutation = useMutation({
    mutationFn: () => comptaApi.initPCG(),
    onSuccess: (data) => { notify('success', `PCG initialisé : ${data.count} comptes créés`); invalidate(); },
    onError: (err: Error) => notify('error', err.message),
  });

  const completeMutation = useMutation({
    mutationFn: () => comptaApi.completePCG(),
    onSuccess: (data) => { notify('success', data.added > 0 ? `${data.added} comptes ajoutés (total : ${data.total})` : data.message); invalidate(); },
    onError: (err: Error) => notify('error', err.message),
  });

  const closeForm = () => {
    setFormMode('closed');
    setFormData({ numero: '', libelle: '', type: 'general', nature: '' });
    setEditingNumero('');
  };

  const startEdit = (c: CompteComptable) => {
    setFormMode('edit');
    setEditingNumero(c.numero);
    setFormData({ numero: c.numero, libelle: c.libelle, type: c.type || 'general', nature: c.nature || '' });
  };

  const toggleClass = (classe: string) => {
    const next = new Set(openClasses);
    next.has(classe) ? next.delete(classe) : next.add(classe);
    setOpenClasses(next);
  };

  // Filtrage par recherche
  const allComptes = planData?.comptes || [];
  const filteredComptes = useMemo(() => {
    let list = allComptes;
    if (!showInactifs) list = list.filter(c => (c as any).actif !== false);
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(c => c.numero.includes(q) || c.libelle.toLowerCase().includes(q));
  }, [allComptes, search, showInactifs]);

  // Grouper par classe
  const groupedComptes = useMemo(() => {
    const groups: Record<string, CompteComptable[]> = {};
    for (const classe of Object.keys(CLASSES_LABELS)) {
      groups[classe] = filteredComptes.filter(c => String(c.classe) === classe);
    }
    return groups;
  }, [filteredComptes]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }

  const isEmpty = allComptes.length === 0;

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

      {/* Initialiser le PCG si vide */}
      {isEmpty && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
          <p className="text-sm text-amber-700 mb-3">
            Aucun compte comptable configuré. Initialisez le Plan Comptable Général standard français ?
          </p>
          <Button onClick={() => initMutation.mutate()} disabled={initMutation.isPending} size="sm">
            {initMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            Initialiser le PCG standard
          </Button>
        </div>
      )}

      {/* Barre outils */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un compte (n° ou libellé)..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowInactifs(!showInactifs)}
          className={showInactifs ? 'bg-gray-100' : ''}
        >
          {showInactifs ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
          {showInactifs ? 'Masquer inactifs' : 'Voir inactifs'}
        </Button>
        <Button size="sm" onClick={() => { setFormMode('add'); setFormData({ numero: '', libelle: '', type: 'general', nature: '' }); }}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter un compte
        </Button>
        {!isEmpty && (
          <Button size="sm" variant="outline" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
            {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            Compléter le PCG
          </Button>
        )}
        <span className="text-xs text-gray-500">{filteredComptes.length} comptes</span>
      </div>

      {/* Formulaire ajout/édition */}
      {formMode !== 'closed' && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">{formMode === 'add' ? 'Nouveau compte' : `Modifier ${editingNumero}`}</h4>
            <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">N° Compte</label>
              <input
                type="text"
                value={formData.numero}
                onChange={e => setFormData(d => ({ ...d, numero: e.target.value.replace(/\D/g, '') }))}
                placeholder="411, 706..."
                className="w-full px-3 py-2 border rounded text-sm"
                disabled={formMode === 'edit'}
                maxLength={8}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Libellé</label>
              <input
                type="text"
                value={formData.libelle}
                onChange={e => setFormData(d => ({ ...d, libelle: e.target.value }))}
                placeholder="Clients, TVA collectée..."
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select value={formData.type} onChange={e => setFormData(d => ({ ...d, type: e.target.value }))} className="w-full px-2 py-2 border rounded text-sm">
                  <option value="general">Général</option>
                  <option value="auxiliaire">Auxiliaire</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nature</label>
                <select value={formData.nature} onChange={e => setFormData(d => ({ ...d, nature: e.target.value }))} className="w-full px-2 py-2 border rounded text-sm">
                  <option value="">—</option>
                  <option value="debit">Débit</option>
                  <option value="credit">Crédit</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => formMode === 'add' ? createMutation.mutate() : updateMutation.mutate()}
              disabled={!formData.numero || !formData.libelle || createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending)
                ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                : <Save className="h-4 w-4 mr-1" />}
              {formMode === 'add' ? 'Créer' : 'Enregistrer'}
            </Button>
            <Button size="sm" variant="ghost" onClick={closeForm}>Annuler</Button>
          </div>
        </div>
      )}

      {/* Liste par classe */}
      <div className="space-y-1">
        {Object.entries(CLASSES_LABELS).map(([classe, label]) => {
          const comptes = groupedComptes[classe] || [];
          if (comptes.length === 0 && search) return null;
          const isOpen = openClasses.has(classe);

          return (
            <div key={classe} className="border rounded-lg overflow-hidden overflow-x-auto">
              <button
                onClick={() => toggleClass(classe)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-left"
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {label}
                </div>
                <span className="text-xs text-gray-500 font-normal">{comptes.length} comptes</span>
              </button>

              {isOpen && comptes.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium text-gray-500 w-28">N°</th>
                      <th className="px-3 py-1.5 text-left font-medium text-gray-500">Libellé</th>
                      <th className="px-3 py-1.5 text-center font-medium text-gray-500 w-24">Type</th>
                      <th className="px-3 py-1.5 text-center font-medium text-gray-500 w-20">Nature</th>
                      <th className="px-3 py-1.5 w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {comptes.map(c => (
                      <tr key={c.numero} className={cn('border-t hover:bg-gray-50/50', (c as any).actif === false && 'opacity-50')}>
                        <td className="px-3 py-1.5 font-mono text-xs">{c.numero}</td>
                        <td className="px-3 py-1.5">{c.libelle}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={cn(
                            'text-xs px-1.5 py-0.5 rounded',
                            c.type === 'auxiliaire' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-600'
                          )}>
                            {c.type === 'auxiliaire' ? 'Aux.' : 'Gén.'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-center text-xs text-gray-500">
                          {c.nature === 'debit' ? 'D' : c.nature === 'credit' ? 'C' : '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => startEdit(c)} className="text-gray-400 hover:text-blue-600 p-1" title="Modifier">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            {(c as any).actif !== false ? (
                              <button
                                onClick={() => toggleActifMutation.mutate({ numero: c.numero, actif: false })}
                                className="text-gray-400 hover:text-amber-600 p-1"
                                title="Désactiver"
                              >
                                <EyeOff className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => toggleActifMutation.mutate({ numero: c.numero, actif: true })}
                                className="text-gray-400 hover:text-green-600 p-1"
                                title="Réactiver"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => { if (confirm(`Supprimer le compte ${c.numero} ?`)) deleteMutation.mutate(c.numero); }}
                              className="text-gray-400 hover:text-red-600 p-1"
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {isOpen && comptes.length === 0 && (
                <p className="text-xs text-gray-400 px-3 py-2 italic">Aucun compte dans cette classe</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
