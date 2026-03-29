CREATE TABLE rapprochements_bancaires (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  periode VARCHAR(7) NOT NULL,
  date_rapprochement DATE NOT NULL,
  solde_releve_debut DECIMAL(12,2),
  solde_releve_fin DECIMAL(12,2),
  solde_512_cumule DECIMAL(12,2),
  solde_rapproche DECIMAL(12,2),
  ecart DECIMAL(12,2) DEFAULT 0,
  nb_pointees INTEGER DEFAULT 0,
  nb_creees INTEGER DEFAULT 0,
  nb_471 INTEGER DEFAULT 0,
  nb_non_matchees INTEGER DEFAULT 0,
  rapport_json JSONB,
  valide BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, periode)
);

CREATE INDEX idx_rappro_tenant_periode ON rapprochements_bancaires(tenant_id, periode);

ALTER TABLE rapprochements_bancaires ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_rapprochements_bancaires" ON rapprochements_bancaires
  USING (tenant_id = current_setting('app.tenant_id', true));
