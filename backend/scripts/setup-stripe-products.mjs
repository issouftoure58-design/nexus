#!/usr/bin/env node

/**
 * Script de configuration Stripe Products & Prices
 *
 * Ce script cree les produits et prix dans Stripe pour chaque module NEXUS.
 * A executer une seule fois lors de la mise en place du billing.
 *
 * Usage:
 *   node scripts/setup-stripe-products.mjs
 *
 * Variables d'environnement requises:
 *   STRIPE_SECRET_KEY - Cle secrete Stripe
 *   SUPABASE_URL - URL Supabase
 *   SUPABASE_SERVICE_ROLE_KEY - Cle service Supabase
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// ════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════════════════════════════════════

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY manquante dans .env');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Variables Supabase manquantes dans .env');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ════════════════════════════════════════════════════════════════════
// MODULES NEXUS (meme definition que dans modules.js)
// ════════════════════════════════════════════════════════════════════

const MODULES = [
  {
    id: 'socle',
    nom: 'Socle NEXUS',
    description: 'Dashboard admin, gestion clients, notifications SMS de base',
    prix_mensuel: 4900, // centimes
  },
  {
    id: 'agent_ia_web',
    nom: 'Agent IA Web',
    description: 'Chatbot IA 24/7 sur votre site web',
    prix_mensuel: 2500,
  },
  {
    id: 'whatsapp',
    nom: 'WhatsApp Business',
    description: 'Repondez automatiquement sur WhatsApp avec votre assistant IA',
    prix_mensuel: 3500,
  },
  {
    id: 'telephone',
    nom: 'Telephone IA',
    description: 'Reception des appels avec voix IA naturelle',
    prix_mensuel: 4500,
  },
  {
    id: 'standard_ia',
    nom: 'Standard d\'accueil IA',
    description: 'Standard telephonique intelligent',
    prix_mensuel: 5500,
  },
  {
    id: 'ia_reservation',
    nom: 'IA Reservation Omnicanal',
    description: 'Prise de RDV automatique par telephone, WhatsApp et web',
    prix_mensuel: 3500,
  },
  {
    id: 'reservations',
    nom: 'Agenda & Reservations',
    description: 'Gestion complete des RDV, disponibilites, confirmations automatiques',
    prix_mensuel: 2000,
  },
  {
    id: 'site_vitrine',
    nom: 'Site Web Pro',
    description: 'Site professionnel personnalise avec votre marque',
    prix_mensuel: 1500,
  },
  {
    id: 'paiements',
    nom: 'Paiements en ligne',
    description: 'Encaissez en ligne avec Stripe, gestion acomptes',
    prix_mensuel: 2900,
  },
  {
    id: 'ecommerce',
    nom: 'E-commerce',
    description: 'Boutique en ligne complete, gestion stock et commandes',
    prix_mensuel: 3900,
  },
  {
    id: 'module_metier_salon',
    nom: 'Module Salon',
    description: 'Fonctionnalites specifiques coiffure/beaute',
    prix_mensuel: 1500,
  },
  {
    id: 'module_metier_resto',
    nom: 'Module Restaurant',
    description: 'Fonctionnalites specifiques restauration',
    prix_mensuel: 1500,
  },
  {
    id: 'module_metier_medical',
    nom: 'Module Medical',
    description: 'Fonctionnalites specifiques sante',
    prix_mensuel: 2500,
  },
  {
    id: 'rh_avance',
    nom: 'RH & Planning',
    description: 'Gestion multi-employes, planning equipe, conges',
    prix_mensuel: 3500,
  },
  {
    id: 'paie',
    nom: 'Paie & Salaires',
    description: 'Gestion des fiches de paie, calcul salaires',
    prix_mensuel: 4500,
  },
  {
    id: 'social_media',
    nom: 'Reseaux Sociaux',
    description: 'Generation de posts IA, planification, publication',
    prix_mensuel: 2500,
  },
  {
    id: 'assistant_ia',
    nom: 'Assistant Personnel IA',
    description: 'Assistant IA personnel pour gerer vos taches',
    prix_mensuel: 3000,
  },
  {
    id: 'comptabilite',
    nom: 'Comptabilite',
    description: 'Suivi depenses, compte de resultat, exports',
    prix_mensuel: 2500,
  },
  {
    id: 'marketing',
    nom: 'Marketing Auto',
    description: 'Generation posts IA, campagnes promos, emails',
    prix_mensuel: 2900,
  },
  {
    id: 'seo',
    nom: 'SEO & Visibilite',
    description: 'Articles IA, optimisation mots-cles, Google My Business',
    prix_mensuel: 4000,
  },
  {
    id: 'sentinel_pro',
    nom: 'SENTINEL Pro',
    description: 'Monitoring avance, alertes temps reel, rapports',
    prix_mensuel: 2000,
  }
];

// ════════════════════════════════════════════════════════════════════
// FONCTIONS
// ════════════════════════════════════════════════════════════════════

async function createStripeProduct(module) {
  console.log(`  Creating product: ${module.nom}...`);

  // Creer le produit
  const product = await stripe.products.create({
    name: `NEXUS - ${module.nom}`,
    description: module.description,
    metadata: {
      module_id: module.id,
      source: 'nexus-setup'
    }
  });

  // Creer le prix mensuel
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: module.prix_mensuel,
    currency: 'eur',
    recurring: {
      interval: 'month'
    },
    metadata: {
      module_id: module.id
    }
  });

  console.log(`    ✓ Product: ${product.id}`);
  console.log(`    ✓ Price: ${price.id} (${module.prix_mensuel/100}€/mois)`);

  return { product, price };
}

async function saveToSupabase(module, product, price) {
  // Verifier si la table existe
  const { error: insertError } = await supabase
    .from('stripe_products')
    .upsert({
      module_id: module.id,
      module_name: module.nom,
      stripe_product_id: product.id,
      stripe_price_id: price.id,
      price_amount: module.prix_mensuel,
      currency: 'eur',
      interval: 'month',
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'module_id'
    });

  if (insertError) {
    if (insertError.message.includes('relation') || insertError.message.includes('does not exist')) {
      console.log('    ⚠️  Table stripe_products non trouvee, creation...');
      await createStripeProductsTable();
      // Retry
      await supabase.from('stripe_products').upsert({
        module_id: module.id,
        module_name: module.nom,
        stripe_product_id: product.id,
        stripe_price_id: price.id,
        price_amount: module.prix_mensuel,
        currency: 'eur',
        interval: 'month',
        updated_at: new Date().toISOString()
      }, { onConflict: 'module_id' });
    } else {
      console.error('    ✗ Erreur Supabase:', insertError.message);
    }
  }
}

async function createStripeProductsTable() {
  console.log('\n📦 Creation table stripe_products...');
  console.log('  Executez ce SQL dans Supabase:');
  console.log('─'.repeat(60));
  console.log(`
CREATE TABLE IF NOT EXISTS stripe_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id TEXT NOT NULL UNIQUE,
  module_name TEXT NOT NULL,
  stripe_product_id TEXT NOT NULL,
  stripe_price_id TEXT NOT NULL,
  price_amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'eur',
  interval TEXT DEFAULT 'month',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  amount INTEGER,
  currency TEXT,
  invoice_id TEXT,
  subscription_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_stripe_products_module ON stripe_products(module_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_tenant ON billing_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_created ON billing_events(created_at);

-- Ajouter colonnes Stripe aux tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS subscription_cancel_at TIMESTAMPTZ;
`);
  console.log('─'.repeat(60));
}

async function main() {
  console.log('═'.repeat(60));
  console.log('🚀 NEXUS - Configuration Stripe Products & Prices');
  console.log('═'.repeat(60));
  console.log('');
  console.log(`Mode Stripe: ${STRIPE_SECRET_KEY.startsWith('sk_live') ? '🔴 PRODUCTION' : '🟢 TEST'}`);
  console.log(`Nombre de modules: ${MODULES.length}`);
  console.log('');

  // Verifier les produits existants
  console.log('📋 Verification des produits existants...');
  const { data: existing } = await supabase
    .from('stripe_products')
    .select('module_id');

  const existingIds = new Set(existing?.map(e => e.module_id) || []);

  if (existingIds.size > 0) {
    console.log(`  ${existingIds.size} modules deja configures dans Supabase`);
  }

  // Creer les produits manquants
  console.log('\n🏗️  Creation des produits Stripe...\n');

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const module of MODULES) {
    try {
      if (existingIds.has(module.id)) {
        console.log(`  ⏭️  ${module.nom} - deja configure`);
        skipped++;
        continue;
      }

      const { product, price } = await createStripeProduct(module);
      await saveToSupabase(module, product, price);
      created++;
    } catch (error) {
      console.error(`  ✗ Erreur ${module.nom}:`, error.message);
      errors++;
    }
  }

  // Resume
  console.log('\n═'.repeat(60));
  console.log('📊 Resume:');
  console.log(`  ✓ Crees: ${created}`);
  console.log(`  ⏭️  Ignores: ${skipped}`);
  console.log(`  ✗ Erreurs: ${errors}`);
  console.log('═'.repeat(60));

  if (created > 0) {
    console.log('\n✅ Configuration Stripe terminee!');
    console.log('Les tenants peuvent maintenant souscrire aux modules.');
  }

  // Afficher le total mensuel potentiel
  const totalPrix = MODULES.reduce((sum, m) => sum + m.prix_mensuel, 0);
  console.log(`\n💰 Prix total tous modules: ${totalPrix/100}€/mois`);
}

main().catch(console.error);
