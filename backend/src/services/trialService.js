/**
 * Trial Service - Gestion des périodes d'essai NEXUS
 *
 * Fonctionnalités:
 * - Limites spécifiques au trial
 * - Calcul des jours restants
 * - Notifications de rappel
 * - Blocage post-expiration
 */

import { supabase } from '../config/supabase.js';

// Limites pendant la période d'essai (14 jours)
export const TRIAL_LIMITS = {
  interactions_ia: 50,      // Total interactions IA (téléphone + WhatsApp + chat)
  reservations: 10,         // Réservations max
  sms: 20,                  // SMS envoyés
  emails: 100,              // Emails marketing
  clients: 50,              // Clients max
};

// Durée du trial en jours
export const TRIAL_DURATION_DAYS = 14;

/**
 * Récupère le statut trial d'un tenant
 */
export async function getTrialStatus(tenantId) {
  try {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, statut, essai_fin, created_at, plan_id')
      .eq('id', tenantId)
      .single();

    if (error || !tenant) {
      return { error: 'Tenant non trouvé' };
    }

    const now = new Date();
    const trialEnd = tenant.essai_fin ? new Date(tenant.essai_fin) : null;
    const createdAt = new Date(tenant.created_at);

    // Calculer les jours restants
    let daysRemaining = 0;
    let isExpired = false;
    let isActive = false;

    if (tenant.statut === 'essai' && trialEnd) {
      const diffTime = trialEnd.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isExpired = daysRemaining <= 0;
      isActive = !isExpired;
    } else if (tenant.statut === 'actif') {
      // Client payant
      return {
        isTrial: false,
        isActive: true,
        isPaid: true,
        plan: tenant.plan_id,
      };
    } else if (tenant.statut === 'expire' || tenant.statut === 'annule') {
      isExpired = true;
    }

    // Récupérer l'usage actuel pendant le trial
    const usage = await getTrialUsage(tenantId);

    return {
      isTrial: tenant.statut === 'essai',
      isActive,
      isExpired,
      isPaid: false,
      daysRemaining: Math.max(0, daysRemaining),
      trialEnd: trialEnd?.toISOString(),
      trialStart: createdAt.toISOString(),
      usage,
      limits: TRIAL_LIMITS,
      percentComplete: Math.round(((TRIAL_DURATION_DAYS - daysRemaining) / TRIAL_DURATION_DAYS) * 100),
      alerts: getTrialAlerts(daysRemaining, usage),
    };
  } catch (err) {
    console.error('[TRIAL] Erreur getTrialStatus:', err);
    return { error: err.message };
  }
}

/**
 * Récupère l'usage pendant le trial
 */
