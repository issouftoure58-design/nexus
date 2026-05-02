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

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Sparkles, Calendar, RefreshCw, AlertCircle, Crown, ShoppingBag, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenant } from '@/hooks/useTenant';

const OVERAGE_PRESETS = [10, 25, 50, 100];

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
  overage_enabled: boolean;
  overage_limit_eur: number;
  overage_used_eur: number;
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
  const [customLimit, setCustomLimit] = useState<string>('');

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

  const overageMutation = useMutation({
    mutationFn: (params: { enabled: boolean; limit_eur: number }) =>
      api.patch('/billing/credits/overage', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits-balance'] });
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

      {/* Overage — Utilisation supplementaire automatique */}
      {showPacks && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" />
                  Utilisation supplementaire automatique
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  L'IA continue automatiquement au-dela de votre forfait, avec un plafond que vous definissez
                </p>
              </div>
              <button
                onClick={() => overageMutation.mutate({
                  enabled: !balance.overage_enabled,
                  limit_eur: !balance.overage_enabled ? (balance.overage_limit_eur || 25) : 0,
                })}
                disabled={overageMutation.isPending}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  balance.overage_enabled ? 'bg-amber-500' : 'bg-gray-300',
                  overageMutation.isPending && 'opacity-50'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    balance.overage_enabled ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>
          </div>

          {balance.overage_enabled && (
            <div className="p-6 space-y-4">
              {/* Limite mensuelle — presets */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Plafond mensuel
                </label>
                <div className="flex gap-2">
                  {OVERAGE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => overageMutation.mutate({ enabled: true, limit_eur: preset })}
                      disabled={overageMutation.isPending}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                        balance.overage_limit_eur === preset
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-gray-200 text-gray-600 hover:border-amber-300 hover:bg-amber-50'
                      )}
                    >
                      {preset}€
                    </button>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      placeholder="Autre"
                      value={customLimit}
                      onChange={(e) => setCustomLimit(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = parseFloat(customLimit);
                          if (val > 0 && val <= 10000) {
                            overageMutation.mutate({ enabled: true, limit_eur: val });
                            setCustomLimit('');
                          }
                        }
                      }}
                      className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
                    />
                    <span className="text-sm text-gray-400">€</span>
                  </div>
                </div>
              </div>

              {/* Barre de progression overage EUR */}
              {balance.overage_used_eur > 0 && (
                <div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-700">Consommation supplementaire</span>
                    <span className="text-sm text-gray-500">
                      {balance.overage_used_eur.toFixed(2)}€ / {balance.overage_limit_eur.toFixed(2)}€
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className={cn(
                        'h-2.5 rounded-full transition-all',
                        (balance.overage_used_eur / balance.overage_limit_eur) >= 0.8
                          ? 'bg-orange-500'
                          : 'bg-amber-400'
                      )}
                      style={{ width: `${Math.min(100, (balance.overage_used_eur / balance.overage_limit_eur) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Reinitialise a chaque debut de mois
                  </p>
                </div>
              )}

              {balance.overage_used_eur === 0 && (
                <p className="text-sm text-gray-400">
                  Aucune consommation supplementaire ce mois-ci. Vous ne payez que si votre forfait est depasse.
                </p>
              )}
            </div>
          )}

          {!balance.overage_enabled && (
            <div className="px-6 py-4">
              <p className="text-sm text-gray-500">
                Quand votre forfait mensuel est epuise, l'IA s'arrete. Activez l'utilisation supplementaire pour que l'IA continue automatiquement.
              </p>
            </div>
          )}
        </div>
      )}

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
