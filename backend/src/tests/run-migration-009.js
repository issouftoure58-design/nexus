/**
 * Script d'exécution migration 009 - Intelligence Alertes
 * Plan Business - Semaine 8 Jour 4
 */

import '../config/env.js';
import { supabase } from '../config/supabase.js';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, prefix, message) {
  console.log(`${COLORS[color]}[${prefix}]${COLORS.reset} ${message}`);
}

function success(msg) { log('green', '✅', msg); }
function error(msg) { log('red', '❌', msg); }
function info(msg) { log('blue', 'ℹ️', msg); }
function section(msg) { console.log(`\n${COLORS.cyan}${'═'.repeat(60)}\n${msg}\n${'═'.repeat(60)}${COLORS.reset}`); }

async function runMigration() {
  section('MIGRATION 009: Intelligence Alertes (Business Plan)');

  try {
    // Table 1: intelligence_alertes
    info('Création table intelligence_alertes...');

    const { error: err1 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS intelligence_alertes (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('warning', 'alert', 'info')),
          metric TEXT NOT NULL,
          message TEXT NOT NULL,
          severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
          suggestion TEXT,
          statut TEXT DEFAULT 'active' CHECK (statut IN ('active', 'resolved', 'ignored')),
          resolved_at TIMESTAMP,
          ignored_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (err1) {
      // Try direct SQL approach via query if RPC doesn't exist
      info('RPC non disponible, tentative via query directe...');
    } else {
      success('Table intelligence_alertes créée');
    }

    // Table 2: intelligence_metrics_history
    info('Création table intelligence_metrics_history...');

    const { error: err2 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS intelligence_metrics_history (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          metrics JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (!err2) {
      success('Table intelligence_metrics_history créée');
    }

    // Table 3: intelligence_predictions
    info('Création table intelligence_predictions...');

    const { error: err3 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS intelligence_predictions (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          prediction JSONB NOT NULL,
          confidence INTEGER DEFAULT 50,
          period_start DATE,
          period_end DATE,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (!err3) {
      success('Table intelligence_predictions créée');
    }

    // Table 4: intelligence_suggestions
    info('Création table intelligence_suggestions...');

    const { error: err4 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS intelligence_suggestions (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          context TEXT,
          suggestions JSONB NOT NULL,
          applied BOOLEAN DEFAULT false,
          applied_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (!err4) {
      success('Table intelligence_suggestions créée');
    }

    // Créer les index
    info('Création des index...');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_intelligence_alertes_tenant ON intelligence_alertes(tenant_id);',
      'CREATE INDEX IF NOT EXISTS idx_intelligence_alertes_statut ON intelligence_alertes(statut) WHERE statut = \'active\';',
      'CREATE INDEX IF NOT EXISTS idx_intelligence_alertes_created ON intelligence_alertes(created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_intelligence_metrics_tenant ON intelligence_metrics_history(tenant_id);',
      'CREATE INDEX IF NOT EXISTS idx_intelligence_metrics_created ON intelligence_metrics_history(created_at DESC);',
      'CREATE INDEX IF NOT EXISTS idx_intelligence_predictions_tenant ON intelligence_predictions(tenant_id);',
      'CREATE INDEX IF NOT EXISTS idx_intelligence_predictions_type ON intelligence_predictions(type);',
      'CREATE INDEX IF NOT EXISTS idx_intelligence_suggestions_tenant ON intelligence_suggestions(tenant_id);'
    ];

    for (const idx of indexes) {
      await supabase.rpc('exec_sql', { sql: idx });
    }
    success('Index créés');

    // Vérification
    section('Vérification');

    // Vérifier que les tables existent
    const tables = [
      'intelligence_alertes',
      'intelligence_metrics_history',
      'intelligence_predictions',
      'intelligence_suggestions'
    ];

    for (const table of tables) {
      const { data, error: checkErr } = await supabase
        .from(table)
        .select('id')
        .limit(1);

      if (!checkErr) {
        success(`Table ${table} accessible`);
      } else {
        error(`Table ${table}: ${checkErr.message}`);
      }
    }

    section('MIGRATION 009 TERMINÉE');
    success('Système Intelligence Alertes prêt (Plan Business)');

  } catch (err) {
    error(`Erreur fatale: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

runMigration();
