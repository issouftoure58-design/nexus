/**
 * Worker de traitement des notifications
 * Consomme les jobs de la queue et envoie les notifications
 */

import { initNotificationQueue } from './notificationQueue.js';
import { Resend } from 'resend';
import twilio from 'twilio';
import { getTenantConfig } from '../config/tenants/index.js';

// Clients externes
let resendClient = null;
let twilioClient = null;

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

  const tenantConfig = getTenantConfig(tenant_id);
  const fromEmail = tenantConfig?.email || process.env.RESEND_FROM_EMAIL || 'noreply@nexus.app';
  const fromName = tenantConfig?.businessName || 'NEXUS';

  const result = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
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

  // Vérifier mode mock en dev
  if (process.env.MOCK_SMS === 'true') {
    console.log(`[WORKER] 📱 [MOCK] SMS à ${telephone}: ${message.substring(0, 50)}...`);
    return { success: true, mock: true };
  }

  const tenantConfig = getTenantConfig(tenant_id);
  const from = tenantConfig?.twilioPhone || process.env.TWILIO_PHONE_NUMBER;

  const result = await client.messages.create({
    body: message,
    from,
    to: telephone
  });

  return { success: true, sid: result.sid };
}

/**
 * Envoie un WhatsApp via Twilio
 */
async function sendWhatsApp(job) {
  const { telephone, message, tenant_id } = job.data;
  const client = getTwilio();

  if (!client) {
    throw new Error('Twilio non configuré');
  }

  // Vérifier mode mock en dev
  if (process.env.MOCK_SMS === 'true') {
    console.log(`[WORKER] 💬 [MOCK] WhatsApp à ${telephone}: ${message.substring(0, 50)}...`);
    return { success: true, mock: true };
  }

  const tenantConfig = getTenantConfig(tenant_id);
  const from = `whatsapp:${tenantConfig?.twilioWhatsApp || process.env.TWILIO_WHATSAPP_NUMBER}`;
  const to = telephone.startsWith('whatsapp:') ? telephone : `whatsapp:${telephone}`;

  const result = await client.messages.create({
    body: message,
    from,
    to
  });

  return { success: true, sid: result.sid };
}

/**
 * Démarre le worker
 */
export function startNotificationWorker() {
  const queue = initNotificationQueue();

  if (!queue) {
    console.log('[WORKER] ⚠️ Queue non disponible, worker non démarré');
    return;
  }

  // Processor pour les emails
  queue.process('email', 5, async (job) => {
    console.log(`[WORKER] 📧 Traitement email job ${job.id}...`);
    try {
      const result = await sendEmail(job);
      return result;
    } catch (error) {
      console.error(`[WORKER] ❌ Erreur email:`, error.message);
      throw error; // Relancer pour retry
    }
  });

  // Processor pour les SMS
  queue.process('sms', 3, async (job) => {
    console.log(`[WORKER] 📱 Traitement SMS job ${job.id}...`);
    try {
      const result = await sendSMS(job);
      return result;
    } catch (error) {
      console.error(`[WORKER] ❌ Erreur SMS:`, error.message);
      throw error;
    }
  });

  // Processor pour WhatsApp
  queue.process('whatsapp', 3, async (job) => {
    console.log(`[WORKER] 💬 Traitement WhatsApp job ${job.id}...`);
    try {
      const result = await sendWhatsApp(job);
      return result;
    } catch (error) {
      console.error(`[WORKER] ❌ Erreur WhatsApp:`, error.message);
      throw error;
    }
  });

  console.log('[WORKER] ✅ Notification worker démarré (email: 5 concurrents, sms/whatsapp: 3)');
}

/**
 * Arrête le worker proprement
 */
export async function stopNotificationWorker() {
  const queue = initNotificationQueue();
  if (queue) {
    await queue.close();
    console.log('[WORKER] ⏹️ Worker arrêté');
  }
}

export default {
  startNotificationWorker,
  stopNotificationWorker
};
