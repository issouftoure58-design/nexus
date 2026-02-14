/**
 * Setup Test Tenant - Script complet
 * Crée le tenant nexus-test avec toutes les données fictives
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env
dotenv.config({ path: join(__dirname, '../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TENANT_ID = 'nexus-test';
const ADMIN_EMAIL = 'admin@nexus-test.com';
const ADMIN_PASSWORD = 'Test123!';

async function main() {
  console.log('🚀 Création du tenant test NEXUS...\n');

  try {
    // 1. Créer le tenant
    console.log('1️⃣ Création du tenant...');
    const { error: tenantError } = await supabase
      .from('tenants')
      .upsert({
        id: TENANT_ID,
        name: 'Salon Élégance Paris',
        domain: 'test.nexus.dev',
        plan: 'business',
        status: 'active',
        slug: 'salon-elegance',
        assistant_name: 'Sophie',
        gerante: 'Marie Dupont',
        telephone: '+33 1 23 45 67 89',
        adresse: '123 Avenue des Champs-Élysées, 75008 Paris',
        concept: 'Salon de coiffure haut de gamme spécialisé dans les soins capillaires et les colorations naturelles',
        secteur: 'salon',
        ville: 'Paris',
        frozen: false,
        nexus_version: '2.0',
        features: {
          agent_ia_web: true,
          agent_ia_whatsapp: true,
          agent_ia_telephone: true,
          reservations: true,
          facturation: true,
          comptabilite: true,
          stock: true,
          marketing: true,
          crm_avance: true,
          rh: true,
          analytics: true,
          seo: true,
          sentinel: true,
          api: true,
          white_label: true
        },
        limits_config: {
          telephone_minutes: 1200,
          whatsapp_messages: 5000,
          web_messages: -1,
          posts_ia: 1000,
          images_ia: 1000,
          clients_max: -1,
          storage_gb: -1,
          users_max: 10
        },
        branding: {
          primary_color: '#0891b2',
          logo_url: null,
          favicon_url: null
        }
      }, { onConflict: 'id' });

    if (tenantError) throw tenantError;
    console.log('   ✅ Tenant créé: ' + TENANT_ID);

    // 2. Créer l'admin user
    console.log('\n2️⃣ Création de l\'admin user...');
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    const { error: adminError } = await supabase
      .from('admin_users')
      .upsert({
        email: ADMIN_EMAIL,
        password_hash: passwordHash,
        nom: 'Marie Dupont',
        role: 'admin',
        actif: true,
        tenant_id: TENANT_ID
      }, { onConflict: 'email' });

    if (adminError) throw adminError;
    console.log('   ✅ Admin créé: ' + ADMIN_EMAIL);
    console.log('   🔑 Mot de passe: ' + ADMIN_PASSWORD);

    // 3. Créer les services
    console.log('\n3️⃣ Création des services...');
    const services = [
      { nom: 'Coupe Femme', description: 'Coupe, shampoing et brushing', prix: 4500, duree: 45, ordre: 1 },
      { nom: 'Coupe Homme', description: 'Coupe classique homme', prix: 2500, duree: 30, ordre: 2 },
      { nom: 'Coupe Enfant', description: 'Coupe pour enfants (-12 ans)', prix: 1800, duree: 20, ordre: 3 },
      { nom: 'Brushing', description: 'Brushing simple', prix: 3000, duree: 30, ordre: 4 },
      { nom: 'Brushing Long', description: 'Brushing cheveux longs', prix: 4000, duree: 45, ordre: 5 },
      { nom: 'Coloration', description: 'Coloration complète', prix: 6500, duree: 90, ordre: 6 },
      { nom: 'Mèches', description: 'Mèches ou balayage', prix: 8500, duree: 120, ordre: 7 },
      { nom: 'Coloration + Mèches', description: 'Coloration complète avec mèches', prix: 12000, duree: 150, ordre: 8 },
      { nom: 'Lissage Brésilien', description: 'Lissage brésilien professionnel', prix: 15000, duree: 180, ordre: 9 },
      { nom: 'Soin Kératine', description: 'Soin à la kératine', prix: 8000, duree: 60, ordre: 10 },
      { nom: 'Coupe + Coloration', description: 'Forfait coupe et coloration', prix: 9500, duree: 120, ordre: 11 },
      { nom: 'Forfait Mariée', description: 'Essai + Jour J coiffure mariée', prix: 25000, duree: 240, ordre: 12 },
    ].map(s => ({ ...s, tenant_id: TENANT_ID }));

    const { error: servicesError } = await supabase.from('services').insert(services);
    if (servicesError) console.log('   ⚠️ Services:', servicesError.message);
    else console.log('   ✅ ' + services.length + ' services créés');

    // 4. Créer les clients
    console.log('\n4️⃣ Création des clients...');
    const clients = [
      { nom: 'Martin', prenom: 'Sophie', email: 'sophie.martin@email.com', telephone: '0612345678' },
      { nom: 'Dubois', prenom: 'Julie', email: 'julie.dubois@email.com', telephone: '0623456789' },
      { nom: 'Bernard', prenom: 'Marie', email: 'marie.bernard@email.com', telephone: '0634567890' },
      { nom: 'Petit', prenom: 'Léa', email: 'lea.petit@email.com', telephone: '0645678901' },
      { nom: 'Robert', prenom: 'Emma', email: 'emma.robert@email.com', telephone: '0656789012' },
      { nom: 'Richard', prenom: 'Camille', email: 'camille.richard@email.com', telephone: '0667890123' },
      { nom: 'Moreau', prenom: 'Chloé', email: 'chloe.moreau@email.com', telephone: '0678901234' },
      { nom: 'Simon', prenom: 'Inès', email: 'ines.simon@email.com', telephone: '0689012345' },
      { nom: 'Laurent', prenom: 'Manon', email: 'manon.laurent@email.com', telephone: '0690123456' },
      { nom: 'Michel', prenom: 'Clara', email: 'clara.michel@email.com', telephone: '0611234567' },
      { nom: 'Garcia', prenom: 'Lucas', email: 'lucas.garcia@email.com', telephone: '0611223344' },
      { nom: 'Martinez', prenom: 'Thomas', email: 'thomas.martinez@email.com', telephone: '0622334455' },
      { nom: 'Lopez', prenom: 'Antoine', email: 'antoine.lopez@email.com', telephone: '0633445566' },
      { nom: 'Hernandez', prenom: 'Hugo', email: 'hugo.hernandez@email.com', telephone: '0644556677' },
      { nom: 'Gonzalez', prenom: 'Paul', email: 'paul.gonzalez@email.com', telephone: '0655667788' },
    ].map(c => ({ ...c, tenant_id: TENANT_ID }));

    const { data: createdClients, error: clientsError } = await supabase
      .from('clients')
      .insert(clients)
      .select('id');

    if (clientsError) console.log('   ⚠️ Clients:', clientsError.message);
    else console.log('   ✅ ' + clients.length + ' clients créés');

    // 5. Créer les réservations
    console.log('\n5️⃣ Création des réservations...');

    // Get service IDs
    const { data: serviceData } = await supabase
      .from('services')
      .select('id, prix, duree, nom')
      .eq('tenant_id', TENANT_ID);

    // Get client IDs
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, telephone')
      .eq('tenant_id', TENANT_ID);

    if (serviceData && clientData && serviceData.length > 0 && clientData.length > 0) {
      const reservations = [];
      const heures = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];
      const sources = ['site', 'telephone', 'whatsapp', 'instagram'];
      const statuts = ['confirme', 'en_attente', 'demande'];

      // Réservations passées (50)
      for (let i = 0; i < 50; i++) {
        const service = serviceData[Math.floor(Math.random() * serviceData.length)];
        const client = clientData[Math.floor(Math.random() * clientData.length)];
        const daysAgo = Math.floor(Math.random() * 90) + 1;
        const dateObj = new Date();
        dateObj.setDate(dateObj.getDate() - daysAgo);

        reservations.push({
          tenant_id: TENANT_ID,
          client_id: client.id,
          service_id: service.id,
          service_nom: service.nom,
          date: dateObj.toISOString().split('T')[0],
          heure: heures[Math.floor(Math.random() * heures.length)],
          duree_minutes: service.duree,
          statut: 'termine',
          prix_service: service.prix,
          prix_total: service.prix,
          telephone: client.telephone,
          created_via: sources[Math.floor(Math.random() * sources.length)]
        });
      }

      // Réservations aujourd'hui (6)
      const today = new Date().toISOString().split('T')[0];
      const todayHeures = ['09:00', '10:30', '11:30', '14:00', '15:30', '17:00'];
      for (let i = 0; i < 6; i++) {
        const service = serviceData[Math.floor(Math.random() * serviceData.length)];
        const client = clientData[Math.floor(Math.random() * clientData.length)];

        reservations.push({
          tenant_id: TENANT_ID,
          client_id: client.id,
          service_id: service.id,
          service_nom: service.nom,
          date: today,
          heure: todayHeures[i],
          duree_minutes: service.duree,
          statut: i < 3 ? 'termine' : 'confirme',
          prix_service: service.prix,
          prix_total: service.prix,
          telephone: client.telephone,
          created_via: 'site'
        });
      }

      // Réservations futures (25)
      for (let i = 0; i < 25; i++) {
        const service = serviceData[Math.floor(Math.random() * serviceData.length)];
        const client = clientData[Math.floor(Math.random() * clientData.length)];
        const daysAhead = Math.floor(Math.random() * 14) + 1;
        const dateObj = new Date();
        dateObj.setDate(dateObj.getDate() + daysAhead);

        reservations.push({
          tenant_id: TENANT_ID,
          client_id: client.id,
          service_id: service.id,
          service_nom: service.nom,
          date: dateObj.toISOString().split('T')[0],
          heure: heures[Math.floor(Math.random() * heures.length)],
          duree_minutes: service.duree,
          statut: statuts[Math.floor(Math.random() * statuts.length)],
          prix_service: service.prix,
          prix_total: service.prix,
          telephone: client.telephone,
          created_via: sources[Math.floor(Math.random() * sources.length)]
        });
      }

      const { error: rdvError } = await supabase.from('reservations').insert(reservations);
      if (rdvError) console.log('   ⚠️ Réservations:', rdvError.message);
      else console.log('   ✅ ' + reservations.length + ' réservations créées');
    }

    // 6. Créer les produits (stock)
    console.log('\n6️⃣ Création des produits...');
    const produits = [
      { reference: 'SHP-001', nom: 'Shampoing Kérastase Nutritive', prix_achat_unitaire: 1200, prix_vente_unitaire: 2800, stock_actuel: 15, stock_minimum: 5, categorie: 'Shampoings' },
      { reference: 'SHP-002', nom: 'Shampoing Kérastase Chronologiste', prix_achat_unitaire: 1500, prix_vente_unitaire: 3200, stock_actuel: 12, stock_minimum: 5, categorie: 'Shampoings' },
      { reference: 'SOI-001', nom: 'Après-shampoing Nutritive', prix_achat_unitaire: 1400, prix_vente_unitaire: 3000, stock_actuel: 18, stock_minimum: 5, categorie: 'Soins' },
      { reference: 'SOI-002', nom: 'Masque Chronologiste', prix_achat_unitaire: 2500, prix_vente_unitaire: 4800, stock_actuel: 8, stock_minimum: 3, categorie: 'Soins' },
      { reference: 'SOI-003', nom: 'Huile Elixir Ultime', prix_achat_unitaire: 2000, prix_vente_unitaire: 4200, stock_actuel: 20, stock_minimum: 5, categorie: 'Soins' },
      { reference: 'COL-001', nom: 'Coloration LOréal Majirel', prix_achat_unitaire: 450, prix_vente_unitaire: 0, stock_actuel: 45, stock_minimum: 15, categorie: 'Colorations' },
      { reference: 'COL-002', nom: 'Oxydant 20 volumes', prix_achat_unitaire: 800, prix_vente_unitaire: 0, stock_actuel: 8, stock_minimum: 3, categorie: 'Colorations' },
      { reference: 'COI-001', nom: 'Spray Fixant', prix_achat_unitaire: 800, prix_vente_unitaire: 1800, stock_actuel: 25, stock_minimum: 8, categorie: 'Coiffage' },
      { reference: 'COI-002', nom: 'Mousse Coiffante', prix_achat_unitaire: 700, prix_vente_unitaire: 1600, stock_actuel: 20, stock_minimum: 6, categorie: 'Coiffage' },
      { reference: 'CON-001', nom: 'Serviettes jetables', prix_achat_unitaire: 500, prix_vente_unitaire: 0, stock_actuel: 3, stock_minimum: 2, categorie: 'Consommables' },
    ].map(p => ({ ...p, tenant_id: TENANT_ID, actif: true, unite: 'piece' }));

    const { error: prodError } = await supabase.from('produits').insert(produits);
    if (prodError) console.log('   ⚠️ Produits:', prodError.message);
    else console.log('   ✅ ' + produits.length + ' produits créés');

    // 7. Créer les segments CRM
    console.log('\n7️⃣ Création des segments CRM...');
    const segments = [
      { name: 'VIP', description: 'Clients à forte valeur', criteria: { min_total_spent: 50000 } },
      { name: 'Inactifs', description: 'Sans visite depuis 3 mois', criteria: { last_visit_days_ago: 90 } },
      { name: 'Nouveaux', description: 'Inscrits ce mois', criteria: { registered_days_ago: 30 } },
      { name: 'Colorations', description: 'Fidèles colorations', criteria: { services_categories: ['Coloration'] } },
      { name: 'Anniversaire ce mois', description: 'Anniversaire ce mois', criteria: { birthday_this_month: true } },
    ].map(s => ({ ...s, tenant_id: TENANT_ID, is_active: true }));

    const { error: segError } = await supabase.from('customer_segments').insert(segments);
    if (segError) console.log('   ⚠️ Segments:', segError.message);
    else console.log('   ✅ ' + segments.length + ' segments créés');

    // 8. Résumé
    console.log('\n' + '═'.repeat(50));
    console.log('✅ TENANT TEST CRÉÉ AVEC SUCCÈS!');
    console.log('═'.repeat(50));
    console.log('\n📋 Informations de connexion:');
    console.log('   URL:      http://localhost:3001');
    console.log('   Email:    ' + ADMIN_EMAIL);
    console.log('   Password: ' + ADMIN_PASSWORD);
    console.log('\n📊 Données générées:');
    console.log('   - 12 services');
    console.log('   - 15 clients');
    console.log('   - ~81 réservations');
    console.log('   - 10 produits en stock');
    console.log('   - 5 segments CRM');
    console.log('\n🎯 Plan: Business (toutes fonctionnalités)');
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();
