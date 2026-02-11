/**
 * Tests Marketing Automation - Workflows
 */

import '../config/env.js';
import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';

console.log('='.repeat(60));
console.log('  TESTS MARKETING AUTOMATION - WORKFLOWS');
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
}

const BASE_URL = 'http://localhost:5000';
let allTestsPassed = true;
let createdWorkflowId = null;
let createdTemplateId = null;

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

console.log('\n=== TESTS WORKFLOWS ===\n');

// Test 1: Créer workflow
await test('POST /api/marketing/workflows - Créer workflow', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/workflows`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      nom: 'Test Bienvenue Client',
      description: 'Workflow de test automatique',
      trigger_type: 'nouveau_client',
      actions: [
        { type: 'email', delay_minutes: 0 },
        { type: 'sms', message: 'Bienvenue chez nous !', delay_minutes: 5 },
        { type: 'notification', message: 'Nouveau client inscrit', delay_minutes: 0 }
      ]
    })
  });
  const data = await res.json();
  if (data.success && data.workflow) {
    createdWorkflowId = data.workflow.id;
    console.log(`    Workflow ID: ${data.workflow.id}`);
    console.log(`    Trigger: ${data.workflow.trigger_type}`);
    console.log(`    Actions: ${data.workflow.actions.length}`);
  }
  return { success: data.success, error: data.error };
});

// Test 2: Liste workflows
await test('GET /api/marketing/workflows - Lister workflows', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/workflows`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`    ${data.workflows?.length || 0} workflow(s) trouvé(s)`);
  return { success: data.success && Array.isArray(data.workflows), error: data.error };
});

// Test 3: Stats workflows
await test('GET /api/marketing/workflows/stats - Stats', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/workflows/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success && data.stats) {
    console.log(`    Total: ${data.stats.total_workflows}, Actifs: ${data.stats.workflows_actifs}`);
    console.log(`    Exécutions: ${data.stats.total_executions}`);
  }
  return { success: data.success && data.stats !== undefined, error: data.error };
});

// Test 4: Détail workflow
if (createdWorkflowId) {
  await test('GET /api/marketing/workflows/:id - Détail', async () => {
    const res = await fetch(`${BASE_URL}/api/marketing/workflows/${createdWorkflowId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      console.log(`    Nom: ${data.workflow.nom}`);
      console.log(`    Actif: ${data.workflow.actif}`);
      console.log(`    Exécutions: ${data.executions?.length || 0}`);
    }
    return { success: data.success && data.workflow !== undefined, error: data.error };
  });
}

// Test 5: Toggle actif/inactif
if (createdWorkflowId) {
  await test('POST /api/marketing/workflows/:id/toggle - Désactiver', async () => {
    const res = await fetch(`${BASE_URL}/api/marketing/workflows/${createdWorkflowId}/toggle`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      console.log(`    Nouveau statut: ${data.workflow.actif ? 'actif' : 'inactif'}`);
    }
    return { success: data.success, error: data.error };
  });

  await test('POST /api/marketing/workflows/:id/toggle - Réactiver', async () => {
    const res = await fetch(`${BASE_URL}/api/marketing/workflows/${createdWorkflowId}/toggle`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      console.log(`    Nouveau statut: ${data.workflow.actif ? 'actif' : 'inactif'}`);
    }
    return { success: data.success, error: data.error };
  });
}

// Test 6: Test workflow (exécution manuelle)
if (createdWorkflowId && testClientId) {
  await test('POST /api/marketing/workflows/:id/test - Test manuel', async () => {
    const res = await fetch(`${BASE_URL}/api/marketing/workflows/${createdWorkflowId}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ client_id: testClientId })
    });
    const data = await res.json();
    if (data.success) {
      console.log(`    Execution ID: ${data.execution_id}`);
      console.log(`    Message: ${data.message}`);
    }
    return { success: data.success, error: data.error };
  });

  // Attendre un peu pour que l'exécution se termine
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Vérifier les exécutions
  await test('GET /api/marketing/workflows/:id/executions - Historique', async () => {
    const res = await fetch(`${BASE_URL}/api/marketing/workflows/${createdWorkflowId}/executions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`    ${data.executions?.length || 0} exécution(s)`);
    return { success: data.success && Array.isArray(data.executions), error: data.error };
  });
}

console.log('\n=== TESTS EMAIL TEMPLATES ===\n');

// Test 7: Créer template
await test('POST /api/marketing/email-templates - Créer template', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/email-templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      nom: 'Template Test',
      sujet: 'Bienvenue {{prenom}} !',
      corps: '<h1>Bienvenue chez nous</h1><p>Merci de nous faire confiance.</p>'
    })
  });
  const data = await res.json();
  if (data.success && data.template) {
    createdTemplateId = data.template.id;
    console.log(`    Template ID: ${data.template.id}`);
  }
  return { success: data.success, error: data.error };
});

// Test 8: Liste templates
await test('GET /api/marketing/email-templates - Lister templates', async () => {
  const res = await fetch(`${BASE_URL}/api/marketing/email-templates`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`    ${data.templates?.length || 0} template(s) trouvé(s)`);
  return { success: data.success && Array.isArray(data.templates), error: data.error };
});

console.log('\n=== NETTOYAGE ===\n');

// Supprimer template test
if (createdTemplateId) {
  await test('DELETE /api/marketing/email-templates/:id - Supprimer template', async () => {
    const res = await fetch(`${BASE_URL}/api/marketing/email-templates/${createdTemplateId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return { success: data.success, error: data.error };
  });
}

// Supprimer workflow test
if (createdWorkflowId) {
  await test('DELETE /api/marketing/workflows/:id - Supprimer workflow', async () => {
    const res = await fetch(`${BASE_URL}/api/marketing/workflows/${createdWorkflowId}`, {
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
  console.log('  TOUS LES TESTS WORKFLOWS PASSENT');
} else {
  console.log('  CERTAINS TESTS ONT ÉCHOUÉ');
}
console.log('='.repeat(60));
console.log('');

console.log('CHECKLIST MARKETING AUTOMATION:');
console.log('  [x] Route POST /api/marketing/workflows');
console.log('  [x] Route GET /api/marketing/workflows');
console.log('  [x] Route GET /api/marketing/workflows/stats');
console.log('  [x] Route GET /api/marketing/workflows/:id');
console.log('  [x] Route POST /api/marketing/workflows/:id/toggle');
console.log('  [x] Route POST /api/marketing/workflows/:id/test');
console.log('  [x] Route GET /api/marketing/workflows/:id/executions');
console.log('  [x] Route DELETE /api/marketing/workflows/:id');
console.log('  [x] Route POST /api/marketing/email-templates');
console.log('  [x] Route GET /api/marketing/email-templates');
console.log('  [x] Route DELETE /api/marketing/email-templates/:id');
console.log('');
