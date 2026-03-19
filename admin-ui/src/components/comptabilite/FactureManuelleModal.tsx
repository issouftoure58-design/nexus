import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  X,
  Plus,
  Trash2,
  FileText,
  Loader2,
  Search,
  UserPlus,
} from 'lucide-react';
import { clientsApi, type Client } from '@/lib/api';

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------
interface LigneFacture {
  description: string;
  quantite: number;
  prix_unitaire_ht: number;
  taux_tva: number;
}

export interface FactureManuelleData {
  client_id?: number;
  client_nom?: string;
  client_email?: string;
  client_telephone?: string;
  client_adresse?: string;
  lignes: LigneFacture[];
  date_facture: string;
  date_prestation: string;
  notes?: string;
  frais_deplacement?: number;
}

interface Props {
  onClose: () => void;
  onSubmit: (data: FactureManuelleData) => Promise<void>;
  isSubmitting: boolean;
}

const EMPTY_LIGNE: LigneFacture = {
  description: '',
  quantite: 1,
  prix_unitaire_ht: 0,
  taux_tva: 20,
};

const today = () => new Date().toISOString().split('T')[0];

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------
export default function FactureManuelleModal({ onClose, onSubmit, isSubmitting }: Props) {
  // Client mode
  const [clientMode, setClientMode] = useState<'existant' | 'ponctuel'>('existant');
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Client ponctuel
  const [clientNom, setClientNom] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientTel, setClientTel] = useState('');
  const [clientAdresse, setClientAdresse] = useState('');

  // Lignes
  const [lignes, setLignes] = useState<LigneFacture[]>([{ ...EMPTY_LIGNE }]);

  // Dates & notes
  const [dateFacture, setDateFacture] = useState(today());
  const [datePrestation, setDatePrestation] = useState(today());
  const [notes, setNotes] = useState('');
  const [fraisDeplacement, setFraisDeplacement] = useState(0);

  // Errors
  const [error, setError] = useState('');

  // -------------------------------------------------------------------
  // Client search
  // -------------------------------------------------------------------
  useEffect(() => {
    if (clientMode !== 'existant' || clientSearch.length < 2) {
      setClients([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await clientsApi.list({ search: clientSearch, limit: 10 });
        setClients(res.data || []);
        setShowDropdown(true);
      } catch {
        setClients([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearch, clientMode]);

  const selectClient = useCallback((c: Client) => {
    setSelectedClient(c);
    setClientSearch(`${c.prenom} ${c.nom}`);
    setShowDropdown(false);
  }, []);

  // -------------------------------------------------------------------
  // Lignes helpers
  // -------------------------------------------------------------------
  const updateLigne = (idx: number, field: keyof LigneFacture, value: string | number) => {
    setLignes(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const addLigne = () => setLignes(prev => [...prev, { ...EMPTY_LIGNE }]);

  const removeLigne = (idx: number) => {
    if (lignes.length <= 1) return;
    setLignes(prev => prev.filter((_, i) => i !== idx));
  };

  // -------------------------------------------------------------------
  // Totaux temps réel
  // -------------------------------------------------------------------
  const totaux = useMemo(() => {
    let totalHT = 0;
    let totalTVA = 0;
    for (const l of lignes) {
      const ht = l.quantite * l.prix_unitaire_ht;
      const tva = ht * (l.taux_tva / 100);
      totalHT += ht;
      totalTVA += tva;
    }
    if (fraisDeplacement > 0) {
      totalHT += fraisDeplacement;
      totalTVA += fraisDeplacement * 0.2;
    }
    return {
      ht: totalHT,
      tva: totalTVA,
      ttc: totalHT + totalTVA,
    };
  }, [lignes, fraisDeplacement]);

  // -------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------
  const handleSubmit = async () => {
    setError('');

    // Validation
    if (clientMode === 'existant' && !selectedClient) {
      setError('Sélectionnez un client existant');
      return;
    }
    if (clientMode === 'ponctuel' && !clientNom.trim()) {
      setError('Le nom du client est requis');
      return;
    }

    const invalidLignes = lignes.some(l => !l.description.trim() || l.quantite <= 0 || l.prix_unitaire_ht <= 0);
    if (invalidLignes) {
      setError('Chaque ligne doit avoir une description, quantité > 0 et prix > 0');
      return;
    }

    if (totaux.ttc <= 0) {
      setError('Le montant total doit être supérieur à 0');
      return;
    }

    const data: FactureManuelleData = {
      lignes,
      date_facture: dateFacture,
      date_prestation: datePrestation,
      notes: notes.trim() || undefined,
      frais_deplacement: fraisDeplacement > 0 ? fraisDeplacement : undefined,
    };

    if (clientMode === 'existant' && selectedClient) {
      data.client_id = selectedClient.id;
    } else {
      data.client_nom = clientNom.trim();
      data.client_email = clientEmail.trim() || undefined;
      data.client_telephone = clientTel.trim() || undefined;
      data.client_adresse = clientAdresse.trim() || undefined;
    }

    await onSubmit(data);
  };

  // -------------------------------------------------------------------
  // Format
  // -------------------------------------------------------------------
  const fmt = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' €';

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white z-10 border-b">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-600" />
            Nouvelle facture manuelle
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* ---- CLIENT ---- */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Client</h3>
              <div className="flex gap-1 ml-auto">
                <Button
                  variant={clientMode === 'existant' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setClientMode('existant'); setError(''); }}
                  className="h-7 text-xs gap-1"
                >
                  <Search className="h-3 w-3" />
                  Existant
                </Button>
                <Button
                  variant={clientMode === 'ponctuel' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setClientMode('ponctuel'); setSelectedClient(null); setError(''); }}
                  className="h-7 text-xs gap-1"
                >
                  <UserPlus className="h-3 w-3" />
                  Ponctuel
                </Button>
              </div>
            </div>

            {clientMode === 'existant' ? (
              <div className="relative">
                <Input
                  placeholder="Rechercher un client (nom, email, tél)..."
                  value={clientSearch}
                  onChange={(e) => { setClientSearch(e.target.value); setSelectedClient(null); }}
                  className={selectedClient ? 'border-green-400 bg-green-50' : ''}
                />
                {selectedClient && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-medium">
                    {selectedClient.email || selectedClient.telephone}
                  </span>
                )}
                {showDropdown && clients.length > 0 && !selectedClient && (
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {clients.map(c => (
                      <button
                        key={c.id}
                        onClick={() => selectClient(c)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0 text-sm"
                      >
                        <span className="font-medium">{c.prenom} {c.nom}</span>
                        {c.raison_sociale && <span className="text-gray-500 ml-1">({c.raison_sociale})</span>}
                        <span className="text-gray-400 ml-2 text-xs">{c.email || c.telephone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Nom *" value={clientNom} onChange={e => setClientNom(e.target.value)} />
                <Input placeholder="Email" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
                <Input placeholder="Téléphone" value={clientTel} onChange={e => setClientTel(e.target.value)} />
                <Input placeholder="Adresse" value={clientAdresse} onChange={e => setClientAdresse(e.target.value)} />
              </div>
            )}
          </div>

          {/* ---- LIGNES ---- */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Lignes de facturation</h3>
              <Button variant="outline" size="sm" onClick={addLigne} className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Ajouter
              </Button>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Description</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-600 w-20">Qté</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600 w-28">P.U. HT (€)</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-600 w-24">TVA %</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-600 w-24">Total HT</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((ligne, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-1 px-2">
                        <Input
                          placeholder="Description du service"
                          value={ligne.description}
                          onChange={e => updateLigne(idx, 'description', e.target.value)}
                          className="h-8 text-sm border-0 shadow-none focus-visible:ring-0 px-1"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <Input
                          type="number"
                          min="1"
                          value={ligne.quantite}
                          onChange={e => updateLigne(idx, 'quantite', Math.max(1, parseInt(e.target.value) || 1))}
                          className="h-8 text-sm text-center border-0 shadow-none focus-visible:ring-0 px-1"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={ligne.prix_unitaire_ht || ''}
                          onChange={e => updateLigne(idx, 'prix_unitaire_ht', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm text-right border-0 shadow-none focus-visible:ring-0 px-1"
                        />
                      </td>
                      <td className="py-1 px-2">
                        <select
                          value={ligne.taux_tva}
                          onChange={e => updateLigne(idx, 'taux_tva', parseFloat(e.target.value))}
                          className="h-8 w-full text-sm text-center border-0 bg-transparent focus:ring-0"
                        >
                          <option value={20}>20%</option>
                          <option value={10}>10%</option>
                          <option value={5.5}>5.5%</option>
                          <option value={0}>0%</option>
                        </select>
                      </td>
                      <td className="py-1 px-2 text-right text-sm font-medium text-gray-700">
                        {fmt(ligne.quantite * ligne.prix_unitaire_ht)}
                      </td>
                      <td className="py-1 px-1">
                        {lignes.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeLigne(idx)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- FRAIS DÉPLACEMENT ---- */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 whitespace-nowrap">Frais de déplacement (€ HT)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={fraisDeplacement || ''}
              onChange={e => setFraisDeplacement(parseFloat(e.target.value) || 0)}
              className="w-32 h-8 text-sm"
              placeholder="0.00"
            />
          </div>

          {/* ---- TOTAUX ---- */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <tbody>
                <tr className="border-b">
                  <td className="p-3 text-gray-600 text-sm">Total HT</td>
                  <td className="p-3 text-right font-medium">{fmt(totaux.ht)}</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 text-gray-600 text-sm">TVA</td>
                  <td className="p-3 text-right font-medium">{fmt(totaux.tva)}</td>
                </tr>
                <tr className="bg-cyan-50">
                  <td className="p-3 font-semibold">Total TTC</td>
                  <td className="p-3 text-right font-bold text-lg text-cyan-700">{fmt(totaux.ttc)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ---- DATES ---- */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Date facture</label>
              <Input type="date" value={dateFacture} onChange={e => setDateFacture(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">Date prestation</label>
              <Input type="date" value={datePrestation} onChange={e => setDatePrestation(e.target.value)} className="h-9" />
            </div>
          </div>

          {/* ---- NOTES ---- */}
          <div>
            <label className="text-sm text-gray-600 mb-1 block">Notes (optionnel)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Conditions particulières, références..."
              className="w-full border rounded-lg p-3 text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* ---- ERROR ---- */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* ---- ACTIONS ---- */}
          <div className="flex gap-3 pt-2 border-t">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 bg-cyan-600 hover:bg-cyan-700 gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Créer la facture
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
