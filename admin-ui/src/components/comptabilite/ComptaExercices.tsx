import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { comptaApi, type ExerciceComptable, type PeriodeComptable } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Calendar, Lock, Unlock, CheckCircle, AlertCircle, AlertTriangle,
  Plus, ChevronDown, ChevronRight, Loader2, FileCheck, Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUT_CONFIG = {
  ouvert: { label: 'Ouvert', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cloture_provisoire: { label: 'Clôture provisoire', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle },
  cloture: { label: 'Clôturé', color: 'bg-gray-100 text-gray-600', icon: Lock },
};

export default function ComptaExercices() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newExercice, setNewExercice] = useState({ code: '', date_debut: '', date_fin: '' });
  const [preCloture, setPreCloture] = useState<{ ok: boolean; warnings: string[]; errors: string[] } | null>(null);

  const { data: exercicesData, isLoading } = useQuery({
    queryKey: ['exercices'],
    queryFn: () => comptaApi.getExercices(),
  });

  const { data: periodesData } = useQuery({
    queryKey: ['periodes', expanded],
    queryFn: () => comptaApi.getPeriodesExercice(expanded!),
    enabled: !!expanded,
  });

  const creerMutation = useMutation({
    mutationFn: (data: { date_debut: string; date_fin: string; code: string }) => comptaApi.creerExercice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercices'] });
      setShowCreate(false);
      setNewExercice({ code: '', date_debut: '', date_fin: '' });
    },
  });

  const verrouillerMutation = useMutation({
    mutationFn: ({ exerciceId, periode }: { exerciceId: number; periode: string }) =>
      comptaApi.verrouillerPeriode(exerciceId, periode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['periodes'] }),
  });

  const deverrouillerMutation = useMutation({
    mutationFn: ({ exerciceId, periode }: { exerciceId: number; periode: string }) =>
      comptaApi.deverrouillerPeriode(exerciceId, periode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['periodes'] }),
  });

  const preClotMutation = useMutation({
    mutationFn: (exerciceId: number) => comptaApi.verifierPreCloture(exerciceId),
    onSuccess: (data) => setPreCloture(data),
  });

  const clotProvMutation = useMutation({
    mutationFn: (exerciceId: number) => comptaApi.clotureProvisoire(exerciceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercices'] });
      setPreCloture(null);
    },
  });

  const clotDefMutation = useMutation({
    mutationFn: (exerciceId: number) => comptaApi.clotureDefinitive(exerciceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercices'] });
      setPreCloture(null);
    },
  });

  const exercices = exercicesData?.exercices || [];
  const periodes = periodesData?.periodes || [];

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-purple-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Exercices Comptables</h2>
          <p className="text-sm text-gray-500">Gestion des exercices, périodes et clôtures</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nouvel exercice
        </Button>
      </div>

      {/* Formulaire création */}
      {showCreate && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-medium">Créer un exercice</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Code</label>
              <input
                type="text"
                value={newExercice.code}
                onChange={e => setNewExercice({ ...newExercice, code: e.target.value })}
                placeholder="EX-2026"
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date début</label>
              <input
                type="date"
                value={newExercice.date_debut}
                onChange={e => setNewExercice({ ...newExercice, date_debut: e.target.value })}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date fin</label>
              <input
                type="date"
                value={newExercice.date_fin}
                onChange={e => setNewExercice({ ...newExercice, date_fin: e.target.value })}
                className="w-full px-3 py-2 border rounded text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => creerMutation.mutate(newExercice)}
              disabled={creerMutation.isPending || !newExercice.code || !newExercice.date_debut || !newExercice.date_fin}
            >
              {creerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Créer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
          </div>
          {creerMutation.isError && (
            <p className="text-xs text-red-600">{(creerMutation.error as Error).message}</p>
          )}
        </div>
      )}

      {/* Timeline exercices */}
      {exercices.length === 0 ? (
        <div className="bg-gray-50 border rounded-lg p-8 text-center">
          <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun exercice comptable créé</p>
          <p className="text-sm text-gray-400 mt-1">Créez votre premier exercice pour commencer</p>
        </div>
      ) : (
        <div className="space-y-3">
          {exercices.map((ex: ExerciceComptable) => {
            const config = STATUT_CONFIG[ex.statut] || STATUT_CONFIG.ouvert;
            const StatusIcon = config.icon;
            const isExpanded = expanded === ex.id;

            return (
              <div key={ex.id} className="bg-white border rounded-lg overflow-hidden">
                {/* Header exercice */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpanded(isExpanded ? null : ex.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{ex.code}</span>
                        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', config.color)}>
                          <StatusIcon className="h-3 w-3 inline mr-1" />{config.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(ex.date_debut).toLocaleDateString('fr-FR')} → {new Date(ex.date_fin).toLocaleDateString('fr-FR')}
                        {ex.resultat_net ? ` • Résultat: ${(ex.resultat_net / 100).toFixed(2)}€ (${ex.resultat_type})` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  {ex.statut === 'ouvert' && (
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => preClotMutation.mutate(ex.id)}
                        disabled={preClotMutation.isPending}
                      >
                        <FileCheck className="h-3.5 w-3.5 mr-1" />
                        Vérifier
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm('Clôture provisoire ? Les périodes seront verrouillées.')) {
                            clotProvMutation.mutate(ex.id);
                          }
                        }}
                        disabled={clotProvMutation.isPending}
                      >
                        Clôture provisoire
                      </Button>
                    </div>
                  )}
                  {ex.statut === 'cloture_provisoire' && (
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (confirm('⚠️ Clôture DÉFINITIVE ? Cette action est irréversible. Les à-nouveaux seront générés.')) {
                            clotDefMutation.mutate(ex.id);
                          }
                        }}
                        disabled={clotDefMutation.isPending}
                      >
                        <Shield className="h-3.5 w-3.5 mr-1" />
                        Clôture définitive
                      </Button>
                    </div>
                  )}
                </div>

                {/* Rapport pré-clôture */}
                {preCloture && expanded === ex.id && (
                  <div className="px-4 pb-3">
                    <div className={cn('p-3 rounded-lg border', preCloture.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200')}>
                      <p className={cn('text-sm font-medium', preCloture.ok ? 'text-green-700' : 'text-red-700')}>
                        {preCloture.ok ? '✓ Prêt pour la clôture' : '✗ Problèmes détectés'}
                      </p>
                      {preCloture.errors.map((e, i) => (
                        <p key={i} className="text-xs text-red-600 mt-1"><AlertCircle className="h-3 w-3 inline mr-1" />{e}</p>
                      ))}
                      {preCloture.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-yellow-600 mt-1"><AlertTriangle className="h-3 w-3 inline mr-1" />{w}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grille périodes */}
                {isExpanded && (
                  <div className="border-t px-4 py-3">
                    <h4 className="text-xs font-medium text-gray-500 mb-2">Périodes ({periodes.length})</h4>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1">
                      {periodes.map((p: PeriodeComptable) => {
                        const mois = parseInt(p.periode.split('-')[1]);
                        const moisLabel = new Date(2000, mois - 1).toLocaleDateString('fr-FR', { month: 'short' });

                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              if (ex.statut === 'cloture') return;
                              if (p.verrouillee) {
                                if (confirm(`Déverrouiller ${p.periode} ?`)) {
                                  deverrouillerMutation.mutate({ exerciceId: ex.id, periode: p.periode });
                                }
                              } else {
                                if (confirm(`Verrouiller ${p.periode} ?`)) {
                                  verrouillerMutation.mutate({ exerciceId: ex.id, periode: p.periode });
                                }
                              }
                            }}
                            className={cn(
                              'px-2 py-1.5 rounded text-xs font-medium text-center transition-colors',
                              p.verrouillee
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200',
                              ex.statut === 'cloture' && 'cursor-default opacity-60'
                            )}
                            title={p.verrouillee ? `Verrouillée le ${p.date_verrouillage?.slice(0, 10) || ''}` : 'Cliquer pour verrouiller'}
                          >
                            {p.verrouillee ? <Lock className="h-3 w-3 inline mr-0.5" /> : <Unlock className="h-3 w-3 inline mr-0.5" />}
                            {moisLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
