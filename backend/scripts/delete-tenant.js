#!/usr/bin/env node
/**
 * Delete Tenant
 * Script de suppression complete d'un tenant
 *
 * Usage: node backend/scripts/delete-tenant.js <tenant_id>
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const tenantId = process.argv[2];

if (!tenantId) {
  console.error('Usage: node backend/scripts/delete-tenant.js <tenant_id>');
  console.error('Example: node backend/scripts/delete-tenant.js nexus-test');
  process.exit(1);
}

// Protection contre suppression tenants production
const PROTECTED_TENANTS = ['fatshairafro'];

if (PROTECTED_TENANTS.includes(tenantId)) {
  console.error(`❌ ERREUR: Le tenant "${tenantId}" est protege et ne peut pas etre supprime.`);
  process.exit(1);
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log(`║         SUPPRESSION TENANT: ${tenantId.padEnd(25)}        ║`);
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    // Verifier que le tenant existe
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (!tenant) {
      console.error(`❌ Tenant "${tenantId}" non trouve`);
      process.exit(1);
    }

    // Verifier si frozen
    if (tenant.settings?.frozen) {
      console.error(`❌ Tenant "${tenantId}" est FROZEN et ne peut pas etre supprime.`);
      console.error('   Modifiez frozen: false dans settings avant de supprimer.');
      process.exit(1);
    }

    console.log(`📋 Tenant trouve: ${tenant.name}`);
    console.log(`   Status: ${tenant.status}`);
    console.log(`   Plan: ${tenant.plan}\n`);

    console.log('🗑️  Suppression des donnees...\n');

    // Supprimer dans l'ordre (FK constraints)
    const tables = [
      'expenses',
      'invoices',
      'reservations',
      'products',
      'team_members',
      'clients',
      'services',
      'business_hours',
      'admin_users'
    ];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('tenant_id', tenantId);

      if (error) {
        console.warn(`   ⚠️ ${table}: ${error.message}`);
      } else {
        console.log(`   ✓ ${table}`);
      }
    }

    // Supprimer le tenant
    console.log('\n🗑️  Suppression du tenant...');
    const { error: tenantError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId);

    if (tenantError) {
      throw new Error(`Erreur suppression tenant: ${tenantError.message}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log(`✅ TENANT "${tenantId}" SUPPRIME !`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('📝 N\'oubliez pas de supprimer aussi:');
    console.log(`   - tenants/tenant-X/ (dossier config)`);
    console.log(`   - backend/src/config/tenants/${tenantId.replace(/-/g, '')}.js`);
    console.log(`   - Entry dans tenants/registry.json`);
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
