/**
 * Script d'exécution migration système modules
 * Mission Jour 6
 */

import '../config/env.js';
import { supabase } from '../config/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, prefix, message) {
  console.log(`${COLORS[color]}[${prefix}]${COLORS.reset} ${message}`);
}

function success(msg) { log('green', '✅', msg); }
function error(msg) { log('red', '❌', msg); }
function info(msg) { log('blue', 'ℹ️', msg); }
function section(msg) { console.log(`\n${COLORS.cyan}${'═'.repeat(60)}\n${msg}\n${'═'.repeat(60)}${COLORS.reset}`); }

async function runMigration() {
  section('MIGRATION: Système Modules Activables');

  try {
    // Étape 1: Créer table modules_disponibles
    info('Création table modules_disponibles...');

    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });

    // Si rpc n'existe pas, essayer directement
    if (createError) {
      info('RPC non disponible, création via insert...');
    }

    // Vider et insérer les modules
    info('Suppression anciens modules...');
    await supabase.from('modules_disponibles').delete().neq('id', '');

    info('Insertion modules...');

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
        features: ['Dashboard admin', 'Gestion clients', 'Notifications SMS', 'Support email'],
        dependances: []
      },
      // CANAUX CLIENTS
      {
        id: 'agent_ia_web',
        nom: 'Agent IA Web',
        description: 'Chatbot IA 24/7 sur votre site web, répond aux questions clients',
        categorie: 'canaux_clients',
        prix_mensuel: 2500,
        ordre: 10,
        icone: 'Bot',
        features: ['Chat IA 24/7', 'FAQ automatique', 'Collecte leads', 'Personnalisation ton'],
        dependances: ['socle']
      },
      {
        id: 'whatsapp',
        nom: 'WhatsApp Business',
        description: 'Répondez automatiquement sur WhatsApp avec votre assistant IA',
        categorie: 'canaux_clients',
        prix_mensuel: 3500,
        ordre: 11,
        icone: 'MessageCircle',
        features: ['WhatsApp Business API', 'Réponses IA', 'Templates messages', 'Notifications'],
        dependances: ['socle', 'agent_ia_web']
      },
      {
        id: 'telephone',
        nom: 'Téléphone IA',
        description: 'Réception des appels avec voix IA naturelle, prise de RDV vocale',
        categorie: 'canaux_clients',
        prix_mensuel: 4500,
        ordre: 12,
        icone: 'Phone',
        features: ['Voix IA naturelle', 'Prise RDV vocale', 'Transfert appels', 'Messagerie vocale'],
        dependances: ['socle', 'agent_ia_web']
      },
      // OUTILS BUSINESS
      {
        id: 'reservations',
        nom: 'Agenda & Réservations',
        description: 'Gestion complète des RDV, disponibilités, confirmations automatiques',
        categorie: 'outils_business',
        prix_mensuel: 2000,
        ordre: 20,
        icone: 'Calendar',
        features: ['Agenda en ligne', 'Réservation web', 'Confirmations SMS', 'Rappels J-1', 'Gestion annulations'],
        dependances: ['socle']
      },
      {
        id: 'site_vitrine',
        nom: 'Site Web Pro',
        description: 'Site professionnel personnalisé avec votre marque et vos couleurs',
        categorie: 'outils_business',
        prix_mensuel: 1500,
        ordre: 21,
        icone: 'Globe',
        features: ['Site responsive', 'Personnalisation marque', 'SEO basique', 'Formulaire contact'],
        dependances: ['socle']
      },
      {
        id: 'paiements',
        nom: 'Paiements en ligne',
        description: 'Encaissez en ligne avec Stripe, gestion acomptes et remboursements',
        categorie: 'outils_business',
        prix_mensuel: 2900,
        ordre: 22,
        icone: 'CreditCard',
        features: ['Stripe intégré', 'Acomptes', 'Remboursements', 'Historique paiements'],
        dependances: ['socle']
      },
      {
        id: 'ecommerce',
        nom: 'E-commerce',
        description: 'Boutique en ligne complète, gestion stock et commandes',
        categorie: 'outils_business',
        prix_mensuel: 3900,
        ordre: 23,
        icone: 'ShoppingBag',
        features: ['Catalogue produits', 'Panier', 'Gestion stock', 'Suivi commandes'],
        dependances: ['socle', 'paiements']
      },
      // MODULES MÉTIER
      {
        id: 'module_metier_salon',
        nom: 'Module Salon',
        description: 'Fonctionnalités spécifiques coiffure/beauté : fiches clients, produits',
        categorie: 'modules_metier',
        prix_mensuel: 1500,
        ordre: 30,
        icone: 'Scissors',
        features: ['Fiches techniques clients', 'Historique prestations', 'Gestion produits salon'],
        dependances: ['socle', 'reservations']
      },
      {
        id: 'module_metier_resto',
        nom: 'Module Restaurant',
        description: 'Fonctionnalités spécifiques restauration : tables, menus, réservations',
        categorie: 'modules_metier',
        prix_mensuel: 1500,
        ordre: 31,
        icone: 'UtensilsCrossed',
        features: ['Plan de salle', 'Gestion tables', 'Menus digitaux', 'Commandes en ligne'],
        dependances: ['socle', 'reservations']
      },
      {
        id: 'module_metier_medical',
        nom: 'Module Médical',
        description: 'Fonctionnalités spécifiques santé : dossiers patients, ordonnances',
        categorie: 'modules_metier',
        prix_mensuel: 2500,
        ordre: 32,
        icone: 'Stethoscope',
        features: ['Dossiers patients', 'Historique médical', 'Ordonnances', 'Conformité RGPD santé'],
        dependances: ['socle', 'reservations']
      },
      // MODULES AVANCÉS
      {
        id: 'rh_avance',
        nom: 'RH & Planning',
        description: 'Gestion multi-employés, planning équipe, congés et absences',
        categorie: 'modules_avances',
        prix_mensuel: 3500,
        ordre: 40,
        icone: 'Users',
        features: ['Multi-employés', 'Planning équipe', 'Gestion congés', 'Pointage', 'Rapports RH'],
        dependances: ['socle']
      },
      {
        id: 'comptabilite',
        nom: 'Comptabilité',
        description: 'Suivi dépenses, compte de résultat, exports comptables',
        categorie: 'modules_avances',
        prix_mensuel: 2500,
        ordre: 41,
        icone: 'Calculator',
        features: ['Suivi dépenses', 'Catégorisation', 'P&L mensuel', 'Export CSV/PDF'],
        dependances: ['socle']
      },
      {
        id: 'marketing',
        nom: 'Marketing Auto',
        description: 'Génération posts IA, campagnes promos, emails automatiques',
        categorie: 'modules_avances',
        prix_mensuel: 2900,
        ordre: 42,
        icone: 'Megaphone',
        features: ['Posts IA réseaux sociaux', 'Campagnes email', 'Promos automatiques', 'Analytics'],
        dependances: ['socle']
      },
      {
        id: 'seo',
        nom: 'SEO & Visibilité',
        description: 'Articles IA, optimisation mots-clés, Google My Business',
        categorie: 'modules_avances',
        prix_mensuel: 4000,
        ordre: 43,
        icone: 'Search',
        features: ['Articles IA', 'Analyse mots-clés', 'Google My Business', 'Rapports SEO'],
        dependances: ['socle', 'site_vitrine']
      },
      {
        id: 'sentinel_pro',
        nom: 'SENTINEL Pro',
        description: 'Monitoring avancé plateforme, alertes temps réel, rapports performance',
        categorie: 'modules_avances',
        prix_mensuel: 2000,
        ordre: 44,
        icone: 'Shield',
        features: ['Monitoring 24/7', 'Alertes temps réel', 'Rapports performance', 'Logs détaillés'],
        dependances: ['socle']
      }
    ];

    const { error: insertError } = await supabase
      .from('modules_disponibles')
      .insert(modules);

    if (insertError) {
      error(`Erreur insertion modules: ${insertError.message}`);
      // Try upsert
      info('Tentative upsert...');
      for (const mod of modules) {
        const { error: upsertErr } = await supabase
          .from('modules_disponibles')
          .upsert(mod, { onConflict: 'id' });
        if (upsertErr) {
          error(`Module ${mod.id}: ${upsertErr.message}`);
        } else {
          success(`Module ${mod.id} inséré`);
        }
      }
    } else {
      success(`${modules.length} modules insérés`);
    }

    // Étape 2: Mettre à jour tenants
    section('Mise à jour tenants');

    // Fat's Hair - tous les modules actuellement utilisés
    info('Mise à jour Fat\'s Hair-Afro...');
    const { error: fatError } = await supabase
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
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', 'fatshairafro');

    if (fatError) {
      error(`Fat's Hair: ${fatError.message}`);
    } else {
      success('Fat\'s Hair-Afro mis à jour');
    }

    // Deco Event - modules de base
    info('Mise à jour Deco Event...');
    const { error: decoError } = await supabase
      .from('tenants')
      .update({
        modules_actifs: {
          socle: true,
          agent_ia_web: true,
          reservations: true,
          site_vitrine: true
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', 'decoevent');

    if (decoError) {
      error(`Deco Event: ${decoError.message}`);
    } else {
      success('Deco Event mis à jour');
    }

    // Étape 3: Vérification
    section('Vérification');

    const { data: modulesCheck, error: checkError } = await supabase
      .from('modules_disponibles')
      .select('categorie, prix_mensuel')
      .eq('actif', true);

    if (!checkError && modulesCheck) {
      const stats = {};
      modulesCheck.forEach(m => {
        if (!stats[m.categorie]) {
          stats[m.categorie] = { count: 0, total: 0 };
        }
        stats[m.categorie].count++;
        stats[m.categorie].total += m.prix_mensuel;
      });

      console.log('\n📊 Modules par catégorie:');
      Object.entries(stats).forEach(([cat, data]) => {
        console.log(`  ${cat}: ${data.count} modules, ${(data.total / 100).toFixed(0)}€/mois total`);
      });

      console.log(`\n  TOTAL: ${modulesCheck.length} modules`);
    }

    // Vérifier tenants
    const { data: tenantsCheck } = await supabase
      .from('tenants')
      .select('id, name, modules_actifs')
      .in('id', ['fatshairafro', 'decoevent']);

    console.log('\n📋 Tenants configurés:');
    tenantsCheck?.forEach(t => {
      const nbModules = Object.keys(t.modules_actifs || {}).length;
      console.log(`  ${t.name}: ${nbModules} modules actifs`);
    });

    section('MIGRATION TERMINÉE');
    success('Système modules activables prêt');

  } catch (err) {
    error(`Erreur fatale: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

runMigration();
