-- Migration: 025_factures_reference_paiement.sql
-- Ajoute la colonne reference_paiement pour traçabilité des paiements

-- Colonne pour stocker la référence du paiement (numéro chèque, ID transaction, etc.)
ALTER TABLE factures ADD COLUMN IF NOT EXISTS reference_paiement VARCHAR(100);

-- Commentaire
COMMENT ON COLUMN factures.reference_paiement IS 'Référence du paiement (numéro chèque, ID transaction Stripe/PayPal, etc.)';
