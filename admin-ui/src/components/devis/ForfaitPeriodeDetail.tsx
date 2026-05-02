import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ArrowLeft, CheckCircle, Play, Lock, Users } from 'lucide-react';
import type { ForfaitPeriode, ForfaitPoste, ForfaitAffectation } from './types';
import { STATUT_PERIODE_LABELS, formatMontant } from './types';

interface RhMembre {
  id: number;
  nom: string;
  prenom: string;
}

export interface ForfaitPeriodeDetailProps {
  forfaitId: number;
  periodeId: number;
  onBack: () => void;
}

type BulkMode = 'jour' | 'semaine' | 'mois' | 'trimestre' | 'annee';

export default function ForfaitPeriodeDetail({ forfaitId, periodeId, onBack }: ForfaitPeriodeDetailProps) {
  const queryClient = useQueryClient();

  const [bulkPosteIdState, setBulkPosteId] = useState<number>(0);
  const [bulkMembreId, setBulkMembreId] = useState<number>(0);
  const [bulkMode, setBulkMode] = useState<BulkMode>('mois');
  const [bulkSemaine, setBulkSemaine] = useState<string>(''); // date debut de la semaine choisie

  // Cell editing: which cell is open for selection
  const [editingCell, setEditingCell] = useState<string | null>(null); // "posteId-day-agentIdx"

  // Load periode data
  const { data, isLoading } = useQuery({
    queryKey: ['forfait-periode', forfaitId, periodeId],
    queryFn: () => api.get<{
      forfait: { id: number; nom: string; client_nom: string; montant_mensuel_ht: number };
      periode: ForfaitPeriode;
      postes: ForfaitPoste[];
      affectations: ForfaitAffectation[];
    }>(`/admin/forfaits/${forfaitId}/periodes/${periodeId}`),
  });

  // Load team members (via /services/equipe — no module RH required)
  const { data: membresData } = useQuery({
    queryKey: ['equipe-membres'],
    queryFn: () => api.get<{ data: RhMembre[] }>('/admin/services/equipe'),
  });

  const forfait = data?.forfait;
  const periode = data?.periode;
  const postes = data?.postes || [];
  const affectations = data?.affectations || [];
  const membres = membresData?.data || [];

  // Auto-select si un seul poste
  const bulkPosteId = bulkPosteIdState || (postes.length === 1 ? postes[0]?.id || 0 : 0);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    if (!periode) return [];
    const days: string[] = [];
    const start = new Date(periode.date_debut + 'T12:00:00');
    const end = new Date(periode.date_fin + 'T12:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, [periode]);

  // Group days by week for display
  const weeks = useMemo(() => {
    const result: string[][] = [];
    let currentWeek: string[] = [];
    for (const day of calendarDays) {
      const d = new Date(day + 'T12:00:00');
      if (d.getDay() === 1 && currentWeek.length > 0) {
        result.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    }
    if (currentWeek.length > 0) result.push(currentWeek);
    return result;
  }, [calendarDays]);

  // Affectations lookup: poste_id -> date -> membre[]
  const affectationsMap = useMemo(() => {
    const map: Record<number, Record<string, ForfaitAffectation[]>> = {};
    for (const a of affectations) {
      if (!map[a.poste_id]) map[a.poste_id] = {};
      if (!map[a.poste_id][a.date]) map[a.poste_id][a.date] = [];
      map[a.poste_id][a.date].push(a);
    }
    return map;
  }, [affectations]);

  // Stats
  const totalSlots = useMemo(() => {
    let total = 0;
    for (const poste of postes) {
      const jours = poste.jours || [true, true, true, true, true, false, false];
      for (const day of calendarDays) {
        const d = new Date(day + 'T12:00:00');
        const dayOfWeek = d.getDay();
        const joursIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        if (jours[joursIndex]) {
          total += poste.effectif;
        }
      }
    }
    return total;
  }, [postes, calendarDays]);

  const filledSlots = affectations.length;
  const progress = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

  // Bulk affectation mutation
  const bulkMutation = useMutation({
    mutationFn: (body: { mode: BulkMode; membre_id: number; poste_id: number; scope: Record<string, string> }) =>
      api.put(`/admin/forfaits/${forfaitId}/periodes/${periodeId}/affectations`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forfait-periode', forfaitId, periodeId] });
    },
  });

  // Single-cell affectation mutation (mode jour)
  // membre_id=0 → effacer l'affectation
  const cellMutation = useMutation({
    mutationFn: (body: { mode: 'jour'; membre_id: number; poste_id: number; scope: { date: string; clear_membre_id?: number } }) =>
      api.put(`/admin/forfaits/${forfaitId}/periodes/${periodeId}/affectations`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forfait-periode', forfaitId, periodeId] });
      setEditingCell(null);
    },
  });

  // Executer mutation
  const executerMutation = useMutation({
    mutationFn: () => api.post(`/admin/forfaits/${forfaitId}/periodes/${periodeId}/executer`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forfait-periode', forfaitId, periodeId] });
      queryClient.invalidateQueries({ queryKey: ['forfait', forfaitId] });
    },
  });

  // Cloturer mutation
  const cloturerMutation = useMutation({
    mutationFn: () => api.post(`/admin/forfaits/${forfaitId}/periodes/${periodeId}/cloturer`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forfait-periode', forfaitId, periodeId] });
      queryClient.invalidateQueries({ queryKey: ['forfait', forfaitId] });
    },
  });

  // Reinitialiser mutation (reset en_cours → planifie, supprime resa)
  const reinitMutation = useMutation({
    mutationFn: () => api.post(`/admin/forfaits/${forfaitId}/periodes/${periodeId}/reinitialiser`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forfait-periode', forfaitId, periodeId] });
      queryClient.invalidateQueries({ queryKey: ['forfait', forfaitId] });
    },
  });

  const handleBulkApply = () => {
    if (!bulkPosteId || !bulkMembreId) return;
    if (bulkMode === 'semaine' && !bulkSemaine) return;
    const scope: Record<string, string> = { mois: periode?.mois || '' };
    if (bulkMode === 'semaine') scope.semaine_debut = bulkSemaine;
    bulkMutation.mutate({
      mode: bulkMode,
      membre_id: bulkMembreId,
      poste_id: bulkPosteId,
      scope,
    });
  };

  const handleBulkClear = () => {
    if (!bulkPosteId) return;
    const scope: Record<string, string> = { mois: periode?.mois || '' };
    if (bulkMode === 'semaine' && bulkSemaine) scope.semaine_debut = bulkSemaine;
    bulkMutation.mutate({
      mode: bulkMode === 'semaine' && bulkSemaine ? 'semaine' : 'mois',
      membre_id: 0, // 0 = effacer
      poste_id: bulkPosteId,
      scope,
    });
  };

  if (isLoading) {
    return <div className="p-6 text-center text-gray-500">Chargement...</div>;
  }

  if (!periode || !forfait) {
    return <div className="p-6 text-center text-red-500">Periode non trouvee</div>;
  }

  const isCloture = periode.statut === 'cloture';
  const isExecute = !!periode.reservation_id;
  const statutInfo = STATUT_PERIODE_LABELS[periode.statut];

  const handleCellClick = (posteId: number, day: string, agentIdx: number) => {
    if (isCloture) return;
    const key = `${posteId}-${day}-${agentIdx}`;
    setEditingCell(prev => prev === key ? null : key);
  };

  const handleCellSelect = (posteId: number, day: string, membreId: number) => {
    cellMutation.mutate({ mode: 'jour', membre_id: membreId, poste_id: posteId, scope: { date: day } });
  };

  const handleCellClear = (posteId: number, day: string, membreId?: number) => {
    cellMutation.mutate({ mode: 'jour', membre_id: 0, poste_id: posteId, scope: { date: day, clear_membre_id: membreId } });
  };

  const moisLabel = new Date(periode.date_debut + 'T12:00:00')
    .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const moisLabelCap = moisLabel.charAt(0).toUpperCase() + moisLabel.slice(1);

  const JOURS_COURTS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{moisLabelCap} — {forfait.nom}</h2>
          <p className="text-sm text-gray-500">{forfait.client_nom}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{formatMontant(periode.montant_prevu)}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statutInfo.bg} ${statutInfo.color}`}>
            {statutInfo.label}
          </span>
        </div>
      </div>

      {/* Affectation rapide (si pas cloture) */}
      {!isCloture && (
        <div className="bg-gray-50 border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Affectation rapide</h3>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Poste</label>
              <select
                value={bulkPosteId || 0}
                onChange={e => setBulkPosteId(parseInt(e.target.value))}
                className="border rounded px-2 py-1.5 text-sm"
              >
                {postes.length > 1 && <option value={0}>Choisir...</option>}
                {postes.map(p => (
                  <option key={p.id} value={p.id}>{p.service_nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Agent</label>
              <select
                value={bulkMembreId}
                onChange={e => setBulkMembreId(parseInt(e.target.value))}
                className="border rounded px-2 py-1.5 text-sm"
              >
                <option value={0}>Choisir...</option>
                {membres.map(m => (
                  <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sur</label>
              <select
                value={bulkMode}
                onChange={e => { setBulkMode(e.target.value as BulkMode); setBulkSemaine(''); }}
                className="border rounded px-2 py-1.5 text-sm"
              >
                <option value="mois">Tout le mois</option>
                <option value="semaine">Semaine</option>
                <option value="trimestre">Trimestre</option>
                <option value="annee">Toute l'annee</option>
              </select>
            </div>
            {bulkMode === 'semaine' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Semaine du</label>
                <select
                  value={bulkSemaine}
                  onChange={e => setBulkSemaine(e.target.value)}
                  className="border rounded px-2 py-1.5 text-sm"
                >
                  <option value="">Choisir...</option>
                  {weeks.map((w, i) => {
                    const first = w[0];
                    const last = w[w.length - 1];
                    const fmtD = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                    // Trouver le lundi de cette semaine
                    const d0 = new Date(first + 'T12:00:00');
                    const dow = d0.getDay();
                    const mondayOffset = dow === 0 ? -6 : 1 - dow;
                    const monday = new Date(d0);
                    monday.setDate(monday.getDate() + mondayOffset);
                    const mondayStr = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
                    return (
                      <option key={i} value={mondayStr}>
                        {fmtD(first)} → {fmtD(last)}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            <button
              onClick={handleBulkApply}
              disabled={!bulkPosteId || !bulkMembreId || bulkMutation.isPending || (bulkMode === 'semaine' && !bulkSemaine)}
              className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {bulkMutation.isPending ? 'Application...' : 'Appliquer'}
            </button>
            <button
              onClick={handleBulkClear}
              disabled={!bulkPosteId || bulkMutation.isPending}
              className="px-4 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded text-sm hover:bg-red-100 disabled:opacity-50"
            >
              Tout retirer
            </button>
          </div>
          {bulkMutation.isSuccess && (
            <p className="text-sm text-green-600 mt-2">Affectations creees</p>
          )}
        </div>
      )}

      {/* Grille par poste */}
      {postes.map(poste => {
        const joursLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        const joursActifs = (poste.jours || [])
          .map((j: boolean, idx: number) => j ? joursLabels[idx] : null)
          .filter(Boolean)
          .join('-');

        return (
          <div key={poste.id} className="bg-white border rounded-lg overflow-visible">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{poste.service_nom}</span>
                <span className="text-sm text-gray-500">
                  ({poste.effectif} agent{poste.effectif > 1 ? 's' : ''}, {joursActifs}, {poste.heure_debut}–{poste.heure_fin})
                </span>
              </div>
            </div>

            <div>
              {weeks.map((week, wi) => (
                <div key={wi} className="border-b last:border-b-0">
                  <div className="grid" style={{ gridTemplateColumns: `100px repeat(${week.length}, 1fr)` }}>
                    {/* Header row */}
                    <div className="px-2 py-1 bg-gray-50 text-xs text-gray-500 font-medium border-r" />
                    {week.map(day => {
                      const d = new Date(day + 'T12:00:00');
                      const jourStr = JOURS_COURTS[d.getDay()];
                      const dayNum = d.getDate();
                      const joursIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
                      const isWorkDay = (poste.jours || [])[joursIndex];

                      return (
                        <div
                          key={day}
                          className={`px-1 py-1 text-center text-xs font-medium border-r last:border-r-0 ${
                            isWorkDay ? 'bg-gray-50' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {jourStr} {dayNum}
                        </div>
                      );
                    })}

                    {/* Agent rows */}
                    {Array.from({ length: poste.effectif }, (_, agentIdx) => (
                      <React.Fragment key={agentIdx}>
                        <div className="px-2 py-1.5 text-xs text-gray-500 border-r flex items-center">
                          Ag.{agentIdx + 1}
                        </div>
                        {week.map(day => {
                          const d = new Date(day + 'T12:00:00');
                          const joursIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
                          const isWorkDay = (poste.jours || [])[joursIndex];

                          if (!isWorkDay) {
                            return (
                              <div key={day} className="px-1 py-1.5 bg-gray-100 border-r last:border-r-0" />
                            );
                          }

                          const dayAffectations = affectationsMap[poste.id!]?.[day] || [];
                          const aff = dayAffectations[agentIdx];
                          const cellKey = `${poste.id}-${day}-${agentIdx}`;
                          const isEditing = editingCell === cellKey;

                          return (
                            <div
                              key={day}
                              className={`relative px-1 py-1.5 text-center text-xs border-r last:border-r-0 ${
                                aff ? 'bg-blue-50' : 'bg-yellow-50'
                              } ${isCloture ? '' : 'cursor-pointer hover:bg-blue-100'}`}
                              onClick={() => handleCellClick(poste.id!, day, agentIdx)}
                            >
                              {aff ? (
                                <span className="font-medium text-blue-700 truncate block">
                                  {aff.membre_nom?.split(' ')[0] || `#${aff.membre_id}`}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                              {isEditing && (() => {
                                const openUp = wi >= weeks.length - 1;
                                return (
                                  <div className={`absolute z-30 left-0 bg-white border rounded-lg shadow-lg min-w-[160px] max-h-52 overflow-y-auto ${
                                    openUp ? 'bottom-full mb-1' : 'top-full mt-1'
                                  }`}>
                                    {/* Si ouverture vers le haut, Retirer en bas (plus proche de la cellule) */}
                                    {!openUp && aff && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleCellClear(poste.id!, day, aff?.membre_id); }}
                                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-red-50 text-red-600 border-b font-medium"
                                      >
                                        Retirer
                                      </button>
                                    )}
                                    {membres.map(m => (
                                      <button
                                        key={m.id}
                                        onClick={(e) => { e.stopPropagation(); handleCellSelect(poste.id!, day, m.id); }}
                                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 truncate"
                                      >
                                        {m.prenom} {m.nom}
                                      </button>
                                    ))}
                                    {openUp && aff && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleCellClear(poste.id!, day, aff?.membre_id); }}
                                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-red-50 text-red-600 border-t font-medium"
                                      >
                                        Retirer
                                      </button>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Progress + actions */}
      <div className="flex items-center justify-between bg-white border rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="font-medium">{filledSlots}/{totalSlots}</span>
            <span className="text-gray-500 ml-1">creneaux affectes ({progress}%)</span>
          </div>
          <div className="w-32 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 rounded-full h-2 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex gap-3">
          {!isExecute && !isCloture && (
            <button
              onClick={() => {
                if (confirm(`Executer la periode ${moisLabelCap} ? Cela creera la prestation et le planning.`)) {
                  executerMutation.mutate();
                }
              }}
              disabled={executerMutation.isPending || filledSlots === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              {executerMutation.isPending ? 'Execution...' : 'Executer la periode'}
            </button>
          )}

          {isExecute && !isCloture && (
            <>
              <button
                onClick={() => {
                  if (confirm(`Reinitialiser la periode ${moisLabelCap} ? La prestation et le planning seront supprimes.`)) {
                    reinitMutation.mutate();
                  }
                }}
                disabled={reinitMutation.isPending}
                className="px-4 py-2 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-sm hover:bg-orange-100 disabled:opacity-50"
              >
                {reinitMutation.isPending ? 'Reinitialisation...' : 'Reinitialiser'}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Cloturer la periode ${moisLabelCap} ? La facture sera generee.`)) {
                    cloturerMutation.mutate();
                  }
                }}
                disabled={cloturerMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {cloturerMutation.isPending ? 'Cloture...' : 'Cloturer la periode'}
              </button>
            </>
          )}

          {isCloture && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <Lock className="w-4 h-4" />
              Periode cloturee
              {periode.facture_id && <span className="text-gray-500">(Facture generee)</span>}
            </div>
          )}
        </div>
      </div>

      {/* Mutation feedback */}
      {executerMutation.isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          Periode executee — prestation creee
        </div>
      )}
      {cloturerMutation.isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          Periode cloturee — facture generee
        </div>
      )}
      {(executerMutation.isError || cloturerMutation.isError || bulkMutation.isError || cellMutation.isError || reinitMutation.isError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {(executerMutation.error || cloturerMutation.error || bulkMutation.error || cellMutation.error || reinitMutation.error)?.message || 'Erreur'}
        </div>
      )}
    </div>
  );
}
