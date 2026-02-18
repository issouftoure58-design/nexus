-- Migration 008: Ajouter salaire aux membres RH
-- Pour le calcul de la masse salariale

ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS salaire_mensuel INTEGER DEFAULT 0;

COMMENT ON COLUMN rh_membres.salaire_mensuel IS 'Salaire mensuel brut en centimes';

-- Index pour les calculs de paie
CREATE INDEX IF NOT EXISTS idx_rh_membres_statut ON rh_membres(tenant_id, statut);
