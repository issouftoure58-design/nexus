/**
 * Template Tenant: Service à Domicile
 *
 * Pour: Coiffure à domicile, plombier, électricien, coach sportif,
 * infirmier libéral, aide à domicile, etc.
 *
 * Caractéristiques:
 * - Déplacement chez le client
 * - Frais de déplacement
 * - Adresse client obligatoire
 * - Généralement 1 seul intervenant
 */

export const SERVICE_DOMICILE_TEMPLATE = {
  // ═══════════════════════════════════════════════════════════════
  // IDENTITÉ
  // ═══════════════════════════════════════════════════════════════
  id: '', // À définir
  name: '', // À définir
  business_type: 'service_domicile',

  // ═══════════════════════════════════════════════════════════════
  // TERMINOLOGIE (peut être personnalisée)
  // ═══════════════════════════════════════════════════════════════
  terminology: {
    reservation: { singular: 'RDV', plural: 'RDV' },
    service: { singular: 'Prestation', plural: 'Prestations' },
    client: { singular: 'Client', plural: 'Clients' },
    employee: { singular: 'Intervenant', plural: 'Intervenants' }
  },

  // ═══════════════════════════════════════════════════════════════
  // FEATURES ACTIVÉES
  // ═══════════════════════════════════════════════════════════════
  features: {
    travel_fees: true,
    client_address: true,
    multi_staff: false,
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
    mode: 'mobile', // mobile | fixed | both
    base_address: '', // Adresse de départ pour calcul distance
    zone: '', // Zone de couverture (ex: "Île-de-France")
    travel_fees: {
      enabled: true,
      free_radius_km: 5,
      price_per_km: 50 // centimes
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
    payment: '/paiement',
    reviews: '/avis'
  },

  // ═══════════════════════════════════════════════════════════════
  // ASSISTANT IA
  // ═══════════════════════════════════════════════════════════════
  assistant: {
    name: 'Nexus', // Personnalisable
    voice_id: 'FFXYdAYPzn8Tw8KiHZqg', // ElevenLabs
    personality: 'friendly', // friendly | professional | casual
    language: 'fr'
  },

  // ═══════════════════════════════════════════════════════════════
  // HORAIRES
  // ═══════════════════════════════════════════════════════════════
  horaires: {
    lundi: { ouvert: true, debut: '09:00', fin: '19:00' },
    mardi: { ouvert: true, debut: '09:00', fin: '19:00' },
    mercredi: { ouvert: true, debut: '09:00', fin: '19:00' },
    jeudi: { ouvert: true, debut: '09:00', fin: '19:00' },
    vendredi: { ouvert: true, debut: '09:00', fin: '19:00' },
    samedi: { ouvert: true, debut: '09:00', fin: '17:00' },
    dimanche: { ouvert: false, debut: null, fin: null }
  },

  // ═══════════════════════════════════════════════════════════════
  // RÈGLES DE RÉSERVATION
  // ═══════════════════════════════════════════════════════════════
  booking_rules: {
    min_advance_hours: 24, // Réserver au moins 24h à l'avance
    max_advance_days: 60, // Pas plus de 60 jours à l'avance
    slot_duration: 30, // Créneaux de 30 min
    buffer_between: 15, // 15 min entre RDV
    require_deposit: false,
    deposit_percentage: 30,
    cancellation_hours: 24 // Annulation gratuite jusqu'à 24h avant
  },

  // ═══════════════════════════════════════════════════════════════
  // SERVICES EXEMPLES
  // ═══════════════════════════════════════════════════════════════
  default_services: [
    // À personnaliser selon le métier
  ]
};

export default SERVICE_DOMICILE_TEMPLATE;
