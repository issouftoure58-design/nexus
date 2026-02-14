/**
 * Service TTS Unifié - Routage intelligent entre providers
 *
 * OPTIMISATION COÛTS:
 * - OpenAI TTS (défaut): $0.015/1000 chars - 16x moins cher qu'ElevenLabs
 * - ElevenLabs (premium): $0.30/1000 chars - meilleure qualité voix clonées
 *
 * Le service utilise OpenAI par défaut et fallback sur ElevenLabs si:
 * - Variable TTS_PROVIDER=elevenlabs
 * - OpenAI non configuré
 * - Voix personnalisée ElevenLabs demandée
 *
 * @module ttsService
 */

import openaiTTS from './openaiTTSService.js';
import elevenLabsTTS from './voiceService.js';

// ============================================
// CONFIGURATION
// ============================================

// Provider par défaut: OpenAI (16x moins cher)
const DEFAULT_PROVIDER = process.env.TTS_PROVIDER || 'openai';

// Mapping voix OpenAI vers description
const OPENAI_VOICES = {
  'alloy': { name: 'Alloy', style: 'neutral' },
  'echo': { name: 'Echo', style: 'male-warm' },
  'fable': { name: 'Fable', style: 'narrative' },
  'nova': { name: 'Nova', style: 'female-warm' },
  'onyx': { name: 'Onyx', style: 'male-deep' },
  'shimmer': { name: 'Shimmer', style: 'female-clear' }
};

// Statistiques unifiées
let stats = {
  openaiCalls: 0,
  openaiChars: 0,
  elevenLabsCalls: 0,
  elevenLabsChars: 0,
  cachedHits: 0,
  estimatedSavings: 0,
  sessionStart: new Date().toISOString()
};

// ============================================
// SÉLECTION DU PROVIDER
// ============================================

/**
 * Détermine le meilleur provider pour une requête
 */
function selectProvider(options = {}) {
  const { voiceId, forceProvider, requireClonedVoice } = options;

  // Force explicite
  if (forceProvider === 'elevenlabs') {
    if (!elevenLabsTTS.isConfigured()) {
      console.warn('[TTS] ElevenLabs forcé mais non configuré, fallback OpenAI');
      return 'openai';
    }
    return 'elevenlabs';
  }

  if (forceProvider === 'openai') {
    if (!openaiTTS.isConfigured()) {
      console.warn('[TTS] OpenAI forcé mais non configuré, fallback ElevenLabs');
      return 'elevenlabs';
    }
    return 'openai';
  }

  // Voix clonée ElevenLabs demandée
  if (requireClonedVoice || (voiceId && !OPENAI_VOICES[voiceId])) {
    if (elevenLabsTTS.isConfigured()) {
      return 'elevenlabs';
    }
    console.warn('[TTS] Voix ElevenLabs demandée mais non configuré');
  }

  // Provider par défaut selon config
  if (DEFAULT_PROVIDER === 'elevenlabs' && elevenLabsTTS.isConfigured()) {
    return 'elevenlabs';
  }

  // OpenAI par défaut (moins cher)
  if (openaiTTS.isConfigured()) {
    return 'openai';
  }

  // Fallback ElevenLabs
  if (elevenLabsTTS.isConfigured()) {
    return 'elevenlabs';
  }

  return null;
}

// ============================================
// FONCTIONS PRINCIPALES
// ============================================

/**
 * Convertit du texte en audio (routing automatique)
 */
async function textToSpeech(text, options = {}) {
  const provider = selectProvider(options);

  if (!provider) {
    return {
      success: false,
      error: 'Aucun service TTS configuré (OPENAI_API_KEY ou ELEVENLABS_API_KEY requis)'
    };
  }

  console.log(`[TTS] Provider: ${provider.toUpperCase()}`);

  try {
    let result;

    if (provider === 'openai') {
      const voice = options.voice || options.voiceId || openaiTTS.DEFAULT_VOICE;
      result = await openaiTTS.textToSpeech(text, {
        voice: OPENAI_VOICES[voice] ? voice : 'nova',
        useCache: options.useCache !== false,
        optimize: options.optimize !== false
      });

      if (result.success && !result.fromCache) {
        stats.openaiCalls++;
        stats.openaiChars += result.characters || text.length;
        // Calcul économies vs ElevenLabs
        const elevenLabsCost = (text.length / 1000) * 0.30;
        const openaiCost = (text.length / 1000) * 0.015;
        stats.estimatedSavings += (elevenLabsCost - openaiCost);
      }
    } else {
      result = await elevenLabsTTS.textToSpeech(text, {
        voiceId: options.voiceId,
        useCache: options.useCache !== false,
        optimize: options.optimize !== false
      });

      if (result.success && !result.fromCache) {
        stats.elevenLabsCalls++;
        stats.elevenLabsChars += result.characters || text.length;
      }
    }

    if (result.fromCache) {
      stats.cachedHits++;
    }

    return {
      ...result,
      provider
    };

  } catch (error) {
    console.error(`[TTS] Erreur ${provider}:`, error.message);

    // Fallback sur l'autre provider
    const fallbackProvider = provider === 'openai' ? 'elevenlabs' : 'openai';
    const fallbackService = fallbackProvider === 'openai' ? openaiTTS : elevenLabsTTS;

    if (fallbackService.isConfigured()) {
      console.log(`[TTS] Fallback sur ${fallbackProvider}`);
      return textToSpeech(text, { ...options, forceProvider: fallbackProvider });
    }

    return { success: false, error: error.message };
  }
}

