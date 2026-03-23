-- Fix: ajouter reference_id et reference_type si manquants dans loyalty_transactions
-- (migration 071 pas appliquée complètement)

ALTER TABLE loyalty_transactions
  ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS reference_id VARCHAR(100);

-- Rafraîchir le cache schema PostgREST
NOTIFY pgrst, 'reload schema';
