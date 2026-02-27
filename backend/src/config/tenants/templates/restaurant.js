/**
 * Template Tenant: Restaurant / Bar
 *
 * Pour: Restaurant, brasserie, café, bar, pizzeria, etc.
 *
 * Caractéristiques:
 * - Gestion de tables et couverts
 * - Créneaux midi/soir
 * - Pas de tarification par prestation
 * - Demande de nombre de personnes
 */

export const RESTAURANT_TEMPLATE = {
  // ═══════════════════════════════════════════════════════════════
  // IDENTITÉ
  // ═══════════════════════════════════════════════════════════════
  id: '', // À définir
  name: '', // À définir
  business_type: 'restaurant',

  // ═══════════════════════════════════════════════════════════════
  // TERMINOLOGIE
  // ═══════════════════════════════════════════════════════════════
  terminology: {
    reservation: { singular: 'Réservation', plural: 'Réservations' },
    service: { singular: 'Table', plural: 'Tables' },
    client: { singular: 'Client', plural: 'Clients' },
    employee: { singular: 'Serveur', plural: 'Serveurs' }
  },

  // ═══════════════════════════════════════════════════════════════
  // FEATURES ACTIVÉES
  // ═══════════════════════════════════════════════════════════════
  features: {
    travel_fees: false,
    client_address: false,
    multi_staff: true,
    table_management: true,
    covers: true,
    online_booking: true,
    deposits: false,
    sms_notifications: true,
    whatsapp: true,
    voice_ai: true
  },

  // ═══════════════════════════════════════════════════════════════
  // LOCALISATION
  // ═══════════════════════════════════════════════════════════════
  location: {
    mode: 'fixed',
    address: '',
    city: '',
    postal_code: '',
    coordinates: {
      lat: null,
      lng: null
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // CONTACT
  // ═══════════════════════════════════════════════════════════════
  contact: {
    phone: '',
    whatsapp: '',
    email: ''
  },

  // ═══════════════════════════════════════════════════════════════
  // URLs
  // ═══════════════════════════════════════════════════════════════
  urls: {
    frontend: '',
    booking: '/reserver',
    menu: '/carte',
    reviews: '/avis'
  },

  // ═══════════════════════════════════════════════════════════════
  // ASSISTANT IA
  // ═══════════════════════════════════════════════════════════════
  assistant: {
    name: 'Nexus',
    voice_id: 'FFXYdAYPzn8Tw8KiHZqg',
    personality: 'professional',
    language: 'fr'
  },

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION RESTAURANT
  // ═══════════════════════════════════════════════════════════════
  restaurant: {
    service_types: ['midi', 'soir'],
    services: {
      midi: { debut: '12:00', fin: '14:30', last_booking: '14:00' },
      soir: { debut: '19:00', fin: '22:30', last_booking: '21:30' }
    },
    slot_duration: 90, // Durée moyenne d'un repas en minutes
    max_covers_per_slot: 50, // Capacité max par créneau
    total_capacity: 60, // Capacité totale du restaurant
    zones: ['interieur', 'terrasse', 'salon_prive']
  },

  // ═══════════════════════════════════════════════════════════════
  // HORAIRES D'OUVERTURE
  // ═══════════════════════════════════════════════════════════════
  horaires: {
    lundi: { ouvert: false, debut: null, fin: null },
    mardi: { ouvert: true, midi: true, soir: true },
    mercredi: { ouvert: true, midi: true, soir: true },
    jeudi: { ouvert: true, midi: true, soir: true },
    vendredi: { ouvert: true, midi: true, soir: true },
    samedi: { ouvert: true, midi: true, soir: true },
    dimanche: { ouvert: true, midi: true, soir: false }
  },

  // ═══════════════════════════════════════════════════════════════
  // RÈGLES DE RÉSERVATION
  // ═══════════════════════════════════════════════════════════════
  booking_rules: {
    min_advance_hours: 1,
    max_advance_days: 30,
    min_covers: 1,
    max_covers: 20, // Au-delà, contacter le restaurant
    require_phone: true,
    confirmation_required: true,
    no_show_policy: 'Merci de prévenir en cas d\'annulation',
    large_group_threshold: 8 // À partir de 8, demander confirmation
  },

  // ═══════════════════════════════════════════════════════════════
  // TABLES PAR DÉFAUT (exemple)
  // ═══════════════════════════════════════════════════════════════
  default_tables: [
    { numero: '1', capacite_min: 2, capacite_max: 2, zone: 'terrasse' },
    { numero: '2', capacite_min: 2, capacite_max: 2, zone: 'terrasse' },
    { numero: '3', capacite_min: 2, capacite_max: 4, zone: 'interieur' },
    { numero: '4', capacite_min: 4, capacite_max: 4, zone: 'interieur' },
    { numero: '5', capacite_min: 4, capacite_max: 6, zone: 'interieur' },
    { numero: '6', capacite_min: 6, capacite_max: 8, zone: 'interieur' },
    { numero: 'Salon', capacite_min: 8, capacite_max: 20, zone: 'salon_prive' }
  ]
};

export default RESTAURANT_TEMPLATE;
