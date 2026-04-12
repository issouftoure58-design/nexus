-- ============================================
-- Migration 109 : Table social_posts
-- Posts reseaux sociaux (brouillons, programmes, publies)
-- ============================================

CREATE TABLE IF NOT EXISTS social_posts (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  platform       VARCHAR(20) NOT NULL DEFAULT 'facebook',  -- facebook, instagram, both
  content        TEXT NOT NULL,
  category       VARCHAR(50),                               -- promo, tips, behind_scenes, testimony, news
  status         VARCHAR(20) NOT NULL DEFAULT 'draft',      -- draft, scheduled, published, error
  scheduled_at   TIMESTAMPTZ,
  published_at   TIMESTAMPTZ,
  image_url      TEXT,                                      -- URL image (DALL-E ou upload)
  post_id        VARCHAR(200),                              -- ID retourne par Meta API
  error_message  TEXT,
  account_id     UUID REFERENCES social_accounts(id),       -- Compte social utilise
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_social_posts_tenant ON social_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled ON social_posts(tenant_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status) WHERE status = 'scheduled';

-- RLS
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_social_posts ON social_posts;
CREATE POLICY tenant_isolation_social_posts ON social_posts
  USING (tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.role', true) = 'service_role')
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.role', true) = 'service_role');

COMMENT ON TABLE social_posts IS 'Posts reseaux sociaux — brouillons, programmes et publies (tenant-isolated)';

-- ============================================
-- Verification
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'social_posts') THEN
    RAISE NOTICE '✅ Migration 109 OK — Table social_posts creee';
  END IF;
END $$;
