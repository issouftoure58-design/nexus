-- ════════════════════════════════════════════════════════════════════
-- Migration 128: Modele 5 plans + Enterprise (27 avril 2026)
-- Date: 2026-04-30
-- ════════════════════════════════════════════════════════════════════
--
-- Passe du modele 3 plans (Free/Basic 29€/Business 149€) au modele
-- 5 plans (Free/Starter 69€/Pro 199€/Business 499€/Enterprise 899€).
--
-- Source de verite : memory/business-model-2026.md (revise 27 avril 2026)
--
-- Changements :
--   • Starter (69€/mois)    : re-active, prix 6900, credits 4000
--   • Pro (199€/mois)       : re-active, prix 19900, credits 20000
--   • Business (499€/mois)  : prix 49900, credits 50000, 30 postes
--   • Enterprise (899€/mois): NOUVEAU, 50 postes, 100000 credits, full premium
--   • Basic : marque DEPRECATED (alias legacy de Starter)
--   • Free : quotas ajustes (5 clients, 5 RDV, 5 factures, 500 credits)
--
-- Aucun tenant legacy_pricing n'est affecte (ils gardent leur plan & tarif).
-- ════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════
-- 1. Ajout colonnes manquantes sur plans (si pas encore presentes)
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE plans ADD COLUMN IF NOT EXISTS prix_annuel INTEGER;
-- Note: la colonne s'appelle white_label (avec underscore) dans la table plans


-- ════════════════════════════════════════════════════════════════════
-- 2. Marquer Basic comme DEPRECATED (remplace par Starter)
-- ════════════════════════════════════════════════════════════════════

UPDATE plans SET
  deprecated = TRUE,
  description = 'DEPRECATED — remplace par Starter 69€/mois (migration 128)',
  updated_at = NOW()
WHERE id = 'basic';


-- ════════════════════════════════════════════════════════════════════
-- 3. Re-activer et mettre a jour STARTER (69€/mois)
-- ════════════════════════════════════════════════════════════════════

UPDATE plans SET
  nom                       = 'NEXUS Starter',
  description               = 'Toutes les IA debloquees — CRM avance — 200 limites — 5 postes',
  prix_mensuel              = 6900,
  prix_annuel               = 69000,
  clients_max               = 200,
  utilisateurs_inclus       = 5,
  reservations_max_mois     = 200,
  factures_max_mois         = 200,
  prestations_max           = 200,
  chat_admin_questions_mois = NULL,
  credits_ia_inclus         = 4000,
  facture_watermark         = FALSE,
  comptabilite              = FALSE,
  crm_avance                = TRUE,
  marketing_automation      = FALSE,
  commercial                = FALSE,
  stock_inventaire          = FALSE,
  analytics_avances         = FALSE,
  seo_visibilite            = FALSE,
  rh_multiemployes          = FALSE,
  multisite                 = FALSE,
  sso                       = FALSE,
  white_label               = FALSE,
  api_integrations          = FALSE,
  sentinel_niveau           = 'basic',
  support_email_heures      = 48,
  support_chat              = TRUE,
  assistant_mode            = 'execution',
  ordre                     = 1,
  deprecated                = FALSE,
  updated_at                = NOW()
WHERE id = 'starter';


-- ════════════════════════════════════════════════════════════════════
-- 4. Re-activer et mettre a jour PRO (199€/mois)
-- ════════════════════════════════════════════════════════════════════

UPDATE plans SET
  nom                       = 'NEXUS Pro',
  description               = 'Tout illimite — Facturation, Devis, Pipeline, Stock, Marketing complet, Equipe — 20 postes',
  prix_mensuel              = 19900,
  prix_annuel               = 199000,
  clients_max               = -1,
  utilisateurs_inclus       = 20,
  reservations_max_mois     = NULL,
  factures_max_mois         = NULL,
  prestations_max           = NULL,
  chat_admin_questions_mois = NULL,
  credits_ia_inclus         = 20000,
  facture_watermark         = FALSE,
  comptabilite              = FALSE,
  crm_avance                = TRUE,
  marketing_automation      = TRUE,
  commercial                = TRUE,
  stock_inventaire          = TRUE,
  analytics_avances         = FALSE,
  seo_visibilite            = FALSE,
  rh_multiemployes          = FALSE,
  multisite                 = TRUE,
  sso                       = FALSE,
  white_label               = FALSE,
  api_integrations          = FALSE,
  sentinel_niveau           = 'actif',
  support_email_heures      = 24,
  support_chat              = TRUE,
  assistant_mode            = 'execution',
  ordre                     = 2,
  deprecated                = FALSE,
  updated_at                = NOW()
