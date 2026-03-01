/**
 * Twilio Provisioning Service
 *
 * Gère l'attribution automatique des numéros de téléphone aux tenants
 * et la configuration des webhooks.
 */

import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';
import logger from '../config/logger.js';

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

// Regulatory Bundle SID pour numéros FR (ARCEP compliance)
// À créer sur: Twilio Console → Phone Numbers → Regulatory Compliance → Bundles
const TWILIO_FR_BUNDLE_SID = process.env.TWILIO_FR_BUNDLE_SID || null;

// Address SID pour numéros FR
// À créer sur: Twilio Console → Phone Numbers → Addresses
const TWILIO_FR_ADDRESS_SID = process.env.TWILIO_FR_ADDRESS_SID || null;

logger.info(`Webhook URL: ${WEBHOOK_BASE_URL}`, { service: 'provisioning' });
logger.info(`FR Bundle: ${TWILIO_FR_BUNDLE_SID ? 'Configured' : 'Not configured'}`, { service: 'provisioning' });

/**
 * Recherche des numéros de téléphone disponibles
 * @param {string} country - Code pays (FR, US, etc.)
 * @param {number} limit - Nombre de résultats
 * @param {string} type - Type de numéro (local, mobile, tollFree)
 */
export async function searchAvailableNumbers(country = 'FR', limit = 5, type = 'local') {
  try {
    // Pour la France, vérifier que le bundle ARCEP est configuré
    if (country === 'FR' && !TWILIO_FR_BUNDLE_SID) {
      logger.warn('Bundle ARCEP not configured for FR numbers', { service: 'provisioning' });
      return {
        error: 'FR_BUNDLE_REQUIRED',
        message: 'Les numéros français nécessitent un Regulatory Bundle ARCEP. Configurez TWILIO_FR_BUNDLE_SID.',
        numbers: []
      };
    }

    let numbers;

    // En France, on peut chercher des numéros mobiles (+33 6/7) ou fixes (+33 1-5, 9)
    if (type === 'mobile') {
      numbers = await twilioClient.availablePhoneNumbers(country)
        .mobile
        .list({ limit });
    } else {
      numbers = await twilioClient.availablePhoneNumbers(country)
        .local
        .list({ limit });
    }

    return {
      country,
      type,
      bundleRequired: country === 'FR',
      bundleConfigured: country === 'FR' ? !!TWILIO_FR_BUNDLE_SID : null,
      numbers: numbers.map(n => ({
        phoneNumber: n.phoneNumber,
        friendlyName: n.friendlyName,
        locality: n.locality,
        region: n.region,
        isoCountry: n.isoCountry,
        capabilities: {
          voice: n.capabilities.voice,
          sms: n.capabilities.sms,
          mms: n.capabilities.mms,
        },
      }))
    };
  } catch (error) {
    logger.error('Error searching phone numbers', { service: 'provisioning', error: error.message });
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
  logger.info(`Purchasing phone number ${phoneNumber} for tenant ${tenantId}`, { service: 'provisioning', tenantId, phoneNumber });

  // Détecter si c'est un numéro français
  const isFrenchNumber = phoneNumber.startsWith('+33');

  // Pour les numéros FR, vérifier que le bundle ARCEP est configuré
  if (isFrenchNumber && !TWILIO_FR_BUNDLE_SID) {
    throw new Error(
      'Les numéros français nécessitent un Regulatory Bundle ARCEP. ' +
      'Configurez TWILIO_FR_BUNDLE_SID et TWILIO_FR_ADDRESS_SID dans votre .env'
    );
  }

  try {
    // 1. Préparer les options d'achat
    const purchaseOptions = {
      phoneNumber: phoneNumber,
      friendlyName: `NEXUS-${tenantId}`,
      voiceUrl: `${WEBHOOK_BASE_URL}/api/voice/incoming?tenant=${tenantId}`,
      voiceMethod: 'POST',
      smsUrl: `${WEBHOOK_BASE_URL}/api/sms/incoming?tenant=${tenantId}`,
      smsMethod: 'POST',
    };

    // Pour les numéros FR, ajouter le bundle et l'adresse ARCEP
    if (isFrenchNumber) {
      purchaseOptions.bundleSid = TWILIO_FR_BUNDLE_SID;
      if (TWILIO_FR_ADDRESS_SID) {
        purchaseOptions.addressSid = TWILIO_FR_ADDRESS_SID;
      }
      logger.info(`FR number - ARCEP Bundle: ${TWILIO_FR_BUNDLE_SID}`, { service: 'provisioning', bundleSid: TWILIO_FR_BUNDLE_SID });
    }

    // 2. Acheter le numéro via Twilio
    const purchasedNumber = await twilioClient.incomingPhoneNumbers.create(purchaseOptions);

    logger.info(`Phone number purchased: ${purchasedNumber.sid}`, { service: 'provisioning', sid: purchasedNumber.sid });

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
      logger.error('Database error while saving phone number', { service: 'provisioning', error: dbError });
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
 *
 * Pour FR: Nécessite TWILIO_FR_BUNDLE_SID configuré (ARCEP)
 * Pour US: Pas de restriction
 */
export async function autoProvisionNumber(tenantId, country = 'FR') {
  // Pour FR, vérifier que le bundle ARCEP est configuré
  let actualCountry = country;

  if (country === 'FR' && !TWILIO_FR_BUNDLE_SID) {
    console.warn(`[PROVISIONING] ⚠️ Bundle ARCEP non configuré, fallback vers US`);
    actualCountry = 'US';
  }

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
  const searchResult = await searchAvailableNumbers(actualCountry, 1);

  // Vérifier si erreur (ex: bundle non configuré)
  if (searchResult.error) {
    throw new Error(searchResult.message);
  }

  if (!searchResult.numbers || searchResult.numbers.length === 0) {
    throw new Error(`Aucun numéro disponible pour ${actualCountry}`);
  }

  // 3. Acheter le premier numéro disponible
  const selectedNumber = searchResult.numbers[0];
  console.log(`[PROVISIONING] Numéro sélectionné: ${selectedNumber.phoneNumber} (${selectedNumber.locality || selectedNumber.region})`);

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

    // 2. Supprimer l'ancien mapping si existe, puis insérer
    await supabase
      .from('tenant_phone_numbers')
      .delete()
      .eq('phone_number', normalizedNumber);

    const { error: dbError } = await supabase
      .from('tenant_phone_numbers')
      .insert({
        tenant_id: actualTenantId,
        phone_number: normalizedNumber,
        type: type,
        status: 'active',
        created_at: new Date().toISOString(),
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

/**
 * Vérifie le status de conformité ARCEP pour les numéros français
 * Retourne les infos sur le bundle et l'adresse configurés
 */
export async function getARCEPComplianceStatus() {
  const status = {
    configured: false,
    bundleSid: TWILIO_FR_BUNDLE_SID,
    addressSid: TWILIO_FR_ADDRESS_SID,
    bundle: null,
    address: null,
    canPurchaseFR: false,
    requirements: []
  };

  if (!TWILIO_FR_BUNDLE_SID) {
    status.requirements.push({
      type: 'bundle',
      message: 'Créer un Regulatory Bundle sur Twilio Console',
      link: 'https://console.twilio.com/us1/develop/phone-numbers/regulatory-compliance/bundles'
    });
  }

  if (!TWILIO_FR_ADDRESS_SID) {
    status.requirements.push({
      type: 'address',
      message: 'Créer une adresse vérifiée sur Twilio Console',
      link: 'https://console.twilio.com/us1/develop/phone-numbers/manage/addresses'
    });
  }

  // Si bundle configuré, récupérer son statut
  if (TWILIO_FR_BUNDLE_SID) {
    try {
      const bundle = await twilioClient.numbers.v2
        .regulatoryCompliance
        .bundles(TWILIO_FR_BUNDLE_SID)
        .fetch();

      status.bundle = {
        sid: bundle.sid,
        status: bundle.status, // draft, pending-review, in-review, twilio-rejected, twilio-approved
        friendlyName: bundle.friendlyName,
        regulationType: bundle.regulationType,
        validUntil: bundle.validUntil,
        dateCreated: bundle.dateCreated
      };

      // Le bundle doit être approuvé pour acheter des numéros
      status.canPurchaseFR = bundle.status === 'twilio-approved';

      if (bundle.status !== 'twilio-approved') {
        status.requirements.push({
          type: 'bundle_approval',
          message: `Bundle en attente: ${bundle.status}. Statut requis: twilio-approved`,
          currentStatus: bundle.status
        });
      }
    } catch (error) {
      console.error('[PROVISIONING] Erreur fetch bundle:', error.message);
      status.requirements.push({
        type: 'bundle_error',
        message: `Erreur bundle: ${error.message}`
      });
    }
  }

  // Si adresse configurée, récupérer son statut
  if (TWILIO_FR_ADDRESS_SID) {
    try {
      const address = await twilioClient.addresses(TWILIO_FR_ADDRESS_SID).fetch();

      status.address = {
        sid: address.sid,
        friendlyName: address.friendlyName,
        customerName: address.customerName,
        street: address.street,
        city: address.city,
        postalCode: address.postalCode,
        isoCountry: address.isoCountry,
        validated: address.validated,
        verified: address.verified
      };
    } catch (error) {
      console.error('[PROVISIONING] Erreur fetch address:', error.message);
    }
  }

  status.configured = status.canPurchaseFR;

  return status;
}

/**
 * Liste les Regulatory Bundles disponibles sur le compte Twilio
 * Utile pour trouver le SID du bundle à configurer
 */
export async function listRegulatoryBundles() {
  try {
    const bundles = await twilioClient.numbers.v2
      .regulatoryCompliance
      .bundles
      .list({ limit: 20 });

    return bundles.map(b => ({
      sid: b.sid,
      friendlyName: b.friendlyName,
      status: b.status,
      regulationType: b.regulationType,
      isoCountry: b.isoCountry,
      dateCreated: b.dateCreated,
      validUntil: b.validUntil
    }));
  } catch (error) {
    console.error('[PROVISIONING] Erreur list bundles:', error.message);
    throw error;
  }
}

/**
 * Liste les adresses disponibles sur le compte Twilio
 * Utile pour trouver le SID de l'adresse à configurer
 */
export async function listAddresses() {
  try {
    const addresses = await twilioClient.addresses.list({ limit: 20 });

    return addresses.map(a => ({
      sid: a.sid,
      friendlyName: a.friendlyName,
      customerName: a.customerName,
      street: a.street,
      city: a.city,
      postalCode: a.postalCode,
      isoCountry: a.isoCountry,
      validated: a.validated,
      verified: a.verified
    }));
  } catch (error) {
    console.error('[PROVISIONING] Erreur list addresses:', error.message);
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
  getARCEPComplianceStatus,
  listRegulatoryBundles,
  listAddresses,
};
