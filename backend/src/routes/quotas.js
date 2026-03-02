/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║   ROUTES QUOTAS - Gestion des quotas et facturation dépassement           ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║   GET  /api/quotas              - Statut complet des quotas               ║
 * ║   GET  /api/quotas/modules      - Liste modules avec prix et quotas       ║
 * ║   GET  /api/quotas/usage        - Usage détaillé du mois                  ║
 * ║   GET  /api/quotas/check/:id    - Vérifie quota avant action              ║
 * ║   GET  /api/quotas/overage      - Calcul des dépassements                 ║
 * ║   GET  /api/quotas/pricing      - Grille tarifaire complète               ║
 * ║   POST /api/quotas/increment    - Incrémente usage (admin)                ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { quotaManager, MODULE_QUOTAS } from '../services/quotaManager.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// 🔒 Toutes les routes quotas nécessitent une auth admin
// (sauf /pricing et /modules qui sont informationnels)
router.use(authenticateAdmin);

/**
 * Middleware pour extraire le tenantId depuis l'admin authentifié
 */
const getTenantId = (req) => {
  return req.admin?.tenant_id;
};

/**
 * GET /api/quotas
 * Statut complet des quotas pour le tenant courant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID requis',
      });
    }

    const status = await quotaManager.getQuotaStatus(tenantId);

    // Calculer la prochaine date de reset (1er du mois prochain)
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);
    resetDate.setDate(1);
    resetDate.setHours(0, 0, 0, 0);

    res.json({
      success: true,
      ...status,
      resetDate: resetDate.toISOString(),
      resetInDays: Math.ceil((resetDate - new Date()) / (1000 * 60 * 60 * 24)),
    });
  } catch (error) {
    console.error('[QUOTAS] Erreur status:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/quotas/modules
 * Liste tous les modules avec leurs quotas et prix
 */
router.get('/modules', (req, res) => {
  const modules = Object.entries(MODULE_QUOTAS).map(([id, quota]) => ({
    id,
    name: quota.name,
    basePrice: quota.basePrice,
    unit: quota.unit,
    unlimited: quota.unlimited || false,
    included: quota.included,
    overage: quota.overage,
    description: getModuleDescription(id),
  }));

  res.json({
    success: true,
    modules,
    currency: 'EUR',
  });
});

/**
 * GET /api/quotas/usage
 * Usage détaillé pour le tenant courant
 */
