/**
 * Routes Qualiopi — Dashboard conformité formation
 * Checklist documents par apprenant, alertes, historique
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();
router.use(authenticateAdmin);

// Documents requis pour Qualiopi
const REQUIRED_DOCUMENTS = [
  { id: 'contrat', label: 'Contrat de formation', category: 'administratif' },
  { id: 'programme', label: 'Programme de formation', category: 'pedagogique' },
  { id: 'cgv', label: 'Conditions générales de vente', category: 'administratif' },
  { id: 'reglement_interieur', label: 'Règlement intérieur', category: 'administratif' },
  { id: 'convocation', label: 'Convocation', category: 'administratif' },
  { id: 'emargement', label: 'Feuille d\'émargement', category: 'suivi' },
  { id: 'evaluation_pre', label: 'Évaluation pré-formation', category: 'pedagogique' },
  { id: 'evaluation_post', label: 'Évaluation post-formation', category: 'pedagogique' },
  { id: 'satisfaction_chaud', label: 'Satisfaction à chaud', category: 'qualite' },
  { id: 'satisfaction_froid', label: 'Satisfaction à froid (6 mois)', category: 'qualite' },
  { id: 'attestation', label: 'Attestation de fin de formation', category: 'administratif' },
  { id: 'certificat', label: 'Certificat de réalisation', category: 'administratif' },
];

/**
 * GET /api/admin/qualiopi/documents-types
 * Liste des types de documents requis
 */
router.get('/documents-types', (req, res) => {
  res.json({ success: true, documents: REQUIRED_DOCUMENTS });
});

/**
 * GET /api/admin/qualiopi/apprenants
 * Liste des apprenants avec leur conformité
 */
router.get('/apprenants', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    // Récupérer les apprenants (clients tagués 'apprenant' ou 'formation')
    const { data: apprenants, error } = await supabase
      .from('clients')
      .select('id, prenom, nom, email, telephone, tags, created_at')
      .eq('tenant_id', tenantId)
      .or('tags.cs.{apprenant},tags.cs.{formation},tags.cs.{qualifié}')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Récupérer tous les documents Qualiopi du tenant
    const { data: docs } = await supabase
      .from('qualiopi_documents')
      .select('*')
      .eq('tenant_id', tenantId);

    const documentsMap = {};
    for (const doc of (docs || [])) {
      if (!documentsMap[doc.client_id]) documentsMap[doc.client_id] = [];
      documentsMap[doc.client_id].push(doc);
    }

    // Calculer la conformité de chaque apprenant
    const result = (apprenants || []).map(apprenant => {
      const clientDocs = documentsMap[apprenant.id] || [];
      const completedDocs = clientDocs.filter(d => d.status === 'valide').map(d => d.document_type);
      const total = REQUIRED_DOCUMENTS.length;
      const completed = completedDocs.length;
      const missing = REQUIRED_DOCUMENTS.filter(d => !completedDocs.includes(d.id)).map(d => d.id);

      return {
        ...apprenant,
        conformite: {
          total,
          completed,
          percentage: Math.round((completed / total) * 100),
          missing,
          documents: clientDocs,
        },
      };
    });

    res.json({ success: true, apprenants: result });
  } catch (error) {
    console.error('[QUALIOPI] Erreur apprenants:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/qualiopi/apprenants/:clientId/documents
 * Documents d'un apprenant
 */
router.get('/apprenants/:clientId/documents', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { data, error } = await supabase
      .from('qualiopi_documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('client_id', req.params.clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Construire la checklist complète
    const existingDocs = data || [];
    const checklist = REQUIRED_DOCUMENTS.map(reqDoc => {
      const doc = existingDocs.find(d => d.document_type === reqDoc.id);
      return {
        ...reqDoc,
        status: doc?.status || 'manquant',
        uploaded_at: doc?.created_at || null,
        file_url: doc?.file_url || null,
        notes: doc?.notes || null,
        version: doc?.version || 0,
        history: existingDocs
          .filter(d => d.document_type === reqDoc.id)
          .map(d => ({ id: d.id, version: d.version, status: d.status, created_at: d.created_at })),
      };
    });

    res.json({ success: true, checklist });
  } catch (error) {
    console.error('[QUALIOPI] Erreur documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/qualiopi/apprenants/:clientId/documents
 * Ajouter/valider un document
 */
router.post('/apprenants/:clientId/documents', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { document_type, status, file_url, notes } = req.body;

    if (!document_type) {
      return res.status(400).json({ success: false, error: 'document_type requis' });
    }

    if (!REQUIRED_DOCUMENTS.find(d => d.id === document_type)) {
      return res.status(400).json({ success: false, error: 'Type de document invalide' });
    }

    // Récupérer la version courante
    const { data: existing } = await supabase
      .from('qualiopi_documents')
      .select('version')
      .eq('tenant_id', tenantId)
      .eq('client_id', req.params.clientId)
      .eq('document_type', document_type)
      .order('version', { ascending: false })
      .limit(1);

    const nextVersion = (existing?.[0]?.version || 0) + 1;

    const { data, error } = await supabase
      .from('qualiopi_documents')
      .insert({
        tenant_id: tenantId,
        client_id: req.params.clientId,
        document_type,
        status: status || 'valide',
        file_url: file_url || null,
        notes: notes || null,
        version: nextVersion,
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, document: data });
  } catch (error) {
    console.error('[QUALIOPI] Erreur ajout document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/qualiopi/alertes
 * Alertes documents manquants
 */
router.get('/alertes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { data: apprenants } = await supabase
      .from('clients')
      .select('id, prenom, nom, email')
      .eq('tenant_id', tenantId)
      .or('tags.cs.{apprenant},tags.cs.{formation},tags.cs.{qualifié}');

    const { data: docs } = await supabase
      .from('qualiopi_documents')
      .select('client_id, document_type, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'valide');

    const validDocs = {};
    for (const doc of (docs || [])) {
      if (!validDocs[doc.client_id]) validDocs[doc.client_id] = new Set();
      validDocs[doc.client_id].add(doc.document_type);
    }

    const alertes = [];
    for (const apprenant of (apprenants || [])) {
      const completed = validDocs[apprenant.id] || new Set();
      const missing = REQUIRED_DOCUMENTS.filter(d => !completed.has(d.id));

      if (missing.length > 0) {
        alertes.push({
          client_id: apprenant.id,
          client_name: `${apprenant.prenom} ${apprenant.nom}`.trim(),
          client_email: apprenant.email,
          missing_count: missing.length,
          missing_documents: missing.map(d => d.label),
          severity: missing.length >= 6 ? 'critical' : missing.length >= 3 ? 'warning' : 'info',
        });
      }
    }

    // Trier par sévérité
    alertes.sort((a, b) => b.missing_count - a.missing_count);

    res.json({ success: true, alertes });
  } catch (error) {
    console.error('[QUALIOPI] Erreur alertes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
