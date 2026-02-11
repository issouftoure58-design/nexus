-- ============================================
-- MIGRATION 001 : API REST PUBLIQUE
-- Tables pour API keys, logs, webhooks
-- ============================================

-- Extension UUID si pas deja presente
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE 1 : API Keys par tenant
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(16) NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]',
  rate_limit_per_hour INTEGER DEFAULT 1000,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(tenant_id, is_active);

-- ============================================
-- TABLE 2 : Logs API calls
-- ============================================
CREATE TABLE IF NOT EXISTS api_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL,
  api_key_id UUID REFERENCES api_keys(id),
  method VARCHAR(10) NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_body JSONB,
  response_body JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_tenant ON api_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_key ON api_logs(api_key_id, created_at DESC);

-- ============================================
-- TABLE 3 : Webhooks sortants
-- ============================================
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret VARCHAR(255),
  headers JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  retry_count INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  last_triggered_at TIMESTAMPTZ,
  last_status VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(tenant_id, is_active);

-- ============================================
-- TABLE 4 : Logs webhooks
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(50) NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook ON webhook_logs(webhook_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant ON webhook_logs(tenant_id, sent_at DESC);

-- ============================================
-- COMMENTAIRES
-- ============================================
COMMENT ON TABLE api_keys IS 'API keys pour authentification API REST publique';
COMMENT ON TABLE api_logs IS 'Logs de tous les appels API pour audit et analytics';
COMMENT ON TABLE webhooks IS 'Configuration webhooks sortants par tenant';
COMMENT ON TABLE webhook_logs IS 'Historique des webhooks envoyes';
