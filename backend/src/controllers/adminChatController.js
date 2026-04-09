/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
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
import { hasCredits, consume } from '../services/creditsService.js';
import logger from '../config/logger.js';

// Validation des entrees
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
    logger.error('listConversations error', { tag: 'ADMIN CHAT CTRL', error: error.message });
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

/**
 * POST /conversations
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
    logger.error('newConversation error', { tag: 'ADMIN CHAT CTRL', error: error.message });
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

/**
 * PATCH /conversations/:id
 */
export async function editConversation(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const { title } = req.body;

    const isOwner = await verifyConversationOwnership(id, tenantId, adminId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Le titre est requis' });
    }

    const updated = await updateConversation(id, { title: title.trim() }, tenantId);

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
    logger.error('editConversation error', { tag: 'ADMIN CHAT CTRL', error: error.message });
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

/**
 * DELETE /conversations/:id
 */
export async function removeConversation(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;

    const isOwner = await verifyConversationOwnership(id, tenantId, adminId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    const deleted = await deleteConversation(id, tenantId);

    if (!deleted) {
      return res.status(500).json({ success: false, error: 'Impossible de supprimer la conversation' });
    }

    res.json({ success: true, message: 'Conversation supprimée' });
  } catch (error) {
    logger.error('removeConversation error', { tag: 'ADMIN CHAT CTRL', error: error.message });
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

/**
 * GET /conversations/:id/messages
 */
export async function listMessages(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;

    const isOwner = await verifyConversationOwnership(id, tenantId, adminId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    const messages = await getMessages(id, tenantId);

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
    logger.error('listMessages error', { tag: 'ADMIN CHAT CTRL', error: error.message });
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
}

/**
 * POST /conversations/:id/messages/stream
 */
export async function sendMessageStream(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const { content } = req.body;

    const isOwner = await verifyConversationOwnership(id, tenantId, adminId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    const validation = validateContent(content);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    // 🔒 Credits check: verify tenant has enough credits before calling AI
    const creditCheck = await hasCredits(tenantId, 'chat_admin_question');
    if (!creditCheck.ok) {
      return res.status(402).json({
        success: false,
        error: 'Crédits IA insuffisants',
        code: 'INSUFFICIENT_CREDITS',
        required: creditCheck.cost,
        available: creditCheck.balance,
        action: 'purchase_credits',
        redirect: '/admin/subscription',
      });
    }

    await saveMessage(id, 'user', validation.content, null, tenantId);

    const history = await getMessages(id, tenantId);
    const messages = history.map(m => ({
      role: m.role,
      content: m.content,
    }));

    await chatStream(tenantId, messages, res, id, adminId);

    // Consume credits after successful AI response (stream completed)
    try {
      await consume(tenantId, 'chat_admin_question', {
        refId: id,
        description: 'Chat IA admin (stream)',
      });
    } catch (creditErr) {
      // Non-blocking: the AI response was already sent, log the error
      logger.warn('Credits consumption failed after stream', {
        tag: 'ADMIN CHAT CTRL',
        tenantId,
        error: creditErr.message,
      });
    }

  } catch (error) {
    logger.error('sendMessageStream error', { tag: 'ADMIN CHAT CTRL', error: error.message });
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Erreur serveur' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Erreur serveur' })}\n\n`);
      res.end();
    }
  }
}

/**
 * POST /conversations/:id/messages (fallback sans streaming)
 */
export async function sendMessage(req, res) {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const { content } = req.body;

    const isOwner = await verifyConversationOwnership(id, tenantId, adminId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    const validation = validateContent(content);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    // 🔒 Credits check: verify tenant has enough credits before calling AI
    const creditCheck = await hasCredits(tenantId, 'chat_admin_question');
    if (!creditCheck.ok) {
      return res.status(402).json({
        success: false,
        error: 'Crédits IA insuffisants',
        code: 'INSUFFICIENT_CREDITS',
        required: creditCheck.cost,
        available: creditCheck.balance,
        action: 'purchase_credits',
        redirect: '/admin/subscription',
      });
    }

    await saveMessage(id, 'user', validation.content, null, tenantId);

    const history = await getMessages(id, tenantId);
    const messages = history.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const result = await chat(tenantId, messages, adminId);

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error });
    }

    // Consume credits after successful AI response
    let creditsConsumed = null;
    try {
      creditsConsumed = await consume(tenantId, 'chat_admin_question', {
        refId: id,
        description: 'Chat IA admin',
      });
    } catch (creditErr) {
      // Non-blocking: the AI response was already generated, log the error
      logger.warn('Credits consumption failed after chat', {
        tag: 'ADMIN CHAT CTRL',
        tenantId,
        error: creditErr.message,
      });
    }

    await saveMessage(id, 'assistant', result.response, null, tenantId);

    res.json({
      success: true,
      response: result.response,
      usage: result.usage,
      credits: creditsConsumed ? { consumed: creditsConsumed.consumed, balance: creditsConsumed.balance } : undefined,
    });

  } catch (error) {
    logger.error('sendMessage error', { tag: 'ADMIN CHAT CTRL', error: error.message });
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
