/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║   SERVICE DE RESERVATION UNIFIE                               [LOCKED]        ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                               ║
 * ║   ⛔ FICHIER VERROUILLE - Ne pas modifier sans autorisation                   ║
 * ║                                                                               ║
 * ║   Utilise par : Agent telephone, Chat Halimah, API booking                    ║
 * ║                                                                               ║
 * ║   Fonctionnalites :                                                           ║
 * ║   - Calcul distance (Google Maps)                                             ║
 * ║   - Calcul frais de deplacement (via TRAVEL_FEES)                             ║
 * ║   - Verification disponibilite (anti-chevauchement)                           ║
 * ║   - Verification horaires (via BUSINESS_HOURS)                                ║
 * ║   - Tarifs services                                                           ║
 * ║   - Creation RDV / Envoi SMS                                                  ║
 * ║                                                                               ║
 * ║   *** NEXUS CORE COMPLIANT ***                                                ║
 * ║   - FRAIS_DEPLACEMENT : derives de TRAVEL_FEES                                ║
 * ║   - HORAIRES : derives de BUSINESS_HOURS                                      ║
 * ║                                                                               ║
 * ║   Voir : backend/NEXUS_LOCK.md                                                ║
 * ║                                                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

import { createClient } from '@supabase/supabase-js';
import dateService from './dateService.js';
import logger from '../config/logger.js';
// *** IMPORT DEPUIS NEXUS CORE - SOURCE UNIQUE DE VERITE ***
import { TRAVEL_FEES, BUSINESS_HOURS } from '../config/businessRules.js';
// Multi-tenant: business info dynamique
import { getBusinessInfoSync, getBusinessInfo } from './tenantBusinessService.js';
// Multi-tenant: services, horaires, regles metier dynamiques
import { getServicesForTenant, findServiceByNameForTenant, getBusinessHoursForTenant } from './tenantBusinessRules.js';
// 🔒 FONCTION UNIQUE DE CRÉATION RDV (import différé pour éviter cycle)
let createReservationUnifiedFn = null;
async function getCreateReservationUnified() {
  if (!createReservationUnifiedFn) {
    const nexusCore = await import('../core/unified/nexusCore.js');
    createReservationUnifiedFn = nexusCore.createReservationUnified;
  }
  return createReservationUnifiedFn;
}

/**
 * Wrapper exporté pour createReservationUnified
 * Permet aux routes d'appeler bookingService.createReservationUnified()
 */
export async function createReservationUnified(data, options = {}) {
  const fn = await getCreateReservationUnified();
  const { channel = 'web', sendSMS = true } = options;
  return fn(data, channel, { sendSMS });
}

// Exporter les fonctions de dates
export const { getTodayInfo, getDateInfo, getJourSemaine, validateDate } = dateService;

// ============================================
// CONFIGURATION
// ============================================

let supabase = null;

function getSupabase() {
  if (!supabase && process.env.SUPABASE_URL) {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
  }
  return supabase;
}

/**
 * Récupère l'adresse de base d'un tenant (pour calcul distance)
 * @param {string} tenantId - ID du tenant (obligatoire)
 * @returns {string|null} Adresse de base ou null si non trouvée
 */
export function getBaseAddress(tenantId) {
  if (!tenantId) {
    logger.warn('getBaseAddress appele sans tenantId', { tag: 'BOOKING' });
    return null;
  }
  try {
    const info = getBusinessInfoSync(tenantId);
    return info.adresse || null;
  } catch (e) {
    logger.warn('getBaseAddress: impossible de charger adresse', { tag: 'BOOKING', tenantId, error: e.message });
    return null;
  }
}

// ============================================
// SERVICES ET TARIFS (CHARGEMENT DYNAMIQUE PAR TENANT)
// Les services sont chargés depuis la DB via tenantBusinessRules.js
// ============================================

// @deprecated - Ne plus utiliser directement. Utiliser getServicesForTenant(tenantId) de tenantBusinessRules.js
export const SERVICES = {};

// @deprecated - Les ambiguités doivent être gérées dynamiquement par tenant
export const SERVICES_AMBIGUS = {};

// ============================================
// BARÈME FRAIS DE DÉPLACEMENT
// *** VALEURS IMPORTÉES DEPUIS businessRules.js ***
// ============================================

export const FRAIS_DEPLACEMENT = {
  FORFAIT_BASE: TRAVEL_FEES.BASE_FEE,
  DISTANCE_FORFAIT: TRAVEL_FEES.BASE_DISTANCE_KM,
  TARIF_KM_EXTRA: TRAVEL_FEES.PER_KM_BEYOND,
  // Fonction de calcul officielle
  calculate: TRAVEL_FEES.calculate
};

// ============================================
// HORAIRES (CHARGEMENT DYNAMIQUE PAR TENANT)
// Utiliser getBusinessHoursForTenant(tenantId) de tenantBusinessRules.js
// ============================================

const JOURS_SEMAINE = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function formatHoraireBooking(schedule) {
  if (!schedule) return { ouvert: false, debut: 0, fin: 0, description: 'Ferme' };
  const debut = parseInt(schedule.open.split(':')[0]);
  const fin = parseInt(schedule.close.split(':')[0]);
  return {
    ouvert: true,
    debut,
    fin,
    description: `${debut}h - ${fin}h`
  };
}

// @deprecated - Utiliser getHorairesForTenant(tenantId) a la place
export const HORAIRES = Object.fromEntries(
  JOURS_SEMAINE.map((jour, index) => [jour, formatHoraireBooking(BUSINESS_HOURS.SCHEDULE[index])])
);

/**
 * Charge les horaires dynamiques pour un tenant
 * @param {string} tenantId - ID du tenant (obligatoire)
 * @returns {Promise<Object>} Horaires formates par jour de semaine
 */
export async function getHorairesForTenant(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');
  try {
    const businessHours = await getBusinessHoursForTenant(tenantId);
    return Object.fromEntries(
      JOURS_SEMAINE.map((jour, index) => {
        const dayHours = businessHours.getHours(index);
        return [jour, dayHours
          ? { ouvert: true, debut: parseInt(dayHours.open.split(':')[0]), fin: parseInt(dayHours.close.split(':')[0]), description: `${parseInt(dayHours.open.split(':')[0])}h - ${parseInt(dayHours.close.split(':')[0])}h` }
          : { ouvert: false, debut: 0, fin: 0, description: 'Ferme' }
        ];
      })
    );
  } catch (e) {
    logger.warn('getHorairesForTenant fallback sur HORAIRES statiques', { tag: 'BOOKING', tenantId, error: e.message });
    return HORAIRES;
  }
}

// ============================================
// INFORMATIONS DU SERVICE (DYNAMIQUE PAR TENANT)
// ============================================

// @deprecated - Ne plus utiliser directement. Utiliser getSalonInfo(tenantId).
export const SALON_INFO = Object.freeze({
  nom: '[DEPRECATED - use getSalonInfo(tenantId)]',
  description: '',
  gerante: '',
  adresseBase: '',
  adresse: '',
  telephone: '',
  whatsapp: '',
  zone: ''
});

/**
 * Recupere les infos business d'un tenant.
 * REMPLACE l'ancien SALON_INFO hardcode.
 *
 * @param {string} tenantId - ID du tenant (obligatoire)
 * @returns {Object} Infos business formatees
 */
export function getSalonInfo(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis pour getSalonInfo');
  try {
    const info = getBusinessInfoSync(tenantId);
    return {
      nom: info.nom,
      description: `${info.businessTypeLabel} - ${info.gerant}`,
      gerante: info.gerant,
      adresseBase: info.adresse || 'Sur demande',
      adresse: info.adresse,
      telephone: info.telephone,
      whatsapp: info.whatsapp,
      zone: info.zone || ''
    };
  } catch (e) {
    logger.warn('getSalonInfo erreur', { tag: 'bookingService', tenantId, error: e.message });
    throw new Error(`Impossible de charger les infos business pour le tenant ${tenantId}: ${e.message}`);
  }
}

// ============================================
// LISTE DES SERVICES (CHARGEMENT DYNAMIQUE PAR TENANT)
// Utiliser getServicesListForTenant(tenantId) a la place
// ============================================

// @deprecated - Ne plus utiliser. Utiliser getServicesListForTenant(tenantId).
export const SERVICES_LIST = [];

/**
 * Charge la liste des services pour un tenant depuis la DB
 * @param {string} tenantId - ID du tenant (obligatoire)
 * @returns {Promise<Array>} Liste des services formatee
 */
