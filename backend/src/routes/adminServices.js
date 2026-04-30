import express from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import logger from '../config/logger.js';
import { validate } from '../middleware/validate.js';
import { paginate } from '../middleware/paginate.js';
import { success, error as apiError, paginated } from '../utils/response.js';
import { requirePrestationsQuota } from '../middleware/quotas.js';
import { getEffectiveConstraints, minutesToTime } from '../utils/employeeConstraints.js';

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
  } catch (err) {
    console.error('[ADMIN SERVICES] Erreur liste:', err);
    apiError(res, 'Erreur serveur');
  }
});

// ============================================
// EQUIPE — Membres accessibles a tous les plans
// IMPORTANT: Doit etre AVANT /:id pour ne pas etre capture par le wildcard
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
      .select('id, nom, prenom, role, statut, jours_travailles, avatar_url, email, telephone, adresse_rue, adresse_cp, adresse_ville, pause_debut, pause_fin, max_heures_jour, pause_min_minutes')
      .eq('tenant_id', tenantId)
      .order('nom');

    if (error) throw error;

    success(res, { data: membres || [] });
  } catch (err) {
    console.error('[SERVICES] Erreur liste equipe:', err);
    apiError(res, 'Erreur recuperation equipe');
  }
});

/**
 * GET /api/admin/services/equipe/:id/prochaine-dispo
 * Retourne la prochaine heure disponible d'un membre pour une date donnée
 */
