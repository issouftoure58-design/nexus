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

/**
 * Vérifier les conflits PAR MEMBRE sur une plage multi-jours avec overlap horaire.
 * Exemple : Marc affecté du 18→23 mai (09:00-18:00) → détecte conflit si Marc
 * est aussi sur une autre presta le 20 mai (22:00-06:00) car les heures se chevauchent pas,
 * mais le 20 mai (10:00-14:00) serait en conflit.
 *
 * @param {object} supabase - client Supabase
 * @param {string} tenantId - ID du tenant (REQUIS - TENANT SHIELD)
 * @param {number} membreId - ID du membre à vérifier
 * @param {string} dateDebut - Date début plage (YYYY-MM-DD)
 * @param {string} dateFin - Date fin plage (YYYY-MM-DD)
 * @param {string} heureDebut - Heure début quotidienne (HH:MM)
 * @param {string} heureFin - Heure fin quotidienne (HH:MM)
 * @param {number|null} excludeResaId - ID réservation à exclure (pour modification)
 * @returns {object} { conflict: false } ou { conflict: true, membre_id, date, existingService, existingHeure, existingResaId }
 */
export async function checkMemberMultiDayConflicts(
  supabase, tenantId, membreId, dateDebut, dateFin,
  heureDebut, heureFin, excludeResaId = null, excludeForfaitPosteId = null
) {
  // TENANT SHIELD: tenant_id est obligatoire
  if (!tenantId) {
    console.error('[MEMBER CONFLICT] ERREUR: tenant_id requis');
    throw new Error('tenant_id requis pour checkMemberMultiDayConflicts');
  }
  if (!membreId || !dateDebut || !heureDebut) {
    return { conflict: false };
  }

  // Si pas de dateFin, c'est single-day → pas notre job
  const effectiveDateFin = dateFin || dateDebut;

  try {
    // ========================================
    // REQUÊTE 1: Réservations directes du membre
    // ========================================
    let query1 = supabase
      .from('reservations')
      .select('id, date, date_depart, heure, heure_fin, duree_minutes, service_nom')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membreId)
      .not('statut', 'in', '("annule","no_show")');

    // Filtrer : date dans la plage OU date_depart chevauche
    // On prend large : date <= effectiveDateFin et (date_depart >= dateDebut OU date >= dateDebut)
    query1 = query1.lte('date', effectiveDateFin).gte('date', dateDebut);

    const { data: directResas, error: err1 } = await query1;

    // Aussi chercher les résas multi-jours qui commencent avant mais finissent pendant notre plage
    const { data: overlapResas, error: err2 } = await supabase
      .from('reservations')
      .select('id, date, date_depart, heure, heure_fin, duree_minutes, service_nom')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membreId)
      .not('statut', 'in', '("annule","no_show")')
      .lt('date', dateDebut)
      .not('date_depart', 'is', null)
      .gte('date_depart', dateDebut);

    if (err1) console.error('[MEMBER CONFLICT] Erreur query1:', err1.message);
    if (err2) console.error('[MEMBER CONFLICT] Erreur query2:', err2.message);

    // ========================================
    // REQUÊTE 2: Lignes de réservation du membre
    // ========================================
    // Lignes avec date dans la plage
    const { data: lignesDirect, error: err3 } = await supabase
      .from('reservation_lignes')
      .select('id, reservation_id, service_nom, heure_debut, heure_fin, duree_minutes, date, date_debut, date_fin, membre_id')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membreId);

    if (err3) console.error('[MEMBER CONFLICT] Erreur query3:', err3.message);

    // ========================================
    // REQUÊTE 2b: Réservations via reservation_membres (table de jointure)
    // ========================================
    let membresResas = [];
    let membresResaLignes = [];
    try {
      const { data: membreLinks, error: errMembres } = await supabase
        .from('reservation_membres')
        .select('reservation_id')
        .eq('tenant_id', tenantId)
        .eq('membre_id', membreId);

      if (errMembres) console.error('[MEMBER CONFLICT] Erreur reservation_membres query:', errMembres.message);
      // Debug: console.log(`[MEMBER CONFLICT] REQUÊTE 2b: ${(membreLinks || []).length} liens reservation_membres`);

      if (membreLinks && membreLinks.length > 0) {
        const membreResaIds = membreLinks.map(mr => mr.reservation_id);
        const { data: resaDetails } = await supabase
          .from('reservations')
          .select('id, date, date_depart, heure, heure_fin, duree_minutes, service_nom')
          .eq('tenant_id', tenantId)
          .in('id', membreResaIds)
          .not('statut', 'in', '("annule","no_show")');
        membresResas = resaDetails || [];

        // Aussi récupérer les lignes de ces résas pour avoir les vraies heures
        const { data: mrl } = await supabase
          .from('reservation_lignes')
          .select('id, reservation_id, service_nom, heure_debut, heure_fin, duree_minutes, date, date_debut, date_fin, membre_id')
          .eq('tenant_id', tenantId)
          .in('reservation_id', membreResaIds);
        membresResaLignes = mrl || [];

        // Debug: console.log(`[MEMBER CONFLICT] REQUÊTE 2b résas valides: ${membresResas.length}, lignes: ${membresResaLignes.length}`);
      }
    } catch (e) {
      console.error('[MEMBER CONFLICT] Erreur reservation_membres:', e.message);
    }

    // ========================================
    // CONSTRUIRE LA MAP DES CRÉNEAUX PAR JOUR
    // ========================================
    // Format: { "2026-05-20": [{ service, heureDebut, heureFin, resaId }] }
    const creneauxParJour = {};

    const addSlot = (jour, service, hDebut, hFin, resaId) => {
      if (!creneauxParJour[jour]) creneauxParJour[jour] = [];
      creneauxParJour[jour].push({ service, heureDebut: hDebut, heureFin: hFin, resaId });
    };

    // Traiter les résas directes (membre_id sur la résa + reservation_membres)
    const directResaIds = new Set([...(directResas || []), ...(overlapResas || [])].map(r => r.id));
    const allDirectResas = [...(directResas || []), ...(overlapResas || [])];
    // Ajouter les résas trouvées via reservation_membres (éviter doublons)
    for (const resa of membresResas) {
      if (!directResaIds.has(resa.id)) {
        allDirectResas.push(resa);
        directResaIds.add(resa.id);
      }
    }
    const resasTraiteesParLignes = new Set(); // IDs de résas dont on a des lignes

    // D'abord traiter les lignes (plus précis que la résa parente)
    const lignesParResa = {};
    (lignesDirect || []).forEach(l => {
      if (!lignesParResa[l.reservation_id]) lignesParResa[l.reservation_id] = [];
      lignesParResa[l.reservation_id].push(l);
    });
    // Enrichir avec les lignes de reservation_membres (REQUÊTE 2b)
    for (const l of membresResaLignes) {
      if (!lignesParResa[l.reservation_id]) lignesParResa[l.reservation_id] = [];
      if (!lignesParResa[l.reservation_id].find(existing => existing.id === l.id)) {
        lignesParResa[l.reservation_id].push(l);
      }
    }

    // Vérifier que les résas parentes des lignes ne sont pas annulées
    const allLigneResaIds = [...new Set([
      ...(lignesDirect || []).map(l => l.reservation_id),
      ...membresResaLignes.map(l => l.reservation_id),
    ])];
    let validResaIds = new Set();
    if (allLigneResaIds.length > 0) {
      const { data: parentResas } = await supabase
        .from('reservations')
        .select('id, statut')
        .eq('tenant_id', tenantId)
        .in('id', allLigneResaIds)
        .not('statut', 'in', '("annule","no_show")');
      validResaIds = new Set((parentResas || []).map(r => r.id));
    }
    // Les résas de reservation_membres sont déjà filtrées par statut
    for (const r of membresResas) {
      validResaIds.add(r.id);
    }

    // Expansion des lignes en créneaux par jour
    let slotsFromLignes = 0;
    for (const [resaIdStr, lignes] of Object.entries(lignesParResa)) {
      const resaId = Number(resaIdStr);
      if (excludeResaId && resaId === Number(excludeResaId)) continue;
      if (!validResaIds.has(resaId)) continue;

      let slotsForResa = 0;

      for (const l of lignes) {
        const lHeureDebut = l.heure_debut || '09:00';
        const lHeureFin = l.heure_fin || null;
        const lService = l.service_nom || 'Prestation';

        // Calculer heure fin si pas fournie
        let effectiveHeureFin = lHeureFin;
        if (!effectiveHeureFin && l.duree_minutes) {
          const startMin = heureToMinutes(lHeureDebut);
          effectiveHeureFin = minutesToHeure(startMin + l.duree_minutes);
        }
        if (!effectiveHeureFin) effectiveHeureFin = minutesToHeure(heureToMinutes(lHeureDebut) + 60);

        // Expansion multi-jours : si la ligne a date_debut/date_fin
        if (l.date_debut && l.date_fin && l.date_fin > l.date_debut) {
          const start = new Date(l.date_debut + 'T00:00:00');
          const end = new Date(l.date_fin + 'T00:00:00');
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const jour = d.toISOString().slice(0, 10);
            if (jour >= dateDebut && jour <= effectiveDateFin) {
              addSlot(jour, lService, lHeureDebut, effectiveHeureFin, resaId);
              slotsForResa++;
            }
          }
        } else {
          const jour = l.date || l.date_debut;
          if (jour && jour >= dateDebut && jour <= effectiveDateFin) {
            addSlot(jour, lService, lHeureDebut, effectiveHeureFin, resaId);
            slotsForResa++;
          }
        }
      }

      // Seulement marquer comme traité par lignes si des slots ont été produits
      if (slotsForResa > 0) {
        resasTraiteesParLignes.add(resaId);
        slotsFromLignes += slotsForResa;
      }
      // Debug: console.log(`[MEMBER CONFLICT] Resa ${resaId}: ${lignes.length} lignes → ${slotsForResa} slots`);
    }

    // Traiter les résas directes (celles pas couvertes par des lignes avec slots)
    for (const resa of allDirectResas) {
      if (excludeResaId && resa.id === Number(excludeResaId)) continue;
      if (resasTraiteesParLignes.has(resa.id)) continue;

      const rHeureDebut = resa.heure || '09:00';
      let rHeureFin = resa.heure_fin;
      if (!rHeureFin && resa.duree_minutes) {
        rHeureFin = minutesToHeure(heureToMinutes(rHeureDebut) + resa.duree_minutes);
      }
      // Fallback: chercher heure_fin dans les lignes de cette résa
      if (!rHeureFin && lignesParResa[resa.id]) {
        const maxFin = lignesParResa[resa.id]
          .filter(l => l.heure_fin)
          .map(l => l.heure_fin)
          .sort()
          .pop();
        if (maxFin) rHeureFin = maxFin;
      }
      // Fallback: chercher duree_minutes dans les lignes
      if (!rHeureFin && lignesParResa[resa.id]) {
        const maxDuree = Math.max(...lignesParResa[resa.id]
          .filter(l => l.duree_minutes)
          .map(l => l.duree_minutes), 0);
        if (maxDuree > 0) rHeureFin = minutesToHeure(heureToMinutes(rHeureDebut) + maxDuree);
      }
      if (!rHeureFin) rHeureFin = minutesToHeure(heureToMinutes(rHeureDebut) + 60);
      // Debug: console.log(`[MEMBER CONFLICT] Direct resa ${resa.id}: ${resa.date} ${rHeureDebut}-${rHeureFin}`);

      const rService = resa.service_nom || 'Prestation';

      // Multi-jours : expand si date_depart
      if (resa.date_depart && resa.date_depart > resa.date) {
        const start = new Date(resa.date + 'T00:00:00');
        const end = new Date(resa.date_depart + 'T00:00:00');
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const jour = d.toISOString().slice(0, 10);
          if (jour >= dateDebut && jour <= effectiveDateFin) {
            addSlot(jour, rService, rHeureDebut, rHeureFin, resa.id);
          }
        }
      } else {
        // Single-day
        if (resa.date >= dateDebut && resa.date <= effectiveDateFin) {
          addSlot(resa.date, rService, rHeureDebut, rHeureFin, resa.id);
        }
      }
    }

    // ========================================
    // REQUÊTE 3: Forfait affectations du membre
    // ========================================
    try {
      let q3 = supabase
        .from('forfait_affectations')
        .select('id, date, heure_debut, heure_fin, poste_id, forfait_postes!poste_id(service_nom)')
        .eq('tenant_id', tenantId)
        .eq('membre_id', membreId)
        .gte('date', dateDebut)
        .lte('date', effectiveDateFin);

      // Exclure les affectations du poste en cours de modification (eviter self-conflict)
      if (excludeForfaitPosteId) {
        q3 = q3.neq('poste_id', excludeForfaitPosteId);
      }

      const { data: forfaitAffs } = await q3;

      for (const fa of (forfaitAffs || [])) {
        const jour = fa.date;
        const service = fa.forfait_postes?.service_nom || 'Forfait';
        addSlot(jour, service, fa.heure_debut, fa.heure_fin, null);
      }
    } catch (e) {
      // forfait_affectations table might not exist yet — skip silently
    }

    // ========================================
    // CHECK PAR JOUR : overlap horaire
    // ========================================
    const joursAvecSlots = Object.keys(creneauxParJour).sort();
    // Debug: console.log(`[MEMBER CONFLICT] Slots construits sur ${joursAvecSlots.length} jours`);

    // Convertir le nouveau créneau en minutes (gérer overnight)
    let newStart = heureToMinutes(heureDebut);
    let newEnd = heureFin ? heureToMinutes(heureFin) : newStart + 60;
    if (newEnd <= newStart) newEnd += 24 * 60; // Overnight

    // Itérer chaque jour de la plage demandée
    const startDate = new Date(dateDebut + 'T00:00:00');
    const endDate = new Date(effectiveDateFin + 'T00:00:00');

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const jour = d.toISOString().slice(0, 10);
      const slots = creneauxParJour[jour];
      if (!slots || slots.length === 0) continue;

      for (const slot of slots) {
        let existStart = heureToMinutes(slot.heureDebut);
        let existEnd = heureToMinutes(slot.heureFin);
        if (existEnd <= existStart) existEnd += 24 * 60; // Overnight

        // Overlap check : newStart < existEnd && newEnd > existStart
        if (newStart < existEnd && newEnd > existStart) {
          console.log(`[MEMBER CONFLICT] ❌ Conflit membre ${membreId} le ${jour} : ${slot.service} (${slot.heureDebut}-${slot.heureFin}) vs ${heureDebut}-${heureFin || '?'}`);
          return {
            conflict: true,
            membre_id: membreId,
            date: jour,
            existingService: slot.service,
            existingHeure: `${slot.heureDebut}-${slot.heureFin}`,
            existingResaId: slot.resaId
          };
        }
      }
    }

    return { conflict: false };
  } catch (err) {
    console.error('[MEMBER CONFLICT] Exception:', err.message);
    return { conflict: false }; // Ne pas bloquer si erreur
  }
}