export async function getServicesListForTenant(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');
  const services = await getServicesForTenant(tenantId);
  return services.map(s => ({
    nom: s.name || s.nom,
    prix: s.price ?? s.prix ?? 0,
    duree: s.duration ?? s.duree ?? 60,
    dureeTexte: formatDureeTexte(s.duration ?? s.duree ?? 60),
    prixTexte: s.variable_price || s.prixVariable ? `A partir de ${s.price ?? s.prix ?? 0}EUR` : `${s.price ?? s.prix ?? 0}EUR`,
    categorie: s.category || s.categorie || 'general',
    prixVariable: s.variable_price || s.prixVariable || false,
    blocksFullDay: s.blocksFullDay || s.blocks_full_day || false,
    blocksDays: s.blocksDays || s.blocks_days || 1
  }));
}

/**
 * Formate une duree en minutes vers un texte lisible
 */
function formatDureeTexte(minutes) {
  if (!minutes) return '';
  if (minutes >= 480) return 'Journee entiere';
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h${m}min` : `${h}h`;
  }
  return `${minutes}min`;
}

// ============================================
// FRAIS DE DÉPLACEMENT (format affichage)
// *** VALEURS TIRÉES DE TRAVEL_FEES (businessRules.js) ***
// ============================================

export const DEPLACEMENT = {
  baseKm: TRAVEL_FEES.BASE_DISTANCE_KM,
  baseFrais: TRAVEL_FEES.BASE_FEE,
  tarifKm: TRAVEL_FEES.PER_KM_BEYOND,
  description: `${TRAVEL_FEES.BASE_FEE}€ forfait (0-${TRAVEL_FEES.BASE_DISTANCE_KM}km), puis +${TRAVEL_FEES.PER_KM_BEYOND}€/km au-delà`,
  // Exemples générés dynamiquement
  exemples: [
    { distance: 5, frais: TRAVEL_FEES.calculate(5), detail: `5km → ${TRAVEL_FEES.calculate(5)}€ (forfait)` },
    { distance: 12, frais: TRAVEL_FEES.calculate(12), detail: `12km → ${TRAVEL_FEES.BASE_FEE}€ + 4×${TRAVEL_FEES.PER_KM_BEYOND}€ = ${TRAVEL_FEES.calculate(12)}€` },
    { distance: 20, frais: TRAVEL_FEES.calculate(20), detail: `20km → ${TRAVEL_FEES.BASE_FEE}€ + 12×${TRAVEL_FEES.PER_KM_BEYOND}€ = ${TRAVEL_FEES.calculate(20)}€` }
  ],
  calculate: TRAVEL_FEES.calculate
};

// ============================================
// CALCUL DU CRÉNEAU RÉEL (DURÉE + TRAJET + MARGE)
// ============================================

const MARGE_SECURITE_MINUTES = 10; // 10 min entre chaque RDV

/**
 * Convertir minutes en format heure (ex: 830 → "13:50")
 */
function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Convertir heure en minutes (ex: "14:30" → 870, ou 14 → 840)
 */
function timeToMinutes(time) {
  if (typeof time === 'number') return time * 60;

  const parts = String(time).replace('h', ':').split(':');
  const hours = parseInt(parts[0]) || 0;
  const mins = parseInt(parts[1]) || 0;
  return hours * 60 + mins;
}

/**
 * Calculer le créneau réellement bloqué pour un RDV
 * @param {number} heureRdv - Heure du RDV (ex: 14)
 * @param {number} dureeMinutes - Durée de la prestation en minutes
 * @param {number} tempsTrajetMinutes - Temps de trajet en minutes (aller simple)
 * @returns {Object} { heureDebutReelle, heureFinReelle, dureeBloqueeMinutes }
 */
export function calculateRealSlot(heureRdv, dureeMinutes, tempsTrajetMinutes = 0) {
  // Heure de début réelle = heure RDV - temps trajet aller
  const heureDebutMinutes = (heureRdv * 60) - tempsTrajetMinutes;

  // Heure de fin réelle = heure RDV + durée + temps trajet retour + marge
  const heureFinMinutes = (heureRdv * 60) + dureeMinutes + tempsTrajetMinutes + MARGE_SECURITE_MINUTES;

  // Durée totale bloquée
  const dureeBloqueeMinutes = heureFinMinutes - heureDebutMinutes;

  return {
    heureDebutReelle: minutesToTime(heureDebutMinutes),
    heureFinReelle: minutesToTime(heureFinMinutes),
    heureDebutMinutes,
    heureFinMinutes,
    dureeBloqueeMinutes
  };
}

// ============================================
// FONCTIONS UTILITAIRES
// ============================================

/**
 * Convertir un jour (lundi, mardi...) en date réelle
 */
export function parseJourToDate(jour) {
  if (!jour) return null;

  const joursMap = {
    'dimanche': 0, 'lundi': 1, 'mardi': 2, 'mercredi': 3,
    'jeudi': 4, 'vendredi': 5, 'samedi': 6
  };

  const jourLower = jour.toLowerCase().trim();
  const aujourdhui = new Date();

  // Si c'est "aujourd'hui" ou "demain"
  if (jourLower.includes('aujourd')) {
    return aujourdhui.toISOString().split('T')[0];
  }
  if (jourLower.includes('demain')) {
    const demain = new Date(aujourdhui);
    demain.setDate(demain.getDate() + 1);
    return demain.toISOString().split('T')[0];
  }

  // Trouver le jour de la semaine
  let targetDay = null;
  for (const [nomJour, numJour] of Object.entries(joursMap)) {
    if (jourLower.includes(nomJour)) {
      targetDay = numJour;
      break;
    }
  }

  if (targetDay === null) {
    // Si c'est déjà une date (2025-01-20)
    if (/^\d{4}-\d{2}-\d{2}$/.test(jourLower)) {
      return jourLower;
    }
    return aujourdhui.toISOString().split('T')[0];
  }

  // Calculer le prochain jour correspondant
  const jourActuel = aujourdhui.getDay();
  let daysToAdd = targetDay - jourActuel;
  if (daysToAdd <= 0) daysToAdd += 7;

  const targetDate = new Date(aujourdhui);
  targetDate.setDate(aujourdhui.getDate() + daysToAdd);

  return targetDate.toISOString().split('T')[0];
}

/**
 * Formater une date en texte lisible
 */
export function formatDateToText(dateStr) {
  if (!dateStr) return 'Date non définie';

  const date = new Date(dateStr + 'T12:00:00');
  const options = { weekday: 'long', day: 'numeric', month: 'long' };
  return date.toLocaleDateString('fr-FR', options);
}

/**
 * Obtenir le nom du jour à partir d'une date
 */
export function getJourFromDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr + 'T12:00:00');
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return jours[date.getDay()];
}

// ============================================
// CALCUL DISTANCE (GOOGLE MAPS)
// ============================================

/**
 * Calculer la distance entre le tenant et l'adresse client
 * @param {string} clientAddress - Adresse complète du client
 * @param {string} tenantId - ID du tenant (obligatoire pour résoudre l'adresse d'origine)
 * @returns {Object} { distance, distanceText, duree, dureeText, error }
 */
export async function calculateDistance(clientAddress, tenantId) {
  console.log('[BOOKING] Calcul distance vers:', clientAddress);

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    logger.warn('GOOGLE_MAPS_API_KEY manquante', { tag: 'BOOKING' });
    return {
      distance: null,
      distanceText: 'Non calculée',
      duree: null,
      dureeText: 'Non calculée',
      error: 'Clé Google Maps non configurée'
    };
  }

  if (!clientAddress || clientAddress.length < 5) {
    return {
      distance: null,
      error: 'Adresse invalide'
    };
  }

  const originAddress = getBaseAddress(tenantId);
  if (!originAddress) {
    logger.warn('Adresse tenant non configurée', { tag: 'BOOKING', tenantId });
    return {
      distance: null,
      error: 'Adresse du professionnel non configurée'
    };
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?` +
      `origins=${encodeURIComponent(originAddress)}` +
      `&destinations=${encodeURIComponent(clientAddress)}` +
      `&mode=driving&language=fr&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('[BOOKING] Erreur Google Maps:', data.status, data.error_message);
      return { distance: null, error: `Erreur Google: ${data.status}` };
    }

    const element = data.rows[0]?.elements[0];

    if (!element || element.status !== 'OK') {
      logger.warn('Adresse non trouvée', { tag: 'BOOKING', clientAddress });
      return { distance: null, error: 'Adresse non trouvée' };
    }

    const distanceKm = element.distance.value / 1000;
    const dureeMinutes = Math.round(element.duration.value / 60);

    console.log(`[BOOKING] ✅ Distance: ${distanceKm.toFixed(1)}km, ${dureeMinutes}min`);

    return {
      distance: Math.round(distanceKm * 10) / 10,
      distanceText: element.distance.text,
      duree: dureeMinutes,
      dureeText: element.duration.text,
      error: null
    };

  } catch (error) {
    console.error('[BOOKING] Erreur calcul distance:', error.message);
    return { distance: null, error: error.message };
  }
}

// ============================================
// CALCUL FRAIS DE DÉPLACEMENT
// ⚠️ FORMULE OFFICIELLE : 10€ forfait 0-8km, +1,10€/km au-delà
// ============================================

/**
 * Calculer les frais de déplacement selon la distance
 * FORMULE : 10€ forfait (0-8km), puis +1,10€/km au-delà
 *
 * Exemples :
 * - 5km → 10€
 * - 12km → 10€ + (12-8)×1,10€ = 10€ + 4,40€ = 14,40€
 * - 20km → 10€ + (20-8)×1,10€ = 10€ + 13,20€ = 23,20€
 *
 * @param {number} distanceKm - Distance en kilomètres
 * @returns {Object} { frais, description, detail }
 */
export function calculateTravelFee(distanceKm) {
  if (!distanceKm || distanceKm <= 0) {
    return {
      frais: FRAIS_DEPLACEMENT.FORFAIT_BASE,
      description: 'Forfait minimum',
      detail: `${FRAIS_DEPLACEMENT.FORFAIT_BASE}€ (forfait)`
    };
  }

  const { FORFAIT_BASE, DISTANCE_FORFAIT, TARIF_KM_EXTRA } = FRAIS_DEPLACEMENT;

  if (distanceKm <= DISTANCE_FORFAIT) {
    // Dans le forfait (0-8km)
    console.log(`[BOOKING] Frais déplacement: ${FORFAIT_BASE}€ pour ${distanceKm}km (forfait)`);
    return {
      frais: FORFAIT_BASE,
      description: `Forfait 0-${DISTANCE_FORFAIT}km`,
      detail: `${distanceKm}km → ${FORFAIT_BASE}€ (forfait)`
    };
  }

  // Au-delà du forfait : 10€ + (distance - 8) × 1,10€
  const kmExtra = distanceKm - DISTANCE_FORFAIT;
  const fraisExtra = kmExtra * TARIF_KM_EXTRA;
  const fraisTotal = Math.round((FORFAIT_BASE + fraisExtra) * 100) / 100; // Arrondi à 2 décimales

  console.log(`[BOOKING] Frais déplacement: ${fraisTotal}€ pour ${distanceKm}km (${FORFAIT_BASE}€ + ${kmExtra}×${TARIF_KM_EXTRA}€)`);

  return {
    frais: fraisTotal,
    description: `${FORFAIT_BASE}€ + ${kmExtra}km × ${TARIF_KM_EXTRA}€`,
    detail: `${distanceKm}km → ${FORFAIT_BASE}€ + ${kmExtra}×${TARIF_KM_EXTRA}€ = ${fraisTotal}€`
  };
}

// ============================================
// OBTENIR TARIF SERVICE
// ⚠️ RETOURNE AUSSI LES RÈGLES DE BLOCAGE
// ============================================

/**
 * Verifier si un terme de service est ambigu (necessite precision)
 * @param {string} serviceName - Nom du service
 * @returns {Object|null} - Message de clarification ou null
 * @deprecated - Les ambiguites sont gerees dynamiquement par le moteur IA
 */
export function checkServiceAmbiguity(serviceName) {
  if (!serviceName) return null;
  // Les ambiguites sont desormais gerees par le moteur IA du tenant
  return null;
}

/**
 * @deprecated - Utiliser getServiceInfoForTenant(tenantId, serviceName) pour le multi-tenant
 * Version synchrone conservee pour retrocompatibilite interne (calcul de creneaux).
 * Retourne null car les services hardcodes ont ete supprimes.
 * Les appelants internes utilisent deja un fallback (|| 120 minutes).
 */
export function getServiceInfo(serviceName) {
  if (!serviceName) return null;
  // Les services hardcodes ont ete supprimes. Cette fonction synchrone
  // ne peut plus resoudre les services. Les appelants internes doivent
  // utiliser duree_minutes stockee en DB ou getServiceInfoForTenant().
  return null;
}

/**
 * Obtenir les informations completes d'un service pour un tenant (async)
 * @param {string} tenantId - ID du tenant (obligatoire)
 * @param {string} serviceName - Nom du service
 * @returns {Promise<Object|null>} { nom, prix, duree, categorie, prixVariable, blocksFullDay, blocksDays }
 */
export async function getServiceInfoForTenant(tenantId, serviceName) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!serviceName) return null;

  const service = await findServiceByNameForTenant(tenantId, serviceName);
  if (!service) {
    logger.warn('Service non reconnu pour tenant', { tag: 'BOOKING', tenantId, serviceName });
    return null;
  }

  return {
    nom: service.name || service.nom,
    prix: service.price ?? service.prix ?? 0,
    duree: service.duration ?? service.duree ?? 60,
    categorie: service.category || service.categorie || 'general',
    prixVariable: service.variable_price || service.prixVariable || false,
    blocksFullDay: service.blocksFullDay || service.blocks_full_day || false,
    blocksDays: service.blocksDays || service.blocks_days || 1
  };
}

// ============================================
// VÉRIFICATION DISPONIBILITÉ STRICTE
// ⚠️ RÈGLES MÉTIER INVIOLABLES
// ============================================

/**
 * Ajouter N jours à une date ISO
 */
function addDaysToDate(dateISO, days) {
  const date = new Date(dateISO + 'T12:00:00');
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/**
 * Formater une date pour l'affichage
 */
function formatDateFr(dateISO) {
  const date = new Date(dateISO + 'T12:00:00');
  const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  return `${jours[date.getDay()]} ${date.getDate()} ${mois[date.getMonth()]}`;
}

/**
 * Vérification STRICTE de disponibilité avec règles métier
 * ⚠️ GÈRE : journée entière, 2 jours consécutifs, chevauchements
 *
 * @param {string} tenantId - ID du tenant (obligatoire)
 * @param {string} dateISO - Date au format YYYY-MM-DD
 * @param {string} serviceNom - Nom du service
 * @param {Array} existingBookings - RDV existants ce jour (optionnel, sera récupéré si non fourni)
 * @returns {Object} { available, slots, message, blocksFullDay, blocksDays }
 */
export async function checkStrictAvailability(tenantId, dateISO, serviceNom, existingBookings = null) {
  if (!tenantId) throw new Error('tenant_id requis');

  console.log(`[BOOKING] === VERIFICATION STRICTE: ${serviceNom} le ${dateISO} ===`);

  // 1. Obtenir les infos du service (dynamique par tenant)
  const service = await getServiceInfoForTenant(tenantId, serviceNom);

  if (!service) {
    return {
      available: false,
      slots: [],
      message: `Service "${serviceNom}" non reconnu.`
    };
  }

  // 2. Récupérer les RDV existants si non fournis
  if (!existingBookings) {
    const db = getSupabase();
    if (db) {
      const { data } = await db
        .from('reservations')
        .select('id, heure, service_nom, duree_minutes')
        .eq('tenant_id', tenantId)
        .eq('date', dateISO)
        .in('statut', ['demande', 'confirme']);
      existingBookings = data || [];
    } else {
      existingBookings = [];
    }
  }

  console.log(`[BOOKING] Service: ${service.nom}, blocksFullDay: ${service.blocksFullDay}, blocksDays: ${service.blocksDays}`);
  console.log(`[BOOKING] ${existingBookings.length} RDV existants ce jour`);

  // 3. Si le service BLOQUE LA JOURNÉE ENTIÈRE
  if (service.blocksFullDay) {
    // Vérifier si la journée est déjà prise
    if (existingBookings.length > 0) {
      return {
        available: false,
        slots: [],
        blocksFullDay: true,
        blocksDays: service.blocksDays,
        message: `❌ Le ${formatDateFr(dateISO)} est déjà occupé. La ${service.nom} nécessite la journée entière (${service.duree / 60}h). Veuillez choisir un autre jour.`
      };
    }

    // 4. Si service multi-jours (ex: 2 jours consecutifs), verifier le lendemain
    if (service.blocksDays === 2) {
      const nextDay = addDaysToDate(dateISO, 1);

      // Verifier que le lendemain n'est pas un dimanche
      const nextDayObj = new Date(nextDay);
      if (nextDayObj.getDay() === 0) {
        return {
          available: false,
          slots: [],
          blocksFullDay: true,
          blocksDays: 2,
          message: `${service.nom} necessite ${service.blocksDays} jours consecutifs. Le ${formatDateFr(dateISO)} + lendemain tombe sur un dimanche (ferme). Choisissez un autre jour.`
        };
      }

      // Recuperer les RDV du lendemain
      const db = getSupabase();
      let nextDayBookings = [];
      if (db) {
        const { data } = await db
          .from('reservations')
          .select('id, heure, service_nom')
          .eq('tenant_id', tenantId)
          .eq('date', nextDay)
          .in('statut', ['demande', 'confirme']);
        nextDayBookings = data || [];
      }

      if (nextDayBookings.length > 0) {
        return {
          available: false,
          slots: [],
          blocksFullDay: true,
          blocksDays: 2,
          message: `${service.nom} necessite ${service.blocksDays} jours consecutifs. Le lendemain (${formatDateFr(nextDay)}) est deja pris. Veuillez choisir d'autres dates.`
        };
      }

      // Les 2 jours sont libres !
      const prixTexte = service.prixVariable ? `a partir de ${service.prix}EUR` : `${service.prix}EUR`;
      return {
        available: true,
        slots: ["09:00"],
        blocksFullDay: true,
        blocksDays: 2,
        dates: [dateISO, nextDay],
        message: `Disponible ! ${service.nom} prend ${service.blocksDays} jours consecutifs.\n${formatDateFr(dateISO)} et ${formatDateFr(nextDay)}, RDV a 9h les deux jours.\n${prixTexte}`
      };
    }

    // Service journée entière (1 jour)
    const prixTexte = service.prixVariable ? `à partir de ${service.prix}€` : `${service.prix}€`;
    return {
      available: true,
      slots: ["09:00"],
      blocksFullDay: true,
      blocksDays: 1,
      message: `✅ Disponible ! La ${service.nom} prend la journée entière (${service.duree / 60}h).\n📅 ${formatDateFr(dateISO)} à 9h.\n💰 ${prixTexte}`
    };
  }

  // 5. SERVICE NORMAL : calculer les creneaux disponibles
  const jourSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const dayOfWeek = new Date(dateISO + 'T12:00:00').getDay();
  const jourNom = jourSemaine[dayOfWeek];
  // Charger les horaires dynamiques du tenant
  const horaires = await getHorairesForTenant(tenantId);
  const horaire = horaires[jourNom];

  if (!horaire || !horaire.ouvert) {
    return {
      available: false,
      slots: [],
      message: `Ferme le ${jourNom}. Veuillez choisir un autre jour.`
    };
  }

  const OUVERTURE_MINUTES = horaire.debut * 60;
  const FERMETURE_MINUTES = horaire.fin * 60;

  // Convertir les RDV existants en plages occupées
  const plagesOccupees = existingBookings.map(rdv => {
    const heureNum = parseInt(String(rdv.heure).replace(/[^0-9]/g, ''));
    const dureeRdv = rdv.duree_minutes || 120; // duree_minutes stockee en DB, fallback 2h
    return {
      debut: heureNum * 60,
      fin: heureNum * 60 + dureeRdv
    };
  }).sort((a, b) => a.debut - b.debut);

  // Trouver les créneaux disponibles
  const slotsDisponibles = [];
  const dureeService = service.duree;

  for (let heureMinutes = OUVERTURE_MINUTES; heureMinutes < FERMETURE_MINUTES; heureMinutes += 60) {
    const finService = heureMinutes + dureeService;

    // Vérifier que le service peut finir avant la fermeture
    if (finService > FERMETURE_MINUTES) continue;

    // Vérifier les chevauchements
    let conflit = false;
    for (const plage of plagesOccupees) {
      if (heureMinutes < plage.fin && finService > plage.debut) {
        conflit = true;
        break;
      }
    }

    if (!conflit) {
      const heureStr = `${Math.floor(heureMinutes / 60).toString().padStart(2, '0')}:00`;
      slotsDisponibles.push(heureStr);
    }
  }

  const prixTexte = service.prixVariable ? `à partir de ${service.prix}€` : `${service.prix}€`;

  if (slotsDisponibles.length === 0) {
    return {
      available: false,
      slots: [],
      message: `❌ Aucun créneau disponible le ${formatDateFr(dateISO)} pour ${service.nom} (${service.duree / 60}h). Essayez un autre jour.`
    };
  }

  return {
    available: true,
    slots: slotsDisponibles,
    message: `✅ ${slotsDisponibles.length} créneaux disponibles le ${formatDateFr(dateISO)} pour ${service.nom}.\n⏱️ Durée : ${service.duree >= 60 ? (service.duree / 60) + 'h' : service.duree + 'min'}\n💰 ${prixTexte}`
  };
}

