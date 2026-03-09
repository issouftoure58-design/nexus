/**
 * Jest Test Setup
 * Global mocks and test utilities
 */

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.NODE_ENV = 'test';

// Global test utilities
global.testUtils = {
  // Generate mock tenant ID
  generateTenantId: () => `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,

  // Generate mock user
  generateUser: (overrides = {}) => ({
    id: `user_${Date.now()}`,
    tenant_id: global.testUtils.generateTenantId(),
    email: 'test@example.com',
    role: 'admin',
    plan: 'business',
    ...overrides
  }),

  // Generate mock client
  generateClient: (tenantId, overrides = {}) => ({
    id: `client_${Date.now()}`,
    tenant_id: tenantId,
    nom: 'Dupont',
    prenom: 'Jean',
    email: 'jean.dupont@example.com',
    telephone: '+33612345678',
    created_at: new Date().toISOString(),
    ...overrides
  }),

  // Generate mock reservation
  generateReservation: (tenantId, clientId, overrides = {}) => ({
    id: `rdv_${Date.now()}`,
    tenant_id: tenantId,
    client_id: clientId,
    date: '2024-03-15',
    heure: '10:00',
    duree: 60,
    statut: 'confirme',
    service_name: 'Coupe homme',
    created_at: new Date().toISOString(),
    ...overrides
  }),

  // Generate mock API key
  generateApiKey: (tenantId, overrides = {}) => ({
    id: `key_${Date.now()}`,
    tenant_id: tenantId,
    name: 'Test API Key',
    key_prefix: 'nxs_prod_abc',
    scopes: ['read:clients', 'read:reservations'],
    rate_limit_per_hour: 1000,
    is_active: true,
    ...overrides
  }),

  // Generate mock snapshot
  generateSnapshot: (tenantId, date, overrides = {}) => ({
    id: `snap_${Date.now()}`,
    tenant_id: tenantId,
    date,
    total_clients: 100,
    new_clients: 5,
    total_reservations: 25,
    revenue_paid: 1500,
    no_show_rate: 5.5,
    ...overrides
  }),

  // Sleep utility
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // ═══════════════════════════════════════════════════════════════════════
  // Restaurant generators
  // ═══════════════════════════════════════════════════════════════════════

  generateMenuCategory: (tenantId, overrides = {}) => ({
    id: Math.floor(Math.random() * 100000),
    tenant_id: tenantId,
    nom: 'Entrées',
    description: 'Nos entrées du moment',
    ordre: 1,
    actif: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }),

  generatePlat: (tenantId, categorieId, overrides = {}) => ({
    id: Math.floor(Math.random() * 100000),
    tenant_id: tenantId,
    nom: 'Salade César',
    description: 'Laitue romaine, parmesan, croûtons',
    prix: 14.50,
    categorie_id: categorieId,
    menu_categories: { id: categorieId, nom: 'Entrées' },
    allergenes: ['gluten', 'lactose'],
    regime: ['vegetarien'],
    disponible_midi: true,
    disponible_soir: true,
    plat_du_jour: false,
    stock_limite: false,
    stock_quantite: 0,
    image_url: null,
    ordre: 1,
    actif: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }),

  generateMenuDuJour: (tenantId, overrides = {}) => ({
    id: Math.floor(Math.random() * 100000),
    tenant_id: tenantId,
    date: new Date().toISOString().split('T')[0],
    service: 'midi_soir',
    formule_entree_plat: 18,
    formule_plat_dessert: 18,
    formule_complete: 24,
    entrees: [],
    plats: [],
    desserts: [],
    notes: null,
    actif: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  }),

  generateRestaurantTenant: (overrides = {}) => ({
    id: `resto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: 'Le Bistrot Parisien',
    business_type: 'restaurant',
    plan: 'business',
    ...overrides
  }),

  // ═══════════════════════════════════════════════════════════════════════
  // Hotel generators
  // ═══════════════════════════════════════════════════════════════════════

  generateChambre: (tenantId, overrides = {}) => ({
    id: Math.floor(Math.random() * 100000),
    tenant_id: tenantId,
    nom: 'Chambre Deluxe 101',
    type_chambre: 'double',
    capacite: 2,
    prix: 120,
    actif: true,
    created_at: new Date().toISOString(),
    ...overrides
  }),

  generateTarifSaisonnier: (tenantId, serviceId, overrides = {}) => ({
    id: Math.floor(Math.random() * 100000),
    tenant_id: tenantId,
    service_id: serviceId,
    nom: 'Haute saison été',
    date_debut: '2026-06-01',
    date_fin: '2026-08-31',
    prix_nuit: 180,
    prix_weekend: 220,
    prix_semaine: null,
    petit_dejeuner_inclus: true,
    prix_petit_dejeuner: 15,
    duree_min_nuits: 2,
    actif: true,
    created_at: new Date().toISOString(),
    ...overrides
  }),

  generateOccupation: (tenantId, serviceId, overrides = {}) => ({
    id: Math.floor(Math.random() * 100000),
    tenant_id: tenantId,
    service_id: serviceId,
    date_occupation: new Date().toISOString().split('T')[0],
    statut: 'reservee',
    notes: null,
    ...overrides
  }),

  generateHotelTenant: (overrides = {}) => ({
    id: `hotel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: 'Hôtel Le Grand Paris',
    business_type: 'hotel',
    plan: 'business',
    ...overrides
  })
};

// Suppress console logs during tests (optional)
if (process.env.SUPPRESS_LOGS === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn()
  };
}
