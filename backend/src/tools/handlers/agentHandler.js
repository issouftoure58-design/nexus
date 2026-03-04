/**
 * Agent Handler — agent_plan, agent_execute, agent_confirm, agent_cancel, agent_status, agent_history
 * Outils d'agent autonome pour planification et execution de taches complexes.
 */

import logger from '../../config/logger.js';
import {
  createTask,
  getTask,
  cancelTask,
  executeTask,
  getTaskStats,
  getTaskHistory,
  analyzeAndPlan
} from '../../services/agentService.js';

async function agent_plan(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.request) {
      return { success: false, error: 'Parametre "request" requis' };
    }

    const plan = analyzeAndPlan(toolInput.request);

    if (!plan || !plan.steps || plan.steps.length === 0) {
      return {
        success: false,
        error: 'Impossible de creer un plan pour cette demande',
        plan
      };
    }

    const task = await createTask(tenantId, toolInput.request, plan.steps);

    return {
      success: true,
      message: `Plan cree avec ${plan.steps.length} etapes`,
      task_id: task?.id || task?.data?.[0]?.id,
      plan: {
        description: plan.description,
        steps: plan.steps,
        requires_confirmation: plan.requiresConfirmation
      },
      task
    };
  } catch (error) {
    logger.error('[AGENT HANDLER] Erreur agent_plan:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function agent_execute(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.task_id) {
      return { success: false, error: 'Parametre "task_id" requis' };
    }

    const result = await executeTask(tenantId, toolInput.task_id, null, false);

    return {
      success: true,
      message: `Tache ${toolInput.task_id} en cours d'execution`,
      result
    };
  } catch (error) {
    logger.error('[AGENT HANDLER] Erreur agent_execute:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function agent_confirm(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.task_id) {
      return { success: false, error: 'Parametre "task_id" requis' };
    }

    const result = await executeTask(tenantId, toolInput.task_id, null, true);

    return {
      success: true,
      message: `Tache ${toolInput.task_id} confirmee et executee`,
      result
    };
  } catch (error) {
    logger.error('[AGENT HANDLER] Erreur agent_confirm:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function agent_cancel(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.task_id) {
      return { success: false, error: 'Parametre "task_id" requis' };
    }

    const result = await cancelTask(tenantId, toolInput.task_id);

    return {
      success: true,
      message: `Tache ${toolInput.task_id} annulee`,
      result
    };
  } catch (error) {
    logger.error('[AGENT HANDLER] Erreur agent_cancel:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function agent_status(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (toolInput.task_id) {
      const task = await getTask(tenantId, toolInput.task_id);

      if (!task) {
        return { success: false, error: `Tache ${toolInput.task_id} introuvable` };
      }

      return {
        success: true,
        type: 'detail',
        task
      };
    }

    const stats = await getTaskStats(tenantId);

    return {
      success: true,
      type: 'global',
      stats
    };
  } catch (error) {
    logger.error('[AGENT HANDLER] Erreur agent_status:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function agent_history(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const history = await getTaskHistory(tenantId, toolInput.limit || 20);

    return {
      success: true,
      historique: history || [],
      count: history?.length || 0
    };
  } catch (error) {
    logger.error('[AGENT HANDLER] Erreur agent_history:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

export const agentHandlers = {
  agent_plan,
  agent_execute,
  agent_confirm,
  agent_cancel,
  agent_status,
  agent_history
};
