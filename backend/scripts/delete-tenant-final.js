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

async function run() {
  await client.connect();
  const result = await client.query("DELETE FROM tenants WHERE id = $1", [TENANT_ID]);
  console.log(`✅ tenants: ${result.rowCount} supprime`);
  await client.end();
}

run().catch(console.error);
