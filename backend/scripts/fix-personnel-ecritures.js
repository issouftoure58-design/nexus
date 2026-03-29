/**
 * Script de correction : Supprimer les ecritures AC en double pour les charges de personnel
 *
 * Probleme : generateDepenseEcritures() creait des ecritures AC (D641/C401SAL, D645/C401COT)
 * pour les depenses salaires/cotisations, ALORS QUE le journal PA genere deja les bonnes
 * ecritures (D641/C421, D645/C431). Resultat : double charge + mauvais comptes.
 *
 * Ce script :
 * 1. Supprime les ecritures AC liees aux depenses salaires/cotisations (doublons)
 * 2. Corrige les ecritures BQ existantes : 401xxx → 421/431
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

async function fixPersonnelEcritures() {
  console.log('=== Correction ecritures charges de personnel ===\n');

  // 1. Recuperer les depenses de type salaires et cotisations_sociales
  const { data: depenses, error: depError } = await supabase
    .from('depenses')
    .select('id, tenant_id, categorie, libelle')
    .in('categorie', ['salaires', 'cotisations_sociales']);

  if (depError) {
    console.error('Erreur recuperation depenses:', depError);
    return;
  }

  const count = depenses ? depenses.length : 0;
  console.log(`${count} depenses personnel trouvees\n`);

  if (count === 0) {
    console.log('Rien a corriger.');
    return;
  }

  let deletedAC = 0;
  let fixedBQ = 0;
  let errors = 0;

  for (const depense of depenses) {
    const compteCorrect = depense.categorie === 'salaires' ? '421' : '431';
    const libelleCorrect = depense.categorie === 'salaires'
      ? 'Personnel - Remunerations dues'
      : 'Securite sociale';

    // Etape 1 : Supprimer les ecritures AC (doublons — PA gere deja la charge)
    const { data: ecrituresAC, error: errListAC } = await supabase
      .from('ecritures_comptables')
      .select('id')
      .eq('depense_id', depense.id)
      .eq('tenant_id', depense.tenant_id)
      .eq('journal_code', 'AC');

    if (errListAC) {
      console.error(`Erreur lecture AC depense ${depense.id}:`, errListAC.message);
      errors++;
      continue;
    }

    if (ecrituresAC?.length > 0) {
      const ids = ecrituresAC.map(e => e.id);
      const { error: errDel } = await supabase
        .from('ecritures_comptables')
        .delete()
        .in('id', ids);

      if (errDel) {
        console.error(`Erreur suppression AC depense ${depense.id}:`, errDel.message);
        errors++;
      } else {
        deletedAC += ecrituresAC.length;
        console.log(`  Depense ${depense.id} (${depense.categorie}): ${ecrituresAC.length} ecritures AC supprimees`);
      }
    }

    // Etape 2 : Corriger les ecritures BQ existantes (401xxx → 421/431)
    const { data: ecrituresBQ401, error: errBQ } = await supabase
      .from('ecritures_comptables')
      .select('id')
      .eq('depense_id', depense.id)
      .eq('tenant_id', depense.tenant_id)
      .eq('journal_code', 'BQ')
      .like('compte_numero', '401%');

    if (errBQ) {
      console.error(`Erreur lecture BQ depense ${depense.id}:`, errBQ.message);
      errors++;
      continue;
    }

    if (ecrituresBQ401?.length > 0) {
      const ids = ecrituresBQ401.map(e => e.id);
      const { error: errUpd } = await supabase
        .from('ecritures_comptables')
        .update({
          compte_numero: compteCorrect,
          compte_libelle: libelleCorrect
        })
        .in('id', ids);

      if (errUpd) {
        console.error(`Erreur update BQ depense ${depense.id}:`, errUpd.message);
        errors++;
      } else {
        fixedBQ += ecrituresBQ401.length;
        console.log(`  Depense ${depense.id} (${depense.categorie}): ${ecrituresBQ401.length} ecritures BQ 401→${compteCorrect}`);
      }
    }
  }

  console.log(`\n=== Resultat ===`);
  console.log(`  ${deletedAC} ecritures AC supprimees (doublons PA)`);
  console.log(`  ${fixedBQ} ecritures BQ corrigees (401→421/431)`);
  console.log(`  ${errors} erreurs`);
}

fixPersonnelEcritures().catch(console.error);
