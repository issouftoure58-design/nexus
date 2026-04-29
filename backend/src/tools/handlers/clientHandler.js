/**
 * Client Handler — Outils client et admin pour recherche, RDV, services, salon.
 * search_clients, create_client, update_client, get_client_info, get_price,
 * check_availability, get_available_slots, calculate_travel_fee, create_booking,
 * find_appointment, cancel_appointment, get_salon_info, get_business_hours,
 * tout_savoir_sur_client, send_message (WhatsApp + SMS + Email)
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';
import { checkDisponibilite, getCreneauxDisponibles } from '../../services/dispoService.js';
import { createReservationUnified } from '../../services/bookingService.js';
import { cancelAppointmentById } from '../../core/unified/nexusCore.js';
import { search as halimahSearch, buildMemoryContext } from '../../services/halimahMemory.js';
import { sendWhatsAppNotification } from '../../services/whatsappService.js';
import { sendEmail } from '../../services/emailService.js';
import { sendSMS } from '../../services/smsService.js';

/**
 * Calcule le prix d'une réservation en centimes.
 */
function getPrixReservation(r) {
  if (r.prix_total) return r.prix_total;
  if (r.prix_service) return (r.prix_service || 0) + (r.frais_deplacement || 0);
  return 0;
}

// ═══════════════════════════════════════════════════════════════
// RECHERCHE CLIENTS
// ═══════════════════════════════════════════════════════════════

/**
 * Recherche de clients par nom ou téléphone avec échappement safe.
 */
