/**
 * Tests quotaManager — Gestion des quotas et depassements
 */
import { jest } from '@jest/globals';

// Mock supabase avant import
const mockFrom = jest.fn();
const mockSupabase = { from: mockFrom };

jest.unstable_mockModule('../src/config/supabase.js', () => ({
  supabase: mockSupabase,
  getServiceSupabase: () => mockSupabase
}));

// Import apres mock
const { MODULE_QUOTAS, quotaManager } = await import('../src/services/quotaManager.js');

// ════════════════════════════════════════════════
// MODULE_QUOTAS STRUCTURE
// ════════════════════════════════════════════════
describe('MODULE_QUOTAS', () => {
  test('contient les modules de communication', () => {
    expect(MODULE_QUOTAS.telephone_ia).toBeDefined();
    expect(MODULE_QUOTAS.whatsapp_ia).toBeDefined();
    expect(MODULE_QUOTAS.web_chat_ia).toBeDefined();
    expect(MODULE_QUOTAS.sms_rdv).toBeDefined();
  });

  test('contient les modules de gestion', () => {
    expect(MODULE_QUOTAS.comptabilite).toBeDefined();
    expect(MODULE_QUOTAS.stock).toBeDefined();
    expect(MODULE_QUOTAS.rh).toBeDefined();
    expect(MODULE_QUOTAS.crm).toBeDefined();
  });

  test('telephone_ia a 300 minutes incluses', () => {
    expect(MODULE_QUOTAS.telephone_ia.included.minutes).toBe(300);
  });

  test('whatsapp_ia a 1500 messages inclus', () => {
    expect(MODULE_QUOTAS.whatsapp_ia.included.messages).toBe(1500);
  });

  test('comptabilite est illimite', () => {
    expect(MODULE_QUOTAS.comptabilite.unlimited).toBe(true);
  });

  test('chaque module a un nom et basePrice', () => {
    Object.entries(MODULE_QUOTAS).forEach(([id, quota]) => {
      expect(quota.name).toBeDefined();
      expect(typeof quota.basePrice).toBe('number');
    });
  });

  test('modules avec quotas ont des overage rates', () => {
    const metered = Object.entries(MODULE_QUOTAS)
      .filter(([_, q]) => !q.unlimited);

    metered.forEach(([id, quota]) => {
      expect(quota.overage).toBeDefined();
      expect(typeof quota.overage).toBe('object');
    });
  });
});

// ════════════════════════════════════════════════
// QUOTA MANAGER METHODS
// ════════════════════════════════════════════════
describe('quotaManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    quotaManager.invalidateCache('test-tenant');
  });

  test('getModuleFromChannel voice → telephone_ia', () => {
    expect(quotaManager.getModuleFromChannel('voice')).toBe('telephone_ia');
  });

  test('getModuleFromChannel whatsapp → whatsapp_ia', () => {
    expect(quotaManager.getModuleFromChannel('whatsapp')).toBe('whatsapp_ia');
  });

  test('getModuleFromChannel web → web_chat_ia', () => {
    expect(quotaManager.getModuleFromChannel('web')).toBe('web_chat_ia');
  });

  test('getModuleFromChannel unknown → null', () => {
    expect(quotaManager.getModuleFromChannel('unknown')).toBeNull();
  });

  test('checkQuota pour module illimite = toujours allowed', async () => {
    // Mock getCurrentUsage
    const mockBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      then: (resolve) => resolve({ data: null, error: null })
    };
    mockFrom.mockReturnValue(mockBuilder);

    const result = await quotaManager.checkQuota('test-tenant', 'comptabilite', 'operations', 1);
    expect(result.allowed).toBe(true);
  });

  test('invalidateCache sans erreur', () => {
    expect(() => quotaManager.invalidateCache('test-tenant')).not.toThrow();
  });
});
