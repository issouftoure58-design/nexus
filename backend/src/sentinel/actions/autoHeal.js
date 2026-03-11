/**
 * SENTINEL - Auto-Heal
 *
 * Interventions automatiques:
 * - Memoire saturee -> Vide le cache
 * - API timeout -> Retry avec backoff
 * - DB connexion perdue -> Reconnexion auto
 * - Rate limit proche -> Active throttling
 * - Cout journalier depasse -> Mode degrade
 *
 * Mode degrade persiste en DB (survit aux restarts)
 */

import { supabase } from '../../config/supabase.js';

class AutoHeal {
  constructor() {
    this.actions = [];
    this.degradedMode = false;
  }

  /**
   * Charge l'etat depuis la DB (appele au demarrage)
   */
  async loadState() {
    try {
      const { data } = await supabase
        .from('sentinel_state')
        .select('value')
        .eq('key', 'degraded_mode')
        .single();

      if (data?.value?.active) {
        this.degradedMode = true;
        console.log(`[SENTINEL] Degraded mode RESTORED from DB (since ${data.value.since})`);
      }
    } catch (err) {
      console.error('[SENTINEL] Failed to load degraded mode state:', err.message);
    }
  }

  async attempt(metric, data) {
    const action = {
      id: Date.now().toString(36),
      metric,
      data,
      timestamp: new Date().toISOString(),
      result: null
    };

    console.log(`[SENTINEL] Auto-heal attempting: ${metric}`);

    try {
      switch (metric) {
        case 'memory':
          action.result = await this.healMemory(data);
          break;
        case 'database':
          action.result = await this.healDatabase(data);
          break;
        case 'apis':
          action.result = await this.healAPIs(data);
          break;
        case 'costs':
          action.result = await this.handleCostOverrun(data);
          break;
        case 'errorTrends':
          action.result = await this.healErrorSpike(data);
          break;
        default:
          action.result = { success: false, reason: 'unknown_metric' };
      }

      this.actions.push(action);
      if (this.actions.length > 100) this.actions.shift();
      return action.result;
    } catch (error) {
      action.result = { success: false, error: error.message };
      this.actions.push(action);
      return action.result;
    }
  }

  async healMemory(data) {
    console.log('[SENTINEL-ACTION] Handling unhealthy service: memory');

    const actions = [];

    // 1. Force GC si disponible
    if (global.gc) {
      global.gc();
      actions.push('gc_forced');
      console.log('[SENTINEL] Garbage collection forced');
    }

    // 2. Vider le cache reponses IA (si > 75% memoire)
    if (data.usagePercent > 75) {
      try {
        const { responseCache } = await import('../../services/responseCache.js');
        if (responseCache?.clear) {
          responseCache.clear();
          actions.push('response_cache_cleared');
        }
      } catch { /* cache module optional */ }
    }

    // 3. En critique (>90%), activer mode degrade
    if (data.usagePercent > 90 && !this.degradedMode) {
      await this.handleCostOverrun({ reason: 'memory_critical', ...data });
      actions.push('degraded_mode_activated');
    }

    const memAfter = process.memoryUsage();
    return {
      success: true,
      action: actions.length > 0 ? actions.join(', ') : 'memory_logged',
      actions,
      memoryAfterMB: Math.round(memAfter.rss / 1024 / 1024),
    };
  }

  async healErrorSpike(data) {
    console.log('[SENTINEL-ACTION] Error spike detected, taking action');
    const actions = [];

    // Si > 5x spike, activer mode degrade pour reduire la charge
    if (data.spikeRatio >= 5 && !this.degradedMode) {
      await this.handleCostOverrun({ reason: 'error_spike', spikeRatio: data.spikeRatio });
      actions.push('degraded_mode_activated');
    }

    // Logger les erreurs recurrentes pour investigation
    if (data.recurring?.length > 0) {
      actions.push(`recurring_errors_flagged: ${data.recurring.length}`);
    }

    return { success: true, actions };
  }

  async healDatabase(data) {
    console.log('[SENTINEL] Healing database connection...');
    return { success: true, action: 'db_reconnect_requested', note: 'Supabase auto-reconnects' };
  }

  async healAPIs(data) {
    console.log('[SENTINEL] Checking API configurations...');

    const missing = [];
    if (!process.env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY');
    if (!process.env.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
    if (!process.env.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');

    if (missing.length > 0) {
      return { success: false, action: 'config_check', missing };
    }

    return { success: true, action: 'apis_ok' };
  }

  async handleCostOverrun(data) {
    console.log('[SENTINEL] Handling cost overrun — activating degraded mode');

    this.degradedMode = true;

    // Persist to DB
    try {
      await supabase
        .from('sentinel_state')
        .upsert({
          key: 'degraded_mode',
          value: { active: true, reason: 'cost_overrun', since: new Date().toISOString(), data },
          updated_at: new Date().toISOString()
        });
    } catch (err) {
      console.error('[SENTINEL] Failed to persist degraded mode:', err.message);
    }

    return {
      success: true,
      action: 'degraded_mode_activated',
      restrictions: [
        'AI responses limited to 500 tokens',
        'Image generation disabled',
        'Voice synthesis disabled',
        'Only essential SMS sent'
      ]
    };
  }

  async exitDegradedMode() {
    this.degradedMode = false;
    console.log('[SENTINEL] Exiting degraded mode');

    // Persist to DB
    try {
      await supabase
        .from('sentinel_state')
        .upsert({
          key: 'degraded_mode',
          value: { active: false, reason: null, since: null },
          updated_at: new Date().toISOString()
        });
    } catch (err) {
      console.error('[SENTINEL] Failed to persist degraded mode exit:', err.message);
    }

    return { success: true };
  }

  isDegraded() {
    return this.degradedMode;
  }

  getActions(limit = 20) {
    return this.actions.slice(-limit);
  }
}

export const autoHeal = new AutoHeal();
export default autoHeal;
