-- ════════════════════════════════════════════════════════════════════
-- Migration 107: Révision finale pricing 2026
-- Date: 2026-04-09
-- ════════════════════════════════════════════════════════════════════
--
-- Révise le modèle introduit par la migration 104 selon la décision finale
-- du 9 avril 2026 (voir memory/business-model-2026.md) :
--
--   • Business : 129€/mois → **149€/mois**
--   • Business crédits inclus : 3 500 → **10 000 crédits/mois**
--   • Basic    : 0 crédit inclus → **1 000 crédits/mois**
--   • Packs S/M/L → **un seul pack** : Pack 1000 (15€ → 1 000 crédits, 0% bonus)
--
-- Aucun tenant legacy_pricing n'est affecté (ils gardent leur plan & tarif).
-- Les tenants existants sur plan 'basic' et 'business' voient leur solde
-- monthly_included mis à jour et reçoivent une transaction de grandfathering.
-- ════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════
-- 1. Mise à jour du plan BUSINESS (prix + crédits inclus + description)
-- ════════════════════════════════════════════════════════════════════

UPDATE plans SET
  prix_mensuel        = 14900,   -- 149€ en centimes
  credits_ia_inclus   = 10000,
  description         = 'Multi-site illimité, white-label, API + 10 000 crédits IA inclus/mois',
  updated_at          = NOW()
WHERE id = 'business';


-- ════════════════════════════════════════════════════════════════════
-- 2. Mise à jour du plan BASIC (1 000 crédits inclus)
-- ════════════════════════════════════════════════════════════════════

UPDATE plans SET
  credits_ia_inclus   = 500,
  description         = 'Tout illimité — 1 000 crédits IA inclus/mois + pack additionnel',
  updated_at          = NOW()
WHERE id = 'basic';


-- ════════════════════════════════════════════════════════════════════
-- 3. Suppression des anciens Pack S/M/L dans stripe_products
-- ════════════════════════════════════════════════════════════════════
-- Pattern prudent : on désactive d'abord, puis on supprime.
-- Si des invoices historiques référencent encore ces codes, l'UPDATE suffit.

UPDATE stripe_products
   SET active = FALSE,
       updated_at = NOW()
 WHERE product_code IN ('nexus_credits_s', 'nexus_credits_m', 'nexus_credits_l');

DELETE FROM stripe_products
 WHERE product_code IN ('nexus_credits_s', 'nexus_credits_m', 'nexus_credits_l');


-- ════════════════════════════════════════════════════════════════════
-- 4. Insertion du nouveau pack unique 'nexus_credits_1000'
-- ════════════════════════════════════════════════════════════════════

INSERT INTO stripe_products (
  product_code, name, description, type, billing_type, amount, interval, trial_days, metadata
) VALUES (
  'nexus_credits_1000',
  'Pack 1000 crédits',
  '1 000 crédits IA (taux base, sans bonus)',
  'pack',
  'one_time',
  1500,     -- 15€ en centimes
  NULL,
  0,
  '{"credits": 1000, "tier": "unique", "bonus_pct": 0}'::jsonb
)
ON CONFLICT (product_code) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  amount      = EXCLUDED.amount,
  metadata    = EXCLUDED.metadata,
  active      = TRUE,
  updated_at  = NOW();


-- ════════════════════════════════════════════════════════════════════
-- 5. Mise à jour des prix Stripe products pour les plans
-- ════════════════════════════════════════════════════════════════════

-- Business monthly 129€ → 149€
UPDATE stripe_products SET
  amount      = 14900,
  description = 'Plan Business — multi-site + 10 000 crédits IA/mois',
  updated_at  = NOW()
 WHERE product_code = 'nexus_business_monthly';

-- Business yearly 1290€ → 1490€ (2 mois offerts)
UPDATE stripe_products SET
  amount      = 149000,
  description = 'Plan Business annuel — 2 mois offerts (1 490€/an)',
  updated_at  = NOW()
 WHERE product_code = 'nexus_business_yearly';


