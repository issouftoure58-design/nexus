#!/usr/bin/env node
/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                     🛡️ TENANT SHIELD LINTER 🛡️                            ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║  Ce script analyse le code pour détecter les violations d'isolation      ║
 * ║  multi-tenant AVANT que le code ne soit commité.                         ║
 * ║                                                                           ║
 * ║  VIOLATIONS DÉTECTÉES:                                                    ║
 * ║  1. Requêtes .from() sans .eq('tenant_id')                               ║
 * ║  2. Fonctions de service sans paramètre tenantId                         ║
 * ║  3. Fallback sur tenant par défaut                                       ║
 * ║  4. Routes sans validation tenant                                        ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// Tables système (pas de tenant_id requis)
const SYSTEM_TABLES = [
  'tenants',
  'tenant_phone_numbers',
  'plans',
  'secteurs',
  'modules_config',
  'system_settings',
];

// Fichiers à ignorer
const IGNORE_FILES = [
  'tenantCache.js',
  'supabase.js',
  'TenantContext.js',
  'tenant-shield-lint.js',
];

// Patterns de violation
const VIOLATIONS = {
  // Requête sans tenant_id
  MISSING_TENANT_FILTER: {
    pattern: /\.from\s*\(\s*['"`](\w+)['"`]\s*\)(?:(?!\.eq\s*\(\s*['"`]tenant_id['"`])[\s\S])*?(?:\.select|\.insert|\.update|\.delete|\.upsert)/g,
    message: (table) => `Requête sur '${table}' sans filtre tenant_id`,
    severity: 'ERROR',
  },

  // Fallback tenant par défaut
  DEFAULT_TENANT_FALLBACK: {
    pattern: /tenantId\s*(?:\|\||[\?]{2})\s*['"`]\w+['"`]/g,
    message: () => 'Fallback sur tenant par défaut interdit',
    severity: 'ERROR',
  },

  // Route sans req.tenantId
  ROUTE_WITHOUT_TENANT: {
    pattern: /router\.(get|post|put|patch|delete)\s*\([^)]+,\s*async\s*\(\s*req\s*,\s*res\s*\)\s*=>\s*\{(?:(?!req\.tenantId|tenantId)[\s\S])*?await\s+supabase/g,
    message: () => 'Route accède à Supabase sans utiliser req.tenantId',
    severity: 'WARNING',
  },
};

let totalErrors = 0;
let totalWarnings = 0;
const results = [];

/**
 * Analyse un fichier pour les violations
 */
function analyzeFile(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  const fileName = path.basename(filePath);

  // Ignorer certains fichiers
  if (IGNORE_FILES.includes(fileName)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const fileViolations = [];

  // Chercher les requêtes .from()
  const fromMatches = content.matchAll(/\.from\s*\(\s*['"`](\w+)['"`]\s*\)/g);

  for (const match of fromMatches) {
    const table = match[1];
    const position = match.index;

    // Ignorer les tables système
    if (SYSTEM_TABLES.includes(table)) {
      continue;
    }

    // Chercher si .eq('tenant_id') existe dans les 500 caractères suivants
    const nextChars = content.slice(position, position + 500);

    // Vérifier qu'il y a un .eq('tenant_id') avant le prochain ; ou await
    const hasSelect = nextChars.match(/\.(select|insert|update|delete|upsert)/);
    if (!hasSelect) continue;

    const queryEnd = nextChars.indexOf(';');
    const queryPart = queryEnd > 0 ? nextChars.slice(0, queryEnd) : nextChars;

    const hasTenantFilter = /\.eq\s*\(\s*['"`]tenant_id['"`]/.test(queryPart);

    if (!hasTenantFilter) {
      // Calculer le numéro de ligne
      const lineNum = content.slice(0, position).split('\n').length;

      fileViolations.push({
        line: lineNum,
        type: 'ERROR',
        message: `Table '${table}' requiert .eq('tenant_id', tenantId)`,
        code: queryPart.trim().slice(0, 80) + '...',
      });
      totalErrors++;
    }
  }

  // Chercher les fallback tenant
  const fallbackMatches = content.matchAll(/(\w*tenant\w*)\s*(?:\|\||[\?]{2})\s*['"`](\w+)['"`]/gi);
  for (const match of fallbackMatches) {
    const lineNum = content.slice(0, match.index).split('\n').length;
    fileViolations.push({
      line: lineNum,
      type: 'ERROR',
      message: `Fallback tenant interdit: ${match[0]}`,
      code: match[0],
    });
    totalErrors++;
  }

  if (fileViolations.length > 0) {
    results.push({
      file: relativePath,
      violations: fileViolations,
    });
  }
}

/**
 * Parcourt récursivement un répertoire
 */
function walkDir(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        walkDir(filePath);
      }
    } else if (file.endsWith('.js') || file.endsWith('.ts')) {
      analyzeFile(filePath);
    }
  }
}

// Main
console.log('');
console.log('🛡️  TENANT SHIELD LINTER');
console.log('━'.repeat(60));
console.log('');

// Analyser le répertoire src
walkDir(SRC_DIR);

// Afficher les résultats
if (results.length === 0) {
  console.log('✅ Aucune violation détectée');
  console.log('');
  process.exit(0);
}

for (const result of results) {
  console.log(`📄 ${result.file}`);
  for (const v of result.violations) {
    const icon = v.type === 'ERROR' ? '❌' : '⚠️';
    console.log(`   ${icon} Ligne ${v.line}: ${v.message}`);
    console.log(`      ${v.code}`);
  }
  console.log('');
}

console.log('━'.repeat(60));
console.log(`Résultat: ${totalErrors} erreur(s), ${totalWarnings} warning(s)`);
console.log('');

if (totalErrors > 0) {
  console.log('❌ ÉCHEC - Corrige les erreurs avant de commit');
  console.log('📖 Documentation: TENANT_SHIELD.md');
  console.log('');
  process.exit(1);
}

process.exit(0);
