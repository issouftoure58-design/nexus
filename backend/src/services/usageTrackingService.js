/**
 * Usage Tracking Service
 *
 * Suit l'utilisation des ressources par tenant :
 * - Minutes téléphone
 * - Messages WhatsApp
 * - Messages chat web
 * - Tokens IA consommés
 *
 * Vérifie les quotas et bloque si dépassement.
 * Synchronise avec quotaManager pour facturation overage.
 */

import { createClient } from '@supabase/supabase-js';
import { quotaManager, MODULE_QUOTAS } from './quotaManager.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Quotas par défaut basés sur MODULE_QUOTAS (source unique de vérité)
const DEFAULT_QUOTAS = {
  telephone_minutes: MODULE_QUOTAS.telephone_ia?.included?.minutes || 500,
  whatsapp_messages: MODULE_QUOTAS.whatsapp_ia?.included?.messages || 2000,
  web_messages: MODULE_QUOTAS.web_chat_ia?.included?.sessions || 1000,
  ia_tokens: 500000, // Pas de limite stricte sur les tokens, facturé au coût réel
};

// Coûts de dépassement (en centimes) - alignés sur MODULE_QUOTAS
const OVERAGE_COSTS = {
  telephone_minutes: (MODULE_QUOTAS.telephone_ia?.overage?.minutes || 0.50) * 100,  // 0.50€/min = 50 centimes
  whatsapp_messages: (MODULE_QUOTAS.whatsapp_ia?.overage?.messages || 0.05) * 100,  // 0.05€/msg = 5 centimes
  web_messages: (MODULE_QUOTAS.web_chat_ia?.overage?.sessions || 0.15) * 100,       // 0.15€/session = 15 centimes
  ia_tokens: 0.1,                                                                    // 0.001€/token
};

// Mapping type usage -> module quota
const TYPE_TO_MODULE = {
  telephone: 'telephone_ia',
  whatsapp: 'whatsapp_ia',
  web: 'web_chat_ia',
  sms: 'sms_rdv',
  email: 'marketing_email',
};

/**
 * Enregistre une utilisation
 * @param {string} tenantId
 * @param {string} type - 'telephone' | 'whatsapp' | 'web' | 'ia' | 'sms' | 'email'
 * @param {number} amount - Quantité (minutes, messages, tokens)
 * @param {object} metadata - Données supplémentaires
 */
export async function trackUsage(tenantId, type, amount, metadata = {}) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  console.log(`[USAGE] Track ${type}: ${amount} pour ${tenantId}`);

  try {
    // 1. Enregistrer l'événement
    await supabase.from('usage_events').insert({
      tenant_id: tenantId,
      type: type,
      amount: amount,
      month: monthKey,
      metadata: metadata,
      created_at: now.toISOString(),
    });

    // 2. Mettre à jour le compteur mensuel (legacy)
    const field = `${type}_used`;

    // Upsert sur usage_monthly
    const { data: existing } = await supabase
      .from('usage_monthly')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('month', monthKey)
      .single();

    if (existing) {
      await supabase
        .from('usage_monthly')
        .update({
          [field]: (existing[field] || 0) + amount,
          updated_at: now.toISOString(),
        })
        .eq('tenant_id', tenantId)
        .eq('month', monthKey);
    } else {
      await supabase
        .from('usage_monthly')
        .insert({
          tenant_id: tenantId,
          month: monthKey,
          [field]: amount,
          created_at: now.toISOString(),
        });
    }

    // 3. Synchroniser avec quotaManager pour facturation overage
    const moduleId = TYPE_TO_MODULE[type];
    if (moduleId) {
      const metric = getMetricForType(type);
      await quotaManager.incrementUsage(tenantId, moduleId, metric, amount);
    }

    return { success: true };
  } catch (error) {
    console.error('[USAGE] Erreur tracking:', error);
    // Ne pas bloquer l'opération si le tracking échoue
    return { success: false, error: error.message };
  }
}

