/**
 * Instagram Setter IA Service
 * Gère la qualification automatique des prospects via DMs Instagram
 *
 * Flow:
 * 1. Prospect télécharge ebook / interagit → DM reçu
 * 2. Délai intelligent (30min-1h)
 * 3. Séquence de qualification IA (questions situation, objectifs, timeline)
 * 4. Scoring → qualifié = envoi Calendly / non-qualifié = nurture
 * 5. Relance auto J+1, J+3 (max 2 relances)
 *
 * Env:
 *   INSTAGRAM_ACCESS_TOKEN — Meta Graph API long-lived token
 *   INSTAGRAM_PAGE_ID — ID page Instagram Pro liée
 *   INSTAGRAM_APP_SECRET — pour vérifier signature webhook
 */

import { supabase } from '../config/supabase.js';

const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_PAGE_ID = process.env.INSTAGRAM_PAGE_ID;
const GRAPH_API_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ═══════════════════════════════════════════
// QUALIFICATION CONFIG
// ═══════════════════════════════════════════

const DEFAULT_QUALIFICATION_FLOW = {
  initial_delay_minutes: 45,
  questions: [
    {
      step: 1,
      message: "Salut {{prenom}} ! Merci pour ton intérêt 🙌 J'ai vu que tu t'intéressais à notre contenu. Tu es dans quel domaine d'activité aujourd'hui ?",
      scoring_field: 'domaine',
    },
    {
      step: 2,
      message: "Top ! Et concrètement, quel est ton objectif principal en ce moment ? (Ex: trouver plus de clients, automatiser, scaler...)",
      scoring_field: 'objectif',
    },
    {
      step: 3,
      message: "OK je vois 💡 Et en termes de timing, c'est quelque chose que tu veux mettre en place dans les prochaines semaines ou plutôt dans quelques mois ?",
      scoring_field: 'timeline',
    },
    {
      step: 4,
      message: "Dernière question : tu as déjà un budget prévu pour ça, ou tu explores encore tes options ?",
      scoring_field: 'budget',
    },
  ],
  qualified_message: "Super {{prenom}} ! Ton profil correspond exactement à ce qu'on accompagne. Je te propose un appel de 15min pour qu'on voie ensemble comment t'aider concrètement. Voici mon lien : {{calendly_url}}",
  not_qualified_message: "Merci pour tes réponses {{prenom}} ! Pour l'instant je pense que le mieux c'est qu'on te partage du contenu qui va t'aider à avancer. Je t'enverrai des tips régulièrement 💪",
  relance_j1: "Hey {{prenom}} ! Tu as eu le temps de regarder ce que je t'ai envoyé ? N'hésite pas si tu as des questions 😊",
  relance_j3: "{{prenom}}, petit rappel ! L'offre est toujours dispo si tu veux en discuter. On peut faire un call rapide quand tu veux 📞",
  max_relances: 2,
  scoring_threshold: 60,
};

// ═══════════════════════════════════════════
// INSTAGRAM GRAPH API
// ═══════════════════════════════════════════

function isConfigured() {
  return !!(INSTAGRAM_ACCESS_TOKEN && INSTAGRAM_PAGE_ID);
}

/**
 * Envoie un message DM Instagram via Graph API
 */
async function sendInstagramDM(recipientId, message) {
  if (!isConfigured()) {
    console.log(`[INSTAGRAM SETTER] Simulé → ${recipientId}: ${message.substring(0, 50)}...`);
    return { simulated: true, recipientId };
  }

  const res = await fetch(`${GRAPH_BASE}/${INSTAGRAM_PAGE_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${INSTAGRAM_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: message },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Instagram API ${res.status}: ${error}`);
  }

  return res.json();
}

/**
 * Récupère le profil Instagram d'un utilisateur
 */
async function getUserProfile(userId) {
  if (!isConfigured()) return { name: 'Prospect', username: 'unknown' };

  const res = await fetch(
    `${GRAPH_BASE}/${userId}?fields=name,username,profile_pic&access_token=${INSTAGRAM_ACCESS_TOKEN}`
  );

  if (!res.ok) return { name: 'Prospect', username: 'unknown' };
  return res.json();
}

