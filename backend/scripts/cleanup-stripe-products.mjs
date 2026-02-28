#!/usr/bin/env node
/**
 * Nettoie les produits Stripe en doublon
 * Archive tous les produits sauf ceux référencés dans stripe_products
 */

import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('🧹 Nettoyage des produits Stripe en doublon...\n');
console.log(`Mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_') ? '🔴 PRODUCTION' : '🟢 TEST'}\n`);

async function cleanup() {
  // 1. Récupérer les IDs de produits valides depuis la DB
  const { data: dbProducts, error } = await supabase
    .from('stripe_products')
    .select('stripe_product_id');

  if (error) {
    console.error('❌ Erreur lecture DB:', error.message);
    process.exit(1);
  }

  const validProductIds = new Set(dbProducts.map(p => p.stripe_product_id));
  console.log(`📦 ${validProductIds.size} produits valides dans la DB\n`);

  // 2. Lister tous les produits Stripe actifs
  const allProducts = [];
  let hasMore = true;
  let startingAfter = null;

  while (hasMore) {
    const params = { limit: 100, active: true };
    if (startingAfter) params.starting_after = startingAfter;
    
    const response = await stripe.products.list(params);
    allProducts.push(...response.data);
    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
  }

  console.log(`📋 ${allProducts.length} produits actifs sur Stripe\n`);

  // 3. Archiver les produits non référencés
  let archived = 0;
  let kept = 0;

  for (const product of allProducts) {
    if (validProductIds.has(product.id)) {
      console.log(`✓ ${product.name} (${product.id}) - conservé`);
      kept++;
    } else {
      try {
        await stripe.products.update(product.id, { active: false });
        console.log(`🗄️ ${product.name} (${product.id}) - archivé`);
        archived++;
      } catch (err) {
        console.error(`❌ Erreur archivage ${product.id}:`, err.message);
      }
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`\n📊 Résumé:`);
  console.log(`   ✓ Conservés: ${kept}`);
  console.log(`   🗄️ Archivés: ${archived}`);
  console.log(`\n🎉 Nettoyage terminé!`);
}

cleanup().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