// ============================================
// VÉRIFICATION HORAIRES
// ============================================

/**
 * Verifier si un creneau est dans les horaires du tenant
 * @param {string} jour - Jour de la semaine (lundi, mardi...)
 * @param {string|number} heure - Heure (14, "14h", "14:00")
 * @param {string} tenantId - ID du tenant (optionnel pour retrocompatibilite, utilise HORAIRES statiques si absent)
 * @returns {Object} { ok, message }
 */
export function checkHoraires(jour, heure, tenantId) {
  if (!jour) {
    return { ok: false, message: 'Jour non specifie' };
  }

  const jourLower = jour.toLowerCase().trim();

  // Trouver le jour dans HORAIRES (statiques en sync, dynamiques via checkHorairesAsync)
  let horaire = null;
  let jourTrouve = null;
  for (const [nomJour, h] of Object.entries(HORAIRES)) {
    if (jourLower.includes(nomJour)) {
      horaire = h;
      jourTrouve = nomJour;
      break;
    }
  }

  if (!horaire) {
    return { ok: false, message: 'Jour non reconnu' };
  }

  if (!horaire.ouvert) {
    return {
      ok: false,
      message: `Ferme le ${jourTrouve || 'dimanche'}. Quel autre jour vous conviendrait ?`
    };
  }

  // Extraire l'heure numerique
  let heureNum = parseInt(String(heure).replace(/[^0-9]/g, ''));

  if (isNaN(heureNum) || heureNum < 0 || heureNum > 23) {
    return { ok: false, message: 'Heure non valide' };
  }

  if (heureNum < horaire.debut) {
    return {
      ok: false,
      message: `Le ${jourTrouve}, ouverture a ${horaire.debut}h. Vous preferez ${horaire.debut}h ou plus tard ?`
    };
  }

  if (heureNum >= horaire.fin) {
    return {
      ok: false,
      message: `Le ${jourTrouve}, fermeture a ${horaire.fin}h. Vous preferez une heure plus tot ?`
    };
  }

  return { ok: true, message: 'Créneau valide' };
}

