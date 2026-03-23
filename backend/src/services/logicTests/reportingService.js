/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * PLTE v2 — Reporting Service
 * Genere des rapports structures apres chaque cycle PLTE
 * Alerte uniquement si problemes detectes (pas de spam si tout va bien)
 */

import { alerter } from '../../sentinel/actions/alerter.js';
import { PLTE_TENANTS } from './bootstrap.js';

/**
 * Genere un rapport pour un tenant apres un cycle
 */
export function generateReport(tenantId, runType, results, diagnostics) {
  if (!tenantId) throw new Error('tenant_id requis');

  const tenantName = PLTE_TENANTS[tenantId]?.name || tenantId;
  const profile = PLTE_TENANTS[tenantId]?.profile || 'unknown';

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const errors = results.filter(r => r.status === 'error').length;
  const total = results.length;

  const fixed = diagnostics.filter(d => d.category === 'FIXED');
  const diagnosed = diagnostics.filter(d => d.category === 'DIAGNOSED');
  const unknown = diagnostics.filter(d => d.category === 'UNKNOWN');

  const score = total > 0 ? Math.round((passed / total) * 100) : 100;

  return {
    tenantId,
    tenantName,
    profile,
    runType,
    timestamp: new Date().toISOString(),
    score,
    summary: { total, passed, failed, errors },
    diagnostics: {
      fixed: fixed.map(d => ({
        test_name: d.test_name,
        root_cause: d.root_cause,
        fix_applied: d.fix_applied,
      })),
      diagnosed: diagnosed.map(d => ({
        test_name: d.test_name,
        root_cause: d.root_cause,
        operator_action: d.operator_action,
      })),
      unknown: unknown.map(d => ({
        test_name: d.test_name,
        root_cause: d.root_cause,
      })),
    },
    counts: {
      fixed: fixed.length,
      diagnosed: diagnosed.length,
      unknown: unknown.length,
    },
  };
}

/**
 * Genere un rapport global agrege pour les 8 tenants
 */
export function generateGlobalReport(allReports) {
  if (!allReports?.length) return null;

  const avgScore = Math.round(
    allReports.reduce((s, r) => s + (r.score || 0), 0) / allReports.length
  );

  const totalTests = allReports.reduce((s, r) => s + r.summary.total, 0);
  const totalPassed = allReports.reduce((s, r) => s + r.summary.passed, 0);
  const totalFailed = allReports.reduce((s, r) => s + r.summary.failed, 0);

  const allFixed = allReports.flatMap(r =>
    r.diagnostics.fixed.map(d => ({ ...d, tenantName: r.tenantName }))
  );
  const allDiagnosed = allReports.flatMap(r =>
    r.diagnostics.diagnosed.map(d => ({ ...d, tenantName: r.tenantName }))
  );
  const allUnknown = allReports.flatMap(r =>
    r.diagnostics.unknown.map(d => ({ ...d, tenantName: r.tenantName }))
  );

  return {
    timestamp: new Date().toISOString(),
    runType: allReports[0]?.runType || 'unknown',
    globalScore: avgScore,
    tenantsCount: allReports.length,
    summary: {
      total: totalTests,
      passed: totalPassed,
      failed: totalFailed,
    },
    diagnostics: {
      fixed: allFixed,
      diagnosed: allDiagnosed,
      unknown: allUnknown,
    },
    counts: {
      fixed: allFixed.length,
      diagnosed: allDiagnosed.length,
      unknown: allUnknown.length,
    },
    tenantReports: allReports.map(r => ({
      tenantId: r.tenantId,
      tenantName: r.tenantName,
      profile: r.profile,
      score: r.score,
      failed: r.summary.failed,
      fixed: r.counts.fixed,
      diagnosed: r.counts.diagnosed,
      unknown: r.counts.unknown,
    })),
  };
}

/**
 * Determine si une alerte doit etre envoyee
 * Pas de spam si tout va bien — alerte uniquement sur vrais problemes
 */
export function shouldAlert(report) {
  if (!report) return false;

  const score = report.globalScore ?? report.score ?? 100;

  // Score >= 95% et pas d'inconnus → tout va bien, pas d'alerte
  if (score >= 95 && report.counts.unknown === 0) return false;

  // Alerter si:
  // - UNKNOWN > 0 (problemes non identifies — toujours alerter)
  // - Score global < 80% (degradation significative)
  // - Score < 95% et plus de 2 diagnosed (accumulation de problemes)
  return (
    report.counts.unknown > 0 ||
    score < 80 ||
    (score < 95 && report.counts.diagnosed > 2)
  );
}

/**
 * Envoie une alerte via le systeme d'alertes SENTINEL
 */
export async function sendAlert(report) {
  if (!report) return;

  const isGlobal = report.globalScore !== undefined;
  const score = isGlobal ? report.globalScore : report.score;
  const runTypeLabel = {
    hourly: 'Horaire',
    nightly: 'Nocturne',
    weekly: 'Hebdo',
    full: 'Complet',
  }[report.runType] || report.runType;

  // Formater le contenu du rapport
  const lines = [];
  lines.push(`Score ${score}% | ${report.summary.total} tests | ${report.summary.passed} pass | ${report.summary.failed} fail`);

  if (report.counts.fixed > 0) {
    lines.push('');
    lines.push(`FIXES AUTO (${report.counts.fixed}):`);
    for (const d of report.diagnostics.fixed.slice(0, 5)) {
      const tenant = d.tenantName ? `[${d.tenantName}]` : '';
      lines.push(`  + ${d.test_name} ${tenant} — ${d.fix_applied || d.root_cause}`);
    }
  }

  if (report.counts.diagnosed > 0) {
    lines.push('');
    lines.push(`DIAGNOSTIC (${report.counts.diagnosed}):`);
    for (const d of report.diagnostics.diagnosed.slice(0, 5)) {
      const tenant = d.tenantName ? `[${d.tenantName}]` : '';
      lines.push(`  ! ${d.test_name} ${tenant}`);
      lines.push(`    Cause: ${d.root_cause}`);
      if (d.operator_action) lines.push(`    Action: ${d.operator_action}`);
    }
  }

  if (report.counts.unknown > 0) {
    lines.push('');
    lines.push(`INCONNU (${report.counts.unknown}):`);
    for (const d of report.diagnostics.unknown.slice(0, 3)) {
      const tenant = d.tenantName ? `[${d.tenantName}]` : '';
      lines.push(`  ? ${d.test_name} ${tenant} — ${d.root_cause || 'Pas de cause identifiee'}`);
    }
  }

  const body = lines.join('\n');
  const title = `PLTE ${runTypeLabel} — Score ${score}%`;

  // Niveau d'alerte base sur la gravite
  // CRITICAL = action immediate requise, URGENT = a corriger bientot, WARNING = a surveiller
  const level = report.counts.unknown > 2 || score < 50
    ? 'CRITICAL'
    : score < 80
      ? 'URGENT'
      : 'WARNING';

  try {
    await alerter.send(level, title, {
      report_type: 'plte_diagnostic',
      run_type: report.runType,
      score,
      fixed: report.counts.fixed,
      diagnosed: report.counts.diagnosed,
      unknown: report.counts.unknown,
      body,
    });
  } catch (err) {
    console.error('[PLTE Report] Erreur envoi alerte:', err.message);
  }
}
