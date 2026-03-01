/**
 * Tenant Cache — In-memory cache loaded from Supabase at startup.
 *
 * Pattern: async load at startup, sync reads from Map, periodic refresh.
 * Fallback: if DB is unreachable, loads from static JS files.
 *
 * This module uses rawSupabase (no tenant filtering) because
 * the tenants table is a SYSTEM_TABLE.
 */

import { rawSupabase } from '../supabase.js';
import logger from '../logger.js';

// Static fallback imports
import fatshairafroStatic from './fatshairafro.js';
import decoeventStatic from './decoevent.js';
import templateStatic from './template.js';

const STATIC_FALLBACK = { fatshairafro: fatshairafroStatic, decoevent: decoeventStatic };

// In-memory stores
let tenantMap = new Map();   // tenantId -> full config object
let domainMap = new Map();   // domain fragment -> tenantId
let phoneMap = new Map();    // phone_number -> tenantId (pour routing téléphone)
let tenantIds = [];          // ordered list of tenant IDs
let initialized = false;
let lastRefresh = null;
let refreshTimer = null;
let loadedFromDb = false;

const REFRESH_INTERVAL_MS = 60_000; // 1 minute

/**
 * Load all active tenants from Supabase into memory.
 * Falls back to static JS files if DB is unavailable.
 * @returns {Promise<boolean>} true if loaded from DB, false if fallback
 */
export async function loadAllTenants() {
  try {
    const { data, error } = await rawSupabase
      .from('tenants')
      .select('*')
      .in('status', ['active', 'pending']);

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No tenants found in DB');

    const newTenantMap = new Map();
    const newDomainMap = new Map();

    for (const row of data) {
      const tenantId = row.slug || row.id;

      // Full config source: `config` JSONB (post-migration 011) or `settings` JSONB (pre-migration).
      const baseConfig = row.config || row.settings || {};

      // Overlay structured DB columns for consistency.
      const config = {
        ...baseConfig,
        id: tenantId,
        name: row.name || baseConfig.name,
        domain: row.domain || baseConfig.domain,
        frozen: row.frozen ?? baseConfig.frozen ?? false,
        features: { ...(baseConfig.features || {}), ...(row.features || {}) },
        limits: { ...(baseConfig.limits || {}), ...(row.limits_config || {}) },
        branding: { ...(baseConfig.branding || {}), ...(row.branding || {}) },
        plan: row.tier || baseConfig.plan || 'starter',
        status: row.status,
        phone_number: row.phone_number || baseConfig.phone_number || null,
        whatsapp_number: row.whatsapp_number || baseConfig.whatsapp_number || null,
      };

      newTenantMap.set(tenantId, config);

      // Build domain lookup map
      if (row.domain) {
        newDomainMap.set(row.domain, tenantId);
      }
      // Also map tenantId itself for subdomain matching
      newDomainMap.set(tenantId, tenantId);
    }

    tenantMap = newTenantMap;
    domainMap = newDomainMap;
    tenantIds = Array.from(newTenantMap.keys());
    initialized = true;
    loadedFromDb = true;
    lastRefresh = new Date();

    // Charger les numéros de téléphone pour le routing multi-tenant
    await loadPhoneNumbers();

    logger.info('Loaded tenants from DB', { tag: 'TenantCache', count: tenantMap.size });
    return true;
  } catch (err) {
    logger.warn('DB load failed, using JS fallback', { tag: 'TenantCache', error: err.message });
    loadFromStaticFiles();
    return false;
  }
}

/**
 * Load tenant configs from static JS files (emergency fallback).
 */
function loadFromStaticFiles() {
  tenantMap = new Map();
  domainMap = new Map();

  for (const [id, config] of Object.entries(STATIC_FALLBACK)) {
    tenantMap.set(id, config);
    if (config.domain) {
      domainMap.set(config.domain, id);
    }
    domainMap.set(id, id);
  }

  tenantIds = Array.from(tenantMap.keys());
  initialized = true;
  loadedFromDb = false;
  lastRefresh = new Date();
  logger.info('Loaded tenants from static files (fallback)', { tag: 'TenantCache', count: tenantMap.size });
}

/**
 * Start periodic refresh from DB (every 60s).
 */
