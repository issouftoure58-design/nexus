-- Migration 112 : Nettoyage schema SEO (consolidation et suppression tables orphelines)
--
-- Contexte :
-- Un ancien routeur `/api/seo/*` (routes/seo.js, supprime dans ce meme commit)
-- ecrivait dans 5 tables orphelines jamais lues par le reste du code. Toute la
-- logique SEO a ete consolidee dans `/api/admin/seo/*` (adminSEO.js) qui utilise
-- les tables canoniques : seo_articles, seo_keywords, seo_recommendations,
-- seo_audits, seo_competitors, seo_positions_history.
--
-- Cette migration :
--   1. Drop les 5 tables orphelines (toutes vides, 0 row en prod verifiee)
--   2. Documente le vrai schema de seo_articles (la migration 010 d'archive
--      etait devenue obsolete apres des ALTER TABLE non traces)

-- ═══════════════════════════════════════════════════════════════
-- 1. DROP TABLES ORPHELINES
-- ═══════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS articles_seo CASCADE;          -- doublon de seo_articles
DROP TABLE IF EXISTS mots_cles_suivis CASCADE;      -- remplace par seo_keywords
DROP TABLE IF EXISTS meta_seo_pages CASCADE;        -- jamais lue
DROP TABLE IF EXISTS google_my_business CASCADE;    -- GMB jamais implemente cote client
DROP TABLE IF EXISTS gmb_posts CASCADE;             -- idem

-- ═══════════════════════════════════════════════════════════════
-- 2. DOCUMENTATION SCHEMA REEL seo_articles
-- ═══════════════════════════════════════════════════════════════
-- La table seo_articles existe deja en prod avec ce schema :
--   id, tenant_id, titre, slug, contenu,
--   image_principale, meta_title, meta_description,
--   mots_cles_cibles TEXT[],  -- array unique (principal = [0], secondaires = [1..])
--   categorie, auteur, temps_lecture,
--   statut, date_publication, vues, partages,
--   created_at, updated_at
--
-- On ajoute juste des COMMENT ON COLUMN pour que tout nouveau dev comprenne le
-- format sans avoir a chercher. Aucun ALTER destructif.

COMMENT ON COLUMN seo_articles.mots_cles_cibles IS
  'Array de mots-cles : [0] = mot-cle principal, [1..] = secondaires. '
  'NE PAS utiliser les colonnes mot_cle_principal/mots_cles_secondaires (inexistantes).';

COMMENT ON COLUMN seo_articles.statut IS
  'brouillon | publie | archive. Seuls les publies sont servis par /blog.';

COMMENT ON COLUMN seo_articles.vues IS
  'Compteur vues publiques. TODO: incrementer depuis GET /blog/:slug (pas encore fait).';

COMMENT ON COLUMN seo_articles.partages IS
  'Compteur partages sociaux. TODO: endpoint POST /api/blog/:slug/track-share.';
