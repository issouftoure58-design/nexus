-- ═══════════════════════════════════════════════════════════
-- CRM AVANCE - SEGMENTATION CLIENTS
-- Migration SQL pour tables segments, tags, client_tags
-- Date: 17 fevrier 2026
-- ═══════════════════════════════════════════════════════════

-- Table segments clients
CREATE TABLE IF NOT EXISTS segments_clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  nom TEXT NOT NULL,
  description TEXT,

  -- Criteres de segmentation (JSONB flexible)
  criteres JSONB NOT NULL DEFAULT '{}',
  /* Exemples criteres :
  {
    "ca_min": 500,
    "ca_max": 5000,
    "nb_rdv_min": 3,
    "derniere_visite_jours_max": 90,
    "tags": ["vip", "fidele"],
    "services": ["service-id-1", "service-id-2"],
    "statut": "actif"
  }
  */

  -- Auto-update
  auto_update BOOLEAN DEFAULT true,

  -- Metadonnees
  nb_clients INTEGER DEFAULT 0,
  derniere_mise_a_jour TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segments_tenant ON segments_clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_segments_criteres ON segments_clients USING GIN (criteres);

-- Table tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  nom TEXT NOT NULL,
  couleur TEXT DEFAULT '#3B82F6', -- Bleu par defaut
  description TEXT,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, nom)
);

CREATE INDEX IF NOT EXISTS idx_tags_tenant ON tags(tenant_id);

-- Table liaison clients-tags (many-to-many)
-- Note: client_id est BIGINT car la table clients utilise BIGINT pour id
CREATE TABLE IF NOT EXISTS client_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(client_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_client_tags_client ON client_tags(client_id);
CREATE INDEX IF NOT EXISTS idx_client_tags_tag ON client_tags(tag_id);

-- Ajouter colonnes analytics dans clients si pas deja presentes
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS ca_total DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS nb_rdv_total INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS derniere_visite DATE,
ADD COLUMN IF NOT EXISTS score_engagement INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_clients_ca_total ON clients(tenant_id, ca_total);
CREATE INDEX IF NOT EXISTS idx_clients_score ON clients(tenant_id, score_engagement);

-- Enable RLS
ALTER TABLE segments_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies pour segments_clients
DROP POLICY IF EXISTS "segments_tenant_isolation" ON segments_clients;
CREATE POLICY "segments_tenant_isolation" ON segments_clients
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true));

-- RLS Policies pour tags
DROP POLICY IF EXISTS "tags_tenant_isolation" ON tags;
CREATE POLICY "tags_tenant_isolation" ON tags
  FOR ALL USING (tenant_id = current_setting('app.current_tenant', true));

-- Service role bypass
DROP POLICY IF EXISTS "service_role_segments" ON segments_clients;
CREATE POLICY "service_role_segments" ON segments_clients
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_tags" ON tags;
CREATE POLICY "service_role_tags" ON tags
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_client_tags" ON client_tags;
CREATE POLICY "service_role_client_tags" ON client_tags
  FOR ALL USING (auth.role() = 'service_role');

-- ═══════════════════════════════════════════════════════════
-- FIN MIGRATION CRM SEGMENTATION
-- ═══════════════════════════════════════════════════════════
