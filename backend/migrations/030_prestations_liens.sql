-- ============================================
-- MIGRATION 030: Liens Prestations <-> Réservations
-- ============================================
-- Permet de lier une prestation à sa réservation agenda
-- et une réservation à sa prestation
-- ============================================

-- Ajouter reservation_id sur prestations
ALTER TABLE prestations ADD COLUMN IF NOT EXISTS reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_prestations_reservation ON prestations(reservation_id);

-- Ajouter prestation_id sur reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS prestation_id UUID REFERENCES prestations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_prestation ON reservations(prestation_id);

-- Ajouter prestation_id sur factures (pour lien direct)
ALTER TABLE factures ADD COLUMN IF NOT EXISTS prestation_id UUID REFERENCES prestations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_factures_prestation ON factures(prestation_id);

COMMENT ON COLUMN prestations.reservation_id IS 'Lien vers la réservation agenda associée';
COMMENT ON COLUMN reservations.prestation_id IS 'Lien vers la prestation associée (si créée depuis devis)';
COMMENT ON COLUMN factures.prestation_id IS 'Lien vers la prestation associée (si créée depuis prestation)';
