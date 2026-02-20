/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║              VALIDATEUR MULTI-TENANT - REMPLACE businessRules.js              ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║   Ce fichier fournit des fonctions de validation qui utilisent le             ║
 * ║   TenantContext au lieu de règles hardcodées.                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

import { loadTenant } from './TenantContext.js';
import { supabase } from '../config/supabase.js';

/**
 * Valide une réservation en utilisant les règles du tenant
 * @param {string} tenantId - ID du tenant
 * @param {object} booking - Données de réservation
 * @param {object} service - Service réservé
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
export async function validateBookingForTenant(tenantId, booking, service) {
  const errors = [];

  // 1. Charger le contexte tenant
  let tenantContext;
  try {
    tenantContext = await loadTenant(tenantId);
  } catch (e) {
    errors.push(`Tenant invalide: ${e.message}`);
    return { valid: false, errors };
  }

  // 2. Vérifier que le tenant est actif
  if (!tenantContext.isActive) {
    errors.push('Ce compte est désactivé.');
    return { valid: false, errors };
  }

  if (tenantContext.isFrozen) {
    errors.push('Ce compte est gelé. Veuillez contacter le support.');
    return { valid: false, errors };
  }

  // 3. Vérifier que le service existe
  if (!service) {
    errors.push('Service invalide');
    return { valid: false, errors };
  }

  // 4. Vérifier le jour (utilise les horaires du tenant, pas hardcodés)
  const bookingDate = new Date(booking.date + 'T12:00:00');
  const dayOfWeek = bookingDate.getDay();

  if (!tenantContext.isOpenOnDay(dayOfWeek)) {
    errors.push(tenantContext.getClosedMessage(dayOfWeek));
    return { valid: false, errors };
  }

  // 5. Vérifier les horaires
  const hours = tenantContext.getHoursForDay(dayOfWeek);
  const [openH, openM] = hours.open.split(':').map(Number);
  const [closeH, closeM] = hours.close.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  // Parser l'heure de la réservation
  let startHour = 0;
  let startMin = 0;
  const heureStr = String(booking.heure || '');
  if (heureStr.includes(':')) {
    [startHour, startMin] = heureStr.split(':').map(Number);
  } else if (heureStr.includes('h')) {
    const parts = heureStr.split('h');
    startHour = parseInt(parts[0]) || 0;
    startMin = parseInt(parts[1]) || 0;
  } else {
    startHour = parseInt(heureStr) || 0;
  }

  const startMinutes = startHour * 60 + startMin;
  const durationMinutes = service.durationMinutes || service.duree_minutes || 60;
  const endMinutes = startMinutes + durationMinutes;

  if (startMinutes < openMinutes) {
    errors.push(tenantContext.getOpeningMessage(dayOfWeek));
  }

  if (endMinutes > closeMinutes) {
    const durationHours = Math.round(durationMinutes / 60 * 10) / 10;
    errors.push(`Ce service de ${durationHours}h ne peut pas finir après ${hours.close}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Vérifie les conflits de réservation pour un tenant
 * @param {string} tenantId - ID du tenant
 * @param {string} date - Date YYYY-MM-DD
 * @param {string} heure - Heure HH:MM
 * @param {number} durationMinutes - Durée en minutes
 * @param {string} excludeRdvId - ID de RDV à exclure (pour modification)
 * @returns {Promise<{hasConflict: boolean, conflictingBookings: array}>}
 */
export async function checkBookingConflicts(tenantId, date, heure, durationMinutes, excludeRdvId = null) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: tenantId is required for conflict check');
  }

  // Statuts qui bloquent
  const blockingStatuts = ['confirme', 'en_attente', 'pending', 'confirmed'];

  let query = supabase
    .from('reservations')
    .select('id, date, heure, duree_minutes, service_nom, statut, client_id')
    .eq('tenant_id', tenantId)
    .eq('date', date)
    .in('statut', blockingStatuts);

  if (excludeRdvId) {
    query = query.neq('id', excludeRdvId);
  }

  const { data: existingBookings, error } = await query;

  if (error) {
    console.error('[TenantAwareValidator] Erreur check conflits:', error);
    throw new Error(`Erreur vérification conflits: ${error.message}`);
  }

  // Calculer les créneaux
  const [startH, startM] = heure.split(':').map(Number);
  const newStart = startH * 60 + startM;
  const newEnd = newStart + durationMinutes;

  const conflicts = [];

  for (const booking of (existingBookings || [])) {
    const [bookH, bookM] = (booking.heure || '09:00').split(':').map(Number);
    const bookStart = bookH * 60 + bookM;
    const bookEnd = bookStart + (booking.duree_minutes || 60);

    // Vérifier chevauchement
    if (newStart < bookEnd && newEnd > bookStart) {
      conflicts.push(booking);
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflictingBookings: conflicts,
  };
}

/**
 * Trouve un service par nom pour un tenant
 * Cherche d'abord dans la BDD du tenant, puis dans la config
 * @param {string} tenantId - ID du tenant
 * @param {string} serviceName - Nom du service
 * @returns {Promise<object|null>}
 */
export async function findServiceForTenant(tenantId, serviceName) {
  if (!tenantId || !serviceName) {
    return null;
  }

  const normalizedName = serviceName.toLowerCase().trim();

  // 1. Chercher dans la table services du tenant
  const { data: dbService } = await supabase
    .from('services')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('nom', `%${normalizedName}%`)
    .limit(1)
    .single();

  if (dbService) {
    return {
      id: dbService.id,
      name: dbService.nom,
      price: dbService.prix_centimes ? dbService.prix_centimes / 100 : dbService.prix,
      priceInCents: dbService.prix_centimes || dbService.prix * 100,
      durationMinutes: dbService.duree_minutes || 60,
      blocksFullDay: dbService.bloque_journee || false,
      category: dbService.categorie,
    };
  }

  return null;
}

/**
 * Valide complète avant création de réservation
 * Combine validation des règles + conflits
 */
export async function validateBeforeCreateForTenant(tenantId, bookingData, service) {
  const errors = [];
  const warnings = [];

  // 1. Validation des règles métier du tenant
  const rulesValidation = await validateBookingForTenant(tenantId, bookingData, service);
  if (!rulesValidation.valid) {
    return {
      valid: false,
      errors: rulesValidation.errors,
      warnings,
    };
  }

  // 2. Vérification des conflits
  const durationMinutes = service.durationMinutes || service.duree_minutes || 60;
  const conflicts = await checkBookingConflicts(
    tenantId,
    bookingData.date,
    bookingData.heure,
    durationMinutes
  );

  if (conflicts.hasConflict) {
    const conflictDetails = conflicts.conflictingBookings
      .map(c => `${c.heure} - ${c.client_nom || 'Client'}`)
      .join(', ');
    errors.push(`Créneau déjà occupé: ${conflictDetails}`);
  }

  // 3. Vérifier si c'est un service journée entière
  if (service.blocksFullDay || service.bloque_journee) {
    // Vérifier s'il y a d'autres RDV ce jour
    const { data: otherBookings } = await supabase
      .from('reservations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('date', bookingData.date)
      .in('statut', ['confirme', 'en_attente'])
      .limit(1);

    if (otherBookings && otherBookings.length > 0) {
      errors.push('Ce service nécessite la journée entière mais d\'autres RDV sont déjà prévus.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    service,
  };
}

export default {
  validateBookingForTenant,
  checkBookingConflicts,
  findServiceForTenant,
  validateBeforeCreateForTenant,
};
