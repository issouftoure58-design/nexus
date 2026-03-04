-- ============================================
-- Migration 053: Tables pour outils admin chat
-- ============================================
-- 1. Table campagnes_relance (outils commercial)
-- 2. Table depenses (outils comptabilité)
-- 3. Colonnes manquantes rh_absences
-- 4. Colonnes manquantes rh_membres
-- ============================================

-- ============================================
-- 1. Table campagnes_relance
-- ============================================

CREATE TABLE IF NOT EXISTS campagnes_relance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  type_campagne TEXT DEFAULT 'inactifs',
  canal TEXT DEFAULT 'email',
  objet TEXT,
  message TEXT,
  offre_type TEXT,
  offre_valeur NUMERIC,
  segment_cible TEXT DEFAULT 'standard',
  nb_cibles INTEGER DEFAULT 0,
  nb_envoyes INTEGER DEFAULT 0,
  nb_conversions INTEGER DEFAULT 0,
  statut TEXT DEFAULT 'brouillon',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campagnes_relance_tenant ON campagnes_relance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campagnes_relance_statut ON campagnes_relance(tenant_id, statut);

ALTER TABLE campagnes_relance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campagnes_relance_tenant_isolation" ON campagnes_relance;
CREATE POLICY "campagnes_relance_tenant_isolation" ON campagnes_relance
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

-- ============================================
-- 2. Table depenses
-- ============================================

CREATE TABLE IF NOT EXISTS depenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  categorie TEXT NOT NULL,
  libelle TEXT,
  montant INTEGER NOT NULL, -- centimes
  date_depense DATE NOT NULL DEFAULT CURRENT_DATE,
  payee BOOLEAN DEFAULT false,
  date_paiement DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_depenses_tenant ON depenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_depenses_date ON depenses(tenant_id, date_depense);
CREATE INDEX IF NOT EXISTS idx_depenses_categorie ON depenses(tenant_id, categorie);

ALTER TABLE depenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "depenses_tenant_isolation" ON depenses;
CREATE POLICY "depenses_tenant_isolation" ON depenses
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));

-- ============================================
-- 3. Colonnes manquantes rh_absences
-- ============================================

ALTER TABLE rh_absences ADD COLUMN IF NOT EXISTS nb_jours INTEGER;
ALTER TABLE rh_absences ADD COLUMN IF NOT EXISTS date_validation TIMESTAMPTZ;
ALTER TABLE rh_absences ADD COLUMN IF NOT EXISTS commentaire_refus TEXT;

-- ============================================
-- 4. Colonnes manquantes rh_membres
-- ============================================

ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS type_contrat TEXT;
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS heures_semaine NUMERIC DEFAULT 35;

-- ============================================
-- Confirmation
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '[Migration 053] Tables campagnes_relance et depenses créées, colonnes RH ajoutées';
END $$;
