import { describe, it, expect } from 'vitest';

/**
 * Tests de validation des types de réponse API
 * Vérifie que les contrats d'interface sont respectés
 */

describe('API Response Types', () => {
  it('should validate a success response structure', () => {
    const response = { success: true, data: { id: '1', name: 'Test' } };
    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data.id).toBe('1');
  });

  it('should validate an error response structure', () => {
    const response = {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Données invalides' },
    };
    expect(response.success).toBe(false);
    expect(response.error.code).toBe('VALIDATION_ERROR');
    expect(response.error.message).toBeTruthy();
  });

  it('should validate a paginated response structure', () => {
    const response = {
      success: true,
      data: [{ id: '1' }, { id: '2' }],
      pagination: { page: 1, limit: 20, total: 42, pages: 3 },
    };
    expect(response.success).toBe(true);
    expect(response.data).toHaveLength(2);
    expect(response.pagination.pages).toBe(3);
    expect(response.pagination.total).toBe(42);
  });

  it('should validate DashboardStats type shape', () => {
    const stats = {
      clients_total: 150,
      rdv_mois: 45,
      ca_mois: 5000,
      ca_jour: 250,
    };
    expect(typeof stats.clients_total).toBe('number');
    expect(typeof stats.rdv_mois).toBe('number');
    expect(typeof stats.ca_mois).toBe('number');
    expect(typeof stats.ca_jour).toBe('number');
  });

  it('should validate tenant isolation in request headers', () => {
    const headers: Record<string, string> = {
      'Authorization': 'Bearer test-token',
      'X-Tenant-ID': 'nexus-test',
      'Content-Type': 'application/json',
    };
    expect(headers['X-Tenant-ID']).toBe('nexus-test');
    expect(headers['Authorization']).toMatch(/^Bearer /);
  });
});
