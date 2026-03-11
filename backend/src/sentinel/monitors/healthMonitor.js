/**
 * SENTINEL - Health Monitor
 *
 * Surveille: Uptime, memoire, CPU, connexions DB, APIs externes
 * Priorite #1 - Le plus critique
 */

import { supabase } from '../../config/supabase.js';

class HealthMonitor {
  constructor() {
    this.lastResults = null;
    this.history = [];
    this.maxHistorySize = 20; // Réduit de 100 à 20 pour économiser la mémoire
  }

  async check() {
    const results = {
      timestamp: new Date().toISOString(),
      memory: await this.checkMemory(),
      database: await this.checkDatabase(),
      apis: await this.checkExternalAPIs(),
      uptime: this.checkUptime(),
      errorTrends: await this.checkErrorTrends()
    };

    this.lastResults = results;
    this.history.push(results);

    // Keep only last N checks (économie mémoire)
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize);
    }

    return results;
  }

  async checkMemory() {
    const used = process.memoryUsage();
    const rssMB = Math.round(used.rss / 1024 / 1024);
    const memLimitMB = parseInt(process.env.MEMORY_LIMIT_MB || '512', 10);
    const usagePercent = Math.round((rssMB / memLimitMB) * 100);

    let status = 'OK';
    if (usagePercent > 90) status = 'CRITICAL';
    else if (usagePercent > 75) status = 'WARNING';

    return {
      status,
      rssMB,
      memLimitMB,
      usagePercent,
      heapUsedMB: Math.round(used.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(used.heapTotal / 1024 / 1024)
    };
  }

  async checkDatabase() {
    if (!supabase) {
      return { status: 'WARNING', message: 'Supabase not configured' };
    }

    // Retry 1 fois avant de declarer CRITICAL (evite faux positifs reseau)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const startTime = Date.now();
        const { error } = await supabase.from('services').select('id').limit(1);
        const latency = Date.now() - startTime;

        if (error) {
          if (attempt === 0) { await new Promise(r => setTimeout(r, 2000)); continue; }
          return { status: 'CRITICAL', message: error.message, latency };
        }

        let status = 'OK';
        if (latency > 2000) status = 'CRITICAL';
        else if (latency > 1000) status = 'WARNING';

        return { status, latency, message: 'Connected' };
      } catch (error) {
        if (attempt === 0) { await new Promise(r => setTimeout(r, 2000)); continue; }
        return { status: 'CRITICAL', message: error.message };
      }
    }
  }

  async checkExternalAPIs() {
    const apis = {};

    // Check Anthropic API
    apis.anthropic = {
      status: process.env.ANTHROPIC_API_KEY ? 'OK' : 'WARNING',
      configured: !!process.env.ANTHROPIC_API_KEY
    };

    // Check Twilio
    apis.twilio = {
      status: process.env.TWILIO_ACCOUNT_SID ? 'OK' : 'WARNING',
      configured: !!process.env.TWILIO_ACCOUNT_SID
    };

    // Check Stripe
    apis.stripe = {
      status: process.env.STRIPE_SECRET_KEY ? 'OK' : 'WARNING',
      configured: !!process.env.STRIPE_SECRET_KEY
    };

    // Check Google Maps
    apis.googleMaps = {
      status: process.env.GOOGLE_MAPS_API_KEY ? 'OK' : 'WARNING',
      configured: !!process.env.GOOGLE_MAPS_API_KEY
    };

    return apis;
  }

  checkUptime() {
    const uptimeSeconds = process.uptime();
    const uptimeHours = Math.round(uptimeSeconds / 3600 * 100) / 100;

    return {
      status: 'OK',
      seconds: Math.round(uptimeSeconds),
      hours: uptimeHours,
      started: new Date(Date.now() - uptimeSeconds * 1000).toISOString()
    };
  }

  async checkErrorTrends() {
    if (!supabase) return { status: 'OK', message: 'No DB' };

    try {
      const now = new Date();
      const fourHoursAgo = new Date(now - 4 * 3600000).toISOString();
      const twentyFourHoursAgo = new Date(now - 24 * 3600000).toISOString();

      // Erreurs des 4 dernieres heures (exclure les alertes SENTINEL pour eviter feedback loop)
      const { data: recentErrors } = await supabase
        .from('error_logs')
        .select('fingerprint, level, message, created_at')
        .gte('created_at', fourHoursAgo)
        .not('message', 'like', '%[SENTINEL]%')
        .not('message', 'like', '%dynamically imported module%');

      // Baseline: erreurs des 24 dernieres heures (pour moyenne horaire)
      const { count: dayCount } = await supabase
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', twentyFourHoursAgo)
        .not('message', 'like', '%[SENTINEL]%')
        .not('message', 'like', '%dynamically imported module%');

      const recentCount = recentErrors?.length || 0;
      const avgPerHour = (dayCount || 0) / 24;
      const recentPerHour = recentCount / 4;
      const ratio = avgPerHour > 0 ? recentPerHour / avgPerHour : 0;

      // Detecter erreurs recurrentes (meme fingerprint > 5x en 4h)
      const fingerprints = {};
      for (const err of (recentErrors || [])) {
        const fp = err.fingerprint || err.message;
        fingerprints[fp] = (fingerprints[fp] || 0) + 1;
      }
      const recurring = Object.entries(fingerprints)
        .filter(([, count]) => count >= 5)
        .map(([fp, count]) => ({ fingerprint: fp, count }));

      let status = 'OK';
      if (ratio >= 5 || recurring.length >= 3) status = 'CRITICAL';
      else if (ratio >= 3 || recurring.length >= 1) status = 'WARNING';

      return {
        status,
        recentCount,
        avgPerHour: Math.round(avgPerHour * 10) / 10,
        recentPerHour: Math.round(recentPerHour * 10) / 10,
        spikeRatio: Math.round(ratio * 10) / 10,
        recurring,
      };
    } catch (error) {
      return { status: 'OK', message: error.message };
    }
  }

  getLastResults() {
    return this.lastResults;
  }

  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }
}

export const healthMonitor = new HealthMonitor();
export default healthMonitor;
