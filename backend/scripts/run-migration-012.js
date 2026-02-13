#!/usr/bin/env node
/**
 * Run migration 012: Create missing tables for tenant test
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function createTables() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     MIGRATION 012: Tables manquantes                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Test if tables exist by trying to select from them
  const tables = ['expenses', 'team_members', 'business_hours'];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error && error.message.includes('Could not find')) {
      console.log(`❌ Table ${table} n'existe pas - Creation necessaire via Supabase Dashboard`);
    } else {
      console.log(`✅ Table ${table} existe`);
    }
  }

  console.log('\n📋 Pour creer les tables manquantes:');
  console.log('   1. Aller sur Supabase Dashboard -> SQL Editor');
  console.log('   2. Copier/coller le contenu de:');
  console.log('      backend/src/migrations/012_test_tenant_tables.sql');
  console.log('   3. Executer');
  console.log('\n   OU utiliser la CLI Supabase:');
  console.log('   supabase db push');
}

createTables().catch(console.error);
