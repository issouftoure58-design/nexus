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

  // Get all columns of plans table
  const result = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'plans'
    ORDER BY ordinal_position
  `);
  console.log('plans columns:');
  result.rows.forEach(r => console.log(`  - ${r.column_name}: ${r.data_type}`));

  await client.end();
}

check().catch(console.error);
