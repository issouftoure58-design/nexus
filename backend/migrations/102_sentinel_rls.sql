-- Migration 102: RLS sur tables SENTINEL manquantes (defense-in-depth)

ALTER TABLE sentinel_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sentinel_monthly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE si_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE si_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE si_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE si_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE si_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY sentinel_usage_tenant ON sentinel_usage
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) = '');

CREATE POLICY sentinel_alerts_tenant ON sentinel_alerts
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) = '');

CREATE POLICY sentinel_security_logs_tenant ON sentinel_security_logs
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) = '');

CREATE POLICY sentinel_monthly_goals_tenant ON sentinel_monthly_goals
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) = '');

CREATE POLICY si_metrics_tenant ON si_metrics
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) = '');

CREATE POLICY si_alerts_tenant ON si_alerts
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) = '');

CREATE POLICY si_predictions_tenant ON si_predictions
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) = '');

CREATE POLICY si_anomalies_tenant ON si_anomalies
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) = '');

CREATE POLICY si_reports_tenant ON si_reports
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true) OR current_setting('app.tenant_id', true) = '');
