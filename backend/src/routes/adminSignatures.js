/**
 * Routes Admin Signatures — Gestion des signatures électroniques Yousign
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import {
  createSignatureRequest,
  getSignatureStatus,
  listSignatures,
} from '../services/yousignService.js';

const router = express.Router();
router.use(authenticateAdmin);

/**
 * GET /api/admin/signatures
 * Liste les signatures du tenant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { limit = 20, offset = 0 } = req.query;
    const result = await listSignatures(tenantId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[SIGNATURES] Erreur liste:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/signatures
 * Créer une nouvelle demande de signature
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const {
      name,
      signerEmail,
      signerFirstName,
      signerLastName,
      signerPhone,
      clientId,
      metadata,
    } = req.body;

    if (!signerEmail) {
      return res.status(400).json({ success: false, error: 'signerEmail requis' });
    }

    // Pour l'instant, le document doit être fourni en base64
    // Dans une version future, on pourra générer le PDF depuis un template
    const fileBase64 = req.body.fileBase64;
    if (!fileBase64) {
      return res.status(400).json({ success: false, error: 'fileBase64 requis (contenu PDF en base64)' });
    }

    const fileContent = Buffer.from(fileBase64, 'base64');

    const result = await createSignatureRequest(tenantId, {
      name,
      signerEmail,
      signerFirstName,
      signerLastName,
      signerPhone,
      fileContent,
      fileName: `${name || 'document'}.pdf`,
      clientId,
      metadata,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[SIGNATURES] Erreur création:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/signatures/:id/status
 * Statut d'une signature
 */
router.get('/:id/status', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const result = await getSignatureStatus(tenantId, req.params.id);
    res.json({ success: true, signature: result });
  } catch (error) {
    console.error('[SIGNATURES] Erreur statut:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
