/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ADMIN PROFILE ROUTES
 * Routes pour la gestion du profil métier
 * ═══════════════════════════════════════════════════════════════════════════
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import { loadProfile, listProfiles, changeProfileTenant } from '../profiles/index.js';
import { supabase } from '../config/supabase.js';
// V2 - Multi-tenant business info
import { getBusinessInfoSync, hasFeature, getTerminology } from '../services/tenantBusinessService.js';
import { BUSINESS_TYPES } from '../config/businessTypes.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification admin
router.use(authenticateAdmin);

/**
 * GET /api/admin/profile
 * Récupérer le profil métier du tenant actuel
 * V2: Inclut les infos business enrichies (business_type, features, etc.)
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Charger le profil existant
    let profile = await loadProfile(tenantId);

    if (!profile) {
      profile = getDefaultBusinessProfile();
    }

    // V2 - Enrichir avec les infos du tenant
    try {
      const businessInfo = getBusinessInfoSync(tenantId);
      const businessType = businessInfo.business_type || 'service_domicile';
      const businessTypeConfig = BUSINESS_TYPES[businessType] || BUSINESS_TYPES.service_domicile;

      // Enrichir le profil avec les infos V2
      profile = {
        ...profile,
        // Infos tenant
        tenantId,
        businessType,
        businessTypeName: businessTypeConfig?.label || businessType,
        businessInfo: {
          nom: businessInfo.nom,
          gerant: businessInfo.gerant,
          adresse: businessInfo.adresse,
          telephone: businessInfo.telephone,
          email: businessInfo.email,
          assistant_name: businessInfo.assistant_name,
        },
        // Features flags
        features: businessInfo.features || {},
        // Terminologie V2
        terminology: {
          ...profile.terminology,
          reservation: businessTypeConfig?.terminology?.reservation || profile.terminology?.reservation,
          service: businessTypeConfig?.terminology?.service || profile.terminology?.service,
          client: businessTypeConfig?.terminology?.client || profile.terminology?.client,
          employee: businessTypeConfig?.terminology?.employee || profile.terminology?.employee,
        },
        // Règles métier V2
        businessRules: businessTypeConfig?.businessRules || {},
        // Champs requis/interdits V2
        fieldConfig: businessTypeConfig?.fieldConfig || {},
      };

      console.log(`[ADMIN PROFILE] ✓ Profil enrichi pour ${tenantId} (${businessType})`);
    } catch (businessInfoError) {
      console.warn('[ADMIN PROFILE] Infos business non disponibles, utilisation du profil standard');
    }

    res.json({ profile });
  } catch (error) {
    console.error('[ADMIN PROFILE] Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * V2 - Profil par défaut pour les nouveaux business types
 */
function getDefaultBusinessProfile() {
  return {
    id: 'service_domicile',
    label: 'Service à Domicile',
    description: 'Prestataires de services à domicile',
    icon: 'Home',
    pricing: {
      mode: 'fixed',
      allowedModes: ['fixed'],
    },
    duration: {
      mode: 'fixed',
      allowMultiDay: false,
      allowOvernight: false,
    },
    terminology: {
      reservation: { singular: 'RDV', plural: 'RDV' },
      service: { singular: 'Service', plural: 'Services' },
      client: { singular: 'Client', plural: 'Clients' },
      employee: { singular: 'Prestataire', plural: 'Prestataires' },
      duration: 'Durée',
      quantity: 'Quantité',
    },
    fields: {
      service: { required: ['nom', 'prix', 'duree_minutes'], optional: [], forbidden: ['taux_horaire'] },
      reservation: { required: ['date_rdv', 'heure_rdv', 'adresse_client'], optional: [], forbidden: [] },
    },
    rules: {},
  };
}

/**
 * GET /api/admin/profile/available
 * Lister tous les profils métiers disponibles
 */
router.get('/available', async (req, res) => {
  try {
    const profiles = await listProfiles();
    res.json({ profiles });
  } catch (error) {
    console.error('[ADMIN PROFILE] Erreur liste:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/admin/profile
 * Changer le profil métier du tenant (admin seulement)
 */
router.put('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const { profile_id } = req.body;

    if (!profile_id) {
      return res.status(400).json({ error: 'profile_id requis' });
    }

    // Vérifier les droits (seul super_admin peut changer le profil)
    if (req.admin.role !== 'super_admin' && req.admin.role !== 'owner') {
      return res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Seul le propriétaire peut changer le profil métier',
      });
    }

    const result = await changeProfileTenant(tenantId, profile_id, adminId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      message: 'Profil métier mis à jour',
      profile: result.profile,
    });
  } catch (error) {
    console.error('[ADMIN PROFILE] Erreur changement:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/admin/profile/config
 * Récupérer la configuration personnalisée du tenant
 */
router.get('/config', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data, error } = await supabase
      .from('tenants')
      .select('profile_config')
      .eq('id', tenantId)
      .single();

    if (error) throw error;

    res.json({ config: data?.profile_config || {} });
  } catch (error) {
    console.error('[ADMIN PROFILE] Erreur config:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PATCH /api/admin/profile/config
 * Mettre à jour la configuration personnalisée du tenant
 */
router.patch('/config', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Configuration invalide' });
    }

    // Merger avec la config existante
    const { data: existing } = await supabase
      .from('tenants')
      .select('profile_config')
      .eq('id', tenantId)
      .single();

    const newConfig = {
      ...(existing?.profile_config || {}),
      ...config,
    };

    const { error } = await supabase
      .from('tenants')
      .update({
        profile_config: newConfig,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    if (error) throw error;

    res.json({
      message: 'Configuration mise à jour',
      config: newConfig,
    });
  } catch (error) {
    console.error('[ADMIN PROFILE] Erreur update config:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/admin/profile/terminology
 * Récupérer uniquement la terminologie du profil
 */
router.get('/terminology', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const profile = await loadProfile(tenantId);

    if (!profile) {
      return res.status(404).json({ error: 'Profil non trouvé' });
    }

    res.json({ terminology: profile.terminology });
  } catch (error) {
    console.error('[ADMIN PROFILE] Erreur terminology:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
