/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES CRM - Segmentation clients avancee + Predictions         ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║   SEGMENTS                                                         ║
 * ║   POST /api/crm/segments          - Creer un segment               ║
 * ║   GET  /api/crm/segments          - Liste segments                 ║
 * ║   GET  /api/crm/segments/:id/clients - Clients d'un segment       ║
 * ║   DELETE /api/crm/segments/:id    - Supprimer segment              ║
 * ║   TAGS                                                             ║
 * ║   POST /api/crm/tags              - Creer un tag                   ║
 * ║   GET  /api/crm/tags              - Liste tags                     ║
 * ║   POST /api/crm/clients/:id/tags/:tagId - Ajouter tag a client    ║
 * ║   DELETE /api/crm/clients/:id/tags/:tagId - Retirer tag           ║
 * ║   GET  /api/crm/clients/:id/tags  - Tags d'un client               ║
 * ║   ANALYTICS                                                        ║
 * ║   GET  /api/crm/analytics         - Stats globales CRM             ║
 * ║   GET  /api/crm/clients/:id/analytics - Analytics client 360°     ║
 * ║   PREDICTIONS CHURN                                                ║
 * ║   GET  /api/crm/clients/:id/churn - Score churn d'un client       ║
 * ║   GET  /api/crm/churn/at-risk     - Clients a risque (top N)      ║
 * ║   POST /api/crm/clients/:id/update-engagement - MAJ engagement    ║
 * ║   POST /api/crm/engagement/recalculate-all - MAJ batch            ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { calculerScoreChurn, calculerScoreEngagement, getClientsAtRisk } from '../utils/churnPredictor.js';

const router = express.Router();

// Middleware auth admin pour toutes les routes
router.use(authenticateAdmin);

// ═══════════════════════════════════════════════════════════
// SEGMENTS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/crm/segments
 * Creer un nouveau segment
 */
