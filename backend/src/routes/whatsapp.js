/**
 * Routes WhatsApp - Webhook Twilio
 * Multi-tenant
 *
 * MIGRÉ VERS NEXUS CORE - Janvier 2026
 * Variable USE_NEXUS_WHATSAPP=true pour activer le nouveau handler
 */

import express from 'express';
import {
  handleIncomingMessageNexus,
  handlePaymentConfirmed
} from '../services/whatsappService.js';
import { transcribeFromUrl } from '../services/whisperService.js';
import usageTracking from '../services/usageTrackingService.js';
import { getTenantByPhone, getTenantConfig } from '../config/tenants/index.js';
import { validateTwilioSignature, validateTwilioSignatureLoose } from '../middleware/twilioValidation.js';
import { authenticateAdmin } from './adminAuth.js';
import logger from '../config/logger.js';

/**
 * Identifie le tenant par le numéro WhatsApp appelé
 * Utilise le système de cache multi-tenant unifié
 * 🔒 TENANT ISOLATION: Pas de fallback - rejette si tenant inconnu
 */
function getTenantByWhatsAppNumber(toNumber) {
  // Enlever le préfixe whatsapp: si présent
  const cleanNumber = toNumber.replace('whatsapp:', '');

  console.log(`[WhatsApp ROUTING] Looking up tenant for: ${cleanNumber}`);

  const { tenantId, config } = getTenantByPhone(cleanNumber);

  if (tenantId && config) {
    console.log(`[WhatsApp ROUTING] ✅ ${cleanNumber} → Tenant: ${tenantId}`);
    return { tenantId, config };
  }

  // 🔒 TENANT ISOLATION: Pas de fallback - rejeter si numéro inconnu
  console.error(`[WhatsApp ROUTING] ❌ TENANT_NOT_FOUND: No tenant configured for number ${cleanNumber}`);
  console.error(`[WhatsApp ROUTING] 💡 Fix: POST /api/provisioning/phone/register with tenantId and phoneNumber`);
  return { tenantId: null, config: null, error: 'TENANT_NOT_FOUND' };
}

const router = express.Router();

/**
 * Webhook pour recevoir les messages WhatsApp entrants (Twilio)
 * POST /api/whatsapp/webhook
 * ⚠️ SECURED: Validates Twilio signature to prevent spoofing
 *
 * Twilio envoie les messages au format application/x-www-form-urlencoded
 */
router.post('/webhook', validateTwilioSignature, async (req, res) => {
  try {
    console.log('[WhatsApp Webhook] Requête reçue:', {
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'x-twilio-signature': req.headers['x-twilio-signature'] ? 'présent' : 'absent',
      },
    });

    // Extraire les données du message Twilio
    const {
      From,           // whatsapp:+33612345678
      To,             // whatsapp:+14155238886 (numéro Twilio)
      Body,           // Contenu du message (vide si note vocale)
      ProfileName,    // Nom du profil WhatsApp
      MessageSid,     // ID unique du message
      NumMedia,       // Nombre de médias attachés
      MediaUrl0,      // URL du premier média (note vocale, image, etc.)
      MediaContentType0, // Type MIME du premier média (audio/ogg, image/jpeg, etc.)
    } = req.body;

    const numMedia = parseInt(NumMedia || '0', 10);
    const isVoiceNote = numMedia > 0 && MediaUrl0 && MediaContentType0?.startsWith('audio/');

    // Validation minimale (From requis, Body ou media requis)
    if (!From || (!Body && numMedia === 0)) {
      console.error('[WhatsApp Webhook] Données manquantes:', { From, Body, NumMedia });
      return res.status(400).send('<Response></Response>');
    }

    // Extraire le numéro de téléphone (enlever le préfixe whatsapp:)
    const clientPhone = From.replace('whatsapp:', '');

    // ── TENANT RESOLUTION (AVANT toute opération coûteuse) ──
    const { tenantId, config: tenantConfig, error: tenantError } = getTenantByWhatsAppNumber(To);

    if (!tenantId || tenantError) {
      console.error('[WhatsApp Webhook] TENANT_NOT_FOUND:', { toNumber: To, fromPhone: clientPhone, error: tenantError });
      res.type('text/xml');
      return res.send('<Response></Response>');
    }

    // ── QUOTA CHECK (AVANT transcription Whisper pour ne pas payer si quota épuisé) ──
    try {
      await usageTracking.enforceQuota(tenantId, 'whatsapp');
    } catch (quotaError) {
      console.log(`[WhatsApp] Quota dépassé pour ${tenantId}:`, quotaError.message);
      res.type('text/xml');
      return res.send('<Response></Response>');
    }

    // ── TRANSCRIPTION NOTES VOCALES (après quota check) ──
    let messageText = Body || '';
    if (isVoiceNote) {
      console.log(`[WhatsApp Webhook] Note vocale détectée (${MediaContentType0}), transcription Whisper...`);
      const transcription = await transcribeFromUrl(MediaUrl0, { phoneNumber: clientPhone });

      if (transcription.rateLimited) {
        // Rate limité — ignorer silencieusement (pas de coût)
        console.warn(`[WhatsApp Webhook] Rate limit notes vocales: ${clientPhone}`);
        res.type('text/xml');
        return res.send('<Response></Response>');
      }

      if (transcription.tooLarge) {
        // Audio trop long — répondre un message d'erreur
        console.warn(`[WhatsApp Webhook] Audio trop volumineux: ${clientPhone}`);
        messageText = '[Le client a envoyé une note vocale trop longue]';
      } else if (transcription.success && transcription.text) {
        messageText = transcription.text;
        console.log(`[WhatsApp Webhook] Transcription OK: "${messageText.substring(0, 100)}"`);
      } else {
        console.warn(`[WhatsApp Webhook] Transcription échouée: ${transcription.error}`);
        messageText = '[Note vocale non transcrite]';
      }
    }

    // Dernier check — si toujours pas de texte, abandonner
    if (!messageText.trim()) {
      res.type('text/xml');
      return res.send('<Response></Response>');
    }

    console.log('[WhatsApp Webhook] Message reçu:', {
      de: clientPhone,
      nom: ProfileName,
      tenant: tenantId,
      tenantName: tenantConfig?.name,
      message: messageText.substring(0, 100) + (messageText.length > 100 ? '...' : ''),
      messageId: MessageSid,
      isVoiceNote,
    });

    // ── TRAITEMENT IA ──
    const result = await handleIncomingMessageNexus(clientPhone, messageText, ProfileName, tenantId);

    // Tracker l'utilisation (coût différencié pour notes vocales)
    await usageTracking.trackWhatsAppMessage(tenantId, MessageSid, 'inbound');
    if (result.response) {
      await usageTracking.trackWhatsAppMessage(tenantId, `${MessageSid}-reply`, 'outbound');
    }

    console.log('[WhatsApp Webhook] Réponse:', {
      handler: 'nexusCore',
      tenant: tenantId,
      success: result.success,
      state: result.state || result.context?.etape,
      responseLength: result.response?.length,
    });

    // Répondre à Twilio avec TwiML (la réponse est envoyée par le service)
    // On renvoie une réponse vide car on utilise l'API REST pour répondre
    res.type('text/xml');
    res.send('<Response></Response>');

  } catch (error) {
    console.error('[WhatsApp Webhook] Erreur:', error);
    res.type('text/xml');
    res.status(500).send('<Response></Response>');
  }
});

