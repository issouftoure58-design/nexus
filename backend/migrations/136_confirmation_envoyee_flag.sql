-- Migration 136: Ajout flag confirmation_envoyee pour eviter les doublons SMS/Email
-- Bug: un client recoit la confirmation 2 fois (1re a la reservation, 2e si statut re-change vers confirme)
-- Fix: flag idempotent comme rappel_j1_envoye (migration 052)

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS confirmation_envoyee BOOLEAN DEFAULT FALSE;

-- Index pour les requetes de verification
CREATE INDEX IF NOT EXISTS idx_reservations_confirmation_envoyee
  ON reservations (confirmation_envoyee)
  WHERE confirmation_envoyee = FALSE;

COMMENT ON COLUMN reservations.confirmation_envoyee IS 'Flag idempotent: true si la confirmation (Email/WA/SMS) a deja ete envoyee';
