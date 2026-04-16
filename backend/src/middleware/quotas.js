/**
 * Middleware de gestion des quotas NEXUS
 * Modèle 2026 : Free / Basic / Business (voir memory/business-model-2026.md)
 *
 * @module middleware/quotas
 */

import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import { captureMessage } from '../config/sentry.js';
import { PLAN_LIMITS as CANONICAL_PLAN_LIMITS } from '../config/planFeatures.js';

/**
 * Limites par plan tarifaire — re-exporte la source unique de vérité (planFeatures.js)
 * pour garder les imports historiques (`import { PLAN_LIMITS } from 'middleware/quotas.js'`)
 */
export const PLAN_LIMITS = CANONICAL_PLAN_LIMITS;

/**
 * Normalise un nom de plan vers les noms canoniques (free|basic|business)
 * Mappe les anciens noms 'starter'→'free' et 'pro'→'basic' pour rétrocompat.
 */
function normalizePlan(plan) {
  const p = (plan || '').toLowerCase();
  if (p === 'starter') return 'free';
  if (p === 'pro') return 'basic';
  if (p === 'free' || p === 'basic' || p === 'business') return p;
  return 'free';
}

/**
 * Récupère le plan du tenant
 * @param {string} tenant_id - ID du tenant
 * @returns {Promise<string>} Plan canonique (free, basic, business)
 */
export async function getTenantPlan(tenant_id) {
  const { data, error } = await supabase
    .from('tenants')
    .select('plan')
    .eq('id', tenant_id)
    .single();

  if (error) {
    logger.error('Erreur récupération plan', { tag: 'QUOTAS', error: error.message });
    return 'free'; // défaut si erreur
  }

  return normalizePlan(data?.plan);
}

/**
 * Vérifie quota clients
 * @param {string} tenant_id - ID du tenant
 * @param {string} plan - Plan du tenant
 * @returns {Promise<Object>} Résultat de la vérification
 */
export async function checkClientsQuota(tenant_id, plan) {
  const limit = PLAN_LIMITS[plan]?.clients || PLAN_LIMITS.starter.clients;
  if (limit === -1) return { ok: true, current: 0, limit: -1 };

  const { count, error } = await supabase
    .from('clients')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id);

  if (error) {
    logger.error('Erreur comptage clients', { tag: 'QUOTAS', error: error.message });
    return { ok: true, current: 0, limit, message: 'Erreur comptage' };
  }

  const currentCount = count || 0;

  return {
    ok: currentCount < limit,
    current: currentCount,
    limit: limit,
    percentage: Math.round((currentCount / limit) * 100),
    message: currentCount >= limit ? `Limite de ${limit} clients atteinte` : null
  };
}

/**
 * Vérifie quota stockage documents
 * @param {string} tenant_id - ID du tenant
 * @param {string} plan - Plan du tenant
 * @param {number} file_size - Taille du fichier à ajouter (bytes)
 * @returns {Promise<Object>} Résultat de la vérification
 */
export async function checkStorageQuota(tenant_id, plan, file_size = 0) {
  const limit_gb = PLAN_LIMITS[plan]?.storage_gb || PLAN_LIMITS.starter.storage_gb;
  if (limit_gb === -1) return { ok: true, current_gb: '0.00', limit_gb: -1 };

  const { data, error } = await supabase
    .from('documents')
    .select('file_size')
    .eq('tenant_id', tenant_id);

  if (error) {
    logger.error('Erreur calcul stockage', { tag: 'QUOTAS', error: error.message });
    return { ok: true, current_gb: '0.00', limit_gb, message: 'Erreur calcul' };
  }

  const total_bytes = (data || []).reduce((sum, doc) => sum + (doc.file_size || 0), 0);
  const total_gb = total_bytes / (1024 * 1024 * 1024);
  const new_total_gb = (total_bytes + file_size) / (1024 * 1024 * 1024);

  return {
    ok: new_total_gb <= limit_gb,
    current_gb: total_gb.toFixed(2),
    limit_gb: limit_gb,
    percentage: Math.round((total_gb / limit_gb) * 100),
    message: new_total_gb > limit_gb ? `Limite de ${limit_gb} GB dépassée` : null
  };
}

/**
 * Vérifie quota posts/images IA du mois
 * @param {string} tenant_id - ID du tenant
 * @param {string} plan - Plan du tenant
 * @param {string} type - 'post' ou 'image'
 * @returns {Promise<Object>} Résultat de la vérification
 */
