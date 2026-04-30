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
 * Modèle 2026 (révisé 27 avril 2026 — voir memory/business-model-2026.md):
 * - FREE       (0€/mois)   : Freemium à vie, quotas stricts, IA bloquée
 * - STARTER    (69€/mois)  : Toutes IA débloquées, CRM avancé, 200 limites, 5 postes
 * - PRO        (199€/mois) : + Facturation, Devis, Pipeline, Stock, Marketing complet, Equipe, Planning, Fidelite, multi-sites, 20 postes
 * - BUSINESS   (499€/mois) : + Compta basique, SEO, API/webhooks, 30 postes
 * - ENTERPRISE (899€/mois) : + RH complet, Compta analytique, Sentinel, White-label, SSO, AM, 50 postes
 */

// ═══════════════════════════════════════════════════════════════
// FEATURES PAR PLAN
// ═══════════════════════════════════════════════════════════════

/**
 * FREE — 0€/mois — Freemium à vie
 * Modules visibles dans le menu (effet WOW) mais verrouillés.
 * IA bloquée sauf chat admin limité.
 */
const FREE_FEATURES = {
  // Core CRUD (avec quotas)
  dashboard: true,
  clients: true,
  reservations: true,
  facturation: true,       // watermark "Propulsé par NEXUS"
  documents: true,
  paiements: true,
  ecommerce: true,
  reviews: true,
  waitlist: true,

  // Lecture seule sur modules avancés
  comptabilite_readonly: true,
  stock_readonly: true,
  rh_readonly: true,

  // ⛔ Fonctions IA bloquées
  agent_ia_web: false,
  whatsapp: false,
  telephone: false,

  // ⛔ Modules avancés bloqués
  equipe: false,
  fidelite: false,
  comptabilite: false,
  stock: false,
  rh: false,
  crm_avance: false,
  devis: false,
  marketing: false,
  pipeline: false,
  commercial: false,
  analytics: false,
  seo: false,
  workflows: false,
  sentinel: false,
  multi_site: false,
  whitelabel: false,
  api: false,
  sso: false,
};

/**
 * STARTER — 69€/mois — Premier plan payant
 * Toutes les IA débloquées + CRM avancé.
 * PAS de facturation, devis, pipeline, stock, marketing complet, equipe, planning, fidelite.
 */
const STARTER_FEATURES = {
  // Core CRUD (200 limites)
  dashboard: true,
  clients: true,
  reservations: true,
  documents: true,
  paiements: true,
  ecommerce: true,
  reviews: true,
  waitlist: true,

  // Modules débloqués Starter
  crm_avance: true,

  // ✨ IA — agent_ia_web auto-accordé (self-service)
  // ⚠️ whatsapp/telephone nécessitent provisioning manuel (voir activation-ia-protocol.md)
  agent_ia_web: true,

  // ⛔ Bloqués — Pro+
  facturation: false,
  equipe: false,
  fidelite: false,
  stock: false,
  devis: false,
  marketing: false,
  pipeline: false,
  commercial: false,
  workflows: false,
  planning: false,

  // ⛔ Bloqués — Business+
  comptabilite: false,
  seo: false,
  api: false,
  analytics: false,

  // ⛔ Bloqués — Enterprise uniquement
  rh: false,
  sentinel: false,
  compta_analytique: false,
  multi_site: false,
  whitelabel: false,
  sso: false,
};

/**
 * PRO — 199€/mois — Facturation, Devis, Pipeline, Equipe, Marketing complet, Stock, Fidelite
 * Multi-sites, tout illimité, 20 postes.
 * PAS de Compta, SEO, API, RH, Sentinel, White-label, SSO.
 */
const PRO_FEATURES = {
  ...STARTER_FEATURES,
  facturation: true,
  equipe: true,
  fidelite: true,
  stock: true,
  devis: true,
  marketing: true,
  pipeline: true,
  commercial: true,
  workflows: true,
  planning: true,
  multi_site: true,
};

/**
 * BUSINESS — 499€/mois — Compta basique, SEO, API
 * 30 postes, multi-sites.
 * PAS de RH, Compta analytique, Sentinel, White-label, SSO.
 */
const BUSINESS_FEATURES = {
  ...PRO_FEATURES,
  comptabilite: true,
  seo: true,
  api: true,
};

/**
 * ENTERPRISE — 899€/mois — Full premium
 * TOUT sans exception. 50 postes.
 * Exclusivités : RH complet, Compta analytique, Sentinel, Analytics, White-label, SSO, AM.
 */
const ENTERPRISE_FEATURES = {
  ...BUSINESS_FEATURES,
  analytics: true,
  compta_analytique: true,
  rh: true,
  sentinel: true,
  whitelabel: true,
  sso: true,
  support_prioritaire: true,
  account_manager: true,
};

export const PLAN_FEATURES = {
  free: FREE_FEATURES,
  starter: STARTER_FEATURES,
  pro: PRO_FEATURES,
  business: BUSINESS_FEATURES,
  enterprise: ENTERPRISE_FEATURES,
  // Legacy alias
  basic: STARTER_FEATURES,
};

// ═══════════════════════════════════════════════════════════════
// MAPPING ROUTES → MODULE REQUIS
// ═══════════════════════════════════════════════════════════════

