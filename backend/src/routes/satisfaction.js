/**
 * Routes Enquêtes Satisfaction
 * - Templates à chaud / à froid
 * - Distribution auto (email/SMS)
 * - Collecte réponses publiques
 * - Reporting dashboard
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// Templates par défaut
const DEFAULT_TEMPLATES = {
  chaud: {
    titre: 'Satisfaction à chaud',
    description: 'Évaluation immédiate en fin de formation',
    questions: [
      { id: 'q1', type: 'rating', label: 'Comment évaluez-vous la qualité globale de la formation ?', max: 5 },
      { id: 'q2', type: 'rating', label: 'La formation a-t-elle répondu à vos attentes ?', max: 5 },
      { id: 'q3', type: 'rating', label: 'Comment évaluez-vous la pédagogie du formateur ?', max: 5 },
      { id: 'q4', type: 'rating', label: 'Les supports de formation étaient-ils adaptés ?', max: 5 },
      { id: 'q5', type: 'rating', label: 'L\'organisation logistique était-elle satisfaisante ?', max: 5 },
      { id: 'q6', type: 'textarea', label: 'Qu\'avez-vous le plus apprécié ?', required: false },
      { id: 'q7', type: 'textarea', label: 'Que pourrait-on améliorer ?', required: false },
      { id: 'q8', type: 'radio', label: 'Recommanderiez-vous cette formation ?', options: ['Oui', 'Non', 'Peut-être'] },
    ],
  },
  froid: {
    titre: 'Satisfaction à froid (6 mois)',
    description: 'Évaluation de l\'impact 6 mois après la formation',
    questions: [
      { id: 'q1', type: 'rating', label: 'Les compétences acquises vous sont-elles utiles au quotidien ?', max: 5 },
      { id: 'q2', type: 'rating', label: 'Avez-vous pu mettre en pratique ce que vous avez appris ?', max: 5 },
      { id: 'q3', type: 'rating', label: 'Quel impact la formation a-t-elle eu sur votre activité ?', max: 5 },
      { id: 'q4', type: 'textarea', label: 'Quels changements concrets avez-vous mis en place ?', required: false },
      { id: 'q5', type: 'textarea', label: 'Quels freins avez-vous rencontrés dans la mise en pratique ?', required: false },
      { id: 'q6', type: 'radio', label: 'Avez-vous besoin d\'un accompagnement complémentaire ?', options: ['Oui', 'Non'] },
    ],
  },
};

// ═══════════════════════════════════════════
// ROUTES PUBLIQUES (réponse enquête)
// ═══════════════════════════════════════════

/**
 * GET /api/satisfaction/public/:token
 * Récupère une enquête par token (lien unique)
 */
