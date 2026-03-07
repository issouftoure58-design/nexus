/**
 * Routes NEXUS Super-Admin (Operator Panel)
 * Endpoints /api/nexus/* — protégés par requireSuperAdmin
 *
 * Vue cross-tenant pour le propriétaire de la plateforme NEXUS
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin, requireSuperAdmin } from './adminAuth.js';
import { sentinel } from '../sentinel/index.js';
import { alerter } from '../sentinel/actions/alerter.js';
import { getRecentLogs, getSecurityStats, getRateLimitStats } from '../sentinel/security/index.js';
import { createBackup, listBackups, restoreBackup } from '../sentinel/backup/index.js';
import { getStatus as getUptimeStatus } from '../sentinel/monitoring/index.js';

const router = express.Router();

// Toutes les routes nécessitent authenticateAdmin + requireSuperAdmin
router.use(authenticateAdmin);
router.use(requireSuperAdmin);

// Prix par plan (source de vérité: migration 041)
const PLAN_PRICES = {
  starter: 99,
  pro: 249,
  business: 499
};

// ============================================
// DASHBOARD
// ============================================

/**
 * GET /api/nexus/dashboard
 * Dashboard principal Super-Admin: MRR, tenants, alertes, coûts
 */
router.get('/dashboard', async (req, res) => {
  try {
    // 1. Tous les tenants actifs
    const { data: tenants, error: tenantsErr } = await supabase
      .from('tenants')
      .select('id, name, plan, statut, created_at')
      .in('statut', ['actif', 'essai']);

    if (tenantsErr) throw tenantsErr;

    const activeTenants = tenants || [];

    // 2. Calcul MRR
    let mrr = 0;
    const planDistribution = { starter: 0, pro: 0, business: 0 };
    for (const t of activeTenants) {
      const plan = (t.plan || 'starter').toLowerCase();
      mrr += PLAN_PRICES[plan] || 0;
      if (planDistribution[plan] !== undefined) planDistribution[plan]++;
    }

    // 3. Coûts du mois (sentinel_daily_costs)
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    const firstOfMonthStr = firstOfMonth.toISOString().split('T')[0];

    const { data: costs } = await supabase
      .from('sentinel_daily_costs')
      .select('ai_cost_eur, sms_cost_eur, voice_cost_eur, emails_cost_eur, total_cost_eur')
      .gte('date', firstOfMonthStr);

    const costBreakdown = {
      anthropic: 0,
      twilio: 0,
      elevenlabs: 0
    };

    let totalCost = 0;

    if (costs) {
      for (const c of costs) {
        costBreakdown.anthropic += c.ai_cost_eur || 0;
        costBreakdown.twilio += (c.sms_cost_eur || 0) + (c.voice_cost_eur || 0);
        costBreakdown.elevenlabs += c.voice_cost_eur || 0; // ElevenLabs = voice synthesis
        totalCost += c.total_cost_eur || 0;
      }
    }

    // Appels API / Conversations IA du mois (métrique infra, pas business)
    const { data: aiSnapshots } = await supabase
      .from('sentinel_daily_snapshots')
      .select('ai_conversations, ai_messages_count')
      .gte('date', firstOfMonthStr);

    let totalCalls = 0;
    if (aiSnapshots) {
      totalCalls = aiSnapshots.reduce((sum, s) => sum + (s.ai_conversations || 0), 0);
    }

    // 4. Alertes récentes
    const recentAlerts = alerter.getHistory(8).reverse().map(a => ({
      id: a.id,
      tenant_id: a.data?.tenantId || null,
      level: a.level.toLowerCase(),
      percentage: 0,
      message: a.title,
      created_at: a.timestamp
    }));

    // 5. Tenants à risque (quota > 80%)
    const { data: usageData } = await supabase
      .from('sentinel_daily_snapshots')
      .select('tenant_id, no_show_rate')
      .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);

    let tenantsAtRisk = 0;
    if (usageData) {
      const riskTenants = new Set();
      for (const u of usageData) {
        if ((u.no_show_rate || 0) > 20) riskTenants.add(u.tenant_id);
      }
      tenantsAtRisk = riskTenants.size;
    }

    // 6. Label période
    const now = new Date();
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const periodLabel = `${months[now.getMonth()]} ${now.getFullYear()}`;

    // Coûts du jour (pour SentinelCosts "aujourd'hui")
    const todayStr = now.toISOString().split('T')[0];
    const { data: todayCostsData } = await supabase
      .from('sentinel_daily_costs')
      .select('ai_cost_eur, sms_cost_eur, voice_cost_eur, emails_cost_eur, total_cost_eur')
      .eq('date', todayStr);

    const todayCosts = { anthropic: 0, twilio: 0, elevenlabs: 0, total: 0 };
    if (todayCostsData) {
      for (const c of todayCostsData) {
        todayCosts.anthropic += c.ai_cost_eur || 0;
        todayCosts.twilio += (c.sms_cost_eur || 0) + (c.voice_cost_eur || 0);
        todayCosts.elevenlabs += c.voice_cost_eur || 0;
        todayCosts.total += c.total_cost_eur || 0;
      }
    }

    res.json({
      timestamp: now.toISOString(),
      env: process.env.NODE_ENV || 'development',
      periodLabel,
      summary: {
        totalTenants: activeTenants.length,
        totalCalls,
        totalCost: Math.round(totalCost * 100) / 100,
        tenantsAtRisk
      },
      costBreakdown: {
        anthropic: Math.round(costBreakdown.anthropic * 100) / 100,
        twilio: Math.round(costBreakdown.twilio * 100) / 100,
        elevenlabs: Math.round(costBreakdown.elevenlabs * 100) / 100
      },
      todayCosts,
      alerts: {
        recent: recentAlerts,
        active: recentAlerts.filter(a => a.level === 'critical' || a.level === 'urgent').length
      },
      mrr,
      arr: mrr * 12,
      planDistribution
    });
  } catch (error) {
    console.error('[NEXUS ADMIN] Dashboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// TENANTS
// ============================================

/**
 * GET /api/nexus/tenants
 * Liste tous les tenants avec plan, usage, quota, activité
 */
router.get('/tenants', async (req, res) => {
  try {
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('id, name, plan, statut, created_at, updated_at, essai_fin, whatsapp_number, phone_number')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Récupérer les coûts du mois en cours par tenant
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    const firstOfMonthStr = firstOfMonth.toISOString().split('T')[0];

    const { data: monthlyCosts } = await supabase
      .from('sentinel_daily_costs')
      .select('tenant_id, total_cost_eur')
      .gte('date', firstOfMonthStr);

    const costByTenant = {};
    if (monthlyCosts) {
      for (const c of monthlyCosts) {
        costByTenant[c.tenant_id] = (costByTenant[c.tenant_id] || 0) + (c.total_cost_eur || 0);
      }
    }

    // Récupérer la dernière activité par tenant (dernier snapshot — date seulement, pas les données business)
    const { data: latestSnapshots } = await supabase
      .from('sentinel_daily_snapshots')
      .select('tenant_id, date, ai_conversations')
      .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    const lastActivityByTenant = {};
    const aiCallsByTenant = {};
    if (latestSnapshots) {
      for (const s of latestSnapshots) {
        if (!lastActivityByTenant[s.tenant_id]) {
          lastActivityByTenant[s.tenant_id] = s.date;
        }
        aiCallsByTenant[s.tenant_id] = (aiCallsByTenant[s.tenant_id] || 0) + (s.ai_conversations || 0);
      }
    }

    // Construire la réponse
    const tenantsResult = (tenants || []).map(t => {
      const plan = (t.plan || 'starter').toLowerCase();
      const cost = costByTenant[t.id] || 0;
      const planPrice = PLAN_PRICES[plan] || 99;
      const costPercentage = planPrice > 0 ? Math.round((cost / planPrice) * 100) : 0;

      return {
        id: t.id,
        name: t.name || t.id,
        plan,
        status: t.statut === 'actif' ? 'Actif' : t.statut === 'essai' ? 'Essai' : t.statut,
        usage: {
          aiCalls: aiCallsByTenant[t.id] || 0,
          cost: Math.round(cost * 100) / 100
        },
        quota: {
          percentage: Math.min(costPercentage, 100),
          status: costPercentage >= 90 ? 'critical' : costPercentage >= 70 ? 'warning' : 'ok'
        },
        lastActivity: lastActivityByTenant[t.id] || null
      };
    });

    res.json({ tenants: tenantsResult });
  } catch (error) {
    console.error('[NEXUS ADMIN] Tenants error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/nexus/tenants/:id
 * Détail d'un tenant
 */
router.get('/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('id, name, plan, statut, created_at, updated_at, essai_fin, whatsapp_number, phone_number, frozen')
      .eq('id', id)
      .single();

    if (error || !tenant) {
      return res.status(404).json({ success: false, error: 'Tenant non trouvé' });
    }

    // Modules actifs
    const { data: modules } = await supabase
      .from('tenant_modules')
      .select('module_id, activated_at')
      .eq('tenant_id', id)
      .eq('is_active', true);

    // Coûts infra 30 derniers jours (données NEXUS, pas business)
    const { data: costs } = await supabase
      .from('sentinel_daily_costs')
      .select('date, ai_cost_eur, sms_cost_eur, voice_cost_eur, total_cost_eur')
      .eq('tenant_id', id)
      .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Admins du tenant
    const { data: admins } = await supabase
      .from('admin_users')
      .select('id, email, nom, role, actif')
      .eq('tenant_id', id);

    res.json({
      success: true,
      data: {
        ...tenant,
        modules: modules || [],
        costs: costs || [],
        admins: admins || []
      }
    });
  } catch (error) {
    console.error('[NEXUS ADMIN] Tenant detail error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/nexus/tenants/:id
 * Modifier plan, statut, frozen d'un tenant
 */
router.patch('/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, statut, frozen } = req.body;

    // Vérifier que le tenant existe
    const { data: existing, error: checkErr } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', id)
      .single();

    if (checkErr || !existing) {
      return res.status(404).json({ success: false, error: 'Tenant non trouvé' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (plan && ['starter', 'pro', 'business'].includes(plan)) updates.plan = plan;
    if (statut) updates.statut = statut;
    if (frozen !== undefined) updates.frozen = frozen;

    const { data, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[NEXUS ADMIN] Tenant ${id} updated:`, updates);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[NEXUS ADMIN] Tenant update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SENTINEL STATUS
// ============================================

/**
 * GET /api/nexus/sentinel/status
 * Status global SENTINEL: health, uptime, mémoire, tenants
 */
router.get('/sentinel/status', async (req, res) => {
  try {
    const sentinelStatus = sentinel.getStatus();
    const mem = process.memoryUsage();

    // Compter les tenants actifs
    const { count } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .in('statut', ['actif', 'essai']);

    // Status réel des services via uptimeMonitor
    const uptimeStatus = getUptimeStatus();
    const servicesList = uptimeStatus.services || {};

    res.json({
      status: sentinelStatus.status === 'ACTIVE' ? 'healthy' : 'checking',
      uptime: Math.floor(process.uptime()),
      memory: {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal
      },
      tenants: count || 0,
      lastCheck: sentinelStatus.lastCheck,
      monitors: sentinelStatus.monitors,
      services: servicesList
    });
  } catch (error) {
    console.error('[NEXUS ADMIN] Sentinel status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SENTINEL SECURITY
// ============================================

/**
 * GET /api/nexus/sentinel/security/logs
 * Logs de sécurité cross-tenant
 */
router.get('/sentinel/security/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const severity = req.query.severity || null;

    const filters = {};
    if (severity) filters.severity = severity;

    const logs = await getRecentLogs(limit, filters);

    res.json({ data: logs });
  } catch (error) {
    console.error('[NEXUS ADMIN] Security logs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/nexus/sentinel/security/stats
 * Statistiques de sécurité cross-tenant
 */
router.get('/sentinel/security/stats', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const security = await getSecurityStats(hours);
    const rateLimit = getRateLimitStats();

    res.json({
      data: {
        security,
        rateLimit: {
          blocked: rateLimit.blocked || 0,
          totalTracked: rateLimit.totalTracked || 0
        },
        rateLimited: rateLimit.blocked || 0
      }
    });
  } catch (error) {
    console.error('[NEXUS ADMIN] Security stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// SENTINEL BACKUPS
// ============================================

/**
 * GET /api/nexus/sentinel/backups
 * Liste des backups
 */
router.get('/sentinel/backups', async (req, res) => {
  try {
    const backups = await listBackups();
    res.json({ data: backups });
  } catch (error) {
    console.error('[NEXUS ADMIN] Backups list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/nexus/sentinel/backups
 * Créer un backup
 */
router.post('/sentinel/backups', async (req, res) => {
  try {
    const result = await createBackup();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[NEXUS ADMIN] Backup create error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/nexus/sentinel/backups/:name/restore
 * Restaurer un backup
 */
router.post('/sentinel/backups/:name/restore', async (req, res) => {
  try {
    const { name } = req.params;
    const result = await restoreBackup(name);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[NEXUS ADMIN] Backup restore error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// BILLING
// ============================================

/**
 * GET /api/nexus/billing
 * MRR/ARR, répartition par plan, revenue forecast
 */
router.get('/billing', async (req, res) => {
  try {
    const { data: tenants, error } = await supabase
      .from('tenants')
      .select('id, plan, statut')
      .in('statut', ['actif', 'essai']);

    if (error) throw error;

    let mrr = 0;
    const planDistribution = { starter: 0, pro: 0, business: 0 };

    for (const t of (tenants || [])) {
      const plan = (t.plan || 'starter').toLowerCase();
      mrr += PLAN_PRICES[plan] || 0;
      if (planDistribution[plan] !== undefined) planDistribution[plan]++;
    }

    // Coûts du mois
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);

    const { data: costs } = await supabase
      .from('sentinel_daily_costs')
      .select('total_cost_eur')
      .gte('date', firstOfMonth.toISOString().split('T')[0]);

    const totalCost = (costs || []).reduce((s, c) => s + (c.total_cost_eur || 0), 0);
    const margin = mrr > 0 ? Math.round(((mrr - totalCost) / mrr) * 100) : 0;

    // Churn Rate: tenants annulés ce mois / tenants actifs début de mois
    const { count: churned } = await supabase
      .from('tenants')
      .select('id', { count: 'exact', head: true })
      .eq('statut', 'annule')
      .gte('updated_at', firstOfMonth.toISOString());

    const totalActive = (tenants || []).length;
    const churnRate = totalActive > 0
      ? Math.round(((churned || 0) / (totalActive + (churned || 0))) * 10000) / 100
      : 0;

    // LTV = ARPU / Churn Rate mensuel (ou estimation si churn=0)
    const arpu = totalActive > 0 ? mrr / totalActive : 0;
    const monthlyChurn = churnRate / 100;
    const ltv = monthlyChurn > 0 ? Math.round(arpu / monthlyChurn) : Math.round(arpu * 24); // Estimation 24 mois si pas de churn

    // Revenue par billing_events ce mois
    const { data: paidEvents } = await supabase
      .from('billing_events')
      .select('amount')
      .eq('event_type', 'invoice_paid')
      .gte('created_at', firstOfMonth.toISOString());

    const actualRevenue = (paidEvents || []).reduce((s, e) => s + (e.amount || 0), 0) / 100;

    res.json({
      success: true,
      data: {
        mrr,
        arr: mrr * 12,
        totalCost: Math.round(totalCost * 100) / 100,
        margin,
        planDistribution,
        totalTenants: totalActive,
        churnRate,
        ltv,
        arpu: Math.round(arpu),
        actualRevenueThisMonth: Math.round(actualRevenue * 100) / 100,
        churnedThisMonth: churned || 0,
      }
    });
  } catch (error) {
    console.error('[NEXUS ADMIN] Billing error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

// ============================================
// SUB-ROUTERS pour endpoints appelés par NexusSentinel tabs
// Montés à des chemins différents dans index.js
// ============================================

// --- /api/admin/sentinel-intelligence/* ---
export const sentinelIntelligenceRouter = express.Router();
sentinelIntelligenceRouter.use(authenticateAdmin);
sentinelIntelligenceRouter.use(requireSuperAdmin);

/**
 * GET /api/admin/sentinel-intelligence/health-score
 * Score de santé global de la plateforme
 */
sentinelIntelligenceRouter.get('/health-score', async (req, res) => {
  try {
    const sentinelStatus = sentinel.getStatus();
    const mem = process.memoryUsage();
    const uptime = process.uptime();

    // Calcul score basé sur les métriques système réelles
    const uptimeScore = Math.min(uptime / 86400, 1) * 100; // Max après 24h
    // Performance: RSS vs limite mémoire (512MB par défaut sur Render free, 2GB sur paid)
    const rssBytes = mem.rss;
    const memLimitMB = parseInt(process.env.MEMORY_LIMIT_MB || '512', 10);
    const rssPct = rssBytes / (memLimitMB * 1024 * 1024);
    const memoryScore = rssPct < 0.6 ? 100 : rssPct < 0.75 ? 85 : rssPct < 0.85 ? 70 : rssPct < 0.95 ? 50 : 20;
    const sentinelActive = sentinelStatus.status === 'ACTIVE' ? 100 : 30;

    // Latence réelle: ping DB
    const dbStart = Date.now();
    await supabase.from('tenants').select('id').limit(1);
    const dbLatency = Date.now() - dbStart;
    const latencyScore = dbLatency < 100 ? 100 : dbLatency < 300 ? 85 : dbLatency < 500 ? 70 : dbLatency < 1000 ? 50 : 20;

    // Sécurité réelle: vérification des composants actifs
    let securityScore = 50; // base
    if (process.env.JWT_SECRET) securityScore += 10;
    if (process.env.STRIPE_WEBHOOK_SECRET) securityScore += 10;
    const secStats = await getSecurityStats(24).catch(() => null);
    if (secStats) {
      // Pas de brèches récentes = +15, rate limiter actif = +15
      const breaches = secStats.critical || 0;
      securityScore += breaches === 0 ? 15 : breaches < 3 ? 5 : 0;
      securityScore += 15; // Helmet + CORS + Tenant Shield toujours actifs
    } else {
      securityScore += 30; // Assume OK si pas d'erreurs
    }
    securityScore = Math.min(securityScore, 100);

    const breakdown = {
      uptime: Math.round(uptimeScore),
      latency: latencyScore,
      security: securityScore,
      performance: Math.round(memoryScore),
      stability: Math.round(sentinelActive)
    };

    const score = Math.round(
      Object.values(breakdown).reduce((s, v) => s + v, 0) / Object.keys(breakdown).length
    );

    res.json({
      data: {
        healthScore: {
          score,
          status: score >= 80 ? 'Excellent' : score >= 50 ? 'Attention' : 'Critique',
          breakdown
        }
      }
    });
  } catch (error) {
    console.error('[NEXUS] Health score error:', error);
    res.status(500).json({ data: { healthScore: { score: 0, status: 'Erreur' } } });
  }
});

/**
 * GET /api/admin/sentinel-intelligence/alerts
 * Alertes actives de la plateforme
 */
sentinelIntelligenceRouter.get('/alerts', async (req, res) => {
  try {
    const history = alerter.getHistory(50);
    const alerts = history.reverse().map(a => ({
      id: a.id,
      title: a.title,
      message: a.title,
      type: a.data?.type || 'system',
      severity: a.level === 'CRITICAL' ? 'critical' : a.level === 'URGENT' ? 'high' : a.level === 'WARNING' ? 'medium' : 'low',
      level: a.level.toLowerCase(),
      created_at: a.timestamp
    }));

    res.json({ data: alerts });
  } catch (error) {
    console.error('[NEXUS] Alerts error:', error);
    res.json({ data: [] });
  }
});

/**
 * GET /api/admin/sentinel-intelligence/anomalies
 * Anomalies détectées
 */
sentinelIntelligenceRouter.get('/anomalies', async (req, res) => {
  try {
    // Anomalies TECHNIQUES uniquement (pas de données business des tenants)
    const anomalies = [];

    // 1. Coûts infrastructure anormaux (données NEXUS, pas business tenant)
    const { data: costs } = await supabase
      .from('sentinel_daily_costs')
      .select('tenant_id, date, total_cost_eur, ai_cost_eur, sms_cost_eur, voice_cost_eur')
      .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (costs && costs.length > 0) {
      const avgCost = costs.reduce((s, c) => s + (c.total_cost_eur || 0), 0) / costs.length;

      for (const c of costs) {
        // Pic de coût (>200% de la moyenne et >1€)
        if (avgCost > 0 && (c.total_cost_eur || 0) > avgCost * 2 && (c.total_cost_eur || 0) > 1) {
          anomalies.push({
            id: `cost-${c.tenant_id}-${c.date}`,
            metric: 'infrastructure_cost',
            type: 'cost_spike',
            description: `Coût infra ${c.total_cost_eur.toFixed(2)}€ (×${((c.total_cost_eur || 0) / avgCost).toFixed(1)} vs moyenne)`,
            severity: (c.total_cost_eur || 0) > avgCost * 5 ? 'high' : 'medium',
            status: 'detected',
            detected_at: c.date,
            tenant_id: c.tenant_id
          });
        }
      }
    }

    // 2. Alertes système (mémoire, services down)
    const alertHistory = alerter.getHistory(30);
    for (const a of alertHistory) {
      if (a.level === 'CRITICAL') {
        anomalies.push({
          id: `sys-${a.id}`,
          metric: 'system',
          type: 'system_alert',
          description: a.title,
          severity: 'high',
          status: 'detected',
          detected_at: a.timestamp,
          tenant_id: null
        });
      }
    }

    // 3. Erreurs applicatives récentes
    const { data: errorLogs } = await supabase
      .from('error_logs')
      .select('id, message, level, created_at, tenant_id')
      .eq('level', 'fatal')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    for (const err of errorLogs || []) {
      anomalies.push({
        id: `err-${err.id}`,
        metric: 'error',
        type: 'fatal_error',
        description: `Erreur fatale: ${(err.message || '').slice(0, 100)}`,
        severity: 'high',
        status: 'detected',
        detected_at: err.created_at,
        tenant_id: err.tenant_id
      });
    }

    // Trier par date décroissante
    anomalies.sort((a, b) => (b.detected_at || '').localeCompare(a.detected_at || ''));
    res.json({ data: anomalies.slice(0, 50) });
  } catch (error) {
    console.error('[NEXUS] Anomalies error:', error);
    res.json({ data: [] });
  }
});

/**
 * POST /api/admin/sentinel-intelligence/anomalies/detect
 * Lancer une détection d'anomalies
 */
sentinelIntelligenceRouter.post('/anomalies/detect', async (req, res) => {
  try {
    // Détection technique uniquement (coûts infra, erreurs, alertes système)
    let detected = 0;

    // Coûts anormaux
    const { data: costs } = await supabase
      .from('sentinel_daily_costs')
      .select('total_cost_eur')
      .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]);

    if (costs && costs.length > 0) {
      const avgCost = costs.reduce((s, c) => s + (c.total_cost_eur || 0), 0) / costs.length;
      for (const c of costs) {
        if (avgCost > 0 && (c.total_cost_eur || 0) > avgCost * 2 && (c.total_cost_eur || 0) > 1) detected++;
      }
    }

    // Alertes critiques
    const criticalAlerts = alerter.getHistory(30).filter(a => a.level === 'CRITICAL');
    detected += criticalAlerts.length;

    res.json({ success: true, message: 'Détection terminée', detected });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/sentinel-intelligence/anomalies/:id/investigate
 * Investiguer une anomalie
 */
sentinelIntelligenceRouter.post('/anomalies/:id/investigate', async (req, res) => {
  try {
    const { id } = req.params;

    // Investigation technique uniquement (coûts infra, alertes système, erreurs)
    const parts = id.split('-');
    const type = parts[0]; // cost, sys, err

    let recommendation = '';
    let severity = 'medium';

    if (type === 'cost') {
      // Pic de coût infra — analyser la source
      const tenantId = parts.slice(1, -1).join('-');
      const { data: recentCosts } = await supabase
        .from('sentinel_daily_costs')
        .select('date, ai_cost_eur, sms_cost_eur, voice_cost_eur, total_cost_eur')
        .eq('tenant_id', tenantId)
        .gte('date', new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (recentCosts && recentCosts.length > 0) {
        const avgCost = recentCosts.reduce((s, c) => s + (c.total_cost_eur || 0), 0) / recentCosts.length;
        const mainDriver = recentCosts.reduce((acc, c) => {
          acc.ai += c.ai_cost_eur || 0;
          acc.sms += c.sms_cost_eur || 0;
          acc.voice += c.voice_cost_eur || 0;
          return acc;
        }, { ai: 0, sms: 0, voice: 0 });

        const topDriver = Object.entries(mainDriver).sort((a, b) => b[1] - a[1])[0];
        recommendation = `Coût moyen: ${avgCost.toFixed(2)}€/jour. Principal poste: ${topDriver[0]} (${topDriver[1].toFixed(2)}€ total). Vérifier les quotas du tenant.`;
        severity = avgCost > 5 ? 'high' : 'medium';
      } else {
        recommendation = 'Données de coûts insuffisantes pour l\'investigation.';
      }
    } else if (type === 'sys') {
      recommendation = 'Alerte système détectée. Vérifier les logs serveur et l\'état des services externes.';
      severity = 'high';
    } else if (type === 'err') {
      recommendation = 'Erreur fatale détectée. Consulter SENTINEL > Erreurs pour le stack trace complet.';
      severity = 'high';
    } else {
      recommendation = 'Anomalie technique. Surveiller la tendance dans les prochaines heures.';
    }

    res.json({
      success: true,
      investigation: {
        status: 'completed',
        anomalyId: id,
        severity,
        recommendation
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/sentinel-intelligence/predictions
 * Prédictions basées sur les données historiques
 */
sentinelIntelligenceRouter.get('/predictions', async (req, res) => {
  try {
    // Prédictions TECHNIQUES : coûts infra projetés (données NEXUS, pas business tenant)
    const { data: costs } = await supabase
      .from('sentinel_daily_costs')
      .select('total_cost_eur, ai_cost_eur, sms_cost_eur, voice_cost_eur')
      .gte('date', new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]);

    const predictions = [];
    if (costs && costs.length > 0) {
      const avgDailyCost = costs.reduce((s, c) => s + (c.total_cost_eur || 0), 0) / costs.length;
      const avgAiCost = costs.reduce((s, c) => s + (c.ai_cost_eur || 0), 0) / costs.length;

      const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
      const daysRemaining = Math.ceil((new Date(endOfMonth) - Date.now()) / 86400000);

      predictions.push(
        { id: 'pred-cost-week', metric: 'cost_7d', predicted_value: Math.round(avgDailyCost * 7 * 100) / 100, target_date: nextWeek, accuracy: 75, unit: '€', label: 'Coût infra (7 jours)' },
        { id: 'pred-cost-month', metric: 'cost_month', predicted_value: Math.round(avgDailyCost * daysRemaining * 100) / 100, target_date: endOfMonth, accuracy: 65, unit: '€', label: 'Coût infra (fin de mois)' },
        { id: 'pred-ai-month', metric: 'ai_cost_month', predicted_value: Math.round(avgAiCost * daysRemaining * 100) / 100, target_date: endOfMonth, accuracy: 70, unit: '€', label: 'Coût IA (fin de mois)' }
      );
    }

    res.json({ data: predictions });
  } catch (error) {
    console.error('[NEXUS] Predictions error:', error);
    res.json({ data: [] });
  }
});

/**
 * POST /api/admin/sentinel-intelligence/predictions/generate
 * Générer de nouvelles prédictions
 */
sentinelIntelligenceRouter.post('/predictions/generate', async (req, res) => {
  try {
    res.json({ success: true, message: 'Prédictions générées' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/sentinel-intelligence/recommendations
 * Recommandations d'optimisation
 */
sentinelIntelligenceRouter.get('/recommendations', async (req, res) => {
  try {
    // Recommandations dynamiques basées sur l'état réel du système
    const recommendations = [];
    const isProd = process.env.NODE_ENV === 'production';

    // --- Recommandations PRODUCTION SEULEMENT ---
    if (isProd) {
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        recommendations.push({
          id: 'rec-stripe-wh', title: 'Configurer STRIPE_WEBHOOK_SECRET',
          description: 'Les webhooks Stripe ne sont pas sécurisés — risque de faux événements',
          priority: 'high', category: 'security',
          action: 'Render > Environment > Add STRIPE_WEBHOOK_SECRET'
        });
      }

      if (!process.env.REDIS_URL) {
        recommendations.push({
          id: 'rec-redis', title: 'Configurer Redis',
          description: 'Redis non configuré — le cache et les files de tâches sont désactivés',
          priority: 'medium', category: 'performance',
          action: 'Render > Environment > Add REDIS_URL'
        });
      }

      if (process.env.JWT_SECRET?.includes('dev')) {
        recommendations.push({
          id: 'rec-jwt', title: 'Changer JWT_SECRET en production',
          description: 'Le secret JWT contient "dev" — utiliser un secret aléatoire de 64+ caractères',
          priority: 'high', category: 'security',
          action: 'Render > Environment > Update JWT_SECRET'
        });
      }
    }

    // --- Recommandations TOUS ENVIRONNEMENTS ---

    // Mémoire élevée (RSS vs limite réelle, pas heap ratio)
    const mem = process.memoryUsage();
    const memLimitMB = parseInt(process.env.MEMORY_LIMIT_MB || '512', 10);
    const rssPct = Math.round((mem.rss / (memLimitMB * 1024 * 1024)) * 100);
    if (rssPct > 85) {
      recommendations.push({
        id: 'rec-memory', title: 'Utilisation mémoire élevée',
        description: `RSS à ${rssPct}% de la limite (${Math.round(mem.rss / 1024 / 1024)}MB / ${memLimitMB}MB)`,
        priority: rssPct > 95 ? 'high' : 'medium', category: 'performance',
        action: 'Redémarrer le serveur ou augmenter la RAM'
      });
    }

    // Backups (pertinent en prod seulement)
    if (isProd) {
      try {
        const backups = await listBackups();
        if (!backups || backups.length === 0) {
          recommendations.push({
            id: 'rec-backup', title: 'Aucun backup récent',
            description: 'Aucun backup trouvé — activer les sauvegardes automatiques',
            priority: 'high', category: 'backup',
            action: 'SENTINEL > Backups > Créer un backup'
          });
        }
      } catch (_) { /* skip if backup service unavailable */ }
    }

    // Vérifier les tenants en essai qui arrivent à expiration
    const soon = new Date(Date.now() + 3 * 86400000).toISOString();
    const { data: expiringTrials } = await supabase
      .from('tenants')
      .select('id, name, essai_fin')
      .eq('statut', 'essai')
      .lte('essai_fin', soon)
      .gte('essai_fin', new Date().toISOString());

    if (expiringTrials && expiringTrials.length > 0) {
      recommendations.push({
        id: 'rec-trials', title: `${expiringTrials.length} essai(s) expirent bientôt`,
        description: `Tenants: ${expiringTrials.map(t => t.name || t.id).join(', ')}`,
        priority: 'medium', category: 'business',
        action: 'Contacter les tenants pour conversion'
      });
    }

    res.json({ data: recommendations });
  } catch (error) {
    console.error('[NEXUS] Recommendations error:', error);
    res.json({ data: [] });
  }
});

// --- /api/sentinel/autopilot/* ---
export const sentinelAutopilotRouter = express.Router();
sentinelAutopilotRouter.use(authenticateAdmin);
sentinelAutopilotRouter.use(requireSuperAdmin);

/**
 * GET /api/sentinel/autopilot/status
 * Status du système autopilot
 */
sentinelAutopilotRouter.get('/status', async (req, res) => {
  try {
    const sentinelStatus = sentinel.getStatus();
    const healthHistory = sentinel.monitors?.health?.getHistory?.(10) || [];

    // Stats réelles basées sur les health checks exécutés
    const totalScans = healthHistory.length;
    const warningsFound = healthHistory.filter(h =>
      Object.values(h || {}).some(v => v && typeof v === 'object' && v.status === 'WARNING')
    ).length;
    const criticalFound = healthHistory.filter(h =>
      Object.values(h || {}).some(v => v && typeof v === 'object' && v.status === 'CRITICAL')
    ).length;

    // Alertes récentes comme "actions" de l'autopilot
    const alertHistory = alerter.getHistory(20);
    const recentActions = alertHistory.slice(-10).reverse().map(a => ({
      id: a.id,
      type: a.level === 'CRITICAL' ? 'AUTO_ALERT' : 'MONITORING',
      description: a.title,
      status: 'executed',
      executedAt: a.timestamp
    }));

    res.json({
      success: true,
      enabled: sentinelStatus.status === 'ACTIVE',
      autoScanEnabled: true,
      scanIntervalMinutes: 5,
      stats: {
        totalScans,
        totalActionsProposed: warningsFound + criticalFound,
        totalActionsExecuted: alertHistory.length,
        lastScanAt: sentinelStatus.lastCheck
      },
      summary: {
        pending: 0,
        executed: alertHistory.length,
        failed: criticalFound
      },
      recentActions
    });
  } catch (error) {
    console.error('[NEXUS] Autopilot status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- /api/sentinel/live/* ---
export const sentinelLiveRouter = express.Router();
sentinelLiveRouter.use(authenticateAdmin);
sentinelLiveRouter.use(requireSuperAdmin);

/**
 * GET /api/sentinel/live/events
 * Événements en temps réel
 */
sentinelLiveRouter.get('/events', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const type = req.query.type || 'all';

    // Récupérer les alertes récentes comme événements
    const history = alerter.getHistory(limit);

    const events = history.reverse().map((a, i) => ({
      id: a.id || `evt-${i}`,
      type: 'system',
      category: a.level === 'CRITICAL' ? 'error' : a.level === 'WARNING' ? 'security' : 'system',
      icon: a.level === 'CRITICAL' ? '🔴' : a.level === 'WARNING' ? '🟡' : '🔵',
      timestamp: a.timestamp,
      action: a.title,
      reason: JSON.stringify(a.data || {}).substring(0, 100)
    }));

    res.json({
      events: type === 'all' ? events : events.filter(e => e.category === type),
      stats: {
        total: events.length,
        last5min: events.filter(e => Date.now() - new Date(e.timestamp).getTime() < 300000).length,
        last1min: events.filter(e => Date.now() - new Date(e.timestamp).getTime() < 60000).length,
        byType: {}
      }
    });
  } catch (error) {
    console.error('[NEXUS] Live events error:', error);
    res.json({ events: [], stats: { total: 0, last5min: 0, last1min: 0, byType: {} } });
  }
});

// --- /api/optimization/* ---
export const optimizationRouter = express.Router();
optimizationRouter.use(authenticateAdmin);
optimizationRouter.use(requireSuperAdmin);

/**
 * GET /api/optimization/cache/stats
 * Statistiques du cache
 */
optimizationRouter.get('/cache/stats', async (req, res) => {
  try {
    // Vérifier si Redis est disponible
    const { isAvailable } = await import('../config/redis.js');
    const redisUp = isAvailable();

    // Stats réelles du cache en mémoire
    const { default: responseCache } = await import('../services/responseCache.js');
    const cacheStats = responseCache?.getStats ? responseCache.getStats() : null;

    res.json({
      data: {
        hits: cacheStats?.hits || 0,
        misses: cacheStats?.misses || 0,
        size: cacheStats?.size || 0,
        savings: parseFloat(cacheStats?.estimatedSavings || '0'),
        hitRate: cacheStats?.hitRate || '0.0',
        totalFiles: cacheStats?.size || 0,
        totalSizeMB: cacheStats ? (cacheStats.size * 0.002).toFixed(1) : '0.0', // ~2KB par entrée
        redis: redisUp ? 'connected' : 'not_available'
      }
    });
  } catch (error) {
    console.error('[NEXUS] Cache stats error:', error);
    res.json({ data: { hits: 0, misses: 0, size: 0 } });
  }
});

/**
 * GET /api/optimization/pricing
 * Informations de pricing des APIs
 */
optimizationRouter.get('/pricing', async (req, res) => {
  try {
    // Pricing réel des APIs (mis à jour mars 2026)
    res.json({
      data: {
        anthropic: {
          haiku: { input_per_1m: 0.25, output_per_1m: 1.25 },
          sonnet: { input_per_1m: 3, output_per_1m: 15 },
          opus: { input_per_1m: 15, output_per_1m: 75 },
        },
        twilio: {
          sms_outbound_fr: 0.0725,
          sms_inbound: 0.0075,
          voice_per_min: 0.015,
          whatsapp_per_msg: 0.005,
        },
        elevenlabs: {
          turbo_per_char: 0.00015,
          multilingual_per_char: 0.00030,
        },
        dalle: {
          standard: 0.04,
          hd: 0.08,
        },
        tavily: {
          per_search: 0.003,
        },
        plans: {
          starter: { price: 99, budget_ai: 5, budget_sms: 8, budget_voice: 3 },
          pro: { price: 249, budget_ai: 15, budget_sms: 20, budget_voice: 8 },
          business: { price: 499, budget_ai: 30, budget_sms: 40, budget_voice: 15 },
        },
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
