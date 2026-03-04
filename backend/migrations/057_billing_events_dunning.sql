-- Migration 057: Billing events table + dunning support
-- Sprint 1.5 — Dunning Stripe

-- Table billing_events (utilisée par stripeBillingService mais jamais créée)
CREATE TABLE IF NOT EXISTS billing_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id),
  event_type VARCHAR(50) NOT NULL,
  amount INTEGER,
  currency VARCHAR(3) DEFAULT 'eur',
  invoice_id VARCHAR(100),
  stripe_event_id VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_tenant ON billing_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_type ON billing_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_events_created ON billing_events(created_at DESC);

-- Compteur d'échecs de paiement consécutifs sur tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS payment_failures_count INTEGER DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMPTZ;
