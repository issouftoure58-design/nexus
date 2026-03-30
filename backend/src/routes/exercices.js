/**
 * Routes Exercices Comptables
 * Gestion exercices, périodes, clôture et réouverture
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import {
  listExercices,
  getOuCreerExerciceCourant,
  getExerciceOuvert,
  isPeriodeVerrouillee,
  verrouillerPeriode,
  deverrouillerPeriode,
  listPeriodes,
  verifierPreCloture,
  cloturerExercice,
  rouvrirExercice
} from '../services/exerciceService.js';

const router = express.Router();
router.use(authenticateAdmin);

/**
 * GET /api/exercices — Liste des exercices (auto-init si vide)
 */
router.get('/', async (req, res) => {
  try {
    let exercices = await listExercices(req.admin.tenant_id);

    // Auto-init : si aucun exercice, en créer un pour l'année courante
    if (exercices.length === 0) {
      await getOuCreerExerciceCourant(req.admin.tenant_id);
      exercices = await listExercices(req.admin.tenant_id);
    }

    res.json({ exercices });
  } catch (error) {
    console.error('[EXERCICES] Erreur liste:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/exercices/courant — Exercice ouvert (avec auto-init)
 */
router.get('/courant', async (req, res) => {
  try {
    const exercice = await getOuCreerExerciceCourant(req.admin.tenant_id);
    res.json({ exercice });
  } catch (error) {
    console.error('[EXERCICES] Erreur exercice courant:', error);
    res.status(500).json({ error: error.message });
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
 * POST /api/exercices/:id/cloturer — Clôture de l'exercice
 */
router.post('/:id/cloturer', async (req, res) => {
  try {
    const result = await cloturerExercice(req.admin.tenant_id, parseInt(req.params.id), req.admin.id);
    res.json(result);
  } catch (error) {
    console.error('[EXERCICES] Erreur clôture:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/exercices/:id/rouvrir — Réouverture de l'exercice
 */
router.post('/:id/rouvrir', async (req, res) => {
  try {
    const result = await rouvrirExercice(req.admin.tenant_id, parseInt(req.params.id), req.admin.id);
    res.json(result);
  } catch (error) {
    console.error('[EXERCICES] Erreur réouverture:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
