/**
 * Tenant Business Service
 *
 * Service central pour la logique métier basée sur le type de business du tenant.
 * REMPLACE les constantes hardcodées comme SALON_INFO.
 *
 * Usage:
 *   import { getBusinessInfo, getTerminology, hasFeature } from './tenantBusinessService.js';
 *
 *   const info = getBusinessInfo(tenantId);
 *   const term = getTerminology(tenantId, 'reservation', true); // "RDV" ou "Réservations"
 *   const canTravel = hasFeature(tenantId, 'travelFees');
 */

import { getTenantConfig } from '../config/tenants/index.js';
import { supabase } from '../config/supabase.js';
import {
  BUSINESS_TYPES,
  getBusinessType,
  getTerminology as getTypeTerminology,
  hasFeature as hasTypeFeature,
  getBusinessRule as getTypeBusinessRule,
  isFieldRequired as isTypeFieldRequired,
  isFieldForbidden as isTypeFieldForbidden
} from '../config/businessTypes.js';

// ═══════════════════════════════════════════════════════════════════
// CACHE EN MÉMOIRE (pour éviter les requêtes DB répétées)
// ═══════════════════════════════════════════════════════════════════

const tenantBusinessCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Charge la config business d'un tenant depuis la DB
 */
async function loadTenantBusinessConfig(tenantId) {
  if (!tenantId) return null;

  // Check cache
  const cached = tenantBusinessCache.get(tenantId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const { data, error } = await supabase
      .from('tenants')
      .select(`
        id,
        nom,
        business_profile,
        profile_config,
        location_config,
        contact_config,
        urls_config,
        assistant_config,
        terminology_override,
        features_config
      `)
      .eq('id', tenantId)
      .single();

    if (error || !data) {
      console.warn(`[TenantBusiness] Tenant ${tenantId} not found in DB, using static config`);
      return null;
    }

    // Cache the result
    tenantBusinessCache.set(tenantId, {
      data,
      timestamp: Date.now()
    });

    return data;
  } catch (err) {
    console.error(`[TenantBusiness] Error loading tenant ${tenantId}:`, err);
    return null;
  }
}

/**
 * Invalide le cache pour un tenant
 */
export function invalidateCache(tenantId) {
  if (tenantId) {
    tenantBusinessCache.delete(tenantId);
  } else {
    tenantBusinessCache.clear();
  }
}

// ═══════════════════════════════════════════════════════════════════
// FONCTIONS PRINCIPALES
// ═══════════════════════════════════════════════════════════════════

/**
 * Récupère les informations business d'un tenant.
 * REMPLACE l'ancien SALON_INFO hardcodé.
 *
 * @param {string} tenantId - ID du tenant
 * @returns {Object} Informations business du tenant
 */