WHERE id = 'pro';


-- ════════════════════════════════════════════════════════════════════
-- 5. Mettre a jour BUSINESS (499€/mois)
-- ════════════════════════════════════════════════════════════════════

UPDATE plans SET
  nom                       = 'NEXUS Business',
  description               = 'Compta basique, SEO, API/Webhooks — 30 postes',
  prix_mensuel              = 49900,
  prix_annuel               = 499000,
  clients_max               = -1,
  utilisateurs_inclus       = 30,
  prix_utilisateur_sup      = 1500,
  reservations_max_mois     = NULL,
  factures_max_mois         = NULL,
  prestations_max           = NULL,
  chat_admin_questions_mois = NULL,
  credits_ia_inclus         = 50000,
  facture_watermark         = FALSE,
  comptabilite              = TRUE,
  crm_avance                = TRUE,
  marketing_automation      = TRUE,
  commercial                = TRUE,
  stock_inventaire          = TRUE,
  analytics_avances         = FALSE,
  seo_visibilite            = TRUE,
  rh_multiemployes          = FALSE,
  multisite                 = TRUE,
  sso                       = FALSE,
  white_label               = FALSE,
  api_integrations          = TRUE,
  sentinel_niveau           = 'actif',
  support_email_heures      = 12,
  support_chat              = TRUE,
  support_telephone         = TRUE,
  assistant_mode            = 'intelligence',
  ordre                     = 3,
  deprecated                = FALSE,
  updated_at                = NOW()
WHERE id = 'business';


-- ════════════════════════════════════════════════════════════════════
-- 6. Inserer ENTERPRISE (899€/mois) — NOUVEAU
-- ════════════════════════════════════════════════════════════════════

INSERT INTO plans (
  id, nom, description, prix_mensuel, prix_annuel,
  clients_max, stockage_mb, posts_ia_mois, images_dalle_mois,
  utilisateurs_inclus, prix_utilisateur_sup,
  reservations_max_mois, factures_max_mois, prestations_max,
  chat_admin_questions_mois,
  comptabilite, crm_avance, marketing_automation, commercial,
  stock_inventaire, analytics_avances, seo_visibilite, rh_multiemployes,
  api_integrations, white_label, multisite, sso,
  facture_watermark, credits_ia_inclus,
  sentinel_niveau, support_email_heures, support_chat, support_telephone,
  account_manager, assistant_mode,
  ordre, deprecated
) VALUES (
  'enterprise', 'NEXUS Enterprise',
  'Full premium — RH complet, Compta analytique, Sentinel, White-label, SSO — 50 postes',
  89900, 899000,
  -1, 512000, -1, -1,
  50, 2000,
  NULL, NULL, NULL,
  NULL,
  TRUE, TRUE, TRUE, TRUE,
  TRUE, TRUE, TRUE, TRUE,
  TRUE, TRUE, TRUE, TRUE,
  FALSE, 100000,
  'intel', 1, TRUE, TRUE,
  TRUE, 'intelligence',
  4, FALSE
)
ON CONFLICT (id) DO UPDATE SET
  nom                       = EXCLUDED.nom,
  description               = EXCLUDED.description,
  prix_mensuel              = EXCLUDED.prix_mensuel,
  prix_annuel               = EXCLUDED.prix_annuel,
  clients_max               = EXCLUDED.clients_max,
  stockage_mb               = EXCLUDED.stockage_mb,
  posts_ia_mois             = EXCLUDED.posts_ia_mois,
  images_dalle_mois         = EXCLUDED.images_dalle_mois,
  utilisateurs_inclus       = EXCLUDED.utilisateurs_inclus,
  prix_utilisateur_sup      = EXCLUDED.prix_utilisateur_sup,
  reservations_max_mois     = EXCLUDED.reservations_max_mois,
  factures_max_mois         = EXCLUDED.factures_max_mois,
  prestations_max           = EXCLUDED.prestations_max,
  chat_admin_questions_mois = EXCLUDED.chat_admin_questions_mois,
  comptabilite              = EXCLUDED.comptabilite,
  crm_avance                = EXCLUDED.crm_avance,
  marketing_automation      = EXCLUDED.marketing_automation,
  commercial                = EXCLUDED.commercial,
  stock_inventaire          = EXCLUDED.stock_inventaire,
  analytics_avances         = EXCLUDED.analytics_avances,
  seo_visibilite            = EXCLUDED.seo_visibilite,
  rh_multiemployes          = EXCLUDED.rh_multiemployes,
  api_integrations          = EXCLUDED.api_integrations,
  multisite                 = EXCLUDED.multisite,
  sso                       = EXCLUDED.sso,
  facture_watermark         = EXCLUDED.facture_watermark,
  credits_ia_inclus         = EXCLUDED.credits_ia_inclus,
  sentinel_niveau           = EXCLUDED.sentinel_niveau,
  support_email_heures      = EXCLUDED.support_email_heures,
  support_chat              = EXCLUDED.support_chat,
  support_telephone         = EXCLUDED.support_telephone,
  account_manager           = EXCLUDED.account_manager,
  assistant_mode            = EXCLUDED.assistant_mode,
  ordre                     = EXCLUDED.ordre,
  deprecated                = FALSE,
  updated_at                = NOW();


