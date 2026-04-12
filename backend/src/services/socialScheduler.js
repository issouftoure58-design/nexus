/**
 * Scheduler publication automatique posts programmes
 *
 * Verifie toutes les 15 minutes si des posts sont a publier.
 * Multi-tenant : scanne tous les tenants via service_role.
 */

import { rawSupabase } from '../config/supabase.js';
import { publishToFacebook, publishToInstagram } from './facebookService.js';
import { registerInterval } from '../utils/intervalRegistry.js';
import logger from '../config/logger.js';

let intervalId = null;

/**
 * Demarrer scheduler
 */
export function startSocialScheduler() {
  logger.info('[SOCIAL SCHEDULER] Demarrage...');

  // Verifier toutes les 15 minutes
  intervalId = setInterval(() => {
    publishAllScheduledPosts().catch(err =>
      logger.error('[SOCIAL SCHEDULER] Erreur cycle:', err.message)
    );
  }, 15 * 60 * 1000);

  registerInterval('socialScheduler', intervalId);
  if (intervalId.unref) intervalId.unref();

  // Execution immediate
  publishAllScheduledPosts().catch(err =>
    logger.error('[SOCIAL SCHEDULER] Erreur init:', err.message)
  );

  logger.info('[SOCIAL SCHEDULER] Actif (verif toutes les 15min)');
}

/**
 * Arreter scheduler
 */
export function stopSocialScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[SOCIAL SCHEDULER] Arrete');
  }
}

/**
 * Publier tous les posts programmes dont scheduled_at <= now
 * Multi-tenant : utilise rawSupabase (service_role, pas de RLS)
 */
async function publishAllScheduledPosts() {
  try {
    const now = new Date().toISOString();

    const { data: posts, error } = await rawSupabase
      .from('social_posts')
      .select('*, social_accounts(*)')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .limit(50);

    if (error) {
      // Table n'existe pas encore ou FK manquante — silencieux au demarrage
      if (error.code === '42P01' || error.code === 'PGRST200') return;
      logger.warn(`[SOCIAL SCHEDULER] Query error: ${error.code} ${error.message || JSON.stringify(error)}`);
      return;
    }

    if (!posts || posts.length === 0) return;

    logger.info(`[SOCIAL SCHEDULER] ${posts.length} post(s) a publier`);

    for (const post of posts) {
      await publishPost(post);
    }
  } catch (err) {
    logger.error(`[SOCIAL SCHEDULER] Erreur: ${err?.message || JSON.stringify(err)}`);
  }
}

/**
 * Publier un post sur la plateforme cible
 */
async function publishPost(post) {
  if (!post.tenant_id) {
    logger.error('[SOCIAL SCHEDULER] tenant_id requis pour publication');
    return;
  }

  try {
    const account = post.social_accounts;

    if (!account || !account.is_active) {
      await markPostError(post, 'Compte social inactif ou non connecte');
      return;
    }

    let result;

    if (post.platform === 'facebook' || post.platform === 'both') {
      result = await publishToFacebook(account.page_id, account.access_token, {
        message: post.content,
        imageUrl: post.image_url,
      });
    }

    if (post.platform === 'instagram' || post.platform === 'both') {
      if (!account.ig_account_id) {
        logger.warn(`[SOCIAL SCHEDULER] Pas de compte IG pour post ${post.id}`);
      } else {
        result = await publishToInstagram(account.ig_account_id, account.access_token, {
          caption: post.content,
          imageUrl: post.image_url,
        });
      }
    }

    // Marquer comme publie
    await rawSupabase
      .from('social_posts')
      .update({
        status: 'published',
        post_id: result?.postId || null,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id);

    logger.info(`[SOCIAL SCHEDULER] Post ${post.id} publie sur ${post.platform} (tenant=${post.tenant_id})`);
  } catch (err) {
    logger.error(`[SOCIAL SCHEDULER] Erreur publication post ${post.id}: ${err.message}`);
    await markPostError(post, err.message);
  }
}

/**
 * Marquer un post en erreur
 */
async function markPostError(post, message) {
  await rawSupabase
    .from('social_posts')
    .update({
      status: 'error',
      error_message: message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', post.id);
}

export default { startSocialScheduler, stopSocialScheduler };
