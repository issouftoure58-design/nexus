/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    🛡️ TENANT SHIELD MIDDLEWARE 🛡️                         ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  Middleware de protection runtime qui garantit l'isolation multi-tenant  ║
 * ║  à chaque requête API.                                                   ║
 * ║                                                                           ║
 * ║  FONCTIONNALITÉS:                                                         ║
 * ║  1. Valide la présence de tenant_id sur chaque requête                   ║
 * ║  2. Log les tentatives d'accès cross-tenant                              ║
 * ║  3. Bloque les requêtes sans tenant_id (sauf routes système)             ║
 * ║  4. Ajoute des headers de sécurité                                       ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import logger from '../config/logger.js';

/**
 * Routes système qui n'ont pas besoin de tenant_id
 * Ces routes gèrent la plateforme NEXUS, pas les données tenant
 *
 * ⚠️ IMPORTANT: Ces routes sont exclues du Tenant Shield
 * - Webhooks externes (Twilio, Stripe) - tenant résolu par numéro/session
 * - Auth routes - pas encore de tenant
 * - Routes publiques - tenant résolu par domaine/header
 */
const SYSTEM_ROUTES = [
  // Health & System
  '/health',

  // Auth & Signup (pas encore de tenant)
  '/api/admin/auth',
  '/api/signup',
  '/api/trial/limits',  // Info publique sur les limites trial

  // Webhooks externes (tenant résolu autrement)
  '/api/webhooks',
  '/api/whatsapp/webhook',
  '/api/whatsapp/status',
  '/api/whatsapp/health',
  '/api/twilio',
  '/api/voice',
  '/api/billing/webhook',

  // Routes publiques (tenant résolu par domaine/header via resolveTenantByDomain)
  '/api/landing',       // Agent commercial landing page
  '/api/public',        // Services, chat, RDV publics
  '/api/services',      // Liste services (public)
  '/api/disponibilites',// Créneaux disponibles (public)
  '/api/reviews',       // Avis clients (public GET)
  '/api/orders',        // Checkout panier (public)

  // Provisioning (superadmin seulement, auth séparée)
  '/api/provisioning',
];

/**
 * Vérifie si une route est une route système
 */
function isSystemRoute(path) {
  return SYSTEM_ROUTES.some(route => path.startsWith(route));
}

/**
 * Erreur spécifique pour les violations tenant
 */
export class TenantShieldError extends Error {
  constructor(message, code = 'TENANT_SHIELD_VIOLATION') {
    super(message);
    this.name = 'TenantShieldError';
    this.code = code;
    this.statusCode = 403;
  }
}

/**
 * Middleware principal TENANT SHIELD
 *
 * Doit être utilisé APRÈS le middleware de résolution tenant
 * et AVANT les routes API.
 */
export function tenantShield(options = {}) {
  const {
    strict = true,           // Mode strict: bloque les requêtes sans tenant
    logViolations = true,    // Log les violations
    allowSystemRoutes = true // Permet les routes système sans tenant
  } = options;

  return (req, res, next) => {
    // Ajouter header de sécurité
    res.setHeader('X-Tenant-Shield', 'active');

    // Routes système autorisées sans tenant
    if (allowSystemRoutes && isSystemRoute(req.path)) {
      return next();
    }

    // 🔒 SÉCURITÉ: UNIQUEMENT depuis sources authentifiées
    // JAMAIS de fallback à header ou query param (spoofing)
    const tenantId = req.tenantId || req.admin?.tenant_id || req.user?.tenant_id;

    if (!tenantId) {
      if (logViolations) {
        logger.error('VIOLATION: Requête sans tenant_id', {
          tag: 'TENANT SHIELD',
          method: req.method,
          path: req.path,
          ip: req.ip,
          headers: req.headers
        });
      }

      if (strict) {
        return res.status(403).json({
          success: false,
          error: 'TENANT_REQUIRED',
          message: 'Cette requête nécessite un tenant_id valide',
          shield: 'TENANT_SHIELD_ACTIVE',
        });
      }
    }

    // Attacher tenantId à req pour usage ultérieur
    req.tenantId = tenantId;

    // Ajouter helper pour validation dans les services
    req.validateTenant = (dataOrTenantId) => {
      const checkId = typeof dataOrTenantId === 'object'
        ? dataOrTenantId.tenant_id
        : dataOrTenantId;

      if (checkId && checkId !== tenantId) {
        const error = new TenantShieldError(
          `Accès cross-tenant bloqué: tentative d'accès à ${checkId} depuis ${tenantId}`
        );

        if (logViolations) {
          logger.error('CROSS-TENANT ATTEMPT BLOCKED', {
            tag: 'TENANT SHIELD',
            currentTenant: tenantId,
            attemptedTenant: checkId,
            method: req.method,
            path: req.path
          });
        }

        throw error;
      }

      return true;
    };

    // Log de debug (désactivé en prod)
    if (process.env.NODE_ENV !== 'production' && process.env.TENANT_SHIELD_DEBUG) {
      logger.info('Request validated', { tag: 'TENANT SHIELD', method: req.method, path: req.path, tenantId });
    }

    next();
  };
}

