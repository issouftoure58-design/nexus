#!/usr/bin/env node
import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log('Connected to database.\n');

const sqls = [
  'ALTER TABLE sentinel_logic_tests ADD COLUMN IF NOT EXISTS auto_fixed BOOLEAN DEFAULT false',
  'ALTER TABLE sentinel_logic_tests ADD COLUMN IF NOT EXISTS fix_description TEXT',
  'ALTER TABLE loyalty_transactions ADD COLUMN IF NOT EXISTS balance_after INTEGER DEFAULT 0',
  "DELETE FROM sentinel_logic_tests WHERE category IN ('integrity', 'scenario', 'ia', 'edge_case')",
  "DELETE FROM sentinel_logic_runs WHERE run_type IN ('passive', 'active', 'ia', 'edge_case')",
];

for (const sql of sqls) {
  try {
    const res = await client.query(sql);
    const rows = res.rowCount != null ? ` (${res.rowCount} rows)` : '';
    console.log(`OK: ${sql.substring(0, 80)}${rows}`);
  } catch (e) {
    console.error(`FAIL: ${sql.substring(0, 80)} — ${e.message}`);
  }
}

await client.end();
console.log('\nMigration terminee.');
