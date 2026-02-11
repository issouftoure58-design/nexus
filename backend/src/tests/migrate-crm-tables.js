import '../config/env.js';

console.log('=== MIGRATION TABLES CRM SEGMENTATION ===\n');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Variables Supabase manquantes');
  process.exit(1);
}

// Fonction pour executer SQL via l'API REST
async function executeSql(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SQL Error: ${text}`);
  }

  return await response.json();
}

// Migration SQL par etapes
const migrations = [
  {
    name: 'Table segments_clients',
    sql: `
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
    `,
  },
  {
    name: 'Index segments_clients',
    sql: `CREATE INDEX IF NOT EXISTS idx_segments_tenant ON segments_clients(tenant_id);`,
  },
  {
    name: 'Table tags',
    sql: `
      CREATE TABLE IF NOT EXISTS tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id TEXT NOT NULL,
        nom TEXT NOT NULL,
        couleur TEXT DEFAULT '#3B82F6',
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(tenant_id, nom)
      );
    `,
  },
  {
    name: 'Index tags',
    sql: `CREATE INDEX IF NOT EXISTS idx_tags_tenant ON tags(tenant_id);`,
  },
  {
    name: 'Table client_tags',
    sql: `
      CREATE TABLE IF NOT EXISTS client_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL,
        tag_id UUID NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(client_id, tag_id)
      );
    `,
  },
  {
    name: 'Index client_tags client',
    sql: `CREATE INDEX IF NOT EXISTS idx_client_tags_client ON client_tags(client_id);`,
  },
  {
    name: 'Index client_tags tag',
    sql: `CREATE INDEX IF NOT EXISTS idx_client_tags_tag ON client_tags(tag_id);`,
  },
  {
    name: 'Colonne ca_total clients',
    sql: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS ca_total DECIMAL(10,2) DEFAULT 0;`,
  },
  {
    name: 'Colonne nb_rdv_total clients',
    sql: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS nb_rdv_total INTEGER DEFAULT 0;`,
  },
  {
    name: 'Colonne derniere_visite clients',
    sql: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS derniere_visite DATE;`,
  },
  {
    name: 'Colonne score_engagement clients',
    sql: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS score_engagement INTEGER DEFAULT 0;`,
  },
];

console.log('Execution des migrations...\n');

// Tester d'abord si exec_sql existe
try {
  await executeSql('SELECT 1;');
  console.log('[OK] Fonction exec_sql disponible\n');

  for (const migration of migrations) {
    try {
      await executeSql(migration.sql);
      console.log(`[OK] ${migration.name}`);
    } catch (err) {
      console.log(`[SKIP] ${migration.name}: ${err.message.substring(0, 50)}`);
    }
  }
} catch (err) {
  console.log('[INFO] Fonction exec_sql non disponible, utilisation methode alternative...\n');

  // Methode alternative: creer les tables via INSERT/SELECT pour verifier leur existence
  const { supabase } = await import('../config/supabase.js');

  // Test table segments_clients
  const { error: segErr } = await supabase.from('segments_clients').select('id').limit(1);
  if (segErr?.code === '42P01') {
    console.log('[MANQUE] Table segments_clients - Creer manuellement dans Supabase');
  } else {
    console.log('[OK] Table segments_clients existe');
  }

  // Test table tags
  const { error: tagErr } = await supabase.from('tags').select('id').limit(1);
  if (tagErr?.code === '42P01') {
    console.log('[MANQUE] Table tags - Creer manuellement dans Supabase');
  } else {
    console.log('[OK] Table tags existe');
  }

  // Test table client_tags
  const { error: ctErr } = await supabase.from('client_tags').select('id').limit(1);
  if (ctErr?.code === '42P01') {
    console.log('[MANQUE] Table client_tags - Creer manuellement dans Supabase');
  } else {
    console.log('[OK] Table client_tags existe');
  }

  console.log('\n=== INSTRUCTIONS MANUELLES ===');
  console.log('Allez dans Supabase Dashboard > SQL Editor');
  console.log('Executez le contenu du fichier:');
  console.log('  backend/src/sql/crm-segmentation.sql');
}

console.log('\n=== FIN MIGRATION ===');
