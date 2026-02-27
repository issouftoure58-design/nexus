-- ============================================
-- MIGRATION 029: Modèle Générique NEXUS
-- ============================================
-- Vision: Plateforme métier-agnostique
-- Un seul moteur, configuration par tenant
-- ============================================

-- ============================================
-- 1. TYPES DE RESSOURCES (configurable par tenant)
-- ============================================
-- Permet à chaque tenant de définir ses types :
-- Salon: "Coiffeur", Hôtel: "Chambre", "Agent ménage", Sécu: "Agent"

CREATE TABLE IF NOT EXISTS types_ressources (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,

  -- Identification
  code VARCHAR(50) NOT NULL,           -- 'coiffeur', 'agent', 'chambre', 'table'
  nom VARCHAR(100) NOT NULL,           -- 'Coiffeur', 'Agent de sécurité', 'Chambre'
  nom_pluriel VARCHAR(100),            -- 'Coiffeurs', 'Agents', 'Chambres'

  -- Catégorie
  categorie VARCHAR(20) NOT NULL DEFAULT 'humain', -- 'humain' ou 'physique'

  -- Configuration
  icone VARCHAR(50),                   -- 'user', 'bed', 'utensils'
  couleur VARCHAR(20),                 -- '#3B82F6'

  -- Capacité (pour ressources physiques)
  a_capacite BOOLEAN DEFAULT FALSE,    -- true pour tables, chambres
  capacite_defaut INTEGER DEFAULT 1,

  -- Multi-affectation
  multi_affectation BOOLEAN DEFAULT FALSE, -- true = plusieurs sur même event

  -- Actif
  actif BOOLEAN DEFAULT TRUE,
  ordre INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, code)
);

CREATE INDEX idx_types_ressources_tenant ON types_ressources(tenant_id);

COMMENT ON TABLE types_ressources IS 'Types de ressources configurables par tenant (coiffeur, agent, chambre, table...)';

-- ============================================
-- 2. RESSOURCES (les éléments planifiables)
-- ============================================
-- Remplace/étend la table membres pour être générique
-- Un coiffeur, un agent, une chambre, une table = une ressource

