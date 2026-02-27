-- Migration 026: Tables documents RH
-- Date: 2026-02-23
-- Description: Gestion des documents RH (DPAE, contrats, certificats, attestations)

-- ============================================
-- TABLE MODÈLES DE DOCUMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS rh_documents_modeles (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,

  -- Type de document
  type VARCHAR(50) NOT NULL, -- 'dpae', 'contrat_cdi', 'contrat_cdd', 'avenant', 'certificat_travail', 'attestation_employeur', 'solde_tout_compte'
  nom VARCHAR(255) NOT NULL,
  description TEXT,

  -- Contenu du modèle (HTML avec variables {{variable}})
  contenu_html TEXT NOT NULL,

  -- Variables disponibles dans ce modèle
  variables JSONB DEFAULT '[]', -- [{nom, description, exemple}]

  -- Métadonnées
  actif BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, type)
);

CREATE INDEX IF NOT EXISTS idx_rh_docs_modeles_tenant ON rh_documents_modeles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_docs_modeles_type ON rh_documents_modeles(type);

-- ============================================
-- TABLE DOCUMENTS GÉNÉRÉS
-- ============================================
CREATE TABLE IF NOT EXISTS rh_documents (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  membre_id INTEGER REFERENCES rh_membres(id) ON DELETE CASCADE,

  -- Type et titre
  type VARCHAR(50) NOT NULL,
  titre VARCHAR(255) NOT NULL,

  -- Fichier généré
  fichier_url TEXT, -- URL du PDF stocké
  fichier_nom VARCHAR(255),

  -- Contenu (pour régénération)
  contenu_html TEXT,
  donnees JSONB, -- Données utilisées pour la génération

  -- Workflow
  statut VARCHAR(20) DEFAULT 'brouillon', -- 'brouillon', 'finalise', 'signe', 'envoye'

  -- Signatures
  signe_employeur BOOLEAN DEFAULT false,
  date_signature_employeur TIMESTAMP,
  signe_salarie BOOLEAN DEFAULT false,
  date_signature_salarie TIMESTAMP,

  -- Envoi
  envoye_par_email BOOLEAN DEFAULT false,
  date_envoi TIMESTAMP,
  email_destinataire VARCHAR(255),

  -- Métadonnées
  genere_par INTEGER, -- admin qui a généré
  date_document DATE, -- date figurant sur le document
  date_effet DATE, -- date d'effet (pour contrats, avenants)

  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rh_docs_tenant ON rh_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_docs_membre ON rh_documents(membre_id);
CREATE INDEX IF NOT EXISTS idx_rh_docs_type ON rh_documents(type);
CREATE INDEX IF NOT EXISTS idx_rh_docs_statut ON rh_documents(statut);

-- ============================================
-- TABLE DPAE (Déclaration Préalable à l'Embauche)
-- ============================================
CREATE TABLE IF NOT EXISTS rh_dpae (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  membre_id INTEGER REFERENCES rh_membres(id) ON DELETE CASCADE,

  -- Informations DPAE
  date_embauche DATE NOT NULL,
  heure_embauche TIME DEFAULT '09:00',
  type_contrat VARCHAR(20) NOT NULL, -- 'cdi', 'cdd', 'alternance', 'stage'
  duree_periode_essai INTEGER, -- en jours

  -- Statut déclaration
  statut VARCHAR(20) DEFAULT 'a_declarer', -- 'a_declarer', 'declaree', 'confirmee', 'erreur'
  numero_declaration VARCHAR(50), -- numéro retourné par l'URSSAF
  date_declaration TIMESTAMP,

  -- Accusé de réception
  accuse_reception_url TEXT,

  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, membre_id, date_embauche)
);

CREATE INDEX IF NOT EXISTS idx_rh_dpae_tenant ON rh_dpae(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_dpae_membre ON rh_dpae(membre_id);
CREATE INDEX IF NOT EXISTS idx_rh_dpae_statut ON rh_dpae(statut);

-- ============================================
-- INSERTION MODÈLES PAR DÉFAUT
-- ============================================

-- Note: Les modèles seront créés dynamiquement par tenant lors de la première utilisation

-- ============================================
-- COMMENTAIRES
-- ============================================
COMMENT ON TABLE rh_documents_modeles IS 'Modèles de documents RH personnalisables par tenant';
COMMENT ON TABLE rh_documents IS 'Documents RH générés pour les salariés';
COMMENT ON TABLE rh_dpae IS 'Suivi des DPAE (Déclarations Préalables à l''Embauche)';
