-- Migration 061: Documents table (generic file storage)
-- Sprint 3.5 — Upload fichiers generique

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL,
  admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  file_name VARCHAR(500) NOT NULL,
  original_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size INTEGER NOT NULL, -- bytes
  storage_path TEXT NOT NULL, -- Supabase storage path
  category VARCHAR(50) DEFAULT 'general', -- general, facture, contrat, photo, logo, autre
  entity_type VARCHAR(50), -- client, reservation, depense, rh, etc.
  entity_id VARCHAR(255), -- ID de l'entite liee
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(tenant_id, category);
