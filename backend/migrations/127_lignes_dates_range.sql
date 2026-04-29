-- Migration 127: Ajout date_debut/date_fin par ligne de service (réservations + devis)
-- Permet de définir des plages de dates différentes par prestation dans une même mission

ALTER TABLE reservation_lignes ADD COLUMN IF NOT EXISTS date_debut VARCHAR(10);
ALTER TABLE reservation_lignes ADD COLUMN IF NOT EXISTS date_fin VARCHAR(10);

ALTER TABLE devis_lignes ADD COLUMN IF NOT EXISTS date_debut VARCHAR(10);
ALTER TABLE devis_lignes ADD COLUMN IF NOT EXISTS date_fin VARCHAR(10);
