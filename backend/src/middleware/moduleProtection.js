/**
 * Middleware pour vérifier qu'un tenant a accès à un module/option
 * Mission Jour 6 - Système Modules Activables
 *
 * Structure: plans + options_disponibles
 * - Options canaux IA: options_canaux_actifs JSONB
 * - Module métier: module_metier_id VARCHAR
 * - Fonctionnalités plan: colonnes booléennes dans plans
 */

import { supabase } from '../config/supabase.js';

// Cache des configs tenant (TTL: 30 secondes pour sécurité)
// 🔒 SÉCURITÉ: TTL court pour éviter les fenêtres d'exploitation
// après changement de plan
const moduleCache = new Map();
const CACHE_TTL = 30 * 1000; // 30 secondes (était 5 minutes)

/**
 * Mapping module ID → type de vérification
 */
const MODULE_TYPES = {
  // Canaux IA (vérifier options_canaux_actifs)
  'agent_ia_web': 'canal',
  'agent_ia_whatsapp': 'canal',
  'agent_ia_telephone': 'canal',
  'site_web': 'canal',

  // Modules métier (vérifier module_metier_id)
  'module_metier_salon': 'metier',
  'module_metier_restaurant': 'metier',
  'module_metier_medical': 'metier',
  'module_metier_formation': 'metier',
  'module_metier_ecommerce': 'metier',

  // Fonctionnalités incluses dans le plan (vérifier plan.colonne)
  'comptabilite': 'plan',
  'crm_avance': 'plan',
  'marketing_automation': 'plan',
  'commercial': 'plan',
  'stock_inventaire': 'plan',
  'analytics_avances': 'plan',
  'seo_visibilite': 'plan',
  'rh_multiemployes': 'plan',
  'api_integrations': 'plan',
  'white_label': 'plan',

  // Fonctionnalités toujours disponibles avec un plan
  'reservations': 'always',
  'ecommerce': 'always',
  'paiements': 'always',
};

/**
 * Plan features mapping (pas de table plans, on utilise le plan_id directement)
 *
 * Grille tarifaire 2026:
 * - STARTER (99€/mois): 1 user, 1000 clients, 200 SMS
 * - PRO (249€/mois): 5 users, 5000 clients, 500 SMS, 60min voix IA
 * - BUSINESS (499€/mois): 20 users, illimité, 2000 SMS, 300min voix IA
 */
const PLAN_FEATURES = {
  starter: {
    // Fonctionnalités de base
    dashboard: true,
    clients: true,
    reservations: true,
    facturation: true,
    site_vitrine: true,
    agent_ia_web: true,
    documents: true,
    paiements: true,
    ecommerce: true,
  },
  pro: {
    // Tout Starter
    dashboard: true,
    clients: true,
    reservations: true,
    facturation: true,
    site_vitrine: true,
    agent_ia_web: true,
    documents: true,
    paiements: true,
    ecommerce: true,
    // + Fonctionnalités Pro
    whatsapp: true,
    telephone: true,
    comptabilite: true,
    crm_avance: true,
    marketing: true,
    marketing_automation: true,
    pipeline: true,
    commercial: true,
    stock: true,
    stock_inventaire: true,
    analytics: true,
    analytics_avances: true,
    devis: true,
  },
  business: {
    // Tout Starter
    dashboard: true,
    clients: true,
    reservations: true,
    facturation: true,
    site_vitrine: true,
    agent_ia_web: true,
    documents: true,
    paiements: true,
    ecommerce: true,
    // Tout Pro
    whatsapp: true,
    telephone: true,
    comptabilite: true,
    crm_avance: true,
    marketing: true,
    marketing_automation: true,
    pipeline: true,
    commercial: true,
    stock: true,
    stock_inventaire: true,
    analytics: true,
    analytics_avances: true,
    devis: true,
    // + Fonctionnalités Business exclusives
    rh: true,
    rh_multiemployes: true,
    seo: true,
    seo_visibilite: true,
    api: true,
    api_integrations: true,
    sentinel: true,
    whitelabel: true,
    white_label: true,
  }
};

/**
 * Récupère la config complète d'un tenant (avec cache)
 */
async function getTenantConfig(tenantId) {
  const cacheKey = `config:${tenantId}`;
  const cached = moduleCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.config;
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select(`
      plan_id,
      options_canaux_actifs,
      module_metier_id,
      module_metier_paye,
      modules_actifs
    `)
    .eq('id', tenantId)
    .single();

  if (error || !tenant) {
    console.error(`[MODULE] Erreur récupération tenant ${tenantId}:`, error?.message);
    return null;
  }

  // Utiliser le mapping PLAN_FEATURES au lieu d'une table plans
  const planId = tenant.plan_id || 'starter';
  const planFeatures = PLAN_FEATURES[planId] || PLAN_FEATURES.starter;

  const config = {
    plan_id: planId,
    plan: planFeatures,
    options_canaux: tenant.options_canaux_actifs || tenant.modules_actifs || {},
    module_metier_id: tenant.module_metier_id,
    module_metier_paye: tenant.module_metier_paye
  };

  moduleCache.set(cacheKey, { config, timestamp: Date.now() });
  return config;
}

/**
 * Invalide le cache pour un tenant
 */
export function invalidateModuleCache(tenantId) {
  moduleCache.delete(`config:${tenantId}`);
}

