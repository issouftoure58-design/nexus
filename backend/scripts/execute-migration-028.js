#!/usr/bin/env node
/**
 * Execute Migration 028: Devis lignes multi-services
 * Uses Supabase SQL execution
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const MIGRATION_SQL = `
-- Migration 028: Devis avec lignes multiples
-- Permet d'avoir plusieurs services par devis

-- Table des lignes de devis (services sélectionnés)
CREATE TABLE IF NOT EXISTS devis_lignes (
  id SERIAL PRIMARY KEY,
  devis_id UUID NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  tenant_id VARCHAR(255) NOT NULL,

  -- Service
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  service_nom VARCHAR(255) NOT NULL,

  -- Quantité & Durée
  quantite INTEGER DEFAULT 1,
  duree_minutes INTEGER DEFAULT 60,

  -- Prix (en centimes)
  prix_unitaire INTEGER NOT NULL DEFAULT 0,
  prix_total INTEGER NOT NULL DEFAULT 0,

  -- Affectation (optionnel, rempli lors de l'exécution)
  membre_id INTEGER REFERENCES membres(id) ON DELETE SET NULL,
  reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devis_lignes_devis ON devis_lignes(devis_id);
CREATE INDEX IF NOT EXISTS idx_devis_lignes_tenant ON devis_lignes(tenant_id);

-- Commentaires
COMMENT ON TABLE devis_lignes IS 'Lignes de services pour les devis multi-services';
COMMENT ON COLUMN devis_lignes.membre_id IS 'Coiffeur assigné lors de l''exécution';
COMMENT ON COLUMN devis_lignes.reservation_id IS 'Réservation créée lors de l''exécution';

-- Ajouter colonnes manquantes sur devis si besoin
ALTER TABLE devis ADD COLUMN IF NOT EXISTS date_execution TIMESTAMPTZ;
`;

async function executeMigration() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     MIGRATION 028: Devis lignes multi-services                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    // Test if table already exists
    const { error: selectError } = await supabase.from('devis_lignes').select('id').limit(1);

    if (!selectError) {
      console.log('✅ Table devis_lignes existe déjà');
      return;
    }

    if (selectError && !selectError.message.includes('does not exist')) {
      console.log('✅ Table devis_lignes existe (autre erreur:', selectError.message, ')');
      return;
    }

    // Table doesn't exist, try RPC
    console.log('📋 Table devis_lignes n\'existe pas, création...\n');

    const { data, error } = await supabase.rpc('exec_sql', { sql: MIGRATION_SQL });

    if (error) {
      console.log('⚠️  RPC exec_sql non disponible');
      showManualInstructions();
    } else {
      console.log('✅ Migration exécutée via RPC');
    }

  } catch (err) {
    console.error('Erreur:', err.message);
    showManualInstructions();
  }
}

function showManualInstructions() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📝 INSTRUCTIONS MANUELLES:');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('1. Aller sur: https://supabase.com/dashboard');
  console.log('2. Sélectionner le projet NEXUS');
  console.log('3. Aller dans SQL Editor');
  console.log('4. Copier/coller le SQL ci-dessous et exécuter:\n');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log(MIGRATION_SQL);
  console.log('─────────────────────────────────────────────────────────────────\n');
}

executeMigration().catch(console.error);