// ============================================
// VÉRIFICATION HORAIRES AVEC DURÉE COMPLÈTE
// ============================================

/**
 * Verifier si un RDV peut FINIR avant la fermeture
 * Prend en compte : duree de la prestation + temps de trajet aller/retour + marge
 * @param {string} jour - Jour de la semaine
 * @param {number} heureRdv - Heure du RDV
 * @param {number} dureeMinutes - Duree de la prestation
 * @param {number} tempsTrajetMinutes - Temps de trajet (aller simple)
 * @returns {Object} { ok, message, heureFinReelle }
 */
export function checkHorairesComplet(jour, heureRdv, dureeMinutes, tempsTrajetMinutes = 0) {
  if (!jour) {
    return { ok: false, message: 'Jour non specifie' };
  }

  const jourLower = jour.toLowerCase().trim();

  // Trouver les horaires du jour
  let horaire = null;
  let jourTrouve = null;
  for (const [nomJour, h] of Object.entries(HORAIRES)) {
    if (jourLower.includes(nomJour)) {
      horaire = { ...h };
      jourTrouve = nomJour;
      break;
    }
  }

  if (!horaire) {
    return { ok: false, message: 'Jour non reconnu' };
  }

  if (!horaire.ouvert) {
    return {
      ok: false,
      message: `Ferme le ${jourTrouve || 'dimanche'}. Quel autre jour vous conviendrait ?`
    };
  }

  const heureNum = parseInt(String(heureRdv).replace(/[^0-9]/g, ''));

  // Calculer le creneau reel
  const slot = calculateRealSlot(heureNum, dureeMinutes, tempsTrajetMinutes);

  console.log(`[BOOKING] Verification horaires complete:`);
  console.log(`[BOOKING]   Jour: ${jourTrouve}, Heure RDV: ${heureNum}h`);
  console.log(`[BOOKING]   Duree: ${dureeMinutes}min, Trajet: ${tempsTrajetMinutes}min`);
  console.log(`[BOOKING]   Creneau reel: ${slot.heureDebutReelle} -> ${slot.heureFinReelle}`);

  // Verifier le depart a temps (heure debut reelle >= ouverture)
  const ouvertureMinutes = horaire.debut * 60;
  if (slot.heureDebutMinutes < ouvertureMinutes) {
    const heureMinPossible = Math.ceil((ouvertureMinutes + tempsTrajetMinutes) / 60);
    return {
      ok: false,
      message: `Le ${jourTrouve}, ouverture a ${horaire.debut}h. Avec le trajet, le plus tot possible serait ${heureMinPossible}h.`
    };
  }

  // Verifier le retour avant la fermeture (heure fin reelle <= fermeture)
  const fermetureMinutes = horaire.fin * 60;
  if (slot.heureFinMinutes > fermetureMinutes) {
    const heureMaxPossible = Math.floor((fermetureMinutes - dureeMinutes - tempsTrajetMinutes - MARGE_SECURITE_MINUTES) / 60);

    const dureeHeures = Math.round(dureeMinutes / 60 * 10) / 10;
    return {
      ok: false,
      message: `Le ${jourTrouve}, fermeture a ${horaire.fin}h. Avec la duree de ${dureeHeures}h et le trajet, il faudrait commencer au plus tard a ${heureMaxPossible}h.`
    };
  }

  return {
    ok: true,
    message: 'Creneau valide',
    slot
  };
}

