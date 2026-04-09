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
 * Modèle 2026 (révisé 9 avril 2026 — voir memory/business-model-2026.md):
 * - FREE (0€/mois)         : Freemium à vie, quotas stricts, IA bloquée
 * - BASIC (29€/mois)       : Accès illimité non-IA + 1 000 crédits IA inclus/mois (valeur 15€)
 * - BUSINESS (149€/mois)   : Tout Basic + multi-sites, white-label, API, SSO, 10 000 crédits IA inclus (valeur 150€)
 *
 * Les fonctions IA (chat IA admin, WhatsApp IA, téléphone IA, marketing IA, SEO IA)
 * consomment des crédits (1,5€ = 100 crédits). Un pack unique additionnel est
 * disponible : Pack 1000 — 15€ pour 1 000 crédits (sans bonus).
 */

// ═══════════════════════════════════════════════════════════════
// FEATURES PAR PLAN — Noms canoniques (pas d'alias)
// ═══════════════════════════════════════════════════════════════

/**
 * FREE — Freemium à vie
 * Tous les modules sont VISIBLES dans le menu (effet WOW Notion/Figma)
 * mais limités par des quotas, et toutes les fonctions IA sont BLOQUÉES.
 */
const FREE_FEATURES = {
  // Core CRUD (avec quotas — voir PLAN_LIMITS)
  dashboard: true,
  clients: true,           // max 30
  reservations: true,      // max 10/mois
  facturation: true,       // max 10/mois + watermark "Propulse par NEXUS"
  documents: true,
  paiements: true,
  ecommerce: true,
  reviews: true,
  waitlist: true,

  // Lecture seule sur les modules avancés
  comptabilite_readonly: true,
  stock_readonly: true,
  rh_readonly: true,

  // ⛔ TOUTES les fonctions IA bloquées (visibles mais non-cliquables)
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
};

/**
 * BASIC — 29€/mois — Le plan principal
 * Acces illimité à TOUTES les fonctions non-IA.
 * Fonctions IA disponibles mais nécessitent des crédits (pay-as-you-go).
 */
const BASIC_FEATURES = {
  // Tout ce qui est dans Free, sans quota
  dashboard: true,
  clients: true,
  reservations: true,
  facturation: true,       // sans watermark
  documents: true,
  paiements: true,
  ecommerce: true,
  reviews: true,
  waitlist: true,

  // Modules avancés débloqués (lecture + écriture)
  equipe: true,
  fidelite: true,
  comptabilite: true,
  stock: true,
  rh: true,
  crm_avance: true,
  devis: true,
  marketing: true,
  pipeline: true,
  commercial: true,
  analytics: true,
  seo: true,
  workflows: true,
  sentinel: true,

  // ✨ IA débloquée (mais consomme des crédits)
  agent_ia_web: true,
  whatsapp: true,
  telephone: true,
};

/**
 * BUSINESS — 149€/mois — Multi-sites & premium
 * Tout Basic + multi-sites illimités, white-label, API, SSO, account manager
 * + 10 000 crédits IA inclus chaque mois (valeur ~150€).
 */
const BUSINESS_FEATURES = {
  ...BASIC_FEATURES,
  // Premium
  multi_site: true,
  whitelabel: true,
  api: true,
  sso: true,
  support_prioritaire: true,
  account_manager: true,
};

