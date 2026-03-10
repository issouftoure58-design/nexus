/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ADMIN CHAT SERVICE - Streaming avec Claude + Tool Execution     ║
 * ║   Chat admin style Claude.ai avec exécution des outils            ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../config/supabase.js';
import { TOOLS_ADMIN, getToolsForPlan, getToolsForPlanAndBusiness } from '../tools/toolsRegistry.js';
import { BUSINESS_CONTEXTS } from '../prompts/systemPrompt.js';
import { BUSINESS_TYPES } from '../config/businessTypes.js';
// Import du dispatcher d'outils (remplace le switch monolithique)
import { executeTool } from '../tools/handlers/index.js';
// Import du router IA pour optimisation des couts
import modelRouter, { MODEL_DEFAULT } from './modelRouter.js';
import {
  matchStaticResponse,
  getCachedClaudeResponse,
  cacheClaudeResponse
} from './optimization/cacheService.js';
import logger from '../config/logger.js';
import { isDegraded } from '../sentinel/index.js';

// Client Anthropic (singleton)
let anthropicClient = null;

function getAnthropicClient() {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY non configurée');
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

const MAX_TOKENS_NORMAL = 4096;
const MAX_TOKENS_DEGRADED = 500;
const MAX_TOOL_ITERATIONS = 5; // Limite pour éviter les boucles infinies

// Flag pour éviter de recréer les tables à chaque appel
let chatTablesInitialized = false;

/**
 * Initialise les tables de chat si elles n'existent pas
 */
async function ensureChatTables() {
  if (chatTablesInitialized) return true;

  try {
    const { error: testError } = await supabase
      .from('admin_conversations')
      .select('id')
      .limit(1);

    if (!testError) {
      chatTablesInitialized = true;
      return true;
    }

    logger.warn('Tables admin_conversations/admin_messages non trouvees. Executez la migration 014_admin_chat.sql dans Supabase.', { tag: 'ADMIN CHAT' });
    return false;
  } catch (error) {
    logger.error('Erreur verification tables chat', { tag: 'ADMIN CHAT', error: error.message });
    return false;
  }
}

/**
 * Récupère les informations du tenant
 */
export async function getTenant(tenantId) {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Erreur getTenant', { tag: 'ADMIN CHAT', error: error.message });
    return null;
  }
}

// ============================================
// HELPERS POUR LE SYSTEM PROMPT
// ============================================

/**
 * Instructions comportementales spécifiques au métier
 */
function getBusinessInstructions(profile) {
  const instructions = {
    restaurant: [
      'Demande TOUJOURS le nombre de couverts pour une réservation',
      'Utilise check_table_availability AVANT de proposer un créneau',
      'Mentionne la carte du jour et les allergènes si pertinent',
      'Distingue service midi (11h-15h) et soir (18h-23h)'
    ],
    hotel: [
      'Demande TOUJOURS les dates d\'arrivée et de départ',
      'Utilise check_room_availability avant de confirmer une réservation',
      'Mentionne les extras et services additionnels disponibles',
      'Indique les horaires de check-in/check-out'
    ],
    service_domicile: [
      'Demande TOUJOURS l\'adresse complète du client',
      'Utilise calculate_travel_fee pour estimer les frais de déplacement',
      'Vérifie que l\'adresse est dans la zone de couverture',
      'Annonce les frais de déplacement avant confirmation'
    ],
    salon: [
      'Propose les créneaux disponibles en priorité',
      'Indique le temps estimé pour chaque prestation',
      'Suggère des services complémentaires quand pertinent',
      'Vérifie la disponibilité des membres de l\'équipe'
    ]
  };
  return instructions[profile] || instructions.salon;
}

/**
 * Fonctionnalités disponibles selon le plan
 */
function getPlanCapabilities(plan) {
  const starter = [
    'Gestion clients et réservations',
    'Devis et facturation',
    'Marketing email basique',
    'Agenda et planification',
    'Contenu et mémoire IA'
  ];
  const pro = [
    'SEO et référencement',
    'Réseaux sociaux',
    'RH de base (équipe, heures, absences)',
    'Analytics KPI'
  ];
  const business = [
    'Stratégie et recommandations avancées',
    'Analytics avancé et rapports',
    'RH complet (recrutement, performance)',
    'Agent IA autonome',
    'Recherche web en temps réel',
    'Outils Pro avancés'
  ];

  if (plan === 'business' || plan === 'enterprise') {
    return { included: [...starter, ...pro, ...business], locked: [] };
  }
  if (plan === 'pro') {
    return { included: [...starter, ...pro], locked: business };
  }
  return { included: starter, locked: [...pro, ...business] };
}

