/**
 * Page Instagram Setter — Bientot disponible
 * En attente de la configuration Meta Business API cote plateforme
 */

import { Card, CardContent } from '@/components/ui/card';
import { Instagram, Clock, MessageCircle, Target, UserCheck } from 'lucide-react';

export default function InstagramSetter() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Setter IA Instagram</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Qualifiez automatiquement vos prospects via les DMs Instagram.
        </p>
      </div>

      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-full flex items-center justify-center">
            <Instagram className="w-10 h-10 text-pink-500" />
          </div>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            Bientot disponible
          </h2>

          <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto mb-8">
            Le Setter IA Instagram est en cours de finalisation.
            Vous pourrez bientot qualifier automatiquement vos prospects
            en DM et les rediriger vers vos appels de closing.
          </p>

          <div className="flex items-center justify-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-8">
            <Clock className="w-4 h-4" />
            <span>Fonctionnalite en cours de developpement</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto">
            <div className="p-4 rounded-lg bg-pink-50 dark:bg-pink-900/20 border border-pink-100 dark:border-pink-800">
              <MessageCircle className="w-6 h-6 text-pink-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-pink-700 dark:text-pink-300">DMs automatiques</p>
              <p className="text-xs text-pink-500 dark:text-pink-400 mt-1">Engagement post-ebook</p>
            </div>
            <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800">
              <Target className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Qualification IA</p>
              <p className="text-xs text-purple-500 dark:text-purple-400 mt-1">Scoring & questions</p>
            </div>
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800">
              <UserCheck className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-700 dark:text-green-300">Prise de RDV</p>
              <p className="text-xs text-green-500 dark:text-green-400 mt-1">Redirection Calendly</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
