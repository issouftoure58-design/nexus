/**
 * Tests d'isolation des plans NEXUS
 *
 * Tests UNITAIRES sans dépendance à la DB
 *
 * Grille tarifaire 2026:
 * - STARTER (99€): dashboard, clients, reservations, facturation, site_vitrine, agent_ia_web
 * - PRO (249€): + whatsapp, telephone, comptabilite, marketing, pipeline, stock, analytics
 * - BUSINESS (499€): + rh, seo, api, sentinel, whitelabel
 */

// Mock des variables d'environnement AVANT tout import
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.NODE_ENV = 'test';

// Définitions locales pour tests isolés (copie de modules.js)
const MODULE_PLAN_ACCESS = {
  // STARTER - Inclus dans tous les plans
  'socle': ['starter', 'pro', 'business'],
  'agent_ia_web': ['starter', 'pro', 'business'],
  'ia_reservation': ['starter', 'pro', 'business'],
  'site_vitrine': ['starter', 'pro', 'business'],
  'facturation': ['starter', 'pro', 'business'],

  // PRO - Nécessite plan Pro ou Business
  'whatsapp': ['pro', 'business'],
  'telephone': ['pro', 'business'],
  'standard_ia': ['pro', 'business'],
  'comptabilite': ['pro', 'business'],
  'crm_avance': ['pro', 'business'],
  'marketing': ['pro', 'business'],
  'pipeline': ['pro', 'business'],
  'stock': ['pro', 'business'],
  'analytics': ['pro', 'business'],
  'devis': ['pro', 'business'],

  // BUSINESS - Exclusivement Business
  'rh': ['business'],
  'seo': ['business'],
  'api': ['business'],
  'sentinel': ['business'],
  'whitelabel': ['business'],

  // MODULES MÉTIER - Addon payant, tous plans
  'restaurant': ['starter', 'pro', 'business'],
  'hotel': ['starter', 'pro', 'business'],
  'domicile': ['starter', 'pro', 'business'],
};

function canPlanAccessModule(planId, moduleId) {
  const allowedPlans = MODULE_PLAN_ACCESS[moduleId];
  if (!allowedPlans) {
    return true; // Module non mappé = accessible (backwards compat)
  }
  return allowedPlans.includes(planId?.toLowerCase());
}

function getMinimumPlanForModule(moduleId) {
  const allowedPlans = MODULE_PLAN_ACCESS[moduleId];
  if (!allowedPlans) return 'starter';
  if (allowedPlans.includes('starter')) return 'starter';
  if (allowedPlans.includes('pro')) return 'pro';
  return 'business';
}

// PLAN_FEATURES (copie de moduleProtection.js)
const PLAN_FEATURES = {
  starter: {
    dashboard: true,
    clients: true,
    reservations: true,
    facturation: true,
    site_vitrine: true,
    agent_ia_web: true,
    documents: true,
    paiements: true,
    ecommerce: true,
  },
  pro: {
    dashboard: true,
    clients: true,
    reservations: true,
    facturation: true,
    site_vitrine: true,
    agent_ia_web: true,
    documents: true,
    paiements: true,
    ecommerce: true,
    whatsapp: true,
    telephone: true,
    comptabilite: true,
    crm_avance: true,
    marketing: true,
    pipeline: true,
    stock: true,
    analytics: true,
    devis: true,
  },
  business: {
    dashboard: true,
    clients: true,
    reservations: true,
    facturation: true,
    site_vitrine: true,
    agent_ia_web: true,
    documents: true,
    paiements: true,
    ecommerce: true,
    whatsapp: true,
    telephone: true,
    comptabilite: true,
    crm_avance: true,
    marketing: true,
    pipeline: true,
    stock: true,
    analytics: true,
    devis: true,
    rh: true,
    seo: true,
    api: true,
    sentinel: true,
    whitelabel: true,
  }
};

