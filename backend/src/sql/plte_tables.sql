-- PLTE — Platform Logic Test Engine
-- Tables pour le moteur de tests logiques SENTINEL

-- Catalogue des tests
CREATE TABLE IF NOT EXISTS sentinel_logic_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  module TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'warning',
  last_status TEXT DEFAULT 'pending',
  last_run_at TIMESTAMPTZ,
  last_error TEXT,
  fail_count INT DEFAULT 0,
  pass_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logic_tests_tenant ON sentinel_logic_tests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_logic_tests_category ON sentinel_logic_tests(tenant_id, category);

-- Historique des executions
CREATE TABLE IF NOT EXISTS sentinel_logic_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  total_tests INT DEFAULT 0,
  passed INT DEFAULT 0,
  failed INT DEFAULT 0,
  errors INT DEFAULT 0,
  health_score NUMERIC(5,2),
  results JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logic_runs_tenant ON sentinel_logic_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_logic_runs_date ON sentinel_logic_runs(tenant_id, started_at DESC);

-- RLS
ALTER TABLE sentinel_logic_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_logic_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "tenant_isolation_logic_tests" ON sentinel_logic_tests
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY IF NOT EXISTS "tenant_isolation_logic_runs" ON sentinel_logic_runs
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

-- Service role bypass (pour le backend)
CREATE POLICY IF NOT EXISTS "service_role_logic_tests" ON sentinel_logic_tests
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "service_role_logic_runs" ON sentinel_logic_runs
  FOR ALL USING (true) WITH CHECK (true);
