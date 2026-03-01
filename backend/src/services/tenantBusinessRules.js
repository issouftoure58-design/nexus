/**
 * Tenant-aware Business Rules Service
 *
 * Charge les règles métier (services, horaires, frais) dynamiquement par tenant.
 * Les tenants "frozen" utilisent les valeurs hardcodées de businessRules.js.
 * Les autres tenants chargent depuis la DB.
 *
 * @module tenantBusinessRules
 */

import { rawSupabase } from '../config/supabase.js';
import { isFrozenTenant, getEffectiveConfig } from '../templates/templateLoader.js';
import logger from '../config/logger.js';

// Import frozen rules for backward compatibility
import {
  SERVICES as FROZEN_SERVICES,
  TRAVEL_FEES as FROZEN_TRAVEL_FEES,
  BUSINESS_HOURS as FROZEN_HOURS,
  BOOKING_RULES as FROZEN_BOOKING_RULES,
  BLOCKING_STATUTS,
} from '../config/businessRules.js';

// ============================================
// SERVICES
// ============================================

/**
 * Obtient tous les services pour un tenant
 * @param {string} tenantId - ID du tenant
 * @returns {Promise<Array>} - Liste des services
 */
export async function getServicesForTenant(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED');
  }

  // Frozen tenant = use hardcoded rules
  if (isFrozenTenant(tenantId)) {
    logger.info(`BUSINESS_RULES Using frozen services for ${tenantId}`);
    return Object.values(FROZEN_SERVICES).map(normalizeService);
  }

  // Try to load from DB first
  try {
    const { data: services, error } = await rawSupabase
      .from('services')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .order('category', { ascending: true });

    if (!error && services && services.length > 0) {
      logger.info(`BUSINESS_RULES Loaded ${services.length} services from DB for ${tenantId}`);
      return services.map(normalizeServiceFromDb);
    }
  } catch (err) {
    logger.warn(`BUSINESS_RULES Error loading services from DB: ${err.message}`);
  }

  // Fallback: try tenant config
  try {
    const config = await getEffectiveConfig({ id: tenantId });
    if (config.services && Object.keys(config.services).length > 0) {
      const serviceArray = Array.isArray(config.services)
        ? config.services
        : Object.values(config.services);
      logger.info(`BUSINESS_RULES Using config services for ${tenantId}`);
      return serviceArray.map(normalizeService);
    }
  } catch (err) {
    logger.warn(`BUSINESS_RULES Error loading services from config: ${err.message}`);
  }

  logger.info(`BUSINESS_RULES No services found for ${tenantId}`);
  return [];
}

/**
 * Trouve un service par son nom (recherche flexible)
 * @param {string} tenantId - ID du tenant
 * @param {string} serviceName - Nom du service à chercher
 * @returns {Promise<Object|null>}
 */
export async function findServiceByNameForTenant(tenantId, serviceName) {
  if (!tenantId || !serviceName) return null;

  const services = await getServicesForTenant(tenantId);
  const normalized = normalizeSearchTerm(serviceName);

  // 1. Exact match
  let found = services.find(s =>
    s.name.toLowerCase() === serviceName.toLowerCase()
  );
  if (found) return found;

  // 2. Normalized match
  found = services.find(s => {
    const sNorm = normalizeSearchTerm(s.name);
    return sNorm === normalized;
  });
  if (found) return found;

  // 3. Contains match
  found = services.find(s => {
    const sNorm = normalizeSearchTerm(s.name);
    return sNorm.includes(normalized) || normalized.includes(sNorm);
  });
  if (found) return found;

  // 4. Fuzzy match (first word)
  const firstWord = normalized.split(' ')[0];
  if (firstWord.length >= 4) {
    found = services.find(s =>
      normalizeSearchTerm(s.name).includes(firstWord)
    );
  }

  return found || null;
}

/**
 * Obtient le prix d'un service
 * @param {string} tenantId
 * @param {string} serviceName
 * @returns {Promise<Object|null>}
 */
export async function getPriceForTenant(tenantId, serviceName) {
  const service = await findServiceByNameForTenant(tenantId, serviceName);
  if (!service) return null;

  return {
    service: service.name,
    price: service.price,
    priceInCents: service.priceInCents || service.price * 100,
    priceText: service.priceIsMinimum
      ? `À partir de ${service.price}€`
      : `${service.price}€`,
    durationMinutes: service.durationMinutes,
    blocksFullDay: service.blocksFullDay,
  };
}

// ============================================
// TRAVEL FEES
// ============================================

/**
 * Obtient les frais de déplacement pour un tenant
 * @param {string} tenantId
 * @returns {Promise<Object|null>}
 */
