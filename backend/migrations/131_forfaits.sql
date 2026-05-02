-- Migration 131: Système forfaits — contrats récurrents Security
-- Tables: forfaits, forfait_postes, forfait_periodes, forfait_affectations
-- + colonnes forfait sur reservations

-- Drop tables cassées (première tentative avait UUID au lieu de TEXT)
DROP TABLE IF EXISTS forfait_affectations CASCADE;
DROP TABLE IF EXISTS forfait_periodes CASCADE;
DROP TABLE IF EXISTS forfait_postes CASCADE;
DROP TABLE IF EXISTS forfaits CASCADE;

CREATE TABLE forfaits (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  numero VARCHAR(20) NOT NULL,
  client_id BIGINT REFERENCES clients(id),
  client_nom VARCHAR(200),
  nom VARCHAR(300) NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  montant_mensuel_ht INTEGER NOT NULL DEFAULT 0,
  taux_tva NUMERIC(5,2) DEFAULT 20,
  statut VARCHAR(20) DEFAULT 'actif',
  notes TEXT,
  devis_id UUID REFERENCES devis(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE forfait_postes (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  forfait_id BIGINT NOT NULL REFERENCES forfaits(id) ON DELETE CASCADE,
  service_id BIGINT REFERENCES services(id),
  service_nom VARCHAR(300) NOT NULL,
  effectif INTEGER NOT NULL DEFAULT 1,
  jours JSONB NOT NULL DEFAULT '[true,true,true,true,true,false,false]',
  heure_debut VARCHAR(5) NOT NULL,
  heure_fin VARCHAR(5) NOT NULL,
  taux_horaire INTEGER NOT NULL DEFAULT 0,
  cout_mensuel_ht INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE forfait_periodes (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  forfait_id BIGINT NOT NULL REFERENCES forfaits(id) ON DELETE CASCADE,
  mois VARCHAR(7) NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  statut VARCHAR(20) DEFAULT 'planifie',
  reservation_id BIGINT REFERENCES reservations(id),
  facture_id BIGINT REFERENCES factures(id),
  montant_prevu INTEGER DEFAULT 0,
  montant_reel INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(forfait_id, mois)
);

CREATE TABLE forfait_affectations (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  forfait_id BIGINT NOT NULL REFERENCES forfaits(id) ON DELETE CASCADE,
  periode_id BIGINT NOT NULL REFERENCES forfait_periodes(id) ON DELETE CASCADE,
  poste_id BIGINT NOT NULL REFERENCES forfait_postes(id) ON DELETE CASCADE,
  membre_id BIGINT REFERENCES rh_membres(id),
  date DATE NOT NULL,
  heure_debut VARCHAR(5) NOT NULL,
  heure_fin VARCHAR(5) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Colonnes forfait sur reservations (lien inverse période→prestation)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS forfait_periode_id BIGINT REFERENCES forfait_periodes(id);
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_forfait BOOLEAN DEFAULT FALSE;

-- Index perf
CREATE INDEX IF NOT EXISTS idx_forfaits_tenant ON forfaits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_forfait_postes_forfait ON forfait_postes(forfait_id);
CREATE INDEX IF NOT EXISTS idx_forfait_periodes_forfait ON forfait_periodes(forfait_id);
CREATE INDEX IF NOT EXISTS idx_forfait_affectations_periode ON forfait_affectations(periode_id);
CREATE INDEX IF NOT EXISTS idx_forfait_affectations_membre ON forfait_affectations(membre_id, date);
CREATE INDEX IF NOT EXISTS idx_reservations_forfait ON reservations(forfait_periode_id) WHERE forfait_periode_id IS NOT NULL;