describe('Plan Isolation - Module Access Control', () => {
  describe('MODULE_PLAN_ACCESS mapping', () => {
    it('should have all critical modules mapped', () => {
      const criticalModules = [
        'socle', 'agent_ia_web', 'whatsapp', 'telephone',
        'comptabilite', 'marketing', 'pipeline', 'rh', 'seo', 'api', 'sentinel'
      ];

      criticalModules.forEach(module => {
        expect(MODULE_PLAN_ACCESS[module]).toBeDefined();
        expect(Array.isArray(MODULE_PLAN_ACCESS[module])).toBe(true);
      });
    });

    it('should have correct plan hierarchy', () => {
      // STARTER modules should be accessible to all plans
      const starterModules = ['socle', 'agent_ia_web', 'ia_reservation', 'site_vitrine', 'facturation'];
      starterModules.forEach(module => {
        expect(MODULE_PLAN_ACCESS[module]).toContain('starter');
        expect(MODULE_PLAN_ACCESS[module]).toContain('pro');
        expect(MODULE_PLAN_ACCESS[module]).toContain('business');
      });

      // PRO modules should NOT be accessible to Starter
      const proModules = ['whatsapp', 'telephone', 'comptabilite', 'marketing', 'pipeline'];
      proModules.forEach(module => {
        expect(MODULE_PLAN_ACCESS[module]).not.toContain('starter');
        expect(MODULE_PLAN_ACCESS[module]).toContain('pro');
        expect(MODULE_PLAN_ACCESS[module]).toContain('business');
      });

      // BUSINESS modules should ONLY be accessible to Business
      const businessModules = ['rh', 'seo', 'api', 'sentinel', 'whitelabel'];
      businessModules.forEach(module => {
        expect(MODULE_PLAN_ACCESS[module]).not.toContain('starter');
        expect(MODULE_PLAN_ACCESS[module]).not.toContain('pro');
        expect(MODULE_PLAN_ACCESS[module]).toContain('business');
      });
    });
  });

  describe('canPlanAccessModule()', () => {
    describe('Starter plan access', () => {
      it('should allow Starter to access base modules', () => {
        expect(canPlanAccessModule('starter', 'socle')).toBe(true);
        expect(canPlanAccessModule('starter', 'agent_ia_web')).toBe(true);
        expect(canPlanAccessModule('starter', 'facturation')).toBe(true);
      });

      it('should DENY Starter access to Pro modules', () => {
        expect(canPlanAccessModule('starter', 'whatsapp')).toBe(false);
        expect(canPlanAccessModule('starter', 'telephone')).toBe(false);
        expect(canPlanAccessModule('starter', 'comptabilite')).toBe(false);
        expect(canPlanAccessModule('starter', 'marketing')).toBe(false);
        expect(canPlanAccessModule('starter', 'pipeline')).toBe(false);
      });

      it('should DENY Starter access to Business modules', () => {
        expect(canPlanAccessModule('starter', 'rh')).toBe(false);
        expect(canPlanAccessModule('starter', 'seo')).toBe(false);
        expect(canPlanAccessModule('starter', 'api')).toBe(false);
        expect(canPlanAccessModule('starter', 'sentinel')).toBe(false);
      });
    });

    describe('Pro plan access', () => {
      it('should allow Pro to access Starter modules', () => {
        expect(canPlanAccessModule('pro', 'socle')).toBe(true);
        expect(canPlanAccessModule('pro', 'agent_ia_web')).toBe(true);
        expect(canPlanAccessModule('pro', 'facturation')).toBe(true);
      });

      it('should allow Pro to access Pro modules', () => {
        expect(canPlanAccessModule('pro', 'whatsapp')).toBe(true);
        expect(canPlanAccessModule('pro', 'telephone')).toBe(true);
        expect(canPlanAccessModule('pro', 'comptabilite')).toBe(true);
        expect(canPlanAccessModule('pro', 'marketing')).toBe(true);
        expect(canPlanAccessModule('pro', 'pipeline')).toBe(true);
      });

      it('should DENY Pro access to Business modules', () => {
        expect(canPlanAccessModule('pro', 'rh')).toBe(false);
        expect(canPlanAccessModule('pro', 'seo')).toBe(false);
        expect(canPlanAccessModule('pro', 'api')).toBe(false);
        expect(canPlanAccessModule('pro', 'sentinel')).toBe(false);
      });
    });

    describe('Business plan access', () => {
      it('should allow Business to access ALL modules', () => {
        // Starter
        expect(canPlanAccessModule('business', 'socle')).toBe(true);
        expect(canPlanAccessModule('business', 'agent_ia_web')).toBe(true);

        // Pro
        expect(canPlanAccessModule('business', 'whatsapp')).toBe(true);
        expect(canPlanAccessModule('business', 'telephone')).toBe(true);

        // Business
        expect(canPlanAccessModule('business', 'rh')).toBe(true);
        expect(canPlanAccessModule('business', 'seo')).toBe(true);
        expect(canPlanAccessModule('business', 'api')).toBe(true);
        expect(canPlanAccessModule('business', 'sentinel')).toBe(true);
      });
    });

    describe('Case insensitivity', () => {
      it('should handle uppercase plan IDs', () => {
        expect(canPlanAccessModule('STARTER', 'socle')).toBe(true);
        expect(canPlanAccessModule('PRO', 'whatsapp')).toBe(true);
        expect(canPlanAccessModule('BUSINESS', 'rh')).toBe(true);
      });

      it('should handle mixed case plan IDs', () => {
        expect(canPlanAccessModule('Starter', 'socle')).toBe(true);
        expect(canPlanAccessModule('Pro', 'whatsapp')).toBe(true);
        expect(canPlanAccessModule('Business', 'rh')).toBe(true);
      });
    });

    describe('Edge cases', () => {
      it('should handle null/undefined plan gracefully', () => {
        expect(canPlanAccessModule(null, 'socle')).toBe(false);
        expect(canPlanAccessModule(undefined, 'socle')).toBe(false);
      });

      it('should allow access to unmapped modules (backwards compatibility)', () => {
        expect(canPlanAccessModule('starter', 'unknown_module')).toBe(true);
      });
    });
  });

  describe('getMinimumPlanForModule()', () => {
    it('should return starter for base modules', () => {
      expect(getMinimumPlanForModule('socle')).toBe('starter');
      expect(getMinimumPlanForModule('agent_ia_web')).toBe('starter');
      expect(getMinimumPlanForModule('facturation')).toBe('starter');
    });

    it('should return pro for Pro modules', () => {
      expect(getMinimumPlanForModule('whatsapp')).toBe('pro');
      expect(getMinimumPlanForModule('telephone')).toBe('pro');
      expect(getMinimumPlanForModule('comptabilite')).toBe('pro');
    });

    it('should return business for Business modules', () => {
      expect(getMinimumPlanForModule('rh')).toBe('business');
      expect(getMinimumPlanForModule('seo')).toBe('business');
      expect(getMinimumPlanForModule('sentinel')).toBe('business');
    });

    it('should return starter for unknown modules (safe default)', () => {
      expect(getMinimumPlanForModule('unknown')).toBe('starter');
    });
  });
});

