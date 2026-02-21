/**
 * Scheduler publication automatique posts programmés
 */

import { createClient } from '@supabase/supabase-js';
import { publishToFacebook, publishToInstagram } from './facebookService.js';

let supabase = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }
  return supabase;
}

let intervalId = null;

/**
 * Démarrer scheduler
 */
export function startSocialScheduler() {
  console.log('[SOCIAL SCHEDULER] Démarrage...');

  // Vérifier toutes les 15 minutes
  intervalId = setInterval(() => {
    publishScheduledPosts();
  }, 15 * 60 * 1000);

  // Exécution immédiate
  publishScheduledPosts();

  console.log('[SOCIAL SCHEDULER] ✅ Actif (vérif toutes les 15min)');
}

/**
 * Arrêter scheduler
 */
export function stopSocialScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[SOCIAL SCHEDULER] Arrêté');
  }
}

/**
 * Publier posts programmés pour un tenant spécifique
 * @param {string} tenantId - ID du tenant (requis)
 */
async function publishScheduledPosts(tenantId) {
  if (!tenantId) {
    console.error('[SOCIAL SCHEDULER] tenant_id requis');
    return;
  }

  try {
    const now = new Date().toISOString();
    const db = getSupabase();

    console.log(`[SOCIAL SCHEDULER] Vérification posts à publier pour tenant ${tenantId}...`);

    const { data: posts } = await db
      .from('social_posts')
      .select('*, social_accounts(*)')
      .eq('tenant_id', tenantId)
      .eq('status', 'scheduled')
      .lte('scheduled_at', now);

    if (!posts || posts.length === 0) {
      console.log('[SOCIAL SCHEDULER] Aucun post à publier');
      return;
    }

    console.log(`[SOCIAL SCHEDULER] ${posts.length} post(s) à publier`);

    for (const post of posts) {
      await publishPost(post);
    }

  } catch (error) {
    console.error('[SOCIAL SCHEDULER] Erreur:', error);
  }
}

/**
 * Publier un post
 * @param {object} post - Post avec tenant_id inclus
 */
async function publishPost(post) {
  if (!post.tenant_id) {
    console.error('[SOCIAL SCHEDULER] tenant_id requis pour publication');
    return;
  }

  const db = getSupabase();

  try {
    const account = post.social_accounts;

    if (!account || account.status !== 'active') {
      console.error(`[SOCIAL SCHEDULER] Compte ${post.platform} inactif pour post ${post.id}`);
      return;
    }

    let result;

    if (post.platform === 'facebook') {
      result = await publishToFacebook(account.page_id, account.access_token, {
        message: post.content,
        imageUrl: post.image_url
      });

    } else if (post.platform === 'instagram') {
      result = await publishToInstagram(account.ig_account_id, account.access_token, {
        caption: post.content,
        imageUrl: post.image_url
      });
    }

    // Marquer comme publié
    await db
      .from('social_posts')
      .update({
        status: 'published',
        post_id: result.postId,
        published_at: new Date().toISOString()
      })
      .eq('tenant_id', post.tenant_id)
      .eq('id', post.id);

    console.log(`[SOCIAL SCHEDULER] ✅ Post ${post.id} publié sur ${post.platform}`);

  } catch (error) {
    console.error(`[SOCIAL SCHEDULER] Erreur publication post ${post.id}:`, error);

    await db
      .from('social_posts')
      .update({
        status: 'error',
        error_message: error.message
      })
      .eq('tenant_id', post.tenant_id)
      .eq('id', post.id);
  }
}
