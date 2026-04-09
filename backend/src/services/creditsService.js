/**
 * Credits Service — Gestion des crédits IA (modèle 2026 — révisé 9 avril 2026)
 *
 * Modèle :
 *   • 1,5€ = 100 crédits (taux interne de référence — 0,015€/crédit)
 *   • Free     : 0 crédit (IA bloquée)
 *   • Basic    : 500 crédits inclus/mois (valeur 7,50€) + pack additionnel
 *   • Business : 10 000 crédits inclus/mois (valeur 150€) + pack additionnel
 *
 * Pack unique disponible :
 *   • Pack 1000 : 15€ → 1 000 crédits (taux base, sans bonus)
 *
 * TENANT SHIELD : tenantId est TOUJOURS le 1er paramètre, JAMAIS de fallback.
 */

import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

// ════════════════════════════════════════════════════════════════════
// CONSTANTES — Taux de consommation par action IA (en crédits)
// ════════════════════════════════════════════════════════════════════

export const CREDIT_COSTS = {
  chat_admin_question: 1,    // 1 question chat IA admin (Haiku 4.5)
  whatsapp_message: 1,       // 1 message WhatsApp IA répondu
  web_chat_conversation: 5,  // 1 conversation Agent IA Web (~5 messages Sonnet)
  phone_minute: 8,           // 1 minute appel Téléphone IA
  social_post_generated: 5,  // 1 post réseaux généré (Sonnet + image)
  email_ia_sent: 3,          // 1 email IA généré + envoi
  antichurn_whatsapp: 2,     // 1 message Anti-Churn WhatsApp
  antichurn_sms_fr: 10,      // 1 message Anti-Churn SMS FR (cher)
  seo_article: 50,           // 1 article SEO complet (1500 mots)
  devis_ia: 2,               // 1 devis IA généré
};

// Pack unique disponible (taux base, sans bonus)
export const CREDIT_PACKS = {
  pack_1000: { code: 'nexus_credits_1000', credits: 1000, price_cents: 1500, bonus_pct: 0 },
};

// Crédits inclus mensuels par plan
export const MONTHLY_INCLUDED = {
  free: 0,
  basic: 500,
  business: 10000,
};

// ════════════════════════════════════════════════════════════════════
// LECTURE — Solde et historique
// ════════════════════════════════════════════════════════════════════

/**
 * Récupère le solde courant d'un tenant.
 * Crée la ligne ai_credits si elle n'existe pas (lazy init).
 */
export async function getBalance(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('ai_credits')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error) {
    logger.error('[CreditsService] getBalance error', { tenantId, error: error.message });
    throw error;
  }

  if (data) return data;

  // Lazy init si la ligne n'existe pas encore
  const monthlyIncluded = await getMonthlyIncludedForTenant(tenantId);
  const nextReset = new Date();
  nextReset.setMonth(nextReset.getMonth() + 1);
  nextReset.setDate(1);
  nextReset.setHours(0, 0, 0, 0);

  const { data: created, error: insertError } = await supabase
    .from('ai_credits')
    .insert({
      tenant_id: tenantId,
      balance: monthlyIncluded,
      monthly_included: monthlyIncluded,
      monthly_reset_at: nextReset.toISOString(),
    })
    .select()
    .single();

  if (insertError) throw insertError;
  return created;
}

/**
 * Récupère l'historique de transactions pour un tenant.
 */
