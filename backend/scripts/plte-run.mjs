#!/usr/bin/env node
/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

/**
 * PLTE v2 — CLI Runner
 * Usage: node scripts/plte-run.mjs [hourly|nightly|weekly|full]
 */

import 'dotenv/config';

const type = process.argv[2] || 'hourly';
const validTypes = ['hourly', 'nightly', 'weekly', 'full'];

if (!validTypes.includes(type)) {
  console.error(`Usage: node scripts/plte-run.mjs [${validTypes.join('|')}]`);
  process.exit(1);
}

console.log(`\n[PLTE v2] Starting ${type} run...\n`);

const start = Date.now();

try {
  const { logicTestEngine } = await import('../src/services/logicTestEngine.js');

  let results;
  switch (type) {
    case 'hourly':
      results = await logicTestEngine.runHourly();
      break;
    case 'nightly':
      results = await logicTestEngine.runNightly();
      break;
    case 'weekly':
      results = await logicTestEngine.runWeekly();
      break;
    case 'full':
      results = await logicTestEngine.runFull();
      break;
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n[PLTE v2] === RESULTS ===`);
  console.log(`Type: ${type}`);
  console.log(`Duration: ${elapsed}s`);
  console.log(`Tenants: ${results?.length || 0}`);

  if (results?.length) {
    const totalPassed = results.reduce((s, r) => s + (r.passed || 0), 0);
    const totalFailed = results.reduce((s, r) => s + (r.failed || 0), 0);
    const totalErrors = results.reduce((s, r) => s + (r.errors || 0), 0);
    const totalFixes = results.reduce((s, r) => s + (r.fixes || 0), 0);
    const avgScore = Math.round(results.reduce((s, r) => s + (r.healthScore || 0), 0) / results.length);

    console.log(`Score global: ${avgScore}%`);
    console.log(`Total: ${totalPassed}P / ${totalFailed}F / ${totalErrors}E`);
    if (totalFixes > 0) console.log(`Auto-fixes: ${totalFixes}`);

    console.log(`\nDetail par tenant:`);
    for (const r of results) {
      const status = r.healthScore >= 90 ? 'OK' : r.healthScore >= 70 ? 'WARN' : 'FAIL';
      console.log(`  ${r.tenantId} (${r.profile}): ${r.healthScore}% [${status}] — ${r.passed}P/${r.failed}F${r.fixes ? ` [${r.fixes} fixes]` : ''}`);
    }
  }

  console.log(`\nDone.\n`);
  process.exit(0);
} catch (err) {
  console.error(`[PLTE v2] Fatal error:`, err);
  process.exit(1);
}
