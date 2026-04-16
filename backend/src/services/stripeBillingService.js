/**
 * Stripe Billing Service - Gestion des abonnements NEXUS
 *
 * Systeme d'abonnement dynamique: chaque module a son propre prix Stripe
 * Les tenants peuvent activer/desactiver des modules qui s'ajoutent a leur abonnement
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import {
  sendInvoicePaidEmail,
  sendPaymentFailedEmail,
  sendSubscriptionCancelledEmail,
  sendTrialAlert,
  sendDunningEmail,
  sendAccountSuspendedEmail
} from './tenantEmailService.js';
import { captureException, captureMessage } from '../config/sentry.js';
import creditsService, { CREDIT_PACKS, MONTHLY_INCLUDED } from './creditsService.js';

// Configuration Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
}) : null;

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

/**
 * Verifie si Stripe est configure
 */
export function isStripeConfigured() {
  return !!stripe;
}

/**
 * Convertit centimes en format Stripe (centimes)
 */
function toStripeAmount(centimes) {
  return Math.round(centimes);
}

/**
 * Cree la config IA web par defaut pour un tenant (idempotent).
 * Appelee quand le plan Basic/Business active `agent_ia_web` → le chat est
 * self-service, le tenant doit pouvoir utiliser le widget sans config manuelle.
 * Si une config existe deja, ne fait rien.
 */
async function createDefaultWebIAConfig(tenantId) {
  const { data: existing } = await supabase
    .from('tenant_ia_config')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('channel', 'web')
    .maybeSingle();

  if (existing) return; // deja configure

  await supabase
    .from('tenant_ia_config')
    .insert({
      tenant_id: tenantId,
      channel: 'web',
      config: {
        greeting_message: "Bonjour ! Je suis l'assistant virtuel. Comment puis-je vous aider ?",
        tone: 'professionnel',
        language: 'fr-FR',
        personality: 'Assistant professionnel et amical',
        services_description: '',
        booking_enabled: true,
        show_typing_indicator: true,
        auto_open_delay_ms: 0,
        position: 'bottom-right',
        theme: 'light',
        active: true,
      },
    });

  console.log(`[Stripe Webhook] Config IA web auto-creee pour ${tenantId}`);
}

// ════════════════════════════════════════════════════════════════════
// CUSTOMERS
// ════════════════════════════════════════════════════════════════════

/**
 * Cree ou recupere un Stripe Customer pour un tenant
 */
export async function getOrCreateCustomer(tenantId) {
  if (!stripe) throw new Error('Stripe not configured');

  // Verifier si le tenant a deja un customer_id
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, name, email, stripe_customer_id')
    .eq('id', tenantId)
    .single();

  if (tenantError) throw tenantError;

  // Si deja un customer
  if (tenant.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(tenant.stripe_customer_id);
      if (!customer.deleted) {
        return customer;
      }
    } catch (e) {
      // Customer n'existe plus, on le recree
      console.log(`[Stripe] Customer ${tenant.stripe_customer_id} invalide, recration...`);
    }
  }

  // Creer un nouveau customer
  const customer = await stripe.customers.create({
    name: tenant.name,
    email: tenant.email || `${tenantId}@nexus-ai-saas.com`,
    metadata: {
      tenant_id: tenantId,
      source: 'nexus'
    }
  });

  // Sauvegarder l'ID
  await supabase
    .from('tenants')
    .update({ stripe_customer_id: customer.id })
    .eq('id', tenantId);

  console.log(`[Stripe] Customer cree: ${customer.id} pour tenant ${tenantId}`);

  return customer;
}

// ════════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ════════════════════════════════════════════════════════════════════

/**
 * Cree ou met a jour un abonnement pour un tenant
 * @param tenantId - ID du tenant
 * @param moduleIds - Liste des IDs de modules a inclure
 * @param paymentMethodId - ID de la methode de paiement (optionnel si deja defini)
 */
