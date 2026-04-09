-- ════════════════════════════════════════════════════════════════════
-- Migration 104: Pivot pricing modèle 2026 + Crédits IA
-- Date: 2026-04-08
-- ════════════════════════════════════════════════════════════════════
--
-- Nouveau modèle (validé 8 avril 2026 — voir memory/business-model-2026.md):
--   • Free  : freemium à vie (50 clients, 30 RDV/mois, 20 factures/mois, IA bloquée)
--   • Basic : 29€/mois — tout illimité non-IA, IA via crédits pay-as-you-go
--   • Business : 129€/mois — Basic + multi-site/whitelabel/api/sso + 3500 crédits IA inclus
--
-- Crédits IA universels :
--   • 1,5€ = 100 crédits (taux de référence interne — 0,015€/crédit)
--   • Pack S : 29€  → 2 400  crédits (+25% bonus)
--   • Pack M : 99€  → 9 200  crédits (+40% bonus)
--   • Pack L : 199€ → 20 000 crédits (+50% bonus)
--
-- Stratégie grandfathering :
--   • Plans 'starter' / 'pro' marqués DEPRECATED mais gardés en DB
--   • Tenants existants conservent leur plan_id (statut legacy_pricing=TRUE)
--   • Migration vers free/basic uniquement sur action volontaire (Phase 7)
-- ════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════
-- 1. Étendre table plans : nouveau flag deprecated + crédits IA inclus
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE plans ADD COLUMN IF NOT EXISTS deprecated BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS credits_ia_inclus INTEGER DEFAULT 0;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS reservations_max_mois INTEGER;     -- NULL = illimité
ALTER TABLE plans ADD COLUMN IF NOT EXISTS factures_max_mois INTEGER;          -- NULL = illimité
ALTER TABLE plans ADD COLUMN IF NOT EXISTS prestations_max INTEGER;            -- NULL = illimité
ALTER TABLE plans ADD COLUMN IF NOT EXISTS chat_admin_questions_mois INTEGER;  -- NULL = illimité
ALTER TABLE plans ADD COLUMN IF NOT EXISTS multisite BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS sso BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS facture_watermark BOOLEAN DEFAULT FALSE;

-- ════════════════════════════════════════════════════════════════════
-- 2. Marquer les anciens plans starter/pro comme DEPRECATED
-- ════════════════════════════════════════════════════════════════════

UPDATE plans SET deprecated = TRUE WHERE id IN ('starter', 'pro');

-- ════════════════════════════════════════════════════════════════════
-- 3. Insérer / Mettre à jour les 3 nouveaux plans
-- ════════════════════════════════════════════════════════════════════

-- ── FREE — freemium à vie ───────────────────────────────────────────
INSERT INTO plans (
  id, nom, description, prix_mensuel,
  clients_max, stockage_mb, posts_ia_mois, images_dalle_mois,
  utilisateurs_inclus, prix_utilisateur_sup,
  reservations_max_mois, factures_max_mois, prestations_max,
  chat_admin_questions_mois,
  facture_watermark, credits_ia_inclus,
  sentinel_niveau, support_email_heures, assistant_mode,
  ordre, deprecated
) VALUES (
  'free', 'NEXUS Free', 'Freemium à vie — découvrez NEXUS sans engagement', 0,
  50, 1024, 0, 0,
  1, 0,
  30, 20, 5,
  5,
  TRUE, 0,
  'basic', 72, 'consultation',
  0, FALSE
)
ON CONFLICT (id) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description,
  prix_mensuel = EXCLUDED.prix_mensuel,
  clients_max = EXCLUDED.clients_max,
  stockage_mb = EXCLUDED.stockage_mb,
  posts_ia_mois = EXCLUDED.posts_ia_mois,
  images_dalle_mois = EXCLUDED.images_dalle_mois,
  reservations_max_mois = EXCLUDED.reservations_max_mois,
  factures_max_mois = EXCLUDED.factures_max_mois,
  prestations_max = EXCLUDED.prestations_max,
  chat_admin_questions_mois = EXCLUDED.chat_admin_questions_mois,
  facture_watermark = EXCLUDED.facture_watermark,
  credits_ia_inclus = EXCLUDED.credits_ia_inclus,
  ordre = EXCLUDED.ordre,
  deprecated = FALSE,
  updated_at = NOW();

