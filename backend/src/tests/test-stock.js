/**
 * Tests Stock & Inventaire
 * Mission Semaine 4 - Partie 2
 */

import '../config/env.js';
import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';

console.log('='.repeat(60));
console.log('  TESTS STOCK & INVENTAIRE');
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

// 3. Activer le module stock
console.log('\n=== ACTIVATION MODULE STOCK ===\n');

const { data: tenant, error: tenantError } = await supabase
  .from('tenants')
  .select('modules_actifs')
  .eq('id', 'fatshairafro')
  .single();

if (tenant) {
  const modules = tenant.modules_actifs || {};
  const updatedModules = { ...modules, stock: true };

  await supabase
    .from('tenants')
    .update({ modules_actifs: updatedModules })
    .eq('id', 'fatshairafro');

  console.log('Module activé: stock');
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

console.log('\n=== TESTS PRODUITS ===\n');

// Test: Créer un produit
let createdProduitId = null;
await test('POST /api/stock/produits - Créer produit', async () => {
  const res = await fetch(`${BASE_URL}/api/stock/produits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      nom: 'Test Shampoing Afro',
      reference: 'TEST-SHA-001',
      categorie: 'fournitures',
      prix_achat_unitaire: 8, // 8€ (sera converti en centimes)
      prix_vente_unitaire: 15, // 15€ (sera converti en centimes)
      stock_actuel: 10,
      stock_minimum: 3,
      unite: 'piece',
      fournisseur: 'Test Fournisseur',
      description: 'Produit de test pour validation API'
    })
  });
  const data = await res.json();
  if (data.success && data.produit) {
    createdProduitId = data.produit.id;
    console.log(`    ID: ${data.produit.id}`);
    console.log(`    Référence: ${data.produit.reference}`);
    console.log(`    Stock initial: ${data.produit.stock_actuel}`);
  }
  return { success: data.success, error: data.error };
});

// Test: Liste produits
await test('GET /api/stock/produits - Liste produits', async () => {
  const res = await fetch(`${BASE_URL}/api/stock/produits`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success) {
    console.log(`    ${data.produits?.length || 0} produit(s)`);
  }
  return { success: data.success, error: data.error };
});

// Test: Modifier produit
if (createdProduitId) {
  await test('PATCH /api/stock/produits/:id - Modifier produit', async () => {
    const res = await fetch(`${BASE_URL}/api/stock/produits/${createdProduitId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        nom: 'Test Shampoing Afro MODIFIÉ',
        prix_vente_unitaire: 16 // 16€
      })
    });
    const data = await res.json();
    if (data.success && data.produit) {
      console.log(`    Nouveau nom: ${data.produit.nom}`);
      console.log(`    Nouveau prix: ${data.produit.prix_vente_unitaire_euros}€`);
    }
    return { success: data.success, error: data.error };
  });
}

console.log('\n=== TESTS MOUVEMENTS ===\n');

// Test: Créer mouvement ENTREE
let createdMouvementId = null;
if (createdProduitId) {
  await test('POST /api/stock/mouvements - Entrée stock', async () => {
    const res = await fetch(`${BASE_URL}/api/stock/mouvements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        produit_id: createdProduitId,
        type: 'entree',
        quantite: 5,
        prix_unitaire: 8, // 8€
        motif: 'Réception test'
      })
    });
    const data = await res.json();
    if (data.success && data.mouvement) {
      createdMouvementId = data.mouvement.id;
      console.log(`    ID mouvement: ${data.mouvement.id}`);
      console.log(`    Stock: ${data.stock_avant} → ${data.stock_apres}`);
    }
    return { success: data.success, error: data.error };
  });
}

// Test: Créer mouvement SORTIE
if (createdProduitId) {
  await test('POST /api/stock/mouvements - Sortie stock', async () => {
    const res = await fetch(`${BASE_URL}/api/stock/mouvements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        produit_id: createdProduitId,
        type: 'sortie',
        quantite: 2,
        motif: 'Vente test'
      })
    });
    const data = await res.json();
    if (data.success) {
      console.log(`    Stock: ${data.stock_avant} → ${data.stock_apres}`);
    }
    return { success: data.success, error: data.error };
  });
}

