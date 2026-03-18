/**
 * Yousign Webhook Route
 * POST /api/webhooks/yousign
 *
 * Reçoit les notifications de Yousign (signature terminée, refusée, expirée)
 */

import express from 'express';
import crypto from 'crypto';
import { handleWebhook } from '../services/yousignService.js';

const router = express.Router();

const YOUSIGN_WEBHOOK_SECRET = process.env.YOUSIGN_WEBHOOK_SECRET;

/**
 * Vérifie la signature du webhook Yousign
 */
function verifySignature(req) {
  if (!YOUSIGN_WEBHOOK_SECRET) return true; // Skip en dev

  const signature = req.headers['x-yousign-signature-256'];
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', YOUSIGN_WEBHOOK_SECRET);
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  hmac.update(rawBody);
  const expected = `sha256=${hmac.digest('hex')}`;

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * POST /api/webhooks/yousign
 */
router.post('/', async (req, res) => {
  try {
    // Vérifier la signature en production
    if (YOUSIGN_WEBHOOK_SECRET && !verifySignature(req)) {
      console.warn('[YOUSIGN WEBHOOK] Signature invalide');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;

    if (!event || !event.event_name) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    console.log(`[YOUSIGN WEBHOOK] Received: ${event.event_name}`);

    const result = await handleWebhook(event);

    res.status(200).json({ received: true, status: result?.status });
  } catch (error) {
    console.error('[YOUSIGN WEBHOOK] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
