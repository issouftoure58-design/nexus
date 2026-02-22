/**
 * Business Template Loader
 *
 * Charge les templates métier depuis la DB et fournit une config mergée par tenant.
 * Les templates définissent les defaults (services, horaires, prompts).
 * Les tenants peuvent override ces valeurs.
 *
 * @module templateLoader
 */

import { rawSupabase } from '../config/supabase.js';

// ============================================
// CACHE CONFIGURATION
// ============================================

// Cache des templates (changent rarement)
const templateCache = new Map();
const TEMPLATE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================
// FROZEN TENANTS (backward compatibility)
// ============================================

const FROZEN_TENANTS = ['fatshairafro'];

/**
 * Vérifie si un tenant est frozen (utilise config hardcodée)
 * @param {string} tenantId - ID du tenant
 * @returns {boolean}
 */
export function isFrozenTenant(tenantId) {
  return FROZEN_TENANTS.includes(tenantId);
}

// ============================================
// TEMPLATE LOADING
// ============================================

/**
 * Charge un template depuis la DB ou le cache
 * @param {string} templateId - ID du template ('salon', 'restaurant', etc.)
 * @returns {Promise<Object|null>} - Template ou null
 */
export async function loadTemplate(templateId) {
  if (!templateId) {
    templateId = 'salon'; // Default
  }

  // Check cache
  const cached = templateCache.get(templateId);
  if (cached && Date.now() - cached.loadedAt < TEMPLATE_CACHE_TTL) {
    return cached.template;
  }

  try {
    const { data: template, error } = await rawSupabase
      .from('business_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error) {
      console.warn(`[TEMPLATE] Template not found: ${templateId}`, error.message);
      return null;
    }

    // Parse JSONB fields
    const parsed = {
      ...template,
      defaultServices: template.default_services || [],
      defaultBusinessHours: template.default_business_hours || {},
      defaultBookingRules: template.default_booking_rules || {},
      defaultTravelFees: template.default_travel_fees || {},
      greetingTemplates: template.greeting_templates || {},
      goodbyeTemplates: template.goodbye_templates || {},
      ambiguousTerms: template.ambiguous_terms || {},
      categoryLabels: template.category_labels || {},
      requiredFields: template.required_fields || ['client_nom', 'client_telephone'],
      optionalFields: template.optional_fields || ['adresse', 'notes'],
    };

    // Cache it
    templateCache.set(templateId, { template: parsed, loadedAt: Date.now() });
    console.log(`[TEMPLATE] Loaded template: ${templateId}`);

    return parsed;
  } catch (err) {
    console.error(`[TEMPLATE] Error loading template ${templateId}:`, err.message);
    return null;
  }
}

/**
 * Liste tous les templates disponibles
 * @returns {Promise<Array>}
 */
