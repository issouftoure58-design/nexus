/**
 * SENTINEL - Operator Weekly Report
 *
 * Rapport hebdomadaire consolide pour l'operateur NEXUS:
 * - Score sante global (0-100)
 * - Top erreurs + tendances
 * - Incidents securite + menaces actives
 * - Evolution couts + projection
 * - Actions concretes priorisees
 */

import { supabase } from '../../config/supabase.js';
import { securityShield } from '../monitors/securityShield.js';
import { sendEmail } from '../../services/emailService.js';

/**
 * Genere le rapport hebdomadaire operateur
 */
export async function generateWeeklyReport() {
  const now = new Date();
  const since = new Date(now - 7 * 86400000);
  const sinceStr = since.toISOString();
  const prevWeekStart = new Date(now - 14 * 86400000).toISOString();

  // 1. Erreurs de la semaine
  const { data: errors } = await supabase
    .from('error_logs')
    .select('fingerprint, level, message, count, created_at')
    .gte('created_at', sinceStr)
    .order('created_at', { ascending: false });

  // Erreurs semaine precedente (pour comparaison)
  const { count: prevWeekErrorCount } = await supabase
    .from('error_logs')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', prevWeekStart)
    .lt('created_at', sinceStr);

  // 2. Securite
  const { data: secLogs } = await supabase
    .from('sentinel_security_logs')
    .select('event_type, severity, ip_address, created_at')
    .gte('created_at', sinceStr);

  // 3. Couts
  const { data: costs } = await supabase
    .from('sentinel_daily_costs')
    .select('date, total_cost_eur, anthropic_cost, twilio_cost, email_cost')
    .gte('date', since.toISOString().split('T')[0]);

  // 4. Threat report (in-memory)
  const threatReport = securityShield.getThreatReport();

  // --- Construire le rapport ---

  // Erreurs: top 5 fingerprints
  const errorsByFp = {};
  for (const err of (errors || [])) {
    const fp = err.fingerprint || err.message;
    if (!errorsByFp[fp]) {
      errorsByFp[fp] = { fingerprint: fp, message: err.message, count: 0, level: err.level };
    }
    errorsByFp[fp].count += (err.count || 1);
  }
  const topErrors = Object.values(errorsByFp)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const totalErrors = errors?.length || 0;
  const errorTrend = prevWeekErrorCount > 0
    ? Math.round(((totalErrors - prevWeekErrorCount) / prevWeekErrorCount) * 100)
    : 0;

  // Securite: par severite
  const secBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const secByType = {};
  const suspiciousIPs = {};
  for (const log of (secLogs || [])) {
    secBySeverity[log.severity] = (secBySeverity[log.severity] || 0) + 1;
    secByType[log.event_type] = (secByType[log.event_type] || 0) + 1;
    if (log.severity === 'high' || log.severity === 'critical') {
      suspiciousIPs[log.ip_address] = (suspiciousIPs[log.ip_address] || 0) + 1;
    }
  }

  // Couts: total + projection
  const totalCost = (costs || []).reduce((s, c) => s + (c.total_cost_eur || 0), 0);
  const daysWithData = costs?.length || 1;
  const avgDailyCost = totalCost / daysWithData;
  const monthlyProjection = Math.round(avgDailyCost * 30 * 100) / 100;

  // Score sante (0-100)
  let healthScore = 100;
  // Penalites erreurs
  if (totalErrors > 50) healthScore -= 20;
  else if (totalErrors > 20) healthScore -= 10;
  else if (totalErrors > 5) healthScore -= 5;
  // Penalites securite
  healthScore -= Math.min(secBySeverity.critical * 10, 30);
  healthScore -= Math.min(secBySeverity.high * 5, 15);
  // Penalite menaces actives
  const activeThreatCount = threatReport.filter(t => t.level === 'critical').length;
  healthScore -= Math.min(activeThreatCount * 10, 20);
  healthScore = Math.max(0, healthScore);

  // Actions concretes
  const actions = buildActionItems(topErrors, secBySeverity, suspiciousIPs, costs, threatReport, errorTrend);

  const report = {
    generatedAt: now.toISOString(),
    period: { from: sinceStr, to: now.toISOString() },
    healthScore,
    errors: {
      total: totalErrors,
      trendPercent: errorTrend,
      topErrors,
    },
    security: {
      totalIncidents: secLogs?.length || 0,
      bySeverity: secBySeverity,
      byType: secByType,
      activeThreats: threatReport.length,
      topThreats: threatReport.slice(0, 5),
    },
    costs: {
      totalWeek: Math.round(totalCost * 100) / 100,
      avgDaily: Math.round(avgDailyCost * 100) / 100,
      monthlyProjection,
      dailyBreakdown: costs || [],
    },
    actions,
  };

  return report;
}

/**
 * Genere les actions concretes priorisees
 */
