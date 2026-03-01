/**
 * Service de Validation de Concurrence des Réservations
 *
 * Vérifie qu'il n'y a pas de conflit de créneau horaire
 * avant de créer ou modifier une réservation.
 */

import { supabase } from '../config/supabase.js';

/**
 * Vérifie si un créneau est disponible pour une réservation
 *
 * @param {Object} params
 * @param {string} params.tenantId - ID du tenant
 * @param {string} params.dateRdv - Date du RDV (YYYY-MM-DD)
 * @param {string} params.heureDebut - Heure de début (HH:MM)
 * @param {string} params.heureFin - Heure de fin (HH:MM ou null pour calcul auto)
 * @param {number} params.dureeMinutes - Durée en minutes (si heureFin non fourni)
 * @param {string} params.membreId - ID du membre assigné (optionnel)
 * @param {string} params.excludeReservationId - ID de réservation à exclure (pour modification)
 * @returns {Promise<{available: boolean, conflicts: Array, message: string}>}
 */
export async function checkAvailability(params) {
  const {
    tenantId,
    dateRdv,
    heureDebut,
    heureFin,
    dureeMinutes = 60,
    membreId = null,
    excludeReservationId = null
  } = params;

  if (!tenantId || !dateRdv || !heureDebut) {
    throw new Error('tenantId, dateRdv et heureDebut sont requis');
  }

  // Calculer heure de fin si non fournie
  const calculatedHeureFin = heureFin || calculateEndTime(heureDebut, dureeMinutes);

  // Construire la requête de recherche de conflits
  let query = supabase
    .from('reservations')
    .select('id, heure_rdv, heure_fin, service, client_id, membre_id')
    .eq('tenant_id', tenantId)
    .eq('date_rdv', dateRdv)
    .not('statut', 'in', '("annulee", "cancelled", "no-show")'); // Exclure les RDV annulés

  // Exclure une réservation spécifique (pour les modifications)
  if (excludeReservationId) {
    query = query.neq('id', excludeReservationId);
  }

  // Si un membre est spécifié, filtrer par membre
  // Si pas de membre, c'est un RDV général (conflit avec tous)
  if (membreId) {
    // Conflits avec ce membre spécifique OU RDV sans membre assigné
    query = query.or(`membre_id.eq.${membreId},membre_id.is.null`);
  }

  const { data: existingReservations, error } = await query;

  if (error) {
    console.error('[ReservationConflict] Erreur requête:', error);
    throw error;
  }

  // Vérifier les chevauchements
  const conflicts = [];
  const debutMinutes = timeToMinutes(heureDebut);
  const finMinutes = timeToMinutes(calculatedHeureFin);

  for (const rdv of existingReservations || []) {
    const rdvDebutMinutes = timeToMinutes(rdv.heure_rdv);
    const rdvFinMinutes = rdv.heure_fin
      ? timeToMinutes(rdv.heure_fin)
      : rdvDebutMinutes + 60; // Default 1h si pas de heure_fin

    // Vérifier le chevauchement
    // Conflit si: nouveau_debut < existant_fin ET nouveau_fin > existant_debut
    if (debutMinutes < rdvFinMinutes && finMinutes > rdvDebutMinutes) {
      conflicts.push({
        reservation_id: rdv.id,
        heure_debut: rdv.heure_rdv,
        heure_fin: rdv.heure_fin || minutesToTime(rdvFinMinutes),
        service: rdv.service,
        membre_id: rdv.membre_id
      });
    }
  }

  if (conflicts.length > 0) {
    return {
      available: false,
      conflicts,
      message: `${conflicts.length} conflit(s) détecté(s) pour ce créneau`
    };
  }

  return {
    available: true,
    conflicts: [],
    message: 'Créneau disponible'
  };
}

/**
 * Trouve le prochain créneau disponible à partir d'une date/heure
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.dateRdv
 * @param {string} params.heureDebut - Heure à partir de laquelle chercher
 * @param {number} params.dureeMinutes
 * @param {string} params.membreId
 * @returns {Promise<{date: string, heure: string}>}
 */
