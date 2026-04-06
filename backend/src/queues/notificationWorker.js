/**
 * Worker de traitement des notifications
 * Consomme les jobs de la queue et envoie les notifications
 * Utilise BullMQ Worker (pas Bull queue.process)
 */

import { Worker } from 'bullmq';
import { getRedis, isAvailable, initRedis } from '../config/redis.js';
import { Resend } from 'resend';
import twilio from 'twilio';
import { getTenantConfig } from '../config/tenants/index.js';

// Clients externes
let resendClient = null;
let twilioClient = null;
let worker = null;

function getResend() {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

function getTwilio() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

/**
 * Envoie un email via Resend
 */
async function sendEmail(job) {
  const { to, subject, html, tenant_id } = job.data;
  const resend = getResend();

  if (!resend) {
    throw new Error('Resend non configuré');
  }

  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'NEXUS <noreply@nexus-ai-saas.com>',
    to,
    subject,
    html
  });

  return { success: true, id: result.id };
}

/**
 * Envoie un SMS via Twilio
 */
async function sendSMS(job) {
  const { telephone, message, tenant_id } = job.data;
  const client = getTwilio();

  if (!client) {
    throw new Error('Twilio non configuré');
  }

  const tenantConfig = getTenantConfig(tenant_id);
  const from = tenantConfig?.phone_number || process.env.TWILIO_PHONE_NUMBER;

  const result = await client.messages.create({
    body: message,
    from,
    to: telephone
  });

  return { success: true, sid: result.sid };
}

/**
 * Envoie un message WhatsApp via Twilio
 */
async function sendWhatsApp(job) {
  const { telephone, message, tenant_id } = job.data;
  const client = getTwilio();

  if (!client) {
    throw new Error('Twilio non configuré');
  }

  const tenantConfig = getTenantConfig(tenant_id);
  const waNumber = tenantConfig?.whatsapp_number || process.env.TWILIO_WHATSAPP_NUMBER;
  const from = waNumber.startsWith('whatsapp:') ? waNumber : `whatsapp:${waNumber}`;
  const to = telephone.startsWith('whatsapp:') ? telephone : `whatsapp:${telephone}`;

  const result = await client.messages.create({
    body: message,
    from,
    to
  });

  return { success: true, sid: result.sid };
}

/**
 * Démarre le worker BullMQ
 */
export async function startNotificationWorker() {
  await initRedis();

  if (!isAvailable()) {
    console.log('[WORKER] ⚠️ Redis non disponible, worker non démarré');
    return;
  }

  const redis = getRedis();
  if (!redis) return;

  worker = new Worker('notifications', async (job) => {
    const { type } = job.data;

    switch (type) {
      case 'email':
        console.log(`[WORKER] 📧 Traitement email job ${job.id}...`);
        return await sendEmail(job);

      case 'sms':
        console.log(`[WORKER] 📱 Traitement SMS job ${job.id}...`);
        return await sendSMS(job);

      case 'whatsapp':
        console.log(`[WORKER] 💬 Traitement WhatsApp job ${job.id}...`);
        return await sendWhatsApp(job);

      default:
        console.warn(`[WORKER] ⚠️ Type inconnu: ${type}`);
        throw new Error(`Type de notification inconnu: ${type}`);
    }
  }, {
    connection: redis,
    concurrency: 5
  });

  worker.on('completed', (job) => {
    console.log(`[WORKER] ✅ Job ${job.id} terminé`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[WORKER] ❌ Job ${job?.id} échoué:`, err.message);
  });

  console.log('[WORKER] ✅ Notification worker BullMQ démarré (concurrency: 5)');
}

/**
 * Arrête le worker proprement
 */
export async function stopNotificationWorker() {
  if (worker) {
    await worker.close();
    console.log('[WORKER] ⏹️ Worker arrêté');
  }
}

export default {
  startNotificationWorker,
  stopNotificationWorker
};
