/**
 * Routes API pour Marketing Automation - Workflows
 * Plan PRO Feature
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// Middleware: Vérifier que le tenant a le plan PRO ou BUSINESS
async function requireProPlan(req, res, next) {
  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('plan, plan_id, tier')
      .eq('id', req.admin.tenant_id)
      .single();

    const plan = (tenant?.plan || tenant?.plan_id || tenant?.tier || 'starter').toLowerCase();

    if (plan === 'starter') {
      return res.status(403).json({
        error: 'Fonctionnalité réservée aux plans Pro et Business',
        required_plan: 'pro',
        current_plan: plan
      });
    }

    next();
  } catch (error) {
    console.error('[WORKFLOWS] Erreur vérification plan:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

// Appliquer middleware Pro sur toutes les routes
router.use(authenticateAdmin, requireProPlan);

// Types de triggers disponibles
const TRIGGER_TYPES = [
  { id: 'new_client', label: 'Nouveau client', description: 'Déclenché quand un nouveau client est créé' },
  { id: 'rdv_completed', label: 'RDV terminé', description: 'Déclenché quand un RDV est marqué comme terminé' },
  { id: 'rdv_cancelled', label: 'RDV annulé', description: 'Déclenché quand un RDV est annulé' },
  { id: 'facture_payee', label: 'Facture payée', description: 'Déclenché quand une facture est payée' },
  { id: 'facture_en_retard', label: 'Facture en retard', description: 'Déclenché quand une facture dépasse son échéance' },
  { id: 'client_inactive', label: 'Client inactif', description: 'Déclenché pour les clients sans RDV depuis X jours' },
  { id: 'anniversaire', label: 'Anniversaire client', description: 'Déclenché le jour de l\'anniversaire du client' }
];

// Types d'actions disponibles
const ACTION_TYPES = [
  { id: 'send_email', label: 'Envoyer un email', icon: 'mail' },
  { id: 'send_sms', label: 'Envoyer un SMS', icon: 'message-square' },
  { id: 'send_whatsapp', label: 'Envoyer WhatsApp', icon: 'message-circle' },
  { id: 'add_tag', label: 'Ajouter un tag', icon: 'tag' },
  { id: 'remove_tag', label: 'Retirer un tag', icon: 'x' },
  { id: 'create_task', label: 'Créer une tâche', icon: 'check-square' },
  { id: 'update_field', label: 'Modifier un champ', icon: 'edit' },
  { id: 'webhook', label: 'Appeler un webhook', icon: 'globe' }
];

// Templates de workflows prédéfinis
const WORKFLOW_TEMPLATES = [
  {
    id: 'welcome_email',
    nom: 'Email de bienvenue',
    description: 'Envoie automatiquement un email de bienvenue aux nouveaux clients',
    trigger_type: 'new_client',
    config: {
      conditions: [],
      actions: [
        { type: 'send_email', template: 'bienvenue', to_field: 'email', delay_minutes: 0 }
      ]
    }
  },
  {
    id: 'review_request',
    nom: 'Demande d\'avis après RDV',
    description: 'Envoie un SMS 24h après chaque RDV pour demander un avis',
    trigger_type: 'rdv_completed',
    config: {
      conditions: [],
      actions: [
        {
          type: 'send_sms',
          message: 'Bonjour {{prenom}}, merci pour votre visite ! Qu\'avez-vous pensé de votre expérience ? Votre avis compte beaucoup pour nous.',
          to_field: 'telephone',
          delay_minutes: 1440
        }
      ]
    }
  },
  {
    id: 'thank_you',
    nom: 'Remerciement après RDV',
    description: 'Envoie un email de remerciement après chaque prestation',
    trigger_type: 'rdv_completed',
    config: {
      conditions: [],
      actions: [
        { type: 'send_email', template: 'remerciement', to_field: 'email', delay_minutes: 60 }
      ]
    }
  },
  {
    id: 'vip_tag',
    nom: 'Tag VIP automatique',
    description: 'Ajoute le tag VIP aux clients ayant dépensé plus de 500€',
    trigger_type: 'rdv_completed',
    config: {
      conditions: [
        { field: 'prix_total', operator: '>=', value: 50000 }
      ],
      actions: [
        { type: 'add_tag', tag: 'VIP', delay_minutes: 0 }
      ]
    }
  },
  {
    id: 'follow_up_task',
    nom: 'Tâche de suivi',
    description: 'Crée une tâche de rappel 7 jours après un RDV',
    trigger_type: 'rdv_completed',
    config: {
      conditions: [],
      actions: [
        {
          type: 'create_task',
          description: 'Rappeler {{prenom}} {{nom}} pour un prochain RDV',
          priorite: 'normal',
          due_days: 7,
          delay_minutes: 0
        }
      ]
    }
  }
];

/**
 * GET /api/admin/workflows
 * Liste tous les workflows du tenant
 */
