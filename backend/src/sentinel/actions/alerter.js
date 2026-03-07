/**
 * SENTINEL - Alerter
 *
 * Canaux: SMS (critique), Email (important), Dashboard (info)
 * Toutes les alertes sont persistées dans error_logs (via errorTracker)
 * pour cohérence avec l'onglet Erreurs du dashboard.
 * Numero SMS alertes critiques: 0760537694
 */

import { ALERT_PHONE } from '../config/thresholds.js';
import { captureMessage } from '../../services/errorTracker.js';

// Map alerter levels to error_logs levels
const LEVEL_MAP = { CRITICAL: 'fatal', URGENT: 'error', WARNING: 'warning', INFO: 'info' };

class Alerter {
  constructor() {
    this.alertHistory = [];
    this.lastAlertTime = {};
    this.cooldownMinutes = 5; // Minimum time between same alerts
  }

  async send(level, title, data = {}) {
    const alert = {
      id: Date.now().toString(36),
      level,
      title,
      data,
      timestamp: new Date().toISOString()
    };

    // Check cooldown to avoid spam
    const alertKey = `${level}:${title}`;
    const lastTime = this.lastAlertTime[alertKey];
    if (lastTime) {
      const minutesSince = (Date.now() - lastTime) / 1000 / 60;
      if (minutesSince < this.cooldownMinutes) {
        console.log(`[SENTINEL] Alert suppressed (cooldown): ${alertKey}`);
        return { sent: false, reason: 'cooldown' };
      }
    }

    this.lastAlertTime[alertKey] = Date.now();
    this.alertHistory.push(alert);

    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory = this.alertHistory.slice(-1000);
    }

    console.log(`[SENTINEL] ALERT ${level}: ${title}`, data);

    // Persist dans error_logs pour visibilité dans l'onglet Erreurs
    const errorLevel = LEVEL_MAP[level] || 'info';
    captureMessage(`[SENTINEL] ${title}`, errorLevel, {
      extra: { alertLevel: level, ...data },
    });

    // Send based on level
    switch (level) {
      case 'CRITICAL':
        await this.sendSMS(alert);
        break;
      case 'URGENT':
        await this.sendEmail(alert);
        break;
      case 'WARNING':
      case 'INFO':
        break;
    }

    return { sent: true, alert };
  }

  async sendSMS(alert) {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        console.log('[SENTINEL] SMS not configured, logging only');
        return { sent: false, reason: 'not_configured' };
      }

      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);

      const message = `[NEXUS ALERT] ${alert.level}\n${alert.title}\n${new Date().toLocaleString('fr-FR')}`;

      await client.messages.create({
        body: message.substring(0, 160), // SMS limit
        from: fromNumber,
        to: ALERT_PHONE.startsWith('+') ? ALERT_PHONE : `+33${ALERT_PHONE.substring(1)}`
      });

      console.log(`[SENTINEL] SMS sent to ${ALERT_PHONE}`);
      return { sent: true };
    } catch (error) {
      console.error('[SENTINEL] SMS failed:', error.message);
      return { sent: false, error: error.message };
    }
  }

  async sendEmail(alert) {
    try {
      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        console.log('[SENTINEL] Email not configured (RESEND_API_KEY missing)');
        return { sent: false, reason: 'not_configured' };
      }

      const alertEmail = process.env.SENTINEL_ALERT_EMAIL || process.env.ADMIN_EMAIL;
      if (!alertEmail) {
        console.log('[SENTINEL] No alert email configured (SENTINEL_ALERT_EMAIL or ADMIN_EMAIL)');
        return { sent: false, reason: 'no_recipient' };
      }

      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);

      const levelEmoji = { CRITICAL: '🔴', URGENT: '🟠', WARNING: '🟡', INFO: '🔵' }[alert.level] || '⚪';
      const subject = `${levelEmoji} [NEXUS SENTINEL] ${alert.level}: ${alert.title}`;

      const body = [
        `<h2>${levelEmoji} SENTINEL Alert — ${alert.level}</h2>`,
        `<p><strong>${alert.title}</strong></p>`,
        `<p>Date: ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p>`,
        alert.data && Object.keys(alert.data).length > 0
          ? `<pre>${JSON.stringify(alert.data, null, 2)}</pre>`
          : '',
        `<hr><p style="color:#888">NEXUS SENTINEL — Monitoring automatique</p>`
      ].join('\n');

      await resend.emails.send({
        from: 'NEXUS Sentinel <sentinel@nexus-app.fr>',
        to: alertEmail,
        subject,
        html: body
      });

      console.log(`[SENTINEL] Email sent to ${alertEmail}`);
      return { sent: true };
    } catch (error) {
      console.error('[SENTINEL] Email failed:', error.message);
      return { sent: false, error: error.message };
    }
  }

  getHistory(limit = 50) {
    return this.alertHistory.slice(-limit);
  }

  getByLevel(level) {
    return this.alertHistory.filter(a => a.level === level);
  }
}

export const alerter = new Alerter();
export default alerter;