router.get('/usage', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID requis',
      });
    }

    const usage = await quotaManager.getCurrentUsage(tenantId);
    const overage = await quotaManager.calculateOverage(tenantId);

    res.json({
      success: true,
      usage,
      overage,
    });
  } catch (error) {
    console.error('[QUOTAS] Erreur usage:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/quotas/check/:moduleId
 * Vérifie si le quota permet une action
 */
router.get('/check/:moduleId', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { moduleId } = req.params;
    const { metric, amount } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID requis',
      });
    }

    const quota = MODULE_QUOTAS[moduleId];
    if (!quota) {
      return res.status(404).json({
        success: false,
        error: `Module inconnu: ${moduleId}`,
      });
    }

    const check = await quotaManager.checkQuota(
      tenantId,
      moduleId,
      metric || quota.unit,
      parseInt(amount) || 1
    );

    res.json({
      success: true,
      moduleId,
      moduleName: quota.name,
      ...check,
    });
  } catch (error) {
    console.error('[QUOTAS] Erreur check:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/quotas/overage
 * Calcul du dépassement pour le tenant courant
 */
router.get('/overage', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID requis',
      });
    }

    const overage = await quotaManager.calculateOverage(tenantId);

    res.json({
      success: true,
      tenantId,
      ...overage,
    });
  } catch (error) {
    console.error('[QUOTAS] Erreur overage:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/quotas/increment
 * Incrémente manuellement l'usage (pour tests ou corrections)
 */
router.post('/increment', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { moduleId, metric, amount } = req.body;

    if (!tenantId || !moduleId || !metric) {
      return res.status(400).json({
        success: false,
        error: 'tenantId, moduleId et metric requis',
      });
    }

    const quota = MODULE_QUOTAS[moduleId];
    if (!quota) {
      return res.status(404).json({
        success: false,
        error: `Module inconnu: ${moduleId}`,
      });
    }

    const success = await quotaManager.incrementUsage(
      tenantId,
      moduleId,
      metric,
      parseInt(amount) || 1
    );

    if (success) {
      const newStatus = await quotaManager.checkQuota(tenantId, moduleId, metric);
      res.json({
        success: true,
        message: `Usage incrémenté: ${moduleId}.${metric} +${amount || 1}`,
        newStatus,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'incrémentation',
      });
    }
  } catch (error) {
    console.error('[QUOTAS] Erreur increment:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/quotas/pricing
 * Prix complet avec tous les modules
 */
router.get('/pricing', (req, res) => {
  const pricing = {
    modules: Object.entries(MODULE_QUOTAS).map(([id, quota]) => ({
      id,
      name: quota.name,
      basePrice: quota.basePrice,
      unlimited: quota.unlimited || false,
      included: quota.included,
      overageRates: quota.overage,
      description: getModuleDescription(id),
      category: getModuleCategory(id),
    })),
    currency: 'EUR',
    billingCycle: 'monthly',
    overageInfo: 'Les dépassements sont facturés automatiquement en fin de mois',
  };

  res.json({
    success: true,
    ...pricing,
  });
});

/**
 * GET /api/quotas/summary
 * Résumé rapide pour dashboard
 */
router.get('/summary', async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID requis',
      });
    }

    const status = await quotaManager.getQuotaStatus(tenantId);

    // Résumé simplifié
    const summary = {
      totalOverage: status.totalOverage,
      modulesAtRisk: [],
      modulesExceeded: [],
    };

    for (const [moduleId, module] of Object.entries(status.modules)) {
      for (const [metric, data] of Object.entries(module.metrics || {})) {
        if (data.status === 'exceeded') {
          summary.modulesExceeded.push({
            moduleId,
            name: module.name,
            metric,
            excess: data.excess,
            overageCost: data.overageCost,
          });
        } else if (data.status === 'warning') {
          summary.modulesAtRisk.push({
            moduleId,
            name: module.name,
            metric,
            percentage: data.percentage,
            remaining: data.remaining,
          });
        }
      }
    }

    res.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error('[QUOTAS] Erreur summary:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Descriptions des modules
 */
function getModuleDescription(moduleId) {
  const descriptions = {
    telephone_ia: 'Agent IA qui répond au téléphone, prend les RDV et répond aux questions. 300 minutes incluses.',
    whatsapp_ia: 'Agent IA sur WhatsApp pour répondre aux clients 24/7. 1500 messages inclus.',
    web_chat_ia: 'Chat IA intégré sur votre site web. 800 sessions incluses.',
    sms_rdv: 'Rappels SMS automatiques pour vos rendez-vous. 200 SMS inclus.',
    marketing_email: 'Campagnes email marketing automatisées. 5000 emails inclus.',
    comptabilite: 'Gestion comptable, factures, devis, TVA. Usage illimité.',
    stock: 'Gestion des stocks et inventaires. Usage illimité.',
    rh: 'Gestion RH, planning, congés, paie. Usage illimité.',
    crm: 'Gestion relation client, suivi prospects. Usage illimité.',
    site_web: 'Site web professionnel clé en main. Usage illimité.',
    seo: 'Optimisation référencement Google. Usage illimité.',
    reservations: 'Système de réservation en ligne. Usage illimité.',
  };

  return descriptions[moduleId] || '';
}

/**
 * Catégories des modules
 */
function getModuleCategory(moduleId) {
  const categories = {
    telephone_ia: 'communication',
    whatsapp_ia: 'communication',
    web_chat_ia: 'communication',
    sms_rdv: 'communication',
    marketing_email: 'marketing',
    comptabilite: 'gestion',
    stock: 'gestion',
    rh: 'gestion',
    crm: 'commercial',
    site_web: 'web',
    seo: 'marketing',
    reservations: 'commercial',
  };

  return categories[moduleId] || 'autre';
}

export default router;