export async function checkSocialQuota(tenant_id, plan, type = 'post') {
  const limit = type === 'post'
    ? PLAN_LIMITS[plan]?.posts_per_month || PLAN_LIMITS.starter.posts_per_month
    : PLAN_LIMITS[plan]?.images_per_month || PLAN_LIMITS.starter.images_per_month;

  // Premier jour du mois en cours
  const firstDay = new Date();
  firstDay.setDate(1);
  firstDay.setHours(0, 0, 0, 0);

  let count = 0;
  let error = null;

  if (type === 'post') {
    const result = await supabase
      .from('social_posts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .gte('created_at', firstDay.toISOString());

    count = result.count || 0;
    error = result.error;
  } else {
    // Images : compter les posts avec image_url non null
    const result = await supabase
      .from('social_posts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .not('image_url', 'is', null)
      .gte('created_at', firstDay.toISOString());

    count = result.count || 0;
    error = result.error;
  }

  if (error) {
    logger.error('Erreur comptage', { tag: 'QUOTAS', type, error: error.message });
    return { ok: true, current: 0, limit, message: 'Erreur comptage' };
  }

  return {
    ok: count < limit,
    current: count,
    limit: limit,
    percentage: Math.round((count / limit) * 100),
    message: count >= limit ? `Limite de ${limit} ${type}s/mois atteinte` : null
  };
}

/**
 * Récupère usage de tous les quotas d'un tenant
 * @param {string} tenant_id - ID du tenant
 * @returns {Promise<Object>} Usage complet
 */
export async function getQuotaUsage(tenant_id) {
  const plan = await getTenantPlan(tenant_id);

  const [clients, storage, posts, images] = await Promise.all([
    checkClientsQuota(tenant_id, plan),
    checkStorageQuota(tenant_id, plan),
    checkSocialQuota(tenant_id, plan, 'post'),
    checkSocialQuota(tenant_id, plan, 'image')
  ]);

  return {
    plan,
    plan_name: plan.charAt(0).toUpperCase() + plan.slice(1),
    quotas: {
      clients,
      storage,
      posts,
      images
    }
  };
}

/**
 * Middleware : vérifie quota clients avant création
 */
export async function requireClientsQuota(req, res, next) {
  try {
    const tenant_id = req.admin?.tenant_id || req.tenant_id || req.tenantId;
    if (!tenant_id) {
      return res.status(401).json({ error: 'Tenant non identifié' });
    }

    const plan = await getTenantPlan(tenant_id);
    const check = await checkClientsQuota(tenant_id, plan);

    if (!check.ok) {
      captureMessage(`Quota clients exceeded: ${tenant_id}`, 'warning', { tags: { type: 'quota_exceeded', quota: 'clients' }, extra: { tenant_id, plan, current: check.current, limit: check.limit } });
      return res.status(403).json({
        error: check.message,
        code: 'QUOTA_EXCEEDED',
        upgrade_required: true,
        current_plan: plan,
        quota: 'clients',
        current: check.current,
        limit: check.limit,
        redirect: '/admin/billing/upgrade'
      });
    }

    req.quota_clients = check;
    next();
  } catch (error) {
    logger.error('Erreur middleware clients', { tag: 'QUOTAS', error: error.message });
    res.status(500).json({ error: 'Erreur vérification quota' });
  }
}

/**
 * Vérifie quota réservations du mois
 * @param {string} tenant_id - ID du tenant
 * @param {string} plan - Plan du tenant
 * @returns {Promise<Object>} Résultat de la vérification
 */
export async function checkReservationsQuota(tenant_id, plan) {
  const limit = PLAN_LIMITS[plan]?.reservations_per_month || PLAN_LIMITS.starter.reservations_per_month;
  if (limit === -1) return { ok: true, current: 0, limit: -1 };

  const firstDay = new Date();
  firstDay.setDate(1);
  firstDay.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('reservations')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id)
    .gte('created_at', firstDay.toISOString());

  if (error) {
    logger.error('Erreur comptage réservations', { tag: 'QUOTAS', error: error.message });
    return { ok: true, current: 0, limit, message: 'Erreur comptage' };
  }

  const currentCount = count || 0;

  return {
    ok: currentCount < limit,
    current: currentCount,
    limit,
    percentage: Math.round((currentCount / limit) * 100),
    message: currentCount >= limit ? `Limite de ${limit} réservations/mois atteinte` : null
  };
}

/**
 * Middleware : vérifie quota réservations avant création
 */
export async function requireReservationsQuota(req, res, next) {
  try {
    const tenant_id = req.admin?.tenant_id || req.tenant_id || req.tenantId;
    if (!tenant_id) {
      return res.status(401).json({ error: 'Tenant non identifié' });
    }

    const plan = await getTenantPlan(tenant_id);
    const check = await checkReservationsQuota(tenant_id, plan);

    if (!check.ok) {
      captureMessage(`Quota réservations exceeded: ${tenant_id}`, 'warning', { tags: { type: 'quota_exceeded', quota: 'reservations' }, extra: { tenant_id, plan, current: check.current, limit: check.limit } });
      return res.status(403).json({
        error: check.message,
        code: 'QUOTA_EXCEEDED',
        upgrade_required: true,
        current_plan: plan,
        quota: 'reservations',
        current: check.current,
        limit: check.limit,
        redirect: '/admin/billing/upgrade'
      });
    }

    req.quota_reservations = check;
    next();
  } catch (error) {
    logger.error('Erreur middleware réservations', { tag: 'QUOTAS', error: error.message });
    res.status(500).json({ error: 'Erreur vérification quota' });
  }
}

/**
 * Vérifie quota factures du mois
 * @param {string} tenant_id - ID du tenant
 * @param {string} plan - Plan du tenant
 * @returns {Promise<Object>} Résultat de la vérification
 */
export async function checkFacturesQuota(tenant_id, plan) {
  const limit = PLAN_LIMITS[plan]?.factures_mois ?? PLAN_LIMITS.free.factures_mois ?? 10;
  if (limit === -1) return { ok: true, current: 0, limit: -1 };

  const firstDay = new Date();
  firstDay.setDate(1);
  firstDay.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('factures')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id)
    .gte('created_at', firstDay.toISOString());

  if (error) {
    logger.error('Erreur comptage factures', { tag: 'QUOTAS', error: error.message });
    return { ok: true, current: 0, limit, message: 'Erreur comptage' };
  }

  const currentCount = count || 0;

  return {
    ok: currentCount < limit,
    current: currentCount,
    limit,
    percentage: Math.round((currentCount / limit) * 100),
    message: currentCount >= limit ? `Limite de ${limit} factures/mois atteinte` : null
  };
}

