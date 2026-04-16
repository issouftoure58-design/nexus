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
}

// Prestation annexe (non-chambre) : petit-dej, parking, transfert, etc.
// Pilotee par toggle actif + prix modifiable, persistee dans la table `services`.
export interface AnnexService {
  id?: number;        // si present = UPDATE, sinon = CREATE
  nom: string;
  prix: number;       // euros
  actif: boolean;
  facturation: 'par_nuit' | 'forfait';
}

// Regex de detection des 3 options "frequentes" mises en avant
const FEATURED_OPTIONS = [
  { key: 'petit_dejeuner', regex: /petit[\s-]?d[eé]jeuner/i, emoji: '🥐', label: 'Petit-déjeuner' },
  { key: 'parking',        regex: /parking/i,                emoji: '🅿️', label: 'Parking' },
  { key: 'late_checkout',  regex: /late[\s-]?check[\s-]?out/i, emoji: '🕐', label: 'Late check-out' },
] as const;

interface Props {
  rooms: RoomType[];
  options: HotelOptions;
  annexServices: AnnexService[];
  onRoomsChange: (rooms: RoomType[]) => void;
  onOptionsChange: (options: HotelOptions) => void;
  onAnnexChange: (annex: AnnexService[]) => void;
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
};

export { DEFAULT_ROOMS, DEFAULT_OPTIONS };

const TIME_OPTIONS: string[] = [];
for (let h = 0; h <= 23; h++) {
  for (const m of ['00', '30']) {
    TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:${m}`);
  }
}
TIME_OPTIONS.push('23:59');

export default function ConfigRoomTypes({
  rooms, options, annexServices,
  onRoomsChange, onOptionsChange, onAnnexChange,
}: Props) {
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

  const updateAnnex = (nom: string, patch: Partial<AnnexService>) => {
    onAnnexChange(annexServices.map(a => a.nom === nom ? { ...a, ...patch } : a));
  };

  const totalRooms = rooms.reduce((sum, r) => sum + r.quantite, 0);

  // Separer les annexes "featured" (3 options frequentes) du reste
  const featuredByKey: Record<string, AnnexService | undefined> = {};
  const otherAnnex: AnnexService[] = [];
  for (const svc of annexServices) {
    const match = FEATURED_OPTIONS.find(f => f.regex.test(svc.nom));
    if (match && !featuredByKey[match.key]) {
      featuredByKey[match.key] = svc;
    } else {
      otherAnnex.push(svc);
    }
  }

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

      {/* Horaires check-in/out */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Horaires</h3>
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
      </div>

      {/* Options frequentes (3 toggles featured, pilotent les services DB) */}
      {FEATURED_OPTIONS.some(f => featuredByKey[f.key]) && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Options fréquentes</h3>
          <div className="space-y-2">
            {FEATURED_OPTIONS.map(opt => {
              const svc = featuredByKey[opt.key];
              if (!svc) return null;
              return (
                <div key={opt.key} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 flex-1">
                    <Switch
                      checked={svc.actif}
                      onCheckedChange={v => updateAnnex(svc.nom, { actif: v })}
                    />
                    <span className="text-sm text-gray-700">{opt.emoji} {svc.nom}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={svc.prix}
                      onChange={e => updateAnnex(svc.nom, { prix: parseFloat(e.target.value) || 0 })}
                      className="w-20 h-8 text-right"
                      min={0}
                    />
                    <select
                      value={svc.facturation}
                      onChange={e => updateAnnex(svc.nom, { facturation: e.target.value as 'par_nuit' | 'forfait' })}
                      className="h-8 px-2 border border-gray-200 rounded text-xs bg-white"
                    >
                      <option value="par_nuit">€/nuit</option>
                      <option value="forfait">€ forfait</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Autres prestations (restauration, lit bebe, transfert, etc.) */}
      {otherAnnex.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Autres prestations</h3>
          <p className="text-sm text-gray-500">
            Activez et tarifez les prestations annexes proposées à vos clients. Choisissez "par nuit" (petit-dej, parking…) ou "forfait" (late checkout, transfert…).
          </p>
          <div className="space-y-2">
            {otherAnnex.map(svc => (
              <div key={svc.nom} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 flex-1">
                  <Switch
                    checked={svc.actif}
                    onCheckedChange={v => updateAnnex(svc.nom, { actif: v })}
                  />
                  <span className="text-sm text-gray-700">{svc.nom}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={svc.prix}
                    onChange={e => updateAnnex(svc.nom, { prix: parseFloat(e.target.value) || 0 })}
                    className="w-20 h-8 text-right"
                    min={0}
                  />
                  <select
                    value={svc.facturation}
                    onChange={e => updateAnnex(svc.nom, { facturation: e.target.value as 'par_nuit' | 'forfait' })}
                    className="h-8 px-2 border border-gray-200 rounded text-xs bg-white"
                  >
                    <option value="par_nuit">€/nuit</option>
                    <option value="forfait">€ forfait</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
