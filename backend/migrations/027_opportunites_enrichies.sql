-- Migration 027: Opportunités Enrichies
-- Ajout de services multiples, gestes commerciaux, montants calculés

-- Table des lignes d'opportunité (services sélectionnés)
CREATE TABLE IF NOT EXISTS opportunite_lignes (
  id SERIAL PRIMARY KEY,
  opportunite_id INTEGER NOT NULL REFERENCES opportunites(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL,

  -- Service
  service_id INTEGER,
  service_nom VARCHAR(255) NOT NULL,

  -- Quantité & Durée
  quantite INTEGER DEFAULT 1,
  duree_minutes INTEGER DEFAULT 0,

  -- Prix (en centimes)
  prix_unitaire INTEGER NOT NULL DEFAULT 0,
  prix_total INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opp_lignes_opp ON opportunite_lignes(opportunite_id);
CREATE INDEX IF NOT EXISTS idx_opp_lignes_tenant ON opportunite_lignes(tenant_id);

-- Nouveaux champs sur opportunites
ALTER TABLE opportunites ADD COLUMN IF NOT EXISTS date_debut DATE;
ALTER TABLE opportunites ADD COLUMN IF NOT EXISTS duree_totale_minutes INTEGER DEFAULT 0;
ALTER TABLE opportunites ADD COLUMN IF NOT EXISTS lieu VARCHAR(50) DEFAULT 'salon';
ALTER TABLE opportunites ADD COLUMN IF NOT EXISTS adresse_client TEXT;

-- Gestes commerciaux
ALTER TABLE opportunites ADD COLUMN IF NOT EXISTS remise_type VARCHAR(20); -- 'pourcentage' ou 'montant'
ALTER TABLE opportunites ADD COLUMN IF NOT EXISTS remise_valeur INTEGER DEFAULT 0; -- % ou centimes
ALTER TABLE opportunites ADD COLUMN IF NOT EXISTS remise_motif VARCHAR(255); -- 'bienvenue', 'fidelite', 'promo', etc.

-- Montants calculés (en centimes)
ALTER TABLE opportunites ADD COLUMN IF NOT EXISTS montant_ht INTEGER DEFAULT 0;
ALTER TABLE opportunites ADD COLUMN IF NOT EXISTS montant_tva INTEGER DEFAULT 0;
ALTER TABLE opportunites ADD COLUMN IF NOT EXISTS montant_ttc INTEGER DEFAULT 0;
ALTER TABLE opportunites ADD COLUMN IF NOT EXISTS montant_remise INTEGER DEFAULT 0;
ALTER TABLE opportunites ADD COLUMN IF NOT EXISTS frais_deplacement INTEGER DEFAULT 0;

-- Commentaires
COMMENT ON TABLE opportunite_lignes IS 'Lignes de services pour les opportunités';
COMMENT ON COLUMN opportunites.remise_type IS 'Type de remise: pourcentage ou montant fixe';
COMMENT ON COLUMN opportunites.remise_valeur IS 'Valeur de remise (% ou centimes selon type)';
COMMENT ON COLUMN opportunites.lieu IS 'Lieu prestation: salon ou domicile';
