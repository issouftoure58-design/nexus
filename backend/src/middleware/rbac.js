/**
 * RBAC Middleware — NEXUS
 * Matrice de permissions granulaire par rôle et module.
 *
 * Rôles (du plus au moins privilégié) :
 * - super_admin : opérateur NEXUS, accès cross-tenant
 * - admin       : propriétaire du tenant, accès total
 * - manager     : gestionnaire, lecture + écriture, suppression limitée
 * - viewer      : lecture seule
 *
 * Permissions : read, write, delete
 */

import logger from '../config/logger.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MATRICE DE PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════════

const PERMISSIONS = {
  // Module → { role → [permissions] }
  clients:       { admin: ['read', 'write', 'delete'], manager: ['read', 'write'], viewer: ['read'] },
  reservations:  { admin: ['read', 'write', 'delete'], manager: ['read', 'write'], viewer: ['read'] },
  services:      { admin: ['read', 'write', 'delete'], manager: ['read', 'write'], viewer: ['read'] },
  disponibilites:{ admin: ['read', 'write', 'delete'], manager: ['read', 'write'], viewer: ['read'] },
  parametres:    { admin: ['read', 'write', 'delete'], manager: ['read'],          viewer: ['read'] },
  equipe:        { admin: ['read', 'write', 'delete'], manager: ['read'],          viewer: [] },
  comptabilite:  { admin: ['read', 'write', 'delete'], manager: ['read', 'write'], viewer: ['read'] },
  stock:         { admin: ['read', 'write', 'delete'], manager: ['read', 'write'], viewer: ['read'] },
  rh:            { admin: ['read', 'write', 'delete'], manager: ['read'],          viewer: [] },
  marketing:     { admin: ['read', 'write', 'delete'], manager: ['read', 'write'], viewer: ['read'] },
  devis:         { admin: ['read', 'write', 'delete'], manager: ['read', 'write'], viewer: ['read'] },
  seo:           { admin: ['read', 'write', 'delete'], manager: ['read', 'write'], viewer: ['read'] },
  ia:            { admin: ['read', 'write', 'delete'], manager: ['read'],          viewer: ['read'] },
  billing:       { admin: ['read', 'write', 'delete'], manager: ['read'],          viewer: [] },
  api_keys:      { admin: ['read', 'write', 'delete'], manager: [],                viewer: [] },
  audit:         { admin: ['read'],                     manager: ['read'],          viewer: [] },
  stats:         { admin: ['read'],                     manager: ['read'],          viewer: ['read'] },
  modules:       { admin: ['read', 'write', 'delete'], manager: ['read'],          viewer: ['read'] },
};

// super_admin a toutes les permissions sur tout
const ALL_PERMISSIONS = ['read', 'write', 'delete'];

/**
 * Vérifie si un rôle a une permission sur un module
 * @param {string} role - Le rôle de l'utilisateur
 * @param {string} module - Le module cible
 * @param {string} permission - La permission requise (read/write/delete)
 * @param {object|null} customPermissions - Override JSONB custom_permissions (optionnel)
 */
function hasPermission(role, module, permission, customPermissions = null) {
  if (role === 'super_admin' || role === 'owner') {
    return true;
  }

  // Si custom_permissions défini → l'utiliser en priorité
  if (customPermissions) {
    const perms = customPermissions[module];
    if (!perms) return false; // Module absent = pas d'accès
    return perms.includes(permission);
  }

  // Sinon → matrice par défaut
  const modulePerms = PERMISSIONS[module];
  if (!modulePerms) {
    // Module inconnu → seul admin et super_admin passent
    return role === 'admin';
  }

  const rolePerms = modulePerms[role];
  if (!rolePerms) {
    return false;
  }

  return rolePerms.includes(permission);
}

/**
 * Déduit la permission requise depuis la méthode HTTP
 */
