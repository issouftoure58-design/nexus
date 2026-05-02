import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { X, Plus, Trash2, Clock, Users } from 'lucide-react';
import type { Client, Service, ForfaitCreateData } from './types';
import { formatMontant } from './types';
import {
  heuresParJour,
  joursParSemaine,
  coutMensuelPoste,
  recapForfait,
  type PosteCalc,
} from '@/lib/forfaitCalculator';

export interface ForfaitBuilderModalProps {
  onClose: () => void;
  onSubmit: (data: ForfaitCreateData) => void;
  isLoading: boolean;
  initialData?: {
    nom: string;
    client_id?: number;
    client_nom?: string;
    date_debut: string;
    date_fin: string;
    taux_tva: number;
    notes?: string;
    numero_commande?: string;
    postes?: { service_id?: number; service_nom: string; effectif: number; jours: boolean[]; heure_debut: string; heure_fin: string; taux_horaire: number; cout_mensuel_ht?: number }[];
  };
}

const JOURS_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DEFAULT_JOURS = [true, true, true, true, true, false, false];

interface PosteForm {
  service_id: number | null;
  service_nom: string;
  effectif: number;
  jours: boolean[];
  heure_debut: string;
  heure_fin: string;
  taux_horaire: number; // euros (saisie)
}

