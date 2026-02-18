-- Migration 006: Relance Settings Table
-- Stocke les paramètres de délais de relance par tenant

CREATE TABLE IF NOT EXISTS relance_settings (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL UNIQUE,
  r1_jours INTEGER DEFAULT -7,      -- Rappel préventif (jours avant échéance)
  r2_jours INTEGER DEFAULT 0,       -- Jour d'échéance
  r3_jours INTEGER DEFAULT 7,       -- Première relance (jours après échéance)
  r4_jours INTEGER DEFAULT 15,      -- Deuxième relance
  r5_jours INTEGER DEFAULT 21,      -- Mise en demeure
  contentieux_jours INTEGER DEFAULT 30,  -- Transmission contentieux
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche par tenant
CREATE INDEX IF NOT EXISTS idx_relance_settings_tenant ON relance_settings(tenant_id);

-- Commentaires
COMMENT ON TABLE relance_settings IS 'Paramètres de délais de relance par tenant';
COMMENT ON COLUMN relance_settings.r1_jours IS 'R1: Jours avant échéance (négatif)';
COMMENT ON COLUMN relance_settings.r2_jours IS 'R2: Jour d échéance (0)';
COMMENT ON COLUMN relance_settings.r3_jours IS 'R3: Jours après échéance';
COMMENT ON COLUMN relance_settings.r4_jours IS 'R4: Jours après échéance';
COMMENT ON COLUMN relance_settings.r5_jours IS 'R5: Mise en demeure - jours après échéance';
COMMENT ON COLUMN relance_settings.contentieux_jours IS 'Contentieux: Jours après échéance';
