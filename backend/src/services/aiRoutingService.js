/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║   AI ROUTING SERVICE - Optimisation intelligente des appels IA               ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                               ║
 * ║   Combine Cache + Model Routing pour optimiser les couts IA de 70%           ║
 * ║                                                                               ║
 * ║   Flux:                                                                       ║
 * ║   1. Check cache (reponses statiques + cache dynamique)                       ║
 * ║   2. Analyse complexite de la requete                                         ║
 * ║   3. Route vers Haiku (simple) ou Sonnet (complexe)                           ║
 * ║   4. Cache la reponse                                                         ║
 * ║                                                                               ║
 * ║   Economies estimees:                                                         ║
 * ║   - Cache hit: 100% (0 cout)                                                  ║
 * ║   - Haiku vs Sonnet: 88% moins cher                                           ║
 * ║   - Objectif global: -70% couts IA                                            ║
 * ║                                                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

import Anthropic from '@anthropic-ai/sdk';
import modelRouter from './modelRouter.js';
import {
  matchStaticResponse,
  getCachedClaudeResponse,
  cacheClaudeResponse,
  getStats as getCacheStats
} from './optimization/cacheService.js';

// Client Anthropic singleton
let anthropicClient = null;

function getAnthropicClient() {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY non configuree');
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

// Modeles disponibles
const MODELS = {
  HAIKU: 'claude-3-haiku-20240307',
  SONNET: 'claude-sonnet-4-20250514'
};

// Stats du service
const serviceStats = {
  totalRequests: 0,
  cacheHits: 0,
  staticHits: 0,
  haikuCalls: 0,
  sonnetCalls: 0,
  totalTokensIn: 0,
  totalTokensOut: 0,
  estimatedSavings: 0, // en EUR
  errors: 0,
  lastReset: new Date().toISOString()
};

// Prix par 1M tokens (EUR)
const PRICING = {
  haiku: { input: 0.25, output: 1.25 },
  sonnet: { input: 3, output: 15 }
};

/**
 * Calcule le cout d'un appel
 */
function calculateCost(tokensIn, tokensOut, model) {
  const pricing = model.includes('haiku') ? PRICING.haiku : PRICING.sonnet;
  return (tokensIn * pricing.input / 1_000_000) + (tokensOut * pricing.output / 1_000_000);
}

/**
 * Calcule les economies realisees
 */
function calculateSavings(tokensIn, tokensOut, actualModel) {
  const sonnetCost = (tokensIn * PRICING.sonnet.input / 1_000_000) +
                     (tokensOut * PRICING.sonnet.output / 1_000_000);
  const actualCost = calculateCost(tokensIn, tokensOut, actualModel);
  return sonnetCost - actualCost;
}

/**
 * Point d'entree principal - Chat avec routage intelligent
 *
 * @param {string} tenantId - ID du tenant
 * @param {string} userMessage - Message de l'utilisateur
 * @param {object} options - Options supplementaires
 * @param {string} options.systemPrompt - Prompt systeme
 * @param {Array} options.conversationHistory - Historique de conversation
 * @param {Array} options.tools - Outils disponibles
 * @param {string} options.forceModel - Forcer un modele specifique
 * @param {boolean} options.skipCache - Ignorer le cache
 * @param {number} options.maxTokens - Tokens max de reponse
 * @returns {object} { content, model, fromCache, usage, savings }
 */
export async function chat(tenantId, userMessage, options = {}) {
  const {
    systemPrompt = '',
    conversationHistory = [],
    tools = null,
    forceModel = null,
    skipCache = false,
    maxTokens = 2048
  } = options;

  serviceStats.totalRequests++;

  try {
    // 1. Check reponses statiques (gratuit)
    if (!skipCache && conversationHistory.length === 0) {
      const staticMatch = matchStaticResponse(userMessage);
      if (staticMatch) {
        serviceStats.staticHits++;
        serviceStats.cacheHits++;
        return {
          content: staticMatch.response,
          model: 'static',
          fromCache: true,
          cacheType: 'static',
          matchedKey: staticMatch.key,
          usage: { input_tokens: 0, output_tokens: 0 },
          cost: 0,
          savings: calculateCost(500, 200, MODELS.SONNET) // Economie estimee
        };
      }
    }

    // 2. Check cache dynamique
    if (!skipCache && conversationHistory.length === 0) {
      const cacheKey = `${tenantId}:${userMessage}`;
      const cached = getCachedClaudeResponse(cacheKey);
      if (cached) {
        serviceStats.cacheHits++;
        return {
          content: cached.response,
          model: 'cached',
          fromCache: true,
          cacheType: 'dynamic',
          cachedAt: cached.cachedAt,
          usage: { input_tokens: 0, output_tokens: 0 },
          cost: 0,
          savings: calculateCost(500, 200, MODELS.SONNET)
        };
      }
    }

    // 3. Selection du modele
    let selectedModel;
    let routingReason;

    if (forceModel) {
      selectedModel = forceModel;
      routingReason = 'forced';
    } else {
      const routing = modelRouter.selectModel({
        userMessage,
        context: {
          conversationLength: conversationHistory.length,
          hasTenant: !!tenantId,
          hasTools: !!tools
        }
      });
      selectedModel = routing.model;
      routingReason = routing.reason;
    }

    // 4. Appel API
    const client = getAnthropicClient();

    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    const requestParams = {
      model: selectedModel,
      max_tokens: maxTokens,
      messages
    };

    if (systemPrompt) {
      requestParams.system = systemPrompt;
    }

    if (tools && tools.length > 0) {
      requestParams.tools = tools;
    }

    const response = await client.messages.create(requestParams);

    // 5. Extraire le contenu
    const textContent = response.content.find(c => c.type === 'text');
    const content = textContent?.text || '';

    // 6. Calculer les stats
    const tokensIn = response.usage.input_tokens;
    const tokensOut = response.usage.output_tokens;
    const cost = calculateCost(tokensIn, tokensOut, selectedModel);
    const savings = calculateSavings(tokensIn, tokensOut, selectedModel);

    // 7. Update stats
    if (selectedModel.includes('haiku')) {
      serviceStats.haikuCalls++;
    } else {
      serviceStats.sonnetCalls++;
    }
    serviceStats.totalTokensIn += tokensIn;
    serviceStats.totalTokensOut += tokensOut;
    serviceStats.estimatedSavings += savings;

    // 8. Cache la reponse (seulement pour les requetes simples sans outils)
    if (!skipCache && conversationHistory.length === 0 && !tools && content.length < 2000) {
      const cacheKey = `${tenantId}:${userMessage}`;
      cacheClaudeResponse(cacheKey, content, {
        tenantId,
        model: selectedModel,
        tokens: tokensIn + tokensOut
      });
    }

    return {
      content,
      model: selectedModel,
      fromCache: false,
      routingReason,
      usage: response.usage,
      cost,
      savings,
      stopReason: response.stop_reason,
      toolUse: response.content.filter(c => c.type === 'tool_use')
    };

  } catch (error) {
    serviceStats.errors++;
    console.error('[AI_ROUTING] Erreur:', error.message);
    throw error;
  }
}

/**
 * Chat avec streaming
 */
export async function chatStream(tenantId, userMessage, options = {}) {
  const {
    systemPrompt = '',
    conversationHistory = [],
    tools = null,
    forceModel = null,
    maxTokens = 4096,
    onText = null,
    onToolUse = null
  } = options;

  serviceStats.totalRequests++;

  try {
    // Selection du modele (pas de cache pour streaming)
    let selectedModel;
    if (forceModel) {
      selectedModel = forceModel;
    } else {
      const routing = modelRouter.selectModel({
        userMessage,
        context: {
          conversationLength: conversationHistory.length,
          hasTenant: !!tenantId,
          hasTools: !!tools
        }
      });
      selectedModel = routing.model;
    }

    const client = getAnthropicClient();

    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    const requestParams = {
      model: selectedModel,
      max_tokens: maxTokens,
      messages,
      stream: true
    };

    if (systemPrompt) {
      requestParams.system = systemPrompt;
    }

    if (tools && tools.length > 0) {
      requestParams.tools = tools;
    }

    const stream = client.messages.stream(requestParams);

    // Variables pour collecter la reponse
    let fullText = '';
    let usage = { input_tokens: 0, output_tokens: 0 };
    const toolUses = [];

    // Handler d'evenements
    stream.on('text', (text) => {
      fullText += text;
      if (onText) onText(text);
    });

    stream.on('message', (message) => {
      usage = message.usage;
      const toolUseBlocks = message.content.filter(c => c.type === 'tool_use');
      toolUses.push(...toolUseBlocks);
      if (onToolUse && toolUseBlocks.length > 0) {
        toolUseBlocks.forEach(tu => onToolUse(tu));
      }
    });

    // Attendre la fin
    const finalMessage = await stream.finalMessage();

    // Update stats
    if (selectedModel.includes('haiku')) {
      serviceStats.haikuCalls++;
    } else {
      serviceStats.sonnetCalls++;
    }
    serviceStats.totalTokensIn += usage.input_tokens;
    serviceStats.totalTokensOut += usage.output_tokens;

    const cost = calculateCost(usage.input_tokens, usage.output_tokens, selectedModel);
    const savings = calculateSavings(usage.input_tokens, usage.output_tokens, selectedModel);
    serviceStats.estimatedSavings += savings;

    return {
      content: fullText,
      model: selectedModel,
      fromCache: false,
      usage,
      cost,
      savings,
      stopReason: finalMessage.stop_reason,
      toolUse: toolUses
    };

  } catch (error) {
    serviceStats.errors++;
    console.error('[AI_ROUTING] Stream error:', error.message);
    throw error;
  }
}

/**
 * Appel simple sans historique (optimise pour les taches ponctuelles)
 */
export async function complete(tenantId, prompt, options = {}) {
  return chat(tenantId, prompt, {
    ...options,
    conversationHistory: []
  });
}

/**
 * Force l'utilisation de Sonnet (pour taches complexes)
 */
export async function complexTask(tenantId, prompt, options = {}) {
  return chat(tenantId, prompt, {
    ...options,
    forceModel: MODELS.SONNET,
    skipCache: true
  });
}

/**
 * Force l'utilisation de Haiku (pour taches simples garanties)
 */
export async function simpleTask(tenantId, prompt, options = {}) {
  return chat(tenantId, prompt, {
    ...options,
    forceModel: MODELS.HAIKU
  });
}

/**
 * Recupere les statistiques du service
 */
export function getStats() {
  const total = serviceStats.haikuCalls + serviceStats.sonnetCalls;
  const cacheHitRate = serviceStats.totalRequests > 0
    ? ((serviceStats.cacheHits / serviceStats.totalRequests) * 100).toFixed(1)
    : 0;
  const haikuRate = total > 0
    ? ((serviceStats.haikuCalls / total) * 100).toFixed(1)
    : 0;

  return {
    ...serviceStats,
    cacheHitRate: `${cacheHitRate}%`,
    haikuRate: `${haikuRate}%`,
    avgCostPerRequest: total > 0
      ? (calculateCost(
          serviceStats.totalTokensIn / total,
          serviceStats.totalTokensOut / total,
          'mixed'
        )).toFixed(6)
      : 0,
    estimatedSavingsEUR: serviceStats.estimatedSavings.toFixed(4),
    routerStats: modelRouter.getStats(),
    cacheStats: getCacheStats()
  };
}

/**
 * Reset les statistiques
 */
export function resetStats() {
  Object.assign(serviceStats, {
    totalRequests: 0,
    cacheHits: 0,
    staticHits: 0,
    haikuCalls: 0,
    sonnetCalls: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    estimatedSavings: 0,
    errors: 0,
    lastReset: new Date().toISOString()
  });
  modelRouter.resetStats();
}

/**
 * Ajuste les seuils de routage
 * @param {number} adjustment - Positif = plus de Haiku, negatif = plus de Sonnet
 */
export function adjustRouting(adjustment) {
  return modelRouter.adjustThresholds(adjustment);
}

// Export des modeles disponibles
export { MODELS };

export default {
  chat,
  chatStream,
  complete,
  complexTask,
  simpleTask,
  getStats,
  resetStats,
  adjustRouting,
  MODELS
};