// ============================================
// VÉRIFICATION DISPONIBILITÉ (ANTI-CHEVAUCHEMENT)
// ============================================

/**
 * Vérifier si un créneau est disponible (pas de chevauchement)
 * @param {string} tenantId - ID du tenant (obligatoire)
 * @param {string} dateRdv - Date au format YYYY-MM-DD
 * @param {string|number} heureRdv - Heure de début
 * @param {number} dureeMinutes - Durée du service en minutes
 * @returns {Object} { available, conflits, suggestion }
 */
export async function checkAvailability(tenantId, dateRdv, heureRdv, dureeMinutes = 120) {
  if (!tenantId) throw new Error('tenant_id requis');

  console.log(`[BOOKING] Vérification disponibilité: ${dateRdv} ${heureRdv}h (${dureeMinutes}min)`);

  if (!dateRdv) {
    return { available: true, conflits: [], message: 'Date non spécifiée' };
  }

  const db = getSupabase();
  if (!db) {
    logger.warn('Supabase non configuré', { tag: 'BOOKING' });
    return { available: true, conflits: [], message: 'Base de données non configurée' };
  }

  try {
    // Récupérer les RDV du jour (table reservations)
    const { data: rdvsJour, error } = await db
      .from('reservations')
      .select('id, heure, service_nom, duree_minutes, notes')
      .eq('tenant_id', tenantId)
      .eq('date', dateRdv)
      .in('statut', ['demande', 'confirme']);

    if (error) {
      console.error('[BOOKING] Erreur requete disponibilite:', error);
      return { available: true, conflits: [], message: 'Erreur vérification' };
    }

    if (!rdvsJour || rdvsJour.length === 0) {
      console.log('[BOOKING] ✅ Aucun RDV ce jour, créneau libre');
      return { available: true, conflits: [], message: 'Créneau disponible' };
    }

    console.log(`[BOOKING] ${rdvsJour.length} RDV trouvés ce jour`);

    // Extraire l'heure demandée
    const heureDemandeNum = parseInt(String(heureRdv).replace(/[^0-9]/g, ''));
    const finDemande = heureDemandeNum + Math.ceil(dureeMinutes / 60);

    // Vérifier les chevauchements
    const conflits = [];

    for (const rdv of rdvsJour) {
      const heureRdvNum = parseInt(String(rdv.heure).replace(/[^0-9]/g, ''));

      // Duree du RDV existant (stockee en DB, fallback 2h)
      const dureeExistant = rdv.duree_minutes ? Math.ceil(rdv.duree_minutes / 60) : 2;
      const finExistant = heureRdvNum + dureeExistant;

      // Vérifier chevauchement
      // Chevauchement si : debut1 < fin2 ET debut2 < fin1
      if (heureDemandeNum < finExistant && heureRdvNum < finDemande) {
        console.log(`[BOOKING] ❌ Conflit avec RDV ${rdv.id}: ${heureRdvNum}h-${finExistant}h`);
        conflits.push({
          id: rdv.id,
          heure: rdv.heure,
          service: rdv.service_nom,
          fin: `${finExistant}h`
        });
      }
    }

    if (conflits.length > 0) {
      // Trouver une suggestion d'heure alternative
      const suggestion = findNextAvailableSlot(rdvsJour, heureDemandeNum, dureeMinutes);

      return {
        available: false,
        conflits,
        message: `Ce créneau est déjà pris. ${suggestion}`,
        suggestion
      };
    }

    console.log('[BOOKING] ✅ Créneau disponible');
    return { available: true, conflits: [], message: 'Créneau disponible' };

  } catch (error) {
    console.error('[BOOKING] Erreur checkAvailability:', error);
    return { available: true, conflits: [], message: 'Erreur vérification' };
  }
}

/**
 * Trouver le prochain créneau disponible
 */
function findNextAvailableSlot(rdvsJour, heureVoulue, dureeMinutes) {
  // Creer une liste des heures occupees
  const heuresOccupees = rdvsJour.map(rdv => {
    const h = parseInt(String(rdv.heure).replace(/[^0-9]/g, ''));
    const duree = rdv.duree_minutes ? Math.ceil(rdv.duree_minutes / 60) : 2;
    return { debut: h, fin: h + duree };
  }).sort((a, b) => a.debut - b.debut);

  // Chercher un créneau libre après l'heure voulue
  for (let h = heureVoulue; h <= 18; h++) {
    let libre = true;
    const finProposee = h + Math.ceil(dureeMinutes / 60);

    for (const occ of heuresOccupees) {
      if (h < occ.fin && occ.debut < finProposee) {
        libre = false;
        break;
      }
    }

    if (libre) {
      return `${h}h serait disponible.`;
    }
  }

  return 'Aucun créneau disponible ce jour.';
}

// ============================================
// VÉRIFICATION DISPONIBILITÉ AVEC CRÉNEAUX RÉELS
// ============================================

/**
 * Vérifier si un créneau est disponible (pas de chevauchement RÉEL)
 * Prend en compte la durée + trajet + marge de TOUS les RDV
 *
 * @param {string} tenantId - ID du tenant (obligatoire)
 * @param {string} dateRdv - Date au format YYYY-MM-DD
 * @param {number} heureRdv - Heure de début du RDV
 * @param {number} dureeMinutes - Durée de la prestation
 * @param {number} tempsTrajetMinutes - Temps de trajet (aller simple)
 * @returns {Object} { available, conflits, suggestion }
 */
