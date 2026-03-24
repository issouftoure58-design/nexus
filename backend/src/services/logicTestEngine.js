/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * PLTE v2 — Platform Logic Test Engine
 * 8 tenants autonomes multi-profil avec self-healing
 */

import { supabase } from '../config/supabase.js';
import { ensurePlteTenantsReady, PLTE_TENANT_IDS, PLTE_TENANTS } from './logicTests/bootstrap.js';
import { runHourlyTests } from './logicTests/hourlyTests.js';
import { runNightlyTests } from './logicTests/nightlyTests.js';
import { runWeeklyTests } from './logicTests/weeklyTests.js';
import { runE2ETests } from './logicTests/e2eTests.js';
import { runDiagnostics } from './logicTests/diagnosticEngine.js';
import { generateReport, generateGlobalReport, shouldAlert, sendAlert } from './logicTests/reportingService.js';

// Poids par severite pour calcul score
const SEVERITY_WEIGHTS = {
  critical: 10,
  warning: 3,
  info: 1,
};

class LogicTestEngine {
  constructor() {
    this.isRunning = false;
  }

  // ============================================
  // SCORE CALCULATION
  // ============================================

  calculateHealthScore(results) {
    if (!results || results.length === 0) return 100;

    let totalWeight = 0;
    let failedWeight = 0;

    for (const r of results) {
      const w = SEVERITY_WEIGHTS[r.severity] || 1;
      totalWeight += w;
      if (r.status === 'fail' || r.status === 'error') {
        failedWeight += w;
      }
    }

    if (totalWeight === 0) return 100;
    return Math.max(0, Math.round((1 - failedWeight / totalWeight) * 100 * 100) / 100);
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  async upsertTest(tenantId, test) {
    if (!tenantId) throw new Error('tenant_id requis');

    const { data: existing } = await supabase
      .from('sentinel_logic_tests')
      .select('id, fail_count, pass_count')
      .eq('tenant_id', tenantId)
      .eq('name', test.name)
      .single();

    const now = new Date().toISOString();
    const isPass = test.status === 'pass';

    if (existing) {
      const updateData = {
        last_status: test.status,
        last_run_at: now,
        last_error: test.error || null,
        fail_count: isPass ? existing.fail_count : existing.fail_count + 1,
        pass_count: isPass ? existing.pass_count + 1 : existing.pass_count,
      };

      // Diagnostic columns
      if (test.auto_fixed !== undefined) {
        updateData.auto_fixed = test.auto_fixed;
        updateData.fix_description = test.fix_description || null;
      }
      if (test.diagnosis_category) {
        updateData.diagnosis_category = test.diagnosis_category;
        updateData.root_cause = test.root_cause || null;
        updateData.operator_action = test.operator_action || null;
      }

      await supabase
        .from('sentinel_logic_tests')
        .update(updateData)
        .eq('id', existing.id)
        .eq('tenant_id', tenantId);
    } else {
      const insertData = {
        tenant_id: tenantId,
        category: test.category,
        module: test.module,
        name: test.name,
        description: test.description,
        severity: test.severity,
        last_status: test.status,
        last_run_at: now,
        last_error: test.error || null,
        fail_count: isPass ? 0 : 1,
        pass_count: isPass ? 1 : 0,
      };

      if (test.auto_fixed !== undefined) {
        insertData.auto_fixed = test.auto_fixed;
        insertData.fix_description = test.fix_description || null;
      }
      if (test.diagnosis_category) {
        insertData.diagnosis_category = test.diagnosis_category;
        insertData.root_cause = test.root_cause || null;
        insertData.operator_action = test.operator_action || null;
      }

      await supabase
        .from('sentinel_logic_tests')
        .insert(insertData);
    }
  }

  async saveRun(tenantId, runType, results, startedAt, diagnostics = []) {
    if (!tenantId) throw new Error('tenant_id requis');

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const errors = results.filter(r => r.status === 'error').length;
    const autoFixed = results.filter(r => r.auto_fixed).length;
    const healthScore = this.calculateHealthScore(results);

    const diagnosticsFixed = diagnostics.filter(d => d.category === 'FIXED').length;
    const diagnosticsDiagnosed = diagnostics.filter(d => d.category === 'DIAGNOSED').length;
    const diagnosticsUnknown = diagnostics.filter(d => d.category === 'UNKNOWN').length;

    const { data } = await supabase
      .from('sentinel_logic_runs')
      .insert({
        tenant_id: tenantId,
        run_type: runType,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        total_tests: results.length,
        passed,
        failed,
        errors,
        health_score: healthScore,
        results: JSON.stringify(results),
        diagnostics_fixed: diagnosticsFixed,
        diagnostics_diagnosed: diagnosticsDiagnosed,
        diagnostics_unknown: diagnosticsUnknown,
        diagnostic_report: JSON.stringify(diagnostics),
      })
      .select('id')
      .single();

    return {
      runId: data?.id, healthScore, passed, failed, errors, autoFixed, total: results.length,
      diagnosticsFixed, diagnosticsDiagnosed, diagnosticsUnknown,
    };
  }

  // ============================================
  // RUN METHODS — MULTI-TENANT PLTE v2
  // ============================================

  async runHourly() {
    if (this.isRunning) {
      console.log('[PLTE] Already running, skipping');
      return [];
    }
    this.isRunning = true;

    try {
      console.log('[PLTE v2] Running hourly tests for 8 PLTE tenants...');
      const contexts = await ensurePlteTenantsReady();
      const allRuns = [];

      const allReports = [];

      for (const ctx of Object.values(contexts)) {
        try {
          const startedAt = new Date().toISOString();
          const results = await runHourlyTests(ctx);

          // Diagnostic Engine (remplace self-healing)
          const diagnostics = await runDiagnostics(ctx.tenantId, results);

          // Persister
          for (const r of results) {
            await this.upsertTest(ctx.tenantId, r);
          }

          const run = await this.saveRun(ctx.tenantId, 'hourly', results, startedAt, diagnostics);
          allRuns.push({ tenantId: ctx.tenantId, profile: ctx.profile, ...run, fixes: run.diagnosticsFixed });

          // Generer rapport tenant
          const report = generateReport(ctx.tenantId, 'hourly', results, diagnostics);
          allReports.push(report);

          console.log(`[PLTE v2] ${ctx.tenantId} (${ctx.profile}): ${run.healthScore}% — ${run.passed}P/${run.failed}F/${run.errors}E [${run.diagnosticsFixed}fix/${run.diagnosticsDiagnosed}diag/${run.diagnosticsUnknown}unk]`);
        } catch (err) {
          console.error(`[PLTE v2] Hourly error for ${ctx.tenantId}:`, err.message);
        }

        // Throttle
        await new Promise(r => setTimeout(r, 500));
      }

      // Rapport global + alerte si necessaire
      const globalReport = generateGlobalReport(allReports);
      if (globalReport && shouldAlert(globalReport)) {
        await sendAlert(globalReport);
      }

      this.logGlobalScore(allRuns, 'hourly');
      return allRuns;
    } finally {
      this.isRunning = false;
    }
  }

  async runNightly() {
    if (this.isRunning) {
      console.log('[PLTE] Already running, skipping');
      return [];
    }
    this.isRunning = true;

    try {
      console.log('[PLTE v2] Running nightly stress tests for 8 PLTE tenants...');
      const contexts = await ensurePlteTenantsReady();
      const allRuns = [];

      const allReports = [];

      for (const ctx of Object.values(contexts)) {
        try {
          const startedAt = new Date().toISOString();
          const results = await runNightlyTests(ctx);

          // Diagnostic Engine
          const diagnostics = await runDiagnostics(ctx.tenantId, results);

          for (const r of results) {
            await this.upsertTest(ctx.tenantId, r);
          }

          const run = await this.saveRun(ctx.tenantId, 'nightly', results, startedAt, diagnostics);
          allRuns.push({ tenantId: ctx.tenantId, profile: ctx.profile, ...run });

          const report = generateReport(ctx.tenantId, 'nightly', results, diagnostics);
          allReports.push(report);

          console.log(`[PLTE v2] Nightly ${ctx.tenantId}: ${run.healthScore}% — ${run.passed}P/${run.failed}F [${run.diagnosticsFixed}fix/${run.diagnosticsDiagnosed}diag]`);
        } catch (err) {
          console.error(`[PLTE v2] Nightly error for ${ctx.tenantId}:`, err.message);
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      // Rapport global + alerte
      const globalReport = generateGlobalReport(allReports);
      if (globalReport && shouldAlert(globalReport)) {
        await sendAlert(globalReport);
      }

      this.logGlobalScore(allRuns, 'nightly');
      return allRuns;
    } finally {
      this.isRunning = false;
    }
  }

  async runWeekly() {
    if (this.isRunning) {
      console.log('[PLTE] Already running, skipping');
      return [];
    }
    this.isRunning = true;

    try {
      console.log('[PLTE v2] Running weekly IA tests...');
      const contexts = await ensurePlteTenantsReady();
      const allRuns = [];

      // 1 tenant par profil en rotation
      const profiles = [...new Set(Object.values(PLTE_TENANTS).map(t => t.profile))];
      const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));

      const allReports = [];

      for (const ctx of Object.values(contexts)) {
        // Rotation: chaque semaine un profil different pour les tests IA lourds
        const profileIndex = profiles.indexOf(ctx.profile);
        if (profileIndex === -1) continue;

        try {
          const startedAt = new Date().toISOString();
          const results = await runWeeklyTests(ctx);

          const diagnostics = await runDiagnostics(ctx.tenantId, results);

          for (const r of results) {
            await this.upsertTest(ctx.tenantId, r);
          }

          const run = await this.saveRun(ctx.tenantId, 'weekly', results, startedAt, diagnostics);
          allRuns.push({ tenantId: ctx.tenantId, profile: ctx.profile, ...run });

          const report = generateReport(ctx.tenantId, 'weekly', results, diagnostics);
          allReports.push(report);

          console.log(`[PLTE v2] Weekly ${ctx.tenantId}: ${run.healthScore}% — ${run.passed}P/${run.failed}F`);
        } catch (err) {
          console.error(`[PLTE v2] Weekly error for ${ctx.tenantId}:`, err.message);
        }
        await new Promise(r => setTimeout(r, 2000));
      }

      const globalReport = generateGlobalReport(allReports);
      if (globalReport && shouldAlert(globalReport)) {
        await sendAlert(globalReport);
      }

      this.logGlobalScore(allRuns, 'weekly');
      return allRuns;
    } finally {
      this.isRunning = false;
    }
  }

  async runFull() {
    console.log('[PLTE v2] Running FULL suite (hourly + nightly + weekly)...');

    // Pas de lock isRunning ici car les sous-methodes le gerent pas directement
    const contexts = await ensurePlteTenantsReady();
    const allRuns = [];
    const allReports = [];

    for (const ctx of Object.values(contexts)) {
      try {
        const startedAt = new Date().toISOString();
        const allResults = [];

        const hourlyResults = await runHourlyTests(ctx);
        allResults.push(...hourlyResults);

        const nightlyResults = await runNightlyTests(ctx);
        allResults.push(...nightlyResults);

        const weeklyResults = await runWeeklyTests(ctx);
        allResults.push(...weeklyResults);

        // Diagnostic Engine
        const diagnostics = await runDiagnostics(ctx.tenantId, allResults);

        for (const r of allResults) {
          await this.upsertTest(ctx.tenantId, r);
        }

        const run = await this.saveRun(ctx.tenantId, 'full', allResults, startedAt, diagnostics);
        allRuns.push({ tenantId: ctx.tenantId, profile: ctx.profile, ...run });

        const report = generateReport(ctx.tenantId, 'full', allResults, diagnostics);
        allReports.push(report);

        console.log(`[PLTE v2] Full ${ctx.tenantId}: ${run.healthScore}%`);
      } catch (err) {
        console.error(`[PLTE v2] Full error for ${ctx.tenantId}:`, err.message);
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    const globalReport = generateGlobalReport(allReports);
    if (globalReport && shouldAlert(globalReport)) {
      await sendAlert(globalReport);
    }

    this.logGlobalScore(allRuns, 'full');
    return allRuns;
  }

  // ============================================
  // E2E — Tests parcours utilisateur via HTTP
  // ============================================

  async runE2E() {
    if (this.isRunning) {
      console.log('[PLTE] Already running, skipping E2E');
      return [];
    }
    this.isRunning = true;

    try {
      console.log('[PLTE E2E] Running E2E tests (10 contextes)...');
      const startedAt = new Date().toISOString();
      const results = await runE2ETests();

      // Use a synthetic tenant_id for E2E runs (not tied to PLTE tenants)
      const e2eTenantId = 'plte-e2e';

      // Ensure plte-e2e tenant exists for persistence
      const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', e2eTenantId)
        .single();

      if (!existing) {
        await supabase.from('tenants').insert({
          id: e2eTenantId,
          name: 'PLTE E2E Runner',
          plan: 'business',
          statut: 'actif',
          created_at: new Date().toISOString(),
        });
      }

      // Persist each test result
      for (const r of results) {
        await this.upsertTest(e2eTenantId, r);
      }

      // Save run
      const run = await this.saveRun(e2eTenantId, 'e2e', results, startedAt);

      console.log(`[PLTE E2E] === RESULTAT: ${run.healthScore}% — ${run.passed}P/${run.failed}F/${run.errors}E ===`);
      return [{ tenantId: e2eTenantId, profile: 'e2e', ...run }];
    } finally {
      this.isRunning = false;
    }
  }

  // ============================================
  // GLOBAL SCORE
  // ============================================

  logGlobalScore(runs, type) {
    if (!runs.length) return;
    const avgScore = Math.round(runs.reduce((s, r) => s + (r.healthScore || 0), 0) / runs.length);
    const totalPassed = runs.reduce((s, r) => s + (r.passed || 0), 0);
    const totalFailed = runs.reduce((s, r) => s + (r.failed || 0), 0);
    const totalFixes = runs.reduce((s, r) => s + (r.fixes || 0), 0);

    console.log(`[PLTE v2] === ${type.toUpperCase()} GLOBAL: ${avgScore}% (${runs.length} tenants) — ${totalPassed}P/${totalFailed}F${totalFixes ? ` [${totalFixes} fixes]` : ''} ===`);
  }

  // ============================================
  // STATUS QUERIES (compatible v1 API)
  // ============================================

  async getStatus(tenantId) {
    if (!tenantId) throw new Error('tenant_id requis');

    // For PLTE tenants, show global status
    const isPlte = PLTE_TENANT_IDS.includes(tenantId);

    // Dernier run
    const { data: lastRuns } = await supabase
      .from('sentinel_logic_runs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(10);

    // Tests en echec
    const { data: failedTests } = await supabase
      .from('sentinel_logic_tests')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('last_status', ['fail', 'error'])
      .order('severity', { ascending: true });

    const latestRun = lastRuns?.[0];

    // Counts par categorie
    const { data: allTests } = await supabase
      .from('sentinel_logic_tests')
      .select('category, last_status, severity, auto_fixed, fix_description')
      .eq('tenant_id', tenantId);

    const categories = {};
    let autoFixedCount = 0;
    for (const t of (allTests || [])) {
      if (!categories[t.category]) {
        categories[t.category] = { total: 0, pass: 0, fail: 0, error: 0 };
      }
      categories[t.category].total++;
      if (t.last_status === 'pass') categories[t.category].pass++;
      else if (t.last_status === 'fail') categories[t.category].fail++;
      else if (t.last_status === 'error') categories[t.category].error++;
      if (t.auto_fixed) autoFixedCount++;
    }

    return {
      health_score: latestRun?.health_score ?? null,
      last_run: latestRun || null,
      failed_tests: failedTests || [],
      categories,
      total_tests: allTests?.length || 0,
      auto_fixed_count: autoFixedCount,
      profile: isPlte ? PLTE_TENANTS[tenantId]?.profile : null,
    };
  }

  async getHistory(tenantId, page = 1, limit = 20) {
    if (!tenantId) throw new Error('tenant_id requis');

    const offset = (page - 1) * limit;

    const { data, count } = await supabase
      .from('sentinel_logic_runs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return {
      runs: data || [],
      total: count || 0,
      page,
      limit,
      pages: Math.ceil((count || 0) / limit),
    };
  }

  async getTests(tenantId, category = null) {
    if (!tenantId) throw new Error('tenant_id requis');

    let query = supabase
      .from('sentinel_logic_tests')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('category')
      .order('name');

    if (category) {
      query = query.eq('category', category);
    }

    const { data } = await query;
    return data || [];
  }

  /**
   * Status global PLTE — tous les 8 tenants
   */
  async getGlobalStatus() {
    const tenantScores = [];

    for (const tenantId of PLTE_TENANT_IDS) {
      const { data: lastRun } = await supabase
        .from('sentinel_logic_runs')
        .select('health_score, started_at, run_type, passed, failed, errors')
        .eq('tenant_id', tenantId)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      tenantScores.push({
        tenantId,
        profile: PLTE_TENANTS[tenantId]?.profile,
        name: PLTE_TENANTS[tenantId]?.name,
        healthScore: lastRun?.health_score ?? null,
        lastRun: lastRun || null,
      });
    }

    const scored = tenantScores.filter(t => t.healthScore !== null);
    const globalScore = scored.length > 0
      ? Math.round(scored.reduce((s, t) => s + t.healthScore, 0) / scored.length)
      : null;

    return {
      global_score: globalScore,
      tenants: tenantScores,
      total_tenants: PLTE_TENANT_IDS.length,
      active_tenants: scored.length,
    };
  }
}

export const logicTestEngine = new LogicTestEngine();
export default logicTestEngine;
