/**
 * Routes Twilio Voice AI — Multi-tenant
 * Conversation naturelle au téléphone avec Claude IA
 *
 * 🔒 UTILISE NEXUS CORE UNIFIÉ - Source unique de vérité
 */

import express from 'express';
import twilio from 'twilio';
import logger from '../config/logger.js';
import { captureException } from '../config/sentry.js';
import {
  getVoiceResponseNexus,
  cleanupConversation as cleanupVoiceService,
  getConversationStats,
  trackConversation
} from '../services/voiceAIService.js';
import { validateTwilioSignature, validateTwilioSignatureLoose } from '../middleware/twilioValidation.js';
import { authenticateAdmin } from './adminAuth.js';
// 🔒 NEXUS CORE UNIFIÉ
import {
  processMessage,
  clearConversation
} from '../core/unified/nexusCore.js';
import voiceService from '../services/voiceService.js';
import ttsService from '../services/ttsService.js';
import openaiTTS from '../services/openaiTTSService.js';
import { logCallStart, logCallEnd, logSMS, logSMSStatus } from '../modules/twilio/callLogService.js';
import { saveVoiceRecording } from '../services/voiceRecordingService.js';
import usageTracking from '../services/usageTrackingService.js';
import { getTenantByPhone, getTenantConfig } from '../config/tenants/index.js';
// V2 - Multi-tenant dynamic messages
import { getBusinessInfoSync } from '../services/tenantBusinessService.js';

/**
 * V2 - Génère les messages dynamiques pour les appels vocaux
 */
