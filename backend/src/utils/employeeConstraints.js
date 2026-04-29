/**
 * Contraintes horaires par employé — helper centralisé
 * Gère : pause déjeuner, max heures/jour, gap entre services
 */

const DEFAULTS = {
  pause_debut: '12:00',
  pause_fin: '13:00',
  max_heures_jour: 12,
  pause_min_minutes: 30,        // durée min de la pause déjeuner (ne peut pas descendre en-dessous)
  gap_entre_services_minutes: 10, // pause automatique entre chaque prestation
};

/**
 * Retourne les contraintes effectives d'un membre (valeurs custom ou défauts)
 * @param {Object} membre - ligne rh_membres
 * @returns {Object} contraintes effectives
 */
export function getEffectiveConstraints(membre) {
  const pauseDebut = membre.pause_debut || DEFAULTS.pause_debut;
  const pauseFin = membre.pause_fin || DEFAULTS.pause_fin;
  const maxHeuresJour = membre.max_heures_jour != null ? Number(membre.max_heures_jour) : DEFAULTS.max_heures_jour;
  const pauseMinMinutes = membre.pause_min_minutes != null ? Number(membre.pause_min_minutes) : DEFAULTS.pause_min_minutes;
  const gapEntreServices = membre.gap_entre_services_minutes != null ? Number(membre.gap_entre_services_minutes) : DEFAULTS.gap_entre_services_minutes;

  // Sécurité : la pause déjeuner ne peut pas être < pauseMinMinutes
  const pauseDebutMin = timeToMinutes(pauseDebut);
  const pauseFinMin = timeToMinutes(pauseFin);
  const dureePause = pauseFinMin - pauseDebutMin;
  if (dureePause > 0 && dureePause < pauseMinMinutes) {
    // Étendre automatiquement la fin de pause pour respecter le minimum
    const correctedFinMin = pauseDebutMin + pauseMinMinutes;
    return {
      pauseDebut,
      pauseFin: minutesToTime(correctedFinMin),
      pauseDebutMin,
      pauseFinMin: correctedFinMin,
      maxHeuresJour,
      pauseMinMinutes,
      gapEntreServices,
    };
  }

  return {
    pauseDebut,
    pauseFin,
    pauseDebutMin,
    pauseFinMin,
    maxHeuresJour,
    pauseMinMinutes,
    gapEntreServices,
  };
}

/**
 * Valide qu'un créneau proposé respecte les contraintes d'un employé
 * @param {Object} params
 * @param {Object} params.membre - ligne rh_membres
 * @param {string} params.heure - heure de début du créneau proposé (HH:MM)
 * @param {number} params.dureeMinutes - durée du créneau en minutes
 * @param {Array<{debut: string, fin: string}>} params.creneauxOccupes - créneaux déjà occupés ce jour
 * @returns {{ valid: boolean, error?: string, code?: string }}
 */
export function validateEmployeeConstraints({ membre, heure, dureeMinutes, creneauxOccupes = [] }) {
  const c = getEffectiveConstraints(membre);
  const debutMin = timeToMinutes(heure);
  const finMin = debutMin + dureeMinutes;

  // 1. Pause déjeuner : le créneau ne doit pas chevaucher [pauseDebut, pauseFin]
  // Exception : prestations journée entière (>= 8h) — la pause est implicite
  const isFullDay = dureeMinutes >= 480;
  if (!isFullDay && c.pauseDebutMin < c.pauseFinMin) {
    if (debutMin < c.pauseFinMin && finMin > c.pauseDebutMin) {
      return {
        valid: false,
        error: `Ce créneau chevauche la pause obligatoire (${c.pauseDebut} - ${c.pauseFin}) de ${membre.prenom} ${membre.nom}.`,
        code: 'PAUSE_CONFLICT',
      };
    }
  }

  // 2. Max heures/jour
  const totalOccupeMinutes = creneauxOccupes.reduce((sum, slot) => {
    return sum + (timeToMinutes(slot.fin) - timeToMinutes(slot.debut));
  }, 0);
  const totalAvecNouveau = totalOccupeMinutes + dureeMinutes;
  const maxMinutes = c.maxHeuresJour * 60;

  if (totalAvecNouveau > maxMinutes) {
    const dejaH = (totalOccupeMinutes / 60).toFixed(1);
    return {
      valid: false,
      error: `${membre.prenom} ${membre.nom} a déjà ${dejaH}h de travail ce jour. Ajouter ${dureeMinutes}min dépasserait la limite de ${c.maxHeuresJour}h/jour.`,
      code: 'MAX_HEURES_EXCEEDED',
    };
  }

  // 3. Gap entre services : le nouveau créneau doit respecter le gap minimum
  //    avec chaque créneau existant (pas de collisions ni de services trop rapprochés)
  if (c.gapEntreServices > 0 && creneauxOccupes.length > 0) {
    for (const slot of creneauxOccupes) {
      const slotDebut = timeToMinutes(slot.debut);
      const slotFin = timeToMinutes(slot.fin);

      // Le nouveau créneau commence trop tôt après un existant
      if (debutMin >= slotFin && debutMin < slotFin + c.gapEntreServices) {
        return {
          valid: false,
          error: `${membre.prenom} ${membre.nom} a besoin de ${c.gapEntreServices}min de pause entre deux prestations. Le créneau commence ${debutMin - slotFin}min après le précédent (fin ${slot.fin}).`,
          code: 'GAP_INSUFFICIENT',
        };
      }

      // Le nouveau créneau finit trop près avant un existant
      if (finMin <= slotDebut && slotDebut < finMin + c.gapEntreServices) {
        return {
          valid: false,
          error: `${membre.prenom} ${membre.nom} a besoin de ${c.gapEntreServices}min de pause entre deux prestations. Seulement ${slotDebut - finMin}min avant la prestation suivante (début ${slot.debut}).`,
          code: 'GAP_INSUFFICIENT',
        };
      }

      // Chevauchement pur (déjà couvert normalement mais sécurité)
      if (debutMin < slotFin && finMin > slotDebut) {
        return {
          valid: false,
          error: `Ce créneau chevauche un créneau existant (${slot.debut} - ${slot.fin}) de ${membre.prenom} ${membre.nom}.`,
          code: 'OVERLAP',
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Convertit "HH:MM" en minutes depuis minuit
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Convertit des minutes depuis minuit en "HH:MM"
 */
export function minutesToTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export { DEFAULTS as CONSTRAINT_DEFAULTS };
