/**
 * Tests Programme Fidélité
 * Routes: /api/admin/loyalty (config, stats, leaderboard, adjust, redeem)
 * ~24 tests
 */

import { jest } from '@jest/globals';
import express from 'express';

// ════════════════════════════════════════════════
// MOCK SETUP
// ════════════════════════════════════════════════

const stores = {
  loyalty_config: [],
  loyalty_transactions: [],
  clients: [],
  admin_users: []
};

const resetStores = () => {
  Object.keys(stores).forEach(k => { stores[k] = []; });
};

// Mock Supabase
jest.unstable_mockModule('../src/config/supabase.js', () => {
  function createBuilder(table) {
    let data = [...(stores[table] || [])];
    let filters = [];
    let singleMode = false;
    let countMode = false;
    let pendingUpdate = null;
    let pendingDelete = false;
    let pendingInsert = null;
    let limitVal = null;
    let orderField = null;
    let orderAsc = true;

    function applyFilters(arr) {
      return arr.filter(item => filters.every(f => f(item)));
    }

    const builder = {
      select: (fields, options = {}) => {
        if (options.count === 'exact') countMode = true;
        return builder;
      },
      eq: (field, value) => {
        filters.push(item => item[field] === value);
        return builder;
      },
      gt: (field, value) => {
        filters.push(item => item[field] > value);
        return builder;
      },
      gte: (field, value) => {
        filters.push(item => item[field] >= value);
        return builder;
      },
      order: (field, opts = {}) => {
        orderField = field;
        orderAsc = opts.ascending !== false;
        return builder;
      },
      limit: (n) => {
        limitVal = n;
        return builder;
      },
      range: (from, to) => {
        limitVal = to - from + 1;
        return builder;
      },
      single: () => {
        if (pendingInsert) {
          return { data: pendingInsert, error: null };
        }
        singleMode = true;
        const result = applyFilters(data);
        const item = result[0] || null;
        if (pendingUpdate && item) {
          Object.assign(item, pendingUpdate);
          return { data: item, error: null };
        }
        if (pendingUpdate && !item) {
          // upsert case: find in live store
          const liveResult = applyFilters(stores[table]);
          const liveItem = liveResult[0] || null;
          if (liveItem) {
            Object.assign(liveItem, pendingUpdate);
            return { data: liveItem, error: null };
          }
        }
        if (pendingDelete && item) {
          const idx = stores[table].indexOf(item);
          if (idx >= 0) stores[table].splice(idx, 1);
          return { data: item, error: null };
        }
        return { data: item, error: item ? null : { code: 'PGRST116', message: 'not found' } };
      },
      insert: (record) => {
        const newItem = { id: Math.floor(Math.random() * 100000), ...record, created_at: new Date().toISOString() };
        stores[table].push(newItem);
        pendingInsert = newItem;
        return builder;
      },
      update: (updates) => {
        pendingUpdate = updates;
        return builder;
      },
      upsert: (record, opts = {}) => {
        const conflictField = opts.onConflict;
        const existing = conflictField ? stores[table].find(item => item[conflictField] === record[conflictField]) : null;
        if (existing) {
          Object.assign(existing, record);
          pendingInsert = existing;
        } else {
          const newItem = { id: Math.floor(Math.random() * 100000), ...record, created_at: new Date().toISOString() };
          stores[table].push(newItem);
          pendingInsert = newItem;
        }
        return builder;
      },
      delete: () => {
        pendingDelete = true;
        return builder;
      },
      then: (resolve) => {
        let result = applyFilters(data);
        if (orderField) {
          result.sort((a, b) => {
            const va = a[orderField], vb = b[orderField];
            return orderAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
          });
        }
        if (limitVal) result = result.slice(0, limitVal);

        if (pendingInsert) {
          resolve({ data: pendingInsert, error: null, count: 1 });
        } else if (pendingUpdate) {
          const items = applyFilters(stores[table]);
          items.forEach(item => Object.assign(item, pendingUpdate));
          resolve({ data: items, error: null });
        } else if (pendingDelete) {
          const items = applyFilters(stores[table]);
          items.forEach(item => {
            const idx = stores[table].indexOf(item);
            if (idx >= 0) stores[table].splice(idx, 1);
          });
          resolve({ data: items, error: null });
        } else {
          resolve({ data: result, error: null, count: countMode ? result.length : undefined });
        }
      }
    };

    return builder;
  }

  return {
    supabase: {
      from: (table) => createBuilder(table)
    }
  };
});

