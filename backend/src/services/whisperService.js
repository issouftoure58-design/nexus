/**
 * Service de transcription audio — OpenAI Whisper
 *
 * Transcrit les notes vocales WhatsApp (audio/ogg) en texte.
 * Utilise Whisper-1 via l'API OpenAI.
 *
 * Coût : ~$0.006 / minute d'audio
 *
 * PROTECTIONS ANTI-ABUS :
 * - Taille max fichier : 2 Mo (~2 min de voix WhatsApp ogg)
 * - Rate limit par numéro : 10 notes vocales / 10 min
 * - Coût crédits : whatsapp_voice_note (10 cr) au lieu de whatsapp_message (7 cr)
 *
 * @module whisperService
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { registerInterval } from '../utils/intervalRegistry.js';

// ============================================
// CONFIGURATION
// ============================================

// Lazy-init OpenAI client
let _openai = null;
function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) return null;
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Dossier temporaire pour les fichiers audio téléchargés
const TMP_DIR = path.join(process.cwd(), 'data', 'voice-tmp');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// Limites anti-abus
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Mo (~2 min d'audio WhatsApp ogg)
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 10; // 10 notes vocales max par fenêtre

// Rate limiter en mémoire (par numéro de téléphone)
const rateLimitMap = new Map(); // phone -> [timestamps]

// ============================================
// RATE LIMITING
// ============================================

/**
 * Vérifie si un numéro est rate-limité
 * @param {string} phoneNumber
 * @returns {{ allowed: boolean, remaining: number }}
 */
function checkRateLimit(phoneNumber) {
  const now = Date.now();
  const key = phoneNumber.replace(/\D/g, '');

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, []);
  }

  const timestamps = rateLimitMap.get(key);

  // Nettoyer les anciennes entrées
  const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  rateLimitMap.set(key, validTimestamps);

  if (validTimestamps.length >= RATE_LIMIT_MAX) {
    console.warn(`[WHISPER] ⛔ Rate limit: ${key} a envoyé ${validTimestamps.length} notes vocales en ${RATE_LIMIT_WINDOW_MS / 60000} min`);
    return { allowed: false, remaining: 0 };
  }

  // Enregistrer ce nouveau request
  validTimestamps.push(now);
  return { allowed: true, remaining: RATE_LIMIT_MAX - validTimestamps.length };
}

// Nettoyage périodique du rate limiter (toutes les 30 min)
const _whisperCleanupId = setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, valid);
    }
  }
}, 30 * 60 * 1000);
registerInterval('whisperService:rateLimitCleanup', _whisperCleanupId);

// ============================================
// DOWNLOAD + TRANSCRIPTION
// ============================================

/**
 * Télécharge un fichier audio depuis une URL Twilio
 * Inclut vérification de taille max
 *
 * @param {string} mediaUrl - URL du fichier audio (Twilio)
 * @returns {Promise<{ filePath: string, sizeBytes: number }>}
 */