function buildActionItems(topErrors, secBySeverity, suspiciousIPs, costs, threatReport, errorTrend) {
  const actions = [];
  let priority = 1;

  // Erreurs recurrentes critiques
  for (const err of topErrors) {
    if (err.count >= 10) {
      actions.push({
        priority: priority++,
        severity: err.level === 'fatal' ? 'critical' : 'high',
        action: `Investiguer erreur recurrente: ${err.message.substring(0, 80)}`,
        detail: `Fingerprint: ${err.fingerprint}, ${err.count} occurrences cette semaine`,
      });
    }
  }

  // Menaces actives a score critique
  for (const threat of threatReport) {
    if (threat.score >= 60) {
      actions.push({
        priority: priority++,
        severity: 'critical',
        action: `Bloquer IP ${threat.ip} (score menace: ${threat.score})`,
        detail: `Derniere activite: ${threat.lastSeen}, ${threat.recentEvents.length} events recents`,
      });
    }
  }

  // Incidents securite critiques
  if (secBySeverity.critical > 0) {
    actions.push({
      priority: priority++,
      severity: 'critical',
      action: `${secBySeverity.critical} incident(s) securite critique(s) cette semaine`,
      detail: 'Consulter SENTINEL > Securite pour les details',
    });
  }

  // Tendance erreurs
  if (errorTrend > 20) {
    actions.push({
      priority: priority++,
      severity: 'warning',
      action: `Erreurs en hausse de ${errorTrend}% vs semaine precedente`,
      detail: 'Verifier les deployments recents et les changements de configuration',
    });
  }

  // Couts en hausse
  if (costs?.length >= 2) {
    const recent = costs.slice(-3);
    const older = costs.slice(0, 3);
    const avgRecent = recent.reduce((s, c) => s + (c.total_cost_eur || 0), 0) / recent.length;
    const avgOlder = older.reduce((s, c) => s + (c.total_cost_eur || 0), 0) / older.length;
    if (avgOlder > 0 && ((avgRecent - avgOlder) / avgOlder) > 0.2) {
      const increase = Math.round(((avgRecent - avgOlder) / avgOlder) * 100);
      actions.push({
        priority: priority++,
        severity: 'warning',
        action: `Cout en hausse de ${increase}% — verifier usage API tenants`,
        detail: `Moyenne recente: ${avgRecent.toFixed(2)}€/jour vs ${avgOlder.toFixed(2)}€/jour`,
      });
    }
  }

  // IPs suspectes non encore blacklistees
  const topSuspicious = Object.entries(suspiciousIPs)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  for (const [ip, count] of topSuspicious) {
    if (count >= 5 && !threatReport.some(t => t.ip === ip && t.score >= 60)) {
      actions.push({
        priority: priority++,
        severity: 'medium',
        action: `Surveiller IP ${ip} (${count} incidents high/critical)`,
        detail: 'Envisager un blocage manuel si l\'activite persiste',
      });
    }
  }

  // Tout va bien
  if (actions.length === 0) {
    actions.push({
      priority: 1,
      severity: 'info',
      action: 'Aucune action requise — systeme stable',
      detail: 'Tous les indicateurs sont dans les seuils normaux',
    });
  }

  return actions;
}

/**
 * Genere et envoie le rapport par email
 */
export async function generateAndSendReport() {
  const report = await generateWeeklyReport();

  // Envoyer par email a l'operateur
  const operatorEmail = process.env.NEXUS_SUPERADMIN_EMAIL;
  if (!operatorEmail) {
    console.log('[SENTINEL] No operator email configured, skipping report email');
    return report;
  }

  const actionsHtml = report.actions
    .map(a => `<tr>
      <td style="padding:4px 8px;border:1px solid #ddd">${a.priority}</td>
      <td style="padding:4px 8px;border:1px solid #ddd"><strong style="color:${a.severity === 'critical' ? '#dc2626' : a.severity === 'high' ? '#ea580c' : a.severity === 'warning' ? '#d97706' : '#059669'}">${a.severity.toUpperCase()}</strong></td>
      <td style="padding:4px 8px;border:1px solid #ddd">${a.action}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;color:#666">${a.detail}</td>
    </tr>`)
    .join('');

  const html = `
    <div style="font-family:sans-serif;max-width:700px;margin:0 auto">
      <h1 style="color:#1e293b">SENTINEL — Rapport Hebdomadaire</h1>
      <p style="color:#64748b">Periode: ${new Date(report.period.from).toLocaleDateString('fr-FR')} - ${new Date(report.period.to).toLocaleDateString('fr-FR')}</p>

      <div style="background:${report.healthScore >= 80 ? '#dcfce7' : report.healthScore >= 50 ? '#fef9c3' : '#fecaca'};padding:16px;border-radius:8px;margin:16px 0;text-align:center">
        <div style="font-size:48px;font-weight:bold;color:${report.healthScore >= 80 ? '#166534' : report.healthScore >= 50 ? '#854d0e' : '#991b1b'}">${report.healthScore}/100</div>
        <div style="color:#64748b">Score de sante</div>
      </div>

      <h2>Erreurs</h2>
      <p>${report.errors.total} erreurs (${report.errors.trendPercent > 0 ? '+' : ''}${report.errors.trendPercent}% vs semaine precedente)</p>

      <h2>Securite</h2>
      <p>${report.security.totalIncidents} incidents — ${report.security.bySeverity.critical} critiques, ${report.security.bySeverity.high} high</p>
      <p>${report.security.activeThreats} menace(s) active(s)</p>

      <h2>Couts</h2>
      <p>Total semaine: ${report.costs.totalWeek}€ — Projection mensuelle: ${report.costs.monthlyProjection}€</p>

      <h2>Actions Requises</h2>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:4px 8px;border:1px solid #ddd">#</th>
          <th style="padding:4px 8px;border:1px solid #ddd">Severite</th>
          <th style="padding:4px 8px;border:1px solid #ddd">Action</th>
          <th style="padding:4px 8px;border:1px solid #ddd">Detail</th>
        </tr></thead>
        <tbody>${actionsHtml}</tbody>
      </table>

      <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0">
      <p style="color:#94a3b8;font-size:12px">SENTINEL — Genere automatiquement le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}</p>
    </div>
  `;

  try {
    await sendEmail({
      to: operatorEmail,
      subject: `[SENTINEL] Rapport Hebdo — Score ${report.healthScore}/100`,
      html,
    });
    console.log('[SENTINEL] Weekly report sent to', operatorEmail);
  } catch (err) {
    console.error('[SENTINEL] Failed to send weekly report:', err.message);
  }

  return report;
}
