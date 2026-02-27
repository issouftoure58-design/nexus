import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { comptaApi, Devis, DevisStats, DevisCreateData } from '../lib/api';
import { X, Printer, Download, Send, Edit2, Check, XCircle, Play, Clock, User, MapPin, Phone, Mail, Calendar, FileText, Users } from 'lucide-react';
import { useProfile } from '../contexts/ProfileContext';
import { FeatureField, PricingFields } from '../components/forms';

// Types pour les données
interface Client {
  id: number;
  prenom: string;
  nom: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
  type_client?: string;
  raison_sociale?: string;
}

interface Service {
  id: number;
  nom: string;
  prix: number;
  duree: number;
  taux_horaire?: number; // centimes/heure
}

type StatutDevis = 'brouillon' | 'envoye' | 'accepte' | 'rejete' | 'expire' | 'annule' | 'execute';

const STATUT_LABELS: Record<StatutDevis, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon', color: 'text-gray-600', bg: 'bg-gray-100' },
  envoye: { label: 'Envoyé', color: 'text-blue-600', bg: 'bg-blue-100' },
  accepte: { label: 'Accepté', color: 'text-green-600', bg: 'bg-green-100' },
  execute: { label: 'Exécuté', color: 'text-purple-600', bg: 'bg-purple-100' },
  rejete: { label: 'Rejeté', color: 'text-red-600', bg: 'bg-red-100' },
  expire: { label: 'Expiré', color: 'text-orange-600', bg: 'bg-orange-100' },
  annule: { label: 'Annulé', color: 'text-gray-500', bg: 'bg-gray-200' },
};

