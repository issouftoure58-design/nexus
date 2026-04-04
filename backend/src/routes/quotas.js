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
 * ║   POST /api/quotas/request-activation - Demande activation module        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { quotaManager, MODULE_QUOTAS } from '../services/quotaManager.js';
import { authenticateAdmin } from './adminAuth.js';
import { supabase } from '../config/supabase.js';
import { sendEmail } from '../services/emailService.js';

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

    // Récupérer le plan, modules actifs et statut du tenant
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('plan, modules_actifs, statut')
      .eq('id', tenantId)
      .single();
    // ═══ ESSAI: quotas Starter (pas ceux du plan choisi) ═══
    const plan = tenantRow?.statut === 'essai' ? 'starter' : (tenantRow?.plan || 'starter');

    // Récupérer les demandes d'activation en cours
    const { data: pendingReqs } = await supabase
      .from('module_activation_requests')
      .select('module_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending');

    const status = await quotaManager.getQuotaStatus(tenantId, plan);

    // Calculer la prochaine date de reset (1er du mois prochain)
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);
    resetDate.setDate(1);
    resetDate.setHours(0, 0, 0, 0);

    res.json({
      success: true,
      ...status,
      modulesActifs: tenantRow?.modules_actifs || {},
      pendingActivations: (pendingReqs || []).map(r => r.module_id),
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

// Modules accessibles par plan (pour vérifier l'éligibilité)
const PLAN_MODULES = {
  starter: ['sms_rdv', 'web_chat_ia'],
  pro: ['telephone_ia', 'sms_rdv', 'whatsapp_ia', 'web_chat_ia'],
  business: ['telephone_ia', 'sms_rdv', 'whatsapp_ia', 'web_chat_ia', 'marketing_email'],
};

/**
 * POST /api/quotas/request-activation
 * Demande l'activation d'un module (canal) pour le tenant
 */
router.post('/request-activation', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { moduleId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID requis' });
    }

    if (!moduleId) {
      return res.status(400).json({ success: false, error: 'moduleId requis' });
    }

    // Vérifier que le module existe
    if (!MODULE_QUOTAS[moduleId]) {
      return res.status(404).json({ success: false, error: `Module inconnu: ${moduleId}` });
    }

    // Récupérer le plan et statut du tenant
    const { data: tenantRow } = await supabase
      .from('tenants')
      .select('plan, name, statut')
      .eq('id', tenantId)
      .single();

    // ═══ ESSAI: bloquer les demandes d'activation ═══
    if (tenantRow?.statut === 'essai') {
      return res.status(403).json({
        success: false,
        error: 'Souscrivez à un plan payant pour activer ce module',
        code: 'TRIAL_RESTRICTION',
      });
    }

    const plan = tenantRow?.plan || 'starter';

    // Vérifier que le module est inclus dans le plan
    const allowedModules = PLAN_MODULES[plan] || PLAN_MODULES.starter;
    if (!allowedModules.includes(moduleId)) {
      return res.status(403).json({
        success: false,
        error: 'Ce module n\'est pas disponible dans votre plan',
      });
    }

    // Vérifier qu'il n'y a pas déjà une demande pending
    const { data: existing } = await supabase
      .from('module_activation_requests')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('module_id', moduleId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Une demande d\'activation est déjà en cours pour ce module',
      });
    }

    // Supprimer les anciennes demandes traitées pour ce module (approved/rejected)
    await supabase
      .from('module_activation_requests')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('module_id', moduleId)
      .neq('status', 'pending');

    // Insérer la demande
    const { error: insertError } = await supabase
      .from('module_activation_requests')
      .insert({
        tenant_id: tenantId,
        module_id: moduleId,
        status: 'pending',
      });

    if (insertError) {
      console.error('[QUOTAS] Erreur insert activation request:', insertError.message);
      return res.status(500).json({ success: false, error: 'Erreur lors de la demande' });
    }

    // Envoyer un email de notification à l'équipe
    const moduleName = MODULE_QUOTAS[moduleId]?.name || moduleId;
    const tenantName = tenantRow?.name || tenantId;
    await sendEmail({
      to: 'contact@nexus-ai-saas.com',
      subject: `[NEXUS] Demande d'activation: ${moduleName} — ${tenantName}`,
      html: `
        <h2>Nouvelle demande d'activation</h2>
        <p><strong>Tenant:</strong> ${tenantName} (${tenantId})</p>
        <p><strong>Plan:</strong> ${plan}</p>
        <p><strong>Module:</strong> ${moduleName} (${moduleId})</p>
        <p>Connectez-vous au back-office pour traiter cette demande.</p>
      `,
    }).catch(err => {
      console.error('[QUOTAS] Erreur envoi email activation:', err.message);
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[QUOTAS] Erreur request-activation:', error.message);
    res.status(500).json({ success: false, error: error.message });
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
