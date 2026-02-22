/**
 * TrialBanner - Bannière de statut trial
 *
 * Affiche:
 * - Jours restants pendant la période d'essai
 * - Barres de progression d'usage
 * - CTA pour passer au plan payant
 */

import { useQuery } from '@tanstack/react-query';
import { trialApi, TrialStatus } from '@/lib/api';
import { Clock, AlertTriangle, Sparkles, X, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function TrialBanner() {
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);

  const { data: status, isLoading } = useQuery<TrialStatus>({
    queryKey: ['trial-status'],
    queryFn: trialApi.getStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Ne rien afficher si loading, pas en trial, ou dismissed
  if (isLoading || !status?.isTrial || isDismissed) {
    return null;
  }

  // Si payant, ne pas afficher
  if (status.isPaid) {
    return null;
  }

  const isUrgent = status.daysRemaining <= 3;
  const isExpired = status.isExpired;

  // Calculer le pourcentage d'usage le plus critique
  // Handle unlimited quotas (limit <= 0)
  const usagePercentages = Object.entries(status.limits).map(([key, limit]) => {
    const used = status.usage[key as keyof typeof status.usage] || 0;
    const isUnlimited = limit <= 0;
    return {
      key,
      used,
      limit,
      isUnlimited,
      percentage: isUnlimited ? 0 : Math.round((used / limit) * 100),
    };
  });

  const highestUsage = usagePercentages.reduce((a, b) =>
    a.percentage > b.percentage ? a : b
  );

  const resourceNames: Record<string, string> = {
    interactions_ia: 'Interactions IA',
    reservations: 'Réservations',
    sms: 'SMS',
    clients: 'Clients',
    emails: 'Emails',
  };

  return (
    <div
      className={`
        border-b px-4 py-2 flex items-center justify-between gap-4
        ${isExpired
          ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
          : isUrgent
            ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
            : 'bg-cyan-50 border-cyan-200 dark:bg-cyan-900/20 dark:border-cyan-800'
        }
      `}
    >
      {/* Left: Status */}
      <div className="flex items-center gap-3">
        {isExpired ? (
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
        ) : isUrgent ? (
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
        ) : (
          <Clock className="w-5 h-5 text-cyan-500 flex-shrink-0" />
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
          <span className={`text-sm font-medium ${
            isExpired
              ? 'text-red-700 dark:text-red-300'
              : isUrgent
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-cyan-700 dark:text-cyan-300'
          }`}>
            {isExpired
              ? 'Essai terminé'
              : `${status.daysRemaining} jour${status.daysRemaining > 1 ? 's' : ''} restant${status.daysRemaining > 1 ? 's' : ''}`}
          </span>

          {/* Usage le plus critique */}
          {(highestUsage.percentage > 0 || highestUsage.isUnlimited) && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="text-xs">|</span>
              <span>{resourceNames[highestUsage.key]}: {highestUsage.used}/{highestUsage.isUnlimited ? '∞' : highestUsage.limit}</span>
              <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    highestUsage.percentage >= 100
                      ? 'bg-red-500'
                      : highestUsage.percentage >= 80
                        ? 'bg-amber-500'
                        : 'bg-cyan-500'
                  }`}
                  style={{ width: `${Math.min(100, highestUsage.percentage)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: CTA + Dismiss */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/subscription')}
          className={`
            flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
            ${isExpired || isUrgent
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600'
              : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600'
            }
          `}
        >
          <Sparkles className="w-4 h-4" />
          <span className="hidden sm:inline">
            {isExpired ? 'Activer mon compte' : 'Passer au payant'}
          </span>
          <ChevronRight className="w-4 h-4" />
        </button>

        {!isExpired && (
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>
    </div>
  );
}

export default TrialBanner;
