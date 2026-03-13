#!/usr/bin/env node
/**
 * Validation IA Prompts — Vérifie les 6 business types sans appel API
 *
 * Usage: node scripts/validate-ia-prompts.mjs
 *
 * Vérifie :
 * 1. Génération prompt pour chaque business type (contenu attendu)
 * 2. Tool filtering par business type
 * 3. Client recognition (mock)
 * 4. Régression fatshairafro (prompt dynamique)
 */

import 'dotenv/config';

// ============================================
// IMPORTS
// ============================================

const { generateSystemPrompt } = await import('../src/templates/promptEngine.js');
const { getBusinessTypeRules, BUSINESS_CONTEXTS } = await import('../src/templates/businessTypePrompts/index.js');
const { getToolsForPlanAndBusiness } = await import('../src/tools/toolsRegistry.js');
const { recognizeClient } = await import('../src/services/clientRecognition.js');

// ============================================
// TEST FRAMEWORK
// ============================================

let passed = 0;
let failed = 0;
let warnings = 0;
const failures = [];

function ok(msg) { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg) { console.log(`  ❌ ${msg}`); failed++; failures.push(msg); }
function warn(msg) { console.log(`  ⚠️  ${msg}`); warnings++; }
function check(condition, msg) { condition ? ok(msg) : fail(msg); }
function section(title) { console.log(`\n${'━'.repeat(60)}\n📋 ${title}\n${'━'.repeat(60)}`); }

// ============================================
// MOCK TENANT CONFIGS (simule chaque business type)
// ============================================

const MOCK_TENANTS = {
  service_domicile: {
    id: 'fatshairafro',
    tenant_id: 'fatshairafro',
    name: "Fat's Hair-Afro",
    slug: 'fatshairafro',
    gerante: 'Fatou',
    adresse: '8 rue des Monts Rouges, 95130 Franconville',
    telephone: '07 82 23 50 20',
    concept: 'Coiffure afro à domicile ou chez Fatou',
    ville: 'Franconville',
    assistantName: 'Halimah',
    assistant_name: 'Halimah',
    assistant_gender: 'F',
    template_id: 'salon',
    business_profile: 'service_domicile',
    serviceOptions: { domicile_enabled: true },
    personality: { tutoiement: false, ton: 'chaleureux', emojis: 'moderation' },
  },
  salon: {
    id: 'nexus-test',
    tenant_id: 'nexus-test',
    name: 'Salon Elegance Paris',
    slug: 'nexus-test',
    gerante: 'Marie',
    adresse: '15 avenue Montaigne, 75008 Paris',
    telephone: '01 42 00 00 00',
    concept: 'Salon de coiffure haut de gamme',
    ville: 'Paris',
    assistantName: 'Clara',
    assistant_name: 'Clara',
    assistant_gender: 'F',
    template_id: 'salon',
    business_profile: 'salon',
    personality: { tutoiement: false, ton: 'chaleureux', emojis: 'moderation' },
  },
  restaurant: {
    id: 'test-restaurant',
    tenant_id: 'test-restaurant',
    name: 'Le Petit Bistrot',
    slug: 'test-restaurant',
    gerante: 'Jean',
    adresse: '5 rue de la Paix, 75001 Paris',
    telephone: '01 40 00 00 00',
    concept: 'Bistrot traditionnel français',
    ville: 'Paris',
    assistantName: 'Jules',
    assistant_name: 'Jules',
    assistant_gender: 'M',
    template_id: 'restaurant',
    business_profile: 'restaurant',
    personality: { tutoiement: false, ton: 'chaleureux', emojis: 'moderation' },
  },
  hotel: {
    id: 'test-hotel',
    tenant_id: 'test-hotel',
    name: 'Hôtel Bellevue',
    slug: 'test-hotel',
    gerante: 'Sophie',
    adresse: '100 bd Haussmann, 75008 Paris',
    telephone: '01 53 00 00 00',
    concept: 'Hôtel 4 étoiles avec vue panoramique',
    ville: 'Paris',
    assistantName: 'Éloïse',
    assistant_name: 'Éloïse',
    assistant_gender: 'F',
    template_id: 'hotel',
    business_profile: 'hotel',
    personality: { tutoiement: false, ton: 'chaleureux', emojis: 'moderation' },
  },
  commerce: {
    id: 'test-hospitality',
    tenant_id: 'test-hospitality',
    name: 'Quick Burger Express',
    slug: 'test-hospitality',
    gerante: 'Ali',
    adresse: '30 rue du Commerce, 75015 Paris',
    telephone: '01 45 00 00 00',
    concept: 'Fast-food burgers artisanaux',
    ville: 'Paris',
    assistantName: 'Nexus',
    assistant_name: 'Nexus',
    assistant_gender: 'M',
    template_id: 'commerce',
    business_profile: 'commerce',
    personality: { tutoiement: true, ton: 'décontracté', emojis: 'moderation' },
  },
  security: {
    id: 'test-security',
    tenant_id: 'test-security',
    name: 'Atlas Sécurité',
    slug: 'test-security',
    gerante: 'Marc',
    adresse: '50 avenue des Champs-Élysées, 75008 Paris',
    telephone: '01 56 00 00 00',
    concept: 'Sécurité privée et gardiennage',
    ville: 'Paris',
    assistantName: 'Nexus',
    assistant_name: 'Nexus',
    assistant_gender: 'M',
    template_id: 'security',
    business_profile: 'security',
    personality: { tutoiement: false, ton: 'professionnel', emojis: 'aucun' },
  },
};