export async function createOrUpdateSubscription(tenantId, moduleIds, paymentMethodId = null) {
  if (!stripe) throw new Error('Stripe not configured');

  // Recuperer le customer
  const customer = await getOrCreateCustomer(tenantId);

  // Attacher payment method si fourni
  if (paymentMethodId) {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });
    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  // Recuperer les price IDs pour les modules
  const { data: modules, error: modulesError } = await supabase
    .from('stripe_products')
    .select('module_id, stripe_price_id')
    .in('module_id', moduleIds);

  if (modulesError) throw modulesError;

  if (!modules || modules.length === 0) {
    throw new Error('Aucun module Stripe trouve. Executez le script setup-stripe-products.mjs');
  }

  // Construire les items de l'abonnement
  const subscriptionItems = modules.map(m => ({
    price: m.stripe_price_id,
    quantity: 1
  }));

  // Verifier si le tenant a deja un abonnement
  const { data: tenant } = await supabase
    .from('tenants')
    .select('stripe_subscription_id')
    .eq('id', tenantId)
    .single();

  let subscription;

  if (tenant?.stripe_subscription_id) {
    // Mettre a jour l'abonnement existant
    try {
      const existingSubscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id);

      if (existingSubscription.status !== 'canceled') {
        // Supprimer les anciens items et ajouter les nouveaux
        const itemsToDelete = existingSubscription.items.data.map(item => ({
          id: item.id,
          deleted: true
        }));

        subscription = await stripe.subscriptions.update(tenant.stripe_subscription_id, {
          items: [...itemsToDelete, ...subscriptionItems],
          proration_behavior: 'create_prorations',
          metadata: {
            tenant_id: tenantId,
            modules: moduleIds.join(',')
          }
        });

        console.log(`[Stripe] Subscription mise a jour: ${subscription.id}`);
      } else {
        // L'abonnement est annule, en creer un nouveau
        subscription = await createNewSubscription(customer.id, subscriptionItems, tenantId, moduleIds);
      }
    } catch (e) {
      // Abonnement invalide, en creer un nouveau
      subscription = await createNewSubscription(customer.id, subscriptionItems, tenantId, moduleIds);
    }
  } else {
    // Creer un nouvel abonnement
    subscription = await createNewSubscription(customer.id, subscriptionItems, tenantId, moduleIds);
  }

  // Sauvegarder l'ID de l'abonnement
  await supabase
    .from('tenants')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantId);

  return subscription;
}

/**
 * Cree un nouvel abonnement
 */
async function createNewSubscription(customerId, items, tenantId, moduleIds) {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items,
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      tenant_id: tenantId,
      modules: moduleIds.join(',')
    }
  });

  console.log(`[Stripe] Subscription creee: ${subscription.id}`);
  return subscription;
}

/**
 * Annule un abonnement
 */
export async function cancelSubscription(tenantId, immediately = false) {
  if (!stripe) throw new Error('Stripe not configured');

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('stripe_subscription_id')
    .eq('id', tenantId)
    .single();

  if (error) throw error;
  if (!tenant?.stripe_subscription_id) {
    throw new Error('Pas d\'abonnement actif');
  }

  let subscription;

  if (immediately) {
    subscription = await stripe.subscriptions.cancel(tenant.stripe_subscription_id);
  } else {
    // Annuler a la fin de la periode
    subscription = await stripe.subscriptions.update(tenant.stripe_subscription_id, {
      cancel_at_period_end: true
    });
  }

  // Mettre a jour le statut
  await supabase
    .from('tenants')
    .update({
      subscription_status: subscription.status,
      subscription_cancel_at: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantId);

  console.log(`[Stripe] Subscription ${immediately ? 'annulee' : 'programmee pour annulation'}: ${subscription.id}`);

  return subscription;
}

/**
 * Reactive un abonnement annule (avant fin de periode)
 */
export async function reactivateSubscription(tenantId) {
  if (!stripe) throw new Error('Stripe not configured');

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('stripe_subscription_id')
    .eq('id', tenantId)
    .single();

  if (error) throw error;
  if (!tenant?.stripe_subscription_id) {
    throw new Error('Pas d\'abonnement actif');
  }

  const subscription = await stripe.subscriptions.update(tenant.stripe_subscription_id, {
    cancel_at_period_end: false
  });

  await supabase
    .from('tenants')
    .update({
      subscription_status: subscription.status,
      subscription_cancel_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantId);

  console.log(`[Stripe] Subscription reactivee: ${subscription.id}`);

  return subscription;
}

/**
 * Recupere les details de l'abonnement d'un tenant
 */
export async function getSubscriptionDetails(tenantId) {
  if (!stripe) throw new Error('Stripe not configured');

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('stripe_subscription_id, stripe_customer_id, subscription_status')
    .eq('id', tenantId)
    .single();

  if (error) throw error;

  if (!tenant?.stripe_subscription_id) {
    return {
      has_subscription: false,
      status: null,
      current_period_end: null,
      cancel_at: null,
      items: []
    };
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id, {
      expand: ['items.data.price.product']
    });

    return {
      has_subscription: true,
      id: subscription.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      cancel_at: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null,
      items: subscription.items.data.map(item => ({
        id: item.id,
        price_id: item.price.id,
        product_id: item.price.product.id,
        product_name: item.price.product.name,
        unit_amount: item.price.unit_amount,
        quantity: item.quantity
      }))
    };
  } catch (e) {
    console.error('[Stripe] Erreur recuperation subscription:', e.message);
    captureException(e, { tags: { service: 'stripe', operation: 'get_subscription' } });
    return {
      has_subscription: false,
      error: e.message
    };
  }
}

// ════════════════════════════════════════════════════════════════════
// INVOICES
// ════════════════════════════════════════════════════════════════════

/**
 * Recupere les factures d'un tenant
 */
export async function getInvoices(tenantId, limit = 10) {
  if (!stripe) throw new Error('Stripe not configured');

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('stripe_customer_id')
    .eq('id', tenantId)
    .single();

  if (error) throw error;
  if (!tenant?.stripe_customer_id) {
    return { invoices: [] };
  }

  const invoices = await stripe.invoices.list({
    customer: tenant.stripe_customer_id,
    limit
  });

  return {
    invoices: invoices.data.map(inv => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount_due: inv.amount_due,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      created: new Date(inv.created * 1000).toISOString(),
      due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString() : null,
      pdf_url: inv.invoice_pdf,
      hosted_url: inv.hosted_invoice_url
    }))
  };
}

