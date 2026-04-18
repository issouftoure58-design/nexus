#!/usr/bin/env node

/**
 * NEXUS — Creation des plans Stripe (revision finale 9 avril 2026)
 *
 * Cree les plans (Basic 29€/Business 149€) en mensuel + annuel sur Stripe
 * + le pack credits unique (Pack 1000 — 15€)
 * Met a jour stripe_products et plans en DB
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
// PRICING REVISION FINALE — 9 avril 2026
// Source de verite : memory/business-model-2026.md + config/pricing.js
//
// Free  : 0€    (pas de produit Stripe, pas de checkout)
// Basic : 29€/mois  | 290€/an  (2 mois offerts)
// Business : 149€/mois | 1490€/an (2 mois offerts)
// ════════════════════════════════════════════════════════════════════

const PLANS = [
  {
    code: 'nexus_basic',
    name: 'NEXUS Basic',
    description: 'Tout illimite — 1 000 credits IA inclus/mois',
    monthlyAmount: 2900,    // 29€
    yearlyAmount: 29000,    // 290€/an (2 mois offerts)
    planId: 'basic',
    trialDays: 0,
  },
  {
    code: 'nexus_business',
    name: 'NEXUS Business',
    description: 'Multi-site + white-label + API + SSO + 10 000 credits IA inclus/mois',
    monthlyAmount: 14900,   // 149€
    yearlyAmount: 149000,   // 1490€/an (2 mois offerts)
    planId: 'business',
    trialDays: 0,
  },
];

const PACKS = [
  {
    code: 'nexus_credits_1000',
    name: 'Pack 1000 credits',
    amount: 1500,  // 15€
    desc: '1 000 credits IA (taux base, sans bonus)',
  },
];

// Anciens product_codes a desactiver (plans et packs obsoletes)
const DEPRECATED_CODES = [
  'nexus_starter_monthly', 'nexus_starter_yearly',
  'nexus_pro_monthly', 'nexus_pro_yearly',
  'nexus_sms_100', 'nexus_sms_500', 'nexus_sms_1000', 'nexus_sms_5000',
  'nexus_voice_30', 'nexus_voice_60', 'nexus_voice_120', 'nexus_voice_300',
  'nexus_credits_s', 'nexus_credits_m', 'nexus_credits_l',
];

// ════════════════════════════════════════════════════════════════════

async function main() {
  console.log('='.repeat(60));
  console.log('NEXUS — Configuration Stripe Plans & Pack Credits');
  console.log('='.repeat(60));
  console.log(`Mode: ${isLive ? '🔴 PRODUCTION (LIVE)' : '🟢 TEST'}`);
  console.log('');

  if (!isLive) {
    console.log('⚠️  ATTENTION: Cle TEST detectee. Les price IDs crees ne fonctionneront PAS en production.');
    console.log('   Pour la production, utiliser: STRIPE_SECRET_KEY=sk_live_xxx node scripts/setup-stripe-plans.mjs');
    console.log('');
  }

  // ── 0. DESACTIVER ANCIENS PRODUITS ──
  console.log('--- Nettoyage anciens produits ---');
  const { error: cleanErr } = await supabase
    .from('stripe_products')
    .update({ active: false, updated_at: new Date().toISOString() })
    .in('product_code', DEPRECATED_CODES);

  if (cleanErr) {
    console.log(`  (!) Nettoyage: ${cleanErr.message}`);
  } else {
    console.log(`  ✓ ${DEPRECATED_CODES.length} anciens produits desactives`);
  }

  // Aussi nettoyer les anciennes references dans plans (starter/pro)
  await supabase
    .from('plans')
    .update({ stripe_price_id_monthly: null, stripe_price_id_yearly: null })
    .in('id', ['starter', 'pro']);
  console.log('  ✓ Anciennes references plans (starter/pro) nettoyees');
  console.log('');

  // ── 1. PLANS (mensuel + annuel) ──
  for (const plan of PLANS) {
    console.log(`\n--- ${plan.name} (${plan.monthlyAmount / 100}EUR/mois) ---`);

    // Creer le produit Stripe
    const product = await stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: { plan_id: plan.planId, source: 'nexus-setup-2026', pricing_version: '2026-04-09' },
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
      trial_days: plan.trialDays,
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
      trial_days: plan.trialDays,
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

  // ── 2. PACK CREDITS ──
  console.log('\n--- Pack Credits ---');
  for (const pack of PACKS) {
    const product = await stripe.products.create({
      name: pack.name,
      description: pack.desc,
      metadata: { pack_code: pack.code, source: 'nexus-setup-2026' },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: pack.amount,
      currency: 'eur',
      metadata: { pack_code: pack.code },
    });

    const { error: e3 } = await supabase.from('stripe_products').upsert({
      product_code: pack.code,
      stripe_product_id: product.id,
      stripe_price_id: price.id,
      name: pack.name,
      description: pack.desc,
      type: 'pack',
      billing_type: 'one_time',
      amount: pack.amount,
      active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'product_code' });
    if (e3) console.log(`  (!) ${pack.code}: ${e3.message}`);

    console.log(`  ✓ ${pack.name}: ${price.id} (${pack.amount / 100}EUR)`);
  }

  // ── RESUME ──
  console.log('\n' + '='.repeat(60));
  console.log('TERMINE !');
  console.log('');
  console.log('Plans crees (revision finale 9 avril 2026):');
  console.log('  Free:     0EUR        (pas de produit Stripe)');
  console.log('  Basic:    29EUR/mois  | 290EUR/an');
  console.log('  Business: 149EUR/mois | 1490EUR/an');
  console.log('');
  console.log('Pack credits:');
  console.log('  Pack 1000: 15EUR (1000 credits, 0% bonus)');
  console.log('');
  console.log('Les stripe_price_id sont sauvegardes dans:');
  console.log('  - Table stripe_products (product_code + stripe_price_id)');
  console.log('  - Table plans (stripe_price_id_monthly + stripe_price_id_yearly)');
  console.log('');
  console.log(`Mode: ${isLive ? '🔴 LIVE — pret pour la production' : '🟢 TEST — ne pas utiliser en production'}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('ERREUR:', err.message);
  process.exit(1);
});
