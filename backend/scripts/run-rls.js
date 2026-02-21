#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const TABLES = [
  'services',
  'clients',
  'reservations',
  'factures',
  'conversations',
  'admin_users',
  'branding',
  'reviews',
  'horaires_hebdo',
  'social_posts'
];

async function run() {
  console.log('🛡️ ACTIVATION RLS...\n');

  await client.connect();

  for (const table of TABLES) {
    try {
      // Enable RLS
      await client.query(`ALTER TABLE IF EXISTS ${table} ENABLE ROW LEVEL SECURITY`);

      // Drop old policies
      await client.query(`DROP POLICY IF EXISTS service_full_access_${table} ON ${table}`);

      // Create service_role policy (full access)
      await client.query(`
        CREATE POLICY service_full_access_${table} ON ${table}
        FOR ALL TO service_role USING (true)
      `);

      console.log(`✅ ${table}: RLS activé`);
    } catch (err) {
      if (err.message.includes('does not exist')) {
        console.log(`⏭️  ${table}: table n'existe pas`);
      } else {
        console.log(`❌ ${table}: ${err.message}`);
      }
    }
  }

  // Verification
  const result = await client.query(`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity = true
    ORDER BY tablename
  `);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TABLES AVEC RLS ACTIVÉ:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  result.rows.forEach(r => console.log(`   ✅ ${r.tablename}`));
  console.log(`\nTotal: ${result.rows.length} tables protégées`);

  await client.end();
}

run().catch(err => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