/**
 * Webhook pour les notifications de statut (delivery reports)
 * POST /api/whatsapp/status
 * ⚠️ SECURED: Validates Twilio signature
 */
router.post('/status', validateTwilioSignatureLoose, (req, res) => {
  const { MessageSid, MessageStatus, To, ErrorCode, ErrorMessage } = req.body;

  console.log('[WhatsApp Status]', {
    messageId: MessageSid,
    status: MessageStatus,
    to: To,
    error: ErrorCode ? `${ErrorCode}: ${ErrorMessage}` : null,
  });

  res.status(200).send('OK');
});

/**
 * Webhook pour confirmation de paiement (appelé par Stripe/PayPal)
 * POST /api/whatsapp/payment-confirmed
 * ⚠️ SECURED: Requires admin authentication + tenant isolation
 */
router.post('/payment-confirmed', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

    const { rdv_id } = req.body;

    if (!rdv_id) {
      return res.status(400).json({
        success: false,
        error: 'rdv_id requis',
      });
    }

    console.log('[WhatsApp] Confirmation de paiement pour RDV:', rdv_id, `(tenant: ${tenantId})`);

    // 🔒 Utiliser tenant_id depuis l'auth - JAMAIS depuis le body
    await handlePaymentConfirmed(rdv_id, tenantId);

    res.json({
      success: true,
      message: 'Notification de confirmation envoyée',
    });

  } catch (error) {
    console.error('[WhatsApp] Erreur confirmation paiement:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Endpoint de test pour simuler un message entrant
 * POST /api/whatsapp/test
 * ⚠️ SECURED: Requires admin authentication - tenant from auth
 *
 * Body: { phone: "+33612345678", message: "Bonjour", name: "Test" }
 */
router.post('/test', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

    const { phone, message, name } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        success: false,
        error: 'phone et message requis',
      });
    }

    console.log('[WhatsApp Test] Simulation message:', { phone, message, name, tenantId, handler: 'nexusCore' });

    const result = await handleIncomingMessageNexus(phone, message, name, tenantId);

    res.json({
      success: true,
      handler: 'nexusCore',
      ...result,
    });

  } catch (error) {
    console.error('[WhatsApp Test] Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Endpoint de santé du webhook
 * GET /api/whatsapp/health
 * ⚠️ SECURED: No sensitive info exposed
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'WhatsApp Webhook',
    timestamp: new Date().toISOString(),
    // ⚠️ SECURITY: Ne pas exposer les numéros ou configs
    configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
  });
});

/**
 * Endpoint de debug pour le routing téléphone
 * GET /api/whatsapp/debug/routing/:phoneNumber
 * ⚠️ SECURED: Requires admin authentication - can expose tenant info
 */
router.get('/debug/routing/:phoneNumber', authenticateAdmin, (req, res) => {
  const tenantId = req.admin?.tenant_id;
  if (!tenantId) {
    return res.status(403).json({ error: 'TENANT_REQUIRED' });
  }

  const { phoneNumber } = req.params;

  // Décoder le numéro (au cas où il est URL-encoded)
  const decodedNumber = decodeURIComponent(phoneNumber);

  console.log(`[WhatsApp DEBUG] Testing routing for: ${decodedNumber} (admin: ${tenantId})`);

  // Tester avec et sans préfixe whatsapp:
  const cleanNumber = decodedNumber.replace('whatsapp:', '');

  const result = getTenantByPhone(cleanNumber);

  // 🔒 Ne pas exposer les détails d'autres tenants
  const isSameTenant = result.tenantId === tenantId;

  res.json({
    input: decodedNumber,
    cleanNumber: cleanNumber,
    tenantFound: !!result.tenantId,
    isSameTenant: isSameTenant,
    message: result.tenantId
      ? (isSameTenant ? `This number belongs to your tenant` : 'Number belongs to another tenant')
      : 'No tenant found for this number'
  });
});

export default router;
