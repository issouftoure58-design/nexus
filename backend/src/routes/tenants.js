/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES TENANTS - Configuration et infos tenant                   ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║   GET  /api/tenants/me              - Info tenant actuel           ║
 * ║   PATCH /api/tenants/me/branding    - Modifier branding           ║
 * ║   GET  /api/tenants/modules/available - Modules disponibles       ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// ══════════════════════════════════════════════════════════════════════════════
// QUOTAS PAR DÉFAUT SELON PLAN
// ══════════════════════════════════════════════════════════════════════════════

const DEFAULT_QUOTAS = {
  starter: {
    clients_max: 1000,
    storage_gb: 2,
    posts_ia_month: 100,
    images_ia_month: 100,
    reservations_month: 500,
    messages_ia_month: 1000,
  },
  pro: {
    clients_max: 3000,
    storage_gb: 10,
    posts_ia_month: 500,
    images_ia_month: 500,
    reservations_month: 2000,
    messages_ia_month: 5000,
  },
  business: {
    clients_max: -1,
    storage_gb: 50,
    posts_ia_month: 2000,
    images_ia_month: 2000,
    reservations_month: -1,
    messages_ia_month: -1,
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// MODULES DISPONIBLES
// ══════════════════════════════════════════════════════════════════════════════

const AVAILABLE_MODULES = [
  {
    id: 'agent_ia_web',
    name: 'Agent IA Web Chat',
    description: 'Assistant conversationnel sur votre site web',
    price: 19,
    requiredPlan: 'starter',
  },
  {
    id: 'agent_ia_whatsapp',
    name: 'Agent IA WhatsApp',
    description: 'Réponses automatiques sur WhatsApp Business',
    price: 49,
    requiredPlan: 'starter',
  },
  {
    id: 'agent_ia_telephone',
    name: 'Agent IA Téléphone',
    description: 'Standard téléphonique automatisé',
    price: 79,
    requiredPlan: 'pro',
  },
  {
    id: 'salon',
    name: 'Module Salon/Beauté',
    description: 'Gestion spécialisée pour salons de coiffure et beauté',
    price: 49,
    requiredPlan: 'starter',
  },
  {
    id: 'restaurant',
    name: 'Module Restaurant',
    description: 'Gestion spécialisée pour restaurants et traiteurs',
    price: 49,
    requiredPlan: 'starter',
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/tenants/me - Info tenant actuel
// ══════════════════════════════════════════════════════════════════════════════

router.get('/me', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID manquant',
        code: 'TENANT_ID_MISSING',
      });
    }

    console.log(`[TENANTS] GET /me - tenant_id: ${tenantId}`);

    // Récupérer le tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error('[TENANTS] Tenant not found:', tenantId, tenantError?.message);
      return res.status(404).json({
        success: false,
        error: 'Tenant non trouvé',
        code: 'TENANT_NOT_FOUND',
      });
    }

    // Déterminer le plan
    const plan = tenant.plan_id || 'starter';

    // Construire les quotas (merge défaut + custom)
    const quotas = {
      ...DEFAULT_QUOTAS[plan] || DEFAULT_QUOTAS.starter,
      ...(tenant.quotas || {}),
    };

    // Construire la réponse
    const response = {
      success: true,
      tenant: {
        id: tenant.id,
        slug: tenant.id, // Le slug est l'ID pour l'instant
        name: tenant.name || tenant.nom_commercial || 'NEXUS',
        plan: plan,
        modules: tenant.modules_actifs || {},
        branding: {
          logo: tenant.logo_url || null,
          primaryColor: tenant.couleur_primaire || '#0EA5E9',
          secondaryColor: tenant.couleur_secondaire || '#6366F1',
          favicon: tenant.favicon_url || null,
        },
        quotas: quotas,
        statut: tenant.statut || 'actif',
        essai_fin: tenant.essai_fin || null,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('[TENANTS] Erreur GET /me:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur',
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PATCH /api/tenants/me/branding - Modifier branding
// ══════════════════════════════════════════════════════════════════════════════

router.patch('/me/branding', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID manquant',
      });
    }

    const { logo, primaryColor, secondaryColor, favicon } = req.body;

    console.log(`[TENANTS] PATCH /me/branding - tenant_id: ${tenantId}`);

    // Construire les updates
    const updates = {};
    if (logo !== undefined) updates.logo_url = logo;
    if (primaryColor !== undefined) updates.couleur_primaire = primaryColor;
    if (secondaryColor !== undefined) updates.couleur_secondaire = secondaryColor;
    if (favicon !== undefined) updates.favicon_url = favicon;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucune donnée à mettre à jour',
      });
    }

    updates.updated_at = new Date().toISOString();

    // Mettre à jour le tenant
    const { data: tenant, error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('[TENANTS] Update error:', error);
      throw error;
    }

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        slug: tenant.id,
        name: tenant.name || tenant.nom_commercial || 'NEXUS',
        branding: {
          logo: tenant.logo_url,
          primaryColor: tenant.couleur_primaire,
          secondaryColor: tenant.couleur_secondaire,
          favicon: tenant.favicon_url,
        },
      },
    });
  } catch (error) {
    console.error('[TENANTS] Erreur PATCH /me/branding:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur',
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/tenants/modules/available - Modules disponibles
// ══════════════════════════════════════════════════════════════════════════════

router.get('/modules/available', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID manquant',
      });
    }

    // Récupérer le tenant pour connaître son plan
    const { data: tenant } = await supabase
      .from('tenants')
      .select('plan_id, modules_actifs')
      .eq('id', tenantId)
      .single();

    const currentPlan = tenant?.plan_id || 'starter';
    const activeModules = tenant?.modules_actifs || {};

    // Enrichir les modules avec leur statut
    const modules = AVAILABLE_MODULES.map(mod => ({
      ...mod,
      active: activeModules[mod.id] === true,
      available: isPlanSufficient(currentPlan, mod.requiredPlan),
    }));

    res.json({
      success: true,
      modules,
      currentPlan,
    });
  } catch (error) {
    console.error('[TENANTS] Erreur GET /modules/available:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur',
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function isPlanSufficient(currentPlan, requiredPlan) {
  const planOrder = ['starter', 'pro', 'business'];
  const currentIndex = planOrder.indexOf(currentPlan);
  const requiredIndex = planOrder.indexOf(requiredPlan);
  return currentIndex >= requiredIndex;
}

export default router;
