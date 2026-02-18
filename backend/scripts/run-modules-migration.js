#!/usr/bin/env node
/**
 * Script pour créer la table modules_disponibles et initialiser les modules
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🚀 Migration: Système Modules NEXUS');
  console.log('='.repeat(50));

  // 1. Créer la table modules_disponibles via RPC ou raw SQL
  // Supabase JS ne supporte pas CREATE TABLE, on utilise rpc ou on vérifie si existe

  // 2. Vérifier si la table existe déjà
  const { data: existingModules, error: checkError } = await supabase
    .from('modules_disponibles')
    .select('id')
    .limit(1);

  if (checkError && checkError.code === '42P01') {
    console.log('❌ Table modules_disponibles n\'existe pas.');
    console.log('');
    console.log('👉 Exécutez ce SQL dans Supabase Dashboard > SQL Editor:');
    console.log('');
    console.log(`
CREATE TABLE IF NOT EXISTS modules_disponibles (
  id VARCHAR(50) PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  categorie VARCHAR(50) NOT NULL,
  prix_mensuel INTEGER NOT NULL DEFAULT 0,
  actif BOOLEAN DEFAULT true,
  requis BOOLEAN DEFAULT false,
  dependances JSONB DEFAULT '[]'::jsonb,
  features JSONB DEFAULT '[]'::jsonb,
  ordre INTEGER DEFAULT 0,
  icone VARCHAR(50) DEFAULT 'Package',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modules_categorie ON modules_disponibles(categorie);
CREATE INDEX IF NOT EXISTS idx_modules_actif ON modules_disponibles(actif);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS modules_actifs JSONB DEFAULT '{"socle": true}'::jsonb;
    `);
    console.log('');
    console.log('Puis relancez ce script pour insérer les données.');
    return;
  }

  console.log('✅ Table modules_disponibles existe');

  // 3. Insérer les modules (upsert)
  const modules = [
    // SOCLE
    {
      id: 'socle',
      nom: 'Socle NEXUS',
      description: 'Dashboard admin, gestion clients, notifications SMS de base',
      categorie: 'base',
      prix_mensuel: 4900,
      requis: true,
      ordre: 0,
      icone: 'Building2',
      features: ['Dashboard admin', 'Gestion clients', 'Notifications SMS', 'Support email']
    },
    // CANAUX CLIENTS
    {
      id: 'agent_ia_web',
      nom: 'Agent IA Web',
      description: 'Chatbot IA 24/7 sur votre site web',
      categorie: 'canaux_clients',
      prix_mensuel: 2500,
      dependances: ['socle'],
      ordre: 10,
      icone: 'Bot',
      features: ['Chat IA 24/7', 'FAQ automatique', 'Collecte leads', 'Personnalisation ton']
    },
    {
      id: 'whatsapp',
      nom: 'WhatsApp Business',
      description: 'Répondez automatiquement sur WhatsApp avec votre assistant IA',
      categorie: 'canaux_clients',
      prix_mensuel: 3500,
      dependances: ['socle', 'agent_ia_web'],
      ordre: 11,
      icone: 'MessageCircle',
      features: ['WhatsApp Business API', 'Réponses IA', 'Templates messages', 'Notifications']
    },
    {
      id: 'telephone',
      nom: 'Téléphone IA',
      description: 'Réception des appels avec voix IA naturelle',
      categorie: 'canaux_clients',
      prix_mensuel: 4500,
      dependances: ['socle', 'agent_ia_web'],
      ordre: 12,
      icone: 'Phone',
      features: ['Voix IA naturelle', 'Prise RDV vocale', 'Transfert appels', 'Messagerie vocale']
    },
    // OUTILS BUSINESS
    {
      id: 'reservations',
      nom: 'Agenda & Réservations',
      description: 'Gestion complète des RDV, disponibilités, confirmations automatiques',
      categorie: 'outils_business',
      prix_mensuel: 2000,
      dependances: ['socle'],
      ordre: 20,
      icone: 'Calendar',
      features: ['Agenda en ligne', 'Réservation web', 'Confirmations SMS', 'Rappels J-1']
    },
    {
      id: 'site_vitrine',
      nom: 'Site Web Pro',
      description: 'Site professionnel personnalisé avec votre marque',
      categorie: 'outils_business',
      prix_mensuel: 1500,
      dependances: ['socle'],
      ordre: 21,
      icone: 'Globe',
      features: ['Site responsive', 'Personnalisation marque', 'SEO basique', 'Formulaire contact']
    },
    {
      id: 'paiements',
      nom: 'Paiements en ligne',
      description: 'Encaissez en ligne avec Stripe, gestion acomptes',
      categorie: 'outils_business',
      prix_mensuel: 2900,
      dependances: ['socle'],
      ordre: 22,
      icone: 'CreditCard',
      features: ['Stripe intégré', 'Acomptes', 'Remboursements', 'Historique paiements']
    },
    {
      id: 'ecommerce',
      nom: 'E-commerce',
      description: 'Boutique en ligne complète, gestion stock et commandes',
      categorie: 'outils_business',
      prix_mensuel: 3900,
      dependances: ['socle', 'paiements'],
      ordre: 23,
      icone: 'ShoppingBag',
      features: ['Catalogue produits', 'Panier', 'Gestion stock', 'Suivi commandes']
    },
    // MODULES MÉTIER
    {
      id: 'module_metier_salon',
      nom: 'Module Salon',
      description: 'Fonctionnalités spécifiques coiffure/beauté',
      categorie: 'modules_metier',
      prix_mensuel: 1500,
      dependances: ['socle', 'reservations'],
      ordre: 30,
      icone: 'Scissors',
      features: ['Fiches techniques clients', 'Historique prestations', 'Gestion produits salon']
    },
    {
      id: 'module_metier_resto',
      nom: 'Module Restaurant',
      description: 'Fonctionnalités spécifiques restauration',
      categorie: 'modules_metier',
      prix_mensuel: 1500,
      dependances: ['socle', 'reservations'],
      ordre: 31,
      icone: 'UtensilsCrossed',
      features: ['Plan de salle', 'Gestion tables', 'Menus digitaux', 'Commandes en ligne']
    },
    {
      id: 'module_metier_medical',
      nom: 'Module Médical',
      description: 'Fonctionnalités spécifiques santé',
      categorie: 'modules_metier',
      prix_mensuel: 2500,
      dependances: ['socle', 'reservations'],
      ordre: 32,
      icone: 'Stethoscope',
      features: ['Dossiers patients', 'Historique médical', 'Ordonnances', 'Conformité RGPD santé']
    },
    // MODULES AVANCÉS
    {
      id: 'rh_avance',
      nom: 'RH & Planning',
      description: 'Gestion multi-employés, planning équipe, congés',
      categorie: 'modules_avances',
      prix_mensuel: 3500,
      dependances: ['socle'],
      ordre: 40,
      icone: 'Users',
      features: ['Multi-employés', 'Planning équipe', 'Gestion congés', 'Pointage', 'Rapports RH']
    },
    {
      id: 'comptabilite',
      nom: 'Comptabilité',
      description: 'Suivi dépenses, compte de résultat, exports',
      categorie: 'modules_avances',
      prix_mensuel: 2500,
      dependances: ['socle'],
      ordre: 41,
      icone: 'Calculator',
      features: ['Suivi dépenses', 'Catégorisation', 'P&L mensuel', 'Export CSV/PDF']
    },
    {
      id: 'marketing',
      nom: 'Marketing Auto',
      description: 'Génération posts IA, campagnes promos, emails',
      categorie: 'modules_avances',
      prix_mensuel: 2900,
      dependances: ['socle'],
      ordre: 42,
      icone: 'Megaphone',
      features: ['Posts IA réseaux sociaux', 'Campagnes email', 'Promos automatiques', 'Analytics']
    },
    {
      id: 'seo',
      nom: 'SEO & Visibilité',
      description: 'Articles IA, optimisation mots-clés, Google My Business',
      categorie: 'modules_avances',
      prix_mensuel: 4000,
      dependances: ['socle', 'site_vitrine'],
      ordre: 43,
      icone: 'Search',
      features: ['Articles IA', 'Analyse mots-clés', 'Google My Business', 'Rapports SEO']
    },
    {
      id: 'sentinel_pro',
      nom: 'SENTINEL Pro',
      description: 'Monitoring avancé, alertes temps réel, rapports',
      categorie: 'modules_avances',
      prix_mensuel: 2000,
      dependances: ['socle'],
      ordre: 44,
      icone: 'Shield',
      features: ['Monitoring 24/7', 'Alertes temps réel', 'Rapports performance', 'Logs détaillés']
    }
  ];

  console.log(`\n📦 Insertion de ${modules.length} modules...`);

  for (const mod of modules) {
    const { error } = await supabase
      .from('modules_disponibles')
      .upsert(mod, { onConflict: 'id' });

    if (error) {
      console.log(`  ❌ ${mod.id}: ${error.message}`);
    } else {
      console.log(`  ✅ ${mod.id}: ${mod.nom}`);
    }
  }

  // 4. Mettre à jour les tenants avec modules_actifs par défaut
  console.log('\n👥 Mise à jour des tenants...');

  // Nexus-test avec modules de base
  const { error: nexusError } = await supabase
    .from('tenants')
    .update({
      modules_actifs: {
        socle: true,
        reservations: true,
        agent_ia_web: true
      }
    })
    .eq('id', 'nexus-test');

  if (nexusError) {
    console.log(`  ❌ nexus-test: ${nexusError.message}`);
  } else {
    console.log('  ✅ nexus-test: modules de base');
  }

  // FatShairAfro avec modules salon complets
  const { error: fatsError } = await supabase
    .from('tenants')
    .update({
      modules_actifs: {
        socle: true,
        agent_ia_web: true,
        whatsapp: true,
        telephone: true,
        reservations: true,
        site_vitrine: true,
        paiements: true,
        module_metier_salon: true
      }
    })
    .eq('id', 'fatshairafro');

  if (fatsError) {
    console.log(`  ❌ fatshairafro: ${fatsError.message}`);
  } else {
    console.log('  ✅ fatshairafro: modules salon complets');
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Migration terminée !');
  console.log('');
  console.log('Testez avec:');
  console.log('  curl http://localhost:5000/api/modules/available -H "Authorization: Bearer <token>"');
}

runMigration().catch(console.error);
