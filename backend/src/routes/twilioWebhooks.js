/**
 * Routes Twilio pour Halimah Voice AI
 * Conversation naturelle au téléphone avec Claude IA
 *
 * Numéro Twilio : +33 9 39 24 02 69
 *
 * 🔒 UTILISE NEXUS CORE UNIFIÉ - Source unique de vérité
 */

import express from 'express';
import twilio from 'twilio';
import {
  getVoiceResponseNexus,
  cleanupConversation as cleanupVoiceService,
  getConversationStats,
  trackConversation
} from '../services/voiceAIService.js';
import { validateTwilioSignature, validateTwilioSignatureLoose } from '../middleware/twilioValidation.js';
import { authenticateAdmin } from './adminAuth.js';
// 🔒 NEXUS CORE UNIFIÉ - Remplace halimahAI
import {
  processMessage,
  clearConversation,
  SALON_INFO
} from '../core/unified/nexusCore.js';
import voiceService from '../services/voiceService.js';
import { logCallStart, logCallEnd, logSMS, logSMSStatus } from '../modules/twilio/callLogService.js';
import usageTracking from '../services/usageTrackingService.js';
import { getTenantByPhone, getTenantConfig } from '../config/tenants/index.js';
// V2 - Multi-tenant dynamic messages
import { getBusinessInfoSync } from '../services/tenantBusinessService.js';

/**
 * V2 - Génère les messages dynamiques pour les appels vocaux
 */
function getVoiceMessages(tenantId = 'fatshairafro') {
  try {
    const info = getBusinessInfoSync(tenantId);
    const gerant = info.gerant || 'le responsable';
    const nom = info.nom || 'notre établissement';
    const tel = info.telephone || '09 39 24 02 69';

    return {
      transferMessage: `Je vous transfère vers ${gerant}. Un instant s'il vous plaît.`,
      unavailable: (clientName) =>
        `Désolé${clientName ? ` ${clientName}` : ''}, ${gerant} n'est pas disponible pour le moment. ` +
        `Vous pouvez laisser un message après le bip.`,
      goodbye: `Merci d'avoir appelé ${nom}. À bientôt !`,
      voicemail: `${gerant} n'est pas disponible pour le moment. Vous pouvez laisser un message vocal après le bip, ou envoyer un SMS au ${tel}.`,
      messageRecorded: `Votre message a bien été enregistré. ${gerant} vous rappellera dès que possible. Merci et à bientôt !`,
      unavailableAlt: `${gerant} n'est pas disponible actuellement. Souhaitez-vous laisser un message ou que je prenne votre rendez-vous ?`,
    };
  } catch (e) {
    return {
      transferMessage: "Je vous transfère vers Fatou. Un instant s'il vous plaît.",
      unavailable: (clientName) =>
        `Désolée ${clientName || ''}, Fatou n'est pas disponible pour le moment. ` +
        `Vous pouvez laisser un message après le bip.`,
      goodbye: "Merci d'avoir appelé Fat's Hair-Afro. À bientôt !",
      voicemail: "Fatou n'est pas disponible pour le moment. Vous pouvez laisser un message vocal après le bip, ou envoyer un SMS au 09 39 24 02 69.",
      messageRecorded: "Votre message a bien été enregistré. Fatou vous rappellera dès que possible. Merci et à bientôt !",
      unavailableAlt: "Fatou n'est pas disponible actuellement. Souhaitez-vous laisser un message ou que je prenne votre rendez-vous ?",
    };
  }
}

/**
 * Identifie le tenant par le numéro de téléphone appelé
 * Retourne l'ID et la config complète du tenant
 * 🔒 TENANT ISOLATION: Pas de fallback - rejette si tenant inconnu
 */
function getTenantByPhoneNumber(toNumber) {
  const { tenantId, config } = getTenantByPhone(toNumber);

  if (tenantId && config) {
    console.log(`[ROUTING] Numéro ${toNumber} → Tenant: ${tenantId}`);
    return { tenantId, config };
  }

  // 🔒 TENANT ISOLATION: Pas de fallback - rejeter si numéro inconnu
  console.error(`[ROUTING] ❌ TENANT_NOT_FOUND: No tenant configured for number ${toNumber}`);
  return { tenantId: null, config: null, error: 'TENANT_NOT_FOUND' };
}

