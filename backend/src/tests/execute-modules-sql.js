/**
 * Exécute le SQL de création de la table modules_disponibles
 * Via connexion PostgreSQL directe
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
};

function success(msg) { console.log(`${COLORS.green}[✅]${COLORS.reset} ${msg}`); }
function error(msg) { console.log(`${COLORS.red}[❌]${COLORS.reset} ${msg}`); }
function info(msg) { console.log(`${COLORS.blue}[ℹ️]${COLORS.reset} ${msg}`); }
function section(msg) { console.log(`\n${COLORS.cyan}${'═'.repeat(60)}\n${msg}\n${'═'.repeat(60)}${COLORS.reset}`); }

async function executeSQL() {
  section('EXÉCUTION SQL - Table modules_disponibles');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    info('Connexion à PostgreSQL...');
    await client.connect();
    success('Connecté à la base de données');

    // 1. Créer la table
    info('Création de la table modules_disponibles...');
    await client.query(`
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
    `);
    success('Table créée');

    // 2. Créer les index
    info('Création des index...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_modules_categorie ON modules_disponibles(categorie);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_modules_actif ON modules_disponibles(actif);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_modules_ordre ON modules_disponibles(ordre);`);
    success('Index créés');

    // 3. Vider les données existantes
    info('Nettoyage des données existantes...');
    await client.query(`DELETE FROM modules_disponibles;`);
    success('Données nettoyées');

    // 4. Insérer les modules
    info('Insertion des modules...');

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
        features: JSON.stringify(['Dashboard admin', 'Gestion clients', 'Notifications SMS', 'Support email']),
        dependances: JSON.stringify([])
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
        features: JSON.stringify(['Chat IA 24/7', 'FAQ automatique', 'Collecte leads', 'Personnalisation ton']),
        dependances: JSON.stringify(['socle'])
      },
      {
        id: 'whatsapp',
        nom: 'WhatsApp Business',
        description: 'Répondez automatiquement sur WhatsApp avec votre assistant IA',
        categorie: 'canaux_clients',
        prix_mensuel: 3500,
        ordre: 11,
        icone: 'MessageCircle',
        features: JSON.stringify(['WhatsApp Business API', 'Réponses IA', 'Templates messages', 'Notifications']),
        dependances: JSON.stringify(['socle', 'agent_ia_web'])
      },
      {
        id: 'telephone',
        nom: 'Téléphone IA',
        description: 'Réception des appels avec voix IA naturelle, prise de RDV vocale',
        categorie: 'canaux_clients',
        prix_mensuel: 4500,
        ordre: 12,
        icone: 'Phone',
        features: JSON.stringify(['Voix IA naturelle', 'Prise RDV vocale', 'Transfert appels', 'Messagerie vocale']),
        dependances: JSON.stringify(['socle', 'agent_ia_web'])
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
        features: JSON.stringify(['Agenda en ligne', 'Réservation web', 'Confirmations SMS', 'Rappels J-1', 'Gestion annulations']),
        dependances: JSON.stringify(['socle'])
      },
      {
        id: 'site_vitrine',
        nom: 'Site Web Pro',
        description: 'Site professionnel personnalisé avec votre marque et vos couleurs',
        categorie: 'outils_business',
        prix_mensuel: 1500,
        ordre: 21,
        icone: 'Globe',
        features: JSON.stringify(['Site responsive', 'Personnalisation marque', 'SEO basique', 'Formulaire contact']),
        dependances: JSON.stringify(['socle'])
      },
      {
        id: 'paiements',
        nom: 'Paiements en ligne',
        description: 'Encaissez en ligne avec Stripe, gestion acomptes et remboursements',
        categorie: 'outils_business',
        prix_mensuel: 2900,
        ordre: 22,
        icone: 'CreditCard',
        features: JSON.stringify(['Stripe intégré', 'Acomptes', 'Remboursements', 'Historique paiements']),
        dependances: JSON.stringify(['socle'])
      },
      {
        id: 'ecommerce',
        nom: 'E-commerce',
        description: 'Boutique en ligne complète, gestion stock et commandes',
        categorie: 'outils_business',
        prix_mensuel: 3900,
        ordre: 23,
        icone: 'ShoppingBag',
        features: JSON.stringify(['Catalogue produits', 'Panier', 'Gestion stock', 'Suivi commandes']),
        dependances: JSON.stringify(['socle', 'paiements'])
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
        features: JSON.stringify(['Fiches techniques clients', 'Historique prestations', 'Gestion produits salon']),
        dependances: JSON.stringify(['socle', 'reservations'])
      },
      {
        id: 'module_metier_resto',
        nom: 'Module Restaurant',
        description: 'Fonctionnalités spécifiques restauration : tables, menus, réservations',
        categorie: 'modules_metier',
        prix_mensuel: 1500,
        ordre: 31,
        icone: 'UtensilsCrossed',
        features: JSON.stringify(['Plan de salle', 'Gestion tables', 'Menus digitaux', 'Commandes en ligne']),
        dependances: JSON.stringify(['socle', 'reservations'])
      },
      {
        id: 'module_metier_medical',
        nom: 'Module Médical',
        description: 'Fonctionnalités spécifiques santé : dossiers patients, ordonnances',
        categorie: 'modules_metier',
        prix_mensuel: 2500,
        ordre: 32,
        icone: 'Stethoscope',
        features: JSON.stringify(['Dossiers patients', 'Historique médical', 'Ordonnances', 'Conformité RGPD santé']),
        dependances: JSON.stringify(['socle', 'reservations'])
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
        features: JSON.stringify(['Multi-employés', 'Planning équipe', 'Gestion congés', 'Pointage', 'Rapports RH']),
        dependances: JSON.stringify(['socle'])
      },
      {
        id: 'comptabilite',
        nom: 'Comptabilité',
        description: 'Suivi dépenses, compte de résultat, exports comptables',
        categorie: 'modules_avances',
        prix_mensuel: 2500,
        ordre: 41,
        icone: 'Calculator',
        features: JSON.stringify(['Suivi dépenses', 'Catégorisation', 'P&L mensuel', 'Export CSV/PDF']),
        dependances: JSON.stringify(['socle'])
      },
      {
        id: 'marketing',
        nom: 'Marketing Auto',
        description: 'Génération posts IA, campagnes promos, emails automatiques',
        categorie: 'modules_avances',
        prix_mensuel: 2900,
        ordre: 42,
        icone: 'Megaphone',
        features: JSON.stringify(['Posts IA réseaux sociaux', 'Campagnes email', 'Promos automatiques', 'Analytics']),
        dependances: JSON.stringify(['socle'])
      },
      {
        id: 'seo',
        nom: 'SEO & Visibilité',
        description: 'Articles IA, optimisation mots-clés, Google My Business',
        categorie: 'modules_avances',
        prix_mensuel: 4000,
        ordre: 43,
        icone: 'Search',
        features: JSON.stringify(['Articles IA', 'Analyse mots-clés', 'Google My Business', 'Rapports SEO']),
        dependances: JSON.stringify(['socle', 'site_vitrine'])
      },
      {
        id: 'sentinel_pro',
        nom: 'SENTINEL Pro',
        description: 'Monitoring avancé plateforme, alertes temps réel, rapports performance',
        categorie: 'modules_avances',
        prix_mensuel: 2000,
        ordre: 44,
        icone: 'Shield',
        features: JSON.stringify(['Monitoring 24/7', 'Alertes temps réel', 'Rapports performance', 'Logs détaillés']),
        dependances: JSON.stringify(['socle'])
      }
    ];

    for (const mod of modules) {
      await client.query(`
        INSERT INTO modules_disponibles (id, nom, description, categorie, prix_mensuel, requis, ordre, icone, features, dependances)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          nom = EXCLUDED.nom,
          description = EXCLUDED.description,
          categorie = EXCLUDED.categorie,
          prix_mensuel = EXCLUDED.prix_mensuel,
          requis = EXCLUDED.requis,
          ordre = EXCLUDED.ordre,
          icone = EXCLUDED.icone,
          features = EXCLUDED.features,
          dependances = EXCLUDED.dependances,
          updated_at = NOW()
      `, [
        mod.id,
        mod.nom,
        mod.description,
        mod.categorie,
        mod.prix_mensuel,
        mod.requis || false,
        mod.ordre,
        mod.icone,
        mod.features,
        mod.dependances
      ]);
    }
    success(`${modules.length} modules insérés`);

    // 5. Vérification
    section('VÉRIFICATION');

    const result = await client.query(`
      SELECT categorie, COUNT(*) as nb, SUM(prix_mensuel) as total
      FROM modules_disponibles
      GROUP BY categorie
      ORDER BY MIN(ordre)
    `);

    console.log('\n📊 Modules par catégorie:');
    result.rows.forEach(row => {
      console.log(`  ${row.categorie}: ${row.nb} modules, ${(row.total / 100).toFixed(0)}€/mois`);
    });

    const countResult = await client.query(`SELECT COUNT(*) as total FROM modules_disponibles`);
    console.log(`\n  TOTAL: ${countResult.rows[0].total} modules`);

    section('TERMINÉ');
    success('Table modules_disponibles créée et peuplée avec succès!');

  } catch (err) {
    error(`Erreur: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

executeSQL();
