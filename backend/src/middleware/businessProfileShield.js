/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BUSINESS PROFILE SHIELD
 * Protection et isolation des logiques métiers
 * Similaire au Tenant Shield mais pour les profils métiers
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { loadProfile, validateProfileData } from '../profiles/index.js';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

/**
 * Middleware principal - Charge et injecte le profil métier
 * Doit être utilisé APRÈS authenticateAdmin et tenantShield
 */
export async function businessProfileShield(req, res, next) {
  // Le tenant doit déjà être vérifié
  const tenantId = req.admin?.tenant_id;

  if (!tenantId) {
    logger.error('Pas de tenant_id - tenantShield manquant?', { tag: 'PROFILE SHIELD' });
    return res.status(403).json({
      error: 'TENANT_REQUIRED',
      message: 'Authentification tenant requise avant le profile shield',
    });
  }

  try {
    // Charger le profil du tenant
    const profile = await loadProfile(tenantId);

    if (!profile) {
      logger.error('Profil non trouvé', { tag: 'PROFILE SHIELD', tenantId });

      // Log d'audit
      await logProfileAudit(tenantId, 'profile_load_failed', null, {
        error: 'Profile not found',
        path: req.path,
      });

      return res.status(403).json({
        error: 'PROFILE_NOT_CONFIGURED',
        message: 'Profil métier non configuré pour ce compte',
      });
    }

    // Injecter le profil dans la requête
    req.profile = profile;

    // Log d'audit (uniquement pour certaines routes sensibles)
    if (shouldAudit(req)) {
      await logProfileAudit(tenantId, 'profile_loaded', profile.id, {
        path: req.path,
        method: req.method,
      });
    }

    next();
  } catch (error) {
    logger.error('Erreur', { tag: 'PROFILE SHIELD', error: error.message });
    res.status(500).json({
      error: 'PROFILE_LOAD_ERROR',
      message: 'Erreur lors du chargement du profil métier',
    });
  }
}

/**
 * Middleware de validation des données selon le profil
 * À utiliser sur les routes POST/PUT/PATCH
 */
export function validateProfileRequest(context) {
  return async (req, res, next) => {
    if (!req.profile) {
      return res.status(500).json({
        error: 'PROFILE_NOT_LOADED',
        message: 'Le middleware businessProfileShield doit être appliqué avant',
      });
    }

    // Valider les données selon le contexte
    const validation = validateProfileData(req.profile, req.body, context);

    if (!validation.valid) {
      logger.error('Validation échouée', { tag: 'PROFILE SHIELD', tenantId: req.admin.tenant_id, errors: validation.errors });

      // Log d'audit
      await logProfileAudit(req.admin.tenant_id, 'validation_failed', req.profile.id, {
        context,
        errors: validation.errors,
        data: sanitizeDataForLog(req.body),
      });

      return res.status(400).json({
        error: 'PROFILE_VALIDATION_FAILED',
        message: 'Les données ne correspondent pas au profil métier',
        profile: req.profile.label,
        errors: validation.errors,
      });
    }

    next();
  };
}

/**
 * Middleware pour restreindre l'accès à certains profils
 * @param {...string} allowedProfiles - Liste des profils autorisés
 */
export function requireProfile(...allowedProfiles) {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(500).json({
        error: 'PROFILE_NOT_LOADED',
        message: 'Le middleware businessProfileShield doit être appliqué avant',
      });
    }

    if (!allowedProfiles.includes(req.profile.id)) {
      logger.warn('Accès refusé', { tag: 'PROFILE SHIELD', profileId: req.profile.id, allowedProfiles });

      return res.status(403).json({
        error: 'PROFILE_NOT_ALLOWED',
        message: `Cette fonctionnalité n'est pas disponible pour le profil "${req.profile.label}"`,
        currentProfile: req.profile.id,
        requiredProfiles: allowedProfiles,
      });
    }

    next();
  };
}

/**
 * Middleware pour exclure certains profils
 * @param {...string} excludedProfiles - Liste des profils exclus
 */
export function excludeProfile(...excludedProfiles) {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(500).json({
        error: 'PROFILE_NOT_LOADED',
        message: 'Le middleware businessProfileShield doit être appliqué avant',
      });
    }

    if (excludedProfiles.includes(req.profile.id)) {
      return res.status(403).json({
        error: 'PROFILE_EXCLUDED',
        message: `Cette fonctionnalité n'est pas compatible avec le profil "${req.profile.label}"`,
      });
    }

    next();
  };
}

/**
 * Middleware pour vérifier une règle métier spécifique
 * @param {string} ruleName - Nom de la règle
 * @param {any} expectedValue - Valeur attendue (optionnel, true par défaut)
 */
export function requireRule(ruleName, expectedValue = true) {
  return (req, res, next) => {
    if (!req.profile) {
      return res.status(500).json({ error: 'PROFILE_NOT_LOADED' });
    }

    const ruleValue = req.profile.getRule(ruleName);

    if (ruleValue !== expectedValue) {
      return res.status(403).json({
        error: 'RULE_NOT_SATISFIED',
        message: `La règle "${ruleName}" n'est pas satisfaite pour ce profil`,
        rule: ruleName,
        expected: expectedValue,
        actual: ruleValue,
      });
    }

    next();
  };
}

/**
 * Helper: Obtenir le mode de tarification effectif
 * (peut être override par le service ou la requête)
 */
export function getEffectivePricingMode(req, service = null) {
  // Priorité: requête > service > profil
  if (req.body?.pricing_mode) {
    // Vérifier que le mode est autorisé
    if (req.profile.pricing.allowedModes.includes(req.body.pricing_mode)) {
      return req.body.pricing_mode;
    }
  }

  if (service?.pricing_mode) {
    return service.pricing_mode;
  }

  return req.profile.pricing.mode;
}

/**
 * Helper: Calculer le prix selon le profil
 */
export function calculatePrice(req, service, params) {
  const pricingMode = getEffectivePricingMode(req, service);
  const profile = req.profile;

  // Utiliser la fonction de calcul du profil
  return profile.pricing.calculate(service, {
    ...params,
    pricingMode,
  });
}

/**
 * Helper: Obtenir la terminologie
 */
export function getTerm(req, key, plural = false) {
  if (!req.profile) return key;
  return req.profile.getLabel(key, plural);
}

/**
 * Log d'audit
 */
async function logProfileAudit(tenantId, action, profileId, details = {}) {
  try {
    await supabase.from('business_profile_audit').insert({
      tenant_id: tenantId,
      action,
      profile_id: profileId,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    // Ne pas bloquer si l'audit échoue
    logger.error('Erreur audit', { tag: 'PROFILE SHIELD', error: err.message });
  }
}

/**
 * Déterminer si cette requête doit être auditée
 */
function shouldAudit(req) {
  // Auditer les modifications et les routes sensibles
  const auditMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  const auditPaths = ['/reservations', '/services', '/clients'];

  if (auditMethods.includes(req.method)) {
    return true;
  }

  return auditPaths.some((path) => req.path.includes(path));
}

/**
 * Sanitize data pour les logs (retirer les données sensibles)
 */
function sanitizeDataForLog(data) {
  const sanitized = { ...data };
  const sensitiveFields = ['password', 'token', 'secret', 'card', 'iban'];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }

  return sanitized;
}

export default {
  businessProfileShield,
  validateProfileRequest,
  requireProfile,
  excludeProfile,
  requireRule,
  getEffectivePricingMode,
  calculatePrice,
  getTerm,
};
