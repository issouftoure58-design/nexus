/**
 * Tests API Menu Restaurant
 * Routes: /api/admin/menu (categories, plats, du-jour, stats)
 * ~27 tests
 */

import { jest } from '@jest/globals';
import express from 'express';

// ════════════════════════════════════════════════
// MOCK SETUP
// ════════════════════════════════════════════════

const stores = {
  menu_categories: [],
  plats: [],
  menu_du_jour: [],
  admin_users: []
};

const resetStores = () => {
  Object.keys(stores).forEach(k => { stores[k] = []; });
};

// Cache business info par tenant
const businessInfoCache = {};

function setBusinessInfo(tenantId, type) {
  businessInfoCache[tenantId] = { type };
}

// Mock tenantBusinessService
jest.unstable_mockModule('../src/services/tenantBusinessService.js', () => ({
  getBusinessInfoSync: (tenantId) => businessInfoCache[tenantId] || null,
  getAIContext: jest.fn(),
  getTerminology: jest.fn(),
  hasFeature: jest.fn()
}));

// Mock Supabase
jest.unstable_mockModule('../src/config/supabase.js', () => {
  function createBuilder(table) {
    let data = [...(stores[table] || [])];
    let filters = [];
    let singleMode = false;
    let countMode = false;
    let headMode = false;
    let pendingUpdate = null;
    let pendingDelete = false;
    let pendingInsert = null;

    function applyFilters(arr) {
      return arr.filter(item => filters.every(f => f(item)));
    }

    const builder = {
      select: (fields, options = {}) => {
        if (options.count === 'exact') countMode = true;
        if (options.head) headMode = true;
        return builder;
      },
      insert: (newData) => {
        const items = Array.isArray(newData) ? newData : [newData];
        const inserted = items.map(item => ({
          id: item.id || Math.floor(Math.random() * 100000),
          ...item,
          created_at: new Date().toISOString()
        }));
        stores[table].push(...inserted);
        data = inserted;
        pendingInsert = inserted;
        return builder;
      },
      update: (updates) => {
        pendingUpdate = updates;
        return builder;
      },
      upsert: (newData, opts = {}) => {
        const items = Array.isArray(newData) ? newData : [newData];
        items.forEach(item => {
          const keys = (opts.onConflict || 'id').split(',');
          const idx = stores[table].findIndex(e =>
            keys.every(k => String(e[k.trim()]) === String(item[k.trim()]))
          );
          if (idx >= 0) {
            stores[table][idx] = { ...stores[table][idx], ...item };
            data = [stores[table][idx]];
          } else {
            const newItem = { id: Math.floor(Math.random() * 100000), ...item };
            stores[table].push(newItem);
            data = [newItem];
          }
        });
        return builder;
      },
      delete: () => {
        pendingDelete = true;
        return builder;
      },
      eq: (field, value) => {
        filters.push(item => String(item[field]) === String(value));
        if (!pendingUpdate && !pendingDelete) {
          data = data.filter(item => String(item[field]) === String(value));
        }
        return builder;
      },
      neq: (field, value) => {
        filters.push(item => item[field] !== value);
        if (!pendingUpdate && !pendingDelete) {
          data = data.filter(item => item[field] !== value);
        }
        return builder;
      },
      in: (field, values) => {
        const strValues = values.map(v => String(v));
        filters.push(item => strValues.includes(String(item[field])));
        if (!pendingUpdate && !pendingDelete) {
          data = data.filter(item => strValues.includes(String(item[field])));
        }
        return builder;
      },
      not: (field, operator, value) => {
        if (operator === 'is' && value === null) {
          filters.push(item => item[field] != null);
          if (!pendingUpdate && !pendingDelete) {
            data = data.filter(item => item[field] != null);
          }
        }
        return builder;
      },
      gte: (field, value) => {
        filters.push(item => item[field] >= value);
        if (!pendingUpdate && !pendingDelete) {
          data = data.filter(item => item[field] >= value);
        }
        return builder;
      },
      lte: (field, value) => {
        filters.push(item => item[field] <= value);
        if (!pendingUpdate && !pendingDelete) {
          data = data.filter(item => item[field] <= value);
        }
        return builder;
      },
      lt: (field, value) => {
        filters.push(item => item[field] < value);
        if (!pendingUpdate && !pendingDelete) {
          data = data.filter(item => item[field] < value);
        }
        return builder;
      },
      order: (field, options = {}) => {
        data.sort((a, b) => {
          if (options.ascending !== false) return a[field] > b[field] ? 1 : -1;
          return a[field] < b[field] ? 1 : -1;
        });
        return builder;
      },
      single: () => { singleMode = true; return builder; },
      then: (resolve) => {
        // Execute pending operations with accumulated filters
        if (pendingUpdate) {
          stores[table] = stores[table].map(item => {
            if (filters.every(f => f(item))) {
              return { ...item, ...pendingUpdate };
            }
            return item;
          });
          data = applyFilters(stores[table]);
        }
        if (pendingDelete) {
          stores[table] = stores[table].filter(item => !filters.every(f => f(item)));
          data = [];
        }

        if (countMode && headMode) {
          const count = applyFilters([...(stores[table] || [])]).length;
          resolve({ data: null, error: null, count });
        } else if (singleMode) {
          const finalData = pendingInsert ? pendingInsert : data;
          resolve({
            data: finalData[0] || null,
            error: finalData.length === 0 ? { code: 'PGRST116', message: 'Not found' } : null
          });
        } else {
          resolve({ data, error: null });
        }
      }
    };
    return builder;
  }

  return {
    supabase: { from: (table) => createBuilder(table) }
  };
});

