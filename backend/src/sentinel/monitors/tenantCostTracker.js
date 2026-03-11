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

// Structure : { tenantId: { calls, tokensIn, tokensOut, cost, history[] } }
const tenantUsage = {};

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