function permissionFromMethod(method) {
  switch (method) {
    case 'GET': return 'read';
    case 'POST': return 'write';
    case 'PUT': return 'write';
    case 'PATCH': return 'write';
    case 'DELETE': return 'delete';
    default: return 'read';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Middleware factory — vérifie la permission sur un module
 * Usage : router.get('/', authenticateAdmin, requirePermission('clients', 'read'), handler)
 *         router.delete('/:id', authenticateAdmin, requirePermission('clients', 'delete'), handler)
 */
export function requirePermission(module, permission = null) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const effectivePermission = permission || permissionFromMethod(req.method);

    if (!hasPermission(req.admin.role, module, effectivePermission, req.admin.custom_permissions)) {
      logger.warn(`[RBAC] Accès refusé: admin ${req.admin.id} (role: ${req.admin.role}) → ${module}:${effectivePermission}`);
      return res.status(403).json({
        error: 'Permissions insuffisantes',
        required: `${module}:${effectivePermission}`,
      });
    }

    next();
  };
}

/**
 * Middleware qui déduit le module depuis le path et vérifie automatiquement
 * Usage : app.use('/api/admin', rbacMiddleware());
 */
export function rbacMiddleware() {
  // Map des prefixes de route vers les modules
  const ROUTE_MODULE_MAP = {
    '/clients': 'clients',
    '/reservations': 'reservations',
    '/services': 'services',
    '/disponibilites': 'disponibilites',
    '/parametres': 'parametres',
    '/invitations': 'equipe',
    '/team': 'equipe',
    '/compta': 'comptabilite',
    '/stock': 'stock',
    '/rh': 'rh',
    '/segments': 'marketing',
    '/workflows': 'marketing',
    '/pipeline': 'marketing',
    '/devis': 'devis',
    '/prestations': 'devis',
    '/seo': 'seo',
    '/ia': 'ia',
    '/menu': 'services',
    '/hotel': 'reservations',
    '/agents': 'ia',
    '/api-keys': 'api_keys',
    '/webhooks': 'api_keys',
    '/audit-logs': 'audit',
    '/stats': 'stats',
    '/modules': 'modules',
    '/orders': 'reservations',
    '/onboarding': 'parametres',
    '/profile': 'parametres',
  };

  // Routes exclues du RBAC (auth, chat, etc.)
  const EXCLUDED_PREFIXES = ['/auth', '/chat', '/sentinel'];

  return (req, res, next) => {
    // Seulement si authentifié
    if (!req.admin) {
      return next();
    }

    // Exclure certaines routes
    const path = req.path;
    if (EXCLUDED_PREFIXES.some(p => path.startsWith(p))) {
      return next();
    }

    // Trouver le module correspondant
    const matchedPrefix = Object.keys(ROUTE_MODULE_MAP).find(p => path.startsWith(p));
    if (!matchedPrefix) {
      return next(); // Route non mappée → pas de restriction
    }

    const module = ROUTE_MODULE_MAP[matchedPrefix];
    const permission = permissionFromMethod(req.method);

    if (!hasPermission(req.admin.role, module, permission, req.admin.custom_permissions)) {
      logger.warn(`[RBAC] Accès refusé: admin ${req.admin.id} (role: ${req.admin.role}) → ${module}:${permission} (${req.method} ${path})`);
      return res.status(403).json({
        error: 'Permissions insuffisantes',
        required: `${module}:${permission}`,
      });
    }

    next();
  };
}

/**
 * Retourne la matrice de permissions pour un rôle donné
 */
export function getPermissionsForRole(role) {
  if (role === 'super_admin' || role === 'owner') {
    const result = {};
    for (const module of Object.keys(PERMISSIONS)) {
      result[module] = ALL_PERMISSIONS;
    }
    return result;
  }

  const result = {};
  for (const [module, perms] of Object.entries(PERMISSIONS)) {
    result[module] = perms[role] || [];
  }
  return result;
}

/**
 * Retourne la matrice de permissions effective (custom_permissions override la matrice par défaut)
 */
export function getEffectivePermissions(role, customPermissions = null) {
  if (role === 'super_admin' || role === 'owner') {
    const result = {};
    for (const module of Object.keys(PERMISSIONS)) {
      result[module] = ALL_PERMISSIONS;
    }
    return result;
  }

  // Si custom_permissions défini → l'utiliser
  if (customPermissions) {
    return customPermissions;
  }

  // Sinon → matrice par défaut du rôle
  return getPermissionsForRole(role);
}

export default { requirePermission, rbacMiddleware, getPermissionsForRole, getEffectivePermissions, hasPermission };