export const PLAN_FEATURES = {
  free: FREE_FEATURES,
  basic: BASIC_FEATURES,
  business: BUSINESS_FEATURES,
  // ⚠️ DEPRECATED — Aliases pour retro-compatibilite pendant la migration
  // A SUPPRIMER une fois tous les consommateurs migres vers free/basic/business.
  // Voir memory/business-model-2026.md
  starter: FREE_FEATURES,
  pro: BASIC_FEATURES,
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

  // Canaux IA (Basic+, consomme des crédits)
  '/api/chat': 'agent_ia_web',
  '/api/admin/agents': 'agent_ia_web',
  '/api/whatsapp': 'whatsapp',
  '/api/twilio/whatsapp': 'whatsapp',
  '/api/voice': 'telephone',
  '/api/twilio/voice': 'telephone',

  // Modules Basic+
  '/api/admin/comptabilite': 'comptabilite',
  '/api/admin/compta': 'comptabilite',
  '/api/admin/crm': 'crm_avance',
  '/api/admin/devis': 'devis',
  '/api/admin/stock': 'stock',
  '/api/admin/marketing': 'marketing',
  '/api/admin/pipeline': 'pipeline',
  '/api/admin/analytics': 'analytics',
  '/api/admin/seo': 'seo',
  '/api/admin/rh': 'rh',
  '/api/admin/equipe': 'equipe',
  '/api/admin/fidelite': 'fidelite',
  '/api/admin/workflows': 'workflows',

  // Business uniquement
  '/api/admin/api-keys': 'api',
  '/api/admin/webhooks': 'api',
  '/api/admin/multi-site': 'multi_site',
  '/api/admin/whitelabel': 'whitelabel',
};

// ═══════════════════════════════════════════════════════════════
// QUOTAS PAR PLAN
// ═══════════════════════════════════════════════════════════════

/**
 * Quotas mensuels stricts par plan.
 * -1 = illimité.
 *
 * Les quotas Free appliquent un blocage dur côté backend (middleware enforceQuota).
 * Pour Basic et Business, les quotas non-IA sont illimités ; la consommation IA
 * est gérée par le solde de crédits du tenant (table ai_credits).
 */
// Quotas dimensionnels du nouveau modele 2026
const FREE_LIMITS = {
  clients_max:        30,
  reservations_mois:  10,
  factures_mois:      10,
  prestations_max:    3,
  users_max:          1,
  chat_admin_questions_mois: 5,  // 5 questions decouverte/mois

  // ⚠️ DEPRECATED — alias des champs historiques (pour retro-compat consommateurs)
  clients:                30,
  reservations_per_month: 10,
  storage_gb:             1,
  posts_per_month:        0,   // IA bloquee en Free
  images_per_month:       0,
};

const BASIC_LIMITS = {
  clients_max:        -1,
  reservations_mois:  -1,
  factures_mois:      -1,
  prestations_max:    -1,
  users_max:          -1,
  chat_admin_questions_mois: -1, // illimite (consomme credits)
  credits_ia_inclus_mois: 1000,  // 1 000 crédits IA inclus par mois (valeur 15€)

  // ⚠️ DEPRECATED — alias des champs historiques
  clients:                -1,
  reservations_per_month: -1,
  storage_gb:             50,
  posts_per_month:        -1,  // gere par credits IA
  images_per_month:       -1,
};

const BUSINESS_LIMITS = {
  clients_max:        -1,
  reservations_mois:  -1,
  factures_mois:      -1,
  prestations_max:    -1,
  users_max:          -1,
  chat_admin_questions_mois: -1,
  multi_site_max:     -1,
  credits_ia_inclus_mois: 10000, // 10 000 crédits IA inclus par mois (valeur 150€)

  // ⚠️ DEPRECATED — alias des champs historiques
  clients:                -1,
  reservations_per_month: -1,
  storage_gb:             500,
  posts_per_month:        -1,
  images_per_month:       -1,
};

export const PLAN_LIMITS = {
  free: FREE_LIMITS,
  basic: BASIC_LIMITS,
  business: BUSINESS_LIMITS,
  // ⚠️ DEPRECATED — Aliases retro-compat
  starter: FREE_LIMITS,
  pro: BASIC_LIMITS,
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Retourne les features pour un plan donné (fallback free)
 */
export function getFeaturesForPlan(plan) {
  return PLAN_FEATURES[plan?.toLowerCase()] || PLAN_FEATURES.free;
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
  if (FREE_FEATURES[feature] === true) return 'free';
  if (BASIC_FEATURES[feature] === true) return 'basic';
  if (BUSINESS_FEATURES[feature] === true) return 'business';
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
