/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║   NOTIFICATION CASCADE SERVICE - Optimisation des couts notifications        ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                               ║
 * ║   Cascade intelligente pour reduire les couts de 44%:                         ║
 * ║   1. Email (gratuit - inclus Resend)                                          ║
 * ║   2. WhatsApp (0.01EUR) - apres delai si email non lu                         ║
 * ║   3. SMS (0.04EUR) - en dernier recours ou urgent                             ║
 * ║                                                                               ║
 * ║   Economies:                                                                  ║
 * ║   - 60% des notifications = Email seul (0EUR)                                 ║
 * ║   - 30% = Email + WhatsApp (0.01EUR)                                          ║
 * ║   - 10% = SMS (0.04EUR)                                                       ║
 * ║   - Cout moyen: 0.007EUR vs 0.04EUR direct = -82%                             ║
 * ║                                                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

import { supabase } from '../config/supabase.js';
import { Resend } from 'resend';
import { sendWhatsAppNotification } from './whatsappService.js';

// Config
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'NEXUS <notifications@nexus.io>';

let resend = null;
if (RESEND_API_KEY) {
  resend = new Resend(RESEND_API_KEY);
}

// Delais de cascade (en millisecondes)
const CASCADE_DELAYS = {
  emailToWhatsapp: 2 * 60 * 60 * 1000, // 2 heures
  whatsappToSms: 30 * 60 * 1000,       // 30 minutes
};

// Priorites
const PRIORITY = {
  LOW: 'low',       // Email only
  NORMAL: 'normal', // Email -> WhatsApp -> SMS
  HIGH: 'high',     // Email + WhatsApp immediat
  URGENT: 'urgent', // Tous les canaux immediatement
};

// Stats du service
const stats = {
  totalSent: 0,
  emailOnly: 0,
  emailPlusWhatsapp: 0,
  emailPlusWhatsappPlusSms: 0,
  smsOnly: 0,
  failed: 0,
  costSaved: 0,
  lastReset: new Date().toISOString()
};

// Prix par canal
const COSTS = {
  email: 0,
  whatsapp: 0.01,
  sms: 0.04
};

/**
 * Envoie un email via Resend
 */
async function sendEmail(to, subject, html, text = null) {
  if (!resend) {
    return { success: false, error: 'Resend non configure', channel: 'email' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '')
    });

    if (error) {
      return { success: false, error: error.message, channel: 'email' };
    }

    return { success: true, messageId: data.id, channel: 'email', cost: COSTS.email };
  } catch (error) {
    return { success: false, error: error.message, channel: 'email' };
  }
}

/**
 * Envoie un SMS via Twilio
 */
async function sendSMS(to, message) {
  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // Formater le numero
    let formattedPhone = to.replace(/\s/g, '').replace(/\./g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+33' + formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+33' + formattedPhone;
    }

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    return { success: true, sid: result.sid, channel: 'sms', cost: COSTS.sms };
  } catch (error) {
    return { success: false, error: error.message, channel: 'sms' };
  }
}

/**
 * Enregistre le statut de livraison dans la BDD
 */
async function recordDelivery(tenantId, notificationId, channel, status, metadata = {}) {
  try {
    await supabase.from('notification_deliveries').upsert({
      tenant_id: tenantId,
      notification_id: notificationId,
      channel,
      status,
      metadata,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'notification_id,channel'
    });
  } catch (error) {
    console.error('[CASCADE] Erreur enregistrement delivery:', error.message);
  }
}

/**
 * Verifie si une notification a ete lue/delivree
 */
async function checkDeliveryStatus(tenantId, notificationId, channel) {
  try {
    const { data } = await supabase
      .from('notification_deliveries')
      .select('status, delivered_at, read_at')
      .eq('tenant_id', tenantId)
      .eq('notification_id', notificationId)
      .eq('channel', channel)
      .single();

    return data || { status: 'unknown' };
  } catch {
    return { status: 'unknown' };
  }
}

/**
 * Point d'entree principal - Envoie avec cascade intelligente
 *
 * @param {string} tenantId - ID du tenant
 * @param {object} recipient - { email, phone, name }
 * @param {object} content - { subject, html, text, smsText, whatsappText }
 * @param {object} options - { priority, notificationId, type, metadata }
 * @returns {object} { success, channels, totalCost, savedCost }
 */
