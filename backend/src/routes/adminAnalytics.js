/**
 * Routes Admin Analytics - Business Plan
 * Prévisions, tendances, clustering, patterns
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import {
  forecastRevenue,
  analyzeClientTrends,
  clusterClients,
  detectPatterns
} from '../ai/predictiveAnalytics.js';
import { analyzeChurnRiskAll, scheduleChurnPrevention } from '../ai/predictions.js';

const router = express.Router();

/**
 * GET /api/admin/analytics/forecast
 * Prévision CA
 */
router.get('/forecast', authenticateAdmin, async (req, res) => {
  try {
    const { months } = req.query;

    const forecast = await forecastRevenue(
      req.admin.tenant_id,
      parseInt(months) || 3
    );

    res.json(forecast);
  } catch (error) {
    console.error('[Analytics] Erreur forecast:', error);
    res.status(500).json({ error: 'Erreur prévision CA' });
  }
});

/**
 * GET /api/admin/analytics/client-trends
 * Tendances clients
 */
router.get('/client-trends', authenticateAdmin, async (req, res) => {
  try {
    const trends = await analyzeClientTrends(req.admin.tenant_id);
    res.json(trends);
  } catch (error) {
    console.error('[Analytics] Erreur trends:', error);
    res.status(500).json({ error: 'Erreur analyse tendances' });
  }
});

/**
 * GET /api/admin/analytics/clustering
 * Clustering clients
 */
router.get('/clustering', authenticateAdmin, async (req, res) => {
  try {
    const clusters = await clusterClients(req.admin.tenant_id);
    res.json(clusters);
  } catch (error) {
    console.error('[Analytics] Erreur clustering:', error);
    res.status(500).json({ error: 'Erreur clustering' });
  }
});

/**
 * GET /api/admin/analytics/patterns
 * Détection patterns
 */
router.get('/patterns', authenticateAdmin, async (req, res) => {
  try {
    const patterns = await detectPatterns(req.admin.tenant_id);
    res.json(patterns);
  } catch (error) {
    console.error('[Analytics] Erreur patterns:', error);
    res.status(500).json({ error: 'Erreur détection patterns' });
  }
});

/**
 * GET /api/admin/analytics/dashboard
 * Dashboard analytics complet
 */
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const [forecast, trends, clusters, patterns] = await Promise.all([
      forecastRevenue(req.admin.tenant_id, 3),
      analyzeClientTrends(req.admin.tenant_id),
      clusterClients(req.admin.tenant_id),
      detectPatterns(req.admin.tenant_id)
    ]);

    res.json({
      forecast,
      trends,
      clusters,
      patterns
    });
  } catch (error) {
    console.error('[Analytics] Erreur dashboard analytics:', error);
    res.status(500).json({ error: 'Erreur dashboard analytics' });
  }
});

/**
 * GET /api/admin/analytics/churn
 * Analyse risque churn tous clients
 */
router.get('/churn', authenticateAdmin, async (req, res) => {
  try {
    const analysis = await analyzeChurnRiskAll(req.admin.tenant_id);
    res.json(analysis);
  } catch (error) {
    console.error('[Analytics] Erreur analyse churn:', error);
    res.status(500).json({ error: 'Erreur analyse churn' });
  }
});

/**
 * POST /api/admin/analytics/churn/:clientId/prevent
 * Programmer action anti-churn
 */
router.post('/churn/:clientId/prevent', authenticateAdmin, async (req, res) => {
  try {
    const { action_type } = req.body;
    const result = await scheduleChurnPrevention(
      req.admin.tenant_id,
      parseInt(req.params.clientId),
      action_type
    );
    res.json(result);
  } catch (error) {
    console.error('[Analytics] Erreur action anti-churn:', error);
    res.status(500).json({ error: 'Erreur programmation action anti-churn' });
  }
});

export default router;