// Mock adminAuth — authenticateAdmin
jest.unstable_mockModule('../src/routes/adminAuth.js', () => ({
  authenticateAdmin: (req, res, next) => {
    const tenantId = req.headers['x-test-tenant-id'];
    if (!tenantId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    req.admin = {
      id: 'admin_test',
      tenant_id: tenantId,
      email: 'admin@test.com',
      role: 'admin'
    };
    next();
  },
  default: null
}));

// Mock logger
jest.unstable_mockModule('../src/config/logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }
}));

// Mock security modules
jest.unstable_mockModule('../src/sentinel/security/accountService.js', () => ({
  verifyLogin: jest.fn(),
  changePassword: jest.fn()
}));
jest.unstable_mockModule('../src/sentinel/security/passwordPolicy.js', () => ({
  POLICY: {},
  validatePasswordStrength: jest.fn()
}));
jest.unstable_mockModule('../src/middleware/rateLimiter.js', () => ({
  loginLimiter: (req, res, next) => next()
}));
jest.unstable_mockModule('../src/services/totpService.js', () => ({
  totpService: {}
}));
jest.unstable_mockModule('../src/services/sessionService.js', () => ({
  createSession: jest.fn(),
  validateSession: jest.fn().mockResolvedValue(true),
  listSessions: jest.fn(),
  revokeSession: jest.fn(),
  revokeAllSessions: jest.fn(),
  hashToken: jest.fn()
}));

const { default: request } = await import('supertest');

// ════════════════════════════════════════════════
// TEST HELPERS
// ════════════════════════════════════════════════

const TENANT_RESTO = 'tenant_resto_001';
const TENANT_HOTEL = 'tenant_hotel_001';
const TENANT_OTHER = 'tenant_other_002';

const createTestApp = async () => {
  const app = express();
  app.use(express.json());
  const menuRoutes = (await import('../src/routes/adminMenu.js')).default;
  app.use('/api/admin/menu', menuRoutes);
  return app;
};

const authHeader = (tenantId) => ({ 'x-test-tenant-id': tenantId });

// ════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════

