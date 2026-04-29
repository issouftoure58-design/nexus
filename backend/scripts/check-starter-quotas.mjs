import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tid = process.argv[2] || 'test-salon-starter';
let ok = 0, fail = 0;

function check(label, condition) {
  if (condition) { console.log(`  OK  ${label}`); ok++; }
  else { console.log(`  FAIL  ${label}`); fail++; }
}

const { data: t } = await supabase.from('tenants')
  .select('id, name, plan, statut, email, telephone, modules_actifs, options_canaux_actifs, subscription_status')
  .eq('id', tid).single();

if (!t) { console.error('Tenant not found:', tid); process.exit(1); }

console.log(`\nTenant: ${t.name} (${t.id}) — plan=${t.plan} statut=${t.statut}`);
console.log(`Email: ${t.email} | Tel: ${t.telephone}\n`);

// PLAN
console.log('=== PLAN ===');
check('plan = starter', t.plan === 'starter');
check('statut = actif', t.statut === 'actif');
check('subscription_status = active', t.subscription_status === 'active');
check('email present', !!t.email);
check('telephone present', !!t.telephone);

// MODULES
console.log('\n=== MODULES STARTER ===');
const { getFeaturesForPlan, PLAN_LIMITS } = await import('../src/config/planFeatures.js');
const expected = getFeaturesForPlan('starter');
const actual = t.modules_actifs || {};

const shouldBeTrue = Object.entries(expected).filter(([, v]) => v === true).map(([k]) => k);
const shouldBeFalse = Object.entries(expected).filter(([, v]) => v === false).map(([k]) => k);

for (const m of shouldBeTrue) {
  check(`${m} = true (inclus Starter)`, actual[m] === true);
}
for (const m of shouldBeFalse) {
  check(`${m} = false (bloque Starter)`, !actual[m]);
}

// CANAUX IA (Starter = tous disponibles)
console.log('\n=== CANAUX IA ===');
check('agent_ia_web actif dans modules', actual.agent_ia_web === true);

const { data: iaConfigs } = await supabase.from('tenant_ia_config')
  .select('channel, config').eq('tenant_id', tid);
console.log('\n=== TENANT_IA_CONFIG ===');
const webConfig = (iaConfigs || []).find(r => r.channel === 'web');
check('Config IA web existe', !!webConfig);
check('Config IA web active', webConfig?.config?.active === true);

// LIMITES
console.log('\n=== LIMITES STARTER ===');
const lim = PLAN_LIMITS.starter;
check('clients_max = 200', lim.clients_max === 200);
check('reservations_mois = 200', lim.reservations_mois === 200);
check('factures_mois = 200', lim.factures_mois === 200);
check('prestations_max = 200', lim.prestations_max === 200);
check('users_max = 5', lim.users_max === 5);

// RESUME
console.log(`\n${'='.repeat(40)}`);
console.log(`RESULTAT: ${ok} OK, ${fail} FAIL`);
if (fail === 0) console.log('Tous les quotas Starter sont en place.');
else console.log('Des problemes ont ete detectes.');
process.exit(fail > 0 ? 1 : 0);
