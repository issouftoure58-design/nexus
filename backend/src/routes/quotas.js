/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES QUOTAS - API de gestion des quotas par plan              ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║   GET  /api/quotas          - Récupère usage quotas du tenant     ║
 * ║   GET  /api/quotas/limits   - Récupère les limites par plan       ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import { getQuotaUsage, PLAN_LIMITS } from '../middleware/quotas.js';

const router = express.Router();

// Middleware auth admin pour toutes les routes
router.use(authenticateAdmin);

/**
 * GET /api/quotas
 * Récupère l'usage des quotas du tenant connecté
 */
router.get('/', async (req, res) => {
  try {
    const tenant_id = req.admin.tenant_id;

    if (!tenant_id) {
      return res.status(401).json({
        success: false,
        error: 'Tenant non identifié'
      });
    }

    const usage = await getQuotaUsage(tenant_id);

    // Calculer la prochaine date de reset (1er du mois prochain)
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);
    resetDate.setDate(1);
    resetDate.setHours(0, 0, 0, 0);

    res.json({
      success: true,
      ...usage,
      reset_date: resetDate.toISOString(),
      reset_in_days: Math.ceil((resetDate - new Date()) / (1000 * 60 * 60 * 24))
    });
  } catch (error) {
    console.error('[QUOTAS] Erreur récupération quotas:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération quotas'
    });
  }
});

/**
 * GET /api/quotas/limits
 * Récupère les limites de tous les plans (pour affichage comparatif)
 */
router.get('/limits', async (req, res) => {
  try {
    const plans = Object.entries(PLAN_LIMITS).map(([id, limits]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      price: id === 'starter' ? 99 : id === 'pro' ? 199 : 399,
      limits: {
        clients: limits.clients === -1 ? 'Illimité' : limits.clients,
        storage_gb: limits.storage_gb === -1 ? 'Illimité' : `${limits.storage_gb} GB`,
        posts_per_month: limits.posts_per_month,
        images_per_month: limits.images_per_month
      }
    }));

    res.json({
      success: true,
      plans
    });
  } catch (error) {
    console.error('[QUOTAS] Erreur récupération limites:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur récupération limites'
    });
  }
});

export default router;