export async function findNextAvailableSlot(params) {
  const {
    tenantId,
    dateRdv,
    heureDebut,
    dureeMinutes = 60,
    membreId = null
  } = params;

  // Récupérer les disponibilités du jour
  const dayOfWeek = new Date(dateRdv).getDay();
  const { data: disponibilite } = await supabase
    .from('disponibilites')
    .select('heure_debut, heure_fin, actif')
    .eq('tenant_id', tenantId)
    .eq('jour_semaine', dayOfWeek)
    .single();

  if (!disponibilite || !disponibilite.actif) {
    // Jour fermé, chercher le lendemain
    const nextDay = new Date(dateRdv);
    nextDay.setDate(nextDay.getDate() + 1);
    return findNextAvailableSlot({
      ...params,
      dateRdv: nextDay.toISOString().split('T')[0],
      heureDebut: '09:00' // Reset à l'ouverture
    });
  }

  // Récupérer les RDV du jour
  const { data: reservations } = await supabase
    .from('reservations')
    .select('heure_rdv, heure_fin, duree_minutes')
    .eq('tenant_id', tenantId)
    .eq('date_rdv', dateRdv)
    .not('statut', 'in', '("annulee", "cancelled", "no-show")')
    .order('heure_rdv', { ascending: true });

  // Trouver un créneau libre
  let currentTime = Math.max(
    timeToMinutes(heureDebut),
    timeToMinutes(disponibilite.heure_debut)
  );
  const closeTime = timeToMinutes(disponibilite.heure_fin);

  for (const rdv of reservations || []) {
    const rdvStart = timeToMinutes(rdv.heure_rdv);
    const rdvEnd = rdv.heure_fin
      ? timeToMinutes(rdv.heure_fin)
      : rdvStart + (rdv.duree_minutes || 60);

    // Si on peut caser le RDV avant celui-ci
    if (currentTime + dureeMinutes <= rdvStart) {
      return {
        date: dateRdv,
        heure: minutesToTime(currentTime)
      };
    }

    // Sinon, avancer après ce RDV
    currentTime = Math.max(currentTime, rdvEnd);
  }

  // Vérifier si on peut caser après le dernier RDV
  if (currentTime + dureeMinutes <= closeTime) {
    return {
      date: dateRdv,
      heure: minutesToTime(currentTime)
    };
  }

  // Pas de créneau ce jour, chercher le lendemain
  const nextDay = new Date(dateRdv);
  nextDay.setDate(nextDay.getDate() + 1);
  return findNextAvailableSlot({
    ...params,
    dateRdv: nextDay.toISOString().split('T')[0],
    heureDebut: '09:00'
  });
}

/**
 * Middleware Express pour valider la disponibilité avant création
 */
export function validateReservationSlot(req, res, next) {
  const originalSend = res.json.bind(res);

  // Intercepter seulement les POST et PUT
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return next();
  }

  // Injecter la validation dans le flow
  req.validateSlot = async () => {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) return { available: true }; // Skip si pas de tenant

    const { date_rdv, heure_rdv, heure_fin, duree_minutes, membre_id } = req.body;

    if (!date_rdv || !heure_rdv) {
      return { available: true }; // Pas assez d'infos pour valider
    }

    return checkAvailability({
      tenantId,
      dateRdv: date_rdv,
      heureDebut: heure_rdv,
      heureFin: heure_fin,
      dureeMinutes: duree_minutes || 60,
      membreId: membre_id,
      excludeReservationId: req.params?.id
    });
  };

  next();
}

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

function timeToMinutes(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function calculateEndTime(startTime, durationMinutes) {
  const startMinutes = timeToMinutes(startTime);
  return minutesToTime(startMinutes + durationMinutes);
}

export default {
  checkAvailability,
  findNextAvailableSlot,
  validateReservationSlot
};