async function downloadTwilioMedia(mediaUrl) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;

  const headers = {};
  if (sid && token) {
    headers['Authorization'] = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
  }

  const response = await fetch(mediaUrl, { headers });
  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.status} ${response.statusText}`);
  }

  // Vérifier la taille AVANT de tout lire en mémoire
  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_FILE_SIZE) {
    throw new Error(`AUDIO_TOO_LARGE: ${(contentLength / 1024 / 1024).toFixed(1)} Mo > ${MAX_FILE_SIZE / 1024 / 1024} Mo max`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Double vérification après download (content-length peut être absent)
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`AUDIO_TOO_LARGE: ${(buffer.length / 1024 / 1024).toFixed(1)} Mo > ${MAX_FILE_SIZE / 1024 / 1024} Mo max`);
  }

  const hash = crypto.createHash('md5').update(mediaUrl).digest('hex');
  const ext = mediaUrl.includes('.ogg') ? 'ogg' : 'mp3';
  const filePath = path.join(TMP_DIR, `${hash}.${ext}`);

  fs.writeFileSync(filePath, buffer);
  return { filePath, sizeBytes: buffer.length };
}

/**
 * Transcrit un fichier audio avec OpenAI Whisper
 *
 * @param {string} filePath - Chemin du fichier audio local
 * @param {Object} [options]
 * @param {string} [options.language='fr'] - Langue attendue (ISO 639-1)
 * @returns {Promise<{ success: boolean, text?: string, error?: string }>}
 */
async function transcribeFile(filePath, options = {}) {
  const { language = 'fr' } = options;

  const client = getOpenAI();
  if (!client) {
    return { success: false, error: 'OPENAI_API_KEY non configuré' };
  }

  try {
    const transcription = await client.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-1',
      language,
      response_format: 'text',
    });

    console.log(`[WHISPER] Transcription: "${transcription.substring(0, 80)}..."`);

    return { success: true, text: transcription.trim() };
  } catch (error) {
    console.error('[WHISPER] Erreur transcription:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Transcrit un audio depuis une URL Twilio (rate limit + download + transcrit + nettoie)
 *
 * @param {string} mediaUrl - URL du média Twilio (MediaUrl0)
 * @param {Object} [options]
 * @param {string} [options.language='fr'] - Langue attendue
 * @param {string} [options.phoneNumber] - Numéro pour le rate limiting
 * @returns {Promise<{ success: boolean, text?: string, error?: string, rateLimited?: boolean, tooLarge?: boolean }>}
 */
async function transcribeFromUrl(mediaUrl, options = {}) {
  let filePath = null;

  // Rate limiting
  if (options.phoneNumber) {
    const rateCheck = checkRateLimit(options.phoneNumber);
    if (!rateCheck.allowed) {
      return { success: false, error: 'Trop de notes vocales, réessayez dans quelques minutes', rateLimited: true };
    }
  }

  try {
    // 1. Télécharger (avec vérification taille)
    const download = await downloadTwilioMedia(mediaUrl);
    filePath = download.filePath;
    console.log(`[WHISPER] Audio téléchargé: ${filePath} (${(download.sizeBytes / 1024).toFixed(0)} Ko)`);

    // 2. Transcrire
    const result = await transcribeFile(filePath, options);

    return result;
  } catch (error) {
    console.error('[WHISPER] Erreur transcribeFromUrl:', error.message);

    if (error.message.startsWith('AUDIO_TOO_LARGE')) {
      return { success: false, error: 'Note vocale trop longue (2 min max)', tooLarge: true };
    }

    return { success: false, error: error.message };
  } finally {
    // 3. Nettoyer le fichier temporaire
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
  }
}

/**
 * Télécharge un média depuis Meta Cloud API (WhatsApp WABA)
 * 1. GET /media-id → récupère l'URL de téléchargement
 * 2. GET url → télécharge le fichier audio
 *
 * @param {string} mediaId - ID du média Meta (msg.audio.id)
 * @returns {Promise<{ filePath: string, sizeBytes: number }>}
 */
async function downloadMetaMedia(mediaId) {
  const token = process.env.META_WA_ACCESS_TOKEN;
  if (!token) throw new Error('META_WA_ACCESS_TOKEN non configuré');

  // 1. Récupérer l'URL de téléchargement
  const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error(`Meta media lookup failed: ${metaRes.status}`);
  const { url: downloadUrl } = await metaRes.json();

  // 2. Télécharger le fichier
  const response = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Meta media download failed: ${response.status}`);

  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_FILE_SIZE) {
    throw new Error(`AUDIO_TOO_LARGE: ${(contentLength / 1024 / 1024).toFixed(1)} Mo > ${MAX_FILE_SIZE / 1024 / 1024} Mo max`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`AUDIO_TOO_LARGE: ${(buffer.length / 1024 / 1024).toFixed(1)} Mo > ${MAX_FILE_SIZE / 1024 / 1024} Mo max`);
  }

  const hash = crypto.createHash('md5').update(mediaId).digest('hex');
  const filePath = path.join(TMP_DIR, `${hash}.ogg`);
  fs.writeFileSync(filePath, buffer);
  return { filePath, sizeBytes: buffer.length };
}

/**
 * Transcrit un audio depuis un média Meta (rate limit + download + transcrit + nettoie)
 *
 * @param {string} mediaId - ID du média Meta
 * @param {Object} [options]
 * @param {string} [options.language='fr'] - Langue attendue
 * @param {string} [options.phoneNumber] - Numéro pour le rate limiting
 * @returns {Promise<{ success: boolean, text?: string, error?: string }>}
 */
async function transcribeFromMeta(mediaId, options = {}) {
  let filePath = null;

  if (options.phoneNumber) {
    const rateCheck = checkRateLimit(options.phoneNumber);
    if (!rateCheck.allowed) {
      return { success: false, error: 'Trop de notes vocales, réessayez dans quelques minutes', rateLimited: true };
    }
  }

  try {
    const download = await downloadMetaMedia(mediaId);
    filePath = download.filePath;
    console.log(`[WHISPER] Meta audio téléchargé: ${filePath} (${(download.sizeBytes / 1024).toFixed(0)} Ko)`);
    return await transcribeFile(filePath, options);
  } catch (error) {
    console.error('[WHISPER] Erreur transcribeFromMeta:', error.message);
    if (error.message.startsWith('AUDIO_TOO_LARGE')) {
      return { success: false, error: 'Note vocale trop longue (2 min max)', tooLarge: true };
    }
    return { success: false, error: error.message };
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
  }
}

export default {
  transcribeFile,
  transcribeFromUrl,
  transcribeFromMeta,
  downloadTwilioMedia,
  downloadMetaMedia,
  checkRateLimit,
  MAX_FILE_SIZE,
  RATE_LIMIT_MAX,
};

export { transcribeFile, transcribeFromUrl, transcribeFromMeta, downloadTwilioMedia, downloadMetaMedia, checkRateLimit };