-- ── BASIC — 29€/mois — Le Plus Populaire ───────────────────────────
INSERT INTO plans (
  id, nom, description, prix_mensuel,
  clients_max, stockage_mb, posts_ia_mois, images_dalle_mois,
  utilisateurs_inclus, prix_utilisateur_sup,
  reservations_max_mois, factures_max_mois, prestations_max,
  chat_admin_questions_mois,
  comptabilite, crm_avance, marketing_automation, commercial,
  stock_inventaire, analytics_avances, seo_visibilite, rh_multiemployes,
  facture_watermark, credits_ia_inclus,
  sentinel_niveau, support_email_heures, support_chat, assistant_mode,
  ordre, deprecated
) VALUES (
  'basic', 'NEXUS Basic', 'Tout illimité — IA via crédits pay-as-you-go', 2900,
  -1, 51200, -1, -1,
  5, 1500,
  NULL, NULL, NULL,
  NULL,
  TRUE, TRUE, TRUE, TRUE,
  TRUE, TRUE, TRUE, TRUE,
  FALSE, 0,
  'actif', 24, TRUE, 'execution',
  1, FALSE
)
ON CONFLICT (id) DO UPDATE SET
  nom = EXCLUDED.nom,
  description = EXCLUDED.description,
  prix_mensuel = EXCLUDED.prix_mensuel,
  clients_max = EXCLUDED.clients_max,
  stockage_mb = EXCLUDED.stockage_mb,
  posts_ia_mois = EXCLUDED.posts_ia_mois,
  images_dalle_mois = EXCLUDED.images_dalle_mois,
  utilisateurs_inclus = EXCLUDED.utilisateurs_inclus,
  prix_utilisateur_sup = EXCLUDED.prix_utilisateur_sup,
  reservations_max_mois = EXCLUDED.reservations_max_mois,
  factures_max_mois = EXCLUDED.factures_max_mois,
  prestations_max = EXCLUDED.prestations_max,
  chat_admin_questions_mois = EXCLUDED.chat_admin_questions_mois,
  comptabilite = EXCLUDED.comptabilite,
  crm_avance = EXCLUDED.crm_avance,
  marketing_automation = EXCLUDED.marketing_automation,
  commercial = EXCLUDED.commercial,
  stock_inventaire = EXCLUDED.stock_inventaire,
  analytics_avances = EXCLUDED.analytics_avances,
  seo_visibilite = EXCLUDED.seo_visibilite,
  rh_multiemployes = EXCLUDED.rh_multiemployes,
  facture_watermark = EXCLUDED.facture_watermark,
  credits_ia_inclus = EXCLUDED.credits_ia_inclus,
  ordre = EXCLUDED.ordre,
  deprecated = FALSE,
  updated_at = NOW();

-- ── BUSINESS — 129€/mois — Multi-site + Premium ────────────────────
-- Remplace l'ancien Business 499€ (les anciens tenants restent grandfathered via Stripe sub)
UPDATE plans SET
  nom = 'NEXUS Business',
  description = 'Multi-site illimité, white-label, API + 3500 crédits IA inclus/mois',
  prix_mensuel = 12900,
  clients_max = -1,
  stockage_mb = 512000,
  posts_ia_mois = -1,
  images_dalle_mois = -1,
  utilisateurs_inclus = 20,
  prix_utilisateur_sup = 1200,
  reservations_max_mois = NULL,
  factures_max_mois = NULL,
  prestations_max = NULL,
  chat_admin_questions_mois = NULL,
  comptabilite = TRUE,
  crm_avance = TRUE,
  marketing_automation = TRUE,
  commercial = TRUE,
  stock_inventaire = TRUE,
  analytics_avances = TRUE,
  seo_visibilite = TRUE,
  rh_multiemployes = TRUE,
  api_integrations = TRUE,
  white_label = TRUE,
  multisite = TRUE,
  sso = TRUE,
  facture_watermark = FALSE,
  credits_ia_inclus = 3500,
  sentinel_niveau = 'intel',
  support_email_heures = 1,
  support_chat = TRUE,
  support_telephone = TRUE,
  account_manager = TRUE,
  assistant_mode = 'intelligence',
  ordre = 2,
  deprecated = FALSE,
  updated_at = NOW()
