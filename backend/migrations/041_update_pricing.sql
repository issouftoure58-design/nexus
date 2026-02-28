-- Migration 041: Mise à jour grille tarifaire NEXUS
-- Date: 2026-02-28
-- Description: Nouveaux prix validés (Starter 99€, Pro 249€, Business 499€)

-- ════════════════════════════════════════════════════════════════════
-- PLANS PRINCIPAUX
-- ════════════════════════════════════════════════════════════════════

-- Plans mensuels
UPDATE stripe_products SET amount = 9900, name = 'NEXUS Starter', description = 'Plan Starter - 1 utilisateur, 1000 clients, 200 SMS/mois' WHERE product_code = 'nexus_starter_monthly';
UPDATE stripe_products SET amount = 24900, name = 'NEXUS Pro', description = 'Plan Pro - 5 utilisateurs, 5000 clients, 500 SMS/mois, 60min voix IA' WHERE product_code = 'nexus_pro_monthly';
UPDATE stripe_products SET amount = 49900, name = 'NEXUS Business', description = 'Plan Business - 20 utilisateurs, illimité, 2000 SMS/mois, 300min voix IA' WHERE product_code = 'nexus_business_monthly';

-- Plans annuels (-20%)
UPDATE stripe_products SET amount = 95000, name = 'NEXUS Starter Annuel', description = 'Plan Starter annuel - Économisez 20%' WHERE product_code = 'nexus_starter_yearly';
UPDATE stripe_products SET amount = 239000, name = 'NEXUS Pro Annuel', description = 'Plan Pro annuel - Économisez 20%' WHERE product_code = 'nexus_pro_yearly';
UPDATE stripe_products SET amount = 479000, name = 'NEXUS Business Annuel', description = 'Plan Business annuel - Économisez 20%' WHERE product_code = 'nexus_business_yearly';

-- ════════════════════════════════════════════════════════════════════
-- MODULES MÉTIER
-- ════════════════════════════════════════════════════════════════════

UPDATE stripe_products SET amount = 3900, name = 'Module Restaurant Pro', description = 'Gestion tables, menus, services midi/soir' WHERE product_code = 'nexus_module_restaurant';
UPDATE stripe_products SET amount = 6900, name = 'Module Hôtel Pro', description = 'Gestion chambres, tarifs saisonniers, check-in/out' WHERE product_code = 'nexus_module_hotel';
UPDATE stripe_products SET amount = 2900, name = 'Module Domicile Pro', description = 'Zones, tournées, GPS, frais déplacement' WHERE product_code = 'nexus_module_domicile';

-- ════════════════════════════════════════════════════════════════════
-- PACKS SMS
-- ════════════════════════════════════════════════════════════════════

UPDATE stripe_products SET amount = 1500 WHERE product_code = 'nexus_sms_100';
UPDATE stripe_products SET amount = 6500 WHERE product_code = 'nexus_sms_500';
UPDATE stripe_products SET amount = 11000 WHERE product_code = 'nexus_sms_1000';
UPDATE stripe_products SET amount = 45000 WHERE product_code = 'nexus_sms_5000';

-- ════════════════════════════════════════════════════════════════════
-- PACKS VOIX IA
-- ════════════════════════════════════════════════════════════════════

UPDATE stripe_products SET amount = 1500 WHERE product_code = 'nexus_voice_30';
UPDATE stripe_products SET amount = 2500 WHERE product_code = 'nexus_voice_60';
UPDATE stripe_products SET amount = 4500 WHERE product_code = 'nexus_voice_120';
UPDATE stripe_products SET amount = 9900 WHERE product_code = 'nexus_voice_300';

-- ════════════════════════════════════════════════════════════════════
-- UTILISATEURS SUPPLÉMENTAIRES
-- ════════════════════════════════════════════════════════════════════

UPDATE stripe_products SET amount = 1900 WHERE product_code = 'nexus_user_starter';
UPDATE stripe_products SET amount = 1500 WHERE product_code = 'nexus_user_pro';
UPDATE stripe_products SET amount = 1200 WHERE product_code = 'nexus_user_business';

-- ════════════════════════════════════════════════════════════════════
-- QUOTAS PAR PLAN (nouvelle table si n'existe pas)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plan_quotas (
  id SERIAL PRIMARY KEY,
  plan_id VARCHAR(50) NOT NULL UNIQUE,
  max_users INTEGER NOT NULL DEFAULT 1,
  max_clients INTEGER NOT NULL DEFAULT 1000,
  sms_monthly INTEGER NOT NULL DEFAULT 200,
  voice_minutes_monthly INTEGER NOT NULL DEFAULT 0,
  features JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insérer/Mettre à jour les quotas
INSERT INTO plan_quotas (plan_id, max_users, max_clients, sms_monthly, voice_minutes_monthly, features) VALUES
('starter', 1, 1000, 200, 0, '{"dashboard": true, "clients": true, "reservations": true, "facturation": true, "site_vitrine": true, "agent_ia_web": true}'::jsonb),
('pro', 5, 5000, 500, 60, '{"dashboard": true, "clients": true, "reservations": true, "facturation": true, "site_vitrine": true, "agent_ia_web": true, "whatsapp": true, "telephone": true, "comptabilite": true, "crm_avance": true, "marketing": true, "pipeline": true, "stock": true, "analytics": true, "devis": true}'::jsonb),
('business', 20, -1, 2000, 300, '{"dashboard": true, "clients": true, "reservations": true, "facturation": true, "site_vitrine": true, "agent_ia_web": true, "whatsapp": true, "telephone": true, "comptabilite": true, "crm_avance": true, "marketing": true, "pipeline": true, "stock": true, "analytics": true, "devis": true, "rh": true, "seo": true, "api": true, "sentinel": true, "whitelabel": true}'::jsonb)
ON CONFLICT (plan_id) DO UPDATE SET
  max_users = EXCLUDED.max_users,
  max_clients = EXCLUDED.max_clients,
  sms_monthly = EXCLUDED.sms_monthly,
  voice_minutes_monthly = EXCLUDED.voice_minutes_monthly,
  features = EXCLUDED.features,
  updated_at = NOW();

-- Index
CREATE INDEX IF NOT EXISTS idx_plan_quotas_plan ON plan_quotas(plan_id);

-- Commentaires
COMMENT ON TABLE plan_quotas IS 'Quotas et fonctionnalités par plan (Starter/Pro/Business)';
COMMENT ON COLUMN plan_quotas.max_clients IS '-1 = illimité';
