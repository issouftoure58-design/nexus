-- Migration: Mode de paiement
-- Ajoute le mode de paiement aux factures et réservations
-- Pour alimenter automatiquement le journal Caisse (espèces) ou Banque (CB, virement, etc.)

-- Ajouter mode_paiement aux factures
ALTER TABLE factures
ADD COLUMN IF NOT EXISTS mode_paiement TEXT
CHECK (mode_paiement IN ('especes', 'cb', 'virement', 'prelevement', 'cheque'));

COMMENT ON COLUMN factures.mode_paiement IS 'Mode de paiement: especes, cb, virement, prelevement, cheque';

-- Ajouter mode_paiement aux réservations
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS mode_paiement TEXT
CHECK (mode_paiement IN ('especes', 'cb', 'virement', 'prelevement', 'cheque'));

COMMENT ON COLUMN reservations.mode_paiement IS 'Mode de paiement: especes, cb, virement, prelevement, cheque';

-- Par défaut, mettre CB pour les factures déjà payées (rétrocompatibilité)
UPDATE factures SET mode_paiement = 'cb' WHERE statut = 'payee' AND mode_paiement IS NULL;

-- Par défaut, mettre CB pour les réservations terminées avec paiement (rétrocompatibilité)
UPDATE reservations SET mode_paiement = 'cb' WHERE statut = 'termine' AND mode_paiement IS NULL;
