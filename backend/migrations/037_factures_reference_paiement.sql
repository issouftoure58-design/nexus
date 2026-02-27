-- Migration 037: Ajouter colonne reference_paiement sur factures
-- Date: 2026-02-26

-- Référence du paiement (numéro de chèque, référence virement, etc.)
ALTER TABLE factures ADD COLUMN IF NOT EXISTS reference_paiement VARCHAR(255);

-- Commentaire
COMMENT ON COLUMN factures.reference_paiement IS 'Référence du paiement (numéro chèque, ref virement, etc.)';
