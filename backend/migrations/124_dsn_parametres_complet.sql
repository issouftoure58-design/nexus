-- Migration 124: Ajouter colonnes code_risque_at et taux_at_defaut aux parametres DSN
-- Les colonnes bic, iban, code_regime_retraite, mode_paiement, contact_civilite existent deja (migration 123)

ALTER TABLE rh_dsn_parametres ADD COLUMN IF NOT EXISTS code_risque_at VARCHAR(6) DEFAULT '930DB';
ALTER TABLE rh_dsn_parametres ADD COLUMN IF NOT EXISTS taux_at_defaut NUMERIC(5,2) DEFAULT 1.10;