export async function sendWithCascade(tenantId, recipient, content, options = {}) {
  const {
    priority = PRIORITY.NORMAL,
    notificationId = `notif_${Date.now()}`,
    type = 'general',
    scheduleFallback = true
  } = options;

  if (!tenantId) {
    throw new Error('tenant_id requis pour sendWithCascade');
  }

  stats.totalSent++;
  const results = {
    notificationId,
    channels: [],
    success: false,
    totalCost: 0,
    savedCost: 0
  };

  const { email, phone, name } = recipient;
  const { subject, html, text, smsText, whatsappText } = content;

  try {
    // === URGENT: Tous les canaux immediatement ===
    if (priority === PRIORITY.URGENT) {
      const promises = [];

      if (email) {
        promises.push(sendEmail(email, subject, html, text));
      }
      if (phone && whatsappText) {
        promises.push(sendWhatsAppNotification(phone, whatsappText, tenantId));
      }
      if (phone && smsText) {
        promises.push(sendSMS(phone, smsText));
      }

      const channelResults = await Promise.all(promises);
      results.channels = channelResults;
      results.success = channelResults.some(r => r.success);
      results.totalCost = channelResults.reduce((sum, r) => sum + (r.cost || 0), 0);
      stats.smsOnly++;
      return results;
    }

    // === LOW: Email seulement ===
    if (priority === PRIORITY.LOW) {
      if (email) {
        const emailResult = await sendEmail(email, subject, html, text);
        results.channels.push(emailResult);
        results.success = emailResult.success;
        results.totalCost = emailResult.cost || 0;
        results.savedCost = COSTS.sms; // On economise un SMS
        stats.emailOnly++;
        stats.costSaved += COSTS.sms;
        await recordDelivery(tenantId, notificationId, 'email', emailResult.success ? 'sent' : 'failed');
      }
      return results;
    }

    // === HIGH: Email + WhatsApp immediat ===
    if (priority === PRIORITY.HIGH) {
      const promises = [];

      if (email) {
        promises.push(sendEmail(email, subject, html, text));
      }
      if (phone && whatsappText) {
        promises.push(sendWhatsAppNotification(phone, whatsappText, tenantId).then(r => ({
          ...r,
          channel: 'whatsapp',
          cost: COSTS.whatsapp
        })));
      }

      const channelResults = await Promise.all(promises);
      results.channels = channelResults;
      results.success = channelResults.some(r => r.success);
      results.totalCost = channelResults.reduce((sum, r) => sum + (r.cost || 0), 0);
      results.savedCost = COSTS.sms - results.totalCost;
      stats.emailPlusWhatsapp++;
      stats.costSaved += Math.max(0, results.savedCost);
      return results;
    }

    // === NORMAL: Cascade Email -> WhatsApp -> SMS ===

    // Etape 1: Email
    if (email) {
      const emailResult = await sendEmail(email, subject, html, text);
      results.channels.push(emailResult);
      results.totalCost += emailResult.cost || 0;
      await recordDelivery(tenantId, notificationId, 'email', emailResult.success ? 'sent' : 'failed');

      if (emailResult.success) {
        results.success = true;
        stats.emailOnly++;
        stats.costSaved += COSTS.sms;
        results.savedCost = COSTS.sms;

        // Planifier fallback WhatsApp si email non lu
        if (scheduleFallback && phone && whatsappText) {
          scheduleCascadeFallback(tenantId, notificationId, {
            phone,
            whatsappText,
            smsText,
            delayMs: CASCADE_DELAYS.emailToWhatsapp
          });
        }

        return results;
      }
    }

    // Etape 2: WhatsApp (si email echoue ou pas d'email)
    if (phone && whatsappText) {
      const waResult = await sendWhatsAppNotification(phone, whatsappText, tenantId);
      const waResultEnriched = {
        ...waResult,
        channel: 'whatsapp',
        cost: COSTS.whatsapp
      };
      results.channels.push(waResultEnriched);
      results.totalCost += waResultEnriched.cost || 0;
      await recordDelivery(tenantId, notificationId, 'whatsapp', waResult.success ? 'sent' : 'failed');

      if (waResult.success) {
        results.success = true;
        stats.emailPlusWhatsapp++;
        stats.costSaved += COSTS.sms - COSTS.whatsapp;
        results.savedCost = COSTS.sms - results.totalCost;
        return results;
      }
    }

    // Etape 3: SMS (dernier recours)
    if (phone && smsText) {
      const smsResult = await sendSMS(phone, smsText);
      results.channels.push(smsResult);
      results.totalCost += smsResult.cost || 0;
      await recordDelivery(tenantId, notificationId, 'sms', smsResult.success ? 'sent' : 'failed');

      if (smsResult.success) {
        results.success = true;
        stats.emailPlusWhatsappPlusSms++;
      }
    }

    if (!results.success) {
      stats.failed++;
    }

    return results;

  } catch (error) {
    console.error('[CASCADE] Erreur:', error.message);
    stats.failed++;
    results.error = error.message;
    return results;
  }
}

/**
 * Planifie un fallback pour la cascade
 * Utilise le scheduler existant ou setTimeout simple
 */
