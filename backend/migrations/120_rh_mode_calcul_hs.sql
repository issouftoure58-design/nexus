-- Migration 120: Mode de calcul des heures supplementaires configurable par tenant
-- Hebdomadaire (defaut, Code du travail), Mensuel (lissage), Annualisation

ALTER TABLE rh_parametres_paie
ADD COLUMN IF NOT EXISTS mode_calcul_hs VARCHAR(20) DEFAULT 'hebdomadaire'
CHECK (mode_calcul_hs IN ('hebdomadaire', 'mensuel', 'annualisation'));
