-- Migration 040: Table de suivi des notifications en cascade
-- Date: 2026-02-27
-- Description: Tracking des livraisons pour optimiser la cascade Email -> WhatsApp -> SMS

-- Table de suivi des livraisons de notifications
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  notification_id VARCHAR(100) NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'bounced')),

  -- Timestamps de progression
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  failed_at TIMESTAMP,

  -- Metadata (message_id, error, etc.)
  metadata JSONB DEFAULT '{}',

  -- Cout de cette notification
  cost_cents INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Contrainte unique: un seul enregistrement par notification/canal
  UNIQUE(notification_id, channel)
);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_tenant ON notification_deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_notif ON notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_channel ON notification_deliveries(channel);
CREATE INDEX IF NOT EXISTS idx_notif_deliveries_created ON notification_deliveries(created_at);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_notification_deliveries_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  -- Auto-set timestamps based on status
  IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
    NEW.sent_at = NOW();
  END IF;
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    NEW.delivered_at = NOW();
  END IF;
  IF NEW.status = 'read' AND OLD.status != 'read' THEN
    NEW.read_at = NOW();
  END IF;
  IF NEW.status = 'failed' AND OLD.status != 'failed' THEN
    NEW.failed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS notification_deliveries_updated_at ON notification_deliveries;
CREATE TRIGGER notification_deliveries_updated_at
  BEFORE UPDATE ON notification_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_deliveries_timestamp();

-- Vue pour statistiques de cascade par tenant
CREATE OR REPLACE VIEW notification_cascade_stats AS
SELECT
  tenant_id,
  DATE(created_at) as date,
  COUNT(*) as total_notifications,
  COUNT(*) FILTER (WHERE channel = 'email' AND status IN ('sent', 'delivered', 'read')) as email_success,
  COUNT(*) FILTER (WHERE channel = 'whatsapp' AND status IN ('sent', 'delivered', 'read')) as whatsapp_success,
  COUNT(*) FILTER (WHERE channel = 'sms' AND status IN ('sent', 'delivered', 'read')) as sms_success,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  SUM(cost_cents) as total_cost_cents,
  -- Calcul economie: on compare au cout si tout etait SMS (4 cents)
  (COUNT(DISTINCT notification_id) * 4) - SUM(cost_cents) as saved_cents
FROM notification_deliveries
GROUP BY tenant_id, DATE(created_at);

-- Fonction pour obtenir le meilleur canal pour un client
CREATE OR REPLACE FUNCTION get_best_channel_for_client(
  p_tenant_id VARCHAR(255),
  p_client_email VARCHAR(255),
  p_client_phone VARCHAR(50)
) RETURNS VARCHAR(20) AS $$
DECLARE
  v_email_read_rate NUMERIC;
  v_whatsapp_read_rate NUMERIC;
BEGIN
  -- Calculer le taux de lecture email pour ce client
  SELECT
    COALESCE(
      COUNT(*) FILTER (WHERE status = 'read')::NUMERIC / NULLIF(COUNT(*), 0),
      0
    )
  INTO v_email_read_rate
  FROM notification_deliveries
  WHERE tenant_id = p_tenant_id
    AND channel = 'email'
    AND metadata->>'recipient_email' = p_client_email
    AND created_at > NOW() - INTERVAL '90 days';

  -- Calculer le taux de lecture WhatsApp
  SELECT
    COALESCE(
      COUNT(*) FILTER (WHERE status IN ('delivered', 'read'))::NUMERIC / NULLIF(COUNT(*), 0),
      0
    )
  INTO v_whatsapp_read_rate
  FROM notification_deliveries
  WHERE tenant_id = p_tenant_id
    AND channel = 'whatsapp'
    AND metadata->>'recipient_phone' = p_client_phone
    AND created_at > NOW() - INTERVAL '90 days';

  -- Retourner le meilleur canal
  IF v_email_read_rate >= 0.7 THEN
    RETURN 'email';
  ELSIF v_whatsapp_read_rate >= 0.8 THEN
    RETURN 'whatsapp';
  ELSIF p_client_email IS NOT NULL THEN
    RETURN 'email'; -- Email par defaut si disponible
  ELSIF p_client_phone IS NOT NULL THEN
    RETURN 'whatsapp';
  ELSE
    RETURN 'none';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Commentaires
COMMENT ON TABLE notification_deliveries IS 'Suivi des livraisons de notifications pour la cascade Email->WhatsApp->SMS';
COMMENT ON VIEW notification_cascade_stats IS 'Statistiques quotidiennes de la cascade de notifications par tenant';
COMMENT ON FUNCTION get_best_channel_for_client IS 'Determine le meilleur canal de notification pour un client base sur son historique';
