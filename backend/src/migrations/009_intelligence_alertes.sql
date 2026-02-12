-- =====================================================
-- Migration 009: Intelligence Alertes (Business Plan)
-- SEMAINE 8 JOUR 4 - Admin IA Intelligence
-- =====================================================

-- Table des alertes intelligentes
CREATE TABLE IF NOT EXISTS intelligence_alertes (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('warning', 'alert', 'info')),
  metric TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  suggestion TEXT,
  statut TEXT DEFAULT 'active' CHECK (statut IN ('active', 'resolved', 'ignored')),
  resolved_at TIMESTAMP,
  ignored_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table historique des metriques (pour predictions)
CREATE TABLE IF NOT EXISTS intelligence_metrics_history (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metrics JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des predictions IA
CREATE TABLE IF NOT EXISTS intelligence_predictions (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'ca', 'rdv', 'churn', etc.
  prediction JSONB NOT NULL,
  confidence INTEGER DEFAULT 50,
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des suggestions IA
CREATE TABLE IF NOT EXISTS intelligence_suggestions (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  context TEXT,
  suggestions JSONB NOT NULL,
  applied BOOLEAN DEFAULT false,
  applied_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_intelligence_alertes_tenant ON intelligence_alertes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_alertes_statut ON intelligence_alertes(statut) WHERE statut = 'active';
CREATE INDEX IF NOT EXISTS idx_intelligence_alertes_created ON intelligence_alertes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intelligence_metrics_tenant ON intelligence_metrics_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_metrics_created ON intelligence_metrics_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intelligence_predictions_tenant ON intelligence_predictions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_intelligence_predictions_type ON intelligence_predictions(type);

CREATE INDEX IF NOT EXISTS idx_intelligence_suggestions_tenant ON intelligence_suggestions(tenant_id);

-- Retention: Garder 90 jours d'historique metriques
-- (A executer periodiquement via job)
-- DELETE FROM intelligence_metrics_history WHERE created_at < NOW() - INTERVAL '90 days';

COMMENT ON TABLE intelligence_alertes IS 'Alertes IA automatiques - Plan Business';
COMMENT ON TABLE intelligence_metrics_history IS 'Historique metriques pour predictions - Plan Business';
COMMENT ON TABLE intelligence_predictions IS 'Predictions IA (CA, churn, etc.) - Plan Business';
COMMENT ON TABLE intelligence_suggestions IS 'Suggestions IA automatiques - Plan Business';