export async function getTransactions(tenantId, { limit = 50, type = null } = {}) {
  if (!tenantId) throw new Error('tenant_id requis');

  let query = supabase
    .from('ai_credits_transactions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ════════════════════════════════════════════════════════════════════
// CONSOMMATION — Débit de crédits
// ════════════════════════════════════════════════════════════════════

/**
 * Vérifie si le tenant a assez de crédits pour une action donnée.
 * Ne consomme rien — usage avant un appel IA.
 */
export async function hasCredits(tenantId, action, quantity = 1) {
  if (!tenantId) throw new Error('tenant_id requis');

  const cost = (CREDIT_COSTS[action] || 0) * quantity;
  if (cost === 0) return { ok: true, cost: 0, balance: null };

  const balance = await getBalance(tenantId);
  return {
    ok: balance.balance >= cost,
    cost,
    balance: balance.balance,
    missing: Math.max(0, cost - balance.balance),
  };
}

/**
 * Consomme des crédits pour une action donnée.
 * Lève une erreur si solde insuffisant.
 *
 * @param {string} tenantId
 * @param {string} action  - clé dans CREDIT_COSTS
 * @param {object} options - { quantity, refId, description, metadata }
 */
export async function consume(tenantId, action, { quantity = 1, refId = null, description = null, metadata = {} } = {}) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!CREDIT_COSTS[action]) throw new Error(`Action IA inconnue: ${action}`);

  const cost = CREDIT_COSTS[action] * quantity;
  if (cost === 0) return { consumed: 0, balance: null };

  // Lock optimiste : récupérer + débiter en une transaction
  const balance = await getBalance(tenantId);

  if (balance.balance < cost) {
    const err = new Error(`INSUFFICIENT_CREDITS: ${cost} requis, ${balance.balance} disponibles`);
    err.code = 'INSUFFICIENT_CREDITS';
    err.required = cost;
    err.available = balance.balance;
    throw err;
  }

  const newBalance = balance.balance - cost;

  const { error: updateError } = await supabase
    .from('ai_credits')
    .update({
      balance: newBalance,
      total_consumed: (balance.total_consumed || 0) + cost,
      monthly_used: (balance.monthly_used || 0) + cost,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);

  if (updateError) throw updateError;

  // Logger la transaction
  await supabase.from('ai_credits_transactions').insert({
    tenant_id: tenantId,
    type: 'consume',
    amount: -cost,
    balance_after: newBalance,
    source: action,
    ref_id: refId,
    description: description || `Consommation IA : ${action} x${quantity}`,
    metadata,
  });

  logger.info('[CreditsService] Credits consumed', { tenantId, action, cost, newBalance });

  return { consumed: cost, balance: newBalance };
}

// ════════════════════════════════════════════════════════════════════
// CRÉDIT — Ajout de crédits (achat, bonus, mensuel)
// ════════════════════════════════════════════════════════════════════

/**
 * Crédite des crédits suite à un achat de pack Stripe.
 */
export async function purchasePack(tenantId, packId, { stripeInvoiceId = null, metadata = {} } = {}) {
  if (!tenantId) throw new Error('tenant_id requis');
  const pack = CREDIT_PACKS[packId];
  if (!pack) throw new Error(`Pack inconnu: ${packId}`);

  return creditTenant(tenantId, pack.credits, {
    type: 'purchase',
    source: packId,
    refId: stripeInvoiceId,
    description: `Achat ${packId.toUpperCase()} : ${pack.credits} crédits (${pack.price_cents / 100}€)`,
    metadata: { ...metadata, pack: packId, price_cents: pack.price_cents },
  });
}

/**
 * Octroi mensuel des crédits inclus pour les plans Business.
 * Appelé par un cron en début de mois.
 */
export async function grantMonthlyIncluded(tenantId, amount) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!amount || amount <= 0) return { added: 0 };

  return creditTenant(tenantId, amount, {
    type: 'monthly_grant',
    source: 'business_monthly',
    description: `Crédits mensuels Business inclus : ${amount} crédits`,
  });
}

/**
 * Ajustement manuel admin (refund, bonus marketing, etc.).
 */
export async function adjust(tenantId, amount, description) {
  if (!tenantId) throw new Error('tenant_id requis');
  return creditTenant(tenantId, amount, {
    type: amount > 0 ? 'adjust' : 'consume',
    source: 'manual_adjust',
    description,
  });
}

/**
 * Helper interne — crédite un tenant et logge la transaction.
 */
async function creditTenant(tenantId, amount, { type, source, refId = null, description, metadata = {} }) {
  const balance = await getBalance(tenantId);
  const newBalance = balance.balance + amount;

  const { error: updateError } = await supabase
    .from('ai_credits')
    .update({
      balance: newBalance,
      total_purchased: type === 'purchase' ? (balance.total_purchased || 0) + amount : balance.total_purchased,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);

  if (updateError) throw updateError;

  await supabase.from('ai_credits_transactions').insert({
    tenant_id: tenantId,
    type,
    amount,
    balance_after: newBalance,
    source,
    ref_id: refId,
    description,
    metadata,
  });

  logger.info('[CreditsService] Credits added', { tenantId, type, amount, newBalance });
  return { added: amount, balance: newBalance };
}

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

/**
 * Récupère les crédits inclus mensuels selon le plan du tenant.
 */
async function getMonthlyIncludedForTenant(tenantId) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single();

  const rawPlan = (tenant?.plan || 'free').toLowerCase();
  const normalized = rawPlan === 'starter' ? 'free'
                   : rawPlan === 'pro' ? 'basic'
                   : rawPlan;

  return MONTHLY_INCLUDED[normalized] || 0;
}

export default {
  CREDIT_COSTS,
  CREDIT_PACKS,
  MONTHLY_INCLUDED,
  getBalance,
  getTransactions,
  hasCredits,
  consume,
  purchasePack,
  grantMonthlyIncluded,
  adjust,
};
