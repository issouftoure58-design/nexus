/**
 * Tests API Hotel
 * Routes: /api/admin/hotel (chambres, tarifs, occupation, stats, calcul-prix)
 * ~32 tests
 */

import { jest } from '@jest/globals';
import express from 'express';

// ════════════════════════════════════════════════
// MOCK SETUP
// ════════════════════════════════════════════════

const stores = {
  tenants: [],
  services: [],
  tarifs_saisonniers: [],
  chambres_occupation: [],
  reservations: [],
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
        const results = [];
        items.forEach(item => {
          const keys = (opts.onConflict || 'id').split(',');
          const idx = stores[table].findIndex(e =>
            keys.every(k => String(e[k.trim()]) === String(item[k.trim()]))
          );
          if (idx >= 0) {
            stores[table][idx] = { ...stores[table][idx], ...item };
            results.push(stores[table][idx]);
          } else {
            const newItem = { id: Math.floor(Math.random() * 100000), ...item };
            stores[table].push(newItem);
            results.push(newItem);
          }
        });
        data = results;
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

  const mockClient = { from: (table) => createBuilder(table) };
  return {
    supabase: mockClient,
    rawSupabase: mockClient,
    default: mockClient
  };
});

// Mock tenantBusinessService — requireHotel calls getBusinessInfo()
jest.unstable_mockModule('../src/services/tenantBusinessService.js', () => ({
  getBusinessInfo: async (tenantId) => {
    const tenant = stores.tenants.find(t => t.id === tenantId);
    if (!tenant) return null;
    return { id: tenantId, businessType: tenant.business_type, nom: tenantId };
  },
  getBusinessInfoSync: (tenantId) => {
    const tenant = stores.tenants.find(t => t.id === tenantId);
    return tenant ? { type: tenant.business_type } : null;
  },
  getAIContext: jest.fn(),
  getTerminology: jest.fn(),
  hasFeature: jest.fn()
}));

// Mock adminAuth
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

// Mock security modules for adminAuth dependency chain
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

const TENANT_HOTEL = 'tenant_hotel_001';
const TENANT_HOTEL_2 = 'tenant_hotel_002';
const TENANT_SALON = 'tenant_salon_001';

const seedHotelTenant = (tenantId) => {
  stores.tenants.push({ id: tenantId, business_type: 'hotel' });
};

const seedSalonTenant = (tenantId) => {
  stores.tenants.push({ id: tenantId, business_type: 'salon' });
};

const seedChambre = (tenantId, overrides = {}) => {
  const chambre = {
    id: Math.floor(Math.random() * 100000),
    tenant_id: tenantId,
    nom: 'Chambre 101',
    type_chambre: 'double',
    capacite: 2,
    prix: 120,
    actif: true,
    ...overrides
  };
  stores.services.push(chambre);
  return chambre;
};

const seedTarif = (tenantId, serviceId, overrides = {}) => {
  const tarif = {
    id: Math.floor(Math.random() * 100000),
    tenant_id: tenantId,
    service_id: serviceId,
    nom: 'Haute saison',
    date_debut: '2026-06-01',
    date_fin: '2026-08-31',
    prix_nuit: 180,
    prix_weekend: 220,
    actif: true,
    ...overrides
  };
  stores.tarifs_saisonniers.push(tarif);
  return tarif;
};

const createTestApp = async () => {
  const app = express();
  app.use(express.json());
  const hotelRoutes = (await import('../src/routes/adminHotel.js')).default;
  app.use('/api/admin/hotel', hotelRoutes);
  return app;
};

const authHeader = (tenantId) => ({ 'x-test-tenant-id': tenantId });

// ════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════