describe('Admin Menu API', () => {
  let app;

  beforeAll(async () => {
    setBusinessInfo(TENANT_RESTO, 'restaurant');
    setBusinessInfo(TENANT_HOTEL, 'hotel');
    app = await createTestApp();
  });

  beforeEach(() => {
    resetStores();
  });

  // ═══════════════════════════════════════════
  // requireRestaurant MIDDLEWARE
  // ═══════════════════════════════════════════

  describe('requireRestaurant middleware', () => {
    test('rejette un tenant non-restaurant (403)', async () => {
      const res = await request(app)
        .get('/api/admin/menu/categories')
        .set(authHeader(TENANT_HOTEL))
        .expect(403);

      expect(res.body.error).toMatch(/réservée aux restaurants/i);
    });

    test('accepte un tenant restaurant', async () => {
      const res = await request(app)
        .get('/api/admin/menu/categories')
        .set(authHeader(TENANT_RESTO))
        .expect(200);

      expect(res.body.categories).toBeDefined();
    });

    test('rejette sans authentification (401)', async () => {
      await request(app)
        .get('/api/admin/menu/categories')
        .expect(401);
    });
  });

  // ═══════════════════════════════════════════
  // CATÉGORIES
  // ═══════════════════════════════════════════

  describe('GET /categories', () => {
    test('retourne un tableau vide quand aucune catégorie', async () => {
      const res = await request(app)
        .get('/api/admin/menu/categories')
        .set(authHeader(TENANT_RESTO))
        .expect(200);

      expect(res.body.categories).toEqual([]);
    });

    test('retourne les catégories du tenant', async () => {
      stores.menu_categories.push(
        { id: 1, tenant_id: TENANT_RESTO, nom: 'Entrées', ordre: 1, actif: true },
        { id: 2, tenant_id: TENANT_RESTO, nom: 'Plats', ordre: 2, actif: true }
      );

      const res = await request(app)
        .get('/api/admin/menu/categories')
        .set(authHeader(TENANT_RESTO))
        .expect(200);

      expect(res.body.categories).toHaveLength(2);
      expect(res.body.categories[0].nom).toBe('Entrées');
    });

    test('tri par ordre croissant', async () => {
      stores.menu_categories.push(
        { id: 1, tenant_id: TENANT_RESTO, nom: 'Desserts', ordre: 3 },
        { id: 2, tenant_id: TENANT_RESTO, nom: 'Entrées', ordre: 1 },
        { id: 3, tenant_id: TENANT_RESTO, nom: 'Plats', ordre: 2 }
      );

      const res = await request(app)
        .get('/api/admin/menu/categories')
        .set(authHeader(TENANT_RESTO))
        .expect(200);

      expect(res.body.categories[0].nom).toBe('Entrées');
      expect(res.body.categories[2].nom).toBe('Desserts');
    });
  });

  describe('POST /categories', () => {
    test('crée une catégorie avec nom', async () => {
      const res = await request(app)
        .post('/api/admin/menu/categories')
        .set(authHeader(TENANT_RESTO))
        .send({ nom: 'Entrées', description: 'Nos entrées', ordre: 1 })
        .expect(201);

      expect(res.body.nom).toBe('Entrées');
      expect(res.body.tenant_id).toBe(TENANT_RESTO);
    });

    test('rejette sans nom (400)', async () => {
      await request(app)
        .post('/api/admin/menu/categories')
        .set(authHeader(TENANT_RESTO))
        .send({ description: 'Sans nom' })
        .expect(400);
    });

    test('injecte le tenant_id automatiquement', async () => {
      const res = await request(app)
        .post('/api/admin/menu/categories')
        .set(authHeader(TENANT_RESTO))
        .send({ nom: 'Plats' })
        .expect(201);

      expect(res.body.tenant_id).toBe(TENANT_RESTO);
    });
  });

  describe('PUT /categories/:id', () => {
    test('met à jour une catégorie existante', async () => {
      stores.menu_categories.push({ id: 10, tenant_id: TENANT_RESTO, nom: 'Entrées', ordre: 1 });

      const res = await request(app)
        .put('/api/admin/menu/categories/10')
        .set(authHeader(TENANT_RESTO))
        .send({ nom: 'Starters' })
        .expect(200);

      expect(res.body.nom).toBe('Starters');
    });
  });

  describe('DELETE /categories/:id', () => {
    test('supprime une catégorie', async () => {
      stores.menu_categories.push({ id: 20, tenant_id: TENANT_RESTO, nom: 'À supprimer' });

      await request(app)
        .delete('/api/admin/menu/categories/20')
        .set(authHeader(TENANT_RESTO))
        .expect(200);

      expect(stores.menu_categories).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // PLATS
  // ═══════════════════════════════════════════

  describe('GET /plats', () => {
    test('retourne les plats avec join catégorie', async () => {
      stores.plats.push({
        id: 1,
        tenant_id: TENANT_RESTO,
        nom: 'Salade César',
        categorie_id: 1,
        menu_categories: { id: 1, nom: 'Entrées' },
        ordre: 1,
        actif: true
      });

      const res = await request(app)
        .get('/api/admin/menu/plats')
        .set(authHeader(TENANT_RESTO))
        .expect(200);

      expect(res.body.plats).toHaveLength(1);
      expect(res.body.plats[0].nom).toBe('Salade César');
    });

    test('retourne vide si aucun plat', async () => {
      const res = await request(app)
        .get('/api/admin/menu/plats')
        .set(authHeader(TENANT_RESTO))
        .expect(200);

      expect(res.body.plats).toEqual([]);
    });
  });

  describe('POST /plats', () => {
    test('crée un plat avec tous les champs', async () => {
      const res = await request(app)
        .post('/api/admin/menu/plats')
        .set(authHeader(TENANT_RESTO))
        .send({
          nom: 'Steak Frites',
          description: 'Bœuf Angus, frites maison',
          prix: 22.50,
          categorie_id: 1,
          allergenes: ['gluten'],
          regime: [],
          disponible_midi: true,
          disponible_soir: true
        })
        .expect(201);

      expect(res.body.nom).toBe('Steak Frites');
      expect(res.body.prix).toBe(22.50);
      expect(res.body.tenant_id).toBe(TENANT_RESTO);
    });

    test('rejette sans nom (400)', async () => {
      await request(app)
        .post('/api/admin/menu/plats')
        .set(authHeader(TENANT_RESTO))
        .send({ prix: 10 })
        .expect(400);
    });

    test('allergènes et régime sont des arrays', async () => {
      const res = await request(app)
        .post('/api/admin/menu/plats')
        .set(authHeader(TENANT_RESTO))
        .send({ nom: 'Vegan Bowl', allergenes: ['soja', 'sesame'], regime: ['vegan'] })
        .expect(201);

      expect(res.body.allergenes).toEqual(['soja', 'sesame']);
      expect(res.body.regime).toEqual(['vegan']);
    });
  });

  describe('PUT /plats/:id', () => {
    test('met à jour un plat', async () => {
      stores.plats.push({
        id: 30,
        tenant_id: TENANT_RESTO,
        nom: 'Ancien nom',
        prix: 10,
        actif: true
      });

      const res = await request(app)
        .put('/api/admin/menu/plats/30')
        .set(authHeader(TENANT_RESTO))
        .send({ nom: 'Nouveau nom', prix: 15 })
        .expect(200);

      expect(res.body.nom).toBe('Nouveau nom');
      expect(res.body.prix).toBe(15);
    });
  });

  describe('DELETE /plats/:id', () => {
    test('supprime un plat', async () => {
      stores.plats.push({ id: 40, tenant_id: TENANT_RESTO, nom: 'À supprimer' });

      await request(app)
        .delete('/api/admin/menu/plats/40')
        .set(authHeader(TENANT_RESTO))
        .expect(200);

      expect(stores.plats.filter(p => p.id === 40)).toHaveLength(0);
    });
  });

  describe('PATCH /plats/:id/plat-du-jour', () => {
    test('toggle plat du jour', async () => {
      stores.plats.push({
        id: 50,
        tenant_id: TENANT_RESTO,
        nom: 'Plat test',
        plat_du_jour: false
      });

      const res = await request(app)
        .patch('/api/admin/menu/plats/50/plat-du-jour')
        .set(authHeader(TENANT_RESTO))
        .send({ plat_du_jour: true })
        .expect(200);

      expect(res.body.plat_du_jour).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // MENU DU JOUR
  // ═══════════════════════════════════════════

  describe('GET /du-jour', () => {
    test('retourne null si pas de menu du jour', async () => {
      const res = await request(app)
        .get('/api/admin/menu/du-jour')
        .set(authHeader(TENANT_RESTO))
        .expect(200);

      expect(res.body.menu).toBeNull();
    });

    test('retourne le menu du jour par date', async () => {
      const today = new Date().toISOString().split('T')[0];
      stores.menu_du_jour.push({
        id: 1,
        tenant_id: TENANT_RESTO,
        date: today,
        service: 'midi_soir',
        formule_complete: 24,
        entrees: [],
        plats: [],
        desserts: []
      });

      const res = await request(app)
        .get(`/api/admin/menu/du-jour?date=${today}`)
        .set(authHeader(TENANT_RESTO))
        .expect(200);

      expect(res.body.menu).toBeDefined();
      expect(res.body.menu.formule_complete).toBe(24);
    });
  });

  describe('POST /du-jour', () => {
    test('crée un menu du jour avec formules', async () => {
      const res = await request(app)
        .post('/api/admin/menu/du-jour')
        .set(authHeader(TENANT_RESTO))
        .send({
          date: '2026-03-10',
          service: 'midi',
          formule_entree_plat: 18,
          formule_plat_dessert: 18,
          formule_complete: 24,
          entrees: [1, 2],
          plats: [3, 4],
          desserts: [5]
        })
        .expect(200);

      expect(res.body.formule_complete).toBe(24);
      expect(res.body.tenant_id).toBe(TENANT_RESTO);
    });
  });

  // ═══════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════

  describe('GET /stats', () => {
    test('retourne les compteurs', async () => {
      stores.plats.push(
        { id: 1, tenant_id: TENANT_RESTO, actif: true, plat_du_jour: false },
        { id: 2, tenant_id: TENANT_RESTO, actif: true, plat_du_jour: true }
      );
      stores.menu_categories.push(
        { id: 1, tenant_id: TENANT_RESTO, actif: true }
      );

      const res = await request(app)
        .get('/api/admin/menu/stats')
        .set(authHeader(TENANT_RESTO))
        .expect(200);

      expect(res.body.total_plats).toBe(2);
      expect(res.body.total_categories).toBe(1);
      expect(res.body.plats_du_jour).toBe(1);
    });

    test('retourne 0 pour un tenant vide', async () => {
      const res = await request(app)
        .get('/api/admin/menu/stats')
        .set(authHeader(TENANT_RESTO))
        .expect(200);

      expect(res.body.total_plats).toBe(0);
      expect(res.body.total_categories).toBe(0);
      expect(res.body.plats_du_jour).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // TENANT ISOLATION
  // ═══════════════════════════════════════════

  describe('Tenant Isolation', () => {
    test('un tenant ne voit pas les catégories d\'un autre', async () => {
      setBusinessInfo(TENANT_OTHER, 'restaurant');
      stores.menu_categories.push(
        { id: 1, tenant_id: TENANT_RESTO, nom: 'Entrées Resto 1' },
        { id: 2, tenant_id: TENANT_OTHER, nom: 'Entrées Resto 2' }
      );

      const res = await request(app)
        .get('/api/admin/menu/categories')
        .set(authHeader(TENANT_RESTO))
        .expect(200);

      expect(res.body.categories).toHaveLength(1);
      expect(res.body.categories[0].nom).toBe('Entrées Resto 1');
    });

    test('un tenant ne voit pas les plats d\'un autre', async () => {
      setBusinessInfo(TENANT_OTHER, 'restaurant');
      stores.plats.push(
        { id: 1, tenant_id: TENANT_RESTO, nom: 'Mon plat', categorie_id: 1, ordre: 1 },
        { id: 2, tenant_id: TENANT_OTHER, nom: 'Autre plat', categorie_id: 1, ordre: 1 }
      );

      const res = await request(app)
        .get('/api/admin/menu/plats')
        .set(authHeader(TENANT_RESTO))
        .expect(200);

      expect(res.body.plats).toHaveLength(1);
      expect(res.body.plats[0].nom).toBe('Mon plat');
    });
  });
});
