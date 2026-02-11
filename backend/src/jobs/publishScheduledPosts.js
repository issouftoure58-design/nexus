/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   Job de publication des posts programmés                          ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║   - Vérifie toutes les 15 minutes s'il y a des posts à publier    ║
 * ║   - Publie sur les plateformes configurées (Facebook, LinkedIn)   ║
 * ║   - Met à jour le statut du post après publication                ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import { publishToSocialMedia } from '../services/socialMediaService.js';

let isRunning = false;

export async function publishScheduledPosts() {
  // Éviter les exécutions concurrentes
  if (isRunning) {
    console.log('[SCHEDULED] Job déjà en cours, skip');
    return;
  }

  isRunning = true;

  try {
    // Import dynamique pour éviter les problèmes de dépendances circulaires
    const { supabase } = await import('../config/supabase.js');

    const now = new Date();

    // Récupérer les posts programmés dont l'heure est passée
    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString());

    if (error) {
      // Si la table n'existe pas, ne pas logger d'erreur
      if (error.code === '42P01') {
        return;
      }
      console.error('[SCHEDULED] Erreur fetch:', error);
      return;
    }

    if (!posts || posts.length === 0) {
      return;
    }

    console.log(`[SCHEDULED] ${posts.length} post(s) à publier`);

    for (const post of posts) {
      try {
        console.log(`[SCHEDULED] Publication du post ${post.id} sur ${post.platforms?.join(', ')}...`);

        // Récupérer l'URL média si disponible
        const mediaUrl = post.media_urls && post.media_urls.length > 0
          ? post.media_urls[0]
          : null;

        const results = await publishToSocialMedia(
          post.platforms || [],
          post.content,
          mediaUrl,
          'image'
        );

        const allSuccess = results.resultats?.every(r => r.success) || false;

        // Mettre à jour le statut du post
        const { error: updateError } = await supabase
          .from('social_posts')
          .update({
            status: allSuccess ? 'published' : 'failed',
            published_at: allSuccess ? new Date().toISOString() : null,
            error_message: allSuccess ? null : JSON.stringify(results.resultats?.filter(r => !r.success) || []),
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id);

        if (updateError) {
          console.error(`[SCHEDULED] Erreur update post ${post.id}:`, updateError);
        } else {
          console.log(`[SCHEDULED] Post ${post.id} - ${allSuccess ? '✅ Publié' : '❌ Échec'}`);
        }

        // Log détaillé des résultats
        if (results.resultats) {
          for (const result of results.resultats) {
            if (result.success) {
              console.log(`  ✅ ${result.platform}: ${result.message || 'OK'}`);
            } else {
              console.log(`  ❌ ${result.platform}: ${result.error}`);
            }
          }
        }

      } catch (postError) {
        console.error(`[SCHEDULED] Erreur publication post ${post.id}:`, postError);

        // Marquer comme failed en cas d'erreur
        await supabase
          .from('social_posts')
          .update({
            status: 'failed',
            error_message: postError.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', post.id);
      }
    }

  } catch (error) {
    console.error('[SCHEDULED] Erreur générale:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Démarre le job de publication programmée
 * @param {number} intervalMs - Intervalle en millisecondes (défaut: 15 minutes)
 */
export function startScheduledPostsJob(intervalMs = 15 * 60 * 1000) {
  console.log('[SCHEDULED] Job de publication programmée démarré');
  console.log(`[SCHEDULED] Vérification toutes les ${intervalMs / 1000 / 60} minutes`);

  // Exécuter une première fois au démarrage
  publishScheduledPosts();

  // Puis à intervalle régulier (15 min par défaut)
  const intervalId = setInterval(publishScheduledPosts, intervalMs);

  // Retourner l'ID pour pouvoir arrêter le job si nécessaire
  return intervalId;
}

/**
 * Arrête le job de publication programmée
 * @param {number} intervalId - L'ID retourné par startScheduledPostsJob
 */
export function stopScheduledPostsJob(intervalId) {
  if (intervalId) {
    clearInterval(intervalId);
    console.log('[SCHEDULED] Job de publication programmée arrêté');
  }
}
