#!/usr/bin/env node
/**
 * Exécute la migration 106 (grandfathering_email_tracking) directement
 * sur la prod Supabase via DATABASE_URL.
 */
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = resolve(__dirname, '../migrations/106_grandfathering_email_tracking.sql');
const sql = readFileSync(sqlPath, 'utf-8');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log('Connected to database.\n');
console.log(`Executing: 106_grandfathering_email_tracking.sql\n`);

try {
  const res = await client.query(sql);
  console.log(`OK — migration 106 appliquée.`);
  if (res.rowCount != null) console.log(`   ${res.rowCount} rows affected.`);
} catch (e) {
  console.error(`FAIL: ${e.message}`);
  await client.end();
  process.exit(1);
}

// Vérifier que la colonne existe
const check = await client.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'tenants'
    AND column_name = 'grandfathering_email_sent_at'
`);

if (check.rows.length > 0) {
  console.log(`\n✓ Colonne créée :`, check.rows[0]);
} else {
  console.log(`\n⚠️  Colonne non trouvée après migration ?!`);
}

// Vérifier l'index
const idx = await client.query(`
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'tenants'
    AND indexname = 'idx_tenants_grandfathering_pending'
`);
console.log(`✓ Index créé :`, idx.rows[0]?.indexname || 'NON TROUVÉ');

await client.end();
console.log('\nDone.');
