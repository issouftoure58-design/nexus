/**
 * Configuration tenant : Test NEXUS Platform
 * Tenant de test avec toutes les features activees (plan Business)
 *
 * Ce fichier contient la config metier pour les tests pre-commercialisation.
 * NON FROZEN - Modifications autorisees.
 */

const tenant = {
  // === IDENTITE ===
  id: 'nexus-test',
  name: 'Test NEXUS Platform',
  domain: 'test.nexus.dev',
  assistantName: 'TestBot',
  gerante: 'Admin Test',
  adresse: '123 rue du Test, 75001 Paris',
  telephone: '+33 6 12 34 56 78',
  concept: 'Plateforme de test NEXUS - Services professionnels',
  peutRecevoirChezElle: true,
  secteur: 'Services',
  ville: 'Paris',

  // === BRANDING ===
  branding: {
    logoUrl: '/assets/tenants/tenant-3/logo.svg',
    faviconUrl: '/assets/tenants/tenant-3/favicon.png',
    primaryColor: '#3B82F6',
    accentColor: '#8B5CF6',
  },

  // === SERVICES ===
  services: {
    CONSULTATION_STANDARD: {
      id: 'consultation_standard',
      name: 'Consultation Standard',
      category: 'consultation',
      price: 50,
      priceInCents: 5000,
      priceIsMinimum: false,
      durationMinutes: 60,
      blocksFullDay: false,
      blocksDays: 1,
    },
    CONSULTATION_EXPRESS: {
      id: 'consultation_express',
      name: 'Consultation Express',
      category: 'consultation',
      price: 30,
      priceInCents: 3000,
      priceIsMinimum: false,
      durationMinutes: 30,
      blocksFullDay: false,
      blocksDays: 1,
    },
    DIAGNOSTIC_COMPLET: {
      id: 'diagnostic_complet',
      name: 'Diagnostic Complet',
      category: 'diagnostic',
      price: 120,
      priceInCents: 12000,
      priceIsMinimum: false,
      durationMinutes: 120,
      blocksFullDay: false,
      blocksDays: 1,
    },
    FORMATION_INITIALE: {
      id: 'formation_initiale',
      name: 'Formation Initiale',
      category: 'formation',
      price: 150,
      priceInCents: 15000,
      priceIsMinimum: false,
      durationMinutes: 90,
      blocksFullDay: false,
      blocksDays: 1,
    },
    AUDIT_APPROFONDI: {
      id: 'audit_approfondi',
      name: 'Audit Approfondi',
      category: 'audit',
      price: 250,
      priceInCents: 25000,
      priceIsMinimum: false,
      durationMinutes: 180,
      blocksFullDay: true,
      blocksDays: 1,
    },
    ACCOMPAGNEMENT_PREMIUM: {
      id: 'accompagnement_premium',
      name: 'Accompagnement Premium',
      category: 'accompagnement',
      price: 350,
      priceInCents: 35000,
      priceIsMinimum: false,
      durationMinutes: 240,
      blocksFullDay: true,
      blocksDays: 1,
    },
    PACK_DEMARRAGE: {
      id: 'pack_demarrage',
      name: 'Pack Demarrage',
      category: 'package',
      price: 450,
      priceInCents: 45000,
      priceIsMinimum: false,
      durationMinutes: 180,
      blocksFullDay: true,
      blocksDays: 1,
    },
    PACK_PRO: {
      id: 'pack_pro',
      name: 'Pack Pro',
      category: 'package',
      price: 800,
      priceInCents: 80000,
      priceIsMinimum: false,
      durationMinutes: 300,
      blocksFullDay: true,
      blocksDays: 2,
    },
    INTERVENTION_URGENTE: {
      id: 'intervention_urgente',
      name: 'Intervention Urgente',
      category: 'urgence',
      price: 200,
      priceInCents: 20000,
      priceIsMinimum: false,
      durationMinutes: 60,
      blocksFullDay: false,
      blocksDays: 1,
    },
    SUIVI_MENSUEL: {
      id: 'suivi_mensuel',
      name: 'Suivi Mensuel',
      category: 'suivi',
      price: 500,
      priceInCents: 50000,
      priceIsMinimum: false,
      durationMinutes: 120,
      blocksFullDay: false,
      blocksDays: 1,
    },
  },

  // === FRAIS DE DEPLACEMENT ===
  travelFees: {
    BASE_DISTANCE_KM: 10,
    BASE_FEE: 0,
    BASE_FEE_CENTS: 0,
    PER_KM_BEYOND: 1.00,
    PER_KM_BEYOND_CENTS: 100,
  },

  // === HORAIRES ===
  businessHours: {
    0: null, // Dimanche
    1: { open: '09:00', close: '18:00' }, // Lundi
    2: { open: '09:00', close: '18:00' }, // Mardi
    3: { open: '09:00', close: '18:00' }, // Mercredi
    4: { open: '09:00', close: '18:00' }, // Jeudi
    5: { open: '09:00', close: '18:00' }, // Vendredi
    6: { open: '10:00', close: '16:00' }, // Samedi
  },
  daysOpen: [1, 2, 3, 4, 5, 6],

  // === REGLES DE RESERVATION ===
  bookingRules: {
    MIN_ADVANCE_HOURS: 24,
    MAX_ADVANCE_DAYS: 90,
    DEPOSIT_PERCENT: 30,
    FREE_CANCELLATION_HOURS: 48,
    FULL_DAY_START_HOUR: 9,
    FULL_DAY_START_TIME: '09:00',
  },

  // === OPTIONS DE SERVICE ===
  serviceOptions: {
    DOMICILE_ENABLED: true,
    DOMICILE_DISABLED_MESSAGE: null,
  },

  // === STATUTS BLOQUANTS ===
  blockingStatuts: ['demande', 'confirme', 'en_attente', 'en_attente_paiement'],

  // === PERSONNALITE DE L'ASSISTANT ===
  personality: {
    tutoiement: false,
    ton: 'professionnel',
    emojis: 'moderation',
    description: 'Professionnel, efficace, bienveillant',
  },

  // === HORAIRES FORMATES ===
  horairesTexte: `• Lundi : 9h - 18h
• Mardi : 9h - 18h
• Mercredi : 9h - 18h
• Jeudi : 9h - 18h
• Vendredi : 9h - 18h
• Samedi : 10h - 16h
• Dimanche : Ferme`,

  // === PROTECTION PRODUCTION ===
  frozen: false,
  lastStableDate: null,
  nexusVersion: '1.0.0',

  // === FEATURES ACTIVES (TOUTES pour Business) ===
  features: {
    // Core
    reservations: true,
    reservations_web: true,
    reservations_telephone: true,
    reservations_chat: true,
    reservations_whatsapp: true,
    reservations_admin: true,
    services_variables: true,
    services_domicile: true,

    // Notifications
    sms_confirmation: true,
    sms_rappel_j1: true,
    sms_remerciement: true,
    email_notifications: true,
    push_notifications: true,

    // AI
    assistant_telephone: true,
    assistant_chat: true,
    assistant_whatsapp: true,
    voice_synthesis: true,
    sentiment_analysis: true,

    // Admin
    dashboard_admin: true,
    dashboard_stats: true,
    multi_users: true,
    roles_permissions: true,

    // Modules avances
    accounting: true,
    commerce_catalogue: true,
    commerce_stock: true,
    commerce_ventes: true,
    marketing: true,
    marketing_campaigns: true,
    marketing_social: true,
    seo: true,
    seo_analysis: true,
    seo_recommendations: true,
    rh: true,
    rh_employees: true,
    rh_planning: true,
    rh_payroll: true,
    sentinel_client: true,

    // Analytics
    predictions: true,
    churn_prevention: true,
    forecast: true,
    cohort_analysis: true,

    // Integrations
    google_calendar: true,
    stripe: true,
    mailchimp: true,
    zapier: true,
  },

  // === LIMITES (elevees pour test) ===
  limits: {
    maxReservationsPerDay: 1000,
    maxSmsPerMonth: 10000,
    maxAiCallsPerDay: 1000,
    maxUsers: 20,
    maxStorageGB: 100,
  },
};

export default tenant;
