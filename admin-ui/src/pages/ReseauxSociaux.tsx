/**
 * Page Reseaux Sociaux — En attente Meta Business API
 * Bloquee tant que les numeros 06/07 + WhatsApp Business ne sont pas actifs
 */

import { Card, CardContent } from '@/components/ui/card';
import { Share2, Clock, Instagram, Facebook } from 'lucide-react';

export default function ReseauxSociaux() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reseaux Sociaux</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Connectez vos comptes Facebook et Instagram pour publier automatiquement.
        </p>
      </div>

      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center">
            <Share2 className="w-10 h-10 text-indigo-400" />
          </div>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            Bientot disponible
          </h2>

          <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto mb-8">
            La connexion a Facebook et Instagram est en cours de finalisation.
            Vous pourrez bientot publier automatiquement sur vos reseaux sociaux
            directement depuis Nexus.
          </p>

          <div className="flex items-center justify-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-8">
            <Clock className="w-4 h-4" />
            <span>Fonctionnalite en cours de developpement</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto">
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
              <Facebook className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Pages Facebook</p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">Publication automatique</p>
            </div>
            <div className="p-4 rounded-lg bg-pink-50 dark:bg-pink-900/20 border border-pink-100 dark:border-pink-800">
              <Instagram className="w-6 h-6 text-pink-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-pink-700 dark:text-pink-300">Instagram Business</p>
              <p className="text-xs text-pink-500 dark:text-pink-400 mt-1">Posts & Stories</p>
            </div>
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <Share2 className="w-6 h-6 text-gray-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Multi-plateformes</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">1 clic, tous les reseaux</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
