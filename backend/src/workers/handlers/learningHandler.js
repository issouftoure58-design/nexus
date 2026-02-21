import { TaskTypes } from '../../services/taskQueue.js';
import { remember, createInsight, getPendingInsights } from '../../services/halimahMemory.js';

/**
 * Handler pour les tâches d'apprentissage
 */
export async function handleLearningTask(job) {
  const { type, data, tenantId } = job.data;

  console.log(`[LEARNING] 🧠 Traitement tâche ${type}`);

  switch (type) {
    case TaskTypes.LEARN_FROM_FEEDBACK:
      return await learnFromFeedback(data, tenantId);

    case TaskTypes.UPDATE_INSIGHTS:
      return await updateInsights(tenantId);

    default:
      throw new Error(`Handler learning inconnu: ${type}`);
  }
}

/**
 * Apprend à partir d'un feedback
 */
async function learnFromFeedback(data, tenantId) {
  if (!tenantId) {
    console.error('[LEARNING] ❌ learnFromFeedback requires tenantId');
    return { learned: false, error: 'tenant_id requis' };
  }

  const { feedback, context, source } = data;

  console.log(`[LEARNING] 📝 Apprentissage à partir du feedback (tenant: ${tenantId})...`);
  console.log(`[LEARNING]    Source: ${source || 'inconnu'}`);
  console.log(`[LEARNING]    Rating: ${feedback?.rating || 'N/A'}`);

  try {
    // Si le feedback est positif, mémoriser le pattern
    if (feedback?.rating >= 4) {
      console.log('[LEARNING] ✨ Feedback positif - mémorisation du pattern');

      if (remember) {
        await remember({
          tenantId,  // 🔒 TENANT ISOLATION - No fallback
          type: 'learning',
          category: 'positive_pattern',
          key: `pattern_${Date.now()}`,
          value: JSON.stringify({
            context,
            rating: feedback.rating,
            comment: feedback.comment,
            source
          }),
          confidence: 0.7 + (feedback.rating - 4) * 0.15 // 0.7 à 0.85 selon rating
        });
      }

      // Créer un insight si le pattern est notable
      if (feedback.comment && createInsight) {
        await createInsight({
          tenantId,  // 🔒 TENANT ISOLATION - No fallback
          category: 'learning',
          insight: `Pattern positif identifié: ${feedback.comment.substring(0, 100)}`,
          data: { context, feedback },
          confidence: 0.7
        });
      }
    }

    // Si le feedback est négatif, noter pour amélioration
    if (feedback?.rating <= 2) {
      console.log('[LEARNING] ⚠️ Feedback négatif - analyse pour amélioration');

      if (createInsight) {
        await createInsight({
          tenantId,  // 🔒 TENANT ISOLATION - No fallback
          category: 'improvement',
          insight: `Point d'amélioration: ${feedback.comment || 'Pas de commentaire'}`,
          data: { context, feedback },
          confidence: 0.8
        });
      }
    }

    return {
      learned: true,
      feedbackType: feedback?.rating >= 4 ? 'positive' : feedback?.rating <= 2 ? 'negative' : 'neutral',
      actions: feedback?.rating >= 4
        ? ['Pattern mémorisé', 'Insight créé']
        : feedback?.rating <= 2
          ? ['Point d\'amélioration noté']
          : ['Feedback neutre enregistré'],
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[LEARNING] ❌ Erreur apprentissage:', error);
    return { learned: false, error: error.message };
  }
}

/**
 * Met à jour les insights basés sur les données accumulées
 */
async function updateInsights(tenantId) {
  if (!tenantId) {
    console.error('[LEARNING] ❌ updateInsights requires tenantId');
    return { updated: false, error: 'tenant_id requis' };
  }

  console.log(`[LEARNING] 🔄 Mise à jour des insights (tenant: ${tenantId})...`);

  try {
    // Récupérer les insights existants
    const existingInsights = getPendingInsights
      ? await getPendingInsights(100, tenantId)
      : [];

    // Analyser les patterns
    const patterns = analyzePatterns(existingInsights);

    // Générer de nouveaux insights
    const newInsights = [];

    // Insight sur les services populaires
    if (patterns.popularServices?.length > 0) {
      newInsights.push({
        category: 'business',
        insight: `Services les plus demandés: ${patterns.popularServices.join(', ')}`,
        confidence: 0.8
      });
    }

    // Insight sur les créneaux
    if (patterns.busyTimes?.length > 0) {
      newInsights.push({
        category: 'scheduling',
        insight: `Créneaux les plus demandés: ${patterns.busyTimes.join(', ')}`,
        confidence: 0.8
      });
    }

    // Insight sur les feedbacks
    if (patterns.feedbackSummary) {
      newInsights.push({
        category: 'quality',
        insight: patterns.feedbackSummary,
        confidence: 0.75
      });
    }

    // Sauvegarder les nouveaux insights
    for (const insight of newInsights) {
      if (createInsight) {
        await createInsight({
          tenantId,  // 🔒 TENANT ISOLATION - No fallback
          ...insight,
          data: { generatedFrom: 'pattern_analysis' }
        });
      }
    }

    console.log(`[LEARNING] ✅ ${newInsights.length} nouveaux insights générés`);

    return {
      updated: true,
      patternsAnalyzed: Object.keys(patterns).length,
      newInsights: newInsights.length,
      insights: newInsights,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[LEARNING] ❌ Erreur mise à jour insights:', error);
    return { updated: false, error: error.message };
  }
}

/**
 * Analyse les patterns à partir des insights existants
 */
function analyzePatterns(insights) {
  const patterns = {
    popularServices: [],
    busyTimes: [],
    feedbackSummary: null
  };

  if (!insights || insights.length === 0) {
    return patterns;
  }

  // Analyser les services mentionnés
  const serviceMentions = {};
  insights.forEach(i => {
    if (i.data?.service) {
      serviceMentions[i.data.service] = (serviceMentions[i.data.service] || 0) + 1;
    }
  });

  patterns.popularServices = Object.entries(serviceMentions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  // Analyser les feedbacks
  const feedbacks = insights.filter(i => i.category === 'learning' || i.category === 'improvement');
  const positives = feedbacks.filter(i => i.data?.feedback?.rating >= 4).length;
  const negatives = feedbacks.filter(i => i.data?.feedback?.rating <= 2).length;

  if (positives + negatives > 0) {
    const ratio = (positives / (positives + negatives) * 100).toFixed(0);
    patterns.feedbackSummary = `Taux de satisfaction: ${ratio}% (${positives} positifs, ${negatives} négatifs)`;
  }

  return patterns;
}

/**
 * Consolide les apprentissages en règles
 */
export async function consolidateLearnings(tenantId) {
  console.log('[LEARNING] 📚 Consolidation des apprentissages...');

  // Cette fonction pourrait être appelée périodiquement pour :
  // 1. Regrouper les patterns similaires
  // 2. Augmenter la confiance des patterns répétés
  // 3. Archiver les patterns obsolètes

  return {
    consolidated: true,
    timestamp: new Date().toISOString()
  };
}
