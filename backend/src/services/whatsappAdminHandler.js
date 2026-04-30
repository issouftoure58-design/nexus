/**
 * WhatsApp Admin Handler
 * Gère les messages WhatsApp entrants des admins/managers
 * Utilise adminChatService.chat() (non-streaming, tool loop)
 *
 * 🔒 TENANT SHIELD : tenant_id obligatoire partout
 * 💳 Crédits : chat_admin_question (même coût que admin-ui)
 */

import { supabase } from '../config/supabase.js';
import { chat, getMessages, saveMessage, createConversation } from './adminChatService.js';
import { sendWhatsAppNotification } from './whatsappService.js';
import logger from '../config/logger.js';

const WA_ADMIN_CONV_TITLE = '[WhatsApp] Admin Chat';
const MAX_WA_MESSAGE_LENGTH = 4096;

// Commandes de reset
const RESET_COMMANDS = ['/reset', 'nouvelle conversation', 'reset', '/new'];

/**
 * Gère un message WhatsApp entrant d'un admin
 * @param {string} adminPhone - Numéro de l'admin (format brut)
 * @param {string} messageText - Texte du message
 * @param {string} tenantId - ID du tenant
 * @param {object} admin - { id, nom, role, source } depuis detectAdminByPhone
 * @param {string} messageSid - ID du message Twilio/Meta
 * @param {Function} [sendFn] - Fonction d'envoi (défaut: sendWhatsAppNotification)
 * @returns {Promise<{ success: boolean, response?: string }>}
 */
export async function handleAdminWhatsAppMessage(adminPhone, messageText, tenantId, admin, messageSid, sendFn) {
  if (!tenantId) throw new Error('TENANT_ID_REQUIRED: handleAdminWhatsAppMessage');

  const send = sendFn || ((phone, msg) => sendWhatsAppNotification(phone, msg, tenantId));

  try {
    const trimmed = messageText.trim().toLowerCase();

    // ── Commande /reset ──
    if (RESET_COMMANDS.includes(trimmed)) {
      await resetAdminConversation(admin.id, tenantId);
      await send(adminPhone, '🔄 Conversation réinitialisée. Posez votre question !');
      return { success: true, response: 'Conversation réinitialisée' };
    }

    // ── Récupérer ou créer la conversation ──
    const conversation = await getOrCreateAdminConversation(admin.id, tenantId);
    if (!conversation) {
      await send(adminPhone, '⚠️ Erreur interne. Réessayez dans un instant.');
      return { success: false, error: 'conversation_creation_failed' };
    }

    // ── Sauvegarder le message user ──
    await saveMessage(conversation.id, 'user', messageText, null, tenantId);

    // ── Charger l'historique récent (derniers 20 messages pour contexte) ──
    const allMessages = await getMessages(conversation.id, tenantId);
    const recentMessages = allMessages.slice(-20).map(m => ({
      role: m.role,
      content: m.content,
    }));

    // ── Appel IA admin (non-streaming, tool loop) ──
    const result = await chat(tenantId, recentMessages, admin.id, { channel: 'whatsapp' });

    if (!result.success || !result.response) {
      await send(adminPhone, '⚠️ Erreur IA. Réessayez.');
      return { success: false, error: result.error || 'no_response' };
    }

    // ── Sauvegarder la réponse assistant ──
    await saveMessage(conversation.id, 'assistant', result.response, null, tenantId);

    // ── Mettre à jour updated_at de la conversation ──
    await supabase
      .from('admin_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id)
      .eq('tenant_id', tenantId);

    // ── Envoyer la réponse (split si nécessaire) ──
    await sendSplitWhatsAppMessage(adminPhone, result.response, send);

    return { success: true, response: result.response };
  } catch (error) {
    logger.error(`[WA ADMIN] Erreur handler: ${error.message}`, { tenantId, adminId: admin?.id });
    try {
      await send(adminPhone, '⚠️ Erreur serveur. Réessayez dans un instant.');
    } catch (_) { /* ignore send error */ }
    return { success: false, error: error.message };
  }
}

/**
 * Récupère ou crée la conversation WhatsApp admin unique pour un admin
 */
async function getOrCreateAdminConversation(adminId, tenantId) {
  try {
    // Chercher la conversation existante
    const { data: existing } = await supabase
      .from('admin_conversations')
      .select('id, title')
      .eq('tenant_id', tenantId)
      .eq('admin_id', adminId)
      .eq('title', WA_ADMIN_CONV_TITLE)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (existing) return existing;

    // Créer une nouvelle conversation
    return await createConversation(tenantId, adminId, WA_ADMIN_CONV_TITLE);
  } catch (error) {
    // single() throws si 0 résultats, on crée
    return await createConversation(tenantId, adminId, WA_ADMIN_CONV_TITLE);
  }
}

/**
 * Réinitialise la conversation WhatsApp admin (supprime les messages)
 */
async function resetAdminConversation(adminId, tenantId) {
  try {
    const { data: conv } = await supabase
      .from('admin_conversations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('admin_id', adminId)
      .eq('title', WA_ADMIN_CONV_TITLE)
      .limit(1)
      .single();

    if (conv) {
      // Supprimer les messages de cette conversation
      await supabase
        .from('admin_messages')
        .delete()
        .eq('conversation_id', conv.id);

      logger.info(`[WA ADMIN] Conversation reset`, { tenantId, adminId });
    }
  } catch (error) {
    logger.warn(`[WA ADMIN] Reset failed (no conversation?): ${error.message}`, { tenantId });
  }
}

/**
 * Envoie un message WhatsApp, découpé en parties numérotées si > 4096 chars
 * @param {string} phone - Numéro destinataire
 * @param {string} message - Message complet
 * @param {Function} sendFn - Fonction d'envoi
 */
async function sendSplitWhatsAppMessage(phone, message, sendFn) {
  if (message.length <= MAX_WA_MESSAGE_LENGTH) {
    await sendFn(phone, message);
    return;
  }

  // Découper par paragraphes/newlines
  const parts = splitMessage(message, MAX_WA_MESSAGE_LENGTH - 20); // marge pour "(X/Y) "

  for (let i = 0; i < parts.length; i++) {
    const prefix = parts.length > 1 ? `(${i + 1}/${parts.length}) ` : '';
    await sendFn(phone, prefix + parts[i]);
  }
}

/**
 * Découpe un message en parties respectant la limite de caractères
 * Coupe aux paragraphes, puis aux newlines, puis aux espaces
 */
function splitMessage(text, maxLength) {
  const parts = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let cutIndex = -1;

    // Chercher le dernier double-newline avant la limite
    const doubleNl = remaining.lastIndexOf('\n\n', maxLength);
    if (doubleNl > maxLength * 0.3) {
      cutIndex = doubleNl;
    } else {
      // Sinon, chercher le dernier newline
      const nl = remaining.lastIndexOf('\n', maxLength);
      if (nl > maxLength * 0.3) {
        cutIndex = nl;
      } else {
        // Sinon, chercher le dernier espace
        const space = remaining.lastIndexOf(' ', maxLength);
        cutIndex = space > maxLength * 0.3 ? space : maxLength;
      }
    }

    parts.push(remaining.substring(0, cutIndex).trim());
    remaining = remaining.substring(cutIndex).trim();
  }

  if (remaining) parts.push(remaining);
  return parts;
}
