/**
 * Routes pour les statistiques de la queue de notifications
 * ⚠️ SECURED: Toutes les routes nécessitent authenticateAdmin
 */

import express from 'express';
import { getQueueStats, cleanQueue } from '../queues/notificationQueue.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// 🔒 Toutes les routes queue nécessitent une auth admin
router.use(authenticateAdmin);

/**
 * GET /api/queue/stats
 * Récupère les statistiques de la queue de notifications
 * ⚠️ SECURED: Requires admin authentication
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
 * ⚠️ SECURED: Requires admin authentication (via router.use)
 */
router.post('/clean', async (req, res) => {
  try {
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
