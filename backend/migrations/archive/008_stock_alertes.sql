-- =====================================================
-- Migration 008: Stock Alertes Configuration
-- Plan PRO Feature - SEMAINE 7 JOUR 3
-- =====================================================
-- NOTE: La table alertes_stock existe déjà dans le schéma
-- Cette migration ajoute seulement les colonnes manquantes sur produits

-- Ajouter colonne seuil d'alerte sur produits (si pas déjà présente)
ALTER TABLE produits ADD COLUMN IF NOT EXISTS seuil_alerte INTEGER DEFAULT 10;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS alerte_active BOOLEAN DEFAULT true;

-- Mettre à jour les produits existants avec seuil_alerte basé sur stock_minimum
UPDATE produits
SET seuil_alerte = COALESCE(stock_minimum, 10)
WHERE seuil_alerte IS NULL OR seuil_alerte = 0;

-- Index pour optimiser les requêtes d'alertes
CREATE INDEX IF NOT EXISTS idx_produits_alerte_active ON produits(tenant_id, alerte_active) WHERE alerte_active = true;

COMMENT ON COLUMN produits.seuil_alerte IS 'Seuil de stock déclenchant une alerte - Plan PRO';
COMMENT ON COLUMN produits.alerte_active IS 'Active/désactive les alertes pour ce produit';
