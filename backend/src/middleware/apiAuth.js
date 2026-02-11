/**
 * API Authentication Middleware
 * Authentification via API keys pour l'API REST publique
 * Format header : Authorization: Bearer nxk_prod_xxxxxxxxxxxxx
 */

import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';

// Prefixes valides pour les API keys
const KEY_PREFIXES = {
  PRODUCTION: 'nxk_prod_',
  TEST: 'nxk_test_',
  SANDBOX: 'nxk_sand_'
};

// Scopes disponibles
export const API_SCOPES = {
  // Clients
  'read:clients': 'Lecture des clients',
  'write:clients': 'Creation/modification clients',
  'delete:clients': 'Suppression clients',

  // Reservations
  'read:reservations': 'Lecture des reservations',
  'write:reservations': 'Creation/modification reservations',
  'delete:reservations': 'Annulation reservations',

  // Services
  'read:services': 'Lecture des services',
  'write:services': 'Creation/modification services',

  // Webhooks
  'read:webhooks': 'Lecture webhooks',
  'write:webhooks': 'Configuration webhooks',

  // Analytics
  'read:analytics': 'Lecture analytics',

  // Full access
  'admin': 'Acces complet API'
};

// Cache rate limit en memoire (en production utiliser Redis)
const rateLimitCache = new Map();

/**
 * Genere une nouvelle API key
 * @param {string} tenantId
 * @param {string} type - 'prod', 'test', 'sand'
 * @returns {string} API key en clair (a afficher une seule fois)
 */
export function generateApiKey(type = 'prod') {
  const prefix = KEY_PREFIXES[type.toUpperCase()] || KEY_PREFIXES.PRODUCTION;
  const randomPart = Array.from({ length: 32 }, () =>
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
      .charAt(Math.floor(Math.random() * 62))
  ).join('');

  return `${prefix}${randomPart}`;
}

/**
 * Hash une API key pour stockage securise
 * @param {string} apiKey
 * @returns {Promise<string>}
 */
export async function hashApiKey(apiKey) {
  return bcrypt.hash(apiKey, 10);
}

/**
 * Extrait le prefix d'une API key
 * @param {string} apiKey
 * @returns {string}
 */
function extractPrefix(apiKey) {
  // Retourne les 13 premiers caracteres (nxk_prod_ ou nxk_test_)
  return apiKey.substring(0, 13);
}

/**
 * Verifie le rate limit pour une API key
 * @param {string} apiKeyId
 * @param {number} limit
 * @returns {object} { allowed, remaining, resetAt }
 */
function checkRateLimit(apiKeyId, limit) {
  const now = Date.now();
  const hourStart = Math.floor(now / 3600000) * 3600000;
  const cacheKey = `${apiKeyId}:${hourStart}`;

  let record = rateLimitCache.get(cacheKey);

  if (!record) {
    record = { count: 0, resetAt: hourStart + 3600000 };
    rateLimitCache.set(cacheKey, record);
  }

  record.count++;

  // Nettoyer les anciennes entrees
  for (const [key, val] of rateLimitCache) {
    if (val.resetAt < now) {
      rateLimitCache.delete(key);
    }
  }

  return {
    allowed: record.count <= limit,
    remaining: Math.max(0, limit - record.count),
    resetAt: record.resetAt,
    limit
  };
}

/**
 * Log un appel API
 * @param {object} logData
 */
async function logApiCall(logData) {
  try {
    await supabase.from('api_logs').insert({
      tenant_id: logData.tenantId,
      api_key_id: logData.apiKeyId,
      method: logData.method,
      endpoint: logData.endpoint,
      status_code: logData.statusCode,
      response_time_ms: logData.responseTime,
      ip_address: logData.ip,
      user_agent: logData.userAgent,
      request_body: logData.requestBody,
      error_message: logData.error
    });
  } catch (err) {
    console.error('[API_LOG] Erreur logging:', err.message);
  }
}

/**
 * Middleware principal d'authentification API
 */
