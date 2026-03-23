/**
 * NEXUS Backend Obfuscation Script
 *
 * Obfusque les fichiers source in-place avant déploiement.
 * Tier 1 = protection forte (core, IA, SENTINEL, workflows)
 * Tier 2 = protection légère (routes, services génériques)
 *
 * Usage: node scripts/obfuscate.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const JavaScriptObfuscator = require('javascript-obfuscator');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

// ── Tier 1: protection maximale ─────────────────────────────────
const TIER1_PATTERNS = [
  'src/core/**/*.js',
  'src/services/logicTestEngine.js',
  'src/services/logicTests/**/*.js',
  'src/services/sentinelCollector.js',
  'src/services/sentinelInsights.js',
  'src/templates/**/*.js',
  'src/tools/**/*.js',
  'src/automation/workflowEngine.js',
  'src/config/businessRules.js',
  'src/middleware/tenantShield.js',
  'src/middleware/rbac.js',
  'src/controllers/adminChatController.js',
];

// ── Exclusions: jamais obfusqués ─────────────────────────────────
const EXCLUDE_PATTERNS = [
  'src/config/env.js',
  'src/config/swagger.js',
  'src/config/supabase.js',
  'src/config/sentry.js',
  'src/config/redis.js',
  'src/config/logger.js',
  'src/sql/**',
  'src/tests/**',
  'src/start.js',
];

// ── Options obfuscation ──────────────────────────────────────────
const TIER1_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  identifierNamesGenerator: 'hexadecimal',
  splitStrings: true,
  splitStringsChunkLength: 5,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  target: 'node',
  // Préserver les imports/exports ESM
  sourceMap: false,
};

const TIER2_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  identifierNamesGenerator: 'hexadecimal',
  splitStrings: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.5,
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
  target: 'node',
  sourceMap: false,
};

// ── Helpers ──────────────────────────────────────────────────────

function matchesGlob(filePath, pattern) {
  // Normalise le pattern en regex
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  return new RegExp(`^${regexStr}$`).test(filePath);
}

function matchesAny(filePath, patterns) {
  return patterns.some(p => matchesGlob(filePath, p));
}

function getAllJsFiles(dir, base = '') {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(base, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'tests', 'data', 'sql'].includes(entry.name)) continue;
      files.push(...getAllJsFiles(full, rel));
    } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      files.push(rel);
    }
  }
  return files;
}

// ── Main ─────────────────────────────────────────────────────────

function main() {
  console.log('🔒 NEXUS Obfuscation — Démarrage\n');

  const allFiles = getAllJsFiles(SRC, 'src');
  let tier1Count = 0;
  let tier2Count = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const relPath of allFiles) {
    // Exclusions
    if (matchesAny(relPath, EXCLUDE_PATTERNS)) {
      skipCount++;
      continue;
    }

    const isTier1 = matchesAny(relPath, TIER1_PATTERNS);
    const fullPath = path.join(ROOT, relPath);
    const options = isTier1 ? TIER1_OPTIONS : TIER2_OPTIONS;
    const tier = isTier1 ? 'T1' : 'T2';

    try {
      const code = fs.readFileSync(fullPath, 'utf-8');

      // Skip fichiers vides ou très petits
      if (code.trim().length < 10) {
        skipCount++;
        continue;
      }

      const result = JavaScriptObfuscator.obfuscate(code, options);
      fs.writeFileSync(fullPath, result.getObfuscatedCode(), 'utf-8');

      if (isTier1) tier1Count++;
      else tier2Count++;

      console.log(`  [${tier}] ✓ ${relPath}`);
    } catch (err) {
      errorCount++;
      console.error(`  [${tier}] ✗ ${relPath} — ${err.message}`);
    }
  }

  console.log('\n────────────────────────────────────');
  console.log(`  Tier 1 (fort)   : ${tier1Count} fichiers`);
  console.log(`  Tier 2 (léger)  : ${tier2Count} fichiers`);
  console.log(`  Ignorés         : ${skipCount} fichiers`);
  if (errorCount > 0) {
    console.log(`  Erreurs         : ${errorCount} fichiers`);
  }
  console.log('────────────────────────────────────');
  console.log('🔒 Obfuscation terminée.\n');

  if (errorCount > 0) {
    process.exit(1);
  }
}

main();
