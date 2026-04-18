-- Migration 113: Primes mensuelles + absences paie
-- Ajoute la configuration des primes par employé et les champs absences sur bulletins

-- Primes mensuelles configurables par employé
-- Format: [{ code, nom, montant, type, exonere, par_jour_travaille }]
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS primes_mensuelles JSONB DEFAULT '[]';

-- Avantages en nature configurables par employé
-- Format: [{ code, nom, montant_mensuel, type }]
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS avantages_nature JSONB DEFAULT '[]';

-- Champs absences sur les bulletins de paie
ALTER TABLE rh_bulletins_paie ADD COLUMN IF NOT EXISTS absences JSONB DEFAULT '[]';
-- Format: [{ type, jours, retenue, ijss_brutes, ijss_nettes, complement_employeur, subrogation }]

ALTER TABLE rh_bulletins_paie ADD COLUMN IF NOT EXISTS retenue_absences INT DEFAULT 0;
ALTER TABLE rh_bulletins_paie ADD COLUMN IF NOT EXISTS ijss_brutes INT DEFAULT 0;
ALTER TABLE rh_bulletins_paie ADD COLUMN IF NOT EXISTS complement_employeur INT DEFAULT 0;

-- Index pour les requêtes
CREATE INDEX IF NOT EXISTS idx_rh_membres_primes ON rh_membres USING gin(primes_mensuelles);
