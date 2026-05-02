/**
 * Credits Service — Gestion des crédits IA (modèle 2026 — révisé 21 avril 2026)
 *
 * Modèle (inspiré Claude) :
 *   • Interne : 0,015€/crédit — JAMAIS visible au client (il voit "utilisation IA" en %)
 *   • Free     : 200 crédits/mois (IA limitée, pas tel/WA/web)
 *   • Starter  : 1 000 crédits/mois (toutes IA débloquées)
 *   • Pro      : 5 000 crédits/mois (5x Starter)
 *   • Business : 20 000 crédits/mois (20x Starter)
 *
 * Utilisation supplémentaire (modèle Claude) :
 *   • 50€  → 10% réduction
 *   • 200€ → 20% réduction
 *   • 500€ → 30% réduction
 *
 * TENANT SHIELD : tenantId est TOUJOURS le 1er paramètre, JAMAIS de fallback.
 */

import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

// ════════════════════════════════════════════════════════════════════
// CONSTANTES — Taux de consommation par action IA (en crédits)
// ════════════════════════════════════════════════════════════════════

export const CREDIT_COSTS = {
  email_notification: 1,     // 1 email notification (coût NEXUS: 0,001€)
  whatsapp_notification: 5,  // 1 notification WhatsApp sortante (coût NEXUS: 0,005€)
  chat_admin_question: 7,    // 1 question chat IA admin
  whatsapp_message: 7,       // 1 message WhatsApp IA répondu
  devis_ia: 9,               // 1 devis IA généré
  antichurn_whatsapp: 9,     // 1 message Anti-Churn WhatsApp
  email_ia_sent: 9,          // 1 email IA généré + envoi
  whatsapp_voice_note: 10,   // 1 note vocale WhatsApp (7 msg + 3 Whisper transcription)
  social_post_generated: 12, // 1 post réseaux généré (Sonnet + image)
  sms_notification: 15,      // 1 SMS notification sortant FR (coût NEXUS: 0,0725€)
  web_chat_conversation: 15, // 1 conversation Agent IA Web (~5 messages Sonnet)
  phone_minute: 22,          // 1 minute appel Téléphone IA
  antichurn_sms_fr: 25,      // 1 message Anti-Churn SMS FR (IA + envoi)
  seo_article: 75,           // 1 article SEO complet (1500 mots)
  verification_taux: 30,     // 1 vérification mise à jour taux sociaux (fetch + IA)
};

// Utilisation supplémentaire — 3 montants preset avec réductions volume
// Pack S/M/L — le client voit des €, jamais des crédits
export const USAGE_TOPUP = {
  topup_50:  { code: 'nexus_usage_50',  label: 'Pack S', price_cents: 5000,  discount_pct: 10, credits: Math.round(5000 / 1.5 * (100 / 90)),  description: 'Ideal pour un complement ponctuel' },
  topup_200: { code: 'nexus_usage_200', label: 'Pack M', price_cents: 20000, discount_pct: 20, credits: Math.round(20000 / 1.5 * (100 / 80)), description: 'Le plus choisi par nos clients', popular: true },
  topup_500: { code: 'nexus_usage_500', label: 'Pack L', price_cents: 50000, discount_pct: 30, credits: Math.round(50000 / 1.5 * (100 / 70)), description: 'Pour les gros consommateurs' },
};

// Legacy pack (backward compat)
export const CREDIT_PACKS = {
  pack_1000: { code: 'nexus_credits_1000', credits: 1000, price_cents: 1500, bonus_pct: 0 },
};

// Overage (usage-based) — taux interne par crédit en EUR
export const OVERAGE_RATE_EUR = 0.015;
export const OVERAGE_PRESETS = [10, 25, 50, 100];

