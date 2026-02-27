-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 034: Ajout colonne adresse aux clients
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE clients ADD COLUMN IF NOT EXISTS adresse TEXT DEFAULT NULL;

COMMENT ON COLUMN clients.adresse IS 'Adresse postale du client';

-- Index pour recherche
CREATE INDEX IF NOT EXISTS idx_clients_adresse ON clients(adresse) WHERE adresse IS NOT NULL;