export async function getBusinessInfo(tenantId) {
  if (!tenantId) {
    throw new Error('tenant_id requis pour getBusinessInfo');
  }

  // Essayer de charger depuis DB
  const dbConfig = await loadTenantBusinessConfig(tenantId);

  // Fallback sur config statique
  const staticConfig = getTenantConfig(tenantId);

  if (!dbConfig && !staticConfig) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  // Merger DB config + static config
  const businessType = dbConfig?.business_profile || staticConfig?.business_type || 'salon';
  const typeConfig = getBusinessType(businessType);

  // Parser les configs JSON
  const locationConfig = typeof dbConfig?.location_config === 'string'
    ? JSON.parse(dbConfig.location_config)
    : (dbConfig?.location_config || staticConfig?.location || {});

  const contactConfig = typeof dbConfig?.contact_config === 'string'
    ? JSON.parse(dbConfig.contact_config)
    : (dbConfig?.contact_config || staticConfig?.contact || {});

  const urlsConfig = typeof dbConfig?.urls_config === 'string'
    ? JSON.parse(dbConfig.urls_config)
    : (dbConfig?.urls_config || staticConfig?.urls || {});

  const assistantConfig = typeof dbConfig?.assistant_config === 'string'
    ? JSON.parse(dbConfig.assistant_config)
    : (dbConfig?.assistant_config || staticConfig?.assistant || {});

  return {
    // Identité
    id: tenantId,
    nom: dbConfig?.nom || staticConfig?.name || tenantId,
    businessType: businessType,
    businessTypeLabel: typeConfig?.label || businessType,

    // Gérant/Responsable
    gerant: staticConfig?.gerante || staticConfig?.manager || assistantConfig?.name || 'Nexus',

    // Contact
    telephone: contactConfig?.phone || staticConfig?.telephone || '',
    whatsapp: contactConfig?.whatsapp || staticConfig?.whatsapp || '',
    email: contactConfig?.email || staticConfig?.email || '',

    // Localisation
    adresse: locationConfig?.base_address || locationConfig?.address || staticConfig?.adresse || '',
    zone: locationConfig?.zone || '',
    locationMode: locationConfig?.mode || (typeConfig?.businessRules?.allowDomicile ? 'mobile' : 'fixed'),

    // Frais de déplacement
    travelFees: {
      enabled: locationConfig?.travel_fees?.enabled ?? typeConfig?.features?.travelFees ?? false,
      freeRadiusKm: locationConfig?.travel_fees?.free_radius_km ?? typeConfig?.businessRules?.travelFeesFreeRadiusKm ?? 5,
      pricePerKm: locationConfig?.travel_fees?.price_per_km ?? typeConfig?.businessRules?.travelFeesPricePerKm ?? 50
    },

    // URLs
    urls: {
      frontend: urlsConfig?.frontend || staticConfig?.frontend_url || '',
      booking: urlsConfig?.booking || '/reserver',
      payment: urlsConfig?.payment || '/paiement',
      reviews: urlsConfig?.reviews || '/avis'
    },

    // Assistant IA
    assistant: {
      name: assistantConfig?.name || 'Nexus',
      voiceId: assistantConfig?.voice_id || 'FFXYdAYPzn8Tw8KiHZqg',
      personality: assistantConfig?.personality || 'friendly',
      language: assistantConfig?.language || 'fr'
    },

    // Horaires
    horaires: staticConfig?.horaires || {}
  };
}

/**
 * Version synchrone de getBusinessInfo (utilise le cache ou config statique)
 * À utiliser quand on ne peut pas faire d'async
 */
export function getBusinessInfoSync(tenantId) {
  if (!tenantId) {
    throw new Error('tenant_id requis pour getBusinessInfoSync');
  }

  // Check cache first
  const cached = tenantBusinessCache.get(tenantId);
  const dbConfig = cached?.data || null;

  // Fallback sur config statique
  const staticConfig = getTenantConfig(tenantId);

  if (!dbConfig && !staticConfig) {
    // Retourner des valeurs par défaut
    return {
      id: tenantId,
      nom: tenantId,
      businessType: 'salon',
      gerant: 'Nexus',
      telephone: '',
      whatsapp: '',
      email: '',
      adresse: '',
      zone: '',
      locationMode: 'fixed',
      travelFees: { enabled: false, freeRadiusKm: 5, pricePerKm: 50 },
      urls: { frontend: '', booking: '/reserver', payment: '/paiement', reviews: '/avis' },
      assistant: { name: 'Nexus', voiceId: 'FFXYdAYPzn8Tw8KiHZqg', personality: 'friendly', language: 'fr' },
      horaires: {}
    };
  }

  const businessType = dbConfig?.business_profile || staticConfig?.business_type || 'salon';
  const typeConfig = getBusinessType(businessType);

  const locationConfig = dbConfig?.location_config || staticConfig?.location || {};
  const contactConfig = dbConfig?.contact_config || staticConfig?.contact || {};
  const urlsConfig = dbConfig?.urls_config || staticConfig?.urls || {};
  const assistantConfig = dbConfig?.assistant_config || staticConfig?.assistant || {};

  return {
    id: tenantId,
    nom: dbConfig?.nom || staticConfig?.name || tenantId,
    businessType: businessType,
    businessTypeLabel: typeConfig?.label || businessType,
    gerant: staticConfig?.gerante || staticConfig?.manager || assistantConfig?.name || 'Nexus',
    telephone: contactConfig?.phone || staticConfig?.telephone || '',
    whatsapp: contactConfig?.whatsapp || staticConfig?.whatsapp || '',
    email: contactConfig?.email || staticConfig?.email || '',
    adresse: locationConfig?.base_address || locationConfig?.address || staticConfig?.adresse || '',
    zone: locationConfig?.zone || '',
    locationMode: locationConfig?.mode || 'fixed',
    travelFees: {
      enabled: locationConfig?.travel_fees?.enabled ?? false,
      freeRadiusKm: locationConfig?.travel_fees?.free_radius_km ?? 5,
      pricePerKm: locationConfig?.travel_fees?.price_per_km ?? 50
    },
    urls: {
      frontend: urlsConfig?.frontend || staticConfig?.frontend_url || '',
      booking: urlsConfig?.booking || '/reserver',
      payment: urlsConfig?.payment || '/paiement',
      reviews: urlsConfig?.reviews || '/avis'
    },
    assistant: {
      name: assistantConfig?.name || 'Nexus',
      voiceId: assistantConfig?.voice_id || 'FFXYdAYPzn8Tw8KiHZqg',
      personality: assistantConfig?.personality || 'friendly',
      language: assistantConfig?.language || 'fr'
    },
    horaires: staticConfig?.horaires || {}
  };
}

