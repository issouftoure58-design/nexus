-- Migration 079: Add tracking_token to commerce_orders
-- Permet le suivi public des commandes Click & Collect / Livraison

-- Ajouter la colonne tracking_token UUID
ALTER TABLE commerce_orders
ADD COLUMN IF NOT EXISTS tracking_token UUID DEFAULT gen_random_uuid();

-- Backfill les commandes existantes sans token
UPDATE commerce_orders
SET tracking_token = gen_random_uuid()
WHERE tracking_token IS NULL;

-- Rendre NOT NULL apres backfill
ALTER TABLE commerce_orders
ALTER COLUMN tracking_token SET NOT NULL;

-- Index unique pour lookup rapide par token
CREATE UNIQUE INDEX IF NOT EXISTS idx_commerce_orders_tracking_token
ON commerce_orders (tracking_token);
