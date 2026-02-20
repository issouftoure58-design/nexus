#!/usr/bin/env node
/**
 * Fix Tenant nexus-test plan
 * Met à jour le plan à 'business' et active tous les modules
 *
 * Usage: node backend/scripts/fix-nexus-test-plan.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const TENANT_ID = 'nexus-test';

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║       FIX TENANT nexus-test - Plan Business                   ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  try {
    // 1. Vérifier tenant actuel
    console.log('1️⃣  Vérification tenant actuel...');
    const { data: current, error: readError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', TENANT_ID)
      .single();

    if (readError || !current) {
      console.error('❌ Tenant non trouvé:', readError?.message);
      process.exit(1);
    }

    console.log(`   plan: ${current.plan}`);
    console.log(`   plan_id: ${current.plan_id}`);
    console.log(`   status: ${current.status}`);
    console.log(`   options_canaux_actifs: ${JSON.stringify(current.options_canaux_actifs)}`);
    console.log(`   modules_actifs: ${JSON.stringify(current.modules_actifs)}`);
    console.log('');

    // 2. Mettre à jour le plan et les modules
    console.log('2️⃣  Mise à jour vers plan business + activation modules...');

    const updateData = {
      plan: 'business',
      plan_id: 'business',
      options_canaux_actifs: {
        agent_ia_web: true,
        agent_ia_whatsapp: true,
        agent_ia_telephone: true,
        site_web: true
      },
      modules_actifs: {
        agent_ia_web: true,
        agent_ia_whatsapp: true,
        agent_ia_telephone: true,
        site_web: true,
        sentinel: true,
        crm_avance: true,
        analytics: true,
        comptabilite: true,
        marketing: true,
        commercial: true,
        stock: true,
        seo: true,
        rh: true,
        churn_prevention: true
      },
      settings: {
        frozen: false,
        tier: 'business',
        features: {
          all: true,
          sentinel: true,
          agent_ia_web: true,
          agent_ia_whatsapp: true,
          agent_ia_telephone: true
        }
      }
    };

    const { data: updated, error: updateError } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', TENANT_ID)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erreur mise à jour:', updateError.message);

      // Essayer avec moins de colonnes si certaines n'existent pas
      console.log('\n   Tentative avec colonnes minimales...');
      const minimalUpdate = {
        plan: 'business',
      };

      // Ajouter les colonnes qui existent
      if (current.hasOwnProperty('plan_id')) minimalUpdate.plan_id = 'business';
      if (current.hasOwnProperty('options_canaux_actifs')) {
        minimalUpdate.options_canaux_actifs = {
          agent_ia_web: true,
          agent_ia_whatsapp: true,
          agent_ia_telephone: true,
          site_web: true
        };
      }
      if (current.hasOwnProperty('modules_actifs')) {
        minimalUpdate.modules_actifs = {
          agent_ia_web: true,
          agent_ia_whatsapp: true,
          agent_ia_telephone: true,
          sentinel: true
        };
      }

      const { data: updated2, error: error2 } = await supabase
        .from('tenants')
        .update(minimalUpdate)
        .eq('id', TENANT_ID)
        .select()
        .single();

      if (error2) {
        console.error('❌ Erreur 2:', error2.message);
        process.exit(1);
      }

      console.log('   ✓ Mise à jour partielle réussie');
      console.log(`   plan: ${updated2.plan}`);
      console.log(`   plan_id: ${updated2.plan_id}`);
      console.log(`   options_canaux_actifs: ${JSON.stringify(updated2.options_canaux_actifs)}`);
    } else {
      console.log('   ✓ Mise à jour complète réussie');
      console.log(`   plan: ${updated.plan}`);
      console.log(`   plan_id: ${updated.plan_id}`);
      console.log(`   options_canaux_actifs: ${JSON.stringify(updated.options_canaux_actifs)}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ TENANT CORRIGÉ AVEC SUCCÈS !');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('📊 RÉSUMÉ :');
    console.log(`   - Tenant:        ${TENANT_ID}`);
    console.log(`   - Plan:          business`);
    console.log(`   - Canaux IA:     web, whatsapp, telephone`);
    console.log(`   - Sentinel:      activé`);
    console.log('\n🔄 Actions requises:');
    console.log('   1. Redémarrer le backend (pour vider le cache)');
    console.log('   2. Rafraîchir la page admin');
    console.log('');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
