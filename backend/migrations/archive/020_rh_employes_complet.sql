-- Migration 020: Enrichissement complet table rh_membres + table diplômes
-- Date: 2026-02-23
-- Description: Ajout de tous les champs nécessaires pour un SIRH complet conforme aux obligations légales françaises

-- =====================================================
-- PARTIE 1: Enrichissement table rh_membres
-- =====================================================

-- Identité
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS sexe VARCHAR(10); -- 'M', 'F', 'Autre'
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS nationalite VARCHAR(100);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS lieu_naissance VARCHAR(255);

-- Adresse complète
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS adresse_rue TEXT;
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS adresse_cp VARCHAR(10);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS adresse_ville VARCHAR(100);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS adresse_pays VARCHAR(100) DEFAULT 'France';

-- Pièce d'identité
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS piece_identite_type VARCHAR(50); -- 'cni', 'passeport', 'titre_sejour'
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS piece_identite_numero VARCHAR(100);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS piece_identite_expiration DATE;
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS piece_identite_url TEXT; -- scan stocké

-- Contrat et temps de travail
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS type_contrat VARCHAR(20) DEFAULT 'cdi'; -- 'cdi', 'cdd', 'alternance', 'stage', 'interim'
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS date_fin_contrat DATE; -- pour CDD
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS temps_travail VARCHAR(20) DEFAULT 'temps_plein'; -- 'temps_plein', 'temps_partiel'
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS heures_hebdo DECIMAL(4,2) DEFAULT 35.00;
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS heures_mensuelles DECIMAL(5,2) DEFAULT 151.67;
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS jours_travailles JSONB DEFAULT '["lundi","mardi","mercredi","jeudi","vendredi"]';

-- Classification conventionnelle
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS convention_collective VARCHAR(100);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS classification_niveau VARCHAR(20);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS classification_echelon VARCHAR(20);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS classification_coefficient INTEGER;
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS categorie_sociopro VARCHAR(50); -- 'ouvrier', 'employe', 'technicien', 'agent_maitrise', 'cadre'

-- Sécurité sociale et mutuelle
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS regime_ss VARCHAR(50) DEFAULT 'general'; -- 'general', 'alsace_moselle', 'agricole'
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS mutuelle_obligatoire BOOLEAN DEFAULT true;
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS mutuelle_dispense BOOLEAN DEFAULT false;
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS prevoyance BOOLEAN DEFAULT false;

-- Contact urgence
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS contact_urgence_nom VARCHAR(255);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS contact_urgence_tel VARCHAR(20);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS contact_urgence_lien VARCHAR(50); -- 'conjoint', 'parent', 'enfant', 'autre'

-- Coordonnées bancaires
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS iban VARCHAR(34);
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS bic VARCHAR(11);

-- Poste enrichi (intitulé libre au lieu de juste role)
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS poste VARCHAR(100);

-- Numéro d'ordre pour registre du personnel (chronologique par embauche)
ALTER TABLE rh_membres ADD COLUMN IF NOT EXISTS numero_ordre_registre INTEGER;

-- Index pour recherches
CREATE INDEX IF NOT EXISTS idx_rh_membres_type_contrat ON rh_membres(type_contrat);
CREATE INDEX IF NOT EXISTS idx_rh_membres_categorie ON rh_membres(categorie_sociopro);

-- =====================================================
-- PARTIE 2: Table diplômes
-- =====================================================

CREATE TABLE IF NOT EXISTS rh_diplomes (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  membre_id INTEGER REFERENCES rh_membres(id) ON DELETE CASCADE,
  intitule VARCHAR(255) NOT NULL,
  etablissement VARCHAR(255),
  date_obtention DATE,
  niveau VARCHAR(50), -- 'sans_diplome', 'cap_bep', 'bac', 'bac+2', 'bac+3', 'bac+5', 'doctorat'
  domaine VARCHAR(100),
  document_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rh_diplomes_tenant ON rh_diplomes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_diplomes_membre ON rh_diplomes(membre_id);

-- =====================================================
-- PARTIE 3: Fonction pour générer numéro d'ordre automatique
-- =====================================================

CREATE OR REPLACE FUNCTION generate_numero_ordre_registre()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero_ordre_registre IS NULL THEN
    SELECT COALESCE(MAX(numero_ordre_registre), 0) + 1
    INTO NEW.numero_ordre_registre
    FROM rh_membres
    WHERE tenant_id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour auto-générer le numéro d'ordre à l'insertion
DROP TRIGGER IF EXISTS trg_rh_membres_numero_ordre ON rh_membres;
CREATE TRIGGER trg_rh_membres_numero_ordre
  BEFORE INSERT ON rh_membres
  FOR EACH ROW
  EXECUTE FUNCTION generate_numero_ordre_registre();

-- =====================================================
-- PARTIE 4: Commentaires pour documentation
-- =====================================================

COMMENT ON COLUMN rh_membres.sexe IS 'Sexe du salarié (M, F, Autre) - requis pour registre du personnel';
COMMENT ON COLUMN rh_membres.nationalite IS 'Nationalité du salarié - requis pour registre du personnel';
COMMENT ON COLUMN rh_membres.piece_identite_type IS 'Type de pièce d''identité: cni, passeport, titre_sejour';
COMMENT ON COLUMN rh_membres.type_contrat IS 'Type de contrat: cdi, cdd, alternance, stage, interim';
COMMENT ON COLUMN rh_membres.heures_hebdo IS 'Nombre d''heures de travail hebdomadaires (défaut: 35)';
COMMENT ON COLUMN rh_membres.heures_mensuelles IS 'Nombre d''heures mensuelles (défaut: 151.67 pour 35h)';
COMMENT ON COLUMN rh_membres.categorie_sociopro IS 'Catégorie socio-professionnelle: ouvrier, employe, technicien, agent_maitrise, cadre';
COMMENT ON COLUMN rh_membres.regime_ss IS 'Régime de sécurité sociale: general, alsace_moselle, agricole';
COMMENT ON COLUMN rh_membres.numero_ordre_registre IS 'Numéro d''ordre chronologique pour le registre unique du personnel';
COMMENT ON TABLE rh_diplomes IS 'Diplômes et certifications des salariés';
