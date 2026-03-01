import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/moduleProtection.js';
import { checkConflicts } from '../utils/conflictChecker.js';
import { createFactureFromReservation, updateFactureStatutFromReservation, cancelFactureFromReservation } from './factures.js';
import { triggerWorkflows } from '../automation/workflowEngine.js';
import { enforceTrialLimit } from '../services/trialService.js';
import { getDefaultLocation } from '../services/tenantBusinessService.js';
import logger from '../config/logger.js';

const router = express.Router();

// 🔒 AUTH FIRST, then MODULE PROTECTION
router.use(authenticateAdmin);
router.use(requireModule('reservations'));

// Statuts possibles pour une réservation
// - demande: nouvelle réservation en attente de confirmation
// - en_attente_paiement: réservation créée via panier, en attente de paiement en ligne
// - confirme: réservation confirmée
// - annule: réservation annulée
// - termine: réservation terminée
// - no_show: client ne s'est pas présenté
const STATUTS_VALIDES = ['demande', 'en_attente', 'en_attente_paiement', 'confirme', 'annule', 'termine', 'no_show'];

// ════════════════════════════════════════════════════════════════════
// LISTE & FILTRES
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/reservations
// Liste toutes les réservations avec filtres et pagination
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const {
      statut,
      date_debut,
      date_fin,
      client_id,
      service,
      page = 1,
      limit = 20,
      sort = 'date',
      order = 'desc'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Query de base avec jointures (🔒 TENANT ISOLATION)
    let query = supabase
      .from('reservations')
      .select(`
        *,
        clients (
          id,
          nom,
          prenom,
          telephone,
          email,
          type_client,
          raison_sociale,
          adresse,
          code_postal,
          ville
        ),
        membre:rh_membres (
          id,
          nom,
          prenom,
          role
        ),
        reservation_lignes (
          id,
          service_id,
          service_nom,
          quantite,
          duree_minutes,
          prix_unitaire,
          prix_total,
          membre_id,
          heure_debut,
          heure_fin,
          membre:rh_membres (
            id,
            nom,
            prenom,
            role
          )
        ),
        reservation_membres (
          id,
          membre_id,
          role,
          membre:rh_membres (
            id,
            nom,
            prenom,
            role
          )
        )
      `, { count: 'exact' })
      .eq('tenant_id', tenantId);

    // Filtres
    if (statut) {
      query = query.eq('statut', statut);
    }
    if (date_debut) {
      query = query.gte('date', date_debut);
    }
    if (date_fin) {
      query = query.lte('date', date_fin);
    }
    if (client_id) {
      query = query.eq('client_id', client_id);
    }
    if (service) {
      query = query.ilike('service_nom', `%${service}%`);
    }

    // Tri (date + heure pour ordre chronologique complet)
    query = query.order(sort, { ascending: order === 'asc' });
    if (sort === 'date') {
      query = query.order('heure', { ascending: order === 'asc' });
    }

    // Pagination
    query = query.range(offset, offset + limitNum - 1);

    const { data: reservations, error, count } = await query;

    if (error) throw error;

    // Default lieu basé sur le type de business
    const defaultLieu = getDefaultLocation(tenantId);

    // Formater les réservations
    const formattedReservations = (reservations || []).map(r => {
      // Calculer la durée totale à partir des services
      const lignes = r.reservation_lignes || [];
      const dureeTotale = lignes.length > 0
        ? lignes.reduce((sum, l) => sum + (l.duree_minutes || 0) * (l.quantite || 1), 0)
        : r.duree_minutes || 60;

      return {
        id: r.id,
        date_rdv: r.date,
        heure_rdv: r.heure,
        statut: r.statut,
        lieu: r.lieu || defaultLieu,
        prix_total: r.prix_total ? r.prix_total / 100 : 0,
        frais_deplacement: r.frais_deplacement ? r.frais_deplacement / 100 : 0,
        notes: r.notes,
        created_at: r.created_at,
        created_via: r.created_via,
        client: r.clients ? {
          id: r.clients.id,
          nom: r.clients.nom,
          prenom: r.clients.prenom,
          telephone: r.clients.telephone,
          email: r.clients.email,
          type_client: r.clients.type_client,
          raison_sociale: r.clients.raison_sociale,
          adresse: r.clients.adresse,
          code_postal: r.clients.code_postal,
          ville: r.clients.ville
        } : null,
        // Service principal (rétro-compatibilité)
        service: {
          nom: r.service_nom || r.service,
          duree_minutes: r.duree_minutes
        },
        service_nom: r.service_nom || r.service,
        // Durée totale calculée
        duree_totale: dureeTotale,
        duree: dureeTotale,
        // Multi-services avec membres assignés et heures effectives
        services: lignes.map(l => ({
          id: l.id,
          service_id: l.service_id,
          service_nom: l.service_nom,
          quantite: l.quantite,
          duree_minutes: l.duree_minutes,
          prix_unitaire: l.prix_unitaire ? l.prix_unitaire / 100 : 0,
          prix_total: l.prix_total ? l.prix_total / 100 : 0,
          membre_id: l.membre_id,
          heure_debut: l.heure_debut || null,
          heure_fin: l.heure_fin || null,
          // Supabase nested join: membre est dans l.membre
          membre: l.membre ? {
            id: l.membre.id,
            nom: l.membre.nom,
            prenom: l.membre.prenom,
            role: l.membre.role
          } : null
        })),
        adresse_client: r.adresse_client,
        distance_km: r.distance_km,
        duree_trajet_minutes: r.duree_trajet_minutes,
        // Membre principal (rétro-compatibilité)
        membre: r.membre ? {
          id: r.membre.id,
          nom: r.membre.nom,
          prenom: r.membre.prenom,
          role: r.membre.role
        } : null,
        // Tous les membres assignés
        membres: (r.reservation_membres || []).map(rm => ({
          id: rm.membre?.id,
          nom: rm.membre?.nom,
          prenom: rm.membre?.prenom,
          role: rm.membre?.role,
          assignment_role: rm.role
        }))
      };
    });

    res.json({
      reservations: formattedReservations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum)
      }
    });
  } catch (error) {
    console.error('[ADMIN RESERVATIONS] Erreur liste:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/reservations/:id
// Détail complet d'une réservation
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    // 🔒 TENANT ISOLATION - Inclure lignes et membres
    const { data: reservation, error } = await supabase
      .from('reservations')
      .select(`
        *,
        clients (
          id,
          nom,
          prenom,
          telephone,
          email,
          type_client,
          raison_sociale,
          adresse,
          code_postal,
          ville
        ),
        membre:rh_membres (
          id,
          nom,
          prenom,
          role
        ),
        reservation_lignes (
          id,
          service_id,
          service_nom,
          quantite,
          duree_minutes,
          prix_unitaire,
          prix_total,
          membre_id,
          heure_debut,
          heure_fin,
          membre:rh_membres (
            id,
            nom,
            prenom,
            role
          )
        ),
        reservation_membres (
          id,
          membre_id,
          role,
          membre:rh_membres (
            id,
            nom,
            prenom,
            role
          )
        )
      `)
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    if (!reservation) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    // Récupérer les informations du service depuis la table services (🔒 TENANT ISOLATION)
    const serviceName = reservation.service_nom || reservation.service;
    const { data: serviceInfo } = await supabase
      .from('services')
      .select('id, nom, prix, duree, description')
      .eq('tenant_id', tenantId)
      .ilike('nom', serviceName || '')
      .single();

    // Calculer la durée totale à partir des services
    const lignes = reservation.reservation_lignes || [];
    const dureeTotale = lignes.length > 0
      ? lignes.reduce((sum, l) => sum + (l.duree_minutes || 0) * (l.quantite || 1), 0)
      : reservation.duree_minutes || 60;

    // Default lieu basé sur le type de business
    const defaultLieu = getDefaultLocation(tenantId);

    // Formater la réponse
    const formattedReservation = {
      id: reservation.id,
      date_rdv: reservation.date,
      heure_rdv: reservation.heure,
      statut: reservation.statut,
      lieu: reservation.lieu || defaultLieu,
      prix_total: reservation.prix_total ? reservation.prix_total / 100 : 0,
      frais_deplacement: reservation.frais_deplacement ? reservation.frais_deplacement / 100 : 0,
      notes: reservation.notes,
      created_at: reservation.created_at,
      updated_at: reservation.updated_at,
      client: reservation.clients ? {
        id: reservation.clients.id,
        nom: reservation.clients.nom,
        prenom: reservation.clients.prenom,
        telephone: reservation.clients.telephone,
        email: reservation.clients.email,
        type_client: reservation.clients.type_client,
        raison_sociale: reservation.clients.raison_sociale,
        adresse: reservation.clients.adresse,
        code_postal: reservation.clients.code_postal,
        ville: reservation.clients.ville
      } : null,
      service: {
        id: serviceInfo?.id || null,
        nom: reservation.service_nom || reservation.service,
        prix_base: serviceInfo?.prix ? serviceInfo.prix / 100 : 0,
        duree_minutes: reservation.duree_minutes || serviceInfo?.duree || 0,
        description: serviceInfo?.description || null
      },
      service_nom: reservation.service_nom || reservation.service,
      // Durée totale calculée
      duree_totale: dureeTotale,
      duree: dureeTotale,
      // Multi-services avec membres assignés et heures effectives
      services: lignes.map(l => ({
        id: l.id,
        service_id: l.service_id,
        service_nom: l.service_nom,
        quantite: l.quantite,
        duree_minutes: l.duree_minutes,
        prix_unitaire: l.prix_unitaire ? l.prix_unitaire / 100 : 0,
        prix_total: l.prix_total ? l.prix_total / 100 : 0,
        membre_id: l.membre_id,
        heure_debut: l.heure_debut || null,
        heure_fin: l.heure_fin || null,
        membre: l.membre ? {
          id: l.membre.id,
          nom: l.membre.nom,
          prenom: l.membre.prenom,
          role: l.membre.role
        } : null
      })),
      // Tous les membres assignés
      membres: (reservation.reservation_membres || []).map(rm => ({
        id: rm.membre?.id,
        nom: rm.membre?.nom,
        prenom: rm.membre?.prenom,
        role: rm.membre?.role,
        assignment_role: rm.role
      })),
      deplacement: reservation.lieu === 'domicile' ? {
        adresse_client: reservation.adresse_client,
        distance_km: reservation.distance_km,
        duree_trajet_minutes: reservation.duree_trajet_minutes,
        frais: reservation.frais_deplacement ? reservation.frais_deplacement / 100 : 0
      } : null,
      created_via: reservation.created_via || 'chatbot',
      membre: reservation.membre ? {
        id: reservation.membre.id,
        nom: reservation.membre.nom,
        prenom: reservation.membre.prenom,
        role: reservation.membre.role
      } : null
    };

    res.json({ reservation: formattedReservation });
  } catch (error) {
    console.error('[ADMIN RESERVATIONS] Erreur détail:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// ACTIONS
// ════════════════════════════════════════════════════════════════════

// POST /api/admin/reservations
// Créer une réservation/prestation avec multi-services et multi-membres
router.post('/', authenticateAdmin, enforceTrialLimit('reservations'), async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const {
      client_id,
      service,
      date_rdv,
      heure_rdv,
      heure_fin,
      date_fin,
      lieu,
      adresse_client,
      adresse_facturation,
      notes,
      membre_id,
      // Nouvelles données multi-services/membres
      services = [],
      membre_ids = [],
      // Mode de tarification
      pricing_mode,
      // Geste commercial
      remise_type,
      remise_valeur,
      remise_motif,
      // Totaux calculés
      montant_ht,
      montant_tva,
      prix_total,
      duree_totale_minutes,
      frais_deplacement
    } = req.body;

    // Validation
    const hasServices = services && services.length > 0;
    const isHourlyMode = pricing_mode === 'hourly';

    // En mode horaire, les heures sont définies par affectation (agent), pas globalement
    if (!client_id || (!service && !hasServices) || !date_rdv) {
      return res.status(400).json({
        error: 'Champs requis : client_id, service(s), date_rdv'
      });
    }

    // Heure requise sauf en mode horaire (où les heures sont par agent)
    if (!isHourlyMode && !heure_rdv) {
      return res.status(400).json({
        error: 'Champs requis : heure_rdv'
      });
    }

    // Vérifier que le client existe et récupérer ses infos (🔒 TENANT ISOLATION)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, prenom, nom, telephone')
      .eq('id', client_id)
      .eq('tenant_id', tenantId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: 'Client introuvable' });
    }

    // Nom du premier service (rétro-compatibilité)
    const servicePrincipal = hasServices ? services[0].service_nom : service;

    // En mode horaire, extraire l'heure de début du premier agent si pas d'heure globale
    let heureEffective = heure_rdv;
    if (isHourlyMode && !heure_rdv && hasServices) {
      // Chercher l'heure de début du premier agent dans les affectations
      for (const svc of services) {
        if (svc.affectations && svc.affectations.length > 0) {
          const firstAff = svc.affectations.find(a => a.heure_debut);
          if (firstAff && firstAff.heure_debut) {
            heureEffective = firstAff.heure_debut;
            break;
          }
        }
      }
      // Fallback si aucune heure trouvée
      if (!heureEffective) heureEffective = '08:00';
    }

    // Créer via createReservationUnified (même logique que tous les canaux)
    const { createReservationUnified } = await import('../core/unified/nexusCore.js');

    const result = await createReservationUnified({
      tenant_id: tenantId,  // 🔒 TENANT ISOLATION
      service_name: servicePrincipal,
      date: date_rdv,
      heure: heureEffective,
      client_nom: `${client.prenom || ''} ${client.nom || ''}`.trim() || 'Client',
      client_telephone: client.telephone || '',
      lieu: lieu || getDefaultLocation(tenantId),
      adresse: adresse_client || null,
      notes: notes || '[Via admin]',
      statut: 'confirme'
    }, 'admin', {
      sendSMS: false,
      // Skip validation horaires pour admin (surtout mode horaire = sécurité 24/7)
      skipValidation: true
    });

    if (!result.success) {
      // Conflit horaire
      if (result.error && result.error.includes('Conflit')) {
        return res.status(409).json({
          error: result.error,
          suggestions: result.suggestions || []
        });
      }
      return res.status(400).json({ error: result.error || 'Erreur création' });
    }

    const reservationId = result.reservationId;

    // Mise à jour avec les données enrichies (🔒 TENANT ISOLATION)
    const updateData = {
      client_id: client_id,
      adresse_client: adresse_client || null,
      adresse_facturation: adresse_facturation || null
    };

    // Ajouter les totaux si fournis
    if (montant_ht !== undefined) updateData.montant_ht = montant_ht;
    if (montant_tva !== undefined) updateData.montant_tva = montant_tva;
    if (prix_total !== undefined) updateData.prix_total = prix_total;
    if (duree_totale_minutes !== undefined) updateData.duree_totale_minutes = duree_totale_minutes;
    if (frais_deplacement !== undefined) updateData.frais_deplacement = frais_deplacement;

    // Ajouter les infos de remise
    if (remise_type) {
      updateData.remise_type = remise_type;
      updateData.remise_valeur = remise_valeur || 0;
      updateData.remise_motif = remise_motif || null;
    }

    // Premier membre comme membre principal (rétro-compatibilité)
    if (membre_id || (membre_ids && membre_ids.length > 0)) {
      updateData.membre_id = membre_id || membre_ids[0];
    }

    await supabase
      .from('reservations')
      .update(updateData)
      .eq('id', reservationId)
      .eq('tenant_id', tenantId);

    // === INSERTION MULTI-SERVICES (reservation_lignes) avec membre assigné ===
    if (hasServices && services.length > 0) {
      console.log('[ADMIN RESERVATIONS] Services reçus:', JSON.stringify(services, null, 2));
      const lignesData = [];

      for (const s of services) {
        // Si le service a des affectations (mode horaire avec plusieurs agents)
        if (s.affectations && s.affectations.length > 0) {
          console.log(`[ADMIN RESERVATIONS] Service ${s.service_nom} a ${s.affectations.length} affectations:`, s.affectations);
          for (const aff of s.affectations) {
            if (aff.membre_id) {
              // Calculer la durée depuis les heures si disponibles
              let dureeMinutes = s.duree_minutes || 60;
              if (aff.heure_debut && aff.heure_fin) {
                const [startH, startM] = aff.heure_debut.replace('--', '00').split(':').map(Number);
                const [endH, endM] = aff.heure_fin.replace('--', '00').split(':').map(Number);
                let startMinutes = startH * 60 + (startM || 0);
                let endMinutes = endH * 60 + (endM || 0);
                // Gestion passage minuit
                if (endMinutes < startMinutes) endMinutes += 24 * 60;
                dureeMinutes = endMinutes - startMinutes;
              }

              const ligneData = {
                reservation_id: reservationId,
                tenant_id: tenantId,
                service_id: s.service_id || null,
                service_nom: s.service_nom,
                quantite: 1, // Chaque affectation = 1 agent
                duree_minutes: dureeMinutes,
                prix_unitaire: s.prix_unitaire || s.taux_horaire || 0,
                prix_total: s.prix_unitaire || s.taux_horaire || 0,
                membre_id: aff.membre_id
              };
              // Ajouter heures si présentes (colonnes optionnelles)
              if (aff.heure_debut) ligneData.heure_debut = aff.heure_debut;
              if (aff.heure_fin) ligneData.heure_fin = aff.heure_fin;
              lignesData.push(ligneData);
            }
          }
        } else {
          // Mode classique: une ligne par service
          lignesData.push({
            reservation_id: reservationId,
            tenant_id: tenantId,
            service_id: s.service_id || null,
            service_nom: s.service_nom,
            quantite: s.quantite || 1,
            duree_minutes: s.duree_minutes || 60,
            prix_unitaire: s.prix_unitaire || 0,
            prix_total: (s.prix_unitaire || 0) * (s.quantite || 1),
            membre_id: s.membre_id || null
          });
        }
      }

      if (lignesData.length > 0) {
        const { error: lignesError } = await supabase
          .from('reservation_lignes')
          .insert(lignesData);

        if (lignesError) {
          console.error('[ADMIN RESERVATIONS] Erreur insertion lignes:', lignesError);
        }
      }
    }

    // === INSERTION MULTI-MEMBRES (reservation_membres) ===
    // Extraire tous les membres uniques des lignes de service et affectations
    const membresFromServices = [];
    if (hasServices) {
      for (const s of services) {
        if (s.affectations && s.affectations.length > 0) {
          for (const aff of s.affectations) {
            if (aff.membre_id) membresFromServices.push(aff.membre_id);
          }
        } else if (s.membre_id) {
          membresFromServices.push(s.membre_id);
        }
      }
    }
    const uniqueMembresFromServices = [...new Set(membresFromServices)];

    // Combiner avec membre_ids fournis directement
    const allMembreIds = [...new Set([...uniqueMembresFromServices, ...(membre_ids || [])])];

    if (allMembreIds.length > 0) {
      const membresData = allMembreIds.map((mid, index) => ({
        reservation_id: reservationId,
        tenant_id: tenantId,
        membre_id: mid,
        role: index === 0 ? 'principal' : 'executant'
      }));

      const { error: membresError } = await supabase
        .from('reservation_membres')
        .insert(membresData);

      if (membresError) {
        console.error('[ADMIN RESERVATIONS] Erreur insertion membres:', membresError);
      } else {
        console.log(`[ADMIN RESERVATIONS] ${allMembreIds.length} membre(s) assigné(s):`, allMembreIds);
      }
    }

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'create',
      entite: 'reservation',
      entite_id: reservationId,
      details: {
        client_id,
        services: hasServices ? services.map(s => s.service_nom) : [service],
        date_rdv,
        heure_rdv,
        lieu,
        membre_ids: membre_ids || (membre_id ? [membre_id] : []),
        prix_total,
        remise_type,
        remise_valeur
      }
    });

    // Récupérer la réservation complète pour la réponse (🔒 TENANT ISOLATION)
    const { data: reservation } = await supabase
      .from('reservations')
      .select(`
        *,
        membre:rh_membres (id, nom, prenom, role),
        clients (id, nom, prenom, telephone, email)
      `)
      .eq('id', reservationId)
      .eq('tenant_id', tenantId)
      .single();

    // 📄 Note: Pas de création de facture à ce stade
    // La facture sera créée quand la réservation passera en statut "terminé"

    res.json({
      reservation,
      facture: null,
      lignes_count: hasServices ? services.length : 1,
      membres_count: membre_ids ? membre_ids.length : (membre_id ? 1 : 0)
    });
  } catch (error) {
    console.error('[ADMIN RESERVATIONS] Erreur création:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/reservations/:id
// Modifier une réservation
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const {
      date_rdv,
      heure_rdv,
      service,
      statut,
      lieu,
      adresse_client,
      distance_km,
      duree_trajet_minutes,
      frais_deplacement,
      notes,
      membre_id
    } = req.body;

    // Récupérer la réservation actuelle avec téléphone client (🔒 TENANT ISOLATION)
    const { data: currentRdv, error: fetchError } = await supabase
      .from('reservations')
      .select('*, clients(telephone)')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !currentRdv) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    // Si RDV annulé/terminé, on autorise seulement le changement de statut
    if ((currentRdv.statut === 'annule' || currentRdv.statut === 'termine') && !statut) {
      return res.status(400).json({
        error: `Impossible de modifier une réservation ${currentRdv.statut}. Changez d'abord le statut.`
      });
    }

    const updates = {
      updated_at: new Date().toISOString()
    };

    // Si changement de date/heure, vérifier chevauchements (durée incluse)
    if (date_rdv || heure_rdv) {
      const newDate = date_rdv || currentRdv.date;
      const newHeure = heure_rdv || currentRdv.heure;
      const duree = currentRdv.duree_minutes || 60;

      const conflictResult = await checkConflicts(supabase, newDate, newHeure, duree, req.params.id, tenantId);
      if (conflictResult.conflict) {
        const c = conflictResult.rdv;
        return res.status(409).json({
          error: `Conflit : ${c.client} (${c.service}) jusqu'à ${c.fin}`,
          suggestions: conflictResult.suggestions
        });
      }

      if (date_rdv) updates.date = date_rdv;
      if (heure_rdv) updates.heure = heure_rdv;
    }

    // Si changement de service, recalculer le prix (🔒 TENANT ISOLATION)
    if (service && service !== currentRdv.service_nom) {
      const { data: serviceInfo, error: serviceError } = await supabase
        .from('services')
        .select('nom, prix, duree')
        .eq('tenant_id', tenantId)
        .ilike('nom', service)
        .single();

      if (serviceError || !serviceInfo) {
        return res.status(404).json({ error: `Service introuvable: ${service}` });
      }

      updates.service_nom = serviceInfo.nom;
      updates.duree_minutes = serviceInfo.duree;

      // Recalculer prix total
      const fraisDepl = updates.frais_deplacement !== undefined
        ? updates.frais_deplacement
        : currentRdv.frais_deplacement || 0;
      updates.prix_total = serviceInfo.prix + fraisDepl;

      console.log(`[ADMIN EDIT] Service: ${currentRdv.service_nom} → ${serviceInfo.nom} (${serviceInfo.prix/100}€, ${serviceInfo.duree}min)`);
    }

    // Si changement de lieu
    if (lieu !== undefined) {
      updates.lieu = lieu;

      if (lieu === 'domicile') {
        if (adresse_client !== undefined) updates.adresse_client = adresse_client;
        if (distance_km !== undefined) updates.distance_km = distance_km;
        if (duree_trajet_minutes !== undefined) updates.duree_trajet_minutes = duree_trajet_minutes;
        if (frais_deplacement !== undefined) {
          updates.frais_deplacement = Math.round(frais_deplacement * 100);
          // Recalculer prix total (🔒 TENANT ISOLATION)
          const { data: serviceInfo } = await supabase
            .from('services')
            .select('prix')
            .eq('tenant_id', tenantId)
            .ilike('nom', updates.service_nom || currentRdv.service_nom)
            .single();

          if (serviceInfo) {
            updates.prix_total = serviceInfo.prix + updates.frais_deplacement;
          }
        }
      } else {
        // Si passage au salon, annuler les frais de déplacement
        updates.adresse_client = null;
        updates.distance_km = null;
        updates.duree_trajet_minutes = null;
        updates.frais_deplacement = 0;

        // Recalculer prix total (🔒 TENANT ISOLATION)
        const { data: serviceInfo } = await supabase
          .from('services')
          .select('prix')
          .eq('tenant_id', tenantId)
          .ilike('nom', updates.service_nom || currentRdv.service_nom)
          .single();

        if (serviceInfo) {
          updates.prix_total = serviceInfo.prix;
        }
      }
    }

    // Statut
    if (statut && statut !== currentRdv.statut) {
      updates.statut = statut;
      console.log(`[ADMIN EDIT] Statut: ${currentRdv.statut} → ${statut}`);
    }

    // Notes
    if (notes !== undefined) updates.notes = notes;

    // Membre assigné
    if (membre_id !== undefined) {
      updates.membre_id = membre_id;
      console.log(`[ADMIN EDIT] Membre: ${currentRdv.membre_id || 'aucun'} → ${membre_id || 'aucun'}`);
    }

    // Appliquer les modifications (🔒 TENANT ISOLATION)
    const { data: reservation, error } = await supabase
      .from('reservations')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // SMS notification si changement service, date ou heure
    if (updates.service_nom || updates.date || updates.heure) {
      try {
        const telephone = currentRdv.clients?.telephone;
        if (telephone) {
          const { sendConfirmationSMS } = await import('../services/bookingService.js');
          const finalDate = updates.date || currentRdv.date;
          const finalHeure = updates.heure || currentRdv.heure;
          const finalService = updates.service_nom || currentRdv.service_nom;
          const finalPrix = (updates.prix_total || currentRdv.prix_total || 0) / 100;

          await sendConfirmationSMS(telephone, {
            service: finalService,
            date: finalDate,
            heure: finalHeure,
            prixTotal: finalPrix,
            fraisDeplacement: (currentRdv.frais_deplacement || 0) / 100,
            adresse: currentRdv.adresse_client
          });
          console.log(`[ADMIN EDIT] SMS notif envoyé à ${telephone}`);
        }
      } catch (smsErr) {
        console.error('[ADMIN EDIT] SMS échoué (non bloquant):', smsErr.message);
      }
    }

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'update',
      entite: 'reservation',
      entite_id: reservation.id,
      details: { updates }
    });

    // 📄 Synchronisation facture si changement de statut
    let facture = null;
    if (updates.statut && updates.statut !== currentRdv.statut) {
      // Terminé → Confirmé : remettre la facture en "générée"
      if (updates.statut === 'confirme' && currentRdv.statut === 'termine') {
        try {
          const { data: factureExistante } = await supabase
            .from('factures')
            .select('id, numero, statut')
            .eq('reservation_id', req.params.id)
            .eq('tenant_id', tenantId)
            .single();

          if (factureExistante && factureExistante.statut === 'payee') {
            await supabase
              .from('factures')
              .update({
                statut: 'generee',
                date_paiement: null,
                mode_paiement: null
              })
              .eq('id', factureExistante.id);

            // Supprimer les écritures de paiement (BQ/CA)
            await supabase
              .from('ecritures_comptables')
              .delete()
              .eq('facture_id', factureExistante.id)
              .in('journal_code', ['BQ', 'CA']);

            console.log(`[ADMIN EDIT] Facture ${factureExistante.numero} remise en générée`);
            facture = { ...factureExistante, statut: 'generee' };
          }
        } catch (factureErr) {
          console.error('[ADMIN EDIT] Erreur retour facture générée:', factureErr.message);
        }
      }

      // Annulé : annuler la facture
      if (updates.statut === 'annule') {
        try {
          const cancelResult = await cancelFactureFromReservation(req.params.id, tenantId, false);
          if (cancelResult.success && cancelResult.facture) {
            facture = cancelResult.facture;
            console.log(`[ADMIN EDIT] Facture annulée`);
          }
        } catch (factureErr) {
          console.error('[ADMIN EDIT] Erreur annulation facture:', factureErr.message);
        }
      }
    }

    // 📝 Mise à jour des lignes de réservation (heures effectives par salarié)
    const { lignes } = req.body;
    let updatedLignes = [];
    let prixTotalRecalcule = 0;

    if (lignes && Array.isArray(lignes) && lignes.length > 0) {
      console.log(`[ADMIN EDIT] Mise à jour de ${lignes.length} lignes pour réservation ${req.params.id}`);
      console.log(`[ADMIN EDIT] IDs reçus du frontend:`, lignes.map(l => l.id));

      // Vérifier quelles lignes existent réellement pour cette réservation
      const { data: existingLignes } = await supabase
        .from('reservation_lignes')
        .select('id, service_nom')
        .eq('reservation_id', req.params.id)
        .eq('tenant_id', tenantId);
      console.log(`[ADMIN EDIT] Lignes existantes en base:`, existingLignes?.map(l => ({ id: l.id, nom: l.service_nom })));

      for (const ligne of lignes) {
        if (!ligne.id) {
          console.warn('[ADMIN EDIT] Ligne sans ID ignorée:', ligne);
          continue;
        }

        // Récupérer la ligne actuelle pour avoir le service_id et le taux
        const { data: currentLigne, error: ligneErr } = await supabase
          .from('reservation_lignes')
          .select('*')
          .eq('id', ligne.id)
          .eq('reservation_id', req.params.id)
          .single();

        if (ligneErr || !currentLigne) {
          console.warn(`[ADMIN EDIT] Ligne ${ligne.id} introuvable:`, ligneErr?.message);
          continue;
        }

        console.log(`[ADMIN EDIT] Ligne ${ligne.id} (${currentLigne.service_nom}): prix_unitaire=${currentLigne.prix_unitaire/100}€/h`);

        const ligneUpdate = {};

        // Mise à jour des heures si fournies
        if (ligne.heure_debut !== undefined) {
          // Tronquer au format HH:MM (VARCHAR(5))
          ligneUpdate.heure_debut = ligne.heure_debut ? ligne.heure_debut.slice(0, 5) : null;
        }
        if (ligne.heure_fin !== undefined) {
          ligneUpdate.heure_fin = ligne.heure_fin ? ligne.heure_fin.slice(0, 5) : null;
        }

        // Recalculer la durée et le prix si les deux heures sont fournies
        const heureDebut = ligneUpdate.heure_debut || currentLigne.heure_debut;
        const heureFin = ligneUpdate.heure_fin || currentLigne.heure_fin;

        if (heureDebut && heureFin) {
          const [startH, startM] = heureDebut.split(':').map(Number);
          const [endH, endM] = heureFin.split(':').map(Number);
          let dureeMins = (endH * 60 + endM) - (startH * 60 + startM);
          if (dureeMins < 0) dureeMins += 24 * 60; // Passage minuit
          ligneUpdate.duree_minutes = dureeMins;

          // Recalculer le prix : prix_unitaire = taux horaire
          // nouveau_prix_total = prix_unitaire × nouvelles_heures
          const quantite = currentLigne.quantite || 1;
          const heures = dureeMins / 60;
          const tauxHoraire = currentLigne.prix_unitaire; // Le taux horaire en centimes

          if (tauxHoraire) {
            const nouveauPrix = Math.round(tauxHoraire * heures);
            ligneUpdate.prix_total = nouveauPrix * quantite;
            console.log(`[ADMIN EDIT] Ligne ${ligne.id}: ${heures}h x ${tauxHoraire/100}€/h = ${ligneUpdate.prix_total/100}€`);
          }
        }

        // Ne mettre à jour que s'il y a des champs à modifier
        if (Object.keys(ligneUpdate).length > 0) {
          const { data: updatedLigne, error: ligneError } = await supabase
            .from('reservation_lignes')
            .update(ligneUpdate)
            .eq('id', ligne.id)
            .eq('tenant_id', tenantId)
            .eq('reservation_id', req.params.id)
            .select()
            .single();

          if (ligneError) {
            console.error(`[ADMIN EDIT] Erreur mise à jour ligne ${ligne.id}:`, ligneError.message);
          } else {
            updatedLignes.push(updatedLigne);
            console.log(`[ADMIN EDIT] Ligne ${ligne.id} mise à jour: ${ligneUpdate.heure_debut || heureDebut} - ${ligneUpdate.heure_fin || heureFin}`);
          }
        }
      }

      // Recalculer la durée totale et le prix total de la réservation
      const { data: allLignes } = await supabase
        .from('reservation_lignes')
        .select('duree_minutes, quantite, prix_total')
        .eq('reservation_id', req.params.id)
        .eq('tenant_id', tenantId);

      if (allLignes && allLignes.length > 0) {
        const dureeTotale = allLignes.reduce((sum, l) => sum + (l.duree_minutes || 0) * (l.quantite || 1), 0);
        prixTotalRecalcule = allLignes.reduce((sum, l) => sum + (l.prix_total || 0), 0);

        // Ajouter les frais de déplacement existants
        const fraisDeplacement = currentRdv.frais_deplacement || 0;
        const prixHT = prixTotalRecalcule + fraisDeplacement;
        const prixTTC = Math.round(prixHT * 1.2); // TVA 20%

        await supabase
          .from('reservations')
          .update({
            duree_minutes: dureeTotale,
            prix_total: prixTTC // Stocker le TTC
          })
          .eq('id', req.params.id)
          .eq('tenant_id', tenantId);

        console.log(`[ADMIN EDIT] Durée totale: ${dureeTotale} min, Prix: ${prixHT/100}€ HT → ${prixTTC/100}€ TTC`);

        // Mettre à jour la facture associée si elle existe et n'est pas payée
        const { data: factureExistante } = await supabase
          .from('factures')
          .select('id, numero, statut, montant_ht, montant_ttc')
          .eq('reservation_id', req.params.id)
          .eq('tenant_id', tenantId)
          .single();

        console.log(`[ADMIN EDIT] Facture trouvée:`, factureExistante ? `${factureExistante.numero} (${factureExistante.statut})` : 'aucune');

        if (factureExistante && factureExistante.statut !== 'payee') {
          await supabase
            .from('factures')
            .update({
              montant_ht: prixHT,
              montant_ttc: prixTTC
            })
            .eq('id', factureExistante.id)
            .eq('tenant_id', tenantId);

          console.log(`[ADMIN EDIT] Facture ${factureExistante.numero} mise à jour: ${prixHT/100}€ HT → ${prixTTC/100}€ TTC`);
        } else if (factureExistante) {
          console.log(`[ADMIN EDIT] Facture ${factureExistante.numero} déjà payée, non modifiée`);
        }
      }
    }

    res.json({ reservation, changes: updates, facture, lignes: updatedLignes });
  } catch (error) {
    console.error('[ADMIN RESERVATIONS] Erreur modification:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/admin/reservations/:id/statut
// Changer le statut d'une réservation
router.patch('/:id/statut', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { statut, mode_paiement, membre_id } = req.body;

    if (!statut || !STATUTS_VALIDES.includes(statut)) {
      return res.status(400).json({
        error: `Statut invalide. Valeurs acceptées : ${STATUTS_VALIDES.join(', ')}`
      });
    }

    // Note: mode_paiement n'est plus requis ici
    // Le paiement sera enregistré séparément via POST /factures/:id/paiement

    // Récupérer la réservation actuelle (🔒 TENANT ISOLATION)
    const { data: currentRdv, error: fetchError } = await supabase
      .from('reservations')
      .select('*, clients(nom, prenom, telephone)')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !currentRdv) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    // Empêcher certaines transitions
    if (currentRdv.statut === 'termine' && statut === 'en_attente') {
      return res.status(400).json({
        error: 'Impossible de repasser une réservation terminée en attente'
      });
    }

    // ⚠️ VALIDATION: Personnel obligatoire pour terminer une réservation
    if (statut === 'termine') {
      const membreAssigne = membre_id || currentRdv.membre_id;
      if (!membreAssigne) {
        return res.status(400).json({
          error: 'Affectation du personnel obligatoire pour terminer la prestation',
          code: 'MEMBRE_REQUIS'
        });
      }
    }

    // Préparer les données de mise à jour
    const updateData = {
      statut,
      updated_at: new Date().toISOString()
    };

    // Si membre_id fourni, l'ajouter à la mise à jour
    if (membre_id) {
      updateData.membre_id = membre_id;
    }

    // Note: mode_paiement sera enregistré lors du paiement de la facture

    // Mettre à jour le statut (🔒 TENANT ISOLATION)
    const { data: reservation, error } = await supabase
      .from('reservations')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'update_statut',
      entite: 'reservation',
      entite_id: reservation.id,
      details: { ancien_statut: currentRdv.statut, nouveau_statut: statut }
    });

    // 📄 Gestion automatique des factures selon le statut
    let facture = null;

    if (statut === 'termine') {
      // RDV terminé → Créer facture en attente de paiement (statut: 'generee')
      // La facture entre automatiquement dans le système de relance
      try {
        const factureResult = await createFactureFromReservation(req.params.id, tenantId, {
          statut: 'generee',  // Pas 'payee' - le paiement sera enregistré séparément
          updateIfExists: true
        });
        if (factureResult.success) {
          facture = factureResult.facture;

          // Calculer date_echeance = date_facture + 30 jours
          const dateFacture = new Date(facture.date_facture || new Date());
          const dateEcheance = new Date(dateFacture);
          dateEcheance.setDate(dateEcheance.getDate() + 30);

          // Mettre à jour la date d'échéance (pour le système de relance)
          await supabase
            .from('factures')
            .update({
              date_echeance: dateEcheance.toISOString().split('T')[0]
            })
            .eq('id', facture.id);

          console.log(`[ADMIN RESERVATIONS] Facture ${facture.numero} créée (en attente de paiement, échéance: ${dateEcheance.toISOString().split('T')[0]})`);

          // Note: Les écritures VT (créance client) sont générées automatiquement par createFactureFromReservation
          // Les écritures BQ/CA seront générées lors de l'enregistrement du paiement
        }
      } catch (factureErr) {
        console.error('[ADMIN RESERVATIONS] Erreur création facture:', factureErr.message);
      }

      // Déclencher workflows "rdv_completed"
      try {
        await triggerWorkflows('rdv_completed', {
          tenant_id: tenantId,
          entity: {
            ...reservation,
            type: 'rdv',
            client: currentRdv.clients,
            prenom: currentRdv.clients?.prenom,
            nom: currentRdv.clients?.nom,
            email: currentRdv.clients?.email,
            telephone: currentRdv.clients?.telephone
          }
        });
      } catch (workflowErr) {
        console.error('[ADMIN RESERVATIONS] Erreur workflow (non bloquant):', workflowErr.message);
      }
    }

    // Retour de terminé vers confirmé → Remettre la facture en "générée"
    if (statut === 'confirme' && currentRdv.statut === 'termine') {
      try {
        // Trouver la facture liée
        const { data: factureExistante } = await supabase
          .from('factures')
          .select('id, numero, statut')
          .eq('reservation_id', req.params.id)
          .eq('tenant_id', tenantId)
          .single();

        if (factureExistante && factureExistante.statut === 'payee') {
          // Remettre la facture en générée
          await supabase
            .from('factures')
            .update({
              statut: 'generee',
              date_paiement: null,
              mode_paiement: null
            })
            .eq('id', factureExistante.id);

          // Supprimer les écritures de paiement (BQ/CA)
          await supabase
            .from('ecritures_comptables')
            .delete()
            .eq('facture_id', factureExistante.id)
            .in('journal_code', ['BQ', 'CA']);

          console.log(`[ADMIN RESERVATIONS] Facture ${factureExistante.numero} remise en générée`);
          facture = { ...factureExistante, statut: 'generee' };
        }
      } catch (factureErr) {
        console.error('[ADMIN RESERVATIONS] Erreur retour facture générée:', factureErr.message);
      }
    }

    // Note: Pas de création de facture lors de la confirmation
    // La facture sera créée quand la réservation passera en statut "terminé"

    if (statut === 'annule') {
      // RDV annulé → Annuler la facture associée
      try {
        const cancelResult = await cancelFactureFromReservation(req.params.id, tenantId, false);
        if (cancelResult.success && cancelResult.facture) {
          facture = cancelResult.facture;
          console.log(`[ADMIN RESERVATIONS] Facture annulée`);
        }
      } catch (factureErr) {
        console.error('[ADMIN RESERVATIONS] Erreur annulation facture:', factureErr.message);
      }

      // Déclencher workflows "rdv_cancelled"
      try {
        await triggerWorkflows('rdv_cancelled', {
          tenant_id: tenantId,
          entity: {
            ...reservation,
            type: 'rdv',
            client: currentRdv.clients,
            prenom: currentRdv.clients?.prenom,
            nom: currentRdv.clients?.nom,
            email: currentRdv.clients?.email,
            telephone: currentRdv.clients?.telephone
          }
        });
      } catch (workflowErr) {
        console.error('[ADMIN RESERVATIONS] Erreur workflow annulation (non bloquant):', workflowErr.message);
      }
    }

    res.json({ reservation, facture });
  } catch (error) {
    console.error('[ADMIN RESERVATIONS] Erreur changement statut:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/reservations/:id
// Supprimer une réservation (cas exceptionnel)
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    // Vérifier que la réservation existe (🔒 TENANT ISOLATION)
    const { data: reservation, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !reservation) {
      return res.status(404).json({ error: 'Réservation introuvable' });
    }

    // 📄 Supprimer ou annuler la facture associée AVANT de supprimer la réservation
    let factureInfo = null;
    try {
      // Supprimer si brouillon, annuler sinon
      const cancelResult = await cancelFactureFromReservation(req.params.id, tenantId, true);
      if (cancelResult.success) {
        factureInfo = cancelResult.message;
        console.log(`[ADMIN RESERVATIONS] Facture gérée: ${factureInfo}`);
      }
    } catch (factureErr) {
      console.error('[ADMIN RESERVATIONS] Erreur suppression facture:', factureErr.message);
    }

    // Supprimer la réservation (🔒 TENANT ISOLATION)
    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'delete',
      entite: 'reservation',
      entite_id: req.params.id,
      details: {
        client_id: reservation.client_id,
        date: reservation.date,
        service: reservation.service,
        facture: factureInfo
      }
    });

    res.json({ message: 'Réservation supprimée', facture: factureInfo });
  } catch (error) {
    console.error('[ADMIN RESERVATIONS] Erreur suppression:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// STATISTIQUES
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/reservations/stats
// Statistiques des réservations
router.get('/stats/periode', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { periode = 'mois' } = req.query;

    // Calculer les dates selon la période
    const now = new Date();
    let dateDebut;

    switch (periode) {
      case 'semaine':
        dateDebut = new Date(now);
        dateDebut.setDate(now.getDate() - 7);
        break;
      case 'mois':
        dateDebut = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'annee':
        dateDebut = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        dateDebut = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const dateDebutStr = dateDebut.toISOString().split('T')[0];

    // Récupérer toutes les réservations de la période (🔒 TENANT ISOLATION)
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('statut, prix_total, service, date, lieu')
      .eq('tenant_id', tenantId)
      .gte('date', dateDebutStr);

    if (error) throw error;

    // Calculer les statistiques
    const total = reservations?.length || 0;

    const parStatut = {
      en_attente: 0,
      confirme: 0,
      annule: 0,
      termine: 0,
      no_show: 0
    };

    let caTotal = 0;
    const servicesCount = {};
    let nbDomicile = 0;
    let nbSalon = 0;

    reservations?.forEach(r => {
      parStatut[r.statut] = (parStatut[r.statut] || 0) + 1;

      if (r.statut === 'termine') {
        caTotal += (r.prix_total || 0) / 100;
      }

      if (r.service) {
        servicesCount[r.service] = (servicesCount[r.service] || 0) + 1;
      }

      if (r.lieu === 'domicile') {
        nbDomicile++;
      } else {
        nbSalon++;
      }
    });

    // Services les plus demandés
    const servicesPopulaires = Object.entries(servicesCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([service, count]) => ({ service, count }));

    // Taux d'annulation
    const tauxAnnulation = total > 0
      ? Math.round(((parStatut.annule + parStatut.no_show) / total) * 100)
      : 0;

    res.json({
      periode,
      date_debut: dateDebutStr,
      date_fin: now.toISOString().split('T')[0],
      total_reservations: total,
      ca_total: caTotal,
      par_statut: parStatut,
      taux_annulation: tauxAnnulation,
      services_populaires: servicesPopulaires,
      repartition_lieu: {
        salon: nbSalon,
        domicile: nbDomicile
      }
    });
  } catch (error) {
    console.error('[ADMIN RESERVATIONS] Erreur stats:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// EXPORT
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/reservations/export
// Export CSV des réservations
router.get('/export/csv', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { date_debut, date_fin } = req.query;

    // 🔒 TENANT ISOLATION
    let query = supabase
      .from('reservations')
      .select(`
        *,
        clients (
          nom,
          prenom,
          telephone,
          email
        )
      `)
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true });

    if (date_debut) {
      query = query.gte('date', date_debut);
    }
    if (date_fin) {
      query = query.lte('date', date_fin);
    }

    const { data: reservations, error } = await query;

    if (error) throw error;

    // Default lieu basé sur le type de business
    const defaultLieu = getDefaultLocation(tenantId);

    // Générer le CSV
    const csvHeader = 'ID;Date;Heure;Client;Telephone;Service;Lieu;Statut;Prix Total (€);Frais Deplacement (€);Notes\n';

    const csvRows = (reservations || []).map(r => {
      const client = r.clients ? `${r.clients.prenom} ${r.clients.nom}` : 'N/A';
      const telephone = r.clients?.telephone || 'N/A';
      const prixTotal = r.prix_total ? (r.prix_total / 100).toFixed(2) : '0.00';
      const fraisDepl = r.frais_deplacement ? (r.frais_deplacement / 100).toFixed(2) : '0.00';
      const notes = (r.notes || '').replace(/;/g, ',').replace(/\n/g, ' ');

      return `${r.id};${r.date};${r.heure};${client};${telephone};${r.service};${r.lieu || defaultLieu};${r.statut};${prixTotal};${fraisDepl};${notes}`;
    }).join('\n');

    const csv = csvHeader + csvRows;

    // Définir les headers pour le téléchargement
    const filename = `reservations_${date_debut || 'debut'}_${date_fin || 'fin'}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\ufeff' + csv); // BOM UTF-8 pour Excel
  } catch (error) {
    console.error('[ADMIN RESERVATIONS] Erreur export:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
