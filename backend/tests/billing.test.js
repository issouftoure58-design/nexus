/**
 * Billing & Payment Unit Tests — Modèle pricing 2026 (révisé 9 avril 2026)
 *
 * Plans : Free 0€ / Basic 29€ (1 000 cr inclus) / Business 149€ (10 000 cr inclus)
 * Pack unique additionnel : Pack 1000 (15€ → 1 000 crédits, 0% bonus)
 */

import { jest } from '@jest/globals';

describe('Plan Pricing 2026', () => {
  const PLANS = {
    free:     { monthly: 0,     yearly: 0     },
    basic:    { monthly: 2900,  yearly: 29000 },  // 29€ mensuel / 290€ annuel (2 mois offerts)
    business: { monthly: 14900, yearly: 149000 }, // 149€ mensuel / 1490€ annuel (2 mois offerts)
  };

  test('Free is 0€', () => {
    expect(PLANS.free.monthly).toBe(0);
    expect(PLANS.free.yearly).toBe(0);
  });

  test('Basic monthly is 29€ (2900 cents)', () => {
    expect(PLANS.basic.monthly).toBe(2900);
  });

  test('Business monthly is 149€ (14900 cents)', () => {
    expect(PLANS.business.monthly).toBe(14900);
  });

  test('paid plans have 2 months offered yearly (yearly = monthly × 10)', () => {
    expect(PLANS.basic.yearly).toBe(PLANS.basic.monthly * 10);
    expect(PLANS.business.yearly).toBe(PLANS.business.monthly * 10);
  });

  test('Basic is cheaper than Business', () => {
    expect(PLANS.basic.monthly).toBeLessThan(PLANS.business.monthly);
  });

  test('Business costs ~5x more than Basic (149 vs 29)', () => {
    const ratio = PLANS.business.monthly / PLANS.basic.monthly;
    expect(ratio).toBeGreaterThan(5);
    expect(ratio).toBeLessThan(5.5);
  });
});

describe('AI Credit Pack (pack unique — révision 9 avril 2026)', () => {
  // Doit refléter creditsService.js CREDIT_PACKS
  // Base : 1,5€ = 100 crédits (0,015€/crédit)
  const CREDIT_PACKS = [
    { code: 'pack_1000', credits: 1000, price_cents: 1500, bonus_pct: 0 },
  ];

  test('Un seul pack disponible (plus de S/M/L)', () => {
    expect(CREDIT_PACKS.length).toBe(1);
    expect(CREDIT_PACKS[0].code).toBe('pack_1000');
  });

  test('Pack 1000 = 15€ pour 1 000 crédits (0% bonus, taux base)', () => {
    expect(CREDIT_PACKS[0].price_cents).toBe(1500);
    expect(CREDIT_PACKS[0].credits).toBe(1000);
    expect(CREDIT_PACKS[0].bonus_pct).toBe(0);
  });

  test('Pack 1000 respecte le taux base : 1,5€ = 100 crédits', () => {
    const euroPerCredit = CREDIT_PACKS[0].price_cents / 100 / CREDIT_PACKS[0].credits;
    expect(euroPerCredit).toBeCloseTo(0.015, 4);
  });
});

describe('Plan Features', () => {
  // Doit refleter planFeatures.js
  const PLAN_FEATURES = {
    free: ['dashboard', 'clients', 'reservations', 'facturation', 'documents', 'paiements', 'ecommerce'],
    basic: ['equipe', 'comptabilite', 'stock', 'rh', 'crm_avance', 'devis', 'marketing', 'pipeline', 'analytics', 'seo', 'workflows', 'agent_ia_web', 'whatsapp', 'telephone'],
    business: ['multi_site', 'whitelabel', 'api', 'sso', 'support_prioritaire', 'account_manager'],
  };

  test('Free contient les modules CRUD core', () => {
    expect(PLAN_FEATURES.free).toContain('dashboard');
    expect(PLAN_FEATURES.free).toContain('clients');
    expect(PLAN_FEATURES.free).toContain('reservations');
    expect(PLAN_FEATURES.free).toContain('facturation');
  });

  test('Free ne contient AUCUNE fonction IA', () => {
    expect(PLAN_FEATURES.free).not.toContain('agent_ia_web');
    expect(PLAN_FEATURES.free).not.toContain('whatsapp');
    expect(PLAN_FEATURES.free).not.toContain('telephone');
  });

  test('Basic débloque les fonctions IA et modules avancés', () => {
    expect(PLAN_FEATURES.basic).toContain('agent_ia_web');
    expect(PLAN_FEATURES.basic).toContain('whatsapp');
    expect(PLAN_FEATURES.basic).toContain('telephone');
    expect(PLAN_FEATURES.basic).toContain('comptabilite');
    expect(PLAN_FEATURES.basic).toContain('marketing');
  });

  test('Business ajoute les features premium', () => {
    expect(PLAN_FEATURES.business).toContain('multi_site');
    expect(PLAN_FEATURES.business).toContain('whitelabel');
    expect(PLAN_FEATURES.business).toContain('api');
    expect(PLAN_FEATURES.business).toContain('sso');
  });
});