/**
 * Recupere la prochaine facture (preview)
 */
export async function getUpcomingInvoice(tenantId) {
  if (!stripe) throw new Error('Stripe not configured');

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('stripe_customer_id, stripe_subscription_id')
    .eq('id', tenantId)
    .single();

  if (error) throw error;
  if (!tenant?.stripe_subscription_id) {
    return null;
  }

  try {
    const invoice = await stripe.invoices.retrieveUpcoming({
      customer: tenant.stripe_customer_id,
      subscription: tenant.stripe_subscription_id
    });

    return {
      amount_due: invoice.amount_due,
      currency: invoice.currency,
      period_start: new Date(invoice.period_start * 1000).toISOString(),
      period_end: new Date(invoice.period_end * 1000).toISOString(),
      lines: invoice.lines.data.map(line => ({
        description: line.description,
        amount: line.amount,
        quantity: line.quantity
      }))
    };
  } catch (e) {
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════
// PAYMENT METHODS
// ════════════════════════════════════════════════════════════════════

/**
 * Cree un SetupIntent pour ajouter une methode de paiement
 */
export async function createSetupIntent(tenantId) {
  if (!stripe) throw new Error('Stripe not configured');

  const customer = await getOrCreateCustomer(tenantId);

  const setupIntent = await stripe.setupIntents.create({
    customer: customer.id,
    payment_method_types: ['card'],
    metadata: {
      tenant_id: tenantId
    }
  });

  return {
    client_secret: setupIntent.client_secret,
    setup_intent_id: setupIntent.id
  };
}

/**
 * Liste les methodes de paiement d'un tenant
 */
export async function getPaymentMethods(tenantId) {
  if (!stripe) throw new Error('Stripe not configured');

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('stripe_customer_id')
    .eq('id', tenantId)
    .single();

  if (error) throw error;
  if (!tenant?.stripe_customer_id) {
    return { payment_methods: [] };
  }

  const paymentMethods = await stripe.paymentMethods.list({
    customer: tenant.stripe_customer_id,
    type: 'card'
  });

  return {
    payment_methods: paymentMethods.data.map(pm => ({
      id: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      exp_month: pm.card.exp_month,
      exp_year: pm.card.exp_year,
      is_default: pm.id === tenant.default_payment_method
    }))
  };
}

/**
 * Supprime une methode de paiement
 * @param {string} tenantId - ID du tenant (obligatoire pour vérification propriétaire)
 * @param {string} paymentMethodId - ID Stripe du moyen de paiement
 */
export async function deletePaymentMethod(tenantId, paymentMethodId) {
  if (!stripe) throw new Error('Stripe not configured');
  if (!tenantId) throw new Error('tenant_id requis');

  // Vérifier que le PM appartient au customer Stripe du tenant
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('stripe_customer_id')
    .eq('id', tenantId)
    .single();

  if (error || !tenant?.stripe_customer_id) {
    throw new Error('Tenant ou customer Stripe non trouvé');
  }

  // Récupérer le PM depuis Stripe et vérifier le propriétaire
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  if (pm.customer !== tenant.stripe_customer_id) {
    throw new Error('Ce moyen de paiement ne vous appartient pas');
  }

  await stripe.paymentMethods.detach(paymentMethodId);
  return { success: true };
}

/**
 * Definit la methode de paiement par defaut
 */
export async function setDefaultPaymentMethod(tenantId, paymentMethodId) {
  if (!stripe) throw new Error('Stripe not configured');

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('stripe_customer_id')
    .eq('id', tenantId)
    .single();

  if (error) throw error;

  await stripe.customers.update(tenant.stripe_customer_id, {
    invoice_settings: {
      default_payment_method: paymentMethodId
    }
  });

  return { success: true };
}

// ════════════════════════════════════════════════════════════════════
// CHANGE PLAN (upgrade / downgrade direct sans portal)
// ════════════════════════════════════════════════════════════════════

/**
 * Change le plan d'un abonnement existant (upgrade/downgrade entre plans payants).
 * Evite de dependre de la config Stripe Customer Portal.
 * Prorata automatique applique par Stripe.
 *
 * @param {string} tenantId
 * @param {string} planId - 'basic' | 'business'
 * @param {string} cycle - 'monthly' | 'yearly'
 */
export async function changeSubscriptionPlan(tenantId, planId, cycle = 'monthly') {
  if (!stripe) throw new Error('Stripe not configured');
  if (!['basic', 'business'].includes(planId)) {
    throw new Error('Plan invalide (basic | business)');
  }

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('stripe_subscription_id')
    .eq('id', tenantId)
    .single();

  if (error) throw error;
  if (!tenant?.stripe_subscription_id) {
    throw new Error('Aucun abonnement actif — utilisez /billing/checkout pour souscrire');
  }

  // Resolve product_code → stripe_price_id
  const productCode = `nexus_${planId}_${cycle === 'yearly' ? 'yearly' : 'monthly'}`;
  const { data: product } = await supabase
    .from('stripe_products')
    .select('stripe_price_id')
    .eq('product_code', productCode)
    .single();

  if (!product?.stripe_price_id) {
    throw new Error(`Prix non trouve pour ${productCode}. Executer sync-stripe-products.mjs`);
  }

  // Recuperer la subscription pour obtenir l'item a modifier
  const subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id);
  if (!subscription.items?.data?.[0]?.id) {
    throw new Error('Subscription sans items — etat invalide');
  }
  const itemId = subscription.items.data[0].id;

  // Si deja sur le bon prix → no-op
  if (subscription.items.data[0].price?.id === product.stripe_price_id) {
    return {
      success: true,
      subscription_id: subscription.id,
      plan: planId,
      cycle,
      message: 'Deja sur ce plan'
    };
  }

  // Update subscription avec prorata automatique
  const updated = await stripe.subscriptions.update(tenant.stripe_subscription_id, {
    items: [{ id: itemId, price: product.stripe_price_id }],
    proration_behavior: 'create_prorations',
    // Si etait annule a la fin de periode, on re-active le renouvellement
    cancel_at_period_end: false,
    metadata: {
      ...(subscription.metadata || {}),
      plan: planId,
      cycle,
      plan_changed_at: new Date().toISOString()
    }
  });

  console.log(`[Stripe] Plan change pour tenant ${tenantId}: → ${planId} ${cycle}`);

  return {
    success: true,
    subscription_id: updated.id,
    plan: planId,
    cycle,
    status: updated.status
  };
}

// ════════════════════════════════════════════════════════════════════
// PORTAL
// ════════════════════════════════════════════════════════════════════

/**
 * Cree une session vers le Stripe Customer Portal
 */
export async function createPortalSession(tenantId, returnUrl) {
  if (!stripe) throw new Error('Stripe not configured');

  // Auto-creation du customer Stripe si inexistant
  const customer = await getOrCreateCustomer(tenantId);

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: returnUrl || `${process.env.APP_URL || 'http://localhost:5000'}/admin/subscription`
  });

  return {
    url: session.url
  };
}

