/**
 * Service de synthèse vocale OpenAI TTS
 *
 * REMPLACEMENT DE ELEVENLABS - 16x MOINS CHER
 *
 * Coûts comparatifs (par 1000 caractères):
 * - ElevenLabs: ~$0.30
 * - OpenAI TTS-1: $0.015 (20x moins cher)
 * - OpenAI TTS-1-HD: $0.030 (10x moins cher)
 *
 * Voix disponibles:
 * - alloy: neutre, polyvalent
 * - echo: masculin, chaleureux
 * - fable: narratif, expressif
 * - nova: féminin, chaleureux (recommandé pour Halimah)
 * - onyx: masculin, grave
 * - shimmer: féminin, clair
 *
 * @module openaiTTSService
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import OpenAI from 'openai';

// ============================================
// CONFIGURATION
// ============================================

// Lazy-init: ne pas crash au chargement si OPENAI_API_KEY absent
let _openai = null;
function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) return null;
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

// Dossier de cache audio (réutilise le même que ElevenLabs)
const CACHE_DIR = path.join(process.cwd(), 'data', 'voice-cache');

// Créer le dossier cache s'il n'existe pas
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log('[OPENAI TTS] Dossier cache créé:', CACHE_DIR);
}

// Configuration par défaut
const DEFAULT_VOICE = process.env.OPENAI_TTS_VOICE || 'nova'; // nova = féminin chaleureux
const DEFAULT_MODEL = process.env.OPENAI_TTS_MODEL || 'tts-1'; // tts-1 = rapide, tts-1-hd = qualité
const DEFAULT_SPEED = 1.0; // 0.25 à 4.0

// Statistiques d'utilisation
let stats = {
  totalCharacters: 0,
  cachedHits: 0,
  apiCalls: 0,
  charactersSaved: 0,
  sessionStart: new Date().toISOString()
};

// ============================================
// PHRASES PRÉ-GÉNÉRÉES (même structure que ElevenLabs)
// ============================================

const PREGENERATED_PHRASES = {
  // Salutations
  'bonjour': "Bonjour ! Comment allez-vous ?",
  'bonsoir': "Bonsoir ! Comment allez-vous ?",

  // Présentations
  'je_suis_halimah': "Moi c'est Halimah, enchantée !",
  'bienvenue': "Bienvenue chez Fat's Hair-Afro !",

  // Confirmations
  'ok': "D'accord !",
  'parfait': "Parfait !",
  'super': "Super !",
  'cest_note': "C'est noté !",
  'tres_bien': "Très bien !",

  // Transitions
  'un_instant': "Un petit instant...",
  'je_verifie': "Je vérifie les disponibilités...",

  // Questions
  'ca_vous_va': "Ça vous va ?",
  'autre_chose': "Vous avez besoin d'autre chose ?",

  // Au revoir
  'au_revoir': "Au revoir, à bientôt !",
  'bonne_journee': "Bonne journée !",
  'bonne_soiree': "Bonne soirée !",
};

// ============================================
// CACHE AUDIO
// ============================================

/**
 * Génère un hash unique pour un texte
 */
function getTextHash(text, voice) {
  const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
  return crypto.createHash('md5').update(`openai_${normalized}_${voice}`).digest('hex');
}

/**
 * Vérifie si l'audio est en cache
 */
function getCachedAudio(text, voice = DEFAULT_VOICE) {
  const hash = getTextHash(text, voice);
  const cachePath = path.join(CACHE_DIR, `${hash}.mp3`);

  if (fs.existsSync(cachePath)) {
    stats.cachedHits++;
    stats.charactersSaved += text.length;
    console.log(`[OPENAI TTS] Cache HIT: "${text.substring(0, 30)}..."`);
    return fs.readFileSync(cachePath);
  }

  return null;
}

/**
 * Sauvegarde l'audio en cache
 */
function cacheAudio(text, voice, audioBuffer) {
  const hash = getTextHash(text, voice);
  const cachePath = path.join(CACHE_DIR, `${hash}.mp3`);
  fs.writeFileSync(cachePath, audioBuffer);
  console.log(`[OPENAI TTS] Cached: "${text.substring(0, 30)}..."`);
}

// ============================================
// OPTIMISATION DU TEXTE
// ============================================

/**
 * Optimise le texte pour réduire les caractères
 */
