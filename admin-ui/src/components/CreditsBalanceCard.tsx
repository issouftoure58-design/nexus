/**
 * CreditsBalanceCard — Affichage "Utilisation IA" (modele Claude)
 *
 * REGLE ABSOLUE : le mot "credit" n'apparait JAMAIS cote client.
 * Le client voit :
 *   - Barre de progression en % ("42% utilise")
 *   - "Reinitialisation dans X jours"
 *   - "Acheter de l'utilisation supplementaire" en € (15€ / 50€ / 100€)
 *
 * En interne on compte en credits, mais tout est converti en % pour l'affichage.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Sparkles, Calendar, RefreshCw, AlertCircle, Crown, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenant } from '@/hooks/useTenant';

interface CreditsBalance {
  balance: number;
  total_purchased: number;
  total_consumed: number;
  monthly_included: number;
  monthly_used: number;
  monthly_reset_at: string | null;
  auto_recharge_enabled: boolean;
  auto_recharge_threshold: number | null;
  auto_recharge_pack: string | null;
}

interface UsageTopup {
  id: string;
  code: string;
  label: string;
  price_cents: number;
  price_eur: number;
  discount_pct: number;
  description: string;
  popular: boolean;
}

interface PacksResponse {
  packs: UsageTopup[];
  costs: Record<string, number>;
}

interface CheckoutResponse {
  url: string;
  pack: { id: string; price_cents: number };
}

interface CreditsBalanceCardProps {
  showPacks?: boolean;
  compact?: boolean;
}

const PLAN_DISPLAY: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
};

export function CreditsBalanceCard({ showPacks = true, compact = false }: CreditsBalanceCardProps) {
  const queryClient = useQueryClient();
  const { plan: currentPlan } = useTenant();

  const { data: balance, isLoading, isError } = useQuery<CreditsBalance>({
    queryKey: ['credits-balance'],
    queryFn: () => api.get<CreditsBalance>('/billing/credits/balance'),
    staleTime: 30_000,
  });

  const { data: packsData } = useQuery<PacksResponse>({
    queryKey: ['credits-packs'],
    queryFn: () => api.get<PacksResponse>('/billing/credits/packs'),
    staleTime: 5 * 60_000,
    enabled: showPacks,
  });

  const checkoutMutation = useMutation({
    mutationFn: (packId: string) =>
      api.post<CheckoutResponse>('/billing/credits/checkout', {
        packId,
        successUrl: `${window.location.origin}${window.location.pathname}?credits=success`,
        cancelUrl: window.location.href,
      }),
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });

  // Refresh sur retour du checkout Stripe
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('credits') === 'success') {
    queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (isError || !balance) {
    return (
      <div className="bg-white border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">Impossible de charger l'utilisation IA</span>
        </div>
      </div>
    );
  }

  // Calcul du % utilise (sur le quota mensuel inclus)
  const usedPercent = balance.monthly_included > 0
    ? Math.min(100, Math.round((balance.monthly_used / balance.monthly_included) * 100))
    : 0;
  const remainingPercent = 100 - usedPercent;

  const isLow = remainingPercent <= 20;
  const isCritical = remainingPercent <= 5;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  const daysUntilReset = balance.monthly_reset_at
    ? Math.max(0, Math.ceil((new Date(balance.monthly_reset_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const planLabel = PLAN_DISPLAY[currentPlan] || 'Free';

  // Mode compact pour sidebar/header
  if (compact) {
    return (
      <div
        className={cn(
          'rounded-xl p-4 text-white',
          isCritical
            ? 'bg-gradient-to-br from-red-500 to-rose-600'
            : isLow
            ? 'bg-gradient-to-br from-amber-500 to-orange-600'
            : 'bg-gradient-to-br from-purple-500 to-indigo-600'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-medium opacity-90">Utilisation IA</span>
        </div>
        <div className="text-2xl font-bold">{usedPercent}%</div>
        <div className="w-full bg-white/20 rounded-full h-1.5 mt-2">
          <div
            className="h-1.5 rounded-full bg-white transition-all"
            style={{ width: `${usedPercent}%` }}
          />
        </div>
        {daysUntilReset !== null && (
          <div className="text-xs opacity-80 mt-1">
            Reinitialisation dans {daysUntilReset}j
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header card — Utilisation IA */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl p-6 text-white bg-gradient-to-br',
          isCritical
            ? 'from-red-500 to-rose-600'
            : isLow
            ? 'from-amber-500 to-orange-600'
            : 'from-purple-500 to-indigo-600'
        )}
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-16 -translate-x-16" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-semibold">Utilisation IA</h3>
            </div>
            {balance.monthly_included > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white/20 backdrop-blur rounded-full">
                <Crown className="w-3 h-3" />
                {planLabel}
              </span>
            )}
          </div>

          {/* Barre de progression principale */}
          <div className="mb-3">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-4xl font-bold">{usedPercent}%</span>
              <span className="text-sm opacity-80">utilise ce mois</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className={cn(
                  'h-3 rounded-full transition-all',
                  isCritical ? 'bg-red-300' : isLow ? 'bg-amber-300' : 'bg-white'
                )}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs opacity-75">
              <span>{remainingPercent}% restant</span>
              {daysUntilReset !== null && (
                <span>Reinitialisation dans {daysUntilReset} jour{daysUntilReset > 1 ? 's' : ''}</span>
              )}
            </div>
          </div>

          {balance.monthly_reset_at && balance.monthly_included > 0 && (
            <div className="flex items-center gap-2 text-xs opacity-75 mt-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Prochain renouvellement : {formatDate(balance.monthly_reset_at)}</span>
            </div>
          )}

          {isLow && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-white/15 backdrop-blur rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>
                {isCritical
                  ? 'Utilisation presque atteinte — achetez de l\'utilisation supplementaire'
                  : 'Utilisation elevee — pensez a recharger'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Utilisation supplementaire — 3 montants preset en € (modele Claude) */}
      {showPacks && packsData?.packs && packsData.packs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-purple-500" />
              Utilisation supplementaire
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Continuez a utiliser l'IA au-dela de votre limite mensuelle
            </p>
          </div>

          <div className="p-6 grid grid-cols-3 gap-3">
            {packsData.packs.map((topup) => (
              <div
                key={topup.id}
                className={cn(
                  'relative rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg',
                  topup.popular ? 'border-purple-500' : 'border-gray-200'
                )}
              >
                {topup.popular && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <span className="px-2.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded-b-md uppercase">
                      Populaire
                    </span>
                  </div>
                )}

                <div className="p-4 text-center">
                  <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mt-1 mb-2">
                    {topup.label}
                  </p>

                  <div className="mb-2">
                    <span className="text-3xl font-bold text-gray-900">{topup.price_eur}€</span>
                  </div>

                  <p className="text-xs text-green-600 font-medium mb-1">
                    -{topup.discount_pct}% de reduction
                  </p>

                  <p className="text-xs text-gray-400 mb-3">
                    {topup.description}
                  </p>

                  <button
                    onClick={() => checkoutMutation.mutate(topup.id)}
                    disabled={checkoutMutation.isPending}
                    className={cn(
                      'w-full py-2 px-3 rounded-lg text-sm font-medium text-white transition-all',
                      topup.popular
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-600'
                        : 'bg-gray-700 hover:bg-gray-800',
                      'hover:shadow-md disabled:opacity-50'
                    )}
                  >
                    {checkoutMutation.isPending ? '...' : `Acheter`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CreditsBalanceCard;
