-- ============================================
-- MIGRATION 119: Date par ligne de réservation
-- ============================================
-- Support multi-jours: chaque ligne peut avoir sa propre date
-- (ex: Microlocks 18h = Jour 1: 09:00-18:00, Jour 2: 09:00-18:00)
-- ============================================

ALTER TABLE reservation_lignes ADD COLUMN IF NOT EXISTS date VARCHAR(10);

COMMENT ON COLUMN reservation_lignes.date IS 'Date de cette ligne (format YYYY-MM-DD). NULL = date de la réservation parente.';
