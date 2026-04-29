/**
 * Module Activation Service — Source unique pour activer/desactiver des modules
 *
 * TOUTES les routes qui modifient modules_actifs, options_canaux_actifs ou
 * tenant_ia_config DOIVENT passer par ce service.
 *
 * Stores synchronises :
 * 1. tenants.modules_actifs (JSONB)
 * 2. tenants.options_canaux_actifs (JSONB)
 * 3. tenant_ia_config (table — 1 row par channel)
 * 4. module_activation_requests (table — demandes pending)
 */

import { supabase } from '../config/supabase.js';
import { invalidateModuleCache } from '../middleware/moduleProtection.js';
import { getFeaturesForPlan } from '../config/planFeatures.js';
import { sendEmail } from './emailService.js';
import logger from '../config/logger.js';

// Mapping canonical module IDs vers les noms de canal dans tenant_ia_config
const MODULE_TO_CHANNEL = {
  agent_ia_web: 'web',
  whatsapp: 'whatsapp',
  telephone: 'telephone',
};

const IA_CHANNELS = new Set(Object.keys(MODULE_TO_CHANNEL));

/**
 * Charge les stores actuels d'un tenant
 */
async function loadTenantStores(tenantId) {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('modules_actifs, options_canaux_actifs, name')
    .eq('id', tenantId)
    .single();

  if (error || !tenant) {
    throw new Error(`Tenant ${tenantId} non trouve`);
  }

  return {
    modulesActifs: tenant.modules_actifs || {},
    optionsCanaux: tenant.options_canaux_actifs || {},
    tenantName: tenant.name || tenantId,
  };
}

/**
 * Persiste les stores mis a jour et invalide le cache
 */
async function persistStores(tenantId, modulesActifs, optionsCanaux) {
  const { error } = await supabase
    .from('tenants')
    .update({
      modules_actifs: modulesActifs,
      options_canaux_actifs: optionsCanaux,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId);

  if (error) {
    throw new Error(`Erreur persistence stores pour ${tenantId}: ${error.message}`);
  }

  invalidateModuleCache(tenantId);
}

// ══════════════════════════════════════════════════════════════
// ACTIVATE MODULE
// ══════════════════════════════════════════════════════════════

/**
 * Active un module pour un tenant.
 * Synchronise les 3 stores (modules_actifs, options_canaux_actifs, tenant_ia_config).
 *
 * @param {string} tenantId
 * @param {string} moduleId - ex: 'agent_ia_web', 'whatsapp', 'stock', 'comptabilite'
 * @param {Object} [options]
 * @param {Object} [options.iaConfig] - Config IA custom (sinon defaut)
 * @returns {Object} { modulesActifs, optionsCanaux }
 */
export async function activateModule(tenantId, moduleId, options = {}) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!moduleId) throw new Error('module_id requis');

  const { modulesActifs, optionsCanaux } = await loadTenantStores(tenantId);

  // 1. Set module = true dans modules_actifs
  modulesActifs[moduleId] = true;

  // 2. Si canal IA → set dans options_canaux_actifs aussi
  if (IA_CHANNELS.has(moduleId)) {
    optionsCanaux[moduleId] = true;
  }

  // 3. Si canal IA → upsert tenant_ia_config(active: true)
  const channel = MODULE_TO_CHANNEL[moduleId];
  if (channel) {
    const defaultConfig = {
      active: true,
      activation_requested: false,
      activated_at: new Date().toISOString(),
    };
    const config = options.iaConfig
      ? { ...options.iaConfig, active: true, activation_requested: false }
      : defaultConfig;

    await supabase
      .from('tenant_ia_config')
      .upsert(
        { tenant_id: tenantId, channel, config },
        { onConflict: 'tenant_id,channel' }
      );
  }

  // 4. Persist + invalidate cache
  await persistStores(tenantId, modulesActifs, optionsCanaux);

  logger.info('Module active', { tag: 'MODULE_ACTIVATION', tenantId, moduleId });
  return { modulesActifs, optionsCanaux };
}

// ══════════════════════════════════════════════════════════════
// DEACTIVATE MODULE
// ══════════════════════════════════════════════════════════════

/**
 * Desactive un module pour un tenant.
 * Synchronise les 3 stores.
 *
 * @param {string} tenantId
 * @param {string} moduleId
 * @returns {Object} { modulesActifs, optionsCanaux }
 */
export async function deactivateModule(tenantId, moduleId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!moduleId) throw new Error('module_id requis');

  const { modulesActifs, optionsCanaux } = await loadTenantStores(tenantId);

  // 1. Set module = false dans modules_actifs
  modulesActifs[moduleId] = false;

  // 2. Si canal IA → remove from options_canaux_actifs
  if (IA_CHANNELS.has(moduleId)) {
    optionsCanaux[moduleId] = false;
  }

  // 3. Si canal IA → upsert tenant_ia_config(active: false)
  const channel = MODULE_TO_CHANNEL[moduleId];
  if (channel) {
    const { data: existing } = await supabase
      .from('tenant_ia_config')
      .select('id, config')
      .eq('tenant_id', tenantId)
      .eq('channel', channel)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('tenant_ia_config')
        .update({
          config: {
            ...existing.config,
            active: false,
            activation_requested: false,
            deactivated_at: new Date().toISOString(),
          },
        })
        .eq('id', existing.id);
    }
  }

  // 4. Persist + invalidate cache
  await persistStores(tenantId, modulesActifs, optionsCanaux);

  logger.info('Module desactive', { tag: 'MODULE_ACTIVATION', tenantId, moduleId });
  return { modulesActifs, optionsCanaux };
}

