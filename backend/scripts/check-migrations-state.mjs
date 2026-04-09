#!/usr/bin/env node
/**
 * Vérifie quelles migrations 104/105/106 sont appliquées en prod.
 */
import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const checks = [
  {
    name: '104 — table ai_credits',
    sql: "SELECT to_regclass('public.ai_credits') AS exists",
    pass: (r) => r.rows[0].exists !== null,
  },
  {
    name: '104 — table ai_credits_transactions',
    sql: "SELECT to_regclass('public.ai_credits_transactions') AS exists",
    pass: (r) => r.rows[0].exists !== null,
  },
  {
    name: '104 — colonne tenants.legacy_pricing',
    sql: "SELECT column_name FROM information_schema.columns WHERE table_name='tenants' AND column_name='legacy_pricing'",
    pass: (r) => r.rows.length > 0,
  },
  {
    name: '104 — colonne tenants.pricing_migrated_at',
    sql: "SELECT column_name FROM information_schema.columns WHERE table_name='tenants' AND column_name='pricing_migrated_at'",
    pass: (r) => r.rows.length > 0,
  },
  {
    name: '104 — plans free/basic/business présents',
    sql: "SELECT plan_id FROM plans WHERE plan_id IN ('free','basic','business')",
    pass: (r) => r.rows.length === 3,
  },
  {
    name: '105 — table signup_phone_verifications',
    sql: "SELECT to_regclass('public.signup_phone_verifications') AS exists",
    pass: (r) => r.rows[0].exists !== null,
  },
  {
    name: '106 — colonne tenants.grandfathering_email_sent_at',
    sql: "SELECT column_name FROM information_schema.columns WHERE table_name='tenants' AND column_name='grandfathering_email_sent_at'",
    pass: (r) => r.rows.length > 0,
  },
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('  ÉTAT DES MIGRATIONS 104 / 105 / 106 EN PROD');
console.log('═══════════════════════════════════════════════════════════════\n');

for (const c of checks) {
  try {
    const r = await client.query(c.sql);
    const ok = c.pass(r);
    console.log(`${ok ? '✓' : '✗'}  ${c.name}`);
  } catch (e) {
    console.log(`✗  ${c.name} — erreur: ${e.message}`);
  }
}

// Bonus : compter les tenants par plan
console.log('\n--- Tenants par plan ---');
try {
  const r = await client.query("SELECT plan, COUNT(*) FROM tenants GROUP BY plan ORDER BY plan");
  r.rows.forEach((row) => console.log(`  ${row.plan}: ${row.count}`));
} catch (e) {
  console.log(`  erreur: ${e.message}`);
}

await client.end();