CREATE TABLE IF NOT EXISTS ressources (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  type_ressource_id INTEGER NOT NULL REFERENCES types_ressources(id),

  -- Identification
  code VARCHAR(50),                    -- 'CH201', 'T05', optionnel
  nom VARCHAR(255) NOT NULL,           -- 'Marie Dupont', 'Chambre 201', 'Table 5'

  -- Pour ressources humaines (lien optionnel avec membres existants)
  membre_id INTEGER REFERENCES membres(id) ON DELETE SET NULL,

  -- Capacité (pour physiques)
  capacite INTEGER DEFAULT 1,          -- 4 pour table de 4, 2 pour chambre double

  -- Catégorie/Type spécifique
  categorie VARCHAR(100),              -- 'senior', 'junior', 'suite', 'standard'

  -- Attributs libres (JSON)
  attributs JSONB DEFAULT '{}',        -- {"etage": 2, "vue_mer": true, "fumeur": false}

  -- Disponibilité
  actif BOOLEAN DEFAULT TRUE,

  -- Horaires (pour humains, optionnel)
  horaires_defaut JSONB,               -- {"lundi": {"debut": "09:00", "fin": "18:00"}, ...}

  -- Métadonnées
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ressources_tenant ON ressources(tenant_id);
CREATE INDEX idx_ressources_type ON ressources(type_ressource_id);
CREATE INDEX idx_ressources_membre ON ressources(membre_id);

COMMENT ON TABLE ressources IS 'Ressources planifiables génériques (humains ou physiques)';

-- ============================================
-- 3. PRESTATIONS (le cœur du système)
-- ============================================
-- Toute activité planifiée = une prestation
-- Générée depuis: devis, réservation, commande, direct

CREATE TABLE IF NOT EXISTS prestations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(255) NOT NULL,
  numero VARCHAR(50) NOT NULL,         -- 'PREST-2024-00001'

  -- Client
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  client_nom VARCHAR(255),             -- Dénormalisé pour affichage rapide
  client_telephone VARCHAR(50),
  client_email VARCHAR(255),

  -- Statut
  statut VARCHAR(20) NOT NULL DEFAULT 'planifiee',
  -- planifiee, confirmee, en_cours, terminee, facturee, annulee

  -- Planification
  date_debut DATE NOT NULL,
  heure_debut TIME NOT NULL,
  date_fin DATE,
  heure_fin TIME,
  duree_minutes INTEGER,

  -- Lieu
  lieu_type VARCHAR(20) DEFAULT 'etablissement', -- 'etablissement', 'domicile', 'exterieur'
  adresse TEXT,

  -- Montants (en centimes)
  montant_ht INTEGER DEFAULT 0,
  taux_tva DECIMAL(5,2) DEFAULT 20.00,
  montant_tva INTEGER DEFAULT 0,
  montant_ttc INTEGER DEFAULT 0,

  -- Source (traçabilité)
  source VARCHAR(20),                  -- 'devis', 'reservation', 'commande', 'direct'
  source_id VARCHAR(255),              -- UUID ou ID de la source

  -- Lien facture (une fois terminée)
  facture_id INTEGER REFERENCES factures(id) ON DELETE SET NULL,

  -- Métadonnées
  notes TEXT,
  notes_internes TEXT,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_prestations_tenant ON prestations(tenant_id);
CREATE INDEX idx_prestations_client ON prestations(client_id);
CREATE INDEX idx_prestations_date ON prestations(date_debut);
CREATE INDEX idx_prestations_statut ON prestations(statut);
CREATE INDEX idx_prestations_source ON prestations(source, source_id);

COMMENT ON TABLE prestations IS 'Prestations planifiées - cœur du système de planning';

-- ============================================
-- 4. PRESTATION_RESSOURCES (liaison N-N)
-- ============================================
-- Permet d'affecter plusieurs ressources à une prestation
-- Ex: 3 agents sur une mission, 1 coiffeur sur un RDV

CREATE TABLE IF NOT EXISTS prestation_ressources (
  id SERIAL PRIMARY KEY,
  prestation_id UUID NOT NULL REFERENCES prestations(id) ON DELETE CASCADE,
  ressource_id INTEGER NOT NULL REFERENCES ressources(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL,

  -- Rôle (optionnel)
  role VARCHAR(50),                    -- 'principal', 'assistant', 'superviseur'

  -- Horaires spécifiques (si différent de la prestation)
  heure_debut TIME,
  heure_fin TIME,

  -- Statut individuel
  statut VARCHAR(20) DEFAULT 'affecte', -- 'affecte', 'confirme', 'present', 'absent'

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(prestation_id, ressource_id)
);

CREATE INDEX idx_prest_ress_prestation ON prestation_ressources(prestation_id);
CREATE INDEX idx_prest_ress_ressource ON prestation_ressources(ressource_id);
CREATE INDEX idx_prest_ress_tenant ON prestation_ressources(tenant_id);

COMMENT ON TABLE prestation_ressources IS 'Affectation des ressources aux prestations (N-N)';

-- ============================================
-- 5. PRESTATION_LIGNES (détail des services/produits)
-- ============================================
-- Ce qui est vendu dans la prestation

CREATE TABLE IF NOT EXISTS prestation_lignes (
  id SERIAL PRIMARY KEY,
  prestation_id UUID NOT NULL REFERENCES prestations(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL,

  -- Service/Produit
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  designation VARCHAR(255) NOT NULL,   -- Nom du service/produit
  description TEXT,

  -- Quantité et durée
  quantite INTEGER DEFAULT 1,
  duree_minutes INTEGER,

  -- Prix (en centimes)
  prix_unitaire INTEGER NOT NULL DEFAULT 0,
  prix_total INTEGER NOT NULL DEFAULT 0,

  -- Ressource affectée à cette ligne (optionnel)
  ressource_id INTEGER REFERENCES ressources(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_prest_lignes_prestation ON prestation_lignes(prestation_id);
CREATE INDEX idx_prest_lignes_tenant ON prestation_lignes(tenant_id);

COMMENT ON TABLE prestation_lignes IS 'Lignes de détail des prestations (services/produits vendus)';

-- ============================================
-- 6. TYPES D'ÉVÉNEMENTS (configurable par tenant)
-- ============================================
-- Permet de nommer différemment selon le métier

CREATE TABLE IF NOT EXISTS types_evenements (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,

  code VARCHAR(50) NOT NULL,           -- 'rdv', 'intervention', 'sejour', 'reservation'
  nom VARCHAR(100) NOT NULL,           -- 'Rendez-vous', 'Intervention', 'Séjour'

  -- Configuration
  icone VARCHAR(50),
  couleur VARCHAR(20),

  -- Workflow
  statuts_possibles JSONB DEFAULT '["planifiee", "confirmee", "en_cours", "terminee", "annulee"]',

  -- Règles
  duree_defaut INTEGER DEFAULT 60,     -- minutes

  actif BOOLEAN DEFAULT TRUE,
  ordre INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, code)
);

CREATE INDEX idx_types_events_tenant ON types_evenements(tenant_id);

COMMENT ON TABLE types_evenements IS 'Types d événements configurables par tenant';

-- ============================================
-- 7. CONFIGURATION TENANT (métadonnées métier)
-- ============================================
-- Stocke la config spécifique au métier du tenant

-- Ajout colonne config_metier si pas existante
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS config_metier JSONB DEFAULT '{}';

COMMENT ON COLUMN tenants.config_metier IS 'Configuration métier du tenant (termes, workflows, options)';

-- Exemple de config_metier:
-- {
--   "secteur": "coiffure",
--   "termes": {
--     "ressource_principale": "Coiffeur",
--     "evenement_principal": "Rendez-vous",
--     "client": "Client"
--   },
--   "workflows": {
--     "auto_facture": true,
--     "confirmation_requise": false
--   }
-- }

-- ============================================
-- 8. VUES UTILES
-- ============================================

-- Vue planning unifié
CREATE OR REPLACE VIEW v_planning AS
SELECT
  p.id,
  p.tenant_id,
  p.numero,
  p.client_nom,
  p.statut,
  p.date_debut,
  p.heure_debut,
  p.date_fin,
  p.heure_fin,
  p.duree_minutes,
  p.montant_ttc,
  p.source,
  r.id as ressource_id,
  r.nom as ressource_nom,
  tr.nom as type_ressource,
  tr.categorie as ressource_categorie
FROM prestations p
LEFT JOIN prestation_ressources pr ON p.id = pr.prestation_id
LEFT JOIN ressources r ON pr.ressource_id = r.id
LEFT JOIN types_ressources tr ON r.type_ressource_id = tr.id
WHERE p.statut NOT IN ('annulee', 'facturee');

COMMENT ON VIEW v_planning IS 'Vue unifiée du planning avec ressources affectées';

-- ============================================
-- 9. FONCTION: Générer numéro prestation
-- ============================================

CREATE OR REPLACE FUNCTION generate_prestation_numero(p_tenant_id VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_year INTEGER;
  v_count INTEGER;
  v_numero VARCHAR;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW());

  SELECT COUNT(*) + 1 INTO v_count
  FROM prestations
  WHERE tenant_id = p_tenant_id
  AND EXTRACT(YEAR FROM created_at) = v_year;

  v_numero := 'PREST-' || v_year || '-' || LPAD(v_count::TEXT, 5, '0');

  RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. DONNÉES INITIALES TYPES PAR DÉFAUT
-- ============================================
-- Ces types seront copiés pour chaque nouveau tenant

-- Note: L'insertion des types par défaut se fera via le backend
-- lors de la création d'un tenant, selon son secteur d'activité

