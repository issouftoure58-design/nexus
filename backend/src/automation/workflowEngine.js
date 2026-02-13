/**
 * NEXUS Workflow Engine
 * Moteur d'exécution des workflows de marketing automation
 * Plan PRO Feature
 */

import { supabase } from '../config/supabase.js';

// Import services (avec fallback si non disponibles)
let sendEmail, sendSMS, sendWhatsApp;

try {
  const emailService = await import('../services/emailService.js');
  sendEmail = emailService.sendEmail;
} catch (e) {
  sendEmail = async (opts) => {
    console.log('[WORKFLOW] Email simulé:', opts);
    return { success: true, simulated: true };
  };
}

try {
  const smsService = await import('../services/smsService.js');
  sendSMS = smsService.sendSMS;
} catch (e) {
  sendSMS = async (to, message) => {
    console.log('[WORKFLOW] SMS simulé:', { to, message });
    return { success: true, simulated: true };
  };
}

try {
  const whatsappService = await import('../services/whatsappService.js');
  sendWhatsApp = whatsappService.sendWhatsApp;
} catch (e) {
  sendWhatsApp = async (to, message) => {
    console.log('[WORKFLOW] WhatsApp simulé:', { to, message });
    return { success: true, simulated: true };
  };
}

/**
 * Déclenche les workflows pour un événement donné
 * @param {string} triggerType - Type de trigger (new_client, rdv_completed, etc.)
 * @param {object} data - Données de l'événement { tenant_id, entity }
 */
