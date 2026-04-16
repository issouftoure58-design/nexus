import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { disponibilitesApi } from '@/lib/api';
import { useTenantContext } from '@/contexts/TenantContext';
import {
  Clock, Save, Loader2, Plus, Trash2, CalendarOff, AlertCircle, Check,
} from 'lucide-react';

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// Options de 00:00 a 23:30 par pas de 30min + 23:59 (utile pour les businesses 24/7 type hotel)
const TIME_OPTIONS: string[] = [];
for (let h = 0; h <= 23; h++) {
  for (const m of ['00', '30']) {
    TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:${m}`);
  }
}
TIME_OPTIONS.push('23:59');

// Templates that use multi-period hours
const MULTI_PERIOD_TEMPLATES = new Set(['restaurant', 'medical', 'garage']);

const PERIOD_LABELS: Record<string, string[]> = {
  restaurant: ['Midi', 'Soir'],
  medical: ['Matin', 'Après-midi'],
  garage: ['Matin', 'Après-midi'],
};

interface HorairePeriod {
  label: string;
  heure_debut: string;
  heure_fin: string;
}

interface HoraireRow {
  jour: number;
  nom: string;
  is_active: boolean;
  periods: HorairePeriod[];
}

interface HoraireEntry {
  jour: number;
  heure_debut: string | null;
  heure_fin: string | null;
  is_active: boolean;
  period_label?: string;
  sort_order?: number;
}

interface CongeEntry {
  id: number;
  date_debut: string;
  date_fin: string;
  motif?: string;
}

export default function Disponibilites() {
  const queryClient = useQueryClient();
  const { tenant } = useTenantContext();
  const templateId = (tenant as { template_id?: string })?.template_id || 'autre';
  const isMultiPeriod = MULTI_PERIOD_TEMPLATES.has(templateId);
  const defaultLabels = PERIOD_LABELS[templateId] || ['Journée'];

  const [horaires, setHoraires] = useState<HoraireRow[]>([]);
  const [horairesLoaded, setHorairesLoaded] = useState(false);
  const [congeForm, setCongeForm] = useState({ date_debut: '', date_fin: '', motif: '' });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Charger les horaires (supporte multi-period via period_label)
  const { isLoading: loadingHoraires } = useQuery({
    queryKey: ['disponibilites-horaires'],
    queryFn: async () => {
      const data = await disponibilitesApi.getHoraires();
      if (!horairesLoaded) {
        // Group by day
        const byDay: Record<number, HoraireEntry[]> = {};
        (data.horaires || []).forEach((h: HoraireEntry) => {
          if (!byDay[h.jour]) byDay[h.jour] = [];
          byDay[h.jour].push(h);
        });

        const rows: HoraireRow[] = [];
        for (let i = 0; i < 7; i++) {
          const dayEntries = byDay[i] || [];
          if (dayEntries.length === 0) {
            rows.push({
              jour: i,
              nom: JOURS[i],
              is_active: i !== 0,
              periods: i !== 0
                ? [{ label: defaultLabels[0] || 'Journée', heure_debut: '09:00', heure_fin: '18:00' }]
                : [],
            });
          } else {
            const anyActive = dayEntries.some((e) => e.is_active);
            rows.push({
              jour: i,
              nom: JOURS[i],
              is_active: anyActive,
              periods: dayEntries
                .filter((e) => e.is_active)
                .map((e) => ({
                  label: formatPeriodLabel(e.period_label || 'journee'),
                  heure_debut: e.heure_debut || '09:00',
                  heure_fin: e.heure_fin || '18:00',
                })),
            });
            // If active but no periods (all inactive entries), add default
            if (anyActive && rows[rows.length - 1].periods.length === 0) {
              rows[rows.length - 1].periods = [{ label: 'Journée', heure_debut: '09:00', heure_fin: '18:00' }];
            }
          }
        }

        setHoraires(rows);
        setHorairesLoaded(true);
      }
      return data;
    },
  });

  const { data: congesData, isLoading: loadingConges } = useQuery({
    queryKey: ['disponibilites-conges'],
    queryFn: () => disponibilitesApi.getConges(),
  });

  // Sauvegarder: flatten multi-period to array
  const saveMutation = useMutation({
    mutationFn: (data: HoraireRow[]) => {
      const flat: HoraireEntry[] = [];
      data.forEach(day => {
        if (!day.is_active || day.periods.length === 0) {
          flat.push({
            jour: day.jour,
            heure_debut: null,
            heure_fin: null,
            is_active: false,
            period_label: 'journee',
          });
        } else {
          day.periods.forEach((p, idx) => {
            flat.push({
              jour: day.jour,
              heure_debut: p.heure_debut,
              heure_fin: p.heure_fin,
              is_active: true,
              period_label: normalizePeriodLabel(p.label),
              sort_order: idx,
            });
          });
        }
      });
      return disponibilitesApi.updateHoraires(flat);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disponibilites-horaires'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const addCongeMutation = useMutation({
    mutationFn: (data: { date_debut: string; date_fin: string; motif?: string }) =>
      disponibilitesApi.createConge(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disponibilites-conges'] });
      setCongeForm({ date_debut: '', date_fin: '', motif: '' });
    },
  });

  const deleteCongeMutation = useMutation({
    mutationFn: (id: number) => disponibilitesApi.deleteConge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disponibilites-conges'] });
    },
  });

  const toggleDay = (jour: number, active: boolean) => {
    setHoraires(prev => prev.map(h => {
      if (h.jour !== jour) return h;
      return {
        ...h,
        is_active: active,
        periods: active && h.periods.length === 0
          ? [{ label: defaultLabels[0] || 'Journée', heure_debut: '09:00', heure_fin: '18:00' }]
          : h.periods,
      };
    }));
  };

  const updatePeriod = (jour: number, periodIdx: number, field: keyof HorairePeriod, value: string) => {
    setHoraires(prev => prev.map(h => {
      if (h.jour !== jour) return h;
      const periods = [...h.periods];
      periods[periodIdx] = { ...periods[periodIdx], [field]: value };
      return { ...h, periods };
    }));
  };

  const addPeriod = (jour: number) => {
    setHoraires(prev => prev.map(h => {
      if (h.jour !== jour) return h;
      const nextLabel = defaultLabels[h.periods.length] || `Période ${h.periods.length + 1}`;
      return {
        ...h,
        periods: [...h.periods, { label: nextLabel, heure_debut: '18:00', heure_fin: '22:00' }],
      };
    }));
  };

  const removePeriod = (jour: number, periodIdx: number) => {
    setHoraires(prev => prev.map(h => {
      if (h.jour !== jour) return h;
      return { ...h, periods: h.periods.filter((_, i) => i !== periodIdx) };
    }));
  };

  const conges = congesData?.conges || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="w-7 h-7 text-cyan-500" />
          Disponibilités
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Gérez vos horaires d'ouverture et périodes de fermeture
        </p>
      </div>

      {/* Horaires */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-500" />
              Horaires hebdomadaires
              {isMultiPeriod && (
                <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-normal">
                  Multi-période
                </span>
              )}
            </span>
            <Button
              onClick={() => saveMutation.mutate(horaires)}
              disabled={saveMutation.isPending || loadingHoraires}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : saveSuccess ? (
                <Check className="w-4 h-4 mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saveSuccess ? 'Enregistré !' : 'Enregistrer'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHoraires ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
            </div>
          ) : (
            <div className="space-y-3">
              {horaires.map((h) => (
                <div
                  key={h.jour}
                  className={`p-3 rounded-lg border transition-colors ${
                    h.is_active
                      ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      : 'bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-28 font-medium text-gray-700 dark:text-gray-300">
                      {h.nom}
                    </div>
                    <Switch
                      checked={h.is_active}
                      onCheckedChange={(checked) => toggleDay(h.jour, checked)}
                    />
                    {!h.is_active && (
                      <span className="text-gray-400 dark:text-gray-500 text-sm italic">Fermé</span>
                    )}
                  </div>

                  {h.is_active && (
                    <div className="ml-32 mt-2 space-y-2">
                      {h.periods.map((p, pi) => (
                        <div key={pi} className="flex items-center gap-2">
                          {isMultiPeriod && (
                            <span className="w-20 text-xs font-medium text-gray-500">{p.label}</span>
                          )}
                          <select
                            value={p.heure_debut}
                            onChange={(e) => updatePeriod(h.jour, pi, 'heure_debut', e.target.value)}
                            className="px-3 py-1.5 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 text-sm"
                          >
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <span className="text-gray-400">à</span>
                          <select
                            value={p.heure_fin}
                            onChange={(e) => updatePeriod(h.jour, pi, 'heure_fin', e.target.value)}
                            className="px-3 py-1.5 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 text-sm"
                          >
                            {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          {h.periods.length > 1 && (
                            <button onClick={() => removePeriod(h.jour, pi)} className="text-red-400 hover:text-red-600 p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      {isMultiPeriod && h.periods.length < 3 && (
                        <button
                          onClick={() => addPeriod(h.jour)}
                          className="flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-700 font-medium mt-1"
                        >
                          <Plus className="w-3 h-3" /> Ajouter une période
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {saveMutation.isError && (
                <div className="flex items-center gap-2 text-red-500 text-sm mt-2">
                  <AlertCircle className="w-4 h-4" />
                  Erreur lors de la sauvegarde
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Congés */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="w-5 h-5 text-orange-500" />
            Congés et fermetures exceptionnelles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date début</label>
              <Input
                type="date"
                value={congeForm.date_debut}
                onChange={(e) => setCongeForm(prev => ({ ...prev, date_debut: e.target.value }))}
                className="w-40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date fin</label>
              <Input
                type="date"
                value={congeForm.date_fin}
                onChange={(e) => setCongeForm(prev => ({ ...prev, date_fin: e.target.value }))}
                className="w-40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Motif</label>
              <Input
                value={congeForm.motif}
                onChange={(e) => setCongeForm(prev => ({ ...prev, motif: e.target.value }))}
                placeholder="Ex: Vacances"
                className="w-48"
              />
            </div>
            <Button
              onClick={() => {
                if (congeForm.date_debut && congeForm.date_fin) {
                  addCongeMutation.mutate({
                    date_debut: congeForm.date_debut,
                    date_fin: congeForm.date_fin,
                    motif: congeForm.motif || undefined,
                  });
                }
              }}
              disabled={!congeForm.date_debut || !congeForm.date_fin || addCongeMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {addCongeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Ajouter
            </Button>
          </div>

          {loadingConges ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : conges.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              Aucun congé programmé
            </p>
          ) : (
            <div className="space-y-2">
              {conges.map((c: CongeEntry) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {new Date(c.date_debut + 'T12:00:00').toLocaleDateString('fr-FR')}
                      {' '}&rarr;{' '}
                      {new Date(c.date_fin + 'T12:00:00').toLocaleDateString('fr-FR')}
                    </span>
                    {c.motif && (
                      <span className="ml-2 text-sm text-gray-500">— {c.motif}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCongeMutation.mutate(c.id)}
                    disabled={deleteCongeMutation.isPending}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Helpers
function formatPeriodLabel(raw: string): string {
  const map: Record<string, string> = {
    journee: 'Journée',
    midi: 'Midi',
    soir: 'Soir',
    matin: 'Matin',
    'apres-midi': 'Après-midi',
    'apres_midi': 'Après-midi',
  };
  return map[raw.toLowerCase()] || raw;
}

function normalizePeriodLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}
