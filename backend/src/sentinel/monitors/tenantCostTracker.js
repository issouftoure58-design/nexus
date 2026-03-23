/**
 * SENTINEL - Tenant Cost Tracker
 *
 * Suivi des coûts API par tenant (source de vérité unique).
 * Remplace le double tracking avec costMonitor.
 *
 * Stockage en mémoire + persistance Supabase.
 */

import { checkAndAlert } from '../alerts.js';
import { checkQuota, getPlan } from './quotas.js';
import { getTenantConfig } from '../../config/tenants/index.js';
import { saveUsage, loadTodayUsage } from '../persistence.js';
import { PRICING as GLOBAL_PRICING } from '../../config/pricing.js';
import { THRESHOLDS } from '../config/thresholds.js';
import { alerter } from '../actions/alerter.js';

// Structure : { tenantId: { calls, tokensIn, tokensOut, cost, history[] } }
const tenantUsage = {};

// ============================================
// PLATFORM COST TRACKING (temps reel)
// ============================================
let platformHourlyCost = 0;
let platformDailyCost = 0;
let currentHourKey = getHourKey();
let currentDayKey = getDayKey();
const recentCostAlerts = [];

// Prix Claude API (par token, en EUR) — depuis config/pricing.js
const PRICING = {
  haiku: { input: GLOBAL_PRICING.anthropic.haiku.input / 1_000_000, output: GLOBAL_PRICING.anthropic.haiku.output / 1_000_000 },
  sonnet: { input: GLOBAL_PRICING.anthropic.sonnet.input / 1_000_000, output: GLOBAL_PRICING.anthropic.sonnet.output / 1_000_000 },
};

function initTenant(tenantId) {
  if (!tenantUsage[tenantId]) {
    tenantUsage[tenantId] = {
      calls: 0,
      callsHaiku: 0,
      callsSonnet: 0,
      tokensIn: 0,
      tokensOut: 0,
      cost: 0,
      history: [],
    };
  }
}

/**
 * Track un appel Claude API pour un tenant.
 */
export async function trackTenantCall(tenantId, model, tokensIn, tokensOut) {
  initTenant(tenantId);

  const modelType = model.includes('haiku') ? 'haiku' : 'sonnet';
  const callCost = (tokensIn * PRICING[modelType].input) + (tokensOut * PRICING[modelType].output);

  tenantUsage[tenantId].calls++;
  if (modelType === 'haiku') {
    tenantUsage[tenantId].callsHaiku++;
  } else {
    tenantUsage[tenantId].callsSonnet++;
  }
  tenantUsage[tenantId].tokensIn += tokensIn;
  tenantUsage[tenantId].tokensOut += tokensOut;
  tenantUsage[tenantId].cost += callCost;

  // Surveillance couts plateforme temps reel
  checkPlatformCostThresholds(callCost);

  // Garder les 100 derniers appels
  tenantUsage[tenantId].history.push({
    timestamp: new Date().toISOString(),
    model: modelType,
    tokensIn,
    tokensOut,
    cost: callCost,
  });
  if (tenantUsage[tenantId].history.length > 100) {
    tenantUsage[tenantId].history.shift();
  }

  // Note: costMonitor.trackClaudeUsage() supprimé — double tracking
  // tenantCostTracker est la source de vérité pour les coûts par tenant

  // Vérifier quota et alerter si nécessaire
  try {
    const tenantConfig = getTenantConfig(tenantId);
    const planId = tenantConfig.plan || 'starter';
    const quotaCheck = checkQuota(tenantUsage[tenantId], planId);

    if (quotaCheck.usage.percentage >= 80) {
      await checkAndAlert(tenantId, quotaCheck.usage, getPlan(planId).name);
    }
  } catch (err) {
    console.error(`[SENTINEL] Erreur vérification alerte:`, err.message);
  }

  // Persister en async (ne bloque pas la requête)
  saveUsage(tenantId, tenantUsage[tenantId]).catch(err =>
    console.error('[SENTINEL] Erreur persistence:', err.message)
  );

  return { tenantId, callCost, totalCost: tenantUsage[tenantId].cost };
}

/**
 * Charger les données persistées au démarrage du serveur.
 * IMPORTANT: Charge uniquement les données d'AUJOURD'HUI pour éviter le cumul.
 * Les totaux mensuels sont calculés par loadAllUsage() pour le dashboard.
 */
export async function initTenantUsageFromDB() {
  try {
    console.log('[SENTINEL] Chargement données du jour...');
    // 🔧 FIX: Charger SEULEMENT aujourd'hui, pas tout le mois
    // Cela évite le bug de cumul exponentiel à chaque redémarrage
    const persisted = await loadTodayUsage();

    for (const [tid, data] of Object.entries(persisted)) {
      tenantUsage[tid] = {
        ...data,
        history: [], // L'historique détaillé n'est pas persisté
      };
    }

    console.log(`[SENTINEL] ${Object.keys(persisted).length} tenants chargés pour aujourd'hui`);
    return { success: true, count: Object.keys(persisted).length };
  } catch (err) {
    console.error('[SENTINEL] Erreur init depuis DB:', err.message);
    return { success: false, error: err.message };
  }
}

export function getTenantUsage(tenantId) {
  initTenant(tenantId);
  return tenantUsage[tenantId];
}