function optimizeText(text) {
  let optimized = text;

  // Supprimer les espaces multiples
  optimized = optimized.replace(/\s+/g, ' ').trim();

  // Supprimer les emojis
  optimized = optimized.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

  // Raccourcir les formulations verbeuses
  const shortenings = {
    "je vous confirme que": "c'est confirmé,",
    "je vous informe que": "",
    "est-ce que vous": "vous",
    "est-ce que": "",
    "n'hésitez pas à": "",
    "je vous remercie pour": "merci pour",
    "actuellement": "",
    "également": "aussi",
    "néanmoins": "mais",
    "par conséquent": "donc",
  };

  for (const [long, short] of Object.entries(shortenings)) {
    optimized = optimized.replace(new RegExp(long, 'gi'), short);
  }

  // Convertir les symboles
  optimized = optimized.replace(/(\d+)\s*€/g, '$1 euros');
  optimized = optimized.replace(/(\d{1,2})\s*[hH](\d{2})/g, '$1 heures $2');
  optimized = optimized.replace(/(\d{1,2})\s*[hH](?![a-z])/gi, '$1 heures');

  // Supprimer le markdown
  optimized = optimized.replace(/\*\*(.*?)\*\*/g, '$1');
  optimized = optimized.replace(/\*(.*?)\*/g, '$1');

  return optimized.replace(/\s+/g, ' ').trim();
}

// ============================================
// APPEL API OPENAI TTS
// ============================================

/**
 * Appelle l'API OpenAI TTS
 */
async function callOpenAITTS(text, voice = DEFAULT_VOICE, model = DEFAULT_MODEL) {
  stats.apiCalls++;
  stats.totalCharacters += text.length;

  console.log(`[OPENAI TTS] API Call: "${text.substring(0, 40)}..." (${text.length} chars, voice: ${voice})`);

  try {
    const client = getOpenAI();
    if (!client) throw new Error('OPENAI_API_KEY non configuré');
    const mp3Response = await client.audio.speech.create({
      model: model,
      voice: voice,
      input: text,
      speed: DEFAULT_SPEED,
      response_format: 'mp3'
    });

    // Convertir la réponse en Buffer
    const arrayBuffer = await mp3Response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Log coût estimé
    const costPer1000 = model === 'tts-1-hd' ? 0.030 : 0.015;
    const cost = (text.length / 1000) * costPer1000;
    console.log(`[OPENAI TTS] Coût estimé: $${cost.toFixed(4)}`);

    return audioBuffer;

  } catch (error) {
    console.error('[OPENAI TTS] Erreur API:', error.message);
    throw error;
  }
}

// ============================================
// FONCTIONS PRINCIPALES
// ============================================

/**
 * Convertit du texte en audio avec cache
 */
