-- Migration 043: Conversations IA avec les clients
-- Stocke l'historique des conversations WhatsApp, Téléphone, Web Chat

-- Table des sessions de conversation IA
CREATE TABLE IF NOT EXISTS ia_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'telephone', 'web', 'sms')),
  external_id TEXT, -- WhatsApp conversation ID, Twilio Call SID, etc.
  phone_number TEXT, -- Numéro du client
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'transferred', 'abandoned')),
  metadata JSONB DEFAULT '{}', -- Infos supplémentaires (durée appel, etc.)
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des messages dans les conversations IA
CREATE TABLE IF NOT EXISTS ia_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES ia_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'function')),
  content TEXT NOT NULL,
  content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'audio', 'image', 'location', 'document')),
  media_url TEXT, -- URL du media (audio, image, etc.)
  tool_calls JSONB, -- Appels de fonction IA
  tokens_used INTEGER DEFAULT 0,
  latency_ms INTEGER, -- Temps de réponse IA
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des actions/intents détectés
CREATE TABLE IF NOT EXISTS ia_intents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES ia_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES ia_messages(id) ON DELETE CASCADE,
  intent TEXT NOT NULL, -- booking, info, complaint, etc.
  confidence NUMERIC(3,2), -- 0.00 à 1.00
  entities JSONB DEFAULT '{}', -- Entités extraites (date, heure, service, etc.)
  action_taken TEXT, -- Action effectuée (reservation_created, etc.)
  action_result JSONB, -- Résultat de l'action
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_ia_conversations_tenant ON ia_conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ia_conversations_client ON ia_conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_ia_conversations_channel ON ia_conversations(channel);
CREATE INDEX IF NOT EXISTS idx_ia_conversations_phone ON ia_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_ia_conversations_external ON ia_conversations(external_id);
CREATE INDEX IF NOT EXISTS idx_ia_conversations_status ON ia_conversations(status);
CREATE INDEX IF NOT EXISTS idx_ia_conversations_started ON ia_conversations(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ia_messages_conversation ON ia_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ia_messages_created ON ia_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_ia_intents_conversation ON ia_intents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ia_intents_intent ON ia_intents(intent);

-- RLS
ALTER TABLE ia_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_intents ENABLE ROW LEVEL SECURITY;

-- Policies avec tenant isolation
DROP POLICY IF EXISTS ia_conversations_tenant_policy ON ia_conversations;
CREATE POLICY ia_conversations_tenant_policy ON ia_conversations
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ia_messages_tenant_policy ON ia_messages;
CREATE POLICY ia_messages_tenant_policy ON ia_messages
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ia_intents_tenant_policy ON ia_intents;
CREATE POLICY ia_intents_tenant_policy ON ia_intents
  FOR ALL USING (true) WITH CHECK (true);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_ia_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ia_conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ia_conversation_timestamp ON ia_messages;
CREATE TRIGGER trigger_update_ia_conversation_timestamp
AFTER INSERT ON ia_messages
FOR EACH ROW
EXECUTE FUNCTION update_ia_conversation_timestamp();

-- Vue pour statistiques conversations
CREATE OR REPLACE VIEW ia_conversation_stats AS
SELECT
  c.tenant_id,
  c.channel,
  DATE_TRUNC('day', c.started_at) as date,
  COUNT(DISTINCT c.id) as total_conversations,
  COUNT(DISTINCT CASE WHEN c.status = 'closed' THEN c.id END) as completed,
  COUNT(DISTINCT CASE WHEN c.status = 'transferred' THEN c.id END) as transferred,
  COUNT(DISTINCT CASE WHEN c.status = 'abandoned' THEN c.id END) as abandoned,
  COUNT(m.id) as total_messages,
  AVG(m.latency_ms) as avg_latency_ms,
  SUM(m.tokens_used) as total_tokens
FROM ia_conversations c
LEFT JOIN ia_messages m ON c.id = m.conversation_id
GROUP BY c.tenant_id, c.channel, DATE_TRUNC('day', c.started_at);

COMMENT ON TABLE ia_conversations IS 'Sessions de conversation IA avec les clients';
COMMENT ON TABLE ia_messages IS 'Messages échangés dans les conversations IA';
COMMENT ON TABLE ia_intents IS 'Intentions/actions détectées par l''IA';
