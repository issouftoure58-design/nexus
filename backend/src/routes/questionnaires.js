/**
 * Routes Questionnaires Qualification
 * - Admin CRUD (création/gestion formulaires)
 * - Public soumission (page publique)
 * - Scoring + routing pipeline
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { triggerWorkflows } from '../automation/workflowEngine.js';

const router = express.Router();

// ═══════════════════════════════════════════
// ROUTES PUBLIQUES (soumission formulaire)
// ═══════════════════════════════════════════

/**
 * GET /api/questionnaires/public/:slug
 * Récupère un questionnaire publié (page publique)
 */
router.get('/public/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const { data, error } = await supabase
      .from('questionnaires')
      .select('id, titre, description, questions, config, tenant_id')
      .eq('slug', slug)
      .eq('actif', true)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Questionnaire non trouvé' });
    }

    // Ne pas exposer le tenant_id au public
    const { tenant_id, ...publicData } = data;

    res.json({ success: true, questionnaire: publicData });
  } catch (error) {
    console.error('[QUESTIONNAIRES] Erreur public get:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/questionnaires/public/:slug/submit
 * Soumission d'un questionnaire (public)
 */
router.post('/public/:slug/submit', async (req, res) => {
  try {
    const { slug } = req.params;
    const { answers, contact } = req.body;

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ success: false, error: 'Réponses requises' });
    }

    // Récupérer le questionnaire
    const { data: questionnaire, error: qError } = await supabase
      .from('questionnaires')
      .select('*')
      .eq('slug', slug)
      .eq('actif', true)
      .single();

    if (qError || !questionnaire) {
      return res.status(404).json({ success: false, error: 'Questionnaire non trouvé' });
    }

    const tenantId = questionnaire.tenant_id;

    // Calculer le score
    const score = calculateScore(questionnaire.questions, answers);
    const threshold = questionnaire.config?.scoring_threshold || 60;
    const isQualified = score >= threshold;

    // Sauvegarder la soumission
    const { data: submission, error: sError } = await supabase
      .from('questionnaire_submissions')
      .insert({
        tenant_id: tenantId,
        questionnaire_id: questionnaire.id,
        answers,
        contact: contact || {},
        score,
        qualified: isQualified,
      })
      .select()
      .single();

    if (sError) throw sError;

    // Créer un prospect dans le CRM si contact fourni
    if (contact?.email || contact?.telephone) {
      const { data: client } = await supabase
        .from('clients')
        .insert({
          tenant_id: tenantId,
          prenom: contact.prenom || '',
          nom: contact.nom || '',
          email: contact.email || null,
          telephone: contact.telephone || null,
          source: 'questionnaire',
          tags: isQualified ? ['prospect', 'qualifié', 'questionnaire'] : ['prospect', 'questionnaire'],
          notes: `Score questionnaire: ${score}/${100}\nQualifié: ${isQualified ? 'Oui' : 'Non'}`,
        })
        .select()
        .single();

      if (client) {
        // Créer une opportunité si qualifié
        if (isQualified) {
          await supabase.from('opportunities').insert({
            tenant_id: tenantId,
            client_id: client.id,
            titre: `Questionnaire - ${contact.prenom || contact.email || 'Prospect'}`,
            etape: 'prospect',
            source: 'questionnaire',
            notes: `Score: ${score}`,
          });
        }

        // Déclencher un workflow
        const entity = {
          ...client,
          type: 'questionnaire',
          questionnaire_id: questionnaire.id,
          score,
          qualified: isQualified,
        };

        triggerWorkflows(isQualified ? 'payment_received' : 'new_client', {
          tenant_id: tenantId,
          entity,
        }).catch(e => console.error('[QUESTIONNAIRES] Workflow error:', e));
      }
    }

    // Incrémenter le compteur
    await supabase
      .from('questionnaires')
      .update({ submissions_count: (questionnaire.submissions_count || 0) + 1 })
      .eq('id', questionnaire.id)
      .eq('tenant_id', tenantId);

    res.json({
      success: true,
      score,
      qualified: isQualified,
      message: isQualified
        ? questionnaire.config?.qualified_message || 'Merci ! Vous êtes qualifié, nous vous recontactons rapidement.'
        : questionnaire.config?.not_qualified_message || 'Merci pour vos réponses ! Nous reviendrons vers vous.',
    });
  } catch (error) {
    console.error('[QUESTIONNAIRES] Erreur soumission:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════
// ROUTES ADMIN (CRUD)
// ═══════════════════════════════════════════

router.use('/admin', authenticateAdmin);

/**
 * GET /api/questionnaires/admin
 * Liste les questionnaires du tenant
 */
router.get('/admin', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { data, error } = await supabase
      .from('questionnaires')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, questionnaires: data || [] });
  } catch (error) {
    console.error('[QUESTIONNAIRES] Erreur liste:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/questionnaires/admin
 * Créer un questionnaire
 */
router.post('/admin', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { titre, description, questions, config } = req.body;

    if (!titre) return res.status(400).json({ success: false, error: 'Titre requis' });
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, error: 'Au moins une question requise' });
    }

    // Générer un slug unique
    const slug = titre
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);

    const { data, error } = await supabase
      .from('questionnaires')
      .insert({
        tenant_id: tenantId,
        titre,
        description: description || '',
        slug,
        questions,
        config: config || { scoring_threshold: 60 },
        actif: true,
        submissions_count: 0,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, questionnaire: data });
  } catch (error) {
    console.error('[QUESTIONNAIRES] Erreur création:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/questionnaires/admin/:id
 * Modifier un questionnaire
 */
router.put('/admin/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { titre, description, questions, config, actif } = req.body;
    const updates = {};
    if (titre !== undefined) updates.titre = titre;
    if (description !== undefined) updates.description = description;
    if (questions !== undefined) updates.questions = questions;
    if (config !== undefined) updates.config = config;
    if (actif !== undefined) updates.actif = actif;

    const { data, error } = await supabase
      .from('questionnaires')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, questionnaire: data });
  } catch (error) {
    console.error('[QUESTIONNAIRES] Erreur mise à jour:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/questionnaires/admin/:id
 * Supprimer un questionnaire
 */
router.delete('/admin/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { error } = await supabase
      .from('questionnaires')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('[QUESTIONNAIRES] Erreur suppression:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/questionnaires/admin/:id/submissions
 * Soumissions d'un questionnaire
 */
router.get('/admin/:id/submissions', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { data, error } = await supabase
      .from('questionnaire_submissions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('questionnaire_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({ success: true, submissions: data || [] });
  } catch (error) {
    console.error('[QUESTIONNAIRES] Erreur soumissions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════
// SCORING
// ═══════════════════════════════════════════

/**
 * Calcule le score d'une soumission
 * @param {Array} questions — définition des questions avec scoring
 * @param {Object} answers — réponses {question_id: value}
 * @returns {number} score 0-100
 */
function calculateScore(questions, answers) {
  if (!questions || !answers) return 0;

  let totalPoints = 0;
  let maxPoints = 0;

  for (const question of questions) {
    const answer = answers[question.id];
    maxPoints += question.max_points || 10;

    if (answer === undefined || answer === null || answer === '') continue;

    if (question.type === 'select' || question.type === 'radio') {
      // Choix avec points associés
      const selectedOption = (question.options || []).find(o => o.value === answer);
      totalPoints += selectedOption?.points || 0;
    } else if (question.type === 'number' || question.type === 'range') {
      // Valeur numérique avec seuils
      const num = Number(answer);
      const thresholds = question.scoring_thresholds || [];
      for (const t of thresholds) {
        if (num >= t.min && (t.max === undefined || num <= t.max)) {
          totalPoints += t.points || 0;
          break;
        }
      }
    } else if (question.type === 'text' || question.type === 'textarea') {
      // Texte — points pour avoir répondu + longueur
      if (answer.length > 0) totalPoints += Math.min(question.max_points || 5, 5);
      if (answer.length > 50) totalPoints += 2;
    } else if (question.type === 'checkbox') {
      // Multi-select — points par option cochée
      if (Array.isArray(answer)) {
        for (const val of answer) {
          const opt = (question.options || []).find(o => o.value === val);
          totalPoints += opt?.points || 0;
        }
      }
    }
  }

  return maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;
}

export default router;