-- ════════════════════════════════════════════════════════════════════
-- 7. Mettre a jour FREE (quotas revises 27 avril)
-- ════════════════════════════════════════════════════════════════════

UPDATE plans SET
  clients_max               = 5,
  reservations_max_mois     = 5,
  factures_max_mois         = 5,
  prestations_max           = 5,
  chat_admin_questions_mois = 5,
  credits_ia_inclus         = 500,
  updated_at                = NOW()
WHERE id = 'free';


-- ════════════════════════════════════════════════════════════════════
-- 8. Desactiver anciens packs credits, ajouter usage topups
-- ════════════════════════════════════════════════════════════════════

-- Desactiver ancien pack unique
UPDATE stripe_products SET active = FALSE, updated_at = NOW()
WHERE product_code = 'nexus_credits_1000';

-- Nouveaux top-ups utilisation supplementaire
INSERT INTO stripe_products (product_code, name, description, type, billing_type, amount, interval, trial_days, metadata) VALUES
  ('nexus_usage_50',  'Utilisation IA supplementaire — 50€',  '50€ d''utilisation IA (-10%)',  'pack', 'one_time', 5000,  NULL, 0, '{"discount_pct": 10}'::jsonb),
  ('nexus_usage_200', 'Utilisation IA supplementaire — 200€', '200€ d''utilisation IA (-20%)', 'pack', 'one_time', 20000, NULL, 0, '{"discount_pct": 20}'::jsonb),
  ('nexus_usage_500', 'Utilisation IA supplementaire — 500€', '500€ d''utilisation IA (-30%)', 'pack', 'one_time', 50000, NULL, 0, '{"discount_pct": 30}'::jsonb)
