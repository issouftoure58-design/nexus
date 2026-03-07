-- Migration 067: Error Logs for SENTINEL error tracking (replaces Sentry)
-- Table pour centraliser le tracking d'erreurs backend + frontend

CREATE TABLE IF NOT EXISTS error_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT,                        -- NULL pour erreurs systeme
  level TEXT NOT NULL DEFAULT 'error',   -- error, warning, info, fatal
  message TEXT NOT NULL,
  stack TEXT,
  context JSONB DEFAULT '{}',            -- endpoint, user_id, request info
  source TEXT DEFAULT 'backend',         -- backend, frontend
  fingerprint TEXT,                      -- hash pour grouper les erreurs similaires
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_tenant ON error_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs(level);
CREATE INDEX IF NOT EXISTS idx_error_logs_fingerprint ON error_logs(fingerprint);