// ════════════════════════════════════════════════════════════════════
// CHECKOUT SESSIONS
// ════════════════════════════════════════════════════════════════════

/**
 * Cree une Checkout Session pour un nouveau tenant
 * @param {string} tenantId - ID du tenant
 * @param {string} priceId - ID du prix Stripe (ou product_code)
 * @param {string} successUrl - URL de redirection apres succes
 * @param {string} cancelUrl - URL de redirection si annulation
 */
export async function createCheckoutSession(tenantId, priceId, successUrl, cancelUrl) {
  if (!stripe) throw new Error('Stripe not configured');

  // Si c'est un product_code, recuperer le stripe_price_id
  let finalPriceId = priceId;
  if (!priceId.startsWith('price_')) {
    const { data: product } = await supabase
      .from('stripe_products')
      .select('stripe_price_id')
      .eq('product_code', priceId)
      .single();

    if (!product?.stripe_price_id) {
      throw new Error(`Prix non trouve pour ${priceId}. Executez sync-stripe-products.mjs`);
    }
    finalPriceId = product.stripe_price_id;
  }

  // Recuperer ou creer le customer
  const customer = await getOrCreateCustomer(tenantId);

  // 🔒 SÉCURITÉ: Pas de trial Stripe. L'essai est gere cote NEXUS (statut='essai'
  // + essai_fin). Un tenant qui arrive sur /subscription pour payer a deja
  // consomme (ou refuse) son essai NEXUS — pas de double trial.
  const sessionParams = {
    customer: customer.id,
    payment_method_types: ['card'],
    line_items: [{
      price: finalPriceId,
      quantity: 1
    }],
    mode: 'subscription',
    success_url: successUrl || `${process.env.APP_URL}/admin?checkout=success`,
    cancel_url: cancelUrl || `${process.env.APP_URL}/admin/subscription?checkout=cancelled`,
    metadata: {
      tenant_id: tenantId
    },
    subscription_data: {
      metadata: {
        tenant_id: tenantId
      }
    }
  };

  const session = await stripe.checkout.sessions.create(sessionParams);

  console.log(`[Stripe] Checkout session creee: ${session.id} pour tenant ${tenantId}`);

  return {
    session_id: session.id,
    url: session.url
  };
}

/**
 * Cree une Checkout Session pour achat unique (pack SMS, credits, etc.)
 */
