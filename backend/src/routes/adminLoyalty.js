/**
 * Routes admin fidélité — /api/admin/loyalty
 * CRUD config, stats, leaderboard, ajustements
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/moduleProtection.js';
import * as loyaltyService from '../services/loyaltyService.js';

const router = express.Router();

// Gating: fidélité = Pro+ (planFeatures.js)
router.use(authenticateAdmin);
router.use(requireModule('fidelite'));

// GET /api/admin/loyalty/config
router.get('/config', async (req, res) => {
  try {
    const config = await loyaltyService.getConfig(req.admin.tenant_id);
    res.json({ config });
  } catch (error) {
    console.error('[LOYALTY] Erreur get config:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/loyalty/config
router.put('/config', async (req, res) => {
  try {
    const { enabled, points_per_euro, signup_bonus, validity_days, min_redeem, redeem_ratio } = req.body;
    const config = await loyaltyService.updateConfig(req.admin.tenant_id, {
      enabled, points_per_euro, signup_bonus, validity_days, min_redeem, redeem_ratio
    });
    res.json({ config });
  } catch (error) {
    console.error('[LOYALTY] Erreur update config:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/loyalty/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await loyaltyService.getStats(req.admin.tenant_id);
    const config = await loyaltyService.getConfig(req.admin.tenant_id);
    res.json({ stats, config });
  } catch (error) {
    console.error('[LOYALTY] Erreur stats:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/loyalty/leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const leaderboard = await loyaltyService.getLeaderboard(req.admin.tenant_id, limit);
    res.json({ leaderboard });
  } catch (error) {
    console.error('[LOYALTY] Erreur leaderboard:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/loyalty/clients/:id — Détail points + historique d'un client
router.get('/clients/:id', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const [points, history] = await Promise.all([
      loyaltyService.getClientPoints(req.admin.tenant_id, clientId),
      loyaltyService.getTransactionHistory(req.admin.tenant_id, clientId, page, limit)
    ]);

    res.json({ ...points, ...history });
  } catch (error) {
    console.error('[LOYALTY] Erreur client detail:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/loyalty/clients/:id/adjust — Ajustement manuel
router.post('/clients/:id/adjust', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const { points, reason } = req.body;

    if (!points || !reason) {
      return res.status(400).json({ error: 'Points et raison obligatoires' });
    }

    const transaction = await loyaltyService.adjustPoints(
      req.admin.tenant_id, clientId, parseInt(points), req.admin.id, reason
    );

    res.json({ success: true, transaction });
  } catch (error) {
    console.error('[LOYALTY] Erreur adjust:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/admin/loyalty/clients/:id/redeem — Utiliser des points
router.post('/clients/:id/redeem', async (req, res) => {
  try {
    const clientId = parseInt(req.params.id);
    const { points } = req.body;

    if (!points) {
      return res.status(400).json({ error: 'Points obligatoire' });
    }

    const result = await loyaltyService.redeemPoints(
      req.admin.tenant_id, clientId, parseInt(points)
    );

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[LOYALTY] Erreur redeem:', error.message);
    res.status(400).json({ error: error.message });
  }
});

export default router;
