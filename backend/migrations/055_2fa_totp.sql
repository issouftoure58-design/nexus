-- Migration 055: 2FA TOTP pour admin_users
-- Sprint 1.1 — Securite MFA

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS totp_verified_at TIMESTAMPTZ;