export async function getTravelFeesForTenant(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED');
  }

  // Frozen tenant
  if (isFrozenTenant(tenantId)) {
    return normalizeTravelFees(FROZEN_TRAVEL_FEES);
  }

  // Load from effective config
  try {
    const config = await getEffectiveConfig({ id: tenantId });
    if (config.travelFees) {
      return normalizeTravelFees(config.travelFees);
    }
  } catch (err) {
    logger.warn(`BUSINESS_RULES Error loading travel fees: ${err.message}`);
  }

  return null;
}

/**
 * Calcule les frais de déplacement
 * @param {string} tenantId
 * @param {number} distanceKm
 * @returns {Promise<Object>}
 */
export async function calculateTravelFeeForTenant(tenantId, distanceKm) {
  const fees = await getTravelFeesForTenant(tenantId);

  if (!fees) {
    return { success: false, error: 'Frais de déplacement non configurés' };
  }

  const km = parseFloat(distanceKm) || 0;
  let frais = 0;

  if (km > fees.baseDistanceKm) {
    frais = fees.baseFee + (km - fees.baseDistanceKm) * fees.perKmBeyond;
  } else if (km > 0) {
    frais = fees.baseFee;
  }

  frais = Math.round(frais * 100) / 100;

  return {
    success: true,
    distanceKm: km,
    frais,
    fraisInCents: Math.round(frais * 100),
    gratuit: km <= fees.baseDistanceKm,
    details: km <= fees.baseDistanceKm
      ? `Gratuit (moins de ${fees.baseDistanceKm} km)`
      : `${fees.baseFee}€ + ${(km - fees.baseDistanceKm).toFixed(1)} km × ${fees.perKmBeyond}€`,
  };
}

// ============================================
// BUSINESS HOURS
// ============================================

/**
 * Obtient les horaires d'ouverture pour un tenant
 * @param {string} tenantId
 * @returns {Promise<Object>}
 */
export async function getBusinessHoursForTenant(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED');
  }

  // Frozen tenant
  if (isFrozenTenant(tenantId)) {
    return normalizeBusinessHours(FROZEN_HOURS);
  }

  // Try business_hours table first
  try {
    const { data: businessHours, error } = await rawSupabase
      .from('business_hours')
      .select('day_of_week, open_time, close_time, is_closed')
      .eq('tenant_id', tenantId);

    if (!error && businessHours && businessHours.length > 0) {
      const hours = {};
      for (let i = 0; i < 7; i++) {
        const h = businessHours.find(x => x.day_of_week === i);
        hours[i] = h && !h.is_closed ? { open: h.open_time, close: h.close_time } : null;
      }
      return normalizeBusinessHours({ SCHEDULE: hours });
    }
  } catch (err) {
    logger.warn(`BUSINESS_RULES Error loading business_hours: ${err.message}`);
  }

  // Fallback to config
  try {
    const config = await getEffectiveConfig({ id: tenantId });
    if (config.businessHours) {
      return normalizeBusinessHours({ SCHEDULE: config.businessHours });
    }
  } catch (err) {
    logger.warn(`BUSINESS_RULES Error loading business hours from config: ${err.message}`);
  }

  // Default: all days open 9-18
  return normalizeBusinessHours({
    SCHEDULE: {
      0: null, // Sunday closed
      1: { open: '09:00', close: '18:00' },
      2: { open: '09:00', close: '18:00' },
      3: { open: '09:00', close: '18:00' },
      4: { open: '09:00', close: '18:00' },
      5: { open: '09:00', close: '18:00' },
      6: { open: '09:00', close: '18:00' },
    }
  });
}

/**
 * Vérifie si un jour est ouvert
 * @param {string} tenantId
 * @param {number} dayOfWeek - 0=Dimanche, 6=Samedi
 * @returns {Promise<boolean>}
 */
export async function isOpenOnDay(tenantId, dayOfWeek) {
  const hours = await getBusinessHoursForTenant(tenantId);
  return hours.isOpen(dayOfWeek);
}

/**
 * Obtient les horaires d'un jour spécifique
 * @param {string} tenantId
 * @param {number} dayOfWeek
 * @returns {Promise<Object|null>}
 */
export async function getHoursForDay(tenantId, dayOfWeek) {
  const hours = await getBusinessHoursForTenant(tenantId);
  return hours.getHours(dayOfWeek);
}

// ============================================
// BOOKING RULES
// ============================================

/**
 * Obtient les règles de réservation pour un tenant
 * @param {string} tenantId
 * @returns {Promise<Object>}
 */