WHERE id = 'business';

-- ════════════════════════════════════════════════════════════════════
-- 4. Table ai_credits — solde crédits IA par tenant
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_credits (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,           -- crédits disponibles (purchased + monthly_included - consumed)
  total_purchased INTEGER NOT NULL DEFAULT 0,   -- total acheté à vie (informatif)
  total_consumed INTEGER NOT NULL DEFAULT 0,    -- total consommé à vie (informatif)
  monthly_included INTEGER NOT NULL DEFAULT 0,  -- crédits inclus mensuels (Business=3500)
  monthly_used INTEGER NOT NULL DEFAULT 0,      -- conso du mois en cours (reset chaque mois)
  monthly_reset_at TIMESTAMPTZ,                 -- date du prochain reset
  auto_recharge_enabled BOOLEAN DEFAULT FALSE,
  auto_recharge_threshold INTEGER DEFAULT 500,  -- déclencheur de recharge
  auto_recharge_pack TEXT DEFAULT 'pack_s',     -- pack à acheter automatiquement
  low_balance_alert_sent_at TIMESTAMPTZ,        -- dernière alerte 80%
  critical_balance_alert_sent_at TIMESTAMPTZ,   -- dernière alerte 95%
  exhausted_alert_sent_at TIMESTAMPTZ,          -- dernière alerte 0%
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_credits_balance ON ai_credits(balance);
CREATE INDEX IF NOT EXISTS idx_ai_credits_reset ON ai_credits(monthly_reset_at);

-- ════════════════════════════════════════════════════════════════════
-- 5. Table ai_credits_transactions — ledger immuable
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_credits_transactions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'purchase',        -- achat pack S/M/L
    'consume',         -- consommation IA (négatif)
    'monthly_grant',   -- crédits mensuels offerts (Business)
    'monthly_reset',   -- reset compteur mensuel
    'refund',          -- remboursement
    'adjust',          -- ajustement manuel admin
    'bonus'            -- bonus marketing/parrainage
  )),
  amount INTEGER NOT NULL,           -- positif = ajout, négatif = débit
  balance_after INTEGER NOT NULL,    -- solde après opération (snapshot)
  source TEXT,                       -- 'pack_s', 'pack_m', 'pack_l', 'business_monthly', 'whatsapp_ia', 'phone_ia', 'chat_admin', 'post_genere', 'email_ia', 'article_seo', 'devis_ia', etc.
  ref_id TEXT,                       -- stripe_invoice_id, conversation_id, post_id, etc.
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_credits_tx_tenant_date ON ai_credits_transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_credits_tx_type ON ai_credits_transactions(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_ai_credits_tx_source ON ai_credits_transactions(tenant_id, source);

-- ════════════════════════════════════════════════════════════════════
-- 6. Table tenant_quotas — usage mensuel par tenant (Free + alertes)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tenant_quotas (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period TEXT NOT NULL,                  -- format YYYY-MM
  reservations_used INTEGER DEFAULT 0,
  factures_used INTEGER DEFAULT 0,
  clients_count INTEGER DEFAULT 0,       -- snapshot du compteur clients
  prestations_count INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  chat_admin_questions_used INTEGER DEFAULT 0,
  posts_ia_used INTEGER DEFAULT 0,
  images_ia_used INTEGER DEFAULT 0,
  alert_80_sent_at TIMESTAMPTZ,
  alert_95_sent_at TIMESTAMPTZ,
  alert_100_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tenant_id, period)
);

