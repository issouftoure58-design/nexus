/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROVISIONING SCRIPT - Tenants Restaurant & Hotel
 *
 * Crée 2 tenants de test pour valider les types de business:
 *   - test-restaurant : Restaurant avec gestion de tables
 *   - test-hotel      : Hôtel avec gestion de chambres
 *
 * Usage: node scripts/provision-restaurant-hotel.js [--reset]
 * ═══════════════════════════════════════════════════════════════════════════
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger .env AVANT tout import de supabase
dotenv.config({ path: join(__dirname, '../.env') });

// Import dynamique après chargement env
const { supabase } = await import('../src/config/supabase.js');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION DES TENANTS
// ═══════════════════════════════════════════════════════════════════════════

const TENANTS_CONFIG = {
  // ─────────────────────────────────────────────────────────────────────────
  // RESTAURANT
  // ─────────────────────────────────────────────────────────────────────────
  'test-restaurant': {
    tenant: {
      id: 'test-restaurant',
      nom: 'Le Petit Bistrot',
      domain: 'lepetitbistrot.test',
      plan: 'pro',
      status: 'active',
      business_profile: 'restaurant',
      profile_config: JSON.stringify({
        service_types: ['midi', 'soir'],
        slot_duration: 90,
        max_covers: 60
      }),
      location_config: JSON.stringify({
        mode: 'fixed',
        address: '12 rue de la Paix, 75002 Paris',
        zone: 'Paris Centre'
      }),
      contact_config: JSON.stringify({
        phone: '+33145678901',
        email: 'contact@lepetitbistrot.test'
      }),
      modules_actifs: { reservations: true, marketing: true },
    },
    // Tables (stockées comme "services" pour restaurant)
    services: [
      { nom: 'Table 1', description: 'Table pour 2, terrasse', capacite: 2, zone: 'terrasse', actif: true },
      { nom: 'Table 2', description: 'Table pour 2, terrasse', capacite: 2, zone: 'terrasse', actif: true },
      { nom: 'Table 3', description: 'Table pour 4, intérieur', capacite: 4, zone: 'interieur', actif: true },
      { nom: 'Table 4', description: 'Table pour 4, intérieur', capacite: 4, zone: 'interieur', actif: true },
      { nom: 'Table 5', description: 'Table pour 6, intérieur', capacite: 6, zone: 'interieur', actif: true },
      { nom: 'Table 6', description: 'Grande table, salon privé', capacite: 10, zone: 'prive', actif: true },
    ],
    clients: [
      { nom: 'Dupont', prenom: 'Marie', email: 'marie.dupont@email.test', telephone: '+33612345678' },
      { nom: 'Martin', prenom: 'Jean', email: 'jean.martin@email.test', telephone: '+33623456789' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // HOTEL
  // ─────────────────────────────────────────────────────────────────────────
  'test-hotel': {
    tenant: {
      id: 'test-hotel',
      nom: 'Hôtel Bellevue',
      domain: 'hotel-bellevue.test',
      plan: 'pro',
      status: 'active',
      business_profile: 'hotel',
      profile_config: JSON.stringify({
        checkin_time: '15:00',
        checkout_time: '11:00',
        stars: 3
      }),
      location_config: JSON.stringify({
        mode: 'fixed',
        address: '45 avenue de la Mer, 06400 Cannes',
        zone: 'Côte d\'Azur'
      }),
      contact_config: JSON.stringify({
        phone: '+33493123456',
        email: 'reception@hotel-bellevue.test'
      }),
      modules_actifs: { reservations: true, marketing: true },
    },
    // Chambres (stockées comme "services" pour hotel)
    services: [
      { nom: 'Chambre 101', description: 'Chambre double confort', capacite: 2, etage: 1, prix: 9900, equipements: 'wifi,tv,clim', actif: true },
      { nom: 'Chambre 102', description: 'Chambre twin', capacite: 2, etage: 1, prix: 9900, equipements: 'wifi,tv', actif: true },
      { nom: 'Chambre 201', description: 'Chambre supérieure vue mer', capacite: 2, etage: 2, prix: 14900, equipements: 'wifi,tv,clim,minibar', actif: true },
      { nom: 'Suite 301', description: 'Suite familiale', capacite: 4, etage: 3, prix: 24900, equipements: 'wifi,tv,clim,minibar,balcon', actif: true },
    ],
    clients: [
      { nom: 'Smith', prenom: 'John', email: 'john.smith@email.test', telephone: '+33634567890' },
      { nom: 'Garcia', prenom: 'Ana', email: 'ana.garcia@email.test', telephone: '+33645678901' },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// FONCTIONS DE PROVISIONING
// ═══════════════════════════════════════════════════════════════════════════

async function createTenant(config) {
  const { tenant } = config;
  console.log(`\n📦 Création tenant: ${tenant.id}`);

  // Vérifier si existe
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenant.id)
    .single();

  if (existing) {
    if (process.argv.includes('--reset')) {
      console.log(`   ⚠️  Suppression tenant existant...`);
      await deleteTenantData(tenant.id);
    } else {
      console.log(`   ⏭️  Tenant existe déjà, skip (utiliser --reset pour recréer)`);
      return existing;
    }
  }

  // Créer le tenant
  const { data, error } = await supabase
    .from('tenants')
    .upsert({
      ...tenant,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error(`   ❌ Erreur création tenant:`, error);
    throw error;
  }

  console.log(`   ✅ Tenant créé: ${data.nom} (${tenant.business_profile})`);
  return data;
}

async function createServices(tenantId, services, businessType) {
  console.log(`\n🛠️  Création ${businessType === 'restaurant' ? 'tables' : 'chambres'} pour ${tenantId}`);

  for (const service of services) {
    const serviceData = {
      tenant_id: tenantId,
      nom: service.nom,
      description: service.description || '',
      prix: service.prix || 0,
      duree: service.duree || 60,
      actif: service.actif !== false,
      // Champs spécifiques stockés dans les colonnes existantes ou via metadata
      capacite: service.capacite || null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('services')
      .insert(serviceData);

    if (error) {
      console.error(`   ❌ Erreur ${service.nom}:`, error);
    } else {
      const label = businessType === 'restaurant'
        ? `${service.nom} (${service.capacite} places, ${service.zone})`
        : `${service.nom} (${service.capacite} pers., ${(service.prix/100).toFixed(0)}€/nuit)`;
      console.log(`   ✅ ${label}`);
    }
  }
}

async function createClients(tenantId, clients) {
  console.log(`\n👤 Création clients pour ${tenantId}`);

  for (const client of clients) {
    const { error } = await supabase
      .from('clients')
      .insert({
        tenant_id: tenantId,
        nom: client.nom,
        prenom: client.prenom || '',
        email: client.email,
        telephone: client.telephone,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error(`   ❌ Erreur client ${client.nom}:`, error);
    } else {
      console.log(`   ✅ ${client.prenom} ${client.nom}`);
    }
  }
}

async function createAdminUser(tenantId) {
  console.log(`\n🔐 Création admin pour ${tenantId}`);

  const adminEmail = `admin@${tenantId}.test`;
  const adminPassword = 'Test123!';

  const bcrypt = (await import('bcryptjs')).default;
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const { data: existing } = await supabase
    .from('admin_users')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', adminEmail)
    .single();

  if (existing) {
    console.log(`   ⏭️  Admin existe déjà`);
    return;
  }

  const { error } = await supabase
    .from('admin_users')
    .insert({
      email: adminEmail,
      password_hash: passwordHash,
      tenant_id: tenantId,
      role: 'admin',
      nom: 'Admin Test',
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error(`   ❌ Erreur admin:`, error);
  } else {
    console.log(`   ✅ Admin: ${adminEmail} / ${adminPassword}`);
  }
}

async function deleteTenantData(tenantId) {
  const tables = [
    'reservation_membres',
    'reservation_lignes',
    'reservations',
    'devis_lignes',
    'devis',
    'clients',
    'services',
    'admin_users',
  ];

  for (const table of tables) {
    try {
      await supabase.from(table).delete().eq('tenant_id', tenantId);
    } catch (e) {
      // Ignorer les erreurs
    }
  }

  await supabase.from('tenants').delete().eq('id', tenantId);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('    PROVISIONING TENANTS RESTAURANT & HOTEL');
  console.log('═══════════════════════════════════════════════════════════════');

  if (process.argv.includes('--reset')) {
    console.log('\n⚠️  Mode RESET activé - Les données existantes seront supprimées\n');
  }

  const results = { success: [], failed: [] };

  for (const [tenantId, config] of Object.entries(TENANTS_CONFIG)) {
    try {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`PROVISIONING: ${config.tenant.nom}`);
      console.log(`Type: ${config.tenant.business_profile}`);
      console.log(`${'─'.repeat(60)}`);

      await createTenant(config);
      await createServices(tenantId, config.services, config.tenant.business_profile);
      await createClients(tenantId, config.clients);
      await createAdminUser(tenantId);

      results.success.push(tenantId);
    } catch (error) {
      console.error(`\n❌ Erreur provisioning ${tenantId}:`, error);
      results.failed.push({ tenantId, error: error.message });
    }
  }

  // Résumé
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                        RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════════════');

  if (results.success.length > 0) {
    console.log('\n✅ Tenants créés avec succès:');
    results.success.forEach(id => {
      const config = TENANTS_CONFIG[id];
      console.log(`   • ${id} (${config.tenant.nom})`);
      console.log(`     Type: ${config.tenant.business_profile}`);
      console.log(`     Admin: admin@${id}.test / Test123!`);
    });
  }

  if (results.failed.length > 0) {
    console.log('\n❌ Erreurs:');
    results.failed.forEach(({ tenantId, error }) => {
      console.log(`   • ${tenantId}: ${error}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Pour tester:');
  console.log('  1. http://localhost:5173/login');
  console.log('  2. admin@test-restaurant.test / Test123!');
  console.log('  3. admin@test-hotel.test / Test123!');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
