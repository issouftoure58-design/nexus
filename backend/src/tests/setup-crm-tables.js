import '../config/env.js';
import { supabase } from '../config/supabase.js';

console.log('=== SETUP TABLES CRM SEGMENTATION ===\n');

// 1. Creer table segments_clients
console.log('1. Creation table segments_clients...');
const { error: segmentsError } = await supabase.rpc('exec_sql', {
  sql: `
    CREATE TABLE IF NOT EXISTS segments_clients (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  `
});

if (segmentsError) {
  // Essayer insertion directe pour verifier si table existe
  const { error: testError } = await supabase
    .from('segments_clients')
    .select('id')
    .limit(1);

  if (testError && testError.code === '42P01') {
    console.log('  Table non trouvee. Creation manuelle requise dans Supabase.');
  } else if (!testError) {
    console.log('  Table existe deja.');
  } else {
    console.log('  Erreur:', testError.message);
  }
} else {
  console.log('  OK');
}

// 2. Creer table tags
console.log('\n2. Creation table tags...');
const { error: tagsTestError } = await supabase
  .from('tags')
  .select('id')
  .limit(1);

if (tagsTestError && tagsTestError.code === '42P01') {
  console.log('  Table tags non trouvee.');
} else if (!tagsTestError) {
  console.log('  Table tags existe deja.');
} else {
  console.log('  Statut:', tagsTestError.message);
}

// 3. Creer table client_tags
console.log('\n3. Verification table client_tags...');
const { error: clientTagsError } = await supabase
  .from('client_tags')
  .select('id')
  .limit(1);

if (clientTagsError && clientTagsError.code === '42P01') {
  console.log('  Table client_tags non trouvee.');
} else if (!clientTagsError) {
  console.log('  Table client_tags existe deja.');
} else {
  console.log('  Statut:', clientTagsError.message);
}

// 4. Verifier colonnes clients
console.log('\n4. Verification colonnes clients...');
const { data: clientSample, error: clientError } = await supabase
  .from('clients')
  .select('*')
  .limit(1);

if (clientError) {
  console.log('  Erreur:', clientError.message);
} else if (clientSample && clientSample.length > 0) {
  const cols = Object.keys(clientSample[0]);
  const neededCols = ['ca_total', 'nb_rdv_total', 'derniere_visite', 'score_engagement'];

  neededCols.forEach(col => {
    if (cols.includes(col)) {
      console.log(`  [OK] ${col} existe`);
    } else {
      console.log(`  [MANQUE] ${col}`);
    }
  });
} else {
  console.log('  Aucun client pour verifier colonnes');
}

console.log('\n=== FIN VERIFICATION ===');
console.log('\nSi des tables manquent, executez le SQL suivant dans Supabase:');
console.log('Fichier: backend/src/sql/crm-segmentation.sql');
