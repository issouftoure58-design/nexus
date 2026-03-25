/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * PLTE v2 — Bootstrap des 8 tenants autonomes
 * Verification/seed des donnees minimales pour chaque profil metier
 */

import { supabase } from '../../config/supabase.js';
import { BUSINESS_TEMPLATES } from '../../data/businessTemplates.js';

const TEST_PREFIX = '_PLTE_TEST_';

// Les 8 tenants PLTE avec leur profil metier
export const PLTE_TENANTS = {
  'nexus-test':        { name: 'Salon Elegance Paris', profile: 'salon',      template: 'salon_coiffure' },
  'blackburn':         { name: 'Blackburn',            profile: 'restaurant',  template: 'restaurant' },
  'test-hospitality':  { name: 'Quick Burger Express', profile: 'commerce',    template: 'commerce' },
  'test-events':       { name: 'Emma Events',          profile: 'events',      template: 'event_wedding' },
  'test-consulting':   { name: 'Clara Conseil',        profile: 'consulting',  template: 'consultant' },
  'test-security':     { name: 'Atlas Securite',       profile: 'securite',    template: 'security' },
  'plte-hotel':        { name: 'Hotel Sentinel',       profile: 'hotel',       template: 'hotel' },
  'plte-domicile':     { name: 'Service a Domicile Sentinel', profile: 'domicile', template: 'artisan' },
};

export const PLTE_TENANT_IDS = Object.keys(PLTE_TENANTS);

/**
 * Prepare les 8 tenants PLTE avec toutes les donnees necessaires
 * Retourne un map de contextes { tenantId: { tenantId, profile, clients, services, ... } }
 */
export async function ensurePlteTenantsReady() {
  console.log('[PLTE Bootstrap] Verification des 8 tenants...');
  const contexts = {};

  for (const [tenantId, config] of Object.entries(PLTE_TENANTS)) {
    try {
      const ctx = await ensureTenantReady(tenantId, config);
      contexts[tenantId] = ctx;
      console.log(`[PLTE Bootstrap] ${tenantId} (${config.profile}) OK — ${ctx.services.length} services, ${ctx.clients.length} clients`);
    } catch (err) {
      console.error(`[PLTE Bootstrap] ERREUR ${tenantId}:`, err.message, err.stack?.split('\n').slice(0, 3).join(' | '));
      // On continue avec les autres tenants
    }
  }

  console.log(`[PLTE Bootstrap] ${Object.keys(contexts).length}/8 tenants prets`);
  return contexts;
}

/**
 * S'assure qu'un tenant est pret pour les tests
 */
async function ensureTenantReady(tenantId, config) {
  const { profile, template, name } = config;

  // 1. Verifier/creer le tenant
  await ensureTenantExists(tenantId, name, template);

  // 2. Verifier/creer un admin
  await ensureAdminExists(tenantId);

  // 3. Verifier/creer des services depuis le template
  const services = await ensureServices(tenantId, template);

  // 4. Verifier/creer des clients test
  const clients = await ensureTestClients(tenantId);

  // 5. Verifier/creer des horaires
  await ensureBusinessHours(tenantId, template);

  // 6. Seed specifique par profil (non-bloquant — ne doit pas empecher les tests)
  let profileData = {};
  try {
    profileData = await seedProfileData(tenantId, profile);
  } catch (err) {
    console.warn(`[PLTE Bootstrap] seedProfileData ${tenantId} (${profile}): ${err.message}`);
  }

  // Log diagnostique si données manquantes
  if (!services?.length || !clients?.length) {
    console.error(`[PLTE Bootstrap] ⚠️ ${tenantId}: services=${services?.length || 0} clients=${clients?.length || 0} — H0 va echouer!`);
  }
  if (profile === 'securite' && (!profileData.agents?.length || !profileData.sites?.length)) {
    console.error(`[PLTE Bootstrap] ⚠️ ${tenantId}: agents=${profileData.agents?.length || 0} sites=${profileData.sites?.length || 0} — P_securite va echouer!`);
  }

  return {
    tenantId,
    profile,
    template,
    name,
    services,
    clients,
    ...profileData,
  };
}

