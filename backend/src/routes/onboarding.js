/**
 * Routes Onboarding - Configuration initiale du tenant
 *
 * GET    /api/admin/onboarding/status   - Statut de l'onboarding
 * POST   /api/admin/onboarding/save     - Sauvegarder une etape
 * POST   /api/admin/onboarding/complete - Finaliser l'onboarding
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// Middleware auth sur toutes les routes
router.use(authenticateAdmin);

/**
 * GET /api/admin/onboarding/status
 * Recupere l'etat actuel de l'onboarding du tenant
 */
router.get('/status', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Recuperer les infos du tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantError) throw tenantError;

    // Recuperer les horaires (disponibilites)
    const { data: disponibilites } = await supabase
      .from('disponibilites')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('jour_semaine', { ascending: true });

    // Recuperer les services
    const { data: services } = await supabase
      .from('services')
      .select('id, nom, duree, prix, description')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    // Transformer les disponibilites en format horaires
    const joursMap = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const horaires = {};

    joursMap.forEach((jour, idx) => {
      const dispo = disponibilites?.find(d => d.jour_semaine === idx);
      horaires[jour] = {
        ouvert: dispo?.actif || false,
        debut: dispo?.heure_debut || '09:00',
        fin: dispo?.heure_fin || '18:00',
      };
    });

    // Construire businessInfo
    const businessInfo = {
      nom: tenant.nom || '',
      description: tenant.description || '',
      adresse: tenant.adresse || '',
      telephone: tenant.telephone || '',
      email: tenant.email || '',
      site_web: tenant.site_web || '',
      instagram: tenant.instagram || '',
      facebook: tenant.facebook || '',
    };

    // Theme
    const theme = {
      couleur_primaire: tenant.couleur_primaire || '#06B6D4',
      logo_url: tenant.logo_url || '',
    };

    // Determiner l'etape actuelle
    let currentStep = 1;
    if (businessInfo.nom) currentStep = 2;
    if (disponibilites?.length > 0) currentStep = 3;
    if (services?.length > 0) currentStep = 4;
    if (tenant.onboarding_completed) currentStep = 5;

    res.json({
      success: true,
      businessInfo,
      horaires,
      services: services || [],
      theme,
      currentStep,
      onboardingCompleted: tenant.onboarding_completed || false,
    });

  } catch (error) {
    console.error('[Onboarding] Status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/onboarding/save
 * Sauvegarde une etape de l'onboarding
 */
router.post('/save', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { step, data } = req.body;

    console.log(`[Onboarding] Saving step ${step} for tenant ${tenantId}`);

    switch (step) {
      case 1: // Business Info
        if (data.businessInfo) {
          await supabase
            .from('tenants')
            .update({
              nom: data.businessInfo.nom,
              description: data.businessInfo.description,
              adresse: data.businessInfo.adresse,
              telephone: data.businessInfo.telephone,
              email: data.businessInfo.email,
              site_web: data.businessInfo.site_web,
              instagram: data.businessInfo.instagram,
              facebook: data.businessInfo.facebook,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tenantId);
        }
        break;

      case 2: // Horaires
        if (data.horaires) {
          const joursMap = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

          // Supprimer les anciens horaires
          await supabase
            .from('disponibilites')
            .delete()
            .eq('tenant_id', tenantId);

          // Inserer les nouveaux
          const disponibilites = joursMap.map((jour, idx) => ({
            tenant_id: tenantId,
            jour_semaine: idx,
            heure_debut: data.horaires[jour]?.debut || '09:00',
            heure_fin: data.horaires[jour]?.fin || '18:00',
            actif: data.horaires[jour]?.ouvert || false,
          }));

          await supabase.from('disponibilites').insert(disponibilites);
        }
        break;

      case 3: // Services
        if (data.services?.length > 0) {
          // Recuperer les services existants
          const { data: existingServices } = await supabase
            .from('services')
            .select('id')
            .eq('tenant_id', tenantId);

          const existingIds = new Set((existingServices || []).map(s => s.id));

          for (const service of data.services) {
            if (existingIds.has(service.id)) {
              // Update
              await supabase
                .from('services')
                .update({
                  nom: service.nom,
                  duree: service.duree,
                  prix: service.prix,
                  description: service.description,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', service.id)
                .eq('tenant_id', tenantId);
            } else {
              // Insert
              await supabase.from('services').insert({
                tenant_id: tenantId,
                nom: service.nom,
                duree: service.duree,
                prix: service.prix,
                description: service.description,
                actif: true,
              });
            }
          }
        }
        break;

      case 4: // Theme
        if (data.theme) {
          await supabase
            .from('tenants')
            .update({
              couleur_primaire: data.theme.couleur_primaire,
              logo_url: data.theme.logo_url,
              updated_at: new Date().toISOString(),
            })
            .eq('id', tenantId);
        }
        break;
    }

    res.json({ success: true, step });

  } catch (error) {
    console.error('[Onboarding] Save error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/onboarding/complete
 * Marque l'onboarding comme termine
 */
router.post('/complete', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    console.log(`[Onboarding] Completing for tenant ${tenantId}`);

    // Marquer l'onboarding comme termine
    const { error } = await supabase
      .from('tenants')
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    if (error) throw error;

    // Logger l'action
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'onboarding_completed',
      entite: 'tenant',
      details: {},
    });

    res.json({
      success: true,
      message: 'Onboarding complete',
    });

  } catch (error) {
    console.error('[Onboarding] Complete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