export async function createOneTimeCheckout(tenantId, priceId, quantity, successUrl, cancelUrl) {
  if (!stripe) throw new Error('Stripe not configured');

  // Si c'est un product_code, recuperer le stripe_price_id
  let finalPriceId = priceId;
  if (!priceId.startsWith('price_')) {
    const { data: product } = await supabase
      .from('stripe_products')
      .select('stripe_price_id, metadata')
      .eq('product_code', priceId)
      .single();

    if (!product?.stripe_price_id) {
      throw new Error(`Prix non trouve pour ${priceId}`);
    }
    finalPriceId = product.stripe_price_id;
  }

  const customer = await getOrCreateCustomer(tenantId);

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    payment_method_types: ['card'],
    line_items: [{
      price: finalPriceId,
      quantity: quantity || 1
    }],
    mode: 'payment',
    success_url: successUrl || `${process.env.APP_URL}/admin?purchase=success`,
    cancel_url: cancelUrl || `${process.env.APP_URL}/admin/subscription?purchase=cancelled`,
    metadata: {
      tenant_id: tenantId,
      product_code: priceId
    }
  });

  console.log(`[Stripe] One-time checkout creee: ${session.id} pour tenant ${tenantId}`);

  return {
    session_id: session.id,
    url: session.url
  };
}

// ════════════════════════════════════════════════════════════════════
// WEBHOOKS
// ════════════════════════════════════════════════════════════════════

/**
 * Traite un evenement webhook Stripe (avec deduplication idempotente)
 */
export async function handleWebhookEvent(event) {
  console.log(`[Stripe Webhook] ${event.type} (${event.id})`);

  // Idempotence check: skip if already processed
  const { data: existing } = await supabase
    .from('stripe_processed_events')
    .select('event_id')
    .eq('event_id', event.id)
    .single();

  if (existing) {
    console.log(`[Stripe Webhook] Event ${event.id} deja traite, skip`);
    return;
  }

  // Register event BEFORE processing (prevents concurrent duplicates)
  const tenantId = event.data?.object?.metadata?.tenant_id || null;
  await supabase.from('stripe_processed_events').insert({
    event_id: event.id,
    event_type: event.type,
    tenant_id: tenantId
  });

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;

    case 'invoice.paid':
      await handleInvoicePaid(event.data.object, event.id);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object, event.id);
      break;

    case 'customer.subscription.trial_will_end':
      await handleTrialWillEnd(event.data.object);
      break;

    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;

    default:
      console.log(`[Stripe Webhook] Event non gere: ${event.type}`);
  }
}

/**
 * Traite un checkout.session.completed
 * Sert principalement aux achats one-time (packs de credits IA).
 * Les abonnements sont gérés via customer.subscription.created.
 */
async function handleCheckoutCompleted(session) {
  // Seuls les paiements one-time nous intéressent ici (mode='payment')
  if (session.mode !== 'payment') {
    console.log(`[Stripe Webhook] checkout.session.completed mode=${session.mode}, skip (handled by subscription events)`);
    return;
  }

  const tenantId = session.metadata?.tenant_id;
  const productCode = session.metadata?.product_code;

  if (!tenantId) {
    console.warn('[Stripe Webhook] checkout.session.completed sans tenant_id:', session.id);
    return;
  }

  if (!productCode) {
    console.warn('[Stripe Webhook] checkout.session.completed sans product_code:', session.id);
    return;
  }

  // Identifier le pack de credits depuis le product_code
  const packEntry = Object.entries(CREDIT_PACKS).find(
    ([, pack]) => pack.code === productCode
  );

  if (!packEntry) {
    console.log(`[Stripe Webhook] product_code "${productCode}" non reconnu comme pack credits, skip`);
    return;
  }

  const [packId, pack] = packEntry;

  try {
    const result = await creditsService.purchasePack(tenantId, packId, {
      stripeInvoiceId: session.invoice || session.id,
      metadata: {
        stripe_session_id: session.id,
        amount_paid: session.amount_total,
        currency: session.currency,
      },
    });

    console.log(`[Stripe Webhook] Pack ${packId} crédité pour ${tenantId}: +${pack.credits} crédits → solde ${result.balance}`);
  } catch (err) {
    captureException(err, {
      tags: { service: 'stripe', operation: 'purchase_credits_pack' },
      extra: { tenantId, packId, sessionId: session.id },
    });
    console.error(`[Stripe Webhook] Erreur achat pack ${packId} pour ${tenantId}:`, err.message);
    throw err;
  }
}