router.get('/public/:token', async (req, res) => {
  try {
    const { data: envoi, error } = await supabase
      .from('satisfaction_envois')
      .select('*, satisfaction_enquetes(*)')
      .eq('token', req.params.token)
      .single();

    if (error || !envoi) {
      return res.status(404).json({ success: false, error: 'Enquête non trouvée ou expirée' });
    }

    if (envoi.repondu) {
      return res.status(400).json({ success: false, error: 'Vous avez déjà répondu à cette enquête' });
    }

    const enquete = envoi.satisfaction_enquetes;
    res.json({
      success: true,
      enquete: {
        titre: enquete.titre,
        description: enquete.description,
        questions: enquete.questions,
        type: enquete.type,
      },
    });
  } catch (error) {
    console.error('[SATISFACTION] Erreur public get:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/satisfaction/public/:token
 * Soumettre les réponses
 */
router.post('/public/:token', async (req, res) => {
  try {
    const { answers } = req.body;
    if (!answers) return res.status(400).json({ success: false, error: 'Réponses requises' });

    const { data: envoi, error: eError } = await supabase
      .from('satisfaction_envois')
      .select('*')
      .eq('token', req.params.token)
      .single();

    if (eError || !envoi) {
      return res.status(404).json({ success: false, error: 'Enquête non trouvée' });
    }

    if (envoi.repondu) {
      return res.status(400).json({ success: false, error: 'Déjà répondu' });
    }

    // Sauvegarder les réponses
    const { error: rError } = await supabase
      .from('satisfaction_reponses')
      .insert({
        tenant_id: envoi.tenant_id,
        enquete_id: envoi.enquete_id,
        envoi_id: envoi.id,
        client_id: envoi.client_id,
        answers,
      });

    if (rError) throw rError;

    // Marquer comme répondu
    await supabase
      .from('satisfaction_envois')
      .update({ repondu: true, repondu_at: new Date().toISOString() })
      .eq('id', envoi.id)
      .eq('tenant_id', envoi.tenant_id);

    // Incrémenter compteur réponses
    await supabase.rpc('increment_counter', {
      table_name: 'satisfaction_enquetes',
      column_name: 'reponses_count',
      row_id: envoi.enquete_id,
    }).catch(() => {
      // Fallback si RPC n'existe pas
      supabase.from('satisfaction_enquetes')
        .select('reponses_count')
        .eq('id', envoi.enquete_id)
        .single()
        .then(({ data }) => {
          supabase.from('satisfaction_enquetes')
            .update({ reponses_count: (data?.reponses_count || 0) + 1 })
            .eq('id', envoi.enquete_id)
            .eq('tenant_id', envoi.tenant_id);
        });
    });

    res.json({ success: true, message: 'Merci pour votre retour !' });
  } catch (error) {
    console.error('[SATISFACTION] Erreur soumission:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════
// ROUTES ADMIN
// ═══════════════════════════════════════════

router.use('/admin', authenticateAdmin);

/**
 * GET /api/satisfaction/admin/templates
 * Templates par défaut
 */
router.get('/admin/templates', (req, res) => {
  res.json({ success: true, templates: DEFAULT_TEMPLATES });
});

/**
 * GET /api/satisfaction/admin/enquetes
 * Liste des enquêtes du tenant
 */
router.get('/admin/enquetes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { data, error } = await supabase
      .from('satisfaction_enquetes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, enquetes: data || [] });
  } catch (error) {
    console.error('[SATISFACTION] Erreur liste:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/satisfaction/admin/enquetes
 * Créer une enquête
 */
router.post('/admin/enquetes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { titre, description, type, questions } = req.body;

    if (!type || !['chaud', 'froid', 'custom'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Type requis: chaud, froid ou custom' });
    }

    const template = DEFAULT_TEMPLATES[type];
    const finalQuestions = questions || template?.questions || [];

    const { data, error } = await supabase
      .from('satisfaction_enquetes')
      .insert({
        tenant_id: tenantId,
        titre: titre || template?.titre || 'Enquête de satisfaction',
        description: description || template?.description || '',
        type,
        questions: finalQuestions,
        actif: true,
        envois_count: 0,
        reponses_count: 0,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, enquete: data });
  } catch (error) {
    console.error('[SATISFACTION] Erreur création:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/satisfaction/admin/enquetes/:id/send
 * Envoyer l'enquête à des clients
 */
router.post('/admin/enquetes/:id/send', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { client_ids, channel } = req.body;
    const sendChannel = channel || 'email';

    if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'client_ids requis (array)' });
    }

    // Récupérer l'enquête
    const { data: enquete } = await supabase
      .from('satisfaction_enquetes')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (!enquete) {
      return res.status(404).json({ success: false, error: 'Enquête non trouvée' });
    }

    // Récupérer les clients
    const { data: clients } = await supabase
      .from('clients')
      .select('id, prenom, nom, email, telephone')
      .eq('tenant_id', tenantId)
      .in('id', client_ids);

    let sentCount = 0;

    for (const client of (clients || [])) {
      // Générer un token unique
      const token = `sat_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      // Créer l'envoi
      await supabase.from('satisfaction_envois').insert({
        tenant_id: tenantId,
        enquete_id: enquete.id,
        client_id: client.id,
        token,
        channel: sendChannel,
        repondu: false,
      });

      const surveyUrl = `${process.env.LANDING_URL || 'https://nexus-ai-saas.com'}/satisfaction/${token}`;

      // Envoyer par email ou SMS
      if (sendChannel === 'email' && client.email) {
        try {
          const { sendEmail } = await import('../services/emailService.js');
          await sendEmail({
            to: client.email,
            subject: enquete.titre,
            html: `
              <p>Bonjour ${client.prenom || ''},</p>
              <p>${enquete.description || 'Nous aimerions avoir votre retour.'}</p>
              <p style="text-align: center; margin: 30px 0;">
                <a href="${surveyUrl}" style="background: #0891b2; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                  Donner mon avis
                </a>
              </p>
              <p>Cela ne prend que 2 minutes. Merci !</p>
            `,
          });
          sentCount++;
        } catch (e) {
          console.error(`[SATISFACTION] Erreur envoi email ${client.email}:`, e.message);
        }
      } else if (sendChannel === 'sms' && client.telephone) {
        try {
          const { sendSMS } = await import('../services/smsService.js');
          await sendSMS(
            client.telephone,
            `Bonjour ${client.prenom || ''}, donnez-nous votre avis en 2 min : ${surveyUrl}`,
            tenantId
          );
          sentCount++;
        } catch (e) {
          console.error(`[SATISFACTION] Erreur envoi SMS ${client.telephone}:`, e.message);
        }
      }
    }

    // Mettre à jour compteur envois
    await supabase
      .from('satisfaction_enquetes')
      .update({ envois_count: (enquete.envois_count || 0) + sentCount })
      .eq('id', enquete.id)
      .eq('tenant_id', tenantId);

    res.json({ success: true, sent: sentCount, total: client_ids.length });
  } catch (error) {
    console.error('[SATISFACTION] Erreur envoi:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/satisfaction/admin/enquetes/:id/results
 * Résultats d'une enquête
 */
router.get('/admin/enquetes/:id/results', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { data: reponses, error } = await supabase
      .from('satisfaction_reponses')
      .select('*, clients(prenom, nom)')
      .eq('tenant_id', tenantId)
      .eq('enquete_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Calcul des moyennes pour les questions rating
    const { data: enquete } = await supabase
      .from('satisfaction_enquetes')
      .select('questions')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    const questions = enquete?.questions || [];
    const stats = {};

    for (const q of questions) {
      if (q.type === 'rating') {
        const values = (reponses || [])
          .map(r => Number(r.answers?.[q.id]))
          .filter(v => !isNaN(v) && v > 0);

        stats[q.id] = {
          label: q.label,
          avg: values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : 0,
          count: values.length,
          distribution: Array.from({ length: q.max || 5 }, (_, i) => ({
            value: i + 1,
            count: values.filter(v => v === i + 1).length,
          })),
        };
      }
    }

    const globalAvg = Object.values(stats).length > 0
      ? (Object.values(stats).reduce((sum, s) => sum + Number(s.avg), 0) / Object.values(stats).length).toFixed(1)
      : 0;

    res.json({
      success: true,
      reponses: reponses || [],
      stats,
      global_average: globalAvg,
      total_responses: (reponses || []).length,
    });
  } catch (error) {
    console.error('[SATISFACTION] Erreur résultats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
