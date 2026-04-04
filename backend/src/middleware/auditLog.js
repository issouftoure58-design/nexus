/**
 * Middleware Audit Log générique — NEXUS
 * Log automatiquement les actions mutatives (POST/PUT/PATCH/DELETE) dans historique_admin.
 * S'applique aux routes admin après authenticateAdmin.
 */

import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

// Routes à exclure du logging automatique (haute fréquence / non pertinentes)
const EXCLUDED_PATHS = [
  '/admin/auth/login',
  '/admin/auth/logout',
  '/admin/auth/2fa/validate',
  '/admin/chat',
  '/admin/stats',
];

// Méthodes HTTP à logger
const LOGGED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Déduit l'action et l'entité à partir du path et de la méthode HTTP
 */
function parseRoute(method, path) {
  const methodMap = {
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  };

  const action = methodMap[method] || method.toLowerCase();

  // Extraire l'entité depuis le path: /api/admin/clients/123 → clients
  const segments = path.replace(/^\/api\//, '').split('/').filter(Boolean);

  // Chercher le premier segment significatif après "admin"
  let entite = segments[0] || 'unknown';
  if (entite === 'admin' && segments.length > 1) {
    entite = segments[1];
  }

  // Extraire un ID potentiel (UUID ou nombre)
  let entiteId = null;
  for (const seg of segments) {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) || /^\d+$/.test(seg)) {
      entiteId = seg;
      break;
    }
  }

  return { action, entite, entiteId };
}

/**
 * Middleware factory — appliqué globalement sur les routes admin
 */
export function auditLogMiddleware() {
  return (req, res, next) => {
    // Ne logger que les mutations
    if (!LOGGED_METHODS.has(req.method)) {
      return next();
    }

    // Exclure certains paths
    const fullPath = req.originalUrl || req.url;
    if (EXCLUDED_PATHS.some(p => fullPath.includes(p))) {
      return next();
    }

    // On a besoin de req.admin (set par authenticateAdmin)
    // Le log se fait APRÈS la réponse pour ne pas ralentir la requête
    const originalEnd = res.end;
    const startTime = Date.now();

    res.end = function (...args) {
      // Restaurer res.end original
      res.end = originalEnd;
      res.end(...args);

      const ip = req.ip || req.connection?.remoteAddress;
      const userAgent = req.get('user-agent')?.substring(0, 200);

      // Logger les echecs d'authentification (401/403) si un tenant est identifie
      if (res.statusCode === 401 || res.statusCode === 403) {
        const failTenantId = req.admin?.tenant_id || req.tenantId;
        if (failTenantId) {
          const failEntry = {
            tenant_id: failTenantId,
            admin_id: req.admin?.id || null,
            action: res.statusCode === 401 ? 'auth_failure' : 'access_denied',
            entite: 'security',
            details: {
              method: req.method,
              path: fullPath.split('?')[0],
              status: res.statusCode,
              ip,
              user_agent: userAgent,
              duration_ms: Date.now() - startTime,
            },
          };

          supabase
            .from('historique_admin')
            .insert(failEntry)
            .then(({ error }) => {
              if (error) logger.warn('[AUDIT] Erreur insert fail log:', error.message);
            });
        } else {
          logger.warn('[AUDIT] Auth failure sans tenant', { status: res.statusCode, path: fullPath.split('?')[0], ip });
        }
        return;
      }

      // Logger seulement si un admin est authentifié et la réponse est un succès (2xx)
      if (!req.admin?.id || !req.admin?.tenant_id) return;
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      const { action, entite, entiteId } = parseRoute(req.method, fullPath);

      const auditEntry = {
        tenant_id: req.admin.tenant_id,
        admin_id: req.admin.id,
        action,
        entite,
        entite_id: entiteId,
        details: {
          method: req.method,
          path: fullPath.split('?')[0],
          status: res.statusCode,
          ip,
          user_agent: userAgent,
          duration_ms: Date.now() - startTime,
        },
      };

      // Insert non-bloquant
      supabase
        .from('historique_admin')
        .insert(auditEntry)
        .then(({ error }) => {
          if (error) {
            logger.warn('[AUDIT] Erreur insert audit log:', error.message);
          }
        });
    };

    next();
  };
}

export default auditLogMiddleware;
