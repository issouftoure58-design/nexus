import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, User, MapPin, Phone, Mail, Euro, CheckCircle, XCircle, Play, FileText, Users } from 'lucide-react';

interface Prestation {
  id: string;
  numero: string;
  tenant_id: string;
  client_id: number | null;
  client_nom: string;
  client_telephone: string;
  client_email: string;
  statut: 'planifiee' | 'en_cours' | 'terminee' | 'annulee' | 'facturee';
  date_debut: string;
  heure_debut: string;
  date_fin: string;
  heure_fin: string;
  duree_minutes: number;
  lieu_type: 'etablissement' | 'domicile' | 'autre';
  adresse: string;
  montant_ht: number;
  taux_tva: number;
  montant_tva: number;
  montant_ttc: number;
  source: 'devis' | 'reservation' | 'direct';
  source_id: string | null;
  notes: string;
  created_at: string;
}

interface PrestationLigne {
  id: number;
  prestation_id: string;
  service_id: number;
  service_nom: string;
  quantite: number;
  duree_minutes: number;
  prix_unitaire: number;
  prix_total: number;
}

interface PrestationRessource {
  id: number;
  prestation_id: string;
  ressource_id: number;
  ressource?: {
    id: number;
    nom: string;
    categorie: string;
  };
  role: string;
  statut: string;
}

type StatutPrestation = 'planifiee' | 'en_cours' | 'terminee' | 'annulee' | 'facturee';

const STATUT_LABELS: Record<StatutPrestation, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  planifiee: { label: 'Planifiée', color: 'text-blue-600', bg: 'bg-blue-100', icon: <Calendar className="w-4 h-4" /> },
  en_cours: { label: 'En cours', color: 'text-orange-600', bg: 'bg-orange-100', icon: <Play className="w-4 h-4" /> },
  terminee: { label: 'Terminée', color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-4 h-4" /> },
  annulee: { label: 'Annulée', color: 'text-red-600', bg: 'bg-red-100', icon: <XCircle className="w-4 h-4" /> },
  facturee: { label: 'Facturée', color: 'text-purple-600', bg: 'bg-purple-100', icon: <FileText className="w-4 h-4" /> },
};

// Helper pour récupérer le token (multi-tenant compatible)
function getToken(): string | null {
  const currentTenant = localStorage.getItem('nexus_current_tenant');
  if (currentTenant) {
    return localStorage.getItem(`nexus_admin_token_${currentTenant}`);
  }
  return localStorage.getItem('nexus_admin_token');
}

