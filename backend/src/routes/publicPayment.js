/**
 * Routes de paiement PUBLIC pour le widget de reservation
 * Ces endpoints sont accessibles sans authentification admin
 * Le tenant est identifie via X-Tenant-ID header
 *
 * NEXUS - Routes Paiement Public
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import {
  createStripePaymentIntent,
  confirmStripePayment,
  createPayPalOrder,
  capturePayPalOrder,
  eurosToCents,
  centsToEuros,
} from '../services/paymentService.js';
import { resolveTenantByDomain, requireTenant } from '../middleware/resolveTenant.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Appliquer resolution tenant sur toutes les routes
router.use(resolveTenantByDomain);
router.use(requireTenant);

// Rate limiting pour protection anti-abus
router.use(paymentLimiter);

// ============= SUPABASE CLIENT =============

let supabaseClient = null;
function getSupabase() {
  if (!supabaseClient && process.env.SUPABASE_URL) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabaseClient;
}

// ============= HELPERS =============

/**
 * Verifie qu'un tenant existe et est actif
 */
async function validateTenant(tenantId) {
  const db = getSupabase();
  if (!db) return true; // Skip validation si pas de DB

  const { data: tenant, error } = await db
    .from('tenants')
    .select('id, status, plan, settings')
    .eq('id', tenantId)
    .single();

  if (error || !tenant) {
    console.error(`[PublicPayment] Tenant ${tenantId} non trouve`);
    return false;
  }

  if (tenant.status !== 'active' && tenant.status !== 'trial') {
    console.error(`[PublicPayment] Tenant ${tenantId} inactif (${tenant.status})`);
    return false;
  }

  return true;
}

/**
 * Verifie que le service existe pour ce tenant
 */
async function validateService(tenantId, serviceId) {
  if (!serviceId) return null;

  const db = getSupabase();
  if (!db) return { id: serviceId, prix: 0 };

  const { data: service, error } = await db
    .from('services')
    .select('id, nom, prix, duree_minutes, actif')
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !service) {
    console.error(`[PublicPayment] Service ${serviceId} non trouve pour tenant ${tenantId}`);
    return null;
  }

  if (!service.actif) {
    console.error(`[PublicPayment] Service ${serviceId} inactif`);
    return null;
  }

  return service;
}

/**
 * Log de paiement public (sans donnees sensibles)
 */
function logPayment(action, tenantId, data = {}) {
  console.log(`[PublicPayment] ${action}`, {
    tenant: tenantId,
    amount: data.amount,
    provider: data.provider,
    timestamp: new Date().toISOString()
  });
}

// ============= STRIPE ENDPOINTS =============

/**
 * POST /api/public/payment/create-intent
 * Cree un PaymentIntent Stripe pour une reservation publique
 */
router.post('/create-intent', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Valider tenant
    const tenantValid = await validateTenant(tenantId);
    if (!tenantValid) {
      return res.status(403).json({
        success: false,
        error: 'Service temporairement indisponible'
      });
    }

    const { amount, clientEmail, clientName, items, serviceId } = req.body;

    // Validation montant
    if (!amount || amount < 50) {
      return res.status(400).json({
        success: false,
        error: 'Montant invalide (minimum 50 centimes)'
      });
    }

    if (amount > 100000) { // Max 1000€
      return res.status(400).json({
        success: false,
        error: 'Montant trop eleve'
      });
    }

    // Validation email basique
    if (clientEmail && !clientEmail.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Email invalide'
      });
    }

    // Si serviceId fourni, valider qu'il existe
    if (serviceId) {
      const service = await validateService(tenantId, serviceId);
      if (!service) {
        return res.status(400).json({
          success: false,
          error: 'Service non disponible'
        });
      }
    }

    // Creer le PaymentIntent
    const paymentIntent = await createStripePaymentIntent(tenantId, amount, {
      type: 'public_booking',
      client_email: clientEmail || '',
      client_name: clientName || '',
      items_count: items?.length?.toString() || '0',
      source: 'widget'
    });

    logPayment('stripe_intent_created', tenantId, {
      amount: amount / 100,
      provider: 'stripe'
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.payment_intent_id,
      amount: paymentIntent.amount,
    });

  } catch (error) {
    console.error('[PublicPayment] Erreur create-intent:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur initialisation paiement'
    });
  }
});

