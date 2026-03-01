/**
 * Routes RGPD - Export et suppression des données personnelles
 *
 * GET    /api/rgpd/export           - Exporter toutes les données du tenant
 * POST   /api/rgpd/delete-request   - Demander la suppression des données
 * GET    /api/rgpd/delete-status    - Statut de la demande de suppression
 * POST   /api/rgpd/anonymize-client - Anonymiser un client spécifique
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// Middleware auth sur toutes les routes
router.use(authenticateAdmin);

/**
 * GET /api/rgpd/export
 * Exporte toutes les données du tenant au format JSON
 * Conformément à l'Article 20 du RGPD (Droit à la portabilité)
 */
router.get('/export', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminEmail = req.admin.email;

    console.log(`[RGPD] Export demandé par ${adminEmail} pour tenant ${tenantId}`);

    // Collecter toutes les données du tenant
    const [
      { data: tenant },
      { data: clients },
      { data: reservations },
      { data: factures },
      { data: services },
      { data: admins },
      { data: conversations }
    ] = await Promise.all([
      supabase.from('tenants').select('*').eq('id', tenantId).single(),
      supabase.from('clients').select('*').eq('tenant_id', tenantId),
      supabase.from('reservations').select('*').eq('tenant_id', tenantId),
      supabase.from('factures').select('*').eq('tenant_id', tenantId),
      supabase.from('services').select('*').eq('tenant_id', tenantId),
      supabase.from('admin_users').select('id, nom, prenom, email, created_at').eq('tenant_id', tenantId),
      supabase.from('ia_conversations').select('*').eq('tenant_id', tenantId)
    ]);

    const exportData = {
      export_date: new Date().toISOString(),
      tenant_id: tenantId,
      requested_by: adminEmail,
      format_version: '1.0',
      data: {
        account: {
          ...tenant,
          // Masquer les secrets
          stripe_customer_id: tenant?.stripe_customer_id ? '***' : null,
          stripe_subscription_id: tenant?.stripe_subscription_id ? '***' : null
        },
        team: admins || [],
        clients: (clients || []).map(c => ({
          ...c,
          // Garder les données personnelles pour l'export
        })),
        reservations: reservations || [],
        invoices: factures || [],
        services: services || [],
        conversations: (conversations || []).map(c => ({
          id: c.id,
          channel: c.channel,
          started_at: c.started_at,
          ended_at: c.ended_at,
          status: c.status
        }))
      },
      metadata: {
        total_clients: clients?.length || 0,
        total_reservations: reservations?.length || 0,
        total_invoices: factures?.length || 0,
        total_conversations: conversations?.length || 0
      }
    };

    // Logger l'action
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'rgpd_export',
      entite: 'tenant',
      details: { items_exported: exportData.metadata }
    });

    // Retourner en JSON avec headers pour téléchargement
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="nexus-export-${tenantId}-${Date.now()}.json"`);
    res.json(exportData);

  } catch (error) {
    console.error('[RGPD] Erreur export:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rgpd/delete-request
 * Demande la suppression complète des données du tenant
 * Conformément à l'Article 17 du RGPD (Droit à l'effacement)
 */
router.post('/delete-request', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { confirmation, reason } = req.body;

    if (confirmation !== 'SUPPRIMER MES DONNEES') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation requise: tapez "SUPPRIMER MES DONNEES"'
      });
    }

    console.log(`[RGPD] Demande de suppression pour tenant ${tenantId}`);

    // Vérifier si une demande existe déjà
    const { data: existing } = await supabase
      .from('rgpd_requests')
      .select('id, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('type', 'deletion')
      .eq('status', 'pending')
      .single();

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Une demande de suppression est déjà en cours',
        request_id: existing.id,
        created_at: existing.created_at
      });
    }

    // Créer la demande de suppression
    const { data: request, error: insertError } = await supabase
      .from('rgpd_requests')
      .insert({
        tenant_id: tenantId,
        type: 'deletion',
        status: 'pending',
        requested_by: req.admin.id,
        reason: reason || 'Non spécifié',
        scheduled_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 jours
      })
      .select()
      .single();

    if (insertError) {
      // La table n'existe peut-être pas encore
      if (insertError.message.includes('does not exist')) {
        return res.status(503).json({
          success: false,
          error: 'Service temporairement indisponible. Contactez support@nexus.app'
        });
      }
      throw insertError;
    }

    // Logger l'action
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'rgpd_delete_request',
      entite: 'tenant',
      details: { request_id: request.id, reason }
    });

    res.json({
      success: true,
      message: 'Demande de suppression enregistrée',
      request_id: request.id,
      scheduled_deletion: request.scheduled_at,
      info: 'La suppression sera effectuée dans 30 jours. Vous pouvez annuler cette demande avant cette date.'
    });

  } catch (error) {
    console.error('[RGPD] Erreur demande suppression:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rgpd/delete-status
 * Vérifie le statut de la demande de suppression
 */
router.get('/delete-status', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: request, error } = await supabase
      .from('rgpd_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('type', 'deletion')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !request) {
      return res.json({
        success: true,
        has_pending_request: false
      });
    }

    res.json({
      success: true,
      has_pending_request: request.status === 'pending',
      request: {
        id: request.id,
        status: request.status,
        created_at: request.created_at,
        scheduled_at: request.scheduled_at,
        completed_at: request.completed_at
      }
    });

  } catch (error) {
    console.error('[RGPD] Erreur status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/rgpd/delete-request
 * Annule une demande de suppression en cours
 */
router.delete('/delete-request', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: request, error: fetchError } = await supabase
      .from('rgpd_requests')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('type', 'deletion')
      .eq('status', 'pending')
      .single();

    if (fetchError || !request) {
      return res.status(404).json({
        success: false,
        error: 'Aucune demande de suppression en cours'
      });
    }

    await supabase
      .from('rgpd_requests')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', request.id);

    res.json({
      success: true,
      message: 'Demande de suppression annulée'
    });

  } catch (error) {
    console.error('[RGPD] Erreur annulation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rgpd/anonymize-client/:clientId
 * Anonymise les données d'un client spécifique
 * Conformément à l'Article 17 du RGPD
 */
router.post('/anonymize-client/:clientId', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { clientId } = req.params;

    // Vérifier que le client appartient au tenant
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('id, nom, prenom, email, telephone')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !client) {
      return res.status(404).json({
        success: false,
        error: 'Client non trouvé'
      });
    }

    // Anonymiser les données
    const anonymizedData = {
      nom: 'ANONYME',
      prenom: 'Client',
      email: `anonyme-${clientId.slice(0, 8)}@anonyme.local`,
      telephone: '0000000000',
      adresse: null,
      notes: '[Données anonymisées conformément au RGPD]',
      is_anonymized: true,
      anonymized_at: new Date().toISOString()
    };

    await supabase
      .from('clients')
      .update(anonymizedData)
      .eq('id', clientId)
      .eq('tenant_id', tenantId);

    // Logger l'action
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'rgpd_anonymize_client',
      entite: 'client',
      entite_id: clientId,
      details: { original_email: client.email }
    });

    console.log(`[RGPD] Client ${clientId} anonymisé pour tenant ${tenantId}`);

    res.json({
      success: true,
      message: 'Client anonymisé avec succès',
      client_id: clientId
    });

  } catch (error) {
    console.error('[RGPD] Erreur anonymisation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rgpd/client/:clientId/export
 * Exporte les données d'un client spécifique
 * Conformément à l'Article 15 du RGPD (Droit d'accès)
 */
router.get('/client/:clientId/export', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { clientId } = req.params;

    // Récupérer toutes les données du client
    const [
      { data: client },
      { data: reservations },
      { data: factures },
      { data: conversations }
    ] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).eq('tenant_id', tenantId).single(),
      supabase.from('reservations').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
      supabase.from('factures').select('*').eq('client_id', clientId).eq('tenant_id', tenantId),
      supabase.from('ia_conversations').select('id, channel, started_at, ended_at, status').eq('client_id', clientId).eq('tenant_id', tenantId)
    ]);

    if (!client) {
      return res.status(404).json({
        success: false,
        error: 'Client non trouvé'
      });
    }

    const exportData = {
      export_date: new Date().toISOString(),
      client_id: clientId,
      tenant_id: tenantId,
      data: {
        personal_info: {
          nom: client.nom,
          prenom: client.prenom,
          email: client.email,
          telephone: client.telephone,
          adresse: client.adresse,
          created_at: client.created_at
        },
        reservations: reservations || [],
        invoices: factures || [],
        conversations: conversations || []
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="client-export-${clientId}-${Date.now()}.json"`);
    res.json(exportData);

  } catch (error) {
    console.error('[RGPD] Erreur export client:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
