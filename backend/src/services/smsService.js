/**
 * Service SMS via Twilio — Multi-tenant
 * Chaque tenant peut avoir son propre numéro Twilio (stocké en DB).
 * Fallback sur les variables d'environnement globales si le tenant n'a pas de config.
 */

import { supabase } from '../config/supabase.js';
import { isDegraded } from '../sentinel/index.js';
import { trackSMS } from './usageTrackingService.js';

// Cache en mémoire pour éviter une requête DB à chaque SMS (TTL 5 min)
const tenantTwilioCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Récupère la config Twilio d'un tenant (DB → cache → fallback env)
 * @param {string} tenantId
 * @returns {Promise<{messagingServiceSid?: string, phoneNumber?: string}>}
 */
async function getTenantTwilioConfig(tenantId) {
  // SMS plateforme (signup, verif, alertes) → numéro dédié NEXUS
  if (!tenantId) return getPlatformConfig();

  // Check cache
  const cached = tenantTwilioCache.get(tenantId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.config;
  }

  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('twilio_messaging_service_sid, twilio_phone_number')
      .eq('id', tenantId)
      .single();

    if (!error && data && (data.twilio_messaging_service_sid || data.twilio_phone_number)) {
      const config = {
        messagingServiceSid: data.twilio_messaging_service_sid || null,
        phoneNumber: data.twilio_phone_number || null,
      };
      tenantTwilioCache.set(tenantId, { config, ts: Date.now() });
      return config;
    }
  } catch (err) {
    console.warn(`[SMS] Erreur lecture config Twilio tenant ${tenantId}:`, err.message);
  }

  // Fallback env vars
  return getEnvFallback();
}

/**
 * Config pour SMS plateforme (tenantId=null) : numéro dédié NEXUS
 */
function getPlatformConfig() {
  return {
    messagingServiceSid: null,
    phoneNumber: process.env.TWILIO_NEXUS_PHONE_NUMBER || process.env.TWILIO_PHONE_NUMBER || null,
  };
}

/**
 * Fallback tenant sans config DB → Messaging Service global
 */
function getEnvFallback() {
  return {
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || null,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || null,
  };
}

/**
 * Formate un numéro de téléphone en E.164 (défaut +33 pour FR)
 * @param {string} phone
 * @returns {string}
 */
export function formatPhoneE164(phone) {
  let formatted = phone.replace(/[\s.]/g, '');
  if (formatted.startsWith('0')) {
    formatted = '+33' + formatted.substring(1);
  }
  if (!formatted.startsWith('+')) {
    formatted = '+33' + formatted;
  }
  return formatted;
}

/**
 * Envoie un SMS via Twilio (multi-tenant)
 * @param {string} telephone - Numéro du destinataire
 * @param {string} message - Contenu du SMS
 * @param {string} tenantId - ID du tenant (obligatoire pour résolution numéro)
 * @param {object} options
 * @param {boolean} options.essential - Si true, envoyé même en mode dégradé
 * @returns {Promise<{success: boolean, sid?: string, simulated?: boolean}>}
 */
export async function sendSMS(telephone, message, tenantId = null, options = {}) {
  // Mode dégradé : bloquer SMS non-essentiels
  if (isDegraded() && !options.essential) {
    console.log(`[SMS] Bloqué en mode dégradé (non-essentiel), tenant: ${tenantId}`);
    return { success: false, error: 'SMS non-essentiel bloqué (mode dégradé Sentinel)', degradedMode: true };
  }

  if (!telephone || !message) {
    console.warn('[SMS] Paramètres manquants:', { telephone: !!telephone, message: !!message });
    return { success: false, error: 'telephone et message requis' };
  }

  // Si Twilio non configuré globalement → simulé
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log('[SMS] Twilio non configuré, SMS simulé:', { to: telephone, tenant: tenantId });
    return { success: true, simulated: true };
  }

  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    const formattedPhone = formatPhoneE164(telephone);

    // Résoudre la config Twilio du tenant (DB → env fallback)
    const twilioConfig = await getTenantTwilioConfig(tenantId);

    const params = {
      body: message,
      to: formattedPhone,
    };

    // Priorité : messagingServiceSid > phoneNumber
    if (twilioConfig.messagingServiceSid) {
      params.messagingServiceSid = twilioConfig.messagingServiceSid;
    } else if (twilioConfig.phoneNumber) {
      params.from = twilioConfig.phoneNumber;
    } else {
      console.warn(`[SMS] Aucune config Twilio pour tenant ${tenantId}`);
      return { success: false, error: 'Configuration Twilio incomplète (aucun numéro configuré)' };
    }

    const result = await client.messages.create(params);
    console.log(`[SMS] Envoyé à ${formattedPhone} (SID: ${result.sid}, tenant: ${tenantId})`);

    // Tracker l'usage SMS contre le quota du tenant (non-bloquant)
    if (tenantId) {
      trackSMS(tenantId, result.sid, 'outbound').catch(e =>
        console.error('[SMS] Erreur tracking usage:', e.message)
      );
    }

    return { success: true, sid: result.sid };
  } catch (error) {
    console.error(`[SMS] Erreur envoi à ${telephone}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Invalide le cache Twilio d'un tenant (après mise à jour config)
 * @param {string} tenantId
 */
export function invalidateTwilioCache(tenantId) {
  tenantTwilioCache.delete(tenantId);
}
