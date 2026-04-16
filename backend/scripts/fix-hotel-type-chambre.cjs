// Backfill type_chambre + capacite_max pour les services 'chambre'/'suite' existants
// Usage: node scripts/fix-hotel-type-chambre.cjs

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Deduit type_chambre + capacite_max depuis le nom du service
function inferFromName(name) {
  const n = name.toLowerCase();
  if (n.includes('simple'))     return { type_chambre: 'simple',       capacite_max: 1 };
  if (n.includes('twin'))       return { type_chambre: 'twin',         capacite_max: 2 };
  if (n.includes('familiale'))  return { type_chambre: 'familiale',    capacite_max: 4 };
  if (n.includes('junior'))     return { type_chambre: 'suite_junior', capacite_max: 2 };
  if (n.includes('prestige') ||
      n.includes('deluxe')   ||
      n.includes('suite'))      return { type_chambre: 'suite',        capacite_max: 3 };
  if (n.includes('double'))     return { type_chambre: 'double',       capacite_max: 2 };
  return { type_chambre: 'double', capacite_max: 2 }; // fallback raisonnable
}

async function main() {
  // Lister tous les services chambre/suite sans type_chambre
  const { data: services, error } = await supabase
    .from('services')
    .select('id, tenant_id, nom, categorie, category, type_chambre, capacite_max')
    .in('categorie', ['chambre', 'suite'])
    .is('type_chambre', null);

  if (error) {
    console.error('ERREUR lecture services:', error);
    process.exit(1);
  }

  console.log(`${services.length} services a backfill.`);

  for (const svc of services) {
    const inferred = inferFromName(svc.nom);
    const { error: updErr } = await supabase
      .from('services')
      .update({
        type_chambre: inferred.type_chambre,
        capacite_max: svc.capacite_max || inferred.capacite_max,
      })
      .eq('id', svc.id);

    if (updErr) {
      console.error(`  [FAIL] ${svc.tenant_id} / ${svc.nom}: ${updErr.message}`);
    } else {
      console.log(`  [OK] ${svc.tenant_id} / ${svc.nom} → ${inferred.type_chambre} (cap ${inferred.capacite_max})`);
    }
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
