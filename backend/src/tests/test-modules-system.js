/**
 * Tests Système Modules Activables
 * Mission Jour 6
 *
 * Tests:
 * 1. Vérifier modules_actifs dans tenants
 * 2. Vérifier table modules_disponibles
 * 3. Test middleware requireModule
 * 4. Test routes admin modules
 */

import '../config/env.js';
import { supabase } from '../config/supabase.js';
import { hasModule, getActiveModules } from '../middleware/moduleProtection.js';

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
function warn(msg) { log('yellow', '⚠️', msg); }
function section(msg) { console.log(`\n${COLORS.cyan}${'═'.repeat(60)}\n${msg}\n${'═'.repeat(60)}${COLORS.reset}`); }

const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

function recordTest(name, passed, details = '', skip = false) {
  results.tests.push({ name, passed, details, skip });
  if (skip) {
    results.skipped++;
    warn(`${name}: SKIPPED - ${details}`);
  } else if (passed) {
    results.passed++;
    success(`${name}${details ? ': ' + details : ''}`);
  } else {
    results.failed++;
    error(`${name}${details ? ': ' + details : ''}`);
  }
}

// ════════════════════════════════════════════════════════════════════
// TEST 1: Vérifier colonne modules_actifs dans tenants
// ════════════════════════════════════════════════════════════════════

async function testTenantsModulesActifs() {
  section('TEST 1: Colonne modules_actifs dans tenants');

  const { data: tenants, error: err } = await supabase
    .from('tenants')
    .select('id, name, modules_actifs')
    .in('id', ['fatshairafro', 'decoevent']);

  if (err) {
    recordTest('Lecture tenants', false, err.message);
    return;
  }

  recordTest('Tenants trouvés', tenants?.length >= 2, `${tenants?.length} tenants`);

  // Fat's Hair doit avoir plusieurs modules
  const fat = tenants?.find(t => t.id === 'fatshairafro');
  if (fat) {
    const fatModules = Object.keys(fat.modules_actifs || {});
    recordTest('Fat\'s Hair modules_actifs', fatModules.length >= 5, `${fatModules.length} modules: ${fatModules.join(', ')}`);

    // Vérifier modules attendus
    const expectedFat = ['socle', 'reservations', 'paiements', 'agent_ia_web'];
    const hasAll = expectedFat.every(m => fat.modules_actifs?.[m] === true);
    recordTest('Fat\'s Hair modules critiques', hasAll, expectedFat.join(', '));
  }

  // Deco Event doit avoir quelques modules
  const deco = tenants?.find(t => t.id === 'decoevent');
  if (deco) {
    const decoModules = Object.keys(deco.modules_actifs || {});
    recordTest('Deco Event modules_actifs', decoModules.length >= 2, `${decoModules.length} modules: ${decoModules.join(', ')}`);
  }
}

// ════════════════════════════════════════════════════════════════════
// TEST 2: Vérifier table modules_disponibles
// ════════════════════════════════════════════════════════════════════

async function testModulesDisponibles() {
  section('TEST 2: Table modules_disponibles');

  const { data: modules, error: err } = await supabase
    .from('modules_disponibles')
    .select('*')
    .eq('actif', true);

  if (err) {
    if (err.message.includes('not found')) {
      warn('Table modules_disponibles non créée');
      info('Exécutez le SQL dans Supabase Dashboard:');
      info('  backend/src/sql/001_modules_disponibles.sql');
      recordTest('Table modules_disponibles existe', false, 'Table non créée', true);
      return false;
    }
    recordTest('Lecture modules_disponibles', false, err.message);
    return false;
  }

  recordTest('Table modules_disponibles existe', true);
  recordTest('Modules disponibles', modules?.length >= 10, `${modules?.length || 0} modules`);

  // Vérifier catégories
  const categories = [...new Set(modules?.map(m => m.categorie) || [])];
  recordTest('Catégories définies', categories.length >= 4, categories.join(', '));

  // Vérifier socle requis
  const socle = modules?.find(m => m.id === 'socle');
  recordTest('Socle requis', socle?.requis === true);

  // Vérifier prix cohérents
  const prixOk = modules?.every(m => m.prix_mensuel >= 0 && m.prix_mensuel <= 100000);
  recordTest('Prix cohérents', prixOk);

  // Afficher résumé
  console.log('\n📋 Modules par catégorie:');
  const byCategory = {};
  modules?.forEach(m => {
    if (!byCategory[m.categorie]) byCategory[m.categorie] = [];
    byCategory[m.categorie].push(m);
  });

  Object.entries(byCategory).forEach(([cat, mods]) => {
    const total = mods.reduce((s, m) => s + m.prix_mensuel, 0);
    console.log(`  ${cat}: ${mods.length} modules, ${(total / 100).toFixed(0)}€/mois total`);
  });

  return true;
}

// ════════════════════════════════════════════════════════════════════
// TEST 3: Fonctions middleware
// ════════════════════════════════════════════════════════════════════

