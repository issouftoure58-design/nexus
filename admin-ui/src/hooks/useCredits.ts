/**
 * useCredits — Hook React pour acceder au solde et aux operations de credits IA
 *
 * Modele 2026 (revision 21 avril 2026) :
 *   • 1,5€ = 100 credits (0,015€/credit — taux base)
 *   • Free     : 200 credits (limite)
 *   • Starter  : 1 000 credits inclus / mois
 *   • Pro      : 5 000 credits inclus / mois
 *   • Business : 20 000 credits inclus / mois
 *
 * Pack unique additionnel : Pack 1000 → 15€ pour 1 000 credits (0% bonus)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CreditsBalance {
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

export const OVERAGE_RATE_EUR = 0.015;
export const OVERAGE_PRESETS = [10, 25, 50, 100];

export interface CreditTransaction {
  id: number;
  type: 'purchase' | 'consume' | 'monthly_grant' | 'monthly_reset' | 'refund' | 'adjust' | 'bonus' | 'overage';
  amount: number;
  balance_after: number;
  source: string | null;
  ref_id: string | null;
  description: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Coûts par action IA — doit rester synchronisé avec backend creditsService.CREDIT_COSTS
 */
/**
 * Synced with backend/src/config/pricing.js CREDIT_COSTS (11 avril 2026)
 */
export const CREDIT_COSTS = {
  chat_admin_haiku: 7,
  whatsapp_message: 7,
  whatsapp_voice_note: 10,
  devis_ia: 9,
  anti_churn_whatsapp: 9,
  email_ia_sent: 9,
  agent_web_conversation: 12,
  social_post_generated: 12,
  phone_minute: 18,
  anti_churn_sms_fr: 19,
  seo_article_full: 69,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

/**
 * Hook principal — récupère le solde courant + helpers
 */
export function useCredits() {
  const queryClient = useQueryClient();

  const balanceQuery = useQuery<CreditsBalance>({
    queryKey: ['credits-balance'],
    queryFn: () => api.get<CreditsBalance>('/billing/credits/balance'),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const checkoutMutation = useMutation({
    mutationFn: (packId: 'pack_1000') =>
      api.post<{ url: string }>('/billing/credits/checkout', {
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

  const balance = balanceQuery.data;

  /** Vérifie si le solde permet de réaliser N actions du type donné (avec fallback overage) */
  const canAfford = (action: CreditAction, quantity = 1): boolean => {
    if (!balance) return false;
    const cost = CREDIT_COSTS[action] * quantity;
    if (balance.balance >= cost) return true;
    // Fallback overage
    if (balance.overage_enabled) {
      const creditsOverage = cost - balance.balance;
      const overageEurCost = creditsOverage * OVERAGE_RATE_EUR;
      return (balance.overage_used_eur + overageEurCost) <= balance.overage_limit_eur;
    }
    return false;
  };

  /** Coût en crédits pour une action donnée */
  const costOf = (action: CreditAction, quantity = 1): number => {
    return CREDIT_COSTS[action] * quantity;
  };

  /** Solde insuffisant si < 20 crédits */
  const isCritical = balance ? balance.balance < 20 : false;
  /** Solde faible si < 100 crédits */
  const isLow = balance ? balance.balance < 100 : false;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['credits-balance'] });

  return {
    balance,
    isLoading: balanceQuery.isLoading,
    isError: balanceQuery.isError,
    canAfford,
    costOf,
    isCritical,
    isLow,
    refresh,
    purchasePack: checkoutMutation.mutate,
    isPurchasing: checkoutMutation.isPending,
    // Overage
    overageEnabled: balance?.overage_enabled ?? false,
    overageLimitEur: balance?.overage_limit_eur ?? 0,
    overageUsedEur: balance?.overage_used_eur ?? 0,
    updateOverage: overageMutation.mutate,
    isUpdatingOverage: overageMutation.isPending,
  };
}

/**
 * Hook pour récupérer l'historique des transactions de crédits
 */
export function useCreditsTransactions(limit = 50, type?: string) {
  return useQuery<{ transactions: CreditTransaction[]; count: number }>({
    queryKey: ['credits-transactions', limit, type],
    queryFn: () => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (type) params.set('type', type);
      return api.get(`/billing/credits/transactions?${params.toString()}`);
    },
  });
}
