/**
 * Routes pour les statistiques de la queue de notifications
 */

import express from 'express';
import { getQueueStats, cleanQueue } from '../queues/notificationQueue.js';

const router = express.Router();

/**
 * GET /api/queue/stats
 * Récupère les statistiques de la queue de notifications
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getQueueStats();

    if (!stats) {
      return res.json({
        success: true,
        available: false,
        message: 'Queue non disponible (Redis non configuré)'
      });
    }

    res.json({
      success: true,
      available: true,
      stats: {
        waiting: stats.waiting,
        active: stats.active,
        completed: stats.completed,
        failed: stats.failed,
        delayed: stats.delayed,
        total: stats.waiting + stats.active + stats.delayed
      }
    });
  } catch (error) {
    console.error('[QUEUE] Erreur stats:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération statistiques queue'
    });
  }
});

/**
 * POST /api/queue/clean
 * Nettoie les anciens jobs de la queue
 * Protégé - nécessite autorisation admin
 */
router.post('/clean', async (req, res) => {
  try {
    // Vérifier autorisation (à implémenter selon votre système d'auth)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Autorisation requise'
      });
    }

    const { olderThan = 24 * 60 * 60 * 1000 } = req.body; // 24h par défaut
    await cleanQueue(olderThan);

    res.json({
      success: true,
      message: 'Queue nettoyée'
    });
  } catch (error) {
    console.error('[QUEUE] Erreur nettoyage:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur nettoyage queue'
    });
  }
});

/**
 * GET /api/queue/health
 * Health check de la queue
 */
router.get('/health', async (req, res) => {
  try {
    const stats = await getQueueStats();

    res.json({
      status: stats ? 'healthy' : 'unavailable',
      redis: stats ? 'connected' : 'not configured',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      redis: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
