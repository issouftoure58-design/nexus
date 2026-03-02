#!/usr/bin/env node
/**
 * Create Tenant Test - nexus-test (ID: 3)
 * Script de creation du tenant test avec toutes les fonctionnalites
 *
 * Usage: node backend/scripts/create-tenant-test.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const TENANT_CONFIG = {
  id: 'nexus-test',
  name: 'Test NEXUS Platform',
  domain: 'test.nexus.dev',
  plan: 'business',
  status: 'active',
  settings: {
    frozen: false,
    tier: 'business',
    features: {
      all: true
    }
  }
};

const ADMIN_USER = {
  email: 'admin@nexus-test.com',
  password: 'Test123!',
  first_name: 'Admin',
  last_name: 'Test',
  role: 'admin'
};

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║          CREATION TENANT TEST - nexus-test                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Verifier si tenant existe deja
    console.log('1️⃣  Verification tenant existant...');
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', TENANT_CONFIG.id)
      .single();

    if (existing) {
      console.log('⚠️  Tenant "nexus-test" existe deja');
      console.log('   Pour recreer, supprimez d\'abord avec: node scripts/delete-tenant.js nexus-test');
      return;
    }
    console.log('   ✓ Pas de conflit\n');

    // 2. Creer tenant
    console.log('2️⃣  Creation tenant en BDD...');
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert(TENANT_CONFIG)
      .select()
      .single();

    if (tenantError) {
      throw new Error(`Erreur creation tenant: ${tenantError.message}`);
    }
    console.log(`   ✓ Tenant cree: ${tenant.id}\n`);

    // 3. Creer utilisateur admin
    console.log('3️⃣  Creation utilisateur admin...');
    const passwordHash = await bcrypt.hash(ADMIN_USER.password, 10);

    const { data: admin, error: adminError } = await supabase
      .from('admin_users')
      .insert({
        email: ADMIN_USER.email,
        password_hash: passwordHash,
        role: ADMIN_USER.role,
        tenant_id: TENANT_CONFIG.id,
        first_name: ADMIN_USER.first_name,
        last_name: ADMIN_USER.last_name,
        status: 'active'
      })
      .select()
      .single();

    if (adminError) {
      console.warn(`   ⚠️ Warning admin: ${adminError.message}`);
    } else {
      console.log(`   ✓ Admin cree: ${admin.email}\n`);
    }

    // 4. Creer horaires par defaut
    console.log('4️⃣  Configuration horaires...');
    const horaires = [
      { day_of_week: 1, open_time: '09:00', close_time: '18:00', is_closed: false },
      { day_of_week: 2, open_time: '09:00', close_time: '18:00', is_closed: false },
      { day_of_week: 3, open_time: '09:00', close_time: '18:00', is_closed: false },
      { day_of_week: 4, open_time: '09:00', close_time: '18:00', is_closed: false },
      { day_of_week: 5, open_time: '09:00', close_time: '18:00', is_closed: false },
      { day_of_week: 6, open_time: '10:00', close_time: '16:00', is_closed: false },
      { day_of_week: 0, open_time: null, close_time: null, is_closed: true }
    ];

    const { error: horairesError } = await supabase
      .from('business_hours')
      .insert(horaires.map(h => ({ ...h, tenant_id: TENANT_CONFIG.id })));

    if (horairesError) {
      console.warn(`   ⚠️ Warning horaires: ${horairesError.message}`);
    } else {
      console.log('   ✓ Horaires configures\n');
    }

    // Resume
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ TENANT TEST CREE AVEC SUCCES !');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('📊 INFORMATIONS :');
    console.log(`   - ID:       ${TENANT_CONFIG.id}`);
    console.log(`   - Nom:      ${TENANT_CONFIG.name}`);
    console.log(`   - Domain:   ${TENANT_CONFIG.domain}`);
    console.log(`   - Plan:     ${TENANT_CONFIG.plan}`);
    console.log(`   - Status:   ${TENANT_CONFIG.status}\n`);

    console.log('🔐 IDENTIFIANTS ADMIN :');
    console.log(`   - Email:    ${ADMIN_USER.email}`);
    console.log(`   - Password: ${ADMIN_USER.password}\n`);

    console.log('🔧 HEADER API :');
    console.log(`   X-Tenant-ID: ${TENANT_CONFIG.id}\n`);

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
