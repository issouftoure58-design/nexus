-- =====================================================
-- Migration 011: RH Equipe Basique (Business Plan)
-- SEMAINE 8 JOUR 7 - Gestion equipe simplifiee
-- =====================================================

-- Table des membres d'equipe
CREATE TABLE IF NOT EXISTS rh_membres (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT,
  telephone TEXT,
  role TEXT NOT NULL, -- 'manager', 'commercial', 'technicien', 'admin', 'autre'
  statut TEXT DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'conge')),
  date_embauche DATE,
  notes TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des performances (stats simplifiees)
CREATE TABLE IF NOT EXISTS rh_performances (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membre_id INTEGER NOT NULL REFERENCES rh_membres(id) ON DELETE CASCADE,
  periode TEXT NOT NULL, -- format 'YYYY-MM'
  ca_genere DECIMAL(10,2) DEFAULT 0,
  rdv_realises INTEGER DEFAULT 0,
  taux_conversion DECIMAL(5,2) DEFAULT 0,
  clients_acquis INTEGER DEFAULT 0,
  note_satisfaction DECIMAL(3,2) DEFAULT 0, -- 0-5
  objectif_atteint BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des absences
CREATE TABLE IF NOT EXISTS rh_absences (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  membre_id INTEGER NOT NULL REFERENCES rh_membres(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('conge', 'maladie', 'formation', 'autre')),
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuve', 'refuse')),
  motif TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_rh_membres_tenant ON rh_membres(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_membres_statut ON rh_membres(statut) WHERE statut = 'actif';
CREATE INDEX IF NOT EXISTS idx_rh_membres_role ON rh_membres(role);

CREATE INDEX IF NOT EXISTS idx_rh_performances_tenant ON rh_performances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_performances_membre ON rh_performances(membre_id);
CREATE INDEX IF NOT EXISTS idx_rh_performances_periode ON rh_performances(periode DESC);

CREATE INDEX IF NOT EXISTS idx_rh_absences_tenant ON rh_absences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_absences_membre ON rh_absences(membre_id);
CREATE INDEX IF NOT EXISTS idx_rh_absences_dates ON rh_absences(date_debut, date_fin);

-- Fonction trigger pour updated_at
CREATE OR REPLACE FUNCTION update_rh_membres_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger sur rh_membres
DROP TRIGGER IF EXISTS trigger_rh_membres_updated_at ON rh_membres;
CREATE TRIGGER trigger_rh_membres_updated_at
  BEFORE UPDATE ON rh_membres
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_membres_updated_at();

COMMENT ON TABLE rh_membres IS 'Membres equipe - Plan Business';
COMMENT ON TABLE rh_performances IS 'Performances mensuelles equipe - Plan Business';
COMMENT ON TABLE rh_absences IS 'Absences et conges equipe - Plan Business';
