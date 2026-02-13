#!/usr/bin/env node
/**
 * Populate Tenant Test - nexus-test (ID: 3)
 * Script de peuplement des donnees de test
 * Adapte au schema reel des tables Supabase
 *
 * Usage: node backend/scripts/populate-tenant-test.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const TENANT_ID = 'nexus-test';

// Donnees de test
const PRENOMS = ['Marie', 'Pierre', 'Sophie', 'Jean', 'Emma', 'Lucas', 'Lea', 'Thomas', 'Julie', 'Antoine', 'Camille', 'Nicolas', 'Sarah', 'Alexandre', 'Laura', 'Maxime', 'Chloe', 'Hugo', 'Manon', 'Paul'];
const NOMS = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier'];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPhone() {
  // Format: 0612345678 (sans espaces)
  const prefix = Math.random() > 0.5 ? '06' : '07';
  const num = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `${prefix}${num}`;
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function populateServices() {
  console.log('📦 Creation services...');

  // Schema reel: id, nom, description, duree, prix, ordre, tenant_id, taux_tva, prix_variable, prix_min, prix_max
  const services = [
    { nom: 'Consultation Standard', prix: 5000, duree: 60, description: 'Consultation de base', ordre: 1 },
    { nom: 'Consultation Express', prix: 3000, duree: 30, description: 'Consultation rapide', ordre: 2 },
    { nom: 'Diagnostic Complet', prix: 12000, duree: 120, description: 'Diagnostic approfondi', ordre: 3 },
    { nom: 'Formation Initiale', prix: 15000, duree: 90, description: 'Formation de base', ordre: 4 },
    { nom: 'Audit Approfondi', prix: 25000, duree: 180, description: 'Audit complet', ordre: 5 },
    { nom: 'Accompagnement Premium', prix: 35000, duree: 240, description: 'Accompagnement VIP', ordre: 6 },
    { nom: 'Pack Demarrage', prix: 45000, duree: 180, description: 'Pack pour nouveaux clients', ordre: 7 },
    { nom: 'Pack Pro', prix: 80000, duree: 300, description: 'Pack professionnel', ordre: 8 },
    { nom: 'Intervention Urgente', prix: 20000, duree: 60, description: 'Intervention rapide', ordre: 9 },
    { nom: 'Suivi Mensuel', prix: 50000, duree: 120, description: 'Suivi regulier', ordre: 10 }
  ].map(s => ({ ...s, tenant_id: TENANT_ID, taux_tva: 20 }));

  const { data, error } = await supabase.from('services').insert(services).select();
  if (error) throw new Error(`Services: ${error.message}`);
  console.log(`   ✓ ${data.length} services crees`);
  return data;
}

async function populateClients() {
  console.log('👥 Creation clients (50)...');

  // Schema reel: id, nom, prenom, telephone, email, tenant_id, ca_total, nb_rdv_total, derniere_visite, score_engagement
  const segments = [
    { type: 'new', count: 10, score: 20 },
    { type: 'active', count: 15, score: 50 },
    { type: 'loyal', count: 10, score: 80 },
    { type: 'vip', count: 5, score: 95 },
    { type: 'at_risk', count: 7, score: 30 },
    { type: 'lost', count: 3, score: 5 }
  ];

  const clients = [];
  for (const segment of segments) {
    for (let i = 0; i < segment.count; i++) {
      const prenom = randomElement(PRENOMS);
      const nom = randomElement(NOMS);

      clients.push({
        tenant_id: TENANT_ID,
        prenom: prenom,
        nom: nom,
        email: `${prenom.toLowerCase()}.${nom.toLowerCase()}${Math.floor(Math.random() * 100)}@test.com`,
        telephone: randomPhone(),
        ca_total: Math.floor(Math.random() * 500000),
        nb_rdv_total: Math.floor(Math.random() * 20),
        score_engagement: segment.score + Math.floor(Math.random() * 10)
      });
    }
  }

  const { data, error } = await supabase.from('clients').insert(clients).select();
  if (error) throw new Error(`Clients: ${error.message}`);
  console.log(`   ✓ ${data.length} clients crees`);
  return data;
}

async function populateReservations(clients, services) {
  console.log('📅 Creation reservations (200)...');

  // Schema reel: client_id, service_id, service_nom, date, heure, statut, prix_service, prix_total, duree_minutes, tenant_id
  const now = new Date();
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - 3);
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 3);

  const reservations = [];
  for (let i = 0; i < 200; i++) {
    const client = randomElement(clients);
    const service = randomElement(services);
    const rdvDate = randomDate(startDate, endDate);
    rdvDate.setHours(9 + Math.floor(Math.random() * 8));
    rdvDate.setMinutes(randomElement([0, 15, 30, 45]));

    const isPast = rdvDate < now;
    let statut;
    if (isPast) {
      statut = Math.random() > 0.1 ? 'termine' : 'annule';
    } else {
      statut = Math.random() > 0.2 ? 'confirme' : 'en_attente';
    }

    reservations.push({
      tenant_id: TENANT_ID,
      client_id: client.id,
      service_id: service.id,
      service_nom: service.nom,
      date: rdvDate.toISOString().split('T')[0],
      heure: rdvDate.toTimeString().split(' ')[0].substring(0, 5),
      duree_minutes: service.duree,
      statut: statut,
      prix_service: service.prix,
      prix_total: service.prix,
      notes: `RDV test #${i + 1}`,
      created_via: 'test_script'
    });
  }

  // Insert par batch de 50
  let inserted = 0;
  for (let i = 0; i < reservations.length; i += 50) {
    const batch = reservations.slice(i, i + 50);
    const { data, error } = await supabase.from('reservations').insert(batch).select();
    if (error) {
      console.warn(`   ⚠️ Batch ${i}: ${error.message}`);
    } else {
      inserted += data.length;
    }
  }
  console.log(`   ✓ ${inserted} reservations creees`);
  return reservations;
}

async function populateProduits() {
  console.log('📦 Creation produits (10)...');

  // Schema reel: tenant_id, sku, name, description, price, cost_price, tax_rate, is_active
  const produits = [
    { name: 'Guide Pratique', sku: 'GUIDE-001', price: 2900, cost_price: 500 },
    { name: 'Formation Video', sku: 'VIDEO-001', price: 9900, cost_price: 1000 },
    { name: 'Pack Outils', sku: 'PACK-001', price: 4900, cost_price: 1500 },
    { name: 'Abonnement Mensuel', sku: 'ABO-001', price: 4900, cost_price: 0 },
    { name: 'Abonnement Annuel', sku: 'ABO-012', price: 49000, cost_price: 0 },
    { name: 'Ebook Strategies', sku: 'EBOOK-001', price: 1900, cost_price: 200 },
    { name: 'Template Business', sku: 'TMPL-001', price: 3900, cost_price: 300 },
    { name: 'Coaching 1h', sku: 'COACH-001', price: 15000, cost_price: 5000 },
    { name: 'Audit Express', sku: 'AUDIT-001', price: 9900, cost_price: 3000 },
    { name: 'Support Premium', sku: 'SUP-001', price: 29900, cost_price: 10000 }
  ].map(p => ({
    ...p,
    tenant_id: TENANT_ID,
    is_active: true,
    tax_rate: 20,
    description: `Produit test: ${p.name}`
  }));

  const { data, error } = await supabase.from('products').insert(produits).select();
  if (error) {
    console.warn(`   ⚠️ Produits: ${error.message}`);
    return [];
  }
  console.log(`   ✓ ${data.length} produits crees`);
  return data;
}

async function populateFactures(clients) {
  console.log('💰 Creation factures (30)...');

  // Schema reel: tenant_id, invoice_number, client_name, client_email, client_phone, status, issue_date, due_date, subtotal, vat_amount, total
  const factures = [];
  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const client = randomElement(clients);
    const issueDate = randomDate(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), now);
    const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const subtotal = Math.floor(5000 + Math.random() * 50000);
    const vatAmount = Math.round(subtotal * 0.2);

    factures.push({
      tenant_id: TENANT_ID,
      invoice_number: `FAC-2026-${String(i + 1).padStart(4, '0')}`,
      client_name: `${client.prenom} ${client.nom}`,
      client_email: client.email,
      client_phone: client.telephone,
      status: Math.random() > 0.3 ? 'paid' : (Math.random() > 0.5 ? 'sent' : 'draft'),
      issue_date: issueDate.toISOString().split('T')[0],
      due_date: dueDate.toISOString().split('T')[0],
      subtotal: subtotal,
      vat_amount: vatAmount,
      total: subtotal + vatAmount
    });
  }

  const { data, error } = await supabase.from('invoices').insert(factures).select();
  if (error) {
    console.warn(`   ⚠️ Factures: ${error.message}`);
    return [];
  }
  console.log(`   ✓ ${data.length} factures creees`);
  return data;
}

async function populateExpenses() {
  console.log('💸 Creation depenses (20)...');

  const categories = ['loyer', 'fournitures', 'marketing', 'logiciels', 'transport', 'formation', 'divers'];
  const now = new Date();
  const depenses = [];

  for (let i = 0; i < 20; i++) {
    const date = randomDate(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), now);
    const category = randomElement(categories);
    depenses.push({
      tenant_id: TENANT_ID,
      description: `Depense ${category} #${i + 1}`,
      amount: Math.floor(50 + Math.random() * 500) * 100,
      category: category,
      date: date.toISOString().split('T')[0],
      status: 'paid'
    });
  }

  const { data, error } = await supabase.from('expenses').insert(depenses).select();
  if (error) {
    if (error.message.includes('Could not find')) {
      console.log('   ⚠️ Table expenses non existante - Migration requise');
      return [];
    }
    console.warn(`   ⚠️ Depenses: ${error.message}`);
    return [];
  }
  console.log(`   ✓ ${data.length} depenses creees`);
  return data;
}

async function populateTeamMembers() {
  console.log('👔 Creation equipe (5)...');

  const equipe = [
    { first_name: 'Admin', last_name: 'Test', email: 'admin@nexus-test.com', role: 'admin', poste: 'Administrateur' },
    { first_name: 'Marie', last_name: 'Dupont', email: 'marie@nexus-test.com', role: 'manager', poste: 'Manager' },
    { first_name: 'Jean', last_name: 'Martin', email: 'jean@nexus-test.com', role: 'employee', poste: 'Consultant' },
    { first_name: 'Sophie', last_name: 'Bernard', email: 'sophie@nexus-test.com', role: 'employee', poste: 'Consultante' },
    { first_name: 'Lucas', last_name: 'Petit', email: 'lucas@nexus-test.com', role: 'employee', poste: 'Assistant' }
  ].map(e => ({
    ...e,
    tenant_id: TENANT_ID,
    status: 'active',
    phone: randomPhone(),
    hire_date: '2024-01-15',
    monthly_salary: Math.floor(2500 + Math.random() * 3000) * 100
  }));

  const { data, error } = await supabase.from('team_members').insert(equipe).select();
  if (error) {
    if (error.message.includes('Could not find')) {
      console.log('   ⚠️ Table team_members non existante - Migration requise');
      return [];
    }
    console.warn(`   ⚠️ Equipe: ${error.message}`);
    return [];
  }
  console.log(`   ✓ ${data.length} membres equipe crees`);
  return data;
}

async function populateBusinessHours() {
  console.log('🕐 Configuration horaires...');

  const horaires = [
    { day_of_week: 1, open_time: '09:00', close_time: '18:00', is_closed: false },
    { day_of_week: 2, open_time: '09:00', close_time: '18:00', is_closed: false },
    { day_of_week: 3, open_time: '09:00', close_time: '18:00', is_closed: false },
    { day_of_week: 4, open_time: '09:00', close_time: '18:00', is_closed: false },
    { day_of_week: 5, open_time: '09:00', close_time: '18:00', is_closed: false },
    { day_of_week: 6, open_time: '10:00', close_time: '16:00', is_closed: false },
    { day_of_week: 0, open_time: null, close_time: null, is_closed: true }
  ].map(h => ({ ...h, tenant_id: TENANT_ID }));

  const { data, error } = await supabase.from('business_hours').insert(horaires).select();
  if (error) {
    if (error.message.includes('Could not find')) {
      console.log('   ⚠️ Table business_hours non existante - Migration requise');
      return [];
    }
    console.warn(`   ⚠️ Horaires: ${error.message}`);
    return [];
  }
  console.log(`   ✓ ${data.length} jours configures`);
  return data;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║       PEUPLEMENT TENANT TEST - nexus-test                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    // Verifier que le tenant existe
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', TENANT_ID)
      .single();

    if (!tenant) {
      console.error('❌ Tenant "nexus-test" non trouve');
      console.log('   Executez d\'abord: node backend/scripts/create-tenant-test.js');
      process.exit(1);
    }

    // Peupler les donnees
    const services = await populateServices();
    const clients = await populateClients();
    await populateReservations(clients, services);
    await populateProduits();
    await populateFactures(clients);

    // Tables optionnelles (peuvent ne pas exister)
    await populateExpenses();
    await populateTeamMembers();
    await populateBusinessHours();

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ TENANT TEST PEUPLE AVEC SUCCES !');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('📊 RESUME :');
    console.log(`   - 10 services`);
    console.log(`   - 50 clients (6 segments)`);
    console.log(`   - 200 reservations`);
    console.log(`   - 10 produits`);
    console.log(`   - 30 factures`);
    console.log(`   - 20 depenses (si table existe)`);
    console.log(`   - 5 membres equipe (si table existe)`);
    console.log(`   - 7 jours horaires (si table existe)\n`);

    console.log('🔗 ACCES :');
    console.log(`   curl -H "X-Tenant-ID: nexus-test" http://localhost:3000/api/clients`);
    console.log('');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