async function testMiddlewareFunctions() {
  section('TEST 3: Fonctions middleware');

  // hasModule
  info('Test hasModule()');

  const fatHasSocle = await hasModule('fatshairafro', 'socle');
  recordTest('hasModule(fat, socle)', fatHasSocle === true);

  const fatHasReservations = await hasModule('fatshairafro', 'reservations');
  recordTest('hasModule(fat, reservations)', fatHasReservations === true);

  const fatHasRH = await hasModule('fatshairafro', 'rh_avance');
  recordTest('hasModule(fat, rh_avance)', fatHasRH === false, 'Non activé = false');

  const invalidTenant = await hasModule('invalid_tenant', 'socle');
  recordTest('hasModule(invalid, socle)', invalidTenant === false, 'Tenant invalide = false');

  // getActiveModules
  info('Test getActiveModules()');

  const fatModules = await getActiveModules('fatshairafro');
  recordTest('getActiveModules(fat)', fatModules.length >= 5, `${fatModules.length} modules actifs`);

  const decoModules = await getActiveModules('decoevent');
  recordTest('getActiveModules(deco)', decoModules.length >= 2, `${decoModules.length} modules actifs`);

  const invalidModules = await getActiveModules('invalid_tenant');
  recordTest('getActiveModules(invalid)', invalidModules.length === 0, 'Tenant invalide = []');
}

// ════════════════════════════════════════════════════════════════════
// TEST 4: Calcul pricing
// ════════════════════════════════════════════════════════════════════

async function testPricing() {
  section('TEST 4: Calcul pricing');

  // Récupérer modules Fat's Hair
  const fatModules = await getActiveModules('fatshairafro');

  if (fatModules.length === 0) {
    warn('Pas de modules actifs pour Fat\'s Hair');
    return;
  }

  // Récupérer prix depuis modules_disponibles
  const { data: modules, error } = await supabase
    .from('modules_disponibles')
    .select('id, nom, prix_mensuel')
    .in('id', fatModules);

  if (error) {
    if (error.message.includes('not found')) {
      recordTest('Calcul pricing', false, 'Table modules_disponibles non créée', true);
      return;
    }
    recordTest('Calcul pricing', false, error.message);
    return;
  }

  const total = modules?.reduce((sum, m) => sum + (m.prix_mensuel || 0), 0) || 0;
  const totalEuros = (total / 100).toFixed(2);

  console.log('\n💰 Pricing Fat\'s Hair-Afro:');
  modules?.forEach(m => {
    console.log(`  - ${m.nom}: ${(m.prix_mensuel / 100).toFixed(0)}€/mois`);
  });
  console.log(`  ────────────────────────`);
  console.log(`  TOTAL: ${totalEuros}€/mois`);

  recordTest('Pricing calculé', total > 0, `${totalEuros}€/mois`);
}

// ════════════════════════════════════════════════════════════════════
// RAPPORT FINAL
// ════════════════════════════════════════════════════════════════════

function generateReport() {
  section('RAPPORT FINAL - SYSTÈME MODULES');

  const totalTests = results.passed + results.failed + results.skipped;
  const passRate = totalTests > 0 ? Math.round((results.passed / (results.passed + results.failed)) * 100) : 0;

  console.log(`
📊 RÉSUMÉ DES TESTS
───────────────────────────────────────────────
Réussis        : ${results.passed}
Échoués        : ${results.failed}
Ignorés        : ${results.skipped}
───────────────────────────────────────────────
TOTAL          : ${totalTests} tests
TAUX RÉUSSITE  : ${passRate}%
───────────────────────────────────────────────
`);

  if (results.failed === 0 && results.skipped === 0) {
    console.log(`${COLORS.green}🎉 TOUS LES TESTS PASSENT - SYSTÈME MODULES PRÊT${COLORS.reset}`);
  } else if (results.failed === 0) {
    console.log(`${COLORS.yellow}⚠️ TESTS PASSENT (${results.skipped} ignorés) - Voir actions requises${COLORS.reset}`);
  } else {
    console.log(`${COLORS.red}❌ ${results.failed} TEST(S) EN ÉCHEC${COLORS.reset}`);
  }

  // Actions requises
  if (results.skipped > 0) {
    console.log('\n📝 ACTIONS REQUISES:');
    console.log('1. Exécuter le SQL dans Supabase Dashboard:');
    console.log('   backend/src/sql/001_modules_disponibles.sql');
    console.log('2. Relancer ce test après création de la table');
  }

  return results;
}

// ════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║   TESTS SYSTÈME MODULES ACTIVABLES - NEXUS Platform              ║
║   Mission Jour 6                                                 ║
╚══════════════════════════════════════════════════════════════════╝
`);

  try {
    await testTenantsModulesActifs();
    const tableExists = await testModulesDisponibles();
    await testMiddlewareFunctions();

    if (tableExists) {
      await testPricing();
    }

    generateReport();

    process.exit(results.failed > 0 ? 1 : 0);

  } catch (err) {
    error(`Erreur fatale: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

main();
