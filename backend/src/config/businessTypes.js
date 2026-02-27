/**
 * Configuration des types de business supportés par NEXUS
 *
 * Chaque type définit:
 * - terminology: Les termes à utiliser dans l'UI et les messages
 * - features: Les fonctionnalités activées/désactivées
 * - fieldConfig: Les champs requis/optionnels/interdits
 * - businessRules: Les règles métier spécifiques
 * - defaults: Les valeurs par défaut
 */

export const BUSINESS_TYPES = {
  // ═══════════════════════════════════════════════════════════════
  // SERVICE À DOMICILE (Fat's Hair Afro, plombier, coach, etc.)
  // ═══════════════════════════════════════════════════════════════
  service_domicile: {
    id: 'service_domicile',
    label: 'Service à domicile',
    description: 'Prestations réalisées au domicile du client',
    icon: 'Home',

    terminology: {
      reservation: { singular: 'RDV', plural: 'RDV' },
      service: { singular: 'Prestation', plural: 'Prestations' },
      client: { singular: 'Client', plural: 'Clients' },
      employee: { singular: 'Intervenant', plural: 'Intervenants' },
      location: 'Lieu',
      duration: 'Durée',
      quantity: 'Quantité',
      travel_fees: 'Frais de déplacement'
    },

    features: {
      travelFees: true,
      clientAddress: true,
      multiStaff: false,
      onlineBooking: true,
      deposits: true,
      tableManagement: false,
      roomInventory: false,
      checkinCheckout: false
    },

    fieldConfig: {
      service: {
        required: ['nom', 'prix', 'duree_minutes'],
        optional: ['description', 'categorie_id'],
        forbidden: ['taux_journalier', 'capacite_max']
      },
      reservation: {
        required: ['date', 'heure', 'service_id', 'client_id', 'adresse_client'],
        optional: ['lieu', 'frais_deplacement', 'notes'],
        forbidden: ['date_fin', 'nb_agents', 'table_id', 'chambre_id']
      }
    },

    businessRules: {
      allowDomicile: true,
      requireClientAddress: true,
      travelFeesFreeRadiusKm: 5,
      travelFeesPricePerKm: 50, // centimes
      maxServicesPerReservation: 10,
      requireEmployeeAssignment: false,
      defaultLocation: 'domicile'
    },

    pricingMode: 'fixed',
    pricingModesAllowed: ['fixed', 'hourly'],
    durationMode: 'fixed',
    allowMultiDay: false
  },

  // ═══════════════════════════════════════════════════════════════
  // SALON FIXE (Coiffure, barbier, spa, onglerie)
  // ═══════════════════════════════════════════════════════════════
  salon: {
    id: 'salon',
    label: 'Salon / Institut',
    description: 'Établissement fixe avec plusieurs employés',
    icon: 'Scissors',

    terminology: {
      reservation: { singular: 'RDV', plural: 'RDV' },
      service: { singular: 'Prestation', plural: 'Prestations' },
      client: { singular: 'Client', plural: 'Clients' },
      employee: { singular: 'Coiffeur', plural: 'Coiffeurs' },
      location: 'Salon',
      duration: 'Durée',
      quantity: 'Quantité'
    },

    features: {
      travelFees: false,
      clientAddress: false,
      multiStaff: true,
      onlineBooking: true,
      deposits: true,
      stations: true,
      tableManagement: false,
      roomInventory: false,
      checkinCheckout: false
    },

    fieldConfig: {
      service: {
        required: ['nom', 'prix', 'duree_minutes'],
        optional: ['description', 'categorie_id'],
        forbidden: ['taux_horaire', 'taux_journalier', 'capacite_max']
      },
      reservation: {
        required: ['date', 'heure', 'service_id', 'client_id'],
        optional: ['membre_id', 'notes'],
        forbidden: ['adresse_client', 'frais_deplacement', 'date_fin', 'table_id', 'chambre_id']
      }
    },

    businessRules: {
      allowDomicile: false,
      requireClientAddress: false,
      maxServicesPerReservation: 10,
      allowMultipleEmployees: true,
      requireEmployeeAssignment: true,
      hasStations: true,
      defaultLocation: 'salon'
    },

    pricingMode: 'fixed',
    pricingModesAllowed: ['fixed'],
    durationMode: 'fixed',
    allowMultiDay: false
  },

  // ═══════════════════════════════════════════════════════════════
  // RESTAURANT (Restaurant, bar, café)
  // ═══════════════════════════════════════════════════════════════
  restaurant: {
    id: 'restaurant',
    label: 'Restaurant / Bar',
    description: 'Établissement de restauration avec gestion de tables',
    icon: 'UtensilsCrossed',

    terminology: {
      reservation: { singular: 'Réservation', plural: 'Réservations' },
      service: { singular: 'Table', plural: 'Tables' },
      client: { singular: 'Client', plural: 'Clients' },
      employee: { singular: 'Serveur', plural: 'Serveurs' },
      location: 'Restaurant',
      duration: 'Créneau',
      quantity: 'Couverts',
      covers: 'Personnes'
    },

    features: {
      travelFees: false,
      clientAddress: false,
      multiStaff: true,
      onlineBooking: true,
      deposits: false,
      tableManagement: true,
      covers: true,
      roomInventory: false,
      checkinCheckout: false
    },

    fieldConfig: {
      service: {
        required: ['nom', 'capacite_max'],
        optional: ['description', 'zone'],
        forbidden: ['prix', 'duree_minutes', 'taux_horaire']
      },
      reservation: {
        required: ['date', 'heure', 'nb_couverts', 'client_id'],
        optional: ['table_id', 'service_type', 'notes', 'allergies'],
        forbidden: ['adresse_client', 'frais_deplacement', 'membre_id', 'chambre_id']
      }
    },

    businessRules: {
      allowDomicile: false,
      requireClientAddress: false,
      hasTableManagement: true,
      hasCovers: true,
      serviceTypes: ['midi', 'soir'],
      defaultSlotDuration: 90, // minutes
      maxCoversPerSlot: 200,
      requirePhoneNumber: true,
      defaultLocation: 'restaurant'
    },

    pricingMode: 'fixed',
    pricingModesAllowed: ['fixed'],
    durationMode: 'fixed',
    allowMultiDay: false
  },

  // ═══════════════════════════════════════════════════════════════
  // HOTEL (Hôtel, gîte, chambre d'hôtes)
  // ═══════════════════════════════════════════════════════════════
  hotel: {
    id: 'hotel',
    label: 'Hôtel / Hébergement',
    description: 'Établissement d\'hébergement avec gestion de chambres',
    icon: 'Hotel',

    terminology: {
      reservation: { singular: 'Réservation', plural: 'Réservations' },
      service: { singular: 'Chambre', plural: 'Chambres' },
      client: { singular: 'Hôte', plural: 'Hôtes' },
      employee: { singular: 'Réceptionniste', plural: 'Réceptionnistes' },
      location: 'Établissement',
      duration: 'Séjour',
      quantity: 'Personnes',
      checkin: 'Arrivée',
      checkout: 'Départ',
      nights: 'Nuitées'
    },

    features: {
      travelFees: false,
      clientAddress: false,
      multiStaff: true,
      onlineBooking: true,
      deposits: true,
      tableManagement: false,
      roomInventory: true,
      checkinCheckout: true,
      extras: true
    },

    fieldConfig: {
      service: {
        required: ['nom', 'prix', 'capacite_max'],
        optional: ['description', 'equipements', 'etage', 'vue'],
        forbidden: ['duree_minutes', 'taux_horaire']
      },
      reservation: {
        required: ['date_arrivee', 'date_depart', 'chambre_id', 'client_id', 'nb_personnes'],
        optional: ['heure_arrivee', 'extras', 'notes'],
        forbidden: ['adresse_client', 'frais_deplacement', 'heure', 'table_id']
      }
    },

    businessRules: {
      allowDomicile: false,
      requireClientAddress: false,
      hasRoomInventory: true,
      hasCheckinCheckout: true,
      checkinTime: '15:00',
      checkoutTime: '11:00',
      minNights: 1,
      hasExtras: true,
      defaultLocation: 'hotel'
    },

    pricingMode: 'daily',
    pricingModesAllowed: ['daily', 'package'],
    durationMode: 'range',
    allowMultiDay: true
  }
};

