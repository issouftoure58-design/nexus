-- ============================================
-- MIGRATION 004 : RELANCES FACTURES AUTOMATIQUES
-- Ajout des colonnes pour le suivi des relances J+7, J+14, J+21
-- ============================================

-- Colonnes de suivi des relances automatiques
ALTER TABLE factures ADD COLUMN IF NOT EXISTS relance_j7_envoyee BOOLEAN DEFAULT false;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS relance_j14_envoyee BOOLEAN DEFAULT false;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS relance_j21_envoyee BOOLEAN DEFAULT false;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS date_relance_j7 TIMESTAMPTZ;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS date_relance_j14 TIMESTAMPTZ;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS date_relance_j21 TIMESTAMPTZ;

-- Colonnes additionnelles pour le système de relances existant (si absentes)
ALTER TABLE factures ADD COLUMN IF NOT EXISTS date_echeance DATE;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS niveau_relance INTEGER DEFAULT 0;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS date_derniere_relance TIMESTAMPTZ;

-- Index pour optimiser les requêtes de relances
CREATE INDEX IF NOT EXISTS idx_factures_relances_pending
ON factures(tenant_id, statut, date_echeance)
WHERE statut NOT IN ('payee', 'annulee');

CREATE INDEX IF NOT EXISTS idx_factures_j7_pending
ON factures(tenant_id, date_echeance)
WHERE relance_j7_envoyee = false AND statut NOT IN ('payee', 'annulee');

CREATE INDEX IF NOT EXISTS idx_factures_j14_pending
ON factures(tenant_id, date_echeance)
WHERE relance_j14_envoyee = false AND statut NOT IN ('payee', 'annulee');

CREATE INDEX IF NOT EXISTS idx_factures_j21_pending
ON factures(tenant_id, date_echeance)
WHERE relance_j21_envoyee = false AND statut NOT IN ('payee', 'annulee');

-- ============================================
-- TABLE : Historique des relances envoyées
-- ============================================
CREATE TABLE IF NOT EXISTS relances_factures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL,
  facture_id UUID NOT NULL REFERENCES factures(id) ON DELETE CASCADE,

  -- Type de relance
  niveau INTEGER NOT NULL CHECK (niveau >= 1 AND niveau <= 4),
  type VARCHAR(50) NOT NULL CHECK (type IN ('preventif', 'rappel', 'urgence', 'mise_en_demeure', 'j7', 'j14', 'j21')),

  -- Canaux utilisés
  email_envoye BOOLEAN DEFAULT false,
  sms_envoye BOOLEAN DEFAULT false,

  -- IDs externes (pour tracking)
  email_id VARCHAR(255),
  sms_id VARCHAR(255),

  -- Résultat
  statut VARCHAR(50) DEFAULT 'envoye' CHECK (statut IN ('envoye', 'ouvert', 'clique', 'erreur')),
  erreur_message TEXT,

  -- Timestamps
  date_envoi TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relances_facture ON relances_factures(facture_id);
CREATE INDEX IF NOT EXISTS idx_relances_tenant ON relances_factures(tenant_id, date_envoi DESC);

-- ============================================
-- VUE : Factures à relancer (J+7, J+14, J+21)
-- ============================================
CREATE OR REPLACE VIEW factures_a_relancer AS
SELECT
  f.*,
  -- Calcul des jours depuis échéance
  CASE
    WHEN f.date_echeance IS NULL THEN NULL
    ELSE CURRENT_DATE - f.date_echeance
  END as jours_retard,

  -- Déterminer le prochain niveau de relance J+7/J+14/J+21
  CASE
    WHEN f.statut IN ('payee', 'annulee') THEN 0
    WHEN f.date_echeance IS NULL THEN 0
    -- J+21 : plus de 21 jours de retard, relance J+21 pas encore envoyée
    WHEN CURRENT_DATE - f.date_echeance >= 21 AND f.relance_j21_envoyee = false THEN 4
    -- J+14 : entre 14 et 20 jours de retard, relance J+14 pas encore envoyée
    WHEN CURRENT_DATE - f.date_echeance >= 14 AND f.relance_j14_envoyee = false THEN 3
    -- J+7 : entre 7 et 13 jours de retard, relance J+7 pas encore envoyée
    WHEN CURRENT_DATE - f.date_echeance >= 7 AND f.relance_j7_envoyee = false THEN 2
    ELSE 0
  END as prochain_niveau_relance,

  -- Label du prochain niveau
  CASE
    WHEN f.statut IN ('payee', 'annulee') THEN NULL
    WHEN f.date_echeance IS NULL THEN NULL
    WHEN CURRENT_DATE - f.date_echeance >= 21 AND f.relance_j21_envoyee = false THEN 'Mise en demeure J+21'
    WHEN CURRENT_DATE - f.date_echeance >= 14 AND f.relance_j14_envoyee = false THEN 'Relance urgente J+14'
    WHEN CURRENT_DATE - f.date_echeance >= 7 AND f.relance_j7_envoyee = false THEN 'Première relance J+7'
    ELSE NULL
  END as label_relance

FROM factures f
WHERE f.statut NOT IN ('payee', 'annulee')
  AND f.date_echeance IS NOT NULL
  AND f.date_echeance < CURRENT_DATE;

-- ============================================
-- COMMENTAIRES
-- ============================================
COMMENT ON COLUMN factures.relance_j7_envoyee IS 'Relance J+7 envoyée (première relance)';
COMMENT ON COLUMN factures.relance_j14_envoyee IS 'Relance J+14 envoyée (relance urgente)';
COMMENT ON COLUMN factures.relance_j21_envoyee IS 'Relance J+21 envoyée (mise en demeure)';
COMMENT ON TABLE relances_factures IS 'Historique des relances factures envoyées';
COMMENT ON VIEW factures_a_relancer IS 'Vue des factures impayées à relancer avec calcul automatique du niveau';
