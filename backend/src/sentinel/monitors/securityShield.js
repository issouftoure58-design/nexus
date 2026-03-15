/**
 * SENTINEL - Security Shield
 *
 * Protection contre:
 * - Prompt injection
 * - Rate limiting abuse
 * - DDoS patterns
 * - Malicious IPs
 *
 * IP blacklist persiste en DB (survit aux restarts)
 */

import { THRESHOLDS } from '../config/thresholds.js';
import { supabase } from '../../config/supabase.js';
import { retryWithBackoff, isTransientError } from '../../utils/retryWithBackoff.js';

class SecurityShield {
  constructor() {
    this.blacklist = new Set();
    this.requestCounts = new Map();
    this.blockedRequests = [];

    // --- Threat Scoring ---
    this.threatScores = new Map(); // ip -> { score, events, lastUpdate }
    this._threatPersistTimer = null; // Debounce timer pour persistence

    // Points par type d'event
    this.THREAT_POINTS = {
      rate_limit_exceeded: 5,
      auth_failure: 8,
      invalid_input: 10,
      xss_attempt: 15,
      path_traversal_attempt: 15,
      sql_injection_attempt: 25,
      csrf_failure: 10,
      blocked_ip: 0,
      suspicious_activity: 12,
      account_locked: 20,
    };

    // Seuils d'escalation
    this.THREAT_THRESHOLDS = {
      warning: 30,
      critical: 60,
      blacklist: 100,
    };

    // Prompt injection patterns
    this.dangerousPatterns = [
      /ignore previous instructions/i,
      /ignore all previous/i,
      /you are now/i,
      /disregard your training/i,
      /reveal your prompt/i,
      /show me your system prompt/i,
      /what are your instructions/i,
      /forget everything/i,
      /new instructions:/i,
      /override:/i,
      /sudo/i,
      /admin mode/i,
      /developer mode/i,
      /jailbreak/i,
      /DAN mode/i
    ];
  }

  /**
   * Charge la blacklist depuis la DB (appele au demarrage)
   */
  async loadState() {
    try {
      const { data } = await supabase
        .from('sentinel_state')
        .select('value')
        .eq('key', 'ip_blacklist')
        .single();

      if (data?.value?.ips?.length > 0) {
        for (const ip of data.value.ips) {
          this.blacklist.add(ip);
        }
        console.log(`[SENTINEL] IP blacklist RESTORED: ${this.blacklist.size} IPs`);
      }

      // Charger les threatScores persistes
      const { data: threatData } = await supabase
        .from('sentinel_state')
        .select('value')
        .eq('key', 'threat_scores')
        .single();

      if (threatData?.value?.scores) {
        for (const [ip, entry] of Object.entries(threatData.value.scores)) {
          this.threatScores.set(ip, entry);
        }
        console.log(`[SENTINEL] Threat scores RESTORED: ${this.threatScores.size} IPs`);
      }
    } catch (err) {
      console.error('[SENTINEL] Failed to load state:', err.message);
    }
  }

  /**
   * Persiste la blacklist en DB
   */
  async _persistBlacklist() {
    try {
      await retryWithBackoff(
        () => supabase.from('sentinel_state').upsert({
          key: 'ip_blacklist',
          value: { ips: Array.from(this.blacklist) },
          updated_at: new Date().toISOString()
        }),
        { maxRetries: 2, label: 'persistBlacklist', shouldRetry: isTransientError }
      );
    } catch (err) {
      console.error('[SENTINEL] Failed to persist blacklist:', err.message);
    }
  }

  async _persistThreatScores() {
    try {
      const scores = {};
      for (const [ip, entry] of this.threatScores.entries()) {
        // Persister seulement les scores significatifs (>= 5 points)
        if (entry.score >= 5) {
          scores[ip] = { score: entry.score, events: entry.events.slice(-10), lastUpdate: entry.lastUpdate };
        }
      }
      await retryWithBackoff(
        () => supabase.from('sentinel_state').upsert({
          key: 'threat_scores',
          value: { scores },
          updated_at: new Date().toISOString()
        }),
        { maxRetries: 2, label: 'persistThreatScores', shouldRetry: isTransientError }
      );
    } catch (err) {
      console.error('[SENTINEL] Failed to persist threat scores:', err.message);
    }
  }

