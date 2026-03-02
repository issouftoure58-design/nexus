-- Migration 007: Commercial Pipeline
-- NEXUS Plan PRO Feature

-- Table des opportunités commerciales
CREATE TABLE IF NOT EXISTS opportunites (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  description TEXT,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  montant DECIMAL(10,2) NOT NULL DEFAULT 0,
  etape TEXT NOT NULL DEFAULT 'prospect', -- 'prospect', 'contact', 'devis', 'negociation', 'gagne', 'perdu'
  probabilite INTEGER DEFAULT 10, -- 0-100%
  date_cloture_prevue DATE,
  date_cloture_reelle DATE,
  motif_perte TEXT,
  source TEXT, -- 'site_web', 'recommandation', 'reseaux_sociaux', 'pub', 'autre'
  priorite TEXT DEFAULT 'normale', -- 'basse', 'normale', 'haute', 'urgente'
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_by TEXT,
  assigned_to TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table historique des changements d'étape
CREATE TABLE IF NOT EXISTS opportunites_historique (
  id SERIAL PRIMARY KEY,
  opportunite_id INTEGER REFERENCES opportunites(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  etape_precedente TEXT,
  etape_nouvelle TEXT NOT NULL,
  changed_by TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_opportunites_tenant ON opportunites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_opportunites_etape ON opportunites(etape);
CREATE INDEX IF NOT EXISTS idx_opportunites_client ON opportunites(client_id);
CREATE INDEX IF NOT EXISTS idx_opportunites_date_cloture ON opportunites(date_cloture_prevue);
CREATE INDEX IF NOT EXISTS idx_opportunites_historique_opp ON opportunites_historique(opportunite_id);

-- Probabilités par défaut selon étapes:
-- prospect: 10%
-- contact: 25%
-- devis: 50%
-- negociation: 75%
-- gagne: 100%
-- perdu: 0%

-- Contrainte sur les étapes valides
ALTER TABLE opportunites DROP CONSTRAINT IF EXISTS opportunites_etape_check;
ALTER TABLE opportunites ADD CONSTRAINT opportunites_etape_check CHECK (
  etape IN ('prospect', 'contact', 'devis', 'negociation', 'gagne', 'perdu')
);

-- Contrainte sur les priorités valides
ALTER TABLE opportunites DROP CONSTRAINT IF EXISTS opportunites_priorite_check;
ALTER TABLE opportunites ADD CONSTRAINT opportunites_priorite_check CHECK (
  priorite IN ('basse', 'normale', 'haute', 'urgente')
);
