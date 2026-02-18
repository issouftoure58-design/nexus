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
 * GET /api/admin/analytics/overview
 * Vue d'ensemble analytics simplifiée pour l'admin-ui
 */
router.get('/overview', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Importer supabase
    const { supabase } = await import('../config/supabase.js');

    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const startOfLastMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
    const endOfLastMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}-01`;

    // CA ce mois
    const { data: rdvMois } = await supabase
      .from('reservations')
      .select('prix_total')
      .eq('tenant_id', tenantId)
      .gte('date', startOfMonth)
      .in('statut', ['confirme', 'termine']);

    const caMois = rdvMois?.reduce((sum, r) => sum + (r.prix_total || 0), 0) || 0;

    // CA mois précédent
    const { data: rdvLastMois } = await supabase
      .from('reservations')
      .select('prix_total')
      .eq('tenant_id', tenantId)
      .gte('date', startOfLastMonth)
      .lt('date', endOfLastMonth)
      .in('statut', ['confirme', 'termine']);

    const caLastMois = rdvLastMois?.reduce((sum, r) => sum + (r.prix_total || 0), 0) || 0;

    // Calcul variation CA
    const caVariation = caLastMois > 0
      ? Math.round(((caMois - caLastMois) / caLastMois) * 100)
      : (caMois > 0 ? 100 : 0);

    // Nombre de clients
    const { count: nbClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // Nouveaux clients ce mois
    const { count: nouveauxClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfMonth);

    // Nombre de RDV ce mois
    const { count: nbRdv } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('date', startOfMonth);

    // Nombre de RDV mois précédent
    const { count: nbRdvLast } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('date', startOfLastMonth)
      .lt('date', endOfLastMonth);

    const rdvVariation = nbRdvLast > 0
      ? Math.round(((nbRdv - nbRdvLast) / nbRdvLast) * 100)
      : (nbRdv > 0 ? 100 : 0);

    // Taux de conversion (RDV confirmés / total)
    const { count: rdvConfirmes } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('date', startOfMonth)
      .in('statut', ['confirme', 'termine']);

    const tauxConversion = nbRdv > 0
      ? Math.round((rdvConfirmes / nbRdv) * 100)
      : 0;

    res.json({
      ca_total: caMois / 100,
      ca_variation: caVariation,
      nb_clients: nbClients || 0,
      clients_variation: nouveauxClients || 0,
      nb_rdv: nbRdv || 0,
      rdv_variation: rdvVariation,
      taux_conversion: tauxConversion,
    });
  } catch (error) {
    console.error('[Analytics] Erreur overview:', error);
    res.status(500).json({ error: 'Erreur overview analytics' });
  }
});

/**
 * GET /api/admin/analytics/revenue
 * Données revenus par période
 */
router.get('/revenue', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { period = '7d' } = req.query;

    const { supabase } = await import('../config/supabase.js');

    // Calculer la période
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const { data: rdvDay } = await supabase
        .from('reservations')
        .select('prix_total')
        .eq('tenant_id', tenantId)
        .eq('date', dateStr)
        .in('statut', ['confirme', 'termine']);

      const ca = rdvDay?.reduce((sum, r) => sum + (r.prix_total || 0), 0) / 100 || 0;

      data.push({ date: dateStr, ca });
    }

    res.json({ data });
  } catch (error) {
    console.error('[Analytics] Erreur revenue:', error);
    res.status(500).json({ error: 'Erreur données revenus' });
  }
});

/**
 * GET /api/admin/analytics/clients
 * Stats clients
 */
router.get('/clients', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { supabase } = await import('../config/supabase.js');

    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString();

    // Nouveaux clients ce mois
    const { count: nouveauxClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfMonth);

    // Clients actifs (ont un RDV dans les 3 derniers mois)
    const { data: clientsActifsData } = await supabase
      .from('reservations')
      .select('client_id')
      .eq('tenant_id', tenantId)
      .gte('date', threeMonthsAgo)
      .in('statut', ['confirme', 'termine']);

    const clientsActifs = new Set(clientsActifsData?.map(r => r.client_id) || []).size;

    // Total clients
    const { count: totalClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // Clients perdus (pas de RDV depuis 6 mois)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString();
    const { data: clientsRecentData } = await supabase
      .from('reservations')
      .select('client_id')
      .eq('tenant_id', tenantId)
      .gte('date', sixMonthsAgo);

    const clientsRecents = new Set(clientsRecentData?.map(r => r.client_id) || []).size;
    const clientsPerdus = Math.max(0, (totalClients || 0) - clientsRecents);

    // Taux de rétention
    const tauxRetention = totalClients > 0
      ? Math.round((clientsActifs / totalClients) * 100)
      : 0;

    res.json({
      nouveaux_clients: nouveauxClients || 0,
      clients_actifs: clientsActifs,
      clients_perdus: clientsPerdus,
      taux_retention: tauxRetention,
    });
  } catch (error) {
    console.error('[Analytics] Erreur clients:', error);
    res.status(500).json({ error: 'Erreur stats clients' });
  }
});

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
