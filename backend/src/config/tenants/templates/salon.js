/**
 * Template Tenant: Salon / Institut
 *
 * Pour: Salon de coiffure, barbier, institut de beauté, spa,
 * onglerie, centre de bien-être, etc.
 *
 * Caractéristiques:
 * - Établissement fixe
 * - Plusieurs employés/coiffeurs
 * - Pas de déplacement
 * - Gestion de postes/stations
 */

export const SALON_TEMPLATE = {
  // ═══════════════════════════════════════════════════════════════
  // IDENTITÉ
  // ═══════════════════════════════════════════════════════════════
  id: '', // À définir
  name: '', // À définir
  business_type: 'salon',

  // ═══════════════════════════════════════════════════════════════
  // TERMINOLOGIE
  // ═══════════════════════════════════════════════════════════════
  terminology: {
    reservation: { singular: 'RDV', plural: 'RDV' },
    service: { singular: 'Prestation', plural: 'Prestations' },
    client: { singular: 'Client', plural: 'Clients' },
    employee: { singular: 'Coiffeur', plural: 'Coiffeurs' }
  },

  // ═══════════════════════════════════════════════════════════════
  // FEATURES ACTIVÉES
  // ═══════════════════════════════════════════════════════════════
  features: {
    travel_fees: false,
    client_address: false,
    multi_staff: true,
    stations: true,
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
    address: '', // Adresse du salon
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
    payment: '/paiement',
    reviews: '/avis'
  },

  // ═══════════════════════════════════════════════════════════════
  // ASSISTANT IA
  // ═══════════════════════════════════════════════════════════════
  assistant: {
    name: 'Nexus',
    voice_id: 'FFXYdAYPzn8Tw8KiHZqg',
    personality: 'friendly',
    language: 'fr'
  },

  // ═══════════════════════════════════════════════════════════════
  // ÉQUIPE & STATIONS
  // ═══════════════════════════════════════════════════════════════
  staff: {
    require_assignment: true, // Assigner un coiffeur obligatoire
    allow_preference: true, // Client peut demander un coiffeur
    stations_count: 4 // Nombre de postes
  },

  // ═══════════════════════════════════════════════════════════════
  // HORAIRES
  // ═══════════════════════════════════════════════════════════════
  horaires: {
    lundi: { ouvert: false, debut: null, fin: null }, // Souvent fermé
    mardi: { ouvert: true, debut: '09:00', fin: '19:00' },
    mercredi: { ouvert: true, debut: '09:00', fin: '19:00' },
    jeudi: { ouvert: true, debut: '09:00', fin: '21:00' }, // Nocturne
    vendredi: { ouvert: true, debut: '09:00', fin: '19:00' },
    samedi: { ouvert: true, debut: '09:00', fin: '18:00' },
    dimanche: { ouvert: false, debut: null, fin: null }
  },

  // ═══════════════════════════════════════════════════════════════
  // RÈGLES DE RÉSERVATION
  // ═══════════════════════════════════════════════════════════════
  booking_rules: {
    min_advance_hours: 2, // Plus flexible qu'à domicile
    max_advance_days: 90,
    slot_duration: 15, // Créneaux de 15 min
    buffer_between: 0, // Pas de buffer nécessaire
    require_deposit: false,
    deposit_percentage: 30,
    cancellation_hours: 24
  },

  // ═══════════════════════════════════════════════════════════════
  // SERVICES EXEMPLES
  // ═══════════════════════════════════════════════════════════════
  default_services: [
    { nom: 'Coupe homme', duree_minutes: 30, prix: 2500, categorie: 'Coupe' },
    { nom: 'Coupe femme', duree_minutes: 45, prix: 4000, categorie: 'Coupe' },
    { nom: 'Coupe enfant', duree_minutes: 20, prix: 1500, categorie: 'Coupe' },
    { nom: 'Brushing', duree_minutes: 30, prix: 2500, categorie: 'Coiffage' },
    { nom: 'Coloration', duree_minutes: 90, prix: 6000, categorie: 'Couleur' },
    { nom: 'Mèches', duree_minutes: 120, prix: 8000, categorie: 'Couleur' },
    { nom: 'Barbe', duree_minutes: 20, prix: 1500, categorie: 'Barbe' }
  ]
};

export default SALON_TEMPLATE;