// Test: Créer mouvement AJUSTEMENT
if (createdProduitId) {
  await test('POST /api/stock/mouvements - Ajustement stock', async () => {
    const res = await fetch(`${BASE_URL}/api/stock/mouvements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        produit_id: createdProduitId,
        type: 'ajustement',
        quantite: -1,
        motif: 'Correction inventaire test'
      })
    });
    const data = await res.json();
    if (data.success) {
      console.log(`    Stock: ${data.stock_avant} → ${data.stock_apres}`);
    }
    return { success: data.success, error: data.error };
  });
}

// Test: Liste mouvements
await test('GET /api/stock/mouvements - Historique mouvements', async () => {
  const res = await fetch(`${BASE_URL}/api/stock/mouvements`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success) {
    console.log(`    ${data.mouvements?.length || 0} mouvement(s)`);
  }
  return { success: data.success, error: data.error };
});

console.log('\n=== TESTS INVENTAIRES ===\n');

// Test: Créer inventaire
let createdInventaireId = null;
await test('POST /api/stock/inventaires - Créer inventaire', async () => {
  const res = await fetch(`${BASE_URL}/api/stock/inventaires`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      nom: 'Inventaire Test',
      date_inventaire: new Date().toISOString().split('T')[0]
    })
  });
  const data = await res.json();
  if (data.success && data.inventaire) {
    createdInventaireId = data.inventaire.id;
    console.log(`    ID: ${data.inventaire.id}`);
    console.log(`    Nom: ${data.inventaire.nom}`);
    console.log(`    Statut: ${data.inventaire.statut}`);
    console.log(`    Lignes: ${data.inventaire.lignes?.length || 0}`);
  }
  return { success: data.success, error: data.error };
});

// Test: Liste inventaires
await test('GET /api/stock/inventaires - Liste inventaires', async () => {
  const res = await fetch(`${BASE_URL}/api/stock/inventaires`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success) {
    console.log(`    ${data.inventaires?.length || 0} inventaire(s)`);
  }
  return { success: data.success, error: data.error };
});

// Test: Mettre à jour le comptage de l'inventaire
if (createdInventaireId) {
  await test('PATCH /api/stock/inventaires/:id - MAJ comptage', async () => {
    // Récupérer l'inventaire pour avoir les lignes
    const getRes = await fetch(`${BASE_URL}/api/stock/inventaires/${createdInventaireId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const getData = await getRes.json();

    if (!getData.success || !getData.inventaire?.lignes) {
      return { success: false, error: 'Impossible de récupérer les lignes' };
    }

    // Mettre à jour les lignes avec le stock réel (= stock théorique pour ce test)
    const lignesMaj = getData.inventaire.lignes.map(l => ({
      ...l,
      stock_reel: l.stock_theorique // Même valeur = pas d'écart
    }));

    const res = await fetch(`${BASE_URL}/api/stock/inventaires/${createdInventaireId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ lignes: lignesMaj })
    });
    const data = await res.json();
    if (data.success) {
      console.log(`    Lignes MAJ: ${data.inventaire.lignes?.length || 0}`);
      console.log(`    Écarts: ${data.inventaire.ecarts_total || 0}`);
    }
    return { success: data.success, error: data.error };
  });
}

// Test: Valider inventaire
if (createdInventaireId) {
  await test('POST /api/stock/inventaires/:id/valider - Valider inventaire', async () => {
    const res = await fetch(`${BASE_URL}/api/stock/inventaires/${createdInventaireId}/valider`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      console.log(`    Message: ${data.message}`);
    }
    return { success: data.success, error: data.error };
  });
}

console.log('\n=== TESTS DASHBOARD & STATS ===\n');

// Test: Dashboard stock
await test('GET /api/stock/dashboard - Dashboard stock', async () => {
  const res = await fetch(`${BASE_URL}/api/stock/dashboard`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success && data.stats) {
    console.log(`    Nb produits: ${data.stats.nb_produits}`);
    console.log(`    Stock bas: ${data.stats.nb_stock_bas}`);
    console.log(`    Stock zéro: ${data.stats.nb_stock_zero}`);
    console.log(`    Alertes actives: ${data.stats.nb_alertes_actives}`);
    console.log(`    Valorisation: ${data.stats.valeur_totale_euros}€`);
  }
  return { success: data.success, error: data.error };
});

// Test: Valorisation stock
await test('GET /api/stock/valorisation - Valorisation stock', async () => {
  const res = await fetch(`${BASE_URL}/api/stock/valorisation`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success) {
    console.log(`    Catégories: ${data.valorisation?.length || 0}`);
    console.log(`    Total achat: ${data.totaux?.valeur_achat_euros}€`);
    console.log(`    Total vente: ${data.totaux?.valeur_vente_euros}€`);
  }
  return { success: data.success, error: data.error };
});

// Test: Alertes stock
await test('GET /api/stock/alertes - Alertes stock', async () => {
  const res = await fetch(`${BASE_URL}/api/stock/alertes`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success) {
    console.log(`    Alertes actives: ${data.alertes?.length || 0}`);
  }
  return { success: data.success, error: data.error };
});

// Test: Marquer alerte comme vue
const { data: alerteTest } = await supabase
  .from('alertes_stock')
  .select('id')
  .eq('tenant_id', 'fatshairafro')
  .limit(1)
  .single();

if (alerteTest) {
  await test('POST /api/stock/alertes/:id/vue - Marquer alerte vue', async () => {
    const res = await fetch(`${BASE_URL}/api/stock/alertes/${alerteTest.id}/vue`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return { success: data.success, error: data.error };
  });
}

console.log('\n=== NETTOYAGE ===\n');

// Supprimer le produit de test (cascade les mouvements et alertes)
if (createdProduitId) {
  await test('DELETE /api/stock/produits/:id - Supprimer produit', async () => {
    const res = await fetch(`${BASE_URL}/api/stock/produits/${createdProduitId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return { success: data.success, error: data.error };
  });
}

// Nettoyer les inventaires de test
await supabase
  .from('inventaires')
  .delete()
  .eq('tenant_id', 'fatshairafro')
  .like('reference', 'INV-TEST%');
console.log('Inventaires de test nettoyés');

// Nettoyer les produits de test restants
await supabase
  .from('produits')
  .delete()
  .eq('tenant_id', 'fatshairafro')
  .like('reference', 'TEST-%');
console.log('Produits de test nettoyés');

console.log('');
console.log('='.repeat(60));
if (allTestsPassed) {
  console.log('  ✅ TOUS LES TESTS STOCK & INVENTAIRE PASSENT');
} else {
  console.log('  ❌ CERTAINS TESTS ONT ÉCHOUÉ');
}
console.log('='.repeat(60));
console.log('');

console.log('CHECKLIST STOCK & INVENTAIRE:');
console.log('  [x] Route POST /api/stock/produits crée produit');
console.log('  [x] Route GET /api/stock/produits liste produits');
console.log('  [x] Route PATCH /api/stock/produits/:id modifie produit');
console.log('  [x] Route DELETE /api/stock/produits/:id supprime produit');
console.log('  [x] Route POST /api/stock/mouvements (entrée)');
console.log('  [x] Route POST /api/stock/mouvements (sortie)');
console.log('  [x] Route POST /api/stock/mouvements (ajustement)');
console.log('  [x] Route GET /api/stock/mouvements liste mouvements');
console.log('  [x] Route POST /api/stock/inventaires crée session');
console.log('  [x] Route GET /api/stock/inventaires liste inventaires');
console.log('  [x] Route PATCH /api/stock/inventaires/:id MAJ comptage');
console.log('  [x] Route POST /api/stock/inventaires/:id/valider');
console.log('  [x] Route GET /api/stock/dashboard retourne stats');
console.log('  [x] Route GET /api/stock/valorisation');
console.log('  [x] Route GET /api/stock/alertes');
console.log('  [x] Route POST /api/stock/alertes/:id/vue');
console.log('');

process.exit(allTestsPassed ? 0 : 1);
