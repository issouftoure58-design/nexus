/**
 * Configuration OpenAI Realtime API (GA) par tenant
 *
 * Gere les parametres de session WebSocket pour la voix temps reel.
 * Chaque tenant peut avoir sa propre voix et ses propres seuils VAD.
 *
 * Format GA (aout 2025) — audio/pcmu, model gpt-realtime
 */

import { getTenantConfig } from '../config/tenants/index.js';

const OPENAI_REALTIME_MODEL = 'gpt-realtime';

/**
 * Configuration par defaut pour OpenAI Realtime GA
 */
const DEFAULT_CONFIG = {
  model: OPENAI_REALTIME_MODEL,
  voice: 'alloy',
  temperature: 0.5,
  max_response_output_tokens: 500,
  turn_detection: {
    type: 'server_vad',
    threshold: 0.7,
    prefix_padding_ms: 300,
    silence_duration_ms: 400,
  },
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

  const config = {
    ...DEFAULT_CONFIG,
    turn_detection: { ...DEFAULT_CONFIG.turn_detection },
  };

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
