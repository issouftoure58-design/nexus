-- Migration 092: Colonnes manquantes pour le signup tenant
-- Fix: "Erreur lors de la création du compte" — Supabase rejette l'insert
-- car ces colonnes n'existent pas dans la table tenants.

-- statut: cycle de vie abonnement (essai → actif → annule)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS statut VARCHAR(30) DEFAULT 'essai';

-- essai_fin: date de fin de la periode d'essai 14 jours
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS essai_fin TIMESTAMPTZ;

-- modules_actifs: liste des modules actives selon le plan (Starter/Pro/Business)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS modules_actifs JSONB DEFAULT '[]';

-- profession_id: metier selectionne a l'inscription (coiffeur, restaurant, hotel, etc.)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS profession_id VARCHAR(50);

-- Index utile pour filtrer par statut abonnement
CREATE INDEX IF NOT EXISTS idx_tenants_statut ON tenants(statut);
