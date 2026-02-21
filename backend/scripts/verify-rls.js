#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  await client.connect();

  const result = await client.query(`
    SELECT tablename, policyname, cmd, permissive
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname
  `);

  console.log('🛡️ POLICIES RLS ACTIVES:\n');

  let currentTable = '';
  for (const row of result.rows) {
    if (row.tablename !== currentTable) {
      currentTable = row.tablename;
      console.log(`📋 ${currentTable}`);
    }
    console.log(`   └─ ${row.policyname} (${row.cmd})`);
  }

  console.log(`\n✅ Total: ${result.rows.length} policies sur ${new Set(result.rows.map(r => r.tablename)).size} tables`);

  await client.end();
}

verify().catch(console.error);
