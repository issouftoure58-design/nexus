-- Migration 087: Table Qualiopi Documents

CREATE TABLE IF NOT EXISTS qualiopi_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  client_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'manquant',
  file_url TEXT,
  notes TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_qualiopi_docs_tenant ON qualiopi_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_qualiopi_docs_client ON qualiopi_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_qualiopi_docs_type ON qualiopi_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_qualiopi_docs_tenant_client ON qualiopi_documents(tenant_id, client_id);

-- RLS
ALTER TABLE qualiopi_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qualiopi_documents_tenant_isolation" ON qualiopi_documents
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));
