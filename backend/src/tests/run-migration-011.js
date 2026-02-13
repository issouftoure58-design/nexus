/**
 * Script d'execution migration 011 - RH Equipe
 * Plan Business - Semaine 8 Jour 7
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

function success(msg) { log('green', 'OK', msg); }
function error(msg) { log('red', 'ERR', msg); }
function info(msg) { log('blue', 'INFO', msg); }
function section(msg) { console.log(`\n${COLORS.cyan}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${COLORS.reset}`); }

async function runMigration() {
  section('MIGRATION 011: RH Equipe (Business Plan)');

  try {
    // Table 1: rh_membres
    info('Creation table rh_membres...');

    const { error: err1 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS rh_membres (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          nom TEXT NOT NULL,
          prenom TEXT NOT NULL,
          email TEXT,
          telephone TEXT,
          role TEXT NOT NULL,
          statut TEXT DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'conge')),
          date_embauche DATE,
          notes TEXT,
          avatar_url TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (err1) {
      info('RPC exec_sql non disponible, tentative via from()...');
      // Fallback - essayer insert pour verifier si table existe
      const { error: checkErr } = await supabase
        .from('rh_membres')
        .select('id')
        .limit(1);

      if (checkErr && checkErr.code === '42P01') {
        error('Table rh_membres n\'existe pas et RPC indisponible');
        error('Veuillez executer le SQL manuellement dans Supabase Dashboard');
      } else if (!checkErr) {
        success('Table rh_membres existe deja');
      }
    } else {
      success('Table rh_membres creee');
    }

    // Table 2: rh_performances
    info('Creation table rh_performances...');

    const { error: err2 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS rh_performances (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          membre_id INTEGER NOT NULL REFERENCES rh_membres(id) ON DELETE CASCADE,
          periode TEXT NOT NULL,
          ca_genere DECIMAL(10,2) DEFAULT 0,
          rdv_realises INTEGER DEFAULT 0,
          taux_conversion DECIMAL(5,2) DEFAULT 0,
          clients_acquis INTEGER DEFAULT 0,
          note_satisfaction DECIMAL(3,2) DEFAULT 0,
          objectif_atteint BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (!err2) {
      success('Table rh_performances creee');
    } else {
      const { error: checkErr } = await supabase.from('rh_performances').select('id').limit(1);
      if (!checkErr) success('Table rh_performances existe deja');
    }

    // Table 3: rh_absences
    info('Creation table rh_absences...');

    const { error: err3 } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS rh_absences (
          id SERIAL PRIMARY KEY,
          tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          membre_id INTEGER NOT NULL REFERENCES rh_membres(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK (type IN ('conge', 'maladie', 'formation', 'autre')),
          date_debut DATE NOT NULL,
          date_fin DATE NOT NULL,
          statut TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente', 'approuve', 'refuse')),
          motif TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `
    });

    if (!err3) {
      success('Table rh_absences creee');
    } else {
      const { error: checkErr } = await supabase.from('rh_absences').select('id').limit(1);
      if (!checkErr) success('Table rh_absences existe deja');
    }

    // Creer les index
    info('Creation des index...');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_rh_membres_tenant ON rh_membres(tenant_id);',
      'CREATE INDEX IF NOT EXISTS idx_rh_membres_statut ON rh_membres(statut) WHERE statut = \'actif\';',
      'CREATE INDEX IF NOT EXISTS idx_rh_membres_role ON rh_membres(role);',
      'CREATE INDEX IF NOT EXISTS idx_rh_performances_tenant ON rh_performances(tenant_id);',
      'CREATE INDEX IF NOT EXISTS idx_rh_performances_membre ON rh_performances(membre_id);',
      'CREATE INDEX IF NOT EXISTS idx_rh_performances_periode ON rh_performances(periode DESC);',
      'CREATE INDEX IF NOT EXISTS idx_rh_absences_tenant ON rh_absences(tenant_id);',
      'CREATE INDEX IF NOT EXISTS idx_rh_absences_membre ON rh_absences(membre_id);',
      'CREATE INDEX IF NOT EXISTS idx_rh_absences_dates ON rh_absences(date_debut, date_fin);'
    ];

    for (const idx of indexes) {
      await supabase.rpc('exec_sql', { sql: idx });
    }
    success('Index crees');

    // Creer le trigger updated_at
    info('Creation trigger updated_at...');

    await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION update_rh_membres_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `
    });

    await supabase.rpc('exec_sql', {
      sql: `
        DROP TRIGGER IF EXISTS trigger_rh_membres_updated_at ON rh_membres;
        CREATE TRIGGER trigger_rh_membres_updated_at
          BEFORE UPDATE ON rh_membres
          FOR EACH ROW
          EXECUTE FUNCTION update_rh_membres_updated_at();
      `
    });
    success('Trigger updated_at cree');

    // Verification
    section('Verification');

    const tables = ['rh_membres', 'rh_performances', 'rh_absences'];

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

    section('MIGRATION 011 TERMINEE');
    success('Systeme RH Equipe pret (Plan Business)');

  } catch (err) {
    error(`Erreur fatale: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

runMigration();