async function textToSpeech(text, options = {}) {
  const {
    voice = DEFAULT_VOICE,
    model = DEFAULT_MODEL,
    useCache = true,
    optimize = true
  } = options;

  // Optimiser le texte
  let processedText = optimize ? optimizeText(text) : text;

  if (optimize && processedText.length < text.length) {
    const saved = text.length - processedText.length;
    console.log(`[OPENAI TTS] Optimisé: ${text.length} → ${processedText.length} chars (-${saved})`);
  }

  // Vérifier le cache
  if (useCache) {
    const cached = getCachedAudio(processedText, voice);
    if (cached) {
      return {
        success: true,
        audio: cached,
        fromCache: true,
        characters: 0
      };
    }
  }

  // Appeler l'API
  try {
    const audio = await callOpenAITTS(processedText, voice, model);

    // Mettre en cache
    if (useCache) {
      cacheAudio(processedText, voice, audio);
    }

    return {
      success: true,
      audio,
      fromCache: false,
      characters: processedText.length
    };

  } catch (error) {
    console.error('[OPENAI TTS] Erreur TTS:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Génère l'audio pour une réponse complète (découpe en segments)
 */
async function textToSpeechSmart(text, options = {}) {
  const { voice = DEFAULT_VOICE, model = DEFAULT_MODEL } = options;

  // Découper en segments (par phrase)
  const segments = text
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0);

  const audioBuffers = [];
  let totalChars = 0;
  let cachedChars = 0;

  for (const segment of segments) {
    const result = await textToSpeech(segment, { voice, model });

    if (result.success) {
      audioBuffers.push(result.audio);
      if (result.fromCache) {
        cachedChars += segment.length;
      } else {
        totalChars += result.characters;
      }
    }
  }

  // Concaténer les audios
  const finalAudio = Buffer.concat(audioBuffers);

  return {
    success: true,
    audio: finalAudio,
    stats: {
      segments: segments.length,
      charactersUsed: totalChars,
      charactersCached: cachedChars,
      percentSaved: cachedChars > 0
        ? Math.round((cachedChars / (totalChars + cachedChars)) * 100)
        : 0
    }
  };
}

/**
 * Streaming TTS (OpenAI supporte le streaming)
 */
async function textToSpeechStream(text, options = {}) {
  const { voice = DEFAULT_VOICE, model = DEFAULT_MODEL } = options;

  const processedText = optimizeText(text);

  console.log(`[OPENAI TTS] Stream: "${processedText.substring(0, 50)}..."`);

  try {
    const client = getOpenAI();
    if (!client) throw new Error('OPENAI_API_KEY non configuré');
    const response = await client.audio.speech.create({
      model: model,
      voice: voice,
      input: processedText,
      speed: DEFAULT_SPEED,
      response_format: 'mp3'
    });

    stats.apiCalls++;
    stats.totalCharacters += processedText.length;

    // Retourner le body comme stream
    return response.body;

  } catch (error) {
    console.error('[OPENAI TTS] Erreur stream:', error.message);
    throw error;
  }
}

// ============================================
// GESTION DU CACHE
// ============================================

/**
 * Vide le cache audio OpenAI
 */
function clearCache() {
  const files = fs.readdirSync(CACHE_DIR).filter(f => f.startsWith('openai_') || f.endsWith('.mp3'));
  files.forEach(file => {
    fs.unlinkSync(path.join(CACHE_DIR, file));
  });
  console.log(`[OPENAI TTS] Cache vidé: ${files.length} fichiers supprimés`);
  return { cleared: files.length };
}

/**
 * Statistiques du cache et de la session
 */
function getCacheStats() {
  let files = [];
  let totalSize = 0;

  try {
    files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.mp3'));
    files.forEach(file => {
      const stat = fs.statSync(path.join(CACHE_DIR, file));
      totalSize += stat.size;
    });
  } catch (error) {
    console.error('[OPENAI TTS] Erreur lecture cache:', error.message);
  }

  return {
    cacheFiles: files.length,
    cacheSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
    ...stats,
    savingsPercent: stats.totalCharacters > 0
      ? Math.round((stats.charactersSaved / (stats.totalCharacters + stats.charactersSaved)) * 100)
      : 0,
    provider: 'openai',
    model: DEFAULT_MODEL,
    voice: DEFAULT_VOICE
  };
}

/**
 * Pré-génère les phrases courantes
 */
async function pregenerateCommonPhrases(voice = DEFAULT_VOICE) {
  console.log('[OPENAI TTS] Pré-génération des phrases courantes...');

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const [key, phrase] of Object.entries(PREGENERATED_PHRASES)) {
    const cached = getCachedAudio(phrase, voice);
    if (cached) {
      skipped++;
      continue;
    }

    try {
      const result = await textToSpeech(phrase, { voice, useCache: true, optimize: false });
      if (result.success) {
        generated++;
        console.log(`[OPENAI TTS] Généré: ${key}`);
      } else {
        errors++;
      }
    } catch (error) {
      console.error(`[OPENAI TTS] Erreur pour ${key}:`, error.message);
      errors++;
    }

    // Pause pour éviter rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`[OPENAI TTS] Terminé: ${generated} générés, ${skipped} en cache, ${errors} erreurs`);
  return { generated, skipped, errors };
}

/**
 * Réinitialise les statistiques
 */
function resetStats() {
  stats = {
    totalCharacters: 0,
    cachedHits: 0,
    apiCalls: 0,
    charactersSaved: 0,
    sessionStart: new Date().toISOString()
  };
  return stats;
}

/**
 * Vérifie si le service est configuré
 */
function isConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Liste les voix disponibles
 */
function listVoices() {
  return [
    { id: 'alloy', name: 'Alloy', description: 'Neutre, polyvalent' },
    { id: 'echo', name: 'Echo', description: 'Masculin, chaleureux' },
    { id: 'fable', name: 'Fable', description: 'Narratif, expressif' },
    { id: 'nova', name: 'Nova', description: 'Féminin, chaleureux (recommandé)' },
    { id: 'onyx', name: 'Onyx', description: 'Masculin, grave' },
    { id: 'shimmer', name: 'Shimmer', description: 'Féminin, clair' }
  ];
}

// ============================================
// EXPORTS
// ============================================

export default {
  textToSpeech,
  textToSpeechSmart,
  textToSpeechStream,
  pregenerateCommonPhrases,
  clearCache,
  getCacheStats,
  listVoices,
  resetStats,
  isConfigured,
  optimizeText,
  getTextHash,
  PREGENERATED_PHRASES,
  DEFAULT_VOICE,
  DEFAULT_MODEL,
  CACHE_DIR
};

export {
  textToSpeech,
  textToSpeechSmart,
  textToSpeechStream,
  pregenerateCommonPhrases,
  clearCache,
  getCacheStats,
  listVoices,
  resetStats,
  isConfigured,
  optimizeText,
  getTextHash,
  PREGENERATED_PHRASES,
  DEFAULT_VOICE,
  DEFAULT_MODEL,
  CACHE_DIR
};