CREATE INDEX IF NOT EXISTS idx_tenant_quotas_period ON tenant_quotas(period);

-- ════════════════════════════════════════════════════════════════════
-- 7. Packs crédits IA dans stripe_products
-- ════════════════════════════════════════════════════════════════════

INSERT INTO stripe_products (product_code, name, description, type, billing_type, amount, interval, trial_days, metadata) VALUES
  ('nexus_credits_s', 'Pack Crédits S',  '2 400 crédits IA (+25% bonus)',   'pack', 'one_time',  2900, NULL, 0, '{"credits": 2400, "tier": "S", "bonus_pct": 25}'::jsonb),
  ('nexus_credits_m', 'Pack Crédits M',  '9 200 crédits IA (+40% bonus)',   'pack', 'one_time',  9900, NULL, 0, '{"credits": 9200, "tier": "M", "bonus_pct": 40}'::jsonb),
  ('nexus_credits_l', 'Pack Crédits L',  '20 000 crédits IA (+50% bonus)',  'pack', 'one_time', 19900, NULL, 0, '{"credits": 20000, "tier": "L", "bonus_pct": 50}'::jsonb),
  ('nexus_basic_monthly',    'NEXUS Basic Mensuel',    'Plan Basic — tout illimité non-IA',                  'plan', 'recurring',  2900, 'month', 14, '{"plan_id": "basic"}'::jsonb),
  ('nexus_basic_yearly',     'NEXUS Basic Annuel',     'Plan Basic annuel — économisez 17% (290€/an)',      'plan', 'recurring', 29000, 'year',  14, '{"plan_id": "basic"}'::jsonb),
  ('nexus_business_monthly', 'NEXUS Business Mensuel', 'Plan Business — multi-site + 3500 crédits IA/mois', 'plan', 'recurring', 12900, 'month', 14, '{"plan_id": "business"}'::jsonb),
  ('nexus_business_yearly',  'NEXUS Business Annuel',  'Plan Business annuel — économisez 17% (1290€/an)',  'plan', 'recurring',129000, 'year',  14, '{"plan_id": "business"}'::jsonb)
ON CONFLICT (product_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  amount = EXCLUDED.amount,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- Marquer anciens produits Stripe Starter/Pro comme inactifs (grandfathering only)
UPDATE stripe_products SET active = FALSE
 WHERE product_code IN (
   'nexus_starter_monthly', 'nexus_starter_yearly',
   'nexus_pro_monthly', 'nexus_pro_yearly',
   'nexus_user_starter', 'nexus_user_pro'
 );

-- ════════════════════════════════════════════════════════════════════
-- 8. Grandfathering — flag legacy_pricing sur tenants
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS legacy_pricing BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS pricing_migrated_at TIMESTAMPTZ;

-- Marquer tous les tenants existants en plan starter/pro/business legacy
UPDATE tenants
   SET legacy_pricing = TRUE
 WHERE plan IN ('starter', 'pro')
    OR (plan = 'business' AND created_at < '2026-04-08');

-- ════════════════════════════════════════════════════════════════════
-- 9. Initialiser ai_credits pour tous les tenants existants
-- ════════════════════════════════════════════════════════════════════

INSERT INTO ai_credits (tenant_id, balance, monthly_included, monthly_reset_at)
SELECT
  id,
  CASE WHEN plan IN ('business', 'pro') THEN 3500 ELSE 0 END,   -- offre de bienvenue grandfathered
  CASE WHEN plan = 'business' THEN 3500 ELSE 0 END,
  date_trunc('month', NOW()) + interval '1 month'
FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Logger la transaction de bienvenue pour les tenants ayant reçu le bonus
INSERT INTO ai_credits_transactions (tenant_id, type, amount, balance_after, source, description)
SELECT
  ac.tenant_id,
  'bonus',
  ac.balance,
  ac.balance,
  'migration_104_grandfathering',
  'Crédits offerts lors de la migration pricing 2026'
FROM ai_credits ac
WHERE ac.balance > 0;

-- ════════════════════════════════════════════════════════════════════
-- 10. Row Level Security sur les nouvelles tables
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_credits_tenant_isolation ON ai_credits;
CREATE POLICY ai_credits_tenant_isolation ON ai_credits
  FOR ALL USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = ''
  );