export async function triggerWorkflows(triggerType, data) {
  try {
    const { tenant_id, entity } = data;

    if (!tenant_id || !entity) {
      console.warn('[WORKFLOWS] Données manquantes pour trigger:', { triggerType, tenant_id, hasEntity: !!entity });
      return;
    }

    // Récupérer workflows actifs pour ce trigger
    const { data: workflows, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('trigger_type', triggerType)
      .eq('actif', true);

    if (error) {
      console.error('[WORKFLOWS] Erreur récupération workflows:', error);
      return;
    }

    if (!workflows || workflows.length === 0) {
      console.log(`[WORKFLOWS] Aucun workflow actif pour ${triggerType}`);
      return;
    }

    console.log(`[WORKFLOWS] ${workflows.length} workflow(s) à exécuter pour ${triggerType}`);

    // Exécuter chaque workflow (en parallèle pour les performances)
    const executions = workflows.map(workflow => executeWorkflow(workflow, entity));
    await Promise.allSettled(executions);

  } catch (error) {
    console.error('[WORKFLOWS] Erreur trigger workflows:', error);
  }
}

/**
 * Exécute un workflow
 * @param {object} workflow - Le workflow à exécuter
 * @param {object} entity - L'entité concernée (client, rdv, facture)
 */
export async function executeWorkflow(workflow, entity) {
  const { id, tenant_id, nom, config, actions, trigger_config } = workflow;
  let executionId = null;

  // Support des deux formats de structure (config.actions ou actions directement)
  const workflowActions = config?.actions || actions || [];
  const workflowConditions = config?.conditions || trigger_config?.conditions || [];

  try {
    console.log(`[WORKFLOWS] Exécution workflow "${nom}" (ID: ${id})`);

    // Vérifier conditions
    const conditionsMet = checkConditions(workflowConditions, entity);

    if (!conditionsMet) {
      console.log(`[WORKFLOWS] Conditions non remplies pour workflow ${id}`);
      return { success: false, reason: 'conditions_not_met' };
    }

    // Créer entrée d'exécution
    const { data: execution, error: execError } = await supabase
      .from('workflow_executions')
      .insert({
        workflow_id: id,
        tenant_id,
        entity_type: entity.type || 'client',
        entity_id: entity.id,
        statut: 'running'
      })
      .select()
      .single();

    if (execError) {
      console.error('[WORKFLOWS] Erreur création exécution:', execError);
    } else {
      executionId = execution.id;
    }

    // Exécuter actions
    const results = [];

    for (const action of workflowActions) {
      try {
        // Délai si spécifié (max 5 minutes en synchrone, sinon scheduler)
        if (action.delay_minutes > 0 && action.delay_minutes <= 5) {
          await delay(action.delay_minutes * 60 * 1000);
        } else if (action.delay_minutes > 5) {
          // Pour les délais > 5 min, on programme pour plus tard
          await scheduleDelayedAction(workflow, action, entity, action.delay_minutes);
          results.push({
            action: action.type,
            scheduled: true,
            delay_minutes: action.delay_minutes
          });
          continue;
        }

        const result = await executeAction(action, entity, tenant_id);
        results.push(result);
      } catch (actionError) {
        console.error(`[WORKFLOWS] Erreur action ${action.type}:`, actionError);
        results.push({
          action: action.type,
          success: false,
          error: actionError.message
        });
      }
    }

    // Mettre à jour statut exécution
    if (executionId) {
      await supabase
        .from('workflow_executions')
        .update({
          statut: 'success',
          resultat: { actions: results },
          completed_at: new Date().toISOString()
        })
        .eq('id', executionId);
    }

    // Mettre à jour compteur workflow
    await supabase
      .from('workflows')
      .update({
        executions_count: (workflow.executions_count || 0) + 1,
        last_execution_at: new Date().toISOString()
      })
      .eq('id', id);

    console.log(`[WORKFLOWS] Workflow ${id} exécuté avec succès`);
    return { success: true, results };

  } catch (error) {
    console.error(`[WORKFLOWS] Erreur exécution workflow ${id}:`, error);

    // Logger erreur
    if (executionId) {
      await supabase
        .from('workflow_executions')
        .update({
          statut: 'failed',
          error_message: error.message,
          resultat: { error: error.message },
          completed_at: new Date().toISOString()
        })
        .eq('id', executionId);
    }

    return { success: false, error: error.message };
  }
}

/**
 * Vérifie si les conditions sont remplies
 * @param {array} conditions - Liste des conditions
 * @param {object} entity - L'entité à vérifier
 * @returns {boolean}
 */
function checkConditions(conditions, entity) {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every(condition => {
    const { field, operator, value } = condition;
    const entityValue = getNestedValue(entity, field);

    switch (operator) {
      case '=':
      case '==':
        return entityValue == value;
      case '===':
        return entityValue === value;
      case '!=':
      case '!==':
        return entityValue != value;
      case '>':
        return Number(entityValue) > Number(value);
      case '>=':
        return Number(entityValue) >= Number(value);
      case '<':
        return Number(entityValue) < Number(value);
      case '<=':
        return Number(entityValue) <= Number(value);
      case 'contains':
        return String(entityValue).toLowerCase().includes(String(value).toLowerCase());
      case 'not_contains':
        return !String(entityValue).toLowerCase().includes(String(value).toLowerCase());
      case 'starts_with':
        return String(entityValue).toLowerCase().startsWith(String(value).toLowerCase());
      case 'ends_with':
        return String(entityValue).toLowerCase().endsWith(String(value).toLowerCase());
      case 'is_empty':
        return !entityValue || entityValue === '' || (Array.isArray(entityValue) && entityValue.length === 0);
      case 'is_not_empty':
        return entityValue && entityValue !== '' && (!Array.isArray(entityValue) || entityValue.length > 0);
      case 'in':
        return Array.isArray(value) ? value.includes(entityValue) : String(value).split(',').map(v => v.trim()).includes(entityValue);
      case 'not_in':
        return Array.isArray(value) ? !value.includes(entityValue) : !String(value).split(',').map(v => v.trim()).includes(entityValue);
      default:
        console.warn(`[WORKFLOWS] Opérateur inconnu: ${operator}`);
        return false;
    }
  });
}

/**
 * Récupère une valeur imbriquée dans un objet
 * @param {object} obj - L'objet
 * @param {string} path - Le chemin (ex: "client.email")
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Exécute une action
 * @param {object} action - L'action à exécuter
 * @param {object} entity - L'entité concernée
 * @param {string} tenant_id - ID du tenant
 */
async function executeAction(action, entity, tenant_id) {
  const { type } = action;

  console.log(`[WORKFLOWS] Exécution action: ${type}`);

  switch (type) {
    case 'send_email':
      return await executeSendEmail(action, entity, tenant_id);

    case 'send_sms':
      return await executeSendSMS(action, entity, tenant_id);

    case 'send_whatsapp':
      return await executeSendWhatsApp(action, entity, tenant_id);

    case 'add_tag':
      return await executeAddTag(action, entity, tenant_id);

    case 'remove_tag':
      return await executeRemoveTag(action, entity, tenant_id);

    case 'create_task':
      return await executeCreateTask(action, entity, tenant_id);

    case 'update_field':
      return await executeUpdateField(action, entity, tenant_id);

    case 'webhook':
      return await executeWebhook(action, entity, tenant_id);

    default:
      throw new Error(`Action type inconnu: ${type}`);
  }
}

/**
 * Action: Envoyer email
 */
async function executeSendEmail(action, entity, tenant_id) {
  const { template, to_field, custom_subject, custom_body } = action;
  const toEmail = getNestedValue(entity, to_field || 'email');

  if (!toEmail) {
    throw new Error('Email destinataire manquant');
  }

  // Templates prédéfinis
  const templates = {
    bienvenue: {
      subject: 'Bienvenue !',
      html: `Bonjour ${entity.prenom || 'cher client'},<br><br>
             Bienvenue ! Nous sommes ravis de vous compter parmi nos clients.<br><br>
             À très bientôt !`
    },
    avis: {
      subject: 'Votre avis compte',
      html: `Bonjour ${entity.prenom || ''},<br><br>
             Comment s'est passé votre rendez-vous ? Votre avis nous intéresse !<br><br>
             Merci !`
    },
    relance: {
      subject: 'Vous nous manquez',
      html: `Bonjour ${entity.prenom || ''},<br><br>
             Cela fait un moment que nous ne vous avons pas vu. Une petite visite ?<br><br>
             À bientôt !`
    },
    remerciement: {
      subject: 'Merci pour votre visite !',
      html: `Bonjour ${entity.prenom || ''},<br><br>
             Merci pour votre confiance. Nous espérons vous revoir bientôt !<br><br>
             À très vite !`
    },
    anniversaire: {
      subject: 'Joyeux anniversaire !',
      html: `Bonjour ${entity.prenom || ''},<br><br>
             Toute l'équipe vous souhaite un très joyeux anniversaire !<br><br>
             À cette occasion, bénéficiez de -10% sur votre prochain rendez-vous.`
    }
  };

  let emailContent;
  if (custom_subject && custom_body) {
    emailContent = {
      subject: replaceVariables(custom_subject, entity),
      html: replaceVariables(custom_body, entity)
    };
  } else {
    emailContent = templates[template] || templates.bienvenue;
  }

  const result = await sendEmail({
    to: toEmail,
    subject: emailContent.subject,
    html: emailContent.html
  });

  return { action: 'send_email', to: toEmail, template, success: true, ...result };
}

/**
 * Action: Envoyer SMS
 */
async function executeSendSMS(action, entity, tenant_id) {
  const { message, to_field } = action;
  const toPhone = getNestedValue(entity, to_field || 'telephone');

  if (!toPhone) {
    throw new Error('Téléphone destinataire manquant');
  }

  const finalMessage = replaceVariables(message, entity);
  const result = await sendSMS(toPhone, finalMessage);

  return { action: 'send_sms', to: toPhone, success: true, ...result };
}

/**
 * Action: Envoyer WhatsApp
 */
async function executeSendWhatsApp(action, entity, tenant_id) {
  const { message, to_field } = action;
  const toPhone = getNestedValue(entity, to_field || 'telephone');

  if (!toPhone) {
    throw new Error('Téléphone destinataire manquant');
  }

  const finalMessage = replaceVariables(message, entity);
  const result = await sendWhatsApp(toPhone, finalMessage);

  return { action: 'send_whatsapp', to: toPhone, success: true, ...result };
}

/**
 * Action: Ajouter tag
 */
async function executeAddTag(action, entity, tenant_id) {
  const { tag } = action;

  if (!entity.id) {
    throw new Error('ID entité manquant pour ajouter tag');
  }

  // Récupérer tags actuels
  const { data: client, error: getError } = await supabase
    .from('clients')
    .select('tags')
    .eq('id', entity.id)
    .eq('tenant_id', tenant_id)
    .single();

  if (getError) {
    throw new Error(`Erreur récupération client: ${getError.message}`);
  }

  const currentTags = client?.tags || [];
  if (!currentTags.includes(tag)) {
    currentTags.push(tag);

    const { error: updateError } = await supabase
      .from('clients')
      .update({ tags: currentTags })
      .eq('id', entity.id)
      .eq('tenant_id', tenant_id);

    if (updateError) {
      throw new Error(`Erreur mise à jour tags: ${updateError.message}`);
    }
  }

  return { action: 'add_tag', tag, success: true };
}

/**
 * Action: Retirer tag
 */
async function executeRemoveTag(action, entity, tenant_id) {
  const { tag } = action;

  if (!entity.id) {
    throw new Error('ID entité manquant pour retirer tag');
  }

  const { data: client } = await supabase
    .from('clients')
    .select('tags')
    .eq('id', entity.id)
    .eq('tenant_id', tenant_id)
    .single();

  const currentTags = client?.tags || [];
  const index = currentTags.indexOf(tag);

  if (index > -1) {
    currentTags.splice(index, 1);

    await supabase
      .from('clients')
      .update({ tags: currentTags })
      .eq('id', entity.id)
      .eq('tenant_id', tenant_id);
  }

  return { action: 'remove_tag', tag, success: true };
}

/**
 * Action: Créer tâche admin
 */
async function executeCreateTask(action, entity, tenant_id) {
  const { description, priorite, assigned_to, due_days } = action;

  const taskData = {
    tenant_id,
    description: replaceVariables(description, entity),
    statut: 'pending',
    priorite: priorite || 'normal',
    entity_type: entity.type || 'client',
    entity_id: entity.id
  };

  if (assigned_to) {
    taskData.assigned_to = assigned_to;
  }

  if (due_days) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + due_days);
    taskData.due_date = dueDate.toISOString();
  }

  const { error } = await supabase
    .from('admin_tasks')
    .insert(taskData);

  if (error) {
    throw new Error(`Erreur création tâche: ${error.message}`);
  }

  return { action: 'create_task', description: taskData.description, success: true };
}

