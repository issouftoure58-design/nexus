/**
 * Queue de notifications avec retry automatique
 * Utilise Bull + Redis pour la gestion des jobs
 */

import Bull from 'bull';
import { getRedis } from '../config/redis.js';

// Configuration Redis depuis l'environnement
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Création de la queue
let notificationQueue = null;

/**
 * Initialise la queue de notifications
 */
export function initNotificationQueue() {
  if (notificationQueue) return notificationQueue;

  if (!process.env.REDIS_URL) {
    console.log('[QUEUE] ⚠️ Redis non configuré - Queue désactivée');
    return null;
  }

  try {
    notificationQueue = new Bull('notifications', redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000 // 2s, 4s, 8s
        },
        removeOnComplete: 100, // Garder les 100 derniers jobs complétés
        removeOnFail: 50 // Garder les 50 derniers échecs
      },
      settings: {
        stalledInterval: 30000, // 30s
        maxStalledCount: 2
      }
    });

    // Handlers d'événements
    notificationQueue.on('completed', (job, result) => {
      console.log(`[QUEUE] ✅ Job ${job.id} (${job.name}) complété:`, result?.success ? 'OK' : 'Partial');
    });

    notificationQueue.on('failed', (job, err) => {
      console.error(`[QUEUE] ❌ Job ${job.id} (${job.name}) échoué après ${job.attemptsMade} tentatives:`, err.message);
    });

    notificationQueue.on('stalled', (job) => {
      console.warn(`[QUEUE] ⚠️ Job ${job.id} bloqué, relance...`);
    });

    console.log('[QUEUE] ✅ Notification queue initialisée');
    return notificationQueue;

  } catch (error) {
    console.error('[QUEUE] ❌ Erreur initialisation:', error.message);
    return null;
  }
}

/**
 * Ajoute un SMS à la queue
 */
export async function queueSMS(telephone, message, tenantId, options = {}) {
  const queue = initNotificationQueue();
  if (!queue) {
    console.log('[QUEUE] Queue non disponible, envoi direct requis');
    return null;
  }

  const job = await queue.add('sms', {
    type: 'sms',
    telephone,
    message,
    tenant_id: tenantId,
    created_at: new Date().toISOString()
  }, {
    priority: options.priority || 1,
    delay: options.delay || 0,
    jobId: options.jobId || `sms:${tenantId}:${Date.now()}`
  });

  console.log(`[QUEUE] 📱 SMS ajouté: job ${job.id}`);
  return job;
}

/**
 * Ajoute un email à la queue
 */
export async function queueEmail(to, subject, html, tenantId, options = {}) {
  const queue = initNotificationQueue();
  if (!queue) {
    console.log('[QUEUE] Queue non disponible, envoi direct requis');
    return null;
  }

  const job = await queue.add('email', {
    type: 'email',
    to,
    subject,
    html,
    tenant_id: tenantId,
    created_at: new Date().toISOString()
  }, {
    priority: options.priority || 2,
    delay: options.delay || 0,
    jobId: options.jobId || `email:${tenantId}:${Date.now()}`
  });

  console.log(`[QUEUE] 📧 Email ajouté: job ${job.id}`);
  return job;
}

/**
 * Ajoute un WhatsApp à la queue
 */
export async function queueWhatsApp(telephone, message, tenantId, options = {}) {
  const queue = initNotificationQueue();
  if (!queue) {
    console.log('[QUEUE] Queue non disponible, envoi direct requis');
    return null;
  }

  const job = await queue.add('whatsapp', {
    type: 'whatsapp',
    telephone,
    message,
    tenant_id: tenantId,
    created_at: new Date().toISOString()
  }, {
    priority: options.priority || 1,
    delay: options.delay || 0,
    jobId: options.jobId || `whatsapp:${tenantId}:${Date.now()}`
  });

  console.log(`[QUEUE] 💬 WhatsApp ajouté: job ${job.id}`);
  return job;
}

/**
 * Récupère les statistiques de la queue
 */
export async function getQueueStats() {
  const queue = initNotificationQueue();
  if (!queue) return null;

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount()
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Nettoie les anciens jobs
 */
export async function cleanQueue(olderThan = 24 * 60 * 60 * 1000) {
  const queue = initNotificationQueue();
  if (!queue) return;

  await queue.clean(olderThan, 'completed');
  await queue.clean(olderThan * 7, 'failed'); // Garder les échecs 7 jours

  console.log('[QUEUE] 🧹 Nettoyage effectué');
}

export default {
  initNotificationQueue,
  queueSMS,
  queueEmail,
  queueWhatsApp,
  getQueueStats,
  cleanQueue
};
