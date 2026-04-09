/**
 * Quota Service — Gestion des quotas mensuels Free tier (modèle 2026)
 *
 * Quotas Free :
 *   • 30 réservations / mois
 *   • 20 factures / mois
 *   • 50 clients max (compteur global, pas mensuel)
 *   • 5 prestations max
 *   • 5 questions chat IA admin / mois
 *   • 1 utilisateur (équipe désactivée)
 *
 * Plans Basic et Business : tout illimité (-1).
 *
 * TENANT SHIELD : tenantId est TOUJOURS le 1er paramètre, JAMAIS de fallback.
 */

import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

// ════════════════════════════════════════════════════════════════════
// LIMITES PAR PLAN — Source de vérité quotas Free vs Basic vs Business
// ════════════════════════════════════════════════════════════════════

export const PLAN_QUOTAS = {
  free: {
    reservations_max_mois: 30,
    factures_max_mois: 20,
    clients_max: 50,
    prestations_max: 5,
    chat_admin_questions_mois: 5,
    storage_mb: 1024,
    utilisateurs_max: 1,
    posts_ia_mois: 0,
    images_ia_mois: 0,
  },
  basic: {
    reservations_max_mois: -1,
    factures_max_mois: -1,
    clients_max: -1,
    prestations_max: -1,
    chat_admin_questions_mois: -1,
    storage_mb: 51200,
    utilisateurs_max: 5,
    posts_ia_mois: -1,
    images_ia_mois: -1,
  },
  business: {
    reservations_max_mois: -1,
    factures_max_mois: -1,
    clients_max: -1,
    prestations_max: -1,
    chat_admin_questions_mois: -1,
    storage_mb: 512000,
    utilisateurs_max: 20,
    posts_ia_mois: -1,
    images_ia_mois: -1,
  },
};

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

function normalizePlan(plan) {
  const p = (plan || '').toLowerCase();
  if (p === 'starter') return 'free';
  if (p === 'pro') return 'basic';
  if (p === 'free' || p === 'basic' || p === 'business') return p;
  return 'free';
}

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function getTenantPlan(tenantId) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan, statut')
    .eq('id', tenantId)
    .single();

  // Essai = déverrouille comme Basic
  if (tenant?.statut === 'essai') return 'basic';
  return normalizePlan(tenant?.plan);
}

// ════════════════════════════════════════════════════════════════════
// LECTURE — État des quotas
// ════════════════════════════════════════════════════════════════════

/**
 * Récupère ou crée la ligne de quotas pour le tenant et la période courante.
 */
async function getOrCreateQuotaRow(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');
  const period = currentPeriod();

  const { data, error } = await supabase
    .from('tenant_quotas')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('period', period)
    .maybeSingle();

  if (error) {
    logger.error('[QuotaService] read error', { tenantId, error: error.message });
    throw error;
  }

  if (data) return data;

  const { data: created, error: insertError } = await supabase
    .from('tenant_quotas')
    .insert({ tenant_id: tenantId, period })
    .select()
    .single();

  if (insertError) throw insertError;
  return created;
}

/**
 * Récupère un snapshot complet des quotas + usage pour le tenant.
 */
export async function getQuotaSnapshot(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const plan = await getTenantPlan(tenantId);
  const limits = PLAN_QUOTAS[plan];
  const usage = await getOrCreateQuotaRow(tenantId);

  const snapshot = {};
  for (const [key, limit] of Object.entries(limits)) {
    const usedKey = key
      .replace('_max_mois', '_used')
      .replace('_max', '_count')
      .replace('_mois', '_used');
    const used = usage[usedKey] ?? 0;
    snapshot[key] = {
      limit,
      used,
      remaining: limit === -1 ? -1 : Math.max(0, limit - used),
      percentage: limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100)),
      unlimited: limit === -1,
      atLimit: limit !== -1 && used >= limit,
    };
  }

  return { plan, period: currentPeriod(), quotas: snapshot };
}

// ════════════════════════════════════════════════════════════════════
// VÉRIFICATION — Avant action
// ════════════════════════════════════════════════════════════════════

/**
 * Vérifie si une action est autorisée selon le quota courant.
 *
 * @param {string} tenantId
 * @param {string} resource - 'reservations' | 'factures' | 'clients' | 'prestations' | 'chat_admin_questions'
 * @param {number} amount   - quantité à ajouter (default 1)
 * @returns {{ ok: boolean, limit, used, remaining }}
 */
export async function checkQuota(tenantId, resource, amount = 1) {
  if (!tenantId) throw new Error('tenant_id requis');

  const plan = await getTenantPlan(tenantId);
  const limits = PLAN_QUOTAS[plan];

  // Trouver la limite correspondante
  const limitKey = `${resource}_max_mois` in limits ? `${resource}_max_mois`
                : `${resource}_max` in limits ? `${resource}_max`
                : null;

  if (!limitKey) {
    return { ok: true, limit: -1, used: 0, remaining: -1, unlimited: true };
  }

  const limit = limits[limitKey];
  if (limit === -1) {
    return { ok: true, limit: -1, used: 0, remaining: -1, unlimited: true };
  }

  const usage = await getOrCreateQuotaRow(tenantId);
  const usedKey = limitKey
    .replace('_max_mois', '_used')
    .replace('_max', '_count');
  const used = usage[usedKey] ?? 0;

  return {
    ok: used + amount <= limit,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    unlimited: false,
  };
}