// ═══════════════════════════════════════════
// CONVERSATION MANAGEMENT
// ═══════════════════════════════════════════

/**
 * Traite un message DM entrant
 * @param {string} tenantId
 * @param {object} messageData — { senderId, senderUsername, text, timestamp }
 */
export async function handleIncomingDM(tenantId, messageData) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { senderId, senderUsername, text, timestamp } = messageData;

  console.log(`[INSTAGRAM SETTER] DM reçu de ${senderUsername || senderId}: ${text?.substring(0, 50)}`);

  // Charger ou créer la conversation
  let conversation = await getOrCreateConversation(tenantId, senderId, senderUsername);

  // Sauvegarder le message entrant
  await saveMessage(tenantId, conversation.id, {
    direction: 'incoming',
    content: text,
    timestamp,
  });

  // Analyser selon l'étape en cours
  const flow = await getTenantFlow(tenantId);

  switch (conversation.status) {
    case 'new':
      // Premier message — programmer le premier contact avec délai
      await scheduleFirstContact(tenantId, conversation, flow);
      break;

    case 'qualifying':
      // En cours de qualification — traiter la réponse
      await processQualificationResponse(tenantId, conversation, text, flow);
      break;

    case 'qualified':
    case 'not_qualified':
    case 'nurture':
      // Déjà qualifié — forward au tenant comme message normal
      console.log(`[INSTAGRAM SETTER] Conversation ${conversation.id} déjà traitée (${conversation.status})`);
      break;

    default:
      break;
  }

  return { conversationId: conversation.id, status: conversation.status };
}

/**
 * Envoie le premier message de qualification (appelé par scheduler après délai)
 */
export async function sendFirstQualificationMessage(tenantId, conversationId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data: conversation } = await supabase
    .from('ig_setter_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .single();

  if (!conversation || conversation.status !== 'pending_first_contact') return;

  const flow = await getTenantFlow(tenantId);
  const firstQuestion = flow.questions[0];

  const message = replaceVars(firstQuestion.message, {
    prenom: conversation.sender_name || conversation.sender_username || 'toi',
  });

  await sendInstagramDM(conversation.instagram_user_id, message);
  await saveMessage(tenantId, conversationId, { direction: 'outgoing', content: message });

  await supabase
    .from('ig_setter_conversations')
    .update({ status: 'qualifying', current_step: 1 })
    .eq('id', conversationId)
    .eq('tenant_id', tenantId);

  console.log(`[INSTAGRAM SETTER] Premier message envoyé à ${conversation.sender_username} (conversation ${conversationId})`);
}

/**
 * Envoie un message de relance
 */
export async function sendRelance(tenantId, conversationId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data: conversation } = await supabase
    .from('ig_setter_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .single();

  if (!conversation) return;
  if (conversation.relance_count >= DEFAULT_QUALIFICATION_FLOW.max_relances) {
    console.log(`[INSTAGRAM SETTER] Max relances atteint pour ${conversationId}`);
    await supabase
      .from('ig_setter_conversations')
      .update({ status: 'not_qualified' })
      .eq('id', conversationId)
      .eq('tenant_id', tenantId);
    return;
  }

  const flow = await getTenantFlow(tenantId);
  const relanceNum = conversation.relance_count + 1;
  const templateKey = relanceNum === 1 ? 'relance_j1' : 'relance_j3';
  const message = replaceVars(flow[templateKey], {
    prenom: conversation.sender_name || conversation.sender_username || 'toi',
  });

  await sendInstagramDM(conversation.instagram_user_id, message);
  await saveMessage(tenantId, conversationId, { direction: 'outgoing', content: message, type: 'relance' });

  await supabase
    .from('ig_setter_conversations')
    .update({ relance_count: relanceNum })
    .eq('id', conversationId)
    .eq('tenant_id', tenantId);

  console.log(`[INSTAGRAM SETTER] Relance ${relanceNum} envoyée à ${conversation.sender_username}`);
}

// ═══════════════════════════════════════════
// INTERNAL HELPERS
// ═══════════════════════════════════════════