  analyze(request) {
    const result = {
      allowed: true,
      warnings: [],
      blocked: false,
      reason: null
    };

    // Check IP blacklist
    const ip = request.ip || request.headers?.['x-forwarded-for'] || 'unknown';
    if (this.blacklist.has(ip)) {
      result.allowed = false;
      result.blocked = true;
      result.reason = 'IP_BLACKLISTED';
      this.logBlocked(request, result.reason);
      return result;
    }

    // Check rate limits
    const rateCheck = this.checkRateLimit(ip);
    if (!rateCheck.allowed) {
      result.allowed = false;
      result.blocked = true;
      result.reason = rateCheck.reason;
      this.logBlocked(request, result.reason);

      // Auto-ban if too many violations
      if (rateCheck.violations > 10) {
        this.addToBlacklist(ip);
      }

      return result;
    }

    // Check for prompt injection (if message content available)
    const message = request.body?.message || request.body?.content || '';
    const injectionCheck = this.checkPromptInjection(message);
    if (injectionCheck.detected) {
      result.warnings.push('PROMPT_INJECTION_ATTEMPT');
      result.allowed = false;
      result.blocked = true;
      result.reason = 'PROMPT_INJECTION';
      this.logBlocked(request, result.reason, { pattern: injectionCheck.pattern });
      return result;
    }

    return result;
  }

  checkRateLimit(ip) {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const hour = Math.floor(now / 3600000);
    const day = Math.floor(now / 86400000);

    const key = `${ip}`;

    if (!this.requestCounts.has(key)) {
      this.requestCounts.set(key, {
        minute: { count: 0, window: minute },
        hour: { count: 0, window: hour },
        day: { count: 0, window: day },
        violations: 0
      });
    }

    const counts = this.requestCounts.get(key);

    // Reset windows if needed
    if (counts.minute.window !== minute) {
      counts.minute = { count: 0, window: minute };
    }
    if (counts.hour.window !== hour) {
      counts.hour = { count: 0, window: hour };
    }
    if (counts.day.window !== day) {
      counts.day = { count: 0, window: day };
      counts.violations = 0;
    }

    // Increment counts
    counts.minute.count++;
    counts.hour.count++;
    counts.day.count++;

    // Check limits
    if (counts.minute.count > THRESHOLDS.rateLimit.perMinute) {
      counts.violations++;
      return { allowed: false, reason: 'RATE_LIMIT_MINUTE', violations: counts.violations };
    }
    if (counts.hour.count > THRESHOLDS.rateLimit.perHour) {
      counts.violations++;
      return { allowed: false, reason: 'RATE_LIMIT_HOUR', violations: counts.violations };
    }
    if (counts.day.count > THRESHOLDS.rateLimit.perDay) {
      counts.violations++;
      return { allowed: false, reason: 'RATE_LIMIT_DAY', violations: counts.violations };
    }

    return { allowed: true };
  }

