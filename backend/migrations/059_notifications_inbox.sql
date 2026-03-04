-- Migration 059: Notifications in-app
-- Sprint 2.3 — Système de notifications in-app

CREATE TABLE IF NOT EXISTS notifications_inbox (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL,
  admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  message TEXT,
  link VARCHAR(500),
  icon VARCHAR(50),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications_inbox(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_admin ON notifications_inbox(admin_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications_inbox(admin_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications_inbox(created_at DESC);
