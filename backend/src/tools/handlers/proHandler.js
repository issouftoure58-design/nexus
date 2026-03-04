/**
 * Pro Handler — executeAdvancedQuery, createAutomation, scheduleTask, analyzePattern
 * Outils avances pour admin Pro (requetes, automations, analyse de patterns).
 */

import logger from '../../config/logger.js';
import {
  executeAdvancedQuery,
  createAutomation,
  scheduleTask,
  analyzePattern
} from '../../ai/adminProTools.js';

async function pro_executeAdvancedQuery(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.query_description) {
      return { success: false, error: 'Parametre "query_description" requis' };
    }

    const result = await executeAdvancedQuery({
      query_description: toolInput.query_description,
      tenant_id: tenantId
    });

    return {
      success: true,
      query: toolInput.query_description,
      result
    };
  } catch (error) {
    logger.error('[PRO HANDLER] Erreur executeAdvancedQuery:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function pro_createAutomation(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.automation_description) {
      return { success: false, error: 'Parametre "automation_description" requis' };
    }

    const result = await createAutomation({
      automation_description: toolInput.automation_description,
      tenant_id: tenantId
    });

    return {
      success: true,
      automation: toolInput.automation_description,
      result
    };
  } catch (error) {
    logger.error('[PRO HANDLER] Erreur createAutomation:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function pro_scheduleTask(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.task_description) {
      return { success: false, error: 'Parametre "task_description" requis' };
    }

    const result = await scheduleTask({
      task_description: toolInput.task_description,
      tenant_id: tenantId
    });

    return {
      success: true,
      tache: toolInput.task_description,
      result
    };
  } catch (error) {
    logger.error('[PRO HANDLER] Erreur scheduleTask:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function pro_analyzePattern(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.question) {
      return { success: false, error: 'Parametre "question" requis' };
    }

    const result = await analyzePattern({
      question: toolInput.question,
      tenant_id: tenantId
    });

    return {
      success: true,
      question: toolInput.question,
      result
    };
  } catch (error) {
    logger.error('[PRO HANDLER] Erreur analyzePattern:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

export const proHandlers = {
  executeAdvancedQuery: pro_executeAdvancedQuery,
  createAutomation: pro_createAutomation,
  scheduleTask: pro_scheduleTask,
  analyzePattern: pro_analyzePattern
};