export const authenticateApiKey = async (req, res, next) => {
  const startTime = Date.now();

  try {
    // 1. Extraire API key du header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'API key required. Use header: Authorization: Bearer nxk_xxx...'
      });
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer "

    // 2. Verifier format
    const validPrefix = Object.values(KEY_PREFIXES).some(p => apiKey.startsWith(p));
    if (!validPrefix || apiKey.length < 40) {
      return res.status(401).json({
        error: 'invalid_key_format',
        message: 'Invalid API key format'
      });
    }

    const keyPrefix = extractPrefix(apiKey);

    // 3. Chercher API key par prefix
    const { data: keys, error: fetchError } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_prefix', keyPrefix)
      .eq('is_active', true);

    if (fetchError || !keys || keys.length === 0) {
      await logApiCall({
        tenantId: 'unknown',
        method: req.method,
        endpoint: req.path,
        statusCode: 401,
        responseTime: Date.now() - startTime,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        error: 'API key not found'
      });

      return res.status(401).json({
        error: 'invalid_key',
        message: 'Invalid or inactive API key'
      });
    }

    // 4. Verifier le hash de la cle
    let validKey = null;
    for (const key of keys) {
      const isValid = await bcrypt.compare(apiKey, key.key_hash);
      if (isValid) {
        validKey = key;
        break;
      }
    }

    if (!validKey) {
      return res.status(401).json({
        error: 'invalid_key',
        message: 'Invalid API key'
      });
    }

    // 5. Verifier expiration
    if (validKey.expires_at && new Date(validKey.expires_at) < new Date()) {
      return res.status(401).json({
        error: 'key_expired',
        message: 'API key has expired'
      });
    }

    // 6. Verifier rate limit
    const rateLimit = checkRateLimit(validKey.id, validKey.rate_limit_per_hour);

    // Ajouter headers rate limit
    res.set('X-RateLimit-Limit', rateLimit.limit);
    res.set('X-RateLimit-Remaining', rateLimit.remaining);
    res.set('X-RateLimit-Reset', Math.floor(rateLimit.resetAt / 1000));

    if (!rateLimit.allowed) {
      await logApiCall({
        tenantId: validKey.tenant_id,
        apiKeyId: validKey.id,
        method: req.method,
        endpoint: req.path,
        statusCode: 429,
        responseTime: Date.now() - startTime,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        error: 'Rate limit exceeded'
      });

      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: `Rate limit exceeded. Limit: ${rateLimit.limit}/hour`,
        retry_after: Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
      });
    }

    // 7. Mettre a jour last_used_at
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', validKey.id);

    // 8. Ajouter infos a la requete
    req.apiKey = {
      id: validKey.id,
      name: validKey.name,
      scopes: validKey.scopes || [],
      isTest: apiKey.startsWith(KEY_PREFIXES.TEST),
      isSandbox: apiKey.startsWith(KEY_PREFIXES.SANDBOX)
    };
    req.tenantId = validKey.tenant_id;

    // 9. Logger l'appel (async, non-bloquant)
    res.on('finish', () => {
      logApiCall({
        tenantId: validKey.tenant_id,
        apiKeyId: validKey.id,
        method: req.method,
        endpoint: req.path,
        statusCode: res.statusCode,
        responseTime: Date.now() - startTime,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
    });

    next();

  } catch (error) {
    console.error('[API_AUTH] Erreur:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Authentication error'
    });
  }
};

/**
 * Middleware pour verifier un scope specifique
 * @param {string|string[]} requiredScopes - Scope(s) requis
 */
export const requireScope = (requiredScopes) => {
  const scopes = Array.isArray(requiredScopes) ? requiredScopes : [requiredScopes];

  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'API key authentication required'
      });
    }

    const keyScopes = req.apiKey.scopes || [];

    // Admin a tous les droits
    if (keyScopes.includes('admin')) {
      return next();
    }

    // Verifier si au moins un scope requis est present
    const hasScope = scopes.some(s => keyScopes.includes(s));

    if (!hasScope) {
      return res.status(403).json({
        error: 'insufficient_permissions',
        message: `Required scope(s): ${scopes.join(' or ')}`,
        your_scopes: keyScopes
      });
    }

    next();
  };
};

/**
 * Middleware pour mode test/sandbox
 * Bloque certaines operations en mode test
 */
export const blockInTestMode = (req, res, next) => {
  if (req.apiKey && (req.apiKey.isTest || req.apiKey.isSandbox)) {
    return res.status(403).json({
      error: 'test_mode_blocked',
      message: 'This operation is not available in test/sandbox mode'
    });
  }
  next();
};

export default {
  authenticateApiKey,
  requireScope,
  blockInTestMode,
  generateApiKey,
  hashApiKey,
  API_SCOPES
};
