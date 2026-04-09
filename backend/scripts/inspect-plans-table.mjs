#!/usr/bin/env node
import 'dotenv/config';
import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const cols = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='plans' ORDER BY ordinal_position");
console.log('Colonnes table plans:');
cols.rows.forEach((r) => console.log('  -', r.column_name, '(' + r.data_type + ')'));

const data = await c.query('SELECT * FROM plans LIMIT 20');
console.log('\nLignes (' + data.rows.length + '):');
data.rows.forEach((r) => console.log('  ', JSON.stringify(r)));

await c.end();
