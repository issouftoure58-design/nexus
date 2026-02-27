/**
 * Script d'exécution de migrations SQL
 * Usage: node scripts/run-migration.js <fichier.sql>
 */

import '../src/config/env.js';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Créer le client Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration(filename) {
  const filepath = resolve(__dirname, '../migrations', filename);

  console.log(`\n📁 Lecture de ${filename}...`);

  let sql;
  try {
    sql = readFileSync(filepath, 'utf-8');
  } catch (err) {
    console.error(`❌ Fichier non trouvé: ${filepath}`);
    process.exit(1);
  }

  console.log(`📝 ${sql.split('\n').length} lignes de SQL`);
  console.log(`🚀 Exécution de la migration...`);

  // Exécuter le SQL via rpc ou directement
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    // Si la fonction RPC n'existe pas, on essaie statement par statement
    if (error.message.includes('function') || error.code === '42883') {
      console.log('⚠️  RPC exec_sql non disponible, exécution statement par statement...');

      // Découper en statements (simpliste, ne gère pas tous les cas)
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      let success = 0;
      let errors = 0;

      for (const statement of statements) {
        // Skip les commentaires
        if (statement.startsWith('--') || statement.startsWith('/*')) continue;

        try {
          // Pour CREATE TABLE, on utilise une requête select pour tester
          // Mais en réalité on ne peut pas exécuter DDL via le client standard
          // On doit utiliser le SQL Editor de Supabase Dashboard
          console.log(`  → ${statement.slice(0, 60)}...`);
          success++;
        } catch (e) {
          console.error(`  ❌ Erreur: ${e.message}`);
          errors++;
        }
      }

      console.log(`\n⚠️  Le client Supabase ne peut pas exécuter du DDL (CREATE TABLE, etc.)`);
      console.log(`📋 Copiez le contenu SQL suivant dans le SQL Editor de Supabase Dashboard:\n`);
      console.log('='.repeat(80));
      console.log(sql);
      console.log('='.repeat(80));
      console.log(`\n🔗 Ouvrez: https://supabase.com/dashboard > Votre projet > SQL Editor`);
      return;
    }

    console.error(`❌ Erreur d'exécution:`, error.message);
    process.exit(1);
  }

  console.log(`✅ Migration ${filename} exécutée avec succès!`);
}

// Point d'entrée
const args = process.argv.slice(2);

if (args.length === 0) {
  // Lister les migrations disponibles
  console.log('📋 Migrations disponibles:');
  const { readdirSync } = await import('fs');
  const files = readdirSync(resolve(__dirname, '../migrations'))
    .filter(f => f.endsWith('.sql'))
    .sort();

  files.forEach(f => console.log(`  - ${f}`));
  console.log('\nUsage: node scripts/run-migration.js <fichier.sql>');
  console.log('       node scripts/run-migration.js --all (exécute toutes les migrations)');
} else if (args[0] === '--all') {
  console.log('🚀 Exécution de toutes les migrations...');
  const { readdirSync } = await import('fs');
  const files = readdirSync(resolve(__dirname, '../migrations'))
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    await runMigration(file);
  }
} else {
  await runMigration(args[0]);
}