export async function checkAvailabilityComplete(tenantId, dateRdv, heureRdv, dureeMinutes = 120, tempsTrajetMinutes = 0) {
  if (!tenantId) throw new Error('tenant_id requis');

  console.log(`[BOOKING] Vérification disponibilité COMPLÈTE:`);
  console.log(`[BOOKING]   Date: ${dateRdv}, Heure: ${heureRdv}h`);
  console.log(`[BOOKING]   Durée: ${dureeMinutes}min, Trajet: ${tempsTrajetMinutes}min`);

  if (!dateRdv) {
    return { available: true, conflits: [], message: 'Date non spécifiée' };
  }

  const db = getSupabase();
  if (!db) {
    logger.warn('Supabase non configuré', { tag: 'BOOKING' });
    return { available: true, conflits: [], message: 'Base de données non configurée' };
  }

  // Calculer le créneau réel du nouveau RDV
  const heureNum = parseInt(String(heureRdv).replace(/[^0-9]/g, ''));
  const nouveauSlot = calculateRealSlot(heureNum, dureeMinutes, tempsTrajetMinutes);

  console.log(`[BOOKING]   Créneau réel demandé: ${nouveauSlot.heureDebutReelle} → ${nouveauSlot.heureFinReelle}`);

  try {
    // Récupérer les RDV du jour avec leurs infos complètes
    const { data: rdvsJour, error } = await db
      .from('reservations')
      .select('id, heure, service_nom, duree_minutes, notes, distance_km')
      .eq('tenant_id', tenantId)
      .eq('date', dateRdv)
      .in('statut', ['demande', 'confirme']);

    if (error) {
      console.error('[BOOKING] Erreur requete disponibilite:', error);
      return { available: true, conflits: [], message: 'Erreur vérification' };
    }

    if (!rdvsJour || rdvsJour.length === 0) {
      console.log('[BOOKING] ✅ Aucun RDV ce jour, créneau libre');
      return { available: true, conflits: [], message: 'Créneau disponible', slot: nouveauSlot };
    }

    console.log(`[BOOKING] ${rdvsJour.length} RDV existants ce jour`);

    // Vérifier les chevauchements avec les créneaux RÉELS
    const conflits = [];

    for (const rdv of rdvsJour) {
      // Récupérer les infos du RDV existant
      const heureRdvExistant = parseInt(String(rdv.heure).replace(/[^0-9]/g, ''));

      // Duree du RDV existant (duree_minutes stockee en DB, fallback 2h)
      const dureeExistant = rdv.duree_minutes || 120;

      // Temps de trajet du RDV existant (estimer depuis la distance)
      let trajetExistant = 0;
      if (rdv.distance_km) {
        // Estimation : 2 min par km en moyenne
        trajetExistant = Math.round(rdv.distance_km * 2);
      }

      // Calculer le créneau réel du RDV existant
      const slotExistant = calculateRealSlot(heureRdvExistant, dureeExistant, trajetExistant);

      console.log(`[BOOKING]   RDV existant ${rdv.id}: ${slotExistant.heureDebutReelle} → ${slotExistant.heureFinReelle}`);

      // Vérifier chevauchement
      // Chevauchement si : debut1 < fin2 ET debut2 < fin1
      if (nouveauSlot.heureDebutMinutes < slotExistant.heureFinMinutes &&
          slotExistant.heureDebutMinutes < nouveauSlot.heureFinMinutes) {

        console.log(`[BOOKING] ❌ Conflit avec RDV ${rdv.id}`);
        conflits.push({
          id: rdv.id,
          heure: rdv.heure,
          service: rdv.service_nom,
          slotDebut: slotExistant.heureDebutReelle,
          slotFin: slotExistant.heureFinReelle
        });
      }
    }

    if (conflits.length > 0) {
      // Trouver une suggestion d'heure alternative
      const suggestion = findNextAvailableSlotComplete(rdvsJour, heureNum, dureeMinutes, tempsTrajetMinutes, dateRdv);

      return {
        available: false,
        conflits,
        message: `Ce créneau est déjà pris. ${suggestion}`,
        suggestion
      };
    }

    console.log('[BOOKING] ✅ Créneau disponible');
    return { available: true, conflits: [], message: 'Créneau disponible', slot: nouveauSlot };

  } catch (error) {
    console.error('[BOOKING] Erreur checkAvailabilityComplete:', error);
    return { available: true, conflits: [], message: 'Erreur vérification' };
  }
}

/**
 * Trouver le prochain créneau disponible en tenant compte des créneaux réels
 */
function findNextAvailableSlotComplete(rdvsJour, heureVoulue, dureeMinutes, tempsTrajetMinutes, dateRdv) {
  // Récupérer les horaires du jour
  const date = new Date(dateRdv);
  const jourSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][date.getDay()];
  const horaire = HORAIRES[jourSemaine];

  if (!horaire || !horaire.ouvert) {
    return 'Ce jour n\'est pas disponible.';
  }

  // Creer une liste des creneaux occupes (avec leurs vrais horaires)
  const creneauxOccupes = rdvsJour.map(rdv => {
    const h = parseInt(String(rdv.heure).replace(/[^0-9]/g, ''));
    const duree = rdv.duree_minutes || 120; // duree_minutes stockee en DB
    let trajet = 0;
    if (rdv.distance_km) {
      trajet = Math.round(rdv.distance_km * 2);
    }
    return calculateRealSlot(h, duree, trajet);
  }).sort((a, b) => a.heureDebutMinutes - b.heureDebutMinutes);

  // Chercher un créneau libre après l'heure voulue
  const heureMinPossible = horaire.debut;
  const heureMaxPossible = horaire.fin;

  for (let h = heureVoulue; h <= heureMaxPossible - Math.ceil(dureeMinutes / 60); h++) {
    const testSlot = calculateRealSlot(h, dureeMinutes, tempsTrajetMinutes);

    // Vérifier que le créneau est dans les horaires
    if (testSlot.heureDebutMinutes < horaire.debut * 60) continue;
    if (testSlot.heureFinMinutes > horaire.fin * 60) continue;

    // Vérifier qu'il n'y a pas de chevauchement
    let libre = true;
    for (const occ of creneauxOccupes) {
      if (testSlot.heureDebutMinutes < occ.heureFinMinutes &&
          occ.heureDebutMinutes < testSlot.heureFinMinutes) {
        libre = false;
        break;
      }
    }

    if (libre) {
      return `${h}h serait disponible.`;
    }
  }

  // Chercher aussi avant l'heure voulue
  for (let h = heureMinPossible; h < heureVoulue; h++) {
    const testSlot = calculateRealSlot(h, dureeMinutes, tempsTrajetMinutes);

    if (testSlot.heureDebutMinutes < horaire.debut * 60) continue;
    if (testSlot.heureFinMinutes > horaire.fin * 60) continue;

    let libre = true;
    for (const occ of creneauxOccupes) {
      if (testSlot.heureDebutMinutes < occ.heureFinMinutes &&
          occ.heureDebutMinutes < testSlot.heureFinMinutes) {
        libre = false;
        break;
      }
    }

    if (libre) {
      return `${h}h serait disponible plus tôt.`;
    }
  }

  return 'Aucun créneau disponible ce jour. Un autre jour peut-être ?';
}

// ============================================
// CRÉATION OU RECHERCHE CLIENT
// ============================================

/**
 * Trouver ou créer un client
 * @param {string} tenantId - ID du tenant (obligatoire)
 * @param {string} clientNom - Nom de famille du client
 * @param {string} clientPhone - Téléphone du client (identifiant unique)
 * @param {string} clientPrenom - Prénom du client (optionnel)
 */
async function findOrCreateClient(tenantId, clientNom, clientPhone, clientPrenom = null) {
  if (!tenantId) throw new Error('tenant_id requis');

  const db = getSupabase();
  if (!db || !clientPhone) return null;

  try {
    // Chercher le client existant par téléphone
    const { data: existingClient } = await db
      .from('clients')
      .select('id, nom, prenom')
      .eq('tenant_id', tenantId)
      .eq('telephone', clientPhone)
      .single();

    if (existingClient) {
      console.log(`[BOOKING] Client existant trouvé: ${existingClient.id} (${existingClient.prenom || ''} ${existingClient.nom})`);

      // Mettre à jour le nom/prénom si fournis et différents
      const updates = {};
      if (clientNom && clientNom !== existingClient.nom && clientNom !== 'Client') {
        updates.nom = clientNom;
      }
      if (clientPrenom && clientPrenom !== existingClient.prenom) {
        updates.prenom = clientPrenom;
      }

      if (Object.keys(updates).length > 0) {
        await db.from('clients').update(updates).eq('tenant_id', tenantId).eq('id', existingClient.id);
        console.log(`[BOOKING] Client mis à jour:`, updates);
      }

      return existingClient.id;
    }

    // Créer un nouveau client avec nom ET prénom
    const clientData = {
      tenant_id: tenantId,
      nom: clientNom || 'Client',
      telephone: clientPhone
    };

    // Ajouter le prénom si fourni
    if (clientPrenom) {
      clientData.prenom = clientPrenom;
    }

    const { data: newClient, error } = await db
      .from('clients')
      .insert(clientData)
      .select('id')
      .single();

    if (error) {
      console.error('[BOOKING] Erreur création client:', error);
      return null;
    }

    console.log(`[BOOKING] Nouveau client créé: ${newClient.id} (${clientPrenom || ''} ${clientNom || 'Client'})`);
    return newClient.id;

  } catch (error) {
    console.error('[BOOKING] Exception findOrCreateClient:', error);
    return null;
  }
}

// ============================================
// CRÉATION DE RDV
// ============================================

