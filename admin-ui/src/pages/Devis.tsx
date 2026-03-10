import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, comptaApi, Devis, DevisCreateData } from '../lib/api';
import { LayoutTemplate } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import {
  DevisFormModal,
  AcceptDevisModal,
  ExecuteDevisModal,
  RejectDevisModal,
  DevisDetailModal,
  TemplateSelectModal,
  formatMontant,
  formatDate,
  STATUT_LABELS,
  StatutDevis,
} from '@/components/devis';
import type { DevisTemplate } from '@/components/devis';

export default function DevisPage() {
  const queryClient = useQueryClient();
  const { t } = useProfile();
  const [filtreStatut, setFiltreStatut] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingDevis, setEditingDevis] = useState<Devis | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState<Devis | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<Devis | null>(null);
  const [showExecuteModal, setShowExecuteModal] = useState<Devis | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [templatePreFill, setTemplatePreFill] = useState<DevisTemplate | null>(null);

  // Recuperer les devis
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
      setMutationError(null);
    },
    onError: (error: Error) => {
      setMutationError(error.message || 'Erreur lors de la creation du devis');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Devis> }) => comptaApi.updateDevis(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setShowForm(false);
      setEditingDevis(null);
      setMutationError(null);
    },
    onError: (error: Error) => {
      setMutationError(error.message || 'Erreur lors de la modification du devis');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => comptaApi.deleteDevis(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setMutationError(null);
    },
    onError: (error: Error) => {
      setMutationError(error.message || 'Erreur lors de la suppression du devis');
    },
  });

  const envoyerMutation = useMutation({
    mutationFn: (id: string) => comptaApi.envoyerDevis(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setMutationError(null);
    },
    onError: (error: Error) => {
      setMutationError(error.message || 'Erreur lors de l\'envoi du devis');
    },
  });

  const accepterMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/devis/${id}/accepter`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setShowAcceptModal(null);
      setMutationError(null);
    },
    onError: (error: Error) => {
      setMutationError(error.message || 'Erreur lors de l\'acceptation du devis');
    },
  });

  const rejeterMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { raison?: string } }) =>
      comptaApi.rejeterDevis(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setShowRejectModal(null);
      setMutationError(null);
    },
    onError: (error: Error) => {
      setMutationError(error.message || 'Erreur lors du rejet du devis');
    },
  });

  // Change status mutation
  const changeStatutMutation = useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: StatutDevis }) =>
      api.patch(`/admin/devis/${id}/statut`, { statut }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setMutationError(null);
    },
    onError: (error: Error) => {
      setMutationError(error.message || 'Erreur lors du changement de statut');
    },
  });

  // Execute mutation - cree une prestation
  const executerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { date_rdv: string; heure_rdv: string; affectations?: Array<{ ressource_id: number; ligne_id?: number }> } }) =>
      api.post(`/admin/devis/${id}/executer`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devis'] });
      setShowExecuteModal(null);
      setMutationError(null);
    },
    onError: (error: Error) => {
      setMutationError(error.message || 'Erreur lors de l\'execution du devis');
    },
  });

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
      {/* Erreur mutation */}
      {mutationError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex justify-between items-center">
          <span className="text-red-700">{mutationError}</span>
          <button onClick={() => setMutationError(null)} className="text-red-500 hover:text-red-700 font-bold">X</button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devis</h1>
          <p className="text-sm text-gray-500">Gestion des devis clients</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTemplateModal(true)}
            className="px-4 py-2 bg-white border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-2"
          >
            <LayoutTemplate className="w-5 h-5" />
            Utiliser un template
          </button>
          <button
            onClick={() => {
              setEditingDevis(null);
              setTemplatePreFill(null);
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
            <p className="text-sm text-blue-600">Envoyes</p>
            <p className="text-2xl font-bold text-blue-600">{stats.envoye}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border">
            <p className="text-sm text-green-600">Acceptes</p>
            <p className="text-2xl font-bold text-green-600">{stats.accepte}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 border">
            <p className="text-sm text-red-600">Rejetes</p>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numero</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('service')}</th>
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
                  Aucun devis trouve
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
                            Executer
                          </button>
                        )}
                        <button
                          onClick={() => setShowDetailModal(devis.id)}
                          className="text-gray-600 hover:text-gray-800"
                          title="Voir details"
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
          templatePreFill={templatePreFill}
          onClose={() => {
            setShowForm(false);
            setEditingDevis(null);
            setTemplatePreFill(null);
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

      {/* Modal Execution */}
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

      {/* Modal Detail/Apercu */}
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

      {/* Modal Templates */}
      {showTemplateModal && (
        <TemplateSelectModal
          onClose={() => setShowTemplateModal(false)}
          onSelect={(template) => {
            setShowTemplateModal(false);
            setTemplatePreFill(template);
            setEditingDevis(null);
            setShowForm(true);
          }}
        />
      )}
    </div>
  );
}
