/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES MARKETING - Workflows + Campagnes A/B + Analytics         ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║   POSTS SOCIAUX                                                    ║
 * ║   GET/POST /api/marketing/posts      - Liste/Créer posts           ║
 * ║   GET/PUT/DELETE /api/marketing/posts/:id - CRUD post              ║
 * ║   WORKFLOWS AUTOMATION                                             ║
 * ║   POST /api/marketing/workflows         - Créer workflow           ║
 * ║   GET  /api/marketing/workflows         - Liste workflows          ║
 * ║   GET  /api/marketing/workflows/stats   - Stats workflows          ║
 * ║   POST /api/marketing/workflows/:id/toggle - Activer/Désactiver   ║
 * ║   POST /api/marketing/workflows/:id/test   - Test manuel          ║
 * ║   EMAIL TEMPLATES                                                  ║
 * ║   POST/GET /api/marketing/email-templates - CRUD templates         ║
 * ║   CAMPAGNES A/B TESTING                                            ║
 * ║   POST /api/marketing/campagnes         - Créer campagne           ║
 * ║   GET  /api/marketing/campagnes         - Liste campagnes          ║
 * ║   GET  /api/marketing/campagnes/:id     - Détail + analytics       ║
 * ║   POST /api/marketing/campagnes/:id/start - Démarrer               ║
 * ║   POST /api/marketing/campagnes/:id/stop  - Arrêter                ║
 * ║   POST /api/marketing/campagnes/:id/declare-winner - Gagnant       ║
 * ║   TRACKING & ANALYTICS                                             ║
 * ║   POST /api/marketing/tracking/event       - Événement tracking    ║
 * ║   POST /api/marketing/tracking/create-link - Créer lien tracké     ║
 * ║   GET  /api/marketing/track/:token         - Redirection (public)  ║
 * ║   GET  /api/marketing/analytics/overview   - Stats globales        ║
 * ║   GET  /api/marketing/analytics/evolution  - Évolution période     ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/checkPlan.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════
// ROUTE PUBLIQUE (avant auth) - Redirection lien tracké
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/marketing/track/:token
 * Redirection lien tracké (PUBLIC - pas d'auth)
 */
router.get('/track/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const { data: link, error } = await supabase
      .from('tracked_links')
      .select('*')
      .eq('token', token)
      .single();

    if (error || !link) {
      return res.status(404).send('Lien non trouvé');
    }

    // Incrémenter compteur
    await supabase
      .from('tracked_links')
      .update({ nb_clics: (link.nb_clics || 0) + 1 })
      .eq('id', link.id);

    // Enregistrer événement clic
    await supabase
      .from('tracking_events')
      .insert({
        tenant_id: link.tenant_id,
        campagne_id: link.campagne_id,
        workflow_execution_id: link.workflow_execution_id,
        event_type: 'clic',
        metadata: {
          url: link.url_originale,
          user_agent: req.headers['user-agent'],
        },
      });

    console.log(`[TRACKING] Clic lien: ${link.url_originale}`);

    // Rediriger
    res.redirect(link.url_originale);
  } catch (error) {
    console.error('[MARKETING] Erreur redirection tracking:', error);
    res.status(500).send('Erreur serveur');
  }
});

// ═══════════════════════════════════════════════════════════
// ROUTES PROTÉGÉES (après auth)
// ═══════════════════════════════════════════════════════════

// Middleware auth admin
router.use(authenticateAdmin);

// Middleware verification plan (marketing = Pro+)
router.use(requireModule('marketing'));

// Types et occasions valides
const TYPES_VALIDES = ['instagram', 'facebook', 'linkedin', 'twitter'];
const OCCASIONS_VALIDES = ['promo', 'nouveaute', 'evenement', 'inspiration', 'temoignage', 'conseil'];
const TONES_VALIDES = ['professionnel', 'fun', 'inspirant', 'informatif'];
const STATUTS_VALIDES = ['brouillon', 'publie', 'programme', 'archive'];

/**
 * GET /api/marketing/posts
 * Liste des posts marketing avec filtres
 */
