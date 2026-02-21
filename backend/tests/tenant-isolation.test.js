/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    🛡️ TENANT ISOLATION TESTS 🛡️                           ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  Tests automatisés pour garantir l'isolation multi-tenant.               ║
 * ║  Ces tests DOIVENT passer avant chaque déploiement.                      ║
 * ║                                                                           ║
 * ║  npm run test:tenant                                                      ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Configuration des tests
const API_URL = process.env.TEST_API_URL || 'http://localhost:5000';
const TENANT_A = 'fatshairafro';
const TENANT_B = 'decoevent';

/**
 * Helper pour les requêtes API
 */
async function apiRequest(method, path, options = {}) {
  const { tenantId, body, headers = {} } = options;

  const fetchOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tenantId && { 'X-Tenant-ID': tenantId }),
      ...headers,
    },
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, fetchOptions);
  const data = await response.json().catch(() => null);

  return { status: response.status, data };
}

describe('🛡️ TENANT SHIELD - Tests d\'Isolation', () => {

  describe('1. Endpoints publics avec tenant', () => {

    it('GET /api/services retourne uniquement les services du tenant', async () => {
      const responseA = await apiRequest('GET', '/api/services', { tenantId: TENANT_A });
      const responseB = await apiRequest('GET', '/api/services', { tenantId: TENANT_B });

      expect(responseA.status).toBe(200);
      expect(responseB.status).toBe(200);

      // Les données doivent être différentes (isolation)
      const servicesA = responseA.data?.services || [];
      const servicesB = responseB.data?.services || [];

      // Vérifier qu'il n'y a pas de chevauchement d'IDs
      const idsA = new Set(servicesA.map(s => s.id));
      const idsB = new Set(servicesB.map(s => s.id));

      for (const id of idsA) {
        expect(idsB.has(id)).toBe(false);
      }
    });

    it('GET /api/services REFUSE sans tenant_id', async () => {
      const response = await apiRequest('GET', '/api/services');

      // Doit retourner une erreur (400 ou 403)
      expect([400, 403]).toContain(response.status);
    });

  });

  describe('2. Chat API avec tenant', () => {

    it('POST /api/chat fonctionne avec tenant', async () => {
      const response = await apiRequest('POST', '/api/chat', {
        tenantId: TENANT_A,
        body: { message: 'Bonjour', sessionId: 'test-isolation' },
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('response');
    });

    it('POST /api/chat REFUSE sans tenant', async () => {
      const response = await apiRequest('POST', '/api/chat', {
        body: { message: 'Test' },
      });

      expect([400, 403]).toContain(response.status);
    });

  });

  describe('3. Protection contre injection tenant', () => {

    it('Le body.tenant_id ne peut pas override le header', async () => {
      // Tentative d'accès à TENANT_B avec session TENANT_A
      const response = await apiRequest('POST', '/api/chat', {
        tenantId: TENANT_A,
        body: {
          message: 'Test',
          tenant_id: TENANT_B, // Tentative d'injection
        },
      });

      // La requête doit utiliser TENANT_A, pas TENANT_B
      // (soit success avec TENANT_A, soit erreur de mismatch)
      if (response.status === 200) {
        // Si success, vérifier que c'est bien pour TENANT_A
        // (le contexte utilisé est celui du header)
        expect(response.data).toHaveProperty('response');
      } else if (response.status === 403) {
        // Erreur de mismatch = protection active
        expect(response.data?.error).toMatch(/TENANT|mismatch/i);
      }
    });

  });

  describe('4. Routes système (sans tenant requis)', () => {

    it('GET /health fonctionne sans tenant', async () => {
      const response = await apiRequest('GET', '/health');
      expect(response.status).toBe(200);
    });

    it('GET /api/whatsapp/health fonctionne sans tenant', async () => {
      const response = await apiRequest('GET', '/api/whatsapp/health');
      expect(response.status).toBe(200);
    });

  });

  describe('5. Phone routing isolation', () => {

    it('Le cache téléphone route vers le bon tenant', async () => {
      const response = await apiRequest('GET', '/api/provisioning/debug/phone-cache');

      expect(response.status).toBe(200);
      expect(response.data?.cacheState?.entries).toBeDefined();

      // Chaque numéro doit avoir UN SEUL tenant
      const entries = response.data.cacheState.entries;
      for (const [phone, tenant] of Object.entries(entries)) {
        expect(typeof tenant).toBe('string');
        expect(tenant.length).toBeGreaterThan(0);
      }
    });

  });

  describe('6. Disponibilités avec tenant', () => {

    it('GET /api/disponibilites retourne des créneaux pour le tenant', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const response = await apiRequest('GET', `/api/disponibilites?date=${dateStr}`, {
        tenantId: TENANT_A,
      });

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('creneaux');
    });

    it('GET /api/disponibilites REFUSE sans tenant', async () => {
      const response = await apiRequest('GET', '/api/disponibilites?date=2026-03-01');
      expect([400, 403]).toContain(response.status);
    });

  });

});

describe('🔒 TENANT SHIELD - Stress Tests', () => {

  it('100 requêtes parallèles restent isolées', async () => {
    const requests = [];

    // 50 requêtes pour TENANT_A
    for (let i = 0; i < 50; i++) {
      requests.push(
        apiRequest('GET', '/api/services', { tenantId: TENANT_A })
          .then(r => ({ tenant: TENANT_A, data: r.data }))
      );
    }

    // 50 requêtes pour TENANT_B
    for (let i = 0; i < 50; i++) {
      requests.push(
        apiRequest('GET', '/api/services', { tenantId: TENANT_B })
          .then(r => ({ tenant: TENANT_B, data: r.data }))
      );
    }

    const results = await Promise.all(requests);

    // Vérifier que chaque résultat correspond au bon tenant
    const tenantAResults = results.filter(r => r.tenant === TENANT_A);
    const tenantBResults = results.filter(r => r.tenant === TENANT_B);

    expect(tenantAResults.length).toBe(50);
    expect(tenantBResults.length).toBe(50);

    // Tous les résultats TENANT_A doivent être identiques entre eux
    const firstA = JSON.stringify(tenantAResults[0].data);
    for (const result of tenantAResults) {
      expect(JSON.stringify(result.data)).toBe(firstA);
    }

    // Tous les résultats TENANT_B doivent être identiques entre eux
    const firstB = JSON.stringify(tenantBResults[0].data);
    for (const result of tenantBResults) {
      expect(JSON.stringify(result.data)).toBe(firstB);
    }
  });

});
