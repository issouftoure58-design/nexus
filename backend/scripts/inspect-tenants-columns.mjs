#!/usr/bin/env node
import 'dotenv/config';
import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const cols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='tenants' ORDER BY ordinal_position");
console.log('Colonnes table tenants:');
cols.rows.forEach((r) => console.log('  -', r.column_name, '(' + r.data_type + ')'));

const sample = await c.query("SELECT id, name, plan, legacy_pricing FROM tenants LIMIT 5");
console.log('\nÉchantillon tenants:');
sample.rows.forEach((r) => console.log('  ', JSON.stringify(r)));

// Check admin_users columns
const acols = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name='admin_users' ORDER BY ordinal_position");
console.log('\nColonnes admin_users:');
acols.rows.forEach((r) => console.log('  -', r.column_name));

await c.end();
