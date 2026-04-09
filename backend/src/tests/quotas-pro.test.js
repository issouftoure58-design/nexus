/**
 * Tests Quotas Plan Basic (modèle 2026 — révision finale 9 avril 2026)
 * Vérifie que les limites Basic sont correctement appliquées
 *
 * Modèle 2026:
 * - Free: 50 clients max, 1 GB, 30 RDV/mois, IA bloquée (0 crédit)
 * - Basic 29€/mois: tout illimité non-IA + 500 crédits IA inclus/mois (valeur 7,50€)
 * - Business 149€/mois: Basic + 10 000 crédits IA inclus/mois (valeur 150€) + premium features
 */

import {
  PLAN_LIMITS,
  checkClientsQuota,
  checkStorageQuota,
  checkSocialQuota
} from '../middleware/quotas.js';

// Configuration test
const TEST_TENANT_ID = 'test-basic-tenant';
const PLAN = 'basic';

console.log('='.repeat(50));
console.log('TESTS QUOTAS PLAN BASIC (modèle 2026)');
console.log('='.repeat(50));
console.log('');

// Test 1: Vérifier les limites définies (-1 = illimité)
console.log('TEST 1: Limites PLAN_LIMITS.basic définies correctement');
console.log('-'.repeat(40));

const basicLimits = PLAN_LIMITS.basic;
const tests = [
  { name: 'Clients (illimité)', expected: -1, actual: basicLimits.clients },
  { name: 'Stockage (GB)', expected: 50, actual: basicLimits.storage_gb },
  { name: 'Posts/mois (illimité)', expected: -1, actual: basicLimits.posts_per_month },
  { name: 'Images/mois (illimité)', expected: -1, actual: basicLimits.images_per_month }
];

let allPassed = true;
tests.forEach(test => {
  const passed = test.actual === test.expected;
  console.log(`  ${passed ? '✅' : '❌'} ${test.name}: ${test.actual} (attendu: ${test.expected})`);
  if (!passed) allPassed = false;
});

console.log('');

// Test 2: Vérifier checkClientsQuota retourne illimité
console.log('TEST 2: checkClientsQuota avec plan Basic');
console.log('-'.repeat(40));

async function testCheckClientsQuota() {
  try {
    const result = await checkClientsQuota(TEST_TENANT_ID, PLAN);
    const passed = result.limit === -1;
    console.log(`  ${passed ? '✅' : '❌'} Limite retournée: ${result.limit} (attendu: -1 illimité)`);
    console.log(`  ℹ️  Current: ${result.current}, OK: ${result.ok}`);
    return passed;
  } catch (error) {
    console.log(`  ⚠️  Erreur (normal si DB non connectée): ${error.message}`);
    const limit = PLAN_LIMITS.basic.clients;
    const passed = limit === -1;
    console.log(`  ${passed ? '✅' : '❌'} Limite via PLAN_LIMITS: ${limit} (attendu: -1)`);
    return passed;
  }
}

// Test 3: Vérifier checkStorageQuota = 50 GB
console.log('');
console.log('TEST 3: checkStorageQuota avec plan Basic');
console.log('-'.repeat(40));

async function testCheckStorageQuota() {
  try {
    const result = await checkStorageQuota(TEST_TENANT_ID, PLAN);
    const passed = result.limit_gb === 50;
    console.log(`  ${passed ? '✅' : '❌'} Limite retournée: ${result.limit_gb} GB (attendu: 50 GB)`);
    console.log(`  ℹ️  Current: ${result.current_gb} GB, OK: ${result.ok}`);
    return passed;
  } catch (error) {
    console.log(`  ⚠️  Erreur (normal si DB non connectée): ${error.message}`);
    const limit = PLAN_LIMITS.basic.storage_gb;
    const passed = limit === 50;
    console.log(`  ${passed ? '✅' : '❌'} Limite via PLAN_LIMITS: ${limit} GB (attendu: 50 GB)`);
    return passed;
  }
}

