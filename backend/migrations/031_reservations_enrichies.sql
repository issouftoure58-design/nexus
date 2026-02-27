-- ============================================
-- MIGRATION 031: Réservations Enrichies
-- ============================================
-- Support multi-services et multi-membres
-- Flux simplifié: Devis → Reservation → Facture
-- ============================================

-- ============================================
-- 1. RESERVATION_LIGNES (multi-services)
-- ============================================
CREATE TABLE IF NOT EXISTS reservation_lignes (
  id SERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL,

  -- Service
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  service_nom VARCHAR(255) NOT NULL,

  -- Quantité et durée
  quantite INTEGER DEFAULT 1,
  duree_minutes INTEGER,

  -- Prix (en centimes)
  prix_unitaire INTEGER NOT NULL DEFAULT 0,
  prix_total INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resa_lignes_reservation ON reservation_lignes(reservation_id);
CREATE INDEX IF NOT EXISTS idx_resa_lignes_tenant ON reservation_lignes(tenant_id);

COMMENT ON TABLE reservation_lignes IS 'Lignes de détail des réservations (multi-services)';

-- ============================================
-- 2. RESERVATION_MEMBRES (multi-affectation)
-- ============================================
CREATE TABLE IF NOT EXISTS reservation_membres (
  id SERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL,

  -- Membre assigné
  membre_id INTEGER NOT NULL REFERENCES rh_membres(id) ON DELETE CASCADE,

  -- Rôle (optionnel)
  role VARCHAR(50) DEFAULT 'principal', -- 'principal', 'assistant'

  -- Pour ressources génériques (optionnel)
  ressource_id INTEGER REFERENCES ressources(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(reservation_id, membre_id)
);

CREATE INDEX IF NOT EXISTS idx_resa_membres_reservation ON reservation_membres(reservation_id);
CREATE INDEX IF NOT EXISTS idx_resa_membres_membre ON reservation_membres(membre_id);
CREATE INDEX IF NOT EXISTS idx_resa_membres_tenant ON reservation_membres(tenant_id);

COMMENT ON TABLE reservation_membres IS 'Affectation des membres aux réservations (multi-affectation)';

-- ============================================
-- 3. ENRICHIR TABLE RESERVATIONS
-- ============================================
-- Ajouter champs pour montants détaillés
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS montant_ht INTEGER DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS montant_tva INTEGER DEFAULT 0;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS taux_tva DECIMAL(5,2) DEFAULT 20.00;

-- Lien vers devis source
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS devis_id UUID;

-- Durée totale (somme des lignes)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS duree_totale_minutes INTEGER;

-- Heure de fin calculée
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS heure_fin TEXT;

COMMENT ON COLUMN reservations.devis_id IS 'Lien vers le devis source si créée depuis devis';
COMMENT ON COLUMN reservations.duree_totale_minutes IS 'Durée totale (somme des services)';
COMMENT ON COLUMN reservations.heure_fin IS 'Heure de fin calculée';

-- ============================================
-- 4. ADRESSES ET GESTES COMMERCIAUX
-- ============================================
-- Adresse de facturation (peut différer de adresse_client)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS adresse_facturation TEXT;

-- Gestes commerciaux (remises)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS remise_type VARCHAR(20); -- 'pourcentage' ou 'montant'
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS remise_valeur INTEGER DEFAULT 0; -- % ou centimes
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS remise_motif VARCHAR(255); -- 'bienvenue', 'fidelite', 'promo', etc.

COMMENT ON COLUMN reservations.adresse_facturation IS 'Adresse de facturation si différente de adresse_client';
COMMENT ON COLUMN reservations.remise_type IS 'Type de remise: pourcentage ou montant';
COMMENT ON COLUMN reservations.remise_valeur IS 'Valeur de la remise (% ou centimes)';
COMMENT ON COLUMN reservations.remise_motif IS 'Motif de la remise';

-- ============================================
-- 5. MEMBRE ASSIGNÉ PAR LIGNE DE SERVICE
-- ============================================
ALTER TABLE reservation_lignes ADD COLUMN IF NOT EXISTS membre_id INTEGER REFERENCES rh_membres(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resa_lignes_membre ON reservation_lignes(membre_id);

COMMENT ON COLUMN reservation_lignes.membre_id IS 'Membre assigné à cette ligne de service';
