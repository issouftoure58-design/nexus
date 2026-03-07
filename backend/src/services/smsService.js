/**
 * Service SMS via Twilio
 * Wrapper réutilisable pour l'envoi de SMS depuis le workflow engine
 */

import { isDegraded } from '../sentinel/index.js';

/**
 * Envoie un SMS via Twilio
 * @param {string} telephone - Numéro du destinataire
 * @param {string} message - Contenu du SMS
 * @param {string} tenantId - ID du tenant (pour traçabilité)
 * @param {object} options - Options supplémentaires
 * @param {boolean} options.essential - Si true, envoyé même en mode dégradé (confirmations, alertes)
 * @returns {Promise<{success: boolean, sid?: string, simulated?: boolean}>}
 */
export async function sendSMS(telephone, message, tenantId = null, options = {}) {
  // Mode dégradé : bloquer SMS non-essentiels (marketing, rappels)
  if (isDegraded() && !options.essential) {
    console.log(`[SMS] Bloqué en mode dégradé (non-essentiel), tenant: ${tenantId}`);
    return { success: false, error: 'SMS non-essentiel bloqué (mode dégradé Sentinel)', degradedMode: true };
  }
  if (!telephone || !message) {
    console.warn('[SMS] Paramètres manquants:', { telephone: !!telephone, message: !!message });
    return { success: false, error: 'telephone et message requis' };
  }

  // Si Twilio non configuré → log + simulé
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log('[SMS] Twilio non configuré, SMS simulé:', { to: telephone, tenant: tenantId });
    return { success: true, simulated: true };
  }

  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    // Formater le numéro (+33 pour les numéros FR)
    let formattedPhone = telephone.replace(/[\s.]/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+33' + formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+33' + formattedPhone;
    }

    const params = {
      body: message,
      to: formattedPhone
    };

    // Utiliser Messaging Service si configuré, sinon FROM number
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
      params.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    } else if (process.env.TWILIO_PHONE_NUMBER) {
      params.from = process.env.TWILIO_PHONE_NUMBER;
    } else {
      console.warn('[SMS] Ni TWILIO_MESSAGING_SERVICE_SID ni TWILIO_PHONE_NUMBER configuré');
      return { success: false, error: 'Configuration Twilio incomplète (from manquant)' };
    }

    const result = await client.messages.create(params);
    console.log(`[SMS] Envoyé à ${formattedPhone} (SID: ${result.sid}, tenant: ${tenantId})`);
    return { success: true, sid: result.sid };
  } catch (error) {
    console.error(`[SMS] Erreur envoi à ${telephone}:`, error.message);
    return { success: false, error: error.message };
  }
}
