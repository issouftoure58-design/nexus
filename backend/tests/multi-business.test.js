/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TESTS MULTI-BUSINESS
 *
 * Valide la configuration des 4 types de business:
 *   - service_domicile
 *   - salon
 *   - restaurant
 *   - hotel
 *
 * Usage: npm test -- --testPathPattern=multi-business
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { describe, test, expect } from '@jest/globals';

// Import de la config statique (pas de Supabase requis)
import { BUSINESS_TYPES } from '../src/config/businessTypes.js';

// ═══════════════════════════════════════════════════════════════════════════
// TEST: Configuration des 4 types de business
// ═══════════════════════════════════════════════════════════════════════════

describe('Multi-Business Types', () => {

  describe('Configuration businessTypes.js', () => {

    test('devrait avoir 4 types de business configurés', () => {
      const types = Object.keys(BUSINESS_TYPES);
      expect(types).toContain('service_domicile');
      expect(types).toContain('salon');
      expect(types).toContain('restaurant');
      expect(types).toContain('hotel');
      expect(types.length).toBe(4);
    });

    test('chaque type devrait avoir defaultLocation dans businessRules', () => {
      expect(BUSINESS_TYPES.service_domicile.businessRules.defaultLocation).toBe('domicile');
      expect(BUSINESS_TYPES.salon.businessRules.defaultLocation).toBe('salon');
      expect(BUSINESS_TYPES.restaurant.businessRules.defaultLocation).toBe('restaurant');
      expect(BUSINESS_TYPES.hotel.businessRules.defaultLocation).toBe('hotel');
    });

    test('chaque type devrait avoir une terminologie complète', () => {
      for (const [type, config] of Object.entries(BUSINESS_TYPES)) {
        expect(config.terminology).toBeDefined();
        expect(config.terminology.reservation).toBeDefined();
        expect(config.terminology.service).toBeDefined();
        expect(config.terminology.client).toBeDefined();
        expect(config.terminology.employee).toBeDefined();

        // Vérifier que chaque terme a singular et plural
        expect(config.terminology.reservation.singular).toBeTruthy();
        expect(config.terminology.reservation.plural).toBeTruthy();
        expect(config.terminology.service.singular).toBeTruthy();
        expect(config.terminology.service.plural).toBeTruthy();
      }
    });

    test('chaque type devrait avoir des features', () => {
      for (const [type, config] of Object.entries(BUSINESS_TYPES)) {
        expect(config.features).toBeDefined();
        expect(typeof config.features).toBe('object');
      }
    });

    test('chaque type devrait avoir des pricingModesAllowed', () => {
      for (const [type, config] of Object.entries(BUSINESS_TYPES)) {
        expect(config.pricingModesAllowed).toBeDefined();
        expect(Array.isArray(config.pricingModesAllowed)).toBe(true);
        expect(config.pricingModesAllowed.length).toBeGreaterThan(0);
      }
    });

  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST: Features par type de business
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Features service_domicile', () => {
    const features = BUSINESS_TYPES.service_domicile.features;

    test('devrait avoir travelFees activé', () => {
      expect(features.travelFees).toBe(true);
    });

    test('devrait avoir clientAddress activé', () => {
      expect(features.clientAddress).toBe(true);
    });

    test('devrait NE PAS avoir tableManagement', () => {
      expect(features.tableManagement).toBeFalsy();
    });

    test('devrait NE PAS avoir roomInventory', () => {
      expect(features.roomInventory).toBeFalsy();
    });
  });

  describe('Features salon', () => {
    const features = BUSINESS_TYPES.salon.features;

    test('devrait avoir multiStaff activé', () => {
      expect(features.multiStaff).toBe(true);
    });

    test('devrait NE PAS avoir travelFees', () => {
      expect(features.travelFees).toBe(false);
    });

    test('devrait NE PAS avoir clientAddress', () => {
      expect(features.clientAddress).toBe(false);
    });
  });

  describe('Features restaurant', () => {
    const features = BUSINESS_TYPES.restaurant.features;

    test('devrait avoir tableManagement activé', () => {
      expect(features.tableManagement).toBe(true);
    });

    test('devrait avoir covers activé', () => {
      expect(features.covers).toBe(true);
    });

    test('devrait NE PAS avoir travelFees', () => {
      expect(features.travelFees).toBe(false);
    });

    test('devrait NE PAS avoir clientAddress', () => {
      expect(features.clientAddress).toBe(false);
    });

    test('devrait NE PAS avoir roomInventory', () => {
      expect(features.roomInventory).toBeFalsy();
    });
  });

  describe('Features hotel', () => {
    const features = BUSINESS_TYPES.hotel.features;

    test('devrait avoir roomInventory activé', () => {
      expect(features.roomInventory).toBe(true);
    });

    test('devrait avoir checkinCheckout activé', () => {
      expect(features.checkinCheckout).toBe(true);
    });

    test('devrait avoir extras activé', () => {
      expect(features.extras).toBe(true);
    });

    test('devrait NE PAS avoir travelFees', () => {
      expect(features.travelFees).toBe(false);
    });

    test('devrait NE PAS avoir tableManagement', () => {
      expect(features.tableManagement).toBeFalsy();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST: Terminologie
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Terminologie par type', () => {

    test('service_domicile devrait utiliser "Prestation"', () => {
      expect(BUSINESS_TYPES.service_domicile.terminology.service.singular).toBe('Prestation');
    });

    test('salon devrait utiliser "Prestation"', () => {
      expect(BUSINESS_TYPES.salon.terminology.service.singular).toBe('Prestation');
    });

    test('restaurant devrait utiliser "Table"', () => {
      expect(BUSINESS_TYPES.restaurant.terminology.service.singular).toBe('Table');
    });

    test('hotel devrait utiliser "Chambre"', () => {
      expect(BUSINESS_TYPES.hotel.terminology.service.singular).toBe('Chambre');
    });

    test('hotel devrait utiliser "Hôte" pour client', () => {
      expect(BUSINESS_TYPES.hotel.terminology.client.singular).toBe('Hôte');
    });

    test('restaurant devrait utiliser "Serveur" pour employee', () => {
      expect(BUSINESS_TYPES.restaurant.terminology.employee.singular).toBe('Serveur');
    });

    test('hotel devrait utiliser "Réceptionniste" pour employee', () => {
      expect(BUSINESS_TYPES.hotel.terminology.employee.singular).toBe('Réceptionniste');
    });

  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST: Pricing modes
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Pricing modes par type', () => {

    test('service_domicile devrait supporter fixed et hourly', () => {
      const modes = BUSINESS_TYPES.service_domicile.pricingModesAllowed;
      expect(modes).toContain('fixed');
      expect(modes).toContain('hourly');
    });

    test('salon devrait supporter fixed', () => {
      const modes = BUSINESS_TYPES.salon.pricingModesAllowed;
      expect(modes).toContain('fixed');
    });

    test('hotel devrait supporter daily (par nuit)', () => {
      const modes = BUSINESS_TYPES.hotel.pricingModesAllowed;
      expect(modes).toContain('daily');
    });

  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST: Règles métier (affectation membre)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Affectation membre par type', () => {

    test('salon devrait EXIGER une affectation membre', () => {
      const rule = BUSINESS_TYPES.salon.businessRules?.requireEmployeeAssignment;
      expect(rule).toBe(true);
    });

    test('service_domicile devrait NE PAS exiger affectation membre stricte', () => {
      const rule = BUSINESS_TYPES.service_domicile.businessRules?.requireEmployeeAssignment;
      expect(rule).toBe(false);
    });

    test('restaurant devrait NE PAS exiger d\'affectation membre', () => {
      const rule = BUSINESS_TYPES.restaurant.businessRules?.requireEmployeeAssignment;
      expect(rule).toBeFalsy(); // undefined ou false = pas d'exigence
    });

    test('hotel devrait NE PAS exiger d\'affectation membre', () => {
      const rule = BUSINESS_TYPES.hotel.businessRules?.requireEmployeeAssignment;
      expect(rule).toBeFalsy(); // undefined ou false = pas d'exigence
    });

  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST: Cohérence globale
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cohérence globale', () => {

    test('tous les types devraient avoir un label', () => {
      for (const [type, config] of Object.entries(BUSINESS_TYPES)) {
        expect(config.label).toBeTruthy();
      }
    });

    test('tous les types devraient avoir une description', () => {
      for (const [type, config] of Object.entries(BUSINESS_TYPES)) {
        expect(config.description).toBeTruthy();
      }
    });

    test('features devrait être un objet avec des booléens', () => {
      for (const [type, config] of Object.entries(BUSINESS_TYPES)) {
        for (const [feature, value] of Object.entries(config.features)) {
          expect(typeof value).toBe('boolean');
        }
      }
    });

  });

});
