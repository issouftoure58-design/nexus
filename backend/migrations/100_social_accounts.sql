-- Migration 100: social_accounts (OAuth tokens par tenant)
-- Executee le 2026-03-28

CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL,
  account_name VARCHAR(200),
  account_id VARCHAR(200),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  page_id VARCHAR(200),
  ig_account_id VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, platform, account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_tenant ON social_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(tenant_id, platform);

ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_social_accounts ON social_accounts
  USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.role', true) = 'service_role'
  );
