/**
 * ═══════════════════════════════════════════════════════════
 * PROTECT PRODUCTION MIDDLEWARE
 * Protection des données en production
 * ═══════════════════════════════════════════════════════════
 */

import { isProduction, isTestTenant, canModifyTenant, isDevelopment } from '../utils/environment.js';

/**
 * Empêcher modifications tenant test en production
 */
export function protectProductionData(req, res, next) {
  // 🔒 TENANT SHIELD: tenant_id UNIQUEMENT depuis l'authentification
  // NEVER from req.body or req.params - that would allow spoofing
  const tenantId = req.admin?.tenant_id;

  if (!canModifyTenant(tenantId)) {
    return res.status(403).json({
      error: 'Action interdite',
      message: 'Les tenants de test ne peuvent pas être modifiés en production',
      code: 'TEST_TENANT_PROTECTED'
    });
  }

  next();
}

/**
 * Middleware pour routes destructives
 */
export function protectDestructiveActions(req, res, next) {
  const tenantId = req.admin?.tenant_id;

  // Bloquer tenant test en prod
  if (isProduction() && isTestTenant(tenantId)) {
    return res.status(403).json({
      error: 'Action interdite',
      message: 'Actions destructives non autorisées sur tenant test en production',
      code: 'DESTRUCTIVE_ACTION_BLOCKED'
    });
  }

  // Demander confirmation pour actions destructives en prod
  if (isProduction() && !req.body?.confirm) {
    return res.status(400).json({
      error: 'Confirmation requise',
      message: 'Veuillez confirmer cette action en ajoutant { "confirm": true } au body',
      code: 'CONFIRMATION_REQUIRED'
    });
  }

  next();
}

/**
 * Logger requêtes en dev seulement
 */
export function devLogger(req, res, next) {
  if (!isProduction()) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
  }
  next();
}

/**
 * Bloquer accès admin en maintenance
 */
export function maintenanceMode(req, res, next) {
  if (process.env.MAINTENANCE_MODE === 'true') {
    // Autoriser super admin
    if (req.admin?.role === 'super_admin') {
      return next();
    }

    return res.status(503).json({
      error: 'Maintenance en cours',
      message: 'Le système est temporairement indisponible. Veuillez réessayer plus tard.',
      code: 'MAINTENANCE_MODE'
    });
  }

  next();
}

/**
 * Rate limiting basique pour actions sensibles
 */
const actionCounts = new Map();

export function rateLimit(maxActions = 10, windowMs = 60000) {
  return (req, res, next) => {
    const key = `${req.ip}-${req.path}`;
    const now = Date.now();

    let entry = actionCounts.get(key);

    if (!entry || now - entry.start > windowMs) {
      entry = { count: 0, start: now };
    }

    entry.count++;
    actionCounts.set(key, entry);

    if (entry.count > maxActions) {
      return res.status(429).json({
        error: 'Trop de requêtes',
        message: `Maximum ${maxActions} actions par minute`,
        code: 'RATE_LIMITED',
        retryAfter: Math.ceil((entry.start + windowMs - now) / 1000)
      });
    }

    next();
  };
}

/**
 * Vérifier que le tenant existe et est actif
 */
export async function requireActiveTenant(req, res, next) {
  const tenantId = req.admin?.tenant_id;

  if (!tenantId) {
    return res.status(401).json({
      error: 'Tenant non identifié',
      code: 'TENANT_REQUIRED'
    });
  }

  // En dev, on passe toujours
  if (isDevelopment()) {
    return next();
  }

  // En prod, vérifier statut tenant (à implémenter avec cache)
  next();
}