/**
 * Middleware pour valider le tenant dans le body des requêtes POST/PUT
 * Empêche l'injection de tenant_id différent dans le body
 */
export function validateBodyTenant() {
  return (req, res, next) => {
    // Ne pas modifier le body des webhooks externes (casse la validation de signature Twilio)
    if (isSystemRoute(req.path) || isSystemRoute(`/api${req.path}`)) {
      return next();
    }

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      // Si le body contient un tenant_id, il DOIT matcher req.tenantId
      if (req.body.tenant_id && req.body.tenant_id !== req.tenantId) {
        logger.error('BODY TENANT MISMATCH', {
          tag: 'TENANT SHIELD',
          reqTenantId: req.tenantId,
          bodyTenantId: req.body.tenant_id
        });

        return res.status(403).json({
          success: false,
          error: 'TENANT_MISMATCH',
          message: 'Le tenant_id du body ne correspond pas à votre session',
          shield: 'TENANT_SHIELD_ACTIVE',
        });
      }

      // Forcer le tenant_id correct dans le body
      if (req.tenantId) {
        req.body.tenant_id = req.tenantId;
      }
    }

    next();
  };
}

/**
 * Helper pour les services: valide et injecte tenant_id
 *
 * Usage:
 *   import { withTenant } from '../middleware/tenantShield.js';
 *
 *   async function createReservation(data, tenantId) {
 *     const safeData = withTenant(data, tenantId);
 *     // safeData.tenant_id est garanti d'être correct
 *   }
 */
export function withTenant(data, tenantId) {
  if (!tenantId) {
    throw new TenantShieldError('tenant_id requis', 'TENANT_MISSING');
  }

  if (data.tenant_id && data.tenant_id !== tenantId) {
    throw new TenantShieldError(
      `Conflit tenant: données pour ${data.tenant_id}, session ${tenantId}`,
      'TENANT_CONFLICT'
    );
  }

  return {
    ...data,
    tenant_id: tenantId,
  };
}

/**
 * Helper pour les requêtes Supabase: ajoute automatiquement le filtre tenant
 *
 * Usage:
 *   import { tenantQuery } from '../middleware/tenantShield.js';
 *
 *   const query = tenantQuery(supabase.from('reservations'), tenantId);
 *   // Équivalent à: supabase.from('reservations').eq('tenant_id', tenantId)
 */
export function tenantQuery(query, tenantId) {
  if (!tenantId) {
    throw new TenantShieldError('tenant_id requis pour cette requête', 'TENANT_MISSING');
  }
  return query.eq('tenant_id', tenantId);
}

/**
 * Décorateur pour les fonctions de service
 * Garantit que le premier paramètre est toujours tenantId
 *
 * Usage:
 *   const safeGetClients = requireTenant(getClients);
 *   safeGetClients(null); // Throw TenantShieldError
 *   safeGetClients('fatshairafro'); // OK
 */
export function requireTenant(fn) {
  return function(tenantId, ...args) {
    if (!tenantId) {
      throw new TenantShieldError(
        `${fn.name || 'Function'} requiert tenant_id en premier paramètre`,
        'TENANT_MISSING'
      );
    }
    return fn(tenantId, ...args);
  };
}

export default {
  tenantShield,
  validateBodyTenant,
  withTenant,
  tenantQuery,
  requireTenant,
  TenantShieldError,
};