  checkPromptInjection(message) {
    if (!message || typeof message !== 'string') {
      return { detected: false };
    }

    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(message)) {
        return {
          detected: true,
          pattern: pattern.toString()
        };
      }
    }

    return { detected: false };
  }

  logBlocked(request, reason, details = {}) {
    const log = {
      timestamp: new Date().toISOString(),
      ip: request.ip || request.headers?.['x-forwarded-for'] || 'unknown',
      path: request.path || request.url,
      method: request.method,
      reason,
      details
    };

    this.blockedRequests.push(log);
    console.log(`[SENTINEL] Blocked request: ${reason}`, log);

    // Keep only last 1000 blocked requests
    if (this.blockedRequests.length > 1000) {
      this.blockedRequests.shift();
    }
  }

  addToBlacklist(ip) {
    this.blacklist.add(ip);
    console.log(`[SENTINEL] Added to blacklist: ${ip}`);
    this._persistBlacklist();
  }

  removeFromBlacklist(ip) {
    this.blacklist.delete(ip);
    console.log(`[SENTINEL] Removed from blacklist: ${ip}`);
    this._persistBlacklist();
  }

  getBlacklist() {
    return Array.from(this.blacklist);
  }

  getBlockedRequests(limit = 50) {
    return this.blockedRequests.slice(-limit);
  }

  getStats() {
    return {
      blacklistSize: this.blacklist.size,
      blockedTotal: this.blockedRequests.length,
      activeTracking: this.requestCounts.size,
      threatTracking: this.threatScores.size
    };
  }

  // --- Threat Scoring Methods ---

  recordThreatEvent(ip, eventType, severity) {
    if (!ip || ip === 'unknown') return;

    const points = this.THREAT_POINTS[eventType] || 5;
    const now = Date.now();

    if (!this.threatScores.has(ip)) {
      this.threatScores.set(ip, { score: 0, events: [], lastUpdate: now });
    }

    const entry = this.threatScores.get(ip);

    // Decay : diviser par 2 toutes les 6 heures
    const hoursSinceUpdate = (now - entry.lastUpdate) / 3600000;
    if (hoursSinceUpdate >= 6) {
      entry.score = entry.score / Math.pow(2, Math.floor(hoursSinceUpdate / 6));
    }

    entry.score += points;
    entry.lastUpdate = now;
    entry.events.push({ type: eventType, severity, time: new Date().toISOString() });

    // Garder max 50 events par IP
    if (entry.events.length > 50) entry.events = entry.events.slice(-50);

    // Auto-escalation
    if (entry.score >= this.THREAT_THRESHOLDS.blacklist && !this.blacklist.has(ip)) {
      this.addToBlacklist(ip);
      console.log(`[SENTINEL] THREAT: Auto-blacklisted ${ip} (score: ${entry.score})`);
      return { action: 'blacklisted', score: entry.score };
    }

    // Debounce la persistence (max 1 ecriture DB toutes les 30s)
    if (!this._threatPersistTimer) {
      this._threatPersistTimer = setTimeout(() => {
        this._persistThreatScores();
        this._threatPersistTimer = null;
      }, 30000);
    }

    return { score: entry.score, threshold: this.getNextThreshold(entry.score) };
  }

  getNextThreshold(score) {
    if (score < this.THREAT_THRESHOLDS.warning) return 'normal';
    if (score < this.THREAT_THRESHOLDS.critical) return 'warning';
    if (score < this.THREAT_THRESHOLDS.blacklist) return 'critical';
    return 'blacklisted';
  }

  getThreatReport() {
    const threats = [];
    const now = Date.now();

    for (const [ip, entry] of this.threatScores.entries()) {
      // Decay pour affichage
      const hoursSince = (now - entry.lastUpdate) / 3600000;
      const currentScore = hoursSince >= 6
        ? entry.score / Math.pow(2, Math.floor(hoursSince / 6))
        : entry.score;

      if (currentScore >= 5) {
        threats.push({
          ip,
          score: Math.round(currentScore),
          level: this.getNextThreshold(currentScore),
          recentEvents: entry.events.slice(-5),
          lastSeen: entry.events[entry.events.length - 1]?.time,
        });
      }
    }

    return threats
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  }

  // Nettoyage periodique (appele dans le health check)
  cleanupThreatScores() {
    const now = Date.now();
    const maxAge = 48 * 3600000; // 48h
    for (const [ip, entry] of this.threatScores.entries()) {
      if (now - entry.lastUpdate > maxAge) {
        this.threatScores.delete(ip);
      }
    }
  }
}

export const securityShield = new SecurityShield();
export default securityShield;
