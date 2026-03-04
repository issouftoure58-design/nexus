/**
 * Date Handler — get_upcoming_days, parse_date
 * Outils de gestion des dates pour l'admin chat.
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const JOURS_LOWER = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/**
 * Génère un tableau des N prochains jours avec date, jour et date formatée.
 */
async function get_upcoming_days(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const limit = Math.min(toolInput.nb_jours || 14, 60);
    const jours = [];

    for (let i = 0; i < limit; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      jours.push({
        date: d.toISOString().split('T')[0],
        jour: JOURS[d.getDay()],
        dateFormatee: `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`
      });
    }

    return {
      success: true,
      aujourdhui: {
        date: now.toISOString().split('T')[0],
        jour: JOURS[now.getDay()],
        dateFormatee: `${JOURS[now.getDay()]} ${now.getDate()} ${MOIS[now.getMonth()]} ${now.getFullYear()}`
      },
      jours_prochains: jours
    };
  } catch (error) {
    logger.error('[DATE HANDLER] Erreur get_upcoming_days:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

/**
 * Parse un texte de date en langage naturel (français) vers un format ISO.
 * Supporte: aujourd'hui, demain, après-demain, noms de jours.
 */
async function parse_date(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const text = (toolInput.date_text || '').toLowerCase().trim();
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    let targetDate = new Date(now);

    if (text === 'aujourdhui' || text === "aujourd'hui") {
      // aujourd'hui — pas de modification
    } else if (text === 'demain') {
      targetDate.setDate(now.getDate() + 1);
    } else if (text === 'après-demain' || text === 'apres-demain' || text === 'apres demain') {
      targetDate.setDate(now.getDate() + 2);
    } else {
      // Chercher un jour de la semaine
      const cleanText = text.replace(' prochain', '').trim();
      const jourIndex = JOURS_LOWER.indexOf(cleanText);
      if (jourIndex !== -1) {
        const currentDay = now.getDay();
        let daysUntil = jourIndex - currentDay;
        if (daysUntil <= 0) daysUntil += 7;
        targetDate.setDate(now.getDate() + daysUntil);
      }
    }

    return {
      success: true,
      date_iso: targetDate.toISOString().split('T')[0],
      date_formatee: targetDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    };
  } catch (error) {
    logger.error('[DATE HANDLER] Erreur parse_date:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

export const dateHandlers = {
  get_upcoming_days,
  parse_date
};
