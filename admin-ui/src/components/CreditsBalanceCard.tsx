/**
 * CreditsBalanceCard — Affichage du solde de crédits IA + achat de pack additionnel
 *
 * Modèle 2026 (révision finale 9 avril 2026) :
 *   • 1,5€ = 100 crédits (0,015€/crédit — taux base)
 *   • Free     : 0 crédit inclus (IA bloquée)
 *   • Basic    : 500 crédits inclus / mois (valeur 7,50€)
 *   • Business : 10 000 crédits inclus / mois (valeur 150€)
 *
 * Pack unique additionnel : Pack 1000 → 15€ pour 1 000 crédits (0% bonus, taux base)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Sparkles, Zap, TrendingUp, Calendar, RefreshCw, AlertCircle, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface CreditPack {
  id: 'pack_1000';
  code: string;
  credits: number;
  price_cents: number;
  price_eur: number;
  bonus_pct: number;
  cost_per_credit_cents: number;
}

interface PacksResponse {
  packs: CreditPack[];
  costs: Record<string, number>;
}

interface CheckoutResponse {
  url: string;
  pack: { id: string; credits: number; price_cents: number };
}

interface CreditsBalanceCardProps {
  /** Si true, affiche aussi le pack additionnel sous le solde. Par défaut: true */
  showPacks?: boolean;
  /** Si true, version compacte pour sidebar. Par défaut: false */
  compact?: boolean;
}

export function CreditsBalanceCard({ showPacks = true, compact = false }: CreditsBalanceCardProps) {
  const queryClient = useQueryClient();

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
    // Nettoyer l'URL
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
          <span className="text-sm">Impossible de charger le solde de crédits</span>
        </div>
      </div>
    );
  }

  const isLowBalance = balance.balance < 100;
  const isCriticalBalance = balance.balance < 20;

  const formatNumber = (n: number) => n.toLocaleString('fr-FR');
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

  // Mode compact pour sidebar/header
  if (compact) {
    return (
      <div
        className={cn(
          'rounded-xl p-4 text-white',
          isCriticalBalance
            ? 'bg-gradient-to-br from-red-500 to-rose-600'
            : isLowBalance
            ? 'bg-gradient-to-br from-amber-500 to-orange-600'
            : 'bg-gradient-to-br from-purple-500 to-indigo-600'
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-medium opacity-90">Crédits IA</span>
        </div>
        <div className="text-2xl font-bold">{formatNumber(balance.balance)}</div>
        {balance.monthly_included > 0 && (
          <div className="text-xs opacity-80 mt-1">
            +{formatNumber(balance.monthly_included)} / mois inclus
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header card — Solde principal */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl p-6 text-white bg-gradient-to-br',
          isCriticalBalance
            ? 'from-red-500 to-rose-600'
            : isLowBalance
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
              <h3 className="font-semibold">Crédits IA</h3>
            </div>
            {balance.monthly_included > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white/20 backdrop-blur rounded-full">
                <Crown className="w-3 h-3" />
                {balance.monthly_included >= 10000 ? 'Business' : 'Basic'}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-5xl font-bold">{formatNumber(balance.balance)}</span>
            <span className="text-lg opacity-80">crédits</span>
          </div>

          {balance.monthly_included > 0 && (
            <div className="flex items-center gap-2 text-sm opacity-90 mb-1">
              <Calendar className="w-4 h-4" />
              <span>
                {formatNumber(balance.monthly_included)} crédits inclus / mois
                {balance.monthly_used > 0 && (
                  <> · {formatNumber(balance.monthly_used)} utilisés</>
                )}
              </span>
            </div>
          )}

          {balance.monthly_reset_at && balance.monthly_included > 0 && (
            <div className="text-xs opacity-75 mt-1">
              Prochain renouvellement : {formatDate(balance.monthly_reset_at)}
            </div>
          )}

          {isLowBalance && (
            <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-white/15 backdrop-blur rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>
                {isCriticalBalance
                  ? 'Solde critique — rechargez pour éviter l\'interruption des services IA'
                  : 'Solde faible — pensez à recharger'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats secondaires */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <Zap className="w-3.5 h-3.5" />
            <span>Consommé total</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {formatNumber(balance.total_consumed)}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Acheté total</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {formatNumber(balance.total_purchased)}
          </div>
        </div>
      </div>

      {/* Pack unique additionnel à l'achat */}
      {showPacks && packsData?.packs && packsData.packs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              Recharger en crédits IA
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Pack unique additionnel — taux base, sans bonus, sans engagement
            </p>
          </div>

          <div className="p-6 flex justify-center">
            {packsData.packs.map((pack) => (
              <div
                key={pack.id}
                className="relative rounded-xl border-2 border-purple-400 overflow-hidden transition-all hover:shadow-lg max-w-xs w-full"
              >
                <div className="absolute -top-px left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 bg-purple-500 text-white text-xs font-bold rounded-b-md">
                    PACK UNIQUE
                  </span>
                </div>

                <div className="h-2 bg-gradient-to-r from-purple-400 to-indigo-500" />

                <div className="p-6 text-center">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Pack 1000
                  </p>

                  <div className="my-3">
                    <span className="text-4xl font-bold text-gray-900">
                      {formatNumber(pack.credits)}
                    </span>
                    <span className="text-sm text-gray-500 ml-1">crédits</span>
                  </div>

                  <div className="my-4 py-3 border-y border-gray-100">
                    <span className="text-3xl font-bold text-gray-900">{pack.price_eur}€</span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {(pack.cost_per_credit_cents / 100).toFixed(3)}€ / crédit · taux base
                    </p>
                  </div>

                  <button
                    onClick={() => checkoutMutation.mutate(pack.id)}
                    disabled={checkoutMutation.isPending}
                    className={cn(
                      'w-full py-2.5 px-4 rounded-lg font-medium text-white transition-all',
                      'bg-gradient-to-r from-purple-500 to-indigo-600',
                      'hover:shadow-md disabled:opacity-50'
                    )}
                  >
                    {checkoutMutation.isPending ? 'Redirection...' : 'Acheter 1 000 crédits'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {packsData.costs && (
            <div className="px-6 pb-6">
              <details className="bg-gray-50 rounded-lg">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 hover:text-gray-900">
                  Combien coûte chaque action IA ?
                </summary>
                <div className="px-4 pb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-600">
                  <div className="flex justify-between"><span>Question chat IA admin</span><span className="font-semibold">1 cr</span></div>
                  <div className="flex justify-between"><span>Message WhatsApp IA</span><span className="font-semibold">1 cr</span></div>
                  <div className="flex justify-between"><span>Devis IA</span><span className="font-semibold">2 cr</span></div>
                  <div className="flex justify-between"><span>Email IA</span><span className="font-semibold">3 cr</span></div>
                  <div className="flex justify-between"><span>Conversation chat web</span><span className="font-semibold">5 cr</span></div>
                  <div className="flex justify-between"><span>Post réseaux généré</span><span className="font-semibold">5 cr</span></div>
                  <div className="flex justify-between"><span>Minute téléphone IA</span><span className="font-semibold">8 cr</span></div>
                  <div className="flex justify-between"><span>Article SEO complet</span><span className="font-semibold">50 cr</span></div>
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CreditsBalanceCard;
