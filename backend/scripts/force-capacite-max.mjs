#!/usr/bin/env node
// Force capacite_max selon le nom de chambre pour TOUS les services hotel
// Corrige le cas ou capacite_max=2 (default migration 076) alors que le nom indique autre.
//
// Usage: node scripts/force-capacite-max.mjs

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Map nom (lowercase) -> capacite_max attendue
function inferCapacite(name) {
  const n = name.toLowerCase();
  if (n.includes('simple'))     return 1;
  if (n.includes('twin'))       return 2;
  if (n.includes('double'))     return 2;
  if (n.includes('familiale'))  return 4;
  if (n.includes('junior'))     return 2;
  if (n.includes('prestige'))   return 3;
  if (n.includes('deluxe'))     return 3;
  if (n.includes('suite'))      return 3;
  return null; // inconnu -> on ne touche pas
}

async function main() {
  const { data: services, error } = await supabase
    .from('services')
    .select('id, tenant_id, nom, type_chambre, capacite_max')
    .not('type_chambre', 'is', null);

  if (error) {
    console.error('ERREUR lecture services:', error);
    process.exit(1);
  }

  console.log(`${services.length} chambres a verifier.\n`);

  let updated = 0;
  let skipped = 0;

  for (const svc of services) {
    const expected = inferCapacite(svc.nom);
    if (expected === null) {
      console.log(`  [?] ${svc.tenant_id} / "${svc.nom}" -> type inconnu, skip`);
      skipped++;
      continue;
    }

    if (svc.capacite_max === expected) {
      skipped++;
      continue;
    }

    const { error: updErr } = await supabase
      .from('services')
      .update({ capacite_max: expected })
      .eq('id', svc.id)
      .eq('tenant_id', svc.tenant_id);

    if (updErr) {
      console.error(`  [FAIL] ${svc.tenant_id} / "${svc.nom}": ${updErr.message}`);
      continue;
    }

    console.log(`  [OK] ${svc.tenant_id} / "${svc.nom}": ${svc.capacite_max} -> ${expected} pers`);
    updated++;
  }

  console.log(`\nRESULTAT: ${updated} corriges, ${skipped} deja OK ou inconnus.`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
