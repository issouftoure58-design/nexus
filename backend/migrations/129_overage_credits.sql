-- Migration 129: Overage credits (usage-based)
-- Permet aux tenants de continuer à utiliser l'IA au-delà du forfait mensuel
-- avec facturation EUR plafonnée.

ALTER TABLE ai_credits
  ADD COLUMN IF NOT EXISTS overage_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS overage_limit_eur NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overage_used_eur NUMERIC(10,2) DEFAULT 0;

-- Ajouter 'overage' comme type de transaction valide
ALTER TABLE ai_credits_transactions
  DROP CONSTRAINT IF EXISTS ai_credits_transactions_type_check;
ALTER TABLE ai_credits_transactions
  ADD CONSTRAINT ai_credits_transactions_type_check
  CHECK (type IN ('purchase','consume','monthly_grant','monthly_reset','refund','adjust','bonus','overage'));
