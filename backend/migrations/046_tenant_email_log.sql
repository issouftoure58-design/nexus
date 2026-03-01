-- Migration 046: Table de log des emails tenant
-- Tracking des emails envoyes pour eviter les doublons

CREATE TABLE IF NOT EXISTS tenant_email_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL, -- 'trial_day_3', 'trial_day_7', 'trial_alert_7', etc.
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Index pour eviter les doublons et recherche rapide
CREATE INDEX IF NOT EXISTS idx_tenant_email_log_tenant ON tenant_email_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_email_log_type ON tenant_email_log(tenant_id, email_type);
CREATE INDEX IF NOT EXISTS idx_tenant_email_log_sent ON tenant_email_log(sent_at);

-- Contrainte unique pour eviter les doublons (meme type d'email par tenant)
-- On permet plusieurs emails du meme type si la date est differente (jour)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_email_unique
  ON tenant_email_log(tenant_id, email_type, DATE(sent_at));

-- RLS
ALTER TABLE tenant_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_email_log_policy ON tenant_email_log
  FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE tenant_email_log IS 'Log des emails envoyes aux tenants pour tracking et anti-spam';
COMMENT ON COLUMN tenant_email_log.email_type IS 'Type d email: trial_day_3, trial_alert_7, invoice_paid, etc.';
