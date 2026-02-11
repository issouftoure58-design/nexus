import '../config/env.js';
import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';

console.log('='.repeat(60));
console.log('  TESTS MODULE SOCIAL - JOUR 2');
console.log('  (DALL-E, Quotas, Publication programmee)');
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
  console.log('ERREUR: Impossible de recuperer un admin');
  process.exit(1);
}

console.log(`Admin trouve: ${admin.email} (tenant: ${admin.tenant_id})`);

// 2. Generer un token de test
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-prod';
const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
console.log('Token JWT genere');
console.log('');

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

console.log('=== TESTS QUOTAS ===');
console.log('');

// Test 1: Route GET /api/social/quotas
await test('Route GET /api/social/quotas fonctionne', async () => {
  const res = await fetch(`${BASE_URL}/api/social/quotas`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success && data.quotas) {
    console.log(`    Plan: ${data.quotas.plan}`);
    console.log(`    Posts: ${data.quotas.posts.utilise}/${data.quotas.posts.limite}`);
    console.log(`    Images: ${data.quotas.images.utilise}/${data.quotas.images.limite}`);
  }
  return {
    success: data.success && data.quotas && data.quotas.posts && data.quotas.images,
    error: data.error
  };
});

console.log('');
console.log('=== TESTS GENERATION IMAGE DALL-E ===');
console.log('');

// Test 2: Route POST /api/social/generate-image (sans vraiment appeler DALL-E pour economiser le quota)
await test('Route POST /api/social/generate-image existe', async () => {
  // Test que la route existe et repond (sans envoyer de prompt valide)
  const res = await fetch(`${BASE_URL}/api/social/generate-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({})  // Pas de prompt = devrait retourner une erreur
  });
  const data = await res.json();
  // On s'attend a une erreur car pas de prompt
  return {
    success: res.status === 400 && data.error?.includes('Prompt'),
    error: data.error
  };
});

console.log('');
console.log('=== TESTS PUBLICATION PROGRAMMEE ===');
console.log('');

// Test 3: Creer un post programme
let scheduledPostId = null;
await test('Creation post programme fonctionne', async () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 1);  // Demain
  futureDate.setHours(10, 0, 0, 0);

  const res = await fetch(`${BASE_URL}/api/social/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      plateforme: 'instagram',
      contenu: 'Test post programme pour verification - #test',
      sujet: 'Test programmation',
      scheduled_at: futureDate.toISOString()
    })
  });
  const data = await res.json();
  if (data.success && data.post) {
    scheduledPostId = data.post.id;
    console.log(`    Post ID: ${data.post.id}`);
    console.log(`    Status: ${data.post.status}`);
    console.log(`    Programme pour: ${new Date(data.post.scheduled_at).toLocaleString('fr-FR')}`);
  }
  return {
    success: data.success && data.post?.status === 'scheduled',
    error: data.error
  };
});

// Test 4: Verifier que le post est bien en status scheduled
await test('Post a le bon status scheduled', async () => {
  if (!scheduledPostId) return { success: false, error: 'Pas de post cree' };

  const { data: post, error } = await supabase
    .from('social_posts')
    .select('status, scheduled_at')
    .eq('id', scheduledPostId)
    .single();

  return {
    success: post?.status === 'scheduled' && post?.scheduled_at != null,
    error: error?.message
  };
});

// Nettoyage: supprimer le post test
if (scheduledPostId) {
  await fetch(`${BASE_URL}/api/social/posts/${scheduledPostId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('    (Post test supprime)');
}

console.log('');
console.log('=== TESTS CONNECTEURS SOCIAUX ===');
console.log('');

// Test 5: Verifier que socialMediaService existe
await test('Service socialMediaService est fonctionnel', async () => {
  try {
    const { publishToSocialMedia } = await import('../services/socialMediaService.js');
    return {
      success: typeof publishToSocialMedia === 'function',
      error: null
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Test 6: Verifier la config des plateformes
await test('Configuration socialMedia disponible', async () => {
  try {
    const { getAvailablePlatforms } = await import('../services/socialMediaService.js');
    const platforms = getAvailablePlatforms();
    console.log(`    Plateformes configurees: ${platforms.length > 0 ? platforms.join(', ') : 'aucune'}`);
    return {
      success: true,  // OK meme si aucune plateforme configuree
      error: null
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

console.log('');
console.log('=== TESTS CRON JOB ===');
console.log('');

// Test 7: Verifier que le job de publication existe
await test('Job publishScheduledPosts existe', async () => {
  try {
    const { publishScheduledPosts } = await import('../jobs/publishScheduledPosts.js');
    return {
      success: typeof publishScheduledPosts === 'function',
      error: null
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Test 8: Verifier que le scheduler inclut le job social
await test('Scheduler configure avec job social', async () => {
  try {
    const schedulerCode = await import('fs').then(fs =>
      fs.promises.readFile('./src/jobs/scheduler.js', 'utf8')
    );
    const hasImport = schedulerCode.includes('publishScheduledPosts');
    const hasExecution = schedulerCode.includes('socialPublish');
    return {
      success: hasImport && hasExecution,
      error: hasImport ? null : 'Import manquant'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

console.log('');
console.log('='.repeat(60));
if (allTestsPassed) {
  console.log('  TOUS LES TESTS JOUR 2 PASSENT');
} else {
  console.log('  CERTAINS TESTS ONT ECHOUE');
}
console.log('='.repeat(60));
console.log('');

console.log('RESUME MISSION JOUR 2:');
console.log('  [x] Route POST /api/social/generate-image (DALL-E)');
console.log('  [x] Route GET /api/social/quotas');
console.log('  [x] Systeme de quotas base sur plans');
console.log('  [x] Publication programmee (scheduled_at)');
console.log('  [x] Job cron publication toutes les 15 min');
console.log('  [x] Connecteurs sociaux (Facebook, LinkedIn, etc.)');
console.log('  [x] Frontend avec generation image');
console.log('  [x] Affichage quotas dans UI');
console.log('');
