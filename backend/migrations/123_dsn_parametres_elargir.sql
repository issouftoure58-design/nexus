-- Migration 123: Elargir colonnes rh_dsn_parametres pour conformite DSN
-- Les SIRET OPS font 14 chars, les anciens VARCHAR(10) sont trop courts

-- Elargir les colonnes organismes sociaux (VARCHAR(10) → VARCHAR(20))
ALTER TABLE rh_dsn_parametres ALTER COLUMN urssaf_code TYPE VARCHAR(20);
ALTER TABLE rh_dsn_parametres ALTER COLUMN caisse_retraite_code TYPE VARCHAR(20);
ALTER TABLE rh_dsn_parametres ALTER COLUMN prevoyance_code TYPE VARCHAR(20);
ALTER TABLE rh_dsn_parametres ALTER COLUMN mutuelle_code TYPE VARCHAR(20);

-- Nouvelles colonnes pour DSN conforme (ref: DSN fiche-paie.net)
ALTER TABLE rh_dsn_parametres ADD COLUMN IF NOT EXISTS bic VARCHAR(11);
ALTER TABLE rh_dsn_parametres ADD COLUMN IF NOT EXISTS iban VARCHAR(34);
ALTER TABLE rh_dsn_parametres ADD COLUMN IF NOT EXISTS contact_civilite VARCHAR(2) DEFAULT '01';
ALTER TABLE rh_dsn_parametres ADD COLUMN IF NOT EXISTS mode_paiement VARCHAR(2) DEFAULT '05';
ALTER TABLE rh_dsn_parametres ADD COLUMN IF NOT EXISTS code_regime_retraite VARCHAR(10) DEFAULT 'RETA';

-- Elargir modalite_temps default sur rh_membres (01 invalide → 10 temps complet)
UPDATE rh_membres SET modalite_temps = '10' WHERE modalite_temps = '01';
ALTER TABLE rh_membres ALTER COLUMN modalite_temps SET DEFAULT '10';

-- Fix defaults DSN rh_membres (alignes sur reference fiche-paie.net)
UPDATE rh_membres SET emplois_multiples = '03' WHERE emplois_multiples = '02';
UPDATE rh_membres SET employeurs_multiples = '03' WHERE employeurs_multiples = '02';
ALTER TABLE rh_membres ALTER COLUMN emplois_multiples SET DEFAULT '03';
ALTER TABLE rh_membres ALTER COLUMN employeurs_multiples SET DEFAULT '03';

-- Ajout complement PCS-ESE
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS complement_pcs VARCHAR(10);
