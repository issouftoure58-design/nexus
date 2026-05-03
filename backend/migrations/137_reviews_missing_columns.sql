-- Migration 137: Ajout colonnes manquantes a reviews (author_name, source, ip_hash)
-- Bug: "Erreur serveur" sur les formulaires d'avis publics (landing + tenant)
-- Cause: le code insere author_name, source, ip_hash mais ces colonnes n'existaient pas

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'token';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ip_hash TEXT;
