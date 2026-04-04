/**
 * Routes API — Onboarding Sequences (Enrollments post-paiement)
 * Plan Business Feature
 *
 * GET    /api/admin/onboarding-sequences       — Liste des enrollments (pagine)
 * GET    /api/admin/onboarding-sequences/stats  — Stats globales
 * GET    /api/admin/onboarding-sequences/:id    — Detail d'un enrollment
 * POST   /api/admin/onboarding-sequences/:id/cancel — Annuler
 * POST   /api/admin/onboarding-sequences/:id/retry  — Relancer
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/checkPlan.js';
import {
  getEnrollments,
  getEnrollmentStats,
  cancelEnrollment,
  retryEnrollment,
  createEnrollment,
} from '../services/onboardingEnrollmentService.js';
import { triggerWorkflows } from '../automation/workflowEngine.js';

const router = express.Router();

router.use(authenticateAdmin, requireModule('marketing'));

/**
 * POST / — Declenchement manuel "Paiement recu"
 * Body: { client_email, client_name?, amount?, notes? }
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { client_email, client_name, amount, notes } = req.body;

    if (!client_email) {
      return res.status(400).json({ error: 'client_email requis' });
    }

    // Creer l'enrollment
    const enrollment = await createEnrollment(tenantId, {
      clientEmail: client_email,
      clientName: client_name || null,
      metadata: {
        trigger: 'manual_payment',
        amount: amount || null,
        notes: notes || null,
        triggered_by: req.admin.email,
        triggered_at: new Date().toISOString(),
      },
    });

    // Declencher les workflows payment_received
    await triggerWorkflows('payment_received', {
      tenant_id: tenantId,
      entity: {
        type: 'client',
        id: enrollment.id,
        email: client_email,
        nom: client_name || '',
        prenom: client_name?.split(' ')[0] || '',
        amount: amount || null,
        notes: notes || null,
      },
    });

    console.log(`[ONBOARDING-SEQ] Paiement manuel declenche pour ${client_email} (tenant: ${tenantId})`);
    res.json({ success: true, enrollment });
  } catch (error) {
    console.error('[ONBOARDING-SEQ] Erreur paiement manuel:', error);
    res.status(500).json({ error: error.message || 'Erreur declenchement paiement' });
  }
});

/**
 * GET / — Liste paginee des enrollments
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { status, page = 1, limit = 20 } = req.query;

    const result = await getEnrollments(tenantId, {
      status: status || undefined,
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.json(result);
  } catch (error) {
    console.error('[ONBOARDING-SEQ] Erreur liste:', error);
    res.status(500).json({ error: 'Erreur recuperation enrollments' });
  }
});

/**
 * GET /stats — Stats des enrollments
 */
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const stats = await getEnrollmentStats(tenantId);
    res.json(stats);
  } catch (error) {
    console.error('[ONBOARDING-SEQ] Erreur stats:', error);
    res.status(500).json({ error: 'Erreur recuperation stats' });
  }
});

/**
 * GET /:id — Detail d'un enrollment
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data, error } = await (await import('../config/supabase.js')).supabase
      .from('onboarding_enrollments')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Enrollment introuvable' });
    }

    res.json(data);
  } catch (error) {
    console.error('[ONBOARDING-SEQ] Erreur detail:', error);
    res.status(500).json({ error: 'Erreur recuperation enrollment' });
  }
});

/**
 * POST /:id/cancel — Annuler un enrollment actif
 */
router.post('/:id/cancel', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const data = await cancelEnrollment(tenantId, req.params.id);
    res.json({ success: true, enrollment: data });
  } catch (error) {
    console.error('[ONBOARDING-SEQ] Erreur annulation:', error);
    res.status(400).json({ error: error.message || 'Erreur annulation' });
  }
});

/**
 * POST /:id/retry — Relancer un enrollment echoue/annule
 */
router.post('/:id/retry', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const data = await retryEnrollment(tenantId, req.params.id);
    res.json({ success: true, enrollment: data });
  } catch (error) {
    console.error('[ONBOARDING-SEQ] Erreur retry:', error);
    res.status(400).json({ error: error.message || 'Erreur relance' });
  }
});

export default router;
