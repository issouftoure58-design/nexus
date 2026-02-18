-- Migration 009: Ajouter NIR et date de naissance aux membres RH
-- Pour la DSN

ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS nir VARCHAR(15);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS date_naissance DATE;

COMMENT ON COLUMN rh_membres.nir IS 'Numero de securite sociale (15 chiffres)';
COMMENT ON COLUMN rh_membres.date_naissance IS 'Date de naissance du membre';

-- Index pour recherche par NIR
CREATE INDEX IF NOT EXISTS idx_rh_membres_nir ON rh_membres(nir) WHERE nir IS NOT NULL;
