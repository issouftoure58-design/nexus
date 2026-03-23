/**
 * Claude Haiku Helper — Appels IA mutualisés pour génération de contenu
 * Modèle: claude-haiku-4-5-20251001 (88% moins cher que Sonnet)
 */

import Anthropic from '@anthropic-ai/sdk';
import logger from '../../../config/logger.js';
import { MODEL_FAST as MODEL_HAIKU } from '../../../services/modelRouter.js';

let anthropicClient = null;

function getClient() {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY non configurée');
    }
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

/**
 * Génère du contenu via Claude Haiku et parse le JSON
 * @param {string} prompt - Le prompt à envoyer
 * @param {number} maxTokens - Tokens max (défaut: 1000)
 * @returns {Object} Le JSON parsé
 */
export async function generateContent(prompt, maxTokens = 1000) {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  });

  const responseText = response.content[0].text.trim();
  const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleanJson);
  } catch (e) {
    logger.warn('[CLAUDE HELPER] JSON parse failed, returning raw text', { error: e.message });
    return { text: responseText };
  }
}

/**
 * Génère du contenu texte libre (pas de JSON)
 */
export async function generateText(prompt, maxTokens = 1000) {
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL_HAIKU,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text.trim();
}

/**
 * Récupère les infos tenant pour les prompts
 */
export async function getTenantContext(supabase, tenantId) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('business_name, business_profile, name, description')
    .eq('id', tenantId)
    .single();

  const { data: services } = await supabase
    .from('services')
    .select('nom, prix, description')
    .eq('tenant_id', tenantId)
    .eq('actif', true)
    .limit(10);

  const servicesText = services?.map(s => `- ${s.nom}: ${(s.prix / 100).toFixed(0)}€`).join('\n') || '';

  return {
    businessName: tenant?.business_name || tenant?.name || 'Mon entreprise',
    businessType: tenant?.business_profile || 'Services',
    description: tenant?.description || '',
    servicesText
  };
}
