-- Migration 130: Enrichir opportunite_lignes avec dates/horaires par ligne
-- Modèle identique à devis_lignes pour copie automatique pipeline → devis

ALTER TABLE opportunite_lignes
  ADD COLUMN IF NOT EXISTS date_debut VARCHAR(10),
  ADD COLUMN IF NOT EXISTS date_fin VARCHAR(10),
  ADD COLUMN IF NOT EXISTS heure_debut TIME,
  ADD COLUMN IF NOT EXISTS heure_fin TIME,
  ADD COLUMN IF NOT EXISTS taux_horaire INTEGER,
  ADD COLUMN IF NOT EXISTS membre_id INTEGER;
