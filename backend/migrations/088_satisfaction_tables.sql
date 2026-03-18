-- Migration 088: Tables Satisfaction (enquêtes, envois, réponses)

CREATE TABLE IF NOT EXISTS satisfaction_enquetes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  titre TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT NOT NULL CHECK (type IN ('chaud', 'froid', 'custom')),
  questions JSONB NOT NULL DEFAULT '[]',
  actif BOOLEAN DEFAULT true,
  envois_count INTEGER DEFAULT 0,
  reponses_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS satisfaction_envois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  enquete_id UUID NOT NULL REFERENCES satisfaction_enquetes(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  channel TEXT DEFAULT 'email',
  repondu BOOLEAN DEFAULT false,
  repondu_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS satisfaction_reponses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  enquete_id UUID NOT NULL REFERENCES satisfaction_enquetes(id) ON DELETE CASCADE,
  envoi_id UUID NOT NULL REFERENCES satisfaction_envois(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_sat_enquetes_tenant ON satisfaction_enquetes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sat_envois_tenant ON satisfaction_envois(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sat_envois_token ON satisfaction_envois(token);
CREATE INDEX IF NOT EXISTS idx_sat_envois_enquete ON satisfaction_envois(enquete_id);
CREATE INDEX IF NOT EXISTS idx_sat_reponses_tenant ON satisfaction_reponses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sat_reponses_enquete ON satisfaction_reponses(enquete_id);

-- RLS
ALTER TABLE satisfaction_enquetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE satisfaction_envois ENABLE ROW LEVEL SECURITY;
ALTER TABLE satisfaction_reponses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sat_enquetes_tenant_isolation" ON satisfaction_enquetes
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY "sat_envois_tenant_isolation" ON satisfaction_envois
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY "sat_reponses_tenant_isolation" ON satisfaction_reponses
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));
