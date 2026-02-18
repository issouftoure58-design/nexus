import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('Running migration 005_relances_contentieux...\n');

  // Test de connexion
  const { data: test, error: testError } = await supabase
    .from('factures')
    .select('id')
    .limit(1);

  if (testError) {
    console.error('Erreur connexion Supabase:', testError.message);
    return;
  }
  console.log('Connexion Supabase OK\n');

  // Vérifier si les colonnes existent déjà
  const { data: facture, error } = await supabase
    .from('factures')
    .select('en_contentieux')
    .limit(1);

  if (error && error.message.includes('column')) {
    console.log('Les colonnes contentieux n\'existent pas encore.');
    console.log('\n📋 Exécutez ce SQL dans le dashboard Supabase:\n');
    console.log('='.repeat(60));
    console.log(fs.readFileSync('src/migrations/005_relances_contentieux.sql', 'utf8'));
    console.log('='.repeat(60));
    console.log('\n👉 Supabase Dashboard > SQL Editor > New Query > Coller & Run');
  } else {
    console.log('✅ Les colonnes contentieux existent déjà!');

    // Vérifier les valeurs
    const { data: stats } = await supabase
      .from('factures')
      .select('id, en_contentieux, niveau_relance')
      .not('statut', 'in', '("payee","annulee")')
      .limit(5);

    console.log('\nExemple de factures:', stats);
  }
}

runMigration().catch(console.error);