// ════════════════════════════════════════════════════════════════════
// INCREMENT — Après action
// ════════════════════════════════════════════════════════════════════

/**
 * Incrémente le compteur d'usage pour une ressource.
 * Appelé APRÈS l'action réussie.
 */
export async function incrementUsage(tenantId, resource, amount = 1) {
  if (!tenantId) throw new Error('tenant_id requis');

  const plan = await getTenantPlan(tenantId);
  // Ne pas tracker l'usage pour les plans illimités (économie d'écritures DB)
  if (plan !== 'free') return;

  const period = currentPeriod();
  const usage = await getOrCreateQuotaRow(tenantId);

  // Mapper resource → colonne
  const columnMap = {
    reservations: 'reservations_used',
    factures: 'factures_used',
    clients: 'clients_count',
    prestations: 'prestations_count',
    chat_admin_questions: 'chat_admin_questions_used',
    posts_ia: 'posts_ia_used',
    images_ia: 'images_ia_used',
  };

  const column = columnMap[resource];
  if (!column) {
    logger.warn('[QuotaService] Unknown resource', { tenantId, resource });
    return;
  }

  const newValue = (usage[column] ?? 0) + amount;

  const { error } = await supabase
    .from('tenant_quotas')
    .update({ [column]: newValue, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('period', period);

  if (error) {
    logger.error('[QuotaService] increment error', { tenantId, resource, error: error.message });
    throw error;
  }

  // Vérifier si on doit envoyer une alerte (80%, 95%, 100%)
  await maybeSendAlert(tenantId, resource, newValue);
}

/**
 * Décrémente l'usage (suite à une suppression par exemple).
 */
export async function decrementUsage(tenantId, resource, amount = 1) {
  return incrementUsage(tenantId, resource, -amount);
}

// ════════════════════════════════════════════════════════════════════
// ALERTES — 80% / 95% / 100%
// ════════════════════════════════════════════════════════════════════

async function maybeSendAlert(tenantId, resource, currentUsage) {
  const plan = await getTenantPlan(tenantId);
  if (plan !== 'free') return;

  const limits = PLAN_QUOTAS.free;
  const limitKey = `${resource}_max_mois` in limits ? `${resource}_max_mois`
                : `${resource}_max` in limits ? `${resource}_max`
                : null;
  if (!limitKey) return;

  const limit = limits[limitKey];
  if (limit === -1 || limit === 0) return;

  const pct = (currentUsage / limit) * 100;
  const period = currentPeriod();

  const { data: row } = await supabase
    .from('tenant_quotas')
    .select('alert_80_sent_at, alert_95_sent_at, alert_100_sent_at')
    .eq('tenant_id', tenantId)
    .eq('period', period)
    .single();

  if (!row) return;

  const updates = {};
  if (pct >= 100 && !row.alert_100_sent_at) {
    updates.alert_100_sent_at = new Date().toISOString();
    logger.warn('[QuotaService] QUOTA REACHED', { tenantId, resource, currentUsage, limit });
    // TODO: déclencher email + toast in-app
  } else if (pct >= 95 && !row.alert_95_sent_at) {
    updates.alert_95_sent_at = new Date().toISOString();
    logger.info('[QuotaService] Quota 95%', { tenantId, resource });
  } else if (pct >= 80 && !row.alert_80_sent_at) {
    updates.alert_80_sent_at = new Date().toISOString();
    logger.info('[QuotaService] Quota 80%', { tenantId, resource });
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('tenant_quotas').update(updates).eq('tenant_id', tenantId).eq('period', period);
  }
}

// ════════════════════════════════════════════════════════════════════
// MIDDLEWARE Express — enforceQuota
// ════════════════════════════════════════════════════════════════════

/**
 * Middleware Express qui bloque la requête si quota atteint.
 *
 * Usage :
 *   router.post('/reservations', enforceQuota('reservations'), handler);
 */
export function enforceQuota(resource, amount = 1) {
  return async (req, res, next) => {
    try {
      const tenantId = req.tenantId || req.user?.tenant_id || req.admin?.tenant_id;
      if (!tenantId) {
        return res.status(403).json({ error: 'TENANT_REQUIRED' });
      }

      const check = await checkQuota(tenantId, resource, amount);
      if (!check.ok) {
        return res.status(429).json({
          error: 'QUOTA_EXCEEDED',
          message: `Quota ${resource} atteint pour ce mois (${check.used}/${check.limit}). Passez en NEXUS Basic pour un accès illimité.`,
          resource,
          limit: check.limit,
          used: check.used,
          upgrade_url: '/admin/abonnement',
        });
      }

      // Attache le check au req pour incrémenter après succès
      req._quotaCheck = { resource, amount };
      next();
    } catch (err) {
      logger.error('[QuotaService] enforceQuota error', { error: err.message });
      next(err);
    }
  };
}

export default {
  PLAN_QUOTAS,
  getQuotaSnapshot,
  checkQuota,
  incrementUsage,
  decrementUsage,
  enforceQuota,
};
