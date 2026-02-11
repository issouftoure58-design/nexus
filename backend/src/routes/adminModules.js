/**
 * Routes Admin - Gestion des Modules et Options
 * Structure corrigée avec plans + options_disponibles
 *
 * GET    /api/admin/modules                - Liste plan + options actives
 * GET    /api/admin/modules/pricing        - Calcul coût mensuel
 * GET    /api/admin/modules/plans          - Liste tous les plans
 * GET    /api/admin/modules/options        - Liste toutes les options
 * POST   /api/admin/modules/options/:id/activate   - Activer une option
 * POST   /api/admin/modules/options/:id/deactivate - Désactiver une option
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { invalidateModuleCache } from '../middleware/moduleProtection.js';

const router = express.Router();

// ════════════════════════════════════════════════════════════════════
// VUE GLOBALE
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/modules
 * Vue globale: plan actuel + options activées + pricing
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Récupérer tenant avec son plan
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select(`
        *,
        plan:plans(*)
      `)
      .eq('id', tenantId)
      .single();

    if (tenantError) throw tenantError;

    // Récupérer options actives
    const optionsActifs = tenant.options_canaux_actifs || {};
    const optionsIds = Object.keys(optionsActifs).filter(k => optionsActifs[k]);

    let optionsDetails = [];
    if (optionsIds.length > 0) {
      const { data: options } = await supabase
        .from('options_disponibles')
        .select('*')
        .in('id', optionsIds);
      optionsDetails = options || [];
    }

    // Récupérer module métier si configuré
    let moduleMétier = null;
    if (tenant.module_metier_id) {
      const { data: mod } = await supabase
        .from('options_disponibles')
        .select('*')
        .eq('id', tenant.module_metier_id)
        .single();
      moduleMétier = mod;
    }

    // Calculer pricing mensuel
    const planPrix = tenant.plan?.prix_mensuel || 0;
    const optionsPrix = optionsDetails
      .filter(o => o.type_paiement === 'mensuel')
      .reduce((sum, o) => sum + o.prix, 0);
    const totalMensuel = planPrix + optionsPrix;

    res.json({
      plan: tenant.plan,
      options_actives: optionsDetails,
      module_metier: moduleMétier,
      module_metier_paye: tenant.module_metier_paye,
      pricing: {
        plan: planPrix,
        options: optionsPrix,
        total_centimes: totalMensuel,
        total_euros: (totalMensuel / 100).toFixed(2)
      }
    });
  } catch (error) {
    console.error('[ADMIN MODULES] Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// PRICING
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/modules/pricing
 * Calcul détaillé du coût mensuel
 */
