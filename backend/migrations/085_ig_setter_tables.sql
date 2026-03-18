-- Migration 085: Tables Setter IA Instagram
-- Conversations de qualification automatique via DMs Instagram

CREATE TABLE IF NOT EXISTS ig_setter_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  instagram_user_id TEXT NOT NULL,
  sender_username TEXT,
  sender_name TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new',
  current_step INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  responses JSONB DEFAULT '{}',
  relance_count INTEGER DEFAULT 0,
  qualified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ig_setter_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  conversation_id UUID NOT NULL REFERENCES ig_setter_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  content TEXT,
  type TEXT DEFAULT 'message',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_ig_conv_tenant ON ig_setter_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ig_conv_user ON ig_setter_conversations(tenant_id, instagram_user_id);
CREATE INDEX IF NOT EXISTS idx_ig_conv_status ON ig_setter_conversations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ig_msg_conv ON ig_setter_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ig_msg_tenant ON ig_setter_messages(tenant_id);

-- RLS
ALTER TABLE ig_setter_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_setter_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ig_conv_tenant_isolation" ON ig_setter_conversations
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY "ig_msg_tenant_isolation" ON ig_setter_messages
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

-- Trigger updated_at
CREATE TRIGGER trigger_ig_conv_updated_at
  BEFORE UPDATE ON ig_setter_conversations
  FOR EACH ROW EXECUTE FUNCTION update_signature_requests_updated_at();
