/**
 * SENTINEL - Cost Monitor (Multi-Tenant)
 *
 * Surveille: Couts Claude/ElevenLabs/Twilio/Stripe par tenant
 * Seuils: warning 30 EUR, critical 50 EUR, shutdown 100 EUR
 *
 * TENANT SHIELD: Tous les coûts sont isolés par tenant_id
 */

import { THRESHOLDS } from '../config/thresholds.js';

class CostMonitor {
  constructor() {
    // Structure: { tenantId: { daily: {}, monthly: {} } }
    this.tenantCosts = {};
    this.currentDate = new Date().toISOString().split('T')[0];
    this.currentMonth = this.currentDate.substring(0, 7);
  }

  // Pricing constants (approximate)
  static PRICING = {
    claude: {
      inputPer1k: 0.003,    // $3 per 1M input tokens
      outputPer1k: 0.015    // $15 per 1M output tokens
    },
    elevenlabs: {
      perCharacter: 0.00003  // ~$30 per 1M characters
    },
    twilio: {
      smsOutbound: 0.05,     // ~$0.05 per SMS
      smsInbound: 0.01,
      voicePerMinute: 0.02
    },
    stripe: {
      percentage: 0.029,     // 2.9%
      fixed: 0.30            // + $0.30
    },
    googleMaps: {
      perRequest: 0.005      // ~$5 per 1000 requests
    }
  };

  initTenant(tenantId) {
    if (!this.tenantCosts[tenantId]) {
      this.tenantCosts[tenantId] = {
        daily: {},
        monthly: {}
      };
    }
  }

  resetIfNewDay() {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.currentDate) {
      // Reset daily pour tous les tenants
      for (const tenantId of Object.keys(this.tenantCosts)) {
        this.tenantCosts[tenantId].daily = {};
      }
      this.currentDate = today;
    }

