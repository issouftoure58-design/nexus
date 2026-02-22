/**
 * QuotaBar - Barre de quota des interactions IA
 * Affiche la consommation globale (Web + WhatsApp + Téléphone)
 */

import { useState, useEffect } from 'react';
import { Bot, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuotaBarProps {
  className?: string;
}

interface QuotaData {
  used: number;
  limit: number;
  plan: string;
  nextReset: string;
}

export function QuotaBar({ className = '' }: QuotaBarProps) {
  const navigate = useNavigate();
  const [quotaData, setQuotaData] = useState<QuotaData>({
    used: 0,
    limit: 1,
    plan: 'Starter',
    nextReset: '-'
  });
  useEffect(() => {
    const fetchQuotas = async () => {
      try {
        const token = localStorage.getItem('nexus_admin_token');
        const response = await fetch('/api/admin/quotas', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          // Aggregate all quotas
          const totalUsed = (data.web?.used || 0) + (data.whatsapp?.used || 0) + (data.telephone?.used || 0);
          const totalLimit = (data.web?.limit || 1000) + (data.whatsapp?.limit || 500) + (data.telephone?.limit || 100);
          setQuotaData({
            used: totalUsed,
            limit: totalLimit,
            plan: data.plan || 'Starter',
            nextReset: data.nextReset || 'Fin du mois'
          });
        }
      } catch (err) {
        console.error('Erreur fetch quotas:', err);
      }
    };
    fetchQuotas();
  }, []);

  // Handle unlimited quota (limit = -1) and avoid division by zero
  const isUnlimited = quotaData.limit <= 0;
  const percentage = isUnlimited ? 0 : Math.min((quotaData.used / quotaData.limit) * 100, 100);

  const getBarColor = () => {
    if (isUnlimited) return 'bg-cyan-500'; // Unlimited = always green/cyan
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
          {isUnlimited ? <span className="text-cyan-600 dark:text-cyan-400 font-medium">Illimité</span> : quotaData.limit.toLocaleString()}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          Renouvellement: {quotaData.nextReset}
        </span>
      </div>

      {/* Warning if near limit (not shown for unlimited) */}
      {!isUnlimited && percentage >= 75 && (
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
