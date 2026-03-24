-- Migration 093: Ajouter stripe_price_id aux plans
-- Date: 2026-03-24
-- Description: Colonnes pour lier les plans aux prix Stripe

ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id_monthly TEXT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id_yearly TEXT;

-- Prix promo 100 premiers clients (crees par setup-stripe-plans.mjs)
UPDATE plans SET stripe_price_id_monthly = 'price_1TEb9uHPtoWUqBj821PjglUw', stripe_price_id_yearly = 'price_1TEb9uHPtoWUqBj8QrCZVvKK' WHERE id = 'starter';
UPDATE plans SET stripe_price_id_monthly = 'price_1TEb9vHPtoWUqBj8cKBCBxpR', stripe_price_id_yearly = 'price_1TEb9wHPtoWUqBj8gKkps1jT' WHERE id = 'pro';
UPDATE plans SET stripe_price_id_monthly = 'price_1TEb9xHPtoWUqBj8J1nmQbVp', stripe_price_id_yearly = 'price_1TEb9xHPtoWUqBj8C4bu8Tyg' WHERE id = 'business';
