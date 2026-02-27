/**
 * Template Tenant: Hôtel / Hébergement
 *
 * Pour: Hôtel, gîte, chambre d'hôtes, location saisonnière,
 * résidence de tourisme, etc.
 *
 * Caractéristiques:
 * - Gestion de chambres/logements
 * - Check-in / Check-out
 * - Tarification à la nuitée
 * - Extras et services additionnels
 */

export const HOTEL_TEMPLATE = {
  // ═══════════════════════════════════════════════════════════════
  // IDENTITÉ
  // ═══════════════════════════════════════════════════════════════
  id: '', // À définir
  name: '', // À définir
  business_type: 'hotel',

  // ═══════════════════════════════════════════════════════════════
  // TERMINOLOGIE
  // ═══════════════════════════════════════════════════════════════
  terminology: {
    reservation: { singular: 'Réservation', plural: 'Réservations' },
    service: { singular: 'Chambre', plural: 'Chambres' },
    client: { singular: 'Hôte', plural: 'Hôtes' },
    employee: { singular: 'Réceptionniste', plural: 'Réceptionnistes' }
  },

  // ═══════════════════════════════════════════════════════════════
  // FEATURES ACTIVÉES
  // ═══════════════════════════════════════════════════════════════
  features: {
    travel_fees: false,
    client_address: false,
    multi_staff: true,
    room_inventory: true,
    checkin_checkout: true,
    extras: true,
    online_booking: true,
    deposits: true,
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
    },
    nearby: [] // Points d'intérêt à proximité
  },

  // ═══════════════════════════════════════════════════════════════
  // CONTACT
  // ═══════════════════════════════════════════════════════════════
  contact: {
    phone: '',
    whatsapp: '',
    email: '',
    reception_hours: '24h/24' // ou "8h-22h"
  },

  // ═══════════════════════════════════════════════════════════════
  // URLs
  // ═══════════════════════════════════════════════════════════════
  urls: {
    frontend: '',
    booking: '/reserver',
    rooms: '/chambres',
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
  // CONFIGURATION HÔTEL
  // ═══════════════════════════════════════════════════════════════
  hotel: {
    checkin_time: '15:00',
    checkout_time: '11:00',
    early_checkin_fee: 2000, // centimes
    late_checkout_fee: 2500, // centimes
    min_nights: 1,
    max_nights: 30,
    stars: null, // 1-5 ou null si non classé
    room_types: ['simple', 'double', 'twin', 'suite', 'familiale']
  },

  // ═══════════════════════════════════════════════════════════════
  // RÈGLES DE RÉSERVATION
  // ═══════════════════════════════════════════════════════════════
  booking_rules: {
    min_advance_hours: 0, // Réservation le jour même possible
    max_advance_days: 365, // 1 an à l'avance
    require_credit_card: true,
    require_deposit: true,
    deposit_type: 'first_night', // 'first_night', 'percentage', 'fixed'
    deposit_percentage: 100, // 100% de la première nuit
    cancellation_policy: 'flexible', // 'flexible', 'moderate', 'strict'
    cancellation_free_hours: 48, // Annulation gratuite jusqu'à 48h avant
    no_show_fee: 100 // % de la première nuit
  },

  // ═══════════════════════════════════════════════════════════════
  // EXTRAS DISPONIBLES
  // ═══════════════════════════════════════════════════════════════
  default_extras: [
    {
      code: 'petit_dejeuner',
      nom: 'Petit-déjeuner',
      prix: 1500, // centimes
      prix_type: 'per_person', // per_night, per_stay, per_person
      description: 'Buffet petit-déjeuner de 7h à 10h'
    },
    {
      code: 'parking',
      nom: 'Parking privé',
      prix: 1500,
      prix_type: 'per_night',
      description: 'Place de parking sécurisée'
    },
    {
      code: 'lit_bebe',
      nom: 'Lit bébé',
      prix: 0,
      prix_type: 'per_stay',
      description: 'Sur demande, gratuit'
    },
    {
      code: 'late_checkout',
      nom: 'Départ tardif (14h)',
      prix: 2500,
      prix_type: 'per_stay',
      description: 'Sous réserve de disponibilité'
    }
  ],

  // ═══════════════════════════════════════════════════════════════
  // CHAMBRES PAR DÉFAUT (exemple)
  // ═══════════════════════════════════════════════════════════════
  default_rooms: [
    {
      numero: '101',
      type: 'double',
      nom: 'Chambre Confort',
      capacite_max: 2,
      prix_nuit: 9900, // 99€
      etage: 1,
      vue: 'jardin',
      equipements: ['wifi', 'tv', 'climatisation', 'coffre']
    },
    {
      numero: '102',
      type: 'twin',
      nom: 'Chambre Twin',
      capacite_max: 2,
      prix_nuit: 9900,
      etage: 1,
      vue: 'rue',
      equipements: ['wifi', 'tv', 'climatisation']
    },
    {
      numero: '201',
      type: 'suite',
      nom: 'Suite Prestige',
      capacite_max: 4,
      prix_nuit: 19900, // 199€
      etage: 2,
      vue: 'mer',
      superficie_m2: 45,
      equipements: ['wifi', 'tv', 'climatisation', 'coffre', 'minibar', 'balcon']
    }
  ]
};

export default HOTEL_TEMPLATE;