/**
 * Action: Mettre à jour un champ
 */
async function executeUpdateField(action, entity, tenant_id) {
  const { field, value, table } = action;

  if (!entity.id) {
    throw new Error('ID entité manquant pour update');
  }

  const targetTable = table || 'clients';
  const finalValue = replaceVariables(String(value), entity);

  const { error } = await supabase
    .from(targetTable)
    .update({ [field]: finalValue })
    .eq('id', entity.id)
    .eq('tenant_id', tenant_id);

  if (error) {
    throw new Error(`Erreur mise à jour champ: ${error.message}`);
  }

  return { action: 'update_field', field, value: finalValue, success: true };
}

/**
 * Action: Appeler un webhook
 */
async function executeWebhook(action, entity, tenant_id) {
  const { url, method, headers } = action;

  const response = await fetch(url, {
    method: method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: JSON.stringify({
      tenant_id,
      entity,
      timestamp: new Date().toISOString()
    })
  });

  return {
    action: 'webhook',
    url,
    status: response.status,
    success: response.ok
  };
}

/**
 * Programmer une action avec délai
 */
async function scheduleDelayedAction(workflow, action, entity, delayMinutes) {
  // Pour l'instant, on log simplement
  // Dans une implémentation complète, on utiliserait BullMQ ou un scheduler
  console.log(`[WORKFLOWS] Action programmée dans ${delayMinutes} minutes:`, action.type);

  // Stocker dans une table de scheduled_actions
  try {
    await supabase
      .from('workflow_executions')
      .insert({
        workflow_id: workflow.id,
        tenant_id: workflow.tenant_id,
        entity_type: entity.type || 'client',
        entity_id: entity.id,
        statut: 'scheduled',
        resultat: {
          action,
          scheduled_for: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
        }
      });
  } catch (e) {
    console.error('[WORKFLOWS] Erreur scheduling:', e);
  }
}

/**
 * Remplace les variables dans un texte
 * @param {string} text - Texte avec variables {{variable}}
 * @param {object} entity - Données pour remplacement
 */
function replaceVariables(text, entity) {
  if (!text) return text;

  return text.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const value = getNestedValue(entity, path);
    return value !== undefined ? value : match;
  });
}

/**
 * Helper: Délai
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  triggerWorkflows,
  executeWorkflow
};
