-- ============================================
-- Migration 110 : Configuration acompte par tenant
-- Permet a chaque tenant d'activer l'acompte obligatoire
-- avec son propre lien de paiement externe
-- ============================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deposit_enabled BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deposit_rate INTEGER DEFAULT 30;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deposit_payment_url TEXT DEFAULT NULL;

-- Verification
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'deposit_enabled'
  ) THEN
    RAISE NOTICE 'Migration 110 OK : colonnes deposit ajoutees a tenants';
  END IF;
END $$;
