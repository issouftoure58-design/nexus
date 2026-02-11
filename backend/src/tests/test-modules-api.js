/**
 * Test API Modules - Nouvelle structure plans + options
 * Date: 10 février 2026
 */

import '../config/env.js';
import { supabase } from '../config/supabase.js';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

function success(msg) { console.log(`${COLORS.green}[OK]${COLORS.reset} ${msg}`); }
function error(msg) { console.log(`${COLORS.red}[FAIL]${COLORS.reset} ${msg}`); }
function info(msg) { console.log(`${COLORS.blue}[INFO]${COLORS.reset} ${msg}`); }
function section(msg) { console.log(`\n${COLORS.cyan}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${COLORS.reset}`); }

async function testModulesAPI() {
  section('TEST API MODULES - Nouvelle structure');

  let passed = 0;
  let failed = 0;

  // Test 1: Vérifier tables existent
  section('1. Vérification tables');

  try {
    const { data: plans, error: e1 } = await supabase.from('plans').select('id, nom, prix_mensuel');
    if (e1) throw e1;
    success(`Table plans: ${plans.length} entrées`);
    plans.forEach(p => info(`  - ${p.nom}: ${(p.prix_mensuel / 100).toFixed(0)}EUR/mois`));
    passed++;
  } catch (e) {
    error(`Table plans: ${e.message}`);
    failed++;
  }

  try {
    const { data: options, error: e2 } = await supabase.from('options_disponibles').select('id, nom, categorie, type_paiement, prix');
    if (e2) throw e2;
    success(`Table options_disponibles: ${options.length} entrées`);

    const canaux = options.filter(o => o.categorie === 'canal_ia');
    const metiers = options.filter(o => o.categorie === 'module_metier');

    info(`  Canaux IA (mensuel): ${canaux.length}`);
    canaux.forEach(o => info(`    - ${o.nom}: ${(o.prix / 100).toFixed(0)}EUR/mois`));

    info(`  Modules métier (one-time): ${metiers.length}`);
    metiers.forEach(o => info(`    - ${o.nom}: ${(o.prix / 100).toFixed(0)}EUR`));
    passed++;
  } catch (e) {
    error(`Table options_disponibles: ${e.message}`);
    failed++;
  }

  // Test 2: Vérifier config Fat's Hair-Afro
  section('2. Configuration Fat\'s Hair-Afro');

  let tenantData = null;
  let planData = null;

  try {
    const { data: tenant, error: e3 } = await supabase
      .from('tenants')
      .select('id, name, plan_id, options_canaux_actifs, module_metier_id, module_metier_paye')
      .eq('id', 'fatshairafro')
      .single();

    if (e3) throw e3;
    tenantData = tenant;

    // Récupérer plan séparément
    if (tenant.plan_id) {
      const { data: plan } = await supabase
        .from('plans')
        .select('*')
        .eq('id', tenant.plan_id)
        .single();
      planData = plan;
    }

    success(`Tenant: ${tenant.name}`);
    info(`  Plan: ${planData?.nom || 'Aucun'}`);
    info(`  Plan ID: ${tenant.plan_id}`);

    const optionsActifs = tenant.options_canaux_actifs || {};
    const optionsIds = Object.keys(optionsActifs).filter(k => optionsActifs[k]);
    info(`  Options canaux actives: ${optionsIds.length}`);
    optionsIds.forEach(id => info(`    - ${id}`));

    info(`  Module métier: ${tenant.module_metier_id || 'Aucun'}`);
    info(`  Module métier payé: ${tenant.module_metier_paye ? 'Oui' : 'Non'}`);
    passed++;
  } catch (e) {
    error(`Config Fat's Hair: ${e.message}`);
    failed++;
  }

  // Test 3: Calcul pricing
  section('3. Calcul Pricing');

  try {
    // Utiliser les données déjà récupérées
    if (!tenantData) {
      throw new Error('Tenant non chargé');
    }

    const planPrix = planData?.prix_mensuel || 0;
    const optionsActifs = tenantData.options_canaux_actifs || {};
    const optionsIds = Object.keys(optionsActifs).filter(k => optionsActifs[k]);

    let optionsPrix = 0;
    if (optionsIds.length > 0) {
      const { data: options } = await supabase
        .from('options_disponibles')
        .select('id, nom, prix')
        .in('id', optionsIds)
        .eq('type_paiement', 'mensuel');

      options?.forEach(o => {
        optionsPrix += o.prix;
        info(`  + ${o.nom}: ${(o.prix / 100).toFixed(0)}EUR/mois`);
      });
    }

    const total = planPrix + optionsPrix;
    const expected = 37500; // 375EUR = 199 + 19 + 49 + 79 + 29

    info(`  Plan: ${(planPrix / 100).toFixed(0)}EUR`);
    info(`  Options: ${(optionsPrix / 100).toFixed(0)}EUR`);
    info(`  TOTAL: ${(total / 100).toFixed(0)}EUR/mois`);
    info(`  Attendu: ${(expected / 100).toFixed(0)}EUR/mois`);

    if (total === expected) {
      success(`Pricing CORRECT: ${(total / 100).toFixed(0)}EUR/mois`);
      passed++;
    } else {
      error(`Pricing INCORRECT: ${(total / 100).toFixed(0)} != ${(expected / 100).toFixed(0)}`);
      failed++;
    }
  } catch (e) {
    error(`Calcul pricing: ${e.message}`);
    failed++;
  }

  // Test 4: Vérifier middleware moduleProtection
  section('4. Test Middleware (simulation)');

  try {
    // Utiliser les données déjà récupérées
    if (!tenantData) {
      throw new Error('Tenant non chargé');
    }

    const config = {
      plan_id: tenantData.plan_id,
      plan: planData,
      options_canaux: tenantData.options_canaux_actifs || {},
      module_metier_id: tenantData.module_metier_id
    };

    // Test accès canal
    const hasWebChat = config.options_canaux['agent_ia_web'] === true;
    if (hasWebChat) {
      success('Accès agent_ia_web: OK');
      passed++;
    } else {
      error('Accès agent_ia_web: REFUSÉ');
      failed++;
    }

    // Test accès module métier
    const hasSalon = config.module_metier_id === 'module_metier_salon';
    if (hasSalon) {
      success('Accès module_metier_salon: OK');
      passed++;
    } else {
      error('Accès module_metier_salon: REFUSÉ');
      failed++;
    }

    // Test accès feature plan (Pro a comptabilite)
    const hasCompta = config.plan?.comptabilite === true;
    if (hasCompta) {
      success('Accès comptabilite (via plan Pro): OK');
      passed++;
    } else {
      error('Accès comptabilite: REFUSÉ');
      failed++;
    }
  } catch (e) {
    error(`Test middleware: ${e.message}`);
    failed++;
  }

  // Résumé
  section('RÉSUMÉ');
  console.log(`\nTests passés: ${COLORS.green}${passed}${COLORS.reset}`);
  console.log(`Tests échoués: ${COLORS.red}${failed}${COLORS.reset}`);

  if (failed === 0) {
    console.log(`\n${COLORS.green}========================================`);
    console.log('  TOUS LES TESTS PASSENT !');
    console.log(`========================================${COLORS.reset}\n`);
  } else {
    console.log(`\n${COLORS.red}========================================`);
    console.log(`  ${failed} TEST(S) EN ÉCHEC`);
    console.log(`========================================${COLORS.reset}\n`);
    process.exit(1);
  }
}

testModulesAPI();
