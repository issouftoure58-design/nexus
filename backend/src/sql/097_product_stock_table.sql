-- 097: Creation de la table product_stock
-- Utilisee par stockService.js et seedProductStock() dans bootstrap PLTE
-- Necessaire pour N15_order_cycle (commerce)

CREATE TABLE IF NOT EXISTS product_stock (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0,
  last_restock_at TIMESTAMPTZ,
  last_sale_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, product_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_product_stock_tenant ON product_stock(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_product ON product_stock(tenant_id, product_id);

-- RLS
ALTER TABLE product_stock ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_product_stock ON product_stock FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