-- ════════════════════════════════════════════════════════════════════
-- 6. Mise à jour du solde monthly_included des tenants Basic / Business
--    (tenants NON legacy uniquement — les grandfathered restent intacts)
-- ════════════════════════════════════════════════════════════════════

-- Basic : 0 → 1 000 crédits/mois
UPDATE ai_credits ac
   SET monthly_included = 500,
       balance          = ac.balance + GREATEST(0, 500 - ac.monthly_included),
       updated_at       = NOW()
  FROM tenants t
 WHERE ac.tenant_id = t.id
   AND LOWER(COALESCE(t.plan, '')) = 'basic'
   AND COALESCE(t.legacy_pricing, FALSE) = FALSE;

-- Business : 3 500 → 10 000 crédits/mois
UPDATE ai_credits ac
   SET monthly_included = 10000,
       balance          = ac.balance + GREATEST(0, 10000 - ac.monthly_included),
       updated_at       = NOW()
  FROM tenants t
 WHERE ac.tenant_id = t.id
   AND LOWER(COALESCE(t.plan, '')) = 'business'
   AND COALESCE(t.legacy_pricing, FALSE) = FALSE;


-- ════════════════════════════════════════════════════════════════════
-- 7. Transactions de grandfathering (trace auditable du complément)
-- ════════════════════════════════════════════════════════════════════

-- Basic : +1 000 crédits bonus (trace)
INSERT INTO ai_credits_transactions (tenant_id, type, amount, balance_after, source, description, metadata)
SELECT
  ac.tenant_id,
  'bonus',
  500,
  ac.balance,
  'migration_107_revision',
  'Révision pricing 9 avril 2026 : Basic passe à 1 000 crédits inclus/mois',
  '{"migration": "107", "plan": "basic"}'::jsonb
  FROM ai_credits ac
  JOIN tenants t ON t.id = ac.tenant_id
 WHERE LOWER(COALESCE(t.plan, '')) = 'basic'
   AND COALESCE(t.legacy_pricing, FALSE) = FALSE;

-- Business : +6 500 crédits bonus (trace : 10000 - 3500)
INSERT INTO ai_credits_transactions (tenant_id, type, amount, balance_after, source, description, metadata)
SELECT
  ac.tenant_id,
  'bonus',
  6500,
  ac.balance,
  'migration_107_revision',
  'Révision pricing 9 avril 2026 : Business passe à 10 000 crédits inclus/mois',
  '{"migration": "107", "plan": "business"}'::jsonb
  FROM ai_credits ac
  JOIN tenants t ON t.id = ac.tenant_id
 WHERE LOWER(COALESCE(t.plan, '')) = 'business'
   AND COALESCE(t.legacy_pricing, FALSE) = FALSE;


-- ════════════════════════════════════════════════════════════════════
-- 8. Commentaires mis à jour
-- ════════════════════════════════════════════════════════════════════

COMMENT ON COLUMN plans.credits_ia_inclus IS
  'Crédits IA inclus chaque mois (révision 9 avril 2026 : Basic=500, Business=10000)';


-- ════════════════════════════════════════════════════════════════════
-- 9. Vérification finale (commentaire informatif)
-- ════════════════════════════════════════════════════════════════════
--
-- Pour vérifier après run :
--
--   SELECT id, nom, prix_mensuel, credits_ia_inclus FROM plans WHERE id IN ('free','basic','business') ORDER BY ordre;
-- Attendu :
--   free     | NEXUS Free     |     0 |     0
--   basic    | NEXUS Basic    |  2900 |   500
--   business | NEXUS Business | 14900 | 10000
--
--   SELECT product_code, amount FROM stripe_products WHERE product_code LIKE 'nexus_credits%';
-- Attendu :
--   nexus_credits_1000 | 1500
--
--   SELECT product_code, amount FROM stripe_products WHERE product_code LIKE 'nexus_business%';
-- Attendu :
--   nexus_business_monthly | 14900
--   nexus_business_yearly  | 149000
