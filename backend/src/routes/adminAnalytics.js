/**
 * Routes Admin Analytics - Business Plan
 * Prévisions, tendances, clustering, patterns
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/moduleProtection.js';
import {
  forecastRevenue,
  analyzeClientTrends,
  clusterClients,
  detectPatterns
} from '../ai/predictiveAnalytics.js';
import { analyzeChurnRiskAll, scheduleChurnPrevention } from '../ai/predictions.js';
import { getComptabiliteAnalytique, getTopClients } from '../services/analytiqueService.js';

const router = express.Router();

// Appliquer auth + vérification module analytics (Business) globalement
router.use(authenticateAdmin, requireModule('analytics'));

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

    // CA ce mois — réservations + factures + commandes
    const [{ data: rdvMois }, { data: facMois }, { data: ordMois }] = await Promise.all([
      supabase.from('reservations').select('prix_total')
        .eq('tenant_id', tenantId).gte('date', startOfMonth).in('statut', ['confirme', 'termine']),
      supabase.from('factures').select('montant_ttc')
        .eq('tenant_id', tenantId).eq('statut', 'payee').is('reservation_id', null).gte('date_paiement', `${startOfMonth}T00:00:00`),
      supabase.from('orders').select('total')
        .eq('tenant_id', tenantId).in('statut', ['completed', 'ready']).gte('created_at', `${startOfMonth}T00:00:00`),
    ]);

    const caMois = (rdvMois?.reduce((sum, r) => sum + (r.prix_total || 0), 0) || 0)
      + (facMois?.reduce((sum, f) => sum + (parseFloat(f.montant_ttc) || 0), 0) || 0)
      + (ordMois?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) || 0);

    // CA mois précédent — réservations + factures + commandes
    const [{ data: rdvLastMois }, { data: facLastMois }, { data: ordLastMois }] = await Promise.all([
      supabase.from('reservations').select('prix_total')
        .eq('tenant_id', tenantId).gte('date', startOfLastMonth).lt('date', endOfLastMonth).in('statut', ['confirme', 'termine']),
      supabase.from('factures').select('montant_ttc')
        .eq('tenant_id', tenantId).eq('statut', 'payee').is('reservation_id', null).gte('date_paiement', `${startOfLastMonth}T00:00:00`).lt('date_paiement', `${endOfLastMonth}T00:00:00`),
      supabase.from('orders').select('total')
        .eq('tenant_id', tenantId).in('statut', ['completed', 'ready']).gte('created_at', `${startOfLastMonth}T00:00:00`).lt('created_at', `${endOfLastMonth}T00:00:00`),
    ]);

    const caLastMois = (rdvLastMois?.reduce((sum, r) => sum + (r.prix_total || 0), 0) || 0)
      + (facLastMois?.reduce((sum, f) => sum + (parseFloat(f.montant_ttc) || 0), 0) || 0)
      + (ordLastMois?.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0) || 0);

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
 * GET /api/admin/analytics/analytique
 * Comptabilité analytique : CA/service, CA/collab, marges, seuil de rentabilité
 */
