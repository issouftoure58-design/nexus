import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: tenants } = await supabase.from('tenants').select('id, name, slug').in('slug', ['nexus-test', 'bote-service']);
console.log('Tenants:', tenants?.map(t => `${t.slug} (${t.name})`).join(', '));

for (const t of tenants || []) {
  const { data: membres } = await supabase.from('rh_membres').select('*').eq('tenant_id', t.id);

  console.log(`\n=== ${t.slug} — ${membres?.length || 0} membres RH ===`);
  if (membres?.[0]) console.log('Colonnes:', Object.keys(membres[0]).join(', '));
  for (const m of membres || []) {
    console.log(`  ${m.id} | ${m.nom} ${m.prenom} | contrat:${m.type_contrat || '?'} | poste:${m.poste || '?'}`);
    console.log(`    NIR:${m.nir || 'X'} PCS:${m.code_pcs_ese || 'X'} emb:${m.date_embauche || 'X'} modal:${m.modalite_temps || 'X'}`);
    console.log(`    quotRef:${m.quotite_reference || 'X'} statConv:${m.statut_conventionnel || 'X'} risqueAT:${m.code_risque_at || 'X'} tauxAT:${m.taux_at || 'X'}`);
  }

  const { data: params } = await supabase.from('rh_dsn_parametres').select('*').eq('tenant_id', t.id);
  console.log(`  DSN params: ${params?.length || 0}`);
  if (params?.[0]) console.log('  ', JSON.stringify(params[0]));
}