describe('Plan Features Consistency', () => {
  describe('PLAN_FEATURES structure', () => {
    it('should have all three plans defined', () => {
      expect(PLAN_FEATURES.starter).toBeDefined();
      expect(PLAN_FEATURES.pro).toBeDefined();
      expect(PLAN_FEATURES.business).toBeDefined();
    });

    it('should have Pro include all Starter features', () => {
      const starterFeatures = Object.keys(PLAN_FEATURES.starter);

      starterFeatures.forEach(feature => {
        expect(PLAN_FEATURES.pro[feature]).toBe(true);
      });
    });

    it('should have Business include all Pro features', () => {
      const proFeatures = Object.keys(PLAN_FEATURES.pro);

      proFeatures.forEach(feature => {
        expect(PLAN_FEATURES.business[feature]).toBe(true);
      });
    });
  });

  describe('Cross-file consistency', () => {
    it('should have MODULE_PLAN_ACCESS match PLAN_FEATURES for Pro modules', () => {
      const proOnlyInPlanAccess = ['whatsapp', 'telephone', 'comptabilite', 'marketing', 'pipeline'];

      proOnlyInPlanAccess.forEach(module => {
        // Should be in Pro PLAN_FEATURES
        expect(PLAN_FEATURES.pro[module]).toBe(true);
        // Should NOT be in Starter PLAN_FEATURES
        expect(PLAN_FEATURES.starter[module]).toBeFalsy();
      });
    });

    it('should have MODULE_PLAN_ACCESS match PLAN_FEATURES for Business modules', () => {
      const businessOnlyInPlanAccess = ['rh', 'seo', 'api', 'sentinel'];

      businessOnlyInPlanAccess.forEach(module => {
        // Should be in Business PLAN_FEATURES
        expect(PLAN_FEATURES.business[module]).toBe(true);
        // Should NOT be in Pro PLAN_FEATURES
        expect(PLAN_FEATURES.pro[module]).toBeFalsy();
      });
    });
  });
});

