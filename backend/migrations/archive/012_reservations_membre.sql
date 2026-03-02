-- =====================================================
-- Migration 012: Liaison Réservations - Membres RH
-- Permet d'assigner un employé à chaque réservation
-- =====================================================

-- Ajouter la colonne membre_id à la table reservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS membre_id INTEGER REFERENCES rh_membres(id) ON DELETE SET NULL;

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_reservations_membre ON reservations(membre_id);
CREATE INDEX IF NOT EXISTS idx_reservations_membre_date ON reservations(membre_id, date);

-- Commentaire
COMMENT ON COLUMN reservations.membre_id IS 'Employé/salarié assigné à cette réservation';

-- Vue pour le planning d'un employé
CREATE OR REPLACE VIEW v_planning_employe AS
SELECT
  r.id AS reservation_id,
  r.tenant_id,
  r.date,
  r.heure,
  r.service_nom,
  r.duree_minutes,
  r.statut,
  r.lieu,
  r.prix_total,
  r.notes,
  r.membre_id,
  m.nom AS employe_nom,
  m.prenom AS employe_prenom,
  m.role AS employe_role,
  c.nom AS client_nom,
  c.prenom AS client_prenom,
  c.telephone AS client_telephone
FROM reservations r
LEFT JOIN rh_membres m ON r.membre_id = m.id
LEFT JOIN clients c ON r.client_id = c.id
WHERE r.statut NOT IN ('annule')
ORDER BY r.date, r.heure;

COMMENT ON VIEW v_planning_employe IS 'Planning des réservations par employé';
