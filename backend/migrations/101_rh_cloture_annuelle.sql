-- Migration 101: Cloture annuelle RH

CREATE TABLE IF NOT EXISTS rh_cloture_annuelle (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  annee INTEGER NOT NULL,
  statut VARCHAR(20) DEFAULT 'cloturee',
  snapshot_cumuls JSONB DEFAULT '[]',
  provision_cp JSONB DEFAULT '{}',
  report_cp JSONB DEFAULT '[]',
  verifications JSONB DEFAULT '{}',
  cloture_par TEXT,
  date_cloture TIMESTAMPTZ DEFAULT NOW(),
  rouverte_par TEXT,
  date_reouverture TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT rh_cloture_unique UNIQUE(tenant_id, annee)
);

CREATE INDEX IF NOT EXISTS idx_rh_cloture_tenant ON rh_cloture_annuelle(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_cloture_tenant_annee ON rh_cloture_annuelle(tenant_id, annee);

ALTER TABLE rh_cloture_annuelle ENABLE ROW LEVEL SECURITY;

CREATE POLICY rh_cloture_tenant_isolation ON rh_cloture_annuelle
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));
