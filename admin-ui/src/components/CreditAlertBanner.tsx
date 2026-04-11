/**
 * CreditAlertBanner — Bannière d'alerte crédits IA
 *
 * S'affiche quand les crédits < 20% du monthly_included.
 * Dismissible pour la session mais réapparaît au rechargement.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, X, Zap } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';

export function CreditAlertBanner() {
  const [dismissed, setDismissed] = useState(false);
  const navigate = useNavigate();
  const { balance } = useCredits();

  if (dismissed || !balance) return null;

  const { balance: remaining, monthly_included } = balance;

  // Pas de crédits inclus = Free plan → pas d'alerte
  if (!monthly_included || monthly_included === 0) return null;

  const percentRemaining = (remaining / monthly_included) * 100;

  // Ne s'affiche que si < 20% restants
  if (percentRemaining >= 20) return null;

  const isExhausted = remaining <= 0;

  return (
    <div className={`px-4 py-2.5 flex items-center justify-between text-sm ${
      isExhausted
        ? 'bg-red-50 border-b border-red-200 text-red-800'
        : 'bg-amber-50 border-b border-amber-200 text-amber-800'
    }`}>
      <div className="flex items-center gap-2">
        {isExhausted ? (
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
        ) : (
          <Zap className="w-4 h-4 text-amber-500 shrink-0" />
        )}
        <span>
          {isExhausted ? (
            <>
              <strong>Crédits IA épuisés</strong> — Téléphone, WhatsApp et Chat IA sont désactivés.
            </>
          ) : (
            <>
              <strong>Plus que {remaining} crédits IA</strong> ({Math.round(percentRemaining)}% restants).
              Rechargez pour éviter une interruption.
            </>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => navigate('/subscription')}
          className={`px-3 py-1 rounded-md text-xs font-medium text-white ${
            isExhausted ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
          }`}
        >
          Recharger
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-0.5 rounded hover:bg-black/5"
          aria-label="Fermer l'alerte"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
