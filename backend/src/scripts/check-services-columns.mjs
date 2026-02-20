import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('Checking services columns...');

  const { data, error } = await supabase
    .from('services')
    .select('id, nom, taux_tva, taxe_cnaps, taux_cnaps, actif, categorie')
    .limit(2);

  if (error) {
    console.log('Error:', error.message);
    console.log('\n⚠️ Some columns might be missing. Run this SQL in Supabase Dashboard:');
    console.log(`
ALTER TABLE services ADD COLUMN IF NOT EXISTS taux_tva DECIMAL(5,2) DEFAULT 20;
ALTER TABLE services ADD COLUMN IF NOT EXISTS taxe_cnaps BOOLEAN DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS taux_cnaps DECIMAL(5,3) DEFAULT 0.50;
ALTER TABLE services ADD COLUMN IF NOT EXISTS actif BOOLEAN DEFAULT true;
ALTER TABLE services ADD COLUMN IF NOT EXISTS categorie VARCHAR(100);
    `);
  } else {
    console.log('✅ All columns exist!');
    console.log('Sample data:', JSON.stringify(data, null, 2));
  }
}

check();