/**
 * Retourne le nom de la métrique pour un type d'usage
 */
function getMetricForType(type) {
  const metrics = {
    telephone: 'minutes',
    whatsapp: 'messages',
    web: 'sessions',
    sms: 'sms',
    email: 'emails',
    ia: 'tokens',
  };
  return metrics[type] || type;
}

/**
 * Récupère l'usage du mois en cours pour un tenant
 */
export async function getMonthlyUsage(tenantId) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('usage_monthly')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('month', monthKey)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[USAGE] Erreur get usage:', error);
  }

  return {
    month: monthKey,
    telephone: {
      used: data?.telephone_used || 0,
      limit: data?.telephone_limit || DEFAULT_QUOTAS.telephone_minutes,
    },
    whatsapp: {
      used: data?.whatsapp_used || 0,
      limit: data?.whatsapp_limit || DEFAULT_QUOTAS.whatsapp_messages,
    },
    web: {
      used: data?.web_used || 0,
      limit: data?.web_limit || DEFAULT_QUOTAS.web_messages,
    },
    ia: {
      used: data?.ia_used || 0,
      limit: data?.ia_limit || DEFAULT_QUOTAS.ia_tokens,
    },
  };
}

/**
 * Vérifie si le tenant peut utiliser une ressource
 * @returns {object} { allowed: boolean, remaining: number, overage: boolean }
 */
export async function checkQuota(tenantId, type, amount = 1) {
  const usage = await getMonthlyUsage(tenantId);
  const typeData = usage[type];

  if (!typeData) {
    return { allowed: true, remaining: Infinity, overage: false };
  }

  const remaining = typeData.limit - typeData.used;
  const allowed = remaining > 0 || typeData.limit === -1; // -1 = illimité

  return {
    allowed,
    remaining: Math.max(0, remaining),
    overage: remaining < amount && remaining >= 0,
    used: typeData.used,
    limit: typeData.limit,
  };
}

/**
 * Bloque l'utilisation si quota dépassé
 * @throws Error si quota dépassé
 */
export async function enforceQuota(tenantId, type, amount = 1) {
  const quota = await checkQuota(tenantId, type, amount);

  if (!quota.allowed) {
    const typeLabels = {
      telephone: 'minutes téléphone',
      whatsapp: 'messages WhatsApp',
      web: 'messages web',
      ia: 'tokens IA',
    };

    throw new Error(
      `Quota ${typeLabels[type]} épuisé. ` +
      `Utilisé: ${quota.used}/${quota.limit}. ` +
      `Passez au plan supérieur ou attendez le mois prochain.`
    );
  }

  return quota;
}

/**
 * Enregistre un appel téléphonique
 */
export async function trackPhoneCall(tenantId, durationSeconds, callSid, direction = 'inbound') {
  const minutes = Math.ceil(durationSeconds / 60); // Arrondi supérieur

  return trackUsage(tenantId, 'telephone', minutes, {
    call_sid: callSid,
    duration_seconds: durationSeconds,
    direction,
  });
}

/**
 * Enregistre un message WhatsApp
 */
export async function trackWhatsAppMessage(tenantId, messageSid, direction = 'inbound') {
  return trackUsage(tenantId, 'whatsapp', 1, {
    message_sid: messageSid,
    direction,
  });
}

/**
 * Enregistre un message chat web
 */
export async function trackWebMessage(tenantId, conversationId) {
  return trackUsage(tenantId, 'web', 1, {
    conversation_id: conversationId,
  });
}

/**
 * Enregistre l'utilisation de tokens IA
 */
export async function trackIATokens(tenantId, inputTokens, outputTokens, model = 'claude') {
  const totalTokens = inputTokens + outputTokens;

  return trackUsage(tenantId, 'ia', totalTokens, {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    model,
  });
}

/**
 * Enregistre un SMS envoyé
 */
