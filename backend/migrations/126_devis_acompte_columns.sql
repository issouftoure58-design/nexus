-- Migration 126: Add acompte columns to devis table
-- Required by adminDevis.js POST/PUT routes
-- Also adds missing columns: date_prestation, heure_prestation, adresse_facturation

ALTER TABLE devis ADD COLUMN IF NOT EXISTS acompte_pourcentage INTEGER DEFAULT 0;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS montant_acompte INTEGER DEFAULT 0;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS date_prestation DATE;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS heure_prestation TIME;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS adresse_facturation TEXT;

-- Add description column to devis_lignes (referenced in POST route)
ALTER TABLE devis_lignes ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN devis.acompte_pourcentage IS 'Pourcentage d''acompte demandé (0-100)';
COMMENT ON COLUMN devis.montant_acompte IS 'Montant de l''acompte en centimes';
COMMENT ON COLUMN devis.date_prestation IS 'Date prévue de la prestation';
COMMENT ON COLUMN devis.heure_prestation IS 'Heure prévue de la prestation';
COMMENT ON COLUMN devis.adresse_facturation IS 'Adresse de facturation du client';
