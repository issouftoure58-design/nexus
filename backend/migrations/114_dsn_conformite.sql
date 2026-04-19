-- Migration 114: Conformite DSN - Ajout colonnes manquantes
-- Corrige les erreurs du bilan DSN-CTL-V25R01

-- =============================================
-- 1. Colonnes DSN manquantes sur rh_membres
-- =============================================
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS dept_naissance VARCHAR(3);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS code_pays_naissance VARCHAR(5) DEFAULT 'FR';
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS codification_ue VARCHAR(2) DEFAULT '01';
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS code_pcs VARCHAR(10);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS statut_conventionnel VARCHAR(2);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS statut_categoriel VARCHAR(2);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS numero_contrat VARCHAR(20);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS dispositif_politique VARCHAR(2) DEFAULT '99';
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS unite_quotite VARCHAR(2) DEFAULT '10';
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS quotite_reference NUMERIC(10,2) DEFAULT 151.67;
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS quotite_contrat NUMERIC(10,2);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS modalite_temps VARCHAR(2) DEFAULT '01';
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS regime_maladie VARCHAR(3) DEFAULT '200';
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS regime_vieillesse VARCHAR(3) DEFAULT '200';
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS regime_at VARCHAR(3) DEFAULT '200';
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS code_risque_at VARCHAR(6);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS taux_at NUMERIC(5,2);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS emplois_multiples VARCHAR(2) DEFAULT '02';
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS employeurs_multiples VARCHAR(2) DEFAULT '02';
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS nom_usage VARCHAR(100);

-- =============================================
-- 2. Colonne SIRET URSSAF sur rh_dsn_parametres
-- =============================================
ALTER TABLE rh_dsn_parametres ADD COLUMN IF NOT EXISTS urssaf_siret VARCHAR(14);
ALTER TABLE rh_dsn_parametres ADD COLUMN IF NOT EXISTS caisse_retraite_siret VARCHAR(14);

-- =============================================
-- 3. Correction donnees bote-service
-- =============================================

-- Params DSN
UPDATE rh_dsn_parametres SET
  nic = '00011',
  effectif_moyen = 1,
  contact_nom = CASE WHEN contact_nom = '' THEN raison_sociale ELSE contact_nom END,
  updated_at = NOW()
WHERE tenant_id = 'bote-service';

-- Membre MEITE Nogoze
UPDATE rh_membres SET
  dept_naissance = '95',
  code_pcs = '641a',
  statut_conventionnel = '07',
  statut_categoriel = '02',
  numero_contrat = '00001',
  code_risque_at = '602MC',
  taux_at = 3.22,
  codification_ue = '01',
  code_pays_naissance = 'FR',
  updated_at = NOW()
WHERE tenant_id = 'bote-service' AND nom = 'MEITE' AND prenom = 'Nogoze';
