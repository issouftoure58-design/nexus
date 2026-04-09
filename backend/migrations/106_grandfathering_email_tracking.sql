-- ════════════════════════════════════════════════════════════════════
-- Migration 106 — Tracking envoi email grandfathering pricing 2026
-- ════════════════════════════════════════════════════════════════════
--
-- Ajoute une colonne pour tracker l'envoi de l'email d'annonce du
-- nouveau modèle de prix (Free / Basic 29€ / Business 129€) aux
-- tenants existants marqués `legacy_pricing = TRUE`.
--
-- Utilisée par `scripts/send-grandfathering-emails.js` pour éviter
-- les envois en double.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS grandfathering_email_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN tenants.grandfathering_email_sent_at
  IS 'Timestamp d''envoi de l''email d''annonce migration pricing 2026 (NULL = pas encore envoyé)';

-- Index partiel pour accélérer la requête de sélection des tenants à notifier
CREATE INDEX IF NOT EXISTS idx_tenants_grandfathering_pending
  ON tenants (id)
  WHERE legacy_pricing = TRUE AND grandfathering_email_sent_at IS NULL;