export function startPeriodicRefresh() {
  if (refreshTimer) return;
  refreshTimer = setInterval(() => {
    loadAllTenants().catch(err =>
      logger.error('Periodic refresh failed', { tag: 'TenantCache', error: err.message })
    );
  }, REFRESH_INTERVAL_MS);
  // Allow process to exit even if timer is running
  if (refreshTimer.unref) refreshTimer.unref();
}

/**
 * Stop periodic refresh.
 */
export function stopPeriodicRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Load phone numbers for all tenants (for multi-tenant phone routing).
 */
async function loadPhoneNumbers() {
  try {
    // Load from tenant_phone_numbers table
    const { data: phoneData, error: phoneError } = await rawSupabase
      .from('tenant_phone_numbers')
      .select('tenant_id, phone_number')
      .eq('status', 'active');

    if (!phoneError && phoneData) {
      const newPhoneMap = new Map();
      for (const row of phoneData) {
        newPhoneMap.set(row.phone_number, row.tenant_id);
      }
      phoneMap = newPhoneMap;
      logger.info('Loaded phone numbers for routing', { tag: 'TenantCache', count: phoneMap.size });
    }

    // Also load from tenants.phone_number column (fallback)
    const { data: tenantPhones } = await rawSupabase
      .from('tenants')
      .select('slug, id, phone_number')
      .not('phone_number', 'is', null);

    if (tenantPhones) {
      for (const row of tenantPhones) {
        const tenantId = row.slug || row.id;
        if (row.phone_number && !phoneMap.has(row.phone_number)) {
          phoneMap.set(row.phone_number, tenantId);
        }
      }
    }
  } catch (err) {
    logger.warn('Phone numbers load failed', { tag: 'TenantCache', error: err.message });
  }
}

// ============ SYNC GETTERS ============

/**
 * Get cached config for a tenant (sync).
 * Returns template if tenant unknown.
 */
export function getCachedConfig(tenantId) {
  if (!tenantId) return null;
  return tenantMap.get(tenantId) || null;
}

/**
 * Get all cached tenant IDs (sync).
 */
export function getCachedTenantIds() {
  return [...tenantIds];
}

/**
 * Find tenant ID by domain/host fragment (sync).
 */
export function findTenantByDomain(host) {
  if (!host) return null;
  for (const [fragment, tenantId] of domainMap) {
    if (host.includes(fragment)) return tenantId;
  }
  return null;
}

/**
 * Find tenant ID by phone number (sync).
 * Used for multi-tenant phone routing.
 */
export function findTenantByPhone(phoneNumber) {
  if (!phoneNumber) return null;
  // Normaliser le numéro (enlever espaces, tirets, parenthèses - mais garder le +)
  const normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');

  logger.info('findTenantByPhone', { tag: 'TenantCache', phoneNumber, normalized, mapSize: phoneMap.size });

  // Chercher exact match
  if (phoneMap.has(normalized)) {
    logger.info('Exact match found', { tag: 'TenantCache', tenantId: phoneMap.get(normalized) });
    return phoneMap.get(normalized);
  }

  // Chercher avec variantes (+33 vs 0033 vs 33)
  for (const [phone, tenantId] of phoneMap) {
    const phoneNorm = phone.replace(/[\s\-\(\)]/g, '');
    if (phoneNorm === normalized ||
        phoneNorm.endsWith(normalized.slice(-9)) ||
        normalized.endsWith(phoneNorm.slice(-9))) {
      logger.info('Variant match', { tag: 'TenantCache', phone, tenantId });
      return tenantId;
    }
  }

  // Debug: afficher toutes les entrées du cache pour diagnostic
  const entries = {};
  for (const [phone, tenantId] of phoneMap) {
    entries[phone] = tenantId;
  }
  logger.info('No match found', { tag: 'TenantCache', entries });

  return null;
}

/**
 * Whether cache has been initialized.
 */
export function isInitialized() {
  return initialized;
}

/**
 * Whether data was loaded from DB (vs static fallback).
 */
export function isLoadedFromDb() {
  return loadedFromDb;
}

/**
 * Get template config for unknown tenants.
 */
export function getTemplate() {
  return templateStatic;
}

/**
 * Get all phone mappings (for debug).
 */
export function getPhoneMapDebug() {
  const entries = {};
  for (const [phone, tenantId] of phoneMap) {
    entries[phone] = tenantId;
  }
  return {
    size: phoneMap.size,
    entries,
    lastRefresh: lastRefresh?.toISOString() || null,
    loadedFromDb,
  };
}