ALTER TABLE ai_credits_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_credits_tx_tenant_isolation ON ai_credits_transactions;
CREATE POLICY ai_credits_tx_tenant_isolation ON ai_credits_transactions
  FOR ALL USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = ''
  );

ALTER TABLE tenant_quotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_quotas_tenant_isolation ON tenant_quotas;
CREATE POLICY tenant_quotas_tenant_isolation ON tenant_quotas
  FOR ALL USING (
    tenant_id = current_setting('app.tenant_id', true)
    OR current_setting('app.tenant_id', true) = ''
  );

-- ════════════════════════════════════════════════════════════════════
-- 11. Trigger updated_at sur ai_credits
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_ai_credits_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_credits_updated_at ON ai_credits;
CREATE TRIGGER ai_credits_updated_at
  BEFORE UPDATE ON ai_credits
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_credits_timestamp();

DROP TRIGGER IF EXISTS tenant_quotas_updated_at ON tenant_quotas;
CREATE TRIGGER tenant_quotas_updated_at
  BEFORE UPDATE ON tenant_quotas
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_credits_timestamp();

-- ════════════════════════════════════════════════════════════════════
-- 12. Commentaires
-- ════════════════════════════════════════════════════════════════════

COMMENT ON TABLE ai_credits              IS 'Solde de crédits IA par tenant (modèle 2026)';
COMMENT ON TABLE ai_credits_transactions IS 'Ledger immuable des mouvements de crédits IA';
COMMENT ON TABLE tenant_quotas           IS 'Compteurs d''usage mensuel par tenant (Free tier + alertes)';

COMMENT ON COLUMN plans.deprecated                IS 'Plan obsolète : conservé pour grandfathering, non disponible aux nouveaux signups';
COMMENT ON COLUMN plans.credits_ia_inclus         IS 'Crédits IA inclus chaque mois (Business = 3500, autres = 0)';
COMMENT ON COLUMN plans.reservations_max_mois     IS 'Plafond mensuel réservations (NULL = illimité)';
COMMENT ON COLUMN plans.factures_max_mois         IS 'Plafond mensuel factures (NULL = illimité)';
COMMENT ON COLUMN plans.facture_watermark         IS 'Si TRUE, factures portent le watermark "Propulsé par NEXUS"';
COMMENT ON COLUMN tenants.legacy_pricing          IS 'Tenant grandfathered sur ancien pricing (Starter/Pro/Business 499€)';

-- ════════════════════════════════════════════════════════════════════
-- 13. Vérification finale (commentaire informatif)
-- ════════════════════════════════════════════════════════════════════
--
-- Pour vérifier après run :
--   SELECT id, nom, prix_mensuel, deprecated, credits_ia_inclus FROM plans ORDER BY ordre;
-- Attendu :
--   free     | NEXUS Free     |     0 | f |    0
--   basic    | NEXUS Basic    |  2900 | f |    0
--   business | NEXUS Business | 12900 | f | 3500
--   starter  | Starter        |  9900 | t |    0   (deprecated)
--   pro      | Pro            | 24900 | t |    0   (deprecated)
--
--   SELECT COUNT(*) FROM ai_credits;     -- = nombre de tenants
--   SELECT COUNT(*) FROM tenant_quotas;  -- = 0 (peuplé à la première activité)