export const ROUTE_MODULES = {
  // Toujours disponible (Free+)
  '/api/rendez-vous': 'reservations',
  '/api/admin/reservations': 'reservations',
  '/api/admin/disponibilites': 'reservations',
  '/api/admin/clients': 'clients',
  '/api/admin/factures': 'facturation',
  '/api/payment': 'paiements',
  '/api/orders': 'ecommerce',
  '/api/admin/orders': 'ecommerce',

  // Canaux IA (Starter+)
  '/api/chat': 'agent_ia_web',
  '/api/admin/agents': 'agent_ia_web',
  '/api/whatsapp': 'whatsapp',
  '/api/twilio/whatsapp': 'whatsapp',
  '/api/voice': 'telephone',
  '/api/twilio/voice': 'telephone',

  // Modules Starter+
  '/api/admin/crm': 'crm_avance',
  '/api/admin/devis': 'devis',
  '/api/admin/stock': 'stock',
  '/api/admin/marketing': 'marketing',
  '/api/admin/pipeline': 'pipeline',
  '/api/admin/analytics': 'analytics',
  '/api/admin/seo': 'seo',
  '/api/admin/equipe': 'equipe',
  '/api/admin/fidelite': 'fidelite',
  '/api/admin/workflows': 'workflows',

  // Business uniquement
  '/api/admin/comptabilite': 'comptabilite',
  '/api/admin/compta': 'comptabilite',
  '/api/admin/rh': 'rh',
  '/api/admin/api-keys': 'api',
  '/api/admin/webhooks': 'api',
  '/api/admin/multi-site': 'multi_site',
  '/api/admin/whitelabel': 'whitelabel',
};

// ═══════════════════════════════════════════════════════════════
// QUOTAS PAR PLAN
// ═══════════════════════════════════════════════════════════════

const FREE_LIMITS = {
  clients_max:        5,
  reservations_mois:  5,
  factures_mois:      5,
  prestations_max:    5,
  users_max:          1,
  chat_admin_questions_mois: 5,

  // DEPRECATED aliases
  clients:                5,
  reservations_per_month: 5,
  storage_gb:             1,
  posts_per_month:        0,
  images_per_month:       0,
};

const STARTER_LIMITS = {
  clients_max:        200,
  reservations_mois:  200,
  factures_mois:      200,
  prestations_max:    200,
  users_max:          5,
  chat_admin_questions_mois: -1,
  credits_ia_inclus_mois: 4000,

  // DEPRECATED aliases
  clients:                200,
  reservations_per_month: 200,
  storage_gb:             10,
  posts_per_month:        -1,
  images_per_month:       -1,
};

const PRO_LIMITS = {
  clients_max:        -1,
  reservations_mois:  -1,
  factures_mois:      -1,
  prestations_max:    -1,
  users_max:          20,
  chat_admin_questions_mois: -1,
  multi_site_max:     -1,
  credits_ia_inclus_mois: 20000,

  // DEPRECATED aliases
  clients:                -1,
  reservations_per_month: -1,
  storage_gb:             50,
  posts_per_month:        -1,
  images_per_month:       -1,
};

const BUSINESS_LIMITS = {
  clients_max:        -1,
  reservations_mois:  -1,
  factures_mois:      -1,
  prestations_max:    -1,
  users_max:          30,
  chat_admin_questions_mois: -1,
  multi_site_max:     -1,
  credits_ia_inclus_mois: 50000,

  // DEPRECATED aliases
  clients:                -1,
  reservations_per_month: -1,
  storage_gb:             200,
  posts_per_month:        -1,
  images_per_month:       -1,
};

const ENTERPRISE_LIMITS = {
  clients_max:        -1,
  reservations_mois:  -1,
  factures_mois:      -1,
  prestations_max:    -1,
  users_max:          50,
  chat_admin_questions_mois: -1,
  multi_site_max:     -1,
  credits_ia_inclus_mois: 100000,

  // DEPRECATED aliases
  clients:                -1,
  reservations_per_month: -1,
  storage_gb:             500,
  posts_per_month:        -1,
  images_per_month:       -1,
};

export const PLAN_LIMITS = {
  free: FREE_LIMITS,
  starter: STARTER_LIMITS,
  pro: PRO_LIMITS,
  business: BUSINESS_LIMITS,
  enterprise: ENTERPRISE_LIMITS,
  // Legacy alias
  basic: STARTER_LIMITS,
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

export function getFeaturesForPlan(plan) {
  return PLAN_FEATURES[plan?.toLowerCase()] || PLAN_FEATURES.free;
}

export function isPlanFeature(plan, feature) {
  const features = getFeaturesForPlan(plan);
  return features[feature] === true;
}

export function getPlansForFeature(feature) {
  const plans = [];
  for (const [planName, features] of Object.entries(PLAN_FEATURES)) {
    if (features[feature] === true) {
      plans.push(planName);
    }
  }
  return plans;
}

export function getMinPlanForFeature(feature) {
  if (FREE_FEATURES[feature] === true) return 'free';
  if (STARTER_FEATURES[feature] === true) return 'starter';
  if (PRO_FEATURES[feature] === true) return 'pro';
  if (BUSINESS_FEATURES[feature] === true) return 'business';
  if (ENTERPRISE_FEATURES[feature] === true) return 'enterprise';
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
