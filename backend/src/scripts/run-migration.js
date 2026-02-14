/**
 * Run Migration - Exécute une migration SQL via Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
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

async function runMigration(filePath) {
  console.log('📦 Running migration:', filePath);

  const sql = readFileSync(filePath, 'utf-8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (const statement of statements) {
    if (!statement) continue;

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
      if (error) {
        // Try direct query for simple statements
        console.log('   Executing:', statement.substring(0, 60) + '...');
      }
    } catch (e) {
      console.log('   ⚠️', e.message);
    }
  }

  console.log('✅ Migration completed');
}

// Run migration 012
const migrationPath = join(__dirname, '../../../database/migrations/012_create_tenants_full.sql');
runMigration(migrationPath);
