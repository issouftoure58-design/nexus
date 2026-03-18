/**
 * Instagram Messaging Webhook
 * Reçoit les DMs Instagram via Meta Messaging API
 *
 * Setup Meta:
 * 1. App Facebook → Webhooks → instagram_messaging
 * 2. Callback URL: https://backend.nexus-ai-saas.com/api/webhooks/instagram
 * 3. Verify Token: INSTAGRAM_VERIFY_TOKEN (env)
 */

import express from 'express';
import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import { handleIncomingDM } from '../services/instagramSetterService.js';

const router = express.Router();

const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
const INSTAGRAM_VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || 'nexus_ig_verify_2026';

/**
 * GET /api/webhooks/instagram
 * Verification endpoint pour Meta (challenge handshake)
 */
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === INSTAGRAM_VERIFY_TOKEN) {
    console.log('[INSTAGRAM WEBHOOK] Verification OK');
    return res.status(200).send(challenge);
  }

  console.warn('[INSTAGRAM WEBHOOK] Verification failed');
  return res.sendStatus(403);
});

/**
 * Vérifie la signature X-Hub-Signature-256
 */
function verifySignature(req) {
  if (!INSTAGRAM_APP_SECRET) return true; // Skip en dev

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const expected = 'sha256=' + crypto.createHmac('sha256', INSTAGRAM_APP_SECRET).update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * POST /api/webhooks/instagram
 * Reçoit les messages Instagram DM
 */
router.post('/', async (req, res) => {
  // Répondre immédiatement (Meta timeout = 20s)
  res.sendStatus(200);

  try {
    if (INSTAGRAM_APP_SECRET && !verifySignature(req)) {
      console.warn('[INSTAGRAM WEBHOOK] Signature invalide');
      return;
    }

    const body = req.body;
    if (body.object !== 'instagram') return;

    for (const entry of body.entry || []) {
      for (const messaging of entry.messaging || []) {
        const senderId = messaging.sender?.id;
        const recipientId = messaging.recipient?.id;
        const message = messaging.message;

        if (!senderId || !message || message.is_echo) continue;

        console.log(`[INSTAGRAM WEBHOOK] Message de ${senderId}: ${message.text?.substring(0, 50)}`);

        // Identifier le tenant par l'Instagram Page ID
        const tenantId = await getTenantByInstagramPageId(recipientId);

        if (!tenantId) {
          console.warn(`[INSTAGRAM WEBHOOK] Aucun tenant pour Instagram Page ${recipientId}`);
          continue;
        }

        // Traiter le message
        await handleIncomingDM(tenantId, {
          senderId,
          senderUsername: messaging.sender?.username,
          text: message.text || '',
          timestamp: messaging.timestamp ? new Date(parseInt(messaging.timestamp)).toISOString() : new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    console.error('[INSTAGRAM WEBHOOK] Error:', error);
  }
});

/**
 * Trouve le tenant_id associé à un Instagram Page ID
 */
async function getTenantByInstagramPageId(pageId) {
  if (!pageId) return null;

  const { data } = await supabase
    .from('tenants')
    .select('id')
    .or(`config->instagram_page_id.eq.${pageId},config->>instagram_page_id.eq.${pageId}`)
    .single();

  return data?.id || null;
}

export default router;
