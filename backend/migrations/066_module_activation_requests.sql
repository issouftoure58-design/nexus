-- 066: Table des demandes d'activation de modules
-- Un tenant peut demander l'activation d'un canal (telephone, whatsapp, etc.)
-- L'equipe NEXUS traite la demande manuellement

CREATE TABLE IF NOT EXISTS module_activation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
  module_id VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  notes TEXT
);

-- Supprimer l'ancienne contrainte UNIQUE si elle existe (idempotent)
ALTER TABLE module_activation_requests
  DROP CONSTRAINT IF EXISTS unique_pending_request;

-- Index unique partiel: un seul pending par (tenant, module) à la fois
-- Permet de re-demander après un rejected/approved
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_activation
  ON module_activation_requests (tenant_id, module_id)
  WHERE status = 'pending';

ALTER TABLE module_activation_requests ENABLE ROW LEVEL SECURITY;
