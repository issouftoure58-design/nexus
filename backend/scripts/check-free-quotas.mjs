import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const tid = process.argv[2] || 'test-salon-free';
let ok = 0, fail = 0;

function check(label, condition) {
  if (condition) { console.log(`  OK  ${label}`); ok++; }
  else { console.log(`  FAIL  ${label}`); fail++; }
}

// 1. Tenant
const { data: t } = await supabase.from('tenants')
  .select('id, name, plan, statut, email, telephone, modules_actifs, options_canaux_actifs, business_profile')
  .eq('id', tid).single();

if (!t) { console.error('Tenant not found:', tid); process.exit(1); }

console.log(`\nTenant: ${t.name} (${t.id}) — plan=${t.plan} statut=${t.statut}`);
console.log(`Email: ${t.email} | Tel: ${t.telephone} | Profile: ${t.business_profile}\n`);

// 2. Plan & statut
console.log('=== PLAN ===');
check('plan = free', t.plan === 'free');
check('statut = actif', t.statut === 'actif');
check('email present', !!t.email);
check('telephone present', !!t.telephone);
check('business_profile = salon', t.business_profile === 'salon');

// 3. Modules actifs match planFeatures(free)
console.log('\n=== MODULES ===');
const { getFeaturesForPlan, PLAN_LIMITS } = await import('../src/config/planFeatures.js');
const expected = getFeaturesForPlan('free');
const actual = t.modules_actifs || {};

// Modules qui doivent être true (inclus Free)
const shouldBeTrue = Object.entries(expected).filter(([, v]) => v === true).map(([k]) => k);
const shouldBeFalse = Object.entries(expected).filter(([, v]) => v === false).map(([k]) => k);

for (const m of shouldBeTrue) {
  check(`${m} = true (inclus Free)`, actual[m] === true);
}
for (const m of shouldBeFalse) {
  check(`${m} = false (bloqué Free)`, !actual[m]);
}

// 4. Canaux IA (aucun actif en Free)
console.log('\n=== CANAUX IA ===');
const canaux = t.options_canaux_actifs || {};
check('agent_ia_web absent/false', !canaux.agent_ia_web);
check('whatsapp absent/false', !canaux.whatsapp);
check('telephone absent/false', !canaux.telephone);

// 5. tenant_ia_config (aucune config active en Free)
const { data: iaConfigs } = await supabase.from('tenant_ia_config')
  .select('channel, config').eq('tenant_id', tid);
console.log('\n=== TENANT_IA_CONFIG ===');
const activeIa = (iaConfigs || []).filter(r => r.config?.active === true);
check(`Aucun canal IA actif (${activeIa.length} trouvé)`, activeIa.length === 0);

// 6. Limites plan
console.log('\n=== LIMITES FREE ===');
const lim = PLAN_LIMITS.free;
check('clients_max = 5', lim.clients_max === 5);
check('reservations_mois = 5', lim.reservations_mois === 5);
check('factures_mois = 5', lim.factures_mois === 5);
check('prestations_max = 5', lim.prestations_max === 5);
check('users_max = 1', lim.users_max === 1);

// 7. Résumé
console.log(`\n${'='.repeat(40)}`);
console.log(`RESULTAT: ${ok} OK, ${fail} FAIL`);
if (fail === 0) console.log('Tous les quotas Free sont en place.');
else console.log('Des problèmes ont été détectés.');
process.exit(fail > 0 ? 1 : 0);
