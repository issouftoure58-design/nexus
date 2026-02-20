#!/usr/bin/env node
/**
 * Run Sentinel tables migration
 *
 * Usage: node backend/scripts/run-sentinel-migration.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function checkTableExists(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('id')
    .limit(1);

  return !error; // If no error, table exists
}

async function main() {
  console.log('=============================================');
  console.log(' SENTINEL TABLES MIGRATION');
  console.log('=============================================\n');

  // Check which tables exist
  const tables = [
    'sentinel_daily_snapshots',
    'sentinel_daily_costs',
    'sentinel_goals',
    'sentinel_insights'
  ];

  console.log('Checking existing tables...\n');

  for (const table of tables) {
    const exists = await checkTableExists(table);
    console.log(`  ${table}: ${exists ? '✓ exists' : '✗ missing'}`);
  }

  console.log('\n');
  console.log('To create missing tables, run the following SQL in Supabase SQL Editor:');
  console.log('');
  console.log('Go to: https://supabase.com/dashboard → Your Project → SQL Editor');
  console.log('');
  console.log('Copy the contents of:');
  console.log('  backend/src/migrations/003_sentinel_client_tables.sql');
  console.log('');

  // For now, let's just create the basic tables directly
  console.log('Attempting to create tables via API...\n');

  // Try to create the tables by inserting a test record
  // This will fail if table doesn't exist, but at least we tried

  const testTenantId = 'nexus-test';
  const today = new Date().toISOString().split('T')[0];

  // Try to insert a snapshot
  const { error: snapshotError } = await supabase
    .from('sentinel_daily_snapshots')
    .upsert({
      tenant_id: testTenantId,
      date: today,
      total_clients: 0,
      new_clients: 0,
      total_reservations: 0,
      revenue_paid: 0,
      no_show_rate: 0
    }, { onConflict: 'tenant_id,date' });

  if (snapshotError) {
    console.log('❌ sentinel_daily_snapshots:', snapshotError.message);
    if (snapshotError.code === 'PGRST205') {
      console.log('   → Table does not exist. Please create it in Supabase SQL Editor.');
    }
  } else {
    console.log('✓ sentinel_daily_snapshots: OK');
  }

  // Try costs table
  const { error: costsError } = await supabase
    .from('sentinel_daily_costs')
    .upsert({
      tenant_id: testTenantId,
      date: today,
      ai_cost_eur: 0,
      sms_cost_eur: 0,
      voice_cost_eur: 0,
      emails_cost_eur: 0,
      total_cost_eur: 0
    }, { onConflict: 'tenant_id,date' });

  if (costsError) {
    console.log('❌ sentinel_daily_costs:', costsError.message);
  } else {
    console.log('✓ sentinel_daily_costs: OK');
  }

  // Try goals table
  const { error: goalsError } = await supabase
    .from('sentinel_goals')
    .upsert({
      tenant_id: testTenantId,
      goal_revenue_monthly: 10000,
      goal_new_clients_monthly: 50,
      goal_reservations_monthly: 200
    }, { onConflict: 'tenant_id' });

  if (goalsError) {
    console.log('❌ sentinel_goals:', goalsError.message);
  } else {
    console.log('✓ sentinel_goals: OK');
  }

  // Try insights table
  const { error: insightsError } = await supabase
    .from('sentinel_insights')
    .insert({
      tenant_id: testTenantId,
      insight_type: 'tip',
      category: 'revenue',
      title: 'Bienvenue sur SENTINEL',
      description: 'Votre dashboard Business Intelligence est prêt. Les insights seront générés automatiquement.',
      priority: 5,
      status: 'active'
    });

  if (insightsError && !insightsError.message.includes('duplicate')) {
    console.log('❌ sentinel_insights:', insightsError.message);
  } else {
    console.log('✓ sentinel_insights: OK');
  }

  console.log('\n=============================================');
  console.log(' DONE');
  console.log('=============================================\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
