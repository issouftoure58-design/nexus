-- Migration 071: Programme de fidélité
-- Tables pour transactions de points et configuration par tenant

-- Configuration fidélité par tenant
CREATE TABLE IF NOT EXISTS loyalty_config (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  points_per_euro NUMERIC(5,2) DEFAULT 1.0,
  signup_bonus INTEGER DEFAULT 50,
  validity_days INTEGER DEFAULT 730,
  min_redeem INTEGER DEFAULT 100,
  redeem_ratio NUMERIC(5,2) DEFAULT 0.10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Historique des transactions de points
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(100) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('earn', 'redeem', 'adjust', 'expire', 'signup_bonus')),
  points INTEGER NOT NULL,
  balance_after INTEGER NOT NULL DEFAULT 0,
  reference_type VARCHAR(50),
  reference_id VARCHAR(100),
  admin_id INTEGER,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_tenant ON loyalty_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_client ON loyalty_transactions(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type ON loyalty_transactions(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_loyalty_config_tenant ON loyalty_config(tenant_id);

-- RLS
ALTER TABLE loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
