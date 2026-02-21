/**
 * Twilio Provisioning Service
 *
 * Gère l'attribution automatique des numéros de téléphone aux tenants
 * et la configuration des webhooks.
 */

import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Client Twilio
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// URL de base pour les webhooks
// En dev: http://localhost:5000 ou ngrok
// En prod: https://api.votre-domaine.com
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || 'http://localhost:5000';

console.log(`[PROVISIONING] Webhook URL: ${WEBHOOK_BASE_URL}`);

/**
 * Recherche des numéros de téléphone disponibles
 * @param {string} country - Code pays (FR, US, etc.)
 * @param {number} limit - Nombre de résultats
 */
export async function searchAvailableNumbers(country = 'FR', limit = 5) {
  try {
    const numbers = await twilioClient.availablePhoneNumbers(country)
      .local
      .list({ limit });

    return numbers.map(n => ({
      phoneNumber: n.phoneNumber,
      locality: n.locality,
      region: n.region,
      capabilities: {
        voice: n.capabilities.voice,
        sms: n.capabilities.sms,
        mms: n.capabilities.mms,
      },
    }));
  } catch (error) {
    console.error('[PROVISIONING] Erreur recherche numéros:', error.message);
    throw error;
  }
}

/**
 * Achète un numéro de téléphone pour un tenant
 * @param {string} tenantId - ID du tenant
 * @param {string} phoneNumber - Numéro à acheter (format E.164)
 * @param {string} type - Type de service (voice, whatsapp, both)
 */
export async function purchasePhoneNumber(tenantId, phoneNumber, type = 'voice') {
  console.log(`[PROVISIONING] Achat numéro ${phoneNumber} pour tenant ${tenantId}`);

  try {
    // 1. Acheter le numéro via Twilio
    const purchasedNumber = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber: phoneNumber,
      friendlyName: `NEXUS-${tenantId}`,
      voiceUrl: `${WEBHOOK_BASE_URL}/api/voice/incoming?tenant=${tenantId}`,
      voiceMethod: 'POST',
      smsUrl: `${WEBHOOK_BASE_URL}/api/sms/incoming?tenant=${tenantId}`,
      smsMethod: 'POST',
    });

    console.log(`[PROVISIONING] ✅ Numéro acheté: ${purchasedNumber.sid}`);

    // 2. Enregistrer dans la base de données
    const { error: dbError } = await supabase
      .from('tenant_phone_numbers')
      .upsert({
        tenant_id: tenantId,
        phone_number: phoneNumber,
        twilio_sid: purchasedNumber.sid,
        type: type,
        status: 'active',
        created_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('[PROVISIONING] Erreur DB:', dbError);
      // Le numéro est acheté, on log l'erreur mais on continue
    }

    // 3. Mettre à jour le tenant
    await supabase
      .from('tenants')
      .update({
        phone_number: phoneNumber,
        phone_twilio_sid: purchasedNumber.sid,
        modules_actifs: supabase.rpc('jsonb_set_key', {
          target: 'modules_actifs',
          key: 'telephone',
          value: true,
        }),
      })
      .eq('id', tenantId);

    return {
      success: true,
      phoneNumber: phoneNumber,
      sid: purchasedNumber.sid,
      webhooks: {
        voice: purchasedNumber.voiceUrl,
        sms: purchasedNumber.smsUrl,
      },
    };
  } catch (error) {
    console.error('[PROVISIONING] Erreur achat:', error.message);
    throw error;
  }
}

/**
 * Provisionne automatiquement un numéro pour un tenant
 * Cherche le meilleur numéro disponible et l'achète
 * Note: FR nécessite une adresse vérifiée, US non
 */
export async function autoProvisionNumber(tenantId, country = 'US') {
  // Force US pour éviter les problèmes d'adresse FR (ARCEP)
  // TODO: Permettre FR quand l'adresse est configurée
  const actualCountry = country === 'FR' ? 'US' : country;
  console.log(`[PROVISIONING] Auto-provisioning pour ${tenantId} (${actualCountry})`);

  // 1. Vérifier si le tenant a déjà un numéro
  const { data: tenant } = await supabase
    .from('tenants')
    .select('phone_number, phone_twilio_sid')
    .eq('id', tenantId)
    .single();

  if (tenant?.phone_number) {
    console.log(`[PROVISIONING] Tenant ${tenantId} a déjà un numéro: ${tenant.phone_number}`);
    return {
      success: true,
      phoneNumber: tenant.phone_number,
      alreadyExists: true,
    };
  }

  // 2. Chercher un numéro disponible
  const availableNumbers = await searchAvailableNumbers(actualCountry, 1);

  if (availableNumbers.length === 0) {
    throw new Error(`Aucun numéro disponible pour ${country}`);
  }

  // 3. Acheter le premier numéro disponible
  const selectedNumber = availableNumbers[0];
  return await purchasePhoneNumber(tenantId, selectedNumber.phoneNumber, 'voice');
}

/**
 * Libère un numéro de téléphone (annulation module)
 */
