-- 098: Portail Employe — Tables auth + sessions
-- Permet aux employes de se connecter, consulter planning, demander conges, voir bulletins

-- employee_users (auth separee, liee a rh_membres)
CREATE TABLE IF NOT EXISTS employee_users (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  membre_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT,
  invite_token TEXT,
  invite_expires_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  statut TEXT NOT NULL DEFAULT 'invite_pending'
    CHECK (statut IN ('invite_pending', 'actif', 'desactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email),
  UNIQUE(tenant_id, membre_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_employee_users_tenant ON employee_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_users_email ON employee_users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_employee_users_membre ON employee_users(tenant_id, membre_id);
CREATE INDEX IF NOT EXISTS idx_employee_users_invite ON employee_users(invite_token);

-- RLS
ALTER TABLE employee_users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_employee_users ON employee_users FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- employee_sessions (meme pattern que admin_sessions)
CREATE TABLE IF NOT EXISTS employee_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employee_users(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  device_info TEXT,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_employee_sessions_tenant ON employee_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_sessions_employee ON employee_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_sessions_token ON employee_sessions(token_hash);

-- RLS
ALTER TABLE employee_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY tenant_isolation_employee_sessions ON employee_sessions FOR ALL TO authenticated
    USING (tenant_id = current_setting('app.tenant_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
