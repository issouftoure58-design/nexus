#!/usr/bin/env node
/**
 * Syntax Check - Vérifie que tous les fichiers JS sont valides
 * Exécuté avant le déploiement pour éviter les crashes en prod
 */

import { execSync } from 'child_process';
import { globSync } from 'glob';
import path from 'path';

const ROOT = path.resolve(process.cwd(), 'src');

console.log('🔍 Vérification syntaxe des fichiers JavaScript...\n');

// Trouver tous les fichiers JS
const files = globSync('**/*.js', { cwd: ROOT });

let errors = 0;
let checked = 0;

for (const file of files) {
  const fullPath = path.join(ROOT, file);
  try {
    // Utiliser node --check pour valider la syntaxe
    execSync(`node --check "${fullPath}"`, { stdio: 'pipe' });
    checked++;
  } catch (error) {
    errors++;
    console.error(`❌ ${file}`);
    // Extraire le message d'erreur
    const stderr = error.stderr?.toString() || error.message;
    const lines = stderr.split('\n').slice(0, 5);
    lines.forEach(line => console.error(`   ${line}`));
    console.error('');
  }
}

console.log(`\n✅ ${checked} fichiers OK`);

if (errors > 0) {
  console.error(`\n❌ ${errors} fichier(s) avec erreurs`);
  process.exit(1);
}

console.log('\n🎉 Tous les fichiers sont valides!');
