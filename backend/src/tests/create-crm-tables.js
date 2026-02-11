import '../config/env.js';

console.log('=== CREATION TABLES CRM VIA API ===\n');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Essayer via l'API SQL Management
const sqlQueries = [
  // Table tags
  `CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    nom TEXT NOT NULL,
    couleur TEXT DEFAULT '#3B82F6',
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, nom)
  )`,

  // Index tags
  `CREATE INDEX IF NOT EXISTS idx_tags_tenant ON tags(tenant_id)`,

  // Table segments_clients
  `CREATE TABLE IF NOT EXISTS segments_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    nom TEXT NOT NULL,
    description TEXT,
    criteres JSONB NOT NULL DEFAULT '{}',
    auto_update BOOLEAN DEFAULT true,
    nb_clients INTEGER DEFAULT 0,
    derniere_mise_a_jour TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,

  // Index segments
  `CREATE INDEX IF NOT EXISTS idx_segments_tenant ON segments_clients(tenant_id)`,

  // Table client_tags
  `CREATE TABLE IF NOT EXISTS client_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL,
    tag_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(client_id, tag_id)
  )`,

  // Index client_tags
  `CREATE INDEX IF NOT EXISTS idx_client_tags_client ON client_tags(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_client_tags_tag ON client_tags(tag_id)`,

  // Colonnes clients
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS ca_total DECIMAL(10,2) DEFAULT 0`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS nb_rdv_total INTEGER DEFAULT 0`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS derniere_visite DATE`,
  `ALTER TABLE clients ADD COLUMN IF NOT EXISTS score_engagement INTEGER DEFAULT 0`,
];

// Utiliser l'API REST de Supabase pour les requetes SQL
async function executeSQL(sql) {
  // Supabase n'a pas d'endpoint SQL direct dans l'API REST standard
  // On doit utiliser l'API Management ou la connection directe

  // Essayons via l'API Management (si disponible)
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  return response;
}

// Test si on peut executer du SQL
console.log('Test connexion API...');

const testResponse = await fetch(`${SUPABASE_URL}/rest/v1/`, {
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
  },
});

if (testResponse.ok) {
  console.log('[OK] Connexion API etablie\n');
} else {
  console.log('[FAIL] Connexion API echouee\n');
}

// Afficher les instructions manuelles
console.log('='.repeat(60));
console.log('INSTRUCTIONS MANUELLES');
console.log('='.repeat(60));
console.log('');
console.log('Les tables CRM doivent etre creees dans Supabase.');
console.log('');
console.log('1. Allez dans votre dashboard Supabase');
console.log('2. Cliquez sur "SQL Editor"');
console.log('3. Copiez-collez le SQL suivant:');
console.log('');
console.log('-'.repeat(60));
console.log(`
-- Tables CRM Segmentation
-- Executez ce script dans Supabase SQL Editor

-- Table tags
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  nom TEXT NOT NULL,
  couleur TEXT DEFAULT '#3B82F6',
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, nom)
);

CREATE INDEX IF NOT EXISTS idx_tags_tenant ON tags(tenant_id);

-- Table segments_clients
CREATE TABLE IF NOT EXISTS segments_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  nom TEXT NOT NULL,
  description TEXT,
  criteres JSONB NOT NULL DEFAULT '{}',
  auto_update BOOLEAN DEFAULT true,
  nb_clients INTEGER DEFAULT 0,
  derniere_mise_a_jour TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segments_tenant ON segments_clients(tenant_id);

-- Table client_tags (liaison many-to-many)
CREATE TABLE IF NOT EXISTS client_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(client_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_client_tags_client ON client_tags(client_id);
CREATE INDEX IF NOT EXISTS idx_client_tags_tag ON client_tags(tag_id);

-- Colonnes analytics clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ca_total DECIMAL(10,2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS nb_rdv_total INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS derniere_visite DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS score_engagement INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_clients_ca_total ON clients(tenant_id, ca_total);
CREATE INDEX IF NOT EXISTS idx_clients_score ON clients(tenant_id, score_engagement);
`);
console.log('-'.repeat(60));
console.log('');
console.log('4. Cliquez sur "Run" pour executer');
console.log('5. Relancez les tests: node src/tests/test-crm-segmentation.js');
console.log('');
