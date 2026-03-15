/**
 * Social Handler — social_publish, social_schedule, social_status, social_generate_content
 * Outils de gestion des reseaux sociaux.
 */

import logger from '../../config/logger.js';
import {
  publishToSocialMedia,
  schedulePost,
  getScheduledPosts,
  cancelScheduledPost,
  generateSocialContent,
  getAvailablePlatforms,
  getPlatformStatus
} from '../../services/socialMediaService.js';

async function social_publish(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.platforms || !toolInput.content) {
      return { success: false, error: 'Parametres "platforms" (array) et "content" requis' };
    }

    const platforms = Array.isArray(toolInput.platforms) ? toolInput.platforms : [toolInput.platforms];

    const result = await publishToSocialMedia(
      platforms,
      toolInput.content,
      toolInput.image_url || null
    );

    return {
      success: true,
      message: `Post publie sur ${platforms.join(', ')}`,
      result
    };
  } catch (error) {
    logger.error('[SOCIAL HANDLER] Erreur social_publish:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function social_schedule(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.platforms || !toolInput.content || !toolInput.scheduled_time) {
      return { success: false, error: 'Parametres "platforms", "content" et "scheduled_time" requis' };
    }

    const platforms = Array.isArray(toolInput.platforms) ? toolInput.platforms : [toolInput.platforms];

    const result = await schedulePost(
      tenantId,
      platforms,
      toolInput.content,
      toolInput.image_url || null,
      toolInput.scheduled_time
    );

    return {
      success: true,
      message: `Post planifie sur ${platforms.join(', ')} pour ${toolInput.scheduled_time}`,
      result
    };
  } catch (error) {
    logger.error('[SOCIAL HANDLER] Erreur social_schedule:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function social_status(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const action = toolInput.action || 'check_platforms';

    switch (action) {
      case 'check_platforms': {
        let platforms;
        try {
          platforms = getAvailablePlatforms ? getAvailablePlatforms() : null;
        } catch {
          platforms = null;
        }

        let statuses;
        try {
          statuses = getPlatformStatus ? getPlatformStatus() : null;
        } catch {
          statuses = null;
        }

        return {
          success: true,
          action: 'check_platforms',
          platforms: platforms || ['instagram', 'facebook', 'twitter'],
          statuses: statuses || {}
        };
      }

      case 'list_scheduled': {
        const posts = await getScheduledPosts(tenantId);
        return {
          success: true,
          action: 'list_scheduled',
          posts: posts || [],
          count: posts?.length || 0
        };
      }

      case 'cancel_scheduled': {
        if (!toolInput.post_id) {
          return { success: false, error: 'Parametre "post_id" requis pour annuler un post' };
        }

        const result = await cancelScheduledPost(tenantId, toolInput.post_id);
        return {
          success: true,
          action: 'cancel_scheduled',
          message: `Post ${toolInput.post_id} annule`,
          result
        };
      }

      default:
        return {
          success: false,
          error: `Action "${action}" non reconnue. Utilisez: check_platforms, list_scheduled, cancel_scheduled`
        };
    }
  } catch (error) {
    logger.error('[SOCIAL HANDLER] Erreur social_status:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function social_generate_content(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.sujet) {
      return { success: false, error: 'Parametre "sujet" requis' };
    }

    const result = await generateSocialContent(
      toolInput.sujet,
      toolInput.type,
      toolInput.platforms || ['instagram', 'facebook', 'twitter'],
      tenantId
    );

    return {
      success: true,
      sujet: toolInput.sujet,
      contenu: result
    };
  } catch (error) {
    logger.error('[SOCIAL HANDLER] Erreur social_generate_content:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

export const socialHandlers = {
  social_publish,
  social_schedule,
  social_status,
  social_generate_content
};
