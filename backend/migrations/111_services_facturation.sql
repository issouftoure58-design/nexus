-- Migration 111 : Mode de facturation des services annexes hoteliers
--
-- Certains extras (petit-dej, demi-pension, parking) se facturent par nuit,
-- d'autres en forfait (late checkout, transfert, lit bebe).
-- Cette colonne permet au frontend (modal resa) et a l'IA de calculer
-- correctement le prix total : prix_unitaire × nb_nuits si par_nuit,
-- sinon prix_unitaire × 1.
--
-- Par defaut 'forfait' pour eviter toute multiplication implicite sur les
-- services existants non hoteliers (salon, restaurant, etc.).

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS facturation TEXT
  CHECK (facturation IN ('par_nuit', 'forfait'))
  DEFAULT 'forfait';

-- Backfill : les services annexes hoteliers courants passent en 'par_nuit'
UPDATE services
SET facturation = 'par_nuit'
WHERE facturation = 'forfait'
  AND type_chambre IS NULL
  AND (
       nom ILIKE '%petit%d_jeuner%'
    OR nom ILIKE '%demi-pension%'
    OR nom ILIKE '%demi pension%'
    OR nom ILIKE '%pension compl_te%'
    OR nom ILIKE '%parking%'
  );

COMMENT ON COLUMN services.facturation IS
  'Mode facturation: par_nuit (multiplie par nb_nuits) ou forfait (prix unique). Pertinent surtout pour hotel.';
