/**
 * Service de cache universel NEXUS
 *
 * Gère le cache pour tous les services externes :
 * - Claude (réponses dynamiques)
 * - ElevenLabs (audio)
 * - DALL-E (images)
 * - Tavily (recherches)
 *
 * @module cacheService
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Utiliser process.cwd() pour compatibilité ESM/CJS
const PROJECT_ROOT = process.cwd();

// === CONFIGURATION DU CACHE ===

export const CACHE_CONFIG = {
  claude: {
    directory: path.join(PROJECT_ROOT, 'data', 'cache', 'claude'),
    ttl: 24 * 60 * 60 * 1000, // 24 heures
    maxSize: 100 * 1024 * 1024, // 100 MB
    extension: '.json'
  },
  elevenlabs: {
    directory: path.join(PROJECT_ROOT, 'data', 'voice-cache'),
    ttl: 30 * 24 * 60 * 60 * 1000, // 30 jours
    maxSize: 500 * 1024 * 1024, // 500 MB
    extension: '.mp3'
  },
  dalle: {
    directory: path.join(PROJECT_ROOT, 'data', 'cache', 'dalle'),
    ttl: 90 * 24 * 60 * 60 * 1000, // 90 jours
    maxSize: 1024 * 1024 * 1024, // 1 GB
    extension: '.png'
  },
  tavily: {
    directory: path.join(PROJECT_ROOT, 'data', 'cache', 'tavily'),
    ttl: 60 * 60 * 1000, // 1 heure
    maxSize: 50 * 1024 * 1024, // 50 MB
    extension: '.json'
  },
  general: {
    directory: path.join(PROJECT_ROOT, 'data', 'cache', 'general'),
    ttl: 60 * 60 * 1000, // 1 heure par défaut
    maxSize: 100 * 1024 * 1024, // 100 MB
    extension: '.json'
  }
};

// === RÉPONSES STATIQUES CLAUDE ===
// REMOVED (v3.23.0): Static responses were hardcoded for a single tenant (Fat's Hair-Afro)
// and returned incorrect information for all other tenants. The AI generates correct
// per-tenant responses dynamically using tenant config, business rules, and services DB.
// The matchStaticResponse() function still works -- it simply returns null for all queries,
// letting the AI handle every request with tenant-aware context.
export const STATIC_RESPONSES = {};

// === FONCTIONS UTILITAIRES ===

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generateKey(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return crypto.createHash('md5').update(str).digest('hex');
}

function getFilePath(service, key) {
  const config = CACHE_CONFIG[service] || CACHE_CONFIG.general;
  ensureDirectory(config.directory);
  return path.join(config.directory, `${key}${config.extension}`);
}

function isExpired(filepath, ttl) {
  try {
    const stats = fs.statSync(filepath);
    const age = Date.now() - stats.mtimeMs;
    return age > ttl;
  } catch {
    return true;
  }
}

// === FONCTIONS PRINCIPALES ===

/**
 * Récupère une entrée du cache
 * @param {string} service - Type de service (claude, elevenlabs, dalle, tavily)
 * @param {string|object} keyData - Données pour générer la clé
 * @returns {object|null} { data, metadata } ou null si non trouvé/expiré
 */
export function get(service, keyData) {
  const config = CACHE_CONFIG[service] || CACHE_CONFIG.general;
  const key = typeof keyData === 'string' && keyData.length === 32 ? keyData : generateKey(keyData);
  const filepath = getFilePath(service, key);

  if (!fs.existsSync(filepath)) {
    return null;
  }

  if (isExpired(filepath, config.ttl)) {
    // Supprimer l'entrée expirée
    try {
      fs.unlinkSync(filepath);
    } catch {}
    return null;
  }

  try {
    if (config.extension === '.json') {
      const content = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      return {
        data: content.data,
        metadata: content.metadata,
        key,
        fromCache: true
      };
    } else {
      // Fichiers binaires (audio, images)
      return {
        data: fs.readFileSync(filepath),
        metadata: getMetadata(service, key),
        key,
        fromCache: true
      };
    }
  } catch (error) {
    console.error(`[CACHE] Erreur lecture ${service}/${key}:`, error.message);
    return null;
  }
}

/**
 * Stocke une entrée dans le cache
 * @param {string} service - Type de service
 * @param {string|object} keyData - Données pour générer la clé
 * @param {any} data - Données à stocker
 * @param {object} metadata - Métadonnées optionnelles
 * @returns {string} Clé générée
 */
export function set(service, keyData, data, metadata = {}) {
  const config = CACHE_CONFIG[service] || CACHE_CONFIG.general;
  const key = typeof keyData === 'string' && keyData.length === 32 ? keyData : generateKey(keyData);
  const filepath = getFilePath(service, key);

  try {
    if (config.extension === '.json') {
      fs.writeFileSync(filepath, JSON.stringify({
        data,
        metadata: {
          ...metadata,
          cachedAt: new Date().toISOString(),
          service
        }
      }, null, 2));
    } else {
      // Fichiers binaires
      fs.writeFileSync(filepath, data);
      // Stocker les métadonnées séparément
      setMetadata(service, key, metadata);
    }

    return key;
  } catch (error) {
    console.error(`[CACHE] Erreur écriture ${service}/${key}:`, error.message);
    throw error;
  }
}

/**
 * Gère les métadonnées pour les fichiers binaires
 */
function getMetadata(service, key) {
  const metaPath = getFilePath(service, `${key}.meta`).replace(CACHE_CONFIG[service]?.extension || '.json', '.json');
  try {
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    }
  } catch {}
  return {};
}

function setMetadata(service, key, metadata) {
  const config = CACHE_CONFIG[service] || CACHE_CONFIG.general;
  const metaPath = path.join(config.directory, `${key}.meta.json`);
  try {
    fs.writeFileSync(metaPath, JSON.stringify({
      ...metadata,
      cachedAt: new Date().toISOString()
    }));
  } catch {}
}