async function search_clients(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const rawQuery = (toolInput.query || toolInput.search || '').toString().trim();
    // Echapper les caractères spéciaux PostgREST pour éviter l'injection
    const safeQuery = rawQuery.replace(/[%_\\(),."']/g, '');

    if (!safeQuery) {
      // Sans terme de recherche, retourner les derniers clients
      const { data: clients, error } = await supabase
        .from('clients')
        .select('id, prenom, nom, telephone, email')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        logger.error('[CLIENT HANDLER] Erreur search_clients (recent):', { error, tenantId });
        return { success: false, error: error.message };
      }

      return { success: true, query: rawQuery, results: clients || [] };
    }

    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, prenom, nom, telephone, email')
      .eq('tenant_id', tenantId)
      .or(`prenom.ilike.%${safeQuery}%,nom.ilike.%${safeQuery}%,telephone.ilike.%${safeQuery}%`)
      .limit(10);

    if (error) {
      logger.error('[CLIENT HANDLER] Erreur search_clients:', { error, tenantId });
      return { success: false, error: error.message };
    }

    return {
      success: true,
      query: rawQuery,
      results: clients || []
    };
  } catch (error) {
    logger.error('[CLIENT HANDLER] Erreur search_clients:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

/**
 * Crée un nouveau client dans la base de données.
 */
async function create_client(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const prenom = (toolInput.prenom || '').trim();
    const nom = (toolInput.nom || '').trim();
    const telephone = (toolInput.telephone || '').trim();

    if (!prenom || !nom || !telephone) {
      return { success: false, error: 'prenom, nom et telephone requis' };
    }

    // Vérifier doublon téléphone
    const { data: existing } = await supabase
      .from('clients')
      .select('id, prenom, nom')
      .eq('tenant_id', tenantId)
      .eq('telephone', telephone)
      .limit(1);

    if (existing && existing.length > 0) {
      return {
        success: false,
        error: `Un client avec ce téléphone existe déjà: ${existing[0].prenom} ${existing[0].nom} (ID: ${existing[0].id})`
      };
    }

    const insertData = {
      tenant_id: tenantId,
      prenom,
      nom,
      telephone
    };
    if (toolInput.email) insertData.email = toolInput.email.trim();
    if (toolInput.adresse) insertData.adresse = toolInput.adresse.trim();
    if (toolInput.notes) insertData.notes = toolInput.notes.trim();

    const { data: client, error } = await supabase
      .from('clients')
      .insert(insertData)
      .select('id, prenom, nom, telephone, email')
      .single();

    if (error) {
      logger.error('[CLIENT HANDLER] Erreur create_client:', { error, tenantId });
      return { success: false, error: error.message };
    }

    logger.info('[CLIENT HANDLER] Client créé', { tenantId, adminId, clientId: client.id });

    return { success: true, client };
  } catch (error) {
    logger.error('[CLIENT HANDLER] Erreur create_client:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

/**
 * Met à jour les informations d'un client existant.
 */
async function update_client(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const clientId = toolInput.client_id;
    if (!clientId) {
      return { success: false, error: 'client_id requis' };
    }

    // Vérifier que le client existe et appartient au tenant
    const { data: existing, error: lookupError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .single();

    if (lookupError || !existing) {
      return { success: false, error: 'Client non trouvé' };
    }

    // Construire l'objet update avec seulement les champs fournis
    const updateData = {};
    if (toolInput.prenom !== undefined) updateData.prenom = toolInput.prenom.trim();
    if (toolInput.nom !== undefined) updateData.nom = toolInput.nom.trim();
    if (toolInput.telephone !== undefined) updateData.telephone = toolInput.telephone.trim();
    if (toolInput.email !== undefined) updateData.email = toolInput.email.trim();
    if (toolInput.adresse !== undefined) updateData.adresse = toolInput.adresse.trim();
    if (toolInput.notes !== undefined) updateData.notes = toolInput.notes.trim();

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'Aucun champ à mettre à jour' };
    }

    const { data: client, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .select('id, prenom, nom, telephone, email')
      .single();

    if (error) {
      logger.error('[CLIENT HANDLER] Erreur update_client:', { error, tenantId });
      return { success: false, error: error.message };
    }

    logger.info('[CLIENT HANDLER] Client mis à jour', { tenantId, adminId, clientId });

    return { success: true, client };
  } catch (error) {
    logger.error('[CLIENT HANDLER] Erreur update_client:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les infos complètes d'un client avec historique RDV et CA.
 */
async function get_client_info(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    let query = supabase
      .from('clients')
      .select(`
        id, prenom, nom, telephone, email, adresse, created_at,
        reservations:reservations(id, date, service_nom, statut, prix_total, prix_service, frais_deplacement)
      `)
      .eq('tenant_id', tenantId);

    // Recherche par ID ou téléphone
    if (toolInput.client_id) {
      query = query.eq('id', toolInput.client_id);
    } else if (toolInput.telephone) {
      query = query.eq('telephone', toolInput.telephone);
    } else {
      return { success: false, error: 'client_id ou telephone requis' };
    }

    const { data: client, error } = await query.single();

    if (error) {
      logger.error('[CLIENT HANDLER] Erreur get_client_info:', { error, tenantId });
      return { success: false, error: 'Client non trouvé' };
    }

    if (!client) {
      return { success: false, error: 'Client non trouvé' };
    }

    // Calculer CA total (confirme + termine)
    const rdvFacturables = client.reservations?.filter(r => r.statut === 'confirme' || r.statut === 'termine') || [];
    const caTotal = rdvFacturables.reduce((sum, r) => sum + getPrixReservation(r), 0);

    return {
      success: true,
      client: {
        id: client.id,
        nom: `${client.prenom} ${client.nom}`,
        telephone: client.telephone,
        email: client.email,
        adresse: client.adresse,
        inscrit_depuis: client.created_at,
        nb_rdv_total: client.reservations?.length || 0,
        nb_rdv_confirmes: rdvFacturables.length,
        ca_total: `${(caTotal / 100).toFixed(2)}€`,
        derniers_rdv: client.reservations?.slice(0, 5).map(r => ({
          date: r.date,
          service: r.service_nom,
          statut: r.statut
        }))
      }
    };
  } catch (error) {
    logger.error('[CLIENT HANDLER] Erreur get_client_info:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// OUTILS SERVICES & DISPONIBILITE
// ═══════════════════════════════════════════════════════════════

/**
 * Recherche un service par nom (ilike) et retourne son prix.
 */
async function get_price(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const serviceName = (toolInput.service_name || toolInput.nom || '').trim();

    if (!serviceName) {
      return { success: false, error: 'Nom du service requis' };
    }

    const { data: services, error } = await supabase
      .from('services')
      .select('id, nom, prix, duree_minutes, categorie')
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .ilike('nom', `%${serviceName}%`)
      .limit(5);

    if (error) {
      logger.error('[CLIENT HANDLER] Erreur get_price:', { error, tenantId });
      return { success: false, error: error.message };
    }

    if (!services || services.length === 0) {
      return { success: false, error: `Service "${serviceName}" non trouvé` };
    }

    // Retourner le premier match
    const service = services[0];
    return {
      success: true,
      service: service.nom,
      prix: `${(service.prix / 100).toFixed(2)}€`,
      prix_centimes: service.prix,
      duree: service.duree_minutes,
      categorie: service.categorie,
      autres_resultats: services.length > 1 ? services.slice(1).map(s => ({
        nom: s.nom,
        prix: `${(s.prix / 100).toFixed(2)}€`
      })) : undefined
    };
  } catch (error) {
    logger.error('[CLIENT HANDLER] Erreur get_price:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

/**
 * Vérifie la disponibilité d'un créneau via dispoService.
 */
async function check_availability(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const { date, heure, duree_minutes, adresse_client } = toolInput;

    if (!date || !heure) {
      return { success: false, error: 'date et heure requis' };
    }

    // Récupérer les RDV existants pour cette date
    const { data: rdvExistants, error } = await supabase
      .from('reservations')
      .select('id, heure, duree_minutes, statut')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .in('statut', ['demande', 'confirme', 'en_attente', 'en_attente_paiement']);

    if (error) {
      logger.error('[CLIENT HANDLER] Erreur check_availability (fetch rdv):', { error, tenantId });
    }

    const result = await checkDisponibilite(
      date,
      heure,
      duree_minutes || 60,
      adresse_client || null,
      rdvExistants || []
    );

    return { success: true, ...result };
  } catch (error) {
    logger.error('[CLIENT HANDLER] Erreur check_availability:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

/**
 * Retourne les créneaux disponibles pour une date et un service donné.
 */
async function get_available_slots(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const { date, duree_minutes, adresse_client } = toolInput;

    if (!date) {
      return { success: false, error: 'date requis' };
    }

    // Récupérer les RDV existants pour cette date
    const { data: rdvExistants, error } = await supabase
      .from('reservations')
      .select('id, heure, duree_minutes, statut')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .in('statut', ['demande', 'confirme', 'en_attente', 'en_attente_paiement']);

    if (error) {
      logger.error('[CLIENT HANDLER] Erreur get_available_slots (fetch rdv):', { error, tenantId });
    }

    const creneaux = await getCreneauxDisponibles(
      date,
      duree_minutes || 60,
      adresse_client || null,
      rdvExistants || []
    );

    return {
      success: true,
      date,
      creneaux_disponibles: creneaux || [],
      nb_creneaux: creneaux?.length || 0
    };
  } catch (error) {
    logger.error('[CLIENT HANDLER] Erreur get_available_slots:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

/**
 * Calcule les frais de déplacement en fonction de la distance en km.
 * Barème: 0-10km: 0€, 10-20km: 15€, 20-30km: 25€, 30+: 35€
 */
async function calculate_travel_fee(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const distanceKm = toolInput.distance_km;

    if (distanceKm === undefined || distanceKm === null) {
      return { success: false, error: 'distance_km requis' };
    }

    const km = parseFloat(distanceKm);
    if (isNaN(km) || km < 0) {
      return { success: false, error: 'distance_km doit être un nombre positif' };
    }

    let frais = 0;
    if (km > 30) {
      frais = 35;
    } else if (km > 20) {
      frais = 25;
    } else if (km > 10) {
      frais = 15;
    }

    return {
      success: true,
      distance_km: km,
      frais_deplacement: frais,
      message: frais > 0
        ? `Frais de déplacement: ${frais}€ pour ${km} km`
        : `Pas de frais de déplacement pour ${km} km (rayon 10 km)`
    };
  } catch (error) {
    logger.error('[CLIENT HANDLER] Erreur calculate_travel_fee:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

/**
 * Crée une réservation via bookingService.createReservationUnified.
 */
async function create_booking(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const bookingData = {
      ...toolInput,
      tenant_id: tenantId
    };

    logger.info('[CLIENT HANDLER] Création RDV', {
      tenantId,
      adminId,
      date: toolInput.date,
      heure: toolInput.heure,
      service: toolInput.service_nom || toolInput.service_name
    });

    const result = await createReservationUnified(bookingData, {
      channel: toolInput.channel || 'admin-chat',
      sendSMS: toolInput.sendSMS !== false
    });

    return result;
  } catch (error) {
    logger.error('[CLIENT HANDLER] Erreur create_booking:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

/**
 * Recherche les prochains RDV d'un client par téléphone.
 */
async function find_appointment(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const telephone = (toolInput.telephone || '').trim();

    if (!telephone) {
      return { success: false, error: 'telephone requis' };
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: rdvs, error } = await supabase
      .from('reservations')
      .select(`
        id, date, heure, statut, service_nom, prix_total, prix_service, frais_deplacement,
        clients:client_id(prenom, nom, telephone)
      `)
      .eq('tenant_id', tenantId)
      .gte('date', today)
      .in('statut', ['demande', 'confirme', 'en_attente', 'en_attente_paiement'])
      .order('date', { ascending: true })
      .order('heure', { ascending: true });

    if (error) {
      logger.error('[CLIENT HANDLER] Erreur find_appointment:', { error, tenantId });
      return { success: false, error: error.message };
    }

    // Filtrer par téléphone du client (join côté JS car le filtre PostgREST sur relation est limité)
    const rdvsFiltres = (rdvs || []).filter(r =>
      r.clients?.telephone === telephone
    );

    return {
      success: true,
      telephone,
      rdv_count: rdvsFiltres.length,
      rdv: rdvsFiltres.map(r => ({
        id: r.id,
        date: r.date,
        heure: r.heure,
        client: r.clients ? `${r.clients.prenom} ${r.clients.nom}` : 'Client inconnu',
        service: r.service_nom,
        statut: r.statut,
        montant: `${(getPrixReservation(r) / 100).toFixed(2)}€`
      }))
    };
  } catch (error) {
    logger.error('[CLIENT HANDLER] Erreur find_appointment:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

/**
 * Annule un rendez-vous par ID — délègue à cancelAppointmentById (règle unique).
 */
async function cancel_appointment(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  const appointmentId = toolInput.appointment_id || toolInput.rdv_id || toolInput.id;
  if (!appointmentId) {
    return { success: false, error: 'appointment_id requis' };
  }

  const reason = toolInput.reason
    ? `Annulé via admin chat: ${toolInput.reason}`
    : 'Annulé via admin chat (demande admin)';

  const result = await cancelAppointmentById(appointmentId, reason, tenantId, { channel: 'admin_chat' });

  if (result.success) {
    logger.info('[CLIENT HANDLER] RDV annulé', { tenantId, adminId, appointmentId });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// OUTILS SALON / BUSINESS INFO
// ═══════════════════════════════════════════════════════════════

/**
 * Récupère les infos du salon/business depuis la table tenants.
 */
async function get_salon_info(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('business_name, adresse, telephone, email, horaires, config')
      .eq('id', tenantId)
      .single();

    if (error) {
      logger.error('[CLIENT HANDLER] Erreur get_salon_info:', { error, tenantId });
      return { success: false, error: error.message };
    }

    if (!tenant) {
      return { success: false, error: 'Tenant non trouvé' };
    }

    return {
      success: true,
      business_name: tenant.business_name,
      adresse: tenant.adresse,
      telephone: tenant.telephone,
      email: tenant.email,
      horaires: tenant.horaires
    };
  } catch (error) {
    logger.error('[CLIENT HANDLER] Erreur get_salon_info:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

/**
 * Récupère les horaires d'ouverture depuis horaires_hebdo ou config tenant.
 */
async function get_business_hours(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    // Essayer d'abord horaires_hebdo
    const { data: horaires, error: horairesError } = await supabase
      .from('horaires_hebdo')
      .select('jour, ouvert, heure_debut, heure_fin, pause_debut, pause_fin')
      .eq('tenant_id', tenantId)
      .order('jour', { ascending: true });

    if (!horairesError && horaires && horaires.length > 0) {
      // Filtrer par jour si spécifié
      const joursMap = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
      let result = horaires;

      if (toolInput.jour) {
        const jourLower = toolInput.jour.toLowerCase();
        result = horaires.filter(h => {
          const jourNom = joursMap[h.jour] || '';
          return jourNom === jourLower || h.jour === parseInt(toolInput.jour);
        });
      }

      return {
        success: true,
        source: 'horaires_hebdo',
        horaires: result.map(h => ({
          jour: h.jour,
          jour_nom: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][h.jour] || h.jour,
          ouvert: h.ouvert,
          heure_debut: h.heure_debut,
          heure_fin: h.heure_fin,
          pause_debut: h.pause_debut,
          pause_fin: h.pause_fin
        }))
      };
    }

    // Fallback: récupérer depuis la config du tenant
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('horaires, config')
      .eq('id', tenantId)
      .single();

    if (tenantError) {
      logger.error('[CLIENT HANDLER] Erreur get_business_hours (tenant fallback):', { error: tenantError, tenantId });
      return { success: false, error: tenantError.message };
    }

    return {
      success: true,
      source: 'tenant_config',
      horaires: tenant?.horaires || tenant?.config?.horaires || 'Non configuré'
    };
  } catch (error) {
    logger.error('[CLIENT HANDLER] Erreur get_business_hours:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════
// OUTILS MEMOIRE & COMMUNICATION
// ═══════════════════════════════════════════════════════════════

/**
 * Tout savoir sur un client: combine données DB + mémoire Halimah.
 */
async function tout_savoir_sur_client(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const { client_id, telephone } = toolInput;

    if (!client_id && !telephone) {
      return { success: false, error: 'client_id ou telephone requis' };
    }

    // 1. Récupérer les données client depuis la DB
    let clientQuery = supabase
      .from('clients')
      .select(`
        id, prenom, nom, telephone, email, adresse, created_at, notes,
        reservations:reservations(id, date, service_nom, statut, prix_total, prix_service, frais_deplacement, notes)
      `)
      .eq('tenant_id', tenantId);

    if (client_id) {
      clientQuery = clientQuery.eq('id', client_id);
    } else {
      clientQuery = clientQuery.eq('telephone', telephone);
    }

    const { data: client, error } = await clientQuery.single();

    if (error || !client) {
      logger.error('[CLIENT HANDLER] Erreur tout_savoir_sur_client:', { error, tenantId });
      return { success: false, error: 'Client non trouvé' };
    }

    // 2. Calculer les statistiques
    const rdvFacturables = client.reservations?.filter(r => r.statut === 'confirme' || r.statut === 'termine') || [];
    const caTotal = rdvFacturables.reduce((sum, r) => sum + getPrixReservation(r), 0);

    // 3. Récupérer le contexte mémoire (Halimah Memory)
    let memoryContext = null;
    try {
      const clientName = `${client.prenom} ${client.nom}`;
      const memories = await halimahSearch(tenantId, clientName, null, 20);
      if (memories && memories.length > 0) {
        memoryContext = await buildMemoryContext({
          tenantId,
          clientId: client.id,
          clientName,
          clientPhone: client.telephone
        });
      }
    } catch (memError) {
      logger.warn('[CLIENT HANDLER] Mémoire Halimah non disponible:', { error: memError.message });
    }

    return {
      success: true,
      client: {
        id: client.id,
        nom: `${client.prenom} ${client.nom}`,
        prenom: client.prenom,
        nom_famille: client.nom,
        telephone: client.telephone,
        email: client.email,
        adresse: client.adresse,
        notes: client.notes,
        inscrit_depuis: client.created_at,
        nb_rdv_total: client.reservations?.length || 0,
        nb_rdv_confirmes: rdvFacturables.length,
        ca_total: `${(caTotal / 100).toFixed(2)}€`,
        derniers_rdv: client.reservations
          ?.sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10)
          .map(r => ({
            id: r.id,
            date: r.date,
            service: r.service_nom,
            statut: r.statut,
            montant: `${(getPrixReservation(r) / 100).toFixed(2)}€`,
            notes: r.notes
          }))
      },
      memoire: memoryContext || { message: 'Aucune mémoire enregistrée pour ce client' }
    };
  } catch (error) {
    logger.error('[CLIENT HANDLER] Erreur tout_savoir_sur_client:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

/**
 * Envoie un message au client via WhatsApp, SMS ou Email.
 */
async function send_message(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const { telephone, message, canal, email, objet } = toolInput;
    const channel = (canal || 'whatsapp').toLowerCase();

    if (channel === 'email') {
      if (!email) {
        return { success: false, error: 'email requis pour canal email' };
      }
      if (!objet) {
        return { success: false, error: 'objet requis pour canal email' };
      }
      if (!message) {
        return { success: false, error: 'message requis' };
      }

      logger.info('[CLIENT HANDLER] Envoi email', {
        tenantId,
        adminId,
        to: email,
        subject: objet
      });

      const result = await sendEmail({
        to: email,
        subject: objet,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`
      });

      return {
        success: true,
        canal: 'email',
        message_id: result?.id || null,
        info: 'Email envoyé'
      };
    }

    if (channel === 'sms') {
      if (!telephone) {
        return { success: false, error: 'telephone requis pour canal SMS' };
      }
      if (!message) {
        return { success: false, error: 'message requis' };
      }

      logger.info('[CLIENT HANDLER] Envoi SMS', {
        tenantId,
        adminId,
        telephone: telephone.substring(0, 6) + '***',
        messageLength: message.length
      });

      const result = await sendSMS(telephone, message, tenantId);

      return {
        success: result.success !== false,
        canal: 'sms',
        message_id: result.messageId || result.sid || null,
        simulated: result.simulated || false,
        info: result.simulated
          ? 'SMS simulé (Twilio non configuré)'
          : 'SMS envoyé'
      };
    }

    // Default: WhatsApp
    if (!telephone) {
      return { success: false, error: 'telephone requis' };
    }
    if (!message) {
      return { success: false, error: 'message requis' };
    }

    logger.info('[CLIENT HANDLER] Envoi message WhatsApp', {
      tenantId,
      adminId,
      telephone: telephone.substring(0, 6) + '***',
      messageLength: message.length
    });

    const result = await sendWhatsAppNotification(telephone, message, tenantId);

    return {
      success: result.success !== false,
      canal: 'whatsapp',
      message_id: result.messageId,
      simulated: result.simulated || false,
      info: result.simulated
        ? 'Message simulé (Twilio non configuré)'
        : 'Message envoyé via WhatsApp'
    };
  } catch (error) {
    logger.error('[CLIENT HANDLER] Erreur send_message:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

export const clientHandlers = {
  search_clients,
  create_client,
  update_client,
  get_client_info,
  get_price,
  check_availability,
  get_available_slots,
  calculate_travel_fee,
  create_booking,
  find_appointment,
  cancel_appointment,
  get_salon_info,
  get_business_hours,
  tout_savoir_sur_client,
  send_message
};
