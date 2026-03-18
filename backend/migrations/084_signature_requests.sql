-- Migration 084: Table signature_requests pour Yousign
-- Stocke les demandes de signature électronique par tenant

CREATE TABLE IF NOT EXISTS signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  yousign_request_id TEXT,
  yousign_document_id TEXT,
  yousign_signer_id TEXT,
  document_name TEXT,
  signer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  signed_at TIMESTAMPTZ,
  webhook_data JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_signature_requests_tenant ON signature_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_yousign ON signature_requests(yousign_request_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_client ON signature_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_status ON signature_requests(tenant_id, status);

-- RLS
ALTER TABLE signature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "signature_requests_tenant_isolation" ON signature_requests
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_signature_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_signature_requests_updated_at
  BEFORE UPDATE ON signature_requests
  FOR EACH ROW EXECUTE FUNCTION update_signature_requests_updated_at();
