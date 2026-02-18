/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║   ADMIN SEGMENTS ROUTES - CRM Segmentation (Pro/Business)                     ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║   GET    /segments             - Liste des segments                           ║
 * ║   POST   /segments             - Créer un segment                             ║
 * ║   GET    /segments/:id         - Détails d'un segment                         ║
 * ║   PUT    /segments/:id         - Modifier un segment                          ║
 * ║   DELETE /segments/:id         - Supprimer un segment                         ║
 * ║   GET    /segments/:id/clients - Clients d'un segment                         ║
 * ║   POST   /segments/:id/clients - Ajouter clients à un segment                 ║
 * ║   DELETE /segments/:id/clients - Retirer clients d'un segment                 ║
 * ║   POST   /segments/:id/refresh - Recalculer segment dynamique                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// Middleware pour vérifier plan Pro/Business
async function requireProPlan(req, res, next) {
  try {
    const tenantId = req.admin.tenant_id;
    const { data: tenant } = await supabase
      .from('tenants')
      .select('plan, plan_id, tier')
      .eq('id', tenantId)
      .single();

    const plan = (tenant?.plan || tenant?.plan_id || tenant?.tier || 'starter').toLowerCase();
    if (plan === 'starter') {
      return res.status(403).json({
        error: 'Fonctionnalité Pro requise',
        message: 'La segmentation CRM nécessite un plan Pro ou Business.',
        upgrade_url: '/admin/billing/upgrade'
      });
    }

    req.tenantPlan = plan;
    next();
  } catch (error) {
    console.error('[SEGMENTS] Erreur vérification plan:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}

// ════════════════════════════════════════════════════════════════════
// SEGMENTS - LISTE ET CRUD
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/segments
 * Liste tous les segments du tenant
 */
router.get('/', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { actif, type } = req.query;

    let query = supabase
      .from('segments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('ordre', { ascending: true });

    if (actif !== undefined) {
      query = query.eq('actif', actif === 'true');
    }
    if (type) {
      query = query.eq('type', type);
    }

    const { data: segments, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      segments: segments || [],
      count: segments?.length || 0
    });
  } catch (error) {
    console.error('[SEGMENTS] Erreur liste:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/segments
 * Créer un nouveau segment
 */
router.post('/', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;

    const {
      nom,
      description,
      couleur = '#6366f1',
      icone = 'users',
      type = 'manuel',
      criteres = {},
      actif = true
    } = req.body;

    if (!nom || nom.trim().length === 0) {
      return res.status(400).json({ error: 'Le nom du segment est requis' });
    }

    // Vérifier unicité du nom
    const { data: existing } = await supabase
      .from('segments')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('nom', nom.trim())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Un segment avec ce nom existe déjà' });
    }

    // Trouver le prochain ordre
    const { data: maxOrdre } = await supabase
      .from('segments')
      .select('ordre')
      .eq('tenant_id', tenantId)
      .order('ordre', { ascending: false })
      .limit(1)
      .single();

    const nouvelOrdre = (maxOrdre?.ordre || 0) + 1;

    const { data: segment, error } = await supabase
      .from('segments')
      .insert({
        tenant_id: tenantId,
        nom: nom.trim(),
        description: description?.trim() || null,
        couleur,
        icone,
        type,
        criteres,
        actif,
        ordre: nouvelOrdre,
        created_by: adminId
      })
      .select()
      .single();

    if (error) throw error;

    // Si segment dynamique, calculer les clients
    if (type === 'dynamique' || type === 'mixte') {
      await refreshDynamicSegment(segment.id, tenantId, criteres);
    }

    res.status(201).json({
      success: true,
      segment,
      message: 'Segment créé avec succès'
    });
  } catch (error) {
    console.error('[SEGMENTS] Erreur création:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * GET /api/admin/segments/:id
 * Détails d'un segment avec statistiques
 */
router.get('/:id', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: segment, error } = await supabase
      .from('segments')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !segment) {
      return res.status(404).json({ error: 'Segment non trouvé' });
    }

    // Récupérer le nombre de clients
    const { count: nbClients } = await supabase
      .from('segment_clients')
      .select('*', { count: 'exact', head: true })
      .eq('segment_id', id);

    // Calculer le CA total des clients du segment
    const { data: clientIds } = await supabase
      .from('segment_clients')
      .select('client_id')
      .eq('segment_id', id);

    let caTotal = 0;
    if (clientIds && clientIds.length > 0) {
      const ids = clientIds.map(c => c.client_id);
      const { data: reservations } = await supabase
        .from('reservations')
        .select('prix_total')
        .eq('tenant_id', tenantId)
        .in('client_id', ids)
        .in('statut', ['confirme', 'termine']);

      caTotal = (reservations || []).reduce((sum, r) => sum + (r.prix_total || 0), 0);
    }

    res.json({
      success: true,
      segment: {
        ...segment,
        nb_clients: nbClients || 0,
        ca_total_euros: (caTotal / 100).toFixed(2)
      }
    });
  } catch (error) {
    console.error('[SEGMENTS] Erreur détails:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/admin/segments/:id
 * Modifier un segment
 */
router.put('/:id', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const {
      nom,
      description,
      couleur,
      icone,
      type,
      criteres,
      actif,
      ordre
    } = req.body;

    // Vérifier que le segment existe et appartient au tenant
    const { data: existing } = await supabase
      .from('segments')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Segment non trouvé' });
    }

    // Construire l'objet de mise à jour
    const updates = {};
    if (nom !== undefined) updates.nom = nom.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (couleur !== undefined) updates.couleur = couleur;
    if (icone !== undefined) updates.icone = icone;
    if (type !== undefined) updates.type = type;
    if (criteres !== undefined) updates.criteres = criteres;
    if (actif !== undefined) updates.actif = actif;
    if (ordre !== undefined) updates.ordre = ordre;

    const { data: segment, error } = await supabase
      .from('segments')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Si les critères ont changé et segment dynamique, recalculer
    if (criteres !== undefined && (segment.type === 'dynamique' || segment.type === 'mixte')) {
      await refreshDynamicSegment(id, tenantId, criteres);
    }

    res.json({
      success: true,
      segment,
      message: 'Segment modifié avec succès'
    });
  } catch (error) {
    console.error('[SEGMENTS] Erreur modification:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/admin/segments/:id
 * Supprimer un segment
 */
router.delete('/:id', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('segments')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Segment supprimé'
    });
  } catch (error) {
    console.error('[SEGMENTS] Erreur suppression:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// CLIENTS DU SEGMENT
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/segments/:id/clients
 * Liste les clients d'un segment
 */
router.get('/:id/clients', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Vérifier que le segment existe
    const { data: segment } = await supabase
      .from('segments')
      .select('id, nom')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!segment) {
      return res.status(404).json({ error: 'Segment non trouvé' });
    }

    // Récupérer les clients du segment avec leurs infos
    const { data: segmentClients, count, error } = await supabase
      .from('segment_clients')
      .select(`
        id, source, added_at, notes,
        clients:client_id(id, nom, prenom, telephone, email)
      `, { count: 'exact' })
      .eq('segment_id', id)
      .eq('tenant_id', tenantId)
      .range(offset, offset + limitNum - 1);

    if (error) throw error;

    // Enrichir avec stats par client
    const clientsEnriched = await Promise.all(
      (segmentClients || []).map(async (sc) => {
        // CA du client
        const { data: rdvs } = await supabase
          .from('reservations')
          .select('prix_total')
          .eq('client_id', sc.clients.id)
          .eq('tenant_id', tenantId)
          .in('statut', ['confirme', 'termine']);

        const ca = (rdvs || []).reduce((sum, r) => sum + (r.prix_total || 0), 0);

        return {
          segment_client_id: sc.id,
          source: sc.source,
          added_at: sc.added_at,
          notes: sc.notes,
          client: {
            ...sc.clients,
            ca_total_euros: (ca / 100).toFixed(2),
            nb_rdv: rdvs?.length || 0
          }
        };
      })
    );

    res.json({
      success: true,
      segment_nom: segment.nom,
      clients: clientsEnriched,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        pages: Math.ceil((count || 0) / limitNum)
      }
    });
  } catch (error) {
    console.error('[SEGMENTS] Erreur liste clients:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/segments/:id/clients
 * Ajouter des clients à un segment
 */
router.post('/:id/clients', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const { id } = req.params;
    const { client_ids, notes } = req.body;

    if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
      return res.status(400).json({ error: 'client_ids requis (tableau d\'IDs)' });
    }

    // Vérifier que le segment existe
    const { data: segment } = await supabase
      .from('segments')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!segment) {
      return res.status(404).json({ error: 'Segment non trouvé' });
    }

    // Ajouter les clients (ignore les doublons)
    const inserts = client_ids.map(clientId => ({
      segment_id: id,
      client_id: clientId,
      tenant_id: tenantId,
      source: 'manuel',
      added_by: adminId,
      notes: notes || null
    }));

    const { data: added, error } = await supabase
      .from('segment_clients')
      .upsert(inserts, { onConflict: 'segment_id,client_id', ignoreDuplicates: true })
      .select();

    if (error) throw error;

    res.json({
      success: true,
      added_count: added?.length || 0,
      message: `${added?.length || 0} client(s) ajouté(s) au segment`
    });
  } catch (error) {
    console.error('[SEGMENTS] Erreur ajout clients:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/admin/segments/:id/clients
 * Retirer des clients d'un segment
 */
router.delete('/:id/clients', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { client_ids } = req.body;

    if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
      return res.status(400).json({ error: 'client_ids requis (tableau d\'IDs)' });
    }

    const { error } = await supabase
      .from('segment_clients')
      .delete()
      .eq('segment_id', id)
      .eq('tenant_id', tenantId)
      .in('client_id', client_ids);

    if (error) throw error;

    res.json({
      success: true,
      message: `${client_ids.length} client(s) retiré(s) du segment`
    });
  } catch (error) {
    console.error('[SEGMENTS] Erreur suppression clients:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/segments/:id/refresh
 * Recalculer un segment dynamique
 */
router.post('/:id/refresh', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Récupérer le segment
    const { data: segment } = await supabase
      .from('segments')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!segment) {
      return res.status(404).json({ error: 'Segment non trouvé' });
    }

    if (segment.type === 'manuel') {
      return res.status(400).json({ error: 'Les segments manuels ne peuvent pas être recalculés' });
    }

    const result = await refreshDynamicSegment(id, tenantId, segment.criteres);

    res.json({
      success: true,
      ...result,
      message: 'Segment recalculé avec succès'
    });
  } catch (error) {
    console.error('[SEGMENTS] Erreur refresh:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// FONCTION HELPER: Refresh segment dynamique
// ════════════════════════════════════════════════════════════════════

async function refreshDynamicSegment(segmentId, tenantId, criteres) {
  try {
    // Construire la requête selon les critères
    let query = supabase
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId);

    // Critère: dernière visite max X jours
    if (criteres.derniere_visite_max_jours) {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - criteres.derniere_visite_max_jours);
      query = query.or(`derniere_visite.lt.${dateLimit.toISOString()},derniere_visite.is.null`);
    }

    // Critère: créé depuis X jours
    if (criteres.created_days_ago) {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - criteres.created_days_ago);
      query = query.gte('created_at', dateLimit.toISOString());
    }

    const { data: clientsBase } = await query;

    if (!clientsBase || clientsBase.length === 0) {
      return { nb_clients: 0, added: 0, removed: 0 };
    }

    // Filtrer par nombre de RDV et CA si nécessaire
    let clientsFiltered = clientsBase;

    if (criteres.min_rdv || criteres.min_ca_euros) {
      const enrichedClients = await Promise.all(
        clientsBase.map(async (client) => {
          const { data: rdvs } = await supabase
            .from('reservations')
            .select('prix_total')
            .eq('client_id', client.id)
            .eq('tenant_id', tenantId)
            .in('statut', ['confirme', 'termine']);

          return {
            id: client.id,
            nb_rdv: rdvs?.length || 0,
            ca_euros: (rdvs || []).reduce((sum, r) => sum + (r.prix_total || 0), 0) / 100
          };
        })
      );

      clientsFiltered = enrichedClients.filter(c => {
        if (criteres.min_rdv && c.nb_rdv < criteres.min_rdv) return false;
        if (criteres.min_ca_euros && c.ca_euros < criteres.min_ca_euros) return false;
        return true;
      });
    }

    // Récupérer les clients actuels du segment (source auto)
    const { data: currentClients } = await supabase
      .from('segment_clients')
      .select('client_id')
      .eq('segment_id', segmentId)
      .eq('source', 'auto');

    const currentIds = new Set((currentClients || []).map(c => c.client_id));
    const newIds = new Set(clientsFiltered.map(c => c.id));

    // Clients à ajouter
    const toAdd = clientsFiltered.filter(c => !currentIds.has(c.id));
    // Clients à retirer (uniquement auto, pas les manuels)
    const toRemove = (currentClients || []).filter(c => !newIds.has(c.client_id));

    // Ajouter les nouveaux clients
    if (toAdd.length > 0) {
      const inserts = toAdd.map(c => ({
        segment_id: segmentId,
        client_id: c.id,
        tenant_id: tenantId,
        source: 'auto'
      }));

      await supabase
        .from('segment_clients')
        .upsert(inserts, { onConflict: 'segment_id,client_id', ignoreDuplicates: true });
    }

    // Retirer les clients qui ne correspondent plus (uniquement auto)
    if (toRemove.length > 0) {
      const removeIds = toRemove.map(c => c.client_id);
      await supabase
        .from('segment_clients')
        .delete()
        .eq('segment_id', segmentId)
        .eq('source', 'auto')
        .in('client_id', removeIds);
    }

    // Compter le total final
    const { count: nbTotal } = await supabase
      .from('segment_clients')
      .select('*', { count: 'exact', head: true })
      .eq('segment_id', segmentId);

    // Mettre à jour les stats du segment
    await supabase
      .from('segments')
      .update({ nb_clients: nbTotal || 0 })
      .eq('id', segmentId);

    return {
      nb_clients: nbTotal || 0,
      added: toAdd.length,
      removed: toRemove.length
    };
  } catch (error) {
    console.error('[SEGMENTS] Erreur refreshDynamicSegment:', error);
    return { nb_clients: 0, added: 0, removed: 0, error: error.message };
  }
}

export default router;
