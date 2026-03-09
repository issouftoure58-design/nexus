-- Migration 070: CGV acceptance tracking
-- Ajoute les colonnes pour tracer l'acceptation des CGV au signup

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS cgv_accepted_at TIMESTAMPTZ;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS cgv_version VARCHAR(20);

-- Backfill: tous les utilisateurs existants ont implicitement accepté la v1.0
UPDATE admin_users SET cgv_accepted_at = created_at, cgv_version = '1.0' WHERE cgv_accepted_at IS NULL;
