/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RESTAURANT AVAILABILITY SERVICE
 *
 * Gère la capacité et la disponibilité des tables pour les tenants restaurant.
 * Utilisé par l'IA agent ET l'admin pour vérifier/attribuer les tables.
 *
 * Concepts clés:
 * - Les "tables" sont des services avec business_type restaurant
 * - Chaque table a une capacité (capacite = nb places max)
 * - Le restaurant a des services (midi/soir) avec des horaires
 * - Une réservation occupe une table pendant slot_duration (défaut: 90min)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { supabase } from '../config/supabase.js';

// Durée par défaut d'un repas (minutes)
const DEFAULT_SLOT_DURATION = 90;

/**
 * Détermine le service (midi/soir) en fonction de l'heure
 * @param {string} heure - HH:MM
 * @returns {'midi'|'soir'|null}
 */
export function getServiceType(heure) {
  if (!heure) return null;
  const [h] = heure.split(':').map(Number);
  if (h >= 11 && h < 15) return 'midi';
  if (h >= 18 && h < 23) return 'soir';
  return null;
}

/**
 * Récupère toutes les tables d'un restaurant
 * @param {string} tenantId
 * @returns {Promise<Array>} Tables avec capacite, zone, etc.
 */
export async function getRestaurantTables(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data: tables, error } = await supabase
    .from('services')
    .select('id, nom, capacite, zone, service_dispo, actif')
    .eq('tenant_id', tenantId)
    .eq('actif', true)
    .order('nom', { ascending: true });

  if (error) throw error;

  // Filtrer: une table a forcément une capacite > 0
  return (tables || []).filter(t => t.capacite && t.capacite > 0);
}

/**
 * Récupère les réservations actives pour une date et un créneau horaire
 * @param {string} tenantId
 * @param {string} date - YYYY-MM-DD
 * @param {string} heure - HH:MM (optionnel, filtre par chevauchement)
 * @param {number} slotDuration - Durée du repas en minutes
 * @returns {Promise<Array>} Réservations bloquantes
 */
async function getActiveReservations(tenantId, date, heure = null, slotDuration = DEFAULT_SLOT_DURATION) {
  if (!tenantId) throw new Error('tenant_id requis');

  let query = supabase
    .from('reservations')
    .select('id, service_id, table_id, nb_couverts, heure, duree_minutes, statut, client_id, service_nom')
    .eq('tenant_id', tenantId)
    .eq('date', date)
    .in('statut', ['demande', 'confirme', 'en_cours']);

  const { data: reservations, error } = await query;
  if (error) throw error;

  if (!heure) return reservations || [];

  // Filtrer par chevauchement horaire
  const toMin = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const requestStart = toMin(heure);
  const requestEnd = requestStart + slotDuration;

  return (reservations || []).filter(r => {
    if (!r.heure) return false;
    const resStart = toMin(r.heure);
    const resEnd = resStart + (r.duree_minutes || slotDuration);
    // Chevauchement: startA < endB && endA > startB
    return requestStart < resEnd && requestEnd > resStart;
  });
}

/**
 * Retourne la disponibilité de chaque table pour une date/heure
 * @param {string} tenantId
 * @param {string} date - YYYY-MM-DD
 * @param {string} heure - HH:MM (optionnel)
 * @returns {Promise<Object>} { tables: [{id, nom, capacite, zone, statut, reservation}], totals }
 */
export async function getTableAvailability(tenantId, date, heure = null) {
  if (!tenantId) throw new Error('tenant_id requis');

  const [tables, reservations] = await Promise.all([
    getRestaurantTables(tenantId),
    getActiveReservations(tenantId, date, heure)
  ]);

  // Index réservations par table
  // Une réservation peut avoir service_id (table ID) ou table_id
  const reservationsByTable = {};
  for (const r of reservations) {
    const tableId = r.table_id || r.service_id;
    if (tableId) {
      if (!reservationsByTable[tableId]) reservationsByTable[tableId] = [];
      reservationsByTable[tableId].push(r);
    }
  }

  const tableStatuses = tables.map(table => {
    const tableReservations = reservationsByTable[table.id] || [];
    const isOccupied = tableReservations.length > 0;

    return {
      id: table.id,
      nom: table.nom,
      capacite: table.capacite,
      zone: table.zone || 'interieur',
      service_dispo: table.service_dispo || 'midi_soir',
      statut: isOccupied ? 'occupee' : 'libre',
      reservations: tableReservations.map(r => ({
        id: r.id,
        heure: r.heure,
        nb_couverts: r.nb_couverts,
        client_id: r.client_id
      }))
    };
  });

  // Calculer totaux
  const totalTables = tableStatuses.length;
  const tablesLibres = tableStatuses.filter(t => t.statut === 'libre').length;
  const tablesOccupees = totalTables - tablesLibres;
  const capaciteTotale = tables.reduce((sum, t) => sum + (t.capacite || 0), 0);
  const couvertsReserves = reservations.reduce((sum, r) => sum + (r.nb_couverts || 0), 0);
  const couvertsDisponibles = capaciteTotale - couvertsReserves;

  return {
    tables: tableStatuses,
    totals: {
      total_tables: totalTables,
      tables_libres: tablesLibres,
      tables_occupees: tablesOccupees,
      capacite_totale: capaciteTotale,
      couverts_reserves: couvertsReserves,
      couverts_disponibles: Math.max(0, couvertsDisponibles),
      pourcentage_occupation: totalTables > 0
        ? Math.round((tablesOccupees / totalTables) * 100)
        : 0
    },
    service_type: heure ? getServiceType(heure) : null
  };
}