/**
 * Synthèse intelligente (découpe en segments)
 */
async function textToSpeechSmart(text, options = {}) {
  const provider = selectProvider(options);

  if (!provider) {
    return {
      success: false,
      error: 'Aucun service TTS configuré'
    };
  }

  const service = provider === 'openai' ? openaiTTS : elevenLabsTTS;
  const result = await service.textToSpeechSmart(text, options);

  return {
    ...result,
    provider
  };
}

/**
 * Synthèse en streaming
 */
async function textToSpeechStream(text, options = {}) {
  const provider = selectProvider(options);

  if (!provider) {
    throw new Error('Aucun service TTS configuré');
  }

  const service = provider === 'openai' ? openaiTTS : elevenLabsTTS;
  return service.textToSpeechStream(text, options);
}

// ============================================
// GESTION CACHE & STATS
// ============================================

/**
 * Statistiques unifiées
 */
function getStats() {
  const openaiStats = openaiTTS.isConfigured() ? openaiTTS.getCacheStats() : null;
  const elevenLabsStats = elevenLabsTTS.isConfigured() ? elevenLabsTTS.getCacheStats() : null;

  return {
    providers: {
      openai: {
        configured: openaiTTS.isConfigured(),
        calls: stats.openaiCalls,
        characters: stats.openaiChars,
        estimatedCost: `$${(stats.openaiChars / 1000 * 0.015).toFixed(4)}`,
        ...(openaiStats || {})
      },
      elevenlabs: {
        configured: elevenLabsTTS.isConfigured(),
        calls: stats.elevenLabsCalls,
        characters: stats.elevenLabsChars,
        estimatedCost: `$${(stats.elevenLabsChars / 1000 * 0.30).toFixed(4)}`,
        ...(elevenLabsStats || {})
      }
    },
    unified: {
      totalCalls: stats.openaiCalls + stats.elevenLabsCalls,
      totalCharacters: stats.openaiChars + stats.elevenLabsChars,
      cachedHits: stats.cachedHits,
      estimatedSavings: `$${stats.estimatedSavings.toFixed(4)}`,
      defaultProvider: DEFAULT_PROVIDER,
      sessionStart: stats.sessionStart
    }
  };
}

/**
 * Vide tous les caches
 */
function clearAllCaches() {
  let results = {};

  if (openaiTTS.isConfigured()) {
    results.openai = openaiTTS.clearCache();
  }

  if (elevenLabsTTS.isConfigured()) {
    results.elevenlabs = elevenLabsTTS.clearCache();
  }

  return results;
}

/**
 * Pré-génère les phrases communes (sur le provider par défaut)
 */
async function pregenerateCommonPhrases(options = {}) {
  const provider = selectProvider(options);

  if (!provider) {
    return { error: 'Aucun service TTS configuré' };
  }

  const service = provider === 'openai' ? openaiTTS : elevenLabsTTS;
  return service.pregenerateCommonPhrases(options.voice || options.voiceId);
}

/**
 * Liste les voix disponibles
 */
async function listVoices() {
  const voices = {
    openai: [],
    elevenlabs: []
  };

  if (openaiTTS.isConfigured()) {
    voices.openai = openaiTTS.listVoices();
  }

  if (elevenLabsTTS.isConfigured()) {
    voices.elevenlabs = await elevenLabsTTS.listVoices();
  }

  return voices;
}

/**
 * Vérifie si au moins un provider est configuré
 */
function isConfigured() {
  return openaiTTS.isConfigured() || elevenLabsTTS.isConfigured();
}

/**
 * Réinitialise les statistiques
 */
function resetStats() {
  stats = {
    openaiCalls: 0,
    openaiChars: 0,
    elevenLabsCalls: 0,
    elevenLabsChars: 0,
    cachedHits: 0,
    estimatedSavings: 0,
    sessionStart: new Date().toISOString()
  };

  if (openaiTTS.isConfigured()) openaiTTS.resetStats();
  if (elevenLabsTTS.isConfigured()) elevenLabsTTS.resetStats();

  return stats;
}

// ============================================
// EXPORTS
// ============================================

export default {
  textToSpeech,
  textToSpeechSmart,
  textToSpeechStream,
  pregenerateCommonPhrases,
  clearAllCaches,
  getStats,
  listVoices,
  resetStats,
  isConfigured,
  selectProvider,
  DEFAULT_PROVIDER,
  OPENAI_VOICES
};

export {
  textToSpeech,
  textToSpeechSmart,
  textToSpeechStream,
  pregenerateCommonPhrases,
  clearAllCaches,
  getStats,
  listVoices,
  resetStats,
  isConfigured,
  selectProvider,
  DEFAULT_PROVIDER,
  OPENAI_VOICES
};
