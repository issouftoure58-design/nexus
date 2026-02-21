/**
 * Quota Manager - Gestion des quotas et facturation dépassement
 *
 * Protège contre les pertes en limitant l'usage par module
 * et en facturant les dépassements.
 */

import { supabase } from '../config/supabase.js';

/**
 * QUOTAS OPTIMISÉS - Prend en compte les optimisations internes:
 * - OpenAI TTS (20x moins cher qu'ElevenLabs)
 * - Model Router Haiku/Sonnet (12x moins cher pour FAQ)
 * - Cache universel (30-50% de hits gratuits)
 *
 * Coût réel estimé avec optimisations:
 * - Téléphone: ~0.08€/min (vs 0.25€ sans optim)
 * - WhatsApp: ~0.008€/msg (vs 0.025€ sans optim)
 * - Web Chat: ~0.025€/session (vs 0.09€ sans optim)
 */

// Définition des quotas par module (inclus dans le prix de base)
export const MODULE_QUOTAS = {
  telephone_ia: {
    id: 'telephone_ia',
    name: 'Téléphone IA',
    included: {
      minutes: 300,           // 300 minutes incluses
      calls: null,
    },
    overage: {
      minutes: 0.25,          // 0.25€/minute au-delà
    },
    basePrice: 99,
    unit: 'minutes',
    costPerUnit: 0.08,
  },

  whatsapp_ia: {
    id: 'whatsapp_ia',
    name: 'WhatsApp IA',
    included: {
      messages: 1500,         // 1500 messages inclus
    },
    overage: {
      messages: 0.03,         // 0.03€/message au-delà
    },
    basePrice: 49,
    unit: 'messages',
    costPerUnit: 0.008,
  },

  web_chat_ia: {
    id: 'web_chat_ia',
    name: 'Chat Web IA',
    included: {
      sessions: 800,          // 800 sessions incluses
      messages: 8000,
    },
    overage: {
      sessions: 0.10,         // 0.10€/session au-delà
    },
    basePrice: 79,
    unit: 'sessions',
    costPerUnit: 0.025,
  },

  sms_rdv: {
    id: 'sms_rdv',
    name: 'SMS Rappels RDV',
    included: {
      sms: 200,               // 200 SMS inclus
    },
    overage: {
      sms: 0.10,              // 0.10€/SMS au-delà
    },
    basePrice: 39,
    unit: 'sms',
    costPerUnit: 0.0725,
  },

  marketing_email: {
    id: 'marketing_email',
    name: 'Marketing Email',
    included: {
      emails: 5000,           // 5000 emails inclus
    },
    overage: {
      emails: 0.003,          // 0.003€/email au-delà
    },
    basePrice: 29,
    unit: 'emails',
    costPerUnit: 0.001,
  },

  // Modules sans quota (coût fixe)
  comptabilite: {
    id: 'comptabilite',
    name: 'Comptabilité',
    included: {},
    overage: {},
    basePrice: 14.90,
    unit: null,
    unlimited: true,
  },

  stock: {
    id: 'stock',
    name: 'Gestion Stock',
    included: {},
    overage: {},
    basePrice: 9.90,
    unit: null,
    unlimited: true,
  },

  rh: {
    id: 'rh',
    name: 'Ressources Humaines',
    included: {},
    overage: {},
    basePrice: 9.90,
    unit: null,
    unlimited: true,
  },

  crm: {
    id: 'crm',
    name: 'CRM',
    included: {},
    overage: {},
    basePrice: 14.90,
    unit: null,
    unlimited: true,
  },

  site_web: {
    id: 'site_web',
    name: 'Site Web',
    included: {},
    overage: {},
    basePrice: 25.90,
    unit: null,
    unlimited: true,
  },

  seo: {
    id: 'seo',
    name: 'SEO',
    included: {},
    overage: {},
    basePrice: 9.90,
    unit: null,
    unlimited: true,
  },

  reservations: {
    id: 'reservations',
    name: 'Réservations',
    included: {
      reservations: null,
    },
    overage: {},
    basePrice: 19,
    unit: null,
    unlimited: true,
  },
};

// Table de mapping channel -> module
const CHANNEL_TO_MODULE = {
  telephone: 'telephone_ia',
  voice: 'telephone_ia',
  whatsapp: 'whatsapp_ia',
  web: 'web_chat_ia',
  webchat: 'web_chat_ia',
  sms: 'sms_rdv',
  email: 'marketing_email',
};

