import { Switch } from '@/components/ui/switch';

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 23; h++) {
  for (const m of ['00', '30']) {
    TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:${m}`);
  }
}

export interface DayHours {
  is_active: boolean;
  open: string;
  close: string;
}

interface Props {
  hours: DayHours[];
  onChange: (hours: DayHours[]) => void;
}

export default function ConfigHoursSingle({ hours, onChange }: Props) {
  const update = (day: number, field: keyof DayHours, value: string | boolean) => {
    const updated = [...hours];
    updated[day] = { ...updated[day], [field]: value };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900">Horaires d'ouverture</h3>
      <p className="text-sm text-gray-500">Configurez vos horaires pour chaque jour de la semaine.</p>

      <div className="space-y-2">
        {DAYS.map((dayName, i) => (
          <div key={i} className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg">
            <Switch
              checked={hours[i]?.is_active ?? false}
              onCheckedChange={v => update(i, 'is_active', v)}
            />
            <span className="w-24 text-sm font-medium text-gray-700">{dayName}</span>
            {hours[i]?.is_active ? (
              <div className="flex items-center gap-2">
                <select
                  value={hours[i]?.open || '09:00'}
                  onChange={e => update(i, 'open', e.target.value)}
                  className="h-9 px-2 border border-gray-300 rounded-md text-sm"
                >
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <span className="text-gray-400">-</span>
                <select
                  value={hours[i]?.close || '18:00'}
                  onChange={e => update(i, 'close', e.target.value)}
                  className="h-9 px-2 border border-gray-300 rounded-md text-sm"
                >
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            ) : (
              <span className="text-sm text-gray-400 italic">Fermé</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