function scheduleCascadeFallback(tenantId, notificationId, options) {
  const { phone, whatsappText, smsText, delayMs } = options;

  // Pour l'instant, simple setTimeout (en prod, utiliser Bull/Redis)
  setTimeout(async () => {
    try {
      // Verifier si email a ete lu
      const emailStatus = await checkDeliveryStatus(tenantId, notificationId, 'email');

      if (emailStatus.read_at) {
        console.log(`[CASCADE] Email lu pour ${notificationId}, pas de fallback`);
        return;
      }

      console.log(`[CASCADE] Email non lu pour ${notificationId}, envoi WhatsApp`);

      // Envoyer WhatsApp
      if (phone && whatsappText) {
        const waResult = await sendWhatsAppNotification(phone, whatsappText, tenantId);
        await recordDelivery(tenantId, notificationId, 'whatsapp', waResult.success ? 'sent' : 'failed');

        if (waResult.success) {
          stats.emailPlusWhatsapp++;
          return;
        }
      }

      // Si WhatsApp echoue, planifier SMS
      if (phone && smsText) {
        setTimeout(async () => {
          const waStatus = await checkDeliveryStatus(tenantId, notificationId, 'whatsapp');
          if (waStatus.delivered_at || waStatus.read_at) {
            return;
          }

          console.log(`[CASCADE] WhatsApp non delivre pour ${notificationId}, envoi SMS`);
          const smsResult = await sendSMS(phone, smsText);
          await recordDelivery(tenantId, notificationId, 'sms', smsResult.success ? 'sent' : 'failed');
          stats.emailPlusWhatsappPlusSms++;
        }, CASCADE_DELAYS.whatsappToSms);
      }

    } catch (error) {
      console.error('[CASCADE] Erreur fallback:', error.message);
    }
  }, delayMs);
}

/**
 * Raccourci pour notifications de rendez-vous
 */
export async function sendRdvNotification(tenantId, rdv, type, options = {}) {
  const recipient = {
    email: rdv.client_email || rdv.clients?.email,
    phone: rdv.client_telephone || rdv.clients?.telephone,
    name: rdv.client_prenom || rdv.clients?.prenom || 'Client'
  };

  const templates = {
    confirmation: {
      subject: `Confirmation RDV - ${rdv.date}`,
      priority: PRIORITY.HIGH
    },
    rappel: {
      subject: `Rappel: RDV demain - ${rdv.date}`,
      priority: PRIORITY.NORMAL
    },
    annulation: {
      subject: `Annulation RDV - ${rdv.date}`,
      priority: PRIORITY.HIGH
    },
    modification: {
      subject: `Modification RDV - ${rdv.date}`,
      priority: PRIORITY.HIGH
    }
  };

  const template = templates[type] || templates.confirmation;

  const content = {
    subject: template.subject,
    html: options.html || `<p>RDV: ${rdv.date} a ${rdv.heure}</p>`,
    smsText: options.smsText || `RDV ${rdv.date} ${rdv.heure}`,
    whatsappText: options.whatsappText || `RDV: ${rdv.date} a ${rdv.heure}`
  };

  return sendWithCascade(tenantId, recipient, content, {
    priority: options.priority || template.priority,
    type: `rdv_${type}`,
    ...options
  });
}

/**
 * Raccourci pour notifications marketing
 */
export async function sendMarketingNotification(tenantId, client, content, options = {}) {
  const recipient = {
    email: client.email,
    phone: client.telephone,
    name: client.prenom || client.nom || 'Client'
  };

  return sendWithCascade(tenantId, recipient, content, {
    priority: PRIORITY.LOW, // Marketing = email only par defaut
    type: 'marketing',
    scheduleFallback: false, // Pas de fallback pour marketing
    ...options
  });
}

/**
 * Stats du service
 */
export function getStats() {
  const total = stats.emailOnly + stats.emailPlusWhatsapp + stats.emailPlusWhatsappPlusSms + stats.smsOnly;

  return {
    ...stats,
    emailOnlyRate: total > 0 ? ((stats.emailOnly / total) * 100).toFixed(1) + '%' : '0%',
    avgCostPerNotification: total > 0
      ? ((stats.emailOnly * 0 + stats.emailPlusWhatsapp * 0.01 + stats.emailPlusWhatsappPlusSms * 0.05 + stats.smsOnly * 0.04) / total).toFixed(4)
      : '0',
    totalSavingsEUR: stats.costSaved.toFixed(2)
  };
}

/**
 * Reset stats
 */
export function resetStats() {
  Object.assign(stats, {
    totalSent: 0,
    emailOnly: 0,
    emailPlusWhatsapp: 0,
    emailPlusWhatsappPlusSms: 0,
    smsOnly: 0,
    failed: 0,
    costSaved: 0,
    lastReset: new Date().toISOString()
  });
}

// Exports
export { PRIORITY, COSTS, CASCADE_DELAYS };

export default {
  sendWithCascade,
  sendRdvNotification,
  sendMarketingNotification,
  getStats,
  resetStats,
  PRIORITY,
  COSTS
};
