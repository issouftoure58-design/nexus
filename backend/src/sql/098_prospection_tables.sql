-- 098: Tables pour le module de prospection email automatisee
-- Utilise par: modules/prospection/* (scrape Google Places, generation email IA, envoi Resend)
-- Toutes les tables utilisent tenant_id = 'nexus-internal' (outil interne NEXUS)

-- =============================================================================
-- Table: prospection_prospects
-- Prospects scrapes depuis Google Places ou importes manuellement
-- =============================================================================
CREATE TABLE IF NOT EXISTS prospection_prospects (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'nexus-internal',
  place_id VARCHAR(255),
  name VARCHAR(500) NOT NULL,
  sector VARCHAR(100) NOT NULL,
  address TEXT,
  city VARCHAR(255),
  postal_code VARCHAR(10),
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(500),
  rating NUMERIC(2,1),
  reviews_count INT DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  source VARCHAR(50) NOT NULL DEFAULT 'google_places',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_prospection_prospects_tenant ON prospection_prospects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prospection_prospects_sector ON prospection_prospects(tenant_id, sector);
CREATE INDEX IF NOT EXISTS idx_prospection_prospects_city ON prospection_prospects(tenant_id, city);
CREATE INDEX IF NOT EXISTS idx_prospection_prospects_status ON prospection_prospects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_prospection_prospects_email ON prospection_prospects(tenant_id, email);

ALTER TABLE prospection_prospects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_prospection_prospects ON prospection_prospects FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Table: prospection_campaigns
-- Campagnes d'emailing groupees par secteur/ville
-- =============================================================================
CREATE TABLE IF NOT EXISTS prospection_campaigns (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'nexus-internal',
  name VARCHAR(255) NOT NULL,
  sector VARCHAR(100) NOT NULL,
  cities TEXT[] DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  daily_send_limit INT DEFAULT 30,
  follow_up_enabled BOOLEAN DEFAULT true,
  prospects_count INT DEFAULT 0,
  emails_sent INT DEFAULT 0,
  emails_opened INT DEFAULT 0,
  emails_responded INT DEFAULT 0,
  conversions INT DEFAULT 0,
  custom_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospection_campaigns_tenant ON prospection_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prospection_campaigns_status ON prospection_campaigns(tenant_id, status);

ALTER TABLE prospection_campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_prospection_campaigns ON prospection_campaigns FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Table: prospection_emails
-- Emails envoyes avec tracking (Resend webhooks)
-- =============================================================================
CREATE TABLE IF NOT EXISTS prospection_emails (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'nexus-internal',
  campaign_id INT NOT NULL REFERENCES prospection_campaigns(id) ON DELETE CASCADE,
  prospect_id INT NOT NULL REFERENCES prospection_prospects(id) ON DELETE CASCADE,
  resend_id VARCHAR(255),
  email_type VARCHAR(50) NOT NULL DEFAULT 'initial',
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  to_address VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  opened_count INT DEFAULT 0,
  clicked_count INT DEFAULT 0,
  follow_up_scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospection_emails_tenant ON prospection_emails(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prospection_emails_campaign ON prospection_emails(tenant_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_prospection_emails_prospect ON prospection_emails(tenant_id, prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospection_emails_status ON prospection_emails(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_prospection_emails_followup ON prospection_emails(tenant_id, follow_up_scheduled_at)
  WHERE follow_up_scheduled_at IS NOT NULL AND status != 'bounced';
CREATE INDEX IF NOT EXISTS idx_prospection_emails_resend ON prospection_emails(resend_id)
  WHERE resend_id IS NOT NULL;

ALTER TABLE prospection_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_prospection_emails ON prospection_emails FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Table: prospection_settings
-- Configuration singleton (une seule ligne tenant_id = 'nexus-internal')
-- =============================================================================
CREATE TABLE IF NOT EXISTS prospection_settings (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'nexus-internal' UNIQUE,
  daily_limit INT DEFAULT 50,
  hourly_limit INT DEFAULT 10,
  send_window_start INT DEFAULT 9,
  send_window_end INT DEFAULT 18,
  send_days INT[] DEFAULT '{1,2,3,4,5}',
  from_email VARCHAR(255) DEFAULT 'contact@nexus-sentinel.com',
  from_name VARCHAR(255) DEFAULT 'NEXUS Business',
  reply_to VARCHAR(255) DEFAULT 'nexussentinelai@yahoo.com',
  active_sectors TEXT[] DEFAULT '{salon,restaurant,commerce,hotel,domicile,securite}',
  active_cities TEXT[] DEFAULT '{Paris,Lyon,Marseille}',
  ai_model VARCHAR(100) DEFAULT 'claude-haiku-4-5-20251001',
  ai_temperature NUMERIC(2,1) DEFAULT 0.7,
  followup_j3 BOOLEAN DEFAULT true,
  followup_j7 BOOLEAN DEFAULT true,
  followup_j14 BOOLEAN DEFAULT false,
  global_pause BOOLEAN DEFAULT false,
  company_name VARCHAR(255) DEFAULT 'NEXUS Business Solutions',
  company_siret VARCHAR(20) DEFAULT '',
  company_address TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospection_settings_tenant ON prospection_settings(tenant_id);

ALTER TABLE prospection_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_prospection_settings ON prospection_settings FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Insert default settings row
-- =============================================================================
INSERT INTO prospection_settings (tenant_id)
VALUES ('nexus-internal')
ON CONFLICT (tenant_id) DO NOTHING;
