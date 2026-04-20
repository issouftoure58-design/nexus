-- Migration 117: Avis publics (sans token de réservation)
-- Ajoute source, author_name, ip_hash pour les avis publics

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'token';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS author_name VARCHAR(100);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ip_hash VARCHAR(64);

-- Index pour anti-spam (max 3 avis/jour/IP/tenant)
CREATE INDEX IF NOT EXISTS idx_reviews_ip_hash_tenant ON reviews (ip_hash, tenant_id, created_at)
  WHERE ip_hash IS NOT NULL;

-- Index pour filtrer par source
CREATE INDEX IF NOT EXISTS idx_reviews_source ON reviews (source);

COMMENT ON COLUMN reviews.source IS 'token = via lien réservation, public = via formulaire site';
COMMENT ON COLUMN reviews.author_name IS 'Nom affiché pour les avis publics (pas de client_id)';
COMMENT ON COLUMN reviews.ip_hash IS 'SHA-256 de l''IP pour anti-spam (RGPD compliant)';
