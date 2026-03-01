/**
 * Service de Persistance des Conversations IA
 *
 * Stocke et récupère les conversations IA (WhatsApp, Téléphone, Web)
 * Permet l'analyse, l'historique et l'amélioration continue de l'IA
 */

import { supabase } from '../config/supabase.js';

/**
 * Crée ou récupère une conversation active
 * @param {string} tenantId - ID du tenant
 * @param {string} channel - Canal (whatsapp, telephone, web, sms)
 * @param {string} phoneNumber - Numéro du client ou session ID
 * @param {string} externalId - ID externe (Twilio SID, etc.)
 * @returns {Promise<{id: string, isNew: boolean}>}
 */
export async function getOrCreateConversation(tenantId, channel, phoneNumber, externalId = null) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED');
  }

  // Chercher une conversation active pour ce client/canal
  const { data: existing, error: searchError } = await supabase
    .from('ia_conversations')
    .select('id, started_at')
    .eq('tenant_id', tenantId)
    .eq('channel', channel)
    .eq('phone_number', phoneNumber)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (existing && !searchError) {
    // Vérifier si la conversation n'est pas trop vieille (4h max)
    const startedAt = new Date(existing.started_at);
    const now = new Date();
    const hoursDiff = (now - startedAt) / (1000 * 60 * 60);

    if (hoursDiff < 4) {
      console.log(`[Conversations] Conversation active trouvée: ${existing.id}`);
      return { id: existing.id, isNew: false };
    }

    // Clôturer l'ancienne conversation
    await supabase
      .from('ia_conversations')
      .update({ status: 'closed', ended_at: new Date().toISOString() })
      .eq('id', existing.id);
  }

  // Créer une nouvelle conversation
  const { data: newConv, error: createError } = await supabase
    .from('ia_conversations')
    .insert({
      tenant_id: tenantId,
      channel: channel,
      phone_number: phoneNumber,
      external_id: externalId,
      status: 'active',
      started_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (createError) {
    console.error('[Conversations] Erreur création:', createError.message);
    throw createError;
  }

  console.log(`[Conversations] Nouvelle conversation créée: ${newConv.id}`);
  return { id: newConv.id, isNew: true };
}

/**
 * Ajoute un message à une conversation
 * @param {string} conversationId - ID de la conversation
 * @param {string} role - Rôle (user, assistant, system)
 * @param {string} content - Contenu du message
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<{id: string}>}
 */
export async function addMessage(conversationId, role, content, options = {}) {
  const {
    contentType = 'text',
    mediaUrl = null,
    toolCalls = null,
    tokensUsed = 0,
    latencyMs = null
  } = options;

  const { data, error } = await supabase
    .from('ia_messages')
    .insert({
      conversation_id: conversationId,
      role: role,
      content: content,
      content_type: contentType,
      media_url: mediaUrl,
      tool_calls: toolCalls,
      tokens_used: tokensUsed,
      latency_ms: latencyMs,
      created_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Conversations] Erreur ajout message:', error.message);
    throw error;
  }

  return { id: data.id };
}

/**
 * Enregistre un intent/action détecté
 * @param {string} conversationId - ID de la conversation
 * @param {string} intent - Type d'intent (booking, info, etc.)
 * @param {Object} options - Options
 */
export async function recordIntent(conversationId, intent, options = {}) {
  const {
    messageId = null,
    confidence = null,
    entities = {},
    actionTaken = null,
    actionResult = null
  } = options;

  const { error } = await supabase
    .from('ia_intents')
    .insert({
      conversation_id: conversationId,
      message_id: messageId,
      intent: intent,
      confidence: confidence,
      entities: entities,
      action_taken: actionTaken,
      action_result: actionResult
    });

  if (error) {
    console.error('[Conversations] Erreur enregistrement intent:', error.message);
    // Non-bloquant
  }
}

/**
 * Clôture une conversation
 * @param {string} conversationId - ID de la conversation
 * @param {string} status - Statut final (closed, transferred, abandoned)
 */
export async function closeConversation(conversationId, status = 'closed') {
  const { error } = await supabase
    .from('ia_conversations')
    .update({
      status: status,
      ended_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', conversationId);

  if (error) {
    console.error('[Conversations] Erreur clôture:', error.message);
    throw error;
  }

  console.log(`[Conversations] Conversation ${conversationId} clôturée (${status})`);
}

/**
 * Lie une conversation à un client identifié
 * @param {string} conversationId - ID de la conversation
 * @param {string} clientId - ID du client
 */
export async function linkToClient(conversationId, clientId) {
  const { error } = await supabase
    .from('ia_conversations')
    .update({ client_id: clientId })
    .eq('id', conversationId);

  if (error) {
    console.error('[Conversations] Erreur liaison client:', error.message);
  }
}

/**
 * Récupère l'historique des messages d'une conversation
 * @param {string} conversationId - ID de la conversation
 * @param {number} limit - Nombre max de messages
 * @returns {Promise<Array>}
 */
export async function getConversationHistory(conversationId, limit = 50) {
  const { data, error } = await supabase
    .from('ia_messages')
    .select('role, content, content_type, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[Conversations] Erreur récupération historique:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Récupère les conversations récentes d'un tenant
 * @param {string} tenantId - ID du tenant
 * @param {Object} filters - Filtres (channel, status, limit)
 * @returns {Promise<Array>}
 */
export async function getRecentConversations(tenantId, filters = {}) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED');
  }

  const { channel = null, status = null, limit = 20 } = filters;

  let query = supabase
    .from('ia_conversations')
    .select(`
      id,
      channel,
      phone_number,
      status,
      started_at,
      ended_at,
      client:clients(id, nom, prenom)
    `)
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (channel) query = query.eq('channel', channel);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    console.error('[Conversations] Erreur récupération:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Récupère les statistiques de conversations d'un tenant
 * @param {string} tenantId - ID du tenant
 * @param {Object} options - Options (days, channel)
 * @returns {Promise<Object>}
 */
export async function getConversationStats(tenantId, options = {}) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED');
  }

  const { days = 30, channel = null } = options;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  let query = supabase
    .from('ia_conversations')
    .select('id, channel, status, started_at, ended_at')
    .eq('tenant_id', tenantId)
    .gte('started_at', startDate.toISOString());

  if (channel) query = query.eq('channel', channel);

  const { data: conversations, error } = await query;

  if (error) {
    console.error('[Conversations] Erreur stats:', error.message);
    return { total: 0, byChannel: {}, byStatus: {} };
  }

  const stats = {
    total: conversations.length,
    byChannel: {},
    byStatus: {},
    avgDuration: 0
  };

  let totalDuration = 0;
  let completedCount = 0;

  conversations.forEach(conv => {
    // Par canal
    stats.byChannel[conv.channel] = (stats.byChannel[conv.channel] || 0) + 1;

    // Par statut
    stats.byStatus[conv.status] = (stats.byStatus[conv.status] || 0) + 1;

    // Durée moyenne (conversations terminées)
    if (conv.ended_at) {
      const duration = new Date(conv.ended_at) - new Date(conv.started_at);
      totalDuration += duration;
      completedCount++;
    }
  });

  if (completedCount > 0) {
    stats.avgDuration = Math.round(totalDuration / completedCount / 1000); // en secondes
  }

  return stats;
}

/**
 * Fonction helper pour wrapper un handler IA avec persistance
 * @param {string} tenantId - ID du tenant
 * @param {string} channel - Canal
 * @param {string} phoneNumber - Numéro client
 * @param {string} userMessage - Message entrant
 * @param {Function} processMessage - Fonction qui traite le message et retourne la réponse
 * @returns {Promise<Object>}
 */
export async function withPersistence(tenantId, channel, phoneNumber, userMessage, processMessage) {
  const startTime = Date.now();

  try {
    // Créer ou récupérer la conversation
    const { id: conversationId, isNew } = await getOrCreateConversation(tenantId, channel, phoneNumber);

    // Enregistrer le message utilisateur
    await addMessage(conversationId, 'user', userMessage);

    // Traiter le message avec le handler IA
    const result = await processMessage(conversationId);

    const latencyMs = Date.now() - startTime;

    // Enregistrer la réponse de l'IA
    if (result.response) {
      await addMessage(conversationId, 'assistant', result.response, {
        latencyMs: latencyMs,
        tokensUsed: result.tokensUsed || 0,
        toolCalls: result.toolCalls || null
      });
    }

    // Enregistrer l'intent si détecté
    if (result.intent) {
      await recordIntent(conversationId, result.intent, {
        confidence: result.confidence,
        entities: result.entities,
        actionTaken: result.actionTaken,
        actionResult: result.actionResult
      });
    }

    // Lier au client si identifié
    if (result.clientId) {
      await linkToClient(conversationId, result.clientId);
    }

    return {
      ...result,
      conversationId,
      isNewConversation: isNew,
      latencyMs
    };

  } catch (error) {
    console.error('[Conversations] Erreur withPersistence:', error.message);
    // On ne bloque pas le flux principal
    return await processMessage(null);
  }
}

export default {
  getOrCreateConversation,
  addMessage,
  recordIntent,
  closeConversation,
  linkToClient,
  getConversationHistory,
  getRecentConversations,
  getConversationStats,
  withPersistence
};
