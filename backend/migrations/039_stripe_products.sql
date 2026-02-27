-- Migration 039: Table des produits Stripe
-- Date: 2026-02-27
-- Description: Stockage des produits/prix Stripe pour la facturation

-- Table principale des produits Stripe
CREATE TABLE IF NOT EXISTS stripe_products (
  id SERIAL PRIMARY KEY,
  product_code VARCHAR(100) NOT NULL UNIQUE,
  stripe_product_id VARCHAR(100),
  stripe_price_id VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN ('plan', 'module', 'addon', 'pack')),
  billing_type VARCHAR(50) NOT NULL CHECK (billing_type IN ('recurring', 'one_time', 'metered')),
  amount INTEGER NOT NULL, -- en centimes
  currency VARCHAR(3) DEFAULT 'eur',
  interval VARCHAR(20) CHECK (interval IN ('month', 'year') OR interval IS NULL),
  interval_count INTEGER DEFAULT 1,
  trial_days INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_stripe_products_code ON stripe_products(product_code);
CREATE INDEX IF NOT EXISTS idx_stripe_products_type ON stripe_products(type);
CREATE INDEX IF NOT EXISTS idx_stripe_products_active ON stripe_products(active);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_stripe_products_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stripe_products_updated_at ON stripe_products;
CREATE TRIGGER stripe_products_updated_at
  BEFORE UPDATE ON stripe_products
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_products_timestamp();

-- Insertion des produits de base
-- Note: stripe_product_id et stripe_price_id seront remplis apres creation dans Stripe Dashboard

INSERT INTO stripe_products (product_code, name, description, type, billing_type, amount, interval, trial_days) VALUES
-- Plans mensuels
('nexus_starter_monthly', 'NEXUS Starter Mensuel', 'Plan Starter - 1 utilisateur, 500 clients, 100 SMS/mois', 'plan', 'recurring', 4900, 'month', 14),
('nexus_pro_monthly', 'NEXUS Pro Mensuel', 'Plan Pro - 5 utilisateurs, 5000 clients, 500 SMS/mois, IA Voix 60min', 'plan', 'recurring', 12900, 'month', 14),
('nexus_business_monthly', 'NEXUS Business Mensuel', 'Plan Business - 20 utilisateurs, illimite, 2000 SMS/mois, IA Voix 300min', 'plan', 'recurring', 29900, 'month', 14),

-- Plans annuels (-20%)
('nexus_starter_yearly', 'NEXUS Starter Annuel', 'Plan Starter annuel - Economisez 20%', 'plan', 'recurring', 46800, 'year', 14),
('nexus_pro_yearly', 'NEXUS Pro Annuel', 'Plan Pro annuel - Economisez 20%', 'plan', 'recurring', 123600, 'year', 14),
('nexus_business_yearly', 'NEXUS Business Annuel', 'Plan Business annuel - Economisez 20%', 'plan', 'recurring', 286800, 'year', 14),

-- Modules specialises
('nexus_module_restaurant', 'Module Restaurant Pro', 'Gestion tables, menus, services midi/soir', 'module', 'recurring', 2900, 'month', 0),
('nexus_module_hotel', 'Module Hotel Pro', 'Gestion chambres, tarifs saisonniers, channel manager', 'module', 'recurring', 4900, 'month', 0),
('nexus_module_domicile', 'Module Domicile Pro', 'Zones, tournees, GPS temps reel', 'module', 'recurring', 1900, 'month', 0),

-- Packs SMS (one-time)
('nexus_sms_100', 'Pack 100 SMS', '100 SMS supplementaires', 'pack', 'one_time', 800, NULL, 0),
('nexus_sms_500', 'Pack 500 SMS', '500 SMS supplementaires', 'pack', 'one_time', 3500, NULL, 0),
('nexus_sms_1000', 'Pack 1000 SMS', '1000 SMS supplementaires', 'pack', 'one_time', 6000, NULL, 0),
('nexus_sms_5000', 'Pack 5000 SMS', '5000 SMS supplementaires', 'pack', 'one_time', 25000, NULL, 0),

-- Packs Voix IA (one-time)
('nexus_voice_30', 'Pack 30 min Voix IA', '30 minutes IA vocale supplementaires', 'pack', 'one_time', 600, NULL, 0),
('nexus_voice_60', 'Pack 60 min Voix IA', '60 minutes IA vocale supplementaires', 'pack', 'one_time', 1000, NULL, 0),
('nexus_voice_120', 'Pack 120 min Voix IA', '120 minutes IA vocale supplementaires', 'pack', 'one_time', 1800, NULL, 0),
('nexus_voice_300', 'Pack 300 min Voix IA', '300 minutes IA vocale supplementaires', 'pack', 'one_time', 3900, NULL, 0),

