import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

export interface TableZone {
  nom: string;
  tables: number;
  capacite_par_table: number;
}

interface Props {
  zones: TableZone[];
  onChange: (zones: TableZone[]) => void;
}

const DEFAULT_ZONES: TableZone[] = [
  { nom: 'Salle', tables: 10, capacite_par_table: 4 },
  { nom: 'Terrasse', tables: 6, capacite_par_table: 4 },
  { nom: 'Salon privé', tables: 2, capacite_par_table: 8 },
  { nom: 'Bar', tables: 4, capacite_par_table: 2 },
];

export { DEFAULT_ZONES };

export default function ConfigTableZones({ zones, onChange }: Props) {
  const [newZone, setNewZone] = useState<TableZone>({ nom: '', tables: 4, capacite_par_table: 4 });

  const updateZone = (index: number, field: keyof TableZone, value: string | number) => {
    const updated = [...zones];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeZone = (index: number) => {
    onChange(zones.filter((_, i) => i !== index));
  };

  const addZone = () => {
    if (!newZone.nom.trim()) return;
    onChange([...zones, { ...newZone }]);
    setNewZone({ nom: '', tables: 4, capacite_par_table: 4 });
  };

  const totalCouverts = zones.reduce((sum, z) => sum + z.tables * z.capacite_par_table, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Zones et tables</h3>
          <p className="text-sm text-gray-500">Organisez votre salle par zones.</p>
        </div>
        <span className="text-sm font-medium text-cyan-600">
          {totalCouverts} couverts total
        </span>
      </div>

      <div className="space-y-2">
        {zones.map((zone, i) => (
          <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
            <Input
              value={zone.nom}
              onChange={e => updateZone(i, 'nom', e.target.value)}
              placeholder="Nom de la zone"
              className="flex-1 h-9"
            />
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={zone.tables}
                onChange={e => updateZone(i, 'tables', parseInt(e.target.value) || 0)}
                className="w-16 h-9 text-center"
                min={1}
              />
              <span className="text-xs text-gray-500 w-12">tables</span>
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={zone.capacite_par_table}
                onChange={e => updateZone(i, 'capacite_par_table', parseInt(e.target.value) || 0)}
                className="w-16 h-9 text-center"
                min={1}
              />
              <span className="text-xs text-gray-500 w-12">places</span>
            </div>
            <span className="text-xs text-gray-400 w-12 text-right">
              = {zone.tables * zone.capacite_par_table}
            </span>
            <button onClick={() => removeZone(i)} className="text-red-400 hover:text-red-600 p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border border-dashed border-gray-300 p-2 rounded-lg">
        <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <Input
          value={newZone.nom}
          onChange={e => setNewZone(p => ({ ...p, nom: e.target.value }))}
          placeholder="Nouvelle zone"
          className="flex-1 h-9"
          onKeyDown={e => e.key === 'Enter' && addZone()}
        />
        <Input
          type="number"
          value={newZone.tables}
          onChange={e => setNewZone(p => ({ ...p, tables: parseInt(e.target.value) || 4 }))}
          className="w-16 h-9 text-center"
          min={1}
        />
        <Input
          type="number"
          value={newZone.capacite_par_table}
          onChange={e => setNewZone(p => ({ ...p, capacite_par_table: parseInt(e.target.value) || 4 }))}
          className="w-16 h-9 text-center"
          min={1}
        />
        <Button size="sm" variant="ghost" onClick={addZone} disabled={!newZone.nom.trim()}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}
