/**
 * Service de pointage automatique
 * Alimente les heures travaillées depuis les réservations terminées
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Synchronise le pointage depuis les réservations terminées
 * @param {string} tenantId - ID du tenant
 * @param {string} date - Date au format YYYY-MM-DD (optionnel, défaut = hier)
 */
export async function synchroniserPointageDepuisReservations(tenantId, date = null) {
  // Par défaut, traiter la veille
  if (!date) {
    const hier = new Date();
    hier.setDate(hier.getDate() - 1);
    date = hier.toISOString().split('T')[0];
  }

  // Récupérer les réservations terminées avec membre_id
  const { data: reservations, error: errReservations } = await supabase
    .from('reservations')
    .select(`
      id,
      membre_id,
      date_reservation,
      heure_debut,
      heure_fin,
      statut
    `)
    .eq('tenant_id', tenantId)
    .eq('date_reservation', date)
    .not('membre_id', 'is', null)
    .in('statut', ['completed', 'paid', 'confirmed']);

  if (errReservations) {
    console.error('[POINTAGE] Erreur récupération réservations:', errReservations);
    return { success: false, error: errReservations.message };
  }

  if (!reservations?.length) {
    return { success: true, message: 'Aucune réservation à traiter', count: 0 };
  }

  // Récupérer les infos contrat des membres
  const membreIds = [...new Set(reservations.map(r => r.membre_id))];
  const { data: membres } = await supabase
    .from('rh_membres')
    .select('id, heures_mensuelles, heures_hebdo')
    .in('id', membreIds);

  const membresMap = new Map();
  (membres || []).forEach(m => membresMap.set(m.id, m));

  // Agréger les heures par membre
  const heuresParMembre = new Map();

  for (const resa of reservations) {
    if (!resa.heure_debut || !resa.heure_fin) continue;

    const debut = parseTime(resa.heure_debut);
    const fin = parseTime(resa.heure_fin);
    const duree = (fin - debut) / 3600; // en heures

    if (duree <= 0) continue;

    const current = heuresParMembre.get(resa.membre_id) || {
      heures: 0,
      reservations: []
    };
    current.heures += duree;
    current.reservations.push(resa.id);
    heuresParMembre.set(resa.membre_id, current);
  }

  // Créer/mettre à jour les pointages
  let created = 0;
  let updated = 0;

  for (const [membreId, data] of heuresParMembre) {
    const membre = membresMap.get(membreId) || {};
    const heuresTheo = (membre.heures_mensuelles || 151.67) / 21.67; // ~7h/jour

    const pointageData = {
      tenant_id: tenantId,
      membre_id: membreId,
      date_travail: date,
      heures_travaillees: Math.round(data.heures * 100) / 100,
      heures_theoriques: Math.round(heuresTheo * 100) / 100,
      heures_supp: Math.max(0, Math.round((data.heures - heuresTheo) * 100) / 100),
      source: 'planning',
      reservation_id: data.reservations[0], // première réservation
      notes: `Auto-généré depuis ${data.reservations.length} réservation(s)`
    };

    // Upsert
    const { data: existing } = await supabase
      .from('rh_pointage')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membreId)
      .eq('date_travail', date)
      .single();

    if (existing) {
      await supabase
        .from('rh_pointage')
        .update(pointageData)
        .eq('id', existing.id);
      updated++;
    } else {
      await supabase
        .from('rh_pointage')
        .insert(pointageData);
      created++;
    }
  }

  return {
    success: true,
    date,
    reservations_traitees: reservations.length,
    pointages_crees: created,
    pointages_maj: updated
  };
}

/**
 * Calcule les heures supplémentaires mensuelles
 * @param {string} tenantId
 * @param {string} periode - Format YYYY-MM
 */
