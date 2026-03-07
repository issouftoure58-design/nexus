-- 065_avoirs.sql
-- Factures immutables + systeme d'avoirs (notes de credit)
-- Conformite loi comptable francaise (Code de commerce, Art. L123-23)

-- Type de document : 'facture' ou 'avoir'
ALTER TABLE factures ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'facture';

-- Reference a la facture originale (pour les avoirs)
ALTER TABLE factures ADD COLUMN IF NOT EXISTS facture_origine_id BIGINT REFERENCES factures(id);

-- Indique si un avoir a ete emis pour cette facture
ALTER TABLE factures ADD COLUMN IF NOT EXISTS avoir_emis BOOLEAN NOT NULL DEFAULT false;

-- Motif de l'avoir
ALTER TABLE factures ADD COLUMN IF NOT EXISTS motif_avoir TEXT;

-- Index pour retrouver rapidement les avoirs d'une facture
CREATE INDEX IF NOT EXISTS idx_factures_origine ON factures(facture_origine_id);

-- Index pour filtrer par type par tenant
CREATE INDEX IF NOT EXISTS idx_factures_type ON factures(tenant_id, type);