router.get('/', async (req, res) => {
  try {
    const { data: workflows, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Ajouter le nombre d'exécutions
    const workflowsWithStats = await Promise.all(
      (workflows || []).map(async (workflow) => {
        const { count } = await supabase
          .from('workflow_executions')
          .select('*', { count: 'exact', head: true })
          .eq('workflow_id', workflow.id);

        return {
          ...workflow,
          executions_total: count || 0
        };
      })
    );

    res.json(workflowsWithStats);
  } catch (error) {
    console.error('[WORKFLOWS] Erreur liste:', error);
    res.status(500).json({ error: 'Erreur récupération workflows' });
  }
});

/**
 * GET /api/admin/workflows/templates
 * Liste les templates de workflows disponibles
 */
router.get('/templates', async (req, res) => {
  res.json({
    templates: WORKFLOW_TEMPLATES,
    trigger_types: TRIGGER_TYPES,
    action_types: ACTION_TYPES
  });
});

/**
 * GET /api/admin/workflows/:id
 * Détail d'un workflow
 */
router.get('/:id', async (req, res) => {
  try {
    const { data: workflow, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (error || !workflow) {
      return res.status(404).json({ error: 'Workflow introuvable' });
    }

    // Récupérer les dernières exécutions
    const { data: executions } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('workflow_id', workflow.id)
      .order('executed_at', { ascending: false })
      .limit(20);

    res.json({
      workflow,
      executions: executions || []
    });
  } catch (error) {
    console.error('[WORKFLOWS] Erreur détail:', error);
    res.status(500).json({ error: 'Erreur récupération workflow' });
  }
});

/**
 * POST /api/admin/workflows
 * Créer un nouveau workflow
 */
router.post('/', async (req, res) => {
  try {
    const { nom, description, trigger_type, config, template_id } = req.body;

    // Si template_id fourni, utiliser le template
    let workflowData;
    if (template_id) {
      const template = WORKFLOW_TEMPLATES.find(t => t.id === template_id);
      if (!template) {
        return res.status(400).json({ error: 'Template introuvable' });
      }
      workflowData = {
        tenant_id: req.admin.tenant_id,
        nom: template.nom,
        description: template.description,
        trigger_type: template.trigger_type,
        // Support des deux formats de structure
        config: template.config,
        actions: template.config?.actions || [],
        trigger_config: { conditions: template.config?.conditions || [] },
        actif: true
      };
    } else {
      // Validation
      if (!nom || !trigger_type) {
        return res.status(400).json({
          error: 'Champs requis : nom, trigger_type'
        });
      }

      // Vérifier que le trigger_type est valide
      if (!TRIGGER_TYPES.find(t => t.id === trigger_type)) {
        return res.status(400).json({
          error: `Trigger type invalide. Types disponibles: ${TRIGGER_TYPES.map(t => t.id).join(', ')}`
        });
      }

      workflowData = {
        tenant_id: req.admin.tenant_id,
        nom,
        description,
        trigger_type,
        // Support des deux formats
        config: config || {},
        actions: config?.actions || [],
        trigger_config: { conditions: config?.conditions || [] },
        actif: true
      };
    }

    const { data: workflow, error } = await supabase
      .from('workflows')
      .insert(workflowData)
      .select()
      .single();

    if (error) throw error;

    console.log(`[WORKFLOWS] Nouveau workflow créé: ${workflow.id} - ${workflow.nom}`);
    res.status(201).json(workflow);
  } catch (error) {
    console.error('[WORKFLOWS] Erreur création:', error);
    res.status(500).json({ error: 'Erreur création workflow' });
  }
});

/**
 * PUT /api/admin/workflows/:id
 * Mettre à jour un workflow
 */
router.put('/:id', async (req, res) => {
  try {
    const { nom, description, trigger_type, config, actif } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (nom !== undefined) updates.nom = nom;
    if (description !== undefined) updates.description = description;
    if (trigger_type !== undefined) updates.trigger_type = trigger_type;
    if (config !== undefined) updates.config = config;
    if (actif !== undefined) updates.actif = actif;

    const { data: workflow, error } = await supabase
      .from('workflows')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow introuvable' });
    }

    res.json(workflow);
  } catch (error) {
    console.error('[WORKFLOWS] Erreur mise à jour:', error);
    res.status(500).json({ error: 'Erreur mise à jour workflow' });
  }
});

/**
 * PATCH /api/admin/workflows/:id/toggle
 * Activer/désactiver un workflow
 */
router.patch('/:id/toggle', async (req, res) => {
  try {
    // Récupérer l'état actuel
    const { data: current } = await supabase
      .from('workflows')
      .select('actif')
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!current) {
      return res.status(404).json({ error: 'Workflow introuvable' });
    }

    // Inverser l'état
    const { data: workflow, error } = await supabase
      .from('workflows')
      .update({
        actif: !current.actif,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    console.log(`[WORKFLOWS] Workflow ${workflow.id} ${workflow.actif ? 'activé' : 'désactivé'}`);
    res.json(workflow);
  } catch (error) {
    console.error('[WORKFLOWS] Erreur toggle:', error);
    res.status(500).json({ error: 'Erreur activation/désactivation' });
  }
});

/**
 * DELETE /api/admin/workflows/:id
 * Supprimer un workflow
 */
router.delete('/:id', async (req, res) => {
  try {
    // Les executions seront supprimées en cascade (ON DELETE CASCADE)
    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;

    console.log(`[WORKFLOWS] Workflow ${req.params.id} supprimé`);
    res.json({ success: true });
  } catch (error) {
    console.error('[WORKFLOWS] Erreur suppression:', error);
    res.status(500).json({ error: 'Erreur suppression workflow' });
  }
});

/**
 * GET /api/admin/workflows/:id/executions
 * Historique des exécutions d'un workflow
 */
router.get('/:id/executions', async (req, res) => {
  try {
    const { page = 1, limit = 20, statut } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('workflow_executions')
      .select('*', { count: 'exact' })
      .eq('workflow_id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .order('executed_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (statut) {
      query = query.eq('statut', statut);
    }

    const { data: executions, error, count } = await query;

    if (error) throw error;

    res.json({
      executions: executions || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('[WORKFLOWS] Erreur historique:', error);
    res.status(500).json({ error: 'Erreur récupération historique' });
  }
});

/**
 * GET /api/admin/workflows/stats
 * Statistiques globales des workflows
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Nombre total de workflows
    const { count: totalWorkflows } = await supabase
      .from('workflows')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // Nombre de workflows actifs
    const { count: activeWorkflows } = await supabase
      .from('workflows')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('actif', true);

    // Exécutions ce mois
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: executionsThisMonth } = await supabase
      .from('workflow_executions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('executed_at', startOfMonth.toISOString());

    // Exécutions réussies ce mois
    const { count: successThisMonth } = await supabase
      .from('workflow_executions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('statut', 'success')
      .gte('executed_at', startOfMonth.toISOString());

    // Exécutions échouées ce mois
    const { count: failedThisMonth } = await supabase
      .from('workflow_executions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('statut', 'failed')
      .gte('executed_at', startOfMonth.toISOString());

    res.json({
      total_workflows: totalWorkflows || 0,
      active_workflows: activeWorkflows || 0,
      executions_this_month: executionsThisMonth || 0,
      success_this_month: successThisMonth || 0,
      failed_this_month: failedThisMonth || 0,
      success_rate: executionsThisMonth > 0
        ? Math.round((successThisMonth / executionsThisMonth) * 100)
        : 100
    });
  } catch (error) {
    console.error('[WORKFLOWS] Erreur stats:', error);
    res.status(500).json({ error: 'Erreur récupération stats' });
  }
});

export default router;
