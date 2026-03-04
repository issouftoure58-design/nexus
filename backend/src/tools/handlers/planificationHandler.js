/**
 * Planification Handler — planifier_post, voir_taches_planifiees, annuler_tache,
 * planifier_rappel, planifier_relance, stats_queue
 * Outils de planification et gestion des taches admin.
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';
import { schedulePost } from '../../services/socialMediaService.js';

const TASK_TABLE = 'admin_tasks';

async function planifier_post(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.platform || !toolInput.when) {
      return { success: false, error: 'Parametres "platform" et "when" requis' };
    }

    const scheduledTime = new Date(toolInput.when).toISOString();

    const result = await schedulePost(
      tenantId,
      [toolInput.platform],
      toolInput.customText || 'Post planifie',
      null,
      scheduledTime
    );

    return {
      success: true,
      message: `Post planifie sur ${toolInput.platform} pour ${scheduledTime}`,
      result
    };
  } catch (error) {
    logger.error('[PLANIFICATION HANDLER] Erreur planifier_post:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function voir_taches_planifiees(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    let query = supabase
      .from(TASK_TABLE)
      .select('*')
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'scheduled'])
      .order('scheduled_at', { ascending: true });

    const { data, error } = await query;

    if (error) {
      // Fallback: try with execute_at column or halimah_tasks table
      logger.warn('[PLANIFICATION HANDLER] admin_tasks query failed, trying fallback:', { error: error.message });

      const fallback = await supabase
        .from('halimah_tasks')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('status', ['pending', 'scheduled'])
        .order('created_at', { ascending: true });

      if (fallback.error) {
        return { success: false, error: `Erreur requete taches: ${fallback.error.message}` };
      }

      return {
        success: true,
        taches: fallback.data || [],
        count: fallback.data?.length || 0,
        source: 'halimah_tasks'
      };
    }

    return {
      success: true,
      taches: data || [],
      count: data?.length || 0
    };
  } catch (error) {
    logger.error('[PLANIFICATION HANDLER] Erreur voir_taches_planifiees:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function annuler_tache(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.taskId) {
      return { success: false, error: 'Parametre "taskId" requis' };
    }

    const { data, error } = await supabase
      .from(TASK_TABLE)
      .update({ status: 'cancelled' })
      .eq('id', toolInput.taskId)
      .eq('tenant_id', tenantId)
      .select();

    if (error) {
      // Fallback to halimah_tasks
      const fallback = await supabase
        .from('halimah_tasks')
        .update({ status: 'cancelled' })
        .eq('id', toolInput.taskId)
        .eq('tenant_id', tenantId)
        .select();

      if (fallback.error) {
        return { success: false, error: `Erreur annulation: ${fallback.error.message}` };
      }

      return {
        success: true,
        message: `Tache ${toolInput.taskId} annulee`,
        tache: fallback.data?.[0]
      };
    }

    if (!data || data.length === 0) {
      return { success: false, error: `Tache ${toolInput.taskId} introuvable pour ce tenant` };
    }

    return {
      success: true,
      message: `Tache ${toolInput.taskId} annulee`,
      tache: data[0]
    };
  } catch (error) {
    logger.error('[PLANIFICATION HANDLER] Erreur annuler_tache:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function planifier_rappel(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.clientId || !toolInput.reminderDate) {
      return { success: false, error: 'Parametres "clientId" et "reminderDate" requis' };
    }

    const taskData = {
      tenant_id: tenantId,
      type: 'reminder',
      description: `Rappel pour client ${toolInput.clientId}`,
      scheduled_at: toolInput.reminderDate,
      metadata: {
        clientId: toolInput.clientId,
        bookingId: toolInput.bookingId,
        channel: toolInput.channel || 'whatsapp'
      },
      status: 'pending'
    };

    const { data, error } = await supabase
      .from(TASK_TABLE)
      .insert(taskData)
      .select();

    if (error) {
      // Fallback: try halimah_tasks with execute_at
      const fallbackData = { ...taskData, tenant_id: tenantId, execute_at: taskData.scheduled_at };
      delete fallbackData.scheduled_at;

      const fallback = await supabase
        .from('halimah_tasks')
        .insert({ tenant_id: tenantId, ...fallbackData })
        .select();

      if (fallback.error) {
        return { success: false, error: `Erreur creation rappel: ${fallback.error.message}` };
      }

      return {
        success: true,
        message: `Rappel planifie pour client ${toolInput.clientId}`,
        tache: fallback.data?.[0]
      };
    }

    return {
      success: true,
      message: `Rappel planifie pour client ${toolInput.clientId} le ${toolInput.reminderDate}`,
      tache: data?.[0]
    };
  } catch (error) {
    logger.error('[PLANIFICATION HANDLER] Erreur planifier_rappel:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function planifier_relance(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.clientId) {
      return { success: false, error: 'Parametre "clientId" requis' };
    }

    const delayMs = (toolInput.delayDays || 7) * 86400000;
    const scheduledAt = new Date(Date.now() + delayMs).toISOString();

    const taskData = {
      tenant_id: tenantId,
      type: 'relance',
      description: `Relance client ${toolInput.clientId}`,
      scheduled_at: scheduledAt,
      metadata: {
        clientId: toolInput.clientId
      },
      status: 'pending'
    };

    const { data, error } = await supabase
      .from(TASK_TABLE)
      .insert(taskData)
      .select();

    if (error) {
      const fallbackData = { ...taskData, execute_at: taskData.scheduled_at };
      delete fallbackData.scheduled_at;

      const fallback = await supabase
        .from('halimah_tasks')
        .insert(fallbackData)
        .select();

      if (fallback.error) {
        return { success: false, error: `Erreur creation relance: ${fallback.error.message}` };
      }

      return {
        success: true,
        message: `Relance planifiee pour client ${toolInput.clientId}`,
        tache: fallback.data?.[0]
      };
    }

    return {
      success: true,
      message: `Relance planifiee pour client ${toolInput.clientId} dans ${toolInput.delayDays || 7} jours`,
      tache: data?.[0]
    };
  } catch (error) {
    logger.error('[PLANIFICATION HANDLER] Erreur planifier_relance:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function stats_queue(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const { data, error } = await supabase
      .from(TASK_TABLE)
      .select('status')
      .eq('tenant_id', tenantId);

    if (error) {
      // Fallback to halimah_tasks
      const fallback = await supabase
        .from('halimah_tasks')
        .select('status')
        .eq('tenant_id', tenantId);

      if (fallback.error) {
        return { success: false, error: `Erreur stats queue: ${fallback.error.message}` };
      }

      const counts = {};
      (fallback.data || []).forEach(row => {
        counts[row.status] = (counts[row.status] || 0) + 1;
      });

      return { success: true, stats: counts, total: fallback.data?.length || 0, source: 'halimah_tasks' };
    }

    const counts = {};
    (data || []).forEach(row => {
      counts[row.status] = (counts[row.status] || 0) + 1;
    });

    return {
      success: true,
      stats: counts,
      total: data?.length || 0
    };
  } catch (error) {
    logger.error('[PLANIFICATION HANDLER] Erreur stats_queue:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

export const planificationHandlers = {
  planifier_post,
  voir_taches_planifiees,
  annuler_tache,
  planifier_rappel,
  planifier_relance,
  stats_queue
};