/**
 * Middleware : vérifie quota factures avant création
 */
export async function requireFacturesQuota(req, res, next) {
  try {
    const tenant_id = req.admin?.tenant_id || req.tenant_id || req.tenantId;
    if (!tenant_id) {
      return res.status(401).json({ error: 'Tenant non identifié' });
    }

    const plan = await getTenantPlan(tenant_id);
    const check = await checkFacturesQuota(tenant_id, plan);

    if (!check.ok) {
      captureMessage(`Quota factures exceeded: ${tenant_id}`, 'warning', { tags: { type: 'quota_exceeded', quota: 'factures' }, extra: { tenant_id, plan, current: check.current, limit: check.limit } });
      return res.status(403).json({
        error: check.message,
        code: 'QUOTA_EXCEEDED',
        upgrade_required: true,
        current_plan: plan,
        quota: 'factures',
        current: check.current,
        limit: check.limit,
        redirect: '/admin/billing/upgrade'
      });
    }

    req.quota_factures = check;
    next();
  } catch (error) {
    logger.error('Erreur middleware factures', { tag: 'QUOTAS', error: error.message });
    res.status(500).json({ error: 'Erreur vérification quota' });
  }
}

/**
 * Vérifie quota prestations (services) — compteur global, pas mensuel
 * @param {string} tenant_id - ID du tenant
 * @param {string} plan - Plan du tenant
 * @returns {Promise<Object>} Résultat de la vérification
 */
export async function checkPrestationsQuota(tenant_id, plan) {
  const limit = PLAN_LIMITS[plan]?.prestations_max ?? PLAN_LIMITS.free.prestations_max ?? -1;
  if (limit === -1) return { ok: true, current: 0, limit: -1 };

  const { count, error } = await supabase
    .from('services')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant_id);

  if (error) {
    logger.error('Erreur comptage prestations', { tag: 'QUOTAS', error: error.message });
    return { ok: true, current: 0, limit, message: 'Erreur comptage' };
  }

  const currentCount = count || 0;

  return {
    ok: currentCount < limit,
    current: currentCount,
    limit,
    percentage: Math.round((currentCount / limit) * 100),
    message: currentCount >= limit ? `Limite de ${limit} prestations atteinte` : null
  };
}

/**
 * Middleware : vérifie quota prestations (services) avant création
 */
