/**
 * QuotaBar - Barre de quota des interactions IA
 * Affiche la consommation globale (Web + WhatsApp + Téléphone)
 */

import { Bot, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuotaBarProps {
  className?: string;
}

// Mock data - sera remplacé par les vraies données API
const quotaData = {
  used: 1247,
  limit: 2000,
  plan: 'Starter',
  nextReset: '1er mars 2026'
};

export function QuotaBar({ className = '' }: QuotaBarProps) {
  const navigate = useNavigate();
  const percentage = Math.min((quotaData.used / quotaData.limit) * 100, 100);

  const getBarColor = () => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-amber-500';
    return 'bg-cyan-500';
  };

  return (
    <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          <span className="font-medium text-gray-900 dark:text-white">Interactions IA ce mois</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">(Web + WhatsApp + Téléphone)</span>
        </div>
        <button
          onClick={() => navigate('/subscription')}
          className="text-sm text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 flex items-center gap-1"
        >
          Gérer
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
        <div
          className={`absolute top-0 left-0 h-full ${getBarColor()} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          <span className="font-semibold text-gray-900 dark:text-white">{quotaData.used.toLocaleString()}</span>
          {' / '}
          {quotaData.limit.toLocaleString()}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          Renouvellement: {quotaData.nextReset}
        </span>
      </div>

      {/* Warning if near limit */}
      {percentage >= 75 && (
        <div className={`mt-3 px-3 py-2 rounded-md text-sm ${
          percentage >= 90
            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
        }`}>
          {percentage >= 90 ? (
            <>⚠️ Quota presque épuisé. <button onClick={() => navigate('/subscription')} className="underline font-medium">Upgrader maintenant</button></>
          ) : (
            <>💡 75% du quota utilisé. Pensez à votre upgrade si nécessaire.</>
          )}
        </div>
      )}
    </div>
  );
}