router.get('/posts', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { statut, type, occasion, limit = 50 } = req.query;

    let query = supabase
      .from('posts_marketing')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (statut && STATUTS_VALIDES.includes(statut)) {
      query = query.eq('statut', statut);
    }
    if (type && TYPES_VALIDES.includes(type)) {
      query = query.eq('type', type);
    }
    if (occasion && OCCASIONS_VALIDES.includes(occasion)) {
      query = query.eq('occasion', occasion);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      posts: data,
      count: data.length
    });
  } catch (error) {
    console.error('[MARKETING] Erreur liste posts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/marketing/posts/:id
 * Détail d'un post
 */
router.get('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;

    const { data, error } = await supabase
      .from('posts_marketing')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, error: 'Post non trouvé' });
    }

    res.json({ success: true, post: data });
  } catch (error) {
    console.error('[MARKETING] Erreur détail post:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/marketing/posts
 * Créer un nouveau post
 */
router.post('/posts', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      type,
      titre,
      contenu,
      hashtags,
      emojis,
      image_url,
      image_description,
      occasion,
      tone,
      date_publication,
      statut
    } = req.body;

    // Validation
    if (!type || !TYPES_VALIDES.includes(type)) {
      return res.status(400).json({ success: false, error: 'Type invalide (instagram, facebook, linkedin, twitter)' });
    }
    if (!contenu || contenu.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Contenu requis' });
    }

    const { data, error } = await supabase
      .from('posts_marketing')
      .insert({
        tenant_id: tenantId,
        type,
        titre: titre?.trim() || null,
        contenu: contenu.trim(),
        hashtags: Array.isArray(hashtags) ? hashtags : null,
        emojis: Array.isArray(emojis) ? emojis : null,
        image_url: image_url || null,
        image_description: image_description || null,
        occasion: occasion && OCCASIONS_VALIDES.includes(occasion) ? occasion : null,
        tone: tone && TONES_VALIDES.includes(tone) ? tone : null,
        date_publication: date_publication || null,
        statut: statut && STATUTS_VALIDES.includes(statut) ? statut : 'brouillon'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, post: data });
  } catch (error) {
    console.error('[MARKETING] Erreur création post:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/marketing/posts/:id
 * Modifier un post
 */
router.put('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const updates = {};

    // Champs modifiables
    const { type, titre, contenu, hashtags, emojis, image_url, image_description, occasion, tone, date_publication, statut } = req.body;

    if (type && TYPES_VALIDES.includes(type)) updates.type = type;
    if (titre !== undefined) updates.titre = titre?.trim() || null;
    if (contenu) updates.contenu = contenu.trim();
    if (hashtags !== undefined) updates.hashtags = Array.isArray(hashtags) ? hashtags : null;
    if (emojis !== undefined) updates.emojis = Array.isArray(emojis) ? emojis : null;
    if (image_url !== undefined) updates.image_url = image_url || null;
    if (image_description !== undefined) updates.image_description = image_description || null;
    if (occasion !== undefined) updates.occasion = occasion && OCCASIONS_VALIDES.includes(occasion) ? occasion : null;
    if (tone !== undefined) updates.tone = tone && TONES_VALIDES.includes(tone) ? tone : null;
    if (date_publication !== undefined) updates.date_publication = date_publication || null;
    if (statut && STATUTS_VALIDES.includes(statut)) updates.statut = statut;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'Aucune modification fournie' });
    }

    const { data, error } = await supabase
      .from('posts_marketing')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, error: 'Post non trouvé' });
    }

    res.json({ success: true, post: data });
  } catch (error) {
    console.error('[MARKETING] Erreur modification post:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/marketing/posts/:id/statut
 * Changer le statut d'un post
 */
router.patch('/posts/:id/statut', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const { statut } = req.body;

    if (!statut || !STATUTS_VALIDES.includes(statut)) {
      return res.status(400).json({ success: false, error: 'Statut invalide' });
    }

    const updates = { statut };
    if (statut === 'publie') {
      updates.date_publication = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('posts_marketing')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, post: data });
  } catch (error) {
    console.error('[MARKETING] Erreur changement statut:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/marketing/posts/:id
 * Supprimer un post
 */
router.delete('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;

    const { error } = await supabase
      .from('posts_marketing')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Post supprimé' });
  } catch (error) {
    console.error('[MARKETING] Erreur suppression post:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/marketing/stats
 * Statistiques des posts
 */
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: posts, error } = await supabase
      .from('posts_marketing')
      .select('statut, type, occasion')
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Agrégations
    const parStatut = {};
    const parType = {};
    const parOccasion = {};

    posts.forEach(p => {
      parStatut[p.statut] = (parStatut[p.statut] || 0) + 1;
      parType[p.type] = (parType[p.type] || 0) + 1;
      if (p.occasion) parOccasion[p.occasion] = (parOccasion[p.occasion] || 0) + 1;
    });

    res.json({
      success: true,
      stats: {
        total: posts.length,
        par_statut: parStatut,
        par_type: parType,
        par_occasion: parOccasion
      }
    });
  } catch (error) {
    console.error('[MARKETING] Erreur stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// WORKFLOWS AUTOMATION
// ═══════════════════════════════════════════════════════════

// Types de triggers disponibles
const TRIGGER_TYPES = {
  nouveau_client: 'Nouveau client créé',
  apres_rdv: 'Après un RDV terminé',
  rdv_annule: 'RDV annulé',
  inactif_X_jours: 'Client inactif X jours',
  anniversaire_client: 'Anniversaire client',
  panier_abandonne: 'Panier abandonné',
  objectif_ca_atteint: 'Objectif CA atteint',
  tag_ajoute: 'Tag ajouté à un client',
};

/**
 * POST /api/marketing/workflows
 * Créer un nouveau workflow
 */
router.post('/workflows', async (req, res) => {
  try {
    const { nom, description, trigger_type, trigger_config, actions } = req.body;
    const tenantId = req.admin.tenant_id;

    if (!nom || !trigger_type || !actions || actions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nom, trigger_type et au moins une action requis',
      });
    }

    if (!TRIGGER_TYPES[trigger_type]) {
      return res.status(400).json({
        success: false,
        error: `Trigger type invalide. Valides: ${Object.keys(TRIGGER_TYPES).join(', ')}`,
      });
    }

    const { data: workflow, error } = await supabase
      .from('workflows')
      .insert({
        tenant_id: tenantId,
        nom,
        description: description || null,
        trigger_type,
        trigger_config: trigger_config || {},
        actions,
        actif: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '42P01') {
        return res.status(500).json({
          success: false,
          error: 'Table workflows non trouvée. Exécutez la migration SQL.',
        });
      }
      throw error;
    }

    console.log(`[MARKETING] Workflow créé: ${nom} (trigger: ${trigger_type})`);

    res.json({ success: true, workflow });
  } catch (error) {
    console.error('[MARKETING] Erreur création workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/marketing/workflows
 * Liste tous les workflows du tenant
 */
router.get('/workflows', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: workflows, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        return res.json({ success: true, workflows: [] });
      }
      throw error;
    }

    res.json({ success: true, workflows: workflows || [] });
  } catch (error) {
    console.error('[MARKETING] Erreur liste workflows:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/marketing/workflows/stats
 * Statistiques workflows
 */
router.get('/workflows/stats', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: workflows } = await supabase
      .from('workflows')
      .select('actif')
      .eq('tenant_id', tenantId);

    const { data: executions } = await supabase
      .from('workflow_executions')
      .select('statut')
      .eq('tenant_id', tenantId);

    const stats = {
      total_workflows: workflows?.length || 0,
      workflows_actifs: workflows?.filter(w => w.actif).length || 0,
      total_executions: executions?.length || 0,
      executions_reussies: executions?.filter(e => e.statut === 'termine').length || 0,
      executions_erreur: executions?.filter(e => e.statut === 'erreur').length || 0,
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('[MARKETING] Erreur stats workflows:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/marketing/workflows/:id
 * Détail d'un workflow avec historique
 */
router.get('/workflows/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (workflowError) {
      return res.status(404).json({ success: false, error: 'Workflow non trouvé' });
    }

    const { data: executions } = await supabase
      .from('workflow_executions')
      .select('*, clients(nom, prenom)')
      .eq('workflow_id', id)
      .order('started_at', { ascending: false })
      .limit(20);

    res.json({ success: true, workflow, executions: executions || [] });
  } catch (error) {
    console.error('[MARKETING] Erreur détail workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/marketing/workflows/:id
 * Modifier un workflow
 */
router.patch('/workflows/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { nom, description, trigger_config, actions, actif } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (nom !== undefined) updates.nom = nom;
    if (description !== undefined) updates.description = description;
    if (trigger_config !== undefined) updates.trigger_config = trigger_config;
    if (actions !== undefined) updates.actions = actions;
    if (actif !== undefined) updates.actif = actif;

    const { data: workflow, error } = await supabase
      .from('workflows')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    console.log(`[MARKETING] Workflow modifié: ${workflow.nom}`);

    res.json({ success: true, workflow });
  } catch (error) {
    console.error('[MARKETING] Erreur modification workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/marketing/workflows/:id
 * Supprimer un workflow
 */
router.delete('/workflows/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    console.log(`[MARKETING] Workflow supprimé: ${id}`);

    res.json({ success: true, message: 'Workflow supprimé' });
  } catch (error) {
    console.error('[MARKETING] Erreur suppression workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/marketing/workflows/:id/toggle
 * Activer/Désactiver un workflow
 */
router.post('/workflows/:id/toggle', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: workflow, error: fetchError } = await supabase
      .from('workflows')
      .select('actif, nom')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !workflow) {
      return res.status(404).json({ success: false, error: 'Workflow non trouvé' });
    }

    const { data: updated, error } = await supabase
      .from('workflows')
      .update({ actif: !workflow.actif, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    console.log(`[MARKETING] Workflow ${updated.actif ? 'activé' : 'désactivé'}: ${workflow.nom}`);

    res.json({
      success: true,
      workflow: updated,
      message: updated.actif ? 'Workflow activé' : 'Workflow désactivé',
    });
  } catch (error) {
    console.error('[MARKETING] Erreur toggle workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/marketing/workflows/:id/test
 * Tester un workflow manuellement sur un client
 */
router.post('/workflows/:id/test', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { client_id } = req.body;

    if (!client_id) {
      return res.status(400).json({ success: false, error: 'client_id requis' });
    }

    const { data: workflow } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow non trouvé' });
    }

    const { data: client } = await supabase
      .from('clients')
      .select('id, nom, prenom')
      .eq('id', client_id)
      .eq('tenant_id', tenantId)
      .single();

    if (!client) {
      return res.status(404).json({ success: false, error: 'Client non trouvé' });
    }

    const { data: execution, error: execError } = await supabase
      .from('workflow_executions')
      .insert({
        workflow_id: id,
        client_id,
        tenant_id: tenantId,
        trigger_data: { type: 'test_manuel', admin: req.admin.email },
        statut: 'en_cours',
      })
      .select()
      .single();

    if (execError) throw execError;

    // Exécuter actions (asynchrone)
    executeWorkflowActions(execution.id, workflow, client_id, tenantId);

    console.log(`[MARKETING] Test workflow ${workflow.nom} sur ${client.prenom} ${client.nom}`);

    res.json({
      success: true,
      execution_id: execution.id,
      message: `Test lancé sur ${client.prenom} ${client.nom}`,
    });
  } catch (error) {
    console.error('[MARKETING] Erreur test workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/marketing/workflows/:id/executions
 * Historique exécutions d'un workflow
 */
router.get('/workflows/:id/executions', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const { data: executions, error } = await supabase
      .from('workflow_executions')
      .select('*, clients(nom, prenom, email)')
      .eq('workflow_id', id)
      .eq('tenant_id', tenantId)
      .order('started_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    res.json({ success: true, executions: executions || [] });
  } catch (error) {
    console.error('[MARKETING] Erreur liste exécutions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/marketing/email-templates
 * Créer un template email
 */
router.post('/email-templates', async (req, res) => {
  try {
    const { nom, sujet, corps } = req.body;
    const tenantId = req.admin.tenant_id;

    if (!nom || !sujet || !corps) {
      return res.status(400).json({ success: false, error: 'Nom, sujet et corps requis' });
    }

    const { data: template, error } = await supabase
      .from('email_templates')
      .insert({ tenant_id: tenantId, nom, sujet, corps })
      .select()
      .single();

    if (error) throw error;

    console.log(`[MARKETING] Template email créé: ${nom}`);

    res.json({ success: true, template });
  } catch (error) {
    console.error('[MARKETING] Erreur création template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/marketing/email-templates
 * Liste des templates email
 */
router.get('/email-templates', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: templates, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        return res.json({ success: true, templates: [] });
      }
      throw error;
    }

    res.json({ success: true, templates: templates || [] });
  } catch (error) {
    console.error('[MARKETING] Erreur liste templates:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/marketing/email-templates/:id
 * Supprimer un template email
 */
router.delete('/email-templates/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Template supprimé' });
  } catch (error) {
    console.error('[MARKETING] Erreur suppression template:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// EXÉCUTION WORKFLOW (HELPER)
// ═══════════════════════════════════════════════════════════

async function executeWorkflowActions(executionId, workflow, clientId, tenantId) {
  try {
    console.log(`[MARKETING] Exécution workflow "${workflow.nom}" pour client ${clientId}`);

    const actionsExecutees = [];

    const { data: client } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (!client) throw new Error('Client non trouvé');

    for (const action of workflow.actions) {
      try {
        if (action.delay_minutes > 0) {
          console.log(`[MARKETING] Délai ${action.delay_minutes} min (ignoré en test)`);
        }

        let resultat = null;

        switch (action.type) {
          case 'email':
            console.log(`[MARKETING] 📧 Email → ${client.email || 'pas d\'email'}`);
            resultat = { envoye: !!client.email, destinataire: client.email };
            break;
          case 'sms':
            console.log(`[MARKETING] 📱 SMS → ${client.telephone || 'pas de tél'}`);
            resultat = { envoye: !!client.telephone, destinataire: client.telephone, message: action.message };
            break;
          case 'tag':
            console.log(`[MARKETING] 🏷️ Tag ${action.tag_id}`);
            if (action.tag_id) {
              const { error: tagError } = await supabase
                .from('client_tags')
                .insert({ client_id: clientId, tag_id: action.tag_id });
              resultat = { ajoute: !tagError || tagError.code === '23505' };
            }
            break;
          case 'notification':
            console.log(`[MARKETING] 🔔 Notification: ${action.message}`);
            resultat = { notifie: true, message: action.message };
            break;
          default:
            resultat = { skipped: true, reason: 'Type inconnu' };
        }

        actionsExecutees.push({
          type: action.type,
          statut: 'execute',
          timestamp: new Date().toISOString(),
          resultat,
        });
      } catch (actionError) {
        console.error(`[MARKETING] Erreur action ${action.type}:`, actionError);
        actionsExecutees.push({
          type: action.type,
          statut: 'erreur',
          timestamp: new Date().toISOString(),
          erreur: actionError.message,
        });
      }
    }

    await supabase
      .from('workflow_executions')
      .update({
        statut: 'termine',
        actions_executees: actionsExecutees,
        completed_at: new Date().toISOString(),
      })
      .eq('id', executionId);

    const { data: currentWorkflow } = await supabase
      .from('workflows')
      .select('nb_executions')
      .eq('id', workflow.id)
      .single();

    await supabase
      .from('workflows')
      .update({
        nb_executions: (currentWorkflow?.nb_executions || 0) + 1,
        derniere_execution: new Date().toISOString(),
      })
      .eq('id', workflow.id);

    console.log(`[MARKETING] Workflow "${workflow.nom}" terminé - ${actionsExecutees.length} actions`);
  } catch (error) {
    console.error('[MARKETING] Erreur exécution workflow:', error);
    await supabase
      .from('workflow_executions')
      .update({
        statut: 'erreur',
        erreur_message: error.message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', executionId);
  }
}

// ═══════════════════════════════════════════════════════════
// CAMPAGNES A/B TESTING
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/marketing/campagnes
 * Créer une campagne marketing
 */
router.post('/campagnes', async (req, res) => {
  try {
    const { nom, description, type, ab_testing_actif, variantes } = req.body;
    const tenantId = req.admin.tenant_id;

    if (!nom || !type) {
      return res.status(400).json({ success: false, error: 'Nom et type requis' });
    }

    // Vérifier poids variantes = 100%
    if (ab_testing_actif && variantes && variantes.length > 0) {
      const totalPoids = variantes.reduce((sum, v) => sum + (v.poids || 0), 0);
      if (totalPoids !== 100) {
        return res.status(400).json({
          success: false,
          error: `Poids total des variantes doit = 100% (actuel: ${totalPoids}%)`
        });
      }
    }

    const { data: campagne, error } = await supabase
      .from('campagnes')
      .insert({
        tenant_id: tenantId,
        nom,
        description: description || null,
        type,
        ab_testing_actif: ab_testing_actif || false,
        variantes: variantes || [],
        statut: 'brouillon',
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[MARKETING] Campagne créée: ${nom} (A/B: ${ab_testing_actif})`);

    res.json({ success: true, campagne });
  } catch (error) {
    console.error('[MARKETING] Erreur création campagne:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/marketing/campagnes
 * Liste des campagnes
 */
router.get('/campagnes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: campagnes, error } = await supabase
      .from('campagnes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, campagnes: campagnes || [] });
  } catch (error) {
    console.error('[MARKETING] Erreur liste campagnes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/marketing/campagnes/:id
 * Détail campagne avec analytics par variante
 */
router.get('/campagnes/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: campagne, error } = await supabase
      .from('campagnes')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !campagne) {
      return res.status(404).json({ success: false, error: 'Campagne non trouvée' });
    }

    // Analytics par variante
    const analytics = await Promise.all(
      (campagne.variantes || []).map(async (variante) => {
        const { data: events } = await supabase
          .from('tracking_events')
          .select('event_type')
          .eq('campagne_id', id)
          .eq('variante_nom', variante.nom);

        const envois = events?.filter(e => e.event_type === 'envoi').length || 0;
        const ouvertures = events?.filter(e => e.event_type === 'ouverture').length || 0;
        const clics = events?.filter(e => e.event_type === 'clic').length || 0;
        const conversions = events?.filter(e => e.event_type === 'conversion').length || 0;

        return {
          ...variante,
          envois,
          ouvertures,
          clics,
          conversions,
          taux_ouverture: envois > 0 ? ((ouvertures / envois) * 100).toFixed(2) : 0,
          taux_clic: ouvertures > 0 ? ((clics / ouvertures) * 100).toFixed(2) : 0,
          taux_conversion: envois > 0 ? ((conversions / envois) * 100).toFixed(2) : 0,
        };
      })
    );

    res.json({
      success: true,
      campagne: { ...campagne, analytics },
    });
  } catch (error) {
    console.error('[MARKETING] Erreur détail campagne:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/marketing/campagnes/:id/start
 * Démarrer une campagne
 */
router.post('/campagnes/:id/start', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: campagne, error } = await supabase
      .from('campagnes')
      .update({
        statut: 'en_cours',
        date_debut: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    console.log(`[MARKETING] Campagne démarrée: ${campagne.nom}`);

    res.json({ success: true, campagne, message: 'Campagne démarrée' });
  } catch (error) {
    console.error('[MARKETING] Erreur démarrage campagne:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/marketing/campagnes/:id/stop
 * Arrêter une campagne
 */
router.post('/campagnes/:id/stop', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: campagne, error } = await supabase
      .from('campagnes')
      .update({
        statut: 'termine',
        date_fin: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    console.log(`[MARKETING] Campagne terminée: ${campagne.nom}`);

    res.json({ success: true, campagne, message: 'Campagne terminée' });
  } catch (error) {
    console.error('[MARKETING] Erreur arrêt campagne:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/marketing/campagnes/:id/declare-winner
 * Déclarer variante gagnante
 */
router.post('/campagnes/:id/declare-winner', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { variante_nom } = req.body;

    if (!variante_nom) {
      return res.status(400).json({ success: false, error: 'variante_nom requis' });
    }

    const { data: campagne, error } = await supabase
      .from('campagnes')
      .update({
        variante_gagnante: variante_nom,
        statut: 'termine',
        date_fin: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    console.log(`[MARKETING] Variante gagnante: ${variante_nom} (campagne ${campagne.nom})`);

    res.json({
      success: true,
      campagne,
      message: `Variante "${variante_nom}" déclarée gagnante`,
    });
  } catch (error) {
    console.error('[MARKETING] Erreur déclaration gagnant:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/marketing/campagnes/:id
 * Supprimer une campagne
 */
router.delete('/campagnes/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('campagnes')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Campagne supprimée' });
  } catch (error) {
    console.error('[MARKETING] Erreur suppression campagne:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// TRACKING & ANALYTICS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/marketing/tracking/event
 * Enregistrer un événement tracking
 */
router.post('/tracking/event', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      campagne_id,
      workflow_execution_id,
      client_id,
      variante_nom,
      event_type,
      metadata
    } = req.body;

    if (!event_type) {
      return res.status(400).json({ success: false, error: 'event_type requis' });
    }

    const { data: event, error } = await supabase
      .from('tracking_events')
      .insert({
        tenant_id: tenantId,
        campagne_id: campagne_id || null,
        workflow_execution_id: workflow_execution_id || null,
        client_id: client_id || null,
        variante_nom: variante_nom || null,
        event_type,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    // Incrémenter compteurs campagne si applicable
    if (campagne_id) {
      const fieldMap = {
        'envoi': 'total_envois',
        'ouverture': 'total_ouvertures',
        'clic': 'total_clics',
        'conversion': 'total_conversions',
      };

      const incrementField = fieldMap[event_type];
      if (incrementField) {
        const { data: campagne } = await supabase
          .from('campagnes')
          .select(incrementField)
          .eq('id', campagne_id)
          .single();

        if (campagne) {
          await supabase
            .from('campagnes')
            .update({ [incrementField]: (campagne[incrementField] || 0) + 1 })
            .eq('id', campagne_id);
        }
      }
    }

    res.json({ success: true, event });
  } catch (error) {
    console.error('[MARKETING] Erreur tracking event:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/marketing/tracking/create-link
 * Créer un lien tracké
 */
router.post('/tracking/create-link', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { url_originale, campagne_id, workflow_execution_id } = req.body;

    if (!url_originale) {
      return res.status(400).json({ success: false, error: 'url_originale requise' });
    }

    // Générer token unique
    const token = Math.random().toString(36).substring(2, 15) +
                  Math.random().toString(36).substring(2, 15);

    const { data: link, error } = await supabase
      .from('tracked_links')
      .insert({
        tenant_id: tenantId,
        campagne_id: campagne_id || null,
        workflow_execution_id: workflow_execution_id || null,
        url_originale,
        token,
      })
      .select()
      .single();

    if (error) throw error;

    const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const trackedUrl = `${baseUrl}/api/marketing/track/${token}`;

    res.json({ success: true, link, tracked_url: trackedUrl });
  } catch (error) {
    console.error('[MARKETING] Erreur création lien tracké:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/marketing/analytics/overview
 * Analytics globales
 */
router.get('/analytics/overview', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { periode = '30' } = req.query;

    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - parseInt(periode));

    // Événements période
    const { data: events } = await supabase
      .from('tracking_events')
      .select('event_type, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateDebut.toISOString());

    const stats = {
      envois: events?.filter(e => e.event_type === 'envoi').length || 0,
      ouvertures: events?.filter(e => e.event_type === 'ouverture').length || 0,
      clics: events?.filter(e => e.event_type === 'clic').length || 0,
      conversions: events?.filter(e => e.event_type === 'conversion').length || 0,
    };

    stats.taux_ouverture = stats.envois > 0
      ? ((stats.ouvertures / stats.envois) * 100).toFixed(2)
      : 0;
    stats.taux_clic = stats.ouvertures > 0
      ? ((stats.clics / stats.ouvertures) * 100).toFixed(2)
      : 0;
    stats.taux_conversion = stats.envois > 0
      ? ((stats.conversions / stats.envois) * 100).toFixed(2)
      : 0;

    // Top campagnes
    const { data: campagnes } = await supabase
      .from('campagnes')
      .select('id, nom, total_envois, total_ouvertures, total_clics, total_conversions')
      .eq('tenant_id', tenantId)
      .order('total_envois', { ascending: false })
      .limit(5);

    // Stats campagnes
    const { data: allCampagnes } = await supabase
      .from('campagnes')
      .select('statut')
      .eq('tenant_id', tenantId);

    const campagneStats = {
      total: allCampagnes?.length || 0,
      en_cours: allCampagnes?.filter(c => c.statut === 'en_cours').length || 0,
      terminees: allCampagnes?.filter(c => c.statut === 'termine').length || 0,
    };

    res.json({
      success: true,
      periode: parseInt(periode),
      stats,
      campagnes: campagneStats,
      top_campagnes: campagnes || [],
    });
  } catch (error) {
    console.error('[MARKETING] Erreur analytics overview:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/marketing/analytics/evolution
 * Évolution sur la période
 */
router.get('/analytics/evolution', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { periode = '30' } = req.query;

    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - parseInt(periode));

    const { data: events } = await supabase
      .from('tracking_events')
      .select('event_type, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', dateDebut.toISOString())
      .order('created_at', { ascending: true });

    // Grouper par jour
    const parJour = {};
    (events || []).forEach(e => {
      const jour = e.created_at.split('T')[0];
      if (!parJour[jour]) {
        parJour[jour] = { envois: 0, ouvertures: 0, clics: 0, conversions: 0 };
      }
      parJour[jour][e.event_type === 'envoi' ? 'envois' :
                    e.event_type === 'ouverture' ? 'ouvertures' :
                    e.event_type === 'clic' ? 'clics' : 'conversions']++;
    });

    const evolution = Object.entries(parJour).map(([date, stats]) => ({
      date,
      ...stats,
    }));

    res.json({ success: true, evolution });
  } catch (error) {
    console.error('[MARKETING] Erreur analytics evolution:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Déclenche les workflows correspondant à un événement
 * Usage: import { triggerWorkflows } from './marketing.js';
 */
export async function triggerWorkflows(triggerType, clientId, tenantId, triggerData = {}) {
  try {
    const { data: workflows } = await supabase
      .from('workflows')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('trigger_type', triggerType)
      .eq('actif', true);

    if (!workflows || workflows.length === 0) return { triggered: 0 };

    console.log(`[MARKETING] Trigger ${triggerType}: ${workflows.length} workflow(s)`);

    let triggered = 0;
    for (const workflow of workflows) {
      try {
        const { data: execution } = await supabase
          .from('workflow_executions')
          .insert({
            workflow_id: workflow.id,
            client_id: clientId,
            tenant_id: tenantId,
            trigger_data: { type: triggerType, ...triggerData },
            statut: 'en_cours',
          })
          .select()
          .single();

        if (execution) {
          executeWorkflowActions(execution.id, workflow, clientId, tenantId);
          triggered++;
        }
      } catch (err) {
        console.error(`[MARKETING] Erreur trigger workflow ${workflow.id}:`, err);
      }
    }

    return { triggered };
  } catch (error) {
    console.error('[MARKETING] Erreur triggerWorkflows:', error);
    return { triggered: 0, error: error.message };
  }
}

export default router;
