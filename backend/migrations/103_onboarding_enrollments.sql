-- Migration 103: Onboarding Enrollments
-- Tracker pour les sequences d'onboarding post-paiement

CREATE TABLE IF NOT EXISTS onboarding_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  workflow_id UUID REFERENCES workflows(id),
  client_email VARCHAR(255) NOT NULL,
  client_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled', 'failed')),
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 3,
  steps_completed JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_onboarding_enrollments_tenant ON onboarding_enrollments(tenant_id);
CREATE INDEX idx_onboarding_enrollments_status ON onboarding_enrollments(tenant_id, status);

ALTER TABLE onboarding_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_onboarding_enrollments ON onboarding_enrollments
  USING (tenant_id = current_setting('app.tenant_id')::text);
