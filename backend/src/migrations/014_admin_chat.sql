-- Migration 014: Admin Chat Tables
-- Tables pour le chat admin avec l'IA

-- Table des conversations admin
CREATE TABLE IF NOT EXISTS admin_conversations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  admin_id INTEGER NOT NULL,
  title VARCHAR(255) DEFAULT 'Nouvelle conversation',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_admin_conversations_tenant ON admin_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_conversations_admin ON admin_conversations(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_conversations_updated ON admin_conversations(updated_at DESC);

-- Table des messages
CREATE TABLE IF NOT EXISTS admin_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES admin_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_use JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches
CREATE INDEX IF NOT EXISTS idx_admin_messages_conversation ON admin_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_admin_messages_created ON admin_messages(created_at);

-- Trigger pour mettre à jour updated_at sur admin_conversations
CREATE OR REPLACE FUNCTION update_admin_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE admin_conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON admin_messages;
CREATE TRIGGER trigger_update_conversation_timestamp
AFTER INSERT ON admin_messages
FOR EACH ROW
EXECUTE FUNCTION update_admin_conversation_timestamp();

-- RLS Policies
ALTER TABLE admin_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;

-- Policy pour admin_conversations
DROP POLICY IF EXISTS admin_conversations_tenant_policy ON admin_conversations;
CREATE POLICY admin_conversations_tenant_policy ON admin_conversations
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::INTEGER);

-- Policy pour admin_messages (via conversation)
DROP POLICY IF EXISTS admin_messages_tenant_policy ON admin_messages;
CREATE POLICY admin_messages_tenant_policy ON admin_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM admin_conversations
      WHERE tenant_id = current_setting('app.tenant_id', true)::INTEGER
    )
  );
