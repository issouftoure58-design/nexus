-- Migration 134 : Table de verification email au signup
-- Pattern identique a signup_phone_verifications mais avec token-link (pas de code 6 chiffres)

CREATE TABLE IF NOT EXISTS signup_email_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  ip TEXT,
  token TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  verified_token TEXT,
  consumed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verif_email ON signup_email_verifications(email);
CREATE INDEX IF NOT EXISTS idx_email_verif_token ON signup_email_verifications(token);
