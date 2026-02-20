/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║   ADMIN RFM ROUTES - Analyse et Segmentation RFM                              ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║   GET  /api/admin/rfm/analysis      - Analyse RFM complète                    ║
 * ║   GET  /api/admin/rfm/segments      - Liste des segments RFM                  ║
 * ║   GET  /api/admin/rfm/segments/:key - Clients d'un segment                    ║
 * ║   POST /api/admin/rfm/sync          - Synchroniser segments en base           ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import { analyzeRFM, getSegmentClients, syncRFMSegments, RFM_SEGMENTS, RFM_CONFIG } from '../services/rfmService.js';
import { sendWhatsAppNotification } from '../services/whatsappService.js';
import { supabase } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/admin/rfm/analysis
 * Analyse RFM complète du tenant
 */
router.get('/analysis', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const result = await analyzeRFM(tenantId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('[RFM] Erreur analysis:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/admin/rfm/segments
 * Liste des segments RFM avec leurs stats
 */
router.get('/segments', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const result = await analyzeRFM(tenantId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    // Formater pour l'affichage
    const segments = Object.entries(result.segments)
      .map(([key, seg]) => ({
        key,
        nom: seg.nom,
        description: seg.description,
        couleur: seg.couleur,
        icone: seg.icone,
        action: seg.action,
        priority: seg.priority,
        count: seg.count,
        total_ca: seg.total_ca.toFixed(2),
        percentage: result.stats.total_clients > 0
          ? ((seg.count / result.stats.total_clients) * 100).toFixed(1)
          : '0'
      }))
      .filter(seg => seg.count > 0) // Only show non-empty segments
      .sort((a, b) => a.priority - b.priority);

    res.json({
      success: true,
      segments,
      stats: result.stats,
      config: RFM_CONFIG
    });
  } catch (error) {
    console.error('[RFM] Erreur segments:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/admin/rfm/segments/:key
 * Clients d'un segment RFM spécifique
 */
router.get('/segments/:key', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { key } = req.params;

    const result = await getSegmentClients(tenantId, key);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('[RFM] Erreur segment clients:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/rfm/sync
 * Synchronise les segments RFM dans la table segments
 */
router.post('/sync', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const result = await syncRFMSegments(tenantId);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({
      success: true,
      message: `${result.synced.length} segments synchronisés`,
      synced: result.synced
    });
  } catch (error) {
    console.error('[RFM] Erreur sync:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/admin/rfm/config
 * Configuration RFM (seuils de scoring)
 */
router.get('/config', authenticateAdmin, (req, res) => {
  res.json({
    success: true,
    config: RFM_CONFIG,
    segments: Object.entries(RFM_SEGMENTS).map(([key, seg]) => ({
      key,
      nom: seg.nom,
      description: seg.description,
      couleur: seg.couleur,
      action: seg.action
    }))
  });
});

/**
 * POST /api/admin/rfm/segments/:key/campaign
 * Envoie une campagne WhatsApp/Email aux clients d'un segment
 */
router.post('/segments/:key/campaign', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { key } = req.params;
    const { type, message, subject } = req.body; // type: 'whatsapp' | 'email'

    if (!type || !message) {
      return res.status(400).json({ error: 'Type et message requis' });
    }

    // Récupérer les clients du segment
    const result = await getSegmentClients(tenantId, key);
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    const clients = result.clients || [];
    if (clients.length === 0) {
      return res.status(400).json({ error: 'Aucun client dans ce segment' });
    }

    // Envoyer les messages
    const results = {
      total: clients.length,
      sent: 0,
      failed: 0,
      errors: []
    };

    // Créer un enregistrement de campagne
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        tenant_id: tenantId,
        nom: `Campagne ${result.segment.nom} - ${new Date().toLocaleDateString('fr-FR')}`,
        type: type,
        segment_key: key,
        segment_nom: result.segment.nom,
        message: message,
        subject: subject || null,
        nb_destinataires: clients.length,
        statut: 'en_cours',
        created_by: req.admin.id
      })
      .select()
      .single();

    // Si la table campaigns n'existe pas, continuer sans enregistrement
    const campaignId = campaign?.id || null;

    for (const client of clients) {
      try {
        if (type === 'whatsapp' && client.client_telephone) {
          // Personnaliser le message avec les infos client
          const personalizedMessage = message
            .replace('{{prenom}}', client.client_nom?.split(' ')[0] || 'Client')
            .replace('{{nom}}', client.client_nom || 'Client')
            .replace('{{ca}}', client.total_spent_euros || '0');

          await sendWhatsAppNotification(client.client_telephone, personalizedMessage);
          results.sent++;
        } else if (type === 'email' && client.client_email) {
          // TODO: Implémenter l'envoi email
          // Pour l'instant, on compte comme non envoyé
          results.failed++;
          results.errors.push({ client: client.client_nom, error: 'Email non implémenté' });
        } else {
          results.failed++;
          results.errors.push({
            client: client.client_nom,
            error: type === 'whatsapp' ? 'Pas de téléphone' : 'Pas d\'email'
          });
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ client: client.client_nom, error: err.message });
      }
    }

    // Mettre à jour le statut de la campagne
    if (campaignId) {
      await supabase
        .from('campaigns')
        .update({
          nb_envoyes: results.sent,
          nb_echecs: results.failed,
          statut: 'termine',
          finished_at: new Date().toISOString()
        })
        .eq('id', campaignId);
    }

    res.json({
      success: true,
      campaign_id: campaignId,
      results
    });
  } catch (error) {
    console.error('[RFM] Erreur campagne:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
