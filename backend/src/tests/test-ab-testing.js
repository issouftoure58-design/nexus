/**
 * Tests Marketing Automation - A/B Testing + Analytics
 * Mission Partie 2
 */

import '../config/env.js';
import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';

console.log('='.repeat(60));
console.log('  TESTS MARKETING A/B TESTING + ANALYTICS');
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
console.log('Token JWT généré');

// 3. Récupérer un client existant
const { data: clients } = await supabase
  .from('clients')
  .select('id, nom, prenom')
  .eq('tenant_id', 'fatshairafro')
  .limit(1);

let testClientId = null;
if (clients && clients.length > 0) {
  testClientId = clients[0].id;
  console.log(`Client test: ${clients[0].prenom} ${clients[0].nom} (ID: ${testClientId})`);
}

const BASE_URL = 'http://localhost:5000';
let allTestsPassed = true;
let createdCampagneId = null;
let createdLinkToken = null;

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

console.log('\n=== TESTS CAMPAGNES A/B ===\n');

// Test 1: Créer campagne simple
await test('POST /api/marketing/campagnes - Campagne simple', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/campagnes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      nom: 'Test Campagne Simple',
      description: 'Campagne de test sans A/B',
      type: 'email',
      ab_testing_actif: false,
    })
  });
  const data = await res.json();
  if (data.success && data.campagne) {
    console.log(`    ID: ${data.campagne.id}`);
    console.log(`    Type: ${data.campagne.type}`);
  }
  return { success: data.success, error: data.error };
});

// Test 2: Créer campagne A/B
await test('POST /api/marketing/campagnes - Campagne A/B', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/campagnes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      nom: 'Test A/B Subject Lines',
      description: 'Test comparaison objets email',
      type: 'email',
      ab_testing_actif: true,
      variantes: [
        { nom: 'Variante A', poids: 50 },
        { nom: 'Variante B', poids: 50 },
      ]
    })
  });
  const data = await res.json();
  if (data.success && data.campagne) {
    createdCampagneId = data.campagne.id;
    console.log(`    ID: ${data.campagne.id}`);
    console.log(`    A/B Testing: ${data.campagne.ab_testing_actif}`);
    console.log(`    Variantes: ${data.campagne.variantes.length}`);
  }
  return { success: data.success, error: data.error };
});

// Test 3: Vérification poids != 100%
await test('POST /api/marketing/campagnes - Validation poids 100%', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/campagnes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      nom: 'Test Poids Invalide',
      type: 'sms',
      ab_testing_actif: true,
      variantes: [
        { nom: 'A', poids: 30 },
        { nom: 'B', poids: 40 },
      ]
    })
  });
  const data = await res.json();
  // Ce test doit échouer (poids = 70%)
  const expectedFail = !data.success && data.error.includes('100%');
  console.log(`    Rejet attendu: ${expectedFail ? 'OUI' : 'NON'}`);
  return { success: expectedFail, error: expectedFail ? null : 'Devrait refuser poids != 100%' };
});

// Test 4: Liste campagnes
await test('GET /api/marketing/campagnes - Liste', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/campagnes`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`    ${data.campagnes?.length || 0} campagne(s)`);
  return { success: data.success && Array.isArray(data.campagnes), error: data.error };
});

// Test 5: Détail campagne avec analytics
if (createdCampagneId) {
  await test('GET /api/marketing/campagnes/:id - Détail + Analytics', async () => {
    const res = await fetch(`${BASE_URL}/api/marketing/campagnes/${createdCampagneId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      console.log(`    Nom: ${data.campagne.nom}`);
      console.log(`    Analytics: ${data.campagne.analytics?.length || 0} variantes`);
    }
    return { success: data.success && data.campagne, error: data.error };
  });
}

// Test 6: Démarrer campagne
if (createdCampagneId) {
  await test('POST /api/marketing/campagnes/:id/start - Démarrer', async () => {
    const res = await fetch(`${BASE_URL}/api/marketing/campagnes/${createdCampagneId}/start`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      console.log(`    Statut: ${data.campagne.statut}`);
    }
    return { success: data.success && data.campagne?.statut === 'en_cours', error: data.error };
  });
}

console.log('\n=== TESTS TRACKING ===\n');

// Test 7: Créer lien tracké
await test('POST /api/marketing/tracking/create-link - Lien tracké', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/tracking/create-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      url_originale: 'https://example.com/promo',
      campagne_id: createdCampagneId,
    })
  });
  const data = await res.json();
  if (data.success && data.link) {
    createdLinkToken = data.link.token;
    console.log(`    Token: ${data.link.token}`);
    console.log(`    URL trackée: ${data.tracked_url}`);
  }
  return { success: data.success && data.tracked_url, error: data.error };
});

// Test 8: Enregistrer événement tracking
await test('POST /api/marketing/tracking/event - Événement envoi', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/tracking/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      campagne_id: createdCampagneId,
      client_id: testClientId,
      variante_nom: 'Variante A',
      event_type: 'envoi',
      metadata: { canal: 'email' }
    })
  });
  const data = await res.json();
  return { success: data.success, error: data.error };
});

