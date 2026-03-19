/**
 * Routes Exercices Comptables
 * Gestion exercices, périodes, clôtures
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import {
  createExercice,
  listExercices,
  getExerciceOuvert,
  isPeriodeVerrouillee,
  verrouillerPeriode,
  deverrouillerPeriode,
  listPeriodes,
  verifierPreCloture,
  clotureProvisoire,
  clotureDefinitive
} from '../services/exerciceService.js';

const router = express.Router();
router.use(authenticateAdmin);

/**
 * GET /api/exercices — Liste des exercices
 */
router.get('/', async (req, res) => {
  try {
    const exercices = await listExercices(req.admin.tenant_id);
    res.json({ exercices });
  } catch (error) {
    console.error('[EXERCICES] Erreur liste:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exercices/courant — Exercice ouvert
 */
router.get('/courant', async (req, res) => {
  try {
    const exercice = await getExerciceOuvert(req.admin.tenant_id);
    res.json({ exercice });
  } catch (error) {
    console.error('[EXERCICES] Erreur exercice courant:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/exercices — Créer un exercice
 */
router.post('/', async (req, res) => {
  try {
    const { date_debut, date_fin, code } = req.body;

    if (!date_debut || !date_fin || !code) {
      return res.status(400).json({ error: 'date_debut, date_fin et code sont requis' });
    }

    const result = await createExercice(req.admin.tenant_id, { date_debut, date_fin, code });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[EXERCICES] Erreur création:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/exercices/:id/periodes — Périodes d'un exercice
 */
router.get('/:id/periodes', async (req, res) => {
  try {
    const periodes = await listPeriodes(req.admin.tenant_id, parseInt(req.params.id));
    res.json({ periodes });
  } catch (error) {
    console.error('[EXERCICES] Erreur périodes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/exercices/:id/verrouiller-periode
 */
router.post('/:id/verrouiller-periode', async (req, res) => {
  try {
    const { periode } = req.body;
    if (!periode) return res.status(400).json({ error: 'période requise' });

    const result = await verrouillerPeriode(req.admin.tenant_id, periode, req.admin.id);
    res.json(result);
  } catch (error) {
    console.error('[EXERCICES] Erreur verrouillage:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/exercices/:id/deverrouiller-periode
 */
router.post('/:id/deverrouiller-periode', async (req, res) => {
  try {
    const { periode } = req.body;
    if (!periode) return res.status(400).json({ error: 'période requise' });

    const result = await deverrouillerPeriode(req.admin.tenant_id, periode, req.admin.id);
    res.json(result);
  } catch (error) {
    console.error('[EXERCICES] Erreur déverrouillage:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exercices/:id/pre-cloture — Vérification pré-clôture
 */
router.get('/:id/pre-cloture', async (req, res) => {
  try {
    const result = await verifierPreCloture(req.admin.tenant_id, parseInt(req.params.id));
    res.json(result);
  } catch (error) {
    console.error('[EXERCICES] Erreur pré-clôture:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/exercices/:id/cloture-provisoire
 */
router.post('/:id/cloture-provisoire', async (req, res) => {
  try {
    const result = await clotureProvisoire(req.admin.tenant_id, parseInt(req.params.id), req.admin.id);
    res.json(result);
  } catch (error) {
    console.error('[EXERCICES] Erreur clôture provisoire:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/exercices/:id/cloture-definitive
 */
router.post('/:id/cloture-definitive', async (req, res) => {
  try {
    const result = await clotureDefinitive(req.admin.tenant_id, parseInt(req.params.id), req.admin.id);
    res.json(result);
  } catch (error) {
    console.error('[EXERCICES] Erreur clôture définitive:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
