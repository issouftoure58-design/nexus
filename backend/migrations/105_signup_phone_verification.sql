-- Migration 105: Signup phone verification (anti-abuse Free tier)
-- Stocke les codes SMS de verification au signup, avec un token a usage unique
-- echange contre l'inscription finale.
--
-- Flow:
--   1. POST /api/signup/sms/send { phone }
--      → genere code 6 chiffres, hash, stocke, envoie SMS
--   2. POST /api/signup/sms/verify { phone, code }
--      → si OK : marque verified_at, retourne verified_token
--   3. POST /api/signup { ..., verified_token }
--      → backend verifie token + phone match, puis marque token consume

CREATE TABLE IF NOT EXISTS signup_phone_verifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164   text NOT NULL,
  ip           text,
  code_hash    text NOT NULL,
  attempts     integer NOT NULL DEFAULT 0,
  verified_at  timestamptz,
  verified_token text,                       -- genere apres succes (32 bytes hex)
  consumed_at  timestamptz,                  -- marque quand utilise au signup
  expires_at   timestamptz NOT NULL,         -- code expire (10 min)
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signup_phone_verif_phone
  ON signup_phone_verifications(phone_e164);

CREATE INDEX IF NOT EXISTS idx_signup_phone_verif_token
  ON signup_phone_verifications(verified_token)
  WHERE verified_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_signup_phone_verif_ip
  ON signup_phone_verifications(ip, created_at);

-- Cleanup automatique des verifications expirees (housekeeping)
-- Les rows > 24h sont supprimees par un job cron / pg_cron si configure
COMMENT ON TABLE signup_phone_verifications IS
  'Verification SMS au signup. Anti-abuse Free tier (6 chiffres, expire 10min, 5 tentatives max).';
