-- Migration 028: Devis avec lignes multiples
-- Permet d'avoir plusieurs services par devis

-- Table des lignes de devis (services sélectionnés)
CREATE TABLE IF NOT EXISTS devis_lignes (
  id SERIAL PRIMARY KEY,
  devis_id UUID NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL,

  -- Service
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  service_nom VARCHAR(255) NOT NULL,

  -- Quantité & Durée
  quantite INTEGER DEFAULT 1,
  duree_minutes INTEGER DEFAULT 60,

  -- Prix (en centimes)
  prix_unitaire INTEGER NOT NULL DEFAULT 0,
  prix_total INTEGER NOT NULL DEFAULT 0,

  -- Affectation (optionnel, rempli lors de l'exécution)
  membre_id INTEGER REFERENCES membres(id) ON DELETE SET NULL,
  reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devis_lignes_devis ON devis_lignes(devis_id);
CREATE INDEX IF NOT EXISTS idx_devis_lignes_tenant ON devis_lignes(tenant_id);

-- Commentaires
COMMENT ON TABLE devis_lignes IS 'Lignes de services pour les devis multi-services';
COMMENT ON COLUMN devis_lignes.membre_id IS 'Coiffeur assigné lors de l''exécution';
COMMENT ON COLUMN devis_lignes.reservation_id IS 'Réservation créée lors de l''exécution';
