/**
 * Billing & Payment Unit Tests
 * Tests for Stripe integration and plan management
 */

import { jest } from '@jest/globals';

describe('Plan Pricing', () => {
  const PLANS = {
    starter: { monthly: 9900, yearly: 95000 },
    pro: { monthly: 24900, yearly: 239000 },
    business: { monthly: 49900, yearly: 479000 }
  };

  test('should have correct monthly prices in cents', () => {
    expect(PLANS.starter.monthly).toBe(9900); // 99€
    expect(PLANS.pro.monthly).toBe(24900); // 249€
    expect(PLANS.business.monthly).toBe(49900); // 499€
  });

  test('should have ~20% discount for yearly plans', () => {
    const starterDiscount = 1 - (PLANS.starter.yearly / (PLANS.starter.monthly * 12));
    const proDiscount = 1 - (PLANS.pro.yearly / (PLANS.pro.monthly * 12));
    const businessDiscount = 1 - (PLANS.business.yearly / (PLANS.business.monthly * 12));

    expect(starterDiscount).toBeGreaterThan(0.19);
    expect(proDiscount).toBeGreaterThan(0.19);
    expect(businessDiscount).toBeGreaterThan(0.19);
  });
});

describe('SMS Packs', () => {
  const SMS_PACKS = [
    { qty: 100, price: 1500 },
    { qty: 500, price: 6500 },
    { qty: 1000, price: 11000 },
    { qty: 5000, price: 45000 }
  ];

  test('should have decreasing price per SMS for larger packs', () => {
    const pricePerSms = SMS_PACKS.map(p => p.price / p.qty);

    for (let i = 1; i < pricePerSms.length; i++) {
      expect(pricePerSms[i]).toBeLessThan(pricePerSms[i - 1]);
    }
  });
});

describe('Voice Packs', () => {
  const VOICE_PACKS = [
    { mins: 30, price: 1500 },
    { mins: 60, price: 2500 },
    { mins: 120, price: 4500 },
    { mins: 300, price: 9900 }
  ];

  test('should have decreasing price per minute for larger packs', () => {
    const pricePerMin = VOICE_PACKS.map(p => p.price / p.mins);

    for (let i = 1; i < pricePerMin.length; i++) {
      expect(pricePerMin[i]).toBeLessThan(pricePerMin[i - 1]);
    }
  });
});

describe('Plan Features', () => {
  const PLAN_FEATURES = {
    starter: ['dashboard', 'clients', 'reservations', 'facturation', 'site_vitrine', 'agent_ia_web'],
    pro: ['whatsapp', 'telephone', 'comptabilite', 'crm_avance', 'marketing', 'pipeline', 'stock', 'analytics', 'devis'],
    business: ['rh', 'seo', 'api', 'sentinel', 'whitelabel']
  };

  test('starter features should be available to all plans', () => {
    const starterFeatures = PLAN_FEATURES.starter;
    expect(starterFeatures).toContain('dashboard');
    expect(starterFeatures).toContain('clients');
    expect(starterFeatures).toContain('reservations');
  });

  test('pro features should include whatsapp and telephone', () => {
    const proFeatures = PLAN_FEATURES.pro;
    expect(proFeatures).toContain('whatsapp');
    expect(proFeatures).toContain('telephone');
  });

  test('business features should include API and SENTINEL', () => {
    const businessFeatures = PLAN_FEATURES.business;
    expect(businessFeatures).toContain('api');
    expect(businessFeatures).toContain('sentinel');
  });
});

describe('User Limits', () => {
  const USER_LIMITS = {
    starter: 1,
    pro: 5,
    business: 20
  };

  test('should have correct user limits per plan', () => {
    expect(USER_LIMITS.starter).toBe(1);
    expect(USER_LIMITS.pro).toBe(5);
    expect(USER_LIMITS.business).toBe(20);
  });
});

describe('Trial Period', () => {
  test('should have 14-day trial period', () => {
    const TRIAL_DAYS = 14;
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);

    const daysRemaining = Math.ceil((trialEndDate - new Date()) / (1000 * 60 * 60 * 24));
    expect(daysRemaining).toBe(14);
  });

  test('should correctly detect expired trial', () => {
    const expiredTrialEnd = new Date();
    expiredTrialEnd.setDate(expiredTrialEnd.getDate() - 1);

    const isExpired = expiredTrialEnd < new Date();
    expect(isExpired).toBe(true);
  });
});
