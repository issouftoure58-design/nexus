import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Connexion directe à PostgreSQL via DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sql = `
-- Table des événements d'usage
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL DEFAULT 1,
  month VARCHAR(7) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_tenant ON usage_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_month ON usage_events(month);
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_month ON usage_events(tenant_id, month);

-- Table des compteurs mensuels
CREATE TABLE IF NOT EXISTS usage_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(50) NOT NULL,
  month VARCHAR(7) NOT NULL,
  telephone_used INTEGER DEFAULT 0,
  whatsapp_used INTEGER DEFAULT 0,
  web_used INTEGER DEFAULT 0,
  ia_used INTEGER DEFAULT 0,
  telephone_limit INTEGER DEFAULT 300,
  whatsapp_limit INTEGER DEFAULT 1000,
  web_limit INTEGER DEFAULT 5000,
  ia_limit INTEGER DEFAULT 100000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, month)
);

CREATE INDEX IF NOT EXISTS idx_usage_monthly_tenant ON usage_monthly(tenant_id);

-- Table des numéros de téléphone
CREATE TABLE IF NOT EXISTS tenant_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(50) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  twilio_sid VARCHAR(50),
  type VARCHAR(20) DEFAULT 'voice',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_tenant_phones_tenant ON tenant_phone_numbers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_phones_number ON tenant_phone_numbers(phone_number);

-- Colonnes téléphone sur tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone_twilio_sid VARCHAR(50);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30);
`;

async function run() {
  console.log('🚀 Création des tables usage tracking...\n');

  const client = await pool.connect();

  try {
    // Exécuter chaque statement séparément
    const statements = sql.split(';').filter(s => s.trim());

    for (const stmt of statements) {
      if (!stmt.trim()) continue;

      try {
        await client.query(stmt);
        const match = stmt.match(/(?:TABLE|INDEX).*?(\w+)/i);
        if (match) {
          console.log(`✅ ${match[0].substring(0, 50)}...`);
        }
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`⏭️  Déjà existant: ${err.message.substring(0, 50)}`);
        } else {
          console.log(`⚠️  ${err.message.substring(0, 60)}`);
        }
      }
    }

    console.log('\n✅ Migration terminée !');

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
