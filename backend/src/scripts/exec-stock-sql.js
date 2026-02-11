/**
 * Exécute le SQL pour créer les tables Stock
 */

import '../config/env.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'public' }
});

async function execSQL() {
  console.log('Création des tables Stock & Inventaire...\n');

  // Table produits
  console.log('1. Création table produits...');
  const { error: err1 } = await supabase.rpc('exec_sql', {
    query: `
      CREATE TABLE IF NOT EXISTS produits (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        reference TEXT NOT NULL,
        nom TEXT NOT NULL,
        description TEXT,
        categorie TEXT NOT NULL,
        stock_actuel INTEGER DEFAULT 0,
        stock_minimum INTEGER DEFAULT 0,
        stock_optimal INTEGER DEFAULT 0,
        unite TEXT NOT NULL DEFAULT 'piece',
        prix_achat_unitaire INTEGER DEFAULT 0,
        prix_vente_unitaire INTEGER DEFAULT 0,
        actif BOOLEAN DEFAULT true,
        fournisseur TEXT,
        emplacement TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(tenant_id, reference)
      );
    `
  });

  if (err1) {
    console.log('   Erreur RPC, tentative directe...');
    // Fallback: try direct query via REST
  }

  // Essayons via une autre méthode - insertion test
  const { data, error } = await supabase
    .from('produits')
    .select('id')
    .limit(1);

  if (error && error.code === '42P01') {
    console.log('   Table produits n\'existe pas.');
    console.log('\n⚠️  Les tables doivent être créées via le SQL Editor Supabase.');
    console.log('\nScript SQL à exécuter:\n');
    console.log('========================================');

    const sql = `
-- Table produits (articles en stock)
CREATE TABLE IF NOT EXISTS produits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  categorie TEXT NOT NULL,
  stock_actuel INTEGER DEFAULT 0,
  stock_minimum INTEGER DEFAULT 0,
  stock_optimal INTEGER DEFAULT 0,
  unite TEXT NOT NULL DEFAULT 'piece',
  prix_achat_unitaire INTEGER DEFAULT 0,
  prix_vente_unitaire INTEGER DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  fournisseur TEXT,
  emplacement TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_produits_tenant ON produits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_produits_categorie ON produits(tenant_id, categorie);
CREATE INDEX IF NOT EXISTS idx_produits_stock_bas ON produits(tenant_id, stock_actuel);
CREATE INDEX IF NOT EXISTS idx_produits_actif ON produits(tenant_id, actif);

-- Table mouvements stock
CREATE TABLE IF NOT EXISTS mouvements_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie', 'ajustement', 'perte', 'transfert')),
  quantite INTEGER NOT NULL,
  stock_avant INTEGER NOT NULL,
  stock_apres INTEGER NOT NULL,
  prix_unitaire INTEGER,
  reference_document TEXT,
  utilisateur_id UUID,
  motif TEXT,
  notes TEXT,
  date_mouvement TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mouvements_tenant ON mouvements_stock(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_produit ON mouvements_stock(produit_id);
CREATE INDEX IF NOT EXISTS idx_mouvements_type ON mouvements_stock(type);
CREATE INDEX IF NOT EXISTS idx_mouvements_date ON mouvements_stock(date_mouvement);

-- Table inventaires
CREATE TABLE IF NOT EXISTS inventaires (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  date_inventaire DATE NOT NULL,
  statut TEXT NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'valide', 'annule')),
  lignes JSONB NOT NULL DEFAULT '[]',
  nb_produits INTEGER DEFAULT 0,
  ecarts_total INTEGER DEFAULT 0,
  valeur_ecarts_total INTEGER DEFAULT 0,
  realise_par UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  valide_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventaires_tenant ON inventaires(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventaires_statut ON inventaires(statut);
CREATE INDEX IF NOT EXISTS idx_inventaires_date ON inventaires(date_inventaire);

-- Table alertes stock
CREATE TABLE IF NOT EXISTS alertes_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  produit_id UUID NOT NULL REFERENCES produits(id) ON DELETE CASCADE,
  type_alerte TEXT NOT NULL CHECK (type_alerte IN ('stock_bas', 'stock_zero', 'peremption_proche')),
  niveau TEXT NOT NULL CHECK (niveau IN ('info', 'warning', 'urgent')),
  message TEXT NOT NULL,
  vue BOOLEAN DEFAULT false,
  resolue BOOLEAN DEFAULT false,
  date_resolution TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alertes_tenant ON alertes_stock(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alertes_produit ON alertes_stock(produit_id);
CREATE INDEX IF NOT EXISTS idx_alertes_resolue ON alertes_stock(resolue);
CREATE INDEX IF NOT EXISTS idx_alertes_niveau ON alertes_stock(niveau);
`;
    console.log(sql);
    console.log('========================================\n');
  } else if (error) {
    console.log('   Erreur:', error.message);
  } else {
    console.log('   ✓ Table produits existe');
  }
}

execSQL().catch(console.error);