/**
 * POST /api/public/payment/confirm
 * Confirme un paiement Stripe (verification cote serveur)
 */
router.post('/confirm', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'paymentIntentId requis'
      });
    }

    // Verifier le paiement
    const paymentStatus = await confirmStripePayment(tenantId, paymentIntentId);

    if (!paymentStatus.confirmed) {
      return res.status(400).json({
        success: false,
        error: `Paiement non confirme (${paymentStatus.status})`,
        status: paymentStatus.status
      });
    }

    logPayment('stripe_confirmed', tenantId, {
      amount: centsToEuros(paymentStatus.amount),
      provider: 'stripe'
    });

    res.json({
      success: true,
      payment: {
        id: paymentIntentId,
        amount: centsToEuros(paymentStatus.amount),
        status: 'confirmed'
      }
    });

  } catch (error) {
    console.error('[PublicPayment] Erreur confirm:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur verification paiement'
    });
  }
});

// ============= PAYPAL ENDPOINTS =============

/**
 * POST /api/public/payment/create-paypal
 * Cree une commande PayPal pour une reservation publique
 */
router.post('/create-paypal', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    // Valider tenant
    const tenantValid = await validateTenant(tenantId);
    if (!tenantValid) {
      return res.status(403).json({
        success: false,
        error: 'Service temporairement indisponible'
      });
    }

    const { amount, clientEmail, clientName, items, description } = req.body;

    // Validation montant (en centimes)
    if (!amount || amount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Montant invalide (minimum 1€)'
      });
    }

    if (amount > 100000) { // Max 1000€
      return res.status(400).json({
        success: false,
        error: 'Montant trop eleve'
      });
    }

    // Montant en euros pour PayPal
    const amountEuros = amount / 100;

    // Description des services
    const desc = description ||
      (items?.length > 0
        ? `Reservation - ${items.map(i => i.serviceNom).join(', ')}`
        : 'Reservation en ligne');

    // Creer la commande PayPal
    const order = await createPayPalOrder(tenantId, amountEuros, {
      description: desc,
      client_email: clientEmail || '',
      client_name: clientName || '',
      source: 'widget'
    });

    logPayment('paypal_order_created', tenantId, {
      amount: amountEuros,
      provider: 'paypal'
    });

    res.json({
      success: true,
      orderId: order.order_id,
      approvalUrl: order.approval_url,
      amount: amountEuros
    });

  } catch (error) {
    console.error('[PublicPayment] Erreur create-paypal:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur creation commande PayPal'
    });
  }
});

/**
 * POST /api/public/payment/capture-paypal
 * Capture le paiement PayPal apres approbation
 */
router.post('/capture-paypal', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'orderId requis'
      });
    }

    // Capturer le paiement
    const capture = await capturePayPalOrder(tenantId, orderId);

    if (!capture.captured) {
      return res.status(400).json({
        success: false,
        error: `Paiement non capture (${capture.status})`,
        status: capture.status
      });
    }

    logPayment('paypal_captured', tenantId, {
      amount: parseFloat(capture.amount),
      provider: 'paypal'
    });

    res.json({
      success: true,
      payment: {
        orderId: capture.order_id,
        captureId: capture.capture_id,
        amount: parseFloat(capture.amount),
        payerEmail: capture.payer_email,
        status: 'captured'
      }
    });

  } catch (error) {
    console.error('[PublicPayment] Erreur capture-paypal:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur capture PayPal'
    });
  }
});

// ============= HEALTH CHECK =============

/**
 * GET /api/public/payment/health
 * Verification que le service est operationnel
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'public_payment',
    tenant: req.tenantId,
    stripe: !!process.env.STRIPE_SECRET_KEY,
    paypal: !!process.env.PAYPAL_CLIENT_ID
  });
});

export default router;
