-- Migration 045: Champs onboarding pour les tenants
-- Ajoute les colonnes necessaires pour le wizard d'onboarding

-- Ajouter colonne onboarding_completed si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE tenants ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Ajouter colonne onboarding_completed_at si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE tenants ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Ajouter colonne couleur_primaire si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'couleur_primaire'
  ) THEN
    ALTER TABLE tenants ADD COLUMN couleur_primaire VARCHAR(20) DEFAULT '#06B6D4';
  END IF;
END $$;

-- Ajouter colonne logo_url si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE tenants ADD COLUMN logo_url TEXT;
  END IF;
END $$;

-- Ajouter colonne description si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'description'
  ) THEN
    ALTER TABLE tenants ADD COLUMN description TEXT;
  END IF;
END $$;

-- Ajouter colonne adresse si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'adresse'
  ) THEN
    ALTER TABLE tenants ADD COLUMN adresse TEXT;
  END IF;
END $$;

-- Ajouter colonne site_web si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'site_web'
  ) THEN
    ALTER TABLE tenants ADD COLUMN site_web VARCHAR(255);
  END IF;
END $$;

-- Ajouter colonne instagram si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'instagram'
  ) THEN
    ALTER TABLE tenants ADD COLUMN instagram VARCHAR(100);
  END IF;
END $$;

-- Ajouter colonne facebook si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'facebook'
  ) THEN
    ALTER TABLE tenants ADD COLUMN facebook VARCHAR(255);
  END IF;
END $$;

-- Index pour trouver les tenants qui n'ont pas complete l'onboarding
CREATE INDEX IF NOT EXISTS idx_tenants_onboarding ON tenants(onboarding_completed) WHERE onboarding_completed = FALSE;

COMMENT ON COLUMN tenants.onboarding_completed IS 'Indique si le tenant a termine le wizard d onboarding';
COMMENT ON COLUMN tenants.onboarding_completed_at IS 'Date de completion de l onboarding';
COMMENT ON COLUMN tenants.couleur_primaire IS 'Couleur principale de l interface (hex)';
COMMENT ON COLUMN tenants.logo_url IS 'URL du logo du tenant';