router.get('/equipe/:id/prochaine-dispo', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const membreId = parseInt(req.params.id);
    const { date } = req.query;

    if (!date) {
      return apiError(res, 'Date requise', 'BAD_REQUEST', 400);
    }

    // Récupérer les contraintes du membre
    const { data: membreData } = await supabase
      .from('rh_membres')
      .select('id, nom, prenom, pause_debut, pause_fin, max_heures_jour, pause_min_minutes')
      .eq('id', membreId)
      .eq('tenant_id', tenantId)
      .single();

    const constraints = membreData ? getEffectiveConstraints(membreData) : null;

    // Récupérer toutes les résas du membre ce jour-là (non annulées)
    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, heure, duree_minutes, duree_totale_minutes, heure_fin')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .eq('membre_id', membreId)
      .not('statut', 'in', '("annule","no_show")');

    // Récupérer les lignes assignées à ce membre ce jour-là
    const reservationIds = (reservations || []).map(r => r.id);

    // Lignes classiques : toutes les lignes du membre (sans filtre date — on filtre après)
    const { data: lignesMembre } = await supabase
      .from('reservation_lignes')
      .select('heure_debut, heure_fin, duree_minutes, reservation_id, date')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membreId);

    // Lignes multi-jours : lignes avec date = date demandée (résa parente peut avoir une autre date)
    const { data: multiDayLignes } = await supabase
      .from('reservation_lignes')
      .select('heure_debut, heure_fin, duree_minutes, reservation_id, date')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membreId)
      .eq('date', date);

    // Helper pour convertir une ligne en créneau occupé
    const ligneToSlot = (l) => {
      if (l.heure_debut && l.heure_fin) {
        return { debut: l.heure_debut, fin: l.heure_fin };
      } else if (l.heure_debut && l.duree_minutes) {
        const [h, m] = l.heure_debut.split(':').map(Number);
        const finMin = h * 60 + m + (l.duree_minutes || 60);
        const fin = `${String(Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`;
        return { debut: l.heure_debut, fin };
      }
      return null;
    };

    // Construire la liste des créneaux occupés
    const creneauxOccupes = [];

    // --- 1. Lignes multi-jours (date = date demandée, résa parente possiblement différente) ---
    const multiDayResaIds = [...new Set((multiDayLignes || []).map(l => l.reservation_id))];
    const processedMultiDayResaIds = new Set();
    if (multiDayResaIds.length > 0) {
      const { data: parentResas } = await supabase
        .from('reservations')
        .select('id, statut')
        .eq('tenant_id', tenantId)
        .in('id', multiDayResaIds)
        .not('statut', 'in', '("annule","no_show")');
      const validParentIds = new Set((parentResas || []).map(r => r.id));
      (multiDayLignes || []).forEach(l => {
        if (!validParentIds.has(l.reservation_id)) return;
        processedMultiDayResaIds.add(l.reservation_id);
        const slot = ligneToSlot(l);
        if (slot) creneauxOccupes.push(slot);
      });
    }

    // --- 2. Lignes classiques (résa du même jour) ---
    const ligneReservationIds = [...new Set((lignesMembre || []).map(l => l.reservation_id))];
    const allResaIds = [...new Set([...reservationIds, ...ligneReservationIds])];

    let resasParDate = {};
    if (allResaIds.length > 0) {
      const { data: allResas } = await supabase
        .from('reservations')
        .select('id, date, heure, duree_minutes, duree_totale_minutes, heure_fin')
        .eq('tenant_id', tenantId)
        .in('id', allResaIds)
        .eq('date', date)
        .not('statut', 'in', '("annule","no_show")');
      (allResas || []).forEach(r => { resasParDate[r.id] = r; });
    }

    // Créneaux depuis les lignes (priorité: plus précis)
    const resaAvecLignes = new Set();
    (lignesMembre || []).forEach(l => {
      if (!resasParDate[l.reservation_id]) return; // pas ce jour-là
      // Skip lignes multi-jours qui appartiennent à un autre jour
      if (l.date && l.date !== date) return;
      // Éviter double-comptage si déjà traité en multi-jours
      if (processedMultiDayResaIds.has(l.reservation_id)) {
        resaAvecLignes.add(l.reservation_id);
        return;
      }
      resaAvecLignes.add(l.reservation_id);
      const slot = ligneToSlot(l);
      if (slot) creneauxOccupes.push(slot);
    });

    // Créneaux depuis les résas directes (sans lignes)
    (reservations || []).forEach(r => {
      if (resaAvecLignes.has(r.id)) return; // déjà couvert par les lignes
      const heure = r.heure || '09:00';
      const duree = r.duree_totale_minutes || r.duree_minutes || 60;
      if (r.heure_fin) {
        creneauxOccupes.push({ debut: heure, fin: r.heure_fin });
      } else {
        const [h, m] = heure.split(':').map(Number);
        const finMin = h * 60 + m + duree;
        const fin = `${String(Math.floor(finMin / 60)).padStart(2, '0')}:${String(finMin % 60).padStart(2, '0')}`;
        creneauxOccupes.push({ debut: heure, fin });
      }
    });

    // Trier par heure de début
    creneauxOccupes.sort((a, b) => a.debut.localeCompare(b.debut));

    // La prochaine dispo = après le dernier créneau occupé
    let prochaineDispo = null;
    if (creneauxOccupes.length > 0) {
      let latestEnd = '00:00';
      for (const c of creneauxOccupes) {
        if (c.fin > latestEnd) latestEnd = c.fin;
      }
      prochaineDispo = latestEnd;
    }

    // Arrondir au prochain quart d'heure (ex: 10:42 → 10:45)
    const roundUp15 = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      const totalMin = h * 60 + m;
      const rounded = Math.ceil(totalMin / 15) * 15;
      return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`;
    };

    // Si c'est aujourd'hui, appliquer une marge de 1h par rapport à maintenant
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (date === todayStr) {
      const nowPlusMarge = (now.getHours() + 1) * 60 + now.getMinutes();
      const margeStr = `${String(Math.floor(nowPlusMarge / 60)).padStart(2, '0')}:${String(nowPlusMarge % 60).padStart(2, '0')}`;
      if (!prochaineDispo || prochaineDispo < margeStr) {
        prochaineDispo = margeStr;
      }
    }

    // Toujours arrondir au quart d'heure supérieur
    if (prochaineDispo) {
      prochaineDispo = roundUp15(prochaineDispo);
    }

    // Appliquer les contraintes horaires du membre
    if (prochaineDispo && constraints) {
      // Si la dispo tombe dans la pause déjeuner → sauter à pause_fin
      const dispoMin = timeToMin(prochaineDispo);
      if (dispoMin >= constraints.pauseDebutMin && dispoMin < constraints.pauseFinMin) {
        prochaineDispo = roundUp15(minutesToTime(constraints.pauseFinMin));
      }

      // Vérifier max heures accumulées
      const totalOccupeMin = creneauxOccupes.reduce((sum, c) => {
        return sum + (timeToMin(c.fin) - timeToMin(c.debut));
      }, 0);
      if (totalOccupeMin >= constraints.maxHeuresJour * 60) {
        prochaineDispo = null; // plus dispo ce jour
      }
    }

    // Helper pour convertir HH:MM en minutes
    function timeToMin(t) {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    }

    success(res, {
      membre_id: membreId,
      date,
      prochaine_dispo: prochaineDispo,
      creneaux_occupes: creneauxOccupes,
      contraintes: constraints || null
    });
  } catch (err) {
    console.error('[SERVICES] Erreur prochaine dispo:', err);
    apiError(res, 'Erreur calcul prochaine dispo');
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
      return apiError(res, 'Date et heure requis', 'BAD_REQUEST', 400);
    }

    const { data: membres, error: membresError } = await supabase
      .from('rh_membres')
      .select('id, nom, prenom, role, statut, jours_travailles')
      .eq('tenant_id', tenantId)
      .eq('statut', 'actif')
      .order('nom');

    if (membresError) throw membresError;

    const dateObj = new Date(date);
    const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const jourSemaine = jours[dateObj.getDay()];

    const [heureStart, minuteStart] = heure.split(':').map(Number);
    const startMinutes = heureStart * 60 + minuteStart;
    const endMinutes = startMinutes + parseInt(duree);

    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, heure, duree_minutes, duree_totale_minutes, membre_id, statut')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .not('membre_id', 'is', null)
      .not('statut', 'in', '("annule","termine")');

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

    const disponibles = (membres || []).filter(m => {
      const joursTravail = m.jours_travailles || ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
      return joursTravail.includes(jourSemaine) && !membresOccupes.has(m.id);
    });

    success(res, {
      disponibles,
      occupes: membres?.filter(m => membresOccupes.has(m.id)).map(m => ({
        id: m.id, nom: m.nom, prenom: m.prenom, role: m.role,
        raison: 'Deja reserve sur ce creneau'
      })) || [],
      creneau: { date, heure, duree: parseInt(duree), jour: jourSemaine }
    });
  } catch (err) {
    console.error('[SERVICES] Erreur equipe disponible:', err);
    apiError(res, 'Erreur verification disponibilites');
  }
});

/**
 * POST /api/admin/services/equipe
 * Ajouter un membre (CRUD basique, tous plans)
 */
router.post('/equipe', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { nom, prenom, email, telephone, role, adresse_rue, adresse_cp, adresse_ville, pause_debut, pause_fin, max_heures_jour, pause_min_minutes } = req.body;

    if (!nom || !prenom) {
      return apiError(res, 'Nom et prenom requis', 'BAD_REQUEST', 400);
    }

    const insertData = {
      tenant_id: tenantId,
      nom,
      prenom,
      email: email || null,
      telephone: telephone || null,
      role: role || 'employe',
      statut: 'actif',
      jours_travailles: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'],
      adresse_rue: adresse_rue || null,
      adresse_cp: adresse_cp || null,
      adresse_ville: adresse_ville || null,
    };

    // Contraintes horaires (NULL = défauts système)
    if (pause_debut !== undefined) insertData.pause_debut = pause_debut || null;
    if (pause_fin !== undefined) insertData.pause_fin = pause_fin || null;
    if (max_heures_jour !== undefined) insertData.max_heures_jour = max_heures_jour != null ? Number(max_heures_jour) : null;
    if (pause_min_minutes !== undefined) insertData.pause_min_minutes = pause_min_minutes != null ? Number(pause_min_minutes) : null;

    const { data: membre, error } = await supabase
      .from('rh_membres')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    success(res, { membre }, 201);
  } catch (err) {
    console.error('[SERVICES] Erreur ajout membre:', err);
    apiError(res, 'Erreur ajout membre');
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
    const { nom, prenom, email, telephone, role, statut, jours_travailles, adresse_rue, adresse_cp, adresse_ville, pause_debut, pause_fin, max_heures_jour, pause_min_minutes } = req.body;

    const updates = {};
    if (nom !== undefined) updates.nom = nom;
    if (prenom !== undefined) updates.prenom = prenom;
    if (email !== undefined) updates.email = email || null;
    if (telephone !== undefined) updates.telephone = telephone || null;
    if (role !== undefined) updates.role = role;
    if (statut !== undefined) updates.statut = statut;
    if (jours_travailles !== undefined) updates.jours_travailles = jours_travailles;
    if (adresse_rue !== undefined) updates.adresse_rue = adresse_rue || null;
    if (adresse_cp !== undefined) updates.adresse_cp = adresse_cp || null;
    if (adresse_ville !== undefined) updates.adresse_ville = adresse_ville || null;
    // Contraintes horaires (empty string → null = défauts système)
    if (pause_debut !== undefined) updates.pause_debut = pause_debut || null;
    if (pause_fin !== undefined) updates.pause_fin = pause_fin || null;
    if (max_heures_jour !== undefined) updates.max_heures_jour = max_heures_jour != null && max_heures_jour !== '' ? Number(max_heures_jour) : null;
    if (pause_min_minutes !== undefined) updates.pause_min_minutes = pause_min_minutes != null && pause_min_minutes !== '' ? Number(pause_min_minutes) : null;

    const { data: membre, error } = await supabase
      .from('rh_membres')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Invalider le cache admin WhatsApp si telephone modifié
    if (telephone !== undefined) {
      try {
        const { invalidateAdminPhoneCache } = await import('../services/adminDetectionService.js');
        invalidateAdminPhoneCache(tenantId);
      } catch (_) { /* non-bloquant */ }
    }

    success(res, { membre });
  } catch (err) {
    console.error('[SERVICES] Erreur modif membre:', err);
    apiError(res, 'Erreur modification membre');
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

    success(res, { message: 'Membre supprimé' });
  } catch (err) {
    console.error('[SERVICES] Erreur suppression membre:', err);
    apiError(res, 'Erreur suppression membre');
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
      return apiError(res, 'Service introuvable', 'NOT_FOUND', 404);
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
        .eq('tenant_id', tenantId)
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

    success(res, {
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
  } catch (err) {
    console.error('[ADMIN SERVICES] Erreur détail:', err);
    apiError(res, 'Erreur serveur');
  }
});

// POST /api/admin/services - Créer service
router.post('/', authenticateAdmin, requirePrestationsQuota, async (req, res) => {
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
      // Mode facturation (par_nuit | forfait)
      facturation,
    } = req.body;

    // Accepter duree_minutes OU duree pour la durée
    const serviceDuree = duree_minutes || duree || 0;

    if (!nom) {
      return apiError(res, 'Nom requis', 'BAD_REQUEST', 400);
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
    if (facturation && ['par_nuit', 'forfait'].includes(facturation)) {
      insertData.facturation = facturation;
    }

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

    success(res, { service });
  } catch (err) {
    console.error('[ADMIN SERVICES] Erreur création:', err);
    apiError(res, 'Erreur serveur');
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
      // Mode de facturation (hotel annexes surtout) : par_nuit | forfait
      facturation,
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
    // Mode facturation (whitelist)
    if (facturation !== undefined && ['par_nuit', 'forfait'].includes(facturation)) {
      updates.facturation = facturation;
    }

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

    success(res, { service });
  } catch (err) {
    console.error('[ADMIN SERVICES] Erreur modification:', err);
    apiError(res, 'Erreur serveur');
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
      return apiError(res, `Impossible de supprimer: ${count} réservation(s) utilisent ce service`, 'BAD_REQUEST', 400);
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

    success(res, { message: 'Service supprimé' });
  } catch (err) {
    console.error('[ADMIN SERVICES] Erreur suppression:', err);
    apiError(res, 'Erreur serveur');
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
      return apiError(res, 'Service introuvable', 'NOT_FOUND', 404);
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

    success(res, { service, actif: newActif });
  } catch (err) {
    console.error('[ADMIN SERVICES] Erreur toggle:', err);
    apiError(res, 'Erreur serveur');
  }
});

export default router;