function getVoiceMessages(tenantId) {
  if (!tenantId) {
    logger.warn('getVoiceMessages appelé sans tenantId', { tag: 'TWILIO' });
    return { transferMessage: 'Transfert en cours.', unavailable: () => 'Indisponible.', confirmation: () => 'Confirmé.' };
  }
  try {
    const info = getBusinessInfoSync(tenantId);
    const gerant = info.gerant || 'le responsable';
    const nom = info.nom || 'notre établissement';
    const tel = info.telephone || '';

    return {
      transferMessage: `Je vous transfère vers ${gerant}. Un instant s'il vous plaît.`,
      unavailable: (clientName) =>
        `Désolé${clientName ? ` ${clientName}` : ''}, ${gerant} n'est pas disponible pour le moment. ` +
        `Vous pouvez laisser un message après le bip.`,
      goodbye: `Merci d'avoir appelé ${nom}. À bientôt !`,
      voicemail: `${gerant} n'est pas disponible pour le moment. Vous pouvez laisser un message vocal après le bip${tel ? `, ou envoyer un SMS au ${tel}` : ''}.`,
      messageRecorded: `Votre message a bien été enregistré. ${gerant} vous rappellera dès que possible. Merci et à bientôt !`,
      unavailableAlt: `${gerant} n'est pas disponible actuellement. Souhaitez-vous laisser un message ou que je prenne votre rendez-vous ?`,
    };
  } catch (e) {
    logger.warn(`getVoiceMessages fallback for tenant ${tenantId}: ${e.message}`, { tag: 'TWILIO' });
    return {
      transferMessage: "Je vous transfère vers le responsable. Un instant s'il vous plaît.",
      unavailable: (clientName) =>
        `Désolé${clientName ? ` ${clientName}` : ''}, le responsable n'est pas disponible pour le moment. ` +
        `Vous pouvez laisser un message après le bip.`,
      goodbye: "Merci de votre appel. À bientôt !",
      voicemail: "Le responsable n'est pas disponible pour le moment. Vous pouvez laisser un message vocal après le bip.",
      messageRecorded: "Votre message a bien été enregistré. On vous rappellera dès que possible. Merci et à bientôt !",
      unavailableAlt: "Le responsable n'est pas disponible actuellement. Souhaitez-vous laisser un message ou que je prenne votre rendez-vous ?",
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
    logger.info(`ROUTING Numéro ${toNumber} → Tenant: ${tenantId}`);
    return { tenantId, config };
  }

  // 🔒 TENANT ISOLATION: Pas de fallback - rejeter si numéro inconnu
  logger.error(`ROUTING TENANT_NOT_FOUND: No tenant configured for number ${toNumber}`);
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

  // Nom de l'établissement pour les réponses
  const businessName = tenantConfig?.name || 'notre établissement';

  logger.info(`VOICE handleVoice CallSid: ${callSid}, isFirst: ${isFirst}, message: "${message?.substring(0, 80) || ''}"`);

  // Récupérer le tenantId depuis la session
  // 🔒 TENANT ISOLATION: tenantId obligatoire
  const session = voiceSessions.get(callSid);
  const tenantId = session?.tenantId;
  if (!tenantId) {
    logger.error(`TWILIO NEXUS TENANT_ID_REQUIRED: No tenant in session for call ${callSid}`);
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
      logger.info(`VOICE Appel processMessage('bonjour', 'phone') pour tenant: ${tenantId}`);
      const result = await processMessage('bonjour', 'phone', {
        conversationId,
        phone: callSid,
        tenantId
      });
      logger.info(`VOICE Reponse recue: success=${result.success}, duree=${result.duration}ms`);

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
        response: `Merci d'avoir appelé ${businessName}. À très bientôt !`,
        shouldEndCall: true,
        shouldTransfer: false
      };
    }

    // Message normal - traiter avec NEXUS CORE
    logger.info(`VOICE APPEL processMessage()`);
    logger.info(`VOICE Tenant: ${tenantId}`);
    logger.info(`VOICE Message: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`);
    logger.info(`VOICE ConversationId: ${conversationId}`);

    const result = await processMessage(message, 'phone', {
      conversationId,
      phone: callSid,
      tenantId
    });

    logger.info(`VOICE processMessage result: success=${result.success}, duration=${result.duration}ms, response="${result.response?.substring(0, 100) || 'VIDE'}"`);

    // Détecter si la réservation est confirmée (fin de conversation naturelle)
    const isBookingConfirmed = result.response.toLowerCase().includes('confirmé') &&
                               result.response.toLowerCase().includes('rendez-vous');

    return {
      response: result.response,
      shouldEndCall: isBookingConfirmed,
      shouldTransfer: false
    };

  } catch (error) {
    logger.error(`VOICE handleVoice error for tenant ${tenantId}: ${error.message}`, { stack: error.stack });
    captureException(error, { tags: { service: 'twilio', type: 'voice_conversation' }, extra: { callSid, tenantId, message } });
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

// Numéro Twilio sortant (callerId pour les transferts)
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

/**
 * V2 - Récupère le numéro de transfert pour un tenant
 * Charge depuis la config tenant (DB ou statique) — aucun fallback hardcodé
 */
function getTransferPhone(tenantId) {
  if (!tenantId) {
    logger.error('getTransferPhone appelé sans tenantId', { tag: 'TWILIO' });
    return null;
  }
  try {
    const info = getBusinessInfoSync(tenantId);
    return info.telephone_transfert || info.telephone || null;
  } catch (e) {
    logger.warn(`getTransferPhone failed for ${tenantId}: ${e.message}`, { tag: 'TWILIO' });
    return null;
  }
}

/**
 * Récupère le callerId Twilio pour un tenant
 * Utilise le numéro Twilio du tenant (from config) ou le numéro global
 */
function getCallerId(tenantId) {
  if (tenantId) {
    const config = getTenantConfig(tenantId);
    if (config?.twilio_number) return config.twilio_number;
  }
  return TWILIO_PHONE || null;
}

// Configuration voix naturelle française (Amazon Polly via Twilio)
const VOICE_CONFIG = {
  voice: 'Polly.Lea', // Voix française féminine naturelle
  language: 'fr-FR'
};

// Hints génériques pour la reconnaissance vocale Twilio (multi-tenant)
const BASE_SPEECH_HINTS = [
  // Jours
  'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche',
  'demain', 'après-demain', 'semaine prochaine', 'prochain', 'prochaine',
  // Heures
  'matin', 'après-midi', 'midi', 'heure', 'heures',
  // Confirmations
  'oui', 'non', 'parfait', 'ok', "d'accord", 'bien sûr', 'absolument',
  // Réservation
  'rendez-vous', 'réservation', 'disponibilité', 'créneau',
  // Services génériques
  'prestation', 'service', 'tarif', 'prix', 'durée',
  // Adresses
  'rue', 'avenue', 'boulevard', 'place',
  // Actions
  'annuler', 'modifier', 'confirmer', 'reporter', 'transférer'
];

/**
 * Génère les hints de reconnaissance vocale pour un tenant
 * Combine les hints génériques + hints spécifiques au tenant (depuis config)
 */
function getSpeechHints(tenantId) {
  const hints = [...BASE_SPEECH_HINTS];
  if (tenantId) {
    try {
      const info = getBusinessInfoSync(tenantId);
      // Ajouter le nom de l'établissement et du gérant comme hints
      if (info.nom) hints.push(info.nom);
      if (info.gerant) hints.push(info.gerant);
      // Ajouter les hints personnalisés depuis la config tenant
      const config = getTenantConfig(tenantId);
      if (config?.speech_hints && Array.isArray(config.speech_hints)) {
        hints.push(...config.speech_hints);
      }
    } catch (e) {
      // Utiliser les hints de base seuls
    }
  }
  return hints.join(', ');
}

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
 * Nettoie le texte pour la synthèse vocale (Polly ou ElevenLabs)
 * Supprime emojis, markdown, astérisques, et artefacts non prononçables
 */
function cleanTextForTTS(text) {
  return text
    // Supprimer les emojis (tous les blocs Unicode emoji)
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[\u{20E3}]|[\u{E0020}-\u{E007F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/gu, '')
    // Supprimer le markdown bold/italic
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    // Supprimer les tirets de liste en début de ligne
    .replace(/^\s*[-•]\s+/gm, '')
    // Supprimer les # de titre markdown
    .replace(/^#+\s*/gm, '')
    // Supprimer les doubles espaces restants
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Joue l'audio via TTS (OpenAI → ElevenLabs → Polly)
 * Priorité : OpenAI TTS (naturel, pas cher) > ElevenLabs (premium) > Polly (gratuit, robotique)
 * @param {object} parent - twiml ou gather element
 * @param {string} text - texte à prononcer
 */
async function sayWithTTS(parent, text) {
  // Toujours nettoyer le texte avant tout TTS
  const cleanText = cleanTextForTTS(text);

  // Si aucun TTS externe configuré → Polly (fallback gratuit)
  if (!ttsService.isConfigured()) {
    parent.say(VOICE_CONFIG, cleanText);
    return;
  }

  try {
    // Utiliser le service unifié (OpenAI par défaut, ElevenLabs en fallback)
    const result = await ttsService.textToSpeech(cleanText);
    if (!result.success) throw new Error(result.error || 'TTS failed');

    // Déterminer le hash selon le provider utilisé
    const provider = result.provider || 'openai';
    let filename;
    if (provider === 'openai') {
      const hash = openaiTTS.getTextHash(openaiTTS.optimizeText(cleanText), openaiTTS.DEFAULT_VOICE);
      filename = `${hash}.mp3`;
    } else {
      const optimized = voiceService.optimizeText(cleanText);
      const hash = voiceService.getTextHash(optimized, voiceService.DEFAULT_VOICE_ID);
      filename = `${hash}.mp3`;
    }

    const publicUrl = `${BASE_URL}/api/voice/audio/${filename}`;
    logger.info(`VOICE ${provider.toUpperCase()} ${publicUrl} (${result.fromCache ? 'cache' : 'API'})`);
    parent.play(publicUrl);
  } catch (error) {
    logger.warn(`VOICE TTS failed, fallback Polly: ${error.message}`);
    parent.say(VOICE_CONFIG, cleanText);
  }
}

/**
 * Crée un gather avec audio interruptible (barge-in)
 * L'audio est joué À L'INTÉRIEUR du gather pour permettre l'interruption
 *
 * Options :
 *  - timeout: secondes d'attente après fin de parole (défaut: 3)
 *  - action: URL callback
 *  - tenantId: pour les speech hints
 *  - enhanced: utiliser enhanced speech model (meilleure compréhension, +$)
 */
async function gatherWithBargeIn(twiml, text, options = {}) {
  const hints = getSpeechHints(options.tenantId || null);
  const gather = twiml.gather({
    input: 'speech',
    language: 'fr-FR',
    speechTimeout: 'auto',
    speechModel: 'phone_call',
    enhanced: true,         // Meilleure reconnaissance vocale
    hints,
    action: options.action || '/api/twilio/voice/conversation',
    method: 'POST',
    timeout: options.timeout || 3,
    bargeIn: true           // Permet d'interrompre pendant que l'audio joue
  });

  // Jouer l'audio À L'INTÉRIEUR du gather pour que bargeIn fonctionne
  await sayWithTTS(gather, text);

  return gather;
}

// ============================================================
// === WEBHOOK APPEL ENTRANT - ACCUEIL IA ===
// ============================================================

// Accepte GET et POST (Twilio peut envoyer l'un ou l'autre selon la config)
// ⚠️ SECURED: Validates Twilio signature
router.all('/voice', validateTwilioSignature, async (req, res) => {
  // Twilio envoie les params en query (GET) ou body (POST)
  const params = req.method === 'GET' ? req.query : req.body;
  const { From, To, CallSid, CallerCity, CallerCountry } = params;

  // MULTI-TENANT: Identifier le tenant par le numéro appelé
  const { tenantId, config: tenantConfig } = getTenantByPhoneNumber(To);

  logger.info(`VOICE === NOUVEL APPEL ===`);
  logger.info(`VOICE De: ${From} vers ${To}`);
  logger.info(`VOICE Tenant: ${tenantId} (${tenantConfig?.name || 'inconnu'})`);
  logger.info(`VOICE CallSid: ${CallSid}`);
  if (CallerCity) logger.info(`VOICE Localisation: ${CallerCity}, ${CallerCountry}`);

  // 🔒 TENANT ISOLATION: Rejeter si tenant inconnu
  if (!tenantId) {
    logger.error(`VOICE TENANT_NOT_FOUND: Rejecting call from ${From} to unknown number ${To}`);
    const twiml = new VoiceResponse();
    twiml.say(VOICE_CONFIG, "Désolé, ce numéro n'est plus en service. Au revoir.");
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

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
    // Message d'accueil via NEXUS CORE
    const { response } = await handleVoice(CallSid, '', true);

    // Accueil + écoute avec barge-in (client peut interrompre)
    await gatherWithBargeIn(twiml, response, { timeout: 5, tenantId });

    // Si pas de réponse après le timeout
    await gatherWithBargeIn(twiml, "Vous êtes toujours là ? Je vous écoute.", { timeout: 3, tenantId });

    // Si toujours pas de réponse
    await sayWithTTS(twiml, "Je n'entends rien. N'hésitez pas à rappeler ou à nous contacter par WhatsApp. Au revoir !");

  } catch (error) {
    logger.error(`VOICE Erreur accueil pour tenant ${tenantId}: ${error.message}`);
    captureException(error, { tags: { service: 'twilio', type: 'voice_greeting' } });
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

  // Récupérer le tenantId depuis la session
  const session = voiceSessions.get(CallSid);
  const tenantId = session?.tenantId;

  logger.info(`VOICE CONVERSATION CallSid: ${CallSid}, Tenant: ${tenantId}`);
  logger.info(`VOICE SpeechResult: "${SpeechResult}" (confidence: ${Confidence})`);

  const twiml = new VoiceResponse();

  // 🔒 TENANT ISOLATION: Rejeter si pas de tenant en session
  if (!tenantId) {
    logger.error(`VOICE No tenantId in session for CallSid: ${CallSid}`);
    await sayWithTTS(twiml, "Excusez-moi, une erreur technique s'est produite. Veuillez rappeler.");
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Vérifier si on a bien compris
  if (!SpeechResult || SpeechResult.trim() === '') {
    logger.info(`VOICE Pas de speech détecté pour ${CallSid}`);

    // Demander de répéter avec barge-in
    await gatherWithBargeIn(twiml, "Excusez-moi, je n'ai pas bien entendu. Pouvez-vous répéter ?", { timeout: 5, tenantId });

    // Après timeout sans réponse
    await sayWithTTS(twiml, "Je n'entends plus rien. Si vous avez des questions, n'hésitez pas à rappeler. Au revoir !");

    res.type('text/xml');
    return res.send(twiml.toString());
  }

  try {
    // Obtenir la réponse IA via NEXUS CORE
    const { response, shouldEndCall, shouldTransfer, clientName } = await handleVoice(CallSid, SpeechResult, false);

    const messages = getVoiceMessages(tenantId);

    logger.info(`VOICE Réponse IA: "${response?.substring(0, 100)}..." Fin: ${shouldEndCall}, Transfert: ${shouldTransfer}`);

    // === TRANSFERT VERS LE RESPONSABLE ===
    if (shouldTransfer) {
      logger.info(`VOICE Transfert vers responsable pour ${clientName} (tenant: ${tenantId})`);

      // Dire qu'on transfère (sans gather car on va dial après)
      await sayWithTTS(twiml, response);

      // Récupérer le numéro de transfert pour ce tenant
      const transferPhone = getTransferPhone(tenantId);
      if (!transferPhone) {
        logger.error(`VOICE No transfer phone for tenant ${tenantId}`);
        await gatherWithBargeIn(twiml,
          messages.unavailable(clientName) + ' Puis-je prendre un message ou préférez-vous rappeler plus tard ?',
          { timeout: 8, tenantId }
        );
      } else {
        // Appeler le responsable
        const callerId = getCallerId(tenantId);
        const dial = twiml.dial({
          timeout: 20,
          ...(callerId ? { callerId } : {}),
          action: '/api/twilio/voice/transfer-result',
          method: 'POST'
        });
        dial.number(transferPhone);

        // Si le responsable ne répond pas (après le dial) - avec barge-in
        await gatherWithBargeIn(twiml,
          messages.unavailable(clientName) + ' Puis-je prendre un message ou préférez-vous rappeler plus tard ?',
          { timeout: 8, tenantId }
        );
      }

    } else if (shouldEndCall) {
      // Terminer l'appel proprement - dire au revoir puis raccrocher
      await sayWithTTS(twiml, response);
      logger.info(`VOICE Fin de conversation pour ${CallSid}`);
      cleanupVoiceService(CallSid);
      cleanupVoiceSession(CallSid);
      twiml.hangup();
    } else {
      // Continuer la conversation - répondre avec barge-in pour que le client puisse interrompre
      await gatherWithBargeIn(twiml, response, { timeout: 8, tenantId });

      // Timeout - relancer avec barge-in
      await gatherWithBargeIn(twiml, "Vous êtes toujours là ?", { timeout: 3, tenantId });

      // Fin après double timeout
      await sayWithTTS(twiml, messages.goodbye);
    }

  } catch (error) {
    logger.error(`VOICE Erreur conversation tenant ${tenantId}: ${error.message}`);
    captureException(error, { tags: { service: 'twilio', type: 'voice_conversation' }, extra: { CallSid, tenantId } });
    const info = tenantId ? getBusinessInfoSync(tenantId) : {};
    const phoneMsg = info.telephone ? ` ou envoyer un SMS au ${info.telephone}` : '';
    await sayWithTTS(twiml, `Excusez-moi, j'ai eu un petit souci. Pouvez-vous rappeler${phoneMsg} ? Au revoir !`);
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

  logger.info(`VOICE === STATUT APPEL === CallSid: ${CallSid}, Statut: ${CallStatus}${CallDuration ? `, Durée: ${CallDuration}s` : ''}`);

  // Persister fin d'appel
  logCallEnd({ CallSid, CallStatus, CallDuration }).catch(() => {});

  // Tracker l'usage quand l'appel est terminé
  if (CallStatus === 'completed' && CallDuration) {
    try {
      const { tenantId } = getTenantByPhoneNumber(To);
      await usageTracking.trackPhoneCall(tenantId, parseInt(CallDuration), CallSid, 'inbound');
      logger.info(`VOICE Usage tracke: ${CallDuration}s pour ${tenantId}`);
    } catch (err) {
      logger.error(`VOICE Erreur tracking: ${err.message}`);
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
  const tenantId = session?.tenantId;
  if (!tenantId) {
    logger.error(`VOICE No tenantId in session for transfer CallSid: ${CallSid}`);
    res.type('text/xml');
    return res.send(new VoiceResponse().toString());
  }
  const messages = getVoiceMessages(tenantId);

  logger.info(`VOICE Transfert vers responsable pour ${CallSid} (tenant: ${tenantId})`);

  const twiml = new VoiceResponse();

  await sayWithTTS(twiml, messages.transferMessage);

  const transferPhone = getTransferPhone(tenantId);
  if (!transferPhone) {
    logger.error(`VOICE No transfer phone configured for tenant ${tenantId}`);
    await sayWithTTS(twiml, messages.voicemail);
    twiml.record({
      maxLength: 120,
      playBeep: true,
      action: '/api/twilio/voice/recording',
      method: 'POST'
    });
  } else {
    const callerId = getCallerId(tenantId);
    twiml.dial({
      timeout: 30,
      ...(callerId ? { callerId } : {}),
      action: '/api/twilio/voice/transfer-status',
      method: 'POST'
    }, transferPhone);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// ⚠️ SECURED: Validates Twilio signature
router.post('/voice/transfer-status', validateTwilioSignature, async (req, res) => {
  const { DialCallStatus, CallSid } = req.body;

  // V2 - Récupérer le tenantId depuis la session
  const session = voiceSessions.get(CallSid);
  const tenantId = session?.tenantId;
  if (!tenantId) {
    logger.error(`VOICE No tenantId in session for transfer-status CallSid: ${CallSid}`);
    res.type('text/xml');
    return res.send(new VoiceResponse().toString());
  }
  const messages = getVoiceMessages(tenantId);

  logger.info(`VOICE Statut transfert: ${DialCallStatus} (tenant: ${tenantId})`);

  const twiml = new VoiceResponse();

  if (DialCallStatus !== 'completed') {
    await sayWithTTS(twiml, messages.voicemail);

    twiml.record({
      maxLength: 120,
      playBeep: true,
      action: '/api/twilio/voice/recording',
      method: 'POST',
      transcribe: true,
      transcribeCallback: '/api/twilio/voice/transcription'
    });
  }

  await sayWithTTS(twiml, messages.goodbye);
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
  const tenantId = session?.tenantId;
  if (!tenantId) {
    logger.error(`VOICE No tenantId in session for transfer-result CallSid: ${CallSid}`);
    res.type('text/xml');
    return res.send(new VoiceResponse().toString());
  }
  const messages = getVoiceMessages(tenantId);

  logger.info(`VOICE Résultat transfert: ${DialCallStatus}, Durée: ${DialCallDuration}s (tenant: ${tenantId})`);

  const twiml = new VoiceResponse();

  if (DialCallStatus === 'completed') {
    // Le responsable a pris l'appel et la conversation est terminée
    logger.info(`VOICE Transfert réussi pour ${CallSid}`);
    await sayWithTTS(twiml, messages.goodbye);
    cleanupVoiceService(CallSid);
    cleanupVoiceSession(CallSid);
  } else {
    // Le responsable n'a pas répondu ou a refusé
    logger.info(`VOICE Transfert échoué: ${DialCallStatus} (tenant: ${tenantId})`);

    // Utiliser gatherWithBargeIn pour que l'audio soit DANS le gather
    // Cela permet au client d'interrompre l'assistant
    await gatherWithBargeIn(twiml,
      messages.unavailableAlt,
      { timeout: 8, tenantId }
    );

    // Timeout - si pas de réponse
    await sayWithTTS(twiml, messages.goodbye);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// ============================================================
// === ENREGISTREMENT VOCAL ===
// ============================================================

// ⚠️ SECURED: Validates Twilio signature
router.post('/voice/recording', validateTwilioSignature, async (req, res) => {
  const { RecordingUrl, RecordingSid, From, CallSid, RecordingDuration } = req.body;

  // V2 - Récupérer le tenantId depuis la session
  const session = voiceSessions.get(CallSid);
  const tenantId = session?.tenantId;
  const messages = getVoiceMessages(tenantId);

  // 🔒 TENANT ISOLATION: Reject if no tenant
  if (!tenantId) {
    logger.error(`VOICE TENANT_REQUIRED: No tenant for recording ${RecordingSid}`);
    return res.sendStatus(400);
  }

  logger.info(`VOICE Recording received: ${RecordingSid} for tenant ${tenantId}`);

  // Save recording to database and storage
  try {
    await saveVoiceRecording(tenantId, {
      RecordingUrl,
      RecordingSid,
      CallSid,
      From,
      Duration: RecordingDuration
    });
    logger.info(`VOICE Recording saved: ${RecordingSid}`);
  } catch (err) {
    logger.error(`VOICE Failed to save recording: ${err.message}`);
    // Continue anyway - user should still hear confirmation
  }

  const twiml = new VoiceResponse();
  await sayWithTTS(twiml, messages.messageRecorded);

  res.type('text/xml');
  res.send(twiml.toString());
});

// ⚠️ SECURED: Validates Twilio signature
router.post('/voice/transcription', validateTwilioSignature, async (req, res) => {
  const { TranscriptionText, RecordingSid, From, CallSid } = req.body;

  // Récupérer le tenantId depuis la session
  const session = voiceSessions.get(CallSid);
  const tenantId = session?.tenantId;

  const tenantLabel = tenantId ? tenantId : 'inconnu';
  logger.info(`VOICE Transcription reçue pour tenant ${tenantLabel}: ${TranscriptionText?.substring(0, 100)}`);

  // TODO: Envoyer la transcription au responsable par SMS ou email (tenant-specific)

  res.sendStatus(200);
});

// ============================================================
// === WEBHOOK SMS AVEC IA (MULTI-TENANT) ===
// ============================================================

// ⚠️ SECURED: Validates Twilio signature
router.post('/sms', validateTwilioSignature, async (req, res) => {
  const { From, To, Body, MessageSid } = req.body;

  // MULTI-TENANT: Identifier le tenant par le numéro appelé
  const { tenantId, config: tenantConfig } = getTenantByPhoneNumber(To);

  logger.info(`SMS De: ${From} vers ${To}, Tenant: ${tenantId}`);
  logger.info(`SMS Message: ${Body?.substring(0, 100)}`);

  // 🔒 TENANT ISOLATION: Rejeter si tenant inconnu
  if (!tenantId) {
    logger.error(`SMS TENANT_NOT_FOUND: Rejecting SMS from ${From} to unknown number ${To}`);
    const twiml = new MessagingResponse();
    twiml.message("Désolé, ce numéro n'est plus en service.");
    res.type('text/xml');
    return res.send(twiml.toString());
  }

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

    logger.info(`SMS Réponse envoyée pour tenant ${tenantId}`);

    twiml.message(result.response);

    // Nettoyer - chaque SMS est indépendant
    clearConversation(conversationId);

  } catch (error) {
    logger.error(`SMS Erreur pour tenant ${tenantId}: ${error.message}`);
    // Réponse générique dynamique — pas de nom hardcodé
    const businessName = tenantConfig?.name || 'Nous';
    twiml.message(`Merci pour votre message ! ${businessName} vous répond bientôt.`);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// ⚠️ SECURED: Validates Twilio signature (loose for status callbacks)
router.post('/sms/status', validateTwilioSignatureLoose, (req, res) => {
  const { MessageSid, MessageStatus, To, ErrorCode } = req.body;

  logger.info(`SMS Statut ${MessageSid}: ${MessageStatus}`);
  if (ErrorCode) logger.error(`SMS Erreur ${MessageSid}: ${ErrorCode}`);

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
    service: 'NEXUS Voice AI',
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
