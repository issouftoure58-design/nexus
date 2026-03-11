import express from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import logger from '../config/logger.js';
import { validate } from '../middleware/validate.js';
import { paginate } from '../middleware/paginate.js';
import { paginated } from '../utils/response.js';

const updateServiceSchema = z.object({
  nom: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  prix: z.number().int().min(0).optional(),
  duree_minutes: z.number().int().min(0).optional(),
  duree: z.number().int().min(0).optional(),
  taux_tva: z.number().min(0).max(100).optional(),
  taxe_cnaps: z.boolean().optional(),
  taux_cnaps: z.number().min(0).max(100).optional(),
  categorie: z.string().max(100).optional(),
  actif: z.boolean().optional(),
}).passthrough();

const router = express.Router();

// GET /api/admin/services - Liste tous les services
router.get('/', authenticateAdmin, paginate(), async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;
    const { page, limit, offset } = req.pagination;

    const { count: total } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const { data: services, error } = await supabase
      .from('services')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('ordre', { ascending: true })
      .range(offset, offset + limit - 1);

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

    paginated(res, { data: mappedServices, page, limit, total: total || 0 });
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

    const {
      nom, description, prix, duree_minutes, duree, taux_tva, taxe_cnaps, taux_cnaps,
      categorie, actif, pricing_mode, taux_horaire,
      // Restaurant
      capacite, zone, service_dispo,
      // Hotel
      capacite_max, etage, vue, type_chambre, equipements,
    } = req.body;

    // Accepter duree_minutes OU duree pour la durée
    const serviceDuree = duree_minutes || duree || 0;

    if (!nom) {
      return res.status(400).json({ error: 'Nom requis' });
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
    const insertData = {
      tenant_id: tenantId,
      nom,
      description: description || null,
      prix: prix !== undefined ? Math.round(prix) : 0,
      duree: serviceDuree,
      taux_tva: taux_tva !== undefined ? parseFloat(taux_tva) : 20,
      taxe_cnaps: taxe_cnaps ?? false,
      taux_cnaps: taux_cnaps !== undefined ? parseFloat(taux_cnaps) : 0.50,
      categorie: categorie || null,
      actif: actif ?? true,
      ordre,
    };

    // Champs optionnels par type métier
    if (pricing_mode) insertData.pricing_mode = pricing_mode;
    if (taux_horaire !== undefined) insertData.taux_horaire = taux_horaire;
    if (capacite !== undefined) insertData.capacite = capacite;
    if (zone) insertData.zone = zone;
    if (service_dispo) insertData.service_dispo = service_dispo;
    if (capacite_max !== undefined) insertData.capacite_max = capacite_max;
    if (etage !== undefined) insertData.etage = etage;
    if (vue) insertData.vue = vue;
    if (type_chambre) insertData.type_chambre = type_chambre;
    if (equipements) insertData.equipements = equipements;

    const { data: service, error } = await supabase
      .from('services')
      .insert(insertData)
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
router.put('/:id', authenticateAdmin, validate(updateServiceSchema), async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const {
      nom, description, prix, duree_minutes, duree, taux_tva, taxe_cnaps, taux_cnaps,
      categorie, actif, pricing_mode, taux_horaire,
      // Restaurant
      capacite, zone, service_dispo,
      // Hotel
      capacite_max, etage, vue, type_chambre, equipements,
    } = req.body;

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
    if (pricing_mode !== undefined) updates.pricing_mode = pricing_mode;
    if (taux_horaire !== undefined) updates.taux_horaire = taux_horaire;
    // Restaurant fields
    if (capacite !== undefined) updates.capacite = capacite;
    if (zone !== undefined) updates.zone = zone;
    if (service_dispo !== undefined) updates.service_dispo = service_dispo;
    // Hotel fields
    if (capacite_max !== undefined) updates.capacite_max = capacite_max;
    if (etage !== undefined) updates.etage = etage;
    if (vue !== undefined) updates.vue = vue;
    if (type_chambre !== undefined) updates.type_chambre = type_chambre;
    if (equipements !== undefined) updates.equipements = equipements;

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

// ============================================
// EQUIPE — Membres accessibles a tous les plans
// (Necessaire pour assigner des prestations)
// ============================================

/**
 * GET /api/admin/services/equipe
 * Liste des membres actifs (tous plans)
 */
router.get('/equipe', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: membres, error } = await supabase
      .from('rh_membres')
      .select('id, nom, prenom, role, statut, jours_travailles, avatar_url')
      .eq('tenant_id', tenantId)
      .order('nom');

    if (error) throw error;

    res.json({ data: membres || [] });
  } catch (error) {
    console.error('[SERVICES] Erreur liste equipe:', error);
    res.status(500).json({ error: 'Erreur recuperation equipe' });
  }
});

/**
 * GET /api/admin/services/equipe/disponibles
 * Membres disponibles pour un creneau (tous plans)
 */
