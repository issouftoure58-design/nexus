import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { comptaApi, type ExerciceComptable, type PeriodeComptable } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Lock, Unlock, CheckCircle, AlertCircle, AlertTriangle,
  ChevronDown, ChevronRight, Loader2, FileCheck, Shield,
  RotateCcw, TrendingUp, TrendingDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

const MOIS_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR');
}

function formatEuros(centimes: number) {
  return (centimes / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export default function ComptaExercices() {
  const queryClient = useQueryClient();
  const [expandedHistorique, setExpandedHistorique] = useState<number | null>(null);
  const [preCloture, setPreCloture] = useState<{ ok: boolean; warnings: string[]; errors: string[]; stats?: { nb_ecritures: number; nb_non_lettrees: number; nb_periodes_ouvertes: number } } | null>(null);

  // ─── Queries ───
  const { data: exercicesData, isLoading } = useQuery({
    queryKey: ['exercices'],
    queryFn: () => comptaApi.getExercices(),
  });

  const exercices = exercicesData?.exercices || [];
  const exerciceCourant = exercices.find((e: ExerciceComptable) => e.statut === 'ouvert') || null;
  const exercicesClotures = exercices.filter((e: ExerciceComptable) => e.statut === 'cloture');

  const { data: periodesData } = useQuery({
    queryKey: ['periodes', exerciceCourant?.id],
    queryFn: () => comptaApi.getPeriodesExercice(exerciceCourant!.id),
    enabled: !!exerciceCourant,
  });

  const { data: periodesHistorique } = useQuery({
    queryKey: ['periodes', expandedHistorique],
    queryFn: () => comptaApi.getPeriodesExercice(expandedHistorique!),
    enabled: !!expandedHistorique,
  });

  // ─── Mutations ───
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['exercices'] });
    queryClient.invalidateQueries({ queryKey: ['periodes'] });
  };

  const verrouillerMutation = useMutation({
    mutationFn: ({ exerciceId, periode }: { exerciceId: number; periode: string }) =>
      comptaApi.verrouillerPeriode(exerciceId, periode),
    onSuccess: invalidateAll,
  });

  const deverrouillerMutation = useMutation({
    mutationFn: ({ exerciceId, periode }: { exerciceId: number; periode: string }) =>
      comptaApi.deverrouillerPeriode(exerciceId, periode),
    onSuccess: invalidateAll,
  });

  const preClotMutation = useMutation({
    mutationFn: (exerciceId: number) => comptaApi.verifierPreCloture(exerciceId),
    onSuccess: (data) => setPreCloture(data),
  });

  const cloturerMutation = useMutation({
    mutationFn: (exerciceId: number) => comptaApi.cloturerExercice(exerciceId),
    onSuccess: () => {
      invalidateAll();
      setPreCloture(null);
    },
  });

  const rouvrirMutation = useMutation({
    mutationFn: (exerciceId: number) => comptaApi.rouvrirExercice(exerciceId),
    onSuccess: invalidateAll,
  });

  const periodes = periodesData?.periodes || [];

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-purple-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Clôture annuelle</h2>
        <p className="text-sm text-gray-500">Clôturez l'exercice terminé pour archiver et ouvrir le suivant</p>
      </div>

      {/* ═══ EXERCICE COURANT ═══ */}
      {exerciceCourant ? (
        <div className="bg-white border-2 border-purple-200 rounded-xl overflow-hidden">
          {/* Header courant */}
          <div className="bg-gradient-to-r from-purple-50 to-white px-5 py-4 border-b">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-900">{exerciceCourant.code}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    <CheckCircle className="h-3 w-3 inline mr-1" />Ouvert
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formatDate(exerciceCourant.date_debut)} — {formatDate(exerciceCourant.date_fin)}
                </p>
              </div>
            </div>
          </div>

          {/* Grille 12 périodes */}
          <div className="px-5 py-4 border-b">
            <h4 className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Périodes</h4>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
              {periodes.map((p: PeriodeComptable) => {
                const mois = parseInt(p.periode.split('-')[1]) - 1;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (p.verrouillee) {
                        if (confirm(`Déverrouiller ${MOIS_LABELS[mois]} ?`)) {
                          deverrouillerMutation.mutate({ exerciceId: exerciceCourant.id, periode: p.periode });
                        }
                      } else {
                        if (confirm(`Verrouiller ${MOIS_LABELS[mois]} ?`)) {
                          verrouillerMutation.mutate({ exerciceId: exerciceCourant.id, periode: p.periode });
                        }
                      }
                    }}
                    className={cn(
                      'px-2 py-2 rounded-lg text-xs font-medium text-center transition-colors',
                      p.verrouillee
                        ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                        : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                    )}
                    title={p.verrouillee ? `Verrouillée le ${p.date_verrouillage?.slice(0, 10) || ''}` : 'Cliquer pour verrouiller'}
                  >
                    {p.verrouillee ? <Lock className="h-3 w-3 inline mr-0.5" /> : <Unlock className="h-3 w-3 inline mr-0.5" />}
                    {MOIS_LABELS[mois]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rapport pré-clôture */}
          {preCloture && (
            <div className="px-5 py-3 border-b">
              <div className={cn('p-3 rounded-lg border', preCloture.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                <p className={cn('text-sm font-medium', preCloture.ok ? 'text-green-700' : 'text-red-700')}>
                  {preCloture.ok ? 'Prêt pour la clôture' : 'Problèmes détectés'}
                </p>
                {preCloture.stats && (
                  <p className="text-xs text-gray-500 mt-1">
                    {preCloture.stats.nb_ecritures} écritures — {preCloture.stats.nb_non_lettrees} non lettrées — {preCloture.stats.nb_periodes_ouvertes} période(s) ouverte(s)
                  </p>
                )}
                {preCloture.errors.map((e, i) => (
                  <p key={`e-${i}`} className="text-xs text-red-600 mt-1"><AlertCircle className="h-3 w-3 inline mr-1" />{e}</p>
                ))}
                {preCloture.warnings.map((w, i) => (
                  <p key={`w-${i}`} className="text-xs text-yellow-600 mt-1"><AlertTriangle className="h-3 w-3 inline mr-1" />{w}</p>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-5 py-4 bg-gray-50 flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => preClotMutation.mutate(exerciceCourant.id)}
              disabled={preClotMutation.isPending}
            >
              {preClotMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              <FileCheck className="h-3.5 w-3.5 mr-1" />
              Vérifier
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (confirm(`Clôturer l'exercice ${exerciceCourant.code} ?\n\nCette action va :\n— Verrouiller toutes les périodes\n— Calculer le résultat\n— Générer les à-nouveaux sur l'exercice suivant\n\nVous pourrez rouvrir l'exercice si nécessaire.`)) {
                  cloturerMutation.mutate(exerciceCourant.id);
                }
              }}
              disabled={cloturerMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {cloturerMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              <Shield className="h-3.5 w-3.5 mr-1" />
              Clôturer l'exercice {exerciceCourant.code}
            </Button>
            {cloturerMutation.isError && (
              <span className="text-xs text-red-600">{(cloturerMutation.error as Error).message}</span>
            )}
          </div>
        </div>
      ) : (
        /* Pas d'exercice ouvert — tous clôturés */
        exercicesClotures.length > 0 && (
          <div className="bg-gray-50 border rounded-lg p-6 text-center">
            <Lock className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 font-medium">Tous les exercices sont clôturés</p>
            <p className="text-sm text-gray-400 mt-1">Rouvrez un exercice ci-dessous ou attendez la clôture qui créera le suivant automatiquement</p>
          </div>
        )
      )}

      {/* ═══ HISTORIQUE EXERCICES CLÔTURÉS ═══ */}
      {exercicesClotures.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Historique</h3>
          <div className="space-y-2">
            {exercicesClotures.map((ex: ExerciceComptable) => {
              const isExpanded = expandedHistorique === ex.id;
              const pHistorique = isExpanded ? (periodesHistorique?.periodes || []) : [];
              const isBenefice = ex.resultat_type === 'benefice';

              return (
                <div key={ex.id} className="bg-white border rounded-lg overflow-hidden">
                  {/* Ligne compacte */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedHistorique(isExpanded ? null : ex.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{ex.code}</span>
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <Lock className="h-3 w-3 inline mr-0.5" />Clôturé
                          </span>
                          {ex.resultat_net != null && (
                            <span className={cn(
                              'px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1',
                              isBenefice ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            )}>
                              {isBenefice ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {formatEuros(ex.resultat_net)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500">
                          {formatDate(ex.date_debut)} — {formatDate(ex.date_fin)}
                          {ex.date_cloture && ` — clôturé le ${formatDate(ex.date_cloture)}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm(`Rouvrir l'exercice ${ex.code} ?\n\nLes périodes seront déverrouillées et l'écriture de clôture supprimée.\nLes à-nouveaux de l'exercice suivant seront recalculés à la re-clôture.`)) {
                            rouvrirMutation.mutate(ex.id);
                          }
                        }}
                        disabled={rouvrirMutation.isPending}
                      >
                        {rouvrirMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Rouvrir
                      </Button>
                    </div>
                  </div>

                  {/* Détail expandable */}
                  {isExpanded && (
                    <div className="border-t px-4 py-3 bg-gray-50">
                      {/* Grille périodes (read-only) */}
                      <h4 className="text-xs font-medium text-gray-500 mb-2">Périodes</h4>
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1 mb-3">
                        {pHistorique.map((p: PeriodeComptable) => {
                          const mois = parseInt(p.periode.split('-')[1]) - 1;
                          return (
                            <div
                              key={p.id}
                              className="px-2 py-1.5 rounded text-xs font-medium text-center bg-gray-200 text-gray-500 cursor-default"
                            >
                              <Lock className="h-3 w-3 inline mr-0.5" />
                              {MOIS_LABELS[mois]}
                            </div>
                          );
                        })}
                      </div>

                      {/* Détail résultat + AN */}
                      <div className="flex gap-4 text-xs text-gray-600">
                        {ex.resultat_net != null && (
                          <span>Résultat : <strong className={isBenefice ? 'text-green-700' : 'text-red-700'}>{formatEuros(ex.resultat_net)}</strong> ({ex.resultat_type})</span>
                        )}
                        {ex.an_generes && <span className="text-purple-600">AN générés</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
