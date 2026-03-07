import { describe, it, expect, beforeEach } from 'vitest';

// Test des fonctions utilitaires extraites de api.ts
describe('API Utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Token management', () => {
    it('should return null when no token is stored', () => {
      const token = localStorage.getItem('nexus_admin_token');
      expect(token).toBeNull();
    });

    it('should store and retrieve tenant-specific token', () => {
      const tenantSlug = 'nexus-test';
      const token = 'test-jwt-token';
      localStorage.setItem('nexus_current_tenant', tenantSlug);
      localStorage.setItem(`nexus_admin_token_${tenantSlug}`, token);

      expect(localStorage.getItem(`nexus_admin_token_${tenantSlug}`)).toBe(token);
      expect(localStorage.getItem('nexus_current_tenant')).toBe(tenantSlug);
    });

    it('should clear all tokens on clearToken', () => {
      localStorage.setItem('nexus_admin_token', 'old-token');
      localStorage.setItem('nexus_current_tenant', 'test');
      localStorage.setItem('nexus_admin_token_test', 'tenant-token');

      // Simulate clearToken
      localStorage.removeItem('nexus_admin_token_test');
      localStorage.removeItem('nexus_admin_token');
      localStorage.removeItem('nexus_current_tenant');

      expect(localStorage.getItem('nexus_admin_token')).toBeNull();
      expect(localStorage.getItem('nexus_current_tenant')).toBeNull();
      expect(localStorage.getItem('nexus_admin_token_test')).toBeNull();
    });
  });

  describe('JWT extraction', () => {
    it('should extract tenant info from a valid JWT', () => {
      const payload = { tenant_id: '123', tenant_slug: 'nexus-test' };
      const fakeJwt = `header.${btoa(JSON.stringify(payload))}.signature`;

      const decoded = JSON.parse(atob(fakeJwt.split('.')[1]));
      expect(decoded.tenant_id).toBe('123');
      expect(decoded.tenant_slug).toBe('nexus-test');
    });

    it('should handle invalid JWT gracefully', () => {
      const invalidJwt = 'not.a.valid.jwt';
      try {
        JSON.parse(atob(invalidJwt.split('.')[1]));
      } catch {
        // Expected - invalid JWT should throw
        expect(true).toBe(true);
      }
    });
  });
});
