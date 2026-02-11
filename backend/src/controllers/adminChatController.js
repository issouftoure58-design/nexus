/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ADMIN CHAT CONTROLLER                                           ║
 * ║   Gestion des conversations et messages admin                     ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import {
  getConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  getMessages,
  saveMessage,
  chatStream,
  chat,
  verifyConversationOwnership,
} from '../services/adminChatService.js';

// Validation des entrées
const MAX_CONTENT_LENGTH = 4000;

function validateContent(content) {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Le contenu est requis' };
  }
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Le contenu ne peut pas être vide' };
  }
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return { valid: false, error: `Le contenu dépasse ${MAX_CONTENT_LENGTH} caractères` };
  }
  return { valid: true, content: trimmed };
}

/**
 * GET /conversations
 * Liste les conversations de l'admin
 */
export async function listConversations(req, res) {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;

    if (!tenantId || !adminId) {
      return res.status(400).json({ success: false, error: 'Tenant ou admin non identifié' });
    }

    const conversations = await getConversations(tenantId, adminId);

    res.json({
      success: true,
      conversations: conversations.map(c => ({
        id: c.id,
        title: c.title,
        messageCount: c.admin_messages?.[0]?.count || 0,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    });
  } catch (error) {
    console.error('[ADMIN CHAT CTRL] listConversations error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

/**
 * POST /conversations
 * Créer une nouvelle conversation
 */
export async function newConversation(req, res) {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const { title } = req.body;

    if (!tenantId || !adminId) {
      return res.status(400).json({ success: false, error: 'Tenant ou admin non identifié' });
    }

    const conversation = await createConversation(tenantId, adminId, title || 'Nouvelle conversation');

    if (!conversation) {
      return res.status(500).json({ success: false, error: 'Impossible de créer la conversation' });
    }

    res.status(201).json({
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.created_at,
      },
    });
  } catch (error) {
    console.error('[ADMIN CHAT CTRL] newConversation error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

/**
 * PATCH /conversations/:id
 * Modifier le titre d'une conversation
 */
export async function editConversation(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const { title } = req.body;

    // Vérifier ownership
    const isOwner = await verifyConversationOwnership(id, tenantId, adminId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Le titre est requis' });
    }

    const updated = await updateConversation(id, { title: title.trim() });

    if (!updated) {
      return res.status(500).json({ success: false, error: 'Impossible de modifier la conversation' });
    }

    res.json({
      success: true,
      conversation: {
        id: updated.id,
        title: updated.title,
        updatedAt: updated.updated_at,
      },
    });
  } catch (error) {
    console.error('[ADMIN CHAT CTRL] editConversation error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

/**
 * DELETE /conversations/:id
 * Supprimer une conversation
 */
export async function removeConversation(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;

    // Vérifier ownership
    const isOwner = await verifyConversationOwnership(id, tenantId, adminId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    const deleted = await deleteConversation(id);

    if (!deleted) {
      return res.status(500).json({ success: false, error: 'Impossible de supprimer la conversation' });
    }

    res.json({ success: true, message: 'Conversation supprimée' });
  } catch (error) {
    console.error('[ADMIN CHAT CTRL] removeConversation error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

/**
 * GET /conversations/:id/messages
 * Récupérer les messages d'une conversation
 */
export async function listMessages(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;

    // Vérifier ownership
    const isOwner = await verifyConversationOwnership(id, tenantId, adminId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    const messages = await getMessages(id);

    res.json({
      success: true,
      messages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolUse: m.tool_use,
        createdAt: m.created_at,
      })),
    });
  } catch (error) {
    console.error('[ADMIN CHAT CTRL] listMessages error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

/**
 * POST /conversations/:id/messages/stream
 * Envoyer un message et streamer la réponse
 */
export async function sendMessageStream(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const { content } = req.body;

    // Vérifier ownership
    const isOwner = await verifyConversationOwnership(id, tenantId, adminId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    // Valider le contenu
    const validation = validateContent(content);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    // Sauvegarder le message user
    await saveMessage(id, 'user', validation.content);

    // Récupérer l'historique des messages
    const history = await getMessages(id);

    // Formater pour Claude
    const messages = history.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Streamer la réponse
    await chatStream(tenantId, messages, res, id);

  } catch (error) {
    console.error('[ADMIN CHAT CTRL] sendMessageStream error:', error);
    // Si headers pas encore envoyés
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Erreur serveur' })}\n\n`);
      res.end();
    }
  }
}

/**
 * POST /conversations/:id/messages
 * Envoyer un message sans streaming (fallback)
 */
export async function sendMessage(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const { content } = req.body;

    // Vérifier ownership
    const isOwner = await verifyConversationOwnership(id, tenantId, adminId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    // Valider le contenu
    const validation = validateContent(content);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    // Sauvegarder le message user
    await saveMessage(id, 'user', validation.content);

    // Récupérer l'historique
    const history = await getMessages(id);
    const messages = history.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Appeler Claude sans streaming
    const result = await chat(tenantId, messages);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    // Sauvegarder la réponse
    await saveMessage(id, 'assistant', result.response);

    res.json({
      success: true,
      response: result.response,
      usage: result.usage,
    });

  } catch (error) {
    console.error('[ADMIN CHAT CTRL] sendMessage error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

export default {
  listConversations,
  newConversation,
  editConversation,
  removeConversation,
  listMessages,
  sendMessageStream,
  sendMessage,
};
