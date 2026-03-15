-- ================================================================
-- Migration 080: Tables SENTINEL manquantes
-- Cree les 9 tables utilisees par SENTINEL qui n'avaient pas de migration
-- ================================================================

-- 1. sentinel_usage — Tracking usage IA par tenant par jour
CREATE TABLE IF NOT EXISTS sentinel_usage (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  calls INTEGER DEFAULT 0,
  calls_haiku INTEGER DEFAULT 0,
  calls_sonnet INTEGER DEFAULT 0,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost NUMERIC(10,4) DEFAULT 0,
  channel TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, date)
);

CREATE INDEX IF NOT EXISTS idx_sentinel_usage_tenant_date ON sentinel_usage(tenant_id, date);

-- 2. sentinel_alerts — Alertes quotas et business
CREATE TABLE IF NOT EXISTS sentinel_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  type TEXT,
  level TEXT,
  title TEXT,
  message TEXT,
  percentage NUMERIC(5,2),
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentinel_alerts_tenant ON sentinel_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sentinel_alerts_created ON sentinel_alerts(created_at DESC);

-- 3. sentinel_security_logs — Logs securite (batch insert)
CREATE TABLE IF NOT EXISTS sentinel_security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  ip_address TEXT,
  user_id TEXT,
  tenant_id TEXT,
  path TEXT,
  method TEXT,
  details JSONB DEFAULT '{}',
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_logs_tenant ON sentinel_security_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip ON sentinel_security_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_logs_type ON sentinel_security_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_logs_created ON sentinel_security_logs(created_at DESC);

-- 4. sentinel_monthly_goals — Objectifs mensuels par tenant
CREATE TABLE IF NOT EXISTS sentinel_monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  goal_revenue NUMERIC(12,2) DEFAULT 0,
  goal_new_clients INTEGER DEFAULT 0,
  goal_reservations INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, year, month)
);

-- 5. si_metrics — Metriques SENTINEL Intelligence
CREATE TABLE IF NOT EXISTS si_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  revenue_day NUMERIC(12,2) DEFAULT 0,
  revenue_week NUMERIC(12,2) DEFAULT 0,
  revenue_month NUMERIC(12,2) DEFAULT 0,
  bookings_day INTEGER DEFAULT 0,
  bookings_week INTEGER DEFAULT 0,
  bookings_month INTEGER DEFAULT 0,
  customers_total INTEGER DEFAULT 0,
  customers_new INTEGER DEFAULT 0,
  customers_active INTEGER DEFAULT 0,
  stock_items_low INTEGER DEFAULT 0,
  stock_items_out INTEGER DEFAULT 0,
  orders_pending INTEGER DEFAULT 0,
  orders_completed INTEGER DEFAULT 0,
  leaves_pending INTEGER DEFAULT 0,
  payments_failed INTEGER DEFAULT 0,
  health_score INTEGER DEFAULT 0,
  UNIQUE(tenant_id, date)
);

CREATE INDEX IF NOT EXISTS idx_si_metrics_tenant_date ON si_metrics(tenant_id, date);

-- 6. si_alerts — Alertes SENTINEL Intelligence
CREATE TABLE IF NOT EXISTS si_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  title TEXT,
  message TEXT,
  impact TEXT,
  recommendations JSONB,
  data JSONB,
  status TEXT DEFAULT 'active',
  dismissed_at TIMESTAMPTZ,
  dismissed_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_si_alerts_tenant ON si_alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_si_alerts_status ON si_alerts(status);

-- 7. si_predictions — Predictions SENTINEL Intelligence
CREATE TABLE IF NOT EXISTS si_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  prediction_date DATE NOT NULL,
  target_date DATE NOT NULL,
  type TEXT NOT NULL,
  predicted_value NUMERIC(12,2),
  confidence_score NUMERIC(4,3),
  baseline_value NUMERIC(12,2),
  details JSONB,
  actual_value NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_si_predictions_tenant ON si_predictions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_si_predictions_target ON si_predictions(target_date);

-- 8. si_anomalies — Anomalies detectees par SENTINEL Intelligence
CREATE TABLE IF NOT EXISTS si_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL,
  metric TEXT NOT NULL,
  baseline_value NUMERIC(12,2),
  current_value NUMERIC(12,2),
  deviation_percent NUMERIC(8,2),
  severity TEXT DEFAULT 'medium',
  possible_causes JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  investigated BOOLEAN DEFAULT FALSE,
  investigation_notes TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_si_anomalies_tenant ON si_anomalies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_si_anomalies_resolved ON si_anomalies(resolved);

-- 9. si_reports — Rapports generes par SENTINEL Intelligence
CREATE TABLE IF NOT EXISTS si_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'weekly',
  period_start DATE,
  period_end DATE,
  summary JSONB,
  highlights JSONB,
  recommendations JSONB,
  charts JSONB,
  file_url TEXT,
  status TEXT DEFAULT 'generated',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_si_reports_tenant ON si_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_si_reports_type ON si_reports(type);
