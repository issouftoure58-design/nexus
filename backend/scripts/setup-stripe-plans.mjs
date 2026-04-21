#!/usr/bin/env node

/**
 * NEXUS — Creation des plans Stripe (revision 21 avril 2026)
 *
 * Cree les plans (Starter 69€ / Pro 199€ / Business 599€) en mensuel + annuel
 * + les top-ups utilisation supplementaire (50€ / 200€ / 500€)
 * Archive TOUS les anciens produits/prix
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_live_xxx node scripts/setup-stripe-plans.mjs
 *
 * Variables d'environnement requises:
 *   STRIPE_SECRET_KEY  (DOIT etre la cle LIVE pour la production)
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

const isLive = STRIPE_SECRET_KEY.startsWith('sk_live');

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ════════════════════════════════════════════════════════════════════
// PRICING — 21 avril 2026 (modele inspire Claude)
// Source de verite : memory/business-model-2026.md + config/pricing.js
//
// Free     : 0€    (pas de produit Stripe)
// Starter  : 69€/mois  | 690€/an  (2 mois offerts)
// Pro      : 199€/mois | 1990€/an (2 mois offerts)
// Business : 599€/mois | 5990€/an (2 mois offerts)
// ════════════════════════════════════════════════════════════════════

const PLANS = [
  {
    code: 'nexus_starter',
    name: 'NEXUS Starter',
    description: 'Toutes les IA debloquees — 200 limites — 5 postes',
    monthlyAmount: 6900,     // 69��
    yearlyAmount: 69000,     // 690€/an (2 mois offerts)
    planId: 'starter',
  },
  {
    code: 'nexus_pro',
    name: 'NEXUS Pro',
    description: 'Tout illimite — 20 postes — Multi-sites — RH — IA x5',
    monthlyAmount: 19900,    // 199€
    yearlyAmount: 199000,    // 1990€/an (2 mois offerts)
    planId: 'pro',
  },
  {
    code: 'nexus_business',
    name: 'NEXUS Business',
    description: 'Full premium — 50 postes — White-label — API — SSO — IA x20',
    monthlyAmount: 59900,    // 599€
    yearlyAmount: 599000,    // 5990€/an (2 mois offerts)
    planId: 'business',
  },
];

const TOPUPS = [
  {
    code: 'nexus_usage_50',
    name: 'Utilisation IA supplementaire — 50€',
    description: '50€ d\'utilisation IA (-10%)',
    amount: 5000,  // 50€
  },
  {
    code: 'nexus_usage_200',
    name: 'Utilisation IA supplementaire — 200€',
    description: '200€ d\'utilisation IA (-20%)',
    amount: 20000, // 200€
  },
  {
    code: 'nexus_usage_500',
    name: 'Utilisation IA supplementaire — 500€',
    description: '500€ d\'utilisation IA (-30%)',
    amount: 50000, // 500€
  },
];

// Tous les anciens product_codes a desactiver
const DEPRECATED_CODES = [
  // v1 plans
  'nexus_starter_monthly', 'nexus_starter_yearly',
  'nexus_pro_monthly', 'nexus_pro_yearly',
  // v3 plans (Basic 29€ / Business 149€)
  'nexus_basic_monthly', 'nexus_basic_yearly',
  'nexus_business_monthly', 'nexus_business_yearly',
  // Anciens packs SMS/Voice
  'nexus_sms_100', 'nexus_sms_500', 'nexus_sms_1000', 'nexus_sms_5000',
  'nexus_voice_30', 'nexus_voice_60', 'nexus_voice_120', 'nexus_voice_300',
  // Anciens packs credits
  'nexus_credits_s', 'nexus_credits_m', 'nexus_credits_l',
  'nexus_credits_1000',
];

// ════════════════════════════════════════════════════════════════════

async function main() {
  console.log('='.repeat(60));
  console.log('NEXUS — Setup Stripe Plans (21 avril 2026)');
  console.log('='.repeat(60));
  console.log(`Mode: ${isLive ? '🔴 PRODUCTION (LIVE)' : '🟢 TEST'}`);
  console.log('');

  // ── 0. ARCHIVER ANCIENS PRODUITS STRIPE ──
  console.log('--- Archivage anciens produits ---');

  // Recuperer les anciens stripe_price_id pour les archiver sur Stripe
  const { data: oldProducts } = await supabase
    .from('stripe_products')
    .select('product_code, stripe_price_id, stripe_product_id')
    .in('product_code', DEPRECATED_CODES)
    .eq('active', true);

  if (oldProducts?.length) {
    for (const old of oldProducts) {
      try {
        // Archiver le prix sur Stripe
        if (old.stripe_price_id) {
          await stripe.prices.update(old.stripe_price_id, { active: false });
          console.log(`  🗄️ Prix archive: ${old.product_code} (${old.stripe_price_id})`);
        }
        // Archiver le produit sur Stripe
        if (old.stripe_product_id) {
          await stripe.products.update(old.stripe_product_id, { active: false });
        }
      } catch (err) {
        console.log(`  (!) ${old.product_code}: ${err.message}`);
      }
    }
  }

  // Desactiver en DB
  const { error: cleanErr } = await supabase
    .from('stripe_products')
    .update({ active: false, updated_at: new Date().toISOString() })
    .in('product_code', DEPRECATED_CODES);

  if (cleanErr) {
    console.log(`  (!) Nettoyage DB: ${cleanErr.message}`);
  } else {
    console.log(`  ✓ ${DEPRECATED_CODES.length} anciens produits desactives en DB`);
  }

  // Nettoyer anciennes references dans plans
  await supabase
    .from('plans')
    .update({ stripe_price_id_monthly: null, stripe_price_id_yearly: null })
    .in('id', ['basic', 'starter', 'pro']);
  console.log('  ✓ Anciennes references plans nettoyees');
  console.log('');

  // ── 1. PLANS (mensuel + annuel) ──
  for (const plan of PLANS) {
    console.log(`\n--- ${plan.name} (${plan.monthlyAmount / 100}EUR/mois) ---`);

    // Creer le produit Stripe
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { plan_id: plan.planId, source: 'nexus-setup-2026', pricing_version: '2026-04-21' },
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
    const { error: e1 } = await supabase.from('stripe_products').upsert({
      product_code: `${plan.code}_monthly`,
      stripe_product_id: product.id,
      stripe_price_id: monthlyPrice.id,
      name: `${plan.name} Mensuel`,
      description: plan.description,
      type: 'plan',
      billing_type: 'recurring',
      amount: plan.monthlyAmount,
      interval: 'month',
      trial_days: 0,
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'product_code' });
    if (e1) console.log(`  (!) stripe_products monthly: ${e1.message}`);

    // stripe_products (annuel)
    const { error: e2 } = await supabase.from('stripe_products').upsert({
      product_code: `${plan.code}_yearly`,
      stripe_product_id: product.id,
      stripe_price_id: yearlyPrice.id,
      name: `${plan.name} Annuel`,
      description: plan.description,
      type: 'plan',
      billing_type: 'recurring',
      amount: plan.yearlyAmount,
      interval: 'year',
      trial_days: 0,
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'product_code' });
    if (e2) console.log(`  (!) stripe_products yearly: ${e2.message}`);

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
      console.log(`  ✓ Table plans mise a jour (${plan.planId})`);
    }
  }

  // ── 2. TOP-UPS (utilisation supplementaire) ──
  console.log('\n--- Utilisation supplementaire ---');
  for (const topup of TOPUPS) {
    const product = await stripe.products.create({
      name: topup.name,
      description: topup.description,
      metadata: { topup_code: topup.code, source: 'nexus-setup-2026' },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: topup.amount,
      currency: 'eur',
      metadata: { topup_code: topup.code },
    });

    const { error: e3 } = await supabase.from('stripe_products').upsert({
      product_code: topup.code,
      stripe_product_id: product.id,
      stripe_price_id: price.id,
      name: topup.name,
      description: topup.description,
      type: 'pack',
      billing_type: 'one_time',
      amount: topup.amount,
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'product_code' });
    if (e3) console.log(`  (!) ${topup.code}: ${e3.message}`);

    console.log(`  ✓ ${topup.name}: ${price.id} (${topup.amount / 100}EUR)`);
  }

  // ── RESUME ──
  console.log('\n' + '='.repeat(60));
  console.log('TERMINE !');
  console.log('');
  console.log('Plans crees (revision 21 avril 2026):');
  console.log('  Free:     0EUR        (pas de produit Stripe)');
  console.log('  Starter:  69EUR/mois  | 690EUR/an');
  console.log('  Pro:      199EUR/mois | 1990EUR/an');
  console.log('  Business: 599EUR/mois | 5990EUR/an');
  console.log('');
  console.log('Top-ups utilisation supplementaire:');
  console.log('  50EUR  (-10%)');
  console.log('  200EUR (-20%)');
  console.log('  500EUR (-30%)');
  console.log('');
  console.log('Anciens produits archives:');
  console.log(`  ${DEPRECATED_CODES.length} product_codes desactives`);
  console.log('');
  console.log(`Mode: ${isLive ? '🔴 LIVE — pret pour la production' : '🟢 TEST — ne pas utiliser en production'}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('ERREUR:', err.message);
  process.exit(1);
});
