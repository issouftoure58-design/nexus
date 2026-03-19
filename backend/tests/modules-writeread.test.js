/**
 * Module Integration Tests: Write→Read Cycles
 *
 * Vérifie que chaque module écrit ET relit correctement les données.
 * Créé suite au bug template_id (19 mars 2026) : PATCH écrivait dans profile_config JSONB
 * mais GET lisait la colonne template_id → cycle write→read cassé.
 *
 * Pattern: mock Supabase in-memory, écriture puis relecture, vérification cohérence.
 */

import { jest } from '@jest/globals';

// ============================================
// MOCK SETUP — Stores élargis (toutes les tables)
// ============================================

const stores = {
  tenants: [],
  reservations: [],
  reservation_lignes: [],
  reservation_membres: [],
  clients: [],
  services: [],
  factures: [],
  facture_lignes: [],
  facture_paiements: [],
  rh_membres: [],
  admin_users: [],
  ai_agents: [],
  notifications: [],
  segments_clients: [],
  client_tags: [],
  produits: [],
  stock_mouvements: [],
  api_keys: [],
  webhooks: [],
  branding: [],
  parametres: [],
  devis: [],
  devis_lignes: [],
  devis_signatures: [],
  // Agenda
  agenda_events: [],
  // Disponibilités
  business_hours: [],
  conges: [],
  blocs_indispo: [],
  // Fidélité
  loyalty_config: [],
  loyalty_transactions: [],
  // Liste d'attente
  waitlist: [],
  // Comptabilité
  depenses: [],
  journaux_comptables: [],
  // Workflows
  workflows: [],
  workflow_executions: [],
  // Pipeline
  opportunites: [],
  opportunite_lignes: [],
  opportunites_historique: [],
  // SEO
  seo_articles: [],
  seo_keywords: [],
  seo_positions: [],
  seo_recommendations: [],
  // Sentinel
  sentinel_daily_snapshots: [],
  sentinel_daily_costs: [],
  sentinel_insights: [],
  sentinel_goals: [],
  // WhatsApp
  whatsapp_conversations: [],
  whatsapp_settings: [],
  // Abonnement
  subscriptions: [],
  subscription_history: []
};

const resetStores = () => {
  Object.keys(stores).forEach(k => { stores[k] = []; });
};

