/**
 * SEO Tracking Job - Business Plan
 * Tracking hebdomadaire des positions Google
 *
 * NOTE: Version simulation - intégration Google Search Console API à faire
 * NOTE: Adapté au schéma DB existant
 */

import { supabase } from '../config/supabase.js';

/**
 * Job hebdomadaire : tracker positions Google
 * S'exécute tous les lundis à 9h
 */
export async function jobSEOTracking() {
  console.log('[SEO] 📊 Début tracking positions...');

  try {
    // Récupérer tous les keywords actifs de tous les tenants Business
    const { data: keywords, error: kwError } = await supabase
      .from('seo_keywords')
      .select(`
        id,
        tenant_id,
        keyword,
        target_url,
        current_position,
        previous_position
      `)
      .eq('status', 'active');

    if (kwError) {
      console.error('[SEO] Erreur récupération keywords:', kwError);
      return;
    }

    if (!keywords || keywords.length === 0) {
      console.log('[SEO] Aucun mot-clé actif à tracker');
      return;
    }

    console.log(`[SEO] ${keywords.length} mots-clés à tracker`);

    let tracked = 0;
    let errors = 0;

    for (const keyword of keywords) {
      try {
        // SIMULATION position Google
        // En production: utiliser Google Search Console API ou service tiers
        // const position = await getRealGooglePosition(keyword.keyword, keyword.target_url);

        const position = simulateGooglePosition(keyword.current_position);

        // Enregistrer dans historique (table seo_positions)
        const { error: histError } = await supabase
          .from('seo_positions')
          .insert({
            keyword_id: keyword.id,
            position,
            url: keyword.target_url
          });

        if (histError) {
          console.error(`[SEO] Erreur historique keyword ${keyword.id}:`, histError.message);
          errors++;
          continue;
        }

        // Mettre à jour position actuelle et précédente
        const { error: updateError } = await supabase
          .from('seo_keywords')
          .update({
            previous_position: keyword.current_position,
            current_position: position,
            last_checked: new Date()
          })
          .eq('id', keyword.id);

        if (updateError) {
          console.error(`[SEO] Erreur update keyword ${keyword.id}:`, updateError.message);
          errors++;
          continue;
        }

        // Mettre à jour best_position si meilleure
        if (!keyword.best_position || position < keyword.best_position) {
          await supabase
            .from('seo_keywords')
            .update({ best_position: position })
            .eq('id', keyword.id);
        }

        tracked++;

        // Log progression tous les 10 keywords
        if (tracked % 10 === 0) {
          console.log(`[SEO] ${tracked}/${keywords.length} positions trackées...`);
        }

      } catch (err) {
        console.error(`[SEO] Erreur tracking keyword ${keyword.id}:`, err.message);
        errors++;
      }
    }

    console.log(`[SEO] ✅ Tracking terminé: ${tracked} positions mises à jour, ${errors} erreurs`);

    // Générer alertes si positions importantes perdues
    await checkPositionAlerts(keywords);

  } catch (error) {
    console.error('[SEO] ❌ Erreur job tracking:', error);
  }
}

/**
 * Simule une position Google (pour développement)
 * En production, remplacer par vraie API
 */
function simulateGooglePosition(currentPosition) {
  if (!currentPosition) {
    // Nouvelle entrée: position aléatoire entre 20 et 100
    return Math.floor(Math.random() * 80) + 20;
  }

  // Variation réaliste de +/- 5 positions
  const variation = Math.floor(Math.random() * 11) - 5;
  const newPosition = currentPosition + variation;

  // Garder entre 1 et 100
  return Math.max(1, Math.min(100, newPosition));
}

/**
 * Vérifie les alertes de position
 */
async function checkPositionAlerts(keywords) {
  try {
    for (const keyword of keywords) {
      // Récupérer les 2 dernières positions
      const { data: history } = await supabase
        .from('seo_positions')
        .select('position')
        .eq('keyword_id', keyword.id)
        .order('checked_at', { ascending: false })
        .limit(2);

      if (history && history.length >= 2) {
        const [current, previous] = history;
        const drop = current.position - previous.position;

        // Alerte si perte de plus de 10 positions
        if (drop > 10) {
          console.log(`[SEO] ⚠️ Alerte: "${keyword.keyword}" a perdu ${drop} positions (${previous.position} → ${current.position})`);

          // Créer recommandation automatique
          await supabase
            .from('seo_recommendations')
            .insert({
              tenant_id: keyword.tenant_id,
              type: 'technical',
              titre: `Perte de position: ${keyword.keyword}`,
              description: `Le mot-clé "${keyword.keyword}" a perdu ${drop} positions cette semaine (${previous.position} → ${current.position}). Vérifier le contenu et les backlinks.`,
              priorite: drop > 20 ? 'high' : 'medium',
              impact_estime: 'Récupérer les positions perdues peut restaurer le trafic',
              statut: 'active'
            });
        }

        // Alerte positive si gain top 10
        if (previous.position > 10 && current.position <= 10) {
          console.log(`[SEO] 🎉 "${keyword.keyword}" est entré dans le top 10 ! (${previous.position} → ${current.position})`);
        }
      }
    }
  } catch (error) {
    console.error('[SEO] Erreur vérification alertes:', error);
  }
}

/**
 * Exécution manuelle du tracking (pour tests)
 */
export async function runSEOTrackingManually() {
  console.log('[SEO] Exécution manuelle du tracking...');
  await jobSEOTracking();
}

export default {
  jobSEOTracking,
  runSEOTrackingManually
};
