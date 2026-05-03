-- Migration 135: Ajouter ig_account_id à social_accounts si manquant
-- La colonne était dans la migration 100 mais n'a pas été créée en production

ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS ig_account_id VARCHAR(200);
