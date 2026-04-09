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
import logger from '../config/logger.js';
import { PLAN_FEATURES, ROUTE_MODULES, getPlansForFeature } from '../config/planFeatures.js';

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
  'marketing': 'plan',
  'commercial': 'plan',
  'pipeline': 'plan',
  'stock': 'plan',
  'devis': 'plan',
  'analytics': 'plan',
  'seo': 'plan',
  'rh': 'plan',
  'api': 'plan',
  'sentinel': 'plan',
  'whitelabel': 'plan',

  // Fonctionnalités toujours disponibles avec un plan
  'reservations': 'always',
  'ecommerce': 'always',
  'paiements': 'always',
  'facturation': 'always',
  'clients': 'always',
  'documents': 'always',
  'dashboard': 'always',
};

// PLAN_FEATURES importé depuis config/planFeatures.js (source unique de vérité)

/**
 * Extrait les clés canal depuis PLAN_FEATURES pour un plan donné
 * Fallback quand options_canaux_actifs n'est pas encore écrit en DB
 */
function extractCanauxFromPlan(planId) {
  const features = PLAN_FEATURES[planId] || PLAN_FEATURES.free;
  const canaux = {};
  for (const [key, type] of Object.entries(MODULE_TYPES)) {
    if (type === 'canal' && features[key]) canaux[key] = true;
  }
  return canaux;
}

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
      plan,
      statut,
      options_canaux_actifs,
      module_metier_id,
      module_metier_paye,
      modules_actifs
    `)
    .eq('id', tenantId)
    .single();

  if (error || !tenant) {
    logger.error('Erreur récupération tenant', { tag: 'MODULE', tenantId, error: error?.message });
    return null;
  }

  // ═══ Modèle 2026 : Free / Basic / Business ═══
  // En essai, on déverrouille comme Basic (le tenant teste pleinement avant de payer)
  const rawPlan = (tenant.plan || 'free').toLowerCase();
  const normalizedPlan = rawPlan === 'starter' ? 'free' : rawPlan === 'pro' ? 'basic' : rawPlan;
  const planId = tenant.statut === 'essai' ? 'basic' : normalizedPlan;
  const planFeatures = PLAN_FEATURES[planId] || PLAN_FEATURES.free;

  const config = {
    plan_id: planId,
    plan: planFeatures,
    // Pendant l'essai: canaux Basic (toutes fonctions IA débloquées, soumises aux crédits)
    options_canaux: tenant.statut === 'essai'
      ? extractCanauxFromPlan('basic')
      : (tenant.options_canaux_actifs || extractCanauxFromPlan(planId)),
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
      logger.warn('Type inconnu pour module', { tag: 'MODULE', moduleId });
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
        logger.info('Accès refusé', { tag: 'MODULE', tenantId, moduleId });
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
      logger.error('Erreur middleware', { tag: 'MODULE', error: err.message });
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

  // Ajouter fonctionnalités du plan (noms canoniques depuis PLAN_FEATURES)
  if (config.plan) {
    for (const [feat, enabled] of Object.entries(config.plan)) {
      if (enabled === true && !activeModules.includes(feat)) {
        activeModules.push(feat);
      }
    }
  }

  return activeModules;
}

// ROUTE_MODULES importé depuis config/planFeatures.js (source unique de vérité)

export default { requireModule, hasModule, getActiveModules, invalidateModuleCache, ROUTE_MODULES, PLAN_FEATURES };