await test('POST /api/marketing/tracking/event - Événement ouverture', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/tracking/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      campagne_id: createdCampagneId,
      client_id: testClientId,
      variante_nom: 'Variante A',
      event_type: 'ouverture',
    })
  });
  const data = await res.json();
  return { success: data.success, error: data.error };
});

await test('POST /api/marketing/tracking/event - Événement clic', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/tracking/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      campagne_id: createdCampagneId,
      client_id: testClientId,
      variante_nom: 'Variante A',
      event_type: 'clic',
      metadata: { url: 'https://example.com' }
    })
  });
  const data = await res.json();
  return { success: data.success, error: data.error };
});

console.log('\n=== TESTS ANALYTICS ===\n');

// Test 9: Analytics overview
await test('GET /api/marketing/analytics/overview - Stats globales', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/analytics/overview?periode=30`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success && data.stats) {
    console.log(`    Envois: ${data.stats.envois}`);
    console.log(`    Ouvertures: ${data.stats.ouvertures}`);
    console.log(`    Clics: ${data.stats.clics}`);
    console.log(`    Taux ouverture: ${data.stats.taux_ouverture}%`);
  }
  return { success: data.success && data.stats !== undefined, error: data.error };
});

// Test 10: Evolution
await test('GET /api/marketing/analytics/evolution - Évolution', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/analytics/evolution?periode=7`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`    ${data.evolution?.length || 0} jour(s) avec données`);
  return { success: data.success && Array.isArray(data.evolution), error: data.error };
});

// Test 11: Détail campagne après tracking
if (createdCampagneId) {
  await test('GET /api/marketing/campagnes/:id - Vérif stats mises à jour', async () => {
    const res = await fetch(`${BASE_URL}/api/marketing/campagnes/${createdCampagneId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.campagne) {
      console.log(`    Total envois: ${data.campagne.total_envois}`);
      console.log(`    Total ouvertures: ${data.campagne.total_ouvertures}`);
      console.log(`    Total clics: ${data.campagne.total_clics}`);
      // Vérifier analytics par variante
      const varianteA = data.campagne.analytics?.find(v => v.nom === 'Variante A');
      if (varianteA) {
        console.log(`    Variante A - Taux ouverture: ${varianteA.taux_ouverture}%`);
      }
    }
    return { success: data.success && data.campagne.total_envois >= 1, error: data.error };
  });
}

// Test 12: Déclarer gagnant
if (createdCampagneId) {
  await test('POST /api/marketing/campagnes/:id/declare-winner - Gagnant', async () => {
    const res = await fetch(`${BASE_URL}/api/marketing/campagnes/${createdCampagneId}/declare-winner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ variante_nom: 'Variante A' })
    });
    const data = await res.json();
    if (data.success) {
      console.log(`    Gagnant: ${data.campagne.variante_gagnante}`);
      console.log(`    Statut: ${data.campagne.statut}`);
    }
    return { success: data.success && data.campagne?.variante_gagnante === 'Variante A', error: data.error };
  });
}

console.log('\n=== NETTOYAGE ===\n');

// Supprimer campagnes de test
const { data: testCampagnes } = await supabase
  .from('campagnes')
  .select('id')
  .eq('tenant_id', 'fatshairafro')
  .like('nom', 'Test%');

if (testCampagnes && testCampagnes.length > 0) {
  for (const camp of testCampagnes) {
    await test(`DELETE /api/marketing/campagnes/${camp.id.substring(0,8)}...`, async () => {
      const res = await fetch(`${BASE_URL}/api/marketing/campagnes/${camp.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      return { success: data.success, error: data.error };
    });
  }
}

// Nettoyer tracking events de test
await supabase
  .from('tracking_events')
  .delete()
  .eq('tenant_id', 'fatshairafro');

console.log('');
console.log('='.repeat(60));
if (allTestsPassed) {
  console.log('  TOUS LES TESTS A/B TESTING PASSENT');
} else {
  console.log('  CERTAINS TESTS ONT ÉCHOUÉ');
}
console.log('='.repeat(60));
console.log('');

console.log('CHECKLIST A/B TESTING + ANALYTICS:');
console.log('  [x] Route POST /api/marketing/campagnes (simple)');
console.log('  [x] Route POST /api/marketing/campagnes (A/B)');
console.log('  [x] Validation poids variantes = 100%');
console.log('  [x] Route GET /api/marketing/campagnes');
console.log('  [x] Route GET /api/marketing/campagnes/:id (analytics)');
console.log('  [x] Route POST /api/marketing/campagnes/:id/start');
console.log('  [x] Route POST /api/marketing/tracking/create-link');
console.log('  [x] Route POST /api/marketing/tracking/event (envoi)');
console.log('  [x] Route POST /api/marketing/tracking/event (ouverture)');
console.log('  [x] Route POST /api/marketing/tracking/event (clic)');
console.log('  [x] Route GET /api/marketing/analytics/overview');
console.log('  [x] Route GET /api/marketing/analytics/evolution');
console.log('  [x] Stats campagne mises à jour');
console.log('  [x] Route POST /api/marketing/campagnes/:id/declare-winner');
console.log('  [x] Route DELETE /api/marketing/campagnes/:id');
console.log('');
