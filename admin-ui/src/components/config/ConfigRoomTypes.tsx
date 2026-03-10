import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';

export interface RoomType {
  type: string;
  capacite: number;
  quantite: number;
  prix_nuit: number;
}

export interface HotelOptions {
  check_in: string;
  check_out: string;
  petit_dejeuner: boolean;
  parking: boolean;
  late_checkout: boolean;
}

interface Props {
  rooms: RoomType[];
  options: HotelOptions;
  onRoomsChange: (rooms: RoomType[]) => void;
  onOptionsChange: (options: HotelOptions) => void;
}

const DEFAULT_ROOMS: RoomType[] = [
  { type: 'Chambre Standard', capacite: 2, quantite: 10, prix_nuit: 89 },
  { type: 'Chambre Supérieure', capacite: 2, quantite: 5, prix_nuit: 129 },
  { type: 'Suite', capacite: 4, quantite: 2, prix_nuit: 219 },
  { type: 'Chambre Familiale', capacite: 5, quantite: 3, prix_nuit: 169 },
];

const DEFAULT_OPTIONS: HotelOptions = {
  check_in: '15:00',
  check_out: '11:00',
  petit_dejeuner: true,
  parking: false,
  late_checkout: false,
};

export { DEFAULT_ROOMS, DEFAULT_OPTIONS };

const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 23; h++) {
  for (const m of ['00', '30']) {
    TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:${m}`);
  }
}

export default function ConfigRoomTypes({ rooms, options, onRoomsChange, onOptionsChange }: Props) {
  const [newRoom, setNewRoom] = useState<RoomType>({ type: '', capacite: 2, quantite: 1, prix_nuit: 0 });

  const updateRoom = (index: number, field: keyof RoomType, value: string | number) => {
    const updated = [...rooms];
    updated[index] = { ...updated[index], [field]: value };
    onRoomsChange(updated);
  };

  const removeRoom = (index: number) => {
    onRoomsChange(rooms.filter((_, i) => i !== index));
  };

  const addRoom = () => {
    if (!newRoom.type.trim()) return;
    onRoomsChange([...rooms, { ...newRoom }]);
    setNewRoom({ type: '', capacite: 2, quantite: 1, prix_nuit: 0 });
  };

  const totalRooms = rooms.reduce((sum, r) => sum + r.quantite, 0);

  return (
    <div className="space-y-6">
      {/* Types de chambres */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Types de chambres</h3>
            <p className="text-sm text-gray-500">Définissez vos chambres et tarifs.</p>
          </div>
          <span className="text-sm font-medium text-cyan-600">{totalRooms} chambres total</span>
        </div>

        <div className="space-y-2">
          {rooms.map((room, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
              <Input
                value={room.type}
                onChange={e => updateRoom(i, 'type', e.target.value)}
                placeholder="Type de chambre"
                className="flex-1 h-9"
              />
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={room.capacite}
                  onChange={e => updateRoom(i, 'capacite', parseInt(e.target.value) || 1)}
                  className="w-14 h-9 text-center"
                  min={1}
                />
                <span className="text-xs text-gray-500">pers</span>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={room.quantite}
                  onChange={e => updateRoom(i, 'quantite', parseInt(e.target.value) || 1)}
                  className="w-14 h-9 text-center"
                  min={1}
                />
                <span className="text-xs text-gray-500">ch.</span>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  value={room.prix_nuit}
                  onChange={e => updateRoom(i, 'prix_nuit', parseFloat(e.target.value) || 0)}
                  className="w-20 h-9 text-right"
                  min={0}
                />
                <span className="text-xs text-gray-500">EUR/n</span>
              </div>
              <button onClick={() => removeRoom(i)} className="text-red-400 hover:text-red-600 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 border border-dashed border-gray-300 p-2 rounded-lg">
          <Plus className="w-4 h-4 text-gray-400" />
          <Input value={newRoom.type} onChange={e => setNewRoom(p => ({ ...p, type: e.target.value }))} placeholder="Nouveau type" className="flex-1 h-9" onKeyDown={e => e.key === 'Enter' && addRoom()} />
          <Input type="number" value={newRoom.capacite} onChange={e => setNewRoom(p => ({ ...p, capacite: parseInt(e.target.value) || 2 }))} className="w-14 h-9 text-center" min={1} />
          <Input type="number" value={newRoom.quantite} onChange={e => setNewRoom(p => ({ ...p, quantite: parseInt(e.target.value) || 1 }))} className="w-14 h-9 text-center" min={1} />
          <Input type="number" value={newRoom.prix_nuit} onChange={e => setNewRoom(p => ({ ...p, prix_nuit: parseFloat(e.target.value) || 0 }))} className="w-20 h-9 text-right" min={0} />
          <Button size="sm" variant="ghost" onClick={addRoom} disabled={!newRoom.type.trim()}>Ajouter</Button>
        </div>
      </div>

      {/* Options hôtel */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Options & horaires</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Check-in à partir de</label>
            <select
              value={options.check_in}
              onChange={e => onOptionsChange({ ...options, check_in: e.target.value })}
              className="w-full h-9 px-2 border border-gray-300 rounded-md text-sm"
            >
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Check-out avant</label>
            <select
              value={options.check_out}
              onChange={e => onOptionsChange({ ...options, check_out: e.target.value })}
              className="w-full h-9 px-2 border border-gray-300 rounded-md text-sm"
            >
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          {[
            { key: 'petit_dejeuner' as const, label: 'Petit-déjeuner inclus', emoji: '🥐' },
            { key: 'parking' as const, label: 'Parking disponible', emoji: '🅿️' },
            { key: 'late_checkout' as const, label: 'Late check-out possible', emoji: '🕐' },
          ].map(opt => (
            <div key={opt.key} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <span className="text-sm text-gray-700">{opt.emoji} {opt.label}</span>
              <Switch
                checked={options[opt.key]}
                onCheckedChange={v => onOptionsChange({ ...options, [opt.key]: v })}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