async function handleSubscriptionUpdate(subscription) {
  const tenantId = subscription.metadata?.tenant_id;
  if (!tenantId) {
    console.warn('[Stripe Webhook] Subscription sans tenant_id:', subscription.id);
    return;
  }

  // Extraire le plan depuis les items de la subscription
  const planId = extractPlanFromSubscription(subscription);
  const planModules = computeModulesFromPlan(planId);

  const updateData = {
    stripe_subscription_id: subscription.id,
    subscription_status: subscription.status,
    subscription_cancel_at: subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString()
  };

  // Mettre a jour le plan seulement si la subscription est active
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    updateData.plan_id = planId;
    updateData.plan = planId;
    updateData.tier = planId;
    updateData.statut = subscription.status === 'trialing' ? 'essai' : 'actif';

    // Merger avec modules existants au lieu d'ecraser :
    // - Les modules manuellement actives par super-admin (whatsapp, telephone, ...)
    //   ne sont PAS dans planModules → ils sont preserves tels quels.
    // - Les modules du plan ecrasent la valeur precedente (on veut pouvoir
    //   les activer au upgrade et les desactiver au downgrade).
    const { data: current } = await supabase
      .from('tenants')
      .select('modules_actifs')
      .eq('id', tenantId)
      .single();

    const existingModules = (current?.modules_actifs && typeof current.modules_actifs === 'object')
      ? current.modules_actifs
      : {};

    updateData.modules_actifs = { ...existingModules, ...planModules };

    // Extraire canaux depuis modules_actifs mergés pour options_canaux_actifs
    const mergedModules = updateData.modules_actifs;
    const canauxActifs = {};
    if (mergedModules.agent_ia_web) canauxActifs.agent_ia_web = true;
    if (mergedModules.agent_ia_whatsapp) canauxActifs.agent_ia_whatsapp = true;
    if (mergedModules.agent_ia_telephone) canauxActifs.agent_ia_telephone = true;
    if (mergedModules.site_web) canauxActifs.site_web = true;
    updateData.options_canaux_actifs = canauxActifs;
  }

  await supabase
    .from('tenants')
    .update(updateData)
    .eq('id', tenantId);

  // Auto-creer la config IA web par defaut si le plan l'active (chat web = self-service)
  if (
    (subscription.status === 'active' || subscription.status === 'trialing') &&
    planModules.agent_ia_web === true
  ) {
    try {
      await createDefaultWebIAConfig(tenantId);
    } catch (err) {
      console.error(`[Stripe Webhook] Erreur creation config IA web pour ${tenantId}:`, err.message);
      // Non-bloquant
    }
  }

  console.log(`[Stripe Webhook] Subscription ${subscription.id} mise a jour pour ${tenantId}: status=${subscription.status}, plan=${planId}`);

  // 💳 Octroi des crédits IA mensuels inclus (Basic & Business) a chaque renouvellement de periode
  // - Premiere activation d'un plan payant : grant complet + init monthly_included
  // - Renouvellement periode : grant complet (monthly_reset_at depassee)
  // - Upgrade Basic -> Business en cours de periode : top-up de la difference
  // - Downgrade Business -> Basic : pas de nouveau grant, monthly_included ajuste pour prochain reset
  if (
    ['basic', 'business'].includes(planId) &&
    (subscription.status === 'active' || subscription.status === 'trialing')
  ) {
    try {
      const monthlyAmount = MONTHLY_INCLUDED[planId] || 0;
      if (monthlyAmount > 0) {
        const balance = await creditsService.getBalance(tenantId);
        const now = new Date();
        const lastReset = balance.monthly_reset_at ? new Date(balance.monthly_reset_at) : null;
        const periodExpired = !lastReset || lastReset <= now;

        const currentIncluded = balance.monthly_included || 0;
        const isUpgrade = !periodExpired && monthlyAmount > currentIncluded;

        let granted = 0;
        if (periodExpired) {
          // Nouvelle periode : grant complet
          await creditsService.grantMonthlyIncluded(tenantId, monthlyAmount);
          granted = monthlyAmount;
        } else if (isUpgrade) {
          // Upgrade en cours de periode : top-up de la difference
          const delta = monthlyAmount - currentIncluded;
          await creditsService.grantMonthlyIncluded(tenantId, delta);
          granted = delta;
        }

        // Mettre a jour monthly_included (plan change) + reset cycle si nouvelle periode
        const updates = { monthly_included: monthlyAmount };
        if (periodExpired) {
          const nextReset = new Date(now);
          nextReset.setMonth(nextReset.getMonth() + 1);
          nextReset.setDate(1);
          nextReset.setHours(0, 0, 0, 0);
          updates.monthly_reset_at = nextReset.toISOString();
          updates.monthly_used = 0;
        }

        await supabase.from('ai_credits').update(updates).eq('tenant_id', tenantId);

        if (granted > 0) {
          console.log(`[Stripe Webhook] Grant mensuel ${planId}: +${granted} credits a ${tenantId}`);
        }
      }
    } catch (err) {
      captureException(err, {
        tags: { service: 'stripe', operation: 'grant_monthly_credits' },
        extra: { tenantId, planId },
      });
      console.error(`[Stripe Webhook] Erreur grant mensuel ${planId} pour ${tenantId}:`, err.message);
      // Non-bloquant
    }
  }
}

/**
 * Extrait le plan_id depuis les items de la subscription Stripe
 * Modèle 2026 : Free / Basic / Business
 * Aliases retro-compat : 'starter' → 'free', 'pro' → 'basic'
 */