router.get('/equipe/disponibles', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { date, heure, duree = 60 } = req.query;

    if (!date || !heure) {
      return res.status(400).json({ error: 'Date et heure requis' });
    }

    // 1. Membres actifs
    const { data: membres, error: membresError } = await supabase
      .from('rh_membres')
      .select('id, nom, prenom, role, statut, jours_travailles')
      .eq('tenant_id', tenantId)
      .eq('statut', 'actif')
      .order('nom');

    if (membresError) throw membresError;

    // 2. Jour de la semaine
    const dateObj = new Date(date);
    const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const jourSemaine = jours[dateObj.getDay()];

    // 3. Plage horaire demandee
    const [heureStart, minuteStart] = heure.split(':').map(Number);
    const startMinutes = heureStart * 60 + minuteStart;
    const endMinutes = startMinutes + parseInt(duree);

    // 4. Reservations du jour
    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, heure, duree_minutes, duree_totale_minutes, membre_id, statut')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .not('membre_id', 'is', null)
      .not('statut', 'in', '("annule","termine")');

    // 5. Multi-membres
    const { data: reservationMembres } = await supabase
      .from('reservation_membres')
      .select('reservation_id, membre_id')
      .eq('tenant_id', tenantId);

    const reservationMembreMap = {};
    (reservationMembres || []).forEach(rm => {
      if (!reservationMembreMap[rm.reservation_id]) {
        reservationMembreMap[rm.reservation_id] = [];
      }
      reservationMembreMap[rm.reservation_id].push(rm.membre_id);
    });

    // 6. Membres occupes
    const membresOccupes = new Set();
    (reservations || []).forEach(resa => {
      const [h, m] = (resa.heure || '09:00').split(':').map(Number);
      const resaStart = h * 60 + m;
      const resaDuree = resa.duree_totale_minutes || resa.duree_minutes || 60;
      const resaEnd = resaStart + resaDuree;

      if (!(endMinutes <= resaStart || startMinutes >= resaEnd)) {
        if (resa.membre_id) membresOccupes.add(resa.membre_id);
        (reservationMembreMap[resa.id] || []).forEach(mid => membresOccupes.add(mid));
      }
    });

    // 7. Filtrer
    const disponibles = (membres || []).filter(m => {
      const joursTravail = m.jours_travailles || ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
      return joursTravail.includes(jourSemaine) && !membresOccupes.has(m.id);
    });

    res.json({
      disponibles,
      occupes: membres?.filter(m => membresOccupes.has(m.id)).map(m => ({
        id: m.id, nom: m.nom, prenom: m.prenom, role: m.role,
        raison: 'Deja reserve sur ce creneau'
      })) || [],
      creneau: { date, heure, duree: parseInt(duree), jour: jourSemaine }
    });
  } catch (error) {
    console.error('[SERVICES] Erreur equipe disponible:', error);
    res.status(500).json({ error: 'Erreur verification disponibilites' });
  }
});

/**
 * POST /api/admin/services/equipe
 * Ajouter un membre (CRUD basique, tous plans)
 */
router.post('/equipe', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { nom, prenom, email, telephone, role } = req.body;

    if (!nom || !prenom) {
      return res.status(400).json({ error: 'Nom et prenom requis' });
    }

    const { data: membre, error } = await supabase
      .from('rh_membres')
      .insert({
        tenant_id: tenantId,
        nom,
        prenom,
        email: email || null,
        telephone: telephone || null,
        role: role || 'employe',
        statut: 'actif',
        jours_travailles: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'],
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(membre);
  } catch (error) {
    console.error('[SERVICES] Erreur ajout membre:', error);
    res.status(500).json({ error: 'Erreur ajout membre' });
  }
});

/**
 * PUT /api/admin/services/equipe/:id
 * Modifier un membre (CRUD basique, tous plans)
 */
router.put('/equipe/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { nom, prenom, email, telephone, role, statut, jours_travailles } = req.body;

    const updates = {};
    if (nom !== undefined) updates.nom = nom;
    if (prenom !== undefined) updates.prenom = prenom;
    if (email !== undefined) updates.email = email || null;
    if (telephone !== undefined) updates.telephone = telephone || null;
    if (role !== undefined) updates.role = role;
    if (statut !== undefined) updates.statut = statut;
    if (jours_travailles !== undefined) updates.jours_travailles = jours_travailles;

    const { data: membre, error } = await supabase
      .from('rh_membres')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json(membre);
  } catch (error) {
    console.error('[SERVICES] Erreur modif membre:', error);
    res.status(500).json({ error: 'Erreur modification membre' });
  }
});

/**
 * DELETE /api/admin/services/equipe/:id
 * Supprimer un membre (tous plans)
 */
router.delete('/equipe/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('rh_membres')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('[SERVICES] Erreur suppression membre:', error);
    res.status(500).json({ error: 'Erreur suppression membre' });
  }
});

export default router;
