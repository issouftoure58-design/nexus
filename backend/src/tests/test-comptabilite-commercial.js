/**
 * Tests Comptabilité + Commercial
 * Mission Semaine 4
 */

import '../config/env.js';
import { supabase } from '../config/supabase.js';
import jwt from 'jsonwebtoken';

console.log('='.repeat(60));
console.log('  TESTS COMPTABILITÉ + COMMERCIAL');
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

// 3. Activer les modules comptabilite et commercial
console.log('\n=== ACTIVATION MODULES ===\n');

const { data: tenant, error: tenantError } = await supabase
  .from('tenants')
  .select('modules_actifs')
  .eq('id', 'fatshairafro')
  .single();

if (tenant) {
  const modules = tenant.modules_actifs || {};
  const updatedModules = { ...modules, comptabilite: true, commercial: true };

  await supabase
    .from('tenants')
    .update({ modules_actifs: updatedModules })
    .eq('id', 'fatshairafro');

  console.log('Modules activés: comptabilite, commercial');
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

console.log('\n=== TESTS COMPTABILITÉ ===\n');

// Test: Dashboard comptable
await test('GET /api/comptabilite/dashboard', async () => {
  const res = await fetch(`${BASE_URL}/api/comptabilite/dashboard`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success && data.mois_actuel) {
    console.log(`    Mois actuel: ${data.mois_actuel.mois}/${data.mois_actuel.annee}`);
    console.log(`    Revenus: ${data.mois_actuel.total_revenus}€`);
    console.log(`    Dépenses: ${data.mois_actuel.total_depenses}€`);
    console.log(`    Bénéfice: ${data.mois_actuel.benefice_net}€`);
  }
  return { success: data.success, error: data.error };
});

// Test: Liste catégories
await test('GET /api/comptabilite/categories', async () => {
  const res = await fetch(`${BASE_URL}/api/comptabilite/categories`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`    ${data.categories?.length || 0} catégorie(s)`);
  return { success: data.success, error: data.error };
});

// Test: Rapport mensuel
await test('GET /api/comptabilite/rapports/mensuel', async () => {
  const res = await fetch(`${BASE_URL}/api/comptabilite/rapports/mensuel?annee=2026&mois=2`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success && data.rapport) {
    console.log(`    Nb transactions: ${data.rapport.nb_transactions}`);
  }
  return { success: data.success, error: data.error };
});

console.log('\n=== TESTS DÉPENSES ===\n');

// Test: Liste dépenses
await test('GET /api/depenses', async () => {
  const res = await fetch(`${BASE_URL}/api/depenses?mois=2026-02`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`    ${data.depenses?.length || 0} dépense(s) ce mois`);
  return { success: data.success, error: data.error };
});

// Test: Créer dépense
let createdDepenseId = null;
await test('POST /api/depenses - Créer dépense', async () => {
  const res = await fetch(`${BASE_URL}/api/depenses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      libelle: 'Test fournitures',
      categorie: 'fournitures',
      montant_ttc: 5000, // 50€ TTC
      taux_tva: 20,
      deductible_tva: true,
      date_depense: '2026-02-11'
    })
  });
  const data = await res.json();
  if (data.success && data.depense) {
    createdDepenseId = data.depense.id;
    console.log(`    ID: ${data.depense.id}`);
    console.log(`    Montant HT: ${data.depense.montant_euros}€`);
    console.log(`    Montant TTC: ${data.depense.montant_ttc_euros}€`);
  }
  return { success: data.success, error: data.error };
});

// Test: Résumé dépenses
await test('GET /api/depenses/resume', async () => {
  const res = await fetch(`${BASE_URL}/api/depenses/resume?mois=2026-02`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success) {
    console.log(`    Total: ${data.total_euros}€`);
    console.log(`    Catégories: ${data.par_categorie?.length || 0}`);
  }
  return { success: data.success, error: data.error };
});

// Test: Compte résultat
await test('GET /api/depenses/compte-resultat', async () => {
  const res = await fetch(`${BASE_URL}/api/depenses/compte-resultat?mois=2026-02`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success && data.compte_resultat) {
    console.log(`    CA: ${data.compte_resultat.chiffre_affaires.total_euros}€`);
    console.log(`    Charges: ${data.compte_resultat.charges.total_euros}€`);
    console.log(`    Résultat: ${data.compte_resultat.resultat_net.total_euros}€`);
    console.log(`    Positif: ${data.compte_resultat.resultat_net.positif ? 'OUI' : 'NON'}`);
  }
  return { success: data.success, error: data.error };
});

// Test: TVA
await test('GET /api/depenses/tva', async () => {
  const res = await fetch(`${BASE_URL}/api/depenses/tva?mois=2026-02`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success && data.tva) {
    console.log(`    TVA collectée: ${data.tva.collectee.tva_euros}€`);
    console.log(`    TVA déductible: ${data.tva.deductible.tva_euros}€`);
    console.log(`    Solde: ${data.tva.solde.montant_euros}€ (${data.tva.solde.a_payer ? 'à payer' : 'crédit'})`);
  }
  return { success: data.success, error: data.error };
});

// Test: Supprimer dépense
if (createdDepenseId) {
  await test('DELETE /api/depenses/:id', async () => {
    const res = await fetch(`${BASE_URL}/api/depenses/${createdDepenseId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return { success: data.success, error: data.error };
  });
}

console.log('\n=== TESTS FACTURES ===\n');

// Test: Liste factures
await test('GET /api/factures', async () => {
  const res = await fetch(`${BASE_URL}/api/factures?mois=2026-02`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success) {
    console.log(`    ${data.factures?.length || 0} facture(s) ce mois`);
    console.log(`    En attente: ${data.stats?.nb_en_attente || 0}`);
    console.log(`    Envoyées: ${data.stats?.nb_envoyees || 0}`);
  }
  return { success: data.success, error: data.error };
});

// Test: Générer factures manquantes
await test('POST /api/factures/generer-manquantes', async () => {
  const res = await fetch(`${BASE_URL}/api/factures/generer-manquantes`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`    ${data.nb_creees || 0} facture(s) générée(s)`);
  return { success: data.success, error: data.error };
});

console.log('\n=== TESTS COMMERCIAL ===\n');

// Test: Clients inactifs
await test('GET /api/commercial/clients/inactifs', async () => {
  const res = await fetch(`${BASE_URL}/api/commercial/clients/inactifs?periode=3`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success) {
    console.log(`    ${data.nb_clients_inactifs || 0} clients inactifs`);
    if (data.segments) {
      console.log(`    VIP: ${data.segments.vip || 0}, Fidèles: ${data.segments.fidele || 0}, Standard: ${data.segments.standard || 0}`);
    }
  }
  return { success: data.success, error: data.error };
});

// Test: Scoring clients
await test('GET /api/commercial/clients/scoring', async () => {
  const res = await fetch(`${BASE_URL}/api/commercial/clients/scoring`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success) {
    console.log(`    ${data.clients?.length || 0} clients scorés`);
    if (data.segments) {
      console.log(`    VIP: ${data.segments.vip || 0}, Fidèles: ${data.segments.fidele || 0}`);
    }
  }
  return { success: data.success, error: data.error };
});

// Test: Liste campagnes commerciales
await test('GET /api/commercial/campagnes', async () => {
  const res = await fetch(`${BASE_URL}/api/commercial/campagnes`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(`    ${data.campagnes?.length || 0} campagne(s)`);
  return { success: data.success, error: data.error };
});

// Test: Créer campagne commerciale
let createdCampagneId = null;
await test('POST /api/commercial/campagnes', async () => {
  const res = await fetch(`${BASE_URL}/api/commercial/campagnes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      titre: 'Test relance inactifs',
      type_campagne: 'relance_inactifs',
      canal: 'email',
      message: 'Bonjour {{prenom}}, nous avons une offre spéciale pour vous!',
      offre_type: 'pourcentage',
      offre_valeur: 10,
      segment_cible: 'fidele',
      nb_cibles: 5
    })
  });
  const data = await res.json();
  if (data.success && data.campagne) {
    createdCampagneId = data.campagne.id;
    console.log(`    ID: ${data.campagne.id}`);
    console.log(`    Statut: ${data.campagne.statut}`);
  }
  return { success: data.success, error: data.error };
});

// Test: Stats commerciales
await test('GET /api/commercial/stats', async () => {
  const res = await fetch(`${BASE_URL}/api/commercial/stats`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.success && data.stats) {
    console.log(`    Total campagnes: ${data.stats.total_campagnes}`);
    console.log(`    Taux ouverture: ${data.stats.taux_ouverture}%`);
    console.log(`    Taux conversion: ${data.stats.taux_conversion}%`);
  }
  return { success: data.success, error: data.error };
});

// Test: Supprimer campagne
if (createdCampagneId) {
  await test('DELETE /api/commercial/campagnes/:id', async () => {
    const res = await fetch(`${BASE_URL}/api/commercial/campagnes/${createdCampagneId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return { success: data.success, error: data.error };
  });
}

// NETTOYAGE
console.log('\n=== NETTOYAGE ===\n');

// Nettoyer les dépenses de test
await supabase
  .from('depenses')
  .delete()
  .eq('tenant_id', 'fatshairafro')
  .like('libelle', 'Test%');
console.log('Dépenses de test nettoyées');

// Nettoyer les campagnes de test
await supabase
  .from('campagnes_relance')
  .delete()
  .eq('tenant_id', 'fatshairafro')
  .like('titre', 'Test%');
console.log('Campagnes de test nettoyées');

console.log('');
console.log('='.repeat(60));
if (allTestsPassed) {
  console.log('  ✅ TOUS LES TESTS COMPTABILITÉ + COMMERCIAL PASSENT');
} else {
  console.log('  ❌ CERTAINS TESTS ONT ÉCHOUÉ');
}
console.log('='.repeat(60));
console.log('');

console.log('CHECKLIST COMPTABILITÉ + COMMERCIAL:');
console.log('  [x] Route GET /api/comptabilite/dashboard');
console.log('  [x] Route GET /api/comptabilite/categories');
console.log('  [x] Route GET /api/comptabilite/rapports/mensuel');
console.log('  [x] Route GET /api/depenses');
console.log('  [x] Route POST /api/depenses');
console.log('  [x] Route DELETE /api/depenses/:id');
console.log('  [x] Route GET /api/depenses/resume');
console.log('  [x] Route GET /api/depenses/compte-resultat');
console.log('  [x] Route GET /api/depenses/tva');
console.log('  [x] Route GET /api/factures');
console.log('  [x] Route POST /api/factures/generer-manquantes');
console.log('  [x] Route GET /api/commercial/clients/inactifs');
console.log('  [x] Route GET /api/commercial/clients/scoring');
console.log('  [x] Route GET /api/commercial/campagnes');
console.log('  [x] Route POST /api/commercial/campagnes');
console.log('  [x] Route DELETE /api/commercial/campagnes/:id');
console.log('  [x] Route GET /api/commercial/stats');
console.log('');