class QuotaManager {
  constructor() {
    this.usageCache = {};
    this.cacheTTL = 60000; // 1 minute
  }

  /**
   * Récupère l'usage actuel d'un tenant pour le mois en cours
   * @param {string} tenantId - ID du tenant (obligatoire)
   */
  async getCurrentUsage(tenantId) {
    if (!tenantId) throw new Error('tenant_id requis');

    const cacheKey = `usage-${tenantId}`;
    const cached = this.usageCache[cacheKey];

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    try {
      // Récupérer l'usage depuis quota_usage ou créer la structure
      const { data: quotaData, error } = await supabase
        .from('quota_usage')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('period_start', startOfMonth.toISOString())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[QUOTA] Erreur récupération usage:', error.message);
      }

      // Si pas de données, calculer depuis les logs
      const usage = quotaData || await this.calculateUsageFromLogs(tenantId, startOfMonth);

      this.usageCache[cacheKey] = {
        data: usage,
        timestamp: Date.now(),
      };

      return usage;
    } catch (error) {
      console.error('[QUOTA] Erreur:', error.message);
      return this.getEmptyUsage(tenantId);
    }
  }

  /**
   * Calcule l'usage depuis les logs si pas de données quota_usage
   * @param {string} tenantId - ID du tenant (obligatoire)
   */
  async calculateUsageFromLogs(tenantId, startDate) {
    if (!tenantId) throw new Error('tenant_id requis');

    const usage = this.getEmptyUsage(tenantId);

    try {
      // Appels téléphoniques
      const { data: callLogs } = await supabase
        .from('twilio_call_logs')
        .select('call_duration, channel')
        .eq('tenant_id', tenantId)
        .eq('channel', 'voice')
        .gte('created_at', startDate.toISOString());

      if (callLogs) {
        usage.telephone_ia.minutes = callLogs.reduce((sum, log) =>
          sum + Math.ceil((log.call_duration || 0) / 60), 0);
        usage.telephone_ia.calls = callLogs.length;
      }

      // SMS
      const { data: smsLogs } = await supabase
        .from('twilio_call_logs')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('channel', 'sms')
        .gte('created_at', startDate.toISOString());

      if (smsLogs) {
        usage.sms_rdv.sms = smsLogs.length;
      }

      // WhatsApp (depuis sentinel_usage ou messages)
      const { data: waLogs } = await supabase
        .from('sentinel_usage')
        .select('calls')
        .eq('tenant_id', tenantId)
        .eq('channel', 'whatsapp')
        .gte('date', startDate.toISOString().split('T')[0]);

      if (waLogs) {
        usage.whatsapp_ia.messages = waLogs.reduce((sum, log) => sum + (log.calls || 0), 0);
      }

      // Web Chat
      const { data: webLogs } = await supabase
        .from('sentinel_usage')
        .select('calls')
        .eq('tenant_id', tenantId)
        .eq('channel', 'web')
        .gte('date', startDate.toISOString().split('T')[0]);

      if (webLogs) {
        usage.web_chat_ia.sessions = webLogs.reduce((sum, log) => sum + (log.calls || 0), 0);
      }

    } catch (error) {
      console.error('[QUOTA] Erreur calcul logs:', error.message);
    }

    return usage;
  }

  /**
   * Structure d'usage vide
   */
  getEmptyUsage(tenantId) {
    return {
      tenant_id: tenantId,
      period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      telephone_ia: { minutes: 0, calls: 0 },
      whatsapp_ia: { messages: 0 },
      web_chat_ia: { sessions: 0, messages: 0 },
      sms_rdv: { sms: 0 },
      marketing_email: { emails: 0 },
    };
  }

  /**
   * Incrémente l'usage d'un module
   * @param {string} tenantId - ID du tenant (obligatoire)
   */
  async incrementUsage(tenantId, moduleId, metric, amount = 1) {
    if (!tenantId) throw new Error('tenant_id requis');

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    try {
      // Upsert dans quota_usage
      const { data: existing } = await supabase
        .from('quota_usage')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('period_start', startOfMonth.toISOString())
        .single();

      if (existing) {
        // Update
        const currentValue = existing[moduleId]?.[metric] || 0;
        const updateData = {
          [moduleId]: {
            ...existing[moduleId],
            [metric]: currentValue + amount,
          },
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from('quota_usage')
          .update(updateData)
          .eq('tenant_id', tenantId)
          .eq('id', existing.id);
      } else {
        // Insert
        const newUsage = this.getEmptyUsage(tenantId);
        newUsage[moduleId][metric] = amount;

        await supabase
          .from('quota_usage')
          .insert(newUsage);
      }

      // Invalider le cache
      delete this.usageCache[`usage-${tenantId}`];

      return true;
    } catch (error) {
      console.error('[QUOTA] Erreur increment:', error.message);
      return false;
    }
  }

  /**
   * Vérifie si un tenant peut utiliser un module (quota non dépassé ou overage autorisé)
   * @param {string} tenantId - ID du tenant (obligatoire)
   */
  async checkQuota(tenantId, moduleId, metric, amount = 1) {
    if (!tenantId) throw new Error('tenant_id requis');

    const quota = MODULE_QUOTAS[moduleId];
    if (!quota || quota.unlimited) {
      return { allowed: true, remaining: Infinity, overage: 0 };
    }

    const usage = await this.getCurrentUsage(tenantId);
    const currentUsage = usage[moduleId]?.[metric] || 0;
    const limit = quota.included[metric];

    if (limit === null || limit === undefined) {
      return { allowed: true, remaining: Infinity, overage: 0 };
    }

    const remaining = Math.max(0, limit - currentUsage);
    const wouldExceed = currentUsage + amount > limit;
    const overageAmount = wouldExceed ? (currentUsage + amount - limit) : 0;
    const overageRate = quota.overage[metric] || 0;
    const overageCost = overageAmount * overageRate;

    return {
      allowed: true, // Toujours autorisé, mais facturé en overage
      remaining,
      currentUsage,
      limit,
      wouldExceed,
      overageAmount,
      overageRate,
      overageCost,
    };
  }

  /**
   * Calcule le montant total d'overage pour un tenant ce mois
   */
  async calculateOverage(tenantId) {
    const usage = await this.getCurrentUsage(tenantId);
    const overages = {};
    let totalOverage = 0;

    for (const [moduleId, quota] of Object.entries(MODULE_QUOTAS)) {
      if (quota.unlimited) continue;

      const moduleUsage = usage[moduleId] || {};
      const moduleOverages = {};

      for (const [metric, limit] of Object.entries(quota.included)) {
        if (limit === null) continue;

        const used = moduleUsage[metric] || 0;
        const excess = Math.max(0, used - limit);
        const rate = quota.overage[metric] || 0;
        const cost = excess * rate;

        if (excess > 0) {
          moduleOverages[metric] = {
            used,
            limit,
            excess,
            rate,
            cost,
          };
          totalOverage += cost;
        }
      }

      if (Object.keys(moduleOverages).length > 0) {
        overages[moduleId] = {
          name: quota.name,
          metrics: moduleOverages,
        };
      }
    }

    return {
      total: parseFloat(totalOverage.toFixed(2)),
      details: overages,
    };
  }

  /**
   * Récupère le statut complet des quotas pour un tenant
   */
  async getQuotaStatus(tenantId) {
    const usage = await this.getCurrentUsage(tenantId);
    const status = {};

    for (const [moduleId, quota] of Object.entries(MODULE_QUOTAS)) {
      const moduleUsage = usage[moduleId] || {};

      status[moduleId] = {
        name: quota.name,
        basePrice: quota.basePrice,
        unlimited: quota.unlimited || false,
        metrics: {},
      };

      if (!quota.unlimited) {
        for (const [metric, limit] of Object.entries(quota.included)) {
          if (limit === null) continue;

          const used = moduleUsage[metric] || 0;
          const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;
          const remaining = Math.max(0, limit - used);
          const excess = Math.max(0, used - limit);
          const overageRate = quota.overage[metric] || 0;
          const overageCost = excess * overageRate;

          status[moduleId].metrics[metric] = {
            used,
            limit,
            remaining,
            percentage,
            excess,
            overageRate,
            overageCost,
            status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok',
          };
        }
      }
    }

    // Ajouter le total overage
    const overage = await this.calculateOverage(tenantId);

    return {
      tenantId,
      period: usage.period_start,
      modules: status,
      totalOverage: overage.total,
      overageDetails: overage.details,
    };
  }

  /**
   * Récupère le module correspondant à un channel
   */
  getModuleFromChannel(channel) {
    return CHANNEL_TO_MODULE[channel] || null;
  }

  /**
   * Invalide le cache pour un tenant
   */
  invalidateCache(tenantId) {
    delete this.usageCache[`usage-${tenantId}`];
  }
}

// Singleton
export const quotaManager = new QuotaManager();
export default quotaManager;
