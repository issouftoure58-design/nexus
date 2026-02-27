-- Migration 022: Tables paramètres DSN, modèles documents et documents générés
-- Date: 2026-02-23
-- Description: Infrastructure pour la DSN automatisée et la génération de documents RH

-- =====================================================
-- PARTIE 1: Paramètres DSN par tenant
-- =====================================================

CREATE TABLE IF NOT EXISTS rh_dsn_parametres (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT UNIQUE NOT NULL,

  -- Entreprise
  siren VARCHAR(9),
  raison_sociale VARCHAR(255),
  adresse_siege TEXT,
  code_postal_siege VARCHAR(5),
  ville_siege VARCHAR(100),

  -- Établissement (peut être différent du siège)
  siret VARCHAR(14),
  nic VARCHAR(5), -- 5 derniers chiffres du SIRET
  code_naf VARCHAR(5),
  effectif_moyen INTEGER,
  adresse_etablissement TEXT,
  code_postal_etablissement VARCHAR(5),
  ville_etablissement VARCHAR(100),

  -- Contact DSN
  contact_nom VARCHAR(255),
  contact_email VARCHAR(255),
  contact_tel VARCHAR(20),

  -- Paramètres techniques
  logiciel_paie VARCHAR(100) DEFAULT 'NEXUS SIRH',
  version_norme VARCHAR(20) DEFAULT 'P26V01',
  fraction VARCHAR(2) DEFAULT '11', -- 11 = mensuelle normale

  -- Organismes sociaux
  urssaf_code VARCHAR(10),
  caisse_retraite_code VARCHAR(10),
  caisse_retraite_nom VARCHAR(100),
  prevoyance_code VARCHAR(10),
  prevoyance_nom VARCHAR(100),
  mutuelle_code VARCHAR(10),
  mutuelle_nom VARCHAR(100),

  -- Convention collective
  idcc VARCHAR(4), -- Identifiant convention collective nationale
  convention_libelle VARCHAR(255),

  -- Dates importantes
  date_creation_etablissement DATE,
  date_premiere_embauche DATE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rh_dsn_tenant ON rh_dsn_parametres(tenant_id);

-- =====================================================
-- PARTIE 2: Historique des DSN générées
-- =====================================================

CREATE TABLE IF NOT EXISTS rh_dsn_historique (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  periode VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  type_declaration VARCHAR(20) NOT NULL, -- 'mensuelle', 'evenementielle', 'annule_remplace'
  nature_envoi VARCHAR(10) DEFAULT '01', -- 01=normale, 02=test

  -- Contenu
  fichier_url TEXT, -- URL du fichier .dsn stocké
  nb_salaries INTEGER,
  total_brut INTEGER, -- en centimes
  total_cotisations INTEGER, -- en centimes

  -- Statut
  statut VARCHAR(20) DEFAULT 'genere', -- 'genere', 'envoye', 'accepte', 'rejete'
  date_envoi TIMESTAMP,
  date_retour TIMESTAMP,
  message_retour TEXT,

  -- Traçabilité
  genere_par INTEGER REFERENCES rh_membres(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rh_dsn_hist_tenant ON rh_dsn_historique(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_dsn_hist_periode ON rh_dsn_historique(periode);

-- =====================================================
-- PARTIE 3: Modèles de documents RH
-- =====================================================

CREATE TABLE IF NOT EXISTS rh_documents_modeles (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'dpae', 'contrat_cdi', 'contrat_cdd', 'avenant', 'certificat_travail', 'attestation_employeur', 'solde_tout_compte'
  nom VARCHAR(255) NOT NULL,
  description TEXT,
  contenu_html TEXT NOT NULL, -- template avec variables {{nom}}, {{date_embauche}}, etc.
  variables JSONB, -- liste des variables disponibles avec description
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT rh_doc_modele_unique UNIQUE(tenant_id, type)
);

CREATE INDEX IF NOT EXISTS idx_rh_doc_modeles_tenant ON rh_documents_modeles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_doc_modeles_type ON rh_documents_modeles(type);

-- =====================================================
-- PARTIE 4: Documents RH générés
-- =====================================================

CREATE TABLE IF NOT EXISTS rh_documents (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  membre_id INTEGER REFERENCES rh_membres(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  titre VARCHAR(255),

  -- Fichier
  fichier_url TEXT, -- PDF stocké (Supabase Storage)
  taille_octets INTEGER,

  -- Traçabilité
  date_generation TIMESTAMP DEFAULT NOW(),
  genere_par INTEGER REFERENCES rh_membres(id),

  -- Signature (optionnel)
  signe BOOLEAN DEFAULT false,
  date_signature TIMESTAMP,
  signature_url TEXT, -- image de la signature si applicable

  -- Envoi
  envoye BOOLEAN DEFAULT false,
  date_envoi TIMESTAMP,
  email_destinataire VARCHAR(255),

  -- Métadonnées spécifiques selon type
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rh_documents_tenant ON rh_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rh_documents_membre ON rh_documents(membre_id);
CREATE INDEX IF NOT EXISTS idx_rh_documents_type ON rh_documents(type);

-- =====================================================
-- PARTIE 5: Modèles par défaut
-- =====================================================

-- Insérer les modèles par défaut pour chaque nouveau tenant via trigger
CREATE OR REPLACE FUNCTION creer_modeles_documents_defaut()
RETURNS TRIGGER AS $$
BEGIN
  -- Modèle DPAE
  INSERT INTO rh_documents_modeles (tenant_id, type, nom, description, contenu_html, variables)
  VALUES (
    NEW.tenant_id,
    'dpae',
    'DPAE - Déclaration Préalable à l''Embauche',
    'Déclaration obligatoire à l''URSSAF avant embauche',
    '<h1>DPAE - Déclaration Préalable à l''Embauche</h1>
<h2>Employeur</h2>
<p>Raison sociale: {{raison_sociale}}</p>
<p>SIRET: {{siret}}</p>
<p>Adresse: {{adresse_employeur}}</p>
<h2>Salarié</h2>
<p>Nom: {{nom}} {{prenom}}</p>
<p>Date de naissance: {{date_naissance}}</p>
<p>Lieu de naissance: {{lieu_naissance}}</p>
<p>NIR: {{nir}}</p>
<p>Nationalité: {{nationalite}}</p>
<h2>Embauche</h2>
<p>Date d''embauche: {{date_embauche}}</p>
<p>Heure d''embauche: {{heure_embauche}}</p>
<p>Type de contrat: {{type_contrat}}</p>
<p>Durée période d''essai: {{duree_essai}}</p>',
    '["raison_sociale", "siret", "adresse_employeur", "nom", "prenom", "date_naissance", "lieu_naissance", "nir", "nationalite", "date_embauche", "heure_embauche", "type_contrat", "duree_essai"]'
  ) ON CONFLICT (tenant_id, type) DO NOTHING;

  -- Modèle Certificat de travail
  INSERT INTO rh_documents_modeles (tenant_id, type, nom, description, contenu_html, variables)
  VALUES (
    NEW.tenant_id,
    'certificat_travail',
    'Certificat de Travail',
    'Document obligatoire remis au salarié à la fin du contrat',
    '<h1>CERTIFICAT DE TRAVAIL</h1>
<p>Je soussigné(e), {{responsable_nom}}, agissant en qualité de {{responsable_fonction}}</p>
<p>Pour la société {{raison_sociale}}, SIRET {{siret}}</p>
<p>Sise {{adresse_employeur}}</p>
<br/>
<p>Certifie que M./Mme {{nom}} {{prenom}}</p>
<p>Né(e) le {{date_naissance}} à {{lieu_naissance}}</p>
<p>A été employé(e) dans notre établissement</p>
<p>Du {{date_embauche}} au {{date_sortie}}</p>
<p>En qualité de: {{poste}}</p>
<p>Classification: {{classification}}</p>
<br/>
<p>M./Mme {{nom}} quitte notre entreprise libre de tout engagement.</p>
<br/>
<p>Fait à {{ville}}, le {{date_document}}</p>
<p>Signature et cachet de l''employeur</p>',
    '["responsable_nom", "responsable_fonction", "raison_sociale", "siret", "adresse_employeur", "nom", "prenom", "date_naissance", "lieu_naissance", "date_embauche", "date_sortie", "poste", "classification", "ville", "date_document"]'
  ) ON CONFLICT (tenant_id, type) DO NOTHING;

  -- Modèle Solde de tout compte
  INSERT INTO rh_documents_modeles (tenant_id, type, nom, description, contenu_html, variables)
  VALUES (
    NEW.tenant_id,
    'solde_tout_compte',
    'Reçu pour Solde de Tout Compte',
    'Inventaire des sommes versées au salarié lors de la rupture',
    '<h1>REÇU POUR SOLDE DE TOUT COMPTE</h1>
<p>Je soussigné(e) {{nom}} {{prenom}}</p>
<p>Demeurant {{adresse_salarie}}</p>
<br/>
<p>Reconnais avoir reçu de {{raison_sociale}}</p>
<p>SIRET: {{siret}}</p>
<p>Sise {{adresse_employeur}}</p>
<br/>
<p>La somme de {{montant_total}} € net</p>
<p>En règlement de toutes les sommes qui m''étaient dues au titre de l''exécution et de la rupture de mon contrat de travail.</p>
<br/>
<h3>Détail des sommes versées:</h3>
<ul>
<li>Salaire: {{salaire}} €</li>
<li>Indemnité de congés payés: {{indemnite_cp}} €</li>
<li>Indemnité de préavis: {{indemnite_preavis}} €</li>
<li>Indemnité de licenciement/rupture: {{indemnite_rupture}} €</li>
<li>Primes: {{primes}} €</li>
</ul>
<br/>
<p>Ce reçu a été établi en double exemplaire.</p>
<p>Fait à {{ville}}, le {{date_document}}</p>
<br/>
<p>Signature du salarié (précédée de la mention "pour solde de tout compte")</p>
<p>_________________________________</p>
<br/>
<p style="font-size: 10px;">Ce reçu peut être dénoncé dans les six mois qui suivent sa signature.</p>',
    '["nom", "prenom", "adresse_salarie", "raison_sociale", "siret", "adresse_employeur", "montant_total", "salaire", "indemnite_cp", "indemnite_preavis", "indemnite_rupture", "primes", "ville", "date_document"]'
  ) ON CONFLICT (tenant_id, type) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Ce trigger sera appelé depuis l'application lors de la création du tenant
-- ou via un insert dans une table de configuration

-- =====================================================
-- PARTIE 6: Vue récapitulative documents par salarié
-- =====================================================

CREATE OR REPLACE VIEW v_rh_documents_salarie AS
SELECT
  d.id,
  d.tenant_id,
  d.membre_id,
  m.nom || ' ' || m.prenom as salarie_nom,
  d.type,
  d.titre,
  d.fichier_url,
  d.date_generation,
  d.signe,
  d.envoye,
  g.nom || ' ' || g.prenom as genere_par_nom
FROM rh_documents d
JOIN rh_membres m ON d.membre_id = m.id
LEFT JOIN rh_membres g ON d.genere_par = g.id;

-- =====================================================
-- PARTIE 7: Commentaires
-- =====================================================

COMMENT ON TABLE rh_dsn_parametres IS 'Paramètres entreprise/établissement pour la DSN';
COMMENT ON TABLE rh_dsn_historique IS 'Historique des fichiers DSN générés';
COMMENT ON TABLE rh_documents_modeles IS 'Modèles de documents RH personnalisables par tenant';
COMMENT ON TABLE rh_documents IS 'Documents RH générés pour chaque salarié';
COMMENT ON COLUMN rh_dsn_parametres.idcc IS 'Identifiant de la convention collective nationale (4 chiffres)';
COMMENT ON COLUMN rh_dsn_parametres.fraction IS 'Type de DSN: 11=mensuelle normale, 01=signalement';