export default function DevisPage() {
  const queryClient = useQueryClient();
  const [filtreStatut, setFiltreStatut] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingDevis, setEditingDevis] = useState<Devis | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState<Devis | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<Devis | null>(null);
  const [showExecuteModal, setShowExecuteModal] = useState<Devis | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<string | null>(null);

  // Récupérer les devis
  const { data, isLoading, error } = useQuery({
    queryKey: ['devis', filtreStatut],
    queryFn: () => comptaApi.getDevis({ statut: filtreStatut || undefined }),
  });

  const devisList = data?.devis || [];
  const stats = data?.stats;

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: DevisCreateData) => comptaApi.createDevis(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setShowForm(false);
      setEditingDevis(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Devis> }) => comptaApi.updateDevis(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setShowForm(false);
      setEditingDevis(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => comptaApi.deleteDevis(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devis'] }),
  });

  const envoyerMutation = useMutation({
    mutationFn: (id: string) => comptaApi.envoyerDevis(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devis'] }),
  });

  const accepterMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/devis/${id}/accepter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}`
        }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur acceptation');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setShowAcceptModal(null);
    },
  });

  const rejeterMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { raison?: string } }) =>
      comptaApi.rejeterDevis(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setShowRejectModal(null);
    },
  });

  // Change status mutation
  const changeStatutMutation = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: StatutDevis }) => {
      const res = await fetch(`/api/admin/devis/${id}/statut`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}`
        },
        body: JSON.stringify({ statut })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur changement statut');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
    },
  });

  // Execute mutation - crée une prestation
  const executerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { date_rdv: string; heure_rdv: string; affectations?: Array<{ ressource_id: number; ligne_id?: number }> } }) => {
      const res = await fetch(`/api/admin/devis/${id}/executer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur exécution');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setShowExecuteModal(null);
    },
  });

  const formatMontant = (centimes: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(centimes / 100);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Erreur lors du chargement des devis
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devis</h1>
          <p className="text-sm text-gray-500">Gestion des devis clients</p>
        </div>
        <button
          onClick={() => {
            setEditingDevis(null);
            setShowForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouveau devis
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg p-4 border">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 border">
            <p className="text-sm text-gray-500">Brouillons</p>
            <p className="text-2xl font-bold text-gray-600">{stats.brouillon}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border">
            <p className="text-sm text-blue-600">Envoyés</p>
            <p className="text-2xl font-bold text-blue-600">{stats.envoye}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border">
            <p className="text-sm text-green-600">Acceptés</p>
            <p className="text-2xl font-bold text-green-600">{stats.accepte}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 border">
            <p className="text-sm text-red-600">Rejetés</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejete}</p>
          </div>
          <div className="bg-white rounded-lg p-4 border">
            <p className="text-sm text-gray-500">Montant total</p>
            <p className="text-xl font-bold text-blue-600">{formatMontant(stats.montant_total)}</p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-2">
        <button
          onClick={() => setFiltreStatut('')}
          className={`px-3 py-1.5 rounded-full text-sm ${
            filtreStatut === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          Tous
        </button>
        {Object.entries(STATUT_LABELS).map(([key, { label, bg }]) => (
          <button
            key={key}
            onClick={() => setFiltreStatut(key)}
            className={`px-3 py-1.5 rounded-full text-sm ${
              filtreStatut === key ? 'bg-blue-600 text-white' : `${bg} hover:opacity-80`
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Liste des devis */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant TTC</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {devisList.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  Aucun devis trouvé
                </td>
              </tr>
            ) : (
              devisList.map((devis: Devis) => {
                const statutConfig = STATUT_LABELS[devis.statut as StatutDevis];
                const isExpired = devis.date_expiration && new Date(devis.date_expiration) < new Date();
                return (
                  <tr key={devis.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setShowDetailModal(devis.id)}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {devis.numero}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{devis.client_nom || '-'}</div>
                      <div className="text-sm text-gray-500">{devis.client_email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {devis.service_nom || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      {formatMontant(devis.montant_ttc)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(devis.date_devis)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={isExpired && devis.statut === 'envoye' ? 'text-red-600 font-medium' : 'text-gray-500'}>
                        {devis.date_expiration ? formatDate(devis.date_expiration) : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={devis.statut}
                        onChange={(e) => {
                          const newStatut = e.target.value;
                          if (newStatut !== devis.statut) {
                            if (confirm(`Changer le statut vers "${STATUT_LABELS[newStatut as StatutDevis]?.label}" ?`)) {
                              changeStatutMutation.mutate({ id: devis.id, statut: newStatut as StatutDevis });
                            } else {
                              e.target.value = devis.statut; // Reset
                            }
                          }
                        }}
                        className={`px-2 py-1 text-xs rounded-full border-0 cursor-pointer ${statutConfig?.bg} ${statutConfig?.color}`}
                      >
                        {Object.entries(STATUT_LABELS).map(([key, { label }]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex justify-end gap-2">
                        {devis.statut === 'brouillon' && (
                          <>
                            <button
                              onClick={() => {
                                setEditingDevis(devis);
                                setShowForm(true);
                              }}
                              className="text-blue-600 hover:text-blue-800"
                              title="Modifier"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => envoyerMutation.mutate(devis.id)}
                              className="text-green-600 hover:text-green-800"
                              title="Envoyer"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                            </button>
                            <button
                              onClick={() => {
                                if (confirm('Supprimer ce devis ?')) {
                                  deleteMutation.mutate(devis.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-800"
                              title="Supprimer"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                        {devis.statut === 'envoye' && (
                          <>
                            <button
                              onClick={() => setShowAcceptModal(devis)}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              Accepter
                            </button>
                            <button
                              onClick={() => setShowRejectModal(devis)}
                              className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                            >
                              Rejeter
                            </button>
                          </>
                        )}
                        {devis.statut === 'accepte' && (
                          <button
                            onClick={() => setShowExecuteModal(devis)}
                            className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 font-medium"
                          >
                            Exécuter
                          </button>
                        )}
                        <button
                          onClick={() => setShowDetailModal(devis.id)}
                          className="text-gray-600 hover:text-gray-800"
                          title="Voir détails"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Formulaire */}
      {showForm && (
        <DevisFormModal
          devis={editingDevis}
          onClose={() => {
            setShowForm(false);
            setEditingDevis(null);
          }}
          onSubmit={(data) => {
            if (editingDevis) {
              updateMutation.mutate({ id: editingDevis.id, data });
            } else {
              createMutation.mutate(data);
            }
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Modal Acceptation */}
      {showAcceptModal && (
        <AcceptDevisModal
          devis={showAcceptModal}
          onClose={() => setShowAcceptModal(null)}
          onAccept={() => accepterMutation.mutate(showAcceptModal.id)}
          isLoading={accepterMutation.isPending}
        />
      )}

      {/* Modal Exécution */}
      {showExecuteModal && (
        <ExecuteDevisModal
          devis={showExecuteModal}
          onClose={() => setShowExecuteModal(null)}
          onExecute={(data) => executerMutation.mutate({ id: showExecuteModal.id, data })}
          isLoading={executerMutation.isPending}
        />
      )}

      {/* Modal Rejet */}
      {showRejectModal && (
        <RejectDevisModal
          devis={showRejectModal}
          onClose={() => setShowRejectModal(null)}
          onReject={(raison) => rejeterMutation.mutate({ id: showRejectModal.id, data: { raison } })}
          isLoading={rejeterMutation.isPending}
        />
      )}

      {/* Modal Détail/Aperçu */}
      {showDetailModal && (
        <DevisDetailModal
          devisId={showDetailModal}
          onClose={() => setShowDetailModal(null)}
          onEdit={(devis) => {
            setShowDetailModal(null);
            setEditingDevis(devis);
            setShowForm(true);
          }}
          onSend={(id) => {
            envoyerMutation.mutate(id);
            setShowDetailModal(null);
          }}
          onAccept={(devis) => {
            setShowDetailModal(null);
            setShowAcceptModal(devis);
          }}
          onReject={(devis) => {
            setShowDetailModal(null);
            setShowRejectModal(devis);
          }}
          onExecute={(devis) => {
            setShowDetailModal(null);
            setShowExecuteModal(devis);
          }}
        />
      )}
    </div>
  );
}

// ============================================
// COMPOSANTS MODALS
// ============================================

// Affectation individuelle pour chaque unité de service
interface ServiceAffectation {
  index: number;
  membre_id?: number;
  membre_nom?: string;
  heure_debut?: string;
  heure_fin?: string;
}

interface ServiceLigne {
  service_id: number;
  service_nom: string;
  quantite: number;
  prix_unitaire: number;
  duree_minutes: number;
  // Mode horaire
  taux_horaire?: number; // centimes/heure
  // Affectations multiples (une par quantité)
  affectations: ServiceAffectation[];
  // Legacy - pour compatibilité
  heure_debut?: string;
  heure_fin?: string;
}

interface DevisFormModalProps {
  devis: Devis | null;
  onClose: () => void;
  onSubmit: (data: DevisCreateData) => void;
  isLoading: boolean;
}

function DevisFormModal({ devis, onClose, onSubmit, isLoading }: DevisFormModalProps) {
  // Profile métier
  const { profile, t, isPricingMode } = useProfile();

  // Client state
  const [clientMode, setClientMode] = useState<'existant' | 'nouveau'>('existant');
  const [clientSearch, setClientSearch] = useState(devis?.client_nom || '');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [nouveauClient, setNouveauClient] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    adresse: ''
  });

  // Services state
  const [serviceLignes, setServiceLignes] = useState<ServiceLigne[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number>(0);

  // Form state
  const devisTyped = devis as (Devis & { date_prestation?: string; heure_prestation?: string; date_fin_prestation?: string; heure_fin_prestation?: string; nb_agents?: number }) | null;
  const [formData, setFormData] = useState({
    client_adresse: devis?.client_adresse || '',
    adresse_facturation: '',
    date_prestation: devisTyped?.date_prestation || '',
    heure_prestation: devisTyped?.heure_prestation || '',
    date_fin_prestation: devisTyped?.date_fin_prestation || '',
    heure_fin_prestation: devisTyped?.heure_fin_prestation || '',
    nb_agents: devisTyped?.nb_agents || 1,
    taux_tva: devis?.taux_tva || 20,
    validite_jours: devis?.validite_jours || 30,
    notes: devis?.notes || '',
    remise_type: 'aucune' as 'aucune' | 'pourcentage' | 'montant',
    remise_valeur: 0,
    remise_motif: ''
  });

  // Adresse facturation même que prestation
  const [memeAdresse, setMemeAdresse] = useState(true);

  // Fetch clients
  const { data: clientsData } = useQuery({
    queryKey: ['clients-search', clientSearch],
    queryFn: async () => {
      if (!clientSearch || clientSearch.length < 2) return { clients: [] };
      const res = await fetch(`/api/admin/clients?search=${encodeURIComponent(clientSearch)}&limit=10`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      return res.json();
    },
    enabled: clientSearch.length >= 2 && clientMode === 'existant'
  });

  // Fetch services
  const { data: servicesData } = useQuery<{ services: Service[] }>({
    queryKey: ['services'],
    queryFn: async () => {
      const res = await fetch('/api/admin/services', {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      return res.json();
    }
  });

  // Fetch membres équipe pour assignation
  const { data: membresData } = useQuery<Array<{ id: number; nom: string; prenom: string; role: string }>>({
    queryKey: ['membres-equipe'],
    queryFn: async () => {
      const res = await fetch('/api/admin/rh/membres', {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      return res.json();
    }
  });

  // Add service
  const handleAddService = () => {
    if (!selectedServiceId) return;
    const service = servicesData?.services?.find(s => s.id === selectedServiceId);
    if (!service) return;

    const existing = serviceLignes.find(l => l.service_id === selectedServiceId);
    if (existing) {
      // Incrémenter la quantité et ajouter une affectation
      setServiceLignes(prev => prev.map(l => {
        if (l.service_id === selectedServiceId) {
          const newQuantite = l.quantite + 1;
          const newAffectations = [...l.affectations, { index: newQuantite - 1 }];
          return { ...l, quantite: newQuantite, affectations: newAffectations };
        }
        return l;
      }));
    } else {
      setServiceLignes(prev => [...prev, {
        service_id: service.id,
        service_nom: service.nom,
        quantite: 1,
        prix_unitaire: service.prix / 100,
        duree_minutes: service.duree,
        taux_horaire: service.taux_horaire,
        affectations: [{ index: 0 }]
      }]);
    }
    setSelectedServiceId(0);
  };

  // Remove service
  const handleRemoveService = (serviceId: number) => {
    setServiceLignes(prev => prev.filter(l => l.service_id !== serviceId));
  };

  // Update service line
  const handleUpdateServiceLigne = (serviceId: number, field: keyof ServiceLigne, value: number | string) => {
    setServiceLignes(prev => prev.map(l =>
      l.service_id === serviceId ? { ...l, [field]: value } : l
    ));
  };

  // Update service quantity with affectations management
  const handleUpdateQuantite = (serviceId: number, newQuantite: number) => {
    if (newQuantite < 1) {
      handleRemoveService(serviceId);
      return;
    }

    setServiceLignes(prev => prev.map(l => {
      if (l.service_id !== serviceId) return l;

      // Ajuster le nombre d'affectations selon la nouvelle quantité
      let newAffectations = [...(l.affectations || [])];
      const currentCount = newAffectations.length;

      if (newQuantite > currentCount) {
        // Ajouter des affectations
        for (let i = currentCount; i < newQuantite; i++) {
          newAffectations.push({ index: i });
        }
      } else if (newQuantite < currentCount) {
        // Supprimer les dernières affectations
        newAffectations = newAffectations.slice(0, newQuantite);
      }

      return { ...l, quantite: newQuantite, affectations: newAffectations };
    }));
  };

  // Helper: Calculer heure de fin depuis heure début + durée
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    if (!startTime) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  // Update individual affectation
  const updateAffectation = (
    serviceId: number,
    affectationIndex: number,
    field: keyof ServiceAffectation,
    value: number | string | undefined
  ) => {
    setServiceLignes(prev =>
      prev.map(l => {
        if (l.service_id !== serviceId) return l;

        const newAffectations = l.affectations.map((aff, idx) => {
          if (idx !== affectationIndex) return aff;

          // Auto-calcul heure_fin quand heure_debut change
          if (field === 'heure_debut' && value) {
            const heureFin = calculateEndTime(value as string, l.duree_minutes);
            return { ...aff, heure_debut: value as string, heure_fin: heureFin };
          }

          return { ...aff, [field]: value };
        });

        return { ...l, affectations: newAffectations };
      })
    );
  };

  // Helper: Calculer les heures entre deux horaires
  const calculateHours = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    // Nettoyer les heures (remplacer -- par 00)
    const cleanStart = startTime.replace('--', '00');
    const cleanEnd = endTime.replace('--', '00');
    const [startH, startM] = cleanStart.split(':').map(Number);
    const [endH, endM] = cleanEnd.split(':').map(Number);
    if (isNaN(startH) || isNaN(endH)) return 0;
    let startMinutes = startH * 60 + (startM || 0);
    let endMinutes = endH * 60 + (endM || 0);
    if (endMinutes < startMinutes) endMinutes += 24 * 60;
    return Math.round((endMinutes - startMinutes) / 60 * 100) / 100;
  };

  // Helper: Calculer le nombre de jours entre deux dates
  const calculateDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 pour inclure le jour de début
    return Math.max(1, diffDays);
  };

  // Calculate totals
  const calculs = (() => {
    const pricingMode = profile?.pricing?.mode || 'fixed';
    let sousTotal = 0;
    let dureeTotale = 0;
    let nbJours = 1;
    let nbAgentsEffectif = 0;
    let totalHeuresAffectations = 0;

    if (pricingMode === 'hourly') {
      // Mode horaire: calculer à partir des affectations (heures par agent)
      nbJours = formData.date_fin_prestation && formData.date_prestation
        ? calculateDays(formData.date_prestation, formData.date_fin_prestation)
        : 1;

      sousTotal = serviceLignes.reduce((sum, l) => {
        const tauxHoraire = l.taux_horaire || l.prix_unitaire * 100; // Convertir si nécessaire

        // Calculer pour chaque affectation qui a des heures définies
        let serviceMontant = 0;
        l.affectations.forEach(aff => {
          if (aff.heure_debut && aff.heure_fin) {
            const heuresAgent = calculateHours(aff.heure_debut, aff.heure_fin);
            serviceMontant += Math.round((tauxHoraire / 100) * heuresAgent * nbJours);
            totalHeuresAffectations += heuresAgent;
            nbAgentsEffectif++;
          }
        });

        return sum + serviceMontant;
      }, 0);

      dureeTotale = Math.round(totalHeuresAffectations * 60 * nbJours);
    } else {
      // Mode fixe: prix × quantité
      sousTotal = serviceLignes.reduce((sum, l) => sum + (l.prix_unitaire * l.quantite), 0);
      dureeTotale = serviceLignes.reduce((sum, l) => sum + (l.duree_minutes * l.quantite), 0);
    }

    let montantHT = sousTotal;
    let montantRemise = 0;

    if (formData.remise_type === 'pourcentage' && formData.remise_valeur > 0) {
      montantRemise = montantHT * formData.remise_valeur / 100;
    } else if (formData.remise_type === 'montant' && formData.remise_valeur > 0) {
      montantRemise = formData.remise_valeur;
    }

    montantHT -= montantRemise;
    const montantTVA = montantHT * formData.taux_tva / 100;
    const montantTTC = montantHT + montantTVA;

    return { sousTotal, dureeTotale, montantRemise, montantHT, montantTVA, montantTTC, pricingMode, nbJours, nbAgents: nbAgentsEffectif || formData.nb_agents };
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const clientNom = clientMode === 'existant' && selectedClient
      ? (selectedClient.type_client === 'professionnel' || selectedClient.raison_sociale
          ? selectedClient.raison_sociale || `${selectedClient.prenom} ${selectedClient.nom}`
          : `${selectedClient.prenom} ${selectedClient.nom}`)
      : `${nouveauClient.prenom} ${nouveauClient.nom}`;

    const clientEmail = clientMode === 'existant' && selectedClient
      ? selectedClient.email
      : nouveauClient.email;

    const clientTelephone = clientMode === 'existant' && selectedClient
      ? selectedClient.telephone
      : nouveauClient.telephone;

    const clientAdresse = clientMode === 'existant' && selectedClient
      ? selectedClient.adresse || formData.client_adresse
      : nouveauClient.adresse;

    // Adresse de facturation : si "même adresse", utiliser l'adresse de prestation
    const adresseFacturation = memeAdresse ? clientAdresse : formData.adresse_facturation;

    const serviceNom = serviceLignes.map(l => `${l.service_nom} x${l.quantite}`).join(', ');
    const dureeMinutes = calculs.dureeTotale;

    // Préparer les lignes de services pour stockage individuel avec affectations
    const lignes = serviceLignes.map(l => ({
      service_id: l.service_id,
      service_nom: l.service_nom,
      quantite: l.quantite,
      duree_minutes: l.duree_minutes,
      prix_unitaire: Math.round(l.prix_unitaire * 100),
      prix_total: Math.round(l.prix_unitaire * l.quantite * 100),
      taux_horaire: l.taux_horaire || null,
      // Affectations avec heures et membres (pour mode horaire)
      affectations: l.affectations.map(aff => ({
        membre_id: aff.membre_id,
        heure_debut: aff.heure_debut,
        heure_fin: aff.heure_fin
      }))
    }));

    // Extraire les membre_ids uniques des affectations
    const membreIdsFromServices: number[] = [];
    serviceLignes.forEach(sl => {
      sl.affectations.forEach(aff => {
        if (aff.membre_id) {
          membreIdsFromServices.push(aff.membre_id);
        }
      });
    });
    const uniqueMembreIds = [...new Set(membreIdsFromServices)];

    onSubmit({
      // Client ID pour lien avec la base clients
      client_id: clientMode === 'existant' && selectedClient ? selectedClient.id : undefined,
      client_nom: clientNom,
      client_email: clientEmail,
      client_telephone: clientTelephone,
      client_adresse: formData.client_adresse || clientAdresse,
      adresse_facturation: adresseFacturation,
      service_nom: serviceNom,
      service_description: formData.notes,
      duree_minutes: dureeMinutes,
      montant_ht: Math.round(calculs.montantHT * 100),
      taux_tva: formData.taux_tva,
      validite_jours: formData.validite_jours,
      notes: formData.notes,
      lignes: lignes,
      date_prestation: formData.date_prestation || undefined,
      date_fin_prestation: formData.date_fin_prestation || undefined,
      heure_prestation: formData.heure_prestation || undefined,
      // Mode horaire : informations supplémentaires
      pricing_mode: calculs.pricingMode,
      nb_jours: calculs.nbJours,
      nb_agents: calculs.nbAgents,
      // Liste des membres assignés
      membre_ids: uniqueMembreIds,
    });
  };

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
        {/* Header with close button */}
        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold">
            {devis ? `Modifier devis ${devis.numero}` : 'Nouveau devis'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Section Client */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-gray-700">Client</h3>

            {/* Mode selection */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={clientMode === 'existant'}
                  onChange={() => setClientMode('existant')}
                  className="text-blue-600"
                />
                <span>Client existant</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={clientMode === 'nouveau'}
                  onChange={() => setClientMode('nouveau')}
                  className="text-blue-600"
                />
                <span>Nouveau client</span>
              </label>
            </div>

            {clientMode === 'existant' ? (
              <div className="relative">
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setShowClientDropdown(true);
                    setSelectedClient(null);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Rechercher un client..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {showClientDropdown && clientsData?.clients?.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {clientsData.clients.map((client: Client) => {
                      const isPro = client.type_client === 'professionnel' || !!client.raison_sociale;
                      const displayName = isPro && client.raison_sociale
                        ? client.raison_sociale
                        : `${client.prenom} ${client.nom}`;
                      return (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setSelectedClient(client);
                            setClientSearch(displayName);
                            setShowClientDropdown(false);
                            // Construire l'adresse complète si disponible
                            const adresseComplete = [
                              client.adresse,
                              client.code_postal,
                              client.ville
                            ].filter(Boolean).join(', ');
                            if (adresseComplete) {
                              setFormData(prev => ({ ...prev, client_adresse: adresseComplete }));
                            }
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b last:border-b-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{displayName}</span>
                            {isPro && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">PRO</span>
                            )}
                          </div>
                          {isPro && client.raison_sociale && (
                            <div className="text-xs text-gray-400">Contact: {client.prenom} {client.nom}</div>
                          )}
                          <div className="text-sm text-gray-500">{client.telephone} - {client.email}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedClient && (() => {
                  const isPro = selectedClient.type_client === 'professionnel' || !!selectedClient.raison_sociale;
                  const displayName = isPro && selectedClient.raison_sociale
                    ? selectedClient.raison_sociale
                    : `${selectedClient.prenom} ${selectedClient.nom}`;
                  return (
                    <div className={`mt-2 p-3 rounded-lg ${isPro ? 'bg-orange-50' : 'bg-blue-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{displayName}</span>
                        {isPro && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">PRO</span>
                        )}
                      </div>
                      {isPro && selectedClient.raison_sociale && (
                        <div className="text-xs text-gray-500">Contact: {selectedClient.prenom} {selectedClient.nom}</div>
                      )}
                      <div className="text-sm text-gray-600">{selectedClient.telephone} - {selectedClient.email}</div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Prénom *"
                  value={nouveauClient.prenom}
                  onChange={(e) => setNouveauClient({ ...nouveauClient, prenom: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required={clientMode === 'nouveau'}
                />
                <input
                  type="text"
                  placeholder="Nom *"
                  value={nouveauClient.nom}
                  onChange={(e) => setNouveauClient({ ...nouveauClient, nom: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required={clientMode === 'nouveau'}
                />
                <input
                  type="tel"
                  placeholder="Téléphone *"
                  value={nouveauClient.telephone}
                  onChange={(e) => setNouveauClient({ ...nouveauClient, telephone: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required={clientMode === 'nouveau'}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={nouveauClient.email}
                  onChange={(e) => setNouveauClient({ ...nouveauClient, email: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

          </div>

          {/* Section Adresse / Lieu de prestation */}
          <div className="bg-blue-50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Adresse de prestation
            </h3>
            <textarea
              value={clientMode === 'nouveau' ? nouveauClient.adresse : formData.client_adresse}
              onChange={(e) => {
                if (clientMode === 'nouveau') {
                  setNouveauClient({ ...nouveauClient, adresse: e.target.value });
                } else {
                  setFormData({ ...formData, client_adresse: e.target.value });
                }
              }}
              placeholder="Adresse complète du lieu de prestation&#10;Ex: 123 Rue de Paris, 75001 Paris&#10;ou: Salon - 45 Avenue des Champs-Élysées"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
            />
            <p className="text-xs text-gray-500">
              Indiquez l'adresse où aura lieu la prestation (salon, domicile du client, hôtel, etc.)
            </p>
          </div>

          {/* Section Adresse de facturation */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-600" />
                Adresse de facturation
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={memeAdresse}
                  onChange={(e) => setMemeAdresse(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Identique à l'adresse de prestation</span>
              </label>
            </div>
            {!memeAdresse && (
              <textarea
                value={formData.adresse_facturation}
                onChange={(e) => setFormData({ ...formData, adresse_facturation: e.target.value })}
                placeholder="Adresse de facturation si différente&#10;Ex: 456 Boulevard Saint-Germain, 75006 Paris"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            )}
          </div>

          {/* Section Période (Mode Horaire - avant les services) */}
          {isPricingMode('hourly') && (
            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Période de la {t('reservation', false).toLowerCase()} *
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Du *</label>
                  <input
                    type="date"
                    value={formData.date_prestation}
                    onChange={(e) => setFormData({ ...formData, date_prestation: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Au *</label>
                  <input
                    type="date"
                    value={formData.date_fin_prestation || formData.date_prestation}
                    onChange={(e) => setFormData({ ...formData, date_fin_prestation: e.target.value })}
                    min={formData.date_prestation}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              {formData.date_prestation && formData.date_fin_prestation && formData.date_fin_prestation !== formData.date_prestation && (
                <p className="text-sm text-blue-600">
                  {calculateDays(formData.date_prestation, formData.date_fin_prestation)} jour(s)
                </p>
              )}
            </div>
          )}

          {/* Section Services */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-gray-700">Prestations</h3>

            {/* Add service */}
            <div className="flex gap-2">
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(parseInt(e.target.value))}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>Sélectionner un service...</option>
                {servicesData?.services?.map((service: Service) => (
                  <option key={service.id} value={service.id}>
                    {service.nom} - {(service.prix / 100).toFixed(2)} EUR ({service.duree} min)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddService}
                disabled={!selectedServiceId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>

            {/* Services list */}
            {serviceLignes.length > 0 && (
              <div className="space-y-2">
                {serviceLignes.map((ligne) => {
                  const tauxHoraire = ligne.taux_horaire || ligne.prix_unitaire * 100;
                  const heures = isPricingMode('hourly') && formData.heure_prestation && formData.heure_fin_prestation
                    ? calculateHours(formData.heure_prestation, formData.heure_fin_prestation)
                    : 0;
                  const prixLigne = isPricingMode('hourly')
                    ? (tauxHoraire / 100) * heures * formData.nb_agents
                    : ligne.prix_unitaire * ligne.quantite;

                  return (
                  <div key={ligne.service_id} className="p-3 bg-white rounded-lg border space-y-2">
                    {/* Ligne 1: Service + Prix */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-medium">{ligne.service_nom}</div>
                        <div className="text-sm text-gray-500">
                          {isPricingMode('hourly')
                            ? `${(tauxHoraire / 100).toFixed(2)}€/h`
                            : `${ligne.duree_minutes} min`
                          }
                        </div>
                      </div>
                      {/* Quantité uniquement en mode fixe */}
                      {!isPricingMode('hourly') && (
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">Qté:</label>
                          <input
                            type="number"
                            min="1"
                            value={ligne.quantite}
                            onChange={(e) => handleUpdateQuantite(ligne.service_id, parseInt(e.target.value) || 1)}
                            className="w-16 px-2 py-1 border rounded text-center"
                          />
                        </div>
                      )}
                      {!isPricingMode('hourly') && (
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">Prix:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={ligne.prix_unitaire}
                            onChange={(e) => handleUpdateServiceLigne(ligne.service_id, 'prix_unitaire', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border rounded text-right"
                          />
                          <span className="text-sm">EUR</span>
                        </div>
                      )}
                      <div className="font-medium text-blue-600 min-w-[100px] text-right">
                        {isPricingMode('hourly') && heures > 0 ? (
                          <div>
                            <div>{prixLigne.toFixed(2)} EUR</div>
                            <div className="text-xs text-gray-400 font-normal">
                              {heures}h × {formData.nb_agents} {t('employee', formData.nb_agents > 1).toLowerCase()}
                            </div>
                          </div>
                        ) : isPricingMode('hourly') ? (
                          <span className="text-xs text-amber-600 font-normal">Saisir les heures</span>
                        ) : (
                          <span>{prixLigne.toFixed(2)} EUR</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(ligne.service_id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Affectations multiples (une par quantité) */}
                    {(ligne.affectations || []).map((affectation, affIdx) => (
                      <div key={affIdx} className="pt-2 border-t border-gray-100 space-y-2">
                        {/* Label si plusieurs affectations */}
                        {ligne.quantite > 1 && (
                          <p className="text-xs font-medium text-blue-600 mb-1">
                            Affectation #{affIdx + 1}
                          </p>
                        )}

                        {/* Assignation membre */}
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <select
                            value={affectation.membre_id || ''}
                            onChange={(e) => updateAffectation(
                              ligne.service_id,
                              affIdx,
                              'membre_id',
                              e.target.value ? parseInt(e.target.value) : undefined
                            )}
                            className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">-- Assigner {t('employee', false).toLowerCase()} --</option>
                            {membresData?.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.prenom} {m.nom} ({m.role})
                              </option>
                            ))}
                          </select>
                          {affectation.membre_id && (
                            <span className="text-xs text-green-600">✓</span>
                          )}
                        </div>

                        {/* Horaires pour cette affectation */}
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-600">Horaires:</span>
                          <input
                            type="time"
                            value={affectation.heure_debut || ''}
                            onChange={(e) => updateAffectation(
                              ligne.service_id,
                              affIdx,
                              'heure_debut',
                              e.target.value
                            )}
                            className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Début"
                          />
                          <span className="text-gray-400">→</span>
                          <input
                            type="time"
                            value={affectation.heure_fin || ''}
                            onChange={(e) => updateAffectation(
                              ligne.service_id,
                              affIdx,
                              'heure_fin',
                              e.target.value
                            )}
                            className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Fin"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  );
                })}
              </div>
            )}

            {serviceLignes.length === 0 && (
              <p className="text-center text-gray-500 py-4">Aucune prestation sélectionnée</p>
            )}
          </div>

          {/* Section Période de la Prestation (Mode NON-Horaire) */}
          {!isPricingMode('hourly') && (
          <div className="bg-green-50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-green-600" />
              Période de la prestation
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date début *</label>
                <input
                  type="date"
                  value={formData.date_prestation}
                  onChange={(e) => setFormData({ ...formData, date_prestation: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heure début *</label>
                <input
                  type="time"
                  value={formData.heure_prestation}
                  onChange={(e) => setFormData({ ...formData, heure_prestation: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                <input
                  type="date"
                  value={formData.date_fin_prestation}
                  onChange={(e) => setFormData({ ...formData, date_fin_prestation: e.target.value })}
                  min={formData.date_prestation}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heure fin</label>
                <input
                  type="time"
                  value={formData.heure_fin_prestation}
                  onChange={(e) => setFormData({ ...formData, heure_fin_prestation: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Validité du devis (jours)</label>
                <input
                  type="number"
                  value={formData.validite_jours}
                  onChange={(e) => setFormData({ ...formData, validite_jours: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Ces informations seront utilisées lors de l'exécution du devis pour planifier la prestation.
            </p>
          </div>
          )}

          {/* Geste commercial */}
          <div className="bg-yellow-50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-700">Geste commercial</h3>
            <div className="flex gap-4 items-center">
              <select
                value={formData.remise_type}
                onChange={(e) => setFormData({ ...formData, remise_type: e.target.value as 'aucune' | 'pourcentage' | 'montant' })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="aucune">Aucune remise</option>
                <option value="pourcentage">Remise %</option>
                <option value="montant">Remise EUR</option>
              </select>
              {formData.remise_type !== 'aucune' && (
                <>
                  <input
                    type="number"
                    step={formData.remise_type === 'pourcentage' ? '1' : '0.01'}
                    min="0"
                    value={formData.remise_valeur}
                    onChange={(e) => setFormData({ ...formData, remise_valeur: parseFloat(e.target.value) || 0 })}
                    className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span>{formData.remise_type === 'pourcentage' ? '%' : 'EUR'}</span>
                  <input
                    type="text"
                    placeholder="Motif (optionnel)"
                    value={formData.remise_motif}
                    onChange={(e) => setFormData({ ...formData, remise_motif: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Informations complémentaires..."
            />
          </div>

          {/* Résumé montants */}
          <div className="bg-blue-50 rounded-lg p-4 space-y-2">
            {/* Mode horaire: afficher détail du calcul */}
            {calculs.pricingMode === 'hourly' && calculs.nbAgents > 0 && (
              <div className="text-xs text-blue-700 bg-blue-100 rounded p-2 mb-2">
                <span className="font-medium">Mode horaire:</span>{' '}
                {calculs.nbAgents} agent{calculs.nbAgents > 1 ? 's' : ''} × {calculs.nbJours} jour{calculs.nbJours > 1 ? 's' : ''}
                <span className="block mt-1 text-blue-600">
                  Total: {Math.round(calculs.dureeTotale / 60)}h de vacation
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>Sous-total prestations:</span>
              <span>{calculs.sousTotal.toFixed(2)} EUR</span>
            </div>
            {calculs.montantRemise > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Remise ({formData.remise_type === 'pourcentage' ? `${formData.remise_valeur}%` : 'fixe'}):</span>
                <span>-{calculs.montantRemise.toFixed(2)} EUR</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t pt-2">
              <span>Montant HT:</span>
              <span>{calculs.montantHT.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>TVA ({formData.taux_tva}%):</span>
              <span>{calculs.montantTVA.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total TTC:</span>
              <span className="text-blue-600">{calculs.montantTTC.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Durée totale:</span>
              <span>{Math.floor(calculs.dureeTotale / 60)}h{calculs.dureeTotale % 60 > 0 ? ` ${calculs.dureeTotale % 60}min` : ''}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading || serviceLignes.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Enregistrement...' : devis ? 'Modifier' : 'Créer le devis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AcceptDevisModalProps {
  devis: Devis;
  onClose: () => void;
  onAccept: () => void;
  isLoading: boolean;
}

function AcceptDevisModal({ devis, onClose, onAccept, isLoading }: AcceptDevisModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleBackdropClick}>
      <div className="bg-white rounded-lg w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full">
          <X className="w-5 h-5 text-gray-500" />
        </button>
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-green-600">Accepter le devis</h2>
          <p className="text-sm text-gray-500 mt-1">
            Devis {devis.numero} - {devis.client_nom}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              <strong>Confirmation d'acceptation</strong>
            </p>
            <p className="text-sm text-green-700 mt-2">
              Le devis sera marqué comme accepté. Vous pourrez ensuite l'exécuter pour créer les réservations et affecter le personnel.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Service:</span>
              <span className="font-medium">{devis.service_nom}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Client:</span>
              <span className="font-medium">{devis.client_nom}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Montant:</span>
              <span className="font-medium text-blue-600">{(devis.montant_ttc / 100).toFixed(2)} EUR</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              onClick={onAccept}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Acceptation...' : 'Confirmer l\'acceptation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Interface ressource pour les affectations (modèle générique)
interface Ressource {
  id: number;
  nom: string;
  categorie?: string;
  type?: { nom: string; categorie: string };
  membre?: { nom: string; prenom: string };
}

interface DevisLigne {
  id: number;
  service_id: number;
  service_nom: string;
  quantite: number;
  duree_minutes: number;
  prix_unitaire: number;
  prix_total: number;
  // Affectation (mode horaire)
  membre_id?: number;
  heure_debut?: string;
  heure_fin?: string;
  taux_horaire?: number;
}

interface ExecuteDevisModalProps {
  devis: Devis;
  onClose: () => void;
  onExecute: (data: {
    date_rdv: string;
    heure_rdv: string;
    affectations?: Array<{
      ressource_id: number;
      ligne_id?: number;
      membre_id?: number;
      heure_debut?: string;
      heure_fin?: string;
    }>;
  }) => void;
  isLoading: boolean;
}

// Types pour la disponibilité
interface DisponibiliteResponse {
  disponibles: Ressource[];
  occupees: Array<Ressource & { raison: string; conflits?: Array<{ heure_debut: string; heure_fin: string }> }>;
  prochaines_dispos: Array<{ ressource_id: number; ressource_nom: string; date: string; heure_debut: string; heure_fin: string }>;
}

// Type pour les affectations enrichies avec heures
interface AffectationExec {
  membre_id: number;
  heure_debut: string;
  heure_fin: string;
}

function ExecuteDevisModal({ devis, onClose, onExecute, isLoading }: ExecuteDevisModalProps) {
  // Profile pour adapter le texte
  const { profile, t, isPricingMode } = useProfile();

  // Pré-remplir avec les valeurs du devis si disponibles
  const devisData = devis as Devis & { date_prestation?: string; heure_prestation?: string };
  const [dateRdv, setDateRdv] = useState(devisData.date_prestation || '');
  const [heureRdv, setHeureRdv] = useState(devisData.heure_prestation || '10:00');
  const [dateInitialisee, setDateInitialisee] = useState(!!devisData.date_prestation);
  // Affectations enrichies avec heures
  const [affectations, setAffectations] = useState<Record<number, AffectationExec>>({});
  const [serviceEnCours, setServiceEnCours] = useState<number | null>(null);

  // Fetch lignes du devis (avec vraies durées)
  const { data: devisDetailData, error: devisDetailError } = useQuery<{ devis: Devis & { date_prestation?: string; heure_prestation?: string }; lignes: DevisLigne[] }>({
    queryKey: ['devis-detail-exec', devis.id],
    queryFn: async () => {
      console.log('[ExecuteModal] Fetching devis detail:', devis.id);
      const res = await fetch(`/api/admin/devis/${devis.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      console.log('[ExecuteModal] Response status:', res.status);
      if (!res.ok) {
        console.error('[ExecuteModal] Error response:', res.status, res.statusText);
        throw new Error(`Erreur ${res.status}`);
      }
      const data = await res.json();
      console.log('[ExecuteModal] Lignes reçues:', data.lignes?.length, data.lignes?.map((l: DevisLigne) => `${l.service_nom}: ${l.duree_minutes}min`));
      return data;
    },
    retry: 1
  });

  // Pré-remplir quand les données détaillées sont chargées
  useEffect(() => {
    if (devisDetailData?.devis && !dateInitialisee) {
      if (devisDetailData.devis.date_prestation) {
        setDateRdv(devisDetailData.devis.date_prestation);
        setDateInitialisee(true);
      }
      if (devisDetailData.devis.heure_prestation) {
        setHeureRdv(devisDetailData.devis.heure_prestation);
      }
    }
  }, [devisDetailData, dateInitialisee]);

  const lignesDevis = devisDetailData?.lignes || [];

  // Pré-remplir les affectations à partir des lignes du devis (si elles ont des heures définies)
  useEffect(() => {
    if (lignesDevis.length > 0) {
      const newAffectations: Record<number, AffectationExec> = {};
      lignesDevis.forEach(ligne => {
        // Si la ligne a un membre_id ou des heures, pré-remplir
        if (ligne.membre_id || ligne.heure_debut || ligne.heure_fin) {
          newAffectations[ligne.id] = {
            membre_id: ligne.membre_id || 0,
            heure_debut: ligne.heure_debut || heureRdv,
            heure_fin: ligne.heure_fin || ''
          };
        }
      });
      // Seulement mettre à jour si on a des affectations à pré-remplir
      if (Object.keys(newAffectations).length > 0) {
        setAffectations(prev => {
          // Ne pas écraser les modifications de l'utilisateur
          const merged = { ...prev };
          for (const [id, aff] of Object.entries(newAffectations)) {
            if (!merged[parseInt(id)]) {
              merged[parseInt(id)] = aff;
            }
          }
          return merged;
        });
      }
    }
  }, [lignesDevis, heureRdv]);

  // Calcul durée totale
  const dureeTotale = lignesDevis.reduce((sum, l) => sum + (l.duree_minutes || 60) * (l.quantite || 1), 0) || devis.duree_minutes || 60;

  // Fetch membres RH pour affectation
  const { data: membresData, isLoading: dispoLoading } = useQuery<Array<{ id: number; nom: string; prenom: string; role: string }>>({
    queryKey: ['membres-equipe-execute'],
    queryFn: async () => {
      const res = await fetch('/api/admin/rh/membres', {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      return res.json();
    }
  });

  // Convertir les membres en format ressource pour compatibilité avec l'UI existante
  const ressourcesDisponibles: Ressource[] = (membresData || []).map(m => ({
    id: m.id,
    nom: `${m.prenom} ${m.nom}`,
    categorie: m.role
  }));
  const ressourcesOccupees: Array<Ressource & { raison: string }> = [];
  const prochainesDispos: Array<{ ressource_id: number; ressource_nom: string; date: string; heure_debut: string; heure_fin: string }> = [];

  // Fallback: si pas de lignes en DB, parser service_nom
  const services = (() => {
    if (lignesDevis.length > 0) {
      return lignesDevis.map(l => ({
        id: l.id,
        service_id: l.service_id,
        nom: l.service_nom,
        quantite: l.quantite,
        duree_minutes: l.duree_minutes,
        prix_total: l.prix_total
      }));
    }

    // Fallback
    const serviceNom = devis.service_nom || '';
    const parts = serviceNom.split(',').map(s => s.trim()).filter(Boolean);
    return parts.map((part, index) => {
      const match = part.match(/^(.+?)\s*x(\d+)$/);
      if (match) {
        return { id: index + 1, service_id: 0, nom: match[1].trim(), quantite: parseInt(match[2]), duree_minutes: 60, prix_total: 0 };
      }
      return { id: index + 1, service_id: 0, nom: part, quantite: 1, duree_minutes: 60, prix_total: 0 };
    });
  })();

  // Calculer les heures entre deux horaires
  const calculateHoursFromTimes = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    let startMinutes = startH * 60 + (startM || 0);
    let endMinutes = endH * 60 + (endM || 0);
    if (endMinutes < startMinutes) endMinutes += 24 * 60; // Passage minuit
    return Math.round((endMinutes - startMinutes) / 60 * 10) / 10;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Créer les affectations de ressources avec heures
    const affectationsList = Object.entries(affectations)
      .filter(([, aff]) => aff.membre_id > 0)
      .map(([ligneId, aff]) => ({
        ligne_id: parseInt(ligneId),
        ressource_id: aff.membre_id,
        membre_id: aff.membre_id,
        heure_debut: aff.heure_debut || heureRdv,
        heure_fin: aff.heure_fin || ''
      }));

    // Validation: au moins un membre doit être assigné
    if (affectationsList.length === 0) {
      alert('Vous devez affecter au moins un membre du personnel à cette prestation');
      return;
    }

    // Validation mode horaire: vérifier que les heures sont définies
    if (isPricingMode('hourly')) {
      const hasValidHours = affectationsList.every(aff => aff.heure_debut && aff.heure_fin);
      if (!hasValidHours) {
        alert('Veuillez définir les heures de début et de fin pour chaque affectation');
        return;
      }
    }

    // En mode horaire, calculer heure_rdv à partir de l'heure la plus tôt des affectations
    let heureRdvFinal = heureRdv;
    if (isPricingMode('hourly') && affectationsList.length > 0) {
      const heuresDebut = affectationsList
        .map(aff => aff.heure_debut)
        .filter(Boolean)
        .sort();
      if (heuresDebut.length > 0) {
        heureRdvFinal = heuresDebut[0];
      }
    }

    onExecute({
      date_rdv: dateRdv,
      heure_rdv: heureRdvFinal,
      affectations: affectationsList
    });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleBackdropClick}>
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full z-10">
          <X className="w-5 h-5 text-gray-500" />
        </button>
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-purple-600">Exécuter le devis</h2>
          <p className="text-sm text-gray-500 mt-1">
            Devis {devis.numero} - {devis.client_nom}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-800">
              <strong>Création de la prestation</strong>
            </p>
            <p className="text-sm text-purple-700 mt-1">
              Cette action créera une prestation planifiée. Vous pouvez affecter des ressources (collaborateurs) à chaque service.
            </p>
          </div>

          {/* Date et heure */}
          <div className={isPricingMode('hourly') ? '' : 'grid grid-cols-2 gap-4'}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de la prestation *</label>
              <input
                type="date"
                required
                value={dateRdv}
                onChange={(e) => setDateRdv(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {/* Heure de début uniquement en mode non-horaire */}
            {!isPricingMode('hourly') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heure de début *</label>
                <input
                  type="time"
                  required
                  value={heureRdv}
                  onChange={(e) => setHeureRdv(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}
            {/* Info pour mode horaire */}
            {isPricingMode('hourly') && (
              <p className="text-xs text-gray-500 mt-1">
                Les horaires sont définis par affectation ci-dessous.
              </p>
            )}
          </div>

          {/* Affectation des services avec disponibilité intelligente */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-700">Affectation des ressources</h3>
              {dispoLoading && <span className="text-sm text-blue-600">Vérification des disponibilités...</span>}
            </div>

            {/* Message si pas de date (en mode horaire, pas besoin d'heure globale) */}
            {!dateRdv || (!isPricingMode('hourly') && !heureRdv) ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  Sélectionnez une date pour voir le personnel disponible.
                </p>
              </div>
            ) : (
              <>
                {/* Indicateur de disponibilité */}
                {dateRdv && (isPricingMode('hourly') || heureRdv) && !dispoLoading && (
                  <div className={`rounded-lg p-3 text-sm ${
                    ressourcesDisponibles.length > 0
                      ? 'bg-green-50 border border-green-200 text-green-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}>
                    {ressourcesDisponibles.length > 0 ? (
                      <span>✓ {ressourcesDisponibles.length} membre(s) disponible(s)</span>
                    ) : (
                      <span>✗ Aucun membre dans l'équipe</span>
                    )}
                  </div>
                )}

                {/* Services avec affectation */}
                {services.map((service) => {
                  const aff = affectations[service.id] || { membre_id: 0, heure_debut: heureRdv, heure_fin: '' };
                  return (
                    <div key={service.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <p className="font-medium">{service.nom}</p>
                          <p className="text-sm text-gray-500">
                            Quantité: {service.quantite} | Durée prédéfinie: {service.duree_minutes} min
                          </p>
                        </div>
                        <div className="w-56">
                          <select
                            value={aff.membre_id || ''}
                            onChange={(e) => {
                              const membreId = parseInt(e.target.value) || 0;
                              setAffectations({
                                ...affectations,
                                [service.id]: { ...aff, membre_id: membreId }
                              });
                            }}
                            onFocus={() => setServiceEnCours(service.service_id)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                          >
                            <option value="">-- Sélectionner --</option>
                            {ressourcesDisponibles.length > 0 && (
                              <optgroup label="✓ Disponibles">
                                {ressourcesDisponibles.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.nom} {r.categorie ? `(${r.categorie})` : ''}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {ressourcesOccupees.length > 0 && (
                              <optgroup label="✗ Occupées">
                                {ressourcesOccupees.map((r) => (
                                  <option key={r.id} value={r.id} disabled className="text-gray-400">
                                    {r.nom} - {r.raison === 'occupee' ? 'Occupé(e)' : 'Indisponible'}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      </div>

                      {/* Horaires personnalisés (mode horaire) */}
                      {isPricingMode('hourly') && aff.membre_id > 0 && (
                        <div className="flex items-center gap-3 pl-4 border-l-2 border-purple-200">
                          <Clock className="w-4 h-4 text-purple-500" />
                          <span className="text-sm text-gray-600">Horaires:</span>
                          <input
                            type="time"
                            value={aff.heure_debut || ''}
                            onChange={(e) => setAffectations({
                              ...affectations,
                              [service.id]: { ...aff, heure_debut: e.target.value }
                            })}
                            className="px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-purple-500"
                          />
                          <span className="text-gray-400">→</span>
                          <input
                            type="time"
                            value={aff.heure_fin || ''}
                            onChange={(e) => setAffectations({
                              ...affectations,
                              [service.id]: { ...aff, heure_fin: e.target.value }
                            })}
                            className="px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-purple-500"
                          />
                          {aff.heure_debut && aff.heure_fin && (
                            <span className="text-xs text-purple-600 font-medium">
                              ({calculateHoursFromTimes(aff.heure_debut, aff.heure_fin)}h)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Suggestions de prochaines disponibilités */}
                {ressourcesDisponibles.length === 0 && prochainesDispos.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-800 mb-2">📅 Prochaines disponibilités :</p>
                    <div className="space-y-2">
                      {prochainesDispos.map((dispo, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setDateRdv(dispo.date);
                            setHeureRdv(dispo.heure_debut);
                          }}
                          className="w-full text-left px-3 py-2 bg-white rounded border border-blue-200 hover:bg-blue-100 text-sm"
                        >
                          <span className="font-medium">{dispo.ressource_nom}</span>
                          <span className="text-gray-600 ml-2">
                            {dispo.heure_debut} - {dispo.heure_fin}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Récapitulatif */}
          <div className="bg-blue-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Client:</span>
              <span className="font-medium">{devis.client_nom}</span>
            </div>
            {devis.lieu && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Lieu:</span>
                <span className="font-medium">{devis.lieu}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Durée totale:</span>
              <span className="font-medium">{devis.duree_minutes || 60} min</span>
            </div>
            <div className="flex justify-between text-sm font-medium border-t pt-2">
              <span className="text-gray-600">Montant TTC:</span>
              <span className="text-blue-600">{(devis.montant_ttc / 100).toFixed(2)} EUR</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading || !dateRdv}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {isLoading ? 'Création...' : 'Créer les réservations'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface RejectDevisModalProps {
  devis: Devis;
  onClose: () => void;
  onReject: (raison?: string) => void;
  isLoading: boolean;
}

function RejectDevisModal({ devis, onClose, onReject, isLoading }: RejectDevisModalProps) {
  const [raison, setRaison] = useState('');

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleBackdropClick}>
      <div className="bg-white rounded-lg w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full">
          <X className="w-5 h-5 text-gray-500" />
        </button>
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-red-600">Rejeter le devis</h2>
          <p className="text-sm text-gray-500 mt-1">
            Devis {devis.numero} - {devis.client_nom}
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motif du rejet (optionnel)</label>
            <textarea
              value={raison}
              onChange={(e) => setRaison(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500"
              rows={3}
              placeholder="Ex: Prix trop élevé, Date non disponible..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              onClick={() => onReject(raison || undefined)}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {isLoading ? 'Rejet...' : 'Rejeter le devis'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MODAL DETAIL/APERÇU DEVIS
// ============================================

interface DevisDetailModalProps {
  devisId: string;
  onClose: () => void;
  onEdit: (devis: Devis) => void;
  onSend: (id: string) => void;
  onAccept: (devis: Devis) => void;
  onReject: (devis: Devis) => void;
  onExecute: (devis: Devis) => void;
}

function DevisDetailModal({ devisId, onClose, onEdit, onSend, onAccept, onReject, onExecute }: DevisDetailModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch devis details
  const { data, isLoading, error } = useQuery({
    queryKey: ['devis-detail', devisId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/devis/${devisId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (!res.ok) throw new Error('Erreur chargement devis');
      return res.json();
    }
  });

  const devis: Devis | null = data?.devis || null;
  const historique = data?.historique || [];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Devis ${devis?.numero}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
          .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
          .devis-number { font-size: 28px; color: #2563eb; margin-bottom: 10px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
          .info-box { background: #f8fafc; padding: 20px; border-radius: 8px; }
          .info-box h3 { font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 10px; }
          .info-box p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 30px 0; }
          th { background: #2563eb; color: white; padding: 12px; text-align: left; }
          td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
          .totals { margin-left: auto; width: 300px; }
          .totals .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
          .totals .row.total { font-size: 18px; font-weight: bold; color: #2563eb; border-top: 2px solid #2563eb; border-bottom: none; padding-top: 15px; }
          .validity { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 30px 0; text-align: center; }
          .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportPDF = async () => {
    // Ouvrir l'aperçu HTML du devis dans un nouvel onglet
    window.open(`/api/admin/devis/${devisId}/pdf`, '_blank');
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatMontant = (centimes: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(centimes / 100);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-center mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !devis) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleBackdropClick}>
        <div className="bg-white rounded-lg p-8 max-w-md">
          <p className="text-red-600 text-center">Erreur lors du chargement du devis</p>
          <button onClick={onClose} className="mt-4 w-full px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  const statutConfig = STATUT_LABELS[devis.statut as StatutDevis];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleBackdropClick}>
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header avec actions */}
        <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Devis {devis.numero}
            </h2>
            <p className="text-blue-100 text-sm mt-1">{devis.client_nom}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Statut */}
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statutConfig?.bg} ${statutConfig?.color}`}>
              {statutConfig?.label}
            </span>
            <button onClick={onClose} className="p-2 hover:bg-blue-500 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barre d'actions */}
        <div className="p-3 border-b bg-gray-50 flex flex-wrap gap-2">
          {/* Actions de visualisation */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm"
          >
            <Printer className="w-4 h-4" />
            Imprimer
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 text-sm"
          >
            <Download className="w-4 h-4" />
            Exporter PDF
          </button>

          <div className="flex-1" />

          {/* Actions selon statut */}
          {devis.statut === 'brouillon' && (
            <>
              <button
                onClick={() => onEdit(devis)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm"
              >
                <Edit2 className="w-4 h-4" />
                Modifier
              </button>
              <button
                onClick={() => onSend(devis.id)}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Send className="w-4 h-4" />
                Envoyer
              </button>
            </>
          )}

          {devis.statut === 'envoye' && (
            <>
              <button
                onClick={() => onAccept(devis)}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <Check className="w-4 h-4" />
                Accepter
              </button>
              <button
                onClick={() => onReject(devis)}
                className="flex items-center gap-2 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm"
              >
                <XCircle className="w-4 h-4" />
                Rejeter
              </button>
            </>
          )}

          {devis.statut === 'accepte' && (
            <button
              onClick={() => onExecute(devis)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
            >
              <Play className="w-4 h-4" />
              Exécuter
            </button>
          )}
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto">
          {/* Zone imprimable */}
          <div ref={printRef} className="p-6">
            {/* En-tête du devis */}
            <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-blue-600">
              <div>
                <div className="text-3xl font-bold text-blue-600">DEVIS</div>
                <div className="text-lg text-gray-600 mt-1">N° {devis.numero}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Date d'émission</div>
                <div className="font-medium">{formatDate(devis.date_devis)}</div>
                <div className="text-sm text-gray-500 mt-2">Valide jusqu'au</div>
                <div className="font-medium">{devis.date_expiration ? formatDate(devis.date_expiration) : '-'}</div>
              </div>
            </div>

            {/* Informations client et détails */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Client */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h3 className="text-xs uppercase text-gray-500 font-semibold mb-3 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Client
                </h3>
                <div className="space-y-2">
                  <p className="font-semibold text-lg">{devis.client_nom || '-'}</p>
                  {devis.client_telephone && (
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      {devis.client_telephone}
                    </p>
                  )}
                  {devis.client_email && (
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {devis.client_email}
                    </p>
                  )}
                  {devis.client_adresse && (
                    <p className="text-sm text-gray-600 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      {devis.client_adresse}
                    </p>
                  )}
                </div>
              </div>

              {/* Détails prestation */}
              <div className="bg-blue-50 rounded-lg p-5">
                <h3 className="text-xs uppercase text-gray-500 font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Prestation
                </h3>
                <div className="space-y-2">
                  {devis.lieu && (
                    <p className="text-sm flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      <span className="font-medium capitalize">{devis.lieu}</span>
                    </p>
                  )}
                  {devis.duree_minutes && (
                    <p className="text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>Durée: {Math.floor(devis.duree_minutes / 60)}h{devis.duree_minutes % 60 > 0 ? ` ${devis.duree_minutes % 60}min` : ''}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Tableau des prestations */}
            <div className="mb-8">
              <table className="w-full">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="text-left p-3 rounded-tl-lg">Description</th>
                    <th className="text-right p-3 w-32">Durée</th>
                    <th className="text-right p-3 w-32 rounded-tr-lg">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-4">
                      <div className="font-medium">{devis.service_nom || 'Prestation'}</div>
                      {devis.service_description && (
                        <div className="text-sm text-gray-500 mt-1">{devis.service_description}</div>
                      )}
                    </td>
                    <td className="p-4 text-right text-gray-600">
                      {devis.duree_minutes ? `${devis.duree_minutes} min` : '-'}
                    </td>
                    <td className="p-4 text-right font-medium">
                      {formatMontant(devis.montant_ht)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Totaux */}
            <div className="flex justify-end mb-8">
              <div className="w-72 space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">Sous-total HT</span>
                  <span className="font-medium">{formatMontant(devis.montant_ht || 0)}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-600">TVA ({devis.taux_tva || 20}%)</span>
                  <span className="font-medium">{formatMontant(devis.montant_tva || 0)}</span>
                </div>
                <div className="flex justify-between py-3 border-t-2 border-blue-600">
                  <span className="text-lg font-bold">Total TTC</span>
                  <span className="text-lg font-bold text-blue-600">{formatMontant(devis.montant_ttc)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {devis.notes && (
              <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
                <p className="text-sm text-gray-600">{devis.notes}</p>
              </div>
            )}

            {/* Validité */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <p className="text-amber-800">
                <strong>Ce devis est valable {devis.validite_jours || 30} jours</strong> à compter de sa date d'émission.
              </p>
            </div>
          </div>

          {/* Historique (non imprimé) */}
          {historique.length > 0 && (
            <div className="p-6 border-t bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Historique</h3>
              <div className="space-y-2">
                {historique.map((item: { id: number; action: string; notes: string; created_at: string; changed_by: string }) => (
                  <div key={item.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5"></div>
                    <div>
                      <span className="font-medium">{item.action}</span>
                      {item.notes && <span className="text-gray-500"> - {item.notes}</span>}
                      <div className="text-xs text-gray-400">
                        {new Date(item.created_at).toLocaleString('fr-FR')} par {item.changed_by}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
