/**
 * Routes Import Comptable
 * FEC / CSV / Soldes d'ouverture
 */

import express from 'express';
import multer from 'multer';
import { authenticateAdmin } from './adminAuth.js';
import {
  parseFEC,
  parseCSV,
  validateImport,
  createMissingAccounts,
  executeImport,
  importSoldesOuverture
} from '../services/comptaImportService.js';

const router = express.Router();
router.use(authenticateAdmin);

// Upload mémoire (max 10MB)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * POST /api/import-compta/fec — Upload + parse FEC
 */
router.post('/fec', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier FEC requis' });

    const content = req.file.buffer.toString('utf-8');
    const result = await parseFEC(req.admin.tenant_id, content);

    res.json({
      success: true,
      filename: req.file.originalname,
      ...result
    });
  } catch (error) {
    console.error('[IMPORT] Erreur parse FEC:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import-compta/csv — Upload + parse CSV avec mapping
 */
router.post('/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier CSV requis' });

    let mapping;
    try {
      mapping = JSON.parse(req.body.mapping || '{}');
    } catch {
      return res.status(400).json({ error: 'Mapping JSON invalide' });
    }

    const content = req.file.buffer.toString('utf-8');
    const result = await parseCSV(req.admin.tenant_id, content, mapping);

    res.json({
      success: true,
      filename: req.file.originalname,
      ...result
    });
  } catch (error) {
    console.error('[IMPORT] Erreur parse CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import-compta/preview — Valider données parsées
 */
router.post('/preview', async (req, res) => {
  try {
    const { ecritures } = req.body;
    if (!ecritures || ecritures.length === 0) {
      return res.status(400).json({ error: 'Aucune écriture à valider' });
    }

    const result = await validateImport(req.admin.tenant_id, ecritures);
    res.json(result);
  } catch (error) {
    console.error('[IMPORT] Erreur validation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import-compta/execute — Exécuter import validé
 */
router.post('/execute', async (req, res) => {
  try {
    const { ecritures, creer_comptes_manquants, source } = req.body;

    if (!ecritures || ecritures.length === 0) {
      return res.status(400).json({ error: 'Aucune écriture à importer' });
    }

    // Validation finale
    const validation = await validateImport(req.admin.tenant_id, ecritures);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Validation échouée', errors: validation.errors });
    }

    // Créer comptes manquants si demandé
    let nbComptesCrees = 0;
    if (creer_comptes_manquants && validation.comptes_manquants.length > 0) {
      const result = await createMissingAccounts(req.admin.tenant_id, validation.comptes_manquants);
      nbComptesCrees = result.created;
    }

    // Exécuter l'import
    const result = await executeImport(req.admin.tenant_id, ecritures, source || 'fec');

    res.json({
      success: true,
      nb_ecritures: result.nb_ecritures,
      nb_comptes_crees: nbComptesCrees
    });
  } catch (error) {
    console.error('[IMPORT] Erreur exécution:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/import-compta/soldes-ouverture — Import bilan initial
 */
router.post('/soldes-ouverture', async (req, res) => {
  try {
    const { soldes, date_ouverture } = req.body;

    if (!soldes || soldes.length === 0) {
      return res.status(400).json({ error: 'Soldes requis' });
    }
    if (!date_ouverture) {
      return res.status(400).json({ error: 'Date d\'ouverture requise' });
    }

    const result = await importSoldesOuverture(req.admin.tenant_id, soldes, date_ouverture);
    res.json(result);
  } catch (error) {
    console.error('[IMPORT] Erreur soldes ouverture:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