// Mock logger
jest.unstable_mockModule('../src/config/logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

// Mock authenticateAdmin
jest.unstable_mockModule('../src/routes/adminAuth.js', () => ({
  authenticateAdmin: (req, res, next) => {
    req.admin = { id: 1, tenant_id: 'test-tenant', role: 'admin', plan: 'business' };
    next();
  }
}));

// ════════════════════════════════════════════════
// IMPORTS (after mocks)
// ════════════════════════════════════════════════

const { default: loyaltyRoutes } = await import('../src/routes/adminLoyalty.js');
const { earnPoints, redeemPoints, adjustPoints, getConfig, getLeaderboard, getStats } = await import('../src/services/loyaltyService.js');

// ════════════════════════════════════════════════
// APP SETUP
// ════════════════════════════════════════════════

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/loyalty', loyaltyRoutes);
  return app;
}

// ════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════

import request from 'supertest';

describe('Programme Fidélité', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    resetStores();
    // Seed un client
    stores.clients.push({
      id: 1, tenant_id: 'test-tenant', nom: 'Dupont', prenom: 'Jean',
      email: 'jean@test.com', loyalty_points: 0, total_spent: 0
    });
    stores.clients.push({
      id: 2, tenant_id: 'other-tenant', nom: 'Martin', prenom: 'Paul',
      email: 'paul@test.com', loyalty_points: 100, total_spent: 500
    });
  });

  // ── Service Tests ──

  describe('loyaltyService', () => {
    test('getConfig retourne defaults si pas de config', async () => {
      const config = await getConfig('test-tenant');
      expect(config.points_per_euro).toBe(1.0);
      expect(config.signup_bonus).toBe(50);
      expect(config.min_redeem).toBe(100);
    });

    test('earnPoints ajoute des points au client', async () => {
      const tx = await earnPoints('test-tenant', 1, 50, 'reservation', '123');
      expect(tx).not.toBeNull();
      expect(tx.points).toBe(50);
      expect(tx.type).toBe('earn');
      const client = stores.clients.find(c => c.id === 1);
      expect(client.loyalty_points).toBe(50);
    });

    test('earnPoints respecte le ratio points_per_euro', async () => {
      // Config custom: 2 pts par euro
      stores.loyalty_config.push({
        id: 1, tenant_id: 'test-tenant', enabled: true,
        points_per_euro: 2.0, signup_bonus: 50, validity_days: 730, min_redeem: 100, redeem_ratio: 0.10
      });
      const tx = await earnPoints('test-tenant', 1, 30, 'reservation', '456');
      expect(tx.points).toBe(60); // 30 * 2
    });

    test('earnPoints ne fait rien si programme désactivé', async () => {
      stores.loyalty_config.push({
        id: 1, tenant_id: 'test-tenant', enabled: false,
        points_per_euro: 1, signup_bonus: 0, validity_days: 730, min_redeem: 100, redeem_ratio: 0.10
      });
      const tx = await earnPoints('test-tenant', 1, 50, 'reservation', '789');
      expect(tx).toBeNull();
    });

    test('redeemPoints déduit les points', async () => {
      stores.clients[0].loyalty_points = 200;
      const result = await redeemPoints('test-tenant', 1, 100);
      expect(result.discount_value).toBe(10); // 100 * 0.10
      const client = stores.clients.find(c => c.id === 1);
      expect(client.loyalty_points).toBe(100);
    });

    test('redeemPoints refuse si solde insuffisant', async () => {
      stores.clients[0].loyalty_points = 50;
      await expect(redeemPoints('test-tenant', 1, 100)).rejects.toThrow('Solde insuffisant');
    });

    test('redeemPoints refuse si minimum non atteint', async () => {
      stores.clients[0].loyalty_points = 500;
      await expect(redeemPoints('test-tenant', 1, 10)).rejects.toThrow('Minimum');
    });

    test('adjustPoints modifie le solde avec raison', async () => {
      stores.clients[0].loyalty_points = 100;
      const tx = await adjustPoints('test-tenant', 1, 50, 1, 'Geste commercial');
      expect(tx.type).toBe('adjust');
      expect(tx.balance_after).toBe(150);
    });

    test('adjustPoints refuse solde négatif', async () => {
      stores.clients[0].loyalty_points = 10;
      await expect(adjustPoints('test-tenant', 1, -50, 1, 'Correction')).rejects.toThrow('négatif');
    });

    test('adjustPoints exige une raison', async () => {
      await expect(adjustPoints('test-tenant', 1, 10, 1, '')).rejects.toThrow('Raison');
    });

    test('getLeaderboard tri par points décroissants', async () => {
      stores.clients[0].loyalty_points = 200;
      stores.clients.push({
        id: 3, tenant_id: 'test-tenant', nom: 'Lemoine', prenom: 'Marie',
        email: 'marie@test.com', loyalty_points: 500, total_spent: 1000
      });
      const lb = await getLeaderboard('test-tenant');
      expect(lb.length).toBe(2);
      expect(lb[0].loyalty_points).toBeGreaterThanOrEqual(lb[1].loyalty_points);
    });

    test('getLeaderboard isole par tenant', async () => {
      // client 2 est sur other-tenant avec 100 pts
      const lb = await getLeaderboard('test-tenant');
      expect(lb.every(c => c.tenant_id === undefined || stores.clients.find(s => s.id === c.id)?.tenant_id === 'test-tenant')).toBe(true);
    });

    test('earnPoints exige tenant_id', async () => {
      await expect(earnPoints(null, 1, 50)).rejects.toThrow('tenant_id');
    });

    test('redeemPoints exige tenant_id', async () => {
      await expect(redeemPoints(null, 1, 50)).rejects.toThrow('tenant_id');
    });
  });

  // ── Route Tests ──

  describe('Routes /api/admin/loyalty', () => {
    test('GET /config retourne la config', async () => {
      const res = await request(app).get('/api/admin/loyalty/config');
      expect(res.status).toBe(200);
      expect(res.body.config).toBeDefined();
      expect(res.body.config.points_per_euro).toBeDefined();
    });

    test('PUT /config met à jour la config', async () => {
      const res = await request(app)
        .put('/api/admin/loyalty/config')
        .send({ points_per_euro: 2.0, signup_bonus: 100 });
      expect(res.status).toBe(200);
      expect(res.body.config).toBeDefined();
    });

    test('GET /stats retourne les statistiques', async () => {
      const res = await request(app).get('/api/admin/loyalty/stats');
      expect(res.status).toBe(200);
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.total_points_circulation).toBeDefined();
    });

    test('GET /leaderboard retourne le classement', async () => {
      const res = await request(app).get('/api/admin/loyalty/leaderboard');
      expect(res.status).toBe(200);
      expect(res.body.leaderboard).toBeDefined();
      expect(Array.isArray(res.body.leaderboard)).toBe(true);
    });

    test('GET /clients/:id retourne le détail client', async () => {
      const res = await request(app).get('/api/admin/loyalty/clients/1');
      expect(res.status).toBe(200);
      expect(res.body.points).toBeDefined();
    });

    test('POST /clients/:id/adjust ajuste les points', async () => {
      stores.clients[0].loyalty_points = 100;
      const res = await request(app)
        .post('/api/admin/loyalty/clients/1/adjust')
        .send({ points: 50, reason: 'Bonus test' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('POST /clients/:id/adjust refuse sans raison', async () => {
      const res = await request(app)
        .post('/api/admin/loyalty/clients/1/adjust')
        .send({ points: 50 });
      expect(res.status).toBe(400);
    });

    test('POST /clients/:id/redeem utilise les points', async () => {
      stores.clients[0].loyalty_points = 500;
      const res = await request(app)
        .post('/api/admin/loyalty/clients/1/redeem')
        .send({ points: 100 });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.discount_value).toBeDefined();
    });

    test('POST /clients/:id/redeem refuse sans points', async () => {
      const res = await request(app)
        .post('/api/admin/loyalty/clients/1/redeem')
        .send({});
      expect(res.status).toBe(400);
    });

    test('GET /leaderboard?limit=5 respecte la limite', async () => {
      const res = await request(app).get('/api/admin/loyalty/leaderboard?limit=5');
      expect(res.status).toBe(200);
    });
  });
});