/**
 * ATTENTION: Cette fonction est réservée au système interne.
 * Ne JAMAIS exposer via API publique - fuite cross-tenant!
 * Pour usage admin système uniquement (ex: dashboard superadmin).
 * @internal
 */
export function getAllTenantUsage_SYSTEM_ONLY() {
  console.warn('[SENTINEL] getAllTenantUsage_SYSTEM_ONLY called - ensure this is internal use only');
  return tenantUsage;
}

/**
 * Retourne l'usage pour UN tenant spécifique.
 * C'est cette fonction qui doit être utilisée par les routes API.
 */
export function getAllTenantUsage(tenantId) {
  if (!tenantId) {
    throw new Error('tenant_id requis pour getAllTenantUsage');
  }
  initTenant(tenantId);
  return { [tenantId]: tenantUsage[tenantId] };
}

export function resetTenantUsage(tenantId) {
  if (tenantId) {
    delete tenantUsage[tenantId];
  } else {
    Object.keys(tenantUsage).forEach(k => delete tenantUsage[k]);
  }
}

// ============================================
// PLATFORM COST — SURVEILLANCE TEMPS REEL
// ============================================

function getHourKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}`;
}

function getDayKey() {
  return new Date().toISOString().split('T')[0];
}

function checkPlatformCostThresholds(callCost) {
  const hourKey = getHourKey();
  const dayKey = getDayKey();

  // Reset compteurs si changement d'heure/jour
  if (hourKey !== currentHourKey) {
    platformHourlyCost = 0;
    currentHourKey = hourKey;
  }
  if (dayKey !== currentDayKey) {
    platformDailyCost = 0;
    currentDayKey = dayKey;
  }

  platformHourlyCost += callCost;
  platformDailyCost += callCost;

  const hourlyThresholds = THRESHOLDS.hourly || { warning: 5, critical: 10 };
  const dailyThresholds = THRESHOLDS.daily || { warning: 15, critical: 25 };

  // Seuils horaires
  if (platformHourlyCost >= hourlyThresholds.critical) {
    sendCostAlert('CRITICAL', `Cout IA horaire critique: ${platformHourlyCost.toFixed(2)}EUR/h (seuil: ${hourlyThresholds.critical}EUR)`, {
      type: 'hourly', cost: platformHourlyCost, threshold: hourlyThresholds.critical, hour: currentHourKey,
    });
  } else if (platformHourlyCost >= hourlyThresholds.warning) {
    sendCostAlert('URGENT', `Cout IA horaire eleve: ${platformHourlyCost.toFixed(2)}EUR/h (seuil: ${hourlyThresholds.warning}EUR)`, {
      type: 'hourly', cost: platformHourlyCost, threshold: hourlyThresholds.warning, hour: currentHourKey,
    });
  }

  // Seuils journaliers
  if (platformDailyCost >= dailyThresholds.critical) {
    sendCostAlert('CRITICAL', `Cout IA journalier critique: ${platformDailyCost.toFixed(2)}EUR/j (seuil: ${dailyThresholds.critical}EUR)`, {
      type: 'daily', cost: platformDailyCost, threshold: dailyThresholds.critical, day: currentDayKey,
    });
  } else if (platformDailyCost >= dailyThresholds.warning) {
    sendCostAlert('URGENT', `Cout IA journalier eleve: ${platformDailyCost.toFixed(2)}EUR/j (seuil: ${dailyThresholds.warning}EUR)`, {
      type: 'daily', cost: platformDailyCost, threshold: dailyThresholds.warning, day: currentDayKey,
    });
  }
}

async function sendCostAlert(level, title, data) {
  try {
    const result = await alerter.send(level, title, data);
    if (result.sent) {
      recentCostAlerts.push({
        level,
        title,
        data,
        timestamp: new Date().toISOString(),
      });
      // Garder les 50 dernieres alertes
      if (recentCostAlerts.length > 50) recentCostAlerts.shift();
    }
  } catch (err) {
    console.error('[SENTINEL] Cost alert error:', err.message);
  }
}

/**
 * Retourne le status des couts plateforme en temps reel
 * Pour le dashboard et l'API
 */
export function getPlatformCostStatus() {
  const hourKey = getHourKey();
  const dayKey = getDayKey();

  // Reset si changement d'heure/jour
  if (hourKey !== currentHourKey) {
    platformHourlyCost = 0;
    currentHourKey = hourKey;
  }
  if (dayKey !== currentDayKey) {
    platformDailyCost = 0;
    currentDayKey = dayKey;
  }

  const hourlyThresholds = THRESHOLDS.hourly || { warning: 5, critical: 10 };
  const dailyThresholds = THRESHOLDS.daily || { warning: 15, critical: 25 };

  return {
    hourly: {
      cost: Math.round(platformHourlyCost * 100) / 100,
      hour: currentHourKey,
      warning: hourlyThresholds.warning,
      critical: hourlyThresholds.critical,
      status: platformHourlyCost >= hourlyThresholds.critical ? 'critical'
        : platformHourlyCost >= hourlyThresholds.warning ? 'warning' : 'ok',
    },
    daily: {
      cost: Math.round(platformDailyCost * 100) / 100,
      day: currentDayKey,
      warning: dailyThresholds.warning,
      critical: dailyThresholds.critical,
      status: platformDailyCost >= dailyThresholds.critical ? 'critical'
        : platformDailyCost >= dailyThresholds.warning ? 'warning' : 'ok',
    },
    recentAlerts: recentCostAlerts.slice(-10),
  };
}
