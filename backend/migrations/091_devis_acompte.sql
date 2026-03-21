-- 091 : Acompte variable sur les devis
-- Permet aux tenants (couvreur, BTP, etc.) de définir un % d'acompte par devis

ALTER TABLE devis ADD COLUMN IF NOT EXISTS acompte_pourcentage INTEGER DEFAULT NULL;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS montant_acompte INTEGER DEFAULT 0;

COMMENT ON COLUMN devis.acompte_pourcentage IS 'Pourcentage d''acompte demandé (0-100), NULL = pas d''acompte';
COMMENT ON COLUMN devis.montant_acompte IS 'Montant de l''acompte calculé en centimes';
