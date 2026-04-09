#!/usr/bin/env node
/**
 * Exécute les migrations 104, 105 et 106 en séquence sur la prod Supabase.
 * Chaque migration est appliquée dans une transaction. Si une migration échoue,
 * le script s'arrête (mais les migrations précédentes restent appliquées).
 */
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATIONS = [
  '104_pricing_2026_credits.sql',
  '105_signup_phone_verification.sql',
  '106_grandfathering_email_tracking.sql',
];

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log('Connected to database.\n');

for (const filename of MIGRATIONS) {
  const filepath = resolve(__dirname, '../migrations', filename);
  const sql = readFileSync(filepath, 'utf-8');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  ${filename} — ${sql.split('\n').length} lignes`);
  console.log('═══════════════════════════════════════════════════════════════');

  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`✓ ${filename} appliquée avec succès\n`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`✗ ${filename} ÉCHEC : ${e.message}`);
    console.error(`   (transaction annulée — migrations précédentes restent appliquées)\n`);
    await client.end();
    process.exit(1);
  }
}

// Vérifications post-migration
console.log('═══════════════════════════════════════════════════════════════');
console.log('  VÉRIFICATIONS POST-MIGRATION');
console.log('═══════════════════════════════════════════════════════════════\n');

const checks = [
  { label: 'plans free/basic/business existent', sql: "SELECT id, prix_mensuel, deprecated FROM plans WHERE id IN ('free','basic','business') ORDER BY id" },
  { label: 'plans starter/pro deprecated', sql: "SELECT id, deprecated FROM plans WHERE id IN ('starter','pro') ORDER BY id" },
  { label: 'table ai_credits remplie', sql: "SELECT COUNT(*) FROM ai_credits" },
  { label: 'tenants marqués legacy_pricing', sql: "SELECT COUNT(*) FROM tenants WHERE legacy_pricing = TRUE" },
  { label: 'colonne grandfathering_email_sent_at existe', sql: "SELECT column_name FROM information_schema.columns WHERE table_name='tenants' AND column_name='grandfathering_email_sent_at'" },
  { label: 'table signup_phone_verifications existe', sql: "SELECT to_regclass('public.signup_phone_verifications') IS NOT NULL AS exists" },
];

for (const c of checks) {
  try {
    const r = await client.query(c.sql);
    console.log(`✓ ${c.label}`);
    r.rows.forEach((row) => console.log(`   ${JSON.stringify(row)}`));
  } catch (e) {
    console.log(`✗ ${c.label} — ${e.message}`);
  }
}

await client.end();
console.log('\nMigrations terminées avec succès.');
