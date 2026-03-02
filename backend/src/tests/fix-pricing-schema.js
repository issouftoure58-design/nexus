/**
 * CORRECTION PRICING - Mise à jour schéma avec pricing correct
 * Date: 10 février 2026
 */

import '../config/env.js';
import pg from 'pg';

const { Client } = pg;

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

function success(msg) { console.log(`${COLORS.green}[✅]${COLORS.reset} ${msg}`); }
function error(msg) { console.log(`${COLORS.red}[❌]${COLORS.reset} ${msg}`); }
function info(msg) { console.log(`${COLORS.blue}[ℹ️]${COLORS.reset} ${msg}`); }
function warn(msg) { console.log(`${COLORS.yellow}[⚠️]${COLORS.reset} ${msg}`); }
function section(msg) { console.log(`\n${COLORS.cyan}${'═'.repeat(60)}\n${msg}\n${'═'.repeat(60)}${COLORS.reset}`); }

async function fixPricing() {
  section('CORRECTION PRICING - Structure NEXUS');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    info('Connexion à PostgreSQL...');
    await client.connect();
    success('Connecté');

    // ═══════════════════════════════════════════════════════════════
    // ÉTAPE 1: Supprimer l'ancienne table
    // ═══════════════════════════════════════════════════════════════
    section('ÉTAPE 1: Nettoyage');

    info('Suppression table modules_disponibles obsolète...');
    await client.query(`DROP TABLE IF EXISTS modules_disponibles CASCADE;`);
    success('Table modules_disponibles supprimée');

    // ═══════════════════════════════════════════════════════════════
    // ÉTAPE 2: Créer table PLANS
    // ═══════════════════════════════════════════════════════════════
    section('ÉTAPE 2: Table plans');

    info('Suppression ancienne table plans si existante...');
    await client.query(`DROP TABLE IF EXISTS plans CASCADE;`);

    info('Création table plans...');
    await client.query(`
      CREATE TABLE plans (
        id VARCHAR(50) PRIMARY KEY,
        nom VARCHAR(100) NOT NULL,
        description TEXT,
        prix_mensuel INTEGER NOT NULL,  -- En centimes
        clients_max INTEGER,  -- NULL = illimité
        stockage_mb INTEGER,  -- En MB
        posts_ia_mois INTEGER NOT NULL,
        images_dalle_mois INTEGER NOT NULL,
        utilisateurs_inclus INTEGER NOT NULL DEFAULT 1,
        prix_utilisateur_sup INTEGER NOT NULL,  -- En centimes
        reservations_mois INTEGER,  -- NULL = illimité
        commandes_mois INTEGER,
        projets_actifs INTEGER,
        tickets_mois INTEGER,
        -- Modules inclus
        comptabilite BOOLEAN DEFAULT false,
        crm_avance BOOLEAN DEFAULT false,
        marketing_automation BOOLEAN DEFAULT false,
        commercial BOOLEAN DEFAULT false,
        stock_inventaire BOOLEAN DEFAULT false,
        analytics_avances BOOLEAN DEFAULT false,
        seo_visibilite BOOLEAN DEFAULT false,
        rh_multiemployes BOOLEAN DEFAULT false,
        api_integrations BOOLEAN DEFAULT false,
        white_label BOOLEAN DEFAULT false,
        -- Sentinel
        sentinel_niveau VARCHAR(20) DEFAULT 'basic',  -- basic, actif, intel
        -- Support
        support_email_heures INTEGER DEFAULT 48,
        support_chat BOOLEAN DEFAULT false,
        support_telephone BOOLEAN DEFAULT false,
        account_manager BOOLEAN DEFAULT false,
        -- Assistant IA mode
        assistant_mode VARCHAR(20) DEFAULT 'consultation',  -- consultation, execution, intelligence
        -- Ordre affichage
        ordre INTEGER NOT NULL DEFAULT 0,
        actif BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    success('Table plans créée');

    info('Insertion des 3 plans...');
    await client.query(`DELETE FROM plans;`);

    // STARTER - 99€/mois
    await client.query(`
      INSERT INTO plans (
        id, nom, description, prix_mensuel, clients_max, stockage_mb,
        posts_ia_mois, images_dalle_mois, utilisateurs_inclus, prix_utilisateur_sup,
        reservations_mois, commandes_mois, projets_actifs, tickets_mois,
        sentinel_niveau, support_email_heures, assistant_mode, ordre
      ) VALUES (
        'starter', 'Starter', 'Parfait pour démarrer', 9900, 500, 500,
        200, 200, 1, 0,
        100, 100, 10, 100,
        'basic', 48, 'consultation', 1
      );
    `);

    // PRO - 249€/mois
    await client.query(`
      INSERT INTO plans (
        id, nom, description, prix_mensuel, clients_max, stockage_mb,
        posts_ia_mois, images_dalle_mois, utilisateurs_inclus, prix_utilisateur_sup,
        reservations_mois, commandes_mois, projets_actifs, tickets_mois,
        comptabilite, crm_avance, marketing_automation, commercial, stock_inventaire, analytics_avances,
        sentinel_niveau, support_email_heures, support_chat, assistant_mode, ordre
      ) VALUES (
        'pro', 'Pro', 'Le plus populaire', 24900, 2000, 5120,
        500, 500, 5, 2000,
        500, 500, 50, 500,
        true, true, true, true, true, true,
        'actif', 24, true, 'execution', 2
      );
    `);

    // BUSINESS - 499€/mois
    await client.query(`
      INSERT INTO plans (
        id, nom, description, prix_mensuel, clients_max, stockage_mb,
        posts_ia_mois, images_dalle_mois, utilisateurs_inclus, prix_utilisateur_sup,
        reservations_mois, commandes_mois, projets_actifs, tickets_mois,
        comptabilite, crm_avance, marketing_automation, commercial, stock_inventaire, analytics_avances,
        seo_visibilite, rh_multiemployes, api_integrations, white_label,
        sentinel_niveau, support_email_heures, support_chat, support_telephone, account_manager,
        assistant_mode, ordre
      ) VALUES (
        'business', 'Business', 'Pour les entreprises', 49900, NULL, 51200,
        1000, 1000, 10, 1500,
        NULL, NULL, NULL, NULL,
        true, true, true, true, true, true,
        true, true, true, true,
        'intel', 12, true, true, true,
        'intelligence', 3
      );
    `);
    success('3 plans insérés');

    // ═══════════════════════════════════════════════════════════════
    // ÉTAPE 3: Créer table OPTIONS (canaux IA + modules métier)
    // ═══════════════════════════════════════════════════════════════
    section('ÉTAPE 3: Table options_disponibles');

    info('Suppression ancienne table options_disponibles si existante...');
    await client.query(`DROP TABLE IF EXISTS options_disponibles CASCADE;`);

    info('Création table options_disponibles...');
    await client.query(`
      CREATE TABLE options_disponibles (
        id VARCHAR(50) PRIMARY KEY,
        nom VARCHAR(100) NOT NULL,
        description TEXT,
        categorie VARCHAR(50) NOT NULL,  -- 'canal_ia', 'module_metier', 'site_web'
        type_paiement VARCHAR(20) NOT NULL,  -- 'mensuel', 'one_time'
        prix INTEGER NOT NULL,  -- En centimes
        inclus_forfait TEXT,  -- Ex: "600 messages" ou "120 min"
        prix_depassement INTEGER,  -- Prix par unité au-delà du forfait (centimes)
        unite_depassement VARCHAR(50),  -- Ex: "message", "minute"
        dependances JSONB DEFAULT '[]'::jsonb,
        icone VARCHAR(50) DEFAULT 'Package',
        ordre INTEGER DEFAULT 0,
        actif BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    success('Table options_disponibles créée');

    info('Insertion des options...');
    await client.query(`DELETE FROM options_disponibles;`);

    // OPTIONS CANAUX IA (mensuels)
    await client.query(`
      INSERT INTO options_disponibles (id, nom, description, categorie, type_paiement, prix, inclus_forfait, icone, ordre) VALUES
      ('agent_ia_web', 'Agent IA Web', 'Chat IA 24/7 sur votre site web', 'canal_ia', 'mensuel', 1900, 'Conversations illimitées', 'Bot', 1),
      ('agent_ia_whatsapp', 'Agent IA WhatsApp', 'Réponses automatiques WhatsApp avec IA', 'canal_ia', 'mensuel', 4900, '600 messages/mois', 'MessageCircle', 2),
      ('agent_ia_telephone', 'Agent IA Téléphone', 'Réception appels avec voix IA naturelle', 'canal_ia', 'mensuel', 7900, '120 minutes/mois', 'Phone', 3),
      ('site_web', 'Site Web Pro', 'Site professionnel avec hébergement', 'canal_ia', 'mensuel', 2900, 'Hébergement inclus', 'Globe', 4);
    `);

    // Mettre à jour prix dépassement pour téléphone
    await client.query(`
      UPDATE options_disponibles
      SET prix_depassement = 95, unite_depassement = 'minute'
      WHERE id = 'agent_ia_telephone';
    `);

    // MODULES MÉTIER (one-time)
    await client.query(`
      INSERT INTO options_disponibles (id, nom, description, categorie, type_paiement, prix, icone, ordre) VALUES
      ('module_metier_salon', 'Module Salon', 'Fonctionnalités coiffure/beauté', 'module_metier', 'one_time', 5900, 'Scissors', 10),
      ('module_metier_restaurant', 'Module Restaurant', 'Fonctionnalités restauration', 'module_metier', 'one_time', 5900, 'UtensilsCrossed', 11),
      ('module_metier_medical', 'Module Médical', 'Fonctionnalités santé', 'module_metier', 'one_time', 5900, 'Stethoscope', 12),
      ('module_metier_formation', 'Module Formation', 'Fonctionnalités formation', 'module_metier', 'one_time', 5900, 'GraduationCap', 13),
      ('module_metier_ecommerce', 'Module E-commerce', 'Fonctionnalités boutique en ligne', 'module_metier', 'one_time', 5900, 'ShoppingBag', 14);
    `);
    success('Options insérées (4 canaux + 5 modules métier)');

    // ═══════════════════════════════════════════════════════════════
    // ÉTAPE 4: Mettre à jour table tenants
    // ═══════════════════════════════════════════════════════════════
    section('ÉTAPE 4: Mise à jour tenants');

    info('Ajout colonnes pricing dans tenants...');

    // Vérifier et ajouter colonnes si nécessaires
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_id VARCHAR(50) REFERENCES plans(id);
    `);
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS options_canaux_actifs JSONB DEFAULT '{}'::jsonb;
    `);
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS module_metier_id VARCHAR(50);
    `);
    await client.query(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS module_metier_paye BOOLEAN DEFAULT false;
    `);
    success('Colonnes ajoutées');

    // ═══════════════════════════════════════════════════════════════
    // ÉTAPE 5: Configurer Fat's Hair-Afro
    // ═══════════════════════════════════════════════════════════════
    section('ÉTAPE 5: Configuration Fat\'s Hair-Afro');

    info('Mise à jour Fat\'s Hair-Afro...');
    await client.query(`
      UPDATE tenants SET
        plan_id = 'pro',
        options_canaux_actifs = '{
          "agent_ia_web": true,
          "agent_ia_whatsapp": true,
          "agent_ia_telephone": true,
          "site_web": true
        }'::jsonb,
        module_metier_id = 'module_metier_salon',
        module_metier_paye = true,
        updated_at = NOW()
      WHERE id = 'fatshairafro';
    `);
    success('Fat\'s Hair-Afro configuré');

    // ═══════════════════════════════════════════════════════════════
    // ÉTAPE 6: Vérification et calcul pricing
    // ═══════════════════════════════════════════════════════════════
    section('VÉRIFICATION PRICING');

    // Récupérer config Fat's Hair
    const { rows: [fat] } = await client.query(`
      SELECT t.*, p.nom as plan_nom, p.prix_mensuel as plan_prix
      FROM tenants t
      LEFT JOIN plans p ON t.plan_id = p.id
      WHERE t.id = 'fatshairafro'
    `);

    console.log('\n💰 PRICING FAT\'S HAIR-AFRO:');
    console.log(`  Plan: ${fat.plan_nom} (${(fat.plan_prix / 100).toFixed(0)}€/mois)`);

    // Calculer options canaux
    const optionsActifs = fat.options_canaux_actifs || {};
    const { rows: options } = await client.query(`
      SELECT id, nom, prix FROM options_disponibles
      WHERE id = ANY($1) AND type_paiement = 'mensuel'
    `, [Object.keys(optionsActifs).filter(k => optionsActifs[k])]);

    let totalOptions = 0;
    options.forEach(opt => {
      console.log(`  + ${opt.nom}: ${(opt.prix / 100).toFixed(0)}€/mois`);
      totalOptions += opt.prix;
    });

    const totalMensuel = fat.plan_prix + totalOptions;
    console.log('  ────────────────────────────');
    console.log(`  TOTAL MENSUEL: ${(totalMensuel / 100).toFixed(0)}€/mois`);

    if (fat.module_metier_paye) {
      console.log(`  + Module métier (one-time, déjà payé): 59€`);
    }

    // Vérification attendue
    const attendu = 24900 + 1900 + 4900 + 7900 + 2900; // Pro + Web + WhatsApp + Tel + Site
    console.log(`\n  Attendu: ${(attendu / 100).toFixed(0)}€/mois`);

    if (totalMensuel === attendu) {
      success(`✅ PRICING CORRECT: ${(totalMensuel / 100).toFixed(0)}€/mois`);
    } else {
      warn(`⚠️ Différence: calculé ${(totalMensuel / 100).toFixed(0)}€ vs attendu ${(attendu / 100).toFixed(0)}€`);
    }

    // Résumé tables
    section('RÉSUMÉ STRUCTURE');

    const { rows: plansCount } = await client.query(`SELECT COUNT(*) as c FROM plans`);
    const { rows: optionsCount } = await client.query(`SELECT COUNT(*) as c FROM options_disponibles`);

    console.log(`\n📊 Tables créées:`);
    console.log(`  - plans: ${plansCount[0].c} entrées (Starter, Pro, Business)`);
    console.log(`  - options_disponibles: ${optionsCount[0].c} entrées (4 canaux + 5 modules métier)`);

    section('TERMINÉ');
    success('Pricing corrigé et vérifié!');

  } catch (err) {
    error(`Erreur: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixPricing();
