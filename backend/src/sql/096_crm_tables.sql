-- 096: Creation des tables CRM (crm_contacts, quotes, quote_items, follow_ups, contact_interactions)
-- Utilisees par crmService.js — manquaient en base, causant PGRST205 sur N17

-- Contacts CRM (prospects/leads)
CREATE TABLE IF NOT EXISTS crm_contacts (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  source VARCHAR(100),
  status VARCHAR(50) DEFAULT 'lead',
  tags TEXT[],
  converted_at TIMESTAMP,
  lost_reason TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

-- Devis CRM
CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  quote_number VARCHAR(50),
  contact_id INTEGER REFERENCES crm_contacts(id),
  status VARCHAR(50) DEFAULT 'draft',
  issue_date DATE,
  valid_until DATE,
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 20,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  terms TEXT,
  sent_at TIMESTAMP,
  accepted_at TIMESTAMP,
  rejected_at TIMESTAMP,
  rejection_reason TEXT,
  invoice_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, quote_number)
);

-- Lignes de devis
CREATE TABLE IF NOT EXISTS quote_items (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT,
  quantity NUMERIC(10,2) DEFAULT 1,
  unit_price NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Relances / follow-ups
CREATE TABLE IF NOT EXISTS follow_ups (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  quote_id INTEGER REFERENCES quotes(id),
  contact_id INTEGER REFERENCES crm_contacts(id),
  type VARCHAR(50),
  scheduled_date DATE,
  completed_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending',
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Interactions contact (historique)
CREATE TABLE IF NOT EXISTS contact_interactions (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  contact_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  type VARCHAR(50),
  subject VARCHAR(255),
  content TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_crm_contacts_tenant ON crm_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON crm_contacts(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_quotes_tenant ON quotes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quotes_contact ON quotes(tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_tenant ON follow_ups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups(tenant_id, scheduled_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact ON contact_interactions(tenant_id, contact_id);

-- RLS
ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_crm_contacts ON crm_contacts FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_quotes ON quotes FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_quote_items ON quote_items FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_follow_ups ON follow_ups FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_contact_interactions ON contact_interactions FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
