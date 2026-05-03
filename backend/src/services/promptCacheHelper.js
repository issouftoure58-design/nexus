/**
 * Prompt Cache Helper — Optimisation coûts API Anthropic
 *
 * cache_control: { type: 'ephemeral' } = cache 5min
 * Cache hit = -90% input tokens | Cache miss (1ère fois) = +25% (une seule fois)
 *
 * Minimum pour activation cache: 1024 tokens (Sonnet/Haiku), 2048 tokens (Opus)
 */

/**
 * Transforme un system prompt string en format array avec cache_control
 * @param {string} text - Le system prompt à cacher
 * @returns {Array<{type: string, text: string, cache_control: {type: string}}>}
 */
export function cachedSystem(text) {
  if (!text) return [];
  return [{
    type: 'text',
    text,
    cache_control: { type: 'ephemeral' }
  }];
}

/**
 * Ajoute cache_control sur le dernier outil du tableau
 * (stratégie Anthropic: cacher prefix = system + tools, le dernier outil marque la fin du prefix)
 * @param {Array} tools - Tableau de définitions d'outils
 * @returns {Array}
 */
export function cachedTools(tools) {
  if (!tools || tools.length === 0) return [];
  return tools.map((t, i) =>
    i === tools.length - 1
      ? { ...t, cache_control: { type: 'ephemeral' } }
      : t
  );
}
