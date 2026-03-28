-- 099: Table accounting_config — configuration comptable par tenant
-- Utilisee par accountingService.js (getConfig, updateConfig, getNextInvoiceNumber, getNextQuoteNumber)
-- Migration idempotente (IF NOT EXISTS) — garantit la presence de la table + index + RLS

CREATE TABLE IF NOT EXISTS accounting_config (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,

  -- Facturation
  invoice_prefix VARCHAR(10) DEFAULT 'FAC',
  invoice_next_number INTEGER DEFAULT 1,

  -- Devis
  quote_prefix VARCHAR(10) DEFAULT 'DEV',
  next_quote_number INTEGER DEFAULT 1,

  -- TVA et devise
  default_vat_rate NUMERIC(5,2) DEFAULT 20,
  currency VARCHAR(3) DEFAULT 'EUR',
  country VARCHAR(50) DEFAULT 'France',

  -- Conditions de paiement (jours)
  payment_terms INTEGER DEFAULT 30,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_accounting_config_tenant ON accounting_config(tenant_id);

-- RLS
ALTER TABLE accounting_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_accounting_config ON accounting_config
    FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
