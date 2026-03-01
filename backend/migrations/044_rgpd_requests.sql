-- Migration 044: Table des demandes RGPD
-- Gestion des demandes d'export et de suppression de données

CREATE TABLE IF NOT EXISTS rgpd_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deletion', 'export', 'anonymization')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled', 'failed')),
  requested_by UUID, -- ID de l'admin qui a fait la demande
  reason TEXT,
  scheduled_at TIMESTAMPTZ, -- Date prévue pour l'exécution
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_rgpd_requests_tenant ON rgpd_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rgpd_requests_status ON rgpd_requests(status);
CREATE INDEX IF NOT EXISTS idx_rgpd_requests_scheduled ON rgpd_requests(scheduled_at);

-- RLS
ALTER TABLE rgpd_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY rgpd_requests_tenant_policy ON rgpd_requests
  FOR ALL USING (true) WITH CHECK (true);

-- Ajouter colonne is_anonymized aux clients si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'is_anonymized'
  ) THEN
    ALTER TABLE clients ADD COLUMN is_anonymized BOOLEAN DEFAULT FALSE;
    ALTER TABLE clients ADD COLUMN anonymized_at TIMESTAMPTZ;
  END IF;
END $$;

COMMENT ON TABLE rgpd_requests IS 'Demandes RGPD (suppression, export, anonymisation)';
