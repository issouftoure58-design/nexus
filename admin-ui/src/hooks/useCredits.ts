/**
 * useCredits — Hook React pour accéder au solde et aux opérations de crédits IA
 *
 * Modèle 2026 (révision finale 9 avril 2026) :
 *   • 1,5€ = 100 crédits (0,015€/crédit — taux base)
 *   • Free     : 0 crédit inclus (IA bloquée)
 *   • Basic    : 1 000 crédits inclus / mois (valeur 15€)
 *   • Business : 10 000 crédits inclus / mois (valeur 150€)
 *
 * Pack unique additionnel : Pack 1000 → 15€ pour 1 000 crédits (0% bonus)
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
}

export interface CreditTransaction {
  id: number;
  type: 'purchase' | 'consume' | 'monthly_grant' | 'monthly_reset' | 'refund' | 'adjust' | 'bonus';
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
export const CREDIT_COSTS = {
  chat_admin_question: 4,
  whatsapp_message: 4,
  devis_ia: 6,
  antichurn_whatsapp: 6,
  email_ia_sent: 6,
  web_chat_conversation: 9,
  social_post_generated: 9,
  phone_minute: 15,
  antichurn_sms_fr: 16,
  seo_article: 66,
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

  const balance = balanceQuery.data;

  /** Vérifie si le solde permet de réaliser N actions du type donné */
  const canAfford = (action: CreditAction, quantity = 1): boolean => {
    if (!balance) return false;
    const cost = CREDIT_COSTS[action] * quantity;
    return balance.balance >= cost;
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