const router = express.Router();

// Sessions de conversation pour la voix (CallSid -> état)
const voiceSessions = new Map();

/**
 * 🔒 Handler voix unifié - Utilise NEXUS CORE
 * @param {string} callSid - ID de l'appel Twilio
 * @param {string} message - Message transcrit
 * @param {boolean} isFirst - Premier message (accueil)
 * @param {object} tenantConfig - Configuration du tenant (optionnel)
 */
async function handleVoice(callSid, message, isFirst, tenantConfig = null) {
  const conversationId = `voice_${callSid}`;

  // Récupérer la config du tenant depuis la session si non fournie
  if (!tenantConfig) {
    const session = voiceSessions.get(callSid);
    tenantConfig = session?.tenantConfig;
  }

  // Nom du salon pour les réponses
  const salonName = tenantConfig?.name || SALON_INFO.nom;

  console.log(`\n[TWILIO NEXUS] ╔════════════════════════════════════════════════════════╗`);
  console.log(`[TWILIO NEXUS] ║           HANDLE VOICE - DEBUG COMPLET                 ║`);
  console.log(`[TWILIO NEXUS] ╚════════════════════════════════════════════════════════╝`);
  console.log(`[TWILIO NEXUS] 📞 CallSid: ${callSid}`);
  console.log(`[TWILIO NEXUS] 🔄 ConversationId: ${conversationId}`);
  console.log(`[TWILIO NEXUS] 🎯 isFirst: ${isFirst}`);
  console.log(`[TWILIO NEXUS] 💬 Message brut: "${message}"`);
  console.log(`[TWILIO NEXUS] 📏 Message length: ${message?.length || 0}`);
  console.log(`[TWILIO NEXUS] 🔑 ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✅ présente (' + process.env.ANTHROPIC_API_KEY.substring(0,10) + '...)' : '❌ MANQUANTE'}`);
  console.log(`[TWILIO NEXUS] 🗄️ SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅' : '❌'}`);
  console.log(`[TWILIO NEXUS] ⏰ Timestamp: ${new Date().toISOString()}`);

  // Récupérer le tenantId depuis la session
  // 🔒 TENANT ISOLATION: tenantId obligatoire
  const session = voiceSessions.get(callSid);
  const tenantId = session?.tenantId;
  if (!tenantId) {
    console.error(`[TWILIO NEXUS] ❌ TENANT_ID_REQUIRED: No tenant in session for call ${callSid}`);
    return {
      success: false,
      response: "Désolé, une erreur technique est survenue. Veuillez rappeler.",
      shouldEndCall: true
    };
  }

  try {
    // Premier message = accueil
    if (isFirst) {
      // Message d'accueil via NEXUS CORE
      console.log(`[VOICE] 🚀 Appel processMessage('bonjour', 'phone') pour tenant: ${tenantId}`);
      const result = await processMessage('bonjour', 'phone', {
        conversationId,
        phone: callSid,
        tenantId
      });
      console.log(`[VOICE] ✅ Réponse reçue: success=${result.success}, durée=${result.duration}ms`);

      return {
        response: result.response,
        shouldEndCall: false,
        shouldTransfer: false
      };
    }

    // Commandes spéciales
    const msgLower = message.toLowerCase().trim();

    // Demande de transfert vers le responsable
    // V2: Détection générique (transférer, passer, parler à quelqu'un)
    if (msgLower.includes('transférer') || msgLower.includes('transferer') ||
        msgLower.includes('passer') || msgLower.includes('parler à') ||
        msgLower.includes('parler a')) {
      const messages = getVoiceMessages(tenantId);
      return {
        response: messages.transferMessage,
        shouldEndCall: false,
        shouldTransfer: true
      };
    }

    // Fin de conversation
    if (msgLower === 'au revoir' || msgLower === 'merci au revoir' || msgLower === 'bonne journée') {
      // Nettoyer la session
      clearConversation(conversationId);
      voiceSessions.delete(callSid);

      return {
        response: `Merci d'avoir appelé ${salonName}. À très bientôt !`,
        shouldEndCall: true,
        shouldTransfer: false
      };
    }

    // Message normal - traiter avec NEXUS CORE
    console.log(`[VOICE] ═══════════════════════════════════════════════════`);
    console.log(`[VOICE] 🚀 APPEL processMessage()`);
    console.log(`[VOICE] → Tenant: ${tenantId}`);
    console.log(`[VOICE] → Message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
    console.log(`[VOICE] → ConversationId: ${conversationId}`);

    const result = await processMessage(message, 'phone', {
      conversationId,
      phone: callSid,
      tenantId
    });

    console.log(`[TWILIO NEXUS] ═══════════════════════════════════════════════════`);
    console.log(`[TWILIO NEXUS] ✅ RÉSULTAT processMessage()`);
    console.log(`[TWILIO NEXUS] → success: ${result.success}`);
    console.log(`[TWILIO NEXUS] → duration: ${result.duration}ms`);
    console.log(`[TWILIO NEXUS] → error: ${result.error || 'aucune'}`);
    console.log(`[TWILIO NEXUS] → response (100 premiers chars): "${result.response?.substring(0, 100) || 'VIDE'}"`);
    console.log(`[TWILIO NEXUS] → response complète: "${result.response}"`);
    console.log(`[TWILIO NEXUS] ═══════════════════════════════════════════════════`);

    // Détecter si la réservation est confirmée (fin de conversation naturelle)
    const isBookingConfirmed = result.response.toLowerCase().includes('confirmé') &&
                               result.response.toLowerCase().includes('rendez-vous');

    return {
      response: result.response,
      shouldEndCall: isBookingConfirmed,
      shouldTransfer: false
    };

  } catch (error) {
    console.error(`\n[TWILIO NEXUS] ╔════════════════════════════════════════════════════════╗`);
    console.error(`[TWILIO NEXUS] ║              ❌ ERREUR DANS handleVoice                 ║`);
    console.error(`[TWILIO NEXUS] ╚════════════════════════════════════════════════════════╝`);
    console.error('[TWILIO NEXUS] ❌ Type:', error.constructor?.name);
    console.error('[TWILIO NEXUS] ❌ Message:', error.message);
    console.error('[TWILIO NEXUS] ❌ CallSid:', callSid);
    console.error('[TWILIO NEXUS] ❌ Message reçu:', message);
    console.error('[TWILIO NEXUS] ❌ Stack complète:', error.stack);
    console.error('[TWILIO NEXUS] ════════════════════════════════════════════════════════\n');
    return {
      response: "Excusez-moi, j'ai un petit problème. Pouvez-vous répéter ?",
      shouldEndCall: false,
      shouldTransfer: false
    };
  }
}

/**
 * Nettoyer session quand l'appel se termine
 */
function cleanupVoiceSession(callSid) {
  const conversationId = `voice_${callSid}`;
  clearConversation(conversationId);
  voiceSessions.delete(callSid);
}
const VoiceResponse = twilio.twiml.VoiceResponse;
const MessagingResponse = twilio.twiml.MessagingResponse;

// Numéros de téléphone
const FATOU_PHONE = process.env.FATOU_PHONE_NUMBER || '+33782235020'; // Legacy - utiliser getTransferPhone()
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER || '+33939240269';

/**
 * V2 - Récupère le numéro de transfert pour un tenant
 */
function getTransferPhone(tenantId = 'fatshairafro') {
  try {
    const info = getBusinessInfoSync(tenantId);
    return info.telephone_transfert || info.telephone || FATOU_PHONE;
  } catch (e) {
    return FATOU_PHONE;
  }
}

// Configuration voix naturelle française (Amazon Polly via Twilio)
const VOICE_CONFIG = {
  voice: 'Polly.Lea', // Voix française féminine naturelle
  language: 'fr-FR'
};

// Hints pour améliorer la reconnaissance vocale Twilio
// Ces mots-clés aident l'IA de transcription à mieux comprendre le contexte
const SPEECH_HINTS = [
  // Services Fatou
  'locks', 'microlocks', 'crochet', 'twist', 'décapage', 'reprise', 'racines',
  'braids', 'tresses', 'nattes', 'collées', 'rajout', 'rajouts',
  'soin', 'soins', 'shampoing', 'brushing', 'hydratant',
  'teinture', 'décoloration', 'coloration',
  // Jours
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
  'demain', 'après-demain', 'semaine prochaine', 'prochain', 'prochaine',
  // Heures
  'matin', 'après-midi', 'midi', 'heure', 'heures',
  // Confirmations
  'oui', 'non', 'parfait', 'ok', "d'accord", 'bien sûr', 'absolument',
  // Réservation
  'rendez-vous', 'réservation', 'disponibilité', 'créneau',
  // Adresses
  'rue', 'avenue', 'boulevard', 'place', 'Franconville', 'Cergy', 'Paris'
].join(', ');

// Alternatives de voix disponibles :
// 'Polly.Lea' - Française, naturelle, féminine (recommandée)
// 'Polly.Celine' - Française, féminine, plus formelle
// 'Polly.Mathieu' - Français, masculin
// 'alice' - Voix standard Twilio (moins naturelle mais gratuite)

// ============================================================
// === HELPER : VOIX ELEVENLABS AVEC FALLBACK POLLY ===
// ============================================================

const BASE_URL = process.env.BASE_URL || 'https://nexus-backend-dev.onrender.com';

/**
 * Joue l'audio ElevenLabs ou fallback sur Polly
 * @param {object} parent - twiml ou gather element
 * @param {string} text - texte à prononcer
 */
async function sayWithElevenLabs(parent, text) {
  if (!voiceService.isConfigured()) {
    parent.say(VOICE_CONFIG, text);
    return;
  }

  try {
    const result = await voiceService.textToSpeech(text);
    if (!result.success) throw new Error(result.error || 'TTS failed');

    // Calculer le nom de fichier (même logique que le cache)
    const optimized = voiceService.optimizeText(text);
    const hash = voiceService.getTextHash(optimized, voiceService.DEFAULT_VOICE_ID);
    const filename = `${hash}.mp3`;
    const publicUrl = `${BASE_URL}/api/voice/audio/${filename}`;

    console.log(`[VOICE] ElevenLabs → ${publicUrl} (${result.fromCache ? 'cache' : 'API'})`);
    parent.play(publicUrl);
  } catch (error) {
    console.error('[VOICE] ElevenLabs failed, fallback Polly:', error.message);
    parent.say(VOICE_CONFIG, text);
  }
}

/**
 * Crée un gather avec audio interruptible (barge-in)
 * L'audio est joué À L'INTÉRIEUR du gather pour permettre l'interruption
 */
async function gatherWithBargeIn(twiml, text, options = {}) {
  const gather = twiml.gather({
    input: 'speech',
    language: 'fr-FR',
    speechTimeout: 'auto',
    speechModel: 'phone_call',
    hints: SPEECH_HINTS,
    action: options.action || '/api/twilio/voice/conversation',
    method: 'POST',
    timeout: options.timeout || 5,
    bargeIn: true  // Permet d'interrompre pendant que l'audio joue
  });

  // Jouer l'audio À L'INTÉRIEUR du gather pour que bargeIn fonctionne
  await sayWithElevenLabs(gather, text);

  return gather;
}

// ============================================================
// === WEBHOOK APPEL ENTRANT - ACCUEIL HALIMAH IA ===
// ============================================================

// Accepte GET et POST (Twilio peut envoyer l'un ou l'autre selon la config)
// ⚠️ SECURED: Validates Twilio signature
router.all('/voice', validateTwilioSignature, async (req, res) => {
  // Twilio envoie les params en query (GET) ou body (POST)
  const params = req.method === 'GET' ? req.query : req.body;
  const { From, To, CallSid, CallerCity, CallerCountry } = params;

  // MULTI-TENANT: Identifier le tenant par le numéro appelé
  const { tenantId, config: tenantConfig } = getTenantByPhoneNumber(To);

  console.log(`[TWILIO VOICE] Appel reçu - Method: ${req.method} - From: ${From}`);
  console.log(`[VOICE] === NOUVEL APPEL ===`);
  console.log(`[VOICE] De: ${From} vers ${To}`);
  console.log(`[VOICE] Tenant: ${tenantId} (${tenantConfig?.name || 'inconnu'})`);
  console.log(`[VOICE] CallSid: ${CallSid}`);
  if (CallerCity) console.log(`[VOICE] Localisation: ${CallerCity}, ${CallerCountry}`);

  // 🔒 IMPORTANT: Nettoyer toute conversation précédente avec ce CallSid
  // pour éviter que des données d'appels précédents polluent le nouvel appel
  const conversationId = `voice_${CallSid}`;
  clearConversation(conversationId);

  // Stocker la config du tenant dans la session pour les appels suivants
  voiceSessions.set(CallSid, {
    startTime: Date.now(),
    tenantId,
    tenantConfig
  });

  // Tracker la conversation
  trackConversation(CallSid);

  // Persister en base
  logCallStart(tenantId, { CallSid, From, To, CallerCity, CallerCountry }).catch(() => {});

  const twiml = new VoiceResponse();

  try {
    // Message d'accueil avec Halimah IA
    const { response } = await handleVoice(CallSid, '', true);

    // Accueil + écoute avec barge-in (client peut interrompre)
    await gatherWithBargeIn(twiml, response, { timeout: 5 });

    // Si pas de réponse après le timeout
    await gatherWithBargeIn(twiml, "Vous êtes toujours là ? Je vous écoute.", { timeout: 3 });

    // Si toujours pas de réponse
    await sayWithElevenLabs(twiml, "Je n'entends rien. N'hésitez pas à rappeler ou à nous contacter par WhatsApp. Au revoir !");

  } catch (error) {
    console.error('[HALIMAH VOICE] Erreur accueil:', error);
    twiml.say(VOICE_CONFIG, "Excusez-moi, j'ai un petit problème technique. Veuillez rappeler dans quelques instants. Au revoir !");
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// ============================================================
// === CONVERSATION IA - BOUCLE PRINCIPALE ===
// ============================================================

// ⚠️ SECURED: Validates Twilio signature
router.post('/voice/conversation', validateTwilioSignature, async (req, res) => {
  const { CallSid, SpeechResult, Confidence } = req.body;

  console.log(`\n════════════════════════════════════════════════════════════`);
  console.log(`📞 APPEL TÉLÉPHONE - CONVERSATION REÇUE`);
  console.log(`════════════════════════════════════════════════════════════`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`📱 CallSid: ${CallSid}`);
  console.log(`💬 SpeechResult: "${SpeechResult}"`);
  console.log(`📊 Confidence: ${Confidence}`);
  console.log(`📏 SpeechResult length: ${SpeechResult?.length || 0}`);
  console.log(`════════════════════════════════════════════════════════════`);

  const twiml = new VoiceResponse();

  // Vérifier si on a bien compris
  if (!SpeechResult || SpeechResult.trim() === '') {
    console.log('[HALIMAH VOICE] Pas de speech détecté');

    // Demander de répéter avec barge-in
    await gatherWithBargeIn(twiml, "Excusez-moi, je n'ai pas bien entendu. Pouvez-vous répéter ?", { timeout: 5 });

    // Après timeout sans réponse
    await sayWithElevenLabs(twiml, "Je n'entends plus rien. Si vous avez des questions, n'hésitez pas à rappeler. Au revoir !");

    res.type('text/xml');
    return res.send(twiml.toString());
  }

  try {
    // Obtenir la réponse de Halimah IA (nexusCore ou legacy)
    const { response, shouldEndCall, shouldTransfer, clientName } = await handleVoice(CallSid, SpeechResult, false);

    // V2 - Récupérer le tenantId depuis la session
    const session = voiceSessions.get(CallSid);
    const tenantId = session?.tenantId || 'fatshairafro';
    const messages = getVoiceMessages(tenantId);

    console.log(`[HALIMAH VOICE] Halimah répond: "${response}"`);
    console.log(`[HALIMAH VOICE] Fin: ${shouldEndCall}, Transfert: ${shouldTransfer}`);

    // === TRANSFERT VERS LE RESPONSABLE ===
    if (shouldTransfer) {
      console.log(`[HALIMAH VOICE] Transfert vers responsable pour ${clientName} (tenant: ${tenantId})`);

      // Dire qu'on transfère (sans gather car on va dial après)
      await sayWithElevenLabs(twiml, response);

      // Appeler le responsable
      const dial = twiml.dial({
        timeout: 20,
        callerId: TWILIO_PHONE,
        action: '/api/twilio/voice/transfer-result',
        method: 'POST'
      });
      dial.number(getTransferPhone(tenantId));

      // Si le responsable ne répond pas (après le dial) - avec barge-in
      await gatherWithBargeIn(twiml,
        messages.unavailable(clientName) + ' Puis-je prendre un message ou préférez-vous rappeler plus tard ?',
        { timeout: 8 }
      );

    } else if (shouldEndCall) {
      // Terminer l'appel proprement - dire au revoir puis raccrocher
      await sayWithElevenLabs(twiml, response);
      console.log(`[HALIMAH VOICE] Fin de conversation pour ${CallSid}`);
      cleanupVoiceService(CallSid);
      cleanupVoiceSession(CallSid);
      twiml.hangup();
    } else {
      // Continuer la conversation - répondre avec barge-in pour que le client puisse interrompre
      await gatherWithBargeIn(twiml, response, { timeout: 8 });

      // Timeout - relancer avec barge-in
      await gatherWithBargeIn(twiml, "Vous êtes toujours là ?", { timeout: 3 });

      // Fin après double timeout
      await sayWithElevenLabs(twiml, messages.goodbye);
    }

  } catch (error) {
    console.error('[HALIMAH VOICE] Erreur conversation:', error);
    const session = voiceSessions.get(CallSid);
    const tenantId = session?.tenantId || 'fatshairafro';
    const info = getBusinessInfoSync(tenantId);
    await sayWithElevenLabs(twiml, `Excusez-moi, j'ai eu un petit souci. Pouvez-vous rappeler ou envoyer un SMS au ${info.telephone || '09 39 24 02 69'} ? Au revoir !`);
    // Note: Ne pas appeler cleanupConversation ici - sera fait par /voice/status
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// ============================================================
// === WEBHOOK STATUT D'APPEL ===
// ============================================================

// ⚠️ SECURED: Validates Twilio signature (loose for status callbacks)
router.post('/voice/status', validateTwilioSignatureLoose, async (req, res) => {
  const { CallSid, CallStatus, CallDuration, From, To } = req.body;

  console.log(`[HALIMAH VOICE] === STATUT APPEL ===`);
  console.log(`[HALIMAH VOICE] CallSid: ${CallSid}`);
  console.log(`[HALIMAH VOICE] Statut: ${CallStatus}`);
  if (CallDuration) console.log(`[HALIMAH VOICE] Durée: ${CallDuration}s`);

  // Persister fin d'appel
  logCallEnd({ CallSid, CallStatus, CallDuration }).catch(() => {});

  // Tracker l'usage quand l'appel est terminé
  if (CallStatus === 'completed' && CallDuration) {
    try {
      const { tenantId } = getTenantByPhoneNumber(To);
      await usageTracking.trackPhoneCall(tenantId, parseInt(CallDuration), CallSid, 'inbound');
      console.log(`[VOICE] ✅ Usage tracké: ${CallDuration}s pour ${tenantId}`);
    } catch (err) {
      console.error(`[VOICE] Erreur tracking:`, err.message);
    }
  }

  // Nettoyer la conversation quand l'appel se termine
  if (CallStatus === 'completed' || CallStatus === 'failed' || CallStatus === 'busy' || CallStatus === 'no-answer') {
    cleanupVoiceService(CallSid);
    cleanupVoiceSession(CallSid);
  }

  res.sendStatus(200);
});

// ============================================================
// === TRANSFERT VERS LE RESPONSABLE ===
// ============================================================

// ⚠️ SECURED: Validates Twilio signature
router.post('/voice/transfer', validateTwilioSignature, async (req, res) => {
  const { CallSid, From } = req.body;

  // V2 - Récupérer le tenantId depuis la session
  const session = voiceSessions.get(CallSid);
  const tenantId = session?.tenantId || 'fatshairafro';
  const messages = getVoiceMessages(tenantId);

  console.log(`[HALIMAH VOICE] Transfert vers responsable pour ${CallSid} (tenant: ${tenantId})`);

  const twiml = new VoiceResponse();

  await sayWithElevenLabs(twiml, messages.transferMessage);

  twiml.dial({
    timeout: 30,
    callerId: TWILIO_PHONE,
    action: '/api/twilio/voice/transfer-status',
    method: 'POST'
  }, getTransferPhone(tenantId));

  res.type('text/xml');
  res.send(twiml.toString());
});

// ⚠️ SECURED: Validates Twilio signature
router.post('/voice/transfer-status', validateTwilioSignature, async (req, res) => {
  const { DialCallStatus, CallSid } = req.body;

  // V2 - Récupérer le tenantId depuis la session
  const session = voiceSessions.get(CallSid);
  const tenantId = session?.tenantId || 'fatshairafro';
  const messages = getVoiceMessages(tenantId);

  console.log(`[HALIMAH VOICE] Statut transfert: ${DialCallStatus} (tenant: ${tenantId})`);

  const twiml = new VoiceResponse();

  if (DialCallStatus !== 'completed') {
    await sayWithElevenLabs(twiml, messages.voicemail);

    twiml.record({
      maxLength: 120,
      playBeep: true,
      action: '/api/twilio/voice/recording',
      method: 'POST',
      transcribe: true,
      transcribeCallback: '/api/twilio/voice/transcription'
    });
  }

  await sayWithElevenLabs(twiml, messages.goodbye);
  // Note: Ne pas appeler cleanupConversation ici - sera fait par /voice/status

  res.type('text/xml');
  res.send(twiml.toString());
});

// === RÉSULTAT DU TRANSFERT (appelé après le Dial) ===
// ⚠️ SECURED: Validates Twilio signature
router.post('/voice/transfer-result', validateTwilioSignature, async (req, res) => {
  const { CallSid, DialCallStatus, DialCallDuration } = req.body;

  // V2 - Récupérer le tenantId depuis la session
  const session = voiceSessions.get(CallSid);
  const tenantId = session?.tenantId || 'fatshairafro';
  const messages = getVoiceMessages(tenantId);

  console.log(`[HALIMAH VOICE] === RÉSULTAT TRANSFERT ===`);
  console.log(`[HALIMAH VOICE] Status: ${DialCallStatus}, Durée: ${DialCallDuration}s (tenant: ${tenantId})`);

  const twiml = new VoiceResponse();

  if (DialCallStatus === 'completed') {
    // Le responsable a pris l'appel et la conversation est terminée
    console.log(`[HALIMAH VOICE] Transfert réussi pour ${CallSid}`);
    await sayWithElevenLabs(twiml, messages.goodbye);
    cleanupVoiceService(CallSid);
    cleanupVoiceSession(CallSid);
  } else {
    // Le responsable n'a pas répondu ou a refusé
    console.log(`[HALIMAH VOICE] Transfert échoué: ${DialCallStatus}`);

    // 🔧 FIX: Utiliser gatherWithBargeIn pour que l'audio soit DANS le gather
    // Cela permet au client d'interrompre l'assistant
    await gatherWithBargeIn(twiml,
      messages.unavailableAlt,
      { timeout: 8 }
    );

    // Timeout - si pas de réponse
    await sayWithElevenLabs(twiml, "Je n'entends rien. Merci d'avoir appelé. Au revoir !");
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// ============================================================
// === ENREGISTREMENT VOCAL ===
// ============================================================

// ⚠️ SECURED: Validates Twilio signature
router.post('/voice/recording', validateTwilioSignature, async (req, res) => {
  const { RecordingUrl, RecordingSid, From, CallSid } = req.body;

  // V2 - Récupérer le tenantId depuis la session
  const session = voiceSessions.get(CallSid);
  const tenantId = session?.tenantId || 'fatshairafro';
  const messages = getVoiceMessages(tenantId);

  console.log(`[HALIMAH VOICE] === ENREGISTREMENT ===`);
  console.log(`[HALIMAH VOICE] De: ${From}`);
  console.log(`[HALIMAH VOICE] URL: ${RecordingUrl}`);
  console.log(`[HALIMAH VOICE] RecordingSid: ${RecordingSid}`);
  console.log(`[HALIMAH VOICE] Tenant: ${tenantId}`);

  // TODO: Sauvegarder l'enregistrement en base et notifier le responsable

  const twiml = new VoiceResponse();
  await sayWithElevenLabs(twiml, messages.messageRecorded);

  res.type('text/xml');
  res.send(twiml.toString());
});

// ⚠️ SECURED: Validates Twilio signature
router.post('/voice/transcription', validateTwilioSignature, async (req, res) => {
  const { TranscriptionText, RecordingSid, From } = req.body;

  console.log(`[HALIMAH VOICE] === TRANSCRIPTION ===`);
  console.log(`[HALIMAH VOICE] De: ${From}`);
  console.log(`[HALIMAH VOICE] Texte: ${TranscriptionText}`);

  // TODO: Envoyer la transcription à Fatou par SMS ou email

  res.sendStatus(200);
});

// ============================================================
// === WEBHOOK SMS AVEC IA ===
// ============================================================

// ⚠️ SECURED: Validates Twilio signature
router.post('/sms', validateTwilioSignature, async (req, res) => {
  const { From, To, Body, MessageSid } = req.body;

  // MULTI-TENANT: Identifier le tenant par le numéro appelé
  const { tenantId, config: tenantConfig } = getTenantByPhoneNumber(To);
  const salonName = tenantConfig?.name || SALON_INFO.nom;

  console.log(`[SMS] === NOUVEAU SMS ===`);
  console.log(`[SMS] De: ${From} vers ${To}`);
  console.log(`[SMS] Tenant: ${tenantId}`);
  console.log(`[SMS] Message: ${Body}`);

  // Persister SMS en base
  logSMS(tenantId, { MessageSid, From, Body }).catch(() => {});

  const twiml = new MessagingResponse();

  try {
    // Utiliser NEXUS CORE pour répondre aux SMS
    const conversationId = `sms_${MessageSid}`;
    trackConversation(conversationId);

    const result = await processMessage(Body, 'sms', {
      conversationId,
      phone: From,
      tenantId
    });

    console.log(`[SMS] Réponse: ${result.response}`);

    twiml.message(result.response);

    // Nettoyer - chaque SMS est indépendant
    clearConversation(conversationId);

  } catch (error) {
    console.error('[SMS] Erreur:', error);
    twiml.message(`Merci pour votre message ! ${salonName} vous répond bientôt.`);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// ⚠️ SECURED: Validates Twilio signature (loose for status callbacks)
router.post('/sms/status', validateTwilioSignatureLoose, (req, res) => {
  const { MessageSid, MessageStatus, To, ErrorCode } = req.body;

  console.log(`[HALIMAH SMS] Statut ${MessageSid}: ${MessageStatus}`);
  if (ErrorCode) console.error(`[HALIMAH SMS] Erreur: ${ErrorCode}`);

  logSMSStatus({ MessageSid, MessageStatus }).catch(() => {});

  res.sendStatus(200);
});

// ============================================================
// === ROUTES DE TEST ET DEBUG ===
// ============================================================

// GET /voice supprimé - router.all('/voice') gère GET et POST

router.get('/sms', (req, res) => {
  res.json({
    status: 'ok',
    message: 'SMS webhook ready with AI',
    timestamp: new Date().toISOString()
  });
});

// ⚠️ SECURED: No sensitive info exposed
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Halimah Voice AI',
    // ⚠️ SECURITY: Ne pas exposer les numéros de téléphone
    features: [
      'conversation_ia',
      'speech_to_text',
      'natural_voice',
      'call_transfer',
      'voicemail',
      'sms_ai'
    ],
    timestamp: new Date().toISOString()
  });
});

// Debug - voir les conversations actives
// ⚠️ SECURED: Requires admin authentication
router.get('/debug/conversations', authenticateAdmin, (req, res) => {
  const tenantId = req.admin?.tenant_id;
  if (!tenantId) {
    return res.status(403).json({ error: 'TENANT_REQUIRED' });
  }

  const stats = getConversationStats();
  // Note: Dans le futur, filtrer par tenant_id
  res.json(stats);
});

export default router;
