import { identifyTenant, getTenantConfig, isFrozen, hasFeature } from '../config/tenants/index.js';

/**
 * 🔒 SÉCURITÉ: Résout le tenantId de manière sécurisée
 * Priorise les sources authentifiées (JWT) sur les sources non fiables (header/query)
 */
function getSecureTenantId(req) {
  // Sources authentifiées (FIABLES)
  if (req.admin?.tenant_id) return req.admin.tenant_id;
  if (req.user?.tenant_id) return req.user.tenant_id;

  // Source résolue par middleware domaine (OK pour routes publiques)
  if (req.tenantId) return req.tenantId;

  // Fallback: résolution publique (⚠️ NE PAS utiliser pour opérations sensibles)
  return identifyTenant(req);
}

/**
 * Middleware : Identifier le tenant et attacher sa config à la requête.
 * ⚠️ À utiliser sur routes PUBLIQUES uniquement
 */
export function attachTenant(req, res, next) {
  const tenantId = getSecureTenantId(req);
  const config = getTenantConfig(tenantId);

  req.tenantId = tenantId;
  req.tenantConfig = config;

  next();
}

/**
 * Middleware : Vérifier qu'une feature est activée pour le tenant.
 */
export function requireFeature(featureName) {
  return (req, res, next) => {
    const tenantId = getSecureTenantId(req);

    if (!hasFeature(tenantId, featureName)) {
      console.log(`[TENANT ${tenantId}] Feature '${featureName}' non activée`);
      return res.status(403).json({
        success: false,
        error: `Feature '${featureName}' non disponible pour votre compte`,
        code: 'FEATURE_DISABLED',
      });
    }

    next();
  };
}

/**
 * Middleware : Bloquer les modifications sur tenants frozen en production.
 */
export function protectFrozen(req, res, next) {
  const tenantId = getSecureTenantId(req);

  if (isFrozen(tenantId)) {
    const isDev = process.env.NODE_ENV === 'development';

    if (!isDev) {
      console.warn(`[TENANT ${tenantId}] Tentative modification sur tenant FROZEN`);
      return res.status(403).json({
        success: false,
        error: 'Modifications directes interdites sur compte production',
        code: 'TENANT_FROZEN',
      });
    }

    console.log(`[DEV MODE] Autorisation modification tenant frozen ${tenantId}`);
  }

  next();
}

/**
 * Middleware : Logger les requêtes avec info tenant.
 */
export function logTenant(req, res, next) {
  const tenantId = getSecureTenantId(req);
  const config = getTenantConfig(tenantId);

  req.tenantId = tenantId;
  req.tenantConfig = config;

  console.log(`[TENANT ${tenantId}] ${config.name} - ${req.method} ${req.path}`);

  next();
}
