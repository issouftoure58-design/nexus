/**
 * Memoire Handler — memoriser, se_souvenir, oublier, memory_stats, noter_insight, voir_insights
 * Outils de memoire persistante via halimahMemory.
 */

import logger from '../../config/logger.js';
import {
  remember,
  recall,
  search,
  forgetByKey,
  createInsight,
  getPendingInsights,
  getMemoryStats
} from '../../services/halimahMemory.js';

async function memoriser(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const result = await remember({
      tenantId,
      type: toolInput.type || 'fact',
      category: toolInput.category || 'business',
      key: toolInput.key,
      value: toolInput.value,
      subjectId: toolInput.clientId
    });

    return {
      success: true,
      message: `Memorise: "${toolInput.key}"`,
      memory: result
    };
  } catch (error) {
    logger.error('[MEMOIRE HANDLER] Erreur memoriser:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function se_souvenir(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    let result;

    if (toolInput.query) {
      result = await search(tenantId, toolInput.query, toolInput.category);
      return {
        success: true,
        type: 'search',
        query: toolInput.query,
        resultats: result
      };
    }

    if (toolInput.key) {
      result = await recall({
        tenantId,
        key: toolInput.key,
        category: toolInput.category
      });
      return {
        success: true,
        type: 'recall',
        key: toolInput.key,
        memoire: result
      };
    }

    return { success: false, error: 'Parametre "query" ou "key" requis' };
  } catch (error) {
    logger.error('[MEMOIRE HANDLER] Erreur se_souvenir:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function oublier(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.key) {
      return { success: false, error: 'Parametre "key" requis' };
    }

    const result = await forgetByKey(tenantId, toolInput.key, toolInput.category);

    return {
      success: true,
      message: `Memoire "${toolInput.key}" supprimee`,
      result
    };
  } catch (error) {
    logger.error('[MEMOIRE HANDLER] Erreur oublier:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function memory_stats(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const stats = await getMemoryStats(tenantId);

    return {
      success: true,
      stats
    };
  } catch (error) {
    logger.error('[MEMOIRE HANDLER] Erreur memory_stats:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function noter_insight(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.title || !toolInput.description) {
      return { success: false, error: 'Parametres "title" et "description" requis' };
    }

    const result = await createInsight({
      tenantId,
      title: toolInput.title,
      description: toolInput.description,
      priority: toolInput.priority || 5,
      actionRequired: true
    });

    return {
      success: true,
      message: `Insight cree: "${toolInput.title}"`,
      insight: result
    };
  } catch (error) {
    logger.error('[MEMOIRE HANDLER] Erreur noter_insight:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function voir_insights(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const insights = await getPendingInsights(tenantId, toolInput.limit || 10);

    return {
      success: true,
      insights,
      count: insights?.length || 0
    };
  } catch (error) {
    logger.error('[MEMOIRE HANDLER] Erreur voir_insights:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

export const memoireHandlers = {
  memoriser,
  se_souvenir,
  oublier,
  memory_stats,
  noter_insight,
  voir_insights
};
