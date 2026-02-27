/**
 * Tenant Loader — Multi-tenant configuration system
 *
 * Source: Supabase tenants table (via in-memory cache).
 * Fallback: Static JS files if cache not yet loaded.
 *
 * API is 100% SYNCHRONOUS — reads from in-memory Map.
 * Cache is populated async at server startup (tenantCache.js).
 *
 * Identification du tenant par :
 * 1. Header X-Tenant-ID
 * 2. Query param ?tenant=
 * 3. Parse du domaine/sous-domaine (host)
 * 4. null = contexte NEXUS (pas de tenant)
 *
 * REGLE: NEXUS est la plateforme. Les tenants sont des clients.
 * Quand aucun tenant n'est detecte, on est en contexte NEXUS.
 */

import {
  getCachedConfig,
  getCachedTenantIds,
  findTenantByDomain,
  findTenantByPhone,
  isInitialized,
  getTemplate,
} from './tenantCache.js';

// Static fallback (used only during early boot before cache init)
import fatshairafro from './fatshairafro.js';
import decoevent from './decoevent.js';
import nexustest from './nexustest.js';
import testsecurity from './testsecurity.js';
import testconsulting from './testconsulting.js';
import testevents from './testevents.js';
import template from './template.js';

const staticTenants = {
  fatshairafro,
  decoevent,
  'nexus-test': nexustest,
  'test-security': testsecurity,
  'test-consulting': testconsulting,
  'test-events': testevents,
};

/**
 * Retourne la config complète d'un tenant par son ID.
 * Lit depuis le cache en memoire (charge depuis Supabase au demarrage).
 * Fallback sur les fichiers JS statiques si cache pas encore charge.
 */
export function getTenantConfig(tenantId) {
  if (!tenantId) return null;

  // Cache path (normal after startup)
  if (isInitialized()) {
    return getCachedConfig(tenantId) || getTemplate();
  }

  // Fallback: static files (during early boot)
  return staticTenants[tenantId] || template;
}

/**
 * Identifie le tenant à partir d'une requête HTTP.
 * Retourne null si contexte NEXUS (pas de tenant).
 * Ordre : header X-Tenant-ID > query param > sous-domaine > null
 */
export function identifyTenant(req) {
  // 1. Header explicite
  const headerTenant = req?.headers?.['x-tenant-id'];
  if (headerTenant && isKnownTenant(headerTenant)) {
    return headerTenant;
  }

  // 2. Query param ?tenant=
  try {
    const url = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
    const paramTenant = url.searchParams.get('tenant');
    if (paramTenant && isKnownTenant(paramTenant)) return paramTenant;
  } catch (e) { /* URL parse error, continue */ }

  // 3. Domain lookup (from cache — supports custom domains from DB)
  const host = req?.headers?.host || '';
  if (isInitialized()) {
    const domainMatch = findTenantByDomain(host);
    if (domainMatch) return domainMatch;
  }

  // 4. Static fallback for known domains (boot safety)
  if (host.includes('fatshairafro')) return 'fatshairafro';
  if (host.includes('decoevent')) return 'decoevent';
  if (host.includes('nexus-test') || host.includes('test.nexus')) return 'nexus-test';
  if (host.includes('test-security') || host.includes('atlas-securite')) return 'test-security';
  if (host.includes('test-consulting') || host.includes('clara-conseil')) return 'test-consulting';
  if (host.includes('test-events') || host.includes('emma-events')) return 'test-events';

  // 5. Pas de tenant detecte = contexte NEXUS
  return null;
}

/**
 * Verifie si un tenant est connu (cache ou statique).
 */
function isKnownTenant(tenantId) {
  if (isInitialized() && getCachedConfig(tenantId)) return true;
  return !!staticTenants[tenantId];
}

/**
 * Shortcut : identifie le tenant ET retourne sa config.
 */
export function getTenantFromRequest(req) {
  const tenantId = identifyTenant(req);
  return { tenantId, config: getTenantConfig(tenantId) };
}

/**
 * Identifie le tenant par numéro de téléphone (pour routing appels/WhatsApp).
 * Retourne le tenantId et sa config complète.
 */
export function getTenantByPhone(phoneNumber) {
  const tenantId = findTenantByPhone(phoneNumber);
  if (!tenantId) {
    return { tenantId: null, config: null };
  }
  return { tenantId, config: getTenantConfig(tenantId) };
}

/**
 * Liste tous les tenants enregistrés.
 */
export function listTenants() {
  if (isInitialized()) {
    const cached = getCachedTenantIds();
    if (cached.length > 0) return cached;
  }
  return Object.keys(staticTenants);
}

/**
 * Vérifie si un tenant est frozen (production protégée).
 */
export function isFrozen(tenantId) {
  if (!tenantId) return false;
  const config = getTenantConfig(tenantId);
  return config?.frozen === true;
}

/**
 * Vérifie si une feature est activée pour un tenant.
 */
export function hasFeature(tenantId, featureName) {
  if (!tenantId) return false;
  const config = getTenantConfig(tenantId);
  return config?.features?.[featureName] === true;
}

/**
 * Vérifie si un tenant peut être modifié (non frozen ou mode dev).
 */
export function canModify(tenantId, reason = '') {
  if (isFrozen(tenantId)) {
    console.warn(`[TENANT ${tenantId}] FROZEN - Modification refusée: ${reason}`);
    return false;
  }
  return true;
}

export default { getTenantConfig, identifyTenant, getTenantFromRequest, getTenantByPhone, listTenants, isFrozen, hasFeature, canModify };
