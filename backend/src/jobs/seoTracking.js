/**
 * SEO Tracking Job - Business Plan
 * Tracking hebdomadaire des positions Google
 *
 * NOTE: Version simulation - intégration Google Search Console API à faire
 * NOTE: Adapté au schéma DB migration 010
 */

import { supabase } from '../config/supabase.js';

/**
 * Job hebdomadaire : tracker positions Google
 * S'exécute tous les lundis à 9h
 */
export async function jobSEOTracking() {
  console.log('[SEO] 📊 Début tracking positions...');

  try {
    // Récupérer tous les tenants avec keywords actifs
    const { data: tenantKeywords, error: tenantError } = await supabase
      .from('seo_keywords')
      .select('tenant_id')
      .eq('actif', true);

    if (tenantError) {
      console.error('[SEO] Erreur récupération tenants:', tenantError);
      return;
    }

    // Dédupliquer les tenant_ids
    const tenantIds = [...new Set((tenantKeywords || []).map(k => k.tenant_id).filter(Boolean))];

    if (tenantIds.length === 0) {
      console.log('[SEO] Aucun tenant avec mots-clés actifs');
      return;
    }

    let totalTracked = 0;
    let totalErrors = 0;

    // Traiter chaque tenant séparément pour l'isolation
    for (const tenantId of tenantIds) {
      if (!tenantId) continue;

      // Récupérer les keywords actifs pour ce tenant
      // Schéma: mot_cle, position_actuelle, url_cible, actif (migration 010)
      const { data: keywords, error: kwError } = await supabase
        .from('seo_keywords')
        .select(`
          id,
          tenant_id,
          mot_cle,
          url_cible,
          position_actuelle
        `)
        .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
        .eq('actif', true);

    if (kwError) {
      console.error(`[SEO] Erreur récupération keywords pour tenant ${tenantId}:`, kwError);
      continue;
    }

    if (!keywords || keywords.length === 0) {
      continue;
    }

    console.log(`[SEO] Tenant ${tenantId}: ${keywords.length} mots-clés à tracker`);

    let tracked = 0;
    let errors = 0;

    for (const keyword of keywords) {
      try {
        // SIMULATION position Google
        // En production: utiliser Google Search Console API ou service tiers
        const position = simulateGooglePosition(keyword.position_actuelle);

        // Enregistrer dans historique (table seo_positions_history - migration 010)
        const { error: histError } = await supabase
          .from('seo_positions_history')
          .insert({
            tenant_id: tenantId,  // 🔒 TENANT ISOLATION
            keyword_id: keyword.id,
            position,
            url_classee: keyword.url_cible,
            date_mesure: new Date().toISOString()
          });

        if (histError) {
          console.error(`[SEO] Erreur historique keyword ${keyword.id}:`, histError.message);
          errors++;
          continue;
        }

        // Mettre à jour position actuelle
        const { error: updateError } = await supabase
          .from('seo_keywords')
          .update({
            position_actuelle: position
          })
          .eq('id', keyword.id)
          .eq('tenant_id', tenantId);  // 🔒 TENANT ISOLATION

        if (updateError) {
          console.error(`[SEO] Erreur update keyword ${keyword.id}:`, updateError.message);
          errors++;
          continue;
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

    totalTracked += tracked;
    totalErrors += errors;

    // Générer alertes si positions importantes perdues
    await checkPositionAlerts(keywords, tenantId);
    } // End tenant loop

    console.log(`[SEO] ✅ Tracking terminé: ${totalTracked} positions mises à jour, ${totalErrors} erreurs`);

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
async function checkPositionAlerts(keywords, tenantId) {
  if (!tenantId) {
    console.error('[SEO] checkPositionAlerts requires tenantId');
    return;
  }

  try {
    for (const keyword of keywords) {
      // Récupérer les 2 dernières positions depuis seo_positions_history
      const { data: history } = await supabase
        .from('seo_positions_history')
        .select('position, date_mesure')
        .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
        .eq('keyword_id', keyword.id)
        .order('date_mesure', { ascending: false })
        .limit(2);

      if (history && history.length >= 2) {
        const [current, previous] = history;
        const drop = current.position - previous.position;

        // Alerte si perte de plus de 10 positions
        if (drop > 10) {
          console.log(`[SEO] ⚠️ Alerte: "${keyword.mot_cle}" a perdu ${drop} positions (${previous.position} → ${current.position})`);

          // Créer recommandation automatique
          await supabase
            .from('seo_recommendations')
            .insert({
              tenant_id: tenantId,  // 🔒 TENANT ISOLATION - Use passed tenantId
              type: 'technical',
              titre: `Perte de position: ${keyword.mot_cle}`,
              description: `Le mot-clé "${keyword.mot_cle}" a perdu ${drop} positions cette semaine (${previous.position} → ${current.position}). Vérifier le contenu et les backlinks.`,
              priorite: drop > 20 ? 'high' : 'medium',
              impact_estime: 'Récupérer les positions perdues peut restaurer le trafic',
              statut: 'active'
            });
        }

        // Alerte positive si gain top 10
        if (previous.position > 10 && current.position <= 10) {
          console.log(`[SEO] 🎉 "${keyword.mot_cle}" est entré dans le top 10 ! (${previous.position} → ${current.position})`);
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
