-- ============================================================
-- MIGRATION ISOLATION DES TENANTS
-- Exécuter dans Supabase SQL Editor
-- Date: 2026-02-18
-- ============================================================

-- Activer l'extension UUID si pas déjà fait
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ÉTAPE 0: CRÉER LES TABLES MANQUANTES
-- ============================================================

-- Table halimah_tasks (si n'existe pas)
CREATE TABLE IF NOT EXISTS halimah_tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'fatshairafro',
  parent_task_id UUID REFERENCES halimah_tasks(id),
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  steps JSONB DEFAULT '[]',
  current_step INTEGER DEFAULT 0,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Table halimah_google_tokens (si n'existe pas)
CREATE TABLE IF NOT EXISTS halimah_google_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'fatshairafro',
  user_id TEXT NOT NULL DEFAULT 'admin',
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expiry_date BIGINT,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- Table halimah_conversations (si n'existe pas)
CREATE TABLE IF NOT EXISTS halimah_conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'fatshairafro',
  session_id TEXT NOT NULL,
  messages JSONB DEFAULT '[]',
  topic VARCHAR(255),
  client_id UUID,
  tools_used JSONB DEFAULT '[]',
  message_count INTEGER DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- ÉTAPE 1: AJOUT COLONNE TENANT_ID AUX TABLES EXISTANTES
-- ============================================================

-- 1.1 Table halimah_memory
ALTER TABLE halimah_memory
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'fatshairafro';

CREATE INDEX IF NOT EXISTS idx_memory_tenant ON halimah_memory(tenant_id);

-- 1.2 Table halimah_feedback
ALTER TABLE halimah_feedback
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'fatshairafro';

CREATE INDEX IF NOT EXISTS idx_feedback_tenant ON halimah_feedback(tenant_id);

-- 1.3 Table halimah_insights
ALTER TABLE halimah_insights
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'fatshairafro';

CREATE INDEX IF NOT EXISTS idx_insights_tenant ON halimah_insights(tenant_id);

-- 1.4 Index pour halimah_conversations
CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON halimah_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session ON halimah_conversations(session_id);

-- 1.5 Index pour halimah_tasks
CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON halimah_tasks(tenant_id);

-- 1.6 Index pour halimah_google_tokens
CREATE INDEX IF NOT EXISTS idx_google_tokens_tenant ON halimah_google_tokens(tenant_id);

-- ============================================================
-- ÉTAPE 2: VÉRIFICATION QUE RESERVATIONS A BIEN TENANT_ID
-- ============================================================

-- La table reservations devrait déjà avoir tenant_id, sinon l'ajouter
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'fatshairafro';

CREATE INDEX IF NOT EXISTS idx_reservations_tenant ON reservations(tenant_id);

-- ============================================================
-- ÉTAPE 3: ENABLE RLS (Row Level Security)
-- ============================================================

-- 3.1 Activer RLS sur toutes les tables
ALTER TABLE halimah_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE halimah_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE halimah_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE halimah_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE halimah_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE halimah_google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ÉTAPE 4: CRÉER LES POLITIQUES RLS
-- ============================================================

-- 4.1 Politique pour halimah_memory
DROP POLICY IF EXISTS "tenant_isolation_memory" ON halimah_memory;
CREATE POLICY "tenant_isolation_memory" ON halimah_memory
  FOR ALL
  USING (
    -- Service role peut tout voir
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    -- Ou filtrer par tenant_id dans les headers personnalisés
    tenant_id = current_setting('app.current_tenant', true)
  );

-- 4.2 Politique pour halimah_feedback
DROP POLICY IF EXISTS "tenant_isolation_feedback" ON halimah_feedback;
CREATE POLICY "tenant_isolation_feedback" ON halimah_feedback
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    tenant_id = current_setting('app.current_tenant', true)
  );

-- 4.3 Politique pour halimah_insights
DROP POLICY IF EXISTS "tenant_isolation_insights" ON halimah_insights;
CREATE POLICY "tenant_isolation_insights" ON halimah_insights
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    tenant_id = current_setting('app.current_tenant', true)
  );

-- 4.4 Politique pour halimah_conversations
DROP POLICY IF EXISTS "tenant_isolation_conversations" ON halimah_conversations;
CREATE POLICY "tenant_isolation_conversations" ON halimah_conversations
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    tenant_id = current_setting('app.current_tenant', true)
  );

