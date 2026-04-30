/**
 * Plan Pricing — Source unique frontend
 *
 * Ces valeurs sont des fallbacks statiques. Le frontend DEVRAIT
 * appeler GET /api/tenants/plans/features pour les valeurs live.
 *
 * Modèle 2026 (27 avril) : Free / Starter 69€ / Pro 199€ / Business 499€ / Enterprise 899€
 * Source de verite : memory/business-model-2026.md
 */

export const PLAN_PRICES: Record<string, number> = {
  free: 0,
  starter: 69,
  pro: 199,
  business: 499,
  enterprise: 899,
};

export const PLAN_YEARLY_PRICES: Record<string, number> = {
  free: 0,
  starter: 690,
  pro: 1990,
  business: 4990,
  enterprise: 8990,
};

export const PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
};

export const PLAN_ORDER = ['free', 'starter', 'pro', 'business', 'enterprise'] as const;

export type PlanId = (typeof PLAN_ORDER)[number];

/**
 * Retourne le prix mensuel d'un plan (avec fallback)
 */
export function getPlanPrice(planId: string): number {
  const normalized = planId === 'basic' ? 'starter' : planId.toLowerCase();
  return PLAN_PRICES[normalized] ?? 0;
}

/**
 * Retourne le label d'upgrade avec prix
 */
export function getUpgradeLabel(planId: string): string {
  const normalized = planId === 'basic' ? 'starter' : planId.toLowerCase();
  const name = PLAN_NAMES[normalized] || normalized;
  const price = PLAN_PRICES[normalized] || 0;
  if (price === 0) return `Plan ${name}`;
  return `${name} — ${price}€/mois`;
}
