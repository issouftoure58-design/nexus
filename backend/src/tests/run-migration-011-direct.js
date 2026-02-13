/**
 * Migration 011 - Direct SQL via pg
 */

import '../config/env.js';
import pg from 'pg';

const { Pool } = pg;

// Supabase connection (via pooler)
const connectionString = process.env.DATABASE_URL ||
  `postgresql://postgres.mmivralzwcmriciprfbc:${process.env.SUPABASE_DB_PASSWORD}@aws-0-eu-west-3.pooler.supabase.com:6543/postgres`;

const MIGRATION_SQL = `
-- Migration 011: RH Equipe (Business Plan)

-- Table des membres d'equipe
CREATE TABLE IF NOT EXISTS rh_membres (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT,
  telephone TEXT,
  role TEXT NOT NULL,
  statut TEXT DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'conge')),
  date_embauche DATE,
  notes TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des performances
CREATE TABLE IF NOT EXISTS rh_performances (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membre_id INTEGER NOT NULL REFERENCES rh_membres(id) ON DELETE CASCADE,
  periode TEXT NOT NULL,
  ca_genere DECIMAL(10,2) DEFAULT 0,
  rdv_realises INTEGER DEFAULT 0,
  taux_conversion DECIMAL(5,2) DEFAULT 0,
  clients_acquis INTEGER DEFAULT 0,
  note_satisfaction DECIMAL(3,2) DEFAULT 0,
  objectif_atteint BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des absences
CREATE TABLE IF NOT EXISTS rh_absences (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membre_id INTEGER NOT NULL REFERENCES rh_membres(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('conge', 'maladie', 'formation', 'autre')),
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuve', 'refuse')),
  motif TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_rh_membres_tenant ON rh_membres(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_membres_statut ON rh_membres(statut) WHERE statut = 'actif';
CREATE INDEX IF NOT EXISTS idx_rh_membres_role ON rh_membres(role);
CREATE INDEX IF NOT EXISTS idx_rh_performances_tenant ON rh_performances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_performances_membre ON rh_performances(membre_id);
CREATE INDEX IF NOT EXISTS idx_rh_performances_periode ON rh_performances(periode DESC);
CREATE INDEX IF NOT EXISTS idx_rh_absences_tenant ON rh_absences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_absences_membre ON rh_absences(membre_id);
CREATE INDEX IF NOT EXISTS idx_rh_absences_dates ON rh_absences(date_debut, date_fin);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_rh_membres_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_rh_membres_updated_at ON rh_membres;
CREATE TRIGGER trigger_rh_membres_updated_at
  BEFORE UPDATE ON rh_membres
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_membres_updated_at();
`;

async function runMigration() {
  console.log('\\n=== MIGRATION 011: RH Equipe ===\\n');

  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DB_PASSWORD) {
    console.error('ERROR: DATABASE_URL ou SUPABASE_DB_PASSWORD requis');
    console.log('\\nAjoutez dans .env:');
    console.log('DATABASE_URL=postgresql://postgres.mmivralzwcmriciprfbc:VOTRE_PASSWORD@aws-0-eu-west-3.pooler.supabase.com:6543/postgres');
    console.log('\\nOu: SUPABASE_DB_PASSWORD=votre_password');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });

  try {
    console.log('Connexion a la base de donnees...');
    const client = await pool.connect();

    console.log('Execution de la migration...');
    await client.query(MIGRATION_SQL);

    console.log('\\nVerification des tables...');
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('rh_membres', 'rh_performances', 'rh_absences')
    `);

    for (const row of result.rows) {
      console.log(`  OK: ${row.table_name}`);
    }

    client.release();
    console.log('\\n=== MIGRATION TERMINEE ===');

  } catch (err) {
    console.error('Erreur:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
