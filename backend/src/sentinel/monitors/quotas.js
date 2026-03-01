/**
 * SENTINEL - Quotas par plan tarifaire NEXUS
 */

// Plans et limites NEXUS
export const PLANS = {
  starter: {
    name: 'Starter',
    price: 99, // EUR/mois
    limits: {
      users: 1,
      smsPerMonth: 200,
      costPerMonth: 15, // Budget IA/SMS max
      apiCallsPerDay: 500,
    },
  },
  pro: {
    name: 'Pro',
    price: 249,
    limits: {
      users: 5,
      smsPerMonth: 500,
      costPerMonth: 40,
      apiCallsPerDay: 2000,
    },
  },
  business: {
    name: 'Business',
    price: 499,
    limits: {
      users: 20,
      smsPerMonth: 2000,
      costPerMonth: 100,
      apiCallsPerDay: 10000,
    },
  },
};

export function getPlan(planId) {
  return PLANS[planId] || PLANS.starter;
}

export function checkQuota(usage, planId) {
  const plan = getPlan(planId);

  return {
    withinLimits: usage.cost < plan.limits.costPerMonth,
    plan: plan.name,
    usage: {
      cost: Math.round(usage.cost * 10000) / 10000,
      calls: usage.calls,
      limit: plan.limits.costPerMonth,
      percentage: Math.round((usage.cost / plan.limits.costPerMonth) * 100),
    },
  };
}
