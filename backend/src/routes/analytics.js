/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES ANALYTICS - API pour dashboards et prédictions IA        ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import { analyticsService } from '../services/analyticsService.js';
import { requireModule } from '../middleware/checkPlan.js';

const router = express.Router();

// Middleware auth admin
router.use(authenticateAdmin);

// Middleware verification plan (analytics = Pro+)
router.use(requireModule('analytics'));

/**
 * GET /api/analytics/kpi
 * Métriques clés pour une période
 * Query params: debut, fin (format YYYY-MM-DD)
 */
router.get('/kpi', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { debut, fin } = req.query;

    // Défaut : mois en cours
    const now = new Date();
    const dateDebut = debut || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const dateFin = fin || now.toISOString().split('T')[0];

    const kpi = await analyticsService.getKPI(tenantId, dateDebut, dateFin);

    res.json({ success: true, ...kpi });
  } catch (error) {
    console.error('[ANALYTICS] Erreur KPI:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/evolution
 * Évolution temporelle (série chronologique)
 * Query params: debut, fin, granularite (jour|semaine|mois)
 */
router.get('/evolution', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { debut, fin, granularite = 'jour' } = req.query;

    // Défaut : 30 derniers jours
    const now = new Date();
    const dateDebut = debut || new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
    const dateFin = fin || new Date().toISOString().split('T')[0];

    const result = await analyticsService.getEvolution(tenantId, dateDebut, dateFin, granularite);

    res.json({
      success: true,
      periode: { debut: dateDebut, fin: dateFin },
      granularite,
      ...result
    });
  } catch (error) {
    console.error('[ANALYTICS] Erreur évolution:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/predictions
 * Prédictions IA (CA et RDV mois prochain)
 */
router.get('/predictions', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const predictions = await analyticsService.getPredictions(tenantId);

    res.json({ success: true, ...predictions });
  } catch (error) {
    console.error('[ANALYTICS] Erreur prédictions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/anomalies
 * Détection d'anomalies (taux annulation, baisse activité, etc.)
 */
router.get('/anomalies', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const anomalies = await analyticsService.getAnomalies(tenantId);

    res.json({ success: true, ...anomalies });
  } catch (error) {
    console.error('[ANALYTICS] Erreur anomalies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/rapport
 * Rapport complet (KPI + évolution + prédictions + anomalies)
 * Query params: debut, fin
 */
router.get('/rapport', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { debut, fin } = req.query;

    // Défaut : mois en cours
    const now = new Date();
    const dateDebut = debut || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const dateFin = fin || now.toISOString().split('T')[0];

    const rapport = await analyticsService.getRapportComplet(tenantId, dateDebut, dateFin);

    res.json({ success: true, ...rapport });
  } catch (error) {
    console.error('[ANALYTICS] Erreur rapport:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/comparaison
 * Compare deux périodes
 * Query params: debut1, fin1, debut2, fin2
 */
router.get('/comparaison', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { debut1, fin1, debut2, fin2 } = req.query;

    if (!debut1 || !fin1 || !debut2 || !fin2) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres requis: debut1, fin1, debut2, fin2'
      });
    }

    const [kpi1, kpi2] = await Promise.all([
      analyticsService.getKPI(tenantId, debut1, fin1),
      analyticsService.getKPI(tenantId, debut2, fin2)
    ]);

    // Calculer les différences
    const diffCA = parseFloat(kpi2.revenus.ca_total_euros) - parseFloat(kpi1.revenus.ca_total_euros);
    const diffRDV = kpi2.rdv.confirmes - kpi1.rdv.confirmes;
    const diffClients = kpi2.clients.actifs - kpi1.clients.actifs;

    res.json({
      success: true,
      periode_1: { debut: debut1, fin: fin1, ...kpi1 },
      periode_2: { debut: debut2, fin: fin2, ...kpi2 },
      differences: {
        ca_euros: diffCA.toFixed(2),
        ca_pourcent: parseFloat(kpi1.revenus.ca_total_euros) > 0
          ? ((diffCA / parseFloat(kpi1.revenus.ca_total_euros)) * 100).toFixed(1)
          : '0',
        rdv: diffRDV,
        rdv_pourcent: kpi1.rdv.confirmes > 0
          ? ((diffRDV / kpi1.rdv.confirmes) * 100).toFixed(1)
          : '0',
        clients: diffClients
      }
    });
  } catch (error) {
    console.error('[ANALYTICS] Erreur comparaison:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
