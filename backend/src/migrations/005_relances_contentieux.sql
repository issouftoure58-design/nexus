-- ============================================
-- MIGRATION 005 : CONTENTIEUX & RELANCES ÉTENDUES
-- Ajout des colonnes pour contentieux et nouveau système R1-R5
-- ============================================

-- Colonnes pour le contentieux
ALTER TABLE factures ADD COLUMN IF NOT EXISTS en_contentieux BOOLEAN DEFAULT false;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS date_contentieux TIMESTAMPTZ;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS service_contentieux VARCHAR(50) CHECK (service_contentieux IN ('interne', 'huissier'));

-- Mise à jour de la contrainte de niveau pour supporter R1-R6 (contentieux)
-- Le niveau_relance peut maintenant aller de 0 à 6
-- 0 = pas de relance
-- 1 = R1 préventive (7j avant échéance)
-- 2 = R2 jour d'échéance
-- 3 = R3 +7j
-- 4 = R4 +15j
-- 5 = R5 mise en demeure +21j
-- 6 = Contentieux +30j

-- Ajout colonne notes dans relances_factures
ALTER TABLE relances_factures ADD COLUMN IF NOT EXISTS notes TEXT;

-- Mise à jour de la contrainte type pour supporter les nouveaux types
-- D'abord supprimer l'ancienne contrainte si elle existe
ALTER TABLE relances_factures DROP CONSTRAINT IF EXISTS relances_factures_type_check;

-- Puis ajouter la nouvelle contrainte
ALTER TABLE relances_factures ADD CONSTRAINT relances_factures_type_check
CHECK (type IN ('preventif', 'rappel', 'urgence', 'mise_en_demeure', 'j7', 'j14', 'j21', 'preventive', 'echeance', 'relance1', 'relance2', 'contentieux'));

-- Mise à jour de la contrainte niveau (1-6 au lieu de 1-4)
ALTER TABLE relances_factures DROP CONSTRAINT IF EXISTS relances_factures_niveau_check;
ALTER TABLE relances_factures ADD CONSTRAINT relances_factures_niveau_check CHECK (niveau >= 1 AND niveau <= 6);

-- Index pour les factures en contentieux
CREATE INDEX IF NOT EXISTS idx_factures_contentieux
ON factures(tenant_id, en_contentieux)
WHERE en_contentieux = true;

-- ============================================
-- COMMENTAIRES
-- ============================================
COMMENT ON COLUMN factures.en_contentieux IS 'Facture transmise au service contentieux';
COMMENT ON COLUMN factures.date_contentieux IS 'Date de transmission au contentieux';
COMMENT ON COLUMN factures.service_contentieux IS 'Service contentieux : interne ou huissier';
