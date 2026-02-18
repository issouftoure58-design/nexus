import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('=== Migration Usage Tracking ===\n');

  // Test si les tables existent déjà
  const tables = ['usage_events', 'usage_monthly', 'tenant_phone_numbers'];
  const missing = [];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error?.code === 'PGRST205' || error?.code === '42P01') {
      console.log(`❌ Table ${table} n'existe pas`);
      missing.push(table);
    } else if (error) {
      console.log(`⚠️ ${table}: ${error.message}`);
    } else {
      console.log(`✅ Table ${table} existe`);
    }
  }

  // Vérifier colonnes tenant
  const { error: tenantErr } = await supabase
    .from('tenants')
    .select('phone_number')
    .limit(1);

  if (tenantErr?.message?.includes('phone_number')) {
    console.log('❌ Colonne phone_number manquante sur tenants');
    missing.push('tenant_columns');
  } else {
    console.log('✅ Colonnes téléphone sur tenants OK');
  }

  if (missing.length > 0) {
    console.log('\n' + '='.repeat(50));
    console.log('📋 TABLES À CRÉER DANS SUPABASE DASHBOARD');
    console.log('='.repeat(50));
    console.log('\n1. Va sur: https://supabase.com/dashboard');
    console.log('2. Ouvre ton projet → SQL Editor');
    console.log('3. Copie-colle le contenu de: src/sql/usage_tracking.sql');
    console.log('4. Exécute le SQL\n');

    // Afficher le SQL
    const sql = fs.readFileSync('src/sql/usage_tracking.sql', 'utf8');
    console.log('='.repeat(50));
    console.log('SQL À EXÉCUTER:');
    console.log('='.repeat(50));
    console.log(sql);
  } else {
    console.log('\n✅ Toutes les tables sont en place !');
  }
}

runMigration().catch(console.error);
