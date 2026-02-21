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

  // Check plans table RLS status
  const result = await client.query(`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE tablename = 'plans'
  `);
  console.log('plans RLS:', result.rows);

  // Check policies on plans
  const policies = await client.query(`
    SELECT policyname, cmd
    FROM pg_policies
    WHERE tablename = 'plans'
  `);
  console.log('plans policies:', policies.rows);

  // Try to select from plans
  const plans = await client.query('SELECT id, nom, actif FROM plans LIMIT 5');
  console.log('plans data:', plans.rows);

  await client.end();
}

check().catch(console.error);
