-- 094: Fix PLTE bootstrap — tables manquantes + contraintes UNIQUE pour upsert
-- Date: 2026-03-25
-- Contexte: Le bootstrap PLTE echoue silencieusement car:
--   1. Les tables profil (hotel, restaurant, securite, domicile) n'existent pas
--   2. Les contraintes UNIQUE requises par les upsert Supabase sont absentes
-- Ce script est IDEMPOTENT — safe a re-executer plusieurs fois.

-- ============================================================
-- PARTIE 1: TABLES PROFIL (depuis plte_v2_migration.sql)
-- ============================================================

-- Hotel — chambres
CREATE TABLE IF NOT EXISTS hotel_chambres (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  type TEXT DEFAULT 'simple',
  capacite INTEGER DEFAULT 1,
  prix_nuit INTEGER DEFAULT 0,
  etage INTEGER DEFAULT 1,
  statut TEXT DEFAULT 'disponible',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, numero)
);

ALTER TABLE hotel_chambres ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hotel_chambres' AND policyname = 'hotel_chambres_service_role') THEN
    CREATE POLICY "hotel_chambres_service_role" ON hotel_chambres FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Restaurant — tables
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  capacite INTEGER DEFAULT 2,
  zone TEXT DEFAULT 'salle',
  statut TEXT DEFAULT 'libre',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, numero)
);

ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'restaurant_tables' AND policyname = 'restaurant_tables_service_role') THEN
    CREATE POLICY "restaurant_tables_service_role" ON restaurant_tables FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Securite — sites
CREATE TABLE IF NOT EXISTS security_sites (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  adresse TEXT,
  type_site TEXT DEFAULT 'bureau',
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, nom)
);

ALTER TABLE security_sites ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'security_sites' AND policyname = 'security_sites_service_role') THEN
    CREATE POLICY "security_sites_service_role" ON security_sites FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Domicile — zones intervention
CREATE TABLE IF NOT EXISTS zones_intervention (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  rayon_km INTEGER DEFAULT 10,
  frais_deplacement INTEGER DEFAULT 0,
  code_postal TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, nom)
);

ALTER TABLE zones_intervention ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zones_intervention' AND policyname = 'zones_intervention_service_role') THEN
    CREATE POLICY "zones_intervention_service_role" ON zones_intervention FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- PARTIE 2: CONTRAINTES UNIQUE MANQUANTES (pour upsert bootstrap)
-- ============================================================

-- clients: onConflict 'tenant_id,email' — requis par ensureTestClients()
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_clients_tenant_email'
  ) THEN
    -- Supprimer doublons eventuels avant d'ajouter la contrainte
    DELETE FROM clients a USING clients b
    WHERE a.id > b.id
      AND a.tenant_id = b.tenant_id
      AND a.email = b.email
      AND a.email IS NOT NULL;

    ALTER TABLE clients ADD CONSTRAINT uq_clients_tenant_email UNIQUE (tenant_id, email);
    RAISE NOTICE 'Contrainte uq_clients_tenant_email ajoutee';
  END IF;
END $$;

-- rh_membres: onConflict 'tenant_id,nom' — requis par seedEmployes() (salon + securite)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_rh_membres_tenant_nom'
  ) THEN
    DELETE FROM rh_membres a USING rh_membres b
    WHERE a.id > b.id
      AND a.tenant_id = b.tenant_id
      AND a.nom = b.nom;

    ALTER TABLE rh_membres ADD CONSTRAINT uq_rh_membres_tenant_nom UNIQUE (tenant_id, nom);
    RAISE NOTICE 'Contrainte uq_rh_membres_tenant_nom ajoutee';
  END IF;
END $$;

-- produits: onConflict 'tenant_id,reference' — requis par seedProduits() (salon + commerce)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_produits_tenant_reference'
  ) THEN
    DELETE FROM produits a USING produits b
    WHERE a.id > b.id
      AND a.tenant_id = b.tenant_id
      AND a.reference = b.reference
      AND a.reference IS NOT NULL;

    ALTER TABLE produits ADD CONSTRAINT uq_produits_tenant_reference UNIQUE (tenant_id, reference);
    RAISE NOTICE 'Contrainte uq_produits_tenant_reference ajoutee';
  END IF;
END $$;

-- ============================================================
-- PARTIE 3: NETTOYAGE ANCIENS RESULTATS PLTE
-- ============================================================

-- Supprimer les anciens resultats H7 (renomme en N14)
DELETE FROM sentinel_logic_tests WHERE name LIKE 'H7_%';

-- ============================================================
-- PARTIE 4: VERIFICATION
-- ============================================================

-- Verifier que les 4 tables existent
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hotel_chambres')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurant_tables')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_sites')
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'zones_intervention')
  THEN
    RAISE NOTICE '✅ 4 tables profil OK (hotel_chambres, restaurant_tables, security_sites, zones_intervention)';
  ELSE
    RAISE WARNING '❌ Une ou plusieurs tables profil manquantes!';
  END IF;
END $$;

-- Verifier les 3 contraintes UNIQUE
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_clients_tenant_email')
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_rh_membres_tenant_nom')
     AND EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_produits_tenant_reference')
  THEN
    RAISE NOTICE '✅ 3 contraintes UNIQUE OK (clients, rh_membres, produits)';
  ELSE
    RAISE WARNING '❌ Une ou plusieurs contraintes UNIQUE manquantes!';
  END IF;
END $$;
