-- Migration 116: Ajout clé Stripe par tenant pour Checkout Sessions dynamiques (acomptes)
-- Le tenant stocke sa propre clé Stripe secrète pour créer des sessions de paiement avec le montant exact

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_secret_key TEXT DEFAULT NULL;

-- Commentaire pour clarifier l'usage
COMMENT ON COLUMN tenants.stripe_secret_key IS 'Clé secrète Stripe du tenant (sk_live_... ou sk_test_...) pour créer des Checkout Sessions dynamiques (acomptes). Ne JAMAIS exposer côté client.';
