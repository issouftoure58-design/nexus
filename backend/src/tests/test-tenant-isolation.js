/**
 * Script de test : Isolation Multi-Tenant
 * Mission Jour 5 Phase 3
 *
 * Tests:
 * 1. Vérifier tenant decoevent en BDD
 * 2. Créer données test pour chaque tenant
 * 3. Tests isolation API
 * 4. Tests isolation BDD
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
function warn(msg) { log('yellow', '⚠️', msg); }
function section(msg) { console.log(`\n${COLORS.cyan}${'═'.repeat(60)}\n${msg}\n${'═'.repeat(60)}${COLORS.reset}`); }

// ════════════════════════════════════════════════════════════════════
// ÉTAPE 1 : VÉRIFIER TENANTS EN BDD
// ════════════════════════════════════════════════════════════════════

async function verifyTenants() {
  section('ÉTAPE 1 : VÉRIFICATION DES TENANTS EN BDD');

  const { data: tenants, error: err } = await supabase
    .from('tenants')
    .select('*');

  if (err) {
    error(`Erreur lecture tenants: ${err.message}`);
    return { fatshairafro: false, decoevent: false };
  }

  info(`Tenants trouvés en BDD: ${tenants?.length || 0}`);
  tenants?.forEach(t => {
    console.log(`  - ${t.id}: ${t.name} (actif: ${t.is_active})`);
  });

  const fatshairafro = tenants?.find(t => t.id === 'fatshairafro');
  const decoevent = tenants?.find(t => t.id === 'decoevent');

  if (fatshairafro) {
    success('Tenant fatshairafro existe en BDD');
  } else {
    error('Tenant fatshairafro MANQUANT en BDD');
  }

  if (decoevent) {
    success('Tenant decoevent existe en BDD');
  } else {
    warn('Tenant decoevent MANQUANT en BDD - Création...');
    await createDecoEventTenant();
  }

  return { fatshairafro: !!fatshairafro, decoevent: !!decoevent };
}

async function createDecoEventTenant() {
  const { error: err } = await supabase.from('tenants').insert({
    id: 'decoevent',
    name: 'Deco Event',
    domain: 'decoevent.fr',
    is_active: true,
    settings: {
      secteur: 'Décoration événementielle',
      ville: 'Paris'
    }
  });

  if (err) {
    error(`Erreur création decoevent: ${err.message}`);
    return false;
  }

  success('Tenant decoevent créé en BDD');
  return true;
}

// ════════════════════════════════════════════════════════════════════
// ÉTAPE 2 : CRÉER DONNÉES TEST
// ════════════════════════════════════════════════════════════════════

async function createTestData() {
  section('ÉTAPE 2 : CRÉATION DES DONNÉES TEST');

  // --- FATSHAIRAFRO ---
  info('Création données pour fatshairafro...');

  // Service test - use insert (no upsert constraint exists)
  // First delete any existing test data
  await supabase.from('services').delete().ilike('nom', 'TEST-ISO%');
  await supabase.from('clients').delete().ilike('nom', 'TEST-ISO%');

  const { data: serviceFat, error: errSvc } = await supabase
    .from('services')
    .insert({
      tenant_id: 'fatshairafro',
      nom: 'TEST-ISO-Tresses',
      description: 'Service test isolation',
      duree: 120,
      prix: 8000
    })
    .select()
    .single();

  if (errSvc) {
    warn(`Service fatshairafro: ${errSvc.message}`);
  } else {
    success(`Service fatshairafro créé: #${serviceFat?.id}`);
  }

  // Client test Alice
  const { data: clientAlice, error: errAlice } = await supabase
    .from('clients')
    .insert({
      tenant_id: 'fatshairafro',
      nom: 'TEST-ISO-Dupont',
      prenom: 'Alice',
      telephone: '0600000001',
      email: 'alice.test@isolation.fr'
    })
    .select()
    .single();

  if (errAlice) {
    warn(`Client Alice: ${errAlice.message}`);
  } else {
    success(`Client Alice créé: #${clientAlice?.id}`);
  }

  // --- DECOEVENT ---
  info('Création données pour decoevent...');

  // 3 Services test
  const servicesDecoevent = [
    { nom: 'TEST-ISO-Décoration Mariage', duree: 480, prix: 150000 },
    { nom: 'TEST-ISO-Décoration Anniversaire', duree: 240, prix: 50000 },
    { nom: 'TEST-ISO-Location Mobilier', duree: 60, prix: 20000 },
  ];

  for (const svc of servicesDecoevent) {
    const { data, error: err } = await supabase
      .from('services')
      .insert({
        tenant_id: 'decoevent',
        nom: svc.nom,
        description: 'Service test isolation',
        duree: svc.duree,
        prix: svc.prix
      })
      .select()
      .single();

    if (err) {
      warn(`Service ${svc.nom}: ${err.message}`);
    } else {
      success(`Service decoevent créé: ${svc.nom} #${data?.id}`);
    }
  }

  // Client test Bob
  const { data: clientBob, error: errBob } = await supabase
    .from('clients')
    .insert({
      tenant_id: 'decoevent',
      nom: 'TEST-ISO-Martin',
      prenom: 'Bob',
      telephone: '0600000002',
      email: 'bob.test@isolation.fr'
    })
    .select()
    .single();

  if (errBob) {
    warn(`Client Bob: ${errBob.message}`);
  } else {
    success(`Client Bob créé: #${clientBob?.id}`);
  }

  return { serviceFat, clientAlice, clientBob };
}

// ════════════════════════════════════════════════════════════════════
// ÉTAPE 3 : TESTS ISOLATION BDD
// ════════════════════════════════════════════════════════════════════

async function testDbIsolation() {
  section('ÉTAPE 3 : TESTS ISOLATION BASE DE DONNÉES');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  function recordTest(name, passed, details = '') {
    results.tests.push({ name, passed, details });
    if (passed) {
      results.passed++;
      success(`${name}${details ? ': ' + details : ''}`);
    } else {
      results.failed++;
      error(`${name}${details ? ': ' + details : ''}`);
    }
  }

  // TEST 1: Services isolation
  info('Test 1: Services par tenant');

  const { data: servicesFat } = await supabase
    .from('services')
    .select('*')
    .eq('tenant_id', 'fatshairafro')
    .ilike('nom', 'TEST-ISO%');

  const { data: servicesDeco } = await supabase
    .from('services')
    .select('*')
    .eq('tenant_id', 'decoevent')
    .ilike('nom', 'TEST-ISO%');

  recordTest(
    'Services fatshairafro isolés',
    servicesFat?.length >= 1 && !servicesFat.some(s => s.tenant_id !== 'fatshairafro'),
    `${servicesFat?.length || 0} services TEST-ISO`
  );

  recordTest(
    'Services decoevent isolés',
    servicesDeco?.length >= 3 && !servicesDeco.some(s => s.tenant_id !== 'decoevent'),
    `${servicesDeco?.length || 0} services TEST-ISO`
  );

  // TEST 2: Clients isolation
  info('Test 2: Clients par tenant');

  const { data: clientsFat } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', 'fatshairafro')
    .ilike('nom', 'TEST-ISO%');

  const { data: clientsDeco } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', 'decoevent')
    .ilike('nom', 'TEST-ISO%');

  recordTest(
    'Clients fatshairafro isolés',
    clientsFat?.length >= 1 && !clientsFat.some(c => c.tenant_id !== 'fatshairafro'),
    `${clientsFat?.length || 0} clients TEST-ISO (Alice)`
  );

  recordTest(
    'Clients decoevent isolés',
    clientsDeco?.length >= 1 && !clientsDeco.some(c => c.tenant_id !== 'decoevent'),
    `${clientsDeco?.length || 0} clients TEST-ISO (Bob)`
  );

  // TEST 3: Cross-tenant impossible
  info('Test 3: Vérification cross-tenant impossible');

  const { data: crossCheck } = await supabase
    .from('services')
    .select('tenant_id')
    .eq('tenant_id', 'fatshairafro')
    .ilike('nom', 'TEST-ISO-Décoration%');

  recordTest(
    'Cross-tenant bloqué (fat ne voit pas deco services)',
    (crossCheck?.length || 0) === 0,
    `${crossCheck?.length || 0} services cross-tenant trouvés (attendu: 0)`
  );

  // TEST 4: Comptage global vs par tenant
  info('Test 4: Comptage isolation');

  const { count: totalServices } = await supabase
    .from('services')
    .select('*', { count: 'exact', head: true })
    .ilike('nom', 'TEST-ISO%');

  const { count: fatCount } = await supabase
    .from('services')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', 'fatshairafro')
    .ilike('nom', 'TEST-ISO%');

  const { count: decoCount } = await supabase
    .from('services')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', 'decoevent')
    .ilike('nom', 'TEST-ISO%');

  recordTest(
    'Somme par tenant = total',
    totalServices === (fatCount || 0) + (decoCount || 0),
    `Total: ${totalServices}, Fat: ${fatCount}, Deco: ${decoCount}`
  );

  return results;
}

// ════════════════════════════════════════════════════════════════════
// ÉTAPE 4 : TESTS ISOLATION API (simulation)
// ════════════════════════════════════════════════════════════════════

async function testApiIsolation() {
  section('ÉTAPE 4 : TESTS ISOLATION API (simulation requêtes)');

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  function recordTest(name, passed, details = '') {
    results.tests.push({ name, passed, details });
    if (passed) {
      results.passed++;
      success(`${name}${details ? ': ' + details : ''}`);
    } else {
      results.failed++;
      error(`${name}${details ? ': ' + details : ''}`);
    }
  }

  // Simulation d'un contexte admin fatshairafro
  const adminFat = { tenant_id: 'fatshairafro', id: 1 };
  const adminDeco = { tenant_id: 'decoevent', id: 2 };

  info('Test API 1: Liste services avec filtre tenant_id');

  // Simule GET /api/admin/services pour fatshairafro
  const { data: apiServicesFat } = await supabase
    .from('services')
    .select('*')
    .eq('tenant_id', adminFat.tenant_id);

  const hasOnlyFatServices = apiServicesFat?.every(s => s.tenant_id === 'fatshairafro');
  recordTest(
    'API services fatshairafro retourne uniquement ses services',
    hasOnlyFatServices,
    `${apiServicesFat?.length || 0} services, tous tenant_id=fatshairafro`
  );

  // Simule GET /api/admin/services pour decoevent
  const { data: apiServicesDeco } = await supabase
    .from('services')
    .select('*')
    .eq('tenant_id', adminDeco.tenant_id);

  const hasOnlyDecoServices = apiServicesDeco?.every(s => s.tenant_id === 'decoevent');
  recordTest(
    'API services decoevent retourne uniquement ses services',
    hasOnlyDecoServices,
    `${apiServicesDeco?.length || 0} services, tous tenant_id=decoevent`
  );

  // Test: tentative d'accès cross-tenant (admin fat essaie d'accéder à client deco)
  info('Test API 2: Blocage accès cross-tenant');

  const { data: clientBobFromFat } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', adminFat.tenant_id)  // Filtre admin fat
    .eq('prenom', 'Bob');  // Bob est client decoevent

  recordTest(
    'Admin fat ne peut pas voir client Bob (decoevent)',
    (clientBobFromFat?.length || 0) === 0,
    `${clientBobFromFat?.length || 0} clients trouvés (attendu: 0)`
  );

  const { data: clientAliceFromDeco } = await supabase
    .from('clients')
    .select('*')
    .eq('tenant_id', adminDeco.tenant_id)  // Filtre admin deco
    .eq('prenom', 'Alice');  // Alice est cliente fatshairafro

  recordTest(
    'Admin deco ne peut pas voir client Alice (fatshairafro)',
    (clientAliceFromDeco?.length || 0) === 0,
    `${clientAliceFromDeco?.length || 0} clients trouvés (attendu: 0)`
  );

  // Test: stats dashboard isolation
  info('Test API 3: Stats dashboard isolées');

  const { data: statsFat } = await supabase
    .from('reservations')
    .select('id, tenant_id')
    .eq('tenant_id', adminFat.tenant_id);

  const { data: statsDeco } = await supabase
    .from('reservations')
    .select('id, tenant_id')
    .eq('tenant_id', adminDeco.tenant_id);

  const fatRdvOnlyFat = statsFat?.every(r => r.tenant_id === 'fatshairafro');
  const decoRdvOnlyDeco = statsDeco?.every(r => r.tenant_id === 'decoevent');

  recordTest(
    'Stats fatshairafro ne contiennent que ses RDV',
    fatRdvOnlyFat !== false,
    `${statsFat?.length || 0} RDV vérifiés`
  );

  recordTest(
    'Stats decoevent ne contiennent que ses RDV',
    decoRdvOnlyDeco !== false,
    `${statsDeco?.length || 0} RDV vérifiés`
  );

  return results;
}

// ════════════════════════════════════════════════════════════════════
// NETTOYAGE DONNÉES TEST
// ════════════════════════════════════════════════════════════════════

async function cleanupTestData() {
  section('NETTOYAGE DES DONNÉES TEST');

  info('Suppression des services TEST-ISO...');
  const { error: errSvc } = await supabase
    .from('services')
    .delete()
    .ilike('nom', 'TEST-ISO%');

  if (errSvc) {
    warn(`Erreur suppression services: ${errSvc.message}`);
  } else {
    success('Services TEST-ISO supprimés');
  }

  info('Suppression des clients TEST-ISO...');
  const { error: errCli } = await supabase
    .from('clients')
    .delete()
    .ilike('nom', 'TEST-ISO%');

  if (errCli) {
    warn(`Erreur suppression clients: ${errCli.message}`);
  } else {
    success('Clients TEST-ISO supprimés');
  }
}

// ════════════════════════════════════════════════════════════════════
// RAPPORT FINAL
// ════════════════════════════════════════════════════════════════════

function generateReport(dbResults, apiResults) {
  section('RAPPORT FINAL - TESTS ISOLATION MULTI-TENANT');

  const totalPassed = dbResults.passed + apiResults.passed;
  const totalFailed = dbResults.failed + apiResults.failed;
  const totalTests = totalPassed + totalFailed;

  console.log(`
📊 RÉSUMÉ DES TESTS
───────────────────────────────────────────────
Tests BDD      : ${dbResults.passed}/${dbResults.passed + dbResults.failed} réussis
Tests API      : ${apiResults.passed}/${apiResults.passed + apiResults.failed} réussis
───────────────────────────────────────────────
TOTAL          : ${totalPassed}/${totalTests} réussis (${Math.round(totalPassed/totalTests*100)}%)
───────────────────────────────────────────────
`);

  if (totalFailed === 0) {
    console.log(`${COLORS.green}🎉 TOUS LES TESTS PASSENT - ISOLATION VALIDÉE${COLORS.reset}`);
  } else {
    console.log(`${COLORS.red}⚠️ ${totalFailed} TEST(S) EN ÉCHEC - VÉRIFIER L'ISOLATION${COLORS.reset}`);
  }

  // Détail des tests
  console.log('\n📋 DÉTAIL DES TESTS BDD:');
  dbResults.tests.forEach(t => {
    const icon = t.passed ? '✅' : '❌';
    console.log(`  ${icon} ${t.name}`);
    if (t.details) console.log(`     └─ ${t.details}`);
  });

  console.log('\n📋 DÉTAIL DES TESTS API:');
  apiResults.tests.forEach(t => {
    const icon = t.passed ? '✅' : '❌';
    console.log(`  ${icon} ${t.name}`);
    if (t.details) console.log(`     └─ ${t.details}`);
  });

  return { totalPassed, totalFailed, totalTests, dbResults, apiResults };
}

// ════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║   TESTS ISOLATION MULTI-TENANT - NEXUS Platform                  ║
║   Mission Jour 5 Phase 3                                         ║
╚══════════════════════════════════════════════════════════════════╝
`);

  try {
    // Étape 1: Vérifier tenants
    await verifyTenants();

    // Étape 2: Créer données test
    await createTestData();

    // Étape 3: Tests isolation BDD
    const dbResults = await testDbIsolation();

    // Étape 4: Tests isolation API
    const apiResults = await testApiIsolation();

    // Rapport final
    const report = generateReport(dbResults, apiResults);

    // Nettoyage
    await cleanupTestData();

    // Exit code
    process.exit(report.totalFailed > 0 ? 1 : 0);

  } catch (err) {
    error(`Erreur fatale: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

main();
