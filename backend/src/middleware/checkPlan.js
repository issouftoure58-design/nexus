/**
 * Middleware de controle des plans et limites NEXUS
 * Verifie l'acces aux modules selon le plan souscrit
 */

import { supabase } from '../config/supabase.js';

/**
 * Middleware verifiant l'acces d'un tenant a un module
 *
 * Usage:
 * router.use('/marketing', requireModule('marketing'));
 * router.use('/seo', requireModule('seo'));
 */
export function requireModule(moduleName) {
  return async (req, res, next) => {
    // 🔒 TENANT SHIELD: tenant_id UNIQUEMENT depuis l'authentification
    // NEVER from req.body or headers - that would allow spoofing
    const tenantId = req.admin?.tenant_id;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Non authentifie',
        code: 'AUTH_REQUIRED'
      });
    }

    try {
      // Recuperer tenant avec son plan
      const { data: tenant, error } = await supabase
        .from('tenants')
        .select(`
          id,
          name,
          plan_id,
          modules_actifs,
          statut,
          essai_fin
        `)
        .eq('id', tenantId)
        .single();

      if (error || !tenant) {
        return res.status(404).json({
          error: 'Tenant non trouve',
          code: 'TENANT_NOT_FOUND'
        });
      }

      // Recuperer plan
      const { data: plan } = await supabase
        .from('plans')
        .select('nom, modules, limites')
        .eq('id', tenant.plan_id)
        .single();

      // ═══════════════════════════════════════════════════
      // VERIFICATION STATUT ABONNEMENT
      // ═══════════════════════════════════════════════════

      if (tenant.statut === 'suspendu') {
        return res.status(402).json({
          error: 'Abonnement suspendu',
          message: 'Votre abonnement est suspendu. Veuillez mettre a jour votre moyen de paiement.',
          code: 'SUBSCRIPTION_SUSPENDED',
          action: 'update_payment',
          redirect: '/admin/billing'
        });
      }

      if (tenant.statut === 'expire' || tenant.statut === 'annule') {
        return res.status(402).json({
          error: 'Abonnement expire',
          message: 'Votre periode d\'essai est terminee. Veuillez souscrire a un plan.',
          code: 'SUBSCRIPTION_EXPIRED',
          action: 'subscribe',
          redirect: '/admin/billing/upgrade'
        });
      }

      // Verifier si essai expire
      if (tenant.statut === 'essai' && tenant.essai_fin && new Date(tenant.essai_fin) < new Date()) {
        // Marquer comme expire
        await supabase
          .from('tenants')
          .update({ statut: 'expire' })
          .eq('id', tenantId);

        return res.status(402).json({
          error: 'Essai expire',
          message: 'Votre periode d\'essai de 14 jours est terminee. Passez a un plan payant pour continuer.',
          code: 'TRIAL_EXPIRED',
          action: 'subscribe',
          redirect: '/admin/billing/upgrade'
        });
      }

      // ═══════════════════════════════════════════════════
      // VERIFICATION ACCES MODULE
      // ═══════════════════════════════════════════════════

      const moduleActif = tenant.modules_actifs?.[moduleName] ||
                         plan?.modules?.[moduleName];

      if (!moduleActif) {
        const requiredPlans = getRequiredPlans(moduleName);

        return res.status(403).json({
          error: 'Module non inclus',
          message: `Le module "${moduleName}" n'est pas inclus dans votre plan ${plan?.nom || tenant.plan_id}.`,
          code: 'MODULE_NOT_INCLUDED',
          current_plan: tenant.plan_id,
          required_plans: requiredPlans,
          module: moduleName,
          action: 'upgrade',
          redirect: '/admin/billing/upgrade'
        });
      }

      // ═══════════════════════════════════════════════════
      // SUCCES - Attacher infos au req
      // ═══════════════════════════════════════════════════

      req.tenant = tenant;
      req.plan = plan;
      req.limites = plan?.limites || {};

      next();

    } catch (err) {
      console.error('[CHECK PLAN] Erreur:', err);
      return res.status(500).json({
        error: 'Erreur serveur',
        code: 'INTERNAL_ERROR'
      });
    }
  };
}

/**
 * Middleware verifiant limite d'usage pour une ressource
 *
 * Usage:
 * router.post('/reservations', checkUsageLimit('reservations'), ...);
 */
