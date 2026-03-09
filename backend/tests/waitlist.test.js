/**
 * Tests Waitlist / Liste d'attente
 * Routes: /api/admin/waitlist (CRUD, notify, convert, stats)
 * ~20 tests
 */

import { jest } from '@jest/globals';
import express from 'express';

// ════════════════════════════════════════════════
// MOCK SETUP
// ════════════════════════════════════════════════

const stores = {
  waitlist: [],
  clients: [],
  services: [],
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
          resolve({ data: items[0] || null, error: null });
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

const { default: waitlistRoutes } = await import('../src/routes/adminWaitlist.js');
const { addToWaitlist, getWaitlist, notifyNextInLine, getStats } = await import('../src/services/waitlistService.js');

// ════════════════════════════════════════════════
// APP SETUP
// ════════════════════════════════════════════════

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/waitlist', waitlistRoutes);
  return app;
}

// ════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════

import request from 'supertest';

describe('Waitlist / Liste d\'attente', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    resetStores();
    stores.clients.push(
      { id: 1, tenant_id: 'test-tenant', nom: 'Dupont', prenom: 'Jean', email: 'jean@test.com', telephone: '+33612345678' },
      { id: 2, tenant_id: 'test-tenant', nom: 'Martin', prenom: 'Sophie', email: 'sophie@test.com', telephone: '+33687654321' },
      { id: 3, tenant_id: 'other-tenant', nom: 'Autre', prenom: 'Client', email: 'autre@test.com', telephone: '+33699999999' }
    );
  });

  // ── Service Tests ──

  describe('waitlistService', () => {
    test('addToWaitlist crée une entrée', async () => {
      const entry = await addToWaitlist('test-tenant', {
        client_id: 1, preferred_date: '2026-04-01', preferred_time_start: '10:00'
      });
      expect(entry).toBeDefined();
      expect(entry.status).toBe('waiting');
      expect(entry.tenant_id).toBe('test-tenant');
    });

    test('addToWaitlist exige tenant_id', async () => {
      await expect(addToWaitlist(null, { client_id: 1, preferred_date: '2026-04-01' })).rejects.toThrow('tenant_id');
    });

    test('addToWaitlist exige client_id et preferred_date', async () => {
      await expect(addToWaitlist('test-tenant', {})).rejects.toThrow('requis');
    });

    test('getWaitlist retourne les entrées du tenant', async () => {
      stores.waitlist.push(
        { id: 1, tenant_id: 'test-tenant', client_id: 1, preferred_date: '2026-04-01', status: 'waiting', priority: 0, created_at: new Date().toISOString() },
        { id: 2, tenant_id: 'other-tenant', client_id: 3, preferred_date: '2026-04-01', status: 'waiting', priority: 0, created_at: new Date().toISOString() }
      );
      const result = await getWaitlist('test-tenant');
      expect(result.waitlist.length).toBe(1);
      expect(result.waitlist[0].tenant_id).toBe('test-tenant');
    });

    test('getWaitlist filtre par status', async () => {
      stores.waitlist.push(
        { id: 1, tenant_id: 'test-tenant', client_id: 1, preferred_date: '2026-04-01', status: 'waiting', priority: 0, created_at: new Date().toISOString() },
        { id: 2, tenant_id: 'test-tenant', client_id: 2, preferred_date: '2026-04-02', status: 'notified', priority: 0, created_at: new Date().toISOString() }
      );
      const result = await getWaitlist('test-tenant', { status: 'waiting' });
      expect(result.waitlist.every(e => e.status === 'waiting')).toBe(true);
    });

    test('notifyNextInLine notifie le premier en attente', async () => {
      stores.waitlist.push(
        { id: 1, tenant_id: 'test-tenant', client_id: 1, preferred_date: '2026-04-01', status: 'waiting', priority: 0, created_at: '2026-03-01T10:00:00Z' },
        { id: 2, tenant_id: 'test-tenant', client_id: 2, preferred_date: '2026-04-01', status: 'waiting', priority: 1, created_at: '2026-03-02T10:00:00Z' }
      );
      const result = await notifyNextInLine('test-tenant', '2026-04-01', '10:00', '11:00');
      expect(result).not.toBeNull();
    });

    test('notifyNextInLine retourne null si pas d\'attente', async () => {
      const result = await notifyNextInLine('test-tenant', '2026-04-01', '10:00', '11:00');
      expect(result).toBeNull();
    });

    test('getStats retourne les comptages', async () => {
      stores.waitlist.push(
        { id: 1, tenant_id: 'test-tenant', status: 'waiting' },
        { id: 2, tenant_id: 'test-tenant', status: 'waiting' },
        { id: 3, tenant_id: 'test-tenant', status: 'notified' },
        { id: 4, tenant_id: 'test-tenant', status: 'converted' }
      );
      const stats = await getStats('test-tenant');
      expect(stats.waiting).toBe(2);
      expect(stats.notified).toBe(1);
      expect(stats.converted).toBe(1);
      expect(stats.total).toBe(4);
    });

    test('getStats isole par tenant', async () => {
      stores.waitlist.push(
        { id: 1, tenant_id: 'test-tenant', status: 'waiting' },
        { id: 2, tenant_id: 'other-tenant', status: 'waiting' }
      );
      const stats = await getStats('test-tenant');
      expect(stats.total).toBe(1);
    });
  });

  // ── Route Tests ──

  describe('Routes /api/admin/waitlist', () => {
    test('GET / retourne la liste', async () => {
      const res = await request(app).get('/api/admin/waitlist');
      expect(res.status).toBe(200);
      expect(res.body.waitlist).toBeDefined();
      expect(Array.isArray(res.body.waitlist)).toBe(true);
    });

    test('POST / crée une entrée', async () => {
      const res = await request(app)
        .post('/api/admin/waitlist')
        .send({ client_id: 1, preferred_date: '2026-04-15', preferred_time_start: '14:00' });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.entry).toBeDefined();
    });

    test('POST / refuse sans client_id', async () => {
      const res = await request(app)
        .post('/api/admin/waitlist')
        .send({ preferred_date: '2026-04-15' });
      expect(res.status).toBe(400);
    });

    test('GET /stats retourne les statistiques', async () => {
      const res = await request(app).get('/api/admin/waitlist/stats');
      expect(res.status).toBe(200);
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.total).toBeDefined();
    });

    test('DELETE /:id supprime une entrée', async () => {
      stores.waitlist.push({
        id: 99, tenant_id: 'test-tenant', client_id: 1,
        preferred_date: '2026-04-01', status: 'waiting', priority: 0,
        created_at: new Date().toISOString()
      });
      const res = await request(app).delete('/api/admin/waitlist/99');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('POST /:id/convert exige reservation_id', async () => {
      stores.waitlist.push({
        id: 88, tenant_id: 'test-tenant', client_id: 1,
        preferred_date: '2026-04-01', status: 'notified', priority: 0,
        created_at: new Date().toISOString()
      });
      const res = await request(app)
        .post('/api/admin/waitlist/88/convert')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('reservation_id');
    });
  });
});