// ============================================
// TENANT & ADMIN
// ============================================

async function ensureTenantExists(tenantId, name, template) {
  const { data: existing } = await supabase
    .from('tenants')
    .select('id, status')
    .eq('id', tenantId)
    .single();

  if (existing) {
    // S'assurer que le status est 'active' (fix pour tenants crees avant le correctif)
    if (existing.status !== 'active') {
      await supabase.from('tenants').update({ status: 'active', statut: 'actif' }).eq('id', tenantId);
      console.log(`[PLTE Bootstrap] Tenant ${tenantId} status corrige → active`);
    }
    return;
  }

  // Creer le tenant
  const { error } = await supabase.from('tenants').insert({
    id: tenantId,
    name,
    plan: 'business',
    status: 'active',
    statut: 'actif',
    structure_juridique: 'company',
    modules_actifs: ['reservations', 'whatsapp', 'marketing', 'seo', 'comptabilite', 'fidelite', 'rh', 'stock'],
    created_at: new Date().toISOString(),
  });
  if (error) {
    console.error(`[PLTE Bootstrap] ERREUR creation tenant ${tenantId}:`, error.message, error.details, error.hint);
    throw new Error(`Tenant creation failed: ${error.message}`);
  }
  console.log(`[PLTE Bootstrap] Tenant ${tenantId} cree`);
}

async function ensureAdminExists(tenantId) {
  const { data: existing } = await supabase
    .from('admin_users')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1);

  if (existing?.length) return;

  await supabase.from('admin_users').insert({
    tenant_id: tenantId,
    email: `${tenantId}@nexus.internal`,
    nom: 'PLTE Admin',
    role: 'owner',
    created_at: new Date().toISOString(),
  });
}

// ============================================
// SERVICES
// ============================================

async function ensureServices(tenantId, templateId) {
  // Check tous les services (actif ou non)
  const { data: existing, error: queryErr } = await supabase
    .from('services')
    .select('id, nom, duree, prix, categorie, actif')
    .eq('tenant_id', tenantId)
    .limit(20);

  if (queryErr) console.error(`[PLTE Bootstrap] Services query error ${tenantId}:`, queryErr.message);

  // Si des services existent mais sont inactifs, les reactiver
  if (existing?.length >= 1) {
    const inactive = existing.filter(s => !s.actif);
    if (inactive.length) {
      await supabase.from('services').update({ actif: true })
        .eq('tenant_id', tenantId).in('id', inactive.map(s => s.id));
    }
    return existing;
  }

  // Seed depuis le template metier
  const tpl = BUSINESS_TEMPLATES[templateId];
  if (!tpl?.defaultServices?.length) {
    const { data, error } = await supabase
      .from('services')
      .insert({
        tenant_id: tenantId,
        nom: 'Service Standard',
        duree: 60,
        prix: 5000,
        categorie: 'general',
        actif: true,
      })
      .select('id, nom, duree, prix, categorie, actif');
    if (error) console.error(`[PLTE Bootstrap] Service generic insert error ${tenantId}:`, error.message, error.details);
    if (data?.length) return data;
  } else {
    const rows = tpl.defaultServices.slice(0, 6).map(s => ({
      tenant_id: tenantId,
      nom: s.name,
      duree: s.duration,
      prix: s.price * 100,
      categorie: s.category || 'general',
      actif: true,
    }));

    const { data, error } = await supabase
      .from('services')
      .insert(rows)
      .select('id, nom, duree, prix, categorie, actif');
    if (error) {
      console.error(`[PLTE Bootstrap] Services template insert error ${tenantId} (${templateId}):`, error.message, error.details, error.code);
      // Retry individuellement si le batch a echoue
      for (const row of rows) {
        const { error: singleErr } = await supabase.from('services').insert(row);
        if (singleErr && singleErr.code !== '23505') { // Ignorer doublons
          console.error(`[PLTE Bootstrap] Service single insert error ${tenantId}:`, row.nom, singleErr.message);
        }
      }
    }
    if (data?.length) return data;
  }

  // Retry final
  const { data: retry } = await supabase
    .from('services')
    .select('id, nom, duree, prix, categorie, actif')
    .eq('tenant_id', tenantId)
    .limit(20);
  console.log(`[PLTE Bootstrap] Services retry ${tenantId}: ${retry?.length || 0} found`);
  return retry || [];
}

