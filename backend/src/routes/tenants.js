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
import {
  BUSINESS_TEMPLATES,
  NEXUS_PLANS,
  TEMPLATE_TO_PROFILE,
  getBusinessTemplate,
  getAllBusinessTemplates,
  generateIaConfig,
  getPlan,
} from '../data/businessTemplates.js';
import { getFeaturesForPlan, PLAN_LIMITS, PLAN_FEATURES } from '../config/planFeatures.js';
import { PLAN_PRICES } from '../config/pricing.js';

const router = express.Router();

// ══════════════════════════════════════════════════════════════════════════════
// QUOTAS PAR DÉFAUT SELON PLAN — importés depuis config/planFeatures.js
// ══════════════════════════════════════════════════════════════════════════════
const DEFAULT_QUOTAS = PLAN_LIMITS;

// ══════════════════════════════════════════════════════════════════════════════
// MODULES DISPONIBLES
// ══════════════════════════════════════════════════════════════════════════════

// Modèle 2026 : Free / Starter (69€) / Pro (199€) / Business (599€)
// Tous les agents IA sont disponibles à partir de Starter et consomment de l'utilisation IA
// Le plan Free n'a pas accès aux fonctions IA (mais voit les modules en mode aperçu)
const AVAILABLE_MODULES = [
  {
    id: 'agent_ia_web',
    name: 'Agent IA Web Chat',
    description: 'Assistant conversationnel sur votre site web',
    price: 0, // Inclus à partir de Starter
    requiredPlan: 'starter',
  },
  {
    id: 'agent_ia_whatsapp',
    name: 'Agent IA WhatsApp',
    description: 'Réponses automatiques sur WhatsApp Business',
    price: 0, // Inclus à partir de Starter
    requiredPlan: 'starter',
  },
  {
    id: 'agent_ia_telephone',
    name: 'Agent IA Téléphone',
    description: 'Standard téléphonique automatisé',
    price: 0, // Inclus à partir de Starter
    requiredPlan: 'starter',
  },
  {
    id: 'restaurant',
    name: 'Module Restaurant Pro',
    description: 'Gestion spécialisée pour restaurants et traiteurs',
    price: 0, // Inclus dans tous les plans (Free a une version limitée)
    requiredPlan: 'free',
  },
  {
    id: 'hotel',
    name: 'Module Hôtel Pro',
    description: 'Gestion spécialisée pour hôtels et hébergements',
    price: 0, // Inclus dans tous les plans (Free a une version limitée)
    requiredPlan: 'free',
  },
  {
    id: 'domicile',
    name: 'Module Domicile Pro',
    description: 'Gestion spécialisée pour services à domicile',
    price: 0, // Inclus dans tous les plans (Free a une version limitée)
    requiredPlan: 'free',
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

    // Modèle 2026 : Free / Starter (69€) / Pro (199€) / Business (599€)
    // Le plan est stocké tel quel dans la DB. Retro-compat: basic→starter, pro inchangé
    const rawStoredPlan = (tenant.plan || tenant.tier || 'free').toLowerCase();
    const storedPlan = rawStoredPlan === 'basic' ? 'starter' : rawStoredPlan;
    // ═══ ESSAI: plan effectif = Starter (déverrouillé, le tenant teste avant de payer) ═══
    const effectivePlan = tenant.statut === 'essai' ? 'starter' : storedPlan;

    // Construire les quotas selon le plan effectif
    const quotas = {
      ...DEFAULT_QUOTAS[effectivePlan] || DEFAULT_QUOTAS.free,
      ...(tenant.quotas || {}),
    };

    // Convertir modules_actifs (array ou objet) en objet avec booléens
    const modulesRaw = tenant.modules_actifs || [];
    let modulesObject = Array.isArray(modulesRaw)
      ? modulesRaw.reduce((acc, mod) => ({ ...acc, [mod]: true }), {})
      : modulesRaw; // Si c'est déjà un objet, le garder

    // Merge: garantir que les modules du plan effectif sont actifs
    // Source unique de vérité: config/planFeatures.js
    const planDefaults = getFeaturesForPlan(effectivePlan);

    if (!modulesObject || Object.keys(modulesObject).length === 0) {
      modulesObject = { ...planDefaults };
    } else {
      // Merge: si le plan accorde un module (true), forcer l'activation
      // Les modules false dans planDefaults restent tels quels dans la DB
      for (const [mod, val] of Object.entries(planDefaults)) {
        if (!(mod in modulesObject)) {
          modulesObject[mod] = val;
        } else if (val === true && modulesObject[mod] === false) {
          // Le plan accorde ce module — activer (override DB false)
          modulesObject[mod] = true;
        }
      }
    }

    // Persister en DB si modules ont changé
    const currentKeys = Object.keys(tenant.modules_actifs || {});
    const mergedKeys = Object.keys(modulesObject);
    if (mergedKeys.length !== currentKeys.length || mergedKeys.some(k => !(k in (tenant.modules_actifs || {})))) {
      supabase.from('tenants')
        .update({ modules_actifs: modulesObject })
        .eq('id', tenantId)
        .then(() => console.log(`[TENANTS] Modules synced for ${tenantId}: ${mergedKeys.length} modules`))
        .catch(err => console.error('[TENANTS] Error syncing modules:', err.message));
    }

    // Construire la réponse
    const response = {
      success: true,
      tenant: {
        id: tenant.id,
        slug: tenant.id, // Le slug est l'ID pour l'instant
        name: tenant.name || tenant.nom_commercial || 'NEXUS',
        plan: effectivePlan,            // Plan effectif (Starter pendant essai)
        plan_choisi: storedPlan,        // Plan choisi au signup (pour affichage upgrade)
        modules: modulesObject,
        branding: {
          logo: tenant.logo_url || null,
          primaryColor: tenant.couleur_primaire || '#0EA5E9',
          secondaryColor: tenant.couleur_secondaire || '#6366F1',
          favicon: tenant.favicon_url || null,
        },
        quotas: quotas,
        statut: tenant.statut || 'actif',
        essai_fin: tenant.essai_fin || null,
        onboarding_completed: tenant.onboarding_completed || false,
        template_id: tenant.template_id || null,
        business_profile: tenant.business_profile || null,
        onboarding_step: tenant.onboarding_step || 0,
        profession_id: tenant.profession_id || null,
        // Contact info (source unique de vérité)
        email: tenant.email || null,
        telephone: tenant.telephone || null,
        adresse: tenant.adresse || null,
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

// Note: PATCH /me/complete-onboarding défini plus bas (ligne ~745) avec onboarding_completed_at

// ══════════════════════════════════════════════════════════════════════════════
// PATCH /api/tenants/me/profile - Modifier infos profil (source unique de vérité)
// ══════════════════════════════════════════════════════════════════════════════

router.patch('/me/profile', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Tenant ID manquant' });
    }

    const { name, email, telephone, adresse } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (telephone !== undefined) updates.telephone = telephone;
    if (adresse !== undefined) updates.adresse = adresse;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun champ à mettre à jour' });
    }

    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', tenantId);

    if (error) throw error;

    console.log(`[TENANTS] PATCH /me/profile - ${tenantId}:`, Object.keys(updates));
    res.json({ success: true });
  } catch (error) {
    console.error('[TENANTS] Erreur PATCH /me/profile:', error);
    res.status(500).json({ success: false, error: error.message });
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
      .select('plan, tier, statut, modules_actifs')
      .eq('id', tenantId)
      .single();

    // Modèle 2026 : Free / Starter (69€) / Pro (199€) / Business (599€)
    const rawStoredPlan = (tenant?.plan || tenant?.tier || 'free').toLowerCase();
    const storedPlan = rawStoredPlan === 'basic' ? 'starter' : rawStoredPlan;
    // ═══ ESSAI: plan effectif = Starter (déverrouillé) ═══
    const currentPlan = tenant?.statut === 'essai' ? 'starter' : storedPlan;
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
// GET /api/tenants/business-templates - Templates métier disponibles
// ══════════════════════════════════════════════════════════════════════════════

router.get('/business-templates', async (req, res) => {
  try {
    const templates = getAllBusinessTemplates().map(t => ({
      id: t.id,
      name: t.name,
      icon: t.icon,
      emoji: t.emoji,
      description: t.description,
      recommendedModules: t.recommendedModules,
      suggestedPlan: t.suggestedPlan,
      servicesCount: t.defaultServices.length,
    }));

    res.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error('[TENANTS] Erreur GET /business-templates:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur',
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/tenants/plans - Plans NEXUS disponibles
// ══════════════════════════════════════════════════════════════════════════════

router.get('/plans', async (req, res) => {
  try {
    const plans = Object.values(NEXUS_PLANS).map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      popular: p.popular || false,
      includes: p.includes,
    }));

    res.json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error('[TENANTS] Erreur GET /plans:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur',
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/tenants/setup-from-template - Configuration auto depuis template
// ══════════════════════════════════════════════════════════════════════════════

router.post('/setup-from-template', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID manquant',
      });
    }

    const {
      businessType,
      businessName,
      ownerName,
      address,
      phone,
      selectedServices, // optionnel: services sélectionnés (si l'utilisateur modifie)
      customHours, // optionnel: horaires personnalisés
    } = req.body;

    if (!businessType) {
      return res.status(400).json({
        success: false,
        error: 'Type de business requis',
      });
    }

    console.log(`[TENANTS] Setup from template: ${tenantId} -> ${businessType}`);

    // Récupérer le template
    const template = getBusinessTemplate(businessType);

    if (!template) {
      return res.status(400).json({
        success: false,
        error: 'Template non trouvé',
      });
    }

    // ═══════════════════════════════════════════════════
    // 1. METTRE À JOUR LE TENANT
    // ═══════════════════════════════════════════════════

    const tenantUpdate = {
      name: businessName || null,
      business_profile: TEMPLATE_TO_PROFILE[businessType] || businessType || 'salon',
      adresse: address || null,
      telephone: phone || null,
    };

    const { error: tenantError } = await supabase
      .from('tenants')
      .update(tenantUpdate)
      .eq('id', tenantId);

    if (tenantError) {
      console.error('[TENANTS] Erreur update tenant:', tenantError);
    }

    // ═══════════════════════════════════════════════════
    // 2. CRÉER LES SERVICES PAR DÉFAUT
    // ═══════════════════════════════════════════════════

    const servicesToCreate = selectedServices || template.defaultServices;
    let servicesCreated = 0;

    if (servicesToCreate.length > 0) {
      // Supprimer les anciens services (reset)
      await supabase
        .from('services')
        .delete()
        .eq('tenant_id', tenantId);

      // Créer les nouveaux services
      const servicesData = servicesToCreate.map((s, index) => ({
        tenant_id: tenantId,
        nom: s.name,
        description: s.description || '',
        prix: Math.round((s.price || 0) * 100), // En centimes
        duree: s.duration || 30,
        categorie: s.category || 'Service',
        actif: true,
        ordre: index + 1,
      }));

      const { data: createdServices, error: servicesError } = await supabase
        .from('services')
        .insert(servicesData)
        .select();

      if (servicesError) {
        console.error('[TENANTS] Erreur création services:', servicesError);
      } else {
        servicesCreated = createdServices?.length || 0;
      }
    }

    // ═══════════════════════════════════════════════════
    // 3. CRÉER/METTRE À JOUR LES DISPONIBILITÉS
    // ═══════════════════════════════════════════════════

    const hoursToUse = customHours || template.defaultHours;
    let hoursCreated = 0;

    // Supprimer les anciennes disponibilités
    await supabase
      .from('disponibilites')
      .delete()
      .eq('tenant_id', tenantId);

    // Créer les nouvelles disponibilités
    const dayMapping = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 0,
    };

    const disponibilites = [];

    for (const [day, hours] of Object.entries(hoursToUse)) {
      if (hours) {
        // Jour avec horaires
        if (hours.open && hours.close) {
          // Horaires simples
          disponibilites.push({
            tenant_id: tenantId,
            jour_semaine: dayMapping[day],
            heure_debut: hours.open,
            heure_fin: hours.close,
            actif: true,
          });
        }

        // Horaires matin/après-midi (médical)
        if (hours.morning) {
          disponibilites.push({
            tenant_id: tenantId,
            jour_semaine: dayMapping[day],
            heure_debut: hours.morning.open,
            heure_fin: hours.morning.close,
            actif: true,
          });
        }
        if (hours.afternoon) {
          disponibilites.push({
            tenant_id: tenantId,
            jour_semaine: dayMapping[day],
            heure_debut: hours.afternoon.open,
            heure_fin: hours.afternoon.close,
            actif: true,
          });
        }

        // Horaires midi/soir (restaurant)
        if (hours.lunch) {
          disponibilites.push({
            tenant_id: tenantId,
            jour_semaine: dayMapping[day],
            heure_debut: hours.lunch.open,
            heure_fin: hours.lunch.close,
            actif: true,
          });
        }
        if (hours.dinner) {
          disponibilites.push({
            tenant_id: tenantId,
            jour_semaine: dayMapping[day],
            heure_debut: hours.dinner.open,
            heure_fin: hours.dinner.close,
            actif: true,
          });
        }
        if (hours.evening) {
          disponibilites.push({
            tenant_id: tenantId,
            jour_semaine: dayMapping[day],
            heure_debut: hours.evening.open,
            heure_fin: hours.evening.close,
            actif: true,
          });
        }
      }
    }

    if (disponibilites.length > 0) {
      const { data: createdDispo, error: dispoError } = await supabase
        .from('disponibilites')
        .insert(disponibilites)
        .select();

      if (dispoError) {
        console.error('[TENANTS] Erreur création disponibilités:', dispoError);
      } else {
        hoursCreated = createdDispo?.length || 0;
      }
    }

    // ═══════════════════════════════════════════════════
    // 4. CRÉER/METTRE À JOUR LA CONFIG IA
    // ═══════════════════════════════════════════════════

    const iaConfigs = generateIaConfig(businessType, businessName || 'Mon entreprise', ownerName || '');
    let iaConfigsCreated = 0;

    for (const [channel, config] of Object.entries(iaConfigs)) {
      // Channel format: channel_telephone, channel_whatsapp, channel_web
      const channelName = channel.replace('channel_', '');

      // Upsert config IA
      const { error: iaError } = await supabase
        .from('tenant_ia_config')
        .upsert({
          tenant_id: tenantId,
          channel: channelName,
          greeting_message: config.greeting,
          system_prompt: config.personality,
          tone: config.tone,
          can_book: config.canBook,
          can_quote: config.canQuote,
          can_transfer: config.canTransfer || false,
          transfer_keywords: config.transferKeywords || [],
          quick_replies: config.quickReplies || [],
          active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,channel',
        });

      if (!iaError) {
        iaConfigsCreated++;
      } else {
        console.error(`[TENANTS] Erreur config IA ${channelName}:`, iaError);
      }
    }

    // ═══════════════════════════════════════════════════
    // 5. RETOURNER LE RÉSULTAT
    // ═══════════════════════════════════════════════════

    console.log(`[TENANTS] Setup terminé: ${servicesCreated} services, ${hoursCreated} horaires, ${iaConfigsCreated} configs IA`);

    res.json({
      success: true,
      message: 'Configuration appliquée avec succès',
      setup: {
        businessType: template.id,
        businessName: template.name,
        servicesCreated,
        hoursCreated,
        iaConfigsCreated,
        recommendedModules: template.recommendedModules,
        suggestedPlan: template.suggestedPlan,
      },
    });
  } catch (error) {
    console.error('[TENANTS] Erreur POST /setup-from-template:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur',
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/tenants/template-preview/:type - Prévisualiser un template
// ══════════════════════════════════════════════════════════════════════════════

router.get('/template-preview/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const template = getBusinessTemplate(type);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template non trouvé',
      });
    }

    // Retourner le template complet pour prévisualisation
    res.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        icon: template.icon,
        emoji: template.emoji,
        description: template.description,
        defaultServices: template.defaultServices,
        defaultHours: template.defaultHours,
        iaConfig: template.iaConfig,
        recommendedModules: template.recommendedModules,
        suggestedPlan: template.suggestedPlan,
        specialNotes: template.specialNotes || [],
      },
    });
  } catch (error) {
    console.error('[TENANTS] Erreur GET /template-preview:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur',
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PATCH /api/tenants/me/complete-onboarding - Marquer onboarding terminé
// ══════════════════════════════════════════════════════════════════════════════

router.patch('/me/complete-onboarding', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant ID manquant',
      });
    }

    const { error } = await supabase
      .from('tenants')
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    if (error) throw error;

    console.log(`[TENANTS] Onboarding terminé: ${tenantId}`);

    res.json({
      success: true,
      message: 'Onboarding marqué comme terminé',
    });
  } catch (error) {
    console.error('[TENANTS] Erreur PATCH /me/complete-onboarding:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur serveur',
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/tenants/plans/features — Plan features (public, pour le frontend)
// ══════════════════════════════════════════════════════════════════════════════

router.get('/plans/features', async (req, res) => {
  try {
    const plans = {};
    for (const [planId, features] of Object.entries(PLAN_FEATURES)) {
      if (planId === 'basic') continue; // Skip legacy alias
      const prices = PLAN_PRICES[planId] || PLAN_PRICES.free;
      const limits = PLAN_LIMITS[planId] || PLAN_LIMITS.free;
      plans[planId] = {
        features,
        limits,
        price: { monthly: prices.monthly, yearly: prices.yearly },
      };
    }
    res.json({ success: true, plans });
  } catch (error) {
    console.error('[TENANTS] Erreur GET /plans/features:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function isPlanSufficient(currentPlan, requiredPlan) {
  // Modèle 2026 : Free / Starter (69€) / Pro (199€) / Business (599€)
  const normalize = (p) => {
    const x = (p || 'free').toLowerCase();
    if (x === 'basic') return 'starter'; // retro-compat
    return x;
  };
  const planOrder = ['free', 'starter', 'pro', 'business'];
  const currentIndex = planOrder.indexOf(normalize(currentPlan));
  const requiredIndex = planOrder.indexOf(normalize(requiredPlan));
  return currentIndex >= requiredIndex;
}

export default router;
