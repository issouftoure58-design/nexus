import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  console.log('🚀 Running migration 026_rh_documents...\n');

  // Test connection
  const { error: testError } = await supabase.from('rh_membres').select('id').limit(1);
  if (testError) {
    console.error('❌ Erreur connexion Supabase:', testError.message);
    return;
  }
  console.log('✅ Connexion Supabase OK\n');

  // Check if tables already exist
  const { data: existing, error: checkError } = await supabase
    .from('rh_documents')
    .select('id')
    .limit(1);

  if (!checkError) {
    console.log('✅ Les tables documents RH existent déjà!');
    return;
  }

  // Tables don't exist, need to run migration
  console.log('📋 Les tables n\'existent pas encore.');
  console.log('\n👉 Exécutez ce SQL dans le dashboard Supabase:\n');
  console.log('   https://supabase.com/dashboard/project/[PROJECT_ID]/sql/new\n');
  console.log('='.repeat(70));
  console.log(fs.readFileSync('src/migrations/026_rh_documents.sql', 'utf8'));
  console.log('='.repeat(70));
  console.log('\n📝 Instructions:');
  console.log('   1. Allez sur le dashboard Supabase');
  console.log('   2. SQL Editor > New Query');
  console.log('   3. Collez le SQL ci-dessus');
  console.log('   4. Cliquez sur "Run"\n');
}

runMigration().catch(console.error);
