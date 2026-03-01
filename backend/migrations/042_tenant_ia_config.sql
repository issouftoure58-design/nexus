-- Migration 042: Table tenant_ia_config pour stocker les configurations IA par tenant/canal
-- Auto-créée lors de l'activation des modules whatsapp, telephone, agent_ia_web

CREATE TABLE IF NOT EXISTS tenant_ia_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('telephone', 'whatsapp', 'web', 'sms')),
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, channel)
);

-- Index pour recherche rapide par tenant
CREATE INDEX IF NOT EXISTS idx_tenant_ia_config_tenant ON tenant_ia_config(tenant_id);

-- Index pour recherche par channel
CREATE INDEX IF NOT EXISTS idx_tenant_ia_config_channel ON tenant_ia_config(channel);

-- RLS
ALTER TABLE tenant_ia_config ENABLE ROW LEVEL SECURITY;

-- Policy: Les admins peuvent tout faire sur leur tenant
DROP POLICY IF EXISTS tenant_ia_config_admin_policy ON tenant_ia_config;
CREATE POLICY tenant_ia_config_admin_policy ON tenant_ia_config
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Commentaires
COMMENT ON TABLE tenant_ia_config IS 'Configurations IA par tenant et canal (telephone, whatsapp, web)';
COMMENT ON COLUMN tenant_ia_config.channel IS 'Canal: telephone, whatsapp, web, sms';
COMMENT ON COLUMN tenant_ia_config.config IS 'Configuration JSONB spécifique au canal';
