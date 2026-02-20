/**
 * Migration CRM Segments - Création des tables segments et segment_clients
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
  console.log('🚀 Migration CRM Segments...\n');

  try {
    // Créer la table segments via SQL raw
    const { error: segmentsError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS segments (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          nom VARCHAR(100) NOT NULL,
          description TEXT,
          couleur VARCHAR(7) DEFAULT '#6366f1',
          icone VARCHAR(50) DEFAULT 'users',
          type VARCHAR(20) NOT NULL DEFAULT 'manuel',
          criteres JSONB DEFAULT '{}',
          nb_clients INTEGER DEFAULT 0,
          ca_total_centimes BIGINT DEFAULT 0,
          actif BOOLEAN DEFAULT true,
          ordre INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          created_by UUID,
          CONSTRAINT unique_segment_nom_tenant UNIQUE(tenant_id, nom)
        );

        CREATE TABLE IF NOT EXISTS segment_clients (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
          client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          source VARCHAR(20) DEFAULT 'manuel',
          added_at TIMESTAMPTZ DEFAULT NOW(),
          added_by UUID,
          notes TEXT,
          CONSTRAINT unique_client_segment UNIQUE(segment_id, client_id)
        );

        CREATE INDEX IF NOT EXISTS idx_segments_tenant ON segments(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_segments_actif ON segments(tenant_id, actif);
        CREATE INDEX IF NOT EXISTS idx_segment_clients_segment ON segment_clients(segment_id);
        CREATE INDEX IF NOT EXISTS idx_segment_clients_client ON segment_clients(client_id);
        CREATE INDEX IF NOT EXISTS idx_segment_clients_tenant ON segment_clients(tenant_id);
      `
    });

    if (segmentsError) {
      // RPC might not exist, try direct table creation test
      console.log('⚠️ RPC exec_sql non disponible, test direct...');

      // Test if table exists
      const { error: testError } = await supabase.from('segments').select('id').limit(1);

      if (testError && testError.message.includes('does not exist')) {
        console.log('❌ Tables non créées. Exécutez la migration SQL manuellement:');
        console.log('   Via Supabase Dashboard > SQL Editor');
        console.log('   Fichier: backend/src/migrations/005_crm_segments.sql');
        console.log('\n   OU utilisez la commande Supabase CLI:');
        console.log('   supabase db push');
        return;
      } else if (!testError) {
        console.log('✅ Table segments existe déjà');
      }
    } else {
      console.log('✅ Tables créées via RPC');
    }

    // Vérifier
    const { data: segments, error: checkError } = await supabase
      .from('segments')
      .select('id')
      .limit(1);

    if (checkError) {
      console.log('❌ Erreur vérification:', checkError.message);
    } else {
      console.log('✅ Table segments accessible');
      console.log(`   ${segments?.length || 0} segments existants`);
    }

    console.log('\n🎉 Migration terminée!');

  } catch (error) {
    console.error('❌ Exception:', error.message);
  }
}

migrate();
