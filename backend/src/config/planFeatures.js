/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║   PLAN FEATURES — SOURCE UNIQUE DE VÉRITÉ                          ║
 * ╠══════════════════════════════════════════════════════════════════════╣
 * ║                                                                      ║
 * ║   CE FICHIER est la seule source de vérité pour les features         ║
 * ║   par plan. Tous les autres fichiers DOIVENT importer depuis ici.    ║
 * ║                                                                      ║
 * ║   NE JAMAIS dupliquer ces définitions ailleurs.                      ║
 * ║                                                                      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Grille tarifaire 2026:
 * - STARTER (99€/mois): Fonctionnalités de base
 * - PRO (249€/mois): Fonctionnalités avancées + canaux IA
 * - BUSINESS (499€/mois): Tout inclus + premium
 */

// ═══════════════════════════════════════════════════════════════
// FEATURES PAR PLAN — Noms canoniques (pas d'alias)
// ═══════════════════════════════════════════════════════════════

const STARTER_FEATURES = {
  dashboard: true,
  clients: true,
  reservations: true,
  facturation: true,
  agent_ia_web: true,
  documents: true,
  paiements: true,
  ecommerce: true,
};

const PRO_FEATURES = {
  ...STARTER_FEATURES,
  // Canaux IA
  whatsapp: true,
  telephone: true,
  // Modules Pro
  comptabilite: true,
  crm_avance: true,
  devis: true,
  stock: true,
};

const BUSINESS_FEATURES = {
  ...PRO_FEATURES,
  // Marketing & Commercial
  marketing: true,
  pipeline: true,
  commercial: true,
  // Analytics & SEO
  analytics: true,
  seo: true,
  // RH
  rh: true,
  // Technique
  api: true,
  sentinel: true,
  whitelabel: true,
};

export const PLAN_FEATURES = {
  starter: STARTER_FEATURES,
  pro: PRO_FEATURES,
  business: BUSINESS_FEATURES,
};

// ═══════════════════════════════════════════════════════════════
// MAPPING ROUTES → MODULE REQUIS
// ═══════════════════════════════════════════════════════════════

export const ROUTE_MODULES = {
  // Toujours disponible (Starter+)
  '/api/rendez-vous': 'reservations',
  '/api/admin/reservations': 'reservations',
  '/api/admin/disponibilites': 'reservations',
  '/api/admin/clients': 'clients',
  '/api/admin/factures': 'facturation',
  '/api/payment': 'paiements',
  '/api/orders': 'ecommerce',
  '/api/admin/orders': 'ecommerce',
  '/api/chat': 'agent_ia_web',
  '/api/admin/agents': 'agent_ia_web',

  // Canaux IA (Pro+)
  '/api/whatsapp': 'whatsapp',
  '/api/twilio/whatsapp': 'whatsapp',
  '/api/voice': 'telephone',
  '/api/twilio/voice': 'telephone',

  // Modules Pro
  '/api/admin/comptabilite': 'comptabilite',
  '/api/admin/compta': 'comptabilite',
  '/api/admin/crm': 'crm_avance',
  '/api/admin/devis': 'devis',
  '/api/admin/stock': 'stock',

  // Modules Business
  '/api/admin/marketing': 'marketing',
  '/api/admin/pipeline': 'pipeline',
  '/api/admin/analytics': 'analytics',
  '/api/admin/seo': 'seo',
  '/api/admin/rh': 'rh',
  '/api/admin/api-keys': 'api',
  '/api/admin/webhooks': 'api',
};

// ═══════════════════════════════════════════════════════════════
// LIMITES PAR PLAN
// ═══════════════════════════════════════════════════════════════

export const PLAN_LIMITS = {
  starter: { clients_max: 200, reservations_mois: 500 },
  pro: { clients_max: 2000, reservations_mois: 5000 },
  business: { clients_max: -1, reservations_mois: -1 },
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Retourne les features pour un plan donné (fallback starter)
 */
export function getFeaturesForPlan(plan) {
  return PLAN_FEATURES[plan?.toLowerCase()] || PLAN_FEATURES.starter;
}

/**
 * Vérifie si un module est inclus dans un plan
 */
export function isPlanFeature(plan, feature) {
  const features = getFeaturesForPlan(plan);
  return features[feature] === true;
}

/**
 * Retourne les plans qui incluent un module donné
 */
export function getPlansForFeature(feature) {
  const plans = [];
  for (const [planName, features] of Object.entries(PLAN_FEATURES)) {
    if (features[feature] === true) {
      plans.push(planName);
    }
  }
  return plans;
}

/**
 * Plan minimum requis pour une feature
 */
export function getMinPlanForFeature(feature) {
  if (STARTER_FEATURES[feature]) return 'starter';
  if (PRO_FEATURES[feature]) return 'pro';
  if (BUSINESS_FEATURES[feature]) return 'business';
  return null;
}

export default {
  PLAN_FEATURES,
  PLAN_LIMITS,
  ROUTE_MODULES,
  getFeaturesForPlan,
  isPlanFeature,
  getPlansForFeature,
  getMinPlanForFeature,
};