// ============================================
// CLIENTS TEST
// ============================================

async function ensureTestClients(tenantId) {
  const { data: existing } = await supabase
    .from('clients')
    .select('id, nom, prenom, email, telephone')
    .eq('tenant_id', tenantId)
    .like('email', '%@plte.internal')
    .limit(5);

  if (existing?.length >= 3) return existing;

  const testClients = [
    { nom: `${TEST_PREFIX}Martin`, prenom: 'Alice', email: `alice.martin.${tenantId}@plte.internal`, telephone: '0600000001' },
    { nom: `${TEST_PREFIX}Dupont`, prenom: 'Bruno', email: `bruno.dupont.${tenantId}@plte.internal`, telephone: '0600000002' },
    { nom: `${TEST_PREFIX}Leroy`, prenom: 'Claire', email: `claire.leroy.${tenantId}@plte.internal`, telephone: '0600000003' },
  ];

  const rows = testClients.map(c => ({
    tenant_id: tenantId,
    ...c,
    created_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('clients')
    .upsert(rows, { onConflict: 'tenant_id,email' })
    .select('id, nom, prenom, email, telephone');

  if (error) console.error(`[PLTE Bootstrap] Clients upsert error ${tenantId}:`, error.message);

  // Retry: re-query si upsert a echoue mais clients existent deja
  if (!data?.length) {
    const { data: retry } = await supabase
      .from('clients')
      .select('id, nom, prenom, email, telephone')
      .eq('tenant_id', tenantId)
      .like('email', '%@plte.internal')
      .limit(5);
    return retry || [];
  }

  return data;
}

// ============================================
// HORAIRES
// ============================================

async function ensureBusinessHours(tenantId, templateId) {
  const { data: existing } = await supabase
    .from('business_hours')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1);

  if (existing?.length) return;

  const tpl = BUSINESS_TEMPLATES[templateId];
  const hours = tpl?.defaultHours || {
    monday: { open: '09:00', close: '18:00' },
    tuesday: { open: '09:00', close: '18:00' },
    wednesday: { open: '09:00', close: '18:00' },
    thursday: { open: '09:00', close: '18:00' },
    friday: { open: '09:00', close: '18:00' },
    saturday: null,
    sunday: null,
  };

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const rows = days.map(day => ({
    tenant_id: tenantId,
    day_of_week: day,
    is_open: hours[day] !== null,
    open_time: hours[day]?.open || null,
    close_time: hours[day]?.close || null,
  }));

  await supabase.from('business_hours').insert(rows);
}

// ============================================
// SEED SPECIFIQUE PAR PROFIL
// ============================================

async function seedProfileData(tenantId, profile) {
  const result = {};

  switch (profile) {
    case 'salon':
      result.employes = await seedEmployes(tenantId, [
        { nom: `${TEST_PREFIX}Coiffeuse_A`, prenom: 'Marie', poste: 'coiffeuse' },
        { nom: `${TEST_PREFIX}Coiffeur_B`, prenom: 'Julien', poste: 'coiffeur' },
        { nom: `${TEST_PREFIX}Apprenti_C`, prenom: 'Lea', poste: 'apprenti' },
      ]);
      result.produits = await seedProduits(tenantId, [
        { nom: `${TEST_PREFIX}Shampooing Pro`, prix: 1500, stock: 20, reference: 'SHP-001' },
        { nom: `${TEST_PREFIX}Masque Keratine`, prix: 2500, stock: 15, reference: 'MSK-001' },
        { nom: `${TEST_PREFIX}Huile Argan`, prix: 1800, stock: 10, reference: 'HUA-001' },
        { nom: `${TEST_PREFIX}Gel Coiffant`, prix: 1200, stock: 25, reference: 'GEL-001' },
        { nom: `${TEST_PREFIX}Laque Fixation`, prix: 900, stock: 30, reference: 'LAQ-001' },
      ]);
      break;

    case 'restaurant':
      result.tables = await seedTables(tenantId);
      break;

    case 'commerce':
      result.produits = await seedProduits(tenantId, [
        { nom: `${TEST_PREFIX}Burger Classic`, prix: 890, stock: 50, reference: 'BUR-001' },
        { nom: `${TEST_PREFIX}Frites`, prix: 350, stock: 100, reference: 'FRI-001' },
        { nom: `${TEST_PREFIX}Coca-Cola`, prix: 250, stock: 200, reference: 'COC-001' },
        { nom: `${TEST_PREFIX}Milkshake`, prix: 450, stock: 30, reference: 'MLK-001' },
        { nom: `${TEST_PREFIX}Nuggets x6`, prix: 490, stock: 80, reference: 'NUG-001' },
        { nom: `${TEST_PREFIX}Salade Caesar`, prix: 790, stock: 20, reference: 'SAL-001' },
        { nom: `${TEST_PREFIX}Glace`, prix: 350, stock: 40, reference: 'GLA-001' },
        { nom: `${TEST_PREFIX}Wrap Poulet`, prix: 690, stock: 35, reference: 'WRP-001' },
        { nom: `${TEST_PREFIX}Eau minerale`, prix: 150, stock: 300, reference: 'EAU-001' },
        { nom: `${TEST_PREFIX}Cookie`, prix: 200, stock: 60, reference: 'COO-001' },
      ]);
      await seedProductStock(tenantId);
      break;

    case 'hotel':
      result.chambres = await seedChambres(tenantId);
      break;

    case 'securite':
      result.agents = await seedEmployes(tenantId, [
        { nom: `${TEST_PREFIX}Agent_Alpha`, prenom: 'Marc', poste: 'agent_securite' },
        { nom: `${TEST_PREFIX}Agent_Beta`, prenom: 'Sarah', poste: 'agent_securite' },
        { nom: `${TEST_PREFIX}Chef_Equipe`, prenom: 'Paul', poste: 'chef_equipe' },
      ]);
      result.sites = await seedSites(tenantId);
      break;

    case 'domicile':
      result.zones = await seedZonesIntervention(tenantId);
      break;

    case 'consulting':
      // Les services consulting ont deja pricing_mode='hourly' dans le template
      break;

    case 'events':
      // Les forfaits multi-jours sont deja dans le template event_wedding
      break;
  }

  return result;
}

// ============================================
// SEED HELPERS
// ============================================

async function seedEmployes(tenantId, employes) {
  const { data: existing } = await supabase
    .from('rh_membres')
    .select('id, nom, prenom, poste')
    .eq('tenant_id', tenantId)
    .like('nom', `${TEST_PREFIX}%`)
    .limit(10);

  if (existing?.length >= employes.length) return existing;

  const rows = employes.map(e => ({
    tenant_id: tenantId,
    ...e,
    statut: 'actif',
    date_embauche: '2024-01-01',
    created_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('rh_membres')
    .upsert(rows, { onConflict: 'tenant_id,nom' })
    .select('id, nom, prenom, poste');

  if (error) console.error(`[PLTE Bootstrap] seedEmployes error ${tenantId}:`, error.message, error.details, error.code);
  console.log(`[PLTE Bootstrap] seedEmployes ${tenantId}: ${data?.length || 0} employes (existing: ${existing?.length || 0})`);
  return data || existing || [];
}

async function seedProduits(tenantId, produits) {
  const { data: existing } = await supabase
    .from('produits')
    .select('id, nom, prix, stock_actuel, reference')
    .eq('tenant_id', tenantId)
    .like('nom', `${TEST_PREFIX}%`)
    .limit(20);

  if (existing?.length >= produits.length) return existing;

  const rows = produits.map(p => ({
    tenant_id: tenantId,
    nom: p.nom,
    prix: p.prix,
    stock_actuel: p.stock,
    stock_minimum: 5,
    reference: p.reference,
    actif: true,
    created_at: new Date().toISOString(),
  }));

  const { data } = await supabase
    .from('produits')
    .upsert(rows, { onConflict: 'tenant_id,reference' })
    .select('id, nom, prix, stock_actuel, reference');

  return data || existing || [];
}

async function seedTables(tenantId) {
  // Verifier si tables existent deja
  const { data: existing } = await supabase
    .from('restaurant_tables')
    .select('id, numero, capacite, zone')
    .eq('tenant_id', tenantId)
    .limit(20);

  if (existing?.length >= 3) return existing;

  const tables = [
    { numero: 1, capacite: 2, zone: 'salle', statut: 'libre' },
    { numero: 2, capacite: 4, zone: 'salle', statut: 'libre' },
    { numero: 3, capacite: 6, zone: 'salle', statut: 'libre' },
    { numero: 4, capacite: 2, zone: 'terrasse', statut: 'libre' },
    { numero: 5, capacite: 4, zone: 'terrasse', statut: 'libre' },
    { numero: 6, capacite: 8, zone: 'salle_privee', statut: 'libre' },
  ];

  const rows = tables.map(t => ({ tenant_id: tenantId, ...t }));

  try {
    const { data } = await supabase
      .from('restaurant_tables')
      .upsert(rows, { onConflict: 'tenant_id,numero' })
      .select('id, numero, capacite, zone');
    return data || [];
  } catch {
    // Table restaurant_tables may not exist yet
    return existing || [];
  }
}

async function seedChambres(tenantId) {
  const { data: existing } = await supabase
    .from('hotel_chambres')
    .select('id, numero, type, capacite, prix_nuit')
    .eq('tenant_id', tenantId)
    .limit(20);

  if (existing?.length >= 3) return existing;

  const chambres = [
    { numero: '101', type: 'simple', capacite: 1, prix_nuit: 8900, etage: 1, statut: 'disponible' },
    { numero: '102', type: 'simple', capacite: 1, prix_nuit: 8900, etage: 1, statut: 'disponible' },
    { numero: '201', type: 'double', capacite: 2, prix_nuit: 12900, etage: 2, statut: 'disponible' },
    { numero: '202', type: 'double', capacite: 2, prix_nuit: 12900, etage: 2, statut: 'disponible' },
    { numero: '301', type: 'suite', capacite: 4, prix_nuit: 24900, etage: 3, statut: 'disponible' },
  ];

  const rows = chambres.map(c => ({ tenant_id: tenantId, ...c }));

  const { data, error } = await supabase
    .from('hotel_chambres')
    .upsert(rows, { onConflict: 'tenant_id,numero' })
    .select('id, numero, type, capacite, prix_nuit');

  if (error) console.error(`[PLTE Bootstrap] seedChambres error ${tenantId}:`, error.message, error.details, error.code);
  console.log(`[PLTE Bootstrap] seedChambres ${tenantId}: ${data?.length || 0} chambres (existing: ${existing?.length || 0})`);
  return data || existing || [];
}

async function seedSites(tenantId) {
  const { data: existing } = await supabase
    .from('security_sites')
    .select('id, nom, adresse, type_site')
    .eq('tenant_id', tenantId)
    .limit(10);

  if (existing?.length >= 2) return existing;

  const sites = [
    { nom: `${TEST_PREFIX}Site_Logistique`, adresse: '12 rue des Entrepots, 93100 Montreuil', type_site: 'entrepot' },
    { nom: `${TEST_PREFIX}Site_Bureau`, adresse: '45 avenue de la Republique, 75011 Paris', type_site: 'bureau' },
    { nom: `${TEST_PREFIX}Site_Evenement`, adresse: '2 place de la Concorde, 75008 Paris', type_site: 'evenementiel' },
  ];

  const rows = sites.map(s => ({ tenant_id: tenantId, ...s, actif: true }));

  const { data, error } = await supabase
    .from('security_sites')
    .upsert(rows, { onConflict: 'tenant_id,nom' })
    .select('id, nom, adresse, type_site');

  if (error) console.error(`[PLTE Bootstrap] seedSites error ${tenantId}:`, error.message, error.details, error.code);
  console.log(`[PLTE Bootstrap] seedSites ${tenantId}: ${data?.length || 0} sites (existing: ${existing?.length || 0})`);
  return data || existing || [];
}

async function seedZonesIntervention(tenantId) {
  const { data: existing } = await supabase
    .from('zones_intervention')
    .select('id, nom, rayon_km, frais_deplacement')
    .eq('tenant_id', tenantId)
    .limit(10);

  if (existing?.length >= 2) return existing;

  const zones = [
    { nom: `${TEST_PREFIX}Zone_Paris`, rayon_km: 5, frais_deplacement: 0, code_postal: '75000' },
    { nom: `${TEST_PREFIX}Zone_IDF_Proche`, rayon_km: 20, frais_deplacement: 1500, code_postal: '92000' },
    { nom: `${TEST_PREFIX}Zone_IDF_Elargi`, rayon_km: 50, frais_deplacement: 3500, code_postal: '77000' },
  ];

  const rows = zones.map(z => ({ tenant_id: tenantId, ...z, actif: true }));

  const { data, error } = await supabase
    .from('zones_intervention')
    .upsert(rows, { onConflict: 'tenant_id,nom' })
    .select('id, nom, rayon_km, frais_deplacement');

  if (error) console.error(`[PLTE Bootstrap] seedZones error ${tenantId}:`, error.message, error.details, error.code);
  console.log(`[PLTE Bootstrap] seedZones ${tenantId}: ${data?.length || 0} zones (existing: ${existing?.length || 0})`);
  return data || existing || [];
}

/**
 * Seed product_stock pour le profil commerce (necessaire pour N15_order_cycle)
 */
export async function seedProductStock(tenantId) {
  try {
    const { data: produits } = await supabase
      .from('produits')
      .select('id')
      .eq('tenant_id', tenantId)
      .like('nom', `${TEST_PREFIX}%`)
      .limit(20);

    if (!produits?.length) return;

    for (const p of produits) {
      const { data: existing } = await supabase
        .from('product_stock')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('product_id', p.id)
        .limit(1);

      if (existing?.length) continue;

      await supabase.from('product_stock').insert({
        tenant_id: tenantId,
        product_id: p.id,
        quantity: 50,
        reserved_quantity: 0,
      });
    }
  } catch { /* product_stock table may not exist */ }
}

/**
 * Nettoie toutes les donnees de test PLTE pour un tenant
 */
export async function cleanupPlteData(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const tables = [
    { table: 'ecritures_comptables', field: 'numero_piece' },
    { table: 'factures', field: 'numero' },
    { table: 'reservations', field: 'service_nom' },
    { table: 'devis', field: 'numero' },
    { table: 'marketing_campaigns', field: 'name' },
    { table: 'social_posts', field: 'content' },
    { table: 'quotes', field: 'reference' },
    { table: 'orders', field: 'customer_name' },
    { table: 'avis_clients', field: 'commentaire' },
  ];

  for (const { table, field } of tables) {
    try {
      await supabase
        .from(table)
        .delete()
        .eq('tenant_id', tenantId)
        .like(field, `${TEST_PREFIX}%`);
    } catch { /* table may not exist */ }
  }

  // Cleanup crm_contacts et hr_employees par email PLTE
  for (const table of ['crm_contacts', 'hr_employees']) {
    try {
      await supabase
        .from(table)
        .delete()
        .eq('tenant_id', tenantId)
        .like('email', '%@plte.internal');
    } catch { /* table may not exist */ }
  }

  // Cleanup reservations + loyalty transactions + factures par client PLTE
  try {
    const { data: testClients } = await supabase
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .like('email', '%@plte.internal');

    if (testClients?.length) {
      const ids = testClients.map(c => c.id);

      // Supprimer ecritures comptables liees aux factures PLTE
      try {
        const { data: plteFactures } = await supabase
          .from('factures')
          .select('id')
          .eq('tenant_id', tenantId)
          .in('client_id', ids);

        if (plteFactures?.length) {
          const factureIds = plteFactures.map(f => f.id);
          await supabase
            .from('ecritures_comptables')
            .delete()
            .eq('tenant_id', tenantId)
            .in('facture_id', factureIds);
        }
      } catch { /* non-blocking */ }

      // Supprimer factures par client PLTE
      try {
        await supabase
          .from('factures')
          .delete()
          .eq('tenant_id', tenantId)
          .in('client_id', ids);
      } catch { /* non-blocking */ }

      // Supprimer reservations par client PLTE (fix conflit H1)
      try {
        await supabase
          .from('reservations')
          .delete()
          .eq('tenant_id', tenantId)
          .in('client_id', ids);
      } catch { /* non-blocking */ }

      // Supprimer loyalty transactions
      try {
        await supabase
          .from('loyalty_transactions')
          .delete()
          .eq('tenant_id', tenantId)
          .in('client_id', ids);
      } catch { /* non-blocking */ }
    }
  } catch { /* non-blocking */ }

  // Cleanup rh_bulletins_paie avant rh_membres
  try {
    const { data: testMembres } = await supabase
      .from('rh_membres')
      .select('id')
      .eq('tenant_id', tenantId)
      .like('nom', `${TEST_PREFIX}%`);

    if (testMembres?.length) {
      const ids = testMembres.map(e => e.id);
      await supabase
        .from('rh_bulletins_paie')
        .delete()
        .eq('tenant_id', tenantId)
        .in('membre_id', ids);
    }
  } catch { /* non-blocking */ }
}

/**
 * Supprime completement un tenant ephemere E2E (cascading delete)
 * Utilise par les tests E2E pour nettoyer les tenants crees pendant les tests
 */
export async function cleanupE2ETenant(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  console.log(`[PLTE E2E Cleanup] Suppression tenant ${tenantId}...`);

  // Ordre de suppression: dependances d'abord, tenant en dernier
  const cascadeTables = [
    'admin_sessions',
    'invitations',
    'loyalty_transactions',
    'avis_clients',
    'ecritures_comptables',
    'factures',
    'reservations',
    'services',
    'business_hours',
    'clients',
    'usage_tracking',
    'rh_bulletins_paie',
    'rh_membres',
    'produits',
    'product_stock',
    'marketing_campaigns',
    'social_posts',
    'devis',
    'orders',
    'quotes',
    'crm_contacts',
    'hr_employees',
    'hotel_chambres',
    'restaurant_tables',
    'security_sites',
    'zones_intervention',
    'sentinel_logic_tests',
    'sentinel_logic_runs',
    'admin_users',
  ];

  for (const table of cascadeTables) {
    try {
      await supabase
        .from(table)
        .delete()
        .eq('tenant_id', tenantId);
    } catch { /* table may not exist or no rows — non-blocking */ }
  }

  // Finally delete the tenant itself
  try {
    await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId);
  } catch (err) {
    console.error(`[PLTE E2E Cleanup] Erreur suppression tenant ${tenantId}:`, err.message);
  }

  console.log(`[PLTE E2E Cleanup] Tenant ${tenantId} supprime`);
}
