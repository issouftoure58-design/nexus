/**
 * DÉTECTION CHEVAUCHEMENTS CENTRALISÉE
 * Vérifie les conflits de durée (pas juste même heure)
 * Utilisé par les routes admin qui ne passent pas par createReservationUnified
 */

function heureToMinutes(heure) {
  const [h, m] = (heure || '00:00').split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToHeure(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function minutesToLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : '00'}`;
}

/**
 * Vérifier les chevauchements pour une date/heure/durée
 * @param {object} supabase - client Supabase
 * @param {string} date - YYYY-MM-DD
 * @param {string} heure - HH:MM
 * @param {number} dureeMinutes - durée du nouveau RDV en minutes
 * @param {number|null} excludeId - ID RDV à exclure (pour modification)
 * @param {string} tenantId - ID du tenant (REQUIS pour isolation multi-tenant)
 * @param {object} options - Options supplémentaires
 * @param {string} options.date_fin - Date de fin pour chantiers multi-jours (YYYY-MM-DD)
 * @param {number[]} options.membre_ids - IDs des membres à vérifier
 * @returns {object} { conflict: boolean, rdv?, suggestions? }
 */
export async function checkConflicts(supabase, date, heure, dureeMinutes, excludeId = null, tenantId, options = {}) {
  // TENANT SHIELD: tenant_id est obligatoire
  if (!tenantId) {
    console.error('[CONFLICT CHECK] ERREUR: tenant_id requis');
    throw new Error('tenant_id requis pour checkConflicts');
  }

  const { date_fin, membre_ids } = options;

  try {
  // Multi-jours : vérifier chevauchement de plage de dates
  if (date_fin && date_fin > date) {
    return checkMultiDayConflicts(supabase, date, date_fin, excludeId, tenantId, membre_ids);
  }

  // Mono-jour : logique existante
  // Récupérer tous les RDV actifs de cette date POUR CE TENANT
  const { data: rdvs, error } = await supabase
    .from('reservations')
    .select('id, heure, heure_fin, duree_minutes, duree_totale_minutes, service_nom, clients(prenom, nom)')
    .eq('tenant_id', tenantId)
    .eq('date', date)
    .in('statut', ['demande', 'en_attente', 'en_attente_paiement', 'confirme']);

  if (error) {
    console.error('[CONFLICT CHECK] Erreur query:', error.message);
    return { conflict: false }; // Ne pas bloquer si erreur query
  }

  if (!rdvs || rdvs.length === 0) return { conflict: false };

  // Récupérer les lignes pour calculer la vraie durée
  const rdvIds = rdvs.filter(r => !excludeId || r.id !== Number(excludeId)).map(r => r.id);
  const { data: allLignes } = rdvIds.length > 0
    ? await supabase
        .from('reservation_lignes')
        .select('reservation_id, heure_debut, heure_fin, duree_minutes')
        .eq('tenant_id', tenantId)
        .in('reservation_id', rdvIds)
    : { data: [] };

  // Grouper les lignes par réservation
  const lignesParRdv = {};
  (allLignes || []).forEach(l => {
    if (!lignesParRdv[l.reservation_id]) lignesParRdv[l.reservation_id] = [];
    lignesParRdv[l.reservation_id].push(l);
  });

  const newStart = heureToMinutes(heure);
  const newEnd = newStart + (dureeMinutes || 60);

  for (const rdv of rdvs) {
    if (excludeId && rdv.id === Number(excludeId)) continue;

    const existStart = heureToMinutes(rdv.heure);
    // Calculer la vraie fin depuis les lignes si dispo
    let existEnd;
    const rdvLignes = lignesParRdv[rdv.id];
    if (rdvLignes && rdvLignes.length > 0) {
      // Prendre la fin la plus tardive des lignes
      let latestEnd = existStart;
      for (const l of rdvLignes) {
        if (l.heure_fin) {
          const fin = heureToMinutes(l.heure_fin);
          if (fin > latestEnd) latestEnd = fin;
        } else if (l.heure_debut && l.duree_minutes) {
          const fin = heureToMinutes(l.heure_debut) + l.duree_minutes;
          if (fin > latestEnd) latestEnd = fin;
        }
      }
      existEnd = latestEnd > existStart ? latestEnd : existStart + (rdv.duree_minutes || 60);
    } else if (rdv.heure_fin) {
      existEnd = heureToMinutes(rdv.heure_fin);
    } else {
      const existDuree = rdv.duree_minutes || 60;
      existEnd = existStart + existDuree;
    }

    // Chevauchement : newStart < existEnd ET newEnd > existStart
    if (newStart < existEnd && newEnd > existStart) {
      const clientName = rdv.clients
        ? `${rdv.clients.prenom || ''} ${rdv.clients.nom || ''}`.trim()
        : 'Client';

      console.log(`[CONFLICT CHECK] ❌ Conflit RDV #${rdv.id} ${clientName} (${rdv.service_nom}) ${rdv.heure}-${minutesToLabel(existEnd)}`);

      // Suggestions
      const suggestions = [];

      // Après le RDV en conflit
      if (existEnd + (dureeMinutes || 60) <= 18 * 60) { // Avant 18h
        suggestions.push({
          heure: minutesToHeure(existEnd),
          label: `Après ${clientName} à ${minutesToLabel(existEnd)}`
        });
      }

      // Avant le RDV en conflit (si assez de place)
      const beforeStart = existStart - (dureeMinutes || 60);
      if (beforeStart >= 9 * 60) { // Après 9h
        suggestions.push({
          heure: minutesToHeure(beforeStart),
          label: `Avant ${clientName} à ${minutesToLabel(beforeStart)}`
        });
      }

      return {
        conflict: true,
        rdv: {
          id: rdv.id,
          client: clientName,
          service: rdv.service_nom,
          heure: rdv.heure,
          fin: minutesToLabel(existEnd)
        },
        suggestions
      };
    }
  }

  return { conflict: false };
  } catch (err) {
    console.error('[CONFLICT CHECK] Exception inattendue:', err.message);
    return { conflict: false }; // Ne pas bloquer si erreur
  }
}