export async function releasePhoneNumber(tenantId) {
  console.log(`[PROVISIONING] Libération numéro pour ${tenantId}`);

  try {
    // 1. Récupérer le numéro du tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('phone_number, phone_twilio_sid')
      .eq('id', tenantId)
      .single();

    if (!tenant?.phone_twilio_sid) {
      console.log(`[PROVISIONING] Pas de numéro à libérer pour ${tenantId}`);
      return { success: true, message: 'Pas de numéro à libérer' };
    }

    // 2. Supprimer le numéro Twilio
    await twilioClient.incomingPhoneNumbers(tenant.phone_twilio_sid).remove();

    // 3. Mettre à jour la DB
    await supabase
      .from('tenants')
      .update({
        phone_number: null,
        phone_twilio_sid: null,
      })
      .eq('id', tenantId);

    await supabase
      .from('tenant_phone_numbers')
      .update({ status: 'released', released_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('phone_number', tenant.phone_number);

    console.log(`[PROVISIONING] ✅ Numéro libéré: ${tenant.phone_number}`);

    return { success: true, phoneNumber: tenant.phone_number };
  } catch (error) {
    console.error('[PROVISIONING] Erreur libération:', error.message);
    throw error;
  }
}

/**
 * Configure WhatsApp pour un tenant (via Twilio)
 * Note: WhatsApp Business API nécessite une approbation Meta
 */
export async function configureWhatsApp(tenantId, phoneNumber) {
  console.log(`[PROVISIONING] Config WhatsApp pour ${tenantId}`);

  // Pour WhatsApp, on utilise le numéro Twilio sandbox en dev
  // En production, il faut un numéro WhatsApp Business approuvé

  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

  // Mettre à jour le tenant
  await supabase
    .from('tenants')
    .update({
      whatsapp_number: whatsappNumber,
    })
    .eq('id', tenantId);

  return {
    success: true,
    whatsappNumber: whatsappNumber,
    note: 'En dev, utilise le sandbox Twilio. En prod, numéro dédié requis.',
  };
}

/**
 * Récupère les infos de provisioning d'un tenant
 */
export async function getProvisioningStatus(tenantId) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('phone_number, phone_twilio_sid, whatsapp_number, modules_actifs')
    .eq('id', tenantId)
    .single();

  if (!tenant) {
    return { error: 'Tenant non trouvé' };
  }

  return {
    tenantId,
    phone: {
      number: tenant.phone_number,
      configured: !!tenant.phone_number,
      active: tenant.modules_actifs?.telephone === true,
    },
    whatsapp: {
      number: tenant.whatsapp_number,
      configured: !!tenant.whatsapp_number,
      active: tenant.modules_actifs?.whatsapp === true,
    },
  };
}

/**
 * Liste tous les numéros actifs du compte Twilio
 */
export async function listActiveNumbers() {
  const numbers = await twilioClient.incomingPhoneNumbers.list();

  return numbers.map(n => ({
    sid: n.sid,
    phoneNumber: n.phoneNumber,
    friendlyName: n.friendlyName,
    voiceUrl: n.voiceUrl,
    smsUrl: n.smsUrl,
    dateCreated: n.dateCreated,
  }));
}

/**
 * Récupère le solde Twilio
 */
export async function getTwilioBalance() {
  const balance = await twilioClient.balance.fetch();
  return {
    balance: parseFloat(balance.balance),
    currency: balance.currency,
  };
}

/**
 * Enregistre un numéro existant (déjà acheté) pour un tenant
 * Utilisé pour mapper des numéros Twilio existants sans les racheter
 * @param {string} tenantId - ID du tenant
 * @param {string} phoneNumber - Numéro en format E.164 (+33...)
 * @param {string} type - Type de service (voice, whatsapp, both)
 */
export async function registerExistingNumber(tenantId, phoneNumber, type = 'whatsapp') {
  console.log(`[PROVISIONING] Enregistrement manuel: ${phoneNumber} → ${tenantId}`);

  // Normaliser le numéro (enlever espaces, etc.)
  let normalizedNumber = phoneNumber.replace(/[\s\-\(\)\.]/g, '');

  // Convertir format français (09...) en E.164 (+33...)
  if (normalizedNumber.startsWith('0') && normalizedNumber.length === 10) {
    normalizedNumber = '+33' + normalizedNumber.substring(1);
  }
  // S'assurer qu'il commence par +
  if (!normalizedNumber.startsWith('+')) {
    normalizedNumber = '+' + normalizedNumber;
  }

  try {
    // 1. Vérifier que le tenant existe
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, slug')
      .or(`id.eq.${tenantId},slug.eq.${tenantId}`)
      .single();

    if (tenantError || !tenant) {
      throw new Error(`Tenant ${tenantId} non trouvé`);
    }

    const actualTenantId = tenant.slug || tenant.id;

    // 2. Insérer/mettre à jour dans tenant_phone_numbers
    const { error: dbError } = await supabase
      .from('tenant_phone_numbers')
      .upsert({
        tenant_id: actualTenantId,
        phone_number: normalizedNumber,
        type: type,
        status: 'active',
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'phone_number'
      });

    if (dbError) {
      console.error('[PROVISIONING] Erreur DB:', dbError);
      throw dbError;
    }

    // 3. Mettre à jour le tenant si c'est le numéro principal
    if (type === 'whatsapp' || type === 'both') {
      await supabase
        .from('tenants')
        .update({ whatsapp_number: normalizedNumber })
        .eq('slug', actualTenantId);
    }
    if (type === 'voice' || type === 'both') {
      await supabase
        .from('tenants')
        .update({ phone_number: normalizedNumber })
        .eq('slug', actualTenantId);
    }

    console.log(`[PROVISIONING] ✅ Numéro enregistré: ${normalizedNumber} → ${actualTenantId}`);

    return {
      success: true,
      tenantId: actualTenantId,
      phoneNumber: normalizedNumber,
      type: type,
    };
  } catch (error) {
    console.error('[PROVISIONING] Erreur enregistrement:', error.message);
    throw error;
  }
}

export default {
  searchAvailableNumbers,
  purchasePhoneNumber,
  autoProvisionNumber,
  releasePhoneNumber,
  configureWhatsApp,
  getProvisioningStatus,
  listActiveNumbers,
  getTwilioBalance,
  registerExistingNumber,
};
