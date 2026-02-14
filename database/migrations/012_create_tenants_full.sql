-- Migration 012: Create or update tenants table with full schema
-- Cette migration crée la table tenants si elle n'existe pas
-- ou ajoute les colonnes manquantes si elle existe

-- Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  plan TEXT DEFAULT 'starter',
  status TEXT DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter les colonnes de config (si pas déjà présentes)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS assistant_name TEXT DEFAULT 'Nexus';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gerante TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS telephone TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS adresse TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS concept TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS secteur TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ville TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS frozen BOOLEAN DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS nexus_version TEXT DEFAULT '2.0';

-- JSONB config
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS limits_config JSONB DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}';

-- Timestamps
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Index
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- Policy pour service role
DROP POLICY IF EXISTS "Service role full access" ON tenants;
CREATE POLICY "Service role full access" ON tenants
  FOR ALL
  USING (true)
  WITH CHECK (true);
