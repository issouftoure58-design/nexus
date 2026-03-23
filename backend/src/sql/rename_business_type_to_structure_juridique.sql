-- Migration: Renommer business_type → structure_juridique dans la table tenants
-- Raison: business_type portait à confusion (structure juridique company/independent vs type métier salon/restaurant)
-- Le vrai type métier est dans business_profile
-- Date: 2026-03-22

-- Renommer la colonne
ALTER TABLE tenants RENAME COLUMN business_type TO structure_juridique;

-- Commenter la colonne pour la documentation
COMMENT ON COLUMN tenants.structure_juridique IS 'Structure juridique du tenant: company (entreprise/société) ou independent (auto-entrepreneur/micro). Le type métier est dans business_profile.';
