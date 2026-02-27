/**
 * Script de migration : Corriger les écritures des charges de personnel
 * - Changer journal AC → PA
 * - Changer compte 401 → 421 (salaires) ou 431 (cotisations)
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
  console.log('🔧 Migration des écritures charges de personnel...\n');

  // Récupérer les dépenses de type salaires et cotisations_sociales
  const { data: depenses, error: depError } = await supabase
    .from('depenses')
    .select('id, tenant_id, categorie')
    .in('categorie', ['salaires', 'cotisations_sociales']);

  if (depError) {
    console.error('Erreur récupération dépenses:', depError);
    return;
  }

  const count = depenses ? depenses.length : 0;
  console.log(`📋 ${count} dépenses personnel trouvées\n`);

  let updated = 0;
  let errors = 0;

  for (const depense of depenses || []) {
    const newJournal = 'PA';
    const newCompte = depense.categorie === 'salaires' ? '421' : '431';
    const newLibelle = depense.categorie === 'salaires'
      ? 'Personnel - Rémunérations dues'
      : 'Sécurité sociale';

    // Mettre à jour le journal pour toutes les écritures de cette dépense
    const { error: journalError } = await supabase
      .from('ecritures_comptables')
      .update({ journal_code: newJournal })
      .eq('depense_id', depense.id)
      .eq('tenant_id', depense.tenant_id)
      .eq('journal_code', 'AC');

    if (journalError) {
      console.error(`❌ Erreur journal dépense ${depense.id}:`, journalError.message);
      errors++;
      continue;
    }

    // Mettre à jour le compte 401xxx → 421/431
    const { error: compteError } = await supabase
      .from('ecritures_comptables')
      .update({
        compte_numero: newCompte,
        compte_libelle: newLibelle
      })
      .eq('depense_id', depense.id)
      .eq('tenant_id', depense.tenant_id)
      .like('compte_numero', '401%');

    if (compteError) {
      console.error(`❌ Erreur compte dépense ${depense.id}:`, compteError.message);
      errors++;
      continue;
    }

    updated++;
    console.log(`✅ Dépense ${depense.id} (${depense.categorie}) → Journal PA, Compte ${newCompte}`);
  }

  console.log(`\n📊 Résultat: ${updated} mises à jour, ${errors} erreurs`);
}

fixPersonnelEcritures().catch(console.error);
