-- Migration 007: Ajouter statut payée aux dépenses
-- Pour le rapprochement bancaire : seules les dépenses payées comptent

ALTER TABLE depenses ADD COLUMN IF NOT EXISTS payee BOOLEAN DEFAULT true;
ALTER TABLE depenses ADD COLUMN IF NOT EXISTS date_paiement TIMESTAMPTZ;

-- Par défaut, toutes les dépenses existantes sont considérées comme payées
UPDATE depenses SET payee = true WHERE payee IS NULL;

-- Index pour filtrer les dépenses payées
CREATE INDEX IF NOT EXISTS idx_depenses_payee ON depenses(payee);

COMMENT ON COLUMN depenses.payee IS 'Indique si la dépense a été payée';
COMMENT ON COLUMN depenses.date_paiement IS 'Date de paiement de la dépense';
