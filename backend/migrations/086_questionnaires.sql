-- Migration 086: Tables Questionnaires Qualification

CREATE TABLE IF NOT EXISTS questionnaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  titre TEXT NOT NULL,
  description TEXT DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  questions JSONB NOT NULL DEFAULT '[]',
  config JSONB DEFAULT '{}',
  actif BOOLEAN DEFAULT true,
  submissions_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questionnaire_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  questionnaire_id UUID NOT NULL REFERENCES questionnaires(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  contact JSONB DEFAULT '{}',
  score INTEGER DEFAULT 0,
  qualified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_questionnaires_tenant ON questionnaires(tenant_id);
CREATE INDEX IF NOT EXISTS idx_questionnaires_slug ON questionnaires(slug);
CREATE INDEX IF NOT EXISTS idx_q_submissions_tenant ON questionnaire_submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_q_submissions_questionnaire ON questionnaire_submissions(questionnaire_id);

-- RLS
ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE questionnaire_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questionnaires_tenant_isolation" ON questionnaires
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY "q_submissions_tenant_isolation" ON questionnaire_submissions
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));
