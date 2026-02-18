-- ============================================
-- USAGE TRACKING TABLES
-- Suivi de l'utilisation par tenant
-- ============================================

-- Table des événements d'usage (log détaillé)
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
  type VARCHAR(20) NOT NULL, -- 'telephone', 'whatsapp', 'web', 'ia'
  amount INTEGER NOT NULL DEFAULT 1,
  month VARCHAR(7) NOT NULL, -- '2026-02'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour requêtes rapides
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant ON usage_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_month ON usage_events(month);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(type);
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_month ON usage_events(tenant_id, month);

-- Table des compteurs mensuels (agrégé)
CREATE TABLE IF NOT EXISTS usage_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
  month VARCHAR(7) NOT NULL, -- '2026-02'

  -- Compteurs d'utilisation
  telephone_used INTEGER DEFAULT 0,
  whatsapp_used INTEGER DEFAULT 0,
  web_used INTEGER DEFAULT 0,
  ia_used INTEGER DEFAULT 0,

  -- Limites (quotas)
  telephone_limit INTEGER DEFAULT 300,
  whatsapp_limit INTEGER DEFAULT 1000,
  web_limit INTEGER DEFAULT 5000,
  ia_limit INTEGER DEFAULT 100000,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Contrainte d'unicité
  UNIQUE(tenant_id, month)
);

CREATE INDEX IF NOT EXISTS idx_usage_monthly_tenant ON usage_monthly(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_monthly_month ON usage_monthly(month);

-- Table des numéros de téléphone par tenant
CREATE TABLE IF NOT EXISTS tenant_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(50) NOT NULL REFERENCES tenants(id),
  phone_number VARCHAR(20) NOT NULL,
  twilio_sid VARCHAR(50),
  type VARCHAR(20) DEFAULT 'voice', -- 'voice', 'whatsapp', 'both'
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'released', 'suspended'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  released_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_tenant_phones_tenant ON tenant_phone_numbers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_phones_number ON tenant_phone_numbers(phone_number);

-- Ajouter colonnes téléphone au tenant si pas existantes
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone_twilio_sid VARCHAR(50);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30);

-- ============================================
-- FONCTIONS UTILITAIRES
-- ============================================

-- Fonction pour obtenir l'usage du mois courant
CREATE OR REPLACE FUNCTION get_current_usage(p_tenant_id VARCHAR)
RETURNS TABLE (
  telephone_used INTEGER,
  telephone_limit INTEGER,
  whatsapp_used INTEGER,
  whatsapp_limit INTEGER,
  web_used INTEGER,
  web_limit INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(um.telephone_used, 0)::INTEGER,
    COALESCE(um.telephone_limit, 300)::INTEGER,
    COALESCE(um.whatsapp_used, 0)::INTEGER,
    COALESCE(um.whatsapp_limit, 1000)::INTEGER,
    COALESCE(um.web_used, 0)::INTEGER,
    COALESCE(um.web_limit, 5000)::INTEGER
  FROM usage_monthly um
  WHERE um.tenant_id = p_tenant_id
    AND um.month = TO_CHAR(NOW(), 'YYYY-MM')
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Vue pour dashboard usage
CREATE OR REPLACE VIEW v_tenant_usage AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  um.month,
  um.telephone_used,
  um.telephone_limit,
  ROUND((um.telephone_used::DECIMAL / NULLIF(um.telephone_limit, 0)) * 100, 1) AS telephone_pct,
  um.whatsapp_used,
  um.whatsapp_limit,
  ROUND((um.whatsapp_used::DECIMAL / NULLIF(um.whatsapp_limit, 0)) * 100, 1) AS whatsapp_pct,
  um.web_used,
  um.web_limit,
  ROUND((um.web_used::DECIMAL / NULLIF(um.web_limit, 0)) * 100, 1) AS web_pct
FROM tenants t
LEFT JOIN usage_monthly um ON t.id = um.tenant_id AND um.month = TO_CHAR(NOW(), 'YYYY-MM');

-- RLS Policies
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_phone_numbers ENABLE ROW LEVEL SECURITY;

-- Policy: chaque tenant voit seulement ses données
CREATE POLICY usage_events_tenant_policy ON usage_events
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY usage_monthly_tenant_policy ON usage_monthly
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY tenant_phones_tenant_policy ON tenant_phone_numbers
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));