export function checkUsageLimit(resource) {
  return async (req, res, next) => {
    // 🔒 TENANT SHIELD: tenant_id UNIQUEMENT depuis l'authentification
    // NEVER from req.body or headers - that would allow spoofing
    const tenantId = req.admin?.tenant_id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Non authentifie' });
    }

    try {
      // Recuperer plan et limites
      const { data: tenant } = await supabase
        .from('tenants')
        .select('plan_id')
        .eq('id', tenantId)
        .single();

      if (!tenant) {
        return res.status(404).json({ error: 'Tenant non trouve' });
      }

      const { data: plan } = await supabase
        .from('plans')
        .select('limites')
        .eq('id', tenant.plan_id)
        .single();

      const limites = plan?.limites || {};

      // Recuperer usage du mois
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      firstDayOfMonth.setHours(0, 0, 0, 0);

      const { data: usage } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('mois', firstDayOfMonth.toISOString().split('T')[0])
        .single();

      // Verifier limite selon ressource
      let count = 0;
      let limite = -1;
      let fieldName = '';

      switch(resource) {
        case 'reservations':
          count = usage?.reservations_count || 0;
          limite = limites.reservations_mois;
          fieldName = 'reservations_count';
          break;

        case 'commandes':
          count = usage?.commandes_count || 0;
          limite = limites.commandes_mois;
          fieldName = 'commandes_count';
          break;

        case 'tickets':
          count = usage?.tickets_count || 0;
          limite = limites.tickets_mois;
          fieldName = 'tickets_count';
          break;

        case 'projets':
          // Pour projets, compter directement en BDD
          const { count: projetCount } = await supabase
            .from('projets')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('statut', 'actif');

          count = projetCount || 0;
          limite = limites.projets_actifs;
          break;

        case 'clients':
          const { count: clientCount } = await supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId);

          count = clientCount || 0;
          limite = limites.clients_max;
          break;

        case 'posts_sociaux':
          count = usage?.posts_sociaux_count || 0;
          limite = limites.posts_sociaux_mois;
          fieldName = 'posts_sociaux_count';
          break;

        case 'dalle':
          count = usage?.quota_dalle_used || 0;
          limite = limites.quota_dalle;
          fieldName = 'quota_dalle_used';
          break;
      }

      // Si limite atteinte (-1 = illimite)
      if (limite !== -1 && count >= limite) {
        return res.status(402).json({
          error: 'Limite atteinte',
          message: `Limite de ${limite} ${resource}/mois atteinte. Passez a un plan superieur.`,
          code: 'LIMIT_REACHED',
          resource,
          count,
          limite,
          action: 'upgrade',
          redirect: '/admin/billing/upgrade'
        });
      }

      // Incrementer compteur si fieldName fourni
      if (fieldName) {
        req.incrementUsage = async () => {
          if (!usage) {
            // Creer entree usage ce mois
            await supabase.from('usage_tracking').insert({
              tenant_id: tenantId,
              mois: firstDayOfMonth.toISOString().split('T')[0],
              [fieldName]: 1,
              limites_plan: limites
            });
          } else {
            // Incrementer
            await supabase
              .from('usage_tracking')
              .update({
                [fieldName]: count + 1,
                updated_at: new Date()
              })
              .eq('id', usage.id);
          }
        };
      }

      // Attacher infos usage au req
      req.usage = {
        count,
        limite,
        resource,
        remaining: limite === -1 ? -1 : limite - count
      };

      next();

    } catch (err) {
      console.error('[CHECK USAGE] Erreur:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  };
}

/**
 * Helper : quels plans incluent ce module
 */
function getRequiredPlans(moduleName) {
  const moduleToPlans = {
    // Modules de base (tous plans)
    'dashboard': ['starter', 'pro', 'business'],
    'clients': ['starter', 'pro', 'business'],
    'facturation': ['starter', 'pro', 'business'],
    'documents': ['starter', 'pro', 'business'],
    'reseaux_sociaux': ['starter', 'pro', 'business'],

    // Modules avances (Pro et Business)
    'comptabilite': ['pro', 'business'],
    'crm_avance': ['pro', 'business'],
    'marketing': ['pro', 'business'],
    'commercial': ['pro', 'business'],
    'stock': ['pro', 'business'],
    'analytics': ['pro', 'business'],

    // Modules premium (Business uniquement)
    'seo': ['business'],
    'rh': ['business'],
    'api': ['business'],
    'whitelabel': ['business']
  };

  return moduleToPlans[moduleName] || [];
}

/**
 * Middleware verifiant acces module metier (reservations, commandes, etc.)
 */
export function requireModuleMetier(moduleMetierName) {
  return async (req, res, next) => {
    // 🔒 TENANT SHIELD: tenant_id UNIQUEMENT depuis l'authentification
    // NEVER from req.body or headers - that would allow spoofing
    const tenantId = req.admin?.tenant_id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Non authentifie' });
    }

    try {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('modules_metier_actifs')
        .eq('id', tenantId)
        .single();

      if (!tenant?.modules_metier_actifs?.[moduleMetierName]) {
        return res.status(403).json({
          error: 'Module metier non active',
          message: `Le module "${moduleMetierName}" n'est pas active pour votre secteur d'activite.`,
          code: 'MODULE_METIER_NOT_ACTIVE',
          module: moduleMetierName
        });
      }

      next();

    } catch (err) {
      console.error('[CHECK MODULE METIER] Erreur:', err);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  };
}

/**
 * Recuperer les infos du plan d'un tenant
 */
export async function getTenantPlanInfo(tenantId) {
  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('plan_id, modules_actifs, modules_metier_actifs, statut, essai_fin')
      .eq('id', tenantId)
      .single();

    if (!tenant) return null;

    const { data: plan } = await supabase
      .from('plans')
      .select('*')
      .eq('id', tenant.plan_id)
      .single();

    return {
      tenant,
      plan,
      isActive: tenant.statut === 'actif' || tenant.statut === 'essai',
      isTrial: tenant.statut === 'essai',
      trialEndsAt: tenant.essai_fin
    };
  } catch (err) {
    console.error('[GET PLAN INFO] Erreur:', err);
    return null;
  }
}

export default {
  requireModule,
  checkUsageLimit,
  requireModuleMetier,
  getTenantPlanInfo
};
