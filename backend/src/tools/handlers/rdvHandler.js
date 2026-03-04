/**
 * RDV Handler — get_rdv, update_rdv
 * Gestion des rendez-vous (réservations) pour l'admin chat.
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';

/**
 * Calcule le prix d'une réservation en centimes.
 * Priorité: prix_total > prix_service + frais_deplacement > 0
 */
function getPrixReservation(r) {
  if (r.prix_total) return r.prix_total;
  if (r.prix_service) return (r.prix_service || 0) + (r.frais_deplacement || 0);
  return 0;
}

/**
 * Récupère les rendez-vous avec filtres optionnels (date, statut, client_id).
 * Par défaut: aujourd'hui + 7 prochains jours.
 */
async function get_rdv(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const today = new Date().toISOString().split('T')[0];

    let query = supabase
      .from('reservations')
      .select(`
        id, date, heure, statut, service_nom, prix_total, prix_service, frais_deplacement,
        clients:client_id(prenom, nom, telephone)
      `)
      .eq('tenant_id', tenantId);

    // Filtre par date si spécifié
    if (toolInput.date) {
      query = query.eq('date', toolInput.date);
    } else {
      // Par défaut, aujourd'hui et les 7 prochains jours
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + 7);
      query = query.gte('date', today).lte('date', weekEnd.toISOString().split('T')[0]);
    }

    // Filtre par statut si spécifié
    if (toolInput.statut) {
      query = query.eq('statut', toolInput.statut);
    }

    // Filtre par client si spécifié
    if (toolInput.client_id) {
      query = query.eq('client_id', toolInput.client_id);
    }

    const { data: rdvs, error } = await query.order('date').order('heure');

    if (error) {
      logger.error('[RDV HANDLER] Erreur get_rdv:', { error, tenantId });
      return { success: false, error: error.message };
    }

    return {
      success: true,
      date_filtre: toolInput.date || 'semaine',
      rdv_count: rdvs?.length || 0,
      rdv: rdvs?.map(r => ({
        id: r.id,
        date: r.date,
        heure: r.heure,
        client: r.clients ? `${r.clients.prenom} ${r.clients.nom}` : 'Client inconnu',
        telephone: r.clients?.telephone,
        service: r.service_nom,
        statut: r.statut,
        montant: `${(getPrixReservation(r) / 100).toFixed(2)}€`
      })) || []
    };
  } catch (error) {
    logger.error('[RDV HANDLER] Erreur get_rdv:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

/**
 * Met à jour un rendez-vous par ID.
 * Champs modifiables: statut, notes, date, heure.
 */
async function update_rdv(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const { rdv_id } = toolInput;

    if (!rdv_id) {
      return { success: false, error: 'rdv_id requis pour la mise à jour' };
    }

    // Construire l'objet de mise à jour avec uniquement les champs fournis
    const updateData = {};
    if (toolInput.statut !== undefined) updateData.statut = toolInput.statut;
    if (toolInput.notes !== undefined) updateData.notes = toolInput.notes;
    if (toolInput.date !== undefined) updateData.date = toolInput.date;
    if (toolInput.heure !== undefined) updateData.heure = toolInput.heure;

    if (Object.keys(updateData).length === 0) {
      return { success: false, error: 'Aucun champ à mettre à jour (statut, notes, date, heure)' };
    }

    // Ajouter le timestamp de modification
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('reservations')
      .update(updateData)
      .eq('id', rdv_id)
      .eq('tenant_id', tenantId)
      .select('id, date, heure, statut, notes, service_nom')
      .single();

    if (error) {
      logger.error('[RDV HANDLER] Erreur update_rdv:', { error, tenantId, rdv_id });
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'RDV non trouvé ou accès refusé' };
    }

    logger.info('[RDV HANDLER] RDV mis à jour', {
      tenantId,
      adminId,
      rdv_id,
      champs_modifies: Object.keys(updateData).filter(k => k !== 'updated_at')
    });

    return {
      success: true,
      message: 'RDV mis à jour avec succès',
      rdv: {
        id: data.id,
        date: data.date,
        heure: data.heure,
        statut: data.statut,
        notes: data.notes,
        service: data.service_nom
      }
    };
  } catch (error) {
    logger.error('[RDV HANDLER] Erreur update_rdv:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

export const rdvHandlers = {
  get_rdv,
  update_rdv
};
