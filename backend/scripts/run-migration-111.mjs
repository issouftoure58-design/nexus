#!/usr/bin/env node
// Apply migration 111_services_facturation.sql
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqlPath = path.join(__dirname, '..', 'migrations', '111_services_facturation.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log('Connected to DB. Running migration 111...\n');

try {
  await client.query(sql);
  console.log('Migration 111 applied successfully.');

  // Verifier le resultat
  const { rows } = await client.query(`
    SELECT facturation, COUNT(*) AS n
    FROM services
    WHERE type_chambre IS NULL
    GROUP BY facturation
    ORDER BY facturation
  `);
  console.log('\nRepartition annexes (non-chambres) par mode facturation:');
  rows.forEach(r => console.log(`  ${r.facturation}: ${r.n}`));
} catch (e) {
  console.error('FAIL:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
