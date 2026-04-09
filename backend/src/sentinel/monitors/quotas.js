/**
 * SENTINEL - Quotas par plan tarifaire NEXUS
 *
 * Modele 2026 — revision finale 9 avril 2026 (voir memory/business-model-2026.md):
 * - free     : freemium a vie, quotas mensuels stricts, IA bloquee (0 credit)
 * - basic    : 29€/mois, tout illimite non-IA, 1 000 credits IA inclus / mois (valeur 15€)
 * - business : 149€/mois, Basic + multi-sites + white-label + API + SSO + 10 000 credits IA inclus / mois (valeur 150€)
 */

// Plans et limites NEXUS (modele 2026)
export const PLANS = {
  free: {
    name: 'Free',
    price: 0, // EUR/mois
    limits: {
      users: 1,
      reservationsPerMonth: 10,
      facturesPerMonth: 20,
      clientsMax: 50,
      smsPerMonth: 0,        // pas d'IA
      costPerMonth: 0,       // pas de budget IA (IA bloquee)
      apiCallsPerDay: 200,
    },
  },
  basic: {
    name: 'Basic',
    price: 29,
    limits: {
      users: -1,             // illimite
      reservationsPerMonth: -1,
      facturesPerMonth: -1,
      clientsMax: -1,
      smsPerMonth: -1,       // via credits IA
      costPerMonth: 15,      // 1 000 credits inclus = ~15€ valeur au taux base (0,015€/credit)
      creditsIncluded: 1000, // credits IA inclus chaque mois
      apiCallsPerDay: 5000,
    },
  },
  business: {
    name: 'Business',
    price: 149,
    limits: {
      users: -1,
      reservationsPerMonth: -1,
      facturesPerMonth: -1,
      clientsMax: -1,
      smsPerMonth: -1,
      costPerMonth: 150,       // 10 000 credits inclus = 150€ valeur au taux base (0,015€/credit)
      creditsIncluded: 10000,  // credits IA inclus chaque mois
      apiCallsPerDay: 20000,
    },
  },
  // ⚠️ DEPRECATED — Aliases retro-compat (a supprimer apres migration)
  starter: {
    name: 'Free (legacy starter)',
    price: 0,
    limits: { users: 1, reservationsPerMonth: 10, facturesPerMonth: 20, clientsMax: 50, smsPerMonth: 0, costPerMonth: 0, apiCallsPerDay: 200 },
  },
  pro: {
    name: 'Basic (legacy pro)',
    price: 29,
    limits: { users: -1, reservationsPerMonth: -1, facturesPerMonth: -1, clientsMax: -1, smsPerMonth: -1, costPerMonth: 0, apiCallsPerDay: 5000 },
  },
};

export function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

export function checkQuota(usage, planId) {
  const plan = getPlan(planId);
  const limit = plan.limits.costPerMonth;

  // Plans illimites (Basic = pay-as-you-go) : pas de limite cost
  if (limit === 0 && plan.name === 'Basic') {
    return {
      withinLimits: true,
      plan: plan.name,
      usage: {
        cost: Math.round(usage.cost * 10000) / 10000,
        calls: usage.calls,
        limit: 'pay-as-you-go (credits)',
        percentage: 0,
      },
    };
  }

  // Free : aucun budget IA
  if (limit === 0) {
    return {
      withinLimits: usage.cost === 0,
      plan: plan.name,
      usage: {
        cost: Math.round(usage.cost * 10000) / 10000,
        calls: usage.calls,
        limit: 0,
        percentage: usage.cost > 0 ? 100 : 0,
      },
    };
  }

  return {
    withinLimits: usage.cost < limit,
    plan: plan.name,
    usage: {
      cost: Math.round(usage.cost * 10000) / 10000,
      calls: usage.calls,
      limit,
      percentage: Math.round((usage.cost / limit) * 100),
    },
  };
}
