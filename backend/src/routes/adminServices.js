import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import logger from '../config/logger.js';

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
    const mappedServices = services.map(s => {
      const tauxTva = s.taux_tva ?? 20;
      const taxeCnaps = s.taxe_cnaps ?? false;
      const tauxCnaps = s.taux_cnaps ?? 0.50;

      // Calcul: prix TTC -> prix HT -> montant TVA
      // Si taxe CNAPS: HT = Base HT + CNAPS, puis TVA sur le tout
      const prixHtBase = tauxTva > 0 ? Math.round(s.prix / (1 + tauxTva / 100)) : s.prix;

      let montantCnaps = 0;
      let prixHtTotal = prixHtBase;
      if (taxeCnaps && tauxCnaps > 0) {
        // La taxe CNAPS s'applique sur le HT de base et est soumise à TVA
        montantCnaps = Math.round(prixHtBase * tauxCnaps / 100);
        prixHtTotal = prixHtBase + montantCnaps;
      }

      const montantTva = tauxTva > 0 ? s.prix - prixHtTotal : 0;

      return {
        ...s,
        duree_minutes: s.duree || 0,
        taux_tva: tauxTva,
        taxe_cnaps: taxeCnaps,
        taux_cnaps: tauxCnaps,
        actif: s.actif ?? true,
        // Calculs prix
        prix_ht_base: prixHtBase,
        montant_cnaps: montantCnaps,
        prix_ht: prixHtTotal,
        prix_tva: montantTva
      };
    });

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
      .maybeSingle();

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

    const { nom, description, prix, duree_minutes, duree, taux_tva, taxe_cnaps, taux_cnaps, categorie, actif } = req.body;

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
    const { data: service, error } = await supabase
      .from('services')
      .insert({
        tenant_id: tenantId,
        nom,
        description: description || null,
        prix: Math.round(prix), // Prix déjà en centimes depuis le frontend
        duree: serviceDuree, // Le champ s'appelle 'duree' dans la DB
        taux_tva: taux_tva !== undefined ? parseFloat(taux_tva) : 20, // TVA par défaut 20%
        taxe_cnaps: taxe_cnaps ?? false, // Taxe CNAPS (sécurité privée)
        taux_cnaps: taux_cnaps !== undefined ? parseFloat(taux_cnaps) : 0.50, // Taux CNAPS par défaut 0.50%
        categorie: categorie || null,
        actif: actif ?? true,
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

    const { nom, description, prix, duree_minutes, duree, taux_tva, taxe_cnaps, taux_cnaps, categorie, actif } = req.body;

    const updates = {};
    if (nom !== undefined) updates.nom = nom;
    if (description !== undefined) updates.description = description;
    if (prix !== undefined) updates.prix = Math.round(prix); // Prix déjà en centimes depuis le frontend
    // Accepter duree_minutes OU duree pour la durée
    if (duree_minutes !== undefined) updates.duree = duree_minutes;
    if (duree !== undefined) updates.duree = duree;
    if (taux_tva !== undefined) updates.taux_tva = parseFloat(taux_tva);
    if (taxe_cnaps !== undefined) updates.taxe_cnaps = taxe_cnaps;
    if (taux_cnaps !== undefined) updates.taux_cnaps = parseFloat(taux_cnaps);
    if (categorie !== undefined) updates.categorie = categorie;
    if (actif !== undefined) updates.actif = actif;

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
router.patch('/:id/toggle', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Récupérer le service actuel
    const { data: current, error: fetchError } = await supabase
      .from('services')
      .select('actif')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !current) {
      return res.status(404).json({ error: 'Service introuvable' });
    }

    // Inverser le statut
    const newActif = !(current.actif ?? true);

    const { data: service, error } = await supabase
      .from('services')
      .update({ actif: newActif })
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ service, actif: newActif });
  } catch (error) {
    console.error('[ADMIN SERVICES] Erreur toggle:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
