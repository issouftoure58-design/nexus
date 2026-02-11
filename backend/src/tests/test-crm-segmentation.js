import '../config/env.js';
import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';

console.log('='.repeat(60));
console.log('  TESTS CRM SEGMENTATION');
console.log('='.repeat(60));
console.log('');

// 1. Recuperer un admin avec tenant_id
const { data: admin, error: adminError } = await supabase
  .from('admin_users')
  .select('id, email, tenant_id')
  .eq('tenant_id', 'fatshairafro')
  .limit(1)
  .single();

if (adminError || !admin) {
  console.log('[ERREUR] Impossible de recuperer un admin');
  process.exit(1);
}

console.log(`Admin: ${admin.email} (tenant: ${admin.tenant_id})`);

// 2. Generer un token de test
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-prod';
const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
console.log('Token JWT genere\n');

const BASE_URL = 'http://localhost:5000';
let allTestsPassed = true;
let createdTagId = null;
let createdSegmentId = null;

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

console.log('=== TESTS TAGS ===\n');

// Test 1: Creation tag
await test('POST /api/crm/tags - Creer tag VIP', async () => {
  const res = await fetch(`${BASE_URL}/api/crm/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      nom: 'VIP-TEST',
      couleur: '#FFD700',
      description: 'Clients VIP pour test'
    })
  });
  const data = await res.json();
  if (data.success && data.tag) {
    createdTagId = data.tag.id;
    console.log(`    Tag ID: ${data.tag.id}`);
  }
  return { success: data.success, error: data.error };
});

// Test 2: Liste tags
await test('GET /api/crm/tags - Lister tags', async () => {
  const res = await fetch(`${BASE_URL}/api/crm/tags`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`    ${data.tags?.length || 0} tags trouves`);
  return { success: data.success && Array.isArray(data.tags), error: data.error };
});

// Test 3: Tag doublon
await test('POST /api/crm/tags - Doublon detecte', async () => {
  const res = await fetch(`${BASE_URL}/api/crm/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      nom: 'VIP-TEST',
      couleur: '#FFD700'
    })
  });
  const data = await res.json();
  // On s'attend a une erreur
  return { success: !data.success && data.error?.includes('existe'), error: data.error };
});

console.log('\n=== TESTS SEGMENTS ===\n');

// Test 4: Creation segment
await test('POST /api/crm/segments - Creer segment', async () => {
  const res = await fetch(`${BASE_URL}/api/crm/segments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      nom: 'Clients Fideles TEST',
      description: 'Clients avec au moins 3 RDV',
      criteres: {
        nb_rdv_min: 1
      }
    })
  });
  const data = await res.json();
  if (data.success && data.segment) {
    createdSegmentId = data.segment.id;
    console.log(`    Segment ID: ${data.segment.id}`);
    console.log(`    Clients: ${data.segment.nb_clients}`);
  }
  return { success: data.success, error: data.error };
});

// Test 5: Liste segments
await test('GET /api/crm/segments - Lister segments', async () => {
  const res = await fetch(`${BASE_URL}/api/crm/segments`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`    ${data.segments?.length || 0} segments trouves`);
  return { success: data.success && Array.isArray(data.segments), error: data.error };
});

// Test 6: Clients d'un segment
await test('GET /api/crm/segments/:id/clients - Clients du segment', async () => {
  if (!createdSegmentId) return { success: false, error: 'Pas de segment cree' };

  const res = await fetch(`${BASE_URL}/api/crm/segments/${createdSegmentId}/clients`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`    ${data.clients?.length || 0} clients dans le segment`);
  return { success: data.success && Array.isArray(data.clients), error: data.error };
});

console.log('\n=== TESTS ANALYTICS ===\n');

// Test 7: Analytics CRM
await test('GET /api/crm/analytics - Stats CRM', async () => {
  const res = await fetch(`${BASE_URL}/api/crm/analytics`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success && data.analytics) {
    console.log(`    Total clients: ${data.analytics.total_clients}`);
    console.log(`    Clients actifs: ${data.analytics.clients_actifs}`);
    console.log(`    Segments: ${data.analytics.nb_segments}`);
    console.log(`    Tags: ${data.analytics.nb_tags}`);
  }
  return { success: data.success && data.analytics, error: data.error };
});

console.log('\n=== NETTOYAGE ===\n');

// Nettoyage: Supprimer segment test
if (createdSegmentId) {
  await test('DELETE /api/crm/segments/:id - Supprimer segment', async () => {
    const res = await fetch(`${BASE_URL}/api/crm/segments/${createdSegmentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return { success: data.success, error: data.error };
  });
}

// Nettoyage: Supprimer tag test
if (createdTagId) {
  await test('DELETE /api/crm/tags/:id - Supprimer tag', async () => {
    const res = await fetch(`${BASE_URL}/api/crm/tags/${createdTagId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return { success: data.success, error: data.error };
  });
}

console.log('');
console.log('='.repeat(60));
if (allTestsPassed) {
  console.log('  TOUS LES TESTS CRM PASSENT');
} else {
  console.log('  CERTAINS TESTS ONT ECHOUE');
  console.log('  Note: Si "table non trouvee", executez la migration SQL');
}
console.log('='.repeat(60));
console.log('');

console.log('CHECKLIST CRM:');
console.log('  [x] Route POST /api/crm/tags');
console.log('  [x] Route GET /api/crm/tags');
console.log('  [x] Route DELETE /api/crm/tags/:id');
console.log('  [x] Route POST /api/crm/segments');
console.log('  [x] Route GET /api/crm/segments');
console.log('  [x] Route GET /api/crm/segments/:id/clients');
console.log('  [x] Route DELETE /api/crm/segments/:id');
console.log('  [x] Route GET /api/crm/analytics');
console.log('');
