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
        name,
        description,
        concept,
        business_profile,
        template_id,
        config,
        travel_fees,
        assistant_name,
        telephone,
        adresse,
        email
      `)
      .eq('id', tenantId)
      .single();

    if (error || !data) {
      console.warn(`[TenantBusiness] Tenant ${tenantId} not found in DB:`, error?.message);
      return null;
    }

    // Map 'name' to 'nom' for backward compatibility
    data.nom = data.name;

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

  // Parser les configs depuis les colonnes DB existantes
  const travelFeesConfig = typeof dbConfig?.travel_fees === 'string'
    ? JSON.parse(dbConfig.travel_fees)
    : (dbConfig?.travel_fees || {});

  // Fallback sur config statique pour les champs avancés
  const locationConfig = staticConfig?.location || {};
  const urlsConfig = staticConfig?.urls || {};
  const assistantConfig = staticConfig?.assistant || {};

  return {
    // Identité
    id: tenantId,
    nom: dbConfig?.nom || staticConfig?.name || tenantId,
    businessType: businessType,
    businessTypeLabel: typeConfig?.label || businessType,

    // Gérant/Responsable
    gerant: staticConfig?.gerante || staticConfig?.manager || dbConfig?.assistant_name || 'Nexus',

    // Contact (DB columns first, then static config)
    telephone: dbConfig?.telephone || staticConfig?.telephone || '',
    whatsapp: staticConfig?.whatsapp || '',
    email: dbConfig?.email || staticConfig?.email || '',

    // Localisation
    adresse: dbConfig?.adresse || locationConfig?.base_address || locationConfig?.address || staticConfig?.adresse || '',
    zone: locationConfig?.zone || '',
    locationMode: locationConfig?.mode || (typeConfig?.businessRules?.allowDomicile ? 'mobile' : 'fixed'),

    // Frais de déplacement
    travelFees: {
      enabled: travelFeesConfig?.enabled ?? typeConfig?.features?.travelFees ?? false,
      freeRadiusKm: travelFeesConfig?.free_radius_km ?? typeConfig?.businessRules?.travelFeesFreeRadiusKm ?? 5,
      pricePerKm: travelFeesConfig?.price_per_km ?? typeConfig?.businessRules?.travelFeesPricePerKm ?? 50
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
      name: dbConfig?.assistant_name || staticConfig?.assistantName || assistantConfig?.name || 'Nexus',
      voiceId: assistantConfig?.voice_id || 'FFXYdAYPzn8Tw8KiHZqg',
      personality: assistantConfig?.personality || 'friendly',
      language: assistantConfig?.language || 'fr'
    },

    // Features du business type
    features: typeConfig?.features || {},

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

  const travelFeesConfig = dbConfig?.travel_fees || {};
  const locationConfig = staticConfig?.location || {};
  const urlsConfig = staticConfig?.urls || {};
  const assistantConfig = staticConfig?.assistant || {};

  // Le config JSONB contient souvent les champs metier (assistantName, gerante, etc.)
  const configJsonb = dbConfig?.config || {};

  return {
    id: tenantId,
    nom: dbConfig?.nom || dbConfig?.name || staticConfig?.name || tenantId,
    description: dbConfig?.description || dbConfig?.concept || staticConfig?.description || '',
    businessType: businessType,
    businessTypeLabel: typeConfig?.label || businessType,
    gerant: configJsonb?.gerante || staticConfig?.gerante || staticConfig?.manager || 'le responsable',
    telephone: dbConfig?.telephone || staticConfig?.telephone || '',
    telephone_transfert: configJsonb?.telephone || staticConfig?.telephone || '',
    whatsapp: configJsonb?.whatsapp || staticConfig?.whatsapp || '',
    email: dbConfig?.email || staticConfig?.email || '',
    adresse: dbConfig?.adresse || locationConfig?.base_address || staticConfig?.adresse || '',
    zone: locationConfig?.zone || '',
    locationMode: locationConfig?.mode || 'fixed',
    travelFees: {
      enabled: travelFeesConfig?.enabled ?? false,
      freeRadiusKm: travelFeesConfig?.free_radius_km ?? 5,
      pricePerKm: travelFeesConfig?.price_per_km ?? 50
    },
    urls: {
      frontend: urlsConfig?.frontend || staticConfig?.frontend_url || '',
      booking: urlsConfig?.booking || '/reserver',
      payment: urlsConfig?.payment || '/paiement',
      reviews: urlsConfig?.reviews || '/avis'
    },
    assistant: {
      name: configJsonb?.assistantName || dbConfig?.assistant_name || staticConfig?.assistantName || assistantConfig?.name || configJsonb?.assistant?.name || 'Nexus',
      voiceId: assistantConfig?.voice_id || configJsonb?.assistant?.voice_id || 'FFXYdAYPzn8Tw8KiHZqg',
      personality: assistantConfig?.personality || configJsonb?.assistant?.personality || 'friendly',
      language: assistantConfig?.language || configJsonb?.assistant?.language || 'fr'
    },
    assistant_name: configJsonb?.assistantName || staticConfig?.assistantName || assistantConfig?.name || configJsonb?.assistant?.name || null,
    features: typeConfig?.features || {},
    horaires: staticConfig?.horaires || configJsonb?.horaires || {}
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
