/**
 * Run Migration 016 - TVA et CNAPS pour les services
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
dotenv.config({ path: join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('📦 Running migration 016: TVA et CNAPS pour services');

  try {
    // 1. Ajouter taux_tva
    console.log('   Adding taux_tva column...');
    const { error: e1 } = await supabase.rpc('exec_sql', {
      query: "ALTER TABLE services ADD COLUMN IF NOT EXISTS taux_tva DECIMAL(5,2) DEFAULT 20"
    });
    if (e1) console.log('   taux_tva:', e1.message || 'already exists');

    // 2. Ajouter taxe_cnaps
    console.log('   Adding taxe_cnaps column...');
    const { error: e2 } = await supabase.rpc('exec_sql', {
      query: "ALTER TABLE services ADD COLUMN IF NOT EXISTS taxe_cnaps BOOLEAN DEFAULT false"
    });
    if (e2) console.log('   taxe_cnaps:', e2.message || 'already exists');

    // 3. Ajouter taux_cnaps
    console.log('   Adding taux_cnaps column...');
    const { error: e3 } = await supabase.rpc('exec_sql', {
      query: "ALTER TABLE services ADD COLUMN IF NOT EXISTS taux_cnaps DECIMAL(5,3) DEFAULT 0.50"
    });
    if (e3) console.log('   taux_cnaps:', e3.message || 'already exists');

    // 4. Ajouter actif
    console.log('   Adding actif column...');
    const { error: e4 } = await supabase.rpc('exec_sql', {
      query: "ALTER TABLE services ADD COLUMN IF NOT EXISTS actif BOOLEAN DEFAULT true"
    });
    if (e4) console.log('   actif:', e4.message || 'already exists');

    // 5. Ajouter categorie
    console.log('   Adding categorie column...');
    const { error: e5 } = await supabase.rpc('exec_sql', {
      query: "ALTER TABLE services ADD COLUMN IF NOT EXISTS categorie VARCHAR(100)"
    });
    if (e5) console.log('   categorie:', e5.message || 'already exists');

    console.log('✅ Migration 016 completed');
  } catch (err) {
    console.error('❌ Migration error:', err.message);

    // Fallback: Essayer avec une approche directe
    console.log('\n🔄 Trying alternative approach...');

    try {
      // Test de lecture des services pour vérifier la connexion
      const { data, error } = await supabase
        .from('services')
        .select('id, nom, taux_tva, taxe_cnaps, taux_cnaps, actif, categorie')
        .limit(1);

      if (error) {
        console.log('   Column check failed:', error.message);
        console.log('\n⚠️ Please run the migration manually in Supabase Dashboard:');
        console.log('   SQL Editor > New Query > Paste content of migrations/016_services_tva_cnaps.sql');
      } else {
        console.log('✅ Columns already exist! No migration needed.');
        console.log('   Sample data:', data);
      }
    } catch (fallbackErr) {
      console.error('   Fallback error:', fallbackErr.message);
    }
  }
}

runMigration();