export async function getBookingRulesForTenant(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED');
  }

  // Frozen tenant
  if (isFrozenTenant(tenantId)) {
    return normalizeBookingRules(FROZEN_BOOKING_RULES);
  }

  // Load from config
  try {
    const config = await getEffectiveConfig({ id: tenantId });
    if (config.bookingRules) {
      return normalizeBookingRules(config.bookingRules);
    }
  } catch (err) {
    logger.warn(`BUSINESS_RULES Error loading booking rules: ${err.message}`);
  }

  // Default rules
  return normalizeBookingRules({
    MIN_ADVANCE_HOURS: 24,
    MAX_ADVANCE_DAYS: 60,
    DEPOSIT_PERCENT: 30,
    FREE_CANCELLATION_HOURS: 48,
  });
}

/**
 * Obtient les statuts bloquants (pour vérification dispo)
 * @returns {Array<string>}
 */
export function getBlockingStatuts() {
  return BLOCKING_STATUTS || ['demande', 'confirme', 'en_attente', 'en_attente_paiement'];
}

// ============================================
// NORMALIZATION HELPERS
// ============================================

function normalizeService(svc) {
  // Note: Si svc vient de la BDD, prix est en centimes. Si de businessRules.js, price est en euros.
  const priceInCents = svc.priceInCents || svc.prix || (svc.price ? svc.price * 100 : 0);
  return {
    id: svc.id,
    name: svc.name || svc.nom,
    category: svc.category || 'other',
    price: svc.price || (priceInCents / 100),
    priceInCents: priceInCents,
    priceIsMinimum: svc.priceIsMinimum || svc.price_is_minimum || false,
    durationMinutes: svc.durationMinutes || svc.duree || 60,
    blocksFullDay: svc.blocksFullDay || svc.blocks_full_day || false,
    blocksDays: svc.blocksDays || svc.blocks_days || 1,
    specialInstructions: svc.specialInstructions || svc.special_instructions,
  };
}

function normalizeServiceFromDb(svc) {
  // Note: svc.prix est en CENTIMES dans la BDD
  return {
    id: svc.id,
    name: svc.nom,
    category: svc.category || 'other',
    price: svc.prix / 100,  // Centimes → euros
    priceInCents: svc.prix,  // Déjà en centimes
    priceIsMinimum: svc.price_is_minimum || false,
    durationMinutes: svc.duree || 60,
    blocksFullDay: svc.blocks_full_day || false,
    blocksDays: svc.blocks_days || 1,
    specialInstructions: svc.special_instructions,
  };
}

function normalizeTravelFees(fees) {
  return {
    baseDistanceKm: fees.BASE_DISTANCE_KM || fees.base_distance_km || 0,
    baseFee: fees.BASE_FEE || fees.base_fee || 0,
    baseFeeInCents: fees.BASE_FEE_CENTS || fees.base_fee_cents || (fees.BASE_FEE || fees.base_fee || 0) * 100,
    perKmBeyond: fees.PER_KM_BEYOND || fees.per_km_beyond || 0,
    perKmBeyondInCents: fees.PER_KM_BEYOND_CENTS || fees.per_km_beyond_cents || (fees.PER_KM_BEYOND || fees.per_km_beyond || 0) * 100,
  };
}

function normalizeBusinessHours(hours) {
  const schedule = hours.SCHEDULE || hours;

  return {
    schedule,
    isOpen: (day) => {
      const h = schedule[day] || schedule[String(day)];
      return h !== null && h !== undefined;
    },
    getHours: (day) => {
      const h = schedule[day] || schedule[String(day)];
      return h || null;
    },
    getOpenDays: () => {
      const days = [];
      for (let i = 0; i < 7; i++) {
        if (schedule[i] || schedule[String(i)]) {
          days.push(i);
        }
      }
      return days;
    },
  };
}

function normalizeBookingRules(rules) {
  return {
    minAdvanceHours: rules.MIN_ADVANCE_HOURS || rules.min_advance_hours || 24,
    maxAdvanceDays: rules.MAX_ADVANCE_DAYS || rules.max_advance_days || 60,
    depositPercent: rules.DEPOSIT_PERCENT || rules.deposit_percent || 0,
    freeCancellationHours: rules.FREE_CANCELLATION_HOURS || rules.free_cancellation_hours || 48,
    fullDayStartHour: rules.FULL_DAY_START_HOUR || rules.full_day_start_hour || 9,
  };
}

function normalizeSearchTerm(str) {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ');
}

// ============================================
// EXPORTS
// ============================================

export default {
  // Services
  getServicesForTenant,
  findServiceByNameForTenant,
  getPriceForTenant,

  // Travel Fees
  getTravelFeesForTenant,
  calculateTravelFeeForTenant,

  // Business Hours
  getBusinessHoursForTenant,
  isOpenOnDay,
  getHoursForDay,

  // Booking Rules
  getBookingRulesForTenant,
  getBlockingStatuts,
};
