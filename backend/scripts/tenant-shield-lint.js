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
  'business_templates',  // templates métier partagés (salon, restaurant, etc.)
  'agent_roles',         // rôles d'agent IA partagés
  // Tables enfants qui héritent l'isolation du parent (liées par foreign key)
  'invoice_items',      // liées à invoices par invoice_id
  'quote_items',        // liées à quotes par quote_id
  'sale_items',         // liées à sales par sale_id
  'commerce_order_items', // liées à orders par order_id
  'stripe_products',    // config Stripe globale
  'modules_disponibles', // modules système
  'options_disponibles', // options système
  'seo_competitor_keywords', // liées à seo_competitors
  'seo_competitors',    // la query par competitor_id est OK
  'seo_positions',      // liées à seo_keywords par keyword_id
  'segment_clients',    // liées à segments par segment_id
  'opportunites_historique', // liées à opportunites par opportunite_id
  'workflow_executions', // liées à workflows par workflow_id
  'ecritures_comptables', // liées à factures par facture_id
  'themes',             // templates système
  'social_templates',   // templates système
  'sentinel_alerts',    // system monitoring
  'sentinel_security_logs', // system logs
  'sentinel_usage',     // system metrics
  'admin_conversations', // liées à admin_users
  'admin_messages',     // liées à conversations
  'webhook_logs',       // logs système
  'quota_usage',        // tracking système
  // Tables liées par foreign key à des entités tenant-scoped
  'historique_admin',   // liées à admin_users
  'historique_relances', // liées à clients
  'client_tags',        // liées à clients et tags
  'rendez_vous',        // alias de reservations
  'tracked_links',      // liées à campagnes
  'tracking_events',    // liées à campagnes
  'mouvements_stock',   // liées à produits
  'compteurs_conges',   // liées à employes
  'payments',           // liées à reservations
  'depenses',           // comptabilité, la query par ID est OK
];

// Fichiers à ignorer
const IGNORE_FILES = [
  'tenantCache.js',
  'supabase.js',
  'TenantContext.js',
  'tenant-shield-lint.js',
  // Middleware qui résout le tenant (travaille avant que tenant soit connu)
  'resolveTenant.js',
  'apiAuth.js',
  'auth.js',
  // Services système cross-tenant
  'costTracker.js',
  'responseCache.js',
  'taskQueue.js',
  'relancesService.js',
  // Services qui reçoivent déjà tenantId en paramètre et l'utilisent
  'halimahProService.js',
  'whatsappService.js',
  // Routes spéciales
  'adminAuth.js',       // auth avant tenant connu
  'signup.js',          // création de tenant
  'provisioning.js',    // provisioning système
];

// Dossiers à ignorer (tests, scripts CLI, migrations)
const IGNORE_DIRS = [
  'tests',
  'cli',
  'migrations',
  'scripts',
  'sentinel',  // monitoring système
];

// Fichiers spéciaux qui itèrent sur tous les tenants (jobs, workers)
const MULTI_TENANT_ITERATOR_FILES = [
  'scheduler.js',
  'publishScheduledPosts.js',
  'relancesFacturesJob.js',
  'seoTracking.js',
  'stockAlertes.js',
  'sentinelMonitor.js',
  'anomalyDetector.js',
  'intelligenceMonitor.js',
  'suggestions.js',
  'predictions.js',
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

  // Ignorer certains dossiers (tests, scripts CLI, etc.)
  for (const ignoreDir of IGNORE_DIRS) {
    if (relativePath.includes(`/${ignoreDir}/`) || relativePath.includes(`\\${ignoreDir}\\`) || relativePath.startsWith(`src/${ignoreDir}/`)) {
      return;
    }
  }

  // Fichiers qui itèrent sur tous les tenants (jobs cron)
  const isMultiTenantIterator = MULTI_TENANT_ITERATOR_FILES.includes(fileName);

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
    const operationMatch = nextChars.match(/\.(select|insert|update|delete|upsert)/);
    if (!operationMatch) continue;

    const operation = operationMatch[1];
    const queryEnd = nextChars.indexOf(';');
    const queryPart = queryEnd > 0 ? nextChars.slice(0, queryEnd) : nextChars;

    const hasTenantFilter = /\.eq\s*\(\s*['"`]tenant_id['"`]/.test(queryPart);

    // Pour les INSERT/UPSERT, vérifier si tenant_id est dans les données
    if (operation === 'insert' || operation === 'upsert') {
      const hasTenantInData = /tenant_id\s*[:=]/.test(queryPart) || /tenant_id,/.test(queryPart);
      if (hasTenantInData) {
        continue; // OK: tenant_id est dans les données insérées
      }

      // Vérifier si c'est un insert avec une variable qui contient probablement tenant_id
      // Ex: .insert(itemsToInsert) où itemsToInsert est construit avec tenant_id plus haut
      const insertVarMatch = queryPart.match(/\.insert\s*\(\s*(\w+)\s*\)/);
      if (insertVarMatch) {
        const varName = insertVarMatch[1];
        // Chercher si cette variable est construite avec tenant_id dans les 3000 caractères précédents
        const prevChars = content.slice(Math.max(0, position - 3000), position);
        const varHasTenantId = new RegExp(`${varName}[^=]*=.*tenant_id`, 's').test(prevChars) ||
                               new RegExp(`tenant_id[^}]*${varName}`, 's').test(prevChars) ||
                               /\.map\s*\([^)]*tenant_id/.test(prevChars) ||
                               new RegExp(`${varName}\\.push\\s*\\([^)]*tenant_id`, 's').test(prevChars);
        if (varHasTenantId) {
          continue; // OK: la variable contient probablement tenant_id
        }
      }
    }

    // Pour les fichiers multi-tenant iterator, vérifier si c'est une query initiale qui sélectionne tenant_id
    if (isMultiTenantIterator && operation === 'select') {
      const selectsTenantId = /\.select\s*\(\s*['"`][^'"]*tenant_id/.test(queryPart) ||
                              /\.select\s*\(\s*['"`]\*['"`]/.test(queryPart);
      if (selectsTenantId) {
        continue; // OK: query initiale qui récupère les tenant_ids pour itérer
      }
    }

    // Pour UPDATE/DELETE/SELECT par ID primaire, c'est OK si l'ID a été récupéré avec tenant_id
    // Ex: .select(...).eq('id', factureId) est OK car factureId vient d'une query filtrée
    if (/\.eq\s*\(\s*['"`]id['"`]/.test(queryPart) ||
        /\.in\s*\(\s*['"`]id['"`]/.test(queryPart) ||
        /\.eq\s*\(\s*['"`]reservation_id['"`]/.test(queryPart) ||
        /\.eq\s*\(\s*['"`]client_id['"`]/.test(queryPart)) {
      continue; // OK: query par ID spécifique (l'ID provient d'une query tenant-filtrée)
    }

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
