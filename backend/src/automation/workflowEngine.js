/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
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
  sendWhatsApp = whatsappService.sendWhatsAppNotification;
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

    // CRITICAL: Validate tenant_id before any database operation
    if (!tenant_id) {
      console.error('[WORKFLOWS] CRITICAL: tenant_id manquant pour trigger:', triggerType);
      return;
    }

    if (!entity) {
      console.warn('[WORKFLOWS] Entity manquante pour trigger:', { triggerType, tenant_id });
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

  // CRITICAL: Validate tenant_id before any database operation
  if (!tenant_id) {
    console.error('[WORKFLOWS] CRITICAL: tenant_id manquant dans workflow:', id);
    return { success: false, error: 'tenant_id requis' };
  }

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

    // Mettre à jour statut exécution - avec tenant_id pour sécurité
    if (executionId) {
      await supabase
        .from('workflow_executions')
        .update({
          statut: 'success',
          resultat: { actions: results },
          completed_at: new Date().toISOString()
        })
        .eq('id', executionId)
        .eq('tenant_id', tenant_id);
    }

    // Mettre à jour compteur workflow - avec tenant_id pour sécurité
    await supabase
      .from('workflows')
      .update({
        executions_count: (workflow.executions_count || 0) + 1,
        last_execution_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenant_id);

    console.log(`[WORKFLOWS] Workflow ${id} exécuté avec succès`);
    return { success: true, results };

  } catch (error) {
    console.error(`[WORKFLOWS] Erreur exécution workflow ${id}:`, error);

    // Logger erreur - avec tenant_id pour sécurité
    if (executionId) {
      await supabase
        .from('workflow_executions')
        .update({
          statut: 'failed',
          error_message: error.message,
          resultat: { error: error.message },
          completed_at: new Date().toISOString()
        })
        .eq('id', executionId)
        .eq('tenant_id', tenant_id);
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

    case 'send_to_segment':
      return await executeSendToSegment(action, entity, tenant_id);

    case 'move_pipeline':
      return await executeMovePipeline(action, entity, tenant_id);

    case 'send_discord_invite':
      return await executeSendDiscordInvite(action, entity, tenant_id);

    case 'create_signature':
      return await executeCreateSignature(action, entity, tenant_id);

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
    },
    closing_contrat: {
      subject: 'Bienvenue ! Votre contrat et programme',
      html: `Bonjour ${entity.prenom || ''},<br><br>
             Félicitations pour votre inscription ! Nous sommes ravis de vous accompagner.<br><br>
             <strong>Prochaines étapes :</strong><br>
             1. Consultez votre contrat et programme en pièce jointe<br>
             2. Signez votre contrat (vous recevrez un lien de signature électronique)<br>
             3. Prenez connaissance de nos conditions générales<br><br>
             Si vous avez la moindre question, n'hésitez pas à nous contacter.<br><br>
             À très bientôt !`
    },
    closing_acces: {
      subject: 'Vos accès à la plateforme',
      html: `Bonjour ${entity.prenom || ''},<br><br>
             Vos accès à la plateforme sont prêts !<br><br>
             <strong>Comment démarrer :</strong><br>
             1. Connectez-vous avec vos identifiants<br>
             2. Suivez le tutoriel de prise en main<br>
             3. Commencez à explorer les fonctionnalités<br><br>
             Un guide complet est disponible dans votre espace membre.<br><br>
             N'hésitez pas à nous contacter si vous avez besoin d'aide !`
    },
    closing_communaute: {
      subject: 'Rejoignez notre communauté !',
      html: `Bonjour ${entity.prenom || ''},<br><br>
             Dernière étape pour profiter pleinement de votre expérience : rejoignez notre communauté !<br><br>
             <strong>Les avantages :</strong><br>
             • Échangez avec les autres membres<br>
             • Accédez à du contenu exclusif<br>
             • Participez aux événements en direct<br>
             • Obtenez de l'aide rapidement<br><br>
             Nous avons hâte de vous y retrouver !`
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
  const result = await sendSMS(toPhone, finalMessage, tenant_id);

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
  const result = await sendWhatsApp(toPhone, finalMessage, tenant_id);

  return { action: 'send_whatsapp', to: toPhone, success: true, ...result };
}

/**
 * Action: Ajouter tag
 */
async function executeAddTag(action, entity, tenant_id) {
  const { tag } = action;

  // Déterminer l'ID du client selon le type d'entité
  // Si c'est un RDV, utiliser client_id ou client.id
  // Si c'est un client, utiliser id directement
  let clientId = entity.id;
  if (entity.type === 'rdv' || entity.client_id) {
    clientId = entity.client_id || entity.client?.id;
  }

  if (!clientId) {
    throw new Error('ID client manquant pour ajouter tag');
  }

  console.log(`[WORKFLOWS] add_tag: client_id=${clientId}, tag=${tag}`);

  // Récupérer tags actuels
  const { data: client, error: getError } = await supabase
    .from('clients')
    .select('id, tags')
    .eq('id', clientId)
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
      .eq('id', clientId)
      .eq('tenant_id', tenant_id);

    if (updateError) {
      throw new Error(`Erreur mise à jour tags: ${updateError.message}`);
    }

    console.log(`[WORKFLOWS] ✅ Tag "${tag}" ajouté au client ${clientId}`);
  } else {
    console.log(`[WORKFLOWS] Tag "${tag}" déjà présent sur client ${clientId}`);
  }

  return { action: 'add_tag', tag, clientId, success: true };
}

/**
 * Action: Retirer tag
 */
async function executeRemoveTag(action, entity, tenant_id) {
  const { tag } = action;

  // Déterminer l'ID du client selon le type d'entité
  let clientId = entity.id;
  if (entity.type === 'rdv' || entity.client_id) {
    clientId = entity.client_id || entity.client?.id;
  }

  if (!clientId) {
    throw new Error('ID client manquant pour retirer tag');
  }

  const { data: client } = await supabase
    .from('clients')
    .select('tags')
    .eq('id', clientId)
    .eq('tenant_id', tenant_id)
    .single();

  const currentTags = client?.tags || [];
  const index = currentTags.indexOf(tag);

  if (index > -1) {
    currentTags.splice(index, 1);

    await supabase
      .from('clients')
      .update({ tags: currentTags })
      .eq('id', clientId)
      .eq('tenant_id', tenant_id);

    console.log(`[WORKFLOWS] ✅ Tag "${tag}" retiré du client ${clientId}`);
  }

  return { action: 'remove_tag', tag, clientId, success: true };
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
 * Action: Déplacer une opportunité dans le pipeline
 */
async function executeMovePipeline(action, entity, tenant_id) {
  const { etape } = action;

  if (!etape) {
    throw new Error('Étape pipeline requise pour move_pipeline');
  }

  // Chercher l'opportunité liée au client
  const clientId = entity.client_id || entity.id;
  if (!clientId) {
    throw new Error('ID client manquant pour move_pipeline');
  }

  const { data: opportunities, error } = await supabase
    .from('opportunities')
    .select('id, etape')
    .eq('tenant_id', tenant_id)
    .eq('client_id', clientId)
    .neq('etape', 'perdu')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Erreur récupération opportunité: ${error.message}`);
  }

  if (!opportunities || opportunities.length === 0) {
    console.log(`[WORKFLOWS] move_pipeline: aucune opportunité pour client ${clientId}`);
    return { action: 'move_pipeline', success: true, skipped: true, reason: 'no_opportunity' };
  }

  const opp = opportunities[0];
  const { error: updateError } = await supabase
    .from('opportunities')
    .update({ etape })
    .eq('id', opp.id)
    .eq('tenant_id', tenant_id);

  if (updateError) {
    throw new Error(`Erreur déplacement pipeline: ${updateError.message}`);
  }

  console.log(`[WORKFLOWS] move_pipeline: opportunité ${opp.id} déplacée de "${opp.etape}" vers "${etape}"`);
  return { action: 'move_pipeline', opportunityId: opp.id, from: opp.etape, to: etape, success: true };
}

/**
 * Action: Envoyer une invitation Discord par email
 */
async function executeSendDiscordInvite(action, entity, tenant_id) {
  const { channel_id } = action;
  const email = getNestedValue(entity, action.to_field || 'email');

  if (!email) throw new Error('Email destinataire manquant pour Discord invite');
  if (!channel_id) throw new Error('channel_id requis pour send_discord_invite');

  const { sendInviteByEmail } = await import('../services/discordService.js');
  const result = await sendInviteByEmail(
    tenant_id,
    email,
    channel_id,
    entity.prenom || entity.nom || ''
  );

  return { action: 'send_discord_invite', ...result, success: true };
}

/**
 * Action: Creer une signature electronique via Yousign
 */
async function executeCreateSignature(action, entity, tenant_id) {
  const signerEmail = getNestedValue(entity, action.signer_email_field || 'email');
  const signerName = getNestedValue(entity, action.signer_name_field || 'nom');

  if (!signerEmail) {
    throw new Error('Email signataire manquant pour create_signature');
  }

  try {
    const { createSignatureRequest } = await import('../services/yousignService.js');

    const result = await createSignatureRequest(tenant_id, {
      name: action.document_template || 'Contrat onboarding',
      signerEmail,
      signerFirstName: entity.prenom || signerName || 'Client',
      signerLastName: entity.nom || '',
      signerPhone: entity.telephone || undefined,
      fileContent: action.file_content || null,
      fileName: action.file_name || 'contrat.pdf',
      clientId: entity.id || undefined,
      metadata: { workflow_action: 'create_signature', document_template: action.document_template },
    });

    console.log(`[WORKFLOWS] create_signature: signature creee pour ${signerEmail}`);
    return { action: 'create_signature', signer_email: signerEmail, success: true, ...result };
  } catch (err) {
    console.error(`[WORKFLOWS] create_signature error:`, err.message);
    return { action: 'create_signature', success: false, error: err.message };
  }
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
          entity: { id: entity.id, type: entity.type, prenom: entity.prenom, nom: entity.nom, telephone: entity.telephone, email: entity.email },
          scheduled_for: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
        }
      });
  } catch (e) {
    console.error('[WORKFLOWS] Erreur scheduling:', e);
  }
}

/**
 * Action: Envoyer un message à tous les clients d'un segment
 */
async function executeSendToSegment(action, entity, tenant_id) {
  const { segment_id, channel, message, template, custom_subject, custom_body, to_field } = action;

  if (!segment_id) {
    throw new Error('segment_id requis pour send_to_segment');
  }
  if (!tenant_id) {
    throw new Error('tenant_id requis pour send_to_segment');
  }

  // Récupérer les clients du segment
  const { data: segmentClients, error } = await supabase
    .from('segment_clients')
    .select('client_id, clients(id, prenom, nom, telephone, email)')
    .eq('segment_id', segment_id)
    .eq('tenant_id', tenant_id);

  if (error) {
    throw new Error(`Erreur récupération segment: ${error.message}`);
  }

  const clients = (segmentClients || [])
    .map(sc => sc.clients)
    .filter(Boolean);

  let sentCount = 0;
  const sendChannel = channel || 'sms';

  for (const client of clients) {
    try {
      const clientEntity = { ...client, type: 'client' };
      const clientAction = { ...action, to_field: to_field || (sendChannel === 'email' ? 'email' : 'telephone') };

      if (sendChannel === 'email') {
        await executeSendEmail(clientAction, clientEntity, tenant_id);
      } else if (sendChannel === 'sms') {
        await executeSendSMS(clientAction, clientEntity, tenant_id);
      } else if (sendChannel === 'whatsapp') {
        await executeSendWhatsApp(clientAction, clientEntity, tenant_id);
      }
      sentCount++;
    } catch (e) {
      console.error(`[WORKFLOWS] Erreur send_to_segment pour client ${client.id}:`, e.message);
    }
  }

  console.log(`[WORKFLOWS] send_to_segment: ${sentCount}/${clients.length} envoyés (segment: ${segment_id})`);
  return { action: 'send_to_segment', segment_id, sent_count: sentCount, total: clients.length, success: true };
}

/**
 * Traite les actions workflow programmées (delayed)
 * Appelé par le scheduler toutes les minutes
 */
export async function processScheduledActions() {
  try {
    const now = new Date().toISOString();

    // Récupérer les exécutions programmées dont l'heure est arrivée
    const { data: scheduled, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('statut', 'scheduled')
      .limit(50);

    if (error) {
      console.error('[WORKFLOWS] Erreur récupération actions programmées:', error);
      return;
    }

    // Filtrer celles dont scheduled_for <= now
    const due = (scheduled || []).filter(exec => {
      const scheduledFor = exec.resultat?.scheduled_for;
      return scheduledFor && scheduledFor <= now;
    });

    if (due.length === 0) return;

    console.log(`[WORKFLOWS] ${due.length} action(s) programmée(s) à exécuter`);

    for (const exec of due) {
      const { action, entity } = exec.resultat || {};
      if (!action || !entity || !exec.tenant_id) {
        await supabase
          .from('workflow_executions')
          .update({ statut: 'failed', error_message: 'Données action/entity manquantes', completed_at: new Date().toISOString() })
          .eq('id', exec.id)
          .eq('tenant_id', exec.tenant_id);
        continue;
      }

      try {
        let result;
        // Actions spéciales Instagram Setter
        if (action.type === 'ig_setter_first_contact') {
          const { sendFirstQualificationMessage } = await import('../services/instagramSetterService.js');
          await sendFirstQualificationMessage(exec.tenant_id, action.conversation_id);
          result = { action: 'ig_setter_first_contact', success: true };
        } else {
          result = await executeAction(action, entity, exec.tenant_id);
        }
        await supabase
          .from('workflow_executions')
          .update({ statut: 'success', resultat: { ...exec.resultat, execution_result: result }, completed_at: new Date().toISOString() })
          .eq('id', exec.id)
          .eq('tenant_id', exec.tenant_id);
        console.log(`[WORKFLOWS] Action programmée ${exec.id} exécutée avec succès`);
      } catch (e) {
        console.error(`[WORKFLOWS] Erreur action programmée ${exec.id}:`, e.message);
        await supabase
          .from('workflow_executions')
          .update({ statut: 'failed', error_message: e.message, completed_at: new Date().toISOString() })
          .eq('id', exec.id)
          .eq('tenant_id', exec.tenant_id);
      }
    }
  } catch (error) {
    console.error('[WORKFLOWS] Erreur processScheduledActions:', error);
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
  executeWorkflow,
  processScheduledActions
};
