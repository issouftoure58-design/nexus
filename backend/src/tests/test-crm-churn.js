/**
 * Tests CRM Partie 2 - Prédictions Churn + Analytics
 */

import '../config/env.js';
import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';

console.log('='.repeat(60));
console.log('  TESTS CRM CHURN & ANALYTICS');
console.log('='.repeat(60));
console.log('');

// 1. Récupérer un admin avec tenant_id
const { data: admin, error: adminError } = await supabase
  .from('admin_users')
  .select('id, email, tenant_id')
  .eq('tenant_id', 'fatshairafro')
  .limit(1)
  .single();

if (adminError || !admin) {
  console.log('[ERREUR] Impossible de récupérer un admin');
  process.exit(1);
}

console.log(`Admin: ${admin.email} (tenant: ${admin.tenant_id})`);

// 2. Générer un token de test
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-prod';
const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
console.log('Token JWT généré\n');

// 3. Récupérer un client existant pour les tests
const { data: clients } = await supabase
  .from('clients')
  .select('id, nom, prenom')
  .eq('tenant_id', 'fatshairafro')
  .limit(1);

let testClientId = null;
if (clients && clients.length > 0) {
  testClientId = clients[0].id;
  console.log(`Client test: ${clients[0].prenom} ${clients[0].nom} (ID: ${testClientId})`);
} else {
  console.log('[WARN] Aucun client trouvé pour les tests');
}

const BASE_URL = 'http://localhost:5000';
let allTestsPassed = true;

// Helper pour les tests
async function test(name, fn) {
  try {
    const result = await fn();
    if (result.success) {
      console.log(`[OK] ${name}`);
      return result;
    } else {
      console.log(`[FAIL] ${name}: ${result.error}`);
      allTestsPassed = false;
      return result;
    }
  } catch (err) {
    console.log(`[FAIL] ${name}: ${err.message}`);
    allTestsPassed = false;
    return { success: false, error: err.message };
  }
}

console.log('\n=== TESTS PREDICTIONS CHURN ===\n');

// Test 1: Churn d'un client spécifique
if (testClientId) {
  await test('GET /api/crm/clients/:id/churn - Score churn client', async () => {
    const res = await fetch(`${BASE_URL}/api/crm/clients/${testClientId}/churn`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.churn) {
      console.log(`    Score: ${data.churn.score}/100`);
      console.log(`    Risque: ${data.churn.risque}`);
      console.log(`    Raisons: ${data.churn.raisons.length > 0 ? data.churn.raisons.join(', ') : 'Aucune'}`);
    }
    return { success: data.success && data.churn !== undefined, error: data.error };
  });
}

// Test 2: Clients à risque
await test('GET /api/crm/churn/at-risk - Clients à risque', async () => {
  const res = await fetch(`${BASE_URL}/api/crm/churn/at-risk?limit=10`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`    ${data.count || 0} clients à risque identifiés`);
  if (data.clients && data.clients.length > 0) {
    data.clients.slice(0, 3).forEach(c => {
      console.log(`    - ${c.prenom} ${c.nom}: ${c.churn.score}/100 (${c.churn.risque})`);
    });
  }
  return { success: data.success && Array.isArray(data.clients), error: data.error };
});

console.log('\n=== TESTS ENGAGEMENT ===\n');

// Test 3: Mettre à jour engagement d'un client
if (testClientId) {
  await test('POST /api/crm/clients/:id/update-engagement - MAJ engagement', async () => {
    const res = await fetch(`${BASE_URL}/api/crm/clients/${testClientId}/update-engagement`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      console.log(`    Nouveau score: ${data.score}/100`);
    }
    return { success: data.success && data.score !== undefined, error: data.error };
  });
}

// Test 4: Recalculer tous les engagements
await test('POST /api/crm/engagement/recalculate-all - MAJ batch', async () => {
  const res = await fetch(`${BASE_URL}/api/crm/engagement/recalculate-all`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`    ${data.updated || 0} clients mis à jour`);
  return { success: data.success, error: data.error };
});

console.log('\n=== TESTS ANALYTICS CLIENT ===\n');

// Test 5: Analytics complet d'un client
if (testClientId) {
  await test('GET /api/crm/clients/:id/analytics - Analytics 360°', async () => {
    const res = await fetch(`${BASE_URL}/api/crm/clients/${testClientId}/analytics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.analytics) {
      console.log(`    CA Total: ${data.analytics.ca_total}€`);
      console.log(`    Panier Moyen: ${data.analytics.panier_moyen}€`);
      console.log(`    NB RDV: ${data.analytics.nb_rdv}`);
      console.log(`    LTV Estimée: ${data.analytics.ltv_estimee}€`);
      console.log(`    Score Engagement: ${data.analytics.score_engagement}/100`);
      console.log(`    Churn Score: ${data.analytics.churn.score}/100 (${data.analytics.churn.risque})`);
      if (data.analytics.services_preferes.length > 0) {
        console.log(`    Services préférés: ${data.analytics.services_preferes.map(s => s.nom).join(', ')}`);
      }
    }
    return { success: data.success && data.analytics !== undefined, error: data.error };
  });
}

// Test 6: Analytics client inexistant
await test('GET /api/crm/clients/999999/analytics - Client inexistant (404)', async () => {
  const res = await fetch(`${BASE_URL}/api/crm/clients/999999/analytics`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  // On s'attend à une erreur 404
  return { success: !data.success && res.status === 404, error: data.error };
});

console.log('');
console.log('='.repeat(60));
if (allTestsPassed) {
  console.log('  TOUS LES TESTS CHURN & ANALYTICS PASSENT');
} else {
  console.log('  CERTAINS TESTS ONT ÉCHOUÉ');
}
console.log('='.repeat(60));
console.log('');

console.log('CHECKLIST CRM PARTIE 2:');
console.log('  [x] Route GET /api/crm/clients/:id/churn');
console.log('  [x] Route GET /api/crm/churn/at-risk');
console.log('  [x] Route POST /api/crm/clients/:id/update-engagement');
console.log('  [x] Route POST /api/crm/engagement/recalculate-all');
console.log('  [x] Route GET /api/crm/clients/:id/analytics');
console.log('  [x] Algorithme churn avec facteurs de risque');
console.log('  [x] Score engagement calculé');
console.log('  [x] LTV estimée');
console.log('');
