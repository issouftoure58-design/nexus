/**
 * Configuration OpenAI Realtime API par tenant
 *
 * Gere les parametres de session WebSocket pour la voix temps reel.
 * Chaque tenant peut avoir sa propre voix et ses propres seuils VAD.
 */

import { getTenantConfig } from '../config/tenants/index.js';

const OPENAI_REALTIME_MODEL = 'gpt-4o-realtime-preview';

/**
 * Configuration par defaut pour OpenAI Realtime
 */
const DEFAULT_CONFIG = {
  model: OPENAI_REALTIME_MODEL,
  voice: 'coral',
  input_audio_format: 'g711_ulaw',
  output_audio_format: 'g711_ulaw',
  input_audio_transcription: {
    model: 'whisper-1',
  },
  turn_detection: {
    type: 'server_vad',
    threshold: 0.7,            // Seuil normal — le barge-in est gere cote serveur (audio mute)
    prefix_padding_ms: 350,    // Marge standard
    silence_duration_ms: 800,  // Attend 800ms de silence avant de repondre
  },
  temperature: 0.6,
  max_response_output_tokens: 300,
};

/**
 * Retourne la config OpenAI Realtime pour un tenant
 * Merge la config par defaut avec les overrides tenant si disponibles
 *
 * @param {string} tenantId
 * @returns {object} Configuration session OpenAI Realtime
 */
export function getRealtimeConfig(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const config = { ...DEFAULT_CONFIG };

  // Charger overrides depuis la config tenant
  try {
    const tenantCfg = getTenantConfig(tenantId);
    if (tenantCfg?.realtime_voice) {
      const rt = tenantCfg.realtime_voice;
      if (rt.voice) config.voice = rt.voice;
      if (rt.temperature != null) config.temperature = rt.temperature;
      if (rt.silence_duration_ms != null) {
        config.turn_detection.silence_duration_ms = rt.silence_duration_ms;
      }
      if (rt.max_tokens != null) {
        config.max_response_output_tokens = rt.max_tokens;
      }
    }
  } catch {
    // Utiliser les defaults
  }

  return config;
}

/**
 * Verifie si le mode realtime est active pour un tenant
 *
 * @param {string} tenantId
 * @returns {boolean}
 */
export function isRealtimeEnabled(tenantId) {
  // Feature flag global
  if (process.env.VOICE_REALTIME === 'true') return true;

  // Config par tenant
  try {
    const tenantCfg = getTenantConfig(tenantId);
    return tenantCfg?.voice_mode === 'realtime';
  } catch {
    return false;
  }
}

export default { getRealtimeConfig, isRealtimeEnabled };
