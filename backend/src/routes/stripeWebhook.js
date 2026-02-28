/**
 * Stripe Webhook Handler
 *
 * POST /api/webhooks/stripe - Webhook Stripe
 *
 * Evenements geres:
 * - customer.subscription.created/updated/deleted
 * - invoice.paid/payment_failed
 * - customer.subscription.trial_will_end
 */

import express from 'express';
import Stripe from 'stripe';
import { handleWebhookEvent } from '../services/stripeBillingService.js';

const router = express.Router();

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' })
  : null;

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/webhooks/stripe
 * Webhook Stripe - IMPORTANT: raw body requis
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) {
    console.error('[Stripe Webhook] Stripe non configure');
    return res.status(500).send('Stripe not configured');
  }

  const sig = req.headers['stripe-signature'];

  let event;

  try {
    // 🔒 SÉCURITÉ CRITIQUE: TOUJOURS vérifier la signature en production
    if (process.env.NODE_ENV === 'production' && !endpointSecret) {
      console.error('[Stripe Webhook] ❌ CRITIQUE: STRIPE_WEBHOOK_SECRET non configuré en production');
      return res.status(500).send('Webhook secret not configured');
    }

    if (endpointSecret) {
      // Vérification de signature obligatoire
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else if (process.env.NODE_ENV === 'development' && process.env.ALLOW_UNSIGNED_WEBHOOKS === 'true') {
      // Mode dev UNIQUEMENT avec flag explicite
      console.warn('[Stripe Webhook] ⚠️ DEV MODE: Webhook non signé accepté');
      event = JSON.parse(req.body.toString());
    } else {
      console.error('[Stripe Webhook] ❌ Signature requise');
      return res.status(400).send('Webhook signature required');
    }
  } catch (err) {
    console.error('[Stripe Webhook] Erreur signature:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Traiter l'evenement
  try {
    await handleWebhookEvent(event);
    res.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Erreur traitement:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
