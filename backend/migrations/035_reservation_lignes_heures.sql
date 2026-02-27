-- ============================================
-- MIGRATION 035: Heures par ligne de réservation
-- ============================================
-- Support mode horaire: chaque agent a ses propres heures
-- ============================================

-- Ajouter colonnes heure_debut et heure_fin pour chaque ligne
ALTER TABLE reservation_lignes ADD COLUMN IF NOT EXISTS heure_debut VARCHAR(5);
ALTER TABLE reservation_lignes ADD COLUMN IF NOT EXISTS heure_fin VARCHAR(5);

COMMENT ON COLUMN reservation_lignes.heure_debut IS 'Heure de début pour cet agent (format HH:MM)';
COMMENT ON COLUMN reservation_lignes.heure_fin IS 'Heure de fin pour cet agent (format HH:MM)';