/**
 * Invalide une entrée du cache
 * @param {string} service - Type de service
 * @param {string|object} keyData - Données ou clé
 */
export function invalidate(service, keyData) {
  const key = typeof keyData === 'string' && keyData.length === 32 ? keyData : generateKey(keyData);
  const filepath = getFilePath(service, key);

  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    // Supprimer aussi les métadonnées
    const metaPath = filepath.replace(/\.[^.]+$/, '.meta.json');
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Nettoie les entrées expirées de tous les caches
 * @returns {object} Statistiques de nettoyage
 */
export function cleanup() {
  const stats = {
    totalCleaned: 0,
    byService: {},
    freedBytes: 0
  };

  for (const [service, config] of Object.entries(CACHE_CONFIG)) {
    if (!fs.existsSync(config.directory)) continue;

    stats.byService[service] = { cleaned: 0, freedBytes: 0 };

    const files = fs.readdirSync(config.directory);
    for (const file of files) {
      const filepath = path.join(config.directory, file);

      try {
        const fileStats = fs.statSync(filepath);
        const age = Date.now() - fileStats.mtimeMs;

        if (age > config.ttl) {
          stats.byService[service].freedBytes += fileStats.size;
          stats.freedBytes += fileStats.size;
          fs.unlinkSync(filepath);
          stats.byService[service].cleaned++;
          stats.totalCleaned++;
        }
      } catch {}
    }
  }

  return stats;
}

/**
 * Récupère les statistiques du cache
 * @returns {object} Statistiques globales et par service
 */
export function getStats() {
  const stats = {
    totalFiles: 0,
    totalSize: 0,
    totalSizeMB: '0.00',
    byService: {}
  };

  for (const [service, config] of Object.entries(CACHE_CONFIG)) {
    if (!fs.existsSync(config.directory)) {
      stats.byService[service] = {
        files: 0,
        size: 0,
        sizeMB: '0.00',
        maxSizeMB: (config.maxSize / (1024 * 1024)).toFixed(0),
        usagePercent: 0
      };
      continue;
    }

    let serviceFiles = 0;
    let serviceSize = 0;

    const files = fs.readdirSync(config.directory);
    for (const file of files) {
      try {
        const filepath = path.join(config.directory, file);
        const fileStats = fs.statSync(filepath);
        serviceFiles++;
        serviceSize += fileStats.size;
      } catch {}
    }

    stats.byService[service] = {
      files: serviceFiles,
      size: serviceSize,
      sizeMB: (serviceSize / (1024 * 1024)).toFixed(2),
      maxSizeMB: (config.maxSize / (1024 * 1024)).toFixed(0),
      usagePercent: ((serviceSize / config.maxSize) * 100).toFixed(1),
      ttlHours: (config.ttl / (60 * 60 * 1000)).toFixed(1)
    };

    stats.totalFiles += serviceFiles;
    stats.totalSize += serviceSize;
  }

  stats.totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);

  return stats;
}

// === FONCTIONS SPÉCIFIQUES CLAUDE ===

/**
 * Vérifie si une question correspond à une réponse statique
 * @param {string} question - Question de l'utilisateur
 * @returns {object|null} { key, response } ou null
 */
export function matchStaticResponse(question) {
  const normalized = question.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Enlever accents

  for (const [key, data] of Object.entries(STATIC_RESPONSES)) {
    for (const keyword of data.keywords) {
      if (normalized.includes(keyword)) {
        return {
          key,
          response: data.response,
          matchedKeyword: keyword
        };
      }
    }
  }

  return null;
}

/**
 * Cache une réponse Claude dynamique
 */
export function cacheClaudeResponse(prompt, response, metadata = {}) {
  return set('claude', prompt, {
    prompt: prompt.substring(0, 500),
    response,
    timestamp: new Date().toISOString()
  }, metadata);
}

/**
 * Récupère une réponse Claude cachée
 */
export function getCachedClaudeResponse(prompt) {
  const cached = get('claude', prompt);
  if (cached) {
    return {
      response: cached.data.response,
      fromCache: true,
      cachedAt: cached.data.timestamp
    };
  }
  return null;
}

// === FONCTIONS SPÉCIFIQUES IMAGES ===

/**
 * Cache une image DALL-E
 */
export function cacheDalleImage(prompt, imageBuffer, metadata = {}) {
  const key = generateKey(prompt + (metadata.style || '') + (metadata.resolution || '1024'));
  return set('dalle', key, imageBuffer, {
    prompt: prompt.substring(0, 500),
    ...metadata
  });
}

/**
 * Récupère une image DALL-E cachée
 */
export function getCachedDalleImage(prompt, metadata = {}) {
  const key = generateKey(prompt + (metadata.style || '') + (metadata.resolution || '1024'));
  return get('dalle', key);
}

// === FONCTIONS SPÉCIFIQUES TAVILY ===

/**
 * Cache un résultat de recherche Tavily
 */
export function cacheTavilySearch(query, results, metadata = {}) {
  return set('tavily', query, results, metadata);
}

/**
 * Récupère une recherche Tavily cachée
 */
export function getCachedTavilySearch(query) {
  return get('tavily', query);
}

// === EXPORT PAR DÉFAUT ===

export default {
  CACHE_CONFIG,
  STATIC_RESPONSES,
  get,
  set,
  invalidate,
  cleanup,
  getStats,
  generateKey,
  matchStaticResponse,
  cacheClaudeResponse,
  getCachedClaudeResponse,
  cacheDalleImage,
  getCachedDalleImage,
  cacheTavilySearch,
  getCachedTavilySearch
};