/**
 * Construit le prompt système pour Claude
 */
export function buildSystemPrompt(tenant) {
  const businessName = tenant?.name || 'NEXUS';
  const businessProfile = tenant?.business_profile || 'salon';
  const plan = (tenant?.plan || 'starter').toLowerCase();
  const credits = tenant?.ai_credits_remaining ?? 1000;

  // Contexte métier depuis systemPrompt.js et businessTypes.js
  const context = BUSINESS_CONTEXTS[businessProfile] || BUSINESS_CONTEXTS.salon;
  const typeConfig = BUSINESS_TYPES[businessProfile] || BUSINESS_TYPES.salon;

  // Date actuelle formatée avec date ISO
  const now = new Date();
  const dateISO = now.toISOString().split('T')[0];
  const dateStr = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Générer les prochains jours pour référence
  const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const prochainsJours = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    prochainsJours.push(`${d.getDate()} = ${JOURS[d.getDay()]} ${d.toISOString().split('T')[0]}`);
  }

  // Terminologie métier
  const terminology = typeConfig.terminology;
  const termsSection = Object.entries(terminology)
    .map(([key, val]) => {
      if (typeof val === 'object' && val.singular) return `- ${key}: ${val.singular} / ${val.plural}`;
      return `- ${key}: ${val}`;
    })
    .join('\n');

  // Actions principales du métier
  const actionsSection = context.actions.map(a => `- ${a}`).join('\n');

  // Instructions spécifiques au métier
  const bizInstructions = getBusinessInstructions(businessProfile);
  const instructionsSection = bizInstructions.map(i => `- ${i}`).join('\n');

  // Fonctionnalités disponibles selon le plan
  const capabilities = getPlanCapabilities(plan);
  const includedSection = capabilities.included.map(f => `✓ ${f}`).join('\n');
  const lockedSection = capabilities.locked.length > 0
    ? capabilities.locked.map(f => `🔒 ${f} (plan supérieur)`).join('\n')
    : '';

  return `Tu es l'Assistant Admin Pro de ${businessName}, propulsé par NEXUS.

## DATE ET HEURE ACTUELLES
- **Aujourd'hui** : ${dateStr}
- **Date ISO** : ${dateISO}
- **Heure** : ${timeStr}

## CALENDRIER - PROCHAINS JOURS (RÉFÉRENCE OBLIGATOIRE)
${prochainsJours.join('\n')}

## RÈGLE CRITIQUE - AGENDA
Quand l'utilisateur demande d'ajouter un événement à une date :
1. Consulte le CALENDRIER ci-dessus pour trouver la bonne date ISO
2. Exemple: "le 24" → regarde le calendrier → 24 = Mardi 2026-02-24
3. Utilise TOUJOURS heure_fin si l'utilisateur donne une plage horaire ("de 10h à 11h30" → heure="10:00", heure_fin="11:30")

## IDENTITÉ
- Tu es un assistant IA expert en gestion de ${context.description}
- Tu as accès à des outils pour gérer le business
- Tu es proactif : tu utilises les outils directement

## CONTEXTE BUSINESS
- Entreprise : ${businessName}
- Type : ${context.description}
- Plan : ${plan}
- Crédits IA : ${credits}

## TERMINOLOGIE MÉTIER
${termsSection}

## ACTIONS PRINCIPALES
${actionsSection}

## INSTRUCTIONS SPÉCIFIQUES (${typeConfig.label})
${instructionsSection}

## FONCTIONNALITÉS DISPONIBLES (Plan ${plan})
${includedSection}${lockedSection ? '\n' + lockedSection : ''}

## RÈGLES IMPORTANTES
1. **Sois proactif** : Utilise les outils directement. Ne demande pas "Voulez-vous que je...". Fais-le.
2. **Concis** : Maximum 300 mots sauf demande explicite
3. **Markdown** : Utilise le markdown pour structurer (tableaux, listes)
4. **Pas d'emoji excessif** : 1-2 max par message
5. **Terminologie** : Utilise TOUJOURS la terminologie métier ci-dessus (pas de termes génériques)

## ACTIONS CRITIQUES (confirmation requise)
- Suppression de données
- Envoi d'emails/SMS en masse
- Modifications irréversibles`;
}

