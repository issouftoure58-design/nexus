-- PLTE v2 Migration
-- Ajouter colonnes self-healing + purger anciennes donnees v1

-- Colonnes self-healing
ALTER TABLE sentinel_logic_tests ADD COLUMN IF NOT EXISTS auto_fixed BOOLEAN DEFAULT false;
ALTER TABLE sentinel_logic_tests ADD COLUMN IF NOT EXISTS fix_description TEXT;

-- Purge anciennes donnees v1 (categories obsoletes)
DELETE FROM sentinel_logic_tests WHERE category IN ('integrity', 'scenario', 'ia', 'edge_case');
DELETE FROM sentinel_logic_runs WHERE run_type IN ('passive', 'active', 'ia', 'edge_case');

-- Tables pour hotel (si non existantes)
CREATE TABLE IF NOT EXISTS hotel_chambres (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  type TEXT DEFAULT 'simple',
  capacite INTEGER DEFAULT 1,
  prix_nuit INTEGER DEFAULT 0,
  etage INTEGER DEFAULT 1,
  statut TEXT DEFAULT 'disponible',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, numero)
);

ALTER TABLE hotel_chambres ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "hotel_chambres_tenant_isolation" ON hotel_chambres
  USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY IF NOT EXISTS "hotel_chambres_service_role" ON hotel_chambres
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tables pour restaurant
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  capacite INTEGER DEFAULT 2,
  zone TEXT DEFAULT 'salle',
  statut TEXT DEFAULT 'libre',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, numero)
);

ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "restaurant_tables_tenant_isolation" ON restaurant_tables
  USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY IF NOT EXISTS "restaurant_tables_service_role" ON restaurant_tables
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tables pour securite
CREATE TABLE IF NOT EXISTS security_sites (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  adresse TEXT,
  type_site TEXT DEFAULT 'bureau',
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, nom)
);

ALTER TABLE security_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "security_sites_tenant_isolation" ON security_sites
  USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY IF NOT EXISTS "security_sites_service_role" ON security_sites
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tables pour domicile
CREATE TABLE IF NOT EXISTS zones_intervention (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  rayon_km INTEGER DEFAULT 10,
  frais_deplacement INTEGER DEFAULT 0,
  code_postal TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, nom)
);

ALTER TABLE zones_intervention ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "zones_intervention_tenant_isolation" ON zones_intervention
  USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY IF NOT EXISTS "zones_intervention_service_role" ON zones_intervention
  FOR ALL TO service_role USING (true) WITH CHECK (true);
