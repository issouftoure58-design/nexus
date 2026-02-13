#!/usr/bin/env node
/**
 * Reset Tenant Test - nexus-test (ID: 3)
 * Script de reinitialisation des donnees de test
 *
 * Usage: node backend/scripts/reset-tenant-test.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const TENANT_ID = 'nexus-test';

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         RESET TENANT TEST - nexus-test                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    // Verifier que le tenant existe
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', TENANT_ID)
      .single();

    if (!tenant) {
      console.error('❌ Tenant "nexus-test" non trouve');
      process.exit(1);
    }

    console.log('🗑️  Suppression des donnees existantes...\n');

    // Supprimer dans l'ordre (FK constraints)
    // Tables optionnelles en premier, puis tables principales
    const tables = [
      'expenses',        // optionnel
      'team_members',    // optionnel
      'business_hours',  // optionnel
      'invoices',
      'reservations',
      'products',
      'clients',
      'services'
    ];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('tenant_id', TENANT_ID);

      if (error) {
        console.warn(`   ⚠️ ${table}: ${error.message}`);
      } else {
        console.log(`   ✓ ${table} vide`);
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ DONNEES TENANT TEST SUPPRIMEES !');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('📦 PROCHAINE ETAPE :');
    console.log('   node backend/scripts/populate-tenant-test.js');
    console.log('');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
