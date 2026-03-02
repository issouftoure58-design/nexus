/**
 * Queue de notifications avec retry automatique
 * Utilise BullMQ + Redis pour la gestion des jobs
 */

import { Queue } from 'bullmq';
import { getRedis, isAvailable, initRedis } from '../config/redis.js';

// Création de la queue
let notificationQueue = null;
let queueInitialized = false;

/**
 * Initialise la queue de notifications
 */
export async function initNotificationQueue() {
  if (queueInitialized) return notificationQueue;
  queueInitialized = true;

  await initRedis();

  if (!isAvailable()) {
    console.log('[QUEUE] ⚠️ Redis non disponible - Queue désactivée');
    return null;
  }

  const redis = getRedis();
  if (!redis) return null;

  try {
    notificationQueue = new Queue('notifications', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000 // 2s, 4s, 8s
        },
        removeOnComplete: 100,
        removeOnFail: 50
      }
    });

    console.log('[QUEUE] ✅ Notification queue initialisée');
    return notificationQueue;

  } catch (error) {
    console.error('[QUEUE] ❌ Erreur initialisation:', error.message);
    return null;
  }
}

/**
 * Récupère la queue (peut être null si Redis non disponible)
 */
async function getQueue() {
  if (!queueInitialized) {
    await initNotificationQueue();
  }
  return notificationQueue;
}

/**
 * Ajoute un SMS à la queue
 */
export async function queueSMS(telephone, message, tenantId, options = {}) {
  const queue = await getQueue();
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
  const queue = await getQueue();
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
  const queue = await getQueue();
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
  const queue = await getQueue();
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
  const queue = await getQueue();
  if (!queue) return;

  await queue.clean(olderThan, 0, 'completed');
  await queue.clean(olderThan * 7, 0, 'failed'); // Garder les échecs 7 jours

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
