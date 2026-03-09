/**
 * Service de liste d'attente (Waitlist)
 * Pattern: fonctions pures, tenant_id premier paramètre
 */

import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

/**
 * Ajouter un client à la liste d'attente
 */
export async function addToWaitlist(tenantId, data) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { client_id, service_id, preferred_date, preferred_time_start, preferred_time_end, notes, priority } = data;
  if (!client_id || !preferred_date) throw new Error('client_id et preferred_date requis');

  const { data: entry, error } = await supabase
    .from('waitlist')
    .insert({
      tenant_id: tenantId,
      client_id,
      service_id: service_id || null,
      preferred_date,
      preferred_time_start: preferred_time_start || null,
      preferred_time_end: preferred_time_end || null,
      status: 'waiting',
      priority: priority || 0,
      notes: notes || null
    })
    .select('*, clients(nom, prenom, email, telephone)')
    .single();

  if (error) {
    logger.error('Erreur ajout waitlist', { error: error.message, tenantId });
    throw error;
  }

  logger.info(`[WAITLIST] Client ${client_id} ajouté pour le ${preferred_date}`, { tenantId });
  return entry;
}

/**
 * Lister la waitlist avec filtres et pagination
 */
export async function getWaitlist(tenantId, filters = {}, pagination = {}) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { status, date, client_id } = filters;
  const { page = 1, limit = 20 } = pagination;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('waitlist')
    .select('*, clients(nom, prenom, email, telephone), services(nom)', { count: 'exact' })
    .eq('tenant_id', tenantId);

  if (status) query = query.eq('status', status);
  if (date) query = query.eq('preferred_date', date);
  if (client_id) query = query.eq('client_id', client_id);

  const { data, error, count } = await query
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    logger.error('Erreur liste waitlist', { error: error.message, tenantId });
    throw error;
  }

  return { waitlist: data || [], total: count || 0, page, limit };
}

/**
 * Récupérer une entrée par ID
 */
export async function getEntry(tenantId, waitlistId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('waitlist')
    .select('*, clients(nom, prenom, email, telephone), services(nom)')
    .eq('id', waitlistId)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    logger.error('Erreur get waitlist entry', { error: error.message, tenantId });
    throw error;
  }

  return data;
}

/**
 * Mettre à jour une entrée
 */
export async function updateEntry(tenantId, waitlistId, updates) {
  if (!tenantId) throw new Error('tenant_id requis');

  const allowedFields = ['preferred_date', 'preferred_time_start', 'preferred_time_end', 'status', 'priority', 'notes'];
  const safeUpdates = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) safeUpdates[key] = updates[key];
  }
  safeUpdates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('waitlist')
    .update(safeUpdates)
    .eq('id', waitlistId)
    .eq('tenant_id', tenantId)
    .select('*, clients(nom, prenom, email, telephone)')
    .single();

  if (error) {
    logger.error('Erreur update waitlist', { error: error.message, tenantId });
    throw error;
  }

  return data;
}

/**
 * Annuler une entrée
 */
export async function cancelEntry(tenantId, waitlistId) {
  if (!tenantId) throw new Error('tenant_id requis');

  return updateEntry(tenantId, waitlistId, { status: 'cancelled' });
}

/**
 * Supprimer une entrée
 */
export async function deleteEntry(tenantId, waitlistId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { error } = await supabase
    .from('waitlist')
    .delete()
    .eq('id', waitlistId)
    .eq('tenant_id', tenantId);

  if (error) {
    logger.error('Erreur delete waitlist', { error: error.message, tenantId });
    throw error;
  }

  return { success: true };
}

/**
 * Notifier le prochain en liste d'attente quand un créneau se libère
 */
export async function notifyNextInLine(tenantId, date, timeStart, timeEnd) {
  if (!tenantId) throw new Error('tenant_id requis');

  // Chercher le premier en attente pour cette date/créneau
  let query = supabase
    .from('waitlist')
    .select('*, clients(nom, prenom, email, telephone)')
    .eq('tenant_id', tenantId)
    .eq('preferred_date', date)
    .eq('status', 'waiting')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1);

  const { data: entries } = await query;
  const entry = entries?.[0];

  if (!entry) {
    logger.debug('[WAITLIST] Aucun client en attente pour ce créneau', { tenantId, date });
    return null;
  }

  // Marquer comme notifié
  const { data: updated } = await supabase
    .from('waitlist')
    .update({
      status: 'notified',
      notified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', entry.id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  logger.info(`[WAITLIST] Client ${entry.client_id} notifié pour créneau ${date}`, { tenantId });

  // TODO: Envoyer notification (email/SMS) au client
  // Pour l'instant, on log uniquement

  return updated;
}

/**
 * Convertir une entrée waitlist en réservation
 */
export async function convertToReservation(tenantId, waitlistId, reservationId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('waitlist')
    .update({
      status: 'converted',
      reservation_id: reservationId,
      converted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', waitlistId)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) {
    logger.error('Erreur convert waitlist', { error: error.message, tenantId });
    throw error;
  }

  logger.info(`[WAITLIST] Entrée ${waitlistId} convertie en réservation ${reservationId}`, { tenantId });
  return data;
}

/**
 * Statistiques de la waitlist
 */
export async function getStats(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('waitlist')
    .select('status')
    .eq('tenant_id', tenantId);

  if (error) {
    logger.error('Erreur stats waitlist', { error: error.message, tenantId });
    return { waiting: 0, notified: 0, converted: 0, expired: 0, cancelled: 0, total: 0 };
  }

  const stats = {
    waiting: 0,
    notified: 0,
    converted: 0,
    expired: 0,
    cancelled: 0,
    total: data?.length || 0
  };

  data?.forEach(entry => {
    if (stats[entry.status] !== undefined) stats[entry.status]++;
  });

  return stats;
}
