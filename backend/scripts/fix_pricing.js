import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Script de nettoyage du pricing NEXUS
 * Aligne sur le pricing validé dans PRICING_STRATEGY.md
 *
 * Plans:
 * - Starter: 199€/mois
 * - Pro: 399€/mois
 * - Business: 799€/mois
 */

async function fixPricing() {
  console.log('🔧 Nettoyage du système de pricing NEXUS\n');

  // 1. Mettre à jour la table plans avec les colonnes existantes
  console.log('📋 Mise à jour de la table plans...');

  const plans = [
    {
      id: 'starter',
      nom: 'Starter',
      description: 'Pour les petits établissements et indépendants',
      prix_mensuel: 19900, // 199€ en centimes
      clients_max: 1000,
      stockage_mb: 2000, // 2 GB
      utilisateurs_inclus: 1,
      prix_utilisateur_sup: 0, // Pas disponible pour Starter
      posts_ia_mois: 100,
      images_dalle_mois: 100,
      // Modules désactivés
      crm_avance: false,
      marketing_automation: false,
      comptabilite: false,
      commercial: false,
      stock_inventaire: false,
      analytics_avances: false,
      seo_visibilite: false,
      rh_multiemployes: false,
      api_integrations: false,
      white_label: false,
      sentinel_niveau: 'basic',
      support_email_heures: 48,
      support_chat: false,
      support_telephone: false,
      account_manager: false,
      assistant_mode: 'consultation',
      ordre: 1,
      actif: true
    },
    {
      id: 'pro',
      nom: 'Pro',
      description: 'Pour les établissements en croissance',
      prix_mensuel: 39900, // 399€ en centimes
      clients_max: 3000,
      stockage_mb: 10000, // 10 GB
      utilisateurs_inclus: 5,
      prix_utilisateur_sup: 2000, // 20€
      posts_ia_mois: 500,
      images_dalle_mois: 500,
      // Modules Pro
      crm_avance: true,
      marketing_automation: true,
      comptabilite: true,
      commercial: true,
      stock_inventaire: true,
      analytics_avances: true,
      seo_visibilite: false,
      rh_multiemployes: false,
      api_integrations: false,
      white_label: false,
      sentinel_niveau: 'standard',
      support_email_heures: 24,
      support_chat: true,
      support_telephone: false,
      account_manager: false,
      assistant_mode: 'execution',
      ordre: 2,
      actif: true
    },
    {
      id: 'business',
      nom: 'Business',
      description: 'Pour les multi-établissements et franchises',
      prix_mensuel: 79900, // 799€ en centimes
      clients_max: null, // illimité
      stockage_mb: null, // illimité
      utilisateurs_inclus: 10,
      prix_utilisateur_sup: 1500, // 15€
      posts_ia_mois: 1000,
      images_dalle_mois: 1000,
      // Tous modules
      crm_avance: true,
      marketing_automation: true,
      comptabilite: true,
      commercial: true,
      stock_inventaire: true,
      analytics_avances: true,
      seo_visibilite: true,
      rh_multiemployes: true,
      api_integrations: true,
      white_label: true,
      sentinel_niveau: 'intelligence',
      support_email_heures: 4,
      support_chat: true,
      support_telephone: true,
      account_manager: true,
      assistant_mode: 'proactif',
      ordre: 3,
      actif: true
    }
  ];

  for (const plan of plans) {
    const { error } = await supabase
      .from('plans')
      .upsert(plan, { onConflict: 'id' });

    if (error) {
      console.error(`  ❌ Erreur plan ${plan.id}:`, error.message);
    } else {
      console.log(`  ✅ ${plan.nom}: ${(plan.prix_mensuel/100).toFixed(0)}€/mois`);
    }
  }

  // 2. Vérifier les tenants et leur plan
  console.log('\n👥 Vérification des tenants...');

  const { data: tenants, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, name, plan, plan_id, tier');

  if (tenantErr) {
    console.error('Erreur récupération tenants:', tenantErr);
    return;
  }

  for (const tenant of tenants || []) {
    // Normaliser: utiliser plan_id ou plan ou tier, dans cet ordre
    const currentPlan = tenant.plan_id || tenant.plan || tenant.tier || 'starter';

    // Vérifier que le plan existe
    const validPlans = ['starter', 'pro', 'business'];
    const normalizedPlan = validPlans.includes(currentPlan.toLowerCase())
      ? currentPlan.toLowerCase()
      : 'starter';

    // Mettre à jour si nécessaire
    if (tenant.plan !== normalizedPlan) {
      const { error: updateErr } = await supabase
        .from('tenants')
        .update({ plan: normalizedPlan })
        .eq('id', tenant.id);

      if (updateErr) {
        console.log(`  ❌ ${tenant.name}: erreur mise à jour`);
      } else {
        console.log(`  🔄 ${tenant.name}: ${tenant.plan || 'null'} → ${normalizedPlan}`);
      }
    } else {
      console.log(`  ✅ ${tenant.name}: ${normalizedPlan}`);
    }
  }

  console.log('\n✅ Nettoyage terminé!');
}

fixPricing().catch(console.error);
