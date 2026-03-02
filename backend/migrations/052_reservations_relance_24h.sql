-- Migration 052: Ajouter colonnes relance_24h sur reservations
-- Le scheduler sendRelance24h utilise ces colonnes pour eviter les doublons

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS relance_24h_envoyee BOOLEAN DEFAULT FALSE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS relance_24h_date TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_reservations_relance_24h
  ON reservations(relance_24h_envoyee) WHERE relance_24h_envoyee = FALSE;
