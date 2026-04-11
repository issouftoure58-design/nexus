-- ============================================
-- Migration 108 : Alertes crédits IA
-- Table de tracking pour éviter le spam (1 email par seuil par mois)
-- ============================================

CREATE TABLE IF NOT EXISTS credit_alerts_sent (
  id             BIGSERIAL PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  threshold      INT NOT NULL CHECK (threshold IN (50, 80, 100)),
  month          TEXT NOT NULL,  -- 'YYYY-MM' pour dédupliquer par mois
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(tenant_id, threshold, month)
);

-- Index pour lookup rapide
CREATE INDEX IF NOT EXISTS idx_credit_alerts_tenant_month
  ON credit_alerts_sent(tenant_id, month);

-- RLS
ALTER TABLE credit_alerts_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS credit_alerts_tenant_isolation ON credit_alerts_sent;
CREATE POLICY credit_alerts_tenant_isolation ON credit_alerts_sent
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

COMMENT ON TABLE credit_alerts_sent IS 'Tracking des alertes crédits envoyées (anti-spam : 1 email par seuil par mois)';

-- ============================================
-- Vérification
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_alerts_sent') THEN
    RAISE NOTICE '✅ Migration 108 OK — Table credit_alerts_sent créée';
  END IF;
END $$;