-- Utilisateurs supplementaires (metered)
('nexus_user_starter', 'Utilisateur Starter', 'Utilisateur supplementaire plan Starter', 'addon', 'metered', 1500, 'month', 0),
('nexus_user_pro', 'Utilisateur Pro', 'Utilisateur supplementaire plan Pro', 'addon', 'metered', 1200, 'month', 0),
('nexus_user_business', 'Utilisateur Business', 'Utilisateur supplementaire plan Business', 'addon', 'metered', 1000, 'month', 0)

ON CONFLICT (product_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  amount = EXCLUDED.amount,
  updated_at = NOW();

-- Table de mapping tenant -> subscription Stripe
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(100) NOT NULL,
  stripe_subscription_id VARCHAR(100),
  product_code VARCHAR(100) NOT NULL REFERENCES stripe_products(product_code),
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing', 'incomplete')),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_tenant ON tenant_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_stripe ON tenant_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_tenant_subscriptions_status ON tenant_subscriptions(status);

-- Table des achats one-time (packs SMS, voix)
CREATE TABLE IF NOT EXISTS tenant_purchases (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_code VARCHAR(100) NOT NULL REFERENCES stripe_products(product_code),
  stripe_payment_intent_id VARCHAR(100),
  quantity INTEGER DEFAULT 1,
  amount_paid INTEGER NOT NULL, -- centimes
  credits_granted INTEGER NOT NULL, -- SMS ou minutes
  credits_used INTEGER DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  purchased_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP -- optionnel, pour packs avec expiration
);

CREATE INDEX IF NOT EXISTS idx_tenant_purchases_tenant ON tenant_purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_purchases_product ON tenant_purchases(product_code);

-- Vue pour obtenir les credits disponibles par tenant
CREATE OR REPLACE VIEW tenant_credits AS
SELECT
  tenant_id,
  CASE
    WHEN product_code LIKE 'nexus_sms_%' THEN 'sms'
    WHEN product_code LIKE 'nexus_voice_%' THEN 'voice'
  END as credit_type,
  SUM(credits_granted - credits_used) as credits_remaining,
  SUM(credits_granted) as credits_total,
  SUM(credits_used) as credits_used
FROM tenant_purchases
WHERE status = 'completed'
  AND (expires_at IS NULL OR expires_at > NOW())
GROUP BY tenant_id,
  CASE
    WHEN product_code LIKE 'nexus_sms_%' THEN 'sms'
    WHEN product_code LIKE 'nexus_voice_%' THEN 'voice'
  END;

-- Fonction pour consommer des credits
CREATE OR REPLACE FUNCTION consume_credits(
  p_tenant_id VARCHAR(255),
  p_credit_type VARCHAR(20),
  p_amount INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_available INTEGER;
  v_purchase RECORD;
  v_remaining INTEGER;
BEGIN
  -- Verifier credits disponibles
  SELECT COALESCE(SUM(credits_granted - credits_used), 0)
  INTO v_available
  FROM tenant_purchases
  WHERE tenant_id = p_tenant_id
    AND status = 'completed'
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (
      (p_credit_type = 'sms' AND product_code LIKE 'nexus_sms_%')
      OR (p_credit_type = 'voice' AND product_code LIKE 'nexus_voice_%')
    );

  IF v_available < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Consommer les credits (FIFO par date d'achat)
  v_remaining := p_amount;

  FOR v_purchase IN
    SELECT id, credits_granted - credits_used as available
    FROM tenant_purchases
    WHERE tenant_id = p_tenant_id
      AND status = 'completed'
      AND (expires_at IS NULL OR expires_at > NOW())
      AND credits_granted > credits_used
      AND (
        (p_credit_type = 'sms' AND product_code LIKE 'nexus_sms_%')
        OR (p_credit_type = 'voice' AND product_code LIKE 'nexus_voice_%')
      )
    ORDER BY purchased_at ASC
  LOOP
    IF v_remaining <= 0 THEN
      EXIT;
    END IF;

    IF v_purchase.available >= v_remaining THEN
      UPDATE tenant_purchases
      SET credits_used = credits_used + v_remaining
      WHERE id = v_purchase.id;
      v_remaining := 0;
    ELSE
      UPDATE tenant_purchases
      SET credits_used = credits_granted
      WHERE id = v_purchase.id;
      v_remaining := v_remaining - v_purchase.available;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Commentaires
COMMENT ON TABLE stripe_products IS 'Catalogue des produits Stripe (plans, modules, packs)';
COMMENT ON TABLE tenant_subscriptions IS 'Abonnements actifs des tenants';
COMMENT ON TABLE tenant_purchases IS 'Achats one-time (packs SMS, voix)';
COMMENT ON VIEW tenant_credits IS 'Vue des credits disponibles par tenant';
COMMENT ON FUNCTION consume_credits IS 'Consomme des credits SMS ou voix (FIFO)';