router.get('/analytique', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const now = new Date();
    const debut = req.query.debut || `${now.getFullYear()}-01-01`;
    const fin = req.query.fin || now.toISOString().split('T')[0];
    const businessType = req.query.businessType || 'salon';

    const [data, par_client] = await Promise.all([
      getComptabiliteAnalytique(tenantId, debut, fin, businessType),
      getTopClients(tenantId, debut, fin),
    ]);
    res.json({ ...data, par_client });
  } catch (error) {
    console.error('[Analytics] Erreur comptabilité analytique:', error);
    res.status(500).json({ error: 'Erreur comptabilité analytique' });
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
 * GET /api/admin/analytics/churn/distribution
 * Distribution des scores de churn, niveaux de risque, top facteurs
 */
router.get('/churn/distribution', authenticateAdmin, async (req, res) => {
  try {
    const analysis = await analyzeChurnRiskAll(req.admin.tenant_id);
    const clients = analysis.clients || [];

    // Distribution par tranche de score
    const tranches = [
      { min: 0, max: 20, tranche: '0-20' },
      { min: 21, max: 40, tranche: '21-40' },
      { min: 41, max: 60, tranche: '41-60' },
      { min: 61, max: 80, tranche: '61-80' },
      { min: 81, max: 100, tranche: '81-100' }
    ];

    const distribution = tranches.map(({ min, max, tranche }) => ({
      tranche,
      count: clients.filter(c => (c.score || 0) >= min && (c.score || 0) <= max).length
    }));

    // Repartition par niveau de risque
    const lowCount = clients.filter(c => (c.score || 0) <= 30).length;
    const mediumCount = clients.filter(c => (c.score || 0) > 30 && (c.score || 0) <= 60).length;
    const highCount = clients.filter(c => (c.score || 0) > 60 && (c.score || 0) <= 80).length;
    const criticalCount = clients.filter(c => (c.score || 0) > 80).length;

    const risk_levels = [
      { name: 'Faible', value: lowCount, color: '#22c55e' },
      { name: 'Moyen', value: mediumCount, color: '#f59e0b' },
      { name: 'Eleve', value: highCount, color: '#ef4444' },
      { name: 'Critique', value: criticalCount, color: '#7f1d1d' }
    ];

    // Top facteurs de churn
    const factorCounts = {};
    clients.forEach(client => {
      if (Array.isArray(client.factors)) {
        client.factors.forEach(f => {
          const name = f.name || 'Inconnu';
          factorCounts[name] = (factorCounts[name] || 0) + 1;
        });
      } else {
        // Facteurs déduits du score
        const score = client.score || 0;
        const lastVisitDays = client.derniere_visite
          ? Math.floor((Date.now() - new Date(client.derniere_visite).getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        if (lastVisitDays > 60) {
          factorCounts['Pas de visite depuis 60j+'] = (factorCounts['Pas de visite depuis 60j+'] || 0) + 1;
        }
        if (score > 50) {
          factorCounts['Frequence en baisse'] = (factorCounts['Frequence en baisse'] || 0) + 1;
        }
      }
    });

    const top_factors = Object.entries(factorCounts)
      .map(([factor, count]) => ({ factor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({ distribution, risk_levels, top_factors });
  } catch (error) {
    console.error('[Analytics] Erreur churn distribution:', error);
    res.status(500).json({ error: 'Erreur distribution churn' });
  }
});

/**
 * GET /api/admin/analytics/churn
 * Analyse risque churn tous clients
 */
router.get('/churn', authenticateAdmin, async (req, res) => {
  try {
    const analysis = await analyzeChurnRiskAll(req.admin.tenant_id);

    // Mapper les données au format attendu par le frontend
    const mappedClients = (analysis.clients || []).map(client => {
      // Calculer les jours depuis dernière activité
      const lastActivityDays = client.derniere_visite
        ? Math.floor((Date.now() - new Date(client.derniere_visite).getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // Extraire les facteurs du tableau vers un objet
      const factors = {
        inactivity: 0,
        frequency_drop: 0,
        spending_drop: 0,
        engagement: 0
      };

      // Mapper les facteurs si présents
      if (Array.isArray(client.factors)) {
        client.factors.forEach(f => {
          if (f.name?.includes('inactiv') || f.name?.includes('Inactiv')) {
            factors.inactivity = f.weight || 0;
          } else if (f.name?.includes('fréquence') || f.name?.includes('Frequence')) {
            factors.frequency_drop = f.weight || 0;
          } else if (f.name?.includes('CA') || f.name?.includes('dépense')) {
            factors.spending_drop = f.weight || 0;
          } else if (f.name?.includes('engag')) {
            factors.engagement = f.weight || 0;
          }
        });
      }

      return {
        client_id: client.client_id,
        name: client.nom || 'Client inconnu',
        email: client.email || '',
        risk_score: client.score || 0,
        risk_level: client.risk === 'high' ? 'high' : (client.risk === 'medium' ? 'medium' : 'low'),
        last_activity_days: lastActivityDays,
        total_spent: 0, // Non disponible dans les données actuelles
        factors
      };
    });

    res.json({
      total_clients: analysis.total_clients || 0,
      at_risk: analysis.at_risk || 0,
      high_risk: analysis.high_risk || 0,
      medium_risk: analysis.medium_risk || 0,
      clients: mappedClients
    });
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
    let { action_type } = req.body;

    // Mapper les types d'actions frontend vers backend
    const actionTypeMapping = {
      'email_retention': 'email',
      'sms_rappel': 'sms',
      'promo_personnalisee': 'promo',
      // Garder les types backend existants
      'email': 'email',
      'sms': 'sms',
      'promo': 'promo',
      'call': 'call'
    };

    action_type = actionTypeMapping[action_type] || action_type;

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