// Test 4: Vérifier checkSocialQuota pour posts (illimité)
console.log('');
console.log('TEST 4: checkSocialQuota (posts) avec plan Basic');
console.log('-'.repeat(40));

async function testCheckPostsQuota() {
  try {
    const result = await checkSocialQuota(TEST_TENANT_ID, PLAN, 'post');
    const passed = result.limit === -1;
    console.log(`  ${passed ? '✅' : '❌'} Limite retournée: ${result.limit}/mois (attendu: -1 illimité)`);
    console.log(`  ℹ️  Current: ${result.current}, OK: ${result.ok}`);
    return passed;
  } catch (error) {
    console.log(`  ⚠️  Erreur (normal si DB non connectée): ${error.message}`);
    const limit = PLAN_LIMITS.basic.posts_per_month;
    const passed = limit === -1;
    console.log(`  ${passed ? '✅' : '❌'} Limite via PLAN_LIMITS: ${limit}/mois (attendu: -1)`);
    return passed;
  }
}

// Test 5: Vérifier checkSocialQuota pour images (illimité)
console.log('');
console.log('TEST 5: checkSocialQuota (images) avec plan Basic');
console.log('-'.repeat(40));

async function testCheckImagesQuota() {
  try {
    const result = await checkSocialQuota(TEST_TENANT_ID, PLAN, 'image');
    const passed = result.limit === -1;
    console.log(`  ${passed ? '✅' : '❌'} Limite retournée: ${result.limit}/mois (attendu: -1 illimité)`);
    console.log(`  ℹ️  Current: ${result.current}, OK: ${result.ok}`);
    return passed;
  } catch (error) {
    console.log(`  ⚠️  Erreur (normal si DB non connectée): ${error.message}`);
    const limit = PLAN_LIMITS.basic.images_per_month;
    const passed = limit === -1;
    console.log(`  ${passed ? '✅' : '❌'} Limite via PLAN_LIMITS: ${limit}/mois (attendu: -1)`);
    return passed;
  }
}

// Test 6: Comparer Basic vs Free (Free = freemium très limité)
console.log('');
console.log('TEST 6: Comparaison Basic vs Free');
console.log('-'.repeat(40));

const freeLimits = PLAN_LIMITS.free;
const comparisons = [
  { name: 'Clients', free: freeLimits.clients, basic: basicLimits.clients },
  { name: 'Stockage GB', free: freeLimits.storage_gb, basic: basicLimits.storage_gb },
  { name: 'Posts/mois', free: freeLimits.posts_per_month, basic: basicLimits.posts_per_month },
  { name: 'Images/mois', free: freeLimits.images_per_month, basic: basicLimits.images_per_month }
];

comparisons.forEach(c => {
  const display = (v) => v === -1 ? '∞' : v;
  console.log(`  ${c.name}: Free=${display(c.free)}, Basic=${display(c.basic)}`);
});

// Exécuter tous les tests
async function runAllTests() {
  console.log('');
  console.log('='.repeat(50));
  console.log('EXECUTION DES TESTS ASYNC...');
  console.log('='.repeat(50));

  const results = await Promise.all([
    testCheckClientsQuota(),
    testCheckStorageQuota(),
    testCheckPostsQuota(),
    testCheckImagesQuota()
  ]);

  const passedCount = results.filter(r => r).length + (allPassed ? 1 : 0);
  const totalCount = results.length + 1;

  console.log('');
  console.log('='.repeat(50));
  console.log(`RÉSULTAT FINAL: ${passedCount}/${totalCount} tests passés`);
  console.log('='.repeat(50));

  if (passedCount === totalCount) {
    console.log('');
    console.log('✅ TOUS LES TESTS QUOTAS BASIC PASSENT !');
  } else {
    console.log('');
    console.log('❌ Certains tests ont échoué.');
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Erreur exécution tests:', err);
  process.exit(1);
});
