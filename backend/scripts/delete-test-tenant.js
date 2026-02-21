#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const TENANT_ID = 'nouveau-salon-test';

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function deleteTenant() {
  await client.connect();
  console.log(`🗑️  Suppression tenant: ${TENANT_ID}\n`);

  // Delete in correct order (foreign keys)
  const tables = [
    'usage_tracking',
    'admin_users',
    'tenants'
  ];

  for (const table of tables) {
    const result = await client.query(
      `DELETE FROM ${table} WHERE tenant_id = $1`,
      [TENANT_ID]
    );
    console.log(`  ${table}: ${result.rowCount} supprime(s)`);
  }

  console.log(`\n✅ Tenant ${TENANT_ID} supprime`);
  await client.end();
}

deleteTenant().catch(console.error);