// Crédits inclus mensuels par plan
export const MONTHLY_INCLUDED = {
  free: 200,
  starter: 1000,
  pro: 5000,
  business: 20000,
  // Legacy aliases
  basic: 1000,
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

  if (balance.balance >= cost) {
    return { ok: true, cost, balance: balance.balance, missing: 0 };
  }

  // Fallback overage : si activé, vérifier que le coût EUR restant rentre dans la limite
  if (balance.overage_enabled) {
    const creditsOverage = cost - balance.balance;
    const overageEurCost = creditsOverage * OVERAGE_RATE_EUR;
    const currentUsed = parseFloat(balance.overage_used_eur) || 0;
    const limit = parseFloat(balance.overage_limit_eur) || 0;

    if (currentUsed + overageEurCost <= limit) {
      return { ok: true, cost, balance: balance.balance, missing: 0, overage: true };
    }
  }

  return {
    ok: false,
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

  // Branche 1 : solde suffisant — débit normal
  if (balance.balance >= cost) {
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
    return { consumed: cost, balance: newBalance, overage: false };
  }

  // Branche 2 : solde insuffisant + overage activé → split balance + overage
  if (balance.overage_enabled) {
    const creditsFromBalance = balance.balance; // vider le reste
    const creditsOverage = cost - creditsFromBalance;
    const overageEurCost = +(creditsOverage * OVERAGE_RATE_EUR).toFixed(2);
    const currentUsed = parseFloat(balance.overage_used_eur) || 0;
    const limit = parseFloat(balance.overage_limit_eur) || 0;

    if (currentUsed + overageEurCost > limit) {
      const err = new Error(`OVERAGE_LIMIT_REACHED: ${overageEurCost}€ requis, ${(limit - currentUsed).toFixed(2)}€ restants`);
      err.code = 'OVERAGE_LIMIT_REACHED';
      err.required = cost;
      err.available = balance.balance;
      err.overage_cost_eur = overageEurCost;
      err.overage_remaining_eur = +(limit - currentUsed).toFixed(2);
      throw err;
    }

    const newOverageUsed = +(currentUsed + overageEurCost).toFixed(2);

    const { error: updateError } = await supabase
      .from('ai_credits')
      .update({
        balance: 0,
        total_consumed: (balance.total_consumed || 0) + cost,
        monthly_used: (balance.monthly_used || 0) + cost,
        overage_used_eur: newOverageUsed,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    if (updateError) throw updateError;

    // Transaction balance (si > 0)
    if (creditsFromBalance > 0) {
      await supabase.from('ai_credits_transactions').insert({
        tenant_id: tenantId,
        type: 'consume',
        amount: -creditsFromBalance,
        balance_after: 0,
        source: action,
        ref_id: refId,
        description: description || `Consommation IA : ${action} x${quantity} (solde partiel)`,
        metadata,
      });
    }

    // Transaction overage
    await supabase.from('ai_credits_transactions').insert({
      tenant_id: tenantId,
      type: 'overage',
      amount: -creditsOverage,
      balance_after: 0,
      source: action,
      ref_id: refId,
      description: `Overage IA : ${action} — ${creditsOverage} crédits = ${overageEurCost}€`,
      metadata: { ...metadata, overage_eur: overageEurCost, overage_credits: creditsOverage },
    });

    logger.info('[CreditsService] Overage consumed', { tenantId, action, cost, overageEurCost, newOverageUsed });

    // Fire-and-forget : alertes overage (dynamic import pour éviter circular dep)
    import('./creditAlertService.js').then(m => m.checkOverageAlert(tenantId)).catch(() => {});

    return { consumed: cost, balance: 0, overage: true, overage_eur: overageEurCost };
  }

  // Branche 3 : solde insuffisant + pas d'overage → erreur classique
  const err = new Error(`INSUFFICIENT_CREDITS: ${cost} requis, ${balance.balance} disponibles`);
  err.code = 'INSUFFICIENT_CREDITS';
  err.required = cost;
  err.available = balance.balance;
  throw err;
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
 * Octroi mensuel des crédits inclus selon le plan du tenant.
 * Appelé par le cron mensuel (scheduler).
 * Reset monthly_used à 0 et ajoute les crédits inclus.
 */
export async function grantMonthlyIncluded(tenantId, amount) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!amount || amount <= 0) return { added: 0 };

  // Reset monthly_used counter
  const balance = await getBalance(tenantId);
  const nextReset = new Date();
  nextReset.setMonth(nextReset.getMonth() + 1);
  nextReset.setDate(1);
  nextReset.setHours(0, 0, 0, 0);

  // TODO: Avant reset, reporter overage_used_eur à Stripe via Usage Records API (metered billing futur)
  await supabase
    .from('ai_credits')
    .update({
      monthly_used: 0,
      monthly_included: amount,
      overage_used_eur: 0,
      monthly_reset_at: nextReset.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);

  return creditTenant(tenantId, amount, {
    type: 'monthly_grant',
    source: 'monthly_included',
    description: `Crédits mensuels inclus : ${amount} crédits`,
  });
}

/**
 * Achat d'utilisation supplémentaire (modèle Claude).
 * @param {string} tenantId
 * @param {string} topupId - clé dans USAGE_TOPUP (topup_50, topup_200, topup_500)
 * @param {object} options - { stripeInvoiceId, metadata }
 */
export async function purchaseTopup(tenantId, topupId, { stripeInvoiceId = null, metadata = {} } = {}) {
  if (!tenantId) throw new Error('tenant_id requis');
  const topup = USAGE_TOPUP[topupId];
  if (!topup) throw new Error(`Topup inconnu: ${topupId}`);

  return creditTenant(tenantId, topup.credits, {
    type: 'purchase',
    source: topupId,
    refId: stripeInvoiceId,
    description: `Utilisation supplémentaire ${topup.price_cents / 100}€ (-${topup.discount_pct}%) : ${topup.credits} crédits`,
    metadata: { ...metadata, topup: topupId, price_cents: topup.price_cents, discount_pct: topup.discount_pct },
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
// OVERAGE — Configuration
// ════════════════════════════════════════════════════════════════════

/**
 * Met à jour les paramètres overage d'un tenant.
 * @param {string} tenantId
 * @param {{ enabled: boolean, limit_eur: number }} settings
 */
export async function updateOverageSettings(tenantId, { enabled, limit_eur }) {
  if (!tenantId) throw new Error('tenant_id requis');

  // S'assurer que la ligne existe
  await getBalance(tenantId);

  const { error } = await supabase
    .from('ai_credits')
    .update({
      overage_enabled: enabled,
      overage_limit_eur: limit_eur,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId);

  if (error) throw error;

  logger.info('[CreditsService] Overage settings updated', { tenantId, enabled, limit_eur });
  return getBalance(tenantId);
}

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

// Features bloquées sur le plan Free (IA tel/WA/web non incluses)
const FREE_BLOCKED_CHANNELS = ['phone', 'whatsapp', 'web_chat'];

/**
 * Vérifie si le plan du tenant autorise un canal IA donné.
 * Free = pas d'accès phone / whatsapp / web_chat (uniquement chat admin limité).
 * Essai = accès complet (comme Starter).
 *
 * @param {string} tenantId
 * @param {string} channel - 'phone' | 'whatsapp' | 'web_chat'
 * @returns {Promise<boolean>}
 */
export async function isPlanAllowed(tenantId, channel) {
  if (!tenantId) return false;

  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan, statut')
    .eq('id', tenantId)
    .single();

  // Essai = full access
  if (tenant?.statut === 'essai') return true;

  const plan = (tenant?.plan || 'free').toLowerCase();
  if (plan === 'free') {
    return !FREE_BLOCKED_CHANNELS.includes(channel);
  }
  return true;
}

/**
 * Récupère les crédits inclus mensuels selon le plan du tenant.
 */
async function getMonthlyIncludedForTenant(tenantId) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan')
    .eq('id', tenantId)
    .single();

  const plan = (tenant?.plan || 'free').toLowerCase();
  return MONTHLY_INCLUDED[plan] || 0;
}

export default {
  CREDIT_COSTS,
  CREDIT_PACKS,
  USAGE_TOPUP,
  MONTHLY_INCLUDED,
  OVERAGE_RATE_EUR,
  OVERAGE_PRESETS,
  getBalance,
  getTransactions,
  hasCredits,
  consume,
  isPlanAllowed,
  purchasePack,
  purchaseTopup,
  grantMonthlyIncluded,
  adjust,
  updateOverageSettings,
};