// ============================================
// TEST 1: Génération prompt par business type
// ============================================

section('TEST 1 — Génération prompt par business type');

const CORE_RULES_KEYWORDS = [
  'JAMAIS CONFIRMER SANS CRÉER',
  'ANTI-PLACEHOLDER',
  'COLLECTER AVANT DE CRÉER',
  'GARDER LE CONTEXTE',
  'get_upcoming_days',
  'create_booking',
  'parse_date',
  'find_appointment',
  'cancel_appointment',
];

const BUSINESS_SPECIFIC = {
  service_domicile: {
    mustContain: ['calculate_travel_fee', 'domicile', 'adresse'],
    mustNotContain: ['couverts', 'check_table_availability', 'chambre'],
  },
  salon: {
    mustContain: ['salon', 'créneaux'],
    mustNotContain: ['couverts', 'calculate_travel_fee', 'chambre', 'commande', 'mission'],
  },
  restaurant: {
    mustContain: ['couverts', 'check_table_availability', 'midi', 'soir'],
    mustNotContain: ['calculate_travel_fee', 'chambre', 'commande', 'mission'],
  },
  hotel: {
    mustContain: ['arrivée', 'départ', 'check_room_availability', 'chambre'],
    mustNotContain: ['couverts', 'calculate_travel_fee', 'commande', 'mission'],
  },
  commerce: {
    mustContain: ['commande', 'produit', 'click', 'collect'],
    mustNotContain: ['couverts', 'calculate_travel_fee', 'chambre', 'mission', 'CNAPS'],
  },
  security: {
    mustContain: ['mission', 'devis', 'agents', 'CNAPS'],
    mustNotContain: ['couverts', 'calculate_travel_fee', 'chambre', 'commande'],
  },
};

