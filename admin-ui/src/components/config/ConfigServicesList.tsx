import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, GripVertical } from 'lucide-react';

export interface ServiceItem {
  id?: number;       // présent si service chargé depuis la DB (créé par signup auto-onboarding)
  nom: string;
  duree_minutes: number;
  prix: number;
  categorie: string;
}

interface Props {
  services: ServiceItem[];
  onChange: (services: ServiceItem[]) => void;
}

export default function ConfigServicesList({ services, onChange }: Props) {
  const [newService, setNewService] = useState<ServiceItem>({
    nom: '', duree_minutes: 30, prix: 0, categorie: 'general',
  });

  const updateService = (index: number, field: keyof ServiceItem, value: string | number) => {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeService = (index: number) => {
    onChange(services.filter((_, i) => i !== index));
  };

  const addService = () => {
    if (!newService.nom.trim()) return;
    onChange([...services, { ...newService }]);
    setNewService({ nom: '', duree_minutes: 30, prix: 0, categorie: 'general' });
  };

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-gray-900">Services proposés</h3>
      <p className="text-sm text-gray-500">Modifiez les services pré-remplis ou ajoutez-en de nouveaux.</p>

      {/* Liste des services existants */}
      <div className="space-y-2">
        {services.map((service, i) => (
          <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
            <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
            <Input
              value={service.nom}
              onChange={e => updateService(i, 'nom', e.target.value)}
              placeholder="Nom du service"
              className="flex-1 h-9"
            />
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={service.duree_minutes}
                onChange={e => updateService(i, 'duree_minutes', parseInt(e.target.value) || 0)}
                className="w-16 h-9 text-center"
                min={5}
                step={5}
              />
              <span className="text-xs text-gray-500">min</span>
            </div>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={service.prix}
                onChange={e => updateService(i, 'prix', parseFloat(e.target.value) || 0)}
                className="w-20 h-9 text-right"
                min={0}
                step={1}
              />
              <span className="text-xs text-gray-500">EUR</span>
            </div>
            <button onClick={() => removeService(i)} className="text-red-400 hover:text-red-600 p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Ajouter un service */}
      <div className="flex items-center gap-2 border border-dashed border-gray-300 p-2 rounded-lg">
        <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
        <Input
          value={newService.nom}
          onChange={e => setNewService(p => ({ ...p, nom: e.target.value }))}
          placeholder="Nouveau service"
          className="flex-1 h-9"
          onKeyDown={e => e.key === 'Enter' && addService()}
        />
        <Input
          type="number"
          value={newService.duree_minutes}
          onChange={e => setNewService(p => ({ ...p, duree_minutes: parseInt(e.target.value) || 30 }))}
          className="w-16 h-9 text-center"
          min={5}
          step={5}
        />
        <Input
          type="number"
          value={newService.prix}
          onChange={e => setNewService(p => ({ ...p, prix: parseFloat(e.target.value) || 0 }))}
          className="w-20 h-9 text-right"
          min={0}
        />
        <Button size="sm" variant="ghost" onClick={addService} disabled={!newService.nom.trim()}>
          Ajouter
        </Button>
      </div>
    </div>
  );
}
