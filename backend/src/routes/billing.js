/**
 * Routes Billing - Gestion des abonnements Stripe
 *
 * GET    /api/billing/subscription         - Details abonnement actuel
 * POST   /api/billing/subscription         - Creer/mettre a jour abonnement
 * DELETE /api/billing/subscription         - Annuler abonnement
 * POST   /api/billing/subscription/reactivate - Reactiver abonnement
 *
 * GET    /api/billing/invoices             - Liste des factures
 * GET    /api/billing/upcoming             - Prochaine facture (preview)
 *
 * GET    /api/billing/payment-methods      - Liste des moyens de paiement
 * POST   /api/billing/setup-intent         - Creer SetupIntent pour ajouter carte
 * DELETE /api/billing/payment-methods/:id  - Supprimer un moyen de paiement
 * POST   /api/billing/payment-methods/:id/default - Definir comme defaut
 *
 * POST   /api/billing/portal               - Creer session Customer Portal
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import logger from '../config/logger.js';
import * as billingService from '../services/stripeBillingService.js';
import creditsService, { CREDIT_PACKS, CREDIT_COSTS } from '../services/creditsService.js';

const router = express.Router();

// Middleware auth sur toutes les routes
router.use(authenticateAdmin);

// ════════════════════════════════════════════════════════════════════
// SUBSCRIPTION
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/billing/subscription
 * Recupere les details de l'abonnement du tenant
 */
