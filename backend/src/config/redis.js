/**
 * Configuration Redis OPTIONNELLE
 * Le serveur fonctionne sans Redis, mais certaines fonctionnalités seront désactivées
 * (Agent Autonome, File de tâches BullMQ)
 */

import { Redis } from 'ioredis';
import logger from './logger.js';

let redisConnection = null;
let isRedisAvailable = false;
let connectionAttempted = false;

/**
 * Initialise la connexion Redis (optionnel)
 * @returns {Redis|null} Instance Redis ou null si non disponible
 */
export async function initRedis() {
  if (connectionAttempted) {
    return redisConnection;
  }
  connectionAttempted = true;

  // Si pas d'URL Redis configurée, skip silencieusement
  if (!process.env.REDIS_URL) {
    logger.info('REDIS_URL non configurée - Agent Autonome désactivé', { tag: 'REDIS' });
    return null;
  }

  try {
    redisConnection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null, // Requis par BullMQ
      enableReadyCheck: false,
      connectTimeout: 5000,
      lazyConnect: true,
      retryStrategy: (times) => {
        if (times > 2) {
          logger.info('Connexion échouée - Agent Autonome désactivé', { tag: 'REDIS' });
          return null; // Stop retrying
        }
        return Math.min(times * 200, 1000);
      }
    });

    // Tester la connexion
    await redisConnection.connect();
    await redisConnection.ping();

    isRedisAvailable = true;
    logger.info('Connecté', { tag: 'REDIS' });

    // Event handlers
    redisConnection.on('ready', () => {
      logger.info('Prêt à recevoir des commandes', { tag: 'REDIS' });
    });

    redisConnection.on('error', (err) => {
      // Ne pas logger les erreurs de connexion si déjà marqué comme non disponible
      if (isRedisAvailable) {
        logger.error('Erreur', { tag: 'REDIS', error: err.message });
      }
    });

    redisConnection.on('close', () => {
      if (isRedisAvailable) {
        logger.info('Connexion fermée', { tag: 'REDIS' });
        isRedisAvailable = false;
      }
    });

    return redisConnection;

  } catch (error) {
    logger.info('Non disponible - Agent Autonome désactivé. Le serveur fonctionne normalement sans Redis', { tag: 'REDIS' });
    redisConnection = null;
    isRedisAvailable = false;
    return null;
  }
}

/**
 * Récupère l'instance Redis (peut être null)
 */
export function getRedis() {
  return redisConnection;
}

/**
 * Vérifie si Redis est disponible
 */
export function isAvailable() {
  return isRedisAvailable;
}

/**
 * Récupère la connexion Redis ou initialise si nécessaire
 * Pour compatibilité avec le code existant
 */
export async function getOrInitRedis() {
  if (!connectionAttempted) {
    await initRedis();
  }
  return redisConnection;
}

// Export par défaut pour compatibilité avec l'ancien code
// ATTENTION: Ce sera null si Redis n'est pas initialisé
export default redisConnection;

// Export nommés
export { redisConnection };