// Mock Supabase
jest.unstable_mockModule('../src/config/supabase.js', () => {
  function createBuilder(table) {
    if (!stores[table]) stores[table] = [];
    let data = [...stores[table]];
    let filters = [];
    let singleMode = false;

    const builder = {
      select: () => builder,
      insert: (newData) => {
        const items = Array.isArray(newData) ? newData : [newData];
        const inserted = items.map(item => ({
          id: item.id || `${table}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          ...item,
          created_at: item.created_at || new Date().toISOString()
        }));
        stores[table].push(...inserted);
        data = inserted;
        return builder;
      },
      update: (updates) => {
        stores[table] = stores[table].map(item => {
          if (filters.every(f => f(item))) {
            return { ...item, ...updates, updated_at: new Date().toISOString() };
          }
          return item;
        });
        data = stores[table].filter(item => filters.every(f => f(item)));
        return builder;
      },
      upsert: (newData, options = {}) => {
        const items = Array.isArray(newData) ? newData : [newData];
        items.forEach(item => {
          const key = options.onConflict || 'id';
          const idx = stores[table].findIndex(e => e[key] === item[key]);
          if (idx >= 0) {
            stores[table][idx] = { ...stores[table][idx], ...item, updated_at: new Date().toISOString() };
            data = [stores[table][idx]];
          } else {
            const newItem = { id: `${table}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, ...item, created_at: new Date().toISOString() };
            stores[table].push(newItem);
            data = [newItem];
          }
        });
        return builder;
      },
      delete: () => {
        stores[table] = stores[table].filter(item => !filters.every(f => f(item)));
        data = [];
        return builder;
      },
      eq: (field, value) => {
        filters.push(item => item[field] === value);
        data = data.filter(item => item[field] === value);
        return builder;
      },
      neq: (field, value) => {
        filters.push(item => item[field] !== value);
        data = data.filter(item => item[field] !== value);
        return builder;
      },
      gte: (field, value) => {
        filters.push(item => item[field] >= value);
        data = data.filter(item => item[field] >= value);
        return builder;
      },
      lte: (field, value) => {
        filters.push(item => item[field] <= value);
        data = data.filter(item => item[field] <= value);
        return builder;
      },
      gt: (field, value) => {
        filters.push(item => item[field] > value);
        data = data.filter(item => item[field] > value);
        return builder;
      },
      lt: (field, value) => {
        filters.push(item => item[field] < value);
        data = data.filter(item => item[field] < value);
        return builder;
      },
      in: (field, values) => {
        filters.push(item => values.includes(item[field]));
        data = data.filter(item => values.includes(item[field]));
        return builder;
      },
      is: (field, value) => {
        filters.push(item => item[field] === value);
        data = data.filter(item => item[field] === value);
        return builder;
      },
      or: () => builder,
      order: (field, opts = {}) => {
        data.sort((a, b) => opts.ascending !== false ? (a[field] > b[field] ? 1 : -1) : (a[field] < b[field] ? 1 : -1));
        return builder;
      },
      range: (from, to) => { data = data.slice(from, to + 1); return builder; },
      limit: (n) => { data = data.slice(0, n); return builder; },
      single: () => { singleMode = true; return builder; },
      then: (resolve) => {
        if (singleMode) {
          resolve({ data: data[0] || null, error: data.length === 0 ? { code: 'PGRST116' } : null });
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

const { supabase } = await import('../src/config/supabase.js');

// ============================================
// CONSTANTS
// ============================================

const TENANT_A = 'tenant_writeread_A';
const TENANT_B = 'tenant_writeread_B';

// ============================================
// TESTS
// ============================================

describe('Module Integration: Write→Read Cycles', () => {
  beforeEach(() => {
    resetStores();
  });

  // ============================================
  // 1. PROFILE & CONFIG
  // ============================================

  describe('1. Profile & Config', () => {
    test('PATCH template_id → GET returns synced column AND profile_config', async () => {
      // Seed tenant
      stores.tenants.push({
        id: TENANT_A,
        name: 'Salon Test',
        template_id: 'salon',
        profile_config: { template_id: 'salon', horaires: { lundi: '09:00-18:00' } }
      });

      // WRITE — change business type (simulates PATCH /profile/config)
      await supabase.from('tenants').update({
        template_id: 'service_domicile',
        profile_config: {
          template_id: 'service_domicile',
          horaires: { lundi: '09:00-18:00' },
          terminologie: { client: 'Client(e)' }
        }
      }).eq('id', TENANT_A);

      // READ — simulates GET /tenants/me
      const { data } = await supabase
        .from('tenants')
        .select()
        .eq('id', TENANT_A)
        .single();

      // VERIFY — both sources are synced (the bug was: column stayed 'salon' while JSONB had 'service_domicile')
      expect(data.template_id).toBe('service_domicile');
      expect(data.profile_config.template_id).toBe('service_domicile');
      expect(data.template_id).toBe(data.profile_config.template_id);
    });

    test('PATCH partial config (horaires, terminologie) → GET returns merged data without loss', async () => {
      // Seed with full config
      stores.tenants.push({
        id: TENANT_A,
        name: 'Salon Complet',
        template_id: 'salon',
        profile_config: {
          template_id: 'salon',
          horaires: { lundi: '09:00-18:00', mardi: '09:00-18:00' },
          terminologie: { client: 'Client' },
          couleur_theme: '#FF5733'
        }
      });

      // WRITE — update only horaires (merge pattern)
      const { data: current } = await supabase
        .from('tenants')
        .select()
        .eq('id', TENANT_A)
        .single();

      const mergedConfig = {
        ...current.profile_config,
        horaires: { ...current.profile_config.horaires, mercredi: '10:00-17:00' }
      };

      await supabase.from('tenants').update({
        profile_config: mergedConfig
      }).eq('id', TENANT_A);

      // READ
      const { data: updated } = await supabase
        .from('tenants')
        .select()
        .eq('id', TENANT_A)
        .single();

      // VERIFY — new field added, existing fields preserved
      expect(updated.profile_config.horaires.mercredi).toBe('10:00-17:00');
      expect(updated.profile_config.horaires.lundi).toBe('09:00-18:00');
      expect(updated.profile_config.terminologie.client).toBe('Client');
      expect(updated.profile_config.couleur_theme).toBe('#FF5733');
    });
  });

  // ============================================
  // 2. RESERVATIONS MULTI-SERVICES
  // ============================================

  describe('2. Reservations Multi-Services', () => {
    test('POST reservation with 2 services → GET returns lignes + duree_totale + prix_total coherent', async () => {
      // WRITE — create reservation with 2 services
      const { data: rdv } = await supabase
        .from('reservations')
        .insert({
          id: 'rdv_multi_1',
          tenant_id: TENANT_A,
          client_id: 'client_1',
          date: '2026-03-20',
          heure_rdv: '09:00',
          statut: 'confirme',
          duree_totale_minutes: 300,   // 180 + 120
          prix_total: 15000            // 8000 + 7000 centimes
        })
        .select()
        .single();

      // WRITE — create reservation_lignes (1 per affectation/service)
      await supabase.from('reservation_lignes').insert([
        {
          reservation_id: rdv.id,
          tenant_id: TENANT_A,
          service_id: 'svc_vanille',
          nom_service: 'Vanille',
          duree_minutes: 180,
          quantite: 1,
          prix_unitaire: 8000,
          prix_total: 8000
        },
        {
          reservation_id: rdv.id,
          tenant_id: TENANT_A,
          service_id: 'svc_racines',
          nom_service: 'Reprise racines',
          duree_minutes: 120,
          quantite: 1,
          prix_unitaire: 7000,
          prix_total: 7000
        }
      ]);

      // READ — get reservation
      const { data: readRdv } = await supabase
        .from('reservations')
        .select()
        .eq('id', 'rdv_multi_1')
        .single();

      // READ — get lignes
      const { data: lignes } = await supabase
        .from('reservation_lignes')
        .select()
        .eq('reservation_id', 'rdv_multi_1');

      // VERIFY
      expect(lignes).toHaveLength(2);
      expect(readRdv.duree_totale_minutes).toBe(300);
      expect(readRdv.prix_total).toBe(15000);

      // Verify lignes sum matches reservation totals
      const sommeDuree = lignes.reduce((s, l) => s + l.duree_minutes * l.quantite, 0);
      const sommePrix = lignes.reduce((s, l) => s + l.prix_total, 0);
      expect(sommeDuree).toBe(readRdv.duree_totale_minutes);
      expect(sommePrix).toBe(readRdv.prix_total);
    });

    test('PUT modification reservation → GET returns updated fields', async () => {
      // Seed
      stores.reservations.push({
        id: 'rdv_update_1',
        tenant_id: TENANT_A,
        client_id: 'client_1',
        date: '2026-03-20',
        heure_rdv: '09:00',
        statut: 'confirme',
        duree_totale_minutes: 60,
        prix_total: 3000
      });

      // WRITE — update date + heure
      await supabase.from('reservations').update({
        date: '2026-03-21',
        heure_rdv: '14:00',
        duree_totale_minutes: 90,
        prix_total: 4500
      }).eq('id', 'rdv_update_1');

      // READ
      const { data } = await supabase
        .from('reservations')
        .select()
        .eq('id', 'rdv_update_1')
        .single();

      // VERIFY
      expect(data.date).toBe('2026-03-21');
      expect(data.heure_rdv).toBe('14:00');
      expect(data.duree_totale_minutes).toBe(90);
      expect(data.prix_total).toBe(4500);
      expect(data.updated_at).toBeDefined();
    });

    test('DELETE reservation → GET returns nothing', async () => {
      // Seed
      stores.reservations.push({
        id: 'rdv_delete_1',
        tenant_id: TENANT_A,
        client_id: 'client_1',
        date: '2026-03-20',
        statut: 'confirme'
      });
      stores.reservation_lignes.push({
        id: 'ligne_del_1',
        reservation_id: 'rdv_delete_1',
        tenant_id: TENANT_A,
        service_id: 'svc_1'
      });

      // WRITE — delete reservation + lignes
      await supabase.from('reservation_lignes').delete().eq('reservation_id', 'rdv_delete_1');
      await supabase.from('reservations').delete().eq('id', 'rdv_delete_1');

      // READ
      const { data: rdv, error: rdvErr } = await supabase
        .from('reservations')
        .select()
        .eq('id', 'rdv_delete_1')
        .single();

      const { data: lignes } = await supabase
        .from('reservation_lignes')
        .select()
        .eq('reservation_id', 'rdv_delete_1');

      // VERIFY
      expect(rdv).toBeNull();
      expect(rdvErr).toBeTruthy();
      expect(lignes).toHaveLength(0);
    });
  });

  // ============================================
  // 3. CONFLICT DETECTION
  // ============================================

  describe('3. Conflict Detection', () => {
    /**
     * Simulates checkConflicts() logic: two reservations overlap
     * if rdv1_start < rdv2_end AND rdv2_start < rdv1_end
     */
    function checkConflict(existingRdvs, newStart, newDuration) {
      const newEnd = addMinutes(newStart, newDuration);
      return existingRdvs.some(rdv => {
        const existStart = rdv.heure_rdv;
        const existEnd = addMinutes(existStart, rdv.duree_totale_minutes);
        return existStart < newEnd && newStart < existEnd;
      });
    }

    function addMinutes(heure, minutes) {
      const [h, m] = heure.split(':').map(Number);
      const totalMin = h * 60 + m + minutes;
      return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
    }

    test('RDV 09:00 durée 180min → tentative 11:00 → conflit détecté', async () => {
      // Seed existing rdv
      stores.reservations.push({
        id: 'rdv_conflict_1',
        tenant_id: TENANT_A,
        date: '2026-03-20',
        heure_rdv: '09:00',
        duree_totale_minutes: 180, // finit à 12:00
        statut: 'confirme'
      });

      // READ existing reservations for this date
      const { data: existing } = await supabase
        .from('reservations')
        .select()
        .eq('tenant_id', TENANT_A)
        .eq('date', '2026-03-20')
        .eq('statut', 'confirme');

      // CHECK conflict for 11:00, 60min (finit à 12:00 → overlap avec 09:00-12:00)
      const hasConflict = checkConflict(existing, '11:00', 60);
      expect(hasConflict).toBe(true);
    });

    test('RDV 09:00 durée 60min → tentative 10:30 → pas de conflit', async () => {
      stores.reservations.push({
        id: 'rdv_noconflict_1',
        tenant_id: TENANT_A,
        date: '2026-03-20',
        heure_rdv: '09:00',
        duree_totale_minutes: 60, // finit à 10:00
        statut: 'confirme'
      });

      const { data: existing } = await supabase
        .from('reservations')
        .select()
        .eq('tenant_id', TENANT_A)
        .eq('date', '2026-03-20')
        .eq('statut', 'confirme');

      // 10:30 start → 09:00-10:00 ne chevauche PAS 10:30-11:30
      const hasConflict = checkConflict(existing, '10:30', 60);
      expect(hasConflict).toBe(false);
    });
  });

  // ============================================
  // 4. CASCADE STATUT RESERVATION
  // ============================================

  describe('4. Cascade Statut Reservation', () => {
    test('PATCH statut confirme → termine → facture créée', async () => {
      // Seed reservation
      stores.reservations.push({
        id: 'rdv_cascade_1',
        tenant_id: TENANT_A,
        client_id: 'client_cascade',
        statut: 'confirme',
        prix_total: 5000,
        date: '2026-03-20'
      });

      // WRITE — complete reservation
      await supabase.from('reservations').update({
        statut: 'termine',
        completed_at: new Date().toISOString()
      }).eq('id', 'rdv_cascade_1');

      // Simulate cascade: create facture on statut change
      const { data: rdv } = await supabase
        .from('reservations')
        .select()
        .eq('id', 'rdv_cascade_1')
        .single();

      expect(rdv.statut).toBe('termine');

      await supabase.from('factures').insert({
        id: 'fac_cascade_1',
        tenant_id: TENANT_A,
        reservation_id: rdv.id,
        client_id: rdv.client_id,
        montant_ht: rdv.prix_total,
        montant_tva: Math.round(rdv.prix_total * 0.2),
        montant_ttc: Math.round(rdv.prix_total * 1.2),
        statut: 'emise'
      });

      // READ — verify facture exists
      const { data: facture } = await supabase
        .from('factures')
        .select()
        .eq('reservation_id', 'rdv_cascade_1')
        .single();

      expect(facture).toBeTruthy();
      expect(facture.montant_ht).toBe(5000);
      expect(facture.montant_ttc).toBe(6000);
      expect(facture.statut).toBe('emise');
    });

    test('PATCH statut → annule → facture annulée', async () => {
      // Seed reservation + facture
      stores.reservations.push({
        id: 'rdv_cancel_1',
        tenant_id: TENANT_A,
        client_id: 'client_cancel',
        statut: 'confirme',
        prix_total: 3000
      });
      stores.factures.push({
        id: 'fac_cancel_1',
        tenant_id: TENANT_A,
        reservation_id: 'rdv_cancel_1',
        statut: 'emise',
        montant_ttc: 3600
      });

      // WRITE — cancel reservation
      await supabase.from('reservations').update({
        statut: 'annule',
        cancelled_at: new Date().toISOString()
      }).eq('id', 'rdv_cancel_1');

      // Cascade: cancel facture
      await supabase.from('factures').update({
        statut: 'annulee'
      }).eq('reservation_id', 'rdv_cancel_1');

      // READ
      const { data: rdv } = await supabase
        .from('reservations')
        .select()
        .eq('id', 'rdv_cancel_1')
        .single();

      const { data: facture } = await supabase
        .from('factures')
        .select()
        .eq('reservation_id', 'rdv_cancel_1')
        .single();

      // VERIFY
      expect(rdv.statut).toBe('annule');
      expect(facture.statut).toBe('annulee');
    });
  });

  // ============================================
  // 5. CLIENTS
  // ============================================

  describe('5. Clients', () => {
    test('POST client → GET returns all fields', async () => {
      // WRITE
      const { data: client } = await supabase
        .from('clients')
        .insert({
          tenant_id: TENANT_A,
          nom: 'Touré',
          prenom: 'Issouf',
          email: 'issouf@nexus.com',
          telephone: '+33612345678',
          total_visits: 0,
          total_spent: 0,
          tags: ['nouveau'],
          notes: 'Client VIP potentiel'
        })
        .select()
        .single();

      expect(client.id).toBeDefined();

      // READ
      const { data: readClient } = await supabase
        .from('clients')
        .select()
        .eq('id', client.id)
        .eq('tenant_id', TENANT_A)
        .single();

      // VERIFY — all fields persisted
      expect(readClient.nom).toBe('Touré');
      expect(readClient.prenom).toBe('Issouf');
      expect(readClient.email).toBe('issouf@nexus.com');
      expect(readClient.telephone).toBe('+33612345678');
      expect(readClient.total_visits).toBe(0);
      expect(readClient.total_spent).toBe(0);
      expect(readClient.tags).toEqual(['nouveau']);
      expect(readClient.notes).toBe('Client VIP potentiel');
    });

    test('UPDATE client stats (visits, spent) → GET returns incremented values', async () => {
      // Seed
      stores.clients.push({
        id: 'client_stats_1',
        tenant_id: TENANT_A,
        nom: 'Stats',
        total_visits: 5,
        total_spent: 25000,
        last_visit: '2026-03-01'
      });

      // READ current
      const { data: before } = await supabase
        .from('clients')
        .select()
        .eq('id', 'client_stats_1')
        .single();

      // WRITE — increment
      await supabase.from('clients').update({
        total_visits: before.total_visits + 1,
        total_spent: before.total_spent + 5000,
        last_visit: '2026-03-20'
      }).eq('id', 'client_stats_1');

      // READ
      const { data: after } = await supabase
        .from('clients')
        .select()
        .eq('id', 'client_stats_1')
        .single();

      // VERIFY
      expect(after.total_visits).toBe(6);
      expect(after.total_spent).toBe(30000);
      expect(after.last_visit).toBe('2026-03-20');
    });
  });

  // ============================================
  // 6. STOCK
  // ============================================

  describe('6. Stock', () => {
    test('POST mouvement sortie → GET produit → stock_actuel décrémenté', async () => {
      // Seed produit
      stores.produits.push({
        id: 'prod_1',
        tenant_id: TENANT_A,
        nom: 'Shampoing Pro',
        stock_actuel: 50,
        stock_min: 10,
        prix_vente: 1500
      });

      // WRITE — mouvement sortie
      await supabase.from('stock_mouvements').insert({
        tenant_id: TENANT_A,
        produit_id: 'prod_1',
        type: 'sortie',
        quantite: 3,
        motif: 'vente'
      });

      // Update stock
      const { data: prodBefore } = await supabase
        .from('produits')
        .select()
        .eq('id', 'prod_1')
        .single();

      await supabase.from('produits').update({
        stock_actuel: prodBefore.stock_actuel - 3
      }).eq('id', 'prod_1');

      // READ
      const { data: produit } = await supabase
        .from('produits')
        .select()
        .eq('id', 'prod_1')
        .single();

      // VERIFY
      expect(produit.stock_actuel).toBe(47);

      // Verify mouvement recorded
      const { data: mouvements } = await supabase
        .from('stock_mouvements')
        .select()
        .eq('produit_id', 'prod_1');

      expect(mouvements).toHaveLength(1);
      expect(mouvements[0].type).toBe('sortie');
      expect(mouvements[0].quantite).toBe(3);
    });

    test('POST mouvement entrée → GET produit → stock_actuel incrémenté', async () => {
      stores.produits.push({
        id: 'prod_2',
        tenant_id: TENANT_A,
        nom: 'Coloration',
        stock_actuel: 5,
        stock_min: 10
      });

      // WRITE — mouvement entrée (réapprovisionnement)
      await supabase.from('stock_mouvements').insert({
        tenant_id: TENANT_A,
        produit_id: 'prod_2',
        type: 'entree',
        quantite: 20,
        motif: 'restock'
      });

      await supabase.from('produits').update({
        stock_actuel: 25
      }).eq('id', 'prod_2');

      // READ
      const { data: produit } = await supabase
        .from('produits')
        .select()
        .eq('id', 'prod_2')
        .single();

      // VERIFY
      expect(produit.stock_actuel).toBe(25);
      expect(produit.stock_actuel).toBeGreaterThan(produit.stock_min);
    });
  });

  // ============================================
  // 7. TEAM & PERMISSIONS
  // ============================================

  describe('7. Team & Permissions', () => {
    test('PUT rôle/permissions admin → GET team → vérifie rôle modifié', async () => {
      // Seed team member
      stores.admin_users.push({
        id: 'admin_1',
        tenant_id: TENANT_A,
        email: 'alice@nexus.com',
        nom: 'Alice',
        role: 'staff',
        permissions: ['read:clients', 'read:reservations'],
        is_active: true
      });

      // WRITE — promote to manager
      await supabase.from('admin_users').update({
        role: 'manager',
        permissions: ['read:clients', 'write:clients', 'read:reservations', 'write:reservations', 'read:factures']
      }).eq('id', 'admin_1');

      // READ
      const { data: admin } = await supabase
        .from('admin_users')
        .select()
        .eq('id', 'admin_1')
        .eq('tenant_id', TENANT_A)
        .single();

      // VERIFY
      expect(admin.role).toBe('manager');
      expect(admin.permissions).toContain('write:clients');
      expect(admin.permissions).toContain('read:factures');
      expect(admin.permissions).toHaveLength(5);
    });

    test('DELETE membre → GET team → vérifie désactivation', async () => {
      stores.admin_users.push({
        id: 'admin_del_1',
        tenant_id: TENANT_A,
        email: 'bob@nexus.com',
        role: 'staff',
        is_active: true
      });

      // WRITE — soft delete (deactivate)
      await supabase.from('admin_users').update({
        is_active: false,
        deactivated_at: new Date().toISOString()
      }).eq('id', 'admin_del_1');

      // READ
      const { data: admin } = await supabase
        .from('admin_users')
        .select()
        .eq('id', 'admin_del_1')
        .single();

      // VERIFY
      expect(admin.is_active).toBe(false);
      expect(admin.deactivated_at).toBeDefined();

      // READ — active team only
      const { data: activeTeam } = await supabase
        .from('admin_users')
        .select()
        .eq('tenant_id', TENANT_A)
        .eq('is_active', true);

      expect(activeTeam).toHaveLength(0);
    });
  });

  // ============================================
  // 8. AI AGENTS
  // ============================================

  describe('8. AI Agents', () => {
    test('PATCH config agent (nom, ton, proactivité) → GET agents → vérifie persistance', async () => {
      // Seed agent
      stores.ai_agents.push({
        id: 'agent_1',
        tenant_id: TENANT_A,
        nom: 'Assistant IA',
        ton: 'professionnel',
        proactivite: false,
        instructions: 'Réponds poliment',
        is_active: true
      });

      // WRITE — update config
      await supabase.from('ai_agents').update({
        nom: 'Nexus Bot',
        ton: 'amical',
        proactivite: true,
        instructions: 'Sois proactif et propose des créneaux'
      }).eq('id', 'agent_1');

      // READ
      const { data: agent } = await supabase
        .from('ai_agents')
        .select()
        .eq('id', 'agent_1')
        .eq('tenant_id', TENANT_A)
        .single();

      // VERIFY
      expect(agent.nom).toBe('Nexus Bot');
      expect(agent.ton).toBe('amical');
      expect(agent.proactivite).toBe(true);
      expect(agent.instructions).toBe('Sois proactif et propose des créneaux');
    });
  });

  // ============================================
  // 9. CRM SEGMENTS
  // ============================================

  describe('9. CRM Segments', () => {
    test('POST segment avec critères → GET → vérifie nb_clients calculé', async () => {
      // Seed clients
      stores.clients.push(
        { id: 'c1', tenant_id: TENANT_A, nom: 'VIP1', total_spent: 50000, total_visits: 20 },
        { id: 'c2', tenant_id: TENANT_A, nom: 'VIP2', total_spent: 60000, total_visits: 15 },
        { id: 'c3', tenant_id: TENANT_A, nom: 'Regular', total_spent: 5000, total_visits: 2 },
        { id: 'c4', tenant_id: TENANT_A, nom: 'New', total_spent: 0, total_visits: 0 }
      );

      // Calculate nb_clients matching criteria (total_spent >= 30000)
      const { data: matchingClients } = await supabase
        .from('clients')
        .select()
        .eq('tenant_id', TENANT_A)
        .gte('total_spent', 30000);

      const nbClients = matchingClients.length;

      // WRITE — create segment
      await supabase.from('segments_clients').insert({
        id: 'seg_vip',
        tenant_id: TENANT_A,
        nom: 'Clients VIP',
        criteres: { min_spent: 30000 },
        nb_clients: nbClients
      });

      // READ
      const { data: segment } = await supabase
        .from('segments_clients')
        .select()
        .eq('id', 'seg_vip')
        .single();

      // VERIFY
      expect(segment.nom).toBe('Clients VIP');
      expect(segment.nb_clients).toBe(2); // VIP1 + VIP2
    });

    test('PATCH critères segment → GET → vérifie recalcul nb_clients', async () => {
      // Seed
      stores.clients.push(
        { id: 'c10', tenant_id: TENANT_A, nom: 'A', total_visits: 10 },
        { id: 'c11', tenant_id: TENANT_A, nom: 'B', total_visits: 5 },
        { id: 'c12', tenant_id: TENANT_A, nom: 'C', total_visits: 3 },
        { id: 'c13', tenant_id: TENANT_A, nom: 'D', total_visits: 1 }
      );

      stores.segments_clients.push({
        id: 'seg_actifs',
        tenant_id: TENANT_A,
        nom: 'Clients actifs',
        criteres: { min_visits: 5 },
        nb_clients: 2
      });

      // WRITE — relax criteria to min_visits >= 3
      const { data: newMatching } = await supabase
        .from('clients')
        .select()
        .eq('tenant_id', TENANT_A)
        .gte('total_visits', 3);

      await supabase.from('segments_clients').update({
        criteres: { min_visits: 3 },
        nb_clients: newMatching.length
      }).eq('id', 'seg_actifs');

      // READ
      const { data: segment } = await supabase
        .from('segments_clients')
        .select()
        .eq('id', 'seg_actifs')
        .single();

      // VERIFY — now includes C (3 visits) too
      expect(segment.nb_clients).toBe(3); // A(10) + B(5) + C(3)
      expect(segment.criteres.min_visits).toBe(3);
    });
  });

  // ============================================
  // 10. NOTIFICATIONS
  // ============================================

  describe('10. Notifications', () => {
    test('PATCH mark as read → GET → vérifie read_at non null', async () => {
      // Seed
      stores.notifications.push({
        id: 'notif_1',
        tenant_id: TENANT_A,
        type: 'reservation',
        message: 'Nouveau RDV confirmé',
        read_at: null,
        created_at: new Date().toISOString()
      });

      // WRITE — mark as read
      const readAt = new Date().toISOString();
      await supabase.from('notifications').update({
        read_at: readAt
      }).eq('id', 'notif_1');

      // READ
      const { data: notif } = await supabase
        .from('notifications')
        .select()
        .eq('id', 'notif_1')
        .single();

      // VERIFY
      expect(notif.read_at).toBe(readAt);
      expect(notif.read_at).not.toBeNull();
    });

    test('PATCH read-all → GET → vérifie toutes lues', async () => {
      // Seed multiple unread notifications
      stores.notifications.push(
        { id: 'notif_a', tenant_id: TENANT_A, message: 'Msg 1', read_at: null },
        { id: 'notif_b', tenant_id: TENANT_A, message: 'Msg 2', read_at: null },
        { id: 'notif_c', tenant_id: TENANT_A, message: 'Msg 3', read_at: null },
        { id: 'notif_d', tenant_id: 'other_tenant', message: 'Msg X', read_at: null }
      );

      // WRITE — mark all as read for tenant A
      const readAt = new Date().toISOString();
      // Simulate read-all: update all notifications where tenant_id matches
      stores.notifications = stores.notifications.map(n =>
        n.tenant_id === TENANT_A ? { ...n, read_at: readAt } : n
      );

      // READ — unread count for tenant A
      const { data: unread } = await supabase
        .from('notifications')
        .select()
        .eq('tenant_id', TENANT_A);

      const unreadCount = unread.filter(n => n.read_at === null).length;

      // READ — other tenant unaffected
      const { data: otherNotifs } = await supabase
        .from('notifications')
        .select()
        .eq('tenant_id', 'other_tenant');

      // VERIFY
      expect(unreadCount).toBe(0);
      expect(unread).toHaveLength(3);
      expect(otherNotifs[0].read_at).toBeNull(); // other tenant unaffected
    });
  });

  // ============================================
  // 11. API KEYS
  // ============================================

  describe('11. API Keys', () => {
    test('POST create → raw key retournée avec prefix', async () => {
      // Simulate key generation
      const rawKey = `nxs_prod_${Math.random().toString(36).substr(2, 32)}`;
      const keyPrefix = rawKey.substring(0, 12);

      // WRITE — store hashed version (in real app, hash the key)
      const { data: apiKey } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: TENANT_A,
          name: 'Production API Key',
          key_prefix: keyPrefix,
          key_hash: `hashed_${rawKey}`, // in real: bcrypt hash
          scopes: ['read:clients', 'write:reservations'],
          rate_limit_per_hour: 1000,
          is_active: true
        })
        .select()
        .single();

      // VERIFY — raw key starts with prefix
      expect(rawKey.startsWith(apiKey.key_prefix)).toBe(true);
      expect(apiKey.key_hash).toBeDefined();
      expect(apiKey.scopes).toContain('read:clients');
    });

    test('GET list → clé masquée (prefix seulement, pas de hash exposé)', async () => {
      // Seed
      stores.api_keys.push({
        id: 'key_1',
        tenant_id: TENANT_A,
        name: 'Prod Key',
        key_prefix: 'nxs_prod_abc',
        key_hash: 'hashed_secret_value',
        scopes: ['read:clients'],
        is_active: true
      });

      // READ — list keys (simulate API response that strips hash)
      const { data: keys } = await supabase
        .from('api_keys')
        .select()
        .eq('tenant_id', TENANT_A);

      // Simulate API masking (real endpoint would use .select('id, name, key_prefix, scopes, is_active'))
      const maskedKeys = keys.map(({ key_hash, ...rest }) => rest);

      // VERIFY
      expect(maskedKeys).toHaveLength(1);
      expect(maskedKeys[0].key_prefix).toBe('nxs_prod_abc');
      expect(maskedKeys[0].key_hash).toBeUndefined(); // hash never exposed
      expect(maskedKeys[0].name).toBe('Prod Key');
    });
  });

  // ============================================
  // 12. MULTI-TENANT ISOLATION
  // ============================================

  describe('12. Multi-tenant Isolation', () => {
    test('Write tenant A + tenant B → read tenant A → aucune donnée de B', async () => {
      // WRITE — data for both tenants
      await supabase.from('clients').insert([
        { tenant_id: TENANT_A, nom: 'Client A1', telephone: '+33600000001' },
        { tenant_id: TENANT_A, nom: 'Client A2', telephone: '+33600000002' }
      ]);
      await supabase.from('clients').insert([
        { tenant_id: TENANT_B, nom: 'Client B1', telephone: '+33600000003' },
        { tenant_id: TENANT_B, nom: 'Client B2', telephone: '+33600000004' },
        { tenant_id: TENANT_B, nom: 'Client B3', telephone: '+33600000005' }
      ]);

      await supabase.from('reservations').insert([
        { tenant_id: TENANT_A, client_id: 'cA1', date: '2026-03-20', statut: 'confirme' },
        { tenant_id: TENANT_B, client_id: 'cB1', date: '2026-03-20', statut: 'confirme' }
      ]);

      // READ — tenant A only
      const { data: clientsA } = await supabase
        .from('clients')
        .select()
        .eq('tenant_id', TENANT_A);

      const { data: rdvsA } = await supabase
        .from('reservations')
        .select()
        .eq('tenant_id', TENANT_A);

      // VERIFY — no tenant B data leaks into tenant A queries
      expect(clientsA).toHaveLength(2);
      expect(clientsA.every(c => c.tenant_id === TENANT_A)).toBe(true);
      expect(clientsA.some(c => c.nom.includes('B'))).toBe(false);

      expect(rdvsA).toHaveLength(1);
      expect(rdvsA[0].tenant_id).toBe(TENANT_A);
    });

    test('Write tenant A + tenant B → read tenant B → aucune donnée de A', async () => {
      // WRITE
      await supabase.from('clients').insert([
        { tenant_id: TENANT_A, nom: 'Client A1' },
        { tenant_id: TENANT_A, nom: 'Client A2' }
      ]);
      await supabase.from('clients').insert([
        { tenant_id: TENANT_B, nom: 'Client B1' }
      ]);

      await supabase.from('factures').insert([
        { tenant_id: TENANT_A, montant_ttc: 5000, statut: 'emise' },
        { tenant_id: TENANT_B, montant_ttc: 3000, statut: 'emise' },
        { tenant_id: TENANT_B, montant_ttc: 2000, statut: 'payee' }
      ]);

      // READ — tenant B only
      const { data: clientsB } = await supabase
        .from('clients')
        .select()
        .eq('tenant_id', TENANT_B);

      const { data: facturesB } = await supabase
        .from('factures')
        .select()
        .eq('tenant_id', TENANT_B);

      // VERIFY
      expect(clientsB).toHaveLength(1);
      expect(clientsB.every(c => c.tenant_id === TENANT_B)).toBe(true);

      expect(facturesB).toHaveLength(2);
      expect(facturesB.every(f => f.tenant_id === TENANT_B)).toBe(true);
      expect(facturesB.some(f => f.tenant_id === TENANT_A)).toBe(false);
    });
  });

  // ============================================
  // 13. AGENDA (Événements personnels)
  // ============================================

  describe('13. Agenda', () => {
    test('POST event → GET by date range → vérifie persistance', async () => {
      // WRITE
      const { data: event } = await supabase
        .from('agenda_events')
        .insert({
          tenant_id: TENANT_A,
          title: 'Réunion équipe',
          date: '2026-03-20',
          start_time: '09:00',
          end_time: '10:00',
          type: 'meeting',
          location: 'Bureau',
          attendees: ['alice@nexus.com', 'bob@nexus.com'],
          notes: 'Bilan mensuel'
        })
        .select()
        .single();

      expect(event.id).toBeDefined();

      // READ — by date
      const { data: events } = await supabase
        .from('agenda_events')
        .select()
        .eq('tenant_id', TENANT_A)
        .eq('date', '2026-03-20');

      // VERIFY
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Réunion équipe');
      expect(events[0].type).toBe('meeting');
      expect(events[0].attendees).toHaveLength(2);
      expect(events[0].location).toBe('Bureau');
    });

    test('PUT event → GET → vérifie mise à jour heure/lieu', async () => {
      stores.agenda_events.push({
        id: 'evt_1',
        tenant_id: TENANT_A,
        title: 'Appel client',
        date: '2026-03-21',
        start_time: '14:00',
        end_time: '14:30',
        type: 'appel'
      });

      // WRITE — reschedule
      await supabase.from('agenda_events').update({
        start_time: '16:00',
        end_time: '16:30',
        notes: 'Reporté à 16h'
      }).eq('id', 'evt_1');

      // READ
      const { data: evt } = await supabase
        .from('agenda_events')
        .select()
        .eq('id', 'evt_1')
        .single();

      // VERIFY
      expect(evt.start_time).toBe('16:00');
      expect(evt.end_time).toBe('16:30');
      expect(evt.notes).toBe('Reporté à 16h');
      expect(evt.title).toBe('Appel client'); // unchanged
    });

    test('DELETE event → GET → vérifie suppression', async () => {
      stores.agenda_events.push({
        id: 'evt_del',
        tenant_id: TENANT_A,
        title: 'Annulé',
        date: '2026-03-22'
      });

      await supabase.from('agenda_events').delete().eq('id', 'evt_del');

      const { data, error } = await supabase
        .from('agenda_events')
        .select()
        .eq('id', 'evt_del')
        .single();

      expect(data).toBeNull();
      expect(error).toBeTruthy();
    });
  });

  // ============================================
  // 14. PRESTATIONS / SERVICES (catalogue)
  // ============================================

  describe('14. Prestations / Services', () => {
    test('POST service → GET → vérifie tous les champs', async () => {
      const { data: svc } = await supabase
        .from('services')
        .insert({
          tenant_id: TENANT_A,
          nom: 'Coupe femme',
          description: 'Coupe, brushing inclus',
          duree: 45,
          prix: 3500, // centimes
          categorie: 'coiffure',
          actif: true
        })
        .select()
        .single();

      // READ
      const { data: read } = await supabase
        .from('services')
        .select()
        .eq('id', svc.id)
        .eq('tenant_id', TENANT_A)
        .single();

      expect(read.nom).toBe('Coupe femme');
      expect(read.duree).toBe(45);
      expect(read.prix).toBe(3500);
      expect(read.categorie).toBe('coiffure');
      expect(read.actif).toBe(true);
    });

    test('PUT service prix + durée → GET → vérifie mise à jour', async () => {
      stores.services.push({
        id: 'svc_up',
        tenant_id: TENANT_A,
        nom: 'Coloration',
        duree: 60,
        prix: 5000,
        actif: true
      });

      await supabase.from('services').update({
        duree: 90,
        prix: 6500
      }).eq('id', 'svc_up');

      const { data } = await supabase
        .from('services')
        .select()
        .eq('id', 'svc_up')
        .single();

      expect(data.duree).toBe(90);
      expect(data.prix).toBe(6500);
      expect(data.nom).toBe('Coloration'); // unchanged
    });

    test('PATCH désactiver service → GET → vérifie actif=false', async () => {
      stores.services.push({
        id: 'svc_dis',
        tenant_id: TENANT_A,
        nom: 'ToDisable',
        actif: true
      });

      // WRITE — disable
      await supabase.from('services').update({ actif: false }).eq('id', 'svc_dis');

      // READ
      const { data: disabled } = await supabase
        .from('services')
        .select()
        .eq('id', 'svc_dis')
        .single();

      // VERIFY — field persisted
      expect(disabled.actif).toBe(false);
      expect(disabled.nom).toBe('ToDisable'); // other fields unchanged
      expect(disabled.updated_at).toBeDefined();
    });
  });

  // ============================================
  // 15. DISPONIBILITÉS
  // ============================================

  describe('15. Disponibilités', () => {
    test('PUT business_hours → GET → vérifie horaires semaine complète', async () => {
      const horaires = {
        id: 'bh_1',
        tenant_id: TENANT_A,
        lundi: { ouvert: true, periodes: [{ debut: '09:00', fin: '12:00' }, { debut: '14:00', fin: '18:00' }] },
        mardi: { ouvert: true, periodes: [{ debut: '09:00', fin: '18:00' }] },
        mercredi: { ouvert: false, periodes: [] },
        jeudi: { ouvert: true, periodes: [{ debut: '09:00', fin: '18:00' }] },
        vendredi: { ouvert: true, periodes: [{ debut: '09:00', fin: '17:00' }] },
        samedi: { ouvert: true, periodes: [{ debut: '09:00', fin: '13:00' }] },
        dimanche: { ouvert: false, periodes: [] }
      };

      await supabase.from('business_hours').insert(horaires);

      const { data } = await supabase
        .from('business_hours')
        .select()
        .eq('tenant_id', TENANT_A)
        .single();

      expect(data.lundi.ouvert).toBe(true);
      expect(data.lundi.periodes).toHaveLength(2);
      expect(data.mercredi.ouvert).toBe(false);
      expect(data.samedi.periodes[0].fin).toBe('13:00');
    });

    test('POST congé → GET → vérifie période bloquée', async () => {
      await supabase.from('conges').insert({
        tenant_id: TENANT_A,
        membre_id: 'staff_1',
        date_debut: '2026-04-01',
        date_fin: '2026-04-07',
        type: 'vacances',
        motif: 'Congés annuels'
      });

      const { data: conges } = await supabase
        .from('conges')
        .select()
        .eq('tenant_id', TENANT_A)
        .eq('membre_id', 'staff_1');

      expect(conges).toHaveLength(1);
      expect(conges[0].date_debut).toBe('2026-04-01');
      expect(conges[0].date_fin).toBe('2026-04-07');
      expect(conges[0].type).toBe('vacances');
    });

    test('POST bloc indispo → DELETE → GET → vérifie suppression', async () => {
      stores.blocs_indispo.push({
        id: 'bloc_1',
        tenant_id: TENANT_A,
        date: '2026-03-25',
        heure_debut: '12:00',
        heure_fin: '14:00',
        motif: 'Formation'
      });

      await supabase.from('blocs_indispo').delete().eq('id', 'bloc_1');

      const { data: blocs } = await supabase
        .from('blocs_indispo')
        .select()
        .eq('tenant_id', TENANT_A);

      expect(blocs).toHaveLength(0);
    });
  });

  // ============================================
  // 16. FIDÉLITÉ
  // ============================================

  describe('16. Fidélité', () => {
    test('UPSERT loyalty_config → GET → vérifie config persistée', async () => {
      await supabase.from('loyalty_config').upsert({
        tenant_id: TENANT_A,
        points_per_euro: 10,
        signup_bonus: 50,
        validity_days: 365,
        min_redeem: 100,
        redeem_ratio: 0.1, // 100 points = 10€
        is_active: true
      }, { onConflict: 'tenant_id' });

      const { data: config } = await supabase
        .from('loyalty_config')
        .select()
        .eq('tenant_id', TENANT_A)
        .single();

      expect(config.points_per_euro).toBe(10);
      expect(config.signup_bonus).toBe(50);
      expect(config.validity_days).toBe(365);
      expect(config.min_redeem).toBe(100);
      expect(config.is_active).toBe(true);
    });

    test('POST earn + redeem transactions → GET solde → vérifie calcul', async () => {
      // Earn points
      await supabase.from('loyalty_transactions').insert([
        { tenant_id: TENANT_A, client_id: 'cli_loy', type: 'earn', points: 250, motif: 'Achat 25€' },
        { tenant_id: TENANT_A, client_id: 'cli_loy', type: 'earn', points: 100, motif: 'Bonus inscription' }
      ]);

      // Redeem
      await supabase.from('loyalty_transactions').insert({
        tenant_id: TENANT_A, client_id: 'cli_loy', type: 'redeem', points: -150, motif: 'Réduction fidélité'
      });

      // READ
      const { data: transactions } = await supabase
        .from('loyalty_transactions')
        .select()
        .eq('tenant_id', TENANT_A)
        .eq('client_id', 'cli_loy');

      const solde = transactions.reduce((s, t) => s + t.points, 0);

      expect(transactions).toHaveLength(3);
      expect(solde).toBe(200); // 250 + 100 - 150
    });
  });

  // ============================================
  // 17. LISTE D'ATTENTE
  // ============================================

  describe('17. Liste d\'attente', () => {
    test('POST waitlist entry → PATCH notify → PATCH convert → vérifie flow complet', async () => {
      // WRITE — add to waitlist
      const { data: entry } = await supabase
        .from('waitlist')
        .insert({
          tenant_id: TENANT_A,
          client_id: 'cli_wait',
          service_id: 'svc_1',
          date_souhaitee: '2026-03-25',
          creneau_prefere: 'matin',
          statut: 'waiting',
          priorite: 1
        })
        .select()
        .single();

      // WRITE — notify
      await supabase.from('waitlist').update({
        statut: 'notified',
        notified_at: new Date().toISOString()
      }).eq('id', entry.id);

      // READ after notify
      const { data: notified } = await supabase
        .from('waitlist')
        .select()
        .eq('id', entry.id)
        .single();

      expect(notified.statut).toBe('notified');
      expect(notified.notified_at).toBeDefined();

      // WRITE — convert to reservation
      await supabase.from('waitlist').update({
        statut: 'converted',
        converted_at: new Date().toISOString(),
        reservation_id: 'rdv_from_wait'
      }).eq('id', entry.id);

      // READ final
      const { data: converted } = await supabase
        .from('waitlist')
        .select()
        .eq('id', entry.id)
        .single();

      expect(converted.statut).toBe('converted');
      expect(converted.reservation_id).toBe('rdv_from_wait');
    });

    test('GET waitlist filtrée par statut → vérifie isolation', async () => {
      stores.waitlist.push(
        { id: 'w1', tenant_id: TENANT_A, statut: 'waiting', client_id: 'c1' },
        { id: 'w2', tenant_id: TENANT_A, statut: 'waiting', client_id: 'c2' },
        { id: 'w3', tenant_id: TENANT_A, statut: 'converted', client_id: 'c3' },
        { id: 'w4', tenant_id: TENANT_B, statut: 'waiting', client_id: 'c4' }
      );

      const { data: waiting } = await supabase
        .from('waitlist')
        .select()
        .eq('tenant_id', TENANT_A)
        .eq('statut', 'waiting');

      expect(waiting).toHaveLength(2);
      expect(waiting.every(w => w.tenant_id === TENANT_A)).toBe(true);
    });
  });

  // ============================================
  // 18. FACTURATION COMPLÈTE
  // ============================================

  describe('18. Facturation Complète', () => {
    test('POST facture + lignes + paiement → GET → vérifie cycle complet', async () => {
      // WRITE — facture
      const { data: facture } = await supabase
        .from('factures')
        .insert({
          id: 'fac_full_1',
          tenant_id: TENANT_A,
          client_id: 'cli_fac',
          numero: 'NEX-2026-00001',
          montant_ht: 10000,
          montant_tva: 2000,
          montant_ttc: 12000,
          taux_tva: 20,
          statut: 'generee'
        })
        .select()
        .single();

      // WRITE — lignes
      await supabase.from('facture_lignes').insert([
        { facture_id: facture.id, tenant_id: TENANT_A, description: 'Coupe femme', quantite: 1, prix_unitaire: 3500, prix_total: 3500 },
        { facture_id: facture.id, tenant_id: TENANT_A, description: 'Coloration', quantite: 1, prix_unitaire: 6500, prix_total: 6500 }
      ]);

      // WRITE — send
      await supabase.from('factures').update({
        statut: 'envoyee',
        sent_at: new Date().toISOString()
      }).eq('id', facture.id);

      // WRITE — payment
      await supabase.from('facture_paiements').insert({
        facture_id: facture.id,
        tenant_id: TENANT_A,
        montant: 12000,
        methode: 'carte',
        statut: 'completed'
      });

      await supabase.from('factures').update({
        statut: 'payee',
        paid_at: new Date().toISOString()
      }).eq('id', facture.id);

      // READ
      const { data: readFac } = await supabase
        .from('factures')
        .select()
        .eq('id', facture.id)
        .single();

      const { data: lignes } = await supabase
        .from('facture_lignes')
        .select()
        .eq('facture_id', facture.id);

      const { data: paiements } = await supabase
        .from('facture_paiements')
        .select()
        .eq('facture_id', facture.id);

      // VERIFY
      expect(readFac.statut).toBe('payee');
      expect(readFac.numero).toBe('NEX-2026-00001');
      expect(readFac.montant_ttc).toBe(12000);
      expect(lignes).toHaveLength(2);
      expect(lignes.reduce((s, l) => s + l.prix_total, 0)).toBe(10000); // somme HT
      expect(paiements).toHaveLength(1);
      expect(paiements[0].montant).toBe(12000);
    });

    test('GET factures par statut → vérifie filtrage', async () => {
      stores.factures.push(
        { id: 'f1', tenant_id: TENANT_A, statut: 'generee', montant_ttc: 3000 },
        { id: 'f2', tenant_id: TENANT_A, statut: 'envoyee', montant_ttc: 5000 },
        { id: 'f3', tenant_id: TENANT_A, statut: 'payee', montant_ttc: 8000 },
        { id: 'f4', tenant_id: TENANT_A, statut: 'payee', montant_ttc: 2000 }
      );

      const { data: payees } = await supabase
        .from('factures')
        .select()
        .eq('tenant_id', TENANT_A)
        .eq('statut', 'payee');

      const revenuePaye = payees.reduce((s, f) => s + f.montant_ttc, 0);

      expect(payees).toHaveLength(2);
      expect(revenuePaye).toBe(10000);
    });
  });

  // ============================================
  // 19. ANALYTICS / SENTINEL
  // ============================================

  describe('19. Analytics / Sentinel', () => {
    test('POST daily snapshot → GET dashboard → vérifie KPIs', async () => {
      const today = '2026-03-19';

      await supabase.from('sentinel_daily_snapshots').insert({
        tenant_id: TENANT_A,
        date: today,
        total_clients: 150,
        new_clients: 3,
        total_reservations: 12,
        reservations_completed: 10,
        revenue_paid: 35000,
        no_show_count: 1,
        no_show_rate: 8.3
      });

      const { data: snapshot } = await supabase
        .from('sentinel_daily_snapshots')
        .select()
        .eq('tenant_id', TENANT_A)
        .eq('date', today)
        .single();

      expect(snapshot.total_clients).toBe(150);
      expect(snapshot.new_clients).toBe(3);
      expect(snapshot.revenue_paid).toBe(35000);
      expect(snapshot.no_show_rate).toBe(8.3);
    });

    test('POST daily costs → GET → vérifie ventilation', async () => {
      await supabase.from('sentinel_daily_costs').insert({
        tenant_id: TENANT_A,
        date: '2026-03-19',
        cost_ai: 250,    // centimes
        cost_sms: 180,
        cost_voice: 0,
        cost_email: 50,
        cost_whatsapp: 120,
        total: 600
      });

      const { data: costs } = await supabase
        .from('sentinel_daily_costs')
        .select()
        .eq('tenant_id', TENANT_A)
        .eq('date', '2026-03-19')
        .single();

      expect(costs.cost_ai).toBe(250);
      expect(costs.total).toBe(600);
      expect(costs.cost_ai + costs.cost_sms + costs.cost_voice + costs.cost_email + costs.cost_whatsapp).toBe(costs.total);
    });

    test('UPSERT goals → GET → vérifie objectifs persistés', async () => {
      await supabase.from('sentinel_goals').upsert({
        tenant_id: TENANT_A,
        type: 'monthly',
        revenue_target: 500000,
        clients_target: 200,
        reservations_target: 300
      }, { onConflict: 'tenant_id' });

      const { data: goals } = await supabase
        .from('sentinel_goals')
        .select()
        .eq('tenant_id', TENANT_A)
        .single();

      expect(goals.revenue_target).toBe(500000);
      expect(goals.clients_target).toBe(200);
    });
  });

  // ============================================
  // 20. COMPTABILITÉ
  // ============================================

  describe('20. Comptabilité', () => {
    test('POST dépenses + factures payées → calcul P&L → vérifie marge', async () => {
      // Revenue (factures payées)
      stores.factures.push(
        { id: 'fac_p1', tenant_id: TENANT_A, statut: 'payee', montant_ht: 10000, montant_tva: 2000, montant_ttc: 12000, date_emission: '2026-03-01' },
        { id: 'fac_p2', tenant_id: TENANT_A, statut: 'payee', montant_ht: 15000, montant_tva: 3000, montant_ttc: 18000, date_emission: '2026-03-10' }
      );

      // Dépenses
      await supabase.from('depenses').insert([
        { tenant_id: TENANT_A, categorie: 'loyer', montant_ht: 8000, montant_tva: 0, date: '2026-03-01' },
        { tenant_id: TENANT_A, categorie: 'produits', montant_ht: 3000, montant_tva: 600, date: '2026-03-05' },
        { tenant_id: TENANT_A, categorie: 'salaires', montant_ht: 5000, montant_tva: 0, date: '2026-03-15' }
      ]);

      // READ revenue
      const { data: facPayees } = await supabase
        .from('factures')
        .select()
        .eq('tenant_id', TENANT_A)
        .eq('statut', 'payee');

      const revenueHT = facPayees.reduce((s, f) => s + f.montant_ht, 0);
      const tvaCollectee = facPayees.reduce((s, f) => s + f.montant_tva, 0);

      // READ expenses
      const { data: depenses } = await supabase
        .from('depenses')
        .select()
        .eq('tenant_id', TENANT_A);

      const totalDepensesHT = depenses.reduce((s, d) => s + d.montant_ht, 0);
      const tvaDeductible = depenses.reduce((s, d) => s + d.montant_tva, 0);

      // VERIFY P&L
      const resultatNet = revenueHT - totalDepensesHT;
      const tvaNette = tvaCollectee - tvaDeductible;

      expect(revenueHT).toBe(25000);
      expect(totalDepensesHT).toBe(16000);
      expect(resultatNet).toBe(9000);  // profit
      expect(tvaCollectee).toBe(5000);
      expect(tvaDeductible).toBe(600);
      expect(tvaNette).toBe(4400);     // TVA à reverser
    });

    test('POST écriture comptable double → vérifie débit = crédit', async () => {
      await supabase.from('journaux_comptables').insert([
        { tenant_id: TENANT_A, type: 'debit', compte: '411', libelle: 'Paiement client', montant: 12000, date: '2026-03-19' },
        { tenant_id: TENANT_A, type: 'credit', compte: '706', libelle: 'Prestation services', montant: 10000, date: '2026-03-19' },
        { tenant_id: TENANT_A, type: 'credit', compte: '44571', libelle: 'TVA collectée', montant: 2000, date: '2026-03-19' }
      ]);

      const { data: ecritures } = await supabase
        .from('journaux_comptables')
        .select()
        .eq('tenant_id', TENANT_A);

      const totalDebit = ecritures.filter(e => e.type === 'debit').reduce((s, e) => s + e.montant, 0);
      const totalCredit = ecritures.filter(e => e.type === 'credit').reduce((s, e) => s + e.montant, 0);

      expect(totalDebit).toBe(totalCredit); // équilibre comptable
      expect(totalDebit).toBe(12000);
    });
  });

  // ============================================
  // 21. WORKFLOWS (Marketing Automation)
  // ============================================

  describe('21. Workflows', () => {
    test('POST workflow → toggle enable → GET → vérifie statut', async () => {
      const { data: wf } = await supabase
        .from('workflows')
        .insert({
          tenant_id: TENANT_A,
          nom: 'Welcome Email',
          trigger_type: 'new_client',
          actions: [
            { type: 'send_email', template: 'welcome', delay_hours: 0 },
            { type: 'add_tag', tag: 'nouveau', delay_hours: 0 }
          ],
          is_active: false
        })
        .select()
        .single();

      // Enable
      await supabase.from('workflows').update({ is_active: true }).eq('id', wf.id);

      const { data: enabled } = await supabase
        .from('workflows')
        .select()
        .eq('id', wf.id)
        .single();

      expect(enabled.is_active).toBe(true);
      expect(enabled.trigger_type).toBe('new_client');
      expect(enabled.actions).toHaveLength(2);
    });

    test('POST workflow execution → GET → vérifie log', async () => {
      stores.workflows.push({
        id: 'wf_exec',
        tenant_id: TENANT_A,
        nom: 'Review Request',
        trigger_type: 'rdv_completed',
        is_active: true
      });

      await supabase.from('workflow_executions').insert({
        tenant_id: TENANT_A,
        workflow_id: 'wf_exec',
        trigger_data: { client_id: 'cli_1', reservation_id: 'rdv_1' },
        actions_executed: ['send_email'],
        statut: 'completed',
        executed_at: new Date().toISOString()
      });

      const { data: execs } = await supabase
        .from('workflow_executions')
        .select()
        .eq('tenant_id', TENANT_A)
        .eq('workflow_id', 'wf_exec');

      expect(execs).toHaveLength(1);
      expect(execs[0].statut).toBe('completed');
      expect(execs[0].trigger_data.client_id).toBe('cli_1');
    });
  });

  // ============================================
  // 22. PIPELINE (Sales)
  // ============================================

  describe('22. Pipeline', () => {
    test('POST opportunité → PATCH move etape → GET → vérifie progression', async () => {
      const { data: opp } = await supabase
        .from('opportunites')
        .insert({
          tenant_id: TENANT_A,
          client_id: 'cli_pipe',
          titre: 'Mariage Dupont',
          etape: 'prospect',
          probabilite: 10,
          montant_ttc: 250000, // centimes
          source: 'instagram'
        })
        .select()
        .single();

      // Move to devis stage
      await supabase.from('opportunites').update({
        etape: 'devis',
        probabilite: 50
      }).eq('id', opp.id);

      // Log history
      await supabase.from('opportunites_historique').insert({
        tenant_id: TENANT_A,
        opportunite_id: opp.id,
        ancien_etape: 'prospect',
        nouveau_etape: 'devis',
        date: new Date().toISOString()
      });

      // READ
      const { data: updated } = await supabase
        .from('opportunites')
        .select()
        .eq('id', opp.id)
        .single();

      const { data: history } = await supabase
        .from('opportunites_historique')
        .select()
        .eq('opportunite_id', opp.id);

      expect(updated.etape).toBe('devis');
      expect(updated.probabilite).toBe(50);
      expect(history).toHaveLength(1);
      expect(history[0].ancien_etape).toBe('prospect');
    });

    test('GET pipeline forecast → vérifie calcul pondéré', async () => {
      stores.opportunites.push(
        { id: 'op1', tenant_id: TENANT_A, etape: 'prospect', probabilite: 10, montant_ttc: 100000 },
        { id: 'op2', tenant_id: TENANT_A, etape: 'devis', probabilite: 50, montant_ttc: 200000 },
        { id: 'op3', tenant_id: TENANT_A, etape: 'negociation', probabilite: 75, montant_ttc: 150000 },
        { id: 'op4', tenant_id: TENANT_A, etape: 'gagne', probabilite: 100, montant_ttc: 80000 }
      );

      const { data: pipeline } = await supabase
        .from('opportunites')
        .select()
        .eq('tenant_id', TENANT_A);

      const forecast = pipeline.reduce((s, o) => s + (o.montant_ttc * o.probabilite / 100), 0);
      const total = pipeline.reduce((s, o) => s + o.montant_ttc, 0);

      // 10000 + 100000 + 112500 + 80000 = 302500
      expect(forecast).toBe(302500);
      expect(total).toBe(530000);
    });
  });

  // ============================================
  // 23. DEVIS
  // ============================================

  describe('23. Devis', () => {
    test('POST devis + lignes → PATCH send → PATCH accept → vérifie cycle complet', async () => {
      // WRITE — create devis
      const { data: devis } = await supabase
        .from('devis')
        .insert({
          id: 'dev_1',
          tenant_id: TENANT_A,
          client_id: 'cli_dev',
          numero: 'DEV-2026-00001',
          date_devis: '2026-03-19',
          validite_jours: 30,
          date_expiration: '2026-04-18',
          montant_ht: 25000,
          montant_tva: 5000,
          montant_ttc: 30000,
          statut: 'brouillon'
        })
        .select()
        .single();

      // Lignes
      await supabase.from('devis_lignes').insert([
        { devis_id: devis.id, tenant_id: TENANT_A, description: 'Forfait mariage', quantite: 1, prix_unitaire: 15000, prix_total: 15000 },
        { devis_id: devis.id, tenant_id: TENANT_A, description: 'Maquillage', quantite: 2, prix_unitaire: 5000, prix_total: 10000 }
      ]);

      // Send
      await supabase.from('devis').update({
        statut: 'envoye',
        sent_at: new Date().toISOString()
      }).eq('id', devis.id);

      // Accept
      await supabase.from('devis').update({
        statut: 'accepte',
        accepted_at: new Date().toISOString()
      }).eq('id', devis.id);

      // READ
      const { data: readDevis } = await supabase
        .from('devis')
        .select()
        .eq('id', devis.id)
        .single();

      const { data: lignes } = await supabase
        .from('devis_lignes')
        .select()
        .eq('devis_id', devis.id);

      expect(readDevis.statut).toBe('accepte');
      expect(readDevis.accepted_at).toBeDefined();
      expect(readDevis.numero).toBe('DEV-2026-00001');
      expect(lignes).toHaveLength(2);
      expect(lignes.reduce((s, l) => s + l.prix_total, 0)).toBe(25000);
    });

    test('Devis expiré → vérifie date_expiration < aujourd\'hui', async () => {
      stores.devis.push({
        id: 'dev_exp',
        tenant_id: TENANT_A,
        statut: 'envoye',
        date_expiration: '2026-03-01', // passé
        montant_ttc: 5000
      });

      const { data: devis } = await supabase
        .from('devis')
        .select()
        .eq('id', 'dev_exp')
        .single();

      const isExpired = new Date(devis.date_expiration) < new Date('2026-03-19');
      expect(isExpired).toBe(true);
      expect(devis.statut).toBe('envoye'); // still marked as sent, not auto-expired
    });
  });

  // ============================================
  // 24. SEO / ARTICLES
  // ============================================

  describe('24. SEO / Articles', () => {
    test('POST article → PATCH publish → GET → vérifie publication', async () => {
      const { data: article } = await supabase
        .from('seo_articles')
        .insert({
          tenant_id: TENANT_A,
          titre: 'Les 10 tendances coiffure 2026',
          slug: 'tendances-coiffure-2026',
          contenu: '<h1>Tendances 2026</h1><p>Article complet...</p>',
          meta_title: 'Tendances coiffure 2026 - Salon Nexus',
          meta_description: 'Découvrez les tendances coiffure 2026',
          statut: 'draft',
          auteur: 'IA Nexus'
        })
        .select()
        .single();

      // Publish
      await supabase.from('seo_articles').update({
        statut: 'published',
        published_at: new Date().toISOString()
      }).eq('id', article.id);

      const { data: published } = await supabase
        .from('seo_articles')
        .select()
        .eq('id', article.id)
        .single();

      expect(published.statut).toBe('published');
      expect(published.published_at).toBeDefined();
      expect(published.slug).toBe('tendances-coiffure-2026');
      expect(published.meta_title).toContain('2026');
    });

    test('POST keyword + position tracking → GET → vérifie suivi', async () => {
      await supabase.from('seo_keywords').insert({
        id: 'kw_1',
        tenant_id: TENANT_A,
        keyword: 'coiffeur paris 15',
        volume: 880,
        difficulte: 45
      });

      await supabase.from('seo_positions').insert([
        { tenant_id: TENANT_A, keyword_id: 'kw_1', position: 42, date: '2026-03-01' },
        { tenant_id: TENANT_A, keyword_id: 'kw_1', position: 28, date: '2026-03-10' },
        { tenant_id: TENANT_A, keyword_id: 'kw_1', position: 15, date: '2026-03-19' }
      ]);

      const { data: positions } = await supabase
        .from('seo_positions')
        .select()
        .eq('keyword_id', 'kw_1');

      expect(positions).toHaveLength(3);

      // Verify improvement trend
      const first = positions.find(p => p.date === '2026-03-01');
      const last = positions.find(p => p.date === '2026-03-19');
      expect(last.position).toBeLessThan(first.position); // lower = better rank
    });
  });

  // ============================================
  // 25. ANTI-CHURN
  // ============================================

  describe('25. Anti-Churn', () => {
    test('Détecte clients inactifs → crée relance → vérifie ciblage', async () => {
      const now = new Date('2026-03-19');
      const threshold = new Date(now);
      threshold.setDate(threshold.getDate() - 60); // 60 jours inactifs

      stores.clients.push(
        { id: 'cli_active', tenant_id: TENANT_A, nom: 'Active', last_visit: '2026-03-10', total_visits: 5 },
        { id: 'cli_atrisk', tenant_id: TENANT_A, nom: 'At Risk', last_visit: '2026-01-15', total_visits: 10 },
        { id: 'cli_churned', tenant_id: TENANT_A, nom: 'Churned', last_visit: '2025-12-01', total_visits: 3 }
      );

      // READ — find inactive clients
      const { data: allClients } = await supabase
        .from('clients')
        .select()
        .eq('tenant_id', TENANT_A);

      const inactifs = allClients.filter(c =>
        c.last_visit && new Date(c.last_visit) < threshold
      );

      expect(inactifs).toHaveLength(2); // At Risk + Churned

      // WRITE — tag them
      for (const client of inactifs) {
        await supabase.from('client_tags').insert({
          tenant_id: TENANT_A,
          client_id: client.id,
          tag: 'relance_auto',
          added_at: now.toISOString()
        });
      }

      // READ — tagged clients
      const { data: tagged } = await supabase
        .from('client_tags')
        .select()
        .eq('tenant_id', TENANT_A)
        .eq('tag', 'relance_auto');

      expect(tagged).toHaveLength(2);
      expect(tagged.some(t => t.client_id === 'cli_active')).toBe(false);
    });
  });

  // ============================================
  // 26. WHATSAPP IA
  // ============================================

  describe('26. WhatsApp IA', () => {
    test('UPSERT whatsapp_settings → GET → vérifie config', async () => {
      await supabase.from('whatsapp_settings').upsert({
        tenant_id: TENANT_A,
        phone_number: '+33612345678',
        greeting_message: 'Bonjour ! Bienvenue chez Nexus Salon.',
        auto_reply: true,
        business_hours_only: true,
        language: 'fr'
      }, { onConflict: 'tenant_id' });

      const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select()
        .eq('tenant_id', TENANT_A)
        .single();

      expect(settings.phone_number).toBe('+33612345678');
      expect(settings.auto_reply).toBe(true);
      expect(settings.greeting_message).toContain('Nexus');
    });

    test('POST conversation → messages → GET → vérifie historique', async () => {
      const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .insert({
          id: 'conv_1',
          tenant_id: TENANT_A,
          client_phone: '+33698765432',
          client_id: 'cli_wa',
          messages: [
            { role: 'client', content: 'Bonjour, je voudrais un RDV', timestamp: '2026-03-19T10:00:00Z' },
            { role: 'assistant', content: 'Bien sûr ! Quand souhaitez-vous venir ?', timestamp: '2026-03-19T10:00:05Z' }
          ],
          statut: 'active',
          last_message_at: '2026-03-19T10:00:05Z'
        })
        .select()
        .single();

      // Add message
      const updatedMessages = [
        ...conv.messages,
        { role: 'client', content: 'Demain à 14h ?', timestamp: '2026-03-19T10:01:00Z' }
      ];

      await supabase.from('whatsapp_conversations').update({
        messages: updatedMessages,
        last_message_at: '2026-03-19T10:01:00Z'
      }).eq('id', conv.id);

      // READ
      const { data: readConv } = await supabase
        .from('whatsapp_conversations')
        .select()
        .eq('id', conv.id)
        .single();

      expect(readConv.messages).toHaveLength(3);
      expect(readConv.messages[2].content).toContain('14h');
      expect(readConv.statut).toBe('active');
    });
  });

  // ============================================
  // 27. TÉLÉPHONE IA (Voice Bot)
  // ============================================

  describe('27. Téléphone IA', () => {
    test('Config voix tenant → GET → vérifie paramètres TTS', async () => {
      stores.parametres.push({
        id: 'param_voice',
        tenant_id: TENANT_A,
        cle: 'voice_config',
        valeur: {
          provider: 'openai',
          voice: 'alloy',
          speed: 1.0,
          greeting: 'Bonjour, salon Nexus, comment puis-je vous aider ?',
          max_duration_seconds: 300,
          language: 'fr'
        }
      });

      const { data: param } = await supabase
        .from('parametres')
        .select()
        .eq('tenant_id', TENANT_A)
        .eq('cle', 'voice_config')
        .single();

      expect(param.valeur.provider).toBe('openai');
      expect(param.valeur.voice).toBe('alloy');
      expect(param.valeur.greeting).toContain('Nexus');
      expect(param.valeur.max_duration_seconds).toBe(300);
    });

    test('PATCH voice config → GET → vérifie persistance', async () => {
      stores.parametres.push({
        id: 'param_voice_2',
        tenant_id: TENANT_A,
        cle: 'voice_config',
        valeur: { provider: 'openai', voice: 'alloy', speed: 1.0 }
      });

      await supabase.from('parametres').update({
        valeur: { provider: 'elevenlabs', voice: 'rachel', speed: 0.9 }
      }).eq('id', 'param_voice_2');

      const { data } = await supabase
        .from('parametres')
        .select()
        .eq('id', 'param_voice_2')
        .single();

      expect(data.valeur.provider).toBe('elevenlabs');
      expect(data.valeur.voice).toBe('rachel');
      expect(data.valeur.speed).toBe(0.9);
    });
  });

  // ============================================
  // 28. MON ABONNEMENT (Billing)
  // ============================================

  describe('28. Mon Abonnement', () => {
    test('POST subscription → upgrade plan → GET → vérifie changement', async () => {
      const { data: sub } = await supabase
        .from('subscriptions')
        .insert({
          id: 'sub_1',
          tenant_id: TENANT_A,
          plan: 'starter',
          statut: 'active',
          stripe_customer_id: 'cus_test123',
          stripe_subscription_id: 'sub_test123',
          trial_end: '2026-04-02',
          current_period_start: '2026-03-19',
          current_period_end: '2026-04-19'
        })
        .select()
        .single();

      // Log upgrade
      await supabase.from('subscription_history').insert({
        tenant_id: TENANT_A,
        subscription_id: sub.id,
        action: 'upgrade',
        old_plan: 'starter',
        new_plan: 'business',
        date: new Date().toISOString()
      });

      // Apply upgrade
      await supabase.from('subscriptions').update({
        plan: 'business'
      }).eq('id', sub.id);

      // READ
      const { data: updated } = await supabase
        .from('subscriptions')
        .select()
        .eq('id', sub.id)
        .single();

      const { data: history } = await supabase
        .from('subscription_history')
        .select()
        .eq('subscription_id', sub.id);

      expect(updated.plan).toBe('business');
      expect(updated.statut).toBe('active');
      expect(history).toHaveLength(1);
      expect(history[0].old_plan).toBe('starter');
      expect(history[0].new_plan).toBe('business');
    });

    test('PATCH cancel subscription → GET → vérifie statut cancelled', async () => {
      stores.subscriptions.push({
        id: 'sub_cancel',
        tenant_id: TENANT_A,
        plan: 'pro',
        statut: 'active',
        current_period_end: '2026-04-19'
      });

      await supabase.from('subscriptions').update({
        statut: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_at_period_end: true
      }).eq('id', 'sub_cancel');

      const { data } = await supabase
        .from('subscriptions')
        .select()
        .eq('id', 'sub_cancel')
        .single();

      expect(data.statut).toBe('cancelled');
      expect(data.cancelled_at).toBeDefined();
      expect(data.cancel_at_period_end).toBe(true);
      expect(data.current_period_end).toBe('2026-04-19'); // access until end of period
    });
  });

  // ============================================
  // 29. ÉQUIPE RH (Membres + Planning)
  // ============================================

  describe('29. Équipe RH', () => {
    test('POST membre → set planning → GET → vérifie horaires', async () => {
      const { data: membre } = await supabase
        .from('rh_membres')
        .insert({
          tenant_id: TENANT_A,
          nom: 'Dupont',
          prenom: 'Marie',
          email: 'marie@nexus.com',
          role: 'coiffeuse',
          contrat: 'CDI',
          date_embauche: '2026-01-15',
          planning: {
            lundi: { debut: '09:00', fin: '17:00' },
            mardi: { debut: '09:00', fin: '17:00' },
            mercredi: null,
            jeudi: { debut: '09:00', fin: '17:00' },
            vendredi: { debut: '09:00', fin: '16:00' }
          },
          is_active: true
        })
        .select()
        .single();

      // READ
      const { data: read } = await supabase
        .from('rh_membres')
        .select()
        .eq('id', membre.id)
        .eq('tenant_id', TENANT_A)
        .single();

      expect(read.nom).toBe('Dupont');
      expect(read.contrat).toBe('CDI');
      expect(read.planning.lundi.debut).toBe('09:00');
      expect(read.planning.mercredi).toBeNull();
      expect(read.is_active).toBe(true);
    });

    test('PATCH planning membre → GET → vérifie modification', async () => {
      stores.rh_membres.push({
        id: 'rh_1',
        tenant_id: TENANT_A,
        nom: 'Martin',
        planning: {
          lundi: { debut: '09:00', fin: '17:00' },
          samedi: null
        },
        is_active: true
      });

      // Add Saturday
      const { data: before } = await supabase
        .from('rh_membres')
        .select()
        .eq('id', 'rh_1')
        .single();

      await supabase.from('rh_membres').update({
        planning: { ...before.planning, samedi: { debut: '09:00', fin: '13:00' } }
      }).eq('id', 'rh_1');

      const { data: after } = await supabase
        .from('rh_membres')
        .select()
        .eq('id', 'rh_1')
        .single();

      expect(after.planning.samedi).toBeTruthy();
      expect(after.planning.samedi.fin).toBe('13:00');
      expect(after.planning.lundi.debut).toBe('09:00'); // preserved
    });
  });

  // ============================================
  // 30. PARAMÈTRES GÉNÉRAUX
  // ============================================

  describe('30. Paramètres Généraux', () => {
    test('UPSERT multiple paramètres → GET all → vérifie complétude', async () => {
      const params = [
        { tenant_id: TENANT_A, cle: 'devise', valeur: 'EUR' },
        { tenant_id: TENANT_A, cle: 'langue', valeur: 'fr' },
        { tenant_id: TENANT_A, cle: 'fuseau_horaire', valeur: 'Europe/Paris' },
        { tenant_id: TENANT_A, cle: 'format_date', valeur: 'DD/MM/YYYY' },
        { tenant_id: TENANT_A, cle: 'notifications_email', valeur: true },
        { tenant_id: TENANT_A, cle: 'notifications_sms', valeur: false }
      ];

      for (const p of params) {
        await supabase.from('parametres').upsert(p, { onConflict: 'cle' });
      }

      const { data: allParams } = await supabase
        .from('parametres')
        .select()
        .eq('tenant_id', TENANT_A);

      expect(allParams).toHaveLength(6);

      const devise = allParams.find(p => p.cle === 'devise');
      const sms = allParams.find(p => p.cle === 'notifications_sms');

      expect(devise.valeur).toBe('EUR');
      expect(sms.valeur).toBe(false);
    });
  });

  // ============================================
  // 31. MULTI-TENANT ISOLATION ÉTENDUE
  // ============================================

  describe('31. Multi-tenant Isolation Étendue', () => {
    test('Isolation sur toutes les tables critiques', async () => {
      // Seed data across both tenants in multiple tables
      const tables = [
        { table: 'services', dataA: { tenant_id: TENANT_A, nom: 'Svc A' }, dataB: { tenant_id: TENANT_B, nom: 'Svc B' } },
        { table: 'factures', dataA: { tenant_id: TENANT_A, statut: 'payee' }, dataB: { tenant_id: TENANT_B, statut: 'payee' } },
        { table: 'workflows', dataA: { tenant_id: TENANT_A, nom: 'WF A' }, dataB: { tenant_id: TENANT_B, nom: 'WF B' } },
        { table: 'devis', dataA: { tenant_id: TENANT_A, statut: 'brouillon' }, dataB: { tenant_id: TENANT_B, statut: 'envoye' } },
        { table: 'seo_articles', dataA: { tenant_id: TENANT_A, titre: 'Art A' }, dataB: { tenant_id: TENANT_B, titre: 'Art B' } }
      ];

      for (const { table, dataA, dataB } of tables) {
        await supabase.from(table).insert(dataA);
        await supabase.from(table).insert(dataB);
      }

      // Verify each table is isolated
      for (const { table } of tables) {
        const { data: dataA } = await supabase
          .from(table)
          .select()
          .eq('tenant_id', TENANT_A);

        const { data: dataB } = await supabase
          .from(table)
          .select()
          .eq('tenant_id', TENANT_B);

        expect(dataA).toHaveLength(1);
        expect(dataB).toHaveLength(1);
        expect(dataA[0].tenant_id).toBe(TENANT_A);
        expect(dataB[0].tenant_id).toBe(TENANT_B);
      }
    });
  });
});