export async function requirePrestationsQuota(req, res, next) {
  try {
    const tenant_id = req.admin?.tenant_id || req.tenant_id || req.tenantId;
    if (!tenant_id) {
      return res.status(401).json({ error: 'Tenant non identifié' });
    }

    const plan = await getTenantPlan(tenant_id);
    const check = await checkPrestationsQuota(tenant_id, plan);

    if (!check.ok) {
      captureMessage(`Quota prestations exceeded: ${tenant_id}`, 'warning', { tags: { type: 'quota_exceeded', quota: 'prestations' }, extra: { tenant_id, plan, current: check.current, limit: check.limit } });
      return res.status(403).json({
        error: check.message,
        code: 'QUOTA_EXCEEDED',
        upgrade_required: true,
        current_plan: plan,
        quota: 'prestations',
        current: check.current,
        limit: check.limit,
        redirect: '/admin/billing/upgrade'
      });
    }

    req.quota_prestations = check;
    next();
  } catch (error) {
    logger.error('Erreur middleware prestations', { tag: 'QUOTAS', error: error.message });
    res.status(500).json({ error: 'Erreur vérification quota' });
  }
}

/**
 * Middleware : vérifie quota stockage avant upload
 */
export async function requireStorageQuota(req, res, next) {
  try {
    const tenant_id = req.admin?.tenant_id || req.tenant_id || req.tenantId;
    if (!tenant_id) {
      return res.status(401).json({ error: 'Tenant non identifié' });
    }

    const file_size = req.file?.size || req.body?.file_size || 0;
    const plan = await getTenantPlan(tenant_id);
    const check = await checkStorageQuota(tenant_id, plan, file_size);

    if (!check.ok) {
      captureMessage(`Quota stockage exceeded: ${tenant_id}`, 'warning', { tags: { type: 'quota_exceeded', quota: 'stockage' }, extra: { tenant_id, plan } });
      return res.status(403).json({
        error: check.message,
        code: 'QUOTA_EXCEEDED',
        upgrade_required: true,
        current_plan: plan,
        quota: 'storage',
        current_gb: check.current_gb,
        limit_gb: check.limit_gb,
        redirect: '/admin/billing/upgrade'
      });
    }

    req.quota_storage = check;
    next();
  } catch (error) {
    logger.error('Erreur middleware storage', { tag: 'QUOTAS', error: error.message });
    res.status(500).json({ error: 'Erreur vérification quota' });
  }
}

/**
 * Middleware : vérifie quota posts IA avant génération
 */
export async function requirePostsQuota(req, res, next) {
  try {
    const tenant_id = req.admin?.tenant_id || req.tenant_id || req.tenantId;
    if (!tenant_id) {
      return res.status(401).json({ error: 'Tenant non identifié' });
    }

    const plan = await getTenantPlan(tenant_id);
    const check = await checkSocialQuota(tenant_id, plan, 'post');

    if (!check.ok) {
      const resetDate = new Date();
      resetDate.setMonth(resetDate.getMonth() + 1);
      resetDate.setDate(1);

      return res.status(403).json({
        error: check.message,
        code: 'QUOTA_EXCEEDED',
        upgrade_required: true,
        current_plan: plan,
        quota: 'posts',
        current: check.current,
        limit: check.limit,
        reset_date: resetDate.toISOString(),
        redirect: '/admin/billing/upgrade'
      });
    }

    req.quota_posts = check;
    next();
  } catch (error) {
    logger.error('Erreur middleware posts', { tag: 'QUOTAS', error: error.message });
    res.status(500).json({ error: 'Erreur vérification quota' });
  }
}

/**
 * Middleware : vérifie quota images IA avant génération
 */
export async function requireImagesQuota(req, res, next) {
  try {
    const tenant_id = req.admin?.tenant_id || req.tenant_id || req.tenantId;
    if (!tenant_id) {
      return res.status(401).json({ error: 'Tenant non identifié' });
    }

    const plan = await getTenantPlan(tenant_id);
    const check = await checkSocialQuota(tenant_id, plan, 'image');

    if (!check.ok) {
      const resetDate = new Date();
      resetDate.setMonth(resetDate.getMonth() + 1);
      resetDate.setDate(1);

      return res.status(403).json({
        error: check.message,
        code: 'QUOTA_EXCEEDED',
        upgrade_required: true,
        current_plan: plan,
        quota: 'images',
        current: check.current,
        limit: check.limit,
        reset_date: resetDate.toISOString(),
        redirect: '/admin/billing/upgrade'
      });
    }

    req.quota_images = check;
    next();
  } catch (error) {
    logger.error('Erreur middleware images', { tag: 'QUOTAS', error: error.message });
    res.status(500).json({ error: 'Erreur vérification quota' });
  }
}

export default {
  PLAN_LIMITS,
  getTenantPlan,
  checkClientsQuota,
  checkReservationsQuota,
  checkFacturesQuota,
  checkPrestationsQuota,
  checkStorageQuota,
  checkSocialQuota,
  getQuotaUsage,
  requireClientsQuota,
  requireReservationsQuota,
  requireFacturesQuota,
  requirePrestationsQuota,
  requireStorageQuota,
  requirePostsQuota,
  requireImagesQuota
};