/**
 * Créer un rendez-vous complet
 * 🔒 REDIRIGE VERS createReservationUnified (NEXUS CORE)
 *
 * @param {Object} bookingData - Données du RDV (ancien format)
 * @returns {Object} { success, rdv, error }
 */
export async function createAppointment(bookingData) {
  console.log('[BOOKING] ========================================');
  console.log('[BOOKING] Création RDV (via NEXUS CORE)...');

  try {
    const {
      clientName,
      clientPrenom,
      clientPhone,
      clientEmail,
      clientAddress,
      service,
      jour,
      heure,
      source = 'site',
      notes,
      callSid,
      nombre_locks,
      duree_minutes
    } = bookingData;

    // Convertir le jour en date ISO si nécessaire
    let dateRdv = jour;
    if (jour && !jour.match(/^\d{4}-\d{2}-\d{2}$/)) {
      dateRdv = parseJourToDate(jour);
      if (!dateRdv) {
        return { success: false, error: 'Date invalide' };
      }
    }

    // Formater l'heure
    let heureFormatted = heure;
    if (heure && !heure.includes(':')) {
      const heureNum = String(heure).replace(/[^0-9]/g, '');
      heureFormatted = heureNum.padStart(2, '0') + ':00';
    }

    // Préparer les notes
    let notesFinales = notes || '';
    if (source === 'telephone' && callSid) {
      notesFinales = `[TELEPHONE] CallSid: ${callSid}${notesFinales ? ' | ' + notesFinales : ''}`;
    }

    // Mapper vers le nouveau format createReservationUnified
    const data = {
      service_name: service,
      date: dateRdv,
      heure: heureFormatted,
      client_nom: clientName,
      client_prenom: clientPrenom || null,
      client_telephone: clientPhone,
      client_email: clientEmail || null,
      lieu: clientAddress ? 'domicile' : 'salon',
      adresse: clientAddress || null,
      notes: notesFinales || null,
      ...(nombre_locks ? { nombre_locks: Number(nombre_locks), duree_minutes: Number(duree_minutes) || Number(nombre_locks) * 30 } : {}),
    };

    // Appeler la fonction unifiée
    const createReservationUnified = await getCreateReservationUnified();
    const result = await createReservationUnified(data, source, { sendSMS: true });

    // Convertir la réponse vers l'ancien format
    if (result.success) {
      console.log('[BOOKING] ✅ RDV créé via NEXUS CORE, ID:', result.reservationId);
      return {
        success: true,
        rdv: { id: result.reservationId },
        summary: {
          service: result.recap.service,
          date: result.recap.date,
          dateISO: result.recap.date,
          heure: result.recap.heure,
          prixService: result.recap.prix,
          fraisDeplacement: result.recap.fraisDeplacement,
          prixTotal: result.recap.prixTotal,
          distance: result.recap.distanceKm
        }
      };
    } else {
      console.error('[BOOKING] ❌ Erreur NEXUS CORE:', result.error || result.errors);
      return {
        success: false,
        error: result.error || (result.errors ? result.errors.join(', ') : 'Erreur inconnue'),
        needsClarification: result.needsClarification,
        options: result.options
      };
    }

  } catch (error) {
    console.error('[BOOKING] ❌ Exception:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// ENVOI SMS DE CONFIRMATION
// ============================================

/**
 * Envoyer un SMS de confirmation
 * @param {string} tenantId - ID du tenant (obligatoire)
 * @param {string} phoneNumber - Numéro du client
 * @param {Object} bookingDetails - Détails du RDV
 * @returns {boolean} Succès ou échec
 */
export async function sendConfirmationSMS(tenantId, phoneNumber, bookingDetails) {
  if (!tenantId) throw new Error('tenant_id requis');
  console.log('[BOOKING] Envoi SMS à:', phoneNumber);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !twilioPhone) {
    logger.warn('Configuration Twilio manquante, SMS non envoyé', { tag: 'BOOKING' });
    return false;
  }

  if (!phoneNumber || phoneNumber.length < 10) {
    logger.warn('Numéro invalide, SMS non envoyé', { tag: 'BOOKING' });
    return false;
  }

  try {
    // Formater le numéro
    let formattedPhone = phoneNumber.replace(/\s/g, '').replace(/\./g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+33' + formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+33' + formattedPhone;
    }

    const { service, date, heure, prixTotal, fraisDeplacement, adresse } = bookingDetails;

    // Charger les infos business du tenant dynamiquement
    const businessInfo = getSalonInfo(tenantId);

    const fraisText = fraisDeplacement > 0
      ? `(dont ${fraisDeplacement}EUR deplacement)`
      : '';

    const message = `${businessInfo.nom}
Votre RDV est confirme !

${date} a ${heure}
${service}
${prixTotal}EUR${fraisText ? ' ' + fraisText : ''}

${adresse ? 'Adresse : ' + adresse : (businessInfo.adresse ? `Adresse : ${businessInfo.adresse}` : '')}

A bientot !
${businessInfo.gerante}${businessInfo.telephone ? ' - ' + businessInfo.telephone : ''}`;

    const twilio = (await import('twilio')).default;
    const client = twilio(accountSid, authToken);

    const result = await client.messages.create({
      body: message,
      from: twilioPhone,
      to: formattedPhone
    });

    console.log('[BOOKING] ✅ SMS envoyé, SID:', result.sid);

    // 📊 Logger le SMS sortant pour tracking des coûts
    try {
      const { supabase } = await import('../config/supabase.js');
      await supabase.from('twilio_call_logs').insert({
        channel: 'sms',
        direction: 'outbound',
        from_number: twilioPhone,
        to_number: formattedPhone,
        message_sid: result.sid,
        tenant_id: tenantId,
      });
      console.log('[BOOKING] ✅ SMS loggé pour tracking coûts');
    } catch (logErr) {
      logger.warn('Erreur logging SMS', { tag: 'BOOKING', error: logErr.message });
    }

    return true;

  } catch (error) {
    console.error('[BOOKING] ❌ Erreur envoi SMS:', error.message);
    return false;
  }
}

// ============================================
// PROMPT HALIMAH UNIFIÉ (TOUS CANAUX)
// ============================================

/**
 * Generer le prompt systeme pour l'assistant IA du tenant
 * @param {string} canal - 'telephone', 'chat', ou 'whatsapp'
 * @param {boolean} vouvoiement - true pour vouvoiement, false pour tutoiement possible
 * @param {string} tenantId - ID du tenant (obligatoire)
 * @param {Object} options - Options supplementaires { services, horaires }
 *   services: Array de services (pre-charges). Si absent, prompt sans tarifs detailles.
 *   horaires: Object horaires par jour. Si absent, utilise HORAIRES statiques.
 */
export function getHalimahPrompt(canal = 'chat', vouvoiement = true, tenantId = null, options = {}) {
  const today = getTodayInfo();

  // Charger les infos business du tenant
  let businessInfo;
  if (tenantId) {
    businessInfo = getSalonInfo(tenantId);
  } else {
    logger.warn('getHalimahPrompt appele sans tenantId', { tag: 'BOOKING' });
    businessInfo = { nom: 'Notre etablissement', gerante: 'Notre equipe', telephone: '', whatsapp: '', adresse: '', zone: '' };
  }

  const { services: servicesList = [], horaires: horairesData = null } = options;
  const horaires = horairesData || HORAIRES;

  const tutoiementInstruction = vouvoiement
    ? "Tu VOUVOIES TOUJOURS les clients. Utilise 'vous', 'votre', 'vos'."
    : "Tu peux tutoyer si le client tutoie d'abord, sinon vouvoie.";

  const canalSpecifique = {
    telephone: `
SPECIFICITES TELEPHONE :
- Phrases courtes mais chaleureuses (2-3 phrases max)
- Une seule question a la fois
- Confirme ce que tu as compris avant de passer a la suite
- Marqueurs oraux : "Tres bien", "D'accord", "Je vois"`,

    chat: `
SPECIFICITES CHAT :
- Tu peux etre un peu plus detaillee qu'au telephone
- Paragraphes courts et aeres
- Emojis bienvenus avec moderation (1-2 par message)
- Listes si c'est plus clair`,

    whatsapp: `
SPECIFICITES WHATSAPP :
- Messages courts et dynamiques
- Emojis bienvenus
- Decoupe les infos longues en plusieurs messages
- Reponds rapidement aux questions simples`
  };

  // Construire la section services dynamiquement
  const servicesSection = servicesList.length > 0
    ? servicesList.map(s => `- ${s.nom || s.name} : ${s.prixTexte || s.prix + 'EUR'}`).join('\n')
    : '(Utilise les outils pour obtenir les tarifs exacts)';

  // Construire la section horaires dynamiquement
  const horairesSection = Object.entries(horaires)
    .map(([jour, h]) => `- ${jour.charAt(0).toUpperCase() + jour.slice(1)} : ${h.description}`)
    .join('\n');

  // Section deplacement (si le tenant a des frais de deplacement)
  const deplacementSection = DEPLACEMENT.calculate
    ? `DEPLACEMENT :\n- ${DEPLACEMENT.description}`
    : '';

  return `
===============================================================
AUJOURD'HUI : ${today.date}
HEURE : ${today.heure}
===============================================================

Tu es l'assistante virtuelle de ${businessInfo.nom}.

TA PERSONNALITE :

Tu es comme une amie professionnelle - chaleureuse mais respectueuse.

- AUTHENTIQUE : Tu parles comme une vraie personne.
- ATTENTIVE : Tu reformules pour montrer que tu as compris.
- RASSURANTE : Tu anticipes les questions et inquietudes.
- EQUILIBREE : Ni trop bavarde, ni trop breve. Le juste milieu.
- PROFESSIONNELLE : ${tutoiementInstruction}

${canalSpecifique[canal] || canalSpecifique.chat}

===============================================================
STYLE CONVERSATIONNEL
===============================================================

1. ECOUTE ACTIVE
2. REFORMULATION
3. EMPATHIE
4. TRANSITIONS DOUCES
5. ANTICIPATION
6. HUMANITE

===============================================================
GESTION DES DATES - REGLE ABSOLUE
===============================================================

Tu as acces a un OUTIL de calcul de dates. UTILISE-LE TOUJOURS !

Quand un client mentionne une date ("jeudi prochain", "le 15", "dans 2 semaines") :
1. Appelle l'outil getDateInfo() pour obtenir la date exacte
2. NE DEVINE JAMAIS une date toi-meme
3. Si l'outil dit que c'est ferme, propose une alternative

SI TU TE TROMPES : "Vous avez raison, je me suis trompee. Merci de m'avoir corrigee !"

===============================================================
INFORMATIONS DU SERVICE
===============================================================

- Etablissement : ${businessInfo.nom}
- Responsable : ${businessInfo.gerante}
${businessInfo.telephone ? `- Telephone : ${businessInfo.telephone}` : ''}
${businessInfo.whatsapp ? `- WhatsApp : ${businessInfo.whatsapp}` : ''}
${businessInfo.adresse ? `- Adresse : ${businessInfo.adresse}` : ''}
${businessInfo.zone ? `- Zone : ${businessInfo.zone}` : ''}

HORAIRES :
${horairesSection}

SERVICES & TARIFS :
${servicesSection}

${deplacementSection}

===============================================================
REGLES METIER
===============================================================

- JAMAIS de chevauchement de creneaux
- Toujours verifier la disponibilite avant de confirmer
- NE JAMAIS inventer de tarifs ou de dates
- Utiliser les outils pour obtenir les prix et disponibilites exacts

PAIEMENT : A la fin, especes ou carte, pas d'acompte.

SMS : Confirmation envoyee apres reservation.

===============================================================
SITUATIONS DELICATES
===============================================================

CLIENT INQUIET : "Je comprends parfaitement, c'est normal ! Laissez-moi vous expliquer..."
CLIENT HESITE : "Prenez votre temps ! Je peux vous donner plusieurs creneaux."
CLIENT FRUSTRE : "Je suis vraiment desolee. Voyons ce qu'on peut faire..."
CLIENT CORRIGE : "Vous avez raison ! Merci de m'avoir corrigee."

===============================================================
INTERDITS
===============================================================

- Inventer des tarifs ou dates
- Reponses d'une phrase seche
- Monologues interminables
- Oublier l'adresse pour un deplacement
- Ignorer une inquietude du client

===============================================================`;
}

// ============================================
// OUTILS HALIMAH (OBLIGATOIRES)
// ============================================

/**
 * Outil pour obtenir le prix EXACT d'un service (async, multi-tenant)
 * @param {string} tenantId - ID du tenant (obligatoire)
 * @param {string} serviceName - Nom du service
 */
export async function toolGetPrice(tenantId, serviceName) {
  if (!tenantId) throw new Error('tenant_id requis');

  const service = await getServiceInfoForTenant(tenantId, serviceName);
  if (service) {
    return {
      found: true,
      service: service.nom,
      prix: service.prix,
      prixTexte: `${service.prix}EUR`,
      duree: service.duree,
      prixVariable: service.prixVariable || false
    };
  }

  // Service non trouve - retourner la liste
  const allServices = await getServicesListForTenant(tenantId);
  return {
    found: false,
    message: 'Service non trouve. Voici tous les services disponibles :',
    services: allServices.map(s => ({
      nom: s.nom,
      prix: s.prix,
      prixTexte: s.prixTexte
    }))
  };
}

/**
 * Outil pour obtenir la date EXACTE
 * Halimah DOIT utiliser cet outil pour toute date
 * RETOURNE dateISO au format YYYY-MM-DD pour check_availability
 */
export function toolGetDate(jourDemande) {
  const info = getDateInfo(jourDemande);
  const today = getTodayInfo();

  // Si la date n'est pas valide, retourner l'erreur
  if (!info.valide) {
    return {
      success: false,
      erreur: info.erreur,
      aujourdhui: {
        jour: today.jour,
        date: today.date,
        dateISO: today.dateISO,
        timestamp: today.timestamp
      }
    };
  }

  return {
    success: true,
    aujourdhui: {
      jour: today.jour,
      date: today.date,
      dateISO: today.dateISO,
      timestamp: today.timestamp
    },
    jourDemande: {
      jour: info.jour,
      date: info.date,
      dateISO: info.dateISO,  // FORMAT YYYY-MM-DD POUR check_availability
      estOuvert: info.estOuvert,
      horaires: info.horaires,
      horaireDebut: info.horaireDebut,
      horaireFin: info.horaireFin
    }
  };
}

/**
 * Outil pour lister TOUS les services avec prix EXACTS (async, multi-tenant)
 * @param {string} tenantId - ID du tenant (obligatoire)
 */
export async function toolGetAllServices(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const servicesList = await getServicesListForTenant(tenantId);
  return {
    services: servicesList.map(s => ({
      nom: s.nom,
      prix: s.prix,
      prixTexte: s.prixTexte,
      categorie: s.categorie
    })),
    totalServices: servicesList.length
  };
}

/**
 * Outil pour verifier disponibilite (multi-tenant)
 * @param {string} tenantId - ID du tenant (obligatoire)
 * @param {string} dateRdv - Date au format YYYY-MM-DD
 * @param {string|number} heure - Heure de debut
 * @param {number} dureeMinutes - Duree du service
 */
export async function toolCheckAvailability(tenantId, dateRdv, heure, dureeMinutes = 120) {
  if (!tenantId) throw new Error('tenant_id requis');
  const result = await checkAvailabilityComplete(tenantId, dateRdv, heure, dureeMinutes);
  return result;
}

// ============================================
// EXPORT PAR DÉFAUT
// ============================================

export default {
  // @deprecated constants (vides, utiliser les fonctions dynamiques)
  SERVICES,
  SERVICES_LIST,
  FRAIS_DEPLACEMENT,
  HORAIRES,
  SALON_INFO,
  DEPLACEMENT,
  SERVICES_AMBIGUS,
  // Multi-tenant (recommande)
  getSalonInfo,
  getBaseAddress,
  getServicesListForTenant,
  getServiceInfoForTenant,
  getHorairesForTenant,
  // Fonctions dates
  getTodayInfo,
  getDateInfo,
  getJourSemaine,
  validateDate,
  // Fonctions utilitaires
  parseJourToDate,
  formatDateToText,
  getJourFromDate,
  calculateDistance,
  calculateTravelFee,
  getServiceInfo,
  checkHoraires,
  checkAvailability,
  // Fonctions avec creneaux reels
  calculateRealSlot,
  checkHorairesComplet,
  checkAvailabilityComplete,
  // Prompt unifie
  getHalimahPrompt,
  // Autres
  createAppointment,
  sendConfirmationSMS,
  // Outils IA (multi-tenant)
  toolGetPrice,
  toolGetDate,
  toolGetAllServices,
  toolCheckAvailability,
  // Fonctions strictes
  checkServiceAmbiguity,
  checkStrictAvailability,
  // Creation unifiee (via nexusCore)
  createReservationUnified
};