export default function PrestationsPage() {
  const queryClient = useQueryClient();
  const [filtreStatut, setFiltreStatut] = useState<string>('');
  const [filtreDate, setFiltreDate] = useState<string>('');
  const [showDetailModal, setShowDetailModal] = useState<Prestation | null>(null);

  // Récupérer les prestations
  const { data, isLoading, error } = useQuery({
    queryKey: ['prestations', filtreStatut, filtreDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filtreStatut) params.append('statut', filtreStatut);
      if (filtreDate) params.append('date', filtreDate);

      console.log('[Prestations] Fetching...');
      const token = getToken();
      console.log('[Prestations] Token exists:', !!token);

      const res = await fetch(`/api/admin/prestations?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('[Prestations] Response status:', res.status);
      if (!res.ok) {
        const errText = await res.text();
        console.error('[Prestations] Error:', errText);
        throw new Error('Erreur chargement');
      }
      const data = await res.json();
      console.log('[Prestations] Data:', data);
      return data;
    }
  });

  const prestations: Prestation[] = data?.prestations || [];
  const stats = data?.stats;

  // Mutation pour changer le statut
  const changeStatutMutation = useMutation({
    mutationFn: async ({ id, statut }: { id: string; statut: StatutPrestation }) => {
      const res = await fetch(`/api/admin/prestations/${id}/statut`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({ statut })
      });
      if (!res.ok) throw new Error('Erreur changement statut');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestations'] });
    }
  });

  const formatMontant = (centimes: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(centimes / 100);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  const formatHeure = (heure: string) => {
    return heure?.substring(0, 5) || '';
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
        Erreur lors du chargement des prestations
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prestations</h1>
          <p className="text-sm text-gray-500">Suivi des prestations planifiées et réalisées</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg p-4 border">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{stats.total || 0}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border">
            <p className="text-sm text-blue-600">Planifiées</p>
            <p className="text-2xl font-bold text-blue-600">{stats.planifiee || 0}</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border">
            <p className="text-sm text-orange-600">En cours</p>
            <p className="text-2xl font-bold text-orange-600">{stats.en_cours || 0}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border">
            <p className="text-sm text-green-600">Terminées</p>
            <p className="text-2xl font-bold text-green-600">{stats.terminee || 0}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border">
            <p className="text-sm text-purple-600">CA Total</p>
            <p className="text-xl font-bold text-purple-600">{formatMontant(stats.montant_total || 0)}</p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-4 items-center flex-wrap">
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
        <input
          type="date"
          value={filtreDate}
          onChange={(e) => setFiltreDate(e.target.value)}
          className="px-3 py-1.5 border rounded-lg text-sm"
          placeholder="Filtrer par date"
        />
        {filtreDate && (
          <button
            onClick={() => setFiltreDate('')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Effacer date
          </button>
        )}
      </div>

      {/* Liste des prestations */}
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Heure</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durée</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {prestations.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  Aucune prestation trouvée
                </td>
              </tr>
            ) : (
              prestations.map((prestation) => {
                const statutConfig = STATUT_LABELS[prestation.statut];
                const isToday = prestation.date_debut === new Date().toISOString().split('T')[0];
                return (
                  <tr key={prestation.id} className={`hover:bg-gray-50 ${isToday ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setShowDetailModal(prestation)}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {prestation.numero}
                      </button>
                      {isToday && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                          Aujourd'hui
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{prestation.client_nom}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {prestation.client_telephone}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium">{formatDate(prestation.date_debut)}</div>
                      <div className="text-sm text-gray-500">
                        {formatHeure(prestation.heure_debut)} - {formatHeure(prestation.heure_fin)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {Math.floor(prestation.duree_minutes / 60)}h{prestation.duree_minutes % 60 > 0 ? `${prestation.duree_minutes % 60}` : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      {formatMontant(prestation.montant_ttc)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        prestation.source === 'devis' ? 'bg-purple-100 text-purple-700' :
                        prestation.source === 'reservation' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {prestation.source === 'devis' ? 'Devis' :
                         prestation.source === 'reservation' ? 'Réservation' : 'Direct'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={prestation.statut}
                        onChange={(e) => {
                          const newStatut = e.target.value as StatutPrestation;
                          if (newStatut !== prestation.statut) {
                            if (confirm(`Changer le statut vers "${STATUT_LABELS[newStatut]?.label}" ?`)) {
                              changeStatutMutation.mutate({ id: prestation.id, statut: newStatut });
                            } else {
                              e.target.value = prestation.statut;
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
                        <button
                          onClick={() => setShowDetailModal(prestation)}
                          className="text-gray-600 hover:text-gray-800"
                          title="Voir détails"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        {prestation.statut === 'planifiee' && (
                          <button
                            onClick={() => changeStatutMutation.mutate({ id: prestation.id, statut: 'en_cours' })}
                            className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                          >
                            Démarrer
                          </button>
                        )}
                        {prestation.statut === 'en_cours' && (
                          <button
                            onClick={() => changeStatutMutation.mutate({ id: prestation.id, statut: 'terminee' })}
                            className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                          >
                            Terminer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Détail */}
      {showDetailModal && (
        <PrestationDetailModal
          prestation={showDetailModal}
          onClose={() => setShowDetailModal(null)}
        />
      )}
    </div>
  );
}

// Modal de détail
function PrestationDetailModal({ prestation, onClose }: { prestation: Prestation; onClose: () => void }) {
  // Fetch détails complets
  const { data: detailData } = useQuery({
    queryKey: ['prestation-detail', prestation.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/prestations/${prestation.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      return res.json();
    }
  });

  const lignes: PrestationLigne[] = detailData?.lignes || [];
  const ressources: PrestationRessource[] = detailData?.ressources || [];
  const statutConfig = STATUT_LABELS[prestation.statut];

  const formatMontant = (centimes: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(centimes / 100);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleBackdropClick}>
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">{prestation.numero}</h2>
              <span className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${statutConfig.bg} ${statutConfig.color}`}>
                {statutConfig.icon}
                {statutConfig.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Créée le {new Date(prestation.created_at).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <XCircle className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Info Client */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Client
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-lg font-medium">{prestation.client_nom}</p>
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                  <Phone className="w-4 h-4" />
                  {prestation.client_telephone}
                </p>
                {prestation.client_email && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {prestation.client_email}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {prestation.lieu_type === 'etablissement' ? 'Au salon' :
                   prestation.lieu_type === 'domicile' ? 'À domicile' : prestation.lieu_type}
                </p>
                {prestation.adresse && (
                  <p className="text-sm text-gray-600 mt-1">{prestation.adresse}</p>
                )}
              </div>
            </div>
          </div>

          {/* Date & Heure */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Rendez-vous
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-medium">
                  {new Date(prestation.date_debut).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Horaire</p>
                <p className="font-medium">
                  {prestation.heure_debut?.substring(0, 5)} - {prestation.heure_fin?.substring(0, 5)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Durée</p>
                <p className="font-medium">
                  {Math.floor(prestation.duree_minutes / 60)}h{prestation.duree_minutes % 60 > 0 ? `${prestation.duree_minutes % 60}min` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Services */}
          {lignes.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-3">Services</h3>
              <div className="space-y-2">
                {lignes.map((ligne) => (
                  <div key={ligne.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{ligne.service_nom}</p>
                      <p className="text-sm text-gray-500">
                        {ligne.quantite > 1 ? `${ligne.quantite}x ` : ''}{ligne.duree_minutes} min
                      </p>
                    </div>
                    <p className="font-medium">{formatMontant(ligne.prix_total)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ressources affectées */}
          {ressources.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Personnel affecté
              </h3>
              <div className="flex flex-wrap gap-2">
                {ressources.map((r) => (
                  <span key={r.id} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm">
                    {r.ressource?.nom || `Ressource #${r.ressource_id}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Montants */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Euro className="w-4 h-4 text-green-600" />
              Facturation
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Montant HT</span>
                <span>{formatMontant(prestation.montant_ht)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>TVA ({prestation.taux_tva}%)</span>
                <span>{formatMontant(prestation.montant_tva)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total TTC</span>
                <span className="text-green-600">{formatMontant(prestation.montant_ttc)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {prestation.notes && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Notes</h3>
              <p className="text-gray-600 bg-gray-50 rounded-lg p-3">{prestation.notes}</p>
            </div>
          )}

          {/* Source */}
          <div className="text-sm text-gray-500">
            Source: {prestation.source === 'devis' ? 'Devis' : prestation.source === 'reservation' ? 'Réservation' : 'Création directe'}
            {prestation.source_id && ` (${prestation.source_id.substring(0, 8)}...)`}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