for (const [type, tenantConfig] of Object.entries(MOCK_TENANTS)) {
  console.log(`\n  🔹 ${type.toUpperCase()} (${tenantConfig.name})`);

  let prompt;
  try {
    prompt = await generateSystemPrompt('whatsapp', tenantConfig);
  } catch (err) {
    fail(`${type}: Erreur génération prompt — ${err.message}`);
    continue;
  }

  check(prompt.length > 500, `${type}: prompt généré (${prompt.length} chars)`);

  // Vérifier noyau général (présent dans TOUS)
  let coreOk = 0;
  for (const kw of CORE_RULES_KEYWORDS) {
    if (prompt.includes(kw)) coreOk++;
  }
  check(coreOk >= 7, `${type}: noyau général (${coreOk}/${CORE_RULES_KEYWORDS.length} règles core)`);

  // Vérifier contenu spécifique business
  const spec = BUSINESS_SPECIFIC[type];
  if (spec) {
    for (const kw of spec.mustContain) {
      check(prompt.toLowerCase().includes(kw.toLowerCase()), `${type}: contient "${kw}"`);
    }
    for (const kw of spec.mustNotContain) {
      check(!prompt.toLowerCase().includes(kw.toLowerCase()), `${type}: NE contient PAS "${kw}"`);
    }
  }

  // Vérifier que le nom du business est dans le prompt
  check(prompt.includes(tenantConfig.name), `${type}: nom business présent (${tenantConfig.name})`);

  // Vérifier que l'assistant est nommé
  check(prompt.includes(tenantConfig.assistantName), `${type}: nom assistant présent (${tenantConfig.assistantName})`);
}

// ============================================
// TEST 2: Canal téléphone vs WhatsApp
// ============================================

section('TEST 2 — Règles par canal (phone vs whatsapp)');

const phonePrompt = await generateSystemPrompt('phone', MOCK_TENANTS.salon);
const whatsappPrompt = await generateSystemPrompt('whatsapp', MOCK_TENANTS.salon);

check(phonePrompt.includes('MODE VOCAL') || phonePrompt.includes('TÉLÉPHONE'), 'phone: contient règles téléphone');
check(phonePrompt.includes('concis'), 'phone: mentionne concis');
check(whatsappPrompt.includes('WHATSAPP'), 'whatsapp: contient règles WhatsApp');

// ============================================
// TEST 3: Tool filtering par business type
// ============================================

section('TEST 3 — Tool filtering par business type');

const TOOL_EXPECTATIONS = {
  salon: {
    has: ['parse_date', 'get_services', 'check_availability', 'create_booking'],
    not: ['check_table_availability', 'get_hotel_info', 'calculate_travel_fee'],
  },
  restaurant: {
    has: ['check_table_availability', 'get_restaurant_info', 'get_menu', 'create_booking'],
    not: ['calculate_travel_fee', 'get_hotel_info'],
  },
  hotel: {
    has: ['get_hotel_info', 'get_chambres_disponibles', 'check_room_availability', 'create_booking'],
    not: ['check_table_availability', 'calculate_travel_fee'],
  },
  service_domicile: {
    has: ['calculate_travel_fee', 'create_booking', 'check_availability'],
    not: ['check_table_availability', 'get_hotel_info'],
  },
  commerce: {
    has: ['create_booking', 'get_services'],
    not: ['check_table_availability', 'get_hotel_info', 'calculate_travel_fee'],
  },
  security: {
    has: ['create_booking', 'get_services'],
    not: ['check_table_availability', 'get_hotel_info', 'calculate_travel_fee'],
  },
};

for (const [type, expectations] of Object.entries(TOOL_EXPECTATIONS)) {
  const tools = getToolsForPlanAndBusiness('business', type);
  const toolNames = tools.map(t => t.name);

  for (const t of expectations.has) {
    check(toolNames.includes(t), `${type}: a l'outil "${t}"`);
  }
  for (const t of expectations.not) {
    check(!toolNames.includes(t), `${type}: PAS l'outil "${t}"`);
  }
}

// ============================================
// TEST 4: Client recognition (mock)
// ============================================

section('TEST 4 — Client recognition context dans le prompt');

// Test avec client connu (mock)
const tenantWithClient = {
  ...MOCK_TENANTS.salon,
  clientContext: {
    known: true,
    client: { id: '123', prenom: 'Sophie', nom: 'Martin', telephone: '0612345678' },
    displayName: 'Sophie Martin',
    lastVisit: '2026-03-10',
    visitCount: 5,
    recentServices: ['Brushing', 'Coloration'],
  },
};

