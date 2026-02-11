/**
 * Vérification setup modules
 */

import '../config/env.js';
import { supabase } from '../config/supabase.js';

async function check() {
  console.log('=== Vérification Setup Modules ===\n');

  // 1. Vérifier tenants avec modules_actifs
  const { data: tenants, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, name, modules_actifs')
    .in('id', ['fatshairafro', 'decoevent']);

  console.log('1. Tenants avec modules_actifs:');
  if (tenantErr) {
    console.log('   Erreur:', tenantErr.message);
  } else {
    tenants?.forEach(t => {
      console.log(`   - ${t.name}:`, t.modules_actifs ? Object.keys(t.modules_actifs).join(', ') : 'aucun');
    });
  }

  // 2. Vérifier table modules_disponibles
  console.log('\n2. Table modules_disponibles:');
  const { data: modules, error: modErr } = await supabase
    .from('modules_disponibles')
    .select('id')
    .limit(1);

  if (modErr) {
    console.log('   ❌ Table non trouvée:', modErr.message);
    console.log('\n   📝 SQL à exécuter dans Supabase Dashboard:');
    console.log('   -----------------------------------------');
    console.log(`
CREATE TABLE IF NOT EXISTS modules_disponibles (
  id VARCHAR(50) PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  categorie VARCHAR(50) NOT NULL,
  prix_mensuel INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  requis BOOLEAN DEFAULT false,
  dependances JSONB DEFAULT '[]'::jsonb,
  features JSONB DEFAULT '[]'::jsonb,
  ordre INTEGER DEFAULT 0,
  icone VARCHAR(50) DEFAULT 'Package',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modules_categorie ON modules_disponibles(categorie);
CREATE INDEX IF NOT EXISTS idx_modules_actif ON modules_disponibles(actif);
    `);
  } else {
    console.log('   ✅ Table existe');

    const { count } = await supabase
      .from('modules_disponibles')
      .select('*', { count: 'exact', head: true });

    console.log(`   Nombre de modules: ${count || 0}`);
  }
}

check().catch(console.error);
