#!/usr/bin/env node

/**
 * NEXUS — Creation des plans Stripe (prix promo 100 premiers clients)
 *
 * Cree les 3 plans (Starter/Pro/Business) en mensuel + annuel sur Stripe
 * + les packs SMS et Voix IA
 * Met a jour stripe_products et plans en DB
 *
 * Usage:
 *   node scripts/setup-stripe-plans.mjs
 *
 * Variables d'environnement requises:
 *   STRIPE_SECRET_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_SECRET_KEY) { console.error('STRIPE_SECRET_KEY manquante'); process.exit(1); }
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Variables Supabase manquantes'); process.exit(1); }

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ════════════════════════════════════════════════════════════════════
// PRIX PROMO — 100 premiers clients
// Prix affiche barre dans l'UI : 99€/249€/499€
// Prix reel facture par Stripe : 79€/199€/399€
// ════════════════════════════════════════════════════════════════════

const PLANS = [
  {
    code: 'nexus_starter',
    name: 'NEXUS Starter',
    description: 'Plan Starter — 1 utilisateur, 200 clients, 200 SMS/mois',
    monthlyAmount: 7900,   // 79€ promo (au lieu de 99€)
    yearlyAmount: 75800,   // 758€/an promo (79€ x 12 x 0.8)
    planId: 'starter',
    trialDays: 14,
  },
  {
    code: 'nexus_pro',
    name: 'NEXUS Pro',
    description: 'Plan Pro — 5 utilisateurs, 2000 clients, 500 SMS/mois, Voix IA 60min',
    monthlyAmount: 19900,  // 199€ promo (au lieu de 249€)
    yearlyAmount: 191000,  // 1910€/an promo (199€ x 12 x 0.8)
    planId: 'pro',
    trialDays: 14,
  },
  {
    code: 'nexus_business',
    name: 'NEXUS Business',
    description: 'Plan Business — 20 utilisateurs, illimite, 2000 SMS/mois, Voix IA 300min',
    monthlyAmount: 39900,  // 399€ promo (au lieu de 499€)
    yearlyAmount: 383000,  // 3830€/an promo (399€ x 12 x 0.8)
    planId: 'business',
    trialDays: 14,
  },
];

const PACKS = [
  { code: 'nexus_sms_100',   name: 'Pack 100 SMS',         amount: 800,   desc: '100 SMS supplementaires' },
  { code: 'nexus_sms_500',   name: 'Pack 500 SMS',         amount: 3500,  desc: '500 SMS supplementaires' },
  { code: 'nexus_sms_1000',  name: 'Pack 1000 SMS',        amount: 6000,  desc: '1000 SMS supplementaires' },
  { code: 'nexus_sms_5000',  name: 'Pack 5000 SMS',        amount: 25000, desc: '5000 SMS supplementaires' },
  { code: 'nexus_voice_30',  name: 'Pack 30 min Voix IA',  amount: 600,   desc: '30 minutes IA vocale' },
  { code: 'nexus_voice_60',  name: 'Pack 60 min Voix IA',  amount: 1000,  desc: '60 minutes IA vocale' },
  { code: 'nexus_voice_120', name: 'Pack 120 min Voix IA', amount: 1800,  desc: '120 minutes IA vocale' },
  { code: 'nexus_voice_300', name: 'Pack 300 min Voix IA', amount: 3900,  desc: '300 minutes IA vocale' },
];

// ════════════════════════════════════════════════════════════════════

async function main() {
  console.log('='.repeat(60));
  console.log('NEXUS — Configuration Stripe Plans & Packs');
  console.log('='.repeat(60));
  console.log(`Mode: ${STRIPE_SECRET_KEY.startsWith('sk_live') ? 'PRODUCTION' : 'TEST'}`);
  console.log('');

  // ── 1. PLANS (mensuel + annuel) ──
  for (const plan of PLANS) {
    console.log(`\n--- ${plan.name} ---`);

    // Creer le produit Stripe
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { plan_id: plan.planId, source: 'nexus-setup' },
    });
    console.log(`  Produit: ${product.id}`);

    // Prix mensuel
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.monthlyAmount,
      currency: 'eur',
      recurring: { interval: 'month' },
      metadata: { plan_id: plan.planId, period: 'monthly' },
    });
    console.log(`  Prix mensuel: ${monthlyPrice.id} (${plan.monthlyAmount / 100}EUR/mois)`);

    // Prix annuel
    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.yearlyAmount,
      currency: 'eur',
      recurring: { interval: 'year' },
      metadata: { plan_id: plan.planId, period: 'yearly' },
    });
    console.log(`  Prix annuel: ${yearlyPrice.id} (${plan.yearlyAmount / 100}EUR/an)`);

    // Sauvegarder en DB — stripe_products (mensuel)
    await supabase.from('stripe_products').upsert({
      product_code: `${plan.code}_monthly`,
      stripe_product_id: product.id,
      stripe_price_id: monthlyPrice.id,
      name: `${plan.name} Mensuel`,
      description: plan.description,
      type: 'plan',
      billing_type: 'recurring',
      amount: plan.monthlyAmount,
      interval: 'month',
      trial_days: plan.trialDays,
      active: true,
    }, { onConflict: 'product_code' });

    // stripe_products (annuel)
    await supabase.from('stripe_products').upsert({
      product_code: `${plan.code}_yearly`,
      stripe_product_id: product.id,
      stripe_price_id: yearlyPrice.id,
      name: `${plan.name} Annuel`,
      description: plan.description,
      type: 'plan',
      billing_type: 'recurring',
      amount: plan.yearlyAmount,
      interval: 'year',
      trial_days: plan.trialDays,
      active: true,
    }, { onConflict: 'product_code' });

    // Mettre a jour la table plans avec les stripe_price_id
    const { error: planErr } = await supabase
      .from('plans')
      .update({
        stripe_price_id_monthly: monthlyPrice.id,
        stripe_price_id_yearly: yearlyPrice.id,
      })
      .eq('id', plan.planId);

    if (planErr) {
      console.log(`  (!) Table plans update: ${planErr.message}`);
    } else {
      console.log(`  Table plans mise a jour (${plan.planId})`);
    }
  }

  // ── 2. PACKS SMS & VOIX ──
  console.log('\n--- Packs SMS & Voix IA ---');
  for (const pack of PACKS) {
    const product = await stripe.products.create({
      name: pack.name,
      description: pack.desc,
      metadata: { pack_code: pack.code, source: 'nexus-setup' },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: pack.amount,
      currency: 'eur',
      metadata: { pack_code: pack.code },
    });

    await supabase.from('stripe_products').upsert({
      product_code: pack.code,
      stripe_product_id: product.id,
      stripe_price_id: price.id,
      name: pack.name,
      description: pack.desc,
      type: 'pack',
      billing_type: 'one_time',
      amount: pack.amount,
      active: true,
    }, { onConflict: 'product_code' });

    console.log(`  ${pack.name}: ${price.id} (${pack.amount / 100}EUR)`);
  }

  // ── RESUME ──
  console.log('\n' + '='.repeat(60));
  console.log('TERMINE !');
  console.log('');
  console.log('Plans crees (prix promo 100 premiers clients):');
  console.log('  Starter: 79EUR/mois  (au lieu de 99EUR)');
  console.log('  Pro:     199EUR/mois (au lieu de 249EUR)');
  console.log('  Business: 399EUR/mois (au lieu de 499EUR)');
  console.log('');
  console.log(`Packs: ${PACKS.length} crees`);
  console.log('');
  console.log('Les stripe_price_id sont sauvegardes dans:');
  console.log('  - Table stripe_products (product_code + stripe_price_id)');
  console.log('  - Table plans (stripe_price_id_monthly + stripe_price_id_yearly)');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('ERREUR:', err.message);
  process.exit(1);
});