async function getOrCreateConversation(tenantId, senderId, senderUsername) {
  const { data: existing } = await supabase
    .from('ig_setter_conversations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('instagram_user_id', senderId)
    .single();

  if (existing) return existing;

  // Récupérer le profil
  const profile = await getUserProfile(senderId);

  const { data: created, error } = await supabase
    .from('ig_setter_conversations')
    .insert({
      tenant_id: tenantId,
      instagram_user_id: senderId,
      sender_username: senderUsername || profile.username || 'unknown',
      sender_name: profile.name || null,
      status: 'new',
      current_step: 0,
      score: 0,
      relance_count: 0,
      responses: {},
    })
    .select()
    .single();

  if (error) throw error;
  return created;
}

async function saveMessage(tenantId, conversationId, data) {
  await supabase.from('ig_setter_messages').insert({
    tenant_id: tenantId,
    conversation_id: conversationId,
    direction: data.direction,
    content: data.content,
    type: data.type || 'message',
    timestamp: data.timestamp || new Date().toISOString(),
  });
}

async function scheduleFirstContact(tenantId, conversation, flow) {
  const delayMs = (flow.initial_delay_minutes || 45) * 60 * 1000;

  await supabase
    .from('ig_setter_conversations')
    .update({ status: 'pending_first_contact' })
    .eq('id', conversation.id)
    .eq('tenant_id', tenantId);

  // Programmer l'exécution via workflow_executions (réutilise le scheduler existant)
  await supabase.from('workflow_executions').insert({
    workflow_id: null,
    tenant_id: tenantId,
    entity_type: 'ig_setter',
    entity_id: conversation.id,
    statut: 'scheduled',
    resultat: {
      action: { type: 'ig_setter_first_contact', conversation_id: conversation.id },
      entity: { id: conversation.id, type: 'ig_setter' },
      scheduled_for: new Date(Date.now() + delayMs).toISOString(),
    },
  });

  console.log(`[INSTAGRAM SETTER] Premier contact programmé dans ${flow.initial_delay_minutes}min pour ${conversation.sender_username}`);
}

async function processQualificationResponse(tenantId, conversation, text, flow) {
  const currentStep = conversation.current_step || 1;
  const currentQuestion = flow.questions.find(q => q.step === currentStep);

  if (!currentQuestion) return;

  // Sauvegarder la réponse
  const responses = conversation.responses || {};
  responses[currentQuestion.scoring_field] = text;

  // Calculer le score (scoring simple basé sur la longueur et mots-clés)
  const stepScore = calculateStepScore(currentQuestion.scoring_field, text);
  const newScore = (conversation.score || 0) + stepScore;

  const nextStep = currentStep + 1;
  const isLastQuestion = nextStep > flow.questions.length;

  if (isLastQuestion) {
    // Qualification terminée
    const isQualified = newScore >= flow.scoring_threshold;
    const finalStatus = isQualified ? 'qualified' : 'not_qualified';

    const templateKey = isQualified ? 'qualified_message' : 'not_qualified_message';

    // Récupérer l'URL Calendly du tenant
    const { data: tenantConfig } = await supabase
      .from('tenants')
      .select('config')
      .eq('id', tenantId)
      .single();

    const calendlyUrl = tenantConfig?.config?.calendly_url || 'https://calendly.com';

    const message = replaceVars(flow[templateKey], {
      prenom: conversation.sender_name || conversation.sender_username || 'toi',
      calendly_url: calendlyUrl,
    });

    await sendInstagramDM(conversation.instagram_user_id, message);
    await saveMessage(tenantId, conversation.id, { direction: 'outgoing', content: message });

    await supabase
      .from('ig_setter_conversations')
      .update({
        status: finalStatus,
        score: newScore,
        current_step: nextStep,
        responses,
        qualified_at: isQualified ? new Date().toISOString() : null,
      })
      .eq('id', conversation.id)
      .eq('tenant_id', tenantId);

    // Créer un client/prospect dans le CRM si qualifié
    if (isQualified) {
      await createProspectFromConversation(tenantId, conversation, responses, newScore);
    }

    console.log(`[INSTAGRAM SETTER] ${conversation.sender_username} → ${finalStatus} (score: ${newScore})`);
  } else {
    // Envoyer la question suivante
    const nextQuestion = flow.questions.find(q => q.step === nextStep);
    const message = replaceVars(nextQuestion.message, {
      prenom: conversation.sender_name || conversation.sender_username || 'toi',
    });

    await sendInstagramDM(conversation.instagram_user_id, message);
    await saveMessage(tenantId, conversation.id, { direction: 'outgoing', content: message });

    await supabase
      .from('ig_setter_conversations')
      .update({
        current_step: nextStep,
        score: newScore,
        responses,
      })
      .eq('id', conversation.id)
      .eq('tenant_id', tenantId);
  }
}

function calculateStepScore(field, text) {
  if (!text) return 0;
  let score = 5; // base pour avoir répondu

  const textLower = text.toLowerCase();

  // Scoring par champ
  const scoringRules = {
    domaine: {
      keywords: { 'formation': 15, 'coaching': 15, 'consultant': 12, 'agence': 10, 'freelance': 8, 'entrepreneur': 10 },
    },
    objectif: {
      keywords: { 'client': 15, 'scale': 15, 'automatiser': 12, 'vendre': 10, 'développer': 10, 'croissance': 12 },
    },
    timeline: {
      keywords: { 'maintenant': 20, 'cette semaine': 18, 'ce mois': 15, 'bientôt': 10, 'rapidement': 12, 'urgent': 15 },
      negative: { 'plus tard': -5, 'pas pressé': -5, 'quelques mois': -3 },
    },
    budget: {
      keywords: { 'oui': 15, 'prévu': 12, 'prêt': 15, 'investir': 15, 'budget': 10 },
      negative: { 'pas de budget': -10, 'gratuit': -8, 'cher': -3 },
    },
  };

  const rules = scoringRules[field];
  if (rules) {
    for (const [kw, pts] of Object.entries(rules.keywords || {})) {
      if (textLower.includes(kw)) score += pts;
    }
    for (const [kw, pts] of Object.entries(rules.negative || {})) {
      if (textLower.includes(kw)) score += pts;
    }
  }

  // Bonus longueur (réponse détaillée = plus engagé)
  if (text.length > 50) score += 3;
  if (text.length > 100) score += 5;

  return Math.max(score, 0);
}

async function createProspectFromConversation(tenantId, conversation, responses, score) {
  try {
    // Créer un client dans le CRM
    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        tenant_id: tenantId,
        prenom: conversation.sender_name || conversation.sender_username,
        nom: '',
        source: 'instagram',
        tags: ['prospect', 'instagram-setter', 'qualifié'],
        notes: `Prospect Instagram qualifié (score: ${score})\nDomaine: ${responses.domaine || '-'}\nObjectif: ${responses.objectif || '-'}\nTimeline: ${responses.timeline || '-'}\nBudget: ${responses.budget || '-'}`,
      })
      .select()
      .single();

    if (error) throw error;

    // Créer une opportunité dans le pipeline
    await supabase.from('opportunities').insert({
      tenant_id: tenantId,
      client_id: client.id,
      titre: `Prospect IG - ${conversation.sender_username}`,
      etape: 'prospect',
      source: 'instagram',
      notes: `Qualifié via Setter IA (score: ${score})`,
    });

    // Lier la conversation au client
    await supabase
      .from('ig_setter_conversations')
      .update({ client_id: client.id })
      .eq('id', conversation.id)
      .eq('tenant_id', tenantId);

    console.log(`[INSTAGRAM SETTER] Prospect créé dans CRM: ${client.id} (${conversation.sender_username})`);
  } catch (e) {
    console.error('[INSTAGRAM SETTER] Erreur création prospect:', e);
  }
}

async function getTenantFlow(tenantId) {
  // Charger la config custom du tenant si disponible
  const { data: config } = await supabase
    .from('tenants')
    .select('config')
    .eq('id', tenantId)
    .single();

  return config?.config?.ig_setter_flow || DEFAULT_QUALIFICATION_FLOW;
}

function replaceVars(text, vars) {
  if (!text) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || key);
}

export default {
  isConfigured,
  handleIncomingDM,
  sendFirstQualificationMessage,
  sendRelance,
};
