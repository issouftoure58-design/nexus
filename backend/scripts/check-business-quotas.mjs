import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: tenants } = await supabase.from('tenants')
  .select('id, plan').order('created_at', { ascending: false }).limit(5);
const bizTenant = tenants.find(t => t.plan === 'business');
const tid = process.argv[2] || bizTenant?.id;
if (!tid) { console.error('No Business tenant found'); process.exit(1); }

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
check('plan = business', t.plan === 'business');
check('statut = actif', t.statut === 'actif');
check('subscription_status = active', t.subscription_status === 'active');
check('email present', !!t.email);
check('telephone present', !!t.telephone);

// MODULES
console.log('\n=== MODULES BUSINESS ===');
const { getFeaturesForPlan, PLAN_LIMITS } = await import('../src/config/planFeatures.js');
const expected = getFeaturesForPlan('business');
const actual = t.modules_actifs || {};

const shouldBeTrue = Object.entries(expected).filter(([, v]) => v === true).map(([k]) => k);
const shouldBeFalse = Object.entries(expected).filter(([, v]) => v === false).map(([k]) => k);

for (const m of shouldBeTrue) {
  check(`${m} = true (inclus Business)`, actual[m] === true);
}
if (shouldBeFalse.length === 0) {
  check('Aucun module bloque (Business = tout actif)', true);
} else {
  for (const m of shouldBeFalse) {
    check(`${m} = false (bloque Business)`, !actual[m]);
  }
}

// CANAUX IA
console.log('\n=== CANAUX IA ===');
check('agent_ia_web actif', actual.agent_ia_web === true);

const { data: iaConfigs } = await supabase.from('tenant_ia_config')
  .select('channel, config').eq('tenant_id', tid);
console.log('\n=== TENANT_IA_CONFIG ===');
const webConfig = (iaConfigs || []).find(r => r.channel === 'web');
check('Config IA web existe', !!webConfig);
check('Config IA web active', webConfig?.config?.active === true);

// LIMITES BUSINESS
console.log('\n=== LIMITES BUSINESS ===');
const lim = PLAN_LIMITS.business;
check('clients_max = -1 (illimite)', lim.clients_max === -1);
check('reservations_mois = -1 (illimite)', lim.reservations_mois === -1);
check('factures_mois = -1 (illimite)', lim.factures_mois === -1);
check('prestations_max = -1 (illimite)', lim.prestations_max === -1);
check('users_max = 50', lim.users_max === 50);

// MODULES EXCLUSIFS BUSINESS (RH, Sentinel, whitelabel, API, SSO)
console.log('\n=== MODULES EXCLUSIFS BUSINESS ===');
check('rh = true', actual.rh === true);
check('sentinel = true', actual.sentinel === true);
check('whitelabel = true', actual.whitelabel === true);
check('api = true', actual.api === true);
check('sso = true', actual.sso === true);

// RESUME
console.log(`\n${'='.repeat(40)}`);
console.log(`RESULTAT: ${ok} OK, ${fail} FAIL`);
if (fail === 0) console.log('Tous les quotas Business sont en place.');
else console.log('Des problemes ont ete detectes.');
process.exit(fail > 0 ? 1 : 0);