/**
 * Récupère le type de business d'un tenant
 */
export async function getBusinessType_Tenant(tenantId) {
  const dbConfig = await loadTenantBusinessConfig(tenantId);
  const staticConfig = getTenantConfig(tenantId);
  return dbConfig?.business_profile || staticConfig?.business_type || 'salon';
}

/**
 * Version synchrone
 */
export function getBusinessTypeSync(tenantId) {
  const cached = tenantBusinessCache.get(tenantId);
  const staticConfig = getTenantConfig(tenantId);
  return cached?.data?.business_profile || staticConfig?.business_type || 'salon';
}

// ═══════════════════════════════════════════════════════════════════
// TERMINOLOGIE
// ═══════════════════════════════════════════════════════════════════

/**
 * Récupère un terme localisé pour le tenant.
 *
 * @param {string} tenantId - ID du tenant
 * @param {string} key - Clé du terme (reservation, service, client, employee, etc.)
 * @param {boolean} plural - Forme plurielle
 * @returns {string} Le terme localisé
 */
export function getTerminology(tenantId, key, plural = false) {
  // Check for tenant-specific override first
  const cached = tenantBusinessCache.get(tenantId);
  const terminologyOverride = cached?.data?.terminology_override;
  if (terminologyOverride && terminologyOverride[key]) {
    const term = terminologyOverride[key];
    if (typeof term === 'object') {
      return plural ? term.plural : term.singular;
    }
    return term;
  }

  // Fallback to business type default
  const businessType = getBusinessTypeSync(tenantId);
  return getTypeTerminology(businessType, key, plural);
}

/**
 * Récupère tous les termes pour un tenant
 */
export function getAllTerminology(tenantId) {
  const businessType = getBusinessTypeSync(tenantId);
  const typeConfig = getBusinessType(businessType);
  const cached = tenantBusinessCache.get(tenantId);
  const override = cached?.data?.terminology_override || {};

  return {
    ...typeConfig?.terminology,
    ...override
  };
}

// ═══════════════════════════════════════════════════════════════════
// FEATURES
// ═══════════════════════════════════════════════════════════════════

/**
 * Vérifie si une feature est activée pour un tenant.
 *
 * @param {string} tenantId - ID du tenant
 * @param {string} feature - Nom de la feature
 * @returns {boolean}
 */
export function hasFeature(tenantId, feature) {
  // Check tenant-specific features first
  const cached = tenantBusinessCache.get(tenantId);
  const featuresConfig = cached?.data?.features_config;
  if (featuresConfig && feature in featuresConfig) {
    return featuresConfig[feature] === true;
  }

  // Check static config
  const staticConfig = getTenantConfig(tenantId);
  if (staticConfig?.features && feature in staticConfig.features) {
    return staticConfig.features[feature] === true;
  }

  // Fallback to business type default
  const businessType = getBusinessTypeSync(tenantId);
  return hasTypeFeature(businessType, feature);
}

// ═══════════════════════════════════════════════════════════════════
// RÈGLES MÉTIER
// ═══════════════════════════════════════════════════════════════════

/**
 * Récupère une règle métier pour un tenant.
 *
 * @param {string} tenantId - ID du tenant
 * @param {string} rule - Nom de la règle
 * @param {any} defaultValue - Valeur par défaut
 * @returns {any}
 */
export function getBusinessRule(tenantId, rule, defaultValue = null) {
  const businessType = getBusinessTypeSync(tenantId);
  return getTypeBusinessRule(businessType, rule, defaultValue);
}

