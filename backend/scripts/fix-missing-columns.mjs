import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const migrations = [
  {
    name: 'relance_24h_envoyee on reservations',
    sql: `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS relance_24h_envoyee BOOLEAN DEFAULT FALSE;`
  },
  {
    name: 'index on relance_24h_envoyee',
    sql: `CREATE INDEX IF NOT EXISTS idx_reservations_relance_24h ON reservations(relance_24h_envoyee) WHERE relance_24h_envoyee = FALSE;`
  }
];

async function run() {
  console.log('🔧 Correction des colonnes manquantes...\n');

  const client = await pool.connect();

  try {
    for (const migration of migrations) {
      try {
        await client.query(migration.sql);
        console.log(`✅ ${migration.name}`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`⏭️  Déjà existant: ${migration.name}`);
        } else {
          console.log(`❌ Erreur ${migration.name}: ${err.message}`);
        }
      }
    }

    // Vérifier les tables usage
    console.log('\n📊 Vérification tables usage...');

    const tablesCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('usage_events', 'usage_monthly', 'tenant_phone_numbers')
    `);

    for (const row of tablesCheck.rows) {
      console.log(`✅ Table ${row.table_name} existe`);
    }

    const missing = ['usage_events', 'usage_monthly', 'tenant_phone_numbers']
      .filter(t => !tablesCheck.rows.find(r => r.table_name === t));

    if (missing.length > 0) {
      console.log(`\n⚠️ Tables manquantes: ${missing.join(', ')}`);
      console.log('Exécutez: node scripts/create-usage-tables.mjs');
    }

    console.log('\n✅ Migration terminée !');
    console.log('\n💡 Note: Pour rafraîchir le cache Supabase, redémarrez le backend ou attendez quelques minutes.');

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
