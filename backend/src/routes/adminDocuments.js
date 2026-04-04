/**
 * Routes admin pour gestion de fichiers/documents
 * Sprint 3.5 — Upload fichiers generique
 *
 * Endpoints:
 * POST   /api/admin/documents/upload  — Upload un fichier (avec quota check)
 * GET    /api/admin/documents         — Liste les documents du tenant
 * GET    /api/admin/documents/:id     — URL signee pour telecharger
 * DELETE /api/admin/documents/:id     — Supprimer un document
 * GET    /api/admin/documents/quota   — Quota stockage actuel
 */

import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { requireStorageQuota, checkStorageQuota, getTenantPlan } from '../middleware/quotas.js';
import logger from '../config/logger.js';
import { validatePagination } from '../utils/queryValidation.js';

const router = express.Router();

// Configuration multer
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'text/csv', 'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/json'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Whitelist d'extensions autorisees (bloque .exe, .bat, .sh, .cmd, .ps1, etc.)
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.csv', '.txt', '.xlsx', '.docx', '.json'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error(`Type de fichier non supporté: ${file.mimetype}`);
      err.code = 'INVALID_FILE_TYPE';
      cb(err);
    }
  }
});

const STORAGE_BUCKET = 'documents';

// Toutes les routes nécessitent une authentification admin
router.use(authenticateAdmin);

/**
 * POST /upload — Upload un fichier
 * Body (multipart/form-data):
 *   file: File (required)
 *   category: string (general|facture|contrat|photo|logo|autre)
 *   entity_type: string (client|reservation|depense|rh)
 *   entity_id: string
 */
router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` });
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, requireStorageQuota, async (req, res) => {
  try {
    const { tenantId } = req;
    const adminId = req.admin?.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    // Re-valider l'extension (bloque double extensions comme .pdf.exe)
    const fileExt = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return res.status(400).json({ error: `Extension de fichier non autorisée: ${fileExt}` });
    }

    const { category = 'general', entity_type, entity_id } = req.body;

    // Generer un nom unique
    const ext = fileExt.slice(1) || 'bin';
    const uniqueName = `${crypto.randomUUID()}.${ext}`;
    const storagePath = `${tenantId}/${category}/${uniqueName}`;

    // Upload vers Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      logger.error('Erreur upload Supabase Storage', { error: uploadError.message, tenantId });
      return res.status(500).json({ error: 'Erreur lors de l\'upload du fichier' });
    }

    // Sauvegarder les metadonnees en DB
    const docData = {
      tenant_id: tenantId,
      admin_id: adminId,
      file_name: uniqueName,
      original_name: file.originalname,
      mime_type: file.mimetype,
      file_size: file.size,
      storage_path: uploadData.path || storagePath,
      category,
      entity_type: entity_type || null,
      entity_id: entity_id || null
    };

    const { data: doc, error: dbError } = await supabase
      .from('documents')
      .insert(docData)
      .select()
      .single();

    if (dbError) {
      // Rollback: supprimer le fichier uploade si l'insert DB echoue
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      logger.error('Erreur insert document DB', { error: dbError.message, tenantId });
      return res.status(500).json({ error: 'Erreur lors de l\'enregistrement du document' });
    }

    logger.info('Document uploade', { docId: doc.id, tenantId, size: file.size, category });

    res.status(201).json({
      id: doc.id,
      file_name: doc.original_name,
      mime_type: doc.mime_type,
      file_size: doc.file_size,
      category: doc.category,
      entity_type: doc.entity_type,
      entity_id: doc.entity_id,
      created_at: doc.created_at
    });
  } catch (error) {
    if (error.message?.includes('Type de fichier non supporté')) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Erreur upload document', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /quota — Quota stockage actuel du tenant
 * IMPORTANT: Doit être avant /:id pour eviter conflit de route
 */
router.get('/quota', async (req, res) => {
  try {
    const { tenantId } = req;
    const plan = await getTenantPlan(tenantId);
    const quota = await checkStorageQuota(tenantId, plan);

    res.json({
      current_gb: quota.current_gb,
      limit_gb: quota.limit_gb,
      percentage: quota.percentage || 0,
      plan
    });
  } catch (error) {
    logger.error('Erreur quota documents', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET / — Liste les documents du tenant
 * Query: ?category=facture&entity_type=client&entity_id=xxx&page=1&limit=20
 */
router.get('/', async (req, res) => {
  try {
    const { tenantId } = req;
    const { category, entity_type, entity_id } = req.query;
    const { page, limit, offset } = validatePagination(req.query.page, req.query.limit);

    let query = supabase
      .from('documents')
      .select('id, original_name, mime_type, file_size, category, entity_type, entity_id, created_at, admin_id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) query = query.eq('category', category);
    if (entity_type) query = query.eq('entity_type', entity_type);
    if (entity_id) query = query.eq('entity_id', entity_id);

    const { data, error, count } = await query;

    if (error) {
      logger.error('Erreur liste documents', { error: error.message, tenantId });
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    res.json({
      documents: data || [],
      total: count || 0,
      page,
      limit,
      pages: Math.ceil((count || 0) / limit)
    });
  } catch (error) {
    logger.error('Erreur liste documents', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /:id — URL signee pour telecharger un document
 */
router.get('/:id', async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;

    const { data: doc, error } = await supabase
      .from('documents')
      .select('storage_path, original_name, mime_type')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !doc) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    // Generer une URL signee (1 heure d'expiration)
    const { data: signedData, error: signError } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(doc.storage_path, 3600);

    if (signError) {
      logger.error('Erreur generation URL signee', { error: signError.message, docId: id });
      return res.status(500).json({ error: 'Erreur lors de la génération du lien de téléchargement' });
    }

    res.json({
      url: signedData.signedUrl,
      file_name: doc.original_name,
      mime_type: doc.mime_type,
      expires_in: 3600
    });
  } catch (error) {
    logger.error('Erreur get document', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /:id — Supprimer un document
 */
router.delete('/:id', async (req, res) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;

    // Recuperer le document pour le chemin storage
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !doc) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    // Supprimer de Supabase Storage
    const { error: storageError } = await supabase
      .storage
      .from(STORAGE_BUCKET)
      .remove([doc.storage_path]);

    if (storageError) {
      logger.warn('Erreur suppression Storage (continue avec DB)', { error: storageError.message });
    }

    // Supprimer de la DB
    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (dbError) {
      logger.error('Erreur suppression document DB', { error: dbError.message });
      return res.status(500).json({ error: 'Erreur lors de la suppression' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Erreur delete document', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
