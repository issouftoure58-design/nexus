-- Migration 037: Menu Restaurant
-- Gestion des plats et menus du jour pour les restaurants

-- Table des catégories de plats
CREATE TABLE IF NOT EXISTS menu_categories (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  ordre INTEGER DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_cat_tenant ON menu_categories(tenant_id);

-- Table des plats
CREATE TABLE IF NOT EXISTS plats (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  categorie_id INTEGER REFERENCES menu_categories(id) ON DELETE SET NULL,

  -- Infos de base
  nom VARCHAR(255) NOT NULL,
  description TEXT,
  prix INTEGER NOT NULL DEFAULT 0, -- En centimes

  -- Options
  allergenes TEXT[], -- ['gluten', 'lactose', 'arachides', etc.]
  regime TEXT[], -- ['vegetarien', 'vegan', 'halal', 'casher', 'sans_gluten']

  -- Disponibilité
  disponible_midi BOOLEAN DEFAULT true,
  disponible_soir BOOLEAN DEFAULT true,
  plat_du_jour BOOLEAN DEFAULT false,

  -- Stock (optionnel)
  stock_limite BOOLEAN DEFAULT false,
  stock_quantite INTEGER DEFAULT 0,

  -- Médias
  image_url TEXT,

  -- Statut
  actif BOOLEAN DEFAULT true,
  ordre INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plats_tenant ON plats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_plats_categorie ON plats(categorie_id);
CREATE INDEX IF NOT EXISTS idx_plats_actif ON plats(tenant_id, actif);

-- Table du menu du jour
CREATE TABLE IF NOT EXISTS menu_du_jour (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  service VARCHAR(20) DEFAULT 'midi_soir', -- 'midi', 'soir', 'midi_soir'

  -- Formules
  formule_entree_plat INTEGER DEFAULT 0, -- Prix en centimes
  formule_plat_dessert INTEGER DEFAULT 0,
  formule_complete INTEGER DEFAULT 0, -- Entrée + Plat + Dessert

  -- Plats du menu
  entrees INTEGER[], -- IDs des plats
  plats INTEGER[],
  desserts INTEGER[],

  -- Notes
  notes TEXT,

  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(tenant_id, date, service)
);

CREATE INDEX IF NOT EXISTS idx_menu_jour_tenant ON menu_du_jour(tenant_id);
CREATE INDEX IF NOT EXISTS idx_menu_jour_date ON menu_du_jour(tenant_id, date);

-- Commentaires
COMMENT ON TABLE menu_categories IS 'Catégories de plats (Entrées, Plats, Desserts, Boissons...)';
COMMENT ON TABLE plats IS 'Catalogue des plats du restaurant';
COMMENT ON TABLE menu_du_jour IS 'Menu du jour avec formules et sélection de plats';
COMMENT ON COLUMN plats.allergenes IS 'Liste des allergènes présents';
COMMENT ON COLUMN plats.regime IS 'Régimes alimentaires compatibles';
