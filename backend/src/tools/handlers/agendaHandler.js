/**
 * Agenda Handler — Gestion des evenements personnels de l'entrepreneur
 * Tools: agenda_creer_evenement, agenda_lister_evenements, agenda_aujourdhui,
 *        agenda_prochains, agenda_modifier_evenement, agenda_supprimer_evenement,
 *        agenda_marquer_termine
 *
 * IMPORTANT: Tous les outils agenda requierent adminId
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// ═══════════════════════════════════════════════════════════════
// agenda_creer_evenement — Creer un evenement avec detection chevauchement
// ═══════════════════════════════════════════════════════════════
async function agenda_creer_evenement(toolInput, tenantId, adminId) {
  let { titre, date, heure, heure_fin, type, lieu, description, participants } = toolInput;

  logger.debug(`[AGENDA] agenda_creer_evenement - Params:`, JSON.stringify(toolInput, null, 2));

  if (!titre || !heure) {
    return { success: false, error: 'Titre et heure sont requis' };
  }

  // Si la date est juste un jour (ex: "24"), convertir en date ISO du mois courant
  if (!date || /^\d{1,2}$/.test(date)) {
    const jour = parseInt(date) || new Date().getDate();
    const now = new Date();
    date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
    logger.debug(`[AGENDA] Date convertie depuis jour: ${toolInput.date} -> ${date}`);
  }

  // Validation du format de date
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return { success: false, error: `Format de date invalide: "${date}". Utilisez YYYY-MM-DD (ex: 2026-02-24)` };
  }

  // AUTO-CORRECTION: Detecter si l'IA a passe la mauvaise date
  // Chercher un numero de jour dans le titre ou la description
  const texteCombine = `${titre} ${description || ''} ${participants || ''}`;
  const jourMentionneMatch = texteCombine.match(/\ble?\s*(\d{1,2})\b/i);

  if (jourMentionneMatch) {
    const jourMentionne = parseInt(jourMentionneMatch[1]);
    const jourDatePasse = parseInt(date.split('-')[2]);

    // Si le jour mentionne est valide et different de celui passe, corriger
    if (jourMentionne >= 1 && jourMentionne <= 31 && jourMentionne !== jourDatePasse) {
      const [annee, mois] = date.split('-');
      const dateCorrigee = `${annee}-${mois}-${String(jourMentionne).padStart(2, '0')}`;
      logger.debug(`[AGENDA] AUTO-CORRECTION: ${date} -> ${dateCorrigee} (jour ${jourMentionne} detecte dans "${jourMentionneMatch[0]}")`);
      date = dateCorrigee;
    }
  }

  // Validation de l'heure
  const heureRegex = /^\d{2}:\d{2}$/;
  if (!heureRegex.test(heure)) {
    return { success: false, error: `Format d'heure invalide: "${heure}". Utilisez HH:MM (ex: 10:00)` };
  }

  if (!adminId) {
    logger.error('[AGENDA] agenda_creer_evenement: adminId non fourni!');
    return { success: false, error: 'Session admin non valide' };
  }
  logger.debug(`[AGENDA] Creation evenement avec adminId: ${adminId}`);

  // Verifier les chevauchements
  const startTime = heure;
  const endTime = heure_fin || heure;

  const { data: existingEvents } = await supabase
    .from('agenda_events')
    .select('id, title, start_time, end_time')
    .eq('tenant_id', tenantId)
    .eq('admin_id', adminId)
    .eq('date', date);

  // Detecter les chevauchements
  const overlaps = [];
  for (const evt of existingEvents || []) {
    const evtStart = evt.start_time || '00:00';
    const evtEnd = evt.end_time || evt.start_time || '23:59';

    if (startTime < evtEnd && (heure_fin || '23:59') > evtStart) {
      overlaps.push({
        id: evt.id,
        titre: evt.title,
        horaire: `${evtStart}${evt.end_time ? ' - ' + evt.end_time : ''}`
      });
    }
  }

  if (overlaps.length > 0) {
    return {
      success: false,
      error: 'Chevauchement detecte avec un evenement existant',
      conflits: overlaps,
      message: `Un evenement existe deja le ${date} : "${overlaps[0].titre}" a ${overlaps[0].horaire}. Voulez-vous quand meme creer cet evenement ?`
    };
  }

  // Creer l'evenement
  const { data, error } = await supabase
    .from('agenda_events')
    .insert({
      tenant_id: tenantId,
      admin_id: adminId,
      title: titre,
      description: description || null,
      date,
      start_time: heure,
      end_time: heure_fin || null,
      type: type || 'meeting',
      location: lieu || null,
      attendees: participants || null,
      completed: false
    })
    .select()
    .single();

  if (error) throw error;

  const dateObj = new Date(date + 'T12:00:00');
  const jourSemaine = JOURS[dateObj.getDay()];

  return {
    success: true,
    message: `Evenement cree: "${titre}" le ${jourSemaine} ${date} de ${heure}${heure_fin ? ' a ' + heure_fin : ''}`,
    evenement: {
      id: data.id,
      titre: data.title,
      date: data.date,
      jour: jourSemaine,
      heure: data.start_time,
      heure_fin: data.end_time,
      type: data.type,
      lieu: data.location,
      participants: data.attendees
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// agenda_lister_evenements — Lister les evenements avec filtres
// ═══════════════════════════════════════════════════════════════
async function agenda_lister_evenements(toolInput, tenantId, adminId) {
  const { date: dateSpecifique, debut, fin, type } = toolInput;

  logger.debug(`[AGENDA] Liste evenements agenda`);

  if (!adminId) {
    logger.error('[AGENDA] Outil agenda: adminId non fourni!');
    return { success: false, error: 'Session admin non valide' };
  }

  let query = supabase
    .from('agenda_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('admin_id', adminId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });

  if (dateSpecifique) {
    query = query.eq('date', dateSpecifique);
  } else if (debut && fin) {
    query = query.gte('date', debut).lte('date', fin);
  }

  if (type && type !== 'all') {
    query = query.eq('type', type);
  }

  const { data: events, error } = await query.limit(50);

  if (error) throw error;

  return {
    success: true,
    nb_evenements: events?.length || 0,
    evenements: (events || []).map(e => ({
      id: e.id,
      titre: e.title,
      date: e.date,
      heure: e.start_time,
      heure_fin: e.end_time,
      type: e.type,
      lieu: e.location,
      description: e.description,
      participants: e.attendees,
      termine: e.completed
    }))
  };
}

// ═══════════════════════════════════════════════════════════════
// agenda_aujourdhui — Evenements du jour
// ═══════════════════════════════════════════════════════════════
async function agenda_aujourdhui(toolInput, tenantId, adminId) {
  if (!adminId) {
    return { success: false, error: 'Session admin non valide' };
  }

  const today = new Date().toISOString().split('T')[0];

  const { data: events, error } = await supabase
    .from('agenda_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('admin_id', adminId)
    .eq('date', today)
    .order('start_time', { ascending: true });

  if (error) throw error;

  return {
    success: true,
    date: today,
    nb_evenements: events?.length || 0,
    evenements: (events || []).map(e => ({
      id: e.id,
      titre: e.title,
      heure: e.start_time,
      heure_fin: e.end_time,
      type: e.type,
      lieu: e.location,
      termine: e.completed
    }))
  };
}

// ═══════════════════════════════════════════════════════════════
// agenda_prochains — Prochains evenements a venir
// ═══════════════════════════════════════════════════════════════
async function agenda_prochains(toolInput, tenantId, adminId) {
  const limit = toolInput.limit || 10;

  if (!adminId) {
    return { success: false, error: 'Session admin non valide' };
  }

  const today = new Date().toISOString().split('T')[0];

  const { data: events, error } = await supabase
    .from('agenda_events')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('admin_id', adminId)
    .gte('date', today)
    .eq('completed', false)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(limit);

  if (error) throw error;

  return {
    success: true,
    nb_evenements: events?.length || 0,
    evenements: (events || []).map(e => ({
      id: e.id,
      titre: e.title,
      date: e.date,
      heure: e.start_time,
      heure_fin: e.end_time,
      type: e.type,
      lieu: e.location,
      participants: e.attendees
    }))
  };
}

// ═══════════════════════════════════════════════════════════════
// agenda_modifier_evenement — Modifier un evenement existant
// ═══════════════════════════════════════════════════════════════
async function agenda_modifier_evenement(toolInput, tenantId, adminId) {
  const { event_id, titre, date, heure, heure_fin, type, lieu, description, participants, completed } = toolInput;

  if (!event_id) {
    return { success: false, error: 'event_id est requis' };
  }
  if (!adminId) {
    return { success: false, error: 'Session admin non valide' };
  }

  const updateData = { updated_at: new Date().toISOString() };
  if (titre !== undefined) updateData.title = titre;
  if (date !== undefined) updateData.date = date;
  if (heure !== undefined) updateData.start_time = heure;
  if (heure_fin !== undefined) updateData.end_time = heure_fin;
  if (type !== undefined) updateData.type = type;
  if (lieu !== undefined) updateData.location = lieu;
  if (description !== undefined) updateData.description = description;
  if (participants !== undefined) updateData.attendees = participants;
  if (completed !== undefined) updateData.completed = completed;

  const { data, error } = await supabase
    .from('agenda_events')
    .update(updateData)
    .eq('id', event_id)
    .eq('tenant_id', tenantId)
    .eq('admin_id', adminId)
    .select()
    .single();

  if (error) throw error;

  return {
    success: true,
    message: 'Evenement modifie',
    evenement: {
      id: data.id,
      titre: data.title,
      date: data.date,
      heure: data.start_time,
      type: data.type
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// agenda_supprimer_evenement — Supprimer un evenement
// ═══════════════════════════════════════════════════════════════
async function agenda_supprimer_evenement(toolInput, tenantId, adminId) {
  const { event_id } = toolInput;

  if (!event_id) {
    return { success: false, error: 'event_id est requis' };
  }
  if (!adminId) {
    return { success: false, error: 'Session admin non valide' };
  }

  const { error } = await supabase
    .from('agenda_events')
    .delete()
    .eq('id', event_id)
    .eq('tenant_id', tenantId)
    .eq('admin_id', adminId);

  if (error) throw error;

  return {
    success: true,
    message: 'Evenement supprime'
  };
}

// ═══════════════════════════════════════════════════════════════
// agenda_marquer_termine — Basculer l'etat termine d'un evenement
// ═══════════════════════════════════════════════════════════════
async function agenda_marquer_termine(toolInput, tenantId, adminId) {
  const { event_id, termine } = toolInput;

  if (!event_id) {
    return { success: false, error: 'event_id est requis' };
  }
  if (!adminId) {
    return { success: false, error: 'Session admin non valide' };
  }

  const { data, error } = await supabase
    .from('agenda_events')
    .update({
      completed: termine !== false,
      updated_at: new Date().toISOString()
    })
    .eq('id', event_id)
    .eq('tenant_id', tenantId)
    .eq('admin_id', adminId)
    .select()
    .single();

  if (error) throw error;

  return {
    success: true,
    message: data.completed ? 'Marque comme termine' : 'Marque comme non termine',
    evenement: {
      id: data.id,
      titre: data.title,
      termine: data.completed
    }
  };
}

export const agendaHandlers = {
  agenda_creer_evenement,
  agenda_lister_evenements,
  agenda_aujourdhui,
  agenda_prochains,
  agenda_modifier_evenement,
  agenda_supprimer_evenement,
  agenda_marquer_termine
};