export default function ForfaitBuilderModal({ onClose, onSubmit, isLoading, initialData }: ForfaitBuilderModalProps) {
  // Client search
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(
    initialData?.client_id ? { id: initialData.client_id, nom: initialData.client_nom || '', prenom: '' } as Client : null
  );
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Form
  const [nom, setNom] = useState(initialData?.nom || '');
  const [dateDebut, setDateDebut] = useState(initialData?.date_debut || '');
  const [dateFin, setDateFin] = useState(initialData?.date_fin || '');
  const [tauxTva, setTauxTva] = useState(initialData?.taux_tva || 20);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [numeroCommande, setNumeroCommande] = useState(initialData?.numero_commande || '');
  const [viewMode, setViewMode] = useState<'mensuel' | 'annuel'>('mensuel');

  // Postes
  const [postes, setPostes] = useState<PosteForm[]>(
    initialData?.postes && initialData.postes.length > 0
      ? initialData.postes.map(p => ({
          service_id: p.service_id || null,
          service_nom: p.service_nom,
          effectif: p.effectif,
          jours: p.jours,
          heure_debut: p.heure_debut,
          heure_fin: p.heure_fin,
          taux_horaire: p.taux_horaire / 100, // centimes → euros for display
        }))
      : [{
          service_id: null,
          service_nom: '',
          effectif: 1,
          jours: [...DEFAULT_JOURS],
          heure_debut: '09:00',
          heure_fin: '18:00',
          taux_horaire: 22.5,
        }]
  );

  const isEditing = !!initialData;

  // Data queries
  const { data: clientsData } = useQuery<{ data: Client[] }>({
    queryKey: ['clients-search-forfait', clientSearch],
    queryFn: () => api.get<{ data: Client[] }>(`/admin/clients?search=${encodeURIComponent(clientSearch)}&limit=10`),
    enabled: clientSearch.length >= 2,
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services-forfait'],
    queryFn: async () => {
      const { items } = await api.getPaginated<Service>('/admin/services?limit=200');
      return { services: items };
    },
  });

  const clients = clientsData?.data || [];
  const services = servicesData?.services || [];

  // Calculs
  const postesCalc: PosteCalc[] = postes.map(p => ({
    service_id: p.service_id,
    service_nom: p.service_nom,
    effectif: p.effectif,
    jours: p.jours,
    heure_debut: p.heure_debut,
    heure_fin: p.heure_fin,
    taux_horaire: Math.round(p.taux_horaire * 100), // euros → centimes
  }));

  // Build CNAPS map: service_id → taux (%)
  const servicesCnaps: Record<number, number> = {};
  for (const s of services) {
    if (s.taxe_cnaps && (s.taux_cnaps ?? 0) > 0) {
      servicesCnaps[s.id] = s.taux_cnaps!;
    }
  }

  const recap = recapForfait(postesCalc, servicesCnaps);

  // Handlers
  const updatePoste = (index: number, field: keyof PosteForm, value: unknown) => {
    setPostes(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const toggleJour = (posteIndex: number, jourIndex: number) => {
    setPostes(prev => prev.map((p, i) => {
      if (i !== posteIndex) return p;
      const newJours = [...p.jours];
      newJours[jourIndex] = !newJours[jourIndex];
      return { ...p, jours: newJours };
    }));
  };

  const addPoste = () => {
    setPostes(prev => [...prev, {
      service_id: null,
      service_nom: '',
      effectif: 1,
      jours: [...DEFAULT_JOURS],
      heure_debut: '09:00',
      heure_fin: '18:00',
      taux_horaire: 22.5,
    }]);
  };

  const removePoste = (index: number) => {
    if (postes.length <= 1) return;
    setPostes(prev => prev.filter((_, i) => i !== index));
  };

  const selectService = (posteIndex: number, serviceId: number) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    updatePoste(posteIndex, 'service_id', service.id);
    updatePoste(posteIndex, 'service_nom', service.nom);
    if (service.taux_horaire) {
      updatePoste(posteIndex, 'taux_horaire', service.taux_horaire / 100);
    }
  };

  const handleSubmit = () => {
    if (!nom || !dateDebut || !dateFin || postes.some(p => !p.service_nom)) return;

    const data: ForfaitCreateData = {
      nom,
      client_id: selectedClient?.id,
      client_nom: selectedClient
        ? (selectedClient.raison_sociale || `${selectedClient.prenom} ${selectedClient.nom}`.trim())
        : undefined,
      date_debut: dateDebut,
      date_fin: dateFin,
      montant_mensuel_ht: recap.coutMensuelHT,
      taux_tva: tauxTva,
      notes: notes || undefined,
      numero_commande: numeroCommande || undefined,
      postes: postes.map((p, i) => ({
        service_id: p.service_id || undefined,
        service_nom: p.service_nom,
        effectif: p.effectif,
        jours: p.jours,
        heure_debut: p.heure_debut,
        heure_fin: p.heure_fin,
        taux_horaire: Math.round(p.taux_horaire * 100),
        cout_mensuel_ht: coutMensuelPoste(postesCalc[i]),
      })),
    };

    onSubmit(data);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto" onClick={handleBackdropClick}>
      <div className="bg-white rounded-lg w-full max-w-3xl relative my-8 mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex-shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
          <h2 className="text-xl font-bold">{isEditing ? 'Modifier le forfait' : 'Creer un forfait'}</h2>
          <p className="text-sm text-gray-500 mt-1">Contrat recurrent — Security</p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Infos generales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du forfait</label>
              <input
                type="text"
                value={nom}
                onChange={e => setNom(e.target.value)}
                placeholder="Gardiennage Site ACME"
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div className="md:col-span-2 relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <input
                type="text"
                value={selectedClient ? (selectedClient.raison_sociale || `${selectedClient.prenom} ${selectedClient.nom}`.trim()) : clientSearch}
                onChange={e => {
                  setClientSearch(e.target.value);
                  setSelectedClient(null);
                  setShowClientDropdown(true);
                }}
                onFocus={() => setShowClientDropdown(true)}
                placeholder="Rechercher un client..."
                className="w-full border rounded-lg px-3 py-2"
              />
              {showClientDropdown && clients.length > 0 && !selectedClient && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clients.map(c => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedClient(c);
                        setShowClientDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50"
                    >
                      {c.prenom} {c.nom} {c.raison_sociale ? `(${c.raison_sociale})` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date debut</label>
              <input
                type="date"
                value={dateDebut}
                onChange={e => setDateDebut(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
              <input
                type="date"
                value={dateFin}
                onChange={e => setDateFin(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">TVA (%)</label>
              <input
                type="number"
                value={tauxTva}
                onChange={e => setTauxTva(parseFloat(e.target.value) || 0)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          {/* Postes */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Postes
            </h3>

            <div className="space-y-4">
              {postes.map((poste, idx) => {
                const pc = postesCalc[idx];
                const hpj = heuresParJour(poste.heure_debut, poste.heure_fin);
                const jps = joursParSemaine(poste.jours);
                const coutM = coutMensuelPoste(pc);
                const tauxCnaps = poste.service_id ? (servicesCnaps[poste.service_id] ?? 0) : 0;
                const cnapsM = tauxCnaps > 0 ? Math.round(coutM * tauxCnaps / 100) : 0;

                return (
                  <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm text-gray-600">Poste {idx + 1}</span>
                      {postes.length > 1 && (
                        <button onClick={() => removePoste(idx)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Prestation</label>
                        <select
                          value={poste.service_id || ''}
                          onChange={e => {
                            const val = parseInt(e.target.value);
                            if (val) selectService(idx, val);
                          }}
                          className="w-full border rounded px-2 py-1.5 text-sm"
                        >
                          <option value="">Choisir...</option>
                          {services.map(s => (
                            <option key={s.id} value={s.id}>{s.nom}</option>
                          ))}
                        </select>
                        {!poste.service_id && (
                          <input
                            type="text"
                            value={poste.service_nom}
                            onChange={e => updatePoste(idx, 'service_nom', e.target.value)}
                            placeholder="Ou saisir manuellement"
                            className="w-full border rounded px-2 py-1.5 text-sm mt-1"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Effectif</label>
                        <input
                          type="number"
                          min={1}
                          value={poste.effectif}
                          onChange={e => updatePoste(idx, 'effectif', parseInt(e.target.value) || 1)}
                          className="w-full border rounded px-2 py-1.5 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Taux horaire</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.5"
                            value={poste.taux_horaire}
                            onChange={e => updatePoste(idx, 'taux_horaire', parseFloat(e.target.value) || 0)}
                            className="w-full border rounded px-2 py-1.5 text-sm pr-8"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">/h</span>
                        </div>
                      </div>
                    </div>

                    {/* Jours */}
                    <div className="mt-3">
                      <label className="block text-xs text-gray-500 mb-1">Jours</label>
                      <div className="flex gap-1">
                        {JOURS_LABELS.map((label, j) => (
                          <button
                            key={j}
                            type="button"
                            onClick={() => toggleJour(idx, j)}
                            className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                              poste.jours[j]
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Horaires */}
                    <div className="mt-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <input
                        type="time"
                        value={poste.heure_debut}
                        onChange={e => updatePoste(idx, 'heure_debut', e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      />
                      <span className="text-gray-400">→</span>
                      <input
                        type="time"
                        value={poste.heure_fin}
                        onChange={e => updatePoste(idx, 'heure_fin', e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      />
                      <span className="text-xs text-gray-500 ml-2">
                        ({hpj.toFixed(1)}h/jour)
                      </span>
                    </div>

                    {/* Cout mensuel */}
                    <div className="mt-3 text-sm text-gray-600 bg-white rounded px-3 py-2">
                      Cout mensuel : {poste.effectif} x {hpj.toFixed(1)}h x {jps}j x 4,33 = <strong className="text-blue-600">{formatMontant(coutM)}</strong>
                      {cnapsM > 0 && (
                        <span className="text-gray-500 ml-2">+ CNAPS {formatMontant(cnapsM)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addPoste}
              className="mt-3 flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Ajouter un poste
            </button>
          </div>

          {/* Numero commande + Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">N° commande / bon de commande</label>
            <input
              type="text"
              value={numeroCommande}
              onChange={e => setNumeroCommande(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="PO-2026-001..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="Notes internes..."
            />
          </div>

          {/* Recap */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">Recap</h4>
              <div className="flex gap-1">
                <button
                  onClick={() => setViewMode('mensuel')}
                  className={`px-3 py-1 rounded-full text-xs ${viewMode === 'mensuel' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
                >
                  Mensuel
                </button>
                <button
                  onClick={() => setViewMode('annuel')}
                  className={`px-3 py-1 rounded-full text-xs ${viewMode === 'annuel' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'}`}
                >
                  Annuel
                </button>
              </div>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total heures/semaine</span>
                <span className="font-medium">{recap.totalHeuresSemaine.toFixed(1)}h</span>
              </div>
              {recap.montantCnaps > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Taxe CNAPS</span>
                  <span>{formatMontant(viewMode === 'mensuel' ? recap.montantCnaps : recap.montantCnaps * 12)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">
                  {viewMode === 'mensuel' ? 'Cout mensuel HT' : 'Cout annuel HT'}
                  {recap.montantCnaps > 0 ? ' (incl. CNAPS)' : ''}
                </span>
                <span className="font-bold text-blue-600 text-lg">
                  {formatMontant(viewMode === 'mensuel' ? recap.coutMensuelHT : recap.coutAnnuelHT)}
                </span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>TVA ({tauxTva}%)</span>
                <span>
                  {formatMontant(
                    Math.round((viewMode === 'mensuel' ? recap.coutMensuelHT : recap.coutAnnuelHT) * tauxTva / 100)
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !nom || !dateDebut || !dateFin || postes.some(p => !p.service_nom)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (isEditing ? 'Enregistrement...' : 'Creation...') : (isEditing ? 'Enregistrer' : 'Creer le forfait')}
            {!isLoading && <span>→</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
