#!/usr/bin/env node
// Backfill date_fin/date_arrivee/date_depart sur les reservations hotel existantes
// qui ont ete creees avant le fix admin POST /reservations.
//
// Strategie : pour chaque reservation d'un tenant hotel sans date_arrivee,
// on prend date comme date_arrivee et date+1 comme date_depart (defaut 1 nuit).
// L'admin pourra ensuite editer si besoin. Mieux vaut "1 nuit par defaut" que null.
//
// Usage: node scripts/backfill-hotel-resa-dates.mjs

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  // Identifier les tenants hotel
  const { data: tenants, error: tErr } = await supabase
    .from('tenants')
    .select('id, business_profile')
    .eq('business_profile', 'hotel');

  if (tErr) {
    console.error('ERREUR lecture tenants:', tErr);
    process.exit(1);
  }

  console.log(`${tenants.length} tenant(s) hotel identifie(s).\n`);

  let updated = 0;
  let skipped = 0;

  for (const tenant of tenants) {
    // Reservations sans date_arrivee
    const { data: resas, error } = await supabase
      .from('reservations')
      .select('id, date, date_fin, date_arrivee, date_depart, heure, heure_fin')
      .eq('tenant_id', tenant.id)
      .is('date_arrivee', null);

    if (error) {
      console.error(`[${tenant.id}] ERREUR:`, error.message);
      continue;
    }

    if (!resas.length) {
      console.log(`[${tenant.id}] aucune resa a backfiller`);
      continue;
    }

    for (const r of resas) {
      const dateArrivee = r.date;
      // Si date_fin existe, l'utiliser; sinon date + 1
      let dateDepart = r.date_fin;
      if (!dateDepart) {
        const d = new Date(r.date);
        d.setDate(d.getDate() + 1);
        dateDepart = d.toISOString().slice(0, 10);
      }

      const updates = {
        date_arrivee: dateArrivee,
        date_depart: dateDepart,
      };
      if (!r.date_fin) updates.date_fin = dateDepart;
      if (!r.heure_fin) updates.heure_fin = '11:00';

      const { error: updErr } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', r.id)
        .eq('tenant_id', tenant.id);

      if (updErr) {
        console.error(`  [FAIL] resa ${r.id}: ${updErr.message}`);
        continue;
      }

      console.log(`  [OK] resa ${r.id}: ${dateArrivee} -> ${dateDepart}`);
      updated++;
    }

    skipped += resas.length - updated;
  }

  console.log(`\nRESULTAT: ${updated} resas backfillees.`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
