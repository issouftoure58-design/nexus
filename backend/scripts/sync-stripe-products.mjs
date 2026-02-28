#!/usr/bin/env node
/**
 * Sync Stripe Products
 *
 * Crée les produits et prix dans Stripe à partir de la table stripe_products
 * Puis met à jour les stripe_product_id et stripe_price_id
 *
 * Usage: node scripts/sync-stripe-products.mjs
 *
 * Requis: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Charger .env
dotenv.config();

// Configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ STRIPE_SECRET_KEY requis');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('🔄 Synchronisation des produits Stripe...\n');
console.log(`Mode: ${STRIPE_SECRET_KEY.startsWith('sk_live_') ? '🔴 PRODUCTION' : '🟢 TEST'}\n`);

async function syncProducts() {
  // 1. Récupérer tous les produits de la DB
  const { data: products, error } = await supabase
    .from('stripe_products')
    .select('*')
    .eq('active', true)
    .order('id');

  if (error) {
    console.error('❌ Erreur lecture DB:', error.message);
    process.exit(1);
  }

  console.log(`📦 ${products.length} produits à synchroniser\n`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    try {
      // Vérifier si le produit existe déjà dans Stripe
      let stripeProduct;
      let stripePrice;

      if (product.stripe_product_id) {
        // Le produit existe, vérifier s'il est valide
        try {
          stripeProduct = await stripe.products.retrieve(product.stripe_product_id);
          console.log(`✓ ${product.product_code} - Produit existant: ${stripeProduct.id}`);

          // Vérifier si le prix existe ET si le montant est correct
          if (product.stripe_price_id) {
            try {
              stripePrice = await stripe.prices.retrieve(product.stripe_price_id);

              // Vérifier si le montant a changé
              if (stripePrice.unit_amount === product.amount) {
                console.log(`  ✓ Prix existant: ${stripePrice.id} (${product.amount / 100}€)`);
                skipped++;
                continue;
              } else {
                // Le montant a changé, créer un nouveau prix
                console.log(`  ⚠️ Prix modifié: ${stripePrice.unit_amount / 100}€ → ${product.amount / 100}€`);
                // Archiver l'ancien prix
                await stripe.prices.update(stripePrice.id, { active: false });
                console.log(`  🗄️ Ancien prix archivé: ${stripePrice.id}`);
                stripePrice = null; // Force la création d'un nouveau prix
              }
            } catch {
              // Prix n'existe plus, le recréer
              console.log(`  ⚠️ Prix invalide, recréation...`);
            }
          }
        } catch {
          // Produit n'existe plus, le recréer
          console.log(`⚠️ ${product.product_code} - Produit invalide, recréation...`);
          stripeProduct = null;
        }
      }

      // Créer le produit si nécessaire
      if (!stripeProduct) {
        stripeProduct = await stripe.products.create({
          name: product.name,
          description: product.description || undefined,
          metadata: {
            product_code: product.product_code,
            type: product.type,
            nexus: 'true'
          }
        });
        console.log(`✅ ${product.product_code} - Produit créé: ${stripeProduct.id}`);
        created++;
      }

      // Créer le prix
      const priceData = {
        product: stripeProduct.id,
        unit_amount: product.amount,
        currency: product.currency || 'eur',
        metadata: {
          product_code: product.product_code
        }
      };

      // Ajouter récurrence si applicable
      if (product.billing_type === 'recurring' && product.interval) {
        priceData.recurring = {
          interval: product.interval,
          interval_count: product.interval_count || 1
        };
      }

      stripePrice = await stripe.prices.create(priceData);
      console.log(`  ✅ Prix créé: ${stripePrice.id} (${product.amount / 100}€/${product.interval || 'once'})`);

      // Mettre à jour la DB avec les IDs Stripe
      const { error: updateError } = await supabase
        .from('stripe_products')
        .update({
          stripe_product_id: stripeProduct.id,
          stripe_price_id: stripePrice.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', product.id);

      if (updateError) {
        console.error(`  ❌ Erreur mise à jour DB:`, updateError.message);
      } else {
        updated++;
      }

    } catch (err) {
      console.error(`❌ ${product.product_code} - Erreur:`, err.message);
    }

    console.log('');
  }

  console.log('═'.repeat(50));
  console.log(`\n📊 Résumé:`);
  console.log(`   ✅ Créés: ${created}`);
  console.log(`   🔄 Mis à jour: ${updated}`);
  console.log(`   ⏭️  Ignorés: ${skipped}`);
  console.log(`\n🎉 Synchronisation terminée!`);
}

// Exécuter
syncProducts().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
