-- Migration 104: Push Subscriptions (Web Push Notifications)
-- Stocke les abonnements push des admins pour les notifications navigateur

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Un seul abonnement par endpoint (éviter les doublons multi-devices)
CREATE UNIQUE INDEX idx_push_sub_endpoint ON push_subscriptions(endpoint);

-- Recherche rapide par user (envoi de push)
CREATE INDEX idx_push_sub_user ON push_subscriptions(user_id);

-- TENANT SHIELD: index tenant_id
CREATE INDEX idx_push_sub_tenant ON push_subscriptions(tenant_id);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Politique: un admin ne voit/gère que ses propres subscriptions dans son tenant
CREATE POLICY "push_sub_own" ON push_subscriptions
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true));
