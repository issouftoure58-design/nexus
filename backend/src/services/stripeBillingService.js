/**
 * Stripe Billing Service - Gestion des abonnements NEXUS
 *
 * Systeme d'abonnement dynamique: chaque module a son propre prix Stripe
 * Les tenants peuvent activer/desactiver des modules qui s'ajoutent a leur abonnement
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

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
    email: tenant.email || `${tenantId}@nexus.app`,
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
 */
export async function deletePaymentMethod(paymentMethodId) {
  if (!stripe) throw new Error('Stripe not configured');

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
// PORTAL
// ════════════════════════════════════════════════════════════════════

/**
 * Cree une session vers le Stripe Customer Portal
 */
export async function createPortalSession(tenantId, returnUrl) {
  if (!stripe) throw new Error('Stripe not configured');

  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('stripe_customer_id')
    .eq('id', tenantId)
    .single();

  if (error) throw error;
  if (!tenant?.stripe_customer_id) {
    throw new Error('Pas de customer Stripe');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripe_customer_id,
    return_url: returnUrl || `${process.env.APP_URL || 'http://localhost:5000'}/admin/subscription`
  });

  return {
    url: session.url
  };
}

// ════════════════════════════════════════════════════════════════════
// WEBHOOKS
// ════════════════════════════════════════════════════════════════════

/**
 * Traite un evenement webhook Stripe
 */
export async function handleWebhookEvent(event) {
  console.log(`[Stripe Webhook] ${event.type}`);

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;

    case 'invoice.paid':
      await handleInvoicePaid(event.data.object);
      break;

    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object);
      break;

    case 'customer.subscription.trial_will_end':
      await handleTrialWillEnd(event.data.object);
      break;

    default:
      console.log(`[Stripe Webhook] Event non gere: ${event.type}`);
  }
}

async function handleSubscriptionUpdate(subscription) {
  const tenantId = subscription.metadata?.tenant_id;
  if (!tenantId) {
    console.warn('[Stripe Webhook] Subscription sans tenant_id:', subscription.id);
    return;
  }

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

  console.log(`[Stripe Webhook] Subscription ${subscription.id} mise a jour pour ${tenantId}: ${subscription.status}`);
}

async function handleSubscriptionDeleted(subscription) {
  const tenantId = subscription.metadata?.tenant_id;
  if (!tenantId) return;

  // Desactiver tous les modules sauf socle
  await supabase
    .from('tenants')
    .update({
      modules_actifs: { socle: true },
      subscription_status: 'canceled',
      stripe_subscription_id: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', tenantId);

  console.log(`[Stripe Webhook] Subscription annulee pour ${tenantId}, modules desactives`);
}

async function handleInvoicePaid(invoice) {
  const customerId = invoice.customer;

  // Trouver le tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!tenant) return;

  // Logger le paiement
  await supabase.from('billing_events').insert({
    tenant_id: tenant.id,
    event_type: 'invoice_paid',
    amount: invoice.amount_paid,
    currency: invoice.currency,
    invoice_id: invoice.id,
    created_at: new Date().toISOString()
  });

  console.log(`[Stripe Webhook] Facture payee: ${invoice.id} - ${invoice.amount_paid/100}${invoice.currency.toUpperCase()}`);
}

async function handleInvoicePaymentFailed(invoice) {
  const customerId = invoice.customer;

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!tenant) return;

  // Logger l'echec
  await supabase.from('billing_events').insert({
    tenant_id: tenant.id,
    event_type: 'payment_failed',
    amount: invoice.amount_due,
    currency: invoice.currency,
    invoice_id: invoice.id,
    created_at: new Date().toISOString()
  });

  // TODO: Envoyer notification email

  console.log(`[Stripe Webhook] Paiement echoue pour ${tenant.id}: ${invoice.id}`);
}

async function handleTrialWillEnd(subscription) {
  const tenantId = subscription.metadata?.tenant_id;
  if (!tenantId) return;

  // TODO: Envoyer notification email "votre essai se termine dans 3 jours"

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
  handleWebhookEvent
};
