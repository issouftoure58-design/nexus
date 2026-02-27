/**
 * Index des templates de tenant par type de business
 */

export { SERVICE_DOMICILE_TEMPLATE } from './service_domicile.js';
export { SALON_TEMPLATE } from './salon.js';
export { RESTAURANT_TEMPLATE } from './restaurant.js';
export { HOTEL_TEMPLATE } from './hotel.js';

import { SERVICE_DOMICILE_TEMPLATE } from './service_domicile.js';
import { SALON_TEMPLATE } from './salon.js';
import { RESTAURANT_TEMPLATE } from './restaurant.js';
import { HOTEL_TEMPLATE } from './hotel.js';

/**
 * Map des templates par type de business
 */
export const TEMPLATES = {
  service_domicile: SERVICE_DOMICILE_TEMPLATE,
  salon: SALON_TEMPLATE,
  restaurant: RESTAURANT_TEMPLATE,
  hotel: HOTEL_TEMPLATE
};

/**
 * Récupère le template pour un type de business
 */
export function getTemplate(businessType) {
  return TEMPLATES[businessType] || null;
}

/**
 * Crée une configuration de tenant à partir d'un template
 */
export function createTenantFromTemplate(businessType, overrides = {}) {
  const template = getTemplate(businessType);
  if (!template) {
    throw new Error(`Unknown business type: ${businessType}`);
  }

  // Deep merge du template avec les overrides
  return deepMerge(JSON.parse(JSON.stringify(template)), overrides);
}

/**
 * Deep merge de deux objets
 */
function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

export default TEMPLATES;
