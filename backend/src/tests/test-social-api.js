import '../config/env.js';
import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';

// 1. Récupérer un admin avec tenant_id
const { data: admin, error: adminError } = await supabase
  .from('admin_users')
  .select('id, email, tenant_id')
  .eq('tenant_id', 'fatshairafro')
  .limit(1)
  .single();

if (adminError || !admin) {
  console.log('Erreur récupération admin:', adminError?.message);
  process.exit(1);
}

console.log('Admin trouvé:', admin.email, '- tenant:', admin.tenant_id);

// 2. Générer un token de test
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-prod';
const token = jwt.sign(
  { id: admin.id, email: admin.email, role: 'admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('\nToken généré:', token.substring(0, 50) + '...');
console.log('\n=== TESTS API SOCIAL ===\n');

const BASE_URL = 'http://localhost:5000';

// Test 1: Liste posts
console.log('Test 1: GET /api/social/posts');
try {
  const res = await fetch(`${BASE_URL}/api/social/posts`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('  Status:', res.status);
  console.log('  Response:', JSON.stringify(data, null, 2));
} catch (e) {
  console.log('  Erreur:', e.message);
}

// Test 2: Générer un post avec l'IA
console.log('\nTest 2: POST /api/social/generate-post');
try {
  const res = await fetch(`${BASE_URL}/api/social/generate-post`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sujet: 'Nouvelle tendance tresses 2026',
      plateforme: 'instagram'
    })
  });
  const data = await res.json();
  console.log('  Status:', res.status);
  console.log('  Response:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
} catch (e) {
  console.log('  Erreur:', e.message);
}

// Test 3: Sauvegarder un post
console.log('\nTest 3: POST /api/social/posts');
try {
  const res = await fetch(`${BASE_URL}/api/social/posts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      plateforme: 'instagram',
      contenu: 'Test post depuis API - tendances coiffure 2026! #coiffure #tresses',
      sujet: 'Test API'
    })
  });
  const data = await res.json();
  console.log('  Status:', res.status);
  console.log('  Response:', JSON.stringify(data, null, 2));

  // Test 4: Supprimer le post créé
  if (data.success && data.post?.id) {
    console.log('\nTest 4: DELETE /api/social/posts/' + data.post.id);
    const delRes = await fetch(`${BASE_URL}/api/social/posts/${data.post.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const delData = await delRes.json();
    console.log('  Status:', delRes.status);
    console.log('  Response:', JSON.stringify(delData, null, 2));
  }
} catch (e) {
  console.log('  Erreur:', e.message);
}

// Test 5: Stats
console.log('\nTest 5: GET /api/social/stats');
try {
  const res = await fetch(`${BASE_URL}/api/social/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('  Status:', res.status);
  console.log('  Response:', JSON.stringify(data, null, 2));
} catch (e) {
  console.log('  Erreur:', e.message);
}

console.log('\n=== FIN TESTS ===');
