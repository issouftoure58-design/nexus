-- Migration 122: Colonnes manquantes bulletins + taux PAS sur membres
-- prorata, derniere_paie, solde_tout_compte — requis par payrollEngine
-- taux_ir sur rh_membres — taux PAS individuel (DGFIP)

ALTER TABLE rh_bulletins_paie
  ADD COLUMN IF NOT EXISTS prorata JSONB,
  ADD COLUMN IF NOT EXISTS derniere_paie BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS solde_tout_compte JSONB;

-- Taux PAS individuel par salarié (communiqué par la DGFIP via DSN retour)
ALTER TABLE rh_membres
  ADD COLUMN IF NOT EXISTS taux_ir DECIMAL(5,2) DEFAULT 0;
