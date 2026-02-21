#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  await client.connect();

  // Check tenants table columns
  console.log('=== TENANTS TABLE ===');
  const tenants = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'tenants'
    ORDER BY ordinal_position
  `);
  tenants.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} ${r.is_nullable === 'NO' ? '(required)' : ''}`));

  // Check admin_users table columns
  console.log('\n=== ADMIN_USERS TABLE ===');
  const admins = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'admin_users'
    ORDER BY ordinal_position
  `);
  admins.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} ${r.is_nullable === 'NO' ? '(required)' : ''}`));

  // Check usage_tracking table
  console.log('\n=== USAGE_TRACKING TABLE ===');
  const usage = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'usage_tracking'
    ORDER BY ordinal_position
  `);
  if (usage.rows.length === 0) {
    console.log('  TABLE DOES NOT EXIST');
  } else {
    usage.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} ${r.is_nullable === 'NO' ? '(required)' : ''}`));
  }

  await client.end();
}

check().catch(console.error);
