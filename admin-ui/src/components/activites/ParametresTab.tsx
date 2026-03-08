/**
 * ParametresTab - Onglet Paramètres des prestations
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ParametresTab() {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Paramètres des prestations</h2>

        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Durée minimale entre deux prestations (minutes)
            </label>
            <Input type="number" defaultValue={15} className="w-48" />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Délai minimum de prise de prestation (heures)
            </label>
            <Input type="number" defaultValue={24} className="w-48" />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Horaires d'ouverture
            </label>
            <div className="flex items-center gap-4">
              <Input type="time" defaultValue="09:00" className="w-32" />
              <span className="text-gray-500">à</span>
              <Input type="time" defaultValue="19:00" className="w-32" />
            </div>
          </div>

          <div className="pt-4">
            <Button>Enregistrer les paramètres</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
