-- Migration 033: Fix devis.reservation_id type
-- Le champ était UUID mais reservations.id est INTEGER
-- ================================================

-- Supprimer la colonne existante (UUID)
ALTER TABLE devis DROP COLUMN IF EXISTS reservation_id;

-- Recréer avec le bon type (INTEGER)
ALTER TABLE devis ADD COLUMN reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL;

-- Index pour les jointures
CREATE INDEX IF NOT EXISTS idx_devis_reservation ON devis(reservation_id);

-- Commentaire
COMMENT ON COLUMN devis.reservation_id IS 'Réservation créée lors de l''exécution du devis';