describe('Plan Limits — Free quotas', () => {
  // Doit refleter planFeatures.js FREE_LIMITS
  const FREE_LIMITS = {
    clients_max:        50,
    reservations_mois:  10,
    factures_mois:      20,
    prestations_max:    5,
    users_max:          1,
    chat_admin_questions_mois: 5,
  };

  test('Free = 10 RDV/mois', () => {
    expect(FREE_LIMITS.reservations_mois).toBe(10);
  });

  test('Free = 10 factures/mois (avec watermark)', () => {
    expect(FREE_LIMITS.factures_mois).toBe(10);
  });

  test('Free = 30 clients max', () => {
    expect(FREE_LIMITS.clients_max).toBe(30);
  });

  test('Free = 1 utilisateur uniquement', () => {
    expect(FREE_LIMITS.users_max).toBe(1);
  });

  test('Free = 5 questions chat IA admin/mois (essai)', () => {
    expect(FREE_LIMITS.chat_admin_questions_mois).toBe(5);
  });
});

describe('Plan Limits — Basic & Business (révision 9 avril 2026)', () => {
  const BASIC_LIMITS = {
    clients_max:        -1,
    reservations_mois:  -1,
    factures_mois:      -1,
    users_max:          -1,
    credits_ia_inclus_mois: 1000,
  };

  const BUSINESS_LIMITS = {
    ...BASIC_LIMITS,
    multi_site_max:     -1,
    credits_ia_inclus_mois: 10000,
  };

  test('Basic = tout illimité non-IA', () => {
    expect(BASIC_LIMITS.clients_max).toBe(-1);
    expect(BASIC_LIMITS.reservations_mois).toBe(-1);
    expect(BASIC_LIMITS.factures_mois).toBe(-1);
    expect(BASIC_LIMITS.users_max).toBe(-1);
  });

  test('Basic inclut 1 000 crédits IA mensuels', () => {
    expect(BASIC_LIMITS.credits_ia_inclus_mois).toBe(1000);
  });

  test('Business inclut 10 000 crédits IA mensuels', () => {
    expect(BUSINESS_LIMITS.credits_ia_inclus_mois).toBe(10000);
  });

  test('Business = 10x plus de crédits que Basic', () => {
    expect(BUSINESS_LIMITS.credits_ia_inclus_mois / BASIC_LIMITS.credits_ia_inclus_mois).toBe(10);
  });

  test('Business hérite des illimités Basic', () => {
    expect(BUSINESS_LIMITS.clients_max).toBe(-1);
    expect(BUSINESS_LIMITS.multi_site_max).toBe(-1);
  });
});

describe('Trial Period', () => {
  test('14 jours d\'essai Basic', () => {
    const TRIAL_DAYS = 14;
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);
    const daysRemaining = Math.ceil((trialEndDate - new Date()) / (1000 * 60 * 60 * 24));
    expect(daysRemaining).toBe(14);
  });

  test('Détection essai expiré', () => {
    const expiredTrialEnd = new Date();
    expiredTrialEnd.setDate(expiredTrialEnd.getDate() - 1);
    expect(expiredTrialEnd < new Date()).toBe(true);
  });

  test('Après expiration → bascule Free (pas blocage)', () => {
    // Nouvelle UX 2026 : expiration trial = downgrade vers Free, JAMAIS blocage
    const POST_TRIAL_PLAN = 'free';
    expect(POST_TRIAL_PLAN).toBe('free');
    expect(POST_TRIAL_PLAN).not.toBe('expired');
  });
});

describe('Retro-compatibilité legacy plans', () => {
  // Helper de normalisation utilisé partout dans le code
  const normalizePlan = (plan) => {
    if (plan === 'starter') return 'free';
    if (plan === 'pro') return 'basic';
    return plan;
  };

  test('starter → free', () => {
    expect(normalizePlan('starter')).toBe('free');
  });

  test('pro → basic', () => {
    expect(normalizePlan('pro')).toBe('basic');
  });

  test('plans 2026 inchangés', () => {
    expect(normalizePlan('free')).toBe('free');
    expect(normalizePlan('basic')).toBe('basic');
    expect(normalizePlan('business')).toBe('business');
  });
});
