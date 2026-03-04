/**
 * Routes admin pour le programme de parrainage
 * Sprint 4.3 — Programme parrainage et affiliation
 *
 * Endpoints:
 * GET    /api/admin/referrals           — Liste mes parrainages
 * POST   /api/admin/referrals           — Generer mon code de parrainage
 * GET    /api/admin/referrals/stats     — Statistiques de parrainage
 * GET    /api/admin/referrals/code      — Mon code de parrainage
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import {
  createReferral,
  generateReferralCode,
  getReferralStats,
  listReferrals
} from '../services/referralService.js';
import logger from '../config/logger.js';

const router = express.Router();

router.use(authenticateAdmin);

/**
 * GET /stats — Statistiques de parrainage
 */
router.get('/stats', async (req, res) => {
  try {
    const { tenantId } = req;
    const stats = await getReferralStats(tenantId);
    res.json(stats);
  } catch (error) {
    logger.error('Erreur stats referrals', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /code — Mon code de parrainage
 */
router.get('/code', async (req, res) => {
  try {
    const { tenantId } = req;
    const code = await generateReferralCode(tenantId);
    res.json({ referral_code: code });
  } catch (error) {
    logger.error('Erreur get referral code', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET / — Liste mes parrainages
 */
router.get('/', async (req, res) => {
  try {
    const { tenantId } = req;
    const { page = 1, limit = 20 } = req.query;
    const result = await listReferrals(tenantId, parseInt(page), parseInt(limit));
    res.json(result);
  } catch (error) {
    logger.error('Erreur liste referrals', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST / — Creer/recuperer mon code de parrainage
 */
router.post('/', async (req, res) => {
  try {
    const { tenantId } = req;
    const referral = await createReferral(tenantId);
    res.status(201).json(referral);
  } catch (error) {
    logger.error('Erreur creation referral', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