ON CONFLICT (product_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  amount = EXCLUDED.amount,
  metadata = EXCLUDED.metadata,
  active = TRUE,
  updated_at = NOW();

-- Desactiver anciens stripe_products Basic (remplace par Starter)
UPDATE stripe_products SET active = FALSE, updated_at = NOW()
WHERE product_code IN ('nexus_basic_monthly', 'nexus_basic_yearly');


-- ════════════════════════════════════════════════════════════════════
-- 9. Mettre a jour stripe_products pour nouveaux prix
-- ════════════════════════════════════════════════════════════════════

-- Note: les vrais Price IDs Stripe seront crees par setup-stripe-plans.mjs
-- Ici on met a jour uniquement les montants en DB pour coherence

UPDATE stripe_products SET
  amount = 49900,
  description = 'Plan Business — Compta, SEO, API + 50 000 credits IA/mois',
  updated_at = NOW()
WHERE product_code = 'nexus_business_monthly';

UPDATE stripe_products SET
  amount = 499000,
  description = 'Plan Business annuel — 2 mois offerts (4 990€/an)',
  updated_at = NOW()
WHERE product_code = 'nexus_business_yearly';


-- ════════════════════════════════════════════════════════════════════
-- 10. Migrer tenants plan='basic' vers plan='starter'
--     (sauf legacy_pricing qui restent intacts)
-- ════════════════════════════════════════════════════════════════════

UPDATE tenants SET
  plan = 'starter',
  updated_at = NOW()
WHERE plan = 'basic'
  AND COALESCE(legacy_pricing, FALSE) = FALSE;


-- ════════════════════════════════════════════════════════════════════
-- 11. Mise a jour ai_credits monthly_included pour les plans actifs
--     (tenants NON legacy uniquement)
-- ════════════════════════════════════════════════════════════════════

-- Starter : 4000 credits/mois
UPDATE ai_credits ac
   SET monthly_included = 4000,
       updated_at       = NOW()
  FROM tenants t
 WHERE ac.tenant_id = t.id
   AND LOWER(COALESCE(t.plan, '')) = 'starter'
   AND COALESCE(t.legacy_pricing, FALSE) = FALSE;

-- Pro : 20000 credits/mois
UPDATE ai_credits ac
   SET monthly_included = 20000,
       updated_at       = NOW()
  FROM tenants t
 WHERE ac.tenant_id = t.id
   AND LOWER(COALESCE(t.plan, '')) = 'pro'
   AND COALESCE(t.legacy_pricing, FALSE) = FALSE;

-- Business : 50000 credits/mois
UPDATE ai_credits ac
   SET monthly_included = 50000,
       updated_at       = NOW()
  FROM tenants t
 WHERE ac.tenant_id = t.id
   AND LOWER(COALESCE(t.plan, '')) = 'business'
   AND COALESCE(t.legacy_pricing, FALSE) = FALSE;

-- Enterprise : 100000 credits/mois
UPDATE ai_credits ac
   SET monthly_included = 100000,
       updated_at       = NOW()
  FROM tenants t
 WHERE ac.tenant_id = t.id
   AND LOWER(COALESCE(t.plan, '')) = 'enterprise'
   AND COALESCE(t.legacy_pricing, FALSE) = FALSE;


-- ════════════════════════════════════════════════════════════════════
-- 12. Commentaires mis a jour
-- ════════════════════════════════════════════════════════════════════

COMMENT ON COLUMN plans.credits_ia_inclus IS
  'Credits IA inclus/mois (revision 27 avril 2026 : Free=500, Starter=4000, Pro=20000, Business=50000, Enterprise=100000)';

COMMENT ON COLUMN plans.prix_annuel IS
  'Prix annuel en centimes EUR (2 mois offerts vs mensuel)';

COMMENT ON COLUMN tenants.legacy_pricing IS
  'Tenant grandfathered sur ancien pricing (avant modele 5 plans du 27 avril 2026)';


-- ════════════════════════════════════════════════════════════════════
-- 13. Verification finale (commentaire informatif)
-- ════════════════════════════════════════════════════════════════════
--
-- Pour verifier apres run :
--
--   SELECT id, nom, prix_mensuel, prix_annuel, credits_ia_inclus, utilisateurs_inclus, deprecated
--   FROM plans ORDER BY ordre;
--
-- Attendu :
--   free       | NEXUS Free       |     0 |      0 |      0 |  1 | f
--   starter    | NEXUS Starter    |  6900 |  69000 |   4000 |  5 | f
--   pro        | NEXUS Pro        | 19900 | 199000 |  20000 | 20 | f
--   business   | NEXUS Business   | 49900 | 499000 |  50000 | 30 | f
--   enterprise | NEXUS Enterprise | 89900 | 899000 | 100000 | 50 | f
--   basic      | NEXUS Basic      |  2900 |   NULL |    500 |  5 | t  (deprecated)
