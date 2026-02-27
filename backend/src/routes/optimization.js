/**
 * Routes API pour le monitoring et l'optimisation des coûts
 *
 * Endpoints :
 * - GET /api/optimization/costs/today - Coûts du jour
 * - GET /api/optimization/costs/month - Coûts du mois
 * - GET /api/optimization/costs/breakdown/:service - Détail par service
 * - GET /api/optimization/budget/status - Statut du budget
 * - GET /api/optimization/cache/stats - Statistiques du cache
 * - POST /api/optimization/cache/cleanup - Nettoyer le cache expiré
 * - GET /api/optimization/session - Stats de la session
 * - GET /api/optimization/dashboard - Vue d'ensemble pour le dashboard
 *
 * @module routes/optimization
 */

import { Router } from 'express';
import costMonitor from '../services/optimization/costMonitor.js';
import cacheService from '../services/optimization/cacheService.js';
import aiRouting from '../services/aiRoutingService.js';
import notificationCascade from '../services/notificationCascadeService.js';

const router = Router();

// === ROUTES COÛTS ===

/**
 * GET /api/optimization/costs/today
 * Récupère les coûts du jour actuel
 */
router.get('/costs/today', (req, res) => {
  try {
    const costs = costMonitor.getDailyCosts();
    res.json({
      success: true,
      data: costs
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur costs/today:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/optimization/costs/date/:date
 * Récupère les coûts d'une date spécifique
 */
router.get('/costs/date/:date', (req, res) => {
  try {
    const { date } = req.params;
    // Valider le format de date
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'Format de date invalide. Utilisez YYYY-MM-DD'
      });
    }

    const costs = costMonitor.getDailyCosts(date);
    res.json({
      success: true,
      data: costs
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur costs/date:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/optimization/costs/month
 * Récupère les coûts du mois actuel
 */
router.get('/costs/month', (req, res) => {
  try {
    const { month } = req.query; // Optionnel: YYYY-MM
    const costs = costMonitor.getMonthlyCosts(month || new Date());
    res.json({
      success: true,
      data: costs
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur costs/month:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/optimization/costs/breakdown/:service
 * Récupère le détail d'un service sur une période
 */
router.get('/costs/breakdown/:service', (req, res) => {
  try {
    const { service } = req.params;
    const { period = 'week' } = req.query; // week, month, day

    const validServices = ['claude', 'elevenlabs', 'twilio', 'dalle', 'tavily'];
    if (!validServices.includes(service)) {
      return res.status(400).json({
        success: false,
        error: `Service invalide. Services valides: ${validServices.join(', ')}`
      });
    }

    const breakdown = costMonitor.getServiceBreakdown(service, period);
    res.json({
      success: true,
      data: {
        service,
        period,
        breakdown
      }
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur costs/breakdown:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// === ROUTES BUDGET ===

/**
 * GET /api/optimization/budget/status
 * Récupère le statut actuel du budget
 */
router.get('/budget/status', (req, res) => {
  try {
    const status = costMonitor.getBudgetStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur budget/status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/optimization/budget/alerts
 * Récupère les alertes de budget actives
 */
router.get('/budget/alerts', (req, res) => {
  try {
    const alerts = costMonitor.checkBudgetAlerts();
    res.json({
      success: true,
      data: {
        count: alerts.length,
        alerts
      }
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur budget/alerts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// === ROUTES CACHE ===

/**
 * GET /api/optimization/cache/stats
 * Récupère les statistiques du cache
 */
router.get('/cache/stats', (req, res) => {
  try {
    const stats = cacheService.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur cache/stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/optimization/cache/cleanup
 * Nettoie les entrées de cache expirées
 */
router.post('/cache/cleanup', (req, res) => {
  try {
    const result = cacheService.cleanup();
    res.json({
      success: true,
      message: `${result.totalCleaned} entrées nettoyées`,
      data: result
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur cache/cleanup:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/optimization/cache/:service/:key
 * Invalide une entrée de cache spécifique
 */
router.delete('/cache/:service/:key', (req, res) => {
  try {
    const { service, key } = req.params;
    const result = cacheService.invalidate(service, key);
    res.json({
      success: true,
      invalidated: result
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur cache/invalidate:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// === ROUTES SESSION ===

/**
 * GET /api/optimization/session
 * Récupère les statistiques de la session en cours
 */
router.get('/session', (req, res) => {
  try {
    const stats = costMonitor.getSessionStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/optimization/session/reset
 * Réinitialise les statistiques de session
 */
router.post('/session/reset', (req, res) => {
  try {
    costMonitor.resetSessionStats();
    res.json({
      success: true,
      message: 'Statistiques de session réinitialisées'
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur session/reset:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// === ROUTE DASHBOARD ===

/**
 * GET /api/optimization/dashboard
 * Vue d'ensemble pour le dashboard admin
 */
router.get('/dashboard', (req, res) => {
  try {
    const todayCosts = costMonitor.getDailyCosts();
    const monthlyCosts = costMonitor.getMonthlyCosts();
    const budgetStatus = costMonitor.getBudgetStatus();
    const cacheStats = cacheService.getStats();
    const sessionStats = costMonitor.getSessionStats();
    const alerts = costMonitor.checkBudgetAlerts();

    // Calculer les tendances
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayCosts = costMonitor.getDailyCosts(yesterday);

    const dailyTrend = todayCosts.totalCost > 0 && yesterdayCosts.totalCost > 0
      ? ((todayCosts.totalCost - yesterdayCosts.totalCost) / yesterdayCosts.totalCost * 100).toFixed(1)
      : 0;

    // AI Routing stats
    const aiRoutingStats = aiRouting.getStats();

    // Notification Cascade stats
    const cascadeStats = notificationCascade.getStats();

    res.json({
      success: true,
      data: {
        summary: {
          todayTotal: todayCosts.totalCost,
          monthTotal: monthlyCosts.totalCost,
          monthBudget: budgetStatus.total.budget,
          monthRemaining: budgetStatus.total.remaining,
          monthPercent: budgetStatus.total.percent,
          projectedEndOfMonth: budgetStatus.total.projectedEndOfMonth,
          dailyTrend: parseFloat(dailyTrend),
          alertsCount: alerts.length,
          // AI Routing
          aiCacheHitRate: aiRoutingStats.cacheHitRate,
          aiHaikuRate: aiRoutingStats.haikuRate,
          aiSavings: aiRoutingStats.estimatedSavingsEUR,
          // Notification Cascade
          cascadeEmailOnlyRate: cascadeStats.emailOnlyRate,
          cascadeSavings: cascadeStats.totalSavingsEUR
        },
        today: todayCosts,
        month: monthlyCosts,
        budget: budgetStatus,
        cache: cacheStats,
        session: sessionStats,
        alerts: alerts,
        aiRouting: aiRoutingStats,
        cascade: cascadeStats,
        pricing: costMonitor.PRICING
      }
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// === ROUTE PRICING ===

/**
 * GET /api/optimization/pricing
 * Récupère la grille tarifaire des services
 */
router.get('/pricing', (req, res) => {
  res.json({
    success: true,
    data: costMonitor.PRICING
  });
});

// === ROUTE TRACK (pour les autres services) ===

/**
 * POST /api/optimization/track
 * Enregistre manuellement une utilisation (pour tests ou services externes)
 */
router.post('/track', (req, res) => {
  try {
    const { service, operation, quantity, metadata } = req.body;

    if (!service || !operation || quantity === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants: service, operation, quantity requis'
      });
    }

    const result = costMonitor.trackUsage(service, operation, quantity, metadata || {});
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur track:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// === ROUTE STATIC RESPONSES ===

/**
 * GET /api/optimization/static-responses
 * Liste les réponses statiques configurées
 */
router.get('/static-responses', (req, res) => {
  const responses = Object.entries(cacheService.STATIC_RESPONSES).map(([key, data]) => ({
    key,
    response: data.response,
    keywords: data.keywords
  }));

  res.json({
    success: true,
    count: responses.length,
    data: responses
  });
});

/**
 * POST /api/optimization/match-static
 * Teste si une question correspond à une réponse statique
 */
router.post('/match-static', (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({
      success: false,
      error: 'Question requise'
    });
  }

  const match = cacheService.matchStaticResponse(question);
  res.json({
    success: true,
    matched: !!match,
    data: match
  });
});

// === ROUTES AI ROUTING ===

/**
 * GET /api/optimization/ai-routing/stats
 * Statistiques du routage IA intelligent
 */
router.get('/ai-routing/stats', (req, res) => {
  try {
    const stats = aiRouting.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur ai-routing/stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/optimization/ai-routing/reset
 * Reset les statistiques du routage IA
 */
router.post('/ai-routing/reset', (req, res) => {
  try {
    aiRouting.resetStats();
    res.json({
      success: true,
      message: 'Statistiques AI routing reinitialisees'
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur ai-routing/reset:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/optimization/ai-routing/adjust
 * Ajuste les seuils de routage
 * Body: { adjustment: number } - positif = plus de Haiku, negatif = plus de Sonnet
 */
router.post('/ai-routing/adjust', (req, res) => {
  try {
    const { adjustment } = req.body;

    if (adjustment === undefined || typeof adjustment !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'Parametre adjustment (number) requis'
      });
    }

    if (adjustment < -3 || adjustment > 3) {
      return res.status(400).json({
        success: false,
        error: 'Adjustment doit etre entre -3 et 3'
      });
    }

    const result = aiRouting.adjustRouting(adjustment);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur ai-routing/adjust:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/optimization/ai-routing/test
 * Teste le routage pour un message donne (sans appeler l'API)
 */
router.post('/ai-routing/test', async (req, res) => {
  try {
    const { message, context = {} } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Parametre message requis'
      });
    }

    // Import dynamique du modelRouter pour test
    const { default: modelRouter } = await import('../services/modelRouter.js');
    const result = modelRouter.selectModel({ userMessage: message, context });

    res.json({
      success: true,
      data: {
        input: message,
        selectedModel: result.model,
        reason: result.reason,
        complexity: result.complexity,
        expectedCost: result.expectedCost
      }
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur ai-routing/test:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// === ROUTES NOTIFICATION CASCADE ===

/**
 * GET /api/optimization/cascade/stats
 * Statistiques de la cascade de notifications
 */
router.get('/cascade/stats', (req, res) => {
  try {
    const stats = notificationCascade.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur cascade/stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/optimization/cascade/reset
 * Reset les statistiques de cascade
 */
router.post('/cascade/reset', (req, res) => {
  try {
    notificationCascade.resetStats();
    res.json({
      success: true,
      message: 'Statistiques cascade reinitialisees'
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur cascade/reset:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/optimization/cascade/config
 * Configuration de la cascade (delais, couts)
 */
router.get('/cascade/config', (req, res) => {
  res.json({
    success: true,
    data: {
      delays: notificationCascade.CASCADE_DELAYS,
      costs: notificationCascade.COSTS,
      priorities: Object.keys(notificationCascade.PRIORITY)
    }
  });
});

/**
 * POST /api/optimization/cascade/test
 * Teste l'envoi d'une notification cascade (dry-run)
 */
router.post('/cascade/test', async (req, res) => {
  try {
    const { recipient, content, priority = 'normal' } = req.body;

    if (!recipient || !content) {
      return res.status(400).json({
        success: false,
        error: 'recipient et content requis'
      });
    }

    // Simulation sans envoi reel
    const channelsToUse = [];
    if (recipient.email) channelsToUse.push('email');

    if (priority === 'urgent' || priority === 'high') {
      if (recipient.phone) channelsToUse.push('whatsapp');
    }
    if (priority === 'urgent') {
      if (recipient.phone) channelsToUse.push('sms');
    }

    const estimatedCost = channelsToUse.reduce((sum, ch) => {
      return sum + (notificationCascade.COSTS[ch] || 0);
    }, 0);

    res.json({
      success: true,
      data: {
        dryRun: true,
        priority,
        channelsToUse,
        estimatedCost,
        comparedToSmsOnly: {
          smsCost: notificationCascade.COSTS.sms,
          savings: notificationCascade.COSTS.sms - estimatedCost,
          savingsPercent: ((notificationCascade.COSTS.sms - estimatedCost) / notificationCascade.COSTS.sms * 100).toFixed(1) + '%'
        }
      }
    });
  } catch (error) {
    console.error('[OPTIMIZATION] Erreur cascade/test:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
