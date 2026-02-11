/**
 * Middleware de resolution Tenant par domaine
 * Permet le white-label avec domaines custom
 */

import { supabase } from '../config/supabase.js';

// Cache des domaines (evite requetes BDD repetees)
const domainCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Resout le tenant a partir du domaine de la requete
 *
 * Ordre de resolution:
 * 1. Header X-Tenant-ID (pour API/dev)
 * 2. Domaine custom (booking.clientcompany.com)
 * 3. Sous-domaine NEXUS (client.nexus.ai)
 * 4. Query param ?tenant_id=xxx (fallback)
 */
export const resolveTenantByDomain = async (req, res, next) => {
  try {
    // 1. Header explicite (priorite pour API)
    const headerTenantId = req.headers['x-tenant-id'];
    if (headerTenantId) {
      req.tenantId = headerTenantId;
      req.tenantSource = 'header';
      return next();
    }

    // 2. Query param (fallback dev)
    const queryTenantId = req.query.tenant_id;
    if (queryTenantId) {
      req.tenantId = queryTenantId;
      req.tenantSource = 'query';
      return next();
    }

    // 3. Resolution par domaine
    const host = req.get('host');

    if (!host) {
      req.tenantId = null;
      req.tenantSource = 'none';
      return next();
    }

    // Nettoyer le host (retirer port)
    const domain = host.split(':')[0].toLowerCase();

    // Verifier cache
    const cached = domainCache.get(domain);
    if (cached && cached.expiresAt > Date.now()) {
      req.tenantId = cached.tenantId;
      req.tenantSource = cached.source;
      req.branding = cached.branding;
      return next();
    }

    // 3a. Verifier si c'est un domaine custom verifie
    const { data: branding, error } = await supabase
      .from('branding')
      .select('tenant_id, custom_domain_verified, company_name, logo_url, primary_color')
      .eq('custom_domain', domain)
      .eq('custom_domain_verified', true)
      .single();

    if (!error && branding) {
      // Domaine custom trouve
      domainCache.set(domain, {
        tenantId: branding.tenant_id,
        source: 'custom_domain',
        branding: {
          company_name: branding.company_name,
          logo_url: branding.logo_url,
          primary_color: branding.primary_color
        },
        expiresAt: Date.now() + CACHE_TTL
      });

      req.tenantId = branding.tenant_id;
      req.tenantSource = 'custom_domain';
      req.branding = branding;
      return next();
    }

    // 3b. Verifier si c'est un sous-domaine NEXUS (xxx.nexus.ai)
    const nexusDomains = ['nexus.ai', 'nexus-backend-dev.onrender.com', 'localhost'];
    const isNexusDomain = nexusDomains.some(d => domain.endsWith(d));

    if (isNexusDomain) {
      const subdomain = domain.split('.')[0];

      // Ignorer les sous-domaines systeme
      const systemSubdomains = ['www', 'api', 'app', 'admin', 'dashboard'];
      if (!systemSubdomains.includes(subdomain)) {
        domainCache.set(domain, {
          tenantId: subdomain,
          source: 'subdomain',
          branding: null,
          expiresAt: Date.now() + CACHE_TTL
        });

        req.tenantId = subdomain;
        req.tenantSource = 'subdomain';
        return next();
      }
    }

    // Pas de tenant trouve
    req.tenantId = null;
    req.tenantSource = 'none';
    next();

  } catch (error) {
    console.error('[RESOLVE_TENANT] Error:', error);
    req.tenantId = null;
    req.tenantSource = 'error';
    next();
  }
};

/**
 * Middleware qui requiert un tenant_id valide
 * A utiliser apres resolveTenantByDomain
 */
export const requireTenant = (req, res, next) => {
  if (!req.tenantId) {
    return res.status(400).json({
      error: 'tenant_required',
      message: 'Unable to determine tenant. Use X-Tenant-ID header or access via tenant subdomain.'
    });
  }
  next();
};

/**
 * Invalide le cache pour un domaine
 * A appeler quand le branding change
 */
export function invalidateDomainCache(domain) {
  domainCache.delete(domain);
}

/**
 * Invalide tout le cache pour un tenant
 * A appeler quand le tenant change de domaine
 */
export function invalidateTenantCache(tenantId) {
  for (const [domain, cached] of domainCache) {
    if (cached.tenantId === tenantId) {
      domainCache.delete(domain);
    }
  }
}

/**
 * Vide tout le cache (pour maintenance)
 */
export function clearDomainCache() {
  domainCache.clear();
}

/**
 * Stats du cache (pour monitoring)
 */
export function getCacheStats() {
  const now = Date.now();
  let valid = 0;
  let expired = 0;

  for (const cached of domainCache.values()) {
    if (cached.expiresAt > now) {
      valid++;
    } else {
      expired++;
    }
  }

  return {
    total: domainCache.size,
    valid,
    expired,
    ttl_minutes: CACHE_TTL / 60000
  };
}

export default {
  resolveTenantByDomain,
  requireTenant,
  invalidateDomainCache,
  invalidateTenantCache,
  clearDomainCache,
  getCacheStats
};
