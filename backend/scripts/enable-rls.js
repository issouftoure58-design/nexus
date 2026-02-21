#!/usr/bin/env node
/**
 * 🛡️ ENABLE ROW LEVEL SECURITY
 * Execute: node scripts/enable-rls.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TABLES_WITH_TENANT = [
  'services',
  'clients',
  'reservations',
  'factures',
  'conversations',
  'admin_users',
  'branding',
  'reviews',
  'horaires_hebdo',
  'social_posts',
  'products',
  'halimah_conversations',
  'halimah_memory',
  'workflows',
  'automations'
];

async function enableRLS() {
  console.log('🛡️ ENABLING ROW LEVEL SECURITY...\n');

  for (const table of TABLES_WITH_TENANT) {
    try {
      // Check if table exists by querying it
      const { error: checkError } = await supabase
        .from(table)
        .select('tenant_id')
        .limit(1);

      if (checkError && checkError.code === '42P01') {
        console.log(`⏭️  ${table}: table n'existe pas, skip`);
        continue;
      }

      if (checkError && checkError.message.includes('tenant_id')) {
        console.log(`⏭️  ${table}: pas de colonne tenant_id, skip`);
        continue;
      }

      console.log(`✅ ${table}: prêt pour RLS`);
    } catch (err) {
      console.log(`❌ ${table}: erreur - ${err.message}`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 COPIE CE SQL DANS SUPABASE SQL EDITOR:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sql = TABLES_WITH_TENANT.map(table => `
-- ${table}
ALTER TABLE IF EXISTS ${table} ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS service_full_access_${table} ON ${table};
CREATE POLICY service_full_access_${table} ON ${table} FOR ALL TO service_role USING (true);
DROP POLICY IF EXISTS anon_tenant_access_${table} ON ${table};
CREATE POLICY anon_tenant_access_${table} ON ${table} FOR SELECT TO anon
  USING (tenant_id = current_setting('request.jwt.claims', true)::json->>'tenant_id');
`).join('\n');

  console.log(sql);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Copie le SQL ci-dessus dans: https://supabase.com/dashboard/project/mmivralzwcmriciprfbc/sql');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

enableRLS().catch(console.error);