/**
 * Trouve la meilleure table disponible pour un nombre de couverts
 * Algorithme: best-fit (plus petite table suffisante)
 *
 * @param {string} tenantId
 * @param {string} date - YYYY-MM-DD
 * @param {string} heure - HH:MM
 * @param {number} nbCouverts - Nombre de personnes
 * @param {string} [zonePreference] - Zone préférée (interieur, terrasse, salon_prive)
 * @returns {Promise<Object>} { success, table, alternatives, error }
 */
export async function findAvailableTable(tenantId, date, heure, nbCouverts, zonePreference = null) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!date || !heure) return { success: false, error: 'Date et heure requises' };
  if (!nbCouverts || nbCouverts < 1) return { success: false, error: 'Nombre de couverts requis (min: 1)' };

  const { tables, totals } = await getTableAvailability(tenantId, date, heure);

  // Filtrer tables libres + capacité suffisante
  let candidates = tables
    .filter(t => t.statut === 'libre' && t.capacite >= nbCouverts);

  if (candidates.length === 0) {
    // Aucune table dispo → restaurant complet ou groupe trop grand
    const maxCapacite = Math.max(...tables.map(t => t.capacite), 0);

    if (nbCouverts > maxCapacite) {
      return {
        success: false,
        error: `Nous n'avons pas de table pour ${nbCouverts} personnes. Notre plus grande table accueille ${maxCapacite} personnes. Pour un groupe plus important, merci de nous contacter directement.`,
        totals
      };
    }

    return {
      success: false,
      error: `Désolé, aucune table disponible pour ${nbCouverts} personnes le ${date} à ${heure}. ${totals.tables_occupees}/${totals.total_tables} tables sont occupées.`,
      totals
    };
  }

  // Trier par best-fit: préférer la zone demandée, puis la plus petite table suffisante
  candidates.sort((a, b) => {
    // Priorité zone demandée
    if (zonePreference) {
      const aMatch = a.zone === zonePreference ? 0 : 1;
      const bMatch = b.zone === zonePreference ? 0 : 1;
      if (aMatch !== bMatch) return aMatch - bMatch;
    }

    // Best-fit: plus petite table suffisante
    return a.capacite - b.capacite;
  });

  const bestTable = candidates[0];
  const alternatives = candidates.slice(1, 3); // Max 2 alternatives

  return {
    success: true,
    table: {
      id: bestTable.id,
      nom: bestTable.nom,
      capacite: bestTable.capacite,
      zone: bestTable.zone
    },
    alternatives: alternatives.map(t => ({
      id: t.id,
      nom: t.nom,
      capacite: t.capacite,
      zone: t.zone
    })),
    totals
  };
}

/**
 * Vérifie si le restaurant est complet pour une date/heure
 * @param {string} tenantId
 * @param {string} date - YYYY-MM-DD
 * @param {string} heure - HH:MM
 * @returns {Promise<Object>} { complet: boolean, couverts_restants, message }
 */
export async function isRestaurantFull(tenantId, date, heure) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { totals } = await getTableAvailability(tenantId, date, heure);

  const complet = totals.tables_libres === 0;

  return {
    complet,
    tables_libres: totals.tables_libres,
    couverts_disponibles: totals.couverts_disponibles,
    pourcentage_occupation: totals.pourcentage_occupation,
    message: complet
      ? `Le restaurant est complet pour ce créneau (${totals.total_tables} tables occupées).`
      : `${totals.tables_libres} table(s) disponible(s) sur ${totals.total_tables} (${totals.couverts_disponibles} couverts restants).`
  };
}

/**
 * Retourne la capacité du restaurant pour les prochains jours
 * Utilisé par get_upcoming_days pour le contexte restaurant
 *
 * @param {string} tenantId
 * @param {string} date - YYYY-MM-DD
 * @param {string[]} serviceTypes - ['midi', 'soir']
 * @returns {Promise<Object>} Capacité par service type
 */
export async function getRestaurantCapacityForDay(tenantId, date, serviceTypes = ['midi', 'soir']) {
  if (!tenantId) throw new Error('tenant_id requis');

  const heuresByType = {
    midi: '12:30',
    soir: '20:00'
  };

  const capacity = {};

  for (const type of serviceTypes) {
    const heure = heuresByType[type] || '12:30';
    const { totals } = await getTableAvailability(tenantId, date, heure);

    capacity[type] = {
      tables_libres: totals.tables_libres,
      total_tables: totals.total_tables,
      couverts_disponibles: totals.couverts_disponibles,
      capacite_totale: totals.capacite_totale,
      pourcentage_occupation: totals.pourcentage_occupation,
      complet: totals.tables_libres === 0
    };
  }

  return capacity;
}

export default {
  getServiceType,
  getRestaurantTables,
  getTableAvailability,
  findAvailableTable,
  isRestaurantFull,
  getRestaurantCapacityForDay
};
