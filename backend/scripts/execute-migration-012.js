#!/usr/bin/env node
/**
 * Execute Migration 012: Create missing tables
 * Uses Supabase SQL execution
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const MIGRATION_SQL = `
-- =====================================================
-- TABLE: expenses (Depenses comptables)
-- =====================================================
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'cancelled')),
  supplier_name TEXT,
  invoice_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- =====================================================
-- TABLE: team_members (Equipe RH)
-- =====================================================
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'employee' CHECK (role IN ('admin', 'manager', 'employee')),
  poste TEXT,
  hire_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_leave')),
  hourly_rate INTEGER,
  monthly_salary INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_tenant ON team_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);

-- =====================================================
-- TABLE: business_hours (Horaires ouverture)
-- =====================================================
CREATE TABLE IF NOT EXISTS business_hours (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_business_hours_tenant ON business_hours(tenant_id);
`;

async function executeMigration() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     MIGRATION 012: Creation tables manquantes                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    // Execute SQL via rpc (requires a SQL function or use REST API)
    const { data, error } = await supabase.rpc('exec_sql', { sql: MIGRATION_SQL });

    if (error) {
      // If rpc doesn't exist, try alternative approach
      console.log('⚠️  RPC exec_sql non disponible, tentative directe...\n');

      // Try creating tables one by one via REST
      await createTablesDirectly();
    } else {
      console.log('✅ Migration executee via RPC');
    }

  } catch (err) {
    console.error('Erreur:', err.message);
    await createTablesDirectly();
  }
}

async function createTablesDirectly() {
  console.log('📋 Creation des tables via API REST...\n');

  // Test each table by inserting and checking
  const tables = [
    { name: 'expenses', testData: { tenant_id: 'test', description: 'test', amount: 100, category: 'test', date: '2026-01-01' } },
    { name: 'team_members', testData: { tenant_id: 'test', first_name: 'Test', last_name: 'User', email: 'test@test.com' } },
    { name: 'business_hours', testData: { tenant_id: 'test', day_of_week: 1 } }
  ];

  for (const table of tables) {
    const { error: selectError } = await supabase.from(table.name).select('id').limit(1);

    if (selectError && selectError.message.includes('Could not find')) {
      console.log(`❌ Table ${table.name} n'existe pas`);
      console.log(`   → Executer SQL manuellement sur Supabase Dashboard\n`);
    } else {
      console.log(`✅ Table ${table.name} existe`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📝 INSTRUCTIONS MANUELLES:');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('1. Aller sur: https://supabase.com/dashboard');
  console.log('2. Selectionner le projet NEXUS');
  console.log('3. Aller dans SQL Editor');
  console.log('4. Copier/coller le SQL ci-dessous et executer:\n');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(MIGRATION_SQL);
  console.log('─────────────────────────────────────────────────────────────────\n');
}

executeMigration().catch(console.error);
