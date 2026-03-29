/**
 * Script de correction : Ajouter les ecritures TVA deductible (44566) manquantes
 *
 * Probleme : certaines depenses ont montant HT != montant TTC (TVA 20%) mais
 * le champ montant_tva n'est pas renseigne, donc l'ecriture D44566 est skippee.
 * Resultat : D charge(HT) / C 401(TTC) → desequilibre.
 *
 * Ce script ajoute D44566 = TTC - HT pour chaque depense concernee.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixTVAManquante() {
  console.log('=== Correction ecritures TVA deductible manquantes ===\n');

  // Trouver les depenses ou TTC > HT (donc TVA implicite) et pas de montant_tva
  const { data: depenses, error: depErr } = await supabase
    .from('depenses')
    .select('id, tenant_id, categorie, libelle, montant, montant_ttc, montant_tva, date_depense, description, deductible_tva');

  if (depErr) {
    console.error('Erreur:', depErr);
    return;
  }

  // Filtrer : celles ou TTC > HT et pas de montant_tva et pas de salaires/cotisations
  const aCorreger = (depenses || []).filter(d => {
    if (['salaires', 'cotisations_sociales'].includes(d.categorie)) return false;
    const ttc = d.montant_ttc || d.montant || 0;
    const ht = d.montant || ttc;
    const tva = d.montant_tva || 0;
    return ttc > ht && tva === 0 && d.deductible_tva !== false;
  });

  console.log(`${aCorreger.length} depenses avec TVA manquante trouvees\n`);

  let created = 0;
  let errors = 0;

  for (const dep of aCorreger) {
    const ttc = dep.montant_ttc || dep.montant || 0;
    const ht = dep.montant || ttc;
    const tva = ttc - ht;
    const periode = dep.date_depense?.slice(0, 7);
    const exercice = parseInt(dep.date_depense?.slice(0, 4)) || new Date().getFullYear();

    // Verifier si une ecriture 44566 existe deja pour cette depense
    const { data: existante } = await supabase
      .from('ecritures_comptables')
      .select('id')
      .eq('depense_id', dep.id)
      .eq('tenant_id', dep.tenant_id)
      .eq('compte_numero', '44566');

    if (existante?.length > 0) {
      console.log(`  Depense ${dep.id} (${dep.libelle}) — 44566 deja present, skip`);
      continue;
    }

    // Trouver le numero_piece utilise pour cette depense
    const { data: ecrituresExist } = await supabase
      .from('ecritures_comptables')
      .select('numero_piece')
      .eq('depense_id', dep.id)
      .eq('tenant_id', dep.tenant_id)
      .eq('journal_code', 'AC')
      .limit(1);

    const numeroPiece = ecrituresExist?.[0]?.numero_piece || `DEP-${dep.id}`;

    // Creer l'ecriture TVA deductible
    const { error: insertErr } = await supabase
      .from('ecritures_comptables')
      .insert({
        tenant_id: dep.tenant_id,
        journal_code: 'AC',
        date_ecriture: dep.date_depense,
        numero_piece: numeroPiece,
        compte_numero: '44566',
        compte_libelle: 'TVA deductible',
        libelle: `TVA ${dep.libelle || dep.categorie}`,
        debit: tva,
        credit: 0,
        depense_id: dep.id,
        periode,
        exercice
      });

    if (insertErr) {
      console.error(`  Erreur depense ${dep.id}:`, insertErr.message);
      errors++;
    } else {
      created++;
      console.log(`  Depense ${dep.id} (${dep.libelle}) — D44566 ${(tva / 100).toFixed(2)} EUR ajoute`);
    }

    // Aussi mettre a jour montant_tva dans la table depenses
    await supabase
      .from('depenses')
      .update({ montant_tva: tva })
      .eq('id', dep.id)
      .eq('tenant_id', dep.tenant_id);
  }

  console.log(`\n=== Resultat ===`);
  console.log(`  ${created} ecritures 44566 creees`);
  console.log(`  ${errors} erreurs`);
}

fixTVAManquante().catch(console.error);