router.get('/pricing', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Récupérer tenant avec plan
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select(`
        plan_id,
        options_canaux_actifs,
        module_metier_id,
        module_metier_paye,
        plan:plans(id, nom, prix_mensuel)
      `)
      .eq('id', tenantId)
      .single();

    if (error) throw error;

    // Récupérer options actives
    const optionsActifs = tenant.options_canaux_actifs || {};
    const optionsIds = Object.keys(optionsActifs).filter(k => optionsActifs[k]);

    let options = [];
    if (optionsIds.length > 0) {
      const { data } = await supabase
        .from('options_disponibles')
        .select('id, nom, prix, type_paiement')
        .in('id', optionsIds)
        .eq('type_paiement', 'mensuel');
      options = data || [];
    }

    // Calculer totaux
    const planPrix = tenant.plan?.prix_mensuel || 0;
    const optionsPrix = options.reduce((sum, o) => sum + o.prix, 0);
    const totalMensuel = planPrix + optionsPrix;

    const details = [
      { type: 'plan', id: tenant.plan?.id, nom: tenant.plan?.nom, prix: planPrix }
    ];
    options.forEach(o => {
      details.push({ type: 'option', id: o.id, nom: o.nom, prix: o.prix });
    });

    res.json({
      details,
      plan_prix: planPrix,
      options_prix: optionsPrix,
      total_centimes: totalMensuel,
      total_euros: (totalMensuel / 100).toFixed(2),
      devise: 'EUR'
    });
  } catch (error) {
    console.error('[ADMIN MODULES] Erreur pricing:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// PLANS
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/modules/plans
 * Liste tous les plans disponibles
 */
router.get('/plans', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Récupérer tous les plans
    const { data: plans, error } = await supabase
      .from('plans')
      .select('*')
      .eq('actif', true)
      .order('ordre');

    if (error) throw error;

    // Récupérer plan actuel du tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('plan_id')
      .eq('id', tenantId)
      .single();

    const plansWithStatus = (plans || []).map(p => ({
      ...p,
      est_actif: p.id === tenant?.plan_id
    }));

    res.json({
      plans: plansWithStatus,
      plan_actuel: tenant?.plan_id
    });
  } catch (error) {
    console.error('[ADMIN MODULES] Erreur plans:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// OPTIONS
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/modules/options
 * Liste toutes les options disponibles avec statut
 */
router.get('/options', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Récupérer toutes les options
    const { data: options, error } = await supabase
      .from('options_disponibles')
      .select('*')
      .eq('actif', true)
      .order('ordre');

    if (error) throw error;

    // Récupérer config tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('options_canaux_actifs, module_metier_id, module_metier_paye')
      .eq('id', tenantId)
      .single();

    const optionsActifs = tenant?.options_canaux_actifs || {};

    // Enrichir avec statut
    const optionsWithStatus = (options || []).map(opt => {
      let estActif = false;
      let peutDesactiver = true;

      if (opt.categorie === 'canal_ia') {
        estActif = optionsActifs[opt.id] === true;
      } else if (opt.categorie === 'module_metier') {
        estActif = tenant?.module_metier_id === opt.id;
        peutDesactiver = !tenant?.module_metier_paye; // Déjà payé = pas désactivable
      }

      return {
        ...opt,
        est_actif: estActif,
        peut_desactiver: peutDesactiver,
        deja_paye: opt.categorie === 'module_metier' && tenant?.module_metier_id === opt.id && tenant?.module_metier_paye
      };
    });

    // Grouper par catégorie
    const parCategorie = {
      canal_ia: optionsWithStatus.filter(o => o.categorie === 'canal_ia'),
      module_metier: optionsWithStatus.filter(o => o.categorie === 'module_metier')
    };

    res.json({
      options: optionsWithStatus,
      par_categorie: parCategorie
    });
  } catch (error) {
    console.error('[ADMIN MODULES] Erreur options:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// ACTIVATION/DÉSACTIVATION OPTIONS
// ════════════════════════════════════════════════════════════════════

/**
 * POST /api/admin/modules/options/:optionId/activate
 * Activer une option
 */
router.post('/options/:optionId/activate', authenticateAdmin, async (req, res) => {
  try {
    const { optionId } = req.params;
    const tenantId = req.admin.tenant_id;

    console.log(`[ADMIN MODULES] Activation option ${optionId} pour ${tenantId}`);

    // Vérifier option existe
    const { data: option, error: optError } = await supabase
      .from('options_disponibles')
      .select('*')
      .eq('id', optionId)
      .eq('actif', true)
      .single();

    if (optError || !option) {
      return res.status(404).json({ error: 'Option non trouvée' });
    }

    // Récupérer tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('options_canaux_actifs, module_metier_id')
      .eq('id', tenantId)
      .single();

    if (tenantError) throw tenantError;

    let updates = { updated_at: new Date().toISOString() };

    if (option.categorie === 'canal_ia') {
      // Activer canal IA
      const optionsActifs = tenant.options_canaux_actifs || {};
      optionsActifs[optionId] = true;
      updates.options_canaux_actifs = optionsActifs;
    } else if (option.categorie === 'module_metier') {
      // Un seul module métier à la fois
      if (tenant.module_metier_id && tenant.module_metier_id !== optionId) {
        return res.status(400).json({
          error: 'Un module métier est déjà actif. Désactivez-le d\'abord.',
          code: 'MODULE_METIER_ALREADY_ACTIVE'
        });
      }
      updates.module_metier_id = optionId;
      // Note: module_metier_paye reste à false jusqu'au paiement
    }

    // Mettre à jour
    const { error: updateError } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', tenantId);

    if (updateError) throw updateError;

    // Invalider cache
    invalidateModuleCache(tenantId);

    // Logger
    try {
      await supabase.from('historique_admin').insert({
        tenant_id: tenantId,
        admin_id: req.admin.id,
        action: 'activate_option',
        entite: 'option',
        details: { option_id: optionId, option_nom: option.nom }
      });
    } catch (e) { /* ignore */ }

    console.log(`[ADMIN MODULES] ✅ Option ${optionId} activée`);

    res.json({
      success: true,
      message: `${option.nom} activé`,
      option: {
        id: option.id,
        nom: option.nom,
        prix: option.prix,
        type_paiement: option.type_paiement
      }
    });
  } catch (error) {
    console.error('[ADMIN MODULES] Erreur activation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/modules/options/:optionId/deactivate
 * Désactiver une option
 */
router.post('/options/:optionId/deactivate', authenticateAdmin, async (req, res) => {
  try {
    const { optionId } = req.params;
    const tenantId = req.admin.tenant_id;

    console.log(`[ADMIN MODULES] Désactivation option ${optionId} pour ${tenantId}`);

    // Vérifier option existe
    const { data: option, error: optError } = await supabase
      .from('options_disponibles')
      .select('*')
      .eq('id', optionId)
      .single();

    if (optError || !option) {
      return res.status(404).json({ error: 'Option non trouvée' });
    }

    // Récupérer tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('options_canaux_actifs, module_metier_id, module_metier_paye')
      .eq('id', tenantId)
      .single();

    if (tenantError) throw tenantError;

    let updates = { updated_at: new Date().toISOString() };

    if (option.categorie === 'canal_ia') {
      // Désactiver canal IA
      const optionsActifs = tenant.options_canaux_actifs || {};
      delete optionsActifs[optionId];
      updates.options_canaux_actifs = optionsActifs;
    } else if (option.categorie === 'module_metier') {
      // Vérifier si module déjà payé
      if (tenant.module_metier_id === optionId && tenant.module_metier_paye) {
        return res.status(400).json({
          error: 'Ce module a déjà été payé et ne peut pas être désactivé.',
          code: 'MODULE_ALREADY_PAID'
        });
      }
      updates.module_metier_id = null;
    }

    // Mettre à jour
    const { error: updateError } = await supabase
      .from('tenants')
      .update(updates)
      .eq('id', tenantId);

    if (updateError) throw updateError;

    // Invalider cache
    invalidateModuleCache(tenantId);

    // Logger
    try {
      await supabase.from('historique_admin').insert({
        tenant_id: tenantId,
        admin_id: req.admin.id,
        action: 'deactivate_option',
        entite: 'option',
        details: { option_id: optionId, option_nom: option.nom }
      });
    } catch (e) { /* ignore */ }

    console.log(`[ADMIN MODULES] ✅ Option ${optionId} désactivée`);

    res.json({
      success: true,
      message: `${option.nom} désactivé`
    });
  } catch (error) {
    console.error('[ADMIN MODULES] Erreur désactivation:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