/**
 * Vérifier les chevauchements pour un chantier multi-jours
 * Un chantier [date_debut, date_fin] est en conflit si un RDV existant
 * tombe dans cette plage (même membre ou même date).
 */
async function checkMultiDayConflicts(supabase, dateDebut, dateFin, excludeId, tenantId, membreIds) {
  try {
    // Chercher les réservations qui chevauchent la plage [dateDebut, dateFin]
    // Cas 1: RDV mono-jour dont la date tombe dans la plage
    // Cas 2: RDV multi-jours dont [date, date_fin] chevauche [dateDebut, dateFin]
    const { data: rdvs, error } = await supabase
      .from('reservations')
      .select('id, date, date_fin, heure, duree_minutes, service_nom, clients(prenom, nom)')
      .eq('tenant_id', tenantId)
      .in('statut', ['demande', 'en_attente', 'en_attente_paiement', 'confirme'])
      .gte('date', dateDebut)  // date >= dateDebut (simplifié, voir filtre ci-dessous)
      .lte('date', dateFin);   // date <= dateFin

    if (error) {
      console.error('[CONFLICT CHECK MULTI] Erreur query:', error.message);
      return { conflict: false };
    }

    // Aussi chercher les RDV multi-jours qui commencent avant mais finissent pendant notre plage
    const { data: rdvsOverlap } = await supabase
      .from('reservations')
      .select('id, date, date_fin, heure, duree_minutes, service_nom, clients(prenom, nom)')
      .eq('tenant_id', tenantId)
      .in('statut', ['demande', 'en_attente', 'en_attente_paiement', 'confirme'])
      .lt('date', dateDebut)
      .not('date_fin', 'is', null)
      .gte('date_fin', dateDebut);

    const allRdvs = [...(rdvs || []), ...(rdvsOverlap || [])];
    if (allRdvs.length === 0) return { conflict: false };

    for (const rdv of allRdvs) {
      if (excludeId && rdv.id === Number(excludeId)) continue;

      const clientName = rdv.clients
        ? `${rdv.clients.prenom || ''} ${rdv.clients.nom || ''}`.trim()
        : 'Client';

      const rdvFin = rdv.date_fin || rdv.date;

      console.log(`[CONFLICT CHECK MULTI] ❌ Conflit chantier RDV #${rdv.id} ${clientName} (${rdv.service_nom}) ${rdv.date}-${rdvFin}`);

      return {
        conflict: true,
        rdv: {
          id: rdv.id,
          client: clientName,
          service: rdv.service_nom,
          date: rdv.date,
          date_fin: rdvFin,
          heure: rdv.heure,
        },
        suggestions: []
      };
    }

    return { conflict: false };
  } catch (err) {
    console.error('[CONFLICT CHECK MULTI] Exception:', err.message);
    return { conflict: false };
  }
}