/**
 * Récupère le lieu par défaut pour un tenant
 */
export function getDefaultLocation(tenantId) {
  const businessType = getBusinessTypeSync(tenantId);
  return getTypeBusinessRule(businessType, 'defaultLocation', 'salon');
}

// ═══════════════════════════════════════════════════════════════════
// VALIDATION DES CHAMPS
// ═══════════════════════════════════════════════════════════════════

/**
 * Vérifie si un champ est requis
 */
export function isFieldRequired(tenantId, context, field) {
  const businessType = getBusinessTypeSync(tenantId);
  return isTypeFieldRequired(businessType, context, field);
}

/**
 * Vérifie si un champ est interdit
 */
export function isFieldForbidden(tenantId, context, field) {
  const businessType = getBusinessTypeSync(tenantId);
  return isTypeFieldForbidden(businessType, context, field);
}

/**
 * Vérifie si un champ est visible (non interdit)
 */
export function isFieldVisible(tenantId, context, field) {
  return !isFieldForbidden(tenantId, context, field);
}

// ═══════════════════════════════════════════════════════════════════
// CALCUL DE PRIX
// ═══════════════════════════════════════════════════════════════════

/**
 * Calcule le prix total avec frais de déplacement si applicable.
 *
 * @param {string} tenantId - ID du tenant
 * @param {number} basePrice - Prix de base en centimes
 * @param {Object} options - Options (distance_km, nights, covers, etc.)
 * @returns {Object} { total, breakdown }
 */
export async function calculatePrice(tenantId, basePrice, options = {}) {
  const info = await getBusinessInfo(tenantId);
  const businessType = info.businessType;

  let total = basePrice;
  const breakdown = {
    base: basePrice,
    travelFees: 0,
    extras: 0
  };

  // Frais de déplacement (service_domicile)
  if (info.travelFees.enabled && options.distance_km) {
    const billableKm = Math.max(0, options.distance_km - info.travelFees.freeRadiusKm);
    const travelFee = billableKm * info.travelFees.pricePerKm;
    breakdown.travelFees = travelFee;
    total += travelFee;
  }

  // Nuitées (hotel)
  if (businessType === 'hotel' && options.nights > 0) {
    total = basePrice * options.nights;
    breakdown.base = total;
  }

  // Couverts/personnes (restaurant - si prix par personne)
  if (businessType === 'restaurant' && options.price_per_person && options.covers > 0) {
    total = options.price_per_person * options.covers;
    breakdown.base = total;
  }

  // Extras
  if (options.extras && Array.isArray(options.extras)) {
    const extrasTotal = options.extras.reduce((sum, extra) => sum + (extra.prix || 0), 0);
    breakdown.extras = extrasTotal;
    total += extrasTotal;
  }

  return {
    total,
    breakdown
  };
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS POUR PROMPTS IA
// ═══════════════════════════════════════════════════════════════════

/**
 * Génère le contexte business pour les prompts IA.
 */
export async function getAIContext(tenantId) {
  const info = await getBusinessInfo(tenantId);
  const terminology = getAllTerminology(tenantId);

  return {
    businessName: info.nom,
    businessType: info.businessType,
    businessTypeLabel: info.businessTypeLabel,
    manager: info.gerant,
    assistantName: info.assistant.name,
    phone: info.telephone,
    whatsapp: info.whatsapp,
    email: info.email,
    address: info.adresse,
    zone: info.zone,
    locationMode: info.locationMode,
    travelFeesEnabled: info.travelFees.enabled,
    travelFeesFreeKm: info.travelFees.freeRadiusKm,
    travelFeesPricePerKm: info.travelFees.pricePerKm / 100, // En euros
    frontendUrl: info.urls.frontend,
    bookingUrl: `${info.urls.frontend}${info.urls.booking}`,
    terminology
  };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export default {
  getBusinessInfo,
  getBusinessInfoSync,
  getBusinessType: getBusinessType_Tenant,
  getBusinessTypeSync,
  getTerminology,
  getAllTerminology,
  hasFeature,
  getBusinessRule,
  getDefaultLocation,
  isFieldRequired,
  isFieldForbidden,
  isFieldVisible,
  calculatePrice,
  getAIContext,
  invalidateCache
};
