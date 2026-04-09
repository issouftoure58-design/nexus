/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ADMIN CHAT ROUTES                                               ║
 * ║   API REST pour le chat admin streaming                           ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Endpoints:
 *   GET    /conversations                    - Liste des conversations
 *   POST   /conversations                    - Créer une conversation
 *   PATCH  /conversations/:id                - Modifier le titre
 *   DELETE /conversations/:id                - Supprimer une conversation
 *   GET    /conversations/:id/messages       - Messages d'une conversation
 *   POST   /conversations/:id/messages/stream - Envoyer message + stream
 *   POST   /conversations/:id/messages       - Envoyer message (fallback)
 */

import express from 'express';
import { z } from 'zod';
import { authenticateAdmin } from './adminAuth.js';
import {
  listConversations,
  newConversation,
  editConversation,
  removeConversation,
  listMessages,
  sendMessageStream,
  sendMessage,
} from '../controllers/adminChatController.js';
import { enforceTrialLimit } from '../services/trialService.js';
import { validate } from '../middleware/validate.js';
import { requireModule } from '../middleware/moduleProtection.js';

const chatMessageSchema = z.object({
  content: z.string().min(1, 'Message requis').max(2000, 'Message trop long (max 2000 caractères)'),
});

const router = express.Router();

// Toutes les routes nécessitent une authentification admin
router.use(authenticateAdmin);

// ══════════════════════════════════════════════════════════════════════════════
// CONVERSATIONS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/chat/conversations
 * Liste les conversations de l'admin connecté
 */
router.get('/conversations', listConversations);

/**
 * POST /api/admin/chat/conversations
 * Créer une nouvelle conversation
 * Body: { title?: string }
 */
router.post('/conversations', newConversation);

/**
 * PATCH /api/admin/chat/conversations/:id
 * Modifier le titre d'une conversation
 * Body: { title: string }
 */
router.patch('/conversations/:id', editConversation);

/**
 * DELETE /api/admin/chat/conversations/:id
 * Supprimer une conversation et ses messages
 */
router.delete('/conversations/:id', removeConversation);

// ══════════════════════════════════════════════════════════════════════════════
// MESSAGES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/chat/conversations/:id/messages
 * Récupérer tous les messages d'une conversation
 */
router.get('/conversations/:id/messages', listMessages);

/**
 * POST /api/admin/chat/conversations/:id/messages/stream
 * Envoyer un message et recevoir la réponse en streaming SSE
 * Body: { content: string }
 * Response: text/event-stream
 *
 * Events SSE:
 *   { type: 'text', content: string }       - Fragment de texte
 *   { type: 'tool_start', tool: string }    - Début utilisation outil
 *   { type: 'tool_complete', tool: object } - Fin utilisation outil
 *   { type: 'done', stop_reason: string }   - Stream terminé
 *   { type: 'error', message: string }      - Erreur
 */
router.post('/conversations/:id/messages/stream', requireModule('agent_ia_web'), enforceTrialLimit('interactions_ia'), validate(chatMessageSchema), sendMessageStream);

/**
 * POST /api/admin/chat/conversations/:id/messages
 * Envoyer un message sans streaming (fallback)
 * Body: { content: string }
 */
router.post('/conversations/:id/messages', requireModule('agent_ia_web'), enforceTrialLimit('interactions_ia'), validate(chatMessageSchema), sendMessage);

export default router;