// ═══════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════

/**
 * Récupère la configuration d'un type de business
 */
export function getBusinessType(typeId) {
  return BUSINESS_TYPES[typeId] || null;
}

/**
 * Vérifie si un type de business existe
 */
export function isValidBusinessType(typeId) {
  return typeId in BUSINESS_TYPES;
}

/**
 * Récupère la terminologie pour un type de business
 */
export function getTerminology(typeId, key, plural = false) {
  const type = BUSINESS_TYPES[typeId];
  if (!type) return key;

  const term = type.terminology[key];
  if (!term) return key;

  if (typeof term === 'object') {
    return plural ? term.plural : term.singular;
  }
  return term;
}

/**
 * Vérifie si une feature est activée pour un type de business
 */
export function hasFeature(typeId, feature) {
  const type = BUSINESS_TYPES[typeId];
  if (!type) return false;
  return type.features[feature] === true;
}

/**
 * Récupère une règle métier pour un type de business
 */
export function getBusinessRule(typeId, rule, defaultValue = null) {
  const type = BUSINESS_TYPES[typeId];
  if (!type || !type.businessRules) return defaultValue;
  return type.businessRules[rule] ?? defaultValue;
}

/**
 * Vérifie si un champ est requis pour un contexte donné
 */
export function isFieldRequired(typeId, context, field) {
  const type = BUSINESS_TYPES[typeId];
  if (!type || !type.fieldConfig || !type.fieldConfig[context]) return false;
  return type.fieldConfig[context].required?.includes(field) || false;
}

/**
 * Vérifie si un champ est interdit pour un contexte donné
 */
export function isFieldForbidden(typeId, context, field) {
  const type = BUSINESS_TYPES[typeId];
  if (!type || !type.fieldConfig || !type.fieldConfig[context]) return false;
  return type.fieldConfig[context].forbidden?.includes(field) || false;
}

/**
 * Vérifie si un champ est visible (non interdit)
 */
export function isFieldVisible(typeId, context, field) {
  return !isFieldForbidden(typeId, context, field);
}

/**
 * Récupère la liste de tous les types de business
 */
export function getAllBusinessTypes() {
  return Object.values(BUSINESS_TYPES);
}

/**
 * Récupère la liste des types pour un select/dropdown
 */
export function getBusinessTypesForSelect() {
  return Object.values(BUSINESS_TYPES).map(type => ({
    value: type.id,
    label: type.label,
    description: type.description,
    icon: type.icon
  }));
}

export default BUSINESS_TYPES;