export async function trackSMS(tenantId, messageSid, direction = 'outbound') {
  return trackUsage(tenantId, 'sms', 1, {
    message_sid: messageSid,
    direction,
  });
}

/**
 * Enregistre un email marketing envoyé
 */
export async function trackEmail(tenantId, count = 1, campaignId = null) {
  return trackUsage(tenantId, 'email', count, {
    campaign_id: campaignId,
  });
}

/**
 * Vérifie le quota avec quotaManager et retourne les infos de dépassement
 */
export async function checkQuotaWithOverage(tenantId, type, amount = 1) {
  const moduleId = TYPE_TO_MODULE[type];
  if (!moduleId) {
    return { allowed: true, remaining: Infinity, overage: false };
  }

  const metric = getMetricForType(type);
  const quotaCheck = await quotaManager.checkQuota(tenantId, moduleId, metric, amount);

  return {
    allowed: quotaCheck.allowed,
    remaining: quotaCheck.remaining,
    overage: quotaCheck.wouldExceed,
    overageCost: quotaCheck.overageCost,
    used: quotaCheck.currentUsage,
    limit: quotaCheck.limit,
  };
}

/**
 * Récupère le statut complet des quotas via quotaManager
 */
export async function getQuotaStatus(tenantId) {
  return quotaManager.getQuotaStatus(tenantId);
}

/**
 * Calcule le total des dépassements via quotaManager
 */
export async function getTotalOverage(tenantId) {
  return quotaManager.calculateOverage(tenantId);
}

/**
 * Calcule le coût des dépassements pour un tenant
 */
export async function calculateOverageCost(tenantId) {
  const usage = await getMonthlyUsage(tenantId);
  let totalCost = 0;

  for (const [type, data] of Object.entries(usage)) {
    if (type === 'month') continue;

    const overage = Math.max(0, data.used - data.limit);
    if (overage > 0 && data.limit !== -1) {
      const costKey = `${type}_${type === 'telephone' ? 'minutes' : type === 'ia' ? 'tokens' : 'messages'}`;
      const unitCost = OVERAGE_COSTS[costKey] || 0;
      totalCost += overage * unitCost;
    }
  }

  return {
    totalCentimes: totalCost,
    totalEuros: totalCost / 100,
  };
}

/**
 * Récupère l'historique d'usage sur plusieurs mois
 */
export async function getUsageHistory(tenantId, months = 6) {
  const { data, error } = await supabase
    .from('usage_monthly')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('month', { ascending: false })
    .limit(months);

  if (error) {
    console.error('[USAGE] Erreur historique:', error);
    return [];
  }

  return data || [];
}

/**
 * Définit les quotas personnalisés pour un tenant
 */
export async function setTenantQuotas(tenantId, quotas) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const updates = {};
  if (quotas.telephone !== undefined) updates.telephone_limit = quotas.telephone;
  if (quotas.whatsapp !== undefined) updates.whatsapp_limit = quotas.whatsapp;
  if (quotas.web !== undefined) updates.web_limit = quotas.web;
  if (quotas.ia !== undefined) updates.ia_limit = quotas.ia;

  const { error } = await supabase
    .from('usage_monthly')
    .upsert({
      tenant_id: tenantId,
      month: monthKey,
      ...updates,
      updated_at: now.toISOString(),
    });

  if (error) {
    console.error('[USAGE] Erreur set quotas:', error);
    throw error;
  }

  return { success: true };
}

export default {
  trackUsage,
  getMonthlyUsage,
  checkQuota,
  enforceQuota,
  trackPhoneCall,
  trackWhatsAppMessage,
  trackWebMessage,
  trackIATokens,
  trackSMS,
  trackEmail,
  calculateOverageCost,
  getUsageHistory,
  setTenantQuotas,
  checkQuotaWithOverage,
  getQuotaStatus,
  getTotalOverage,
  DEFAULT_QUOTAS,
  OVERAGE_COSTS,
  MODULE_QUOTAS,
};
