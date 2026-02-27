#!/usr/bin/env node
/**
 * Execute Migration 029: Modèle Générique NEXUS
 * Crée les tables pour le système de ressources et prestations génériques
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function checkTableExists(tableName) {
  const { error } = await supabase.from(tableName).select('id').limit(1);
  return !error || !error.message.includes('does not exist');
}

async function executeMigration() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     MIGRATION 029: Modèle Générique NEXUS                     ║');
  console.log('║     Ressources + Prestations configurables                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Vérifier si les tables existent déjà
  const tables = ['types_ressources', 'ressources', 'prestations', 'prestation_ressources'];

  for (const table of tables) {
    const exists = await checkTableExists(table);
    if (exists) {
      console.log(`✅ Table ${table} existe déjà`);
    } else {
      console.log(`📋 Table ${table} à créer`);
    }
  }

  // Lire le fichier SQL
  const sqlPath = path.join(__dirname, '../migrations/029_modele_generique.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('\n📝 INSTRUCTIONS:');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('1. Aller sur: https://supabase.com/dashboard');
  console.log('2. Sélectionner le projet NEXUS');
  console.log('3. Aller dans SQL Editor');
  console.log('4. Copier/coller le contenu du fichier:');
  console.log(`   ${sqlPath}`);
  console.log('5. Exécuter le SQL\n');

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Ou exécuter directement via psql si disponible.\n');

  // Afficher un aperçu du SQL
  console.log('📄 Aperçu du SQL (premières lignes):');
  console.log('───────────────────────────────────────────────────────────────');
  const lines = sql.split('\n').slice(0, 30);
  lines.forEach(line => console.log(line));
  console.log('... (voir fichier complet pour la suite)');
  console.log('───────────────────────────────────────────────────────────────\n');
}

executeMigration().catch(console.error);
