import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ArrowLeft, Calendar, Play, Lock, FileText, Send, CheckCircle, Edit } from 'lucide-react';
import type { Forfait, ForfaitCreateData } from './types';
import { STATUT_PERIODE_LABELS, STATUT_FORFAIT_LABELS, formatMontant, formatDate } from './types';
import ForfaitPeriodeDetail from './ForfaitPeriodeDetail';
import ForfaitBuilderModal from './ForfaitBuilderModal';

export interface ForfaitPeriodesViewProps {
  forfaitId: number;
  onBack: () => void;
}

export default function ForfaitPeriodesView({ forfaitId, onBack }: ForfaitPeriodesViewProps) {
  const queryClient = useQueryClient();
  const [selectedPeriodeId, setSelectedPeriodeId] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [actionError, setActionError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['forfait', forfaitId],
    queryFn: () => api.get<{ forfait: Forfait }>(`/admin/forfaits/${forfaitId}`),
  });

  const forfait = data?.forfait;
  const periodes = forfait?.periodes || [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['forfait', forfaitId] });
    queryClient.invalidateQueries({ queryKey: ['forfaits'] });
  };

  const annulerMutation = useMutation({
    mutationFn: () => api.patch(`/admin/forfaits/${forfaitId}/annuler`),
    onSuccess: invalidate,
  });

  const envoyerMutation = useMutation({
    mutationFn: () => api.post(`/admin/forfaits/${forfaitId}/envoyer`),
    onSuccess: () => { invalidate(); setActionError(''); },
    onError: (err: any) => setActionError(err.message || 'Erreur envoi'),
  });

  const accepterMutation = useMutation({
    mutationFn: () => api.post(`/admin/forfaits/${forfaitId}/accepter`),
    onSuccess: () => { invalidate(); setActionError(''); },
    onError: (err: any) => setActionError(err.message || 'Erreur acceptation'),
  });

  const editMutation = useMutation({
    mutationFn: (data: ForfaitCreateData) => api.put(`/admin/forfaits/${forfaitId}`, data),
    onSuccess: () => { invalidate(); setShowEditModal(false); },
    onError: (err: any) => setActionError(err.message || 'Erreur modification'),
  });

  if (selectedPeriodeId) {
    return (
      <ForfaitPeriodeDetail
        forfaitId={forfaitId}
        periodeId={selectedPeriodeId}
        onBack={() => setSelectedPeriodeId(null)}
      />
    );
  }

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">Chargement...</div>;
  }

  if (!forfait) {
    return <div className="p-6 text-center text-red-500">Forfait non trouve</div>;
  }

  const statutInfo = STATUT_FORFAIT_LABELS[forfait.statut] || STATUT_FORFAIT_LABELS.brouillon;
  const isBrouillon = forfait.statut === 'brouillon';
  const isEnvoye = forfait.statut === 'envoye';
  const isActif = forfait.statut === 'actif';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{forfait.nom}</h2>
          <p className="text-sm text-gray-500">
            {forfait.numero} — {forfait.client_nom || 'Sans client'}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statutInfo.bg} ${statutInfo.color}`}>
          {statutInfo.label}
        </span>
      </div>

      {/* Action error */}
      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600 ml-2">&times;</button>
        </div>
      )}

      {/* Workflow actions bar */}
      {forfait.statut !== 'annule' && (
        <div className="flex flex-wrap items-center gap-2 p-4 bg-white border rounded-lg">
          {isBrouillon && (
            <>
              <button
                onClick={() => setShowEditModal(true)}
                className="px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Modifier
              </button>
              <button
                onClick={() => envoyerMutation.mutate()}
                disabled={envoyerMutation.isPending}
                className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {envoyerMutation.isPending ? 'Envoi...' : 'Envoyer au client'}
              </button>
              <button
                onClick={() => {
                  if (confirm('Accepter directement sans envoyer au client ?')) {
                    accepterMutation.mutate();
                  }
                }}
                disabled={accepterMutation.isPending}
                className="px-3 py-2 text-sm font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {accepterMutation.isPending ? 'Acceptation...' : 'Accepter directement'}
              </button>
            </>
          )}

          {isEnvoye && (
            <>
              <span className="text-sm text-blue-600 font-medium">En attente d'acceptation client</span>
              <button
                onClick={() => envoyerMutation.mutate()}
                disabled={envoyerMutation.isPending}
                className="px-3 py-2 text-sm font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {envoyerMutation.isPending ? 'Envoi...' : 'Renvoyer'}
              </button>
              <button
                onClick={() => accepterMutation.mutate()}
                disabled={accepterMutation.isPending}
                className="px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {accepterMutation.isPending ? 'Acceptation...' : 'Marquer comme accepte'}
              </button>
            </>
          )}

          {isActif && (
            <span className="text-sm text-green-600 font-medium">Contrat actif — planifiable</span>
          )}
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Mensuel HT</div>
          <div className="text-lg font-bold text-blue-600">{formatMontant(forfait.montant_mensuel_ht)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Periode</div>
          <div className="text-sm font-medium">{formatDate(forfait.date_debut)} → {formatDate(forfait.date_fin)}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Postes</div>
          <div className="text-lg font-bold">{forfait.postes?.length || 0}</div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs text-gray-500 mb-1">Progression</div>
          <div className="text-lg font-bold">
            {periodes.length > 0 ? `${periodes.filter(p => p.statut === 'cloture').length}/${periodes.length}` : '—'}
          </div>
        </div>
      </div>

      {/* Postes detail */}
      {forfait.postes && forfait.postes.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Postes du contrat</h3>
          <div className="space-y-2">
            {forfait.postes.map((p, i) => {
              const joursLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
              const joursActifs = (p.jours || [])
                .map((j: boolean, idx: number) => j ? joursLabels[idx] : null)
                .filter(Boolean)
                .join(', ');
              return (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2">
                  <div>
                    <span className="font-medium">{p.effectif}x {p.service_nom}</span>
                    <span className="text-gray-500 ml-2">({joursActifs})</span>
                  </div>
                  <div className="text-gray-500">
                    {p.heure_debut}–{p.heure_fin}
                    {p.cout_mensuel_ht ? <span className="ml-2 font-medium text-blue-600">{formatMontant(p.cout_mensuel_ht)}/mois</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Periodes list — only show if actif (periodes generated) */}
      {periodes.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Periodes ({periodes.length})</h3>
          <div className="space-y-2">
            {periodes.map(p => {
              const sInfo = STATUT_PERIODE_LABELS[p.statut];
              const moisLabel = new Date(p.date_debut + 'T12:00:00')
                .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedPeriodeId(p.id)}
                  className="w-full flex items-center justify-between bg-white border rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {p.statut === 'cloture' ? (
                      <Lock className="w-4 h-4 text-green-500" />
                    ) : p.statut === 'en_cours' ? (
                      <Play className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Calendar className="w-4 h-4 text-gray-400" />
                    )}
                    <div>
                      <span className="font-medium capitalize">{moisLabel}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {formatDate(p.date_debut)} → {formatDate(p.date_fin)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{formatMontant(p.montant_prevu)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sInfo.bg} ${sInfo.color}`}>
                      {sInfo.label}
                    </span>
                    {p.facture_id && (
                      <span title="Facture generee"><FileText className="w-4 h-4 text-green-500" /></span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state for non-actif (no periodes yet) */}
      {periodes.length === 0 && !isBrouillon && !isEnvoye && (
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
          <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>Les periodes seront generees a l'acceptation du forfait</p>
        </div>
      )}

      {/* Actions footer */}
      {(isActif || isBrouillon || isEnvoye) && forfait.statut !== 'annule' && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              if (confirm('Annuler ce forfait ? Les periodes deja cloturees restent intactes.')) {
                annulerMutation.mutate();
              }
            }}
            disabled={annulerMutation.isPending}
            className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 text-sm"
          >
            {annulerMutation.isPending ? 'Annulation...' : 'Annuler le forfait'}
          </button>
        </div>
      )}

      {/* Edit modal (brouillon only) */}
      {showEditModal && forfait && (
        <ForfaitBuilderModal
          onClose={() => setShowEditModal(false)}
          onSubmit={(data) => editMutation.mutate(data)}
          isLoading={editMutation.isPending}
          initialData={forfait}
        />
      )}
    </div>
  );
}
