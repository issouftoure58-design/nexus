#!/usr/bin/env node
/**
 * Backfill Sentinel data for the last N days
 * Usage: node backend/scripts/backfill-sentinel.js [tenantId] [days]
 */

import 'dotenv/config';
import { sentinelCollector } from '../src/services/sentinelCollector.js';

const tenantId = process.argv[2] || 'nexus-test';
const days = parseInt(process.argv[3]) || 30;

console.log('=============================================');
console.log(' SENTINEL BACKFILL');
console.log(`Tenant: ${tenantId}`);
console.log(`Days: ${days}`);
console.log('=============================================\n');

async function backfill() {
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    console.log(`\n[${days - i + 1}/${days + 1}] Collecting ${dateStr}...`);

    const snapshotResult = await sentinelCollector.collectDailySnapshot(tenantId, dateStr);
    console.log(`  Snapshot: ${snapshotResult.success ? '✓' : '✗'}`);

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n=============================================');
  console.log(' BACKFILL COMPLETED');
  console.log('=============================================');
}

backfill().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