router.post('/segments', async (req, res) => {
  try {
    const { nom, description, criteres, auto_update } = req.body;
    const tenantId = req.admin.tenant_id;

    if (!nom || !criteres) {
      return res.status(400).json({
        success: false,
        error: 'Nom et criteres requis'
      });
    }

    // Creer segment
    const { data: segment, error } = await supabase
      .from('segments_clients')
      .insert({
        tenant_id: tenantId,
        nom,
        description: description || null,
        criteres,
        auto_update: auto_update !== false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '42P01') {
        return res.status(500).json({
          success: false,
          error: 'Table segments_clients non trouvee. Executez la migration SQL.'
        });
      }
      throw error;
    }

    // Calculer nombre de clients correspondants
    const nbClients = await calculerClientsSegment(tenantId, criteres);

    // Mettre a jour le compteur
    await supabase
      .from('segments_clients')
      .update({
        nb_clients: nbClients,
        derniere_mise_a_jour: new Date().toISOString(),
      })
      .eq('id', segment.id);

    console.log(`[CRM] Segment cree: ${nom}, ${nbClients} clients`);

    res.json({
      success: true,
      segment: { ...segment, nb_clients: nbClients },
    });
  } catch (error) {
    console.error('[CRM] Erreur creation segment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crm/segments
 * Liste tous les segments du tenant
 */
router.get('/segments', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: segments, error } = await supabase
      .from('segments_clients')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        return res.json({ success: true, segments: [] });
      }
      throw error;
    }

    res.json({
      success: true,
      segments: segments || [],
    });
  } catch (error) {
    console.error('[CRM] Erreur liste segments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crm/segments/:id/clients
 * Recupere les clients correspondant aux criteres d'un segment
 */
router.get('/segments/:id/clients', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Recuperer segment
    const { data: segment, error: segmentError } = await supabase
      .from('segments_clients')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (segmentError) {
      return res.status(404).json({
        success: false,
        error: 'Segment non trouve'
      });
    }

    // Recuperer clients correspondant aux criteres
    const clients = await getClientsParCriteres(tenantId, segment.criteres);

    res.json({
      success: true,
      segment,
      clients,
      count: clients.length,
    });
  } catch (error) {
    console.error('[CRM] Erreur clients segment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/crm/segments/:id
 * Met a jour un segment
 */
router.patch('/segments/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { nom, description, criteres, auto_update } = req.body;

    const updateData = { updated_at: new Date().toISOString() };
    if (nom !== undefined) updateData.nom = nom;
    if (description !== undefined) updateData.description = description;
    if (criteres !== undefined) updateData.criteres = criteres;
    if (auto_update !== undefined) updateData.auto_update = auto_update;

    const { data: segment, error } = await supabase
      .from('segments_clients')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Recalculer nb clients si criteres modifies
    if (criteres !== undefined) {
      const nbClients = await calculerClientsSegment(tenantId, criteres);
      await supabase
        .from('segments_clients')
        .update({
          nb_clients: nbClients,
          derniere_mise_a_jour: new Date().toISOString(),
        })
        .eq('id', id);
      segment.nb_clients = nbClients;
    }

    res.json({
      success: true,
      segment,
    });
  } catch (error) {
    console.error('[CRM] Erreur update segment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/crm/segments/:id
 * Supprime un segment
 */
router.delete('/segments/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('segments_clients')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    console.log(`[CRM] Segment supprime: ${id}`);

    res.json({
      success: true,
      message: 'Segment supprime',
    });
  } catch (error) {
    console.error('[CRM] Erreur suppression segment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/crm/segments/:id/refresh
 * Recalcule le nombre de clients d'un segment
 */
router.post('/segments/:id/refresh', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: segment, error } = await supabase
      .from('segments_clients')
      .select('criteres')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    const nbClients = await calculerClientsSegment(tenantId, segment.criteres);

    await supabase
      .from('segments_clients')
      .update({
        nb_clients: nbClients,
        derniere_mise_a_jour: new Date().toISOString(),
      })
      .eq('id', id);

    res.json({
      success: true,
      nb_clients: nbClients,
    });
  } catch (error) {
    console.error('[CRM] Erreur refresh segment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// TAGS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/crm/tags
 * Creer un nouveau tag
 */
router.post('/tags', async (req, res) => {
  try {
    const { nom, couleur, description } = req.body;
    const tenantId = req.admin.tenant_id;

    if (!nom) {
      return res.status(400).json({
        success: false,
        error: 'Nom requis'
      });
    }

    const { data: tag, error } = await supabase
      .from('tags')
      .insert({
        tenant_id: tenantId,
        nom: nom.trim(),
        couleur: couleur || '#3B82F6',
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          error: 'Ce tag existe deja'
        });
      }
      if (error.code === '42P01') {
        return res.status(500).json({
          success: false,
          error: 'Table tags non trouvee. Executez la migration SQL.'
        });
      }
      throw error;
    }

    console.log(`[CRM] Tag cree: ${nom}`);

    res.json({
      success: true,
      tag,
    });
  } catch (error) {
    console.error('[CRM] Erreur creation tag:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crm/tags
 * Liste tous les tags du tenant
 */
router.get('/tags', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: tags, error } = await supabase
      .from('tags')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('nom', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return res.json({ success: true, tags: [] });
      }
      throw error;
    }

    res.json({
      success: true,
      tags: tags || [],
    });
  } catch (error) {
    console.error('[CRM] Erreur liste tags:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/crm/tags/:id
 * Supprime un tag
 */
router.delete('/tags/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Tag supprime',
    });
  } catch (error) {
    console.error('[CRM] Erreur suppression tag:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// LIAISON CLIENTS-TAGS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/crm/clients/:clientId/tags/:tagId
 * Ajouter un tag a un client
 */
router.post('/clients/:clientId/tags/:tagId', async (req, res) => {
  try {
    const { clientId, tagId } = req.params;
    const tenantId = req.admin.tenant_id;

    // Verifier que client appartient au tenant
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({
        success: false,
        error: 'Client non trouve'
      });
    }

    // Verifier que tag appartient au tenant
    const { data: tag, error: tagError } = await supabase
      .from('tags')
      .select('id, nom')
      .eq('id', tagId)
      .eq('tenant_id', tenantId)
      .single();

    if (tagError || !tag) {
      return res.status(404).json({
        success: false,
        error: 'Tag non trouve'
      });
    }

    // Ajouter liaison
    const { error } = await supabase
      .from('client_tags')
      .insert({
        client_id: clientId,
        tag_id: tagId,
      });

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          error: 'Tag deja attribue a ce client'
        });
      }
      throw error;
    }

    console.log(`[CRM] Tag ${tag.nom} ajoute au client ${clientId}`);

    res.json({
      success: true,
      message: 'Tag ajoute',
    });
  } catch (error) {
    console.error('[CRM] Erreur ajout tag client:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/crm/clients/:clientId/tags/:tagId
 * Retirer un tag d'un client
 */
router.delete('/clients/:clientId/tags/:tagId', async (req, res) => {
  try {
    const { clientId, tagId } = req.params;

    const { error } = await supabase
      .from('client_tags')
      .delete()
      .eq('client_id', clientId)
      .eq('tag_id', tagId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Tag retire',
    });
  } catch (error) {
    console.error('[CRM] Erreur retrait tag client:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crm/clients/:clientId/tags
 * Recuperer les tags d'un client
 */
router.get('/clients/:clientId/tags', async (req, res) => {
  try {
    const { clientId } = req.params;
    const tenantId = req.admin.tenant_id;

    // Verifier appartenance client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({
        success: false,
        error: 'Client non trouve'
      });
    }

    // Recuperer tags via liaison
    const { data: clientTags, error } = await supabase
      .from('client_tags')
      .select('tag_id, tags(*)')
      .eq('client_id', clientId);

    if (error) {
      if (error.code === '42P01') {
        return res.json({ success: true, tags: [] });
      }
      throw error;
    }

    const tags = clientTags?.map(ct => ct.tags).filter(Boolean) || [];

    res.json({
      success: true,
      tags,
    });
  } catch (error) {
    console.error('[CRM] Erreur tags client:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/crm/analytics
 * Stats globales CRM
 */
router.get('/analytics', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Total clients
    const { count: totalClients } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // Clients actifs (visite dans les 30 derniers jours)
    const date30j = new Date();
    date30j.setDate(date30j.getDate() - 30);

    const { count: clientsActifs } = await supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('derniere_visite', date30j.toISOString().split('T')[0]);

    // Nombre de segments
    const { count: nbSegments } = await supabase
      .from('segments_clients')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // Nombre de tags
    const { count: nbTags } = await supabase
      .from('tags')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // CA moyen par client
    const { data: caData } = await supabase
      .from('clients')
      .select('ca_total')
      .eq('tenant_id', tenantId)
      .gt('ca_total', 0);

    const caMoyen = caData && caData.length > 0
      ? caData.reduce((acc, c) => acc + parseFloat(c.ca_total || 0), 0) / caData.length
      : 0;

    res.json({
      success: true,
      analytics: {
        total_clients: totalClients || 0,
        clients_actifs: clientsActifs || 0,
        taux_retention: totalClients > 0 ? Math.round((clientsActifs / totalClients) * 100) : 0,
        nb_segments: nbSegments || 0,
        nb_tags: nbTags || 0,
        ca_moyen: Math.round(caMoyen * 100) / 100,
      },
    });
  } catch (error) {
    console.error('[CRM] Erreur analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// PRÉDICTIONS CHURN
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/crm/clients/:clientId/churn
 * Prédiction risque churn pour un client
 */
router.get('/clients/:clientId/churn', async (req, res) => {
  try {
    const { clientId } = req.params;
    const tenantId = req.admin.tenant_id;

    // Vérifier appartenance client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, nom, prenom, email, telephone')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({
        success: false,
        error: 'Client non trouvé'
      });
    }

    const prediction = await calculerScoreChurn(clientId, tenantId);

    console.log(`[CRM] Churn calculé pour ${client.prenom} ${client.nom}: ${prediction.score}/100 (${prediction.risque})`);

    res.json({
      success: true,
      client,
      churn: prediction,
    });
  } catch (error) {
    console.error('[CRM] Erreur prédiction churn:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/crm/churn/at-risk
 * Clients à risque de churn (top N)
 */
router.get('/churn/at-risk', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { limit = 20, seuil = 31 } = req.query;

    const clientsAtRisk = await getClientsAtRisk(tenantId, parseInt(seuil), parseInt(limit));

    console.log(`[CRM] ${clientsAtRisk.length} clients à risque identifiés`);

    res.json({
      success: true,
      clients: clientsAtRisk,
      count: clientsAtRisk.length,
    });
  } catch (error) {
    console.error('[CRM] Erreur clients at-risk:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/crm/clients/:clientId/update-engagement
 * Mettre à jour le score engagement d'un client
 */
router.post('/clients/:clientId/update-engagement', async (req, res) => {
  try {
    const { clientId } = req.params;
    const tenantId = req.admin.tenant_id;

    // Vérifier appartenance
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({
        success: false,
        error: 'Client non trouvé'
      });
    }

    const score = await calculerScoreEngagement(clientId, tenantId);

    const { error: updateError } = await supabase
      .from('clients')
      .update({ score_engagement: score })
      .eq('id', clientId)
      .eq('tenant_id', tenantId);

    if (updateError) throw updateError;

    console.log(`[CRM] Score engagement mis à jour: ${clientId} -> ${score}`);

    res.json({
      success: true,
      score,
    });
  } catch (error) {
    console.error('[CRM] Erreur update engagement:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/crm/engagement/recalculate-all
 * Recalculer tous les scores engagement (batch)
 */
router.post('/engagement/recalculate-all', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: clients, error: fetchError } = await supabase
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId);

    if (fetchError) throw fetchError;

    if (!clients || clients.length === 0) {
      return res.json({
        success: true,
        updated: 0,
        message: 'Aucun client à mettre à jour'
      });
    }

    let updated = 0;
    for (const client of clients) {
      const score = await calculerScoreEngagement(client.id, tenantId);
      await supabase
        .from('clients')
        .update({ score_engagement: score })
        .eq('id', client.id);
      updated++;
    }

    console.log(`[CRM] Scores engagement recalculés: ${updated} clients`);

    res.json({
      success: true,
      updated,
      message: `${updated} clients mis à jour`,
    });
  } catch (error) {
    console.error('[CRM] Erreur recalcul engagement:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// ANALYTICS CLIENT DÉTAILLÉ
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/crm/clients/:clientId/analytics
 * Analytics complet d'un client (360°)
 */
router.get('/clients/:clientId/analytics', async (req, res) => {
  try {
    const { clientId } = req.params;
    const tenantId = req.admin.tenant_id;

    // Récupérer client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({
        success: false,
        error: 'Client non trouvé'
      });
    }

    // Récupérer RDV
    const { data: rdvs } = await supabase
      .from('rendez_vous')
      .select('*, services(nom)')
      .eq('client_id', clientId)
      .order('date_rdv', { ascending: false });

    const nbRdv = rdvs?.length || 0;
    const rdvsTermines = rdvs?.filter(r => r.statut === 'termine') || [];
    const caTotal = rdvsTermines.reduce((sum, r) => sum + (parseFloat(r.prix) || 0), 0);
    const panierMoyen = rdvsTermines.length > 0 ? caTotal / rdvsTermines.length : 0;

    // Services préférés
    const servicesCount = {};
    rdvs?.forEach(r => {
      const service = r.services?.nom || 'Inconnu';
      servicesCount[service] = (servicesCount[service] || 0) + 1;
    });

    const servicesPreferés = Object.entries(servicesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nom, count]) => ({ nom, count }));

    // Fréquence moyenne entre RDV
    let frequenceMoyenne = null;
    if (rdvs && rdvs.length >= 2) {
      const dates = rdvs.map(r => new Date(r.date_rdv)).sort((a, b) => a - b);
      let totalJours = 0;
      for (let i = 1; i < dates.length; i++) {
        totalJours += (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
      }
      frequenceMoyenne = Math.floor(totalJours / (dates.length - 1));
    }

    // LTV estimée (Customer Lifetime Value)
    // Projection: panier moyen × fréquence annuelle estimée × durée vie client
    const frequenceAnnuelle = frequenceMoyenne ? Math.floor(365 / frequenceMoyenne) : 4;
    const dureeVieClient = 3; // 3 ans estimation
    const ltv = panierMoyen * frequenceAnnuelle * dureeVieClient;

    // Churn
    const churn = await calculerScoreChurn(clientId, tenantId);

    // Score engagement
    const scoreEngagement = await calculerScoreEngagement(clientId, tenantId);

    // Tags du client
    const { data: clientTags } = await supabase
      .from('client_tags')
      .select('tags(*)')
      .eq('client_id', clientId);

    const tags = clientTags?.map(ct => ct.tags).filter(Boolean) || [];

    console.log(`[CRM] Analytics client ${client.prenom} ${client.nom}: CA=${caTotal}€, LTV=${ltv.toFixed(0)}€, Churn=${churn.score}`);

    res.json({
      success: true,
      client: {
        ...client,
        tags,
      },
      analytics: {
        nb_rdv: nbRdv,
        nb_rdv_termines: rdvsTermines.length,
        ca_total: Math.round(caTotal * 100) / 100,
        panier_moyen: Math.round(panierMoyen * 100) / 100,
        ltv_estimee: Math.round(ltv),
        frequence_moyenne_jours: frequenceMoyenne,
        services_preferes: servicesPreferés,
        score_engagement: scoreEngagement,
        churn,
      },
      rdv_historique: rdvs?.slice(0, 10) || [],
    });
  } catch (error) {
    console.error('[CRM] Erreur analytics client:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ═══════════════════════════════════════════════════════════
// FONCTIONS HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Calcule le nombre de clients correspondant aux criteres
 */
async function calculerClientsSegment(tenantId, criteres) {
  const clients = await getClientsParCriteres(tenantId, criteres);
  return clients.length;
}

/**
 * Recupere les clients correspondant aux criteres
 */
async function getClientsParCriteres(tenantId, criteres) {
  try {
    let query = supabase
      .from('clients')
      .select('*, client_tags(tag_id, tags(nom, couleur))')
      .eq('tenant_id', tenantId);

    // Appliquer criteres numeriques
    if (criteres.ca_min) {
      query = query.gte('ca_total', criteres.ca_min);
    }
    if (criteres.ca_max) {
      query = query.lte('ca_total', criteres.ca_max);
    }
    if (criteres.nb_rdv_min) {
      query = query.gte('nb_rdv_total', criteres.nb_rdv_min);
    }
    if (criteres.nb_rdv_max) {
      query = query.lte('nb_rdv_total', criteres.nb_rdv_max);
    }
    if (criteres.score_min) {
      query = query.gte('score_engagement', criteres.score_min);
    }

    // Derniere visite
    if (criteres.derniere_visite_jours_max) {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - criteres.derniere_visite_jours_max);
      query = query.gte('derniere_visite', dateLimit.toISOString().split('T')[0]);
    }

    if (criteres.derniere_visite_jours_min) {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - criteres.derniere_visite_jours_min);
      query = query.lte('derniere_visite', dateLimit.toISOString().split('T')[0]);
    }

    const { data: clients, error } = await query;

    if (error) {
      console.error('[CRM] Erreur requete clients:', error);
      return [];
    }

    let resultat = clients || [];

    // Filtrer par tags si specifie
    if (criteres.tags && criteres.tags.length > 0) {
      resultat = resultat.filter(client => {
        const clientTagsNoms = client.client_tags?.map(ct => ct.tags?.nom).filter(Boolean) || [];
        // Mode "au moins un tag"
        return criteres.tags.some(tag => clientTagsNoms.includes(tag));
      });
    }

    return resultat;
  } catch (error) {
    console.error('[CRM] Erreur getClientsParCriteres:', error);
    return [];
  }
}

export default router;
