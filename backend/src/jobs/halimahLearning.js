/**
 * JOB D'APPRENTISSAGE AUTOMATIQUE HALIMAH
 * Analyse les conversations et génère des insights
 *
 * 🔒 TENANT ISOLATION: Toutes les fonctions requièrent tenantId
 */

import { supabase } from '../config/supabase.js';
import {
  createInsight,
  recordLearning,
  remember as memoryRemember
} from '../services/halimahMemory.js';

// ============================================================
// === VALIDATION TENANT ===
// ============================================================

/**
 * Valide que tenantId est présent
 * @param {string} tenantId
 * @param {string} functionName
 * @returns {boolean}
 */
function validateTenantId(tenantId, functionName) {
  if (!tenantId) {
    console.error(`[LEARNING] ❌ ERREUR CRITIQUE: tenantId manquant dans ${functionName}()`);
    return false;
  }
  return true;
}

// ============================================================
// === ANALYSE QUOTIDIENNE ===
// ============================================================

/**
 * Analyse quotidienne des conversations et activités
 * À lancer via un cron job ou manuellement
 * @param {string} tenantId - 🔒 REQUIS - Identifiant du tenant
 */
export async function dailyLearning(tenantId) {
  if (!validateTenantId(tenantId, 'dailyLearning')) {
    return { success: false, error: 'tenantId manquant' };
  }

  console.log(`[LEARNING] 📊 Démarrage de l'analyse quotidienne (tenant: ${tenantId})...`);

  try {
    // 1. Analyser les conversations des dernières 24h
    await analyzeRecentConversations(tenantId);

    // 2. Analyser les réservations
    await analyzeReservations(tenantId);

    // 3. Analyser les services populaires
    await analyzePopularServices(tenantId);

    // 4. Nettoyer les souvenirs obsolètes
    await cleanupOldMemories(tenantId);

    console.log(`[LEARNING] ✅ Analyse quotidienne terminée (tenant: ${tenantId})`);
    return { success: true };
  } catch (error) {
    console.error('[LEARNING] ❌ Erreur analyse quotidienne:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================
// === ANALYSE DES CONVERSATIONS ===
// ============================================================

/**
 * Analyse les conversations récentes pour détecter des patterns
 * @param {string} tenantId - 🔒 REQUIS - Identifiant du tenant
 */
async function analyzeRecentConversations(tenantId) {
  if (!validateTenantId(tenantId, 'analyzeRecentConversations')) {
    return;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // Récupérer les conversations des dernières 24h depuis halimah_conversations
  const { data: conversations, error } = await supabase
    .from('halimah_conversations')
    .select('*')
    .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
    .gte('created_at', yesterday.toISOString());

  if (error) {
    console.warn('[LEARNING] Pas de table halimah_conversations:', error.message);
    return;
  }

  if (!conversations || conversations.length === 0) {
    console.log('[LEARNING] Aucune conversation récente à analyser');
    return;
  }

  // Analyser les sujets fréquents
  const topicCounts = {};
  conversations.forEach(conv => {
    if (conv.topic) {
      topicCounts[conv.topic] = (topicCounts[conv.topic] || 0) + 1;
    }
  });

  // Créer un insight si un sujet revient souvent
  const frequentTopics = Object.entries(topicCounts)
    .filter(([_, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);

  for (const [topic, count] of frequentTopics) {
    await createInsight({
      tenantId,  // 🔒 TENANT ISOLATION
      insightType: 'trend',
      title: `Sujet fréquent : ${topic}`,
      description: `Le sujet "${topic}" a été abordé ${count} fois ces dernières 24h. Peut-être créer une FAQ ou un contenu dédié ?`,
      data: { topic, count },
      priority: Math.min(count + 3, 10)
    });
  }

  // Analyser la durée moyenne des conversations
  const avgDuration = conversations.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / conversations.length;
  if (avgDuration > 300) { // Plus de 5 minutes en moyenne
    await createInsight({
      tenantId,  // 🔒 TENANT ISOLATION
      insightType: 'warning',
      title: 'Conversations longues',
      description: `La durée moyenne des conversations est de ${Math.round(avgDuration / 60)} minutes. Les clients ont peut-être besoin de plus d'informations en amont.`,
      data: { avgDuration },
      priority: 6
    });
  }

  console.log(`[LEARNING] Analysé ${conversations.length} conversation(s) (tenant: ${tenantId})`);
}

// ============================================================
// === ANALYSE DES RÉSERVATIONS ===
// ============================================================

/**
 * Analyse les réservations pour détecter des tendances
 * @param {string} tenantId - 🔒 REQUIS - Identifiant du tenant
 */
async function analyzeReservations(tenantId) {
  if (!validateTenantId(tenantId, 'analyzeReservations')) {
    return;
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('*')
    .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
    .gte('created_at', oneWeekAgo.toISOString());

  if (error || !reservations) {
    console.warn('[LEARNING] Erreur récupération réservations:', error?.message);
    return;
  }

  if (reservations.length === 0) {
    return;
  }

  // Analyser les jours populaires
  const daysCounts = {};
  const hoursCounts = {};

  reservations.forEach(r => {
    if (r.date) {
      const date = new Date(r.date);
      const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });
      daysCounts[dayName] = (daysCounts[dayName] || 0) + 1;
    }
    if (r.heure) {
      const hour = r.heure.split(':')[0];
      hoursCounts[hour] = (hoursCounts[hour] || 0) + 1;
    }
  });

  // Trouver le jour le plus populaire
  const mostPopularDay = Object.entries(daysCounts)
    .sort((a, b) => b[1] - a[1])[0];

  if (mostPopularDay && mostPopularDay[1] >= 3) {
    await recordLearning({
      tenantId,  // 🔒 TENANT ISOLATION
      category: 'business',
      key: 'jour_rdv_populaire',
      value: `${mostPopularDay[0]} (${mostPopularDay[1]} RDV cette semaine)`,
      metadata: { daysCounts }
    });
  }

  // Trouver l'heure la plus populaire
  const mostPopularHour = Object.entries(hoursCounts)
    .sort((a, b) => b[1] - a[1])[0];

  if (mostPopularHour && mostPopularHour[1] >= 3) {
    await recordLearning({
      tenantId,  // 🔒 TENANT ISOLATION
      category: 'business',
      key: 'heure_rdv_populaire',
      value: `${mostPopularHour[0]}h (${mostPopularHour[1]} RDV cette semaine)`,
      metadata: { hoursCounts }
    });
  }

  // Analyser le taux d'annulation
  const cancelled = reservations.filter(r => r.statut === 'annule').length;
  const cancellationRate = (cancelled / reservations.length) * 100;

  if (cancellationRate > 20) {
    await createInsight({
      tenantId,  // 🔒 TENANT ISOLATION
      insightType: 'warning',
      title: 'Taux d\'annulation élevé',
      description: `${cancellationRate.toFixed(1)}% des réservations ont été annulées cette semaine. Peut-être envoyer des rappels plus fréquents ?`,
      data: { cancelled, total: reservations.length, rate: cancellationRate },
      priority: 8
    });
  }

  console.log(`[LEARNING] Analysé ${reservations.length} réservation(s) (tenant: ${tenantId})`);
}

// ============================================================
// === ANALYSE DES SERVICES ===
// ============================================================

/**
 * Analyse les services populaires
 * @param {string} tenantId - 🔒 REQUIS - Identifiant du tenant
 */
async function analyzePopularServices(tenantId) {
  if (!validateTenantId(tenantId, 'analyzePopularServices')) {
    return;
  }

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('service_nom, prix_total')
    .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
    .gte('created_at', oneMonthAgo.toISOString())
    .in('statut', ['confirme', 'termine']);

  if (error || !reservations) {
    return;
  }

  // Compter les services
  const serviceCounts = {};
  const serviceRevenue = {};

  reservations.forEach(r => {
    if (r.service_nom) {
      serviceCounts[r.service_nom] = (serviceCounts[r.service_nom] || 0) + 1;
      serviceRevenue[r.service_nom] = (serviceRevenue[r.service_nom] || 0) + (r.prix_total || 0);
    }
  });

  // Top service par nombre
  const topByCount = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])[0];

  if (topByCount) {
    await recordLearning({
      tenantId,  // 🔒 TENANT ISOLATION
      category: 'business',
      key: 'service_plus_demande',
      value: `${topByCount[0]} (${topByCount[1]} fois ce mois)`,
      metadata: { serviceCounts }
    });
  }

  // Top service par CA
  const topByRevenue = Object.entries(serviceRevenue)
    .sort((a, b) => b[1] - a[1])[0];

  if (topByRevenue) {
    await recordLearning({
      tenantId,  // 🔒 TENANT ISOLATION
      category: 'business',
      key: 'service_plus_rentable',
      value: `${topByRevenue[0]} (${(topByRevenue[1] / 100).toFixed(2)}€ ce mois)`,
      metadata: { serviceRevenue }
    });
  }

  // Détecter les services peu demandés
  const lowDemandServices = Object.entries(serviceCounts)
    .filter(([_, count]) => count <= 1)
    .map(([service]) => service);

  if (lowDemandServices.length > 0) {
    await createInsight({
      tenantId,  // 🔒 TENANT ISOLATION
      insightType: 'opportunity',
      title: 'Services peu demandés',
      description: `Les services suivants ont été peu demandés ce mois : ${lowDemandServices.join(', ')}. Peut-être promouvoir ou ajuster les tarifs ?`,
      data: { services: lowDemandServices },
      priority: 5
    });
  }

  console.log(`[LEARNING] Analyse des services terminée (tenant: ${tenantId})`);
}

// ============================================================
// === NETTOYAGE ===
// ============================================================

/**
 * Nettoie les souvenirs obsolètes ou à faible confiance
 * @param {string} tenantId - 🔒 REQUIS - Identifiant du tenant
 */
async function cleanupOldMemories(tenantId) {
  if (!validateTenantId(tenantId, 'cleanupOldMemories')) {
    return;
  }

  // Supprimer les souvenirs à très faible confiance (< 0.1) de plus d'un mois
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const { data, error } = await supabase
    .from('halimah_memory')
    .delete()
    .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
    .lt('confidence', 0.1)
    .lt('created_at', oneMonthAgo.toISOString())
    .select();

  if (data && data.length > 0) {
    console.log(`[LEARNING] 🧹 Supprimé ${data.length} souvenir(s) obsolète(s) (tenant: ${tenantId})`);
  }

  // Désactiver les insights traités depuis plus d'une semaine
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  await supabase
    .from('halimah_insights')
    .delete()
    .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
    .eq('is_actioned', true)
    .lt('actioned_at', oneWeekAgo.toISOString());
}

// ============================================================
// === EXTRACTION D'APPRENTISSAGES DEPUIS CONVERSATIONS ===
// ============================================================

/**
 * Extrait des apprentissages d'une conversation
 * @param {string} tenantId - 🔒 REQUIS - Identifiant du tenant
 * @param {Array} messages - Messages de la conversation
 * @param {string|null} clientId - ID du client (optionnel)
 */
export async function learnFromConversation(tenantId, messages, clientId = null) {
  if (!validateTenantId(tenantId, 'learnFromConversation')) {
    return 0;
  }

  const learnings = [];

  // Patterns pour détecter des préférences
  const preferencePatterns = [
    { regex: /préfère\s+(.+)/i, type: 'preference' },
    { regex: /aime\s+(.+)/i, type: 'preference' },
    { regex: /n'aime pas\s+(.+)/i, type: 'preference' },
    { regex: /toujours\s+(.+)/i, type: 'preference' },
    { regex: /jamais\s+(.+)/i, type: 'preference' }
  ];

  // Patterns pour détecter des infos business
  const businessPatterns = [
    { regex: /tarif.+(\d+)\s*€/i, type: 'fact', key: 'tarif_mentionne' },
    { regex: /horaire.+(\d+h)/i, type: 'fact', key: 'horaire_mentionne' },
    { regex: /zone.+intervention.+(.+)/i, type: 'fact', key: 'zone_intervention' }
  ];

  // Analyser chaque message
  for (const msg of messages) {
    if (msg.role !== 'user') continue;

    const content = msg.content || '';

    // Chercher des préférences
    for (const pattern of preferencePatterns) {
      const match = content.match(pattern.regex);
      if (match) {
        learnings.push({
          type: pattern.type,
          category: clientId ? 'client' : 'admin',
          key: `preference_${Date.now()}`,
          value: match[1].trim(),
          clientId
        });
      }
    }

    // Chercher des infos business
    for (const pattern of businessPatterns) {
      const match = content.match(pattern.regex);
      if (match) {
        learnings.push({
          type: pattern.type,
          category: 'business',
          key: pattern.key,
          value: match[1].trim()
        });
      }
    }
  }

  // Sauvegarder les apprentissages avec tenantId
  for (const learning of learnings) {
    await memoryRemember({
      tenantId,  // 🔒 TENANT ISOLATION
      type: learning.type,
      category: learning.category,
      subjectType: learning.clientId ? 'client' : null,
      subjectId: learning.clientId || null,
      key: learning.key,
      value: learning.value,
      confidence: 0.6
    });
  }

  return learnings.length;
}

// ============================================================
// === EXPORTS ===
// ============================================================

export default {
  dailyLearning,
  learnFromConversation
};
