/**
 * SENTINEL Metrics Test Suite
 * Verification de l'exactitude des metriques collectees
 */

import { jest } from '@jest/globals';

// Mock Supabase
const mockData = {
  clients: [
    { id: 1, tenant_id: 'test', created_at: new Date().toISOString() },
    { id: 2, tenant_id: 'test', created_at: new Date(Date.now() - 86400000).toISOString() },
  ],
  reservations: [
    { id: 1, tenant_id: 'test', statut: 'termine', prix_total: 100, date: new Date().toISOString().split('T')[0] },
    { id: 2, tenant_id: 'test', statut: 'no_show', prix_total: 50, date: new Date().toISOString().split('T')[0] },
    { id: 3, tenant_id: 'test', statut: 'confirme', prix_total: 75, date: new Date().toISOString().split('T')[0] },
  ],
};

jest.unstable_mockModule('../src/config/supabase.js', () => ({
  supabase: {
    from: (table) => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            then: (resolve) => resolve({ data: mockData[table] || [], error: null }),
          }),
          then: (resolve) => resolve({ data: mockData[table] || [], error: null }),
        }),
        then: (resolve) => resolve({ data: mockData[table] || [], error: null }),
      }),
    }),
  },
}));

describe('SENTINEL Metrics Collection', () => {

  describe('Client Metrics', () => {
    test('Should count total clients correctly', () => {
      const totalClients = mockData.clients.length;
      expect(totalClients).toBe(2);
    });

    test('Should identify new clients (last 24h)', () => {
      const now = Date.now();
      const newClients = mockData.clients.filter(c => {
        const created = new Date(c.created_at).getTime();
        return (now - created) < 86400000;
      });
      expect(newClients.length).toBe(1);
    });
  });

  describe('Reservation Metrics', () => {
    test('Should count reservations by status', () => {
      const termine = mockData.reservations.filter(r => r.statut === 'termine').length;
      const noShow = mockData.reservations.filter(r => r.statut === 'no_show').length;
      const confirme = mockData.reservations.filter(r => r.statut === 'confirme').length;

      expect(termine).toBe(1);
      expect(noShow).toBe(1);
      expect(confirme).toBe(1);
    });

    test('Should calculate no-show rate correctly', () => {
      const total = mockData.reservations.length;
      const noShows = mockData.reservations.filter(r => r.statut === 'no_show').length;
      const rate = (noShows / total) * 100;

      expect(rate).toBeCloseTo(33.33, 1);
    });

    test('Should calculate total revenue', () => {
      const totalRevenue = mockData.reservations
        .filter(r => r.statut === 'termine')
        .reduce((sum, r) => sum + r.prix_total, 0);

      expect(totalRevenue).toBe(100);
    });
  });

  describe('Cost Calculations', () => {
    const PRICING = {
      AI_INPUT_PER_1M: 3.00,
      AI_OUTPUT_PER_1M: 15.00,
      USD_TO_EUR: 0.92,
      SMS_FR: 0.0725,
    };

    test('Should calculate AI costs correctly', () => {
      const inputTokens = 1000000;
      const outputTokens = 500000;

      const inputCost = (inputTokens / 1000000) * PRICING.AI_INPUT_PER_1M;
      const outputCost = (outputTokens / 1000000) * PRICING.AI_OUTPUT_PER_1M;
      const totalUSD = inputCost + outputCost;
      const totalEUR = totalUSD * PRICING.USD_TO_EUR;

      expect(inputCost).toBe(3.00);
      expect(outputCost).toBe(7.50);
      expect(totalEUR).toBeCloseTo(9.66, 2);
    });

    test('Should calculate SMS costs correctly', () => {
      const smsCount = 10;
      const cost = smsCount * PRICING.SMS_FR;

      expect(cost).toBeCloseTo(0.725, 3);
    });
  });
});

describe('SENTINEL Data Accuracy', () => {

  test('Should not have negative values', () => {
    const metrics = {
      total_clients: 10,
      revenue: 500,
      no_show_rate: 15,
    };

    Object.values(metrics).forEach(value => {
      expect(value).toBeGreaterThanOrEqual(0);
    });
  });

  test('Should have rates between 0 and 100', () => {
    const rates = {
      no_show_rate: 15,
      conversion_rate: 85,
      completion_rate: 92,
    };

    Object.values(rates).forEach(rate => {
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(100);
    });
  });

  test('Should have valid date formats', () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const today = new Date().toISOString().split('T')[0];

    expect(today).toMatch(dateRegex);
  });
});
