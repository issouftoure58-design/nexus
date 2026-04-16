#!/usr/bin/env node
// Split "Transfert aéroport/gare" (un seul service ambigu a 40EUR)
// en 2 services explicites : "- Arrivée" et "- Départ" (25EUR chacun).
// Idempotent : si les deux services existent déjà, ne fait rien.
//
// Usage: node scripts/split-transfert-aeroport.mjs

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  // Trouver tous les services "Transfert aéroport/gare" (sans suffixe - Arrivée/Départ)
  const { data: services, error } = await supabase
    .from('services')
    .select('id, tenant_id, nom, prix, actif, categorie, category, facturation, ordre')
    .ilike('nom', 'transfert aéroport%');

  if (error) {
    console.error('ERREUR lecture services:', error);
    process.exit(1);
  }

  // Regrouper par tenant
  const byTenant = new Map();
  for (const s of services) {
    if (!byTenant.has(s.tenant_id)) byTenant.set(s.tenant_id, []);
    byTenant.get(s.tenant_id).push(s);
  }

  console.log(`${services.length} services "transfert" trouves sur ${byTenant.size} tenants.\n`);

  let splitCount = 0;
  let skipCount = 0;

  for (const [tenantId, tenantSvcs] of byTenant.entries()) {
    const ambiguous = tenantSvcs.find(s =>
      !/arriv[ée]e/i.test(s.nom) && !/d[ée]part/i.test(s.nom)
    );
    const hasArrivee = tenantSvcs.some(s => /arriv[ée]e/i.test(s.nom));
    const hasDepart = tenantSvcs.some(s => /d[ée]part/i.test(s.nom));

    if (!ambiguous) {
      console.log(`[SKIP] ${tenantId}: pas de service ambigu (deja splitte ou absent).`);
      skipCount++;
      continue;
    }

    // Renommer le service ambigu en "- Arrivée" + prix divise par 2 (25EUR au lieu de 40)
    // Et si pas de "- Départ", en creer un
    const halfPrice = Math.round((ambiguous.prix || 4000) / 2);

    if (!hasArrivee) {
      const { error: updErr } = await supabase
        .from('services')
        .update({
          nom: `${ambiguous.nom} - Arrivée`,
          prix: halfPrice,
          facturation: 'forfait',
        })
        .eq('id', ambiguous.id)
        .eq('tenant_id', tenantId);

      if (updErr) {
        console.error(`  [FAIL rename] ${tenantId}: ${updErr.message}`);
        continue;
      }
      console.log(`  [OK] ${tenantId}: renomme "${ambiguous.nom}" → "- Arrivée" (${halfPrice / 100}EUR)`);
    }

    if (!hasDepart) {
      const { error: insErr } = await supabase
        .from('services')
        .insert({
          tenant_id: tenantId,
          nom: `${ambiguous.nom} - Départ`,
          description: null,
          prix: halfPrice,
          duree: 0,
          categorie: ambiguous.categorie || 'option',
          category: ambiguous.category || 'other',
          actif: ambiguous.actif !== false,
          facturation: 'forfait',
          ordre: (ambiguous.ordre || 0) + 1,
          taux_tva: 20,
        });

      if (insErr) {
        console.error(`  [FAIL insert] ${tenantId}: ${insErr.message}`);
        continue;
      }
      console.log(`  [OK] ${tenantId}: cree "- Départ" (${halfPrice / 100}EUR)`);
    }

    splitCount++;
  }

  console.log(`\nRESULTAT: ${splitCount} tenants splittes, ${skipCount} skippés.`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
