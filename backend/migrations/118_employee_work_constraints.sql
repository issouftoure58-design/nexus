-- Migration 118: Contraintes horaires par employé
-- pause_debut/pause_fin: plage de pause bloquée (défaut système: 12:00-13:00)
-- max_heures_jour: maximum heures travaillées par jour (défaut: 12)
-- pause_min_minutes: pause minimum obligatoire dans la journée (défaut: 30min)
-- NULL = utiliser les défauts système

ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS pause_debut TIME DEFAULT NULL;
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS pause_fin TIME DEFAULT NULL;
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS max_heures_jour NUMERIC(4,1) DEFAULT NULL;
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS pause_min_minutes INT DEFAULT NULL;
