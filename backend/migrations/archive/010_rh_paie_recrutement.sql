-- Migration 010: Tables pour journal de paie et recrutement

-- Journal de paie mensuel
CREATE TABLE IF NOT EXISTS rh_journal_paie (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  periode VARCHAR(7) NOT NULL, -- Format YYYY-MM
  total_brut INTEGER DEFAULT 0,
  total_net INTEGER DEFAULT 0,
  total_cotisations_patronales INTEGER DEFAULT 0,
  total_cotisations_salariales INTEGER DEFAULT 0,
  nb_salaries INTEGER DEFAULT 0,
  detail JSONB, -- Détail par salarié
  depense_salaires_id INTEGER,
  depense_cotisations_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, periode)
);

-- Index pour journal de paie
CREATE INDEX IF NOT EXISTS idx_rh_journal_paie_tenant ON rh_journal_paie(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_journal_paie_periode ON rh_journal_paie(periode);

-- Offres de recrutement
CREATE TABLE IF NOT EXISTS rh_recrutements (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  titre VARCHAR(255) NOT NULL,
  description TEXT,
  type_contrat VARCHAR(20) NOT NULL, -- cdi, cdd, stage, alternance
  salaire_min INTEGER, -- en centimes
  salaire_max INTEGER, -- en centimes
  lieu VARCHAR(255),
  competences JSONB DEFAULT '[]',
  date_limite DATE,
  statut VARCHAR(20) DEFAULT 'ouvert', -- ouvert, pourvu, annule
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour recrutements
CREATE INDEX IF NOT EXISTS idx_rh_recrutements_tenant ON rh_recrutements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_recrutements_statut ON rh_recrutements(statut);

-- Candidatures
CREATE TABLE IF NOT EXISTS rh_candidatures (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  recrutement_id INTEGER NOT NULL REFERENCES rh_recrutements(id) ON DELETE CASCADE,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  telephone VARCHAR(20),
  cv_url TEXT,
  lettre_motivation TEXT,
  source VARCHAR(50) DEFAULT 'direct', -- direct, linkedin, indeed, cooptation
  notes TEXT,
  statut VARCHAR(30) DEFAULT 'nouveau', -- nouveau, preselection, entretien, retenu, refuse
  date_entretien TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour candidatures
CREATE INDEX IF NOT EXISTS idx_rh_candidatures_tenant ON rh_candidatures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_candidatures_recrutement ON rh_candidatures(recrutement_id);
CREATE INDEX IF NOT EXISTS idx_rh_candidatures_statut ON rh_candidatures(statut);

COMMENT ON TABLE rh_journal_paie IS 'Journal de paie mensuel avec totaux et liens vers depenses';
COMMENT ON TABLE rh_recrutements IS 'Offres d emploi ouvertes';
COMMENT ON TABLE rh_candidatures IS 'Candidatures recues pour chaque offre';
