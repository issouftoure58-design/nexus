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

// WhatsApp Business Account (WABA) — Business Unit SID approuvé par Meta
const TWILIO_WABA_BU_SID = process.env.TWILIO_WABA_BU_SID || null;

// Messaging Service SID partagé (créé une fois, réutilisé pour tous les tenants)
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID || null;

logger.info(`Webhook URL: ${WEBHOOK_BASE_URL}`, { service: 'provisioning' });
logger.info(`FR Bundle: ${TWILIO_FR_BUNDLE_SID ? 'Configured' : 'Not configured'}`, { service: 'provisioning' });
logger.info(`WABA: ${TWILIO_WABA_BU_SID ? 'Configured' : 'Not configured (sandbox mode)'}`, { service: 'provisioning' });

/**
 * Recherche des numéros de téléphone disponibles
 * @param {string} country - Code pays (FR, US, etc.)
 * @param {number} limit - Nombre de résultats
 * @param {string} type - Type de numéro (local, mobile, tollFree)
 * @param {object} [searchOptions] - Options Twilio supplémentaires (contains, areaCode, etc.)
 */
export async function searchAvailableNumbers(country = 'FR', limit = 5, type = 'local', searchOptions = {}) {
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
    const listParams = { limit, ...searchOptions };

    // En France: local (01-05, 09), mobile (06/07), tollFree (08)
    if (type === 'mobile') {
      numbers = await twilioClient.availablePhoneNumbers(country)
        .mobile
        .list(listParams);
    } else if (type === 'tollFree') {
      numbers = await twilioClient.availablePhoneNumbers(country)
        .tollFree
        .list(listParams);
    } else {
      numbers = await twilioClient.availablePhoneNumbers(country)
        .local
        .list(listParams);
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
    };

    // N'ajouter smsUrl que pour les numéros non voice-only (FR 09 = voice-only)
    // Les numéros US et FR mobile supportent SMS
    const isFR09 = phoneNumber.startsWith('+339');
    if (!isFR09) {
      purchaseOptions.smsUrl = `${WEBHOOK_BASE_URL}/api/sms/incoming?tenant=${tenantId}`;
      purchaseOptions.smsMethod = 'POST';
    }

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

    // 3. Mettre à jour le tenant (phone + twilio_sid)
    await supabase
      .from('tenants')
      .update({
        phone_number: phoneNumber,
        phone_twilio_sid: purchasedNumber.sid,
      })
      .eq('id', tenantId);

    // 4. Activer le module telephone dans modules_actifs (read-modify-write)
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('modules_actifs')
      .eq('id', tenantId)
      .single();

    const modulesActifs = tenantData?.modules_actifs || {};
    modulesActifs.telephone = true;

    await supabase
      .from('tenants')
      .update({ modules_actifs: modulesActifs })
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
 *   Essaie plusieurs types en séquence car le bundle ARCEP peut être
 *   spécifique à un type (national 09, local 01-05, mobile 06/07).
 *   En cas de "regulation type mismatch", passe au type suivant.
 * Pour US: Pas de restriction
 */
export async function autoProvisionNumber(tenantId, country = 'FR') {
  // Pour FR, vérifier que le bundle ARCEP est configuré
  let actualCountry = country;

  if (country === 'FR' && !TWILIO_FR_BUNDLE_SID) {
    console.warn(`[PROVISIONING] Bundle ARCEP non configuré, fallback vers US`);
    actualCountry = 'US';
  }

  logger.info(`Auto-provisioning pour ${tenantId} (${actualCountry})`, { service: 'provisioning', tenantId });

  // 1. Vérifier si le tenant a déjà un numéro
  const { data: tenant } = await supabase
    .from('tenants')
    .select('phone_number, phone_twilio_sid')
    .eq('id', tenantId)
    .single();

  if (tenant?.phone_number) {
    logger.info(`Tenant a déjà un numéro: ${tenant.phone_number}`, { service: 'provisioning', tenantId });
    return {
      success: true,
      phoneNumber: tenant.phone_number,
      alreadyExists: true,
    };
  }

  // 2. Stratégie multi-type pour FR
  // Le bundle ARCEP peut couvrir un type spécifique (national/local/mobile).
  // On essaie chaque type en séquence, et si le bundle ne match pas on passe au suivant.
  const typesToTry = actualCountry === 'FR'
    ? [
        // National (09xx) — type le plus courant pour les bundles ARCEP business
        { type: 'local', label: 'national (09)', searchOptions: { contains: '+339' } },
        // Local géographique (01-05)
        { type: 'local', label: 'local', searchOptions: {} },
        // Mobile (06/07) — souvent besoin d'un bundle mobile spécifique
        { type: 'mobile', label: 'mobile', searchOptions: {} },
      ]
    : [{ type: 'local', label: 'local', searchOptions: {} }];

  let lastError = null;

  for (const { type, label, searchOptions } of typesToTry) {
    logger.info(`Recherche numéro ${label} (${actualCountry})...`, { service: 'provisioning', tenantId });

    const searchResult = await searchAvailableNumbers(actualCountry, 1, type, searchOptions);

    // Skip si erreur de config ou pas de numéros
    if (searchResult.error) {
      logger.warn(`Recherche ${label} échouée: ${searchResult.message}`, { service: 'provisioning', tenantId });
      continue;
    }

    if (!searchResult.numbers || searchResult.numbers.length === 0) {
      logger.warn(`Aucun numéro ${label} disponible`, { service: 'provisioning', tenantId });
      continue;
    }

    const selectedNumber = searchResult.numbers[0];
    logger.info(`Tentative achat ${label}: ${selectedNumber.phoneNumber}`, { service: 'provisioning', tenantId });

    try {
      return await purchasePhoneNumber(tenantId, selectedNumber.phoneNumber, 'voice');
    } catch (purchaseError) {
      // Si le bundle ne match pas le type de numéro, essayer le type suivant
      if (purchaseError.message?.includes('regulation type') || purchaseError.code === 21422) {
        logger.warn(`Bundle mismatch pour ${label}, essai du type suivant...`, {
          service: 'provisioning', tenantId, error: purchaseError.message,
        });
        lastError = purchaseError;
        continue;
      }
      // Autre erreur → remonter immédiatement
      throw purchaseError;
    }
  }

  // Tous les types ont échoué
  throw lastError || new Error(`Aucun numéro disponible pour ${actualCountry} compatible avec le bundle ARCEP`);
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
 *
 * WhatsApp nécessite un numéro SMS-capable. Les numéros FR 09 (voice-only) ne marchent pas.
 * Stratégie:
 *   1. Réutiliser un numéro existant SMS-capable du tenant
 *   2. Chercher un numéro FR SMS-capable (mobile 06/07 si bundle mobile dispo)
 *   3. Fallback: acheter un US pour WhatsApp (SMS-capable, pas de bundle nécessaire)
 *   4. Dernier recours: sandbox
 *
 * @param {string} tenantId - ID du tenant (OBLIGATOIRE)
 * @param {string} [phoneNumber] - Numéro spécifique à utiliser (optionnel)
 */
export async function configureWhatsApp(tenantId, phoneNumber = null) {
  if (!tenantId) throw new Error('tenant_id requis pour configureWhatsApp');

  logger.info(`Config WhatsApp pour ${tenantId}`, { service: 'provisioning', tenantId });

  // Fallback sandbox si WABA non configuré
  if (!TWILIO_WABA_BU_SID || !TWILIO_MESSAGING_SERVICE_SID) {
    logger.warn('WABA/MessagingService non configuré, fallback sandbox', { service: 'provisioning' });
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

    await supabase
      .from('tenants')
      .update({ whatsapp_number: whatsappNumber })
      .eq('id', tenantId);

    return {
      success: true,
      whatsappNumber,
      dedicated: false,
      note: 'Mode sandbox — configurez TWILIO_WABA_BU_SID et TWILIO_MESSAGING_SERVICE_SID pour les numéros dédiés.',
    };
  }

  // Mode dédié — trouver ou acheter un numéro SMS-capable
  let numberToUse = phoneNumber;
  let phoneNumberSid = null;

  if (!numberToUse) {
    // 1. Chercher un numéro existant SMS-capable pour ce tenant
    const { data: existingPhones } = await supabase
      .from('tenant_phone_numbers')
      .select('phone_number, twilio_sid, type')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .in('type', ['voice', 'both', 'whatsapp'])
      .limit(5);

    // Vérifier les capabilities de chaque numéro existant via Twilio
    for (const phone of (existingPhones || [])) {
      if (phone.twilio_sid) {
        try {
          const twilioNum = await twilioClient.incomingPhoneNumbers(phone.twilio_sid).fetch();
          if (twilioNum.capabilities?.sms) {
            numberToUse = phone.phone_number;
            phoneNumberSid = phone.twilio_sid;
            logger.info(`Réutilisation numéro SMS-capable existant: ${numberToUse}`, { service: 'provisioning', tenantId });
            break;
          }
        } catch (e) {
          logger.warn(`Cannot check capabilities for ${phone.phone_number}`, { service: 'provisioning', error: e.message });
        }
      }
    }

    // 2. Acheter un numéro SMS-capable
    if (!numberToUse) {
      logger.info('Aucun numéro SMS-capable existant, recherche...', { service: 'provisioning', tenantId });
      const provisionResult = await provisionSmsCapableNumber(tenantId);
      numberToUse = provisionResult.phoneNumber;
      phoneNumberSid = provisionResult.sid;
    }
  }

  // Récupérer le SID Twilio si pas encore connu
  if (!phoneNumberSid) {
    const { data: phoneRecord } = await supabase
      .from('tenant_phone_numbers')
      .select('twilio_sid')
      .eq('tenant_id', tenantId)
      .eq('phone_number', numberToUse)
      .eq('status', 'active')
      .single();

    phoneNumberSid = phoneRecord?.twilio_sid;
  }

  // Enregistrer dans le Messaging Service
  await registerWhatsAppSender(tenantId, numberToUse, phoneNumberSid);

  return {
    success: true,
    whatsappNumber: `whatsapp:${numberToUse}`,
    dedicated: true,
    phoneNumber: numberToUse,
  };
}

/**
 * Provisionne un numéro SMS-capable pour WhatsApp.
 * WhatsApp exige la capacité SMS — les numéros FR 09 (voice-only) ne fonctionnent pas.
 *
 * Stratégie:
 *   1. FR mobile (06/07) — si bundle mobile disponible
 *   2. FR local SMS-capable — si disponible
 *   3. US local — pas de bundle requis, SMS garanti
 *
 * @param {string} tenantId - ID du tenant (OBLIGATOIRE)
 * @returns {Promise<{phoneNumber: string, sid: string}>}
 */
async function provisionSmsCapableNumber(tenantId) {
  // Stratégie 1: FR mobile (si bundle configuré)
  if (TWILIO_FR_BUNDLE_SID) {
    try {
      const mobileFR = await searchAvailableNumbers('FR', 1, 'mobile', { smsEnabled: true });
      if (mobileFR.numbers?.length > 0) {
        logger.info(`FR mobile SMS-capable trouvé: ${mobileFR.numbers[0].phoneNumber}`, { service: 'provisioning', tenantId });
        return await purchasePhoneNumber(tenantId, mobileFR.numbers[0].phoneNumber, 'whatsapp');
      }
    } catch (e) {
      logger.warn(`FR mobile search failed: ${e.message}`, { service: 'provisioning', tenantId });
    }

    // Stratégie 2: FR local SMS-capable
    try {
      const localFR = await searchAvailableNumbers('FR', 5, 'local', { smsEnabled: true });
      if (localFR.numbers?.length > 0) {
        const smsCapable = localFR.numbers.find(n => n.capabilities?.sms);
        if (smsCapable) {
          logger.info(`FR local SMS-capable trouvé: ${smsCapable.phoneNumber}`, { service: 'provisioning', tenantId });
          return await purchasePhoneNumber(tenantId, smsCapable.phoneNumber, 'whatsapp');
        }
      }
    } catch (e) {
      logger.warn(`FR local SMS search failed: ${e.message}`, { service: 'provisioning', tenantId });
    }
  }

  // Stratégie 3: US local (SMS garanti, pas de bundle nécessaire)
  logger.info('Pas de numéro FR SMS-capable, fallback US pour WhatsApp', { service: 'provisioning', tenantId });
  const usNumbers = await searchAvailableNumbers('US', 1, 'local', { smsEnabled: true });

  if (!usNumbers.numbers?.length) {
    throw new Error('Aucun numéro SMS-capable disponible (FR ou US) pour WhatsApp');
  }

  const selectedUS = usNumbers.numbers[0];
  logger.info(`US SMS-capable sélectionné pour WhatsApp: ${selectedUS.phoneNumber}`, { service: 'provisioning', tenantId });
  return await purchasePhoneNumber(tenantId, selectedUS.phoneNumber, 'whatsapp');
}

/**
 * Enregistre un numéro dans le Messaging Service Twilio pour WhatsApp
 *
 * @param {string} tenantId - ID du tenant (OBLIGATOIRE)
 * @param {string} phoneNumber - Numéro E.164
 * @param {string} [phoneNumberSid] - SID Twilio du numéro (optionnel, lookup si absent)
 */
export async function registerWhatsAppSender(tenantId, phoneNumber, phoneNumberSid = null) {
  if (!tenantId) throw new Error('tenant_id requis pour registerWhatsAppSender');
  if (!TWILIO_MESSAGING_SERVICE_SID) throw new Error('TWILIO_MESSAGING_SERVICE_SID non configuré');

  logger.info(`Enregistrement WhatsApp sender: ${phoneNumber}`, { service: 'provisioning', tenantId });

  try {
    // Mettre à jour le statut en 'registering'
    await supabase
      .from('tenant_phone_numbers')
      .update({ whatsapp_status: 'registering' })
      .eq('tenant_id', tenantId)
      .eq('phone_number', phoneNumber);

    // Ajouter le numéro au Messaging Service
    if (phoneNumberSid) {
      try {
        await twilioClient.messaging.v1
          .services(TWILIO_MESSAGING_SERVICE_SID)
          .phoneNumbers.create({ phoneNumberSid });
      } catch (msError) {
        // Ignorer si le numéro est déjà dans le Messaging Service
        if (msError.code === 21710 || msError.message?.includes('already in the Messaging Service')) {
          logger.info('Numéro déjà dans le Messaging Service, on continue', { service: 'provisioning', tenantId });
        } else {
          throw msError;
        }
      }
    }

    // Mettre à jour tenant_phone_numbers
    await supabase
      .from('tenant_phone_numbers')
      .update({
        whatsapp_status: 'registered',
        messaging_service_sid: TWILIO_MESSAGING_SERVICE_SID,
        type: 'both', // voice + whatsapp
      })
      .eq('tenant_id', tenantId)
      .eq('phone_number', phoneNumber);

    // Mettre à jour tenants
    const whatsappFormatted = `whatsapp:${phoneNumber}`;
    await supabase
      .from('tenants')
      .update({
        whatsapp_number: whatsappFormatted,
        messaging_service_sid: TWILIO_MESSAGING_SERVICE_SID,
      })
      .eq('id', tenantId);

    logger.info(`WhatsApp sender enregistré: ${phoneNumber}`, { service: 'provisioning', tenantId });
  } catch (error) {
    // Marquer l'échec
    await supabase
      .from('tenant_phone_numbers')
      .update({ whatsapp_status: 'failed' })
      .eq('tenant_id', tenantId)
      .eq('phone_number', phoneNumber);

    logger.error('Erreur registerWhatsAppSender', { service: 'provisioning', tenantId, error: error.message });
    throw error;
  }
}

/**
 * Retire un numéro WhatsApp dédié pour un tenant
 * - Retire du Messaging Service
 * - Si voice encore actif → garde le numéro, type = 'voice'
 * - Sinon → libère complètement
 *
 * @param {string} tenantId - ID du tenant (OBLIGATOIRE)
 */
export async function releaseWhatsAppSender(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis pour releaseWhatsAppSender');

  logger.info(`Libération WhatsApp sender pour ${tenantId}`, { service: 'provisioning', tenantId });

  try {
    // Récupérer le numéro WhatsApp du tenant
    const { data: phoneRecord } = await supabase
      .from('tenant_phone_numbers')
      .select('phone_number, twilio_sid, type, messaging_service_sid')
      .eq('tenant_id', tenantId)
      .eq('whatsapp_status', 'registered')
      .single();

    if (!phoneRecord) {
      logger.info('Pas de numéro WhatsApp à libérer', { service: 'provisioning', tenantId });
      return { success: true, message: 'Pas de numéro WhatsApp actif' };
    }

    // Retirer du Messaging Service si possible
    if (phoneRecord.messaging_service_sid && phoneRecord.twilio_sid) {
      try {
        await twilioClient.messaging.v1
          .services(phoneRecord.messaging_service_sid)
          .phoneNumbers(phoneRecord.twilio_sid)
          .remove();
      } catch (err) {
        logger.warn('Erreur retrait du Messaging Service (non-bloquant)', {
          service: 'provisioning', tenantId, error: err.message,
        });
      }
    }

    // Déterminer si on garde le numéro (voice actif ?)
    const { data: tenant } = await supabase
      .from('tenants')
      .select('modules_actifs')
      .eq('id', tenantId)
      .single();

    const voiceActive = tenant?.modules_actifs?.telephone === true || tenant?.modules_actifs?.standard_ia === true;

    if (voiceActive) {
      // Garder le numéro pour voice uniquement
      await supabase
        .from('tenant_phone_numbers')
        .update({
          type: 'voice',
          whatsapp_status: 'none',
          messaging_service_sid: null,
        })
        .eq('tenant_id', tenantId)
        .eq('phone_number', phoneRecord.phone_number);
    } else {
      // Libérer complètement le numéro
      await releasePhoneNumber(tenantId);
    }

    // Nettoyer tenants
    await supabase
      .from('tenants')
      .update({
        whatsapp_number: null,
        messaging_service_sid: null,
      })
      .eq('id', tenantId);

    logger.info(`WhatsApp sender libéré: ${phoneRecord.phone_number}`, { service: 'provisioning', tenantId });
    return { success: true, phoneNumber: phoneRecord.phone_number };
  } catch (error) {
    logger.error('Erreur releaseWhatsAppSender', { service: 'provisioning', tenantId, error: error.message });
    throw error;
  }
}

/**
 * Retourne le numéro WhatsApp du tenant depuis la DB
 * Fallback vers la variable d'environnement globale
 *
 * @param {string} tenantId - ID du tenant (optionnel pour backward compat)
 * @returns {Promise<string>} Numéro WhatsApp au format 'whatsapp:+33...'
 */
export async function getWhatsAppNumber(tenantId) {
  if (tenantId) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('whatsapp_number')
      .eq('id', tenantId)
      .single();

    if (tenant?.whatsapp_number) {
      // S'assurer du format whatsapp:
      const num = tenant.whatsapp_number;
      return num.startsWith('whatsapp:') ? num : `whatsapp:${num}`;
    }
  }

  // Fallback global
  return process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
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
  registerWhatsAppSender,
  releaseWhatsAppSender,
  getWhatsAppNumber,
  getProvisioningStatus,
  listActiveNumbers,
  getTwilioBalance,
  registerExistingNumber,
  getARCEPComplianceStatus,
  listRegulatoryBundles,
  listAddresses,
};