function extractPlanFromSubscription(subscription) {
  const items = subscription.items?.data || [];

  const normalize = (raw) => {
    if (raw.includes('business')) return 'business';
    if (raw.includes('basic')) return 'basic';
    if (raw.includes('free')) return 'free';
    // Legacy aliases
    if (raw.includes('starter')) return 'free';
    if (raw.includes('pro')) return 'basic';
    return null;
  };

  for (const item of items) {
    const productCode = (item.price?.metadata?.product_code || '').toLowerCase();
    const found = normalize(productCode);
    if (found) return found;
  }

  // Fallback: verifier le nom du produit
  for (const item of items) {
    const productName = (item.price?.product?.name || '').toLowerCase();
    const found = normalize(productName);
    if (found) return found;
  }

  return 'free'; // Default
}

/**
 * Calcule les modules actifs selon le plan
 * Modèle 2026 : Free (limité) / Basic (tout débloqué + IA pay-as-you-go) / Business (Basic + premium)
 */
function computeModulesFromPlan(planId) {
  const FREE_MODULES = {
    dashboard: true,
    clients: true,
    reservations: true,
    facturation: true,
    documents: true,
    paiements: true,
    ecommerce: true,
    reviews: true,
    waitlist: true,
    // ⛔ IA bloquée en Free
    agent_ia_web: false,
    whatsapp: false,
    telephone: false,
  };

  // NOTE: `whatsapp`, `telephone`, `agent_ia_whatsapp`, `agent_ia_telephone` ne
  // sont PAS dans cette liste car ils necessitent un provisioning Twilio
  // manuel (cf memory/activation-ia-protocol.md). Le tenant doit faire une
  // demande d'activation depuis /ia-whatsapp ou /ia-telephone → super-admin
  // approuve dans Sentinel apres avoir configure le numero Twilio.
  // Seul `agent_ia_web` est auto-active (self-service, aucun provisioning).
  const BASIC_MODULES = {
    dashboard: true,
    clients: true,
    reservations: true,
    facturation: true,
    documents: true,
    paiements: true,
    ecommerce: true,
    reviews: true,
    waitlist: true,
    // ✨ Chat web IA auto-active (self-service, pas de numero)
    agent_ia_web: true,
    // Modules avancés débloqués
    comptabilite: true,
    crm_avance: true,
    marketing: true,
    pipeline: true,
    commercial: true,
    stock: true,
    analytics: true,
    devis: true,
    equipe: true,
    fidelite: true,
    rh: true,
    seo: true,
    workflows: true,
    sentinel: true,
  };

  const BUSINESS_MODULES = {
    ...BASIC_MODULES,
    api: true,
    multi_site: true,
    whitelabel: true,
    sso: true,
  };

  const PLAN_MODULES = {
    free: FREE_MODULES,
    basic: BASIC_MODULES,
    business: BUSINESS_MODULES,
    // ⚠️ DEPRECATED — alias retro-compat
    starter: FREE_MODULES,
    pro: BASIC_MODULES,
  };

  return PLAN_MODULES[planId] || PLAN_MODULES.free;
}

