/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES TRIAL - Gestion période d'essai NEXUS                    ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import {
  getTrialStatus,
  checkTrialLimit,
  extendTrial,
  convertTrialToPaid,
  TRIAL_LIMITS,
  TRIAL_DURATION_DAYS,
} from '../services/trialService.js';

const router = express.Router();

/**
 * GET /api/trial/status
 * Récupère le statut du trial pour le tenant connecté
 */
router.get('/status', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant non identifié' });
    }

    const status = await getTrialStatus(tenantId);

    if (status.error) {
      return res.status(404).json({ error: status.error });
    }

    res.json({
      success: true,
      ...status,
    });
  } catch (err) {
    console.error('[TRIAL] Erreur status:', err);
    res.status(500).json({ error: 'Erreur récupération statut trial' });
  }
});

/**
 * GET /api/trial/limits
 * Récupère les limites du trial
 */
router.get('/limits', async (req, res) => {
  res.json({
    success: true,
    limits: TRIAL_LIMITS,
    duration_days: TRIAL_DURATION_DAYS,
  });
});

/**
 * POST /api/trial/check
 * Vérifie si une action est autorisée
 * Body: { resource: 'interactions_ia', amount: 1 }
 */
router.post('/check', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    const { resource, amount = 1 } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant non identifié' });
    }

    if (!resource) {
      return res.status(400).json({ error: 'Resource requise' });
    }

    const check = await checkTrialLimit(tenantId, resource, amount);

    res.json({
      success: true,
      ...check,
    });
  } catch (err) {
    console.error('[TRIAL] Erreur check:', err);
    res.status(500).json({ error: 'Erreur vérification limite' });
  }
});

/**
 * POST /api/trial/extend
 * Prolonge le trial (admin/support uniquement)
 * Body: { tenant_id: 'xxx', days: 7 }
 */
router.post('/extend', authenticateAdmin, async (req, res) => {
  try {
    // Vérifier que l'utilisateur est admin système
    if (req.admin?.role !== 'superadmin') {
      return res.status(403).json({ error: 'Action non autorisée' });
    }

    const { tenant_id, days = 7 } = req.body;

    if (!tenant_id) {
      return res.status(400).json({ error: 'tenant_id requis' });
    }

    const result = await extendTrial(tenant_id, days);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: `Trial prolongé de ${days} jours`,
      ...result,
    });
  } catch (err) {
    console.error('[TRIAL] Erreur extend:', err);
    res.status(500).json({ error: 'Erreur prolongation trial' });
  }
});

/**
 * POST /api/trial/convert
 * Convertit le trial en abonnement payant
 * Body: { plan_id: 'pro' }
 */
router.post('/convert', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    const { plan_id } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant non identifié' });
    }

    if (!plan_id) {
      return res.status(400).json({ error: 'plan_id requis' });
    }

    const result = await convertTrialToPaid(tenantId, plan_id);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      message: 'Conversion réussie ! Bienvenue chez NEXUS.',
      ...result,
    });
  } catch (err) {
    console.error('[TRIAL] Erreur convert:', err);
    res.status(500).json({ error: 'Erreur conversion' });
  }
});

/**
 * GET /api/trial/usage-summary
 * Résumé de l'usage pendant le trial
 */
router.get('/usage-summary', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant non identifié' });
    }

    const status = await getTrialStatus(tenantId);

    if (status.error) {
      return res.status(404).json({ error: status.error });
    }

    // Calculer pourcentage d'utilisation par ressource
    const usageSummary = {};

    for (const [resource, limit] of Object.entries(TRIAL_LIMITS)) {
      const used = status.usage?.[resource] || 0;
      usageSummary[resource] = {
        used,
        limit,
        remaining: Math.max(0, limit - used),
        percentage: Math.round((used / limit) * 100),
        isAtLimit: used >= limit,
      };
    }

    res.json({
      success: true,
      isTrial: status.isTrial,
      daysRemaining: status.daysRemaining,
      usage: usageSummary,
      alerts: status.alerts || [],
    });
  } catch (err) {
    console.error('[TRIAL] Erreur usage-summary:', err);
    res.status(500).json({ error: 'Erreur récupération usage' });
  }
});

export default router;