async function getTrialUsage(tenantId) {
  try {
    // Récupérer tenant pour avoir la date de début
    const { data: tenant } = await supabase
      .from('tenants')
      .select('created_at')
      .eq('id', tenantId)
      .single();

    if (!tenant) return {};

    const trialStart = new Date(tenant.created_at);

    // Compter les interactions IA (sentinel_usage)
    const { data: iaUsage } = await supabase
      .from('sentinel_usage')
      .select('calls')
      .eq('tenant_id', tenantId)
      .gte('date', trialStart.toISOString().split('T')[0]);

    const interactionsIa = iaUsage?.reduce((sum, row) => sum + (row.calls || 0), 0) || 0;

    // Compter les réservations
    const { count: reservationsCount } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', trialStart.toISOString());

    // Compter les SMS
    const { count: smsCount } = await supabase
      .from('twilio_call_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('channel', 'sms')
      .gte('created_at', trialStart.toISOString());

    // Compter les clients
    const { count: clientsCount } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    return {
      interactions_ia: interactionsIa,
      reservations: reservationsCount || 0,
      sms: smsCount || 0,
      clients: clientsCount || 0,
    };
  } catch (err) {
    console.error('[TRIAL] Erreur getTrialUsage:', err);
    return {};
  }
}

/**
 * Génère les alertes trial
 */
function getTrialAlerts(daysRemaining, usage) {
  const alerts = [];

  // Alertes de temps
  if (daysRemaining === 7) {
    alerts.push({
      type: 'warning',
      code: 'TRIAL_7_DAYS',
      message: 'Il vous reste 7 jours d\'essai gratuit',
      action: 'upgrade',
    });
  } else if (daysRemaining === 3) {
    alerts.push({
      type: 'warning',
      code: 'TRIAL_3_DAYS',
      message: 'Plus que 3 jours d\'essai !',
      action: 'upgrade',
    });
  } else if (daysRemaining === 1) {
    alerts.push({
      type: 'critical',
      code: 'TRIAL_1_DAY',
      message: 'Dernier jour d\'essai ! Passez au plan payant pour continuer.',
      action: 'upgrade',
    });
  } else if (daysRemaining <= 0) {
    alerts.push({
      type: 'critical',
      code: 'TRIAL_EXPIRED',
      message: 'Votre essai est terminé. Souscrivez pour continuer à utiliser NEXUS.',
      action: 'upgrade',
    });
  }

  // Alertes d'usage
  for (const [resource, limit] of Object.entries(TRIAL_LIMITS)) {
    const used = usage[resource] || 0;
    const percentage = (used / limit) * 100;

    if (percentage >= 100) {
      alerts.push({
        type: 'critical',
        code: `LIMIT_REACHED_${resource.toUpperCase()}`,
        message: `Limite de ${resource.replace('_', ' ')} atteinte (${used}/${limit})`,
        action: 'upgrade',
      });
    } else if (percentage >= 80) {
      alerts.push({
        type: 'warning',
        code: `LIMIT_WARNING_${resource.toUpperCase()}`,
        message: `${Math.round(percentage)}% de la limite ${resource.replace('_', ' ')} utilisée`,
        action: 'upgrade',
      });
    }
  }

  return alerts;
}

/**
 * Vérifie si une action est autorisée pendant le trial
 */
export async function checkTrialLimit(tenantId, resource, amount = 1) {
  const status = await getTrialStatus(tenantId);

  // Si pas en trial ou payant, autoriser
  if (!status.isTrial || status.isPaid) {
    return { allowed: true };
  }

  // Si trial expiré
  if (status.isExpired) {
    return {
      allowed: false,
      reason: 'TRIAL_EXPIRED',
      message: 'Votre période d\'essai est terminée',
      action: 'upgrade',
    };
  }

  // Vérifier la limite
  const limit = TRIAL_LIMITS[resource];
  if (!limit) {
    return { allowed: true }; // Pas de limite pour cette ressource
  }

  const used = status.usage[resource] || 0;

  if (used + amount > limit) {
    return {
      allowed: false,
      reason: 'TRIAL_LIMIT_REACHED',
      message: `Limite trial atteinte pour ${resource} (${used}/${limit})`,
      used,
      limit,
      action: 'upgrade',
    };
  }

  return {
    allowed: true,
    used,
    limit,
    remaining: limit - used - amount,
  };
}

/**
 * Middleware Express pour vérifier les limites trial
 */
export function enforceTrialLimit(resource) {
  return async (req, res, next) => {
    const tenantId = req.admin?.tenant_id || req.tenantId || req.headers['x-tenant-id'];

    if (!tenantId) {
      return next(); // Pas de tenant, laisser passer
    }

    const check = await checkTrialLimit(tenantId, resource);

    if (!check.allowed) {
      return res.status(402).json({
        error: check.message,
        code: check.reason,
        used: check.used,
        limit: check.limit,
        action: check.action,
        redirect: '/subscription',
      });
    }

    // Attacher les infos au req
    req.trialLimit = check;
    next();
  };
}

/**
 * Prolonger le trial d'un tenant (admin only)
 */
export async function extendTrial(tenantId, additionalDays = 7) {
  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('essai_fin, statut')
      .eq('id', tenantId)
      .single();

    if (!tenant) {
      return { error: 'Tenant non trouvé' };
    }

    const currentEnd = tenant.essai_fin ? new Date(tenant.essai_fin) : new Date();
    const newEnd = new Date(currentEnd);
    newEnd.setDate(newEnd.getDate() + additionalDays);

    const { error } = await supabase
      .from('tenants')
      .update({
        essai_fin: newEnd.toISOString(),
        statut: 'essai', // Réactiver si expiré
      })
      .eq('id', tenantId);

    if (error) throw error;

    console.log(`[TRIAL] Extended trial for ${tenantId} by ${additionalDays} days (new end: ${newEnd.toISOString()})`);

    return {
      success: true,
      newTrialEnd: newEnd.toISOString(),
      additionalDays,
    };
  } catch (err) {
    console.error('[TRIAL] Erreur extendTrial:', err);
    return { error: err.message };
  }
}

/**
 * Convertir un trial en abonnement payant
 */
export async function convertTrialToPaid(tenantId, planId) {
  try {
    const { error } = await supabase
      .from('tenants')
      .update({
        statut: 'actif',
        plan_id: planId,
        converted_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    if (error) throw error;

    console.log(`[TRIAL] Converted ${tenantId} to paid plan ${planId}`);

    return { success: true };
  } catch (err) {
    console.error('[TRIAL] Erreur convertTrialToPaid:', err);
    return { error: err.message };
  }
}

export default {
  TRIAL_LIMITS,
  TRIAL_DURATION_DAYS,
  getTrialStatus,
  checkTrialLimit,
  enforceTrialLimit,
  extendTrial,
  convertTrialToPaid,
};
