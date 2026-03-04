/**
 * RH Handler — Gestion des ressources humaines
 * Tools: rh_liste_equipe, rh_heures_mois, rh_absences, rh_stats,
 *        rh_planning, rh_temps_travail, rh_conges, rh_objectifs,
 *        rh_formation, rh_bien_etre
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';

// ═══════════════════════════════════════════════════════════════
// rh_liste_equipe — Lister les membres de l'equipe
// ═══════════════════════════════════════════════════════════════
async function rh_liste_equipe(toolInput, tenantId) {
  const { role } = toolInput;
  // actif n'est plus un booleen: on filtre par statut='actif'
  const filtrerActifs = toolInput.actif !== undefined ? toolInput.actif : undefined;

  let query = supabase
    .from('rh_membres')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('prenom', { ascending: true });

  if (filtrerActifs !== undefined) {
    if (filtrerActifs === true || filtrerActifs === 'true') {
      query = query.eq('statut', 'actif');
    } else {
      query = query.neq('statut', 'actif');
    }
  }
  if (role) {
    query = query.eq('role', role);
  }

  const { data: equipe, error } = await query;
  if (error) throw error;

  return {
    success: true,
    effectif: equipe?.length || 0,
    equipe: (equipe || []).map(m => ({
      id: m.id,
      nom: `${m.prenom} ${m.nom}`,
      role: m.role,
      type_contrat: m.type_contrat,
      heures_semaine: m.heures_semaine,
      date_embauche: m.date_embauche,
      statut: m.statut,
      email: m.email,
      telephone: m.telephone
    }))
  };
}

// ═══════════════════════════════════════════════════════════════
// rh_heures_mois — Heures travaillees par mois
// ═══════════════════════════════════════════════════════════════
async function rh_heures_mois(toolInput, tenantId) {
  const { membre_id, mois } = toolInput;

  const now = new Date();
  const targetMonth = mois || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, month] = targetMonth.split('-').map(Number);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);
  const dateDebut = startOfMonth.toISOString().split('T')[0];
  const dateFin = endOfMonth.toISOString().split('T')[0];

  let query = supabase
    .from('rh_pointage')
    .select('*, rh_membres(id, prenom, nom, heures_semaine)')
    .eq('tenant_id', tenantId)
    .gte('date_travail', dateDebut)
    .lte('date_travail', dateFin);

  if (membre_id) {
    query = query.eq('membre_id', membre_id);
  }

  const { data: pointages, error } = await query;
  if (error) throw error;

  // Grouper par membre
  const parMembre = {};
  (pointages || []).forEach(p => {
    const membreId = p.membre_id;
    if (!parMembre[membreId]) {
      parMembre[membreId] = {
        nom: p.rh_membres ? `${p.rh_membres.prenom} ${p.rh_membres.nom}` : 'Inconnu',
        heures_semaine: p.rh_membres?.heures_semaine || 35,
        heures_travaillees: 0,
        heures_supplementaires: 0,
        nb_jours: 0
      };
    }
    parMembre[membreId].heures_travaillees += p.heures_travaillees || 0;
    parMembre[membreId].heures_supplementaires += p.heures_supp || 0;
    parMembre[membreId].nb_jours += 1;
  });

  // Calculer heures attendues et ecart
  const nbSemaines = Math.ceil(endOfMonth.getDate() / 7);
  const membres = Object.entries(parMembre).map(([id, data]) => {
    const heuresAttendues = data.heures_semaine * nbSemaines;
    return {
      membre_id: id,
      nom: data.nom,
      heures_travaillees: Math.round(data.heures_travaillees * 10) / 10,
      heures_supplementaires: Math.round(data.heures_supplementaires * 10) / 10,
      heures_attendues: heuresAttendues,
      ecart: Math.round((data.heures_travaillees - heuresAttendues) * 10) / 10,
      nb_jours_pointes: data.nb_jours
    };
  });

  const totalHeures = membres.reduce((sum, m) => sum + m.heures_travaillees, 0);
  const totalSupp = membres.reduce((sum, m) => sum + m.heures_supplementaires, 0);

  return {
    success: true,
    mois: targetMonth,
    total_heures_travaillees: Math.round(totalHeures * 10) / 10,
    total_heures_supplementaires: Math.round(totalSupp * 10) / 10,
    membres,
    nb_pointages: pointages?.length || 0
  };
}

// ═══════════════════════════════════════════════════════════════
// rh_absences — CRUD absences (lister, creer, valider, refuser)
// ═══════════════════════════════════════════════════════════════
async function rh_absences(toolInput, tenantId) {
  const { action = 'lister', membre_id, statut, type, date_debut, date_fin, absence_id, motif, commentaire_refus } = toolInput;

  if (action === 'creer') {
    if (!membre_id || !date_debut || !date_fin || !type) {
      return { success: false, error: 'membre_id, date_debut, date_fin et type sont requis' };
    }

    const { data: newAbsence, error } = await supabase
      .from('rh_absences')
      .insert({
        tenant_id: tenantId,
        membre_id,
        date_debut,
        date_fin,
        type,
        motif: motif || null,
        statut: 'en_attente'
      })
      .select('*, rh_membres(prenom, nom)')
      .single();

    if (error) throw error;

    return {
      success: true,
      message: 'Absence creee',
      absence: {
        id: newAbsence.id,
        membre: newAbsence.rh_membres ? `${newAbsence.rh_membres.prenom} ${newAbsence.rh_membres.nom}` : 'Inconnu',
        type: newAbsence.type,
        debut: newAbsence.date_debut,
        fin: newAbsence.date_fin,
        nb_jours: newAbsence.nb_jours,
        statut: newAbsence.statut
      }
    };
  }

  if (action === 'valider' || action === 'refuser') {
    if (!absence_id) {
      return { success: false, error: 'absence_id est requis pour valider/refuser' };
    }

    const updates = {
      statut: action === 'valider' ? 'approuve' : 'refuse',
      date_validation: new Date().toISOString()
    };
    if (action === 'refuser' && commentaire_refus) {
      updates.commentaire_refus = commentaire_refus;
    }

    const { data: updated, error } = await supabase
      .from('rh_absences')
      .update(updates)
      .eq('id', absence_id)
      .eq('tenant_id', tenantId)
      .select('*, rh_membres(prenom, nom)')
      .single();

    if (error) throw error;

    return {
      success: true,
      message: action === 'valider' ? 'Absence approuvee' : 'Absence refusee',
      absence: {
        id: updated.id,
        membre: updated.rh_membres ? `${updated.rh_membres.prenom} ${updated.rh_membres.nom}` : 'Inconnu',
        type: updated.type,
        debut: updated.date_debut,
        fin: updated.date_fin,
        statut: updated.statut
      }
    };
  }

  // Lister les absences
  let query = supabase
    .from('rh_absences')
    .select('*, rh_membres(id, prenom, nom, role)')
    .eq('tenant_id', tenantId)
    .order('date_debut', { ascending: false });

  if (membre_id) query = query.eq('membre_id', membre_id);
  if (statut && statut !== 'tous') query = query.eq('statut', statut);
  if (type) query = query.eq('type', type);
  if (date_debut) query = query.gte('date_debut', date_debut);
  if (date_fin) query = query.lte('date_fin', date_fin);

  const { data: absences, error } = await query.limit(50);
  if (error) throw error;

  // Compter par type et statut
  const parType = {};
  const parStatut = {};
  (absences || []).forEach(a => {
    parType[a.type] = (parType[a.type] || 0) + (a.nb_jours || 0);
    parStatut[a.statut] = (parStatut[a.statut] || 0) + 1;
  });

  return {
    success: true,
    nb_absences: absences?.length || 0,
    jours_par_type: parType,
    par_statut: parStatut,
    absences: (absences || []).map(a => ({
      id: a.id,
      membre: a.rh_membres ? `${a.rh_membres.prenom} ${a.rh_membres.nom}` : 'Inconnu',
      role: a.rh_membres?.role,
      type: a.type,
      debut: a.date_debut,
      fin: a.date_fin,
      nb_jours: a.nb_jours,
      statut: a.statut,
      motif: a.motif
    }))
  };
}

// ═══════════════════════════════════════════════════════════════
// rh_stats — Statistiques RH aggregees
// ═══════════════════════════════════════════════════════════════
async function rh_stats(toolInput, tenantId) {
  const { mois } = toolInput;

  const now = new Date();
  const targetMonth = mois || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, month] = targetMonth.split('-').map(Number);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);
  const dateDebut = startOfMonth.toISOString().split('T')[0];
  const dateFin = endOfMonth.toISOString().split('T')[0];

  // Equipe active
  const { data: equipe } = await supabase
    .from('rh_membres')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('statut', 'actif');

  // Absences approuvees du mois
  const { data: absences } = await supabase
    .from('rh_absences')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('statut', 'approuve')
    .gte('date_debut', dateDebut)
    .lte('date_fin', dateFin);

  // Pointages du mois
  const { data: pointages } = await supabase
    .from('rh_pointage')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('date_travail', dateDebut)
    .lte('date_travail', dateFin);

  // Absences en attente
  const { data: absencesEnAttente } = await supabase
    .from('rh_absences')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('statut', 'en_attente');

  // Calculs
  const totalHeures = (pointages || []).reduce((sum, p) => sum + (p.heures_travaillees || 0), 0);
  const totalSupp = (pointages || []).reduce((sum, p) => sum + (p.heures_supp || 0), 0);
  const joursAbsence = (absences || []).reduce((sum, a) => sum + (a.nb_jours || 0), 0);

  // Par type d'absence
  const absencesParType = {};
  (absences || []).forEach(a => {
    absencesParType[a.type] = (absencesParType[a.type] || 0) + (a.nb_jours || 0);
  });

  return {
    success: true,
    mois: targetMonth,
    stats: {
      effectif_actif: equipe?.length || 0,
      heures_travaillees_total: Math.round(totalHeures * 10) / 10,
      heures_supplementaires_total: Math.round(totalSupp * 10) / 10,
      jours_absence_total: joursAbsence,
      absences_par_type: absencesParType,
      absences_en_attente: absencesEnAttente?.length || 0,
      nb_pointages_mois: pointages?.length || 0
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// rh_planning — Planning equipe pour une semaine donnee
// ═══════════════════════════════════════════════════════════════
async function rh_planning(toolInput, tenantId) {
  const { semaine } = toolInput;

  // Calculer lundi et dimanche de la semaine
  const now = new Date();
  let weekStart, weekEnd;

  if (semaine) {
    // Format attendu: YYYY-MM-DD (date du lundi)
    weekStart = semaine;
    const d = new Date(semaine + 'T12:00:00');
    d.setDate(d.getDate() + 6);
    weekEnd = d.toISOString().split('T')[0];
  } else {
    // Semaine courante
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    weekStart = monday.toISOString().split('T')[0];
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    weekEnd = sunday.toISOString().split('T')[0];
  }

  logger.debug(`[RH] Planning semaine ${weekStart} -> ${weekEnd} - tenant: ${tenantId}`);

  // Membres actifs
  const { data: membres, error: errMembres } = await supabase
    .from('rh_membres')
    .select('id, prenom, nom, role')
    .eq('tenant_id', tenantId)
    .eq('statut', 'actif');

  if (errMembres) throw errMembres;

  // Reservations de la semaine
  const { data: rdvs, error: errRdvs } = await supabase
    .from('reservations')
    .select('id, date, heure, service_nom, client_id, membre_id, statut')
    .eq('tenant_id', tenantId)
    .gte('date', weekStart)
    .lte('date', weekEnd);

  if (errRdvs) throw errRdvs;

  // Absences de la semaine
  const { data: absences } = await supabase
    .from('rh_absences')
    .select('membre_id, type, date_debut, date_fin, statut')
    .eq('tenant_id', tenantId)
    .eq('statut', 'approuve')
    .lte('date_debut', weekEnd)
    .gte('date_fin', weekStart);

  // Grouper rdvs par membre
  const planningParMembre = (membres || []).map(m => {
    const mesRdvs = (rdvs || []).filter(r => r.membre_id === m.id);
    const mesAbsences = (absences || []).filter(a => a.membre_id === m.id);

    // Grouper les RDV par jour
    const parJour = {};
    mesRdvs.forEach(r => {
      if (!parJour[r.date]) parJour[r.date] = [];
      parJour[r.date].push({
        id: r.id,
        heure: r.heure,
        service: r.service_nom,
        statut: r.statut
      });
    });

    return {
      membre_id: m.id,
      nom: `${m.prenom} ${m.nom}`,
      role: m.role,
      nb_rdv_semaine: mesRdvs.length,
      absences: mesAbsences.map(a => ({
        type: a.type,
        debut: a.date_debut,
        fin: a.date_fin
      })),
      planning: parJour
    };
  });

  return {
    success: true,
    semaine: { debut: weekStart, fin: weekEnd },
    effectif: membres?.length || 0,
    total_rdv: rdvs?.length || 0,
    planning: planningParMembre
  };
}

// ═══════════════════════════════════════════════════════════════
// rh_temps_travail — Analyse temps de travail sur une periode
// ═══════════════════════════════════════════════════════════════
async function rh_temps_travail(toolInput, tenantId) {
  const { debut, fin, membre_id } = toolInput;

  const now = new Date();
  const dateDebut = debut || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const dateFin = fin || now.toISOString().split('T')[0];

  logger.debug(`[RH] Temps travail ${dateDebut} -> ${dateFin} - tenant: ${tenantId}`);

  let query = supabase
    .from('rh_pointage')
    .select('*, rh_membres(id, prenom, nom, role, heures_semaine)')
    .eq('tenant_id', tenantId)
    .gte('date_travail', dateDebut)
    .lte('date_travail', dateFin);

  if (membre_id) {
    query = query.eq('membre_id', membre_id);
  }

  const { data: pointages, error } = await query;
  if (error) throw error;

  // Recuperer les RDV pour calculer la productivite
  let rdvQuery = supabase
    .from('reservations')
    .select('id, membre_id, statut, prix_total, prix_service')
    .eq('tenant_id', tenantId)
    .gte('date', dateDebut)
    .lte('date', dateFin)
    .in('statut', ['confirme', 'termine']);

  if (membre_id) {
    rdvQuery = rdvQuery.eq('membre_id', membre_id);
  }

  const { data: rdvs } = await rdvQuery;

  // Grouper par membre
  const parMembre = {};
  (pointages || []).forEach(p => {
    const mId = p.membre_id;
    if (!parMembre[mId]) {
      parMembre[mId] = {
        nom: p.rh_membres ? `${p.rh_membres.prenom} ${p.rh_membres.nom}` : 'Inconnu',
        role: p.rh_membres?.role,
        heures_semaine: p.rh_membres?.heures_semaine || 35,
        heures_travaillees: 0,
        heures_supp: 0,
        nb_jours: 0,
        nb_rdv: 0,
        ca_genere: 0
      };
    }
    parMembre[mId].heures_travaillees += p.heures_travaillees || 0;
    parMembre[mId].heures_supp += p.heures_supp || 0;
    parMembre[mId].nb_jours += 1;
  });

  // Ajouter les stats RDV
  (rdvs || []).forEach(r => {
    if (parMembre[r.membre_id]) {
      parMembre[r.membre_id].nb_rdv += 1;
      parMembre[r.membre_id].ca_genere += r.prix_total || r.prix_service || 0;
    }
  });

  const membres = Object.entries(parMembre).map(([id, data]) => {
    const productivite = data.heures_travaillees > 0
      ? Math.round((data.nb_rdv / data.heures_travaillees) * 100) / 100
      : 0;
    const caParHeure = data.heures_travaillees > 0
      ? Math.round((data.ca_genere / data.heures_travaillees)) / 100
      : 0;

    return {
      membre_id: id,
      nom: data.nom,
      role: data.role,
      heures_travaillees: Math.round(data.heures_travaillees * 10) / 10,
      heures_supp: Math.round(data.heures_supp * 10) / 10,
      nb_jours: data.nb_jours,
      nb_rdv: data.nb_rdv,
      ca_genere: `${(data.ca_genere / 100).toFixed(2)}`,
      productivite_rdv_par_heure: productivite,
      ca_par_heure: `${caParHeure.toFixed(2)}`
    };
  });

  const totalHeures = membres.reduce((sum, m) => sum + m.heures_travaillees, 0);
  const totalSupp = membres.reduce((sum, m) => sum + m.heures_supp, 0);

  return {
    success: true,
    periode: { debut: dateDebut, fin: dateFin },
    total_heures: Math.round(totalHeures * 10) / 10,
    total_heures_supp: Math.round(totalSupp * 10) / 10,
    nb_membres: membres.length,
    membres
  };
}

// ═══════════════════════════════════════════════════════════════
// rh_conges — Gestion des conges (poser, voir, annuler)
// ═══════════════════════════════════════════════════════════════
async function rh_conges(toolInput, tenantId) {
  const { action = 'voir', membre_id, date_debut, date_fin, type, motif, conge_id } = toolInput;
  const typesConges = ['conge_paye', 'rtt', 'sans_solde'];

  if (action === 'poser') {
    if (!membre_id || !date_debut || !date_fin) {
      return { success: false, error: 'membre_id, date_debut et date_fin sont requis' };
    }

    const typeConge = type || 'conge_paye';
    if (!typesConges.includes(typeConge)) {
      return { success: false, error: `Type invalide. Valeurs acceptees: ${typesConges.join(', ')}` };
    }

    // Verifier chevauchement avec conges existants
    const { data: existants } = await supabase
      .from('rh_absences')
      .select('id, date_debut, date_fin, type')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membre_id)
      .in('statut', ['en_attente', 'approuve'])
      .lte('date_debut', date_fin)
      .gte('date_fin', date_debut);

    if (existants && existants.length > 0) {
      return {
        success: false,
        error: 'Chevauchement avec un conge existant',
        conflits: existants.map(e => ({
          id: e.id,
          type: e.type,
          debut: e.date_debut,
          fin: e.date_fin
        }))
      };
    }

    // Calculer le nombre de jours
    const d1 = new Date(date_debut + 'T12:00:00');
    const d2 = new Date(date_fin + 'T12:00:00');
    let nbJours = 0;
    const current = new Date(d1);
    while (current <= d2) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) nbJours++; // Exclure weekends
      current.setDate(current.getDate() + 1);
    }

    const { data: newConge, error } = await supabase
      .from('rh_absences')
      .insert({
        tenant_id: tenantId,
        membre_id,
        date_debut,
        date_fin,
        type: typeConge,
        motif: motif || null,
        nb_jours: nbJours,
        statut: 'en_attente'
      })
      .select('*, rh_membres(prenom, nom)')
      .single();

    if (error) throw error;

    return {
      success: true,
      message: `Conge pose (${nbJours} jours ouvrables)`,
      conge: {
        id: newConge.id,
        membre: newConge.rh_membres ? `${newConge.rh_membres.prenom} ${newConge.rh_membres.nom}` : 'Inconnu',
        type: newConge.type,
        debut: newConge.date_debut,
        fin: newConge.date_fin,
        nb_jours: nbJours,
        statut: newConge.statut
      }
    };
  }

  if (action === 'annuler') {
    if (!conge_id) {
      return { success: false, error: 'conge_id est requis pour annuler' };
    }

    const { data: updated, error } = await supabase
      .from('rh_absences')
      .update({ statut: 'annule' })
      .eq('id', conge_id)
      .eq('tenant_id', tenantId)
      .in('type', typesConges)
      .select('*, rh_membres(prenom, nom)')
      .single();

    if (error) throw error;

    return {
      success: true,
      message: 'Conge annule',
      conge: {
        id: updated.id,
        membre: updated.rh_membres ? `${updated.rh_membres.prenom} ${updated.rh_membres.nom}` : 'Inconnu',
        type: updated.type,
        debut: updated.date_debut,
        fin: updated.date_fin,
        statut: updated.statut
      }
    };
  }

  // Voir (lister les conges)
  let query = supabase
    .from('rh_absences')
    .select('*, rh_membres(id, prenom, nom, role)')
    .eq('tenant_id', tenantId)
    .in('type', typesConges)
    .order('date_debut', { ascending: false });

  if (membre_id) query = query.eq('membre_id', membre_id);
  if (type && typesConges.includes(type)) query = query.eq('type', type);

  const { data: conges, error } = await query.limit(50);
  if (error) throw error;

  // Stats par type et statut
  const parType = {};
  const parStatut = {};
  (conges || []).forEach(c => {
    parType[c.type] = (parType[c.type] || 0) + (c.nb_jours || 0);
    parStatut[c.statut] = (parStatut[c.statut] || 0) + 1;
  });

  return {
    success: true,
    nb_conges: conges?.length || 0,
    jours_par_type: parType,
    par_statut: parStatut,
    conges: (conges || []).map(c => ({
      id: c.id,
      membre: c.rh_membres ? `${c.rh_membres.prenom} ${c.rh_membres.nom}` : 'Inconnu',
      role: c.rh_membres?.role,
      type: c.type,
      debut: c.date_debut,
      fin: c.date_fin,
      nb_jours: c.nb_jours,
      statut: c.statut,
      motif: c.motif
    }))
  };
}

// ═══════════════════════════════════════════════════════════════
// rh_objectifs — Gestion des objectifs (sentinel_goals)
// ═══════════════════════════════════════════════════════════════
async function rh_objectifs(toolInput, tenantId) {
  const { action = 'voir', objectif_id, type_objectif, description, cible, progression, membre_id, echeance } = toolInput;

  if (action === 'definir') {
    if (!type_objectif) {
      return { success: false, error: 'type_objectif est requis' };
    }

    const { data: newGoal, error } = await supabase
      .from('sentinel_goals')
      .insert({
        tenant_id: tenantId,
        title: type_objectif,
        description: description || null,
        target_value: cible || null,
        current_value: 0,
        membre_id: membre_id || null,
        deadline: echeance || null,
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: 'Objectif defini',
      objectif: {
        id: newGoal.id,
        titre: newGoal.title,
        description: newGoal.description,
        cible: newGoal.target_value,
        progression: newGoal.current_value,
        echeance: newGoal.deadline,
        statut: newGoal.status
      }
    };
  }

  if (action === 'suivre') {
    if (!objectif_id) {
      return { success: false, error: 'objectif_id est requis pour suivre' };
    }

    const updates = {};
    if (progression !== undefined) updates.current_value = progression;
    if (type_objectif) updates.title = type_objectif;
    if (description) updates.description = description;
    if (echeance) updates.deadline = echeance;

    // Verifier si objectif atteint
    if (progression !== undefined) {
      const { data: goal } = await supabase
        .from('sentinel_goals')
        .select('target_value')
        .eq('id', objectif_id)
        .eq('tenant_id', tenantId)
        .single();

      if (goal && goal.target_value && progression >= goal.target_value) {
        updates.status = 'completed';
        updates.completed_at = new Date().toISOString();
      }
    }

    const { data: updated, error } = await supabase
      .from('sentinel_goals')
      .update(updates)
      .eq('id', objectif_id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    const pourcent = updated.target_value
      ? Math.round((updated.current_value / updated.target_value) * 100)
      : null;

    return {
      success: true,
      message: updated.status === 'completed' ? 'Objectif atteint!' : 'Progression mise a jour',
      objectif: {
        id: updated.id,
        titre: updated.title,
        progression: updated.current_value,
        cible: updated.target_value,
        pourcentage: pourcent !== null ? `${pourcent}%` : null,
        statut: updated.status
      }
    };
  }

  // Voir (lister les objectifs)
  let query = supabase
    .from('sentinel_goals')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (membre_id) query = query.eq('membre_id', membre_id);

  const { data: goals, error } = await query;
  if (error) throw error;

  const parStatut = {};
  (goals || []).forEach(g => {
    parStatut[g.status] = (parStatut[g.status] || 0) + 1;
  });

  return {
    success: true,
    nb_objectifs: goals?.length || 0,
    par_statut: parStatut,
    objectifs: (goals || []).map(g => {
      const pourcent = g.target_value
        ? Math.round((g.current_value / g.target_value) * 100)
        : null;
      return {
        id: g.id,
        titre: g.title,
        description: g.description,
        progression: g.current_value,
        cible: g.target_value,
        pourcentage: pourcent !== null ? `${pourcent}%` : null,
        echeance: g.deadline,
        statut: g.status,
        membre_id: g.membre_id
      };
    })
  };
}

// ═══════════════════════════════════════════════════════════════
// rh_formation — Suggestions de formations via Claude Haiku
// ═══════════════════════════════════════════════════════════════
async function rh_formation(toolInput, tenantId) {
  const { membre_id, domaine, budget } = toolInput;
  const { generateContent, getTenantContext } = await import('./shared/claudeHelper.js');

  logger.debug(`[RH] Formation suggestion - tenant: ${tenantId}`);

  // Contexte tenant
  const ctx = await getTenantContext(supabase, tenantId);

  // Recuperer info membre si specifie
  let membreInfo = '';
  if (membre_id) {
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('prenom, nom, role, type_contrat, date_embauche')
      .eq('id', membre_id)
      .eq('tenant_id', tenantId)
      .single();

    if (membre) {
      membreInfo = `Membre: ${membre.prenom} ${membre.nom}, Role: ${membre.role}, Contrat: ${membre.type_contrat}, Depuis: ${membre.date_embauche}`;
    }
  }

  // Recuperer equipe pour contexte
  const { data: equipe } = await supabase
    .from('rh_membres')
    .select('role')
    .eq('tenant_id', tenantId)
    .eq('statut', 'actif');

  const roles = [...new Set((equipe || []).map(m => m.role))];

  const prompt = `Tu es un conseiller RH expert pour "${ctx.businessName}" (${ctx.businessType}).
${membreInfo ? `\n${membreInfo}` : ''}
Roles dans l'equipe: ${roles.join(', ')}
${domaine ? `Domaine souhaite: ${domaine}` : ''}
${budget ? `Budget: ${budget}` : ''}

Services proposes:
${ctx.servicesText}

Suggere 3-5 formations pertinentes au format JSON:
{
  "formations": [
    {
      "titre": "...",
      "description": "...",
      "duree": "...",
      "niveau": "debutant|intermediaire|avance",
      "priorite": "haute|moyenne|basse",
      "cout_estime": "...",
      "benefice_attendu": "..."
    }
  ],
  "recommandation": "..."
}`;

  try {
    const result = await generateContent(prompt, 1500);

    return {
      success: true,
      ...result,
      contexte: {
        business: ctx.businessName,
        membre: membreInfo || null,
        domaine: domaine || null
      }
    };
  } catch (err) {
    logger.error(`[RH] Formation error: ${err.message}`);
    return {
      success: false,
      error: 'Impossible de generer les suggestions de formation',
      detail: err.message
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// rh_bien_etre — Analyse bien-etre via Claude Haiku
// ═══════════════════════════════════════════════════════════════
async function rh_bien_etre(toolInput, tenantId) {
  const { periode_mois } = toolInput;
  const { generateContent, getTenantContext } = await import('./shared/claudeHelper.js');

  logger.debug(`[RH] Bien-etre analyse - tenant: ${tenantId}`);

  const now = new Date();
  const nbMois = periode_mois || 3;
  const dateDebut = new Date(now.getFullYear(), now.getMonth() - nbMois, 1).toISOString().split('T')[0];
  const dateFin = now.toISOString().split('T')[0];

  // Contexte tenant
  const ctx = await getTenantContext(supabase, tenantId);

  // Pointages
  const { data: pointages } = await supabase
    .from('rh_pointage')
    .select('membre_id, heures_travaillees, heures_supp, date_travail')
    .eq('tenant_id', tenantId)
    .gte('date_travail', dateDebut)
    .lte('date_travail', dateFin);

  // Absences
  const { data: absences } = await supabase
    .from('rh_absences')
    .select('membre_id, type, nb_jours, statut')
    .eq('tenant_id', tenantId)
    .gte('date_debut', dateDebut)
    .lte('date_fin', dateFin);

  // Membres actifs
  const { data: membres } = await supabase
    .from('rh_membres')
    .select('id, prenom, nom, role, heures_semaine')
    .eq('tenant_id', tenantId)
    .eq('statut', 'actif');

  // Agreger les donnees par membre
  const statsParMembre = {};
  (membres || []).forEach(m => {
    statsParMembre[m.id] = {
      nom: `${m.prenom} ${m.nom}`,
      role: m.role,
      heures_semaine: m.heures_semaine || 35,
      total_heures: 0,
      total_heures_supp: 0,
      nb_jours_travailles: 0,
      nb_jours_absence: 0,
      types_absence: {}
    };
  });

  (pointages || []).forEach(p => {
    if (statsParMembre[p.membre_id]) {
      statsParMembre[p.membre_id].total_heures += p.heures_travaillees || 0;
      statsParMembre[p.membre_id].total_heures_supp += p.heures_supp || 0;
      statsParMembre[p.membre_id].nb_jours_travailles += 1;
    }
  });

  (absences || []).forEach(a => {
    if (statsParMembre[a.membre_id] && (a.statut === 'approuve' || a.statut === 'en_attente')) {
      statsParMembre[a.membre_id].nb_jours_absence += a.nb_jours || 0;
      const t = a.type || 'autre';
      statsParMembre[a.membre_id].types_absence[t] = (statsParMembre[a.membre_id].types_absence[t] || 0) + (a.nb_jours || 0);
    }
  });

  // Preparer le resume pour Claude
  const resumeMembres = Object.values(statsParMembre).map(m => {
    const ratioSupp = m.total_heures > 0 ? Math.round((m.total_heures_supp / m.total_heures) * 100) : 0;
    return `- ${m.nom} (${m.role}): ${Math.round(m.total_heures)}h travaillees, ${Math.round(m.total_heures_supp)}h supp (${ratioSupp}%), ${m.nb_jours_absence}j absence (${JSON.stringify(m.types_absence)})`;
  }).join('\n');

  const prompt = `Tu es un expert RH en bien-etre au travail. Analyse ces donnees pour "${ctx.businessName}" (${ctx.businessType}) sur ${nbMois} mois:

${resumeMembres || 'Aucune donnee de pointage disponible.'}

Effectif: ${membres?.length || 0} membres actifs

Fournis une analyse au format JSON:
{
  "score_global": 1-10,
  "indicateurs": {
    "surcharge_travail": "vert|orange|rouge",
    "absenteisme": "vert|orange|rouge",
    "equilibre_vie_pro": "vert|orange|rouge"
  },
  "alertes": ["..."],
  "points_positifs": ["..."],
  "recommandations": ["..."],
  "membres_a_surveiller": [{"nom": "...", "raison": "..."}]
}`;

  try {
    const result = await generateContent(prompt, 1500);

    return {
      success: true,
      periode: { debut: dateDebut, fin: dateFin, mois: nbMois },
      effectif: membres?.length || 0,
      donnees_brutes: {
        nb_pointages: pointages?.length || 0,
        nb_absences: absences?.length || 0
      },
      ...result
    };
  } catch (err) {
    logger.error(`[RH] Bien-etre error: ${err.message}`);
    return {
      success: false,
      error: 'Impossible de generer l\'analyse bien-etre',
      detail: err.message
    };
  }
}

export const rhHandlers = {
  rh_liste_equipe,
  rh_heures_mois,
  rh_absences,
  rh_stats,
  rh_planning,
  rh_temps_travail,
  rh_conges,
  rh_objectifs,
  rh_formation,
  rh_bien_etre
};
