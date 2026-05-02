/**
 * PointageModal — Modal de pointage des heures (éditable)
 * 3 vues : Global / Par Client / Par Salarié
 * Modifications sauvegardées via PUT /api/admin/reservation-lignes/:id
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Loader2, Save, ClipboardList } from 'lucide-react';
import { api } from '../../lib/api';
import { computeHoursTotalsFromEntries, TOTALS_LABELS, type HoursTotals } from '../../lib/majorations';

interface PointageModalProps {
  onClose: () => void;
  membres?: { id: number; nom: string; prenom: string }[];
}

interface PointageEntry {
  ligne_id: number | null;
  reservation_id: number;
  date: string;
  client_id: number | null;
  client_nom: string;
  membre_id: number | null;
  membre_nom: string;
  service_nom: string;
  heure_debut: string | null;
  heure_fin: string | null;
  statut: string;
  is_forfait: boolean;
}

type ViewMode = 'global' | 'client' | 'membre';

export default function PointageModal({ onClose, membres = [] }: PointageModalProps) {
  const [dateDebut, setDateDebut] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateFin, setDateFin] = useState(() => {
    const d = new Date();
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return last.toISOString().slice(0, 10);
  });
  const [viewMode, setViewMode] = useState<ViewMode>('global');
  const [entries, setEntries] = useState<PointageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modified, setModified] = useState<Set<number>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<{ entries: PointageEntry[] }>(
        `/admin/rh/pointage?date_debut=${dateDebut}&date_fin=${dateFin}`
      );
      setEntries(data.entries || []);
      setModified(new Set());
    } catch (err: any) {
      setError(err.message || 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, [dateDebut, dateFin]);

  useEffect(() => {
    loadData();
  }, []);

  const updateEntry = (index: number, field: keyof PointageEntry, value: any) => {
    setEntries(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    const entry = entries[index];
    if (entry?.ligne_id) {
      setModified(prev => new Set(prev).add(index));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    let savedCount = 0;
    try {
      for (const idx of modified) {
        const e = entries[idx];
        if (!e?.ligne_id) continue;
        const body: Record<string, any> = {};
        if (e.heure_debut) body.heure_debut = e.heure_debut;
        if (e.heure_fin) body.heure_fin = e.heure_fin;
        if (e.membre_id) body.membre_id = e.membre_id;
        await api.put(`/admin/reservation-lignes/${e.ligne_id}`, body);
        savedCount++;
      }
      setModified(new Set());
    } catch (err: any) {
      setError(err.message || 'Erreur sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Compute totals from flat entries
  const totals: HoursTotals = useMemo(() => {
    return computeHoursTotalsFromEntries(entries);
  }, [entries]);

  // Group entries by view mode
  const grouped = useMemo(() => {
    if (viewMode === 'global') return { 'Toutes les prestations': entries };

    const map: Record<string, PointageEntry[]> = {};
    for (const e of entries) {
      const key = viewMode === 'client' ? (e.client_nom || 'Sans client') : (e.membre_nom || 'Non assigne');
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [entries, viewMode]);

  const fmtDate = (d: string) => {
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
  };

  const roundH = (n: number) => Math.round(n * 10) / 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-cyan-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pointage des heures
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateDebut}
              onChange={e => setDateDebut(e.target.value)}
              className="px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="date"
              value={dateFin}
              onChange={e => setDateFin(e.target.value)}
              className="px-2 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
            />
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3 py-1.5 text-sm font-medium bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Charger'}
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-700" />

          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(['global', 'client', 'membre'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === v
                    ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-400'
                } ${v !== 'global' ? 'border-l border-gray-200 dark:border-gray-700' : ''}`}
              >
                {v === 'global' ? 'Global' : v === 'client' ? 'Par Client' : 'Par Salarie'}
              </button>
            ))}
          </div>

          {modified.size > 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {modified.size} modification{modified.size > 1 ? 's' : ''} non sauvegardee{modified.size > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">
              Aucune donnee pour cette periode
            </p>
          ) : (
            Object.entries(grouped).map(([groupLabel, groupEntries]) => (
              <div key={groupLabel} className="mb-6">
                {viewMode !== 'global' && (
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{groupLabel}</h3>
                )}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50">
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                        {viewMode !== 'client' && <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Client</th>}
                        {viewMode !== 'membre' && (
                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Salarie</th>
                        )}
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Service</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 w-[100px]">Debut</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 w-[100px]">Fin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupEntries.map((e, i) => {
                        const globalIdx = entries.indexOf(e);
                        const isModified = modified.has(globalIdx);
                        return (
                          <tr key={`${e.reservation_id}-${e.ligne_id}-${e.date}-${i}`} className={`border-t border-gray-100 dark:border-gray-800 ${isModified ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{fmtDate(e.date)}</td>
                            {viewMode !== 'client' && (
                              <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{e.client_nom}</td>
                            )}
                            {viewMode !== 'membre' && (
                              <td className="px-3 py-1.5">
                                {membres.length > 0 ? (
                                  <select
                                    value={e.membre_id || ''}
                                    onChange={ev => updateEntry(globalIdx, 'membre_id', ev.target.value ? Number(ev.target.value) : null)}
                                    className="w-full px-1.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                                  >
                                    <option value="">Non assigne</option>
                                    {membres.map(m => (
                                      <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-gray-500 dark:text-gray-400 text-xs">{e.membre_nom}</span>
                                )}
                              </td>
                            )}
                            <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 text-xs">{e.service_nom}</td>
                            <td className="px-3 py-1.5">
                              <input
                                type="time"
                                value={e.heure_debut || ''}
                                onChange={ev => updateEntry(globalIdx, 'heure_debut', ev.target.value || null)}
                                className="w-full px-1.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <input
                                type="time"
                                value={e.heure_fin || ''}
                                onChange={ev => updateEntry(globalIdx, 'heure_fin', ev.target.value || null)}
                                className="w-full px-1.5 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Sub-totals for grouped views */}
                {viewMode !== 'global' && (() => {
                  const subTotals = computeHoursTotalsFromEntries(groupEntries);
                  return (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex gap-3 flex-wrap">
                      {(Object.keys(TOTALS_LABELS) as (keyof typeof TOTALS_LABELS)[]).map(k => (
                        subTotals[k] > 0 ? <span key={k}>{TOTALS_LABELS[k]} : {roundH(subTotals[k])}h</span> : null
                      ))}
                      <span className="font-medium">Total : {roundH(subTotals.total)}h</span>
                    </div>
                  );
                })()}
              </div>
            ))
          )}

          {/* Global totals */}
          {entries.length > 0 && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Totaux</p>
              <div className="flex flex-wrap gap-4 text-sm">
                {(Object.keys(TOTALS_LABELS) as (keyof typeof TOTALS_LABELS)[]).map(k => (
                  <div key={k} className="flex items-center gap-1">
                    <span className="text-gray-600 dark:text-gray-400">{TOTALS_LABELS[k]} :</span>
                    <span className="font-medium text-gray-900 dark:text-white">{roundH(totals[k])}h</span>
                  </div>
                ))}
                <div className="flex items-center gap-1 border-l border-gray-300 dark:border-gray-600 pl-4">
                  <span className="text-gray-600 dark:text-gray-400">Total :</span>
                  <span className="font-bold text-gray-900 dark:text-white">{roundH(totals.total)}h</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            {modified.size > 0 ? 'Annuler' : 'Fermer'}
          </button>
          {modified.size > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded-lg flex items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sauvegarder {modified.size} modification{modified.size > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