// ══════════════════════════════════════════════════════════════
// REQUEST MODULE ACTIVATION
// ══════════════════════════════════════════════════════════════

/**
 * Cree une demande d'activation (pour WhatsApp/Telephone qui necessitent provisioning).
 *
 * @param {string} tenantId
 * @param {string} moduleId
 * @param {string} [adminUserId] - ID de l'admin qui fait la demande
 * @returns {Object} request record
 */
export async function requestModuleActivation(tenantId, moduleId, adminUserId = null) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!moduleId) throw new Error('module_id requis');

  const { tenantName } = await loadTenantStores(tenantId);

  // 1. Upsert tenant_ia_config avec activation_requested: true
  const channel = MODULE_TO_CHANNEL[moduleId];
  if (channel) {
    await supabase
      .from('tenant_ia_config')
      .upsert(
        {
          tenant_id: tenantId,
          channel,
          config: {
            active: false,
            activation_requested: true,
            requested_at: new Date().toISOString(),
          },
        },
        { onConflict: 'tenant_id,channel' }
      );
  }

  // 2. Insert module_activation_requests (if not already pending)
  const { data: existingReq } = await supabase
    .from('module_activation_requests')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('module_id', moduleId)
    .eq('status', 'pending')
    .maybeSingle();

  let request = existingReq;

  if (!existingReq) {
    // Clean old non-pending requests
    await supabase
      .from('module_activation_requests')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('module_id', moduleId)
      .neq('status', 'pending');

    const { data: newReq, error } = await supabase
      .from('module_activation_requests')
      .insert({
        tenant_id: tenantId,
        module_id: moduleId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    request = newReq;
  }

  // 3. Send notification email (non-blocking)
  const channelLabel = moduleId === 'whatsapp' ? 'WhatsApp IA' : 'Telephone IA';
  sendEmail({
    to: 'contact@nexus-ai-saas.com',
    subject: `[NEXUS] Demande d'activation: ${channelLabel} — ${tenantName}`,
    html: `
      <h2>Nouvelle demande d'activation</h2>
      <p><strong>Tenant:</strong> ${tenantName} (${tenantId})</p>
      <p><strong>Canal:</strong> ${channelLabel} (${moduleId})</p>
      <p>Connectez-vous au back-office Sentinel pour traiter cette demande.</p>
    `,
  }).catch(err => {
    logger.error('Erreur envoi email activation', { tag: 'MODULE_ACTIVATION', error: err.message });
  });

  logger.info('Demande activation creee', { tag: 'MODULE_ACTIVATION', tenantId, moduleId });
  return request;
}

// ══════════════════════════════════════════════════════════════
// APPROVE MODULE ACTIVATION
// ══════════════════════════════════════════════════════════════

/**
 * Approuve une demande d'activation et active le module.
 *
 * @param {string} requestId - ID de la demande dans module_activation_requests
 * @returns {Object} { request, modulesActifs, optionsCanaux }
 */
export async function approveModuleActivation(requestId) {
  if (!requestId) throw new Error('request_id requis');

  // 1. Load request
  const { data: request, error } = await supabase
    .from('module_activation_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (error || !request) {
    throw new Error(`Demande ${requestId} non trouvee`);
  }

  if (request.status !== 'pending') {
    throw new Error(`Demande ${requestId} deja traitee (status: ${request.status})`);
  }

  // 2. Update request status
  await supabase
    .from('module_activation_requests')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  // 3. Actually activate the module
  const result = await activateModule(request.tenant_id, request.module_id);

  logger.info('Demande approuvee', { tag: 'MODULE_ACTIVATION', requestId, tenantId: request.tenant_id, moduleId: request.module_id });
  return { request, ...result };
}

// ══════════════════════════════════════════════════════════════
// SYNC MODULES FROM PLAN
// ══════════════════════════════════════════════════════════════

/**
 * Synchronise les modules d'un tenant selon son plan.
 * Utilise pour les changements de plan Stripe (upgrade/downgrade).
 *
 * - Active les modules inclus dans le nouveau plan
 * - Desactive les modules qui ne sont plus inclus
 * - Preserve les modules manuellement actives (whatsapp/telephone provisioning)
 *
 * @param {string} tenantId
 * @param {string} planId - 'free', 'starter', 'pro', 'business'
 * @returns {Object} { modulesActifs, optionsCanaux }
 */
export async function syncModulesFromPlan(tenantId, planId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!planId) throw new Error('plan_id requis');

  const planFeatures = getFeaturesForPlan(planId);
  const { modulesActifs, optionsCanaux } = await loadTenantStores(tenantId);

  // Merge: plan features override, but manually-activated channels are preserved
  const manualChannels = ['whatsapp', 'telephone']; // These require manual provisioning
  const newModulesActifs = { ...modulesActifs, ...planFeatures };

  // Preserve manually-activated channels
  for (const ch of manualChannels) {
    if (modulesActifs[ch] === true) {
      newModulesActifs[ch] = true;
    }
  }

  // Sync options_canaux_actifs
  const newOptionsCanaux = { ...optionsCanaux };
  for (const moduleId of Object.keys(MODULE_TO_CHANNEL)) {
    if (newModulesActifs[moduleId] === true) {
      newOptionsCanaux[moduleId] = true;
    }
  }

  // Persist
  await persistStores(tenantId, newModulesActifs, newOptionsCanaux);

  logger.info('Modules synced from plan', { tag: 'MODULE_ACTIVATION', tenantId, planId });
  return { modulesActifs: newModulesActifs, optionsCanaux: newOptionsCanaux };
}

export default {
  activateModule,
  deactivateModule,
  requestModuleActivation,
  approveModuleActivation,
  syncModulesFromPlan,
};
