-- Migration 125: Table rh_dsn_overrides
-- Permet au tenant de surcharger n'importe quelle rubrique DSN
-- sans intervention dev (correction DSN-Val autonome)

CREATE TABLE IF NOT EXISTS rh_dsn_overrides (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rubrique_code VARCHAR(20) NOT NULL,       -- ex: 'S21.G00.40.026'
  valeur VARCHAR(100) NOT NULL,             -- valeur de remplacement
  membre_id INTEGER REFERENCES rh_membres(id) ON DELETE CASCADE,  -- NULL = tous les salariés
  description TEXT,                         -- note libre du tenant
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, rubrique_code, membre_id)
);

-- Contrainte unique pour les surcharges globales (membre_id NULL)
-- PostgreSQL traite NULL comme distinct dans UNIQUE, donc on ajoute un index partiel
CREATE UNIQUE INDEX IF NOT EXISTS idx_rh_dsn_overrides_global
  ON rh_dsn_overrides (tenant_id, rubrique_code)
  WHERE membre_id IS NULL;

ALTER TABLE rh_dsn_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON rh_dsn_overrides
  USING (tenant_id = current_setting('app.tenant_id')::text);
