import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// GET /api/admin/services - Liste tous les services
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { data: services, error } = await supabase
      .from('services')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('ordre', { ascending: true });

    if (error) throw error;

    // Mapper les champs pour le frontend (duree -> duree_minutes)
    const mappedServices = services.map(s => ({
      ...s,
      duree_minutes: s.duree || 0, // Le champ DB s'appelle 'duree'
      taux_tva: s.taux_tva || 20, // TVA par défaut 20%
      // Calculs prix HT et TVA
      prix_ht: s.taux_tva > 0 ? Math.round(s.prix / (1 + (s.taux_tva || 20) / 100)) : s.prix,
      prix_tva: s.taux_tva > 0 ? s.prix - Math.round(s.prix / (1 + (s.taux_tva || 20) / 100)) : 0
    }));

    res.json({ services: mappedServices });
  } catch (error) {
    console.error('[ADMIN SERVICES] Erreur liste:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/services/:id - Un service avec stats
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    // Récupérer le service
    const { data: service, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    if (!service) {
      return res.status(404).json({ error: 'Service introuvable' });
    }

    // Récupérer toutes les réservations de ce service
    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, client_id, statut, prix_total, date')
      .eq('service_id', req.params.id)
      .eq('tenant_id', tenantId);

    const allRdv = reservations || [];
    const nbRdvTotal = allRdv.length;
    const nbRdvTermines = allRdv.filter(r => r.statut === 'termine').length;
    const nbRdvAnnules = allRdv.filter(r => r.statut === 'annule').length;

    // CA total (RDV terminés uniquement) - prix en centimes
    const caTotal = allRdv
      .filter(r => r.statut === 'termine')
      .reduce((sum, r) => sum + (r.prix_total || 0), 0) / 100;

    // Nombre de clients uniques
    const clientIds = [...new Set(allRdv.map(r => r.client_id).filter(Boolean))];
    const nbClientsUniques = clientIds.length;

    // Dernière réservation
    const derniereReservation = allRdv
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date || null;

    // Top 5 clients (les plus fidèles pour ce service)
    const clientCounts = {};
    allRdv.forEach(r => {
      if (r.client_id) {
        clientCounts[r.client_id] = (clientCounts[r.client_id] || 0) + 1;
      }
    });
    const topClientIds = Object.entries(clientCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => parseInt(id));

    let topClients = [];
    if (topClientIds.length > 0) {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, prenom, nom')
        .in('id', topClientIds);

      topClients = topClientIds.map(id => {
        const client = clients?.find(c => c.id === id);
        return client ? {
          ...client,
          nb_rdv: clientCounts[id]
        } : null;
      }).filter(Boolean);
    }

    // Historique des 10 dernières réservations
    const { data: historiqueRdv } = await supabase
      .from('reservations')
      .select('id, client_id, date, heure, statut, prix_total, clients(prenom, nom)')
      .eq('service_id', req.params.id)
      .eq('tenant_id', tenantId)
      .order('date', { ascending: false })
      .limit(10);

    res.json({
      service: {
        ...service,
        duree_minutes: service.duree
      },
      stats: {
        ca_total: caTotal,
        nb_rdv_total: nbRdvTotal,
        nb_rdv_termines: nbRdvTermines,
        nb_rdv_annules: nbRdvAnnules,
        nb_clients_uniques: nbClientsUniques,
        derniere_reservation: derniereReservation
      },
      top_clients: topClients,
      historique_rdv: (historiqueRdv || []).map(rdv => ({
        ...rdv,
        client_nom: rdv.clients ? `${rdv.clients.prenom} ${rdv.clients.nom}` : 'Client inconnu'
      }))
    });
  } catch (error) {
    console.error('[ADMIN SERVICES] Erreur détail:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/services - Créer service
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { nom, description, prix, duree_minutes, duree, taux_tva } = req.body;

    // Accepter duree_minutes OU duree pour la durée
    const serviceDuree = duree_minutes || duree;

    if (!nom || prix === undefined || !serviceDuree) {
      return res.status(400).json({ error: 'Nom, prix et durée requis' });
    }

    // Récupérer le prochain ordre (🔒 TENANT ISOLATION)
    const { data: maxOrdre } = await supabase
      .from('services')
      .select('ordre')
      .eq('tenant_id', tenantId)
      .order('ordre', { ascending: false })
      .limit(1)
      .single();

    const ordre = (maxOrdre?.ordre || 0) + 1;

    // 🔒 TENANT ISOLATION: Inclure tenant_id dans l'insert
    // Note: la colonne 'actif' et 'categorie' n'existent pas dans la DB
    // Le frontend envoie déjà le prix en centimes
    const { data: service, error } = await supabase
      .from('services')
      .insert({
        tenant_id: tenantId,
        nom,
        description: description || null,
        prix: Math.round(prix), // Prix déjà en centimes depuis le frontend
        duree: serviceDuree, // Le champ s'appelle 'duree' dans la DB
        taux_tva: taux_tva !== undefined ? parseFloat(taux_tva) : 20, // TVA par défaut 20%
        ordre
      })
      .select()
      .single();

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'create',
      entite: 'service',
      entite_id: service.id,
      details: { nom: service.nom, prix: service.prix }
    });

    res.json({ service });
  } catch (error) {
    console.error('[ADMIN SERVICES] Erreur création:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/services/:id - Modifier service
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { nom, description, prix, duree_minutes, duree, taux_tva } = req.body;

    const updates = {};
    if (nom !== undefined) updates.nom = nom;
    if (description !== undefined) updates.description = description;
    if (prix !== undefined) updates.prix = Math.round(prix); // Prix déjà en centimes depuis le frontend
    // Accepter duree_minutes OU duree pour la durée
    if (duree_minutes !== undefined) updates.duree = duree_minutes;
    if (duree !== undefined) updates.duree = duree;
    if (taux_tva !== undefined) updates.taux_tva = parseFloat(taux_tva);

    // 🔒 TENANT ISOLATION
    const { data: service, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'update',
      entite: 'service',
      entite_id: service.id,
      details: { updates }
    });

    res.json({ service });
  } catch (error) {
    console.error('[ADMIN SERVICES] Erreur modification:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/services/:id - Supprimer service
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    // Vérifier si service utilisé dans des réservations (🔒 TENANT ISOLATION)
    const { count } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('service_id', req.params.id)
      .eq('tenant_id', tenantId);

    if (count > 0) {
      return res.status(400).json({
        error: `Impossible de supprimer: ${count} réservation(s) utilisent ce service`
      });
    }

    // 🔒 TENANT ISOLATION
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'delete',
      entite: 'service',
      entite_id: req.params.id
    });

    res.json({ message: 'Service supprimé' });
  } catch (error) {
    console.error('[ADMIN SERVICES] Erreur suppression:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/admin/services/:id/toggle - Activer/Désactiver
// Note: La colonne 'actif' n'existe pas dans la DB actuellement
// Cette route est désactivée
router.patch('/:id/toggle', authenticateAdmin, async (req, res) => {
  res.status(501).json({ error: 'Fonctionnalité non disponible - colonne actif non présente' });
});

export default router;