-- 4.5 Politique pour halimah_tasks
DROP POLICY IF EXISTS "tenant_isolation_tasks" ON halimah_tasks;
CREATE POLICY "tenant_isolation_tasks" ON halimah_tasks
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    tenant_id = current_setting('app.current_tenant', true)
  );

-- 4.6 Politique pour halimah_google_tokens (CRITIQUE!)
DROP POLICY IF EXISTS "tenant_isolation_google_tokens" ON halimah_google_tokens;
CREATE POLICY "tenant_isolation_google_tokens" ON halimah_google_tokens
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    tenant_id = current_setting('app.current_tenant', true)
  );

-- 4.7 Politique pour reservations
DROP POLICY IF EXISTS "tenant_isolation_reservations" ON reservations;
CREATE POLICY "tenant_isolation_reservations" ON reservations
  FOR ALL
  USING (
    (auth.jwt() ->> 'role') = 'service_role'
    OR
    tenant_id = current_setting('app.current_tenant', true)
  );

-- ============================================================
-- ÉTAPE 5: PERMETTRE AU SERVICE ROLE DE TOUT FAIRE
-- ============================================================

-- Ces politiques permettent au service_role de bypass RLS
-- Le service_role est utilisé par l'API backend

DROP POLICY IF EXISTS "service_role_all_memory" ON halimah_memory;
CREATE POLICY "service_role_all_memory" ON halimah_memory
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_feedback" ON halimah_feedback;
CREATE POLICY "service_role_all_feedback" ON halimah_feedback
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_insights" ON halimah_insights;
CREATE POLICY "service_role_all_insights" ON halimah_insights
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_conversations" ON halimah_conversations;
CREATE POLICY "service_role_all_conversations" ON halimah_conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_tasks" ON halimah_tasks;
CREATE POLICY "service_role_all_tasks" ON halimah_tasks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_google_tokens" ON halimah_google_tokens;
CREATE POLICY "service_role_all_google_tokens" ON halimah_google_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_reservations" ON reservations;
CREATE POLICY "service_role_all_reservations" ON reservations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- ÉTAPE 6: INDEX COMPOSITES POUR PERFORMANCES
-- ============================================================

-- Index composites tenant_id + autres colonnes fréquentes
CREATE INDEX IF NOT EXISTS idx_memory_tenant_type ON halimah_memory(tenant_id, type, category);
CREATE INDEX IF NOT EXISTS idx_memory_tenant_key ON halimah_memory(tenant_id, key);
CREATE INDEX IF NOT EXISTS idx_memory_tenant_subject ON halimah_memory(tenant_id, subject_type, subject_id);

CREATE INDEX IF NOT EXISTS idx_reservations_tenant_date ON reservations(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_statut ON reservations(tenant_id, statut);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status ON halimah_tasks(tenant_id, status);

-- ============================================================
-- VÉRIFICATION
-- ============================================================

SELECT
  'Migration Tenant Isolation terminée avec succès!' AS status,
  NOW() AS executed_at;

-- Afficher le nombre d'enregistrements par tenant pour vérification
SELECT
  'halimah_memory' AS table_name,
  tenant_id,
  COUNT(*) AS count
FROM halimah_memory
GROUP BY tenant_id
UNION ALL
SELECT
  'reservations' AS table_name,
  tenant_id,
  COUNT(*) AS count
FROM reservations
GROUP BY tenant_id
ORDER BY table_name, tenant_id;
