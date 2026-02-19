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
 * @param {string|null} tenantId - ID du tenant (isolation multi-tenant)
 * @returns {object} { conflict: boolean, rdv?, suggestions? }
 */
export async function checkConflicts(supabase, date, heure, dureeMinutes, excludeId = null, tenantId = null) {
  try {
  // Récupérer tous les RDV actifs de cette date POUR CE TENANT
  let query = supabase
    .from('reservations')
    .select('id, heure, duree_minutes, service_nom, clients(prenom, nom)')
    .eq('date', date)
    .in('statut', ['demande', 'en_attente', 'en_attente_paiement', 'confirme']);

  // 🔒 TENANT ISOLATION - filtrer par tenant
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data: rdvs, error } = await query;

  if (error) {
    console.error('[CONFLICT CHECK] Erreur query:', error.message);
    return { conflict: false }; // Ne pas bloquer si erreur query
  }

  if (!rdvs || rdvs.length === 0) return { conflict: false };

  const newStart = heureToMinutes(heure);
  const newEnd = newStart + (dureeMinutes || 60);

  for (const rdv of rdvs) {
    if (excludeId && rdv.id === Number(excludeId)) continue;

    const existStart = heureToMinutes(rdv.heure);
    const existDuree = rdv.duree_minutes || 60;
    const existEnd = existStart + existDuree;

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