/**
 * Vérifie si un tenant a accès à un module/option
 */
function checkModuleAccess(config, moduleId) {
  if (!config || !config.plan_id) {
    return false; // Pas de plan = pas d'accès
  }

  const moduleType = MODULE_TYPES[moduleId];

  switch (moduleType) {
    case 'canal':
      // Vérifier options_canaux_actifs
      return config.options_canaux[moduleId] === true;

    case 'metier':
      // Vérifier module_metier_id
      return config.module_metier_id === moduleId;

    case 'plan':
      // Vérifier colonne booléenne dans le plan
      return config.plan?.[moduleId] === true;

    case 'always':
      // Toujours disponible si le tenant a un plan
      return !!config.plan_id;

    default:
      // Module inconnu, refuser par défaut
      console.warn(`[MODULE] Type inconnu pour module: ${moduleId}`);
      return false;
  }
}

/**
 * Middleware factory pour vérifier accès à un module
 * @param {string} moduleId - ID du module requis
 * @returns {Function} Express middleware
 */
export function requireModule(moduleId) {
  return async (req, res, next) => {
    try {
      // Récupérer tenant_id selon le type de route
      const tenantId = req.admin?.tenant_id || req.client?.tenant_id || req.user?.tenant_id || req.tenantId;

      if (!tenantId) {
        return res.status(401).json({
          error: 'Authentification requise',
          code: 'NO_TENANT_ID'
        });
      }

      // Récupérer config tenant
      const config = await getTenantConfig(tenantId);

      if (config === null) {
        return res.status(404).json({
          error: 'Tenant non trouvé',
          code: 'TENANT_NOT_FOUND'
        });
      }

      // Vérifier si module/option actif
      if (!checkModuleAccess(config, moduleId)) {
        console.log(`[MODULE] Accès refusé: tenant=${tenantId}, module=${moduleId}`);
        return res.status(403).json({
          error: `Module '${moduleId}' non activé pour ce compte`,
          code: 'MODULE_NOT_ACTIVATED',
          module: moduleId,
          upgrade_url: '/admin/modules'
        });
      }

      // Module actif, continuer
      next();
    } catch (err) {
      console.error('[MODULE] Erreur middleware:', err);
      return res.status(500).json({
        error: 'Erreur serveur',
        code: 'MIDDLEWARE_ERROR'
      });
    }
  };
}

/**
 * Vérifie si un tenant a accès à un module (async)
 * Utilisable dans le code métier
 */
export async function hasModule(tenantId, moduleId) {
  if (!tenantId) return false;

  const config = await getTenantConfig(tenantId);
  return checkModuleAccess(config, moduleId);
}

/**
 * Récupère la liste des modules/options actifs d'un tenant
 */
export async function getActiveModules(tenantId) {
  if (!tenantId) return [];

  const config = await getTenantConfig(tenantId);
  if (!config) return [];

  const activeModules = [];

  // Ajouter canaux actifs
  Object.keys(config.options_canaux || {}).forEach(id => {
    if (config.options_canaux[id] === true) {
      activeModules.push(id);
    }
  });

  // Ajouter module métier si présent
  if (config.module_metier_id) {
    activeModules.push(config.module_metier_id);
  }

  // Ajouter fonctionnalités du plan
  if (config.plan) {
    const planFeatures = ['comptabilite', 'crm_avance', 'marketing_automation', 'commercial',
      'stock_inventaire', 'analytics_avances', 'seo_visibilite', 'rh_multiemployes',
      'api_integrations', 'white_label'];

    planFeatures.forEach(feat => {
      if (config.plan[feat] === true) {
        activeModules.push(feat);
      }
    });

    // Fonctionnalités toujours actives avec un plan
    activeModules.push('reservations', 'ecommerce', 'paiements');
  }

  return activeModules;
}

/**
 * Mapping routes → modules requis
 * Utilisé pour auto-application du middleware
 */
export const ROUTE_MODULES = {
  // Réservations (toujours disponible avec un plan)
  '/api/rendez-vous': 'reservations',
  '/api/admin/reservations': 'reservations',
  '/api/admin/disponibilites': 'reservations',

  // Canaux clients (options payantes)
  '/api/whatsapp': 'agent_ia_whatsapp',
  '/api/twilio/whatsapp': 'agent_ia_whatsapp',
  '/api/voice': 'agent_ia_telephone',
  '/api/twilio/voice': 'agent_ia_telephone',
  '/api/chat': 'agent_ia_web',
  '/api/admin/agents': 'agent_ia_web',

  // Business (toujours disponible avec un plan)
  '/api/payment': 'paiements',
  '/api/orders': 'ecommerce',
  '/api/admin/orders': 'ecommerce',

  // Fonctionnalités plan
  '/api/admin/marketing': 'marketing_automation',
  '/api/admin/seo': 'seo_visibilite',
  '/api/admin/comptabilite': 'comptabilite',
  '/api/admin/rh': 'rh_multiemployes',
  '/api/admin/crm': 'crm_avance',
  '/api/admin/analytics': 'analytics_avances'
};

// Export PLAN_FEATURES pour tests et vérification cohérence
export { PLAN_FEATURES };

export default { requireModule, hasModule, getActiveModules, invalidateModuleCache, ROUTE_MODULES, PLAN_FEATURES };
