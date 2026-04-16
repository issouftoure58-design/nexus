import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
// Options de 00:00 a 23:30 par pas de 30min + 23:59 (utile pour les businesses 24/7 type hotel)
const TIME_OPTIONS: string[] = [];
for (let h = 0; h <= 23; h++) {
  for (const m of ['00', '30']) {
    TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:${m}`);
  }
}
TIME_OPTIONS.push('23:59');

export interface PeriodHours {
  label: string;
  open: string;
  close: string;
}

export interface DayMultiHours {
  is_active: boolean;
  periods: PeriodHours[];
}

interface Props {
  hours: DayMultiHours[];
  onChange: (hours: DayMultiHours[]) => void;
  periodLabels?: string[]; // ex: ['Midi', 'Soir'] ou ['Matin', 'Après-midi']
}

export default function ConfigHoursMulti({ hours, onChange, periodLabels = ['Midi', 'Soir'] }: Props) {
  const updateDay = (day: number, field: 'is_active', value: boolean) => {
    const updated = [...hours];
    updated[day] = { ...updated[day], [field]: value };
    onChange(updated);
  };

  const updatePeriod = (day: number, periodIdx: number, field: keyof PeriodHours, value: string) => {
    const updated = [...hours];
    const periods = [...updated[day].periods];
    periods[periodIdx] = { ...periods[periodIdx], [field]: value };
    updated[day] = { ...updated[day], periods };
    onChange(updated);
  };

  const addPeriod = (day: number) => {
    const updated = [...hours];
    const existingCount = updated[day].periods.length;
    const label = periodLabels[existingCount] || `Période ${existingCount + 1}`;
    updated[day] = {
      ...updated[day],
      periods: [...updated[day].periods, { label, open: '18:00', close: '22:00' }],
    };
    onChange(updated);
  };

  const removePeriod = (day: number, periodIdx: number) => {
    const updated = [...hours];
    updated[day] = {
      ...updated[day],
      periods: updated[day].periods.filter((_, i) => i !== periodIdx),
    };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900">Horaires de service</h3>
      <p className="text-sm text-gray-500">
        Configurez plusieurs plages horaires par jour (ex: {periodLabels.join(' + ')}).
      </p>

      <div className="space-y-3">
        {DAYS.map((dayName, i) => (
          <div key={i} className="bg-gray-50 p-3 rounded-lg space-y-2">
            <div className="flex items-center gap-3">
              <Switch
                checked={hours[i]?.is_active ?? false}
                onCheckedChange={v => updateDay(i, 'is_active', v)}
              />
              <span className="w-24 text-sm font-medium text-gray-700">{dayName}</span>
              {!hours[i]?.is_active && (
                <span className="text-sm text-gray-400 italic">Fermé</span>
              )}
            </div>

            {hours[i]?.is_active && (
              <div className="ml-14 space-y-2">
                {(hours[i]?.periods || []).map((period, pi) => (
                  <div key={pi} className="flex items-center gap-2">
                    <span className="w-20 text-xs font-medium text-gray-500">{period.label}</span>
                    <select
                      value={period.open}
                      onChange={e => updatePeriod(i, pi, 'open', e.target.value)}
                      className="h-8 px-2 border border-gray-300 rounded-md text-sm"
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <span className="text-gray-400">-</span>
                    <select
                      value={period.close}
                      onChange={e => updatePeriod(i, pi, 'close', e.target.value)}
                      className="h-8 px-2 border border-gray-300 rounded-md text-sm"
                    >
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {hours[i].periods.length > 1 && (
                      <button onClick={() => removePeriod(i, pi)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                {hours[i].periods.length < 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addPeriod(i)}
                    className="text-cyan-600 text-xs h-7"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Ajouter une période
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
