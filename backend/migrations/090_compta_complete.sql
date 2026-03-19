-- ============================================================
-- Migration 090: Module Comptabilité Complet
-- Exercices, périodes, modèles, imports, ISCA, Factur-X
-- ============================================================

-- 1. Exercices comptables
CREATE TABLE IF NOT EXISTS exercices_comptables (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code VARCHAR(20) NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'ouvert', -- ouvert, cloture_provisoire, cloture
  date_cloture TIMESTAMP,
  cloture_par TEXT,
  resultat_net INTEGER DEFAULT 0, -- centimes
  resultat_type VARCHAR(10), -- benefice / perte
  an_generes BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- 2. Périodes comptables (verrouillage mensuel)
CREATE TABLE IF NOT EXISTS periodes_comptables (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  exercice_id INTEGER NOT NULL REFERENCES exercices_comptables(id),
  periode VARCHAR(7) NOT NULL, -- YYYY-MM
  verrouillee BOOLEAN DEFAULT false,
  date_verrouillage TIMESTAMP,
  verrouille_par TEXT,
  UNIQUE(tenant_id, periode)
);

-- 3. Modèles d'écritures récurrentes
CREATE TABLE IF NOT EXISTS modeles_ecritures (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  journal_code VARCHAR(5) NOT NULL DEFAULT 'OD',
  lignes JSONB NOT NULL,
  recurrence VARCHAR(20), -- mensuel, trimestriel, annuel, null
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, nom)
);

-- 4. Historique imports comptables
CREATE TABLE IF NOT EXISTS imports_comptables (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  type VARCHAR(20) NOT NULL, -- fec, csv, soldes_ouverture
  filename VARCHAR(255),
  nb_ecritures INTEGER DEFAULT 0,
  nb_comptes_crees INTEGER DEFAULT 0,
  statut VARCHAR(20) DEFAULT 'termine',
  erreurs JSONB,
  importe_par TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Chaîne inaltérabilité ISCA
CREATE TABLE IF NOT EXISTS factures_hash_chain (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  facture_id INTEGER NOT NULL,
  hash_sha256 VARCHAR(64) NOT NULL,
  previous_hash VARCHAR(64),
  sequence_num INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, facture_id),
  UNIQUE(tenant_id, sequence_num)
);

-- 6. Piste d'audit factures
CREATE TABLE IF NOT EXISTS factures_audit_trail (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  facture_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL,
  admin_id TEXT,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. Snapshots archivage périodique
CREATE TABLE IF NOT EXISTS factures_snapshots (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  periode VARCHAR(7) NOT NULL, -- YYYY-MM
  hash_global VARCHAR(64) NOT NULL,
  nb_factures INTEGER NOT NULL,
  data_snapshot JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, periode)
);

-- 8. ALTERs sur tables existantes
ALTER TABLE ecritures_comptables ADD COLUMN IF NOT EXISTS justificatif_url TEXT;
ALTER TABLE ecritures_comptables ADD COLUMN IF NOT EXISTS contrepassation_de INTEGER;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS facturx_xml TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS facturx_profile VARCHAR(20);
ALTER TABLE factures ADD COLUMN IF NOT EXISTS hash_sha256 VARCHAR(64);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS siren VARCHAR(9);

-- 9. Index
CREATE INDEX IF NOT EXISTS idx_exercices_tenant ON exercices_comptables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_exercices_statut ON exercices_comptables(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_periodes_tenant ON periodes_comptables(tenant_id, periode);
CREATE INDEX IF NOT EXISTS idx_periodes_exercice ON periodes_comptables(exercice_id);
CREATE INDEX IF NOT EXISTS idx_hash_chain_tenant ON factures_hash_chain(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hash_chain_seq ON factures_hash_chain(tenant_id, sequence_num);
CREATE INDEX IF NOT EXISTS idx_audit_trail_facture ON factures_audit_trail(tenant_id, facture_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_date ON factures_audit_trail(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_modeles_tenant ON modeles_ecritures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_imports_tenant ON imports_comptables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_tenant ON factures_snapshots(tenant_id, periode);

-- 10. RLS
ALTER TABLE exercices_comptables ENABLE ROW LEVEL SECURITY;
ALTER TABLE periodes_comptables ENABLE ROW LEVEL SECURITY;
ALTER TABLE modeles_ecritures ENABLE ROW LEVEL SECURITY;
ALTER TABLE imports_comptables ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures_hash_chain ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE factures_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies (service_role bypass, authenticated filtre par tenant)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'exercices_comptables', 'periodes_comptables', 'modeles_ecritures',
    'imports_comptables', 'factures_hash_chain', 'factures_audit_trail', 'factures_snapshots'
  ])
  LOOP
    EXECUTE format('
      CREATE POLICY IF NOT EXISTS %I ON %I FOR ALL TO authenticated
      USING (tenant_id = current_setting(''app.tenant_id'', true))
      WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))
    ', 'tenant_isolation_' || tbl, tbl);
  END LOOP;
END $$;
