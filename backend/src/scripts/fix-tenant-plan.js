/**
 * Fix tenant plan - Met à jour le plan d'un tenant pour activer les features Pro
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TENANT_ID = process.argv[2] || 'nexus-test';
const NEW_PLAN = process.argv[3] || 'pro';

async function main() {
  console.log(`\n🔧 Mise à jour du plan pour tenant: ${TENANT_ID}\n`);

  try {
    // 1. Vérifier le tenant actuel
    const { data: tenant, error: fetchError } = await supabase
      .from('tenants')
      .select('id, name, plan, plan_id, tier, status')
      .eq('id', TENANT_ID)
      .single();

    if (fetchError) {
      console.error('❌ Tenant non trouvé:', fetchError.message);
      process.exit(1);
    }

    console.log('📋 Tenant actuel:');
    console.log(`   ID: ${tenant.id}`);
    console.log(`   Name: ${tenant.name}`);
    console.log(`   Plan: ${tenant.plan || 'non défini'}`);
    console.log(`   Plan_id: ${tenant.plan_id || 'non défini'}`);
    console.log(`   Tier: ${tenant.tier || 'non défini'}`);
    console.log(`   Status: ${tenant.status}`);

    // 2. Mettre à jour le plan
    const { error: updateError } = await supabase
      .from('tenants')
      .update({
        plan: NEW_PLAN,
        plan_id: NEW_PLAN,
        tier: NEW_PLAN
      })
      .eq('id', TENANT_ID);

    if (updateError) {
      console.error('\n❌ Erreur mise à jour:', updateError.message);
      process.exit(1);
    }

    console.log(`\n✅ Plan mis à jour: ${NEW_PLAN}`);

    // 3. Vérifier si la table segments existe
    const { error: tableError } = await supabase
      .from('segments')
      .select('id')
      .limit(1);

    if (tableError && tableError.message.includes('does not exist')) {
      console.log('\n⚠️  Table segments non trouvée. Exécutez la migration:');
      console.log('   psql -f backend/src/migrations/005_crm_segments.sql');
    } else {
      console.log('\n✅ Table segments existe');

      // Compter les segments du tenant
      const { count } = await supabase
        .from('segments')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', TENANT_ID);

      console.log(`   ${count || 0} segments pour ce tenant`);
    }

    console.log('\n🎉 Terminé! Le tenant peut maintenant utiliser la segmentation CRM.\n');

  } catch (error) {
    console.error('\n❌ Exception:', error.message);
    process.exit(1);
  }
}

main();