// getPrixReservation et executeTool sont maintenant dans tools/handlers/

/**
 * Chat avec streaming SSE et exécution des outils
 * @param {string} tenantId - ID du tenant
 * @param {Array} messages - Messages de conversation
 * @param {Object} res - Response object Express
 * @param {string} conversationId - ID de la conversation
 * @param {string} adminId - ID de l'admin connecté (pour les outils agenda, etc.)
 */
export async function chatStream(tenantId, messages, res, conversationId, adminId = null) {
  const client = getAnthropicClient();
  const tenant = await getTenant(tenantId);

  const tenantPlan = (tenant?.plan || 'starter').toLowerCase();
  const businessProfile = tenant?.business_profile || 'salon';
  const availableTools = getToolsForPlanAndBusiness(tenantPlan, businessProfile);

  // Headers SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let conversationMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  let fullResponse = '';
  let iterations = 0;

  try {
    // Boucle streaming avec gestion des outils
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      // Vrai streaming via SDK Anthropic
      const stream = client.messages.stream({
        model: MODEL_DEFAULT,
        max_tokens: isDegraded() ? MAX_TOKENS_DEGRADED : MAX_TOKENS_NORMAL,
        system: buildSystemPrompt(tenant),
        messages: conversationMessages,
        tools: availableTools,
      });

      // Forwarding temps reel du texte vers le client SSE
      stream.on('text', (text) => {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`);
      });

      // Attendre la fin du stream pour recuperer le message complet (inclut tool_use)
      const finalMessage = await stream.finalMessage();

      const toolBlocks = finalMessage.content.filter(b => b.type === 'tool_use');

      if (finalMessage.stop_reason !== 'tool_use' || toolBlocks.length === 0) {
        break;
      }

      // Informer le client des outils en cours
      for (const tool of toolBlocks) {
        res.write(`data: ${JSON.stringify({ type: 'tool_start', tool: tool.name })}\n\n`);
      }

      // Ajouter la reponse assistant (texte + tool_use) aux messages
      conversationMessages.push({
        role: 'assistant',
        content: finalMessage.content
      });

      // Executer les outils
      const toolResults = [];
      for (const tool of toolBlocks) {
        const result = await executeTool(tool.name, tool.input, tenantId, adminId);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: JSON.stringify(result)
        });

        res.write(`data: ${JSON.stringify({ type: 'tool_complete', tool: tool.name, success: result.success })}\n\n`);
      }

      conversationMessages.push({
        role: 'user',
        content: toolResults
      });
    }

    // Sauvegarder la reponse en BDD
    if (conversationId && fullResponse) {
      await saveMessage(conversationId, 'assistant', fullResponse);
    }

    res.write(`data: ${JSON.stringify({ type: 'done', stop_reason: 'end_turn' })}\n\n`);
    res.end();

  } catch (error) {
    logger.error('Erreur chatStream', { tag: 'ADMIN CHAT', tenantId, error: error.message });
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
}

/**
 * Chat sans streaming (fallback)
 */
export async function chat(tenantId, messages, adminId = null) {
  const client = getAnthropicClient();
  const tenant = await getTenant(tenantId);

  // Récupérer les outils disponibles selon le plan ET le type de business
  const tenantPlan = (tenant?.plan || 'starter').toLowerCase();
  const businessProfile = tenant?.business_profile || 'salon';
  const availableTools = getToolsForPlanAndBusiness(tenantPlan, businessProfile);

  let conversationMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  let fullResponse = '';
  let iterations = 0;

  try {
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      const response = await client.messages.create({
        model: MODEL_DEFAULT,
        max_tokens: isDegraded() ? MAX_TOKENS_DEGRADED : MAX_TOKENS_NORMAL,
        system: buildSystemPrompt(tenant),
        messages: conversationMessages,
        tools: availableTools,
      });

      // Extraire le texte
      const textBlocks = response.content.filter(b => b.type === 'text');
      const toolBlocks = response.content.filter(b => b.type === 'tool_use');

      for (const block of textBlocks) {
        fullResponse += block.text;
      }

      if (response.stop_reason !== 'tool_use' || toolBlocks.length === 0) {
        break;
      }

      // Ajouter réponse assistant
      conversationMessages.push({
        role: 'assistant',
        content: response.content
      });

      // Exécuter outils
      const toolResults = [];
      for (const tool of toolBlocks) {
        const result = await executeTool(tool.name, tool.input, tenantId, adminId);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: JSON.stringify(result)
        });
      }

      conversationMessages.push({
        role: 'user',
        content: toolResults
      });
    }

    return {
      success: true,
      response: fullResponse,
    };
  } catch (error) {
    logger.error('Erreur chat', { tag: 'ADMIN CHAT', tenantId, error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Sauvegarder un message en BDD
 * Verifie l'ownership de la conversation via tenant_id avant insertion
 */
export async function saveMessage(conversationId, role, content, toolUse = null, tenantId = null) {
  try {
    // Si tenantId fourni, verifier que la conversation appartient au tenant
    if (tenantId) {
      const { data: conv } = await supabase
        .from('admin_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('tenant_id', tenantId)
        .single();
      if (!conv) {
        logger.warn('saveMessage: conversation non trouvee pour ce tenant', { tag: 'ADMIN CHAT', conversationId, tenantId });
        return null;
      }
    }

    const { data, error } = await supabase
      .from('admin_messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        tool_use: toolUse,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Erreur saveMessage', { tag: 'ADMIN CHAT', error: error.message });
    return null;
  }
}

/**
 * Recuperer les messages d'une conversation
 * Filtre via jointure sur admin_conversations.tenant_id
 */
export async function getMessages(conversationId, tenantId = null) {
  try {
    // Si tenantId fourni, verifier ownership d'abord
    if (tenantId) {
      const { data: conv } = await supabase
        .from('admin_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('tenant_id', tenantId)
        .single();
      if (!conv) return [];
    }

    const { data, error } = await supabase
      .from('admin_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Erreur getMessages', { tag: 'ADMIN CHAT', error: error.message });
    return [];
  }
}

/**
 * Creer une nouvelle conversation
 */
export async function createConversation(tenantId, adminId, title = 'Nouvelle conversation') {
  if (!tenantId) throw new Error('TENANT_ID_REQUIRED: createConversation');
  try {
    await ensureChatTables();

    const { data, error } = await supabase
      .from('admin_conversations')
      .insert({
        tenant_id: tenantId,
        admin_id: adminId,
        title,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Erreur createConversation', { tag: 'ADMIN CHAT', tenantId, error: error.message });
    return null;
  }
}

/**
 * Recuperer les conversations d'un tenant/admin
 */
export async function getConversations(tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_ID_REQUIRED: getConversations');
  try {
    const { data, error } = await supabase
      .from('admin_conversations')
      .select('*, admin_messages(count)')
      .eq('tenant_id', tenantId)
      .eq('admin_id', adminId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    logger.error('Erreur getConversations', { tag: 'ADMIN CHAT', tenantId, error: error.message });
    return [];
  }
}

/**
 * Mettre a jour le titre d'une conversation (avec filtre tenant_id)
 */
export async function updateConversation(conversationId, updates, tenantId = null) {
  try {
    let query = supabase
      .from('admin_conversations')
      .update(updates)
      .eq('id', conversationId);

    if (tenantId) query = query.eq('tenant_id', tenantId);

    const { data, error } = await query.select().single();

    if (error) throw error;
    return data;
  } catch (error) {
    logger.error('Erreur updateConversation', { tag: 'ADMIN CHAT', error: error.message });
    return null;
  }
}

/**
 * Supprimer une conversation (avec filtre tenant_id obligatoire)
 */
export async function deleteConversation(conversationId, tenantId = null) {
  try {
    let query = supabase
      .from('admin_conversations')
      .delete()
      .eq('id', conversationId);

    if (tenantId) query = query.eq('tenant_id', tenantId);

    const { error } = await query;

    if (error) throw error;
    return true;
  } catch (error) {
    logger.error('Erreur deleteConversation', { tag: 'ADMIN CHAT', error: error.message });
    return false;
  }
}

/**
 * Verifier ownership d'une conversation
 */
export async function verifyConversationOwnership(conversationId, tenantId, adminId) {
  try {
    const { data, error } = await supabase
      .from('admin_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .eq('admin_id', adminId)
      .single();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

export default {
  getTenant,
  buildSystemPrompt,
  chatStream,
  chat,
  saveMessage,
  getMessages,
  createConversation,
  getConversations,
  updateConversation,
  deleteConversation,
  verifyConversationOwnership,
};
