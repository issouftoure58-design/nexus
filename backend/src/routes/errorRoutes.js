/**
 * Error Routes — SENTINEL Error Tracking API
 * GET /nexus/errors       — Liste paginee (superadmin)
 * GET /nexus/errors/stats  — Stats agregees (superadmin)
 * POST /errors/report      — Endpoint public pour erreurs frontend (rate-limited)
 */

import express from 'express';
import { authenticateAdmin, requireSuperAdmin } from './adminAuth.js';
import { reportFrontendError, getErrors, getErrorStats } from '../services/errorTracker.js';
import rateLimit from 'express-rate-limit';

// Rate limiter strict pour le report frontend (anti-flood)
const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many error reports, slow down' },
});

const router = express.Router();

// --- Super-admin routes (mounted on /api/nexus) ---

router.get('/errors', authenticateAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const { page, limit, level, source, tenant_id, from, to } = req.query;
    const result = await getErrors({
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 50, 200),
      level: level || undefined,
      source: source || undefined,
      tenantId: tenant_id || undefined,
      from: from || undefined,
      to: to || undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/errors/stats', authenticateAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const stats = await getErrorStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Public frontend error report (mounted on /api) ---

export const frontendReportRouter = express.Router();

frontendReportRouter.post('/errors/report', reportLimiter, async (req, res) => {
  try {
    const { message, stack, level, context } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message required' });
    }

    await reportFrontendError({
      message: message.substring(0, 2000),
      stack: stack ? String(stack).substring(0, 10000) : null,
      level: ['error', 'warning', 'info', 'fatal'].includes(level) ? level : 'error',
      context: typeof context === 'object' ? context : {},
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to report error' });
  }
});

export default router;
