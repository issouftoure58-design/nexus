-- Migration 036: Ajout des heures aux lignes de devis
-- Pour le mode horaire (sécurité, etc.), permet de définir heure_debut/heure_fin par service

-- Ajouter les champs heures sur devis_lignes
ALTER TABLE devis_lignes ADD COLUMN IF NOT EXISTS heure_debut TIME;
ALTER TABLE devis_lignes ADD COLUMN IF NOT EXISTS heure_fin TIME;
ALTER TABLE devis_lignes ADD COLUMN IF NOT EXISTS taux_horaire INTEGER; -- centimes/heure

-- Commentaires
COMMENT ON COLUMN devis_lignes.heure_debut IS 'Heure de début pour cette ligne (mode horaire)';
COMMENT ON COLUMN devis_lignes.heure_fin IS 'Heure de fin pour cette ligne (mode horaire)';
COMMENT ON COLUMN devis_lignes.taux_horaire IS 'Taux horaire en centimes (mode horaire)';