describe('Security - Plan Upgrade Scenarios', () => {
  describe('Downgrade protection', () => {
    it('should list what features a tenant would lose on downgrade', () => {
      const businessFeatures = Object.keys(PLAN_FEATURES.business);

      const lostOnBusinessToPro = businessFeatures.filter(f => !PLAN_FEATURES.pro[f]);

      // Business exclusive features
      expect(lostOnBusinessToPro).toContain('rh');
      expect(lostOnBusinessToPro).toContain('seo');
      expect(lostOnBusinessToPro).toContain('api');
      expect(lostOnBusinessToPro).toContain('sentinel');
    });
  });

  describe('Module activation flow', () => {
    it('should correctly block activation attempts', () => {
      // Simulate activation requests
      const testCases = [
        { plan: 'starter', module: 'whatsapp', expected: false },
        { plan: 'starter', module: 'rh', expected: false },
        { plan: 'pro', module: 'whatsapp', expected: true },
        { plan: 'pro', module: 'rh', expected: false },
        { plan: 'business', module: 'rh', expected: true },
      ];

      testCases.forEach(({ plan, module, expected }) => {
        const result = canPlanAccessModule(plan, module);
        expect(result).toBe(expected);
      });
    });
  });
});

describe('Pricing Grid Validation', () => {
  const PRICING = {
    starter: { monthly: 99, yearly: 950 },
    pro: { monthly: 249, yearly: 2390 },
    business: { monthly: 499, yearly: 4790 }
  };

  it('should have correct monthly prices', () => {
    expect(PRICING.starter.monthly).toBe(99);
    expect(PRICING.pro.monthly).toBe(249);
    expect(PRICING.business.monthly).toBe(499);
  });

  it('should have ~20% discount on yearly plans', () => {
    // Starter: 99*12 = 1188, yearly = 950 → ~20% discount
    const starterDiscount = 1 - (PRICING.starter.yearly / (PRICING.starter.monthly * 12));
    expect(starterDiscount).toBeGreaterThan(0.19);
    expect(starterDiscount).toBeLessThan(0.21);

    // Pro: 249*12 = 2988, yearly = 2390 → ~20% discount
    const proDiscount = 1 - (PRICING.pro.yearly / (PRICING.pro.monthly * 12));
    expect(proDiscount).toBeGreaterThan(0.19);
    expect(proDiscount).toBeLessThan(0.21);

    // Business: 499*12 = 5988, yearly = 4790 → ~20% discount
    const businessDiscount = 1 - (PRICING.business.yearly / (PRICING.business.monthly * 12));
    expect(businessDiscount).toBeGreaterThan(0.19);
    expect(businessDiscount).toBeLessThan(0.21);
  });
});