describe('Admin Hotel API', () => {
  let app;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(() => {
    resetStores();
    seedHotelTenant(TENANT_HOTEL);
    seedHotelTenant(TENANT_HOTEL_2);
  });

  // ═══════════════════════════════════════════
  // requireHotel MIDDLEWARE
  // ═══════════════════════════════════════════

  describe('requireHotel middleware', () => {
    test('accepte un tenant hotel', async () => {
      const res = await request(app)
        .get('/api/admin/hotel/chambres')
        .set(authHeader(TENANT_HOTEL))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    test('rejette un tenant non-hotel (403)', async () => {
      seedSalonTenant(TENANT_SALON);
      const res = await request(app)
        .get('/api/admin/hotel/chambres')
        .set(authHeader(TENANT_SALON))
        .expect(403);

      expect(res.body.error).toMatch(/réservée aux hôtels/i);
    });

    test('rejette sans authentification (401)', async () => {
      await request(app)
        .get('/api/admin/hotel/chambres')
        .expect(401);
    });
  });

  // ═══════════════════════════════════════════
  // CHAMBRES
  // ═══════════════════════════════════════════

  describe('GET /chambres', () => {
    test('retourne les chambres (services avec type_chambre)', async () => {
      seedChambre(TENANT_HOTEL, { nom: 'Suite 201', type_chambre: 'suite' });
      seedChambre(TENANT_HOTEL, { nom: 'Double 101', type_chambre: 'double' });
      // Service sans type_chambre (pas une chambre)
      stores.services.push({ id: 999, tenant_id: TENANT_HOTEL, nom: 'Spa', type_chambre: null });

      const res = await request(app)
        .get('/api/admin/hotel/chambres')
        .set(authHeader(TENANT_HOTEL))
        .expect(200);

      expect(res.body).toHaveLength(2);
    });

    test('filtre par tenant', async () => {
      seedChambre(TENANT_HOTEL, { nom: 'Ma chambre' });
      seedChambre(TENANT_HOTEL_2, { nom: 'Autre hôtel' });

      const res = await request(app)
        .get('/api/admin/hotel/chambres')
        .set(authHeader(TENANT_HOTEL))
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].nom).toBe('Ma chambre');
    });

    test('retourne vide si aucune chambre', async () => {
      const res = await request(app)
        .get('/api/admin/hotel/chambres')
        .set(authHeader(TENANT_HOTEL))
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('GET /chambres/:id', () => {
    test('retourne la chambre avec tarifs', async () => {
      const chambre = seedChambre(TENANT_HOTEL, { id: 100, nom: 'Suite Royale' });
      seedTarif(TENANT_HOTEL, 100, { nom: 'Été 2026' });

      const res = await request(app)
        .get('/api/admin/hotel/chambres/100')
        .set(authHeader(TENANT_HOTEL))
        .expect(200);

      expect(res.body.nom).toBe('Suite Royale');
      expect(res.body.tarifs).toBeDefined();
      expect(res.body.tarifs).toHaveLength(1);
    });

    test('retourne 404 si chambre inexistante', async () => {
      await request(app)
        .get('/api/admin/hotel/chambres/99999')
        .set(authHeader(TENANT_HOTEL))
        .expect(404);
    });
  });

  // ═══════════════════════════════════════════
  // TARIFS SAISONNIERS
  // ═══════════════════════════════════════════

  describe('GET /tarifs', () => {
    test('retourne tous les tarifs du tenant', async () => {
      const chambre = seedChambre(TENANT_HOTEL, { id: 200 });
      seedTarif(TENANT_HOTEL, 200, { nom: 'Été' });
      seedTarif(TENANT_HOTEL, 200, { nom: 'Hiver' });

      const res = await request(app)
        .get('/api/admin/hotel/tarifs')
        .set(authHeader(TENANT_HOTEL))
        .expect(200);

      expect(res.body).toHaveLength(2);
    });

    test('filtre par chambre_id', async () => {
      seedChambre(TENANT_HOTEL, { id: 300 });
      seedChambre(TENANT_HOTEL, { id: 301 });
      seedTarif(TENANT_HOTEL, 300, { nom: 'Tarif A' });
      seedTarif(TENANT_HOTEL, 301, { nom: 'Tarif B' });

      const res = await request(app)
        .get('/api/admin/hotel/tarifs?chambre_id=300')
        .set(authHeader(TENANT_HOTEL))
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].nom).toBe('Tarif A');
    });
  });

  describe('POST /tarifs', () => {
    test('crée un tarif saisonnier', async () => {
      seedChambre(TENANT_HOTEL, { id: 400 });

      const res = await request(app)
        .post('/api/admin/hotel/tarifs')
        .set(authHeader(TENANT_HOTEL))
        .send({
          service_id: 400,
          nom: 'Printemps',
          date_debut: '2026-03-01',
          date_fin: '2026-05-31',
          prix_nuit: 150,
          prix_weekend: 180
        })
        .expect(201);

      expect(res.body.nom).toBe('Printemps');
      expect(res.body.prix_nuit).toBe(150);
      expect(res.body.tenant_id).toBe(TENANT_HOTEL);
    });

    test('rejette sans champs requis (400)', async () => {
      await request(app)
        .post('/api/admin/hotel/tarifs')
        .set(authHeader(TENANT_HOTEL))
        .send({ nom: 'Incomplet' })
        .expect(400);
    });

    test('rejette si chambre inexistante (404)', async () => {
      await request(app)
        .post('/api/admin/hotel/tarifs')
        .set(authHeader(TENANT_HOTEL))
        .send({
          service_id: 99999,
          nom: 'Fantôme',
          date_debut: '2026-01-01',
          date_fin: '2026-12-31',
          prix_nuit: 100
        })
        .expect(404);
    });
  });

  describe('PUT /tarifs/:id', () => {
    test('met à jour un tarif', async () => {
      seedChambre(TENANT_HOTEL, { id: 500 });
      const tarif = seedTarif(TENANT_HOTEL, 500, { id: 600, nom: 'Ancien nom' });

      const res = await request(app)
        .put('/api/admin/hotel/tarifs/600')
        .set(authHeader(TENANT_HOTEL))
        .send({ nom: 'Nouveau nom', prix_nuit: 200 })
        .expect(200);

      expect(res.body.nom).toBe('Nouveau nom');
      expect(res.body.prix_nuit).toBe(200);
    });

    test('retourne 404 si tarif inexistant', async () => {
      await request(app)
        .put('/api/admin/hotel/tarifs/99999')
        .set(authHeader(TENANT_HOTEL))
        .send({ nom: 'Fantôme' })
        .expect(404);
    });
  });

  describe('DELETE /tarifs/:id', () => {
    test('supprime un tarif', async () => {
      seedTarif(TENANT_HOTEL, 100, { id: 700 });

      await request(app)
        .delete('/api/admin/hotel/tarifs/700')
        .set(authHeader(TENANT_HOTEL))
        .expect(200);

      expect(stores.tarifs_saisonniers.filter(t => t.id === 700)).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // OCCUPATION
  // ═══════════════════════════════════════════

  describe('GET /occupation', () => {
    test('retourne le calendrier mensuel', async () => {
      seedChambre(TENANT_HOTEL, { id: 800, nom: 'Chambre 1', type_chambre: 'double' });

      const res = await request(app)
        .get('/api/admin/hotel/occupation')
        .set(authHeader(TENANT_HOTEL))
        .expect(200);

      expect(res.body.date_debut).toBeDefined();
      expect(res.body.date_fin).toBeDefined();
      expect(res.body.chambres).toBeDefined();
    });

    test('filtre par chambre', async () => {
      seedChambre(TENANT_HOTEL, { id: 810, nom: 'Ch 1', type_chambre: 'double' });
      seedChambre(TENANT_HOTEL, { id: 811, nom: 'Ch 2', type_chambre: 'single' });

      const res = await request(app)
        .get('/api/admin/hotel/occupation?chambre_id=810')
        .set(authHeader(TENANT_HOTEL))
        .expect(200);

      expect(res.body.chambres).toHaveLength(1);
      expect(res.body.chambres[0].nom).toBe('Ch 1');
    });
  });

  describe('POST /occupation', () => {
    test('crée une occupation maintenance', async () => {
      seedChambre(TENANT_HOTEL, { id: 900 });
      stores.services.find(s => s.id === 900); // ensure it's there

      const res = await request(app)
        .post('/api/admin/hotel/occupation')
        .set(authHeader(TENANT_HOTEL))
        .send({
          service_id: 900,
          dates: ['2026-03-15', '2026-03-16'],
          statut: 'maintenance',
          notes: 'Rénovation salle de bain'
        })
        .expect(201);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });

    test('rejette un statut invalide (400)', async () => {
      seedChambre(TENANT_HOTEL, { id: 901 });

      await request(app)
        .post('/api/admin/hotel/occupation')
        .set(authHeader(TENANT_HOTEL))
        .send({
          service_id: 901,
          dates: ['2026-03-15'],
          statut: 'reservee' // invalide — seuls maintenance/bloquee acceptés
        })
        .expect(400);
    });

    test('rejette sans service_id ou dates (400)', async () => {
      await request(app)
        .post('/api/admin/hotel/occupation')
        .set(authHeader(TENANT_HOTEL))
        .send({ statut: 'maintenance' })
        .expect(400);
    });

    test('rejette si chambre n\'appartient pas au tenant (404)', async () => {
      seedChambre(TENANT_HOTEL_2, { id: 902 });

      await request(app)
        .post('/api/admin/hotel/occupation')
        .set(authHeader(TENANT_HOTEL))
        .send({
          service_id: 902,
          dates: ['2026-03-15'],
          statut: 'maintenance'
        })
        .expect(404);
    });
  });

  describe('DELETE /occupation', () => {
    test('supprime une occupation maintenance', async () => {
      stores.chambres_occupation.push({
        id: 1, tenant_id: TENANT_HOTEL, service_id: 100,
        date_occupation: '2026-03-15', statut: 'maintenance'
      });

      await request(app)
        .delete('/api/admin/hotel/occupation')
        .set(authHeader(TENANT_HOTEL))
        .send({ service_id: 100, dates: ['2026-03-15'] })
        .expect(200);
    });

    test('ne supprime pas les occupations réservées', async () => {
      stores.chambres_occupation.push({
        id: 2, tenant_id: TENANT_HOTEL, service_id: 100,
        date_occupation: '2026-03-20', statut: 'reservee'
      });

      await request(app)
        .delete('/api/admin/hotel/occupation')
        .set(authHeader(TENANT_HOTEL))
        .send({ service_id: 100, dates: ['2026-03-20'] })
        .expect(200);

      // La réservée ne doit pas être supprimée (filtré par in statut maintenance/bloquee)
      expect(stores.chambres_occupation.filter(o => o.statut === 'reservee')).toHaveLength(1);
    });

    test('rejette sans paramètres (400)', async () => {
      await request(app)
        .delete('/api/admin/hotel/occupation')
        .set(authHeader(TENANT_HOTEL))
        .send({})
        .expect(400);
    });
  });

  // ═══════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════

  describe('GET /stats', () => {
    test('retourne les statistiques hotel', async () => {
      seedChambre(TENANT_HOTEL, { type_chambre: 'double' });
      seedChambre(TENANT_HOTEL, { type_chambre: 'suite' });

      const res = await request(app)
        .get('/api/admin/hotel/stats')
        .set(authHeader(TENANT_HOTEL))
        .expect(200);

      expect(res.body.nb_chambres).toBe(2);
      expect(res.body).toHaveProperty('reservations_mois');
      expect(res.body).toHaveProperty('taux_occupation');
    });

    test('retourne 0 pour un hôtel sans chambres', async () => {
      const res = await request(app)
        .get('/api/admin/hotel/stats')
        .set(authHeader(TENANT_HOTEL))
        .expect(200);

      expect(res.body.nb_chambres).toBe(0);
      expect(res.body.taux_occupation).toBe(0);
    });
  });

  // ═══════════════════════════════════════════
  // CALCUL PRIX
  // ═══════════════════════════════════════════

  describe('POST /calcul-prix', () => {
    test('calcule le prix avec tarif saisonnier', async () => {
      seedChambre(TENANT_HOTEL, { id: 1000, prix: 100 });
      seedTarif(TENANT_HOTEL, 1000, {
        date_debut: '2026-07-01',
        date_fin: '2026-08-31',
        prix_nuit: 180,
        prix_weekend: 220,
        actif: true
      });

      const res = await request(app)
        .post('/api/admin/hotel/calcul-prix')
        .set(authHeader(TENANT_HOTEL))
        .send({
          service_id: 1000,
          date_debut: '2026-07-10',
          date_fin: '2026-07-13'
        })
        .expect(200);

      expect(res.body.nb_nuits).toBe(3);
      expect(res.body.prix_total).toBeGreaterThan(0);
      expect(res.body.details).toHaveLength(3);
    });

    test('fallback sur prix de base sans tarif saisonnier', async () => {
      seedChambre(TENANT_HOTEL, { id: 1001, prix: 100 });

      const res = await request(app)
        .post('/api/admin/hotel/calcul-prix')
        .set(authHeader(TENANT_HOTEL))
        .send({
          service_id: 1001,
          date_debut: '2026-01-10',
          date_fin: '2026-01-12'
        })
        .expect(200);

      expect(res.body.nb_nuits).toBe(2);
      expect(res.body.prix_total).toBe(200); // 2 * 100€
    });

    test('rejette sans champs requis (400)', async () => {
      await request(app)
        .post('/api/admin/hotel/calcul-prix')
        .set(authHeader(TENANT_HOTEL))
        .send({ service_id: 1000 })
        .expect(400);
    });

    test('retourne 404 si chambre inexistante', async () => {
      await request(app)
        .post('/api/admin/hotel/calcul-prix')
        .set(authHeader(TENANT_HOTEL))
        .send({
          service_id: 99999,
          date_debut: '2026-07-01',
          date_fin: '2026-07-03'
        })
        .expect(404);
    });
  });

  // ═══════════════════════════════════════════
  // TENANT ISOLATION
  // ═══════════════════════════════════════════

  describe('Tenant Isolation', () => {
    test('un hôtel ne voit pas les chambres d\'un autre', async () => {
      seedChambre(TENANT_HOTEL, { nom: 'Ma chambre', type_chambre: 'double' });
      seedChambre(TENANT_HOTEL_2, { nom: 'Autre hôtel', type_chambre: 'suite' });

      const res = await request(app)
        .get('/api/admin/hotel/chambres')
        .set(authHeader(TENANT_HOTEL))
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].nom).toBe('Ma chambre');
    });

    test('un hôtel ne voit pas les tarifs d\'un autre', async () => {
      seedChambre(TENANT_HOTEL, { id: 1100 });
      seedChambre(TENANT_HOTEL_2, { id: 1101 });
      seedTarif(TENANT_HOTEL, 1100, { nom: 'Mon tarif' });
      seedTarif(TENANT_HOTEL_2, 1101, { nom: 'Autre tarif' });

      const res = await request(app)
        .get('/api/admin/hotel/tarifs')
        .set(authHeader(TENANT_HOTEL))
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].nom).toBe('Mon tarif');
    });

    test('requireHotel gate bloque salon', async () => {
      seedSalonTenant(TENANT_SALON);

      const res = await request(app)
        .get('/api/admin/hotel/stats')
        .set(authHeader(TENANT_SALON))
        .expect(403);

      expect(res.body.error).toMatch(/réservée aux hôtels/i);
    });
  });
});