    const month = today.substring(0, 7);
    if (month !== this.currentMonth) {
      // Reset monthly pour tous les tenants
      for (const tenantId of Object.keys(this.tenantCosts)) {
        this.tenantCosts[tenantId].monthly = {};
      }
      this.currentMonth = month;
    }
  }

  /**
   * Track un coût pour un tenant spécifique
   * @param {string} tenantId - ID du tenant (OBLIGATOIRE)
   */
  trackCost(tenantId, service, amount, details = {}) {
    if (!tenantId) {
      console.error('[SENTINEL] trackCost appelé sans tenant_id - coût non enregistré');
      return null;
    }

    this.resetIfNewDay();
    this.initTenant(tenantId);

    const costs = this.tenantCosts[tenantId];

    if (!costs.daily[service]) {
      costs.daily[service] = { total: 0, calls: 0, details: [] };
    }
    if (!costs.monthly[service]) {
      costs.monthly[service] = { total: 0, calls: 0 };
    }

    costs.daily[service].total += amount;
    costs.daily[service].calls += 1;
    costs.daily[service].details.push({
      amount,
      timestamp: new Date().toISOString(),
      ...details
    });

    costs.monthly[service].total += amount;
    costs.monthly[service].calls += 1;

    // Keep only last 100 details per service
    if (costs.daily[service].details.length > 100) {
      costs.daily[service].details.shift();
    }

    return this.getTodayCosts(tenantId);
  }

  trackClaudeUsage(tenantId, inputTokens, outputTokens) {
    if (!tenantId) {
      console.error('[SENTINEL] trackClaudeUsage appelé sans tenant_id');
      return null;
    }

    const cost =
      (inputTokens / 1000) * CostMonitor.PRICING.claude.inputPer1k +
      (outputTokens / 1000) * CostMonitor.PRICING.claude.outputPer1k;

    return this.trackCost(tenantId, 'claude', cost, { inputTokens, outputTokens });
  }

  trackTwilioSMS(tenantId, direction = 'outbound') {
    if (!tenantId) {
      console.error('[SENTINEL] trackTwilioSMS appelé sans tenant_id');
      return null;
    }

    const cost = direction === 'outbound'
      ? CostMonitor.PRICING.twilio.smsOutbound
      : CostMonitor.PRICING.twilio.smsInbound;

    return this.trackCost(tenantId, 'twilio_sms', cost, { direction });
  }

  trackTwilioVoice(tenantId, minutes) {
    if (!tenantId) {
      console.error('[SENTINEL] trackTwilioVoice appelé sans tenant_id');
      return null;
    }

    const cost = minutes * CostMonitor.PRICING.twilio.voicePerMinute;
    return this.trackCost(tenantId, 'twilio_voice', cost, { minutes });
  }

  trackElevenLabs(tenantId, characters) {
    if (!tenantId) {
      console.error('[SENTINEL] trackElevenLabs appelé sans tenant_id');
      return null;
    }

    const cost = characters * CostMonitor.PRICING.elevenlabs.perCharacter;
    return this.trackCost(tenantId, 'elevenlabs', cost, { characters });
  }

  trackStripePayment(tenantId, amount) {
    if (!tenantId) {
      console.error('[SENTINEL] trackStripePayment appelé sans tenant_id');
      return null;
    }

    const cost = amount * CostMonitor.PRICING.stripe.percentage + CostMonitor.PRICING.stripe.fixed;
    return this.trackCost(tenantId, 'stripe', cost, { paymentAmount: amount });
  }

  trackGoogleMaps(tenantId, requests = 1) {
    if (!tenantId) {
      console.error('[SENTINEL] trackGoogleMaps appelé sans tenant_id');
      return null;
    }

    const cost = requests * CostMonitor.PRICING.googleMaps.perRequest;
    return this.trackCost(tenantId, 'google_maps', cost, { requests });
  }

  /**
   * Obtenir les coûts du jour pour un tenant
   * @param {string} tenantId - ID du tenant (OBLIGATOIRE)
   */
  getTodayCosts(tenantId) {
    if (!tenantId) {
      throw new Error('tenant_id requis pour getTodayCosts');
    }

    this.resetIfNewDay();
    this.initTenant(tenantId);

    const costs = this.tenantCosts[tenantId];
    let total = 0;
    const breakdown = {};

    for (const [service, data] of Object.entries(costs.daily)) {
      total += data.total;
      breakdown[service] = {
        total: Math.round(data.total * 100) / 100,
        calls: data.calls
      };
    }

    return {
      tenant_id: tenantId,
      date: this.currentDate,
      total: Math.round(total * 100) / 100,
      breakdown,
      status: this.getStatus(total),
      thresholds: THRESHOLDS.daily
    };
  }

  /**
   * Obtenir les coûts du mois pour un tenant
   * @param {string} tenantId - ID du tenant (OBLIGATOIRE)
   */
  getMonthCosts(tenantId) {
    if (!tenantId) {
      throw new Error('tenant_id requis pour getMonthCosts');
    }

    this.resetIfNewDay();
    this.initTenant(tenantId);

    const costs = this.tenantCosts[tenantId];
    let total = 0;
    const breakdown = {};

    for (const [service, data] of Object.entries(costs.monthly)) {
      total += data.total;
      breakdown[service] = {
        total: Math.round(data.total * 100) / 100,
        calls: data.calls
      };
    }

    return {
      tenant_id: tenantId,
      month: this.currentMonth,
      total: Math.round(total * 100) / 100,
      breakdown,
      status: this.getStatus(total, 'monthly'),
      thresholds: THRESHOLDS.monthly
    };
  }

  getStatus(total, period = 'daily') {
    const thresholds = period === 'monthly' ? THRESHOLDS.monthly : THRESHOLDS.daily;

    if (total >= thresholds.shutdown) return 'SHUTDOWN';
    if (total >= thresholds.critical) return 'CRITICAL';
    if (total >= thresholds.warning) return 'WARNING';
    return 'OK';
  }
}

export const costMonitor = new CostMonitor();
export default costMonitor;