const promptWithClient = await generateSystemPrompt('whatsapp', tenantWithClient);
check(promptWithClient.includes('CLIENT RECONNU'), 'client connu: section CLIENT RECONNU présente');
check(promptWithClient.includes('Sophie Martin'), 'client connu: nom affiché');
check(promptWithClient.includes('Brushing'), 'client connu: services habituels affichés');

// Test sans client (inconnu)
const tenantNoClient = { ...MOCK_TENANTS.salon };
delete tenantNoClient.clientContext;
const promptNoClient = await generateSystemPrompt('whatsapp', tenantNoClient);
check(!promptNoClient.includes('CLIENT RECONNU'), 'client inconnu: PAS de section CLIENT RECONNU');

// ============================================
// TEST 5: Régression fatshairafro
// ============================================

section('TEST 5 — Régression fatshairafro (production)');

const fatPrompt = await generateSystemPrompt('phone', MOCK_TENANTS.service_domicile);

check(fatPrompt.includes('Halimah'), 'fatshairafro: Halimah présente');
check(fatPrompt.includes("Fat's Hair-Afro"), "fatshairafro: nom business présent");
check(fatPrompt.includes('Fatou'), 'fatshairafro: Fatou présente');
check(fatPrompt.includes('JAMAIS CONFIRMER'), 'fatshairafro: règle #0 présente');
check(fatPrompt.includes('get_upcoming_days'), 'fatshairafro: get_upcoming_days présent');
check(fatPrompt.includes('calculate_travel_fee'), 'fatshairafro: calculate_travel_fee présent');
check(fatPrompt.includes('domicile'), 'fatshairafro: domicile mentionné');
check(fatPrompt.includes('MODE VOCAL') || fatPrompt.includes('TÉLÉPHONE'), 'fatshairafro: règles phone présentes');
check(fatPrompt.includes('parse_date'), 'fatshairafro: parse_date présent');
check(fatPrompt.includes('create_booking'), 'fatshairafro: create_booking présent');
check(fatPrompt.includes('find_appointment'), 'fatshairafro: find_appointment présent');
check(fatPrompt.includes('Franconville'), 'fatshairafro: ville Franconville présente');

// ============================================
// TEST 6: BUSINESS_CONTEXTS complet
// ============================================

section('TEST 6 — BUSINESS_CONTEXTS (admin chat)');

check(Object.keys(BUSINESS_CONTEXTS).length === 6, `6 contextes: ${Object.keys(BUSINESS_CONTEXTS).join(', ')}`);

for (const [type, ctx] of Object.entries(BUSINESS_CONTEXTS)) {
  check(ctx.description && ctx.description.length > 5, `${type}: description OK`);
  check(Array.isArray(ctx.actions) && ctx.actions.length >= 2, `${type}: ${ctx.actions.length} actions`);
  check(ctx.terminology.booking, `${type}: terminologie booking = "${ctx.terminology.booking}"`);
}

// ============================================
// RÉSUMÉ
// ============================================

console.log(`\n${'═'.repeat(60)}`);
console.log(`📊 RÉSULTATS VALIDATION IA PROMPTS`);
console.log(`${'═'.repeat(60)}`);
console.log(`  ✅ Passed:   ${passed}`);
console.log(`  ❌ Failed:   ${failed}`);
console.log(`  ⚠️  Warnings: ${warnings}`);
console.log(`${'═'.repeat(60)}`);

if (failed === 0) {
  console.log(`\n🎉 VALIDATION COMPLÈTE — Tous les tests passent !`);
  console.log(`   6 business types validés, tool filtering OK, client recognition OK`);
  console.log(`   Régression fatshairafro OK, canaux phone/whatsapp OK\n`);
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failed} ÉCHEC(S) :`);
  for (const f of failures) {
    console.log(`   → ${f}`);
  }
  console.log('');
  process.exit(1);
}