async function handleSubscriptionDeleted(subscription) {
  const tenantId = subscription.metadata?.tenant_id;
  if (!tenantId) return;

  // Desactiver tous les modules sauf socle + marquer le tenant comme annule
  await supabase
    .from('tenants')
    .update({
      modules_actifs: { socle: true },
      subscription_status: 'canceled',
      statut: 'annule',
      stripe_subscription_id: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantId);

  // Envoyer l'email de confirmation d'annulation
  const endDate = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : new Date().toISOString();

  sendSubscriptionCancelledEmail(tenantId, endDate).catch(err =>
    console.error('[Stripe Webhook] Erreur email subscription cancelled:', err)
  );

  console.log(`[Stripe Webhook] Subscription annulee pour ${tenantId}, modules desactives`);
}

async function handleInvoicePaid(invoice, stripeEventId = null) {
  const customerId = invoice.customer;

  // Trouver le tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, nom, email, plan, payment_failures_count, statut')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!tenant) return;

  // Logger le paiement avec stripe_event_id pour tracabilite
  await supabase.from('billing_events').insert({
    tenant_id: tenant.id,
    event_type: 'invoice_paid',
    amount: invoice.amount_paid,
    currency: invoice.currency,
    invoice_id: invoice.id,
    stripe_event_id: stripeEventId,
    created_at: new Date().toISOString()
  });

  // Reset compteur d'échecs et réactiver si suspendu
  if (tenant.payment_failures_count > 0 || tenant.statut === 'suspendu') {
    await supabase
      .from('tenants')
      .update({
        payment_failures_count: 0,
        last_payment_failed_at: null,
        subscription_status: 'active',
        ...(tenant.statut === 'suspendu' ? { statut: 'actif' } : {})
      })
      .eq('id', tenant.id);

    console.log(`[Stripe Webhook] Dunning reset: ${tenant.id} réactivé après paiement réussi`);
  }

  // Envoyer l'email de confirmation
  sendInvoicePaidEmail(tenant.id, {
    number: invoice.number || invoice.id,
    amount: invoice.amount_paid,
    planName: tenant.plan,
    url: invoice.hosted_invoice_url
  }).catch(err => console.error('[Stripe Webhook] Erreur email facture:', err));

  console.log(`[Stripe Webhook] Facture payee: ${invoice.id} - ${invoice.amount_paid/100}${invoice.currency.toUpperCase()}`);

  // Declencher les workflows post-paiement (non-bloquant)
  try {
    const { triggerWorkflows } = await import('../automation/workflowEngine.js');
    await triggerWorkflows('payment_received', {
      tenant_id: tenant.id,
      entity: {
        email: tenant.email || invoice.customer_email,
        nom: tenant.nom || tenant.id,
        invoice_id: invoice.id,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency,
        plan: tenant.plan,
        type: 'payment',
      }
    });
  } catch (wfErr) {
    console.warn('[BILLING] Workflow trigger error (non-blocking)', { error: wfErr.message });
  }
}

async function handleInvoicePaymentFailed(invoice, stripeEventId = null) {
  const customerId = invoice.customer;
  const MAX_FAILURES = 3; // Suspendre après 3 échecs

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, payment_failures_count')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!tenant) return;

  const failureCount = (tenant.payment_failures_count || 0) + 1;
  const nextRetryDate = invoice.next_payment_attempt
    ? new Date(invoice.next_payment_attempt * 1000).toISOString()
    : null;

  // Logger l'échec avec stripe_event_id
  await supabase.from('billing_events').insert({
    tenant_id: tenant.id,
    event_type: 'payment_failed',
    amount: invoice.amount_due,
    currency: invoice.currency,
    invoice_id: invoice.id,
    stripe_event_id: stripeEventId,
    metadata: { failure_number: failureCount },
    created_at: new Date().toISOString()
  });

  // Incrémenter compteur + marquer past_due
  const updateData = {
    payment_failures_count: failureCount,
    last_payment_failed_at: new Date().toISOString(),
    subscription_status: 'past_due'
  };

  // Suspendre après MAX_FAILURES échecs consécutifs
  if (failureCount >= MAX_FAILURES) {
    updateData.statut = 'suspendu';
    console.log(`[Stripe Webhook] SUSPENSION: tenant ${tenant.id} suspendu après ${failureCount} échecs`);
  }

  await supabase
    .from('tenants')
    .update(updateData)
    .eq('id', tenant.id);

  // Envoyer l'email approprié selon le nombre d'échecs
  if (failureCount >= MAX_FAILURES) {
    // Email de suspension
    sendAccountSuspendedEmail(tenant.id, {
      amount: invoice.amount_due
    }).catch(err => console.error('[Stripe Webhook] Erreur email suspension:', err));
  } else if (failureCount === 1) {
    // Premier échec : email standard
    sendPaymentFailedEmail(tenant.id, {
      amount: invoice.amount_due,
      nextRetryDate
    }).catch(err => console.error('[Stripe Webhook] Erreur email payment failed:', err));
  } else {
    // 2e+ échec : email d'escalade
    sendDunningEmail(tenant.id, {
      failureCount,
      amount: invoice.amount_due,
      nextRetryDate
    }).catch(err => console.error('[Stripe Webhook] Erreur email dunning:', err));
  }

  captureMessage(`Payment failed for tenant ${tenant.id} (attempt ${failureCount}/${MAX_FAILURES})`, failureCount >= MAX_FAILURES ? 'error' : 'warning', {
    tags: { service: 'stripe', type: 'payment_failed', severity: failureCount >= MAX_FAILURES ? 'suspension' : 'dunning' },
    extra: { tenantId: tenant.id, invoiceId: invoice.id, amount: invoice.amount_due, failureCount }
  });
  console.log(`[Stripe Webhook] Paiement echoue pour ${tenant.id}: ${invoice.id} (échec ${failureCount}/${MAX_FAILURES})`);
}

async function handleTrialWillEnd(subscription) {
  const tenantId = subscription.metadata?.tenant_id;
  if (!tenantId) return;

  // Envoyer l'alerte J-3
  sendTrialAlert(tenantId, 3).catch(err =>
    console.error('[Stripe Webhook] Erreur email trial warning:', err)
  );

  console.log(`[Stripe Webhook] Trial se termine pour ${tenantId}`);
}

// Export par defaut
export default {
  isStripeConfigured,
  getOrCreateCustomer,
  createOrUpdateSubscription,
  cancelSubscription,
  reactivateSubscription,
  getSubscriptionDetails,
  getInvoices,
  getUpcomingInvoice,
  createSetupIntent,
  getPaymentMethods,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  createPortalSession,
  changeSubscriptionPlan,
  createCheckoutSession,
  createOneTimeCheckout,
  handleWebhookEvent
};
