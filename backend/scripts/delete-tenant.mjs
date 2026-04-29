import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tenantId = process.argv[2];
if (!tenantId) {
  console.error('Usage: node scripts/delete-tenant.mjs <tenant_id>');
  process.exit(1);
}

// Tables à nettoyer (ordre = enfants d'abord, parent en dernier)
const tables = [
  'tenant_ia_config',
  'tenant_agent_config',
  'module_activation_requests',
  'usage_tracking',
  'historique_admin',
  'billing_events',
  'ai_credits',
  'business_hours',
  'notifications',
  'conversations',
  'messages',
  'reservations',
  'rendezvous',
  'services',
  'clients',
  'factures',
  'devis',
  'admin_users',
  'tenants',
];

console.log(`Suppression du tenant: ${tenantId}`);

for (const table of tables) {
  const col = table === 'tenants' ? 'id' : 'tenant_id';
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .eq(col, tenantId);

  if (error) {
    console.log(`  ERR ${table}: ${error.message}`);
  } else {
    console.log(`  DEL ${table}: ${count || 0} rows`);
  }
}

// Vérifier
const { data: check } = await supabase.from('tenants').select('id').eq('id', tenantId).maybeSingle();
console.log(check ? 'ERREUR: tenant encore present!' : `OK: ${tenantId} supprime`);
