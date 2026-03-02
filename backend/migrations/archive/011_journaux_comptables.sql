-- Migration 011: Structure des journaux comptables

-- Types de journaux
CREATE TABLE IF NOT EXISTS journaux_comptables (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  code VARCHAR(5) NOT NULL, -- BQ, VT, AC, PA, OD, AN
  libelle VARCHAR(100) NOT NULL,
  description TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

-- Écritures comptables
CREATE TABLE IF NOT EXISTS ecritures_comptables (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  journal_code VARCHAR(5) NOT NULL, -- BQ, VT, AC, PA, OD
  date_ecriture DATE NOT NULL,
  numero_piece VARCHAR(50), -- Référence (n° facture, n° dépense, etc.)
  compte_numero VARCHAR(10) NOT NULL, -- 411, 401, 512, 601, etc.
  compte_libelle VARCHAR(100),
  libelle TEXT NOT NULL,
  debit INTEGER DEFAULT 0, -- en centimes
  credit INTEGER DEFAULT 0, -- en centimes
  lettrage VARCHAR(10), -- Pour le pointage
  date_lettrage DATE,
  -- Liens vers documents source
  facture_id INTEGER,
  depense_id INTEGER,
  paie_journal_id INTEGER,
  -- Métadonnées
  exercice INTEGER, -- Année comptable
  periode VARCHAR(7), -- YYYY-MM
  valide BOOLEAN DEFAULT false, -- Écriture validée/clôturée
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_ecritures_tenant ON ecritures_comptables(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ecritures_journal ON ecritures_comptables(tenant_id, journal_code);
CREATE INDEX IF NOT EXISTS idx_ecritures_date ON ecritures_comptables(tenant_id, date_ecriture);
CREATE INDEX IF NOT EXISTS idx_ecritures_compte ON ecritures_comptables(tenant_id, compte_numero);
CREATE INDEX IF NOT EXISTS idx_ecritures_periode ON ecritures_comptables(tenant_id, periode);
CREATE INDEX IF NOT EXISTS idx_ecritures_facture ON ecritures_comptables(facture_id) WHERE facture_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ecritures_depense ON ecritures_comptables(depense_id) WHERE depense_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ecritures_lettrage ON ecritures_comptables(tenant_id, compte_numero, lettrage) WHERE lettrage IS NOT NULL;

-- Insérer les journaux par défaut pour les tenants existants
-- (On le fera via le code au premier accès)

-- Plan comptable simplifié (référence)
CREATE TABLE IF NOT EXISTS plan_comptable (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  numero VARCHAR(10) NOT NULL,
  libelle VARCHAR(100) NOT NULL,
  classe INTEGER, -- 1-7
  type VARCHAR(20), -- actif, passif, charge, produit
  actif BOOLEAN DEFAULT true,
  UNIQUE(tenant_id, numero)
);

-- Insérer plan comptable de base
INSERT INTO plan_comptable (tenant_id, numero, libelle, classe, type) VALUES
  ('__default__', '101', 'Capital', 1, 'passif'),
  ('__default__', '164', 'Emprunts', 1, 'passif'),
  ('__default__', '21', 'Immobilisations corporelles', 2, 'actif'),
  ('__default__', '28', 'Amortissements', 2, 'actif'),
  ('__default__', '37', 'Stocks', 3, 'actif'),
  ('__default__', '401', 'Fournisseurs', 4, 'passif'),
  ('__default__', '411', 'Clients', 4, 'actif'),
  ('__default__', '421', 'Personnel - Rémunérations dues', 4, 'passif'),
  ('__default__', '431', 'Sécurité sociale', 4, 'passif'),
  ('__default__', '437', 'Autres organismes sociaux', 4, 'passif'),
  ('__default__', '44566', 'TVA déductible', 4, 'actif'),
  ('__default__', '44571', 'TVA collectée', 4, 'passif'),
  ('__default__', '512', 'Banque', 5, 'actif'),
  ('__default__', '530', 'Caisse', 5, 'actif'),
  ('__default__', '601', 'Achats fournitures', 6, 'charge'),
  ('__default__', '606', 'Électricité/Eau', 6, 'charge'),
  ('__default__', '613', 'Loyers', 6, 'charge'),
  ('__default__', '616', 'Assurances', 6, 'charge'),
  ('__default__', '622', 'Honoraires', 6, 'charge'),
  ('__default__', '623', 'Publicité', 6, 'charge'),
  ('__default__', '625', 'Déplacements', 6, 'charge'),
  ('__default__', '626', 'Télécom/Internet', 6, 'charge'),
  ('__default__', '627', 'Frais bancaires', 6, 'charge'),
  ('__default__', '641', 'Rémunérations personnel', 6, 'charge'),
  ('__default__', '645', 'Charges sociales', 6, 'charge'),
  ('__default__', '658', 'Charges diverses', 6, 'charge'),
  ('__default__', '706', 'Prestations de services', 7, 'produit'),
  ('__default__', '707', 'Ventes marchandises', 7, 'produit'),
  ('__default__', '758', 'Produits divers', 7, 'produit')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE journaux_comptables IS 'Journaux comptables: BQ, VT, AC, PA, OD';
COMMENT ON TABLE ecritures_comptables IS 'Écritures comptables liées aux journaux';
COMMENT ON TABLE plan_comptable IS 'Plan comptable de référence';
