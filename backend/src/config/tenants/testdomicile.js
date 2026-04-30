/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TENANT CONFIG: Pro Plombier IDF (test-domicile)
 * Type: service_domicile — Frais de déplacement, adresse client, intervenant
 * ═══════════════════════════════════════════════════════════════════════════
 */

export default {
  // Identité
  id: 'test-domicile',
  name: 'Pro Plombier IDF',
  domain: 'pro-plombier.test',

  // Assistant IA
  assistantName: 'Paul',
  gerante: 'Paul',

  // Coordonnées
  adresse: '22 rue de la République, 93100 Montreuil',
  telephone: '01 56 78 90 12',
  email: 'contact@pro-plombier.test',

  // Type métier
  business_type: 'service_domicile',
  businessProfile: 'plombier',
  pricingMode: 'fixed',

  // Terminologie
  terminology: {
    reservation: { singular: 'Intervention', plural: 'Interventions' },
    service: { singular: 'Prestation', plural: 'Prestations' },
    client: { singular: 'Client', plural: 'Clients' },
    employee: { singular: 'Intervenant', plural: 'Intervenants' },
  },

  // Localisation
  location: {
    mode: 'mobile',
    base_address: '22 rue de la République, 93100 Montreuil',
    zone: 'Île-de-France',
    travel_fees: {
      enabled: true,
      free_radius_km: 5,
      price_per_km: 50, // centimes (0.50€/km)
    },
  },

  // Contact
  contact: {
    phone: '01 56 78 90 12',
    email: 'contact@pro-plombier.test',
  },

  // Services plomberie
  services: {
    DEPANNAGE_URGENT: {
      id: 'depannage_urgent',
      name: 'Dépannage urgent',
      category: 'depannage',
      price: 90,
      priceInCents: 9000,
      durationMinutes: 60,
      blocksFullDay: false,
    },
    FUITE_EAU: {
      id: 'fuite_eau',
      name: 'Réparation fuite d\'eau',
      category: 'depannage',
      price: 120,
      priceInCents: 12000,
      durationMinutes: 90,
      blocksFullDay: false,
    },
    DEBOUCHAGE: {
      id: 'debouchage',
      name: 'Débouchage canalisation',
      category: 'depannage',
      price: 80,
      priceInCents: 8000,
      durationMinutes: 60,
      blocksFullDay: false,
    },
    INSTALL_ROBINET: {
      id: 'install_robinet',
      name: 'Installation robinetterie',
      category: 'installation',
      price: 150,
      priceInCents: 15000,
      durationMinutes: 120,
      blocksFullDay: false,
    },
    INSTALL_WC: {
      id: 'install_wc',
      name: 'Installation WC / sanitaire',
      category: 'installation',
      price: 250,
      priceInCents: 25000,
      durationMinutes: 180,
      blocksFullDay: false,
    },
    INSTALL_CHAUFFE_EAU: {
      id: 'install_chauffe_eau',
      name: 'Installation chauffe-eau',
      category: 'installation',
      price: 350,
      priceInCents: 35000,
      durationMinutes: 240,
      blocksFullDay: false,
    },
    DETARTRAGE: {
      id: 'detartrage',
      name: 'Détartrage ballon / tuyauterie',
      category: 'entretien',
      price: 100,
      priceInCents: 10000,
      durationMinutes: 90,
      blocksFullDay: false,
    },
    DIAGNOSTIC: {
      id: 'diagnostic',
      name: 'Diagnostic complet plomberie',
      category: 'entretien',
      price: 60,
      priceInCents: 6000,
      durationMinutes: 60,
      blocksFullDay: false,
    },
  },

  // Frais de déplacement
  travelFees: {
    BASE_DISTANCE_KM: 5,
    BASE_FEE: 0,
    BASE_FEE_CENTS: 0,
    PER_KM_BEYOND: 0.50,
    PER_KM_BEYOND_CENTS: 50,
  },

  // Service options
  serviceOptions: {
    DOMICILE_ENABLED: true,
    domicile_enabled: true,
  },

  // Horaires
  businessHours: {
    0: null, // Dimanche
    1: { open: '08:00', close: '18:00' },
    2: { open: '08:00', close: '18:00' },
    3: { open: '08:00', close: '18:00' },
    4: { open: '08:00', close: '18:00' },
    5: { open: '08:00', close: '18:00' },
    6: { open: '09:00', close: '14:00' }, // Samedi matin
  },
  daysOpen: [1, 2, 3, 4, 5, 6],

  horairesTexte: `• Lundi au Vendredi : 8h - 18h
• Samedi : 9h - 14h
• Dimanche : Fermé`,

  // Règles de réservation
  bookingRules: {
    MIN_ADVANCE_HOURS: 2,
    MAX_ADVANCE_DAYS: 30,
    DEPOSIT_PERCENT: 0, // Pas d'acompte pour plomberie
    FREE_CANCELLATION_HOURS: 24,
  },

  // Personnalité assistant
  personality: {
    tutoiement: false,
    ton: 'professionnel',
    emojis: 'peu',
    description: 'Professionnel, rassurant, efficace',
  },

  // Statut
  frozen: false,

  // Features
  features: {
    travelFees: true,
    clientAddress: true,
    multiStaff: false,
    onlineBooking: true,
    deposits: false,
    reservations: true,
    reservations_web: true,
    reservations_chat: true,
    reservations_admin: true,
    services_domicile: true,
    assistant_chat: true,
    dashboard_admin: true,
    accounting: true,
    rh: false,
  },

  // Limites
  limits: {
    maxReservationsPerDay: 8,
    maxSmsPerMonth: 200,
    maxAiCallsPerDay: 50,
  },
};
