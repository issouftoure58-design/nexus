-- =====================================================
-- Migration 010: SEO Articles & Keywords (Business Plan)
-- SEMAINE 8 JOUR 5 - SEO & Visibilité
-- =====================================================

-- Table articles SEO
CREATE TABLE IF NOT EXISTS seo_articles (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  slug TEXT NOT NULL,
  meta_description TEXT,
  contenu TEXT NOT NULL,
  mot_cle_principal TEXT,
  mots_cles_secondaires TEXT[],
  statut TEXT DEFAULT 'brouillon' CHECK (statut IN ('brouillon', 'publie', 'archive')),
  date_publication TIMESTAMP,
  auteur TEXT DEFAULT 'IA',
  images TEXT[],
  lectures INTEGER DEFAULT 0,
  partages INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_seo_articles_tenant ON seo_articles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seo_articles_statut ON seo_articles(statut);
CREATE INDEX IF NOT EXISTS idx_seo_articles_slug ON seo_articles(slug);

-- Table mots-clés suivis
CREATE TABLE IF NOT EXISTS seo_keywords (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  mot_cle TEXT NOT NULL,
  volume_recherche INTEGER,
  difficulte INTEGER CHECK (difficulte >= 1 AND difficulte <= 100),
  position_actuelle INTEGER,
  position_cible INTEGER DEFAULT 10,
  url_cible TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, mot_cle)
);

CREATE INDEX IF NOT EXISTS idx_seo_keywords_tenant ON seo_keywords(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seo_keywords_actif ON seo_keywords(actif) WHERE actif = true;

-- Historique positions
CREATE TABLE IF NOT EXISTS seo_positions_history (
  id SERIAL PRIMARY KEY,
  keyword_id INTEGER REFERENCES seo_keywords(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  url_classee TEXT,
  date_mesure TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_positions_keyword ON seo_positions_history(keyword_id);
CREATE INDEX IF NOT EXISTS idx_seo_positions_date ON seo_positions_history(date_mesure);

-- Recommandations SEO
CREATE TABLE IF NOT EXISTS seo_recommendations (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('technical', 'content', 'backlinks')),
  titre TEXT NOT NULL,
  description TEXT NOT NULL,
  priorite TEXT DEFAULT 'medium' CHECK (priorite IN ('low', 'medium', 'high')),
  impact_estime TEXT,
  statut TEXT DEFAULT 'active' CHECK (statut IN ('active', 'completed', 'ignored')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seo_recommendations_tenant ON seo_recommendations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seo_recommendations_statut ON seo_recommendations(statut);

-- Comments
COMMENT ON TABLE seo_articles IS 'Articles de blog SEO générés par IA - Plan Business';
COMMENT ON TABLE seo_keywords IS 'Mots-clés suivis pour tracking positions - Plan Business';
COMMENT ON TABLE seo_positions_history IS 'Historique positions Google - Plan Business';
COMMENT ON TABLE seo_recommendations IS 'Recommandations SEO automatiques - Plan Business';
