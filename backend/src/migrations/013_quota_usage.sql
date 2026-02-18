-- ============================================================================
-- Migration 013: Système de quotas et facturation dépassement
-- ============================================================================
--
-- Crée la table quota_usage pour tracker l'usage mensuel par module
-- et permettre la facturation des dépassements (overage)
--
-- ============================================================================

-- Table principale de tracking des quotas
CREATE TABLE IF NOT EXISTS quota_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Période (mois)
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ,

  -- Usage par module (stocké en JSONB pour flexibilité)
  telephone_ia JSONB DEFAULT '{"minutes": 0, "calls": 0}'::jsonb,
  whatsapp_ia JSONB DEFAULT '{"messages": 0}'::jsonb,
  web_chat_ia JSONB DEFAULT '{"sessions": 0, "messages": 0}'::jsonb,
  sms_rdv JSONB DEFAULT '{"sms": 0}'::jsonb,
  marketing_email JSONB DEFAULT '{"emails": 0}'::jsonb,

  -- Dépassements calculés (mis à jour périodiquement)
  overage_total DECIMAL(10, 2) DEFAULT 0,
  overage_details JSONB DEFAULT '{}'::jsonb,

  -- Statut de facturation
  overage_invoiced BOOLEAN DEFAULT FALSE,
  overage_invoice_id TEXT,
  overage_invoiced_at TIMESTAMPTZ,

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Un seul enregistrement par tenant par période
  UNIQUE(tenant_id, period_start)
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_quota_usage_tenant ON quota_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quota_usage_period ON quota_usage(period_start);
CREATE INDEX IF NOT EXISTS idx_quota_usage_tenant_period ON quota_usage(tenant_id, period_start DESC);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_quota_usage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quota_usage_updated ON quota_usage;
CREATE TRIGGER quota_usage_updated
  BEFORE UPDATE ON quota_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_quota_usage_timestamp();

-- Table pour historique des dépassements facturés
CREATE TABLE IF NOT EXISTS quota_overage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Période concernée
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  -- Détails des dépassements
  modules JSONB NOT NULL, -- {"telephone_ia": {"excess": 100, "cost": 50.00}, ...}
  total_amount DECIMAL(10, 2) NOT NULL,

  -- Facturation Stripe
  stripe_invoice_id TEXT,
  stripe_invoice_item_id TEXT,
  stripe_status TEXT DEFAULT 'pending', -- pending, paid, failed

  -- Métadonnées
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_overage_history_tenant ON quota_overage_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_overage_history_period ON quota_overage_history(period_start);

-- Vue pour usage actuel avec calcul des dépassements
CREATE OR REPLACE VIEW quota_current_status AS
SELECT
  qu.tenant_id,
  qu.period_start,
  qu.telephone_ia,
  qu.whatsapp_ia,
  qu.web_chat_ia,
  qu.sms_rdv,
  qu.marketing_email,
  -- Calcul dépassement téléphone (300 min incluses, 0.25€/min)
  CASE
    WHEN (qu.telephone_ia->>'minutes')::int > 300
    THEN ((qu.telephone_ia->>'minutes')::int - 300) * 0.25
    ELSE 0
  END as telephone_overage,
  -- Calcul dépassement WhatsApp (1500 msgs inclus, 0.03€/msg)
  CASE
    WHEN (qu.whatsapp_ia->>'messages')::int > 1500
    THEN ((qu.whatsapp_ia->>'messages')::int - 1500) * 0.03
    ELSE 0
  END as whatsapp_overage,
  -- Calcul dépassement Chat (800 sessions incluses, 0.10€/session)
  CASE
    WHEN (qu.web_chat_ia->>'sessions')::int > 800
    THEN ((qu.web_chat_ia->>'sessions')::int - 800) * 0.10
    ELSE 0
  END as webchat_overage,
  -- Calcul dépassement SMS (200 inclus, 0.10€/SMS)
  CASE
    WHEN (qu.sms_rdv->>'sms')::int > 200
    THEN ((qu.sms_rdv->>'sms')::int - 200) * 0.10
    ELSE 0
  END as sms_overage,
  -- Calcul dépassement Email (5000 inclus, 0.003€/email)
  CASE
    WHEN (qu.marketing_email->>'emails')::int > 5000
    THEN ((qu.marketing_email->>'emails')::int - 5000) * 0.003
    ELSE 0
  END as email_overage,
  qu.updated_at
FROM quota_usage qu
WHERE qu.period_start >= date_trunc('month', CURRENT_DATE);

-- Fonction pour initialiser le quota du mois pour un tenant
CREATE OR REPLACE FUNCTION init_monthly_quota(p_tenant_id TEXT)
RETURNS quota_usage AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_record quota_usage;
BEGIN
  v_period_start := date_trunc('month', CURRENT_DATE);

  INSERT INTO quota_usage (tenant_id, period_start)
  VALUES (p_tenant_id, v_period_start)
  ON CONFLICT (tenant_id, period_start) DO NOTHING
  RETURNING * INTO v_record;

  IF v_record IS NULL THEN
    SELECT * INTO v_record
    FROM quota_usage
    WHERE tenant_id = p_tenant_id
    AND period_start = v_period_start;
  END IF;

  RETURN v_record;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour incrémenter l'usage d'un module
CREATE OR REPLACE FUNCTION increment_quota_usage(
  p_tenant_id TEXT,
  p_module TEXT,
  p_metric TEXT,
  p_amount INT DEFAULT 1
)
RETURNS BOOLEAN AS $$
DECLARE
  v_period_start TIMESTAMPTZ;
  v_current_value INT;
BEGIN
  v_period_start := date_trunc('month', CURRENT_DATE);

  -- S'assurer que l'enregistrement existe
  PERFORM init_monthly_quota(p_tenant_id);

  -- Incrémenter la valeur
  EXECUTE format(
    'UPDATE quota_usage
     SET %I = jsonb_set(%I, ''{%s}'', to_jsonb(COALESCE((%I->>''%s'')::int, 0) + $1))
     WHERE tenant_id = $2 AND period_start = $3',
    p_module, p_module, p_metric, p_module, p_metric
  ) USING p_amount, p_tenant_id, v_period_start;

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erreur increment quota: %', SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE quota_overage_history ENABLE ROW LEVEL SECURITY;

-- Policy: tenants can only see their own quota
CREATE POLICY quota_usage_tenant_policy ON quota_usage
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::text);

CREATE POLICY overage_history_tenant_policy ON quota_overage_history
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::text);

-- Commentaires
COMMENT ON TABLE quota_usage IS 'Tracking mensuel de l''usage par module pour facturation dépassement';
COMMENT ON TABLE quota_overage_history IS 'Historique des facturations de dépassement';
COMMENT ON VIEW quota_current_status IS 'Vue calculée des dépassements en cours';

-- ============================================================================
-- Fin de la migration 013
-- ============================================================================
