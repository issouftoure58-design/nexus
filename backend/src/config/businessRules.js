/**
 * Business Rules - NEXUS Default Catalog
 *
 * Ce fichier contient le catalogue de services par defaut et les regles metier.
 * Utilise comme fallback quand les services ne sont pas configures en DB pour un tenant.
 *
 * Pour les tenants multi-business, les services sont charges depuis la table `services` en DB.
 * Ce fichier reste la source de verite pour les regles de reservation et les termes ambigus.
 *
 * @fileoverview Catalogue de services par defaut et regles metier
 * @author NEXUS Core System
 */

// NE PAS MODIFIER - TARIFS OFFICIELS
export const SERVICES = Object.freeze({
  // LOCKS
  CREATION_CROCHET_LOCKS: Object.freeze({
    id: 'creation_crochet_locks',
    name: 'Création crochet locks',
    category: 'locks',
    price: 200,
    priceInCents: 20000,
    priceIsMinimum: false,
    durationMinutes: 480, // 8h
    blocksFullDay: true,
    blocksDays: 1,
  }),
  CREATION_MICROLOCKS_CROCHET: Object.freeze({
    id: 'creation_microlocks_crochet',
    name: 'Création microlocks crochet',
    category: 'locks',
    price: 300,
    priceInCents: 30000,
    priceIsMinimum: true, // "a partir de"
    durationMinutes: 960, // 16h
    blocksFullDay: true,
    blocksDays: 2,
  }),
  CREATION_MICROLOCKS_TWIST: Object.freeze({
    id: 'creation_microlocks_twist',
    name: 'Création microlocks twist',
    category: 'locks',
    price: 150,
    priceInCents: 15000,
    priceIsMinimum: true,
    durationMinutes: 480, // 8h
    blocksFullDay: true,
    blocksDays: 1,
  }),
  REPRISE_RACINES_LOCKS: Object.freeze({
    id: 'reprise_racines_locks',
    name: 'Reprise racines locks',
    category: 'locks',
    price: 50,
    priceInCents: 5000,
    priceIsMinimum: false,
    durationMinutes: 120, // 2h
    blocksFullDay: false,
    blocksDays: 1,
  }),
  REPRISE_RACINES_MICROLOCKS: Object.freeze({
    id: 'reprise_racines_microlocks',
    name: 'Reprise racines micro-locks',
    category: 'locks',
    price: 100,
    priceInCents: 10000,
    priceIsMinimum: false,
    durationMinutes: 240, // 4h
    blocksFullDay: false,
    blocksDays: 1,
  }),
  DECAPAGE_LOCKS: Object.freeze({
    id: 'decapage_locks',
    name: 'Décapage locks',
    category: 'locks',
    price: 35,
    priceInCents: 3500,
    priceIsMinimum: false,
    durationMinutes: 60, // 1h
    blocksFullDay: false,
    blocksDays: 1,
  }),

  // SOINS
  SOIN_COMPLET: Object.freeze({
    id: 'soin_complet',
    name: 'Soin complet',
    category: 'soins',
    price: 50,
    priceInCents: 5000,
    priceIsMinimum: false,
    durationMinutes: 60,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  SOIN_HYDRATANT: Object.freeze({
    id: 'soin_hydratant',
    name: 'Soin hydratant',
    category: 'soins',
    price: 40,
    priceInCents: 4000,
    priceIsMinimum: false,
    durationMinutes: 60,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  SOIN_HYDRATANT_CHEVEUX_NON_LOCKSES: Object.freeze({
    id: 'soin_hydratant_cheveux_non_lockses',
    name: 'Soin hydratant cheveux non locksés',
    category: 'soins',
    price: 40,
    priceInCents: 4000,
    priceIsMinimum: false,
    durationMinutes: 120, // 2h
    blocksFullDay: false,
    blocksDays: 1,
    description: 'Comprend shampoing, massage et brushing. Ne concerne que les cheveux non locksés.',
  }),
  SOIN_HYDRATANT_CHEVEUX_LOCKSES: Object.freeze({
    id: 'soin_hydratant_cheveux_lockses',
    name: 'Soin hydratant cheveux locksés',
    category: 'soins',
    price: 40,
    priceInCents: 4000,
    priceIsMinimum: false,
    durationMinutes: 60, // 1h
    blocksFullDay: false,
    blocksDays: 1,
    description: 'Shampoing et massage. Spécial cheveux locksés.',
  }),
  SOIN_PROFOND_CHEVEUX_NON_LOCKSES: Object.freeze({
    id: 'soin_profond_cheveux_non_lockses',
    name: 'Soin profond cheveux non locksés',
    category: 'soins',
    price: 60,
    priceInCents: 6000,
    priceIsMinimum: false,
    durationMinutes: 150, // 2h30
    blocksFullDay: false,
    blocksDays: 1,
    description: 'Massage, shampoing et brushing pointe. Ne concerne que les cheveux non locksés.',
  }),
  SHAMPOING: Object.freeze({
    id: 'shampoing',
    name: 'Shampoing',
    category: 'soins',
    price: 10,
    priceInCents: 1000,
    priceIsMinimum: false,
    durationMinutes: 30,
    blocksFullDay: false,
    blocksDays: 1,
  }),

  // TRESSES & BRAIDS
  NATTES_COLLEES_CORNROW: Object.freeze({
    id: 'nattes_collees_cornrow',
    name: 'Nattes collées cornrow',
    category: 'tresses',
    price: 20,
    priceInCents: 2000,
    priceIsMinimum: true,
    durationMinutes: 60,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  NATTES_COLLEES_STITCH_BRAID: Object.freeze({
    id: 'nattes_collees_stitch_braid',
    name: 'Nattes collées stitch braid',
    category: 'tresses',
    price: 50,
    priceInCents: 5000,
    priceIsMinimum: false,
    durationMinutes: 120,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  BOX_BRAIDS: Object.freeze({
    id: 'box_braids',
    name: 'Box Braids',
    category: 'tresses',
    price: 50,
    priceInCents: 5000,
    priceIsMinimum: true,
    durationMinutes: 300,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  BRAIDS_SIMPLES: Object.freeze({
    id: 'braids_simples',
    name: 'Braids simples',
    category: 'tresses',
    price: 40,
    priceInCents: 4000,
    priceIsMinimum: false,
    durationMinutes: 120, // 2h
    blocksFullDay: false,
    blocksDays: 1,
  }),
  CHIGNON: Object.freeze({
    id: 'chignon',
    name: 'Chignon',
    category: 'tresses',
    price: 50,
    priceInCents: 5000,
    priceIsMinimum: false,
    durationMinutes: 60,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  CROCHET_BRAIDS_NATURELLES: Object.freeze({
    id: 'crochet_braids_naturelles',
    name: 'Crochet Braids Naturelles',
    category: 'tresses',
    price: 60,
    priceInCents: 6000,
    priceIsMinimum: true,
    durationMinutes: 180,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  FULANI_BRAIDS: Object.freeze({
    id: 'fulani_braids',
    name: 'Fulani Braids',
    category: 'tresses',
    price: 70,
    priceInCents: 7000,
    priceIsMinimum: true,
    durationMinutes: 300,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  FULANI_BRAIDS_DEMI_TETE: Object.freeze({
    id: 'fulani_braids_demi_tete',
    name: 'Fulani braids demi-tête',
    category: 'tresses',
    price: 50,
    priceInCents: 5000,
    priceIsMinimum: false,
    durationMinutes: 180, // 3h
    blocksFullDay: false,
    blocksDays: 1,
    description: 'Fulani braids sur la moitié de la tête uniquement.',
  }),
  BOHEMIAN_FULANI: Object.freeze({
    id: 'bohemian_fulani',
    name: 'Bohemian Fulani',
    category: 'tresses',
    price: 60,
    priceInCents: 6000,
    priceIsMinimum: false,
    durationMinutes: 300,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  SENEGALESE_TWISTS: Object.freeze({
    id: 'senegalese_twists',
    name: 'Senegalese Twists',
    category: 'tresses',
    price: 80,
    priceInCents: 8000,
    priceIsMinimum: false,
    durationMinutes: 300,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  PASSION_TWIST: Object.freeze({
    id: 'passion_twist',
    name: 'Passion Twist',
    category: 'tresses',
    price: 80,
    priceInCents: 8000,
    priceIsMinimum: false,
    durationMinutes: 300,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  BOHO_BRAIDS: Object.freeze({
    id: 'boho_braids',
    name: 'Boho Braids',
    category: 'tresses',
    price: 70,
    priceInCents: 7000,
    priceIsMinimum: true,
    durationMinutes: 300,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  DEPART_LOCKS_VANILLE: Object.freeze({
    id: 'depart_locks_vanille',
    name: 'Départ Locks Vanille',
    category: 'tresses',
    price: 80,
    priceInCents: 8000,
    priceIsMinimum: true,
    durationMinutes: 240,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  VANILLE_SANS_RAJOUT: Object.freeze({
    id: 'vanille_sans_rajout',
    name: 'Vanille sans rajout',
    category: 'tresses',
    price: 50,
    priceInCents: 5000,
    priceIsMinimum: false,
    durationMinutes: 180,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  REPARATION_LOCKS: Object.freeze({
    id: 'reparation_locks',
    name: 'Réparation Locks',
    category: 'tresses',
    price: 10,
    priceInCents: 1000,
    priceIsMinimum: false,
    pricePerUnit: true,
    unitName: 'lock',
    durationMinutes: 30,
    durationPerUnit: true,
    blocksFullDay: false,
    blocksDays: 1,
    specialInstructions: "Demander combien de locks à réparer. Prix = nombre × 10€. Durée = nombre × 30min. Note: Prix sous réserve du nombre exact.",
  }),

  // COLORATION & BRUSHING
  TEINTURE_SANS_AMMONIAQUE: Object.freeze({
    id: 'teinture_sans_ammoniaque',
    name: 'Teinture sans ammoniaque',
    category: 'coloration',
    price: 40,
    priceInCents: 4000,
    priceIsMinimum: false,
    durationMinutes: 40,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  DECOLORATION: Object.freeze({
    id: 'decoloration',
    name: 'Décoloration',
    category: 'coloration',
    price: 20,
    priceInCents: 2000,
    priceIsMinimum: false,
    durationMinutes: 10,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  BRUSHING_AFRO: Object.freeze({
    id: 'brushing_afro',
    name: 'Brushing cheveux afro',
    category: 'coloration',
    price: 20,
    priceInCents: 2000,
    priceIsMinimum: false,
    durationMinutes: 60,
    blocksFullDay: false,
    blocksDays: 1,
  }),
  BRUSHING_POINTE: Object.freeze({
    id: 'brushing_pointe',
    name: 'Brushing pointe',
    category: 'coloration',
    price: 30,
    priceInCents: 3000,
    priceIsMinimum: false,
    durationMinutes: 60, // 1h
    blocksFullDay: false,
    blocksDays: 1,
  }),
});

// NE PAS MODIFIER - FRAIS DE DEPLACEMENT
export const TRAVEL_FEES = Object.freeze({
  BASE_DISTANCE_KM: 8,
  BASE_FEE: 10,
  BASE_FEE_CENTS: 1000,
  PER_KM_BEYOND: 1.10,
  PER_KM_BEYOND_CENTS: 110,

  calculate: (distanceKm) => {
    if (distanceKm <= 8) {
      return 10;
    }
    const extraKm = distanceKm - 8;
    return Math.round((10 + (extraKm * 1.10)) * 100) / 100;
  },

  calculateCents: (distanceKm) => {
    if (distanceKm <= 8) {
      return 1000;
    }
    const extraKm = distanceKm - 8;
    return Math.round(1000 + (extraKm * 110));
  }
});

// NE PAS MODIFIER - HORAIRES
export const BUSINESS_HOURS = Object.freeze({
  // Horaires par jour de la semaine (0 = Dimanche)
  SCHEDULE: Object.freeze({
    0: null, // Dimanche - FERME
    1: { open: '09:00', close: '18:00' }, // Lundi
    2: { open: '09:00', close: '18:00' }, // Mardi
    3: { open: '09:00', close: '18:00' }, // Mercredi
    4: { open: '09:00', close: '13:00' }, // Jeudi (demi-journee)
    5: { open: '13:00', close: '18:00' }, // Vendredi (apres-midi)
    6: { open: '09:00', close: '18:00' }, // Samedi
  }),

  DAYS_OPEN: [1, 2, 3, 4, 5, 6], // Lundi a Samedi

  isOpen: (dayOfWeek) => {
    return BUSINESS_HOURS.SCHEDULE[dayOfWeek] !== null;
  },

  getHours: (dayOfWeek) => {
    return BUSINESS_HOURS.SCHEDULE[dayOfWeek];
  }
});

// NE PAS MODIFIER - REGLES DE RESERVATION
export const BOOKING_RULES = Object.freeze({
  // Delai minimum pour reserver (en heures)
  MIN_ADVANCE_HOURS: 24,

  // Delai maximum pour reserver (en jours)
  MAX_ADVANCE_DAYS: 60,

  // Acompte requis (pourcentage)
  DEPOSIT_PERCENT: 30,

  // Delai d'annulation gratuite (en heures)
  FREE_CANCELLATION_HOURS: 48,

  // Creneau unique pour services journee entiere
  FULL_DAY_START_HOUR: 9,
  FULL_DAY_START_TIME: '09:00',
});

// OPTIONS DE SERVICE - PEUVENT ETRE MODIFIEES PAR L'ADMIN
export const SERVICE_OPTIONS = Object.freeze({
  // Désactiver temporairement les déplacements à domicile
  DOMICILE_ENABLED: false,

  // Message a afficher quand domicile desactive
  DOMICILE_DISABLED_MESSAGE: "Actuellement, les deplacements a domicile ne sont pas disponibles. Les prestations se font uniquement sur place. Souhaitez-vous reserver sur place ?",
});

// 🔒 C3: STATUTS QUI BLOQUENT UN CRÉNEAU - SOURCE UNIQUE DE VÉRITÉ
// Utilisé partout pour vérifier la disponibilité (nexusCore, orders, bookingService, etc.)
export const BLOCKING_STATUTS = Object.freeze([
  'demande',              // Réservation en attente de confirmation
  'confirme',             // Réservation confirmée
  'en_attente',           // En attente (générique)
  'en_attente_paiement',  // En attente de paiement en ligne
]);

// Statuts qui NE bloquent PAS un créneau (pour référence)
export const NON_BLOCKING_STATUTS = Object.freeze([
  'annule',    // Annulé - créneau libéré
  'termine',   // Terminé - historique
  'no_show',   // Client absent - historique
]);

// NE PAS MODIFIER - TERMES AMBIGUS NECESSITANT CLARIFICATION
export const AMBIGUOUS_TERMS = Object.freeze({
  'locks': {
    message: "Pour les locks, vous souhaitez :\n- Une création de locks (200€, journée entière)\n- Une reprise de racines (50€, 2h)\n- Un décapage (35€, 1h) ?",
    options: ['création crochet locks', 'reprise racines locks', 'décapage locks', 'réparation locks', 'départ locks vanille'],
    services: ['CREATION_CROCHET_LOCKS', 'REPRISE_RACINES_LOCKS', 'DECAPAGE_LOCKS', 'REPARATION_LOCKS', 'DEPART_LOCKS_VANILLE']
  },
  'microlocks': {
    message: "Pour les microlocks, vous souhaitez :\n- Une création au crochet (300€+, 2 jours)\n- Une création twist (150€+, journée)\n- Une reprise de racines (100€, 4h) ?",
    options: ['création microlocks crochet', 'création microlocks twist', 'reprise racines microlocks'],
    services: ['CREATION_MICROLOCKS_CROCHET', 'CREATION_MICROLOCKS_TWIST', 'REPRISE_RACINES_MICROLOCKS']
  },
  'tresses': {
    message: "Pour les tresses, vous souhaitez :\n- Des braids (60€+)\n- Des nattes collées sans rajout (20€+)\n- Des nattes collées avec rajout (40€+) ?",
    options: ['braids', 'nattes collées sans rajout', 'nattes collées avec rajout'],
    services: ['BRAIDS', 'NATTES_COLLEES_SANS_RAJOUT', 'NATTES_COLLEES_AVEC_RAJOUT']
  }
});

// FONCTION DE VALIDATION DE BASE
export function validateBooking(booking, service) {
  const errors = [];

  // 1. Verifier que le service existe
  if (!service) {
    errors.push("Service invalide");
    return { valid: false, errors };
  }

  // 2. Verifier le jour
  // IMPORTANT: Ajouter T12:00:00 pour éviter les problèmes de timezone
  // Sans cela, "2026-02-16" est interprété comme minuit UTC, qui peut être
  // le jour précédent dans certains fuseaux horaires (ex: serveur USA)
  const bookingDate = new Date(booking.date + 'T12:00:00');
  const dayOfWeek = bookingDate.getDay();

  if (!BUSINESS_HOURS.isOpen(dayOfWeek)) {
    errors.push("Ferme ce jour-la (dimanche)");
    return { valid: false, errors };
  }

  // 3. Verifier les horaires
  const hours = BUSINESS_HOURS.getHours(dayOfWeek);
  const [openH, openM] = hours.open.split(':').map(Number);
  const [closeH, closeM] = hours.close.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  // Parse l'heure en supportant les formats "14:30", "14h30", ou entier
  let startHour = booking.startHour || 0;
  let startMin = booking.startMinutes || 0;
  if (!booking.startHour && booking.heure) {
    const heureStr = String(booking.heure);
    if (heureStr.includes(':')) {
      [startHour, startMin] = heureStr.split(':').map(Number);
    } else if (heureStr.includes('h')) {
      const parts = heureStr.split('h');
      startHour = parseInt(parts[0]) || 0;
      startMin = parseInt(parts[1]) || 0;
    } else {
      startHour = parseInt(heureStr) || 0;
      startMin = 0;
    }
  }
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = startMinutes + service.durationMinutes;

  if (startMinutes < openMinutes) {
    errors.push(`Ouverture a ${hours.open} ce jour-la`);
  }

  if (endMinutes > closeMinutes) {
    errors.push(`Ce service de ${service.durationMinutes / 60}h ne peut pas finir après ${hours.close}`);
  }

  // 4. Verifier heure de debut pour services journee entiere
  if (service.blocksFullDay && startHour !== BOOKING_RULES.FULL_DAY_START_HOUR) {
    errors.push(`Les ${service.name} nécessitent de commencer à ${BOOKING_RULES.FULL_DAY_START_TIME}`);
  }

  return { valid: errors.length === 0, errors };
}

// Normalise un nom de service (accents, tirets, espaces multiples)
function normalizeForSearch(str) {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents: é→e, è→e, ê→e
    .replace(/-/g, '')                                 // tirets: micro-locks → microlocks
    .replace(/\s+/g, ' ');                             // espaces multiples
}

// FONCTION UTILITAIRE - TROUVER UN SERVICE PAR NOM
export function findServiceByName(name) {
  if (!name) return null;
  const normalizedName = name.toLowerCase().trim();
  const searchKey = normalizeForSearch(name);

  // 1. Recherche exacte (case-insensitive)
  for (const [key, service] of Object.entries(SERVICES)) {
    if (service.name.toLowerCase() === normalizedName) {
      return { key, ...service };
    }
  }

  // 2. Recherche avec normalisation accents/tirets
  for (const [key, service] of Object.entries(SERVICES)) {
    if (normalizeForSearch(service.name) === searchKey) {
      return { key, ...service };
    }
  }

  // 3. Recherche partielle (le nom de service contient le terme, ou inverse avec garde-fou longueur)
  for (const [key, service] of Object.entries(SERVICES)) {
    const svcNorm = normalizeForSearch(service.name);
    // Le service contient le terme recherché (ex: "Brushing cheveux afro" contient "brushing")
    if (svcNorm.includes(searchKey) || service.name.toLowerCase().includes(normalizedName)) {
      return { key, ...service };
    }
    // Le terme contient le nom de service, mais seulement si proches en longueur
    // Évite faux positif: "Fulani braids demi-tête" ne doit PAS matcher "Fulani Braids"
    if ((searchKey.includes(svcNorm) || normalizedName.includes(service.name.toLowerCase())) &&
        svcNorm.length >= searchKey.length * 0.75) {
      return { key, ...service };
    }
  }

  // 4. Recherche par mots: tous les mots du terme apparaissent dans le service
  // Ex: "Brushing afro" → mots ["brushing", "afro"] tous dans "Brushing cheveux afro"
  const searchWords = searchKey.split(' ').filter(w => w.length > 1);
  if (searchWords.length >= 2) {
    for (const [key, service] of Object.entries(SERVICES)) {
      const svcWords = normalizeForSearch(service.name).split(' ').filter(w => w.length > 1);
      if (searchWords.every(w => svcWords.includes(w))) {
        return { key, ...service };
      }
    }
  }

  // 5. Recherche fuzzy avec tolérance singulier/pluriel
  // Ex: "reprise racine locks" matche "Reprise racines locks"
  const singularize = (w) => w.endsWith('s') && w.length > 3 ? w.slice(0, -1) : w;
  const searchWordsSingular = searchKey.split(' ').map(singularize).filter(w => w.length > 1);

  for (const [key, service] of Object.entries(SERVICES)) {
    const svcWordsSingular = normalizeForSearch(service.name).split(' ').map(singularize).filter(w => w.length > 1);
    // Vérifier si tous les mots (singularisés) correspondent
    if (searchWordsSingular.length >= 2 &&
        searchWordsSingular.every(w => svcWordsSingular.some(sw => sw === w || sw.includes(w) || w.includes(sw)))) {
      return { key, ...service };
    }
  }

  return null;
}

// FONCTION UTILITAIRE - VERIFIER SI TERME AMBIGU
export function checkAmbiguousTerm(term) {
  if (!term) return null;
  const normalizedTerm = term.toLowerCase().trim();

  // Si le terme correspond a un service connu (exact ou sans tirets), pas d'ambiguite
  // Ex: "reprise racines micro-locks" ou "reprise racines microlocks"
  const termNoHyphens = normalizedTerm.replace(/-/g, '');
  for (const service of Object.values(SERVICES)) {
    const svcName = service.name.toLowerCase();
    if (svcName === normalizedTerm || svcName.replace(/-/g, '') === termNoHyphens) {
      return null;
    }
  }

  for (const [key, ambiguous] of Object.entries(AMBIGUOUS_TERMS)) {
    if (normalizedTerm === key || normalizedTerm.includes(key)) {
      // Verifier que ce n'est pas un terme specifique
      // Normaliser les tirets/espaces pour matcher "micro-locks" avec "microlocks"
      const termNoHyphens = normalizedTerm.replace(/-/g, '');
      const isSpecific = ambiguous.options.some(opt => {
        const optNorm = opt.toLowerCase();
        const optNoHyphens = optNorm.replace(/-/g, '');
        return normalizedTerm.includes(optNorm) || termNoHyphens.includes(optNoHyphens);
      });
      if (!isSpecific) {
        return { term: key, ...ambiguous };
      }
    }
  }

  return null;
}

// FONCTION UTILITAIRE - LISTE DES SERVICES PAR CATEGORIE
export function getServicesByCategory(category) {
  return Object.values(SERVICES).filter(s => s.category === category);
}

// FONCTION UTILITAIRE - LISTE DE TOUS LES SERVICES
export function getAllServices() {
  return Object.values(SERVICES);
}

// Export par defaut
export default {
  SERVICES,
  TRAVEL_FEES,
  BUSINESS_HOURS,
  BOOKING_RULES,
  AMBIGUOUS_TERMS,
  validateBooking,
  findServiceByName,
  checkAmbiguousTerm,
  getServicesByCategory,
  getAllServices,
};
