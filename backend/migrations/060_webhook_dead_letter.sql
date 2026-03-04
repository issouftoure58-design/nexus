-- Migration 060: Webhook dead letter + consecutive failures tracking
-- Sprint 3.2 — Webhook retry + dead letter queue

-- Compteur d'échecs consécutifs pour auto-désactivation
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;

-- Index pour retrouver les webhooks désactivés automatiquement
CREATE INDEX IF NOT EXISTS idx_webhook_logs_failed ON webhook_logs(webhook_id, status) WHERE status = 'failed';