export async function calculerHeuresSupplementaires(tenantId, periode) {
  const [annee, mois] = periode.split('-').map(Number);
  const debutMois = `${periode}-01`;
  const finMois = new Date(annee, mois, 0).toISOString().split('T')[0];

  // Récupérer tous les pointages du mois
  const { data: pointages, error } = await supabase
    .from('rh_pointage')
    .select('membre_id, heures_supp, date_travail')
    .eq('tenant_id', tenantId)
    .gte('date_travail', debutMois)
    .lte('date_travail', finMois)
    .gt('heures_supp', 0);

  if (error) {
    return { success: false, error: error.message };
  }

  // Agréger par membre et par semaine
  const heuresParMembre = new Map();

  for (const p of pointages || []) {
    const current = heuresParMembre.get(p.membre_id) || {
      total: 0,
      parSemaine: new Map()
    };

    // Déterminer la semaine
    const dateTravail = new Date(p.date_travail);
    const semaine = getWeekNumber(dateTravail);

    const semaineCurrent = current.parSemaine.get(semaine) || 0;
    current.parSemaine.set(semaine, semaineCurrent + p.heures_supp);
    current.total += p.heures_supp;

    heuresParMembre.set(p.membre_id, current);
  }

  // Récupérer les taux horaires des membres
  const membreIds = [...heuresParMembre.keys()];
  if (!membreIds.length) {
    return { success: true, message: 'Aucune heure supp', count: 0 };
  }

  const { data: membres } = await supabase
    .from('rh_membres')
    .select('id, salaire_base, heures_mensuelles')
    .in('id', membreIds);

  const membresMap = new Map();
  (membres || []).forEach(m => membresMap.set(m.id, m));

  // Récupérer cumul annuel existant
  const { data: cumulExistant } = await supabase
    .from('rh_heures_supp_mensuel')
    .select('membre_id, heures_25, heures_50')
    .eq('tenant_id', tenantId)
    .like('periode', `${annee}-%`)
    .neq('periode', periode);

  const cumulParMembre = new Map();
  (cumulExistant || []).forEach(c => {
    const current = cumulParMembre.get(c.membre_id) || 0;
    cumulParMembre.set(c.membre_id, current + (c.heures_25 || 0) + (c.heures_50 || 0));
  });

  // Calculer les majorations
  const resultats = [];

  for (const [membreId, data] of heuresParMembre) {
    const membre = membresMap.get(membreId) || {};
    const tauxHoraire = membre.salaire_base && membre.heures_mensuelles
      ? Math.round(membre.salaire_base / membre.heures_mensuelles)
      : 0;

    // Calculer heures 25% et 50% par semaine (8 premières à 25%, au-delà à 50%)
    let heures25 = 0;
    let heures50 = 0;

    for (const [, heuresSemaine] of data.parSemaine) {
      if (heuresSemaine <= 8) {
        heures25 += heuresSemaine;
      } else {
        heures25 += 8;
        heures50 += heuresSemaine - 8;
      }
    }

    const montant25 = Math.round(heures25 * tauxHoraire * 1.25);
    const montant50 = Math.round(heures50 * tauxHoraire * 1.50);
    const cumulAnnuel = (cumulParMembre.get(membreId) || 0) + heures25 + heures50;

    const hsData = {
      tenant_id: tenantId,
      membre_id: membreId,
      periode,
      heures_25: Math.round(heures25 * 100) / 100,
      heures_50: Math.round(heures50 * 100) / 100,
      heures_total: Math.round((heures25 + heures50) * 100) / 100,
      taux_horaire: tauxHoraire,
      montant_25: montant25,
      montant_50: montant50,
      montant_total: montant25 + montant50,
      cumul_annuel: Math.round(cumulAnnuel * 100) / 100,
      alerte_contingent: cumulAnnuel >= 198, // 90% de 220h
      rc_genere: cumulAnnuel > 220 ? Math.round((cumulAnnuel - 220) * 100) / 100 : 0,
      updated_at: new Date().toISOString()
    };

    // Upsert
    const { data: existing } = await supabase
      .from('rh_heures_supp_mensuel')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membreId)
      .eq('periode', periode)
      .single();

    if (existing) {
      await supabase.from('rh_heures_supp_mensuel').update(hsData).eq('id', existing.id);
    } else {
      await supabase.from('rh_heures_supp_mensuel').insert(hsData);
    }

    resultats.push({
      membre_id: membreId,
      heures_25: hsData.heures_25,
      heures_50: hsData.heures_50,
      montant_total: hsData.montant_total,
      cumul_annuel: hsData.cumul_annuel,
      alerte: hsData.alerte_contingent
    });
  }

  return {
    success: true,
    periode,
    membres_traites: resultats.length,
    details: resultats
  };
}

/**
 * Parse une heure au format HH:MM en secondes depuis minuit
 */
function parseTime(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 3600 + m * 60;
}

/**
 * Retourne le numéro de semaine ISO
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export default {
  synchroniserPointageDepuisReservations,
  calculerHeuresSupplementaires
};