export async function listTemplates() {
  try {
    const { data, error } = await rawSupabase
      .from('business_templates')
      .select('id, name, description')
      .order('name');

    if (error) {
      console.error('[TEMPLATE] Error listing templates:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[TEMPLATE] Error listing templates:', err.message);
    return [];
  }
}

// ============================================
// CONFIG MERGING
// ============================================

/**
 * Fusionne la config template + tenant pour obtenir la config effective
 * Priority: tenant overrides > tenant config > template defaults
 *
 * @param {Object} tenantConfig - Configuration du tenant
 * @returns {Promise<Object>} - Configuration effective
 */
export async function getEffectiveConfig(tenantConfig) {
  if (!tenantConfig) {
    throw new Error('TENANT_CONFIG_REQUIRED');
  }

  const templateId = tenantConfig.template_id || tenantConfig.templateId || 'salon';
  const template = await loadTemplate(templateId);

  // Merge: template defaults < tenant config < tenant overrides
  const effective = {
    // Template info
    templateId,
    templateName: template?.name || 'Unknown',

    // Identity (from tenant, no defaults)
    id: tenantConfig.id,
    name: tenantConfig.name,
    slug: tenantConfig.slug,
    domain: tenantConfig.domain,
    assistantName: tenantConfig.assistant_name || tenantConfig.assistantName || 'Nexus',
    assistantGender: tenantConfig.assistant_gender || 'F', // F = feminine, M = masculine
    gerante: tenantConfig.gerante,
    telephone: tenantConfig.telephone,
    adresse: tenantConfig.adresse,
    concept: tenantConfig.concept,
    secteur: tenantConfig.secteur,
    ville: tenantConfig.ville,

    // Branding
    branding: tenantConfig.branding || {},

    // Features
    features: tenantConfig.features || {},
    frozen: tenantConfig.frozen || false,

    // Business rules (tenant overrides template defaults)
    services: tenantConfig.services || template?.defaultServices || [],
    businessHours: tenantConfig.business_hours || tenantConfig.businessHours || template?.defaultBusinessHours || {},
    bookingRules: tenantConfig.booking_rules || tenantConfig.bookingRules || template?.defaultBookingRules || {},
    travelFees: tenantConfig.travel_fees || tenantConfig.travelFees || template?.defaultTravelFees || null,
    serviceOptions: tenantConfig.service_options || tenantConfig.serviceOptions || {},

    // Personality
    personality: tenantConfig.personality || {
      tutoiement: false,
      ton: 'chaleureux',
      emojis: 'moderation',
    },

    // Prompt customization
    promptOverrides: tenantConfig.prompt_overrides || tenantConfig.promptOverrides || {},
    voiceConfig: tenantConfig.voice_config || tenantConfig.voiceConfig || {},

    // Ambiguous terms (merge template + tenant)
    ambiguousTerms: {
      ...(template?.ambiguousTerms || {}),
      ...(tenantConfig.ambiguous_terms || tenantConfig.ambiguousTerms || {}),
    },

    // Category labels
    categoryLabels: {
      ...(template?.categoryLabels || {}),
      ...(tenantConfig.category_labels || {}),
    },

    // Required/optional fields
    requiredFields: template?.requiredFields || ['client_nom', 'client_telephone'],
    optionalFields: template?.optionalFields || ['adresse', 'notes'],

    // Greeting/goodbye templates
    greetingTemplates: {
      ...(template?.greetingTemplates || {}),
      ...(tenantConfig.greeting_templates || {}),
    },
    goodbyeTemplates: {
      ...(template?.goodbyeTemplates || {}),
      ...(tenantConfig.goodbye_templates || {}),
    },
  };

  return effective;
}

// ============================================
// AGENT ROLES
// ============================================

// Cache des rôles
const roleCache = new Map();
const ROLE_CACHE_TTL = 5 * 60 * 1000;

/**
 * Charge un rôle d'agent depuis la DB
 * @param {string} roleId - ID du rôle ('reservation', 'standard', etc.)
 * @returns {Promise<Object|null>}
 */
export async function loadAgentRole(roleId) {
  if (!roleId) {
    roleId = 'reservation'; // Default
  }

  // Check cache
  const cached = roleCache.get(roleId);
  if (cached && Date.now() - cached.loadedAt < ROLE_CACHE_TTL) {
    return cached.role;
  }

  try {
    const { data: role, error } = await rawSupabase
      .from('agent_roles')
      .select('*')
      .eq('id', roleId)
      .single();

    if (error) {
      console.warn(`[ROLE] Role not found: ${roleId}`, error.message);
      return null;
    }

    // Parse JSONB fields
    const parsed = {
      ...role,
      availableCapabilities: role.available_capabilities || [],
      defaultCapabilities: role.default_capabilities || [],
      channels: role.channels || {},
      systemPromptTemplate: role.system_prompt_template,
      voicePromptTemplate: role.voice_prompt_template,
    };

    // Cache it
    roleCache.set(roleId, { role: parsed, loadedAt: Date.now() });
    console.log(`[ROLE] Loaded role: ${roleId}`);

    return parsed;
  } catch (err) {
    console.error(`[ROLE] Error loading role ${roleId}:`, err.message);
    return null;
  }
}

/**
 * Liste tous les rôles disponibles
 * @returns {Promise<Array>}
 */
export async function listAgentRoles() {
  try {
    const { data, error } = await rawSupabase
      .from('agent_roles')
      .select('id, name, description, channels')
      .order('name');

    if (error) {
      console.error('[ROLE] Error listing roles:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[ROLE] Error listing roles:', err.message);
    return [];
  }
}

// ============================================
// TENANT AGENT CONFIG
// ============================================

/**
 * Charge la configuration agent d'un tenant
 * @param {string} tenantId - ID du tenant
 * @returns {Promise<Object|null>}
 */
export async function loadTenantAgentConfig(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED');
  }

  try {
    const { data, error } = await rawSupabase
      .from('tenant_agent_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      // No config found - return defaults
      if (error.code === 'PGRST116') {
        return null;
      }
      console.warn(`[AGENT_CONFIG] Error loading config for ${tenantId}:`, error.message);
      return null;
    }

    return {
      ...data,
      roleId: data.role_id,
      capabilities: data.capabilities || [],
      autonomy: data.autonomy || {},
      channels: data.channels || {},
      notifications: data.notifications || {},
      escalation: data.escalation || {},
    };
  } catch (err) {
    console.error(`[AGENT_CONFIG] Error loading config for ${tenantId}:`, err.message);
    return null;
  }
}

/**
 * Obtient la configuration complète de l'agent pour un tenant
 * Combine: tenant config + agent role + business template
 * @param {string} tenantId - ID du tenant
 * @returns {Promise<Object>}
 */
export async function getFullAgentConfig(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED');
  }

  // Load tenant agent config
  const agentConfig = await loadTenantAgentConfig(tenantId);
  const roleId = agentConfig?.roleId || 'reservation';

  // Load role definition
  const role = await loadAgentRole(roleId);

  // Determine effective capabilities
  const effectiveCapabilities = agentConfig?.capabilities?.length > 0
    ? agentConfig.capabilities
    : role?.defaultCapabilities || [];

  return {
    roleId,
    roleName: role?.name || 'Agent',
    roleDescription: role?.description || '',

    // Capabilities
    availableCapabilities: role?.availableCapabilities || [],
    enabledCapabilities: effectiveCapabilities,

    // Autonomy
    autonomy: agentConfig?.autonomy || {
      can_book_appointments: true,
      can_cancel_appointments: false,
      can_modify_appointments: false,
      can_take_payments: true,
      can_send_sms: true,
      can_transfer_calls: true,
      can_take_messages: true,
    },

    // Channels
    channels: agentConfig?.channels || role?.channels || {
      phone: { enabled: true },
      chat: { enabled: true },
      whatsapp: { enabled: true },
    },

    // Notifications
    notifications: agentConfig?.notifications || {
      email: true,
      sms: false,
      push: true,
    },

    // Escalation
    escalation: agentConfig?.escalation || {
      transfer_numbers: [],
      fallback_email: null,
      busy_action: 'take_message',
      after_hours_action: 'voicemail',
    },

    // Prompt templates from role
    systemPromptTemplate: role?.systemPromptTemplate,
    voicePromptTemplate: role?.voicePromptTemplate,
  };
}

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Vide le cache des templates
 */
export function clearTemplateCache() {
  templateCache.clear();
  console.log('[TEMPLATE] Cache cleared');
}

/**
 * Vide le cache des rôles
 */
export function clearRoleCache() {
  roleCache.clear();
  console.log('[ROLE] Cache cleared');
}

/**
 * Vide tous les caches
 */
export function clearAllCaches() {
  clearTemplateCache();
  clearRoleCache();
  console.log('[CACHE] All caches cleared');
}

/**
 * Recharge un template spécifique
 * @param {string} templateId - ID du template à recharger
 */
export async function refreshTemplate(templateId) {
  templateCache.delete(templateId);
  return loadTemplate(templateId);
}

// ============================================
// EXPORTS
// ============================================

export default {
  // Templates
  loadTemplate,
  listTemplates,
  getEffectiveConfig,
  refreshTemplate,

  // Agent Roles
  loadAgentRole,
  listAgentRoles,

  // Tenant Agent Config
  loadTenantAgentConfig,
  getFullAgentConfig,

  // Utilities
  isFrozenTenant,
  clearTemplateCache,
  clearRoleCache,
  clearAllCaches,
  FROZEN_TENANTS,
};
