/**
 * Routes Usage - API pour le tracking d'utilisation
 *
 * GET  /api/usage/current    - Usage du mois en cours
 * GET  /api/usage/history    - Historique sur plusieurs mois
 * GET  /api/usage/quota      - Vérifier un quota spécifique
 * POST /api/usage/quotas     - Définir les quotas (admin)
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import usageTracking from '../services/usageTrackingService.js';

const router = express.Router();

/**
 * GET /api/usage/current
 * Récupère l'usage du mois en cours pour le tenant
 */
router.get('/current', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const usage = await usageTracking.getMonthlyUsage(tenantId);

    res.json({
      success: true,
      usage,
    });
  } catch (error) {
    console.error('[USAGE API] Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/usage/history
 * Récupère l'historique d'usage sur plusieurs mois
 */
router.get('/history', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { months = 6 } = req.query;

    const history = await usageTracking.getUsageHistory(tenantId, parseInt(months));

    res.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('[USAGE API] Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/usage/quota/:type
 * Vérifie le quota pour un type spécifique
 */
router.get('/quota/:type', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { type } = req.params;

    if (!['telephone', 'whatsapp', 'web', 'ia'].includes(type)) {
      return res.status(400).json({ error: 'Type invalide' });
    }

    const quota = await usageTracking.checkQuota(tenantId, type);

    res.json({
      success: true,
      type,
      ...quota,
    });
  } catch (error) {
    console.error('[USAGE API] Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/usage/overage
 * Calcule le coût des dépassements
 */
router.get('/overage', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const overage = await usageTracking.calculateOverageCost(tenantId);

    res.json({
      success: true,
      ...overage,
    });
  } catch (error) {
    console.error('[USAGE API] Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/usage/quotas
 * Définit les quotas personnalisés (admin/super_admin)
 */
router.post('/quotas', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { telephone, whatsapp, web, ia } = req.body;

    // Seuls les admins peuvent modifier les quotas
    if (!['admin', 'owner', 'super_admin'].includes(req.admin.role)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    await usageTracking.setTenantQuotas(tenantId, { telephone, whatsapp, web, ia });

    res.json({
      success: true,
      message: 'Quotas mis à jour',
    });
  } catch (error) {
    console.error('[USAGE API] Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/usage/summary
 * Résumé complet pour le dashboard
 */
router.get('/summary', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const [usage, overage] = await Promise.all([
      usageTracking.getMonthlyUsage(tenantId),
      usageTracking.calculateOverageCost(tenantId),
    ]);

    // Calculer les pourcentages
    const summary = {
      month: usage.month,
      telephone: {
        ...usage.telephone,
        percentage: usage.telephone.limit > 0
          ? Math.round((usage.telephone.used / usage.telephone.limit) * 100)
          : 0,
      },
      whatsapp: {
        ...usage.whatsapp,
        percentage: usage.whatsapp.limit > 0
          ? Math.round((usage.whatsapp.used / usage.whatsapp.limit) * 100)
          : 0,
      },
      web: {
        ...usage.web,
        percentage: usage.web.limit > 0
          ? Math.round((usage.web.used / usage.web.limit) * 100)
          : 0,
      },
      overage: overage,
    };

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('[USAGE API] Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
