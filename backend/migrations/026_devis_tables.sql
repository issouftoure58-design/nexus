-- Migration 026: Module Devis
-- Chantier 2 - Gestion des devis avec intégration pipeline

-- Table principale des devis
CREATE TABLE IF NOT EXISTS devis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Numérotation
  numero VARCHAR(30) NOT NULL,  -- Format: DEV-YYYY-XXXXX

  -- Lien pipeline (optionnel)
  opportunite_id INTEGER REFERENCES opportunites(id) ON DELETE SET NULL,

  -- Client
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  client_nom VARCHAR(255),
  client_email VARCHAR(255),
  client_telephone VARCHAR(50),
  client_adresse TEXT,

  -- Prestation
  service_id UUID,
  service_nom VARCHAR(255),
  service_description TEXT,
  duree_minutes INTEGER,
  lieu VARCHAR(50) DEFAULT 'salon',

  -- Montants (en centimes)
  montant_ht INTEGER NOT NULL DEFAULT 0,
  taux_tva INTEGER DEFAULT 20,
  montant_tva INTEGER DEFAULT 0,
  montant_ttc INTEGER NOT NULL DEFAULT 0,
  frais_deplacement INTEGER DEFAULT 0,

  -- Statut: brouillon → envoye → accepte | rejete | expire
  statut VARCHAR(50) NOT NULL DEFAULT 'brouillon',

  -- Dates
  date_devis DATE NOT NULL DEFAULT CURRENT_DATE,
  validite_jours INTEGER DEFAULT 30,
  date_expiration DATE,
  date_envoi TIMESTAMP,
  date_acceptation TIMESTAMP,
  date_rejet TIMESTAMP,

  -- Liens créations automatiques
  reservation_id UUID,

  -- Métadonnées
  notes TEXT,
  raison_rejet TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT devis_statut_check CHECK (
    statut IN ('brouillon', 'envoye', 'accepte', 'rejete', 'expire', 'annule')
  ),
  CONSTRAINT devis_numero_unique UNIQUE (tenant_id, numero)
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_devis_tenant ON devis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devis_numero ON devis(tenant_id, numero);
CREATE INDEX IF NOT EXISTS idx_devis_client ON devis(client_id);
CREATE INDEX IF NOT EXISTS idx_devis_opportunite ON devis(opportunite_id);
CREATE INDEX IF NOT EXISTS idx_devis_statut ON devis(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_devis_dates ON devis(date_devis, date_expiration);

-- Historique des actions sur les devis
CREATE TABLE IF NOT EXISTS devis_historique (
  id SERIAL PRIMARY KEY,
  devis_id UUID NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,  -- 'cree', 'modifie', 'envoye', 'accepte', 'rejete', 'expire', 'annule'
  ancien_statut VARCHAR(50),
  nouveau_statut VARCHAR(50),
  notes TEXT,
  changed_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devis_hist_devis ON devis_historique(devis_id);
CREATE INDEX IF NOT EXISTS idx_devis_hist_tenant ON devis_historique(tenant_id);

-- Commentaires
COMMENT ON TABLE devis IS 'Devis clients avec cycle de vie complet';
COMMENT ON TABLE devis_historique IS 'Historique des changements de statut des devis';
COMMENT ON COLUMN devis.statut IS 'brouillon → envoye → accepte/rejete/expire';
COMMENT ON COLUMN devis.reservation_id IS 'Réservation créée automatiquement à l''acceptation';