router.get('/subscription', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const details = await billingService.getSubscriptionDetails(tenantId);

    res.json({
      success: true,
      ...details
    });
  } catch (error) {
    logger.error('Billing Erreur GET subscription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/billing/subscription
 * Cree ou met a jour l'abonnement
 * Body: { moduleIds: ['socle', 'whatsapp'], paymentMethodId?: 'pm_xxx' }
 */
router.post('/subscription', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { moduleIds, paymentMethodId } = req.body;

    if (!moduleIds || !Array.isArray(moduleIds) || moduleIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'moduleIds requis (array non vide)'
      });
    }

    // Le socle est toujours requis
    const modulesWithSocle = moduleIds.includes('socle')
      ? moduleIds
      : ['socle', ...moduleIds];

    const subscription = await billingService.createOrUpdateSubscription(
      tenantId,
      modulesWithSocle,
      paymentMethodId
    );

    // Determiner si le paiement est requis
    const requiresAction = subscription.status === 'incomplete' &&
      subscription.latest_invoice?.payment_intent?.status === 'requires_action';

    const requiresPaymentMethod = subscription.status === 'incomplete' &&
      subscription.latest_invoice?.payment_intent?.status === 'requires_payment_method';

    res.json({
      success: true,
      subscription_id: subscription.id,
      status: subscription.status,
      requires_action: requiresAction,
      requires_payment_method: requiresPaymentMethod,
      client_secret: subscription.latest_invoice?.payment_intent?.client_secret || null
    });
  } catch (error) {
    logger.error('Billing Erreur POST subscription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/billing/subscription
 * Annule l'abonnement
 * Query: ?immediately=true pour annulation immediate
 */
router.delete('/subscription', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const immediately = req.query.immediately === 'true';

    const subscription = await billingService.cancelSubscription(tenantId, immediately);

    res.json({
      success: true,
      message: immediately
        ? 'Abonnement annule immediatement'
        : 'Abonnement sera annule a la fin de la periode',
      cancel_at: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null,
      status: subscription.status
    });
  } catch (error) {
    logger.error('Billing Erreur DELETE subscription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/billing/subscription/reactivate
 * Reactive un abonnement annule (avant fin de periode)
 */
router.post('/subscription/reactivate', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const subscription = await billingService.reactivateSubscription(tenantId);

    res.json({
      success: true,
      message: 'Abonnement reactive',
      status: subscription.status
    });
  } catch (error) {
    logger.error('Billing Erreur reactivate:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// INVOICES
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/billing/invoices
 * Liste les factures du tenant
 */
router.get('/invoices', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const limit = parseInt(req.query.limit) || 10;

    const result = await billingService.getInvoices(tenantId, limit);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Billing Erreur GET invoices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/billing/upcoming
 * Preview de la prochaine facture
 */
router.get('/upcoming', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const invoice = await billingService.getUpcomingInvoice(tenantId);

    if (!invoice) {
      return res.json({
        success: true,
        has_upcoming: false
      });
    }

    res.json({
      success: true,
      has_upcoming: true,
      ...invoice
    });
  } catch (error) {
    logger.error('Billing Erreur GET upcoming:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// PAYMENT METHODS
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/billing/payment-methods
 * Liste les moyens de paiement
 */
router.get('/payment-methods', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const result = await billingService.getPaymentMethods(tenantId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Billing Erreur GET payment-methods:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/billing/setup-intent
 * Cree un SetupIntent pour ajouter une carte
 */
router.post('/setup-intent', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const result = await billingService.createSetupIntent(tenantId);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Billing Erreur POST setup-intent:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/billing/payment-methods/:id
 * Supprime un moyen de paiement
 */
router.delete('/payment-methods/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    await billingService.deletePaymentMethod(tenantId, id);

    res.json({
      success: true,
      message: 'Moyen de paiement supprime'
    });
  } catch (error) {
    logger.error('Billing Erreur DELETE payment-method:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/billing/payment-methods/:id/default
 * Definit comme moyen de paiement par defaut
 */
router.post('/payment-methods/:id/default', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    await billingService.setDefaultPaymentMethod(tenantId, id);

    res.json({
      success: true,
      message: 'Moyen de paiement defini par defaut'
    });
  } catch (error) {
    logger.error('Billing Erreur set default:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// CUSTOMER PORTAL
// ════════════════════════════════════════════════════════════════════

/**
 * POST /api/billing/portal
 * Cree une session vers le Stripe Customer Portal
 */
router.post('/portal', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { returnUrl } = req.body;

    const result = await billingService.createPortalSession(tenantId, returnUrl);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Billing Erreur POST portal:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// CHECKOUT SESSIONS
// ════════════════════════════════════════════════════════════════════

/**
 * POST /api/billing/checkout
 * Cree une Checkout Session pour souscrire a un plan
 * Body: { priceId: 'nexus_pro_monthly' | 'price_xxx', successUrl?, cancelUrl? }
 */
router.post('/checkout', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { priceId, successUrl, cancelUrl } = req.body;

    if (!priceId) {
      return res.status(400).json({
        success: false,
        error: 'priceId requis (ex: nexus_pro_monthly ou price_xxx)'
      });
    }

    const result = await billingService.createCheckoutSession(
      tenantId,
      priceId,
      successUrl,
      cancelUrl
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Billing Erreur POST checkout:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/billing/checkout/pack
 * Cree une Checkout Session pour achat unique (pack SMS, credits, etc.)
 * Body: { priceId: 'nexus_sms_500' | 'price_xxx', quantity?: 1, successUrl?, cancelUrl? }
 */
router.post('/checkout/pack', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { priceId, quantity, successUrl, cancelUrl } = req.body;

    if (!priceId) {
      return res.status(400).json({
        success: false,
        error: 'priceId requis (ex: nexus_sms_500)'
      });
    }

    const result = await billingService.createOneTimeCheckout(
      tenantId,
      priceId,
      quantity || 1,
      successUrl,
      cancelUrl
    );

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    logger.error('Billing Erreur POST checkout/pack:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// CREDITS IA — Solde, transactions, achat de packs
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/billing/credits/balance
 * Solde courant en crédits IA + métadonnées (mensuel inclus, prochain reset, etc.)
 */
router.get('/credits/balance', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const balance = await creditsService.getBalance(tenantId);

    res.json({
      success: true,
      balance: balance.balance,
      total_purchased: balance.total_purchased || 0,
      total_consumed: balance.total_consumed || 0,
      monthly_included: balance.monthly_included || 0,
      monthly_used: balance.monthly_used || 0,
      monthly_reset_at: balance.monthly_reset_at,
      auto_recharge_enabled: balance.auto_recharge_enabled || false,
      auto_recharge_threshold: balance.auto_recharge_threshold || null,
      auto_recharge_pack: balance.auto_recharge_pack || null,
    });
  } catch (error) {
    logger.error('Billing Erreur GET credits/balance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/billing/credits/transactions
 * Historique des transactions (achats, consommation, grants).
 * Query: ?limit=50&type=consume|purchase|monthly_grant
 */
router.get('/credits/transactions', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const type = req.query.type || null;

    const transactions = await creditsService.getTransactions(tenantId, { limit, type });

    res.json({
      success: true,
      transactions,
      count: transactions.length,
    });
  } catch (error) {
    logger.error('Billing Erreur GET credits/transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/billing/credits/packs
 * Liste des packs disponibles + grille tarifaire (sans authentification spéciale).
 */
router.get('/credits/packs', (req, res) => {
  res.json({
    success: true,
    packs: Object.entries(CREDIT_PACKS).map(([id, pack]) => ({
      id,
      code: pack.code,
      credits: pack.credits,
      price_cents: pack.price_cents,
      price_eur: pack.price_cents / 100,
      bonus_pct: pack.bonus_pct,
      cost_per_credit_cents: pack.price_cents / pack.credits,
    })),
    costs: CREDIT_COSTS,
  });
});

/**
 * POST /api/billing/credits/checkout
 * Crée une Checkout Session pour acheter un pack de crédits IA.
 * Body: { packId: 'pack_1000', successUrl?, cancelUrl? }
 *
 * Modèle pricing 2026 — révision finale 9 avril 2026 :
 * Pack unique 1000 crédits — 15€ (taux base 0,015€/crédit, 0% bonus).
 */
router.post('/credits/checkout', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { packId, successUrl, cancelUrl } = req.body;

    const validPackIds = Object.keys(CREDIT_PACKS); // ex: ['pack_1000']
    if (!packId || !CREDIT_PACKS[packId]) {
      return res.status(400).json({
        success: false,
        error: `packId requis (${validPackIds.join(' | ')}). Reçu: ${packId}`,
      });
    }

    const pack = CREDIT_PACKS[packId];

    const result = await billingService.createOneTimeCheckout(
      tenantId,
      pack.code, // ex: 'nexus_credits_1000'
      1,
      successUrl,
      cancelUrl
    );

    res.json({
      success: true,
      pack: {
        id: packId,
        credits: pack.credits,
        price_cents: pack.price_cents,
      },
      ...result,
    });
  } catch (error) {
    logger.error('Billing Erreur POST credits/checkout:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// STATUS CHECK
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/billing/status
 * Verifie si Stripe est configure
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    stripe_configured: billingService.isStripeConfigured(),
    mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? 'live' : 'test'
  });
});

export default router;
