/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║   HALIMAH AI - Assistante Client IA                           [LOCKED]        ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                               ║
 * ║   ⛔ FICHIER VERROUILLE - Ne pas modifier sans autorisation                   ║
 * ║                                                                               ║
 * ║   Claude gere la CONVERSATION (comprehension naturelle)                       ║
 * ║   Les OUTILS gerent les DONNEES (prix, dispo, creation RDV)                   ║
 * ║                                                                               ║
 * ║   Claude NE PEUT PAS inventer : prix, disponibilites, infos metier            ║
 * ║                                                                               ║
 * ║   *** NEXUS CORE COMPLIANT ***                                                ║
 * ║   - SERVICES : importes depuis businessRules.js                               ║
 * ║   - TRAVEL_FEES : importes depuis businessRules.js                            ║
 * ║   - Aucune valeur hardcodee autorisee                                         ║
 * ║                                                                               ║
 * ║   Voir : backend/NEXUS_LOCK.md                                                ║
 * ║                                                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
// Import du prompt vocal naturel
import { getVoicePrompt, getGreeting, getGoodbye } from '../prompts/voicePrompt.js';
// Import Google Maps pour calcul des distances
import { getDistanceFromSalon } from '../services/googleMapsService.js';
// *** NEXUS CORE - SOURCE UNIQUE DE VÉRITÉ ***
import { SERVICES as BUSINESS_SERVICES, TRAVEL_FEES, BUSINESS_HOURS } from '../config/businessRules.js';
// Import du router IA pour optimisation des couts
import modelRouter, { MODEL_DEFAULT } from '../services/modelRouter.js';
import { matchStaticResponse } from '../services/optimization/cacheService.js';
import logger from '../config/logger.js';
// Multi-tenant: chargement dynamique des infos business
import { getBusinessInfo, getBusinessInfoSync } from '../services/tenantBusinessService.js';
import { getBusinessHoursForTenant } from '../services/tenantBusinessRules.js';
import { getTenantConfig } from '../config/tenants/index.js';
import { cachedSystem, cachedTools } from '../services/promptCacheHelper.js';

// ============================================
// CONFIGURATION
// ============================================

const anthropic = new Anthropic();

// Modèles centralisés dans modelRouter.js (source unique de vérité)

function getSupabase() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  return null;
}

// ============================================
// DONNÉES MÉTIER - IMPORTÉES DE businessRules.js
// ============================================

// Transformation des services depuis businessRules.js vers le format attendu par halimahAI
const SERVICES = Object.fromEntries(
  Object.entries(BUSINESS_SERVICES).map(([key, service]) => [
    service.id,
    {
      nom: service.name,
      prix: service.price,
      duree: service.durationMinutes,
      categorie: service.category,
      blocksFullDay: service.blocksFullDay || false
    }
  ])
);

// HORAIRES par defaut (fallback si horaires dynamiques non disponibles)
const HORAIRES_DEFAULT = {
  1: { jour: 'Lundi', ouvert: true, debut: 9, fin: 18 },
  2: { jour: 'Mardi', ouvert: true, debut: 9, fin: 18 },
  3: { jour: 'Mercredi', ouvert: true, debut: 9, fin: 18 },
  4: { jour: 'Jeudi', ouvert: true, debut: 9, fin: 18 },
  5: { jour: 'Vendredi', ouvert: true, debut: 9, fin: 18 },
  6: { jour: 'Samedi', ouvert: true, debut: 9, fin: 18 },
  0: { jour: 'Dimanche', ouvert: false }
};

// Alias pour compatibilite (read-only)
const HORAIRES = HORAIRES_DEFAULT;

/**
 * Charge les infos business d'un tenant (async).
 * @param {string} tenantId - ID du tenant (OBLIGATOIRE)
 * @returns {Promise<Object>} { nom, adresse, telephone, gerant }
 */
async function getSalonInfo(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: getSalonInfo requires explicit tenantId');
  }
  try {
    const info = await getBusinessInfo(tenantId);
    return {
      nom: info.nom || tenantId,
      adresse: info.adresse || '',
      telephone: info.telephone || '',
      coiffeuse: info.gerant || '',
      gerant: info.gerant || '',
      businessType: info.businessType || 'salon',
    };
  } catch (err) {
    logger.warn(`[HALIMAH AI] getSalonInfo fallback for ${tenantId}: ${err.message}`);
    // Fallback sur config statique
    const staticConfig = getTenantConfig(tenantId);
    return {
      nom: staticConfig?.name || tenantId,
      adresse: staticConfig?.adresse || '',
      telephone: staticConfig?.telephone || '',
      coiffeuse: staticConfig?.gerante || '',
      gerant: staticConfig?.gerante || '',
      businessType: staticConfig?.business_type || 'salon',
    };
  }
}

/**
 * Version synchrone (cache uniquement, pas d'appel DB).
 */
function getSalonInfoSync(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: getSalonInfoSync requires explicit tenantId');
  }
  const info = getBusinessInfoSync(tenantId);
  return {
    nom: info.nom || tenantId,
    adresse: info.adresse || '',
    telephone: info.telephone || '',
    coiffeuse: info.gerant || '',
    gerant: info.gerant || '',
    businessType: info.businessType || 'salon',
  };
}

// @deprecated - SALON_INFO maintenu pour compatibilite import.
// Les appelants DOIVENT migrer vers getSalonInfo(tenantId).
const SALON_INFO = Object.freeze({
  nom: '[DEPRECATED - use getSalonInfo(tenantId)]',
  adresse: '',
  telephone: '',
  coiffeuse: ''
});

// ============================================
// OUTILS DÉTERMINISTES (Claude appelle ces fonctions)
// ============================================

const tools = [
  {
    name: "parse_date",
    description: "OBLIGATOIRE : Convertit une date relative ('demain', 'samedi prochain', 'lundi') en format YYYY-MM-DD. Utilise TOUJOURS cet outil avant check_availability.",
    input_schema: {
      type: "object",
      properties: {
        date_text: {
          type: "string",
          description: "La date en langage naturel (ex: 'demain', 'samedi prochain', 'lundi', 'après-demain', '25 janvier')"
        },
        heure: {
          type: "integer",
          description: "L'heure demandée (9-18), optionnel"
        }
      },
      required: ["date_text"]
    }
  },
  {
    name: "get_services",
    description: "Récupère la liste de tous les services avec leurs prix EXACTS. Utilise cet outil quand le client demande les services, les prix, ou veut savoir ce qui est proposé.",
    input_schema: {
      type: "object",
      properties: {
        categorie: {
          type: "string",
          description: "Filtrer par categorie de service, ou 'all' pour tout afficher"
        }
      },
      required: []
    }
  },
  {
    name: "get_price",
    description: "Récupère le prix EXACT d'un service spécifique. TOUJOURS utiliser cet outil pour donner un prix, ne JAMAIS inventer.",
    input_schema: {
      type: "object",
      properties: {
        service_id: {
          type: "string",
          description: "ID du service"
        }
      },
      required: ["service_id"]
    }
  },
  {
    name: "check_availability",
    description: "Vérifie si une date/heure est disponible pour un service. TOUJOURS utiliser avant de confirmer un créneau.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
        heure: { type: "integer", description: "Heure (9-18)" },
        duree_minutes: { type: "integer", description: "Durée du service en minutes" }
      },
      required: ["date", "heure", "duree_minutes"]
    }
  },
  {
    name: "get_next_available_slot",
    description: "Trouve le prochain créneau VRAIMENT disponible pour un service. Utilise cet outil pour proposer une date au client.",
    input_schema: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "ID du service" },
        after_date: { type: "string", description: "Chercher après cette date (YYYY-MM-DD), optionnel" }
      },
      required: ["service_id"]
    }
  },
  {
    name: "calculate_travel_fee",
    description: "Calcule les frais de deplacement pour une adresse client.",
    input_schema: {
      type: "object",
      properties: {
        adresse: { type: "string", description: "Adresse du client" }
      },
      required: ["adresse"]
    }
  },
  {
    name: "create_booking",
    description: "Crée une réservation UNIQUEMENT quand toutes les infos sont confirmées par le client.",
    input_schema: {
      type: "object",
      properties: {
        service_id: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        heure: { type: "integer" },
        lieu: { type: "string", enum: ["domicile", "salon"], description: "domicile = chez le client, salon = sur place" },
        adresse: { type: "string", description: "Adresse si domicile" },
        client_nom: { type: "string" },
        client_telephone: { type: "string" }
      },
      required: ["service_id", "date", "heure", "lieu", "client_nom", "client_telephone"]
    }
  },
  {
    name: "get_salon_info",
    description: "Récupère les informations du salon (adresse, horaires, téléphone).",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  }
];

// ============================================
// IMPLÉMENTATION DES OUTILS
// ============================================

async function executeTool(toolName, toolInput, tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: executeTool requires explicit tenantId');
  }
  logger.info(`[HALIMAH AI] Outil appelé: ${toolName}`, { toolInput, tenantId });

  switch (toolName) {
    case 'parse_date': {
      const { date_text, heure } = toolInput;
      const now = new Date();
      now.setHours(12, 0, 0, 0); // Normaliser

      let targetDate = null;
      const text = date_text.toLowerCase().trim();

      // Dictionnaire des jours
      const joursMap = {
        'dimanche': 0, 'lundi': 1, 'mardi': 2, 'mercredi': 3,
        'jeudi': 4, 'vendredi': 5, 'samedi': 6
      };

      // Cas simples
      if (text === 'demain') {
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + 1);
      } else if (text === 'après-demain' || text === 'apres-demain' || text === 'après demain') {
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + 2);
      } else if (text === "aujourd'hui" || text === 'aujourdhui') {
        targetDate = new Date(now);
      } else {
        // Chercher un jour de la semaine
        for (const [jour, index] of Object.entries(joursMap)) {
          if (text.includes(jour)) {
            targetDate = new Date(now);
            const currentDay = now.getDay();
            let daysToAdd = index - currentDay;
            if (daysToAdd <= 0) daysToAdd += 7; // Prochain occurrence
            targetDate.setDate(targetDate.getDate() + daysToAdd);
            break;
          }
        }

        // Chercher une date au format "25 janvier" ou "25/01"
        if (!targetDate) {
          const moisMap = {
            'janvier': 0, 'février': 1, 'fevrier': 1, 'mars': 2, 'avril': 3,
            'mai': 4, 'juin': 5, 'juillet': 6, 'août': 7, 'aout': 7,
            'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11, 'decembre': 11
          };

          // Format "25 janvier"
          for (const [moisNom, moisIndex] of Object.entries(moisMap)) {
            const regex = new RegExp(`(\\d{1,2})\\s*${moisNom}`);
            const match = text.match(regex);
            if (match) {
              targetDate = new Date(now.getFullYear(), moisIndex, parseInt(match[1]));
              if (targetDate < now) {
                targetDate.setFullYear(targetDate.getFullYear() + 1);
              }
              break;
            }
          }

          // Format "25/01" ou "25/1"
          if (!targetDate) {
            const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
            if (slashMatch) {
              targetDate = new Date(now.getFullYear(), parseInt(slashMatch[2]) - 1, parseInt(slashMatch[1]));
              if (targetDate < now) {
                targetDate.setFullYear(targetDate.getFullYear() + 1);
              }
            }
          }
        }
      }

      if (!targetDate) {
        return {
          success: false,
          error: `Je n'ai pas compris la date "${date_text}". Pouvez-vous préciser le jour ?`
        };
      }

      const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,'0')}-${String(targetDate.getDate()).padStart(2,'0')}`;
      const jourSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][targetDate.getDay()];

      return {
        success: true,
        date: dateStr,
        jour: jourSemaine,
        jour_numero: targetDate.getDate(),
        mois: targetDate.getMonth() + 1,
        heure: heure || null,
        dateFormatee: `${jourSemaine} ${targetDate.getDate()}/${targetDate.getMonth()+1}/${targetDate.getFullYear()}`
      };
    }

    case 'get_services': {
      const categorie = toolInput.categorie || 'all';
      const services = Object.entries(SERVICES)
        .filter(([id, s]) => categorie === 'all' || s.categorie === categorie)
        .map(([id, s]) => ({
          id,
          nom: s.nom,
          prix: `${s.prix}€`,
          duree: s.duree >= 60 ? `${Math.floor(s.duree/60)}h${s.duree%60 > 0 ? s.duree%60 : ''}` : `${s.duree}min`,
          categorie: s.categorie
        }));
      return { success: true, services };
    }

    case 'get_price': {
      const service = SERVICES[toolInput.service_id];
      if (!service) {
        // Chercher par nom partiel
        const found = Object.entries(SERVICES).find(([id, s]) =>
          s.nom.toLowerCase().includes(toolInput.service_id.toLowerCase()) ||
          id.includes(toolInput.service_id.toLowerCase())
        );
        if (found) {
          return { success: true, service: found[1].nom, prix: found[1].prix, duree: found[1].duree };
        }
        return { success: false, error: "Service non trouvé" };
      }
      return { success: true, service: service.nom, prix: service.prix, duree: service.duree };
    }

    case 'check_availability': {
      const db = getSupabase();
      if (!db) return { success: true, disponible: true, message: "Base non connectée, supposé disponible" };

      const { date, heure, duree_minutes } = toolInput;
      const { data: rdvs } = await db
        .from('reservations')
        .select('heure, duree_minutes')
        .eq('tenant_id', tenantId)
        .eq('date', date)
        .in('statut', ['demande', 'confirme', 'en_attente']);

      if (!rdvs || rdvs.length === 0) {
        return { success: true, disponible: true };
      }

      // Convertir heure en minutes (supporte "14:30", "14h30", ou 14)
      const parseHeureToMinutes = (h) => {
        if (typeof h === 'number') return h * 60;
        const str = String(h);
        if (str.includes(':')) {
          const [hh, mm] = str.split(':').map(Number);
          return hh * 60 + (mm || 0);
        }
        if (str.includes('h')) {
          const [hh, mm] = str.split('h').map(s => parseInt(s) || 0);
          return hh * 60 + mm;
        }
        return parseInt(str) * 60;
      };

      // Vérifier les conflits en minutes
      const debutMinutes = parseHeureToMinutes(heure);
      const finMinutes = debutMinutes + (duree_minutes || 60);

      for (const rdv of rdvs) {
        const rdvDebutMinutes = parseHeureToMinutes(rdv.heure);
        const rdvFinMinutes = rdvDebutMinutes + (rdv.duree_minutes || 60);

        // Conflit si les plages se chevauchent
        if (!(finMinutes <= rdvDebutMinutes || debutMinutes >= rdvFinMinutes)) {
          const rdvDebutH = Math.floor(rdvDebutMinutes / 60);
          const rdvDebutM = rdvDebutMinutes % 60;
          const rdvFinH = Math.floor(rdvFinMinutes / 60);
          const rdvFinM = rdvFinMinutes % 60;
          const formatHeure = (h, m) => m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
          return {
            success: true,
            disponible: false,
            conflit: `Créneau ${formatHeure(rdvDebutH, rdvDebutM)}-${formatHeure(rdvFinH, rdvFinM)} déjà pris`
          };
        }
      }

      return { success: true, disponible: true };
    }

    case 'get_next_available_slot': {
      const service = SERVICES[toolInput.service_id];
      if (!service) return { success: false, error: "Service non trouvé" };

      const db = getSupabase();
      const dureeMinutes = service.duree;
      const now = new Date();
      now.setHours(12, 0, 0, 0);

      for (let i = 1; i <= 30; i++) {
        const checkDate = new Date(now);
        checkDate.setDate(checkDate.getDate() + i);

        const jourSemaine = checkDate.getDay();
        const horaires = HORAIRES[jourSemaine];
        if (!horaires || !horaires.ouvert) continue;

        const heuresJournee = (horaires.fin - horaires.debut) * 60;
        if (dureeMinutes > heuresJournee) continue;

        const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth()+1).padStart(2,'0')}-${String(checkDate.getDate()).padStart(2,'0')}`;

        // Vérifier la dispo en base
        if (db) {
          const { data: rdvs } = await db
            .from('reservations')
            .select('heure, duree_minutes')
            .eq('tenant_id', tenantId)
            .eq('date', dateStr)
            .in('statut', ['demande', 'confirme', 'en_attente']);

          // Trouver un créneau libre
          const heuresOccupees = new Set();
          if (rdvs) {
            for (const rdv of rdvs) {
              const h = parseInt(rdv.heure);
              const duree = rdv.duree_minutes || 60;
              for (let x = h; x < h + Math.ceil(duree/60); x++) {
                heuresOccupees.add(x);
              }
            }
          }

          // Chercher premier créneau libre
          for (let h = horaires.debut; h <= horaires.fin - Math.ceil(dureeMinutes/60); h++) {
            let libre = true;
            for (let x = h; x < h + Math.ceil(dureeMinutes/60); x++) {
              if (heuresOccupees.has(x)) { libre = false; break; }
            }
            if (libre) {
              return {
                success: true,
                date: dateStr,
                jour: horaires.jour,
                heure: h,
                dateFormatee: `${horaires.jour} ${checkDate.getDate()}/${checkDate.getMonth()+1}/${checkDate.getFullYear()}`
              };
            }
          }
        } else {
          // Sans DB, proposer 9h
          return {
            success: true,
            date: dateStr,
            jour: horaires.jour,
            heure: horaires.debut,
            dateFormatee: `${horaires.jour} ${checkDate.getDate()}/${checkDate.getMonth()+1}/${checkDate.getFullYear()}`
          };
        }
      }

      return { success: false, error: "Aucun créneau disponible dans les 30 prochains jours" };
    }

    case 'calculate_travel_fee': {
      // Calcul RÉEL avec Google Maps
      const clientAddress = toolInput.adresse;
      if (!clientAddress) {
        return { success: false, error: "Adresse client requise" };
      }

      try {
        const distanceResult = await getDistanceFromSalon(clientAddress);
        const distanceKm = distanceResult.distance_km;

        // *** UTILISE TRAVEL_FEES depuis businessRules.js (NEXUS CORE) ***
        const frais = TRAVEL_FEES.calculate(distanceKm);

        return {
          success: true,
          frais: frais,
          distance_km: distanceKm,
          duree_trajet: distanceResult.duree_text,
          adresse_validee: distanceResult.destination,
          message: `Frais de déplacement : ${frais}€ (${distanceKm} km, trajet ${distanceResult.duree_text})`
        };
      } catch (error) {
        logger.error('[HALIMAH AI] Erreur calcul distance:', { error: error.message });
        // Fallback si Google Maps échoue - utilise BASE_FEE depuis NEXUS CORE
        return {
          success: true,
          frais: TRAVEL_FEES.BASE_FEE,
          message: `Frais de déplacement : ${TRAVEL_FEES.BASE_FEE}€ minimum (distance exacte non calculée)`
        };
      }
    }

    case 'create_booking': {
      const db = getSupabase();
      if (!db) return { success: false, error: "Base de données non disponible" };

      const service = SERVICES[toolInput.service_id];
      if (!service) return { success: false, error: "Service non trouvé" };

      // VÉRIFICATION CHEVAUCHEMENTS avant création
      const { data: existingRdvs } = await db
        .from('reservations')
        .select('heure, duree_minutes')
        .eq('tenant_id', tenantId)
        .eq('date', toolInput.date)
        .in('statut', ['demande', 'confirme', 'en_attente', 'en_attente_paiement']);

      if (existingRdvs && existingRdvs.length > 0) {
        const parseHeure = (h) => {
          const str = String(h);
          if (str.includes(':')) {
            const [hh, mm] = str.split(':').map(Number);
            return hh * 60 + (mm || 0);
          }
          return parseInt(str) * 60;
        };
        const newStart = parseHeure(toolInput.heure);
        const newEnd = newStart + (service.duree || 60);

        for (const rdv of existingRdvs) {
          const rdvStart = parseHeure(rdv.heure);
          const rdvEnd = rdvStart + (rdv.duree_minutes || 60);
          if (newStart < rdvEnd && newEnd > rdvStart) {
            return {
              success: false,
              error: `Ce créneau chevauche un RDV existant (${rdv.heure}). Veuillez proposer un autre horaire.`
            };
          }
        }
      }

      // Extraire prénom et nom du client
      const nameParts = toolInput.client_nom.trim().split(' ');
      const prenom = nameParts[0] || 'Client';
      const nom = nameParts.slice(1).join(' ') || 'Client';

      // Normaliser le téléphone
      const telephone = toolInput.client_telephone.replace(/\s/g, '');

      // Chercher ou créer le client
      let clientId;
      const { data: existingClient } = await db
        .from('clients')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('telephone', telephone)
        .single();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        // Créer le client
        const { data: newClient, error: clientError } = await db
          .from('clients')
          .insert({ prenom, nom, telephone, tenant_id: tenantId })
          .select('id')
          .single();

        if (clientError) {
          logger.error('[HALIMAH AI] Erreur création client:', { error: clientError });
          return { success: false, error: clientError.message };
        }
        clientId = newClient.id;
      }

      // Créer la réservation
      // Note: pas de colonne "lieu", on utilise adresse_client (null = salon)
      const prixEnCentimes = service.prix * 100; // euros → centimes
      const { error } = await db.from('reservations').insert({
        client_id: clientId,
        tenant_id: tenantId,
        date: toolInput.date,
        heure: `${toolInput.heure}:00`,
        duree_minutes: service.duree,
        service_nom: service.nom,
        prix_total: prixEnCentimes, // Prix en centimes (divisé par 100 à l'affichage)
        adresse_client: toolInput.lieu === 'domicile' ? toolInput.adresse : null,
        telephone: telephone,
        statut: 'demande',
        created_via: 'halimah-ai',
        notes: toolInput.lieu === 'domicile' ? `Domicile: ${toolInput.adresse}` : 'Sur place'
      });

      if (error) {
        logger.error('[HALIMAH AI] Erreur création RDV:', { error });
        return { success: false, error: error.message };
      }

      // Charger l'adresse du tenant pour le recap
      let tenantAdresse = '';
      try {
        const info = await getSalonInfo(tenantId);
        tenantAdresse = info.adresse;
      } catch (e) {
        logger.warn('[HALIMAH AI] Could not load tenant address for recap');
      }

      return {
        success: true,
        message: "Réservation créée avec succès",
        recap: {
          service: service.nom,
          prix: service.prix,
          date: toolInput.date,
          heure: `${toolInput.heure}h`,
          lieu: toolInput.lieu === 'domicile' ? toolInput.adresse : tenantAdresse,
          client: toolInput.client_nom
        }
      };
    }

    case 'get_salon_info': {
      // Charger dynamiquement les infos business du tenant
      const salonInfo = await getSalonInfo(tenantId);
      return {
        success: true,
        nom: salonInfo.nom,
        adresse: salonInfo.adresse,
        telephone: salonInfo.telephone,
        coiffeuse: salonInfo.gerant,
        horaires: Object.values(HORAIRES).map(h =>
          h.ouvert ? `${h.jour}: ${h.debut}h-${h.fin}h` : `${h.jour}: Ferme`
        )
      };
    }

    default:
      return { success: false, error: "Outil inconnu" };
  }
}

// ============================================
// SYSTÈME PROMPT - DYNAMIQUE PAR TENANT
// ============================================

/**
 * Genere le prompt systeme dynamique pour un tenant.
 * @param {string} tenantId - ID du tenant (OBLIGATOIRE)
 * @returns {Promise<string>} Le system prompt
 */
async function getSystemPrompt(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: getSystemPrompt requires explicit tenantId');
  }

  // Charger les infos business du tenant
  const info = await getSalonInfo(tenantId);
  const nom = info.nom || tenantId;
  const gerant = info.gerant || '';
  const adresse = info.adresse || '';
  const telephone = info.telephone || '';
  const businessType = info.businessType || 'salon';

  const now = new Date();
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const mois = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

  const jourSemaine = jours[now.getDay()];
  const jour = now.getDate();
  const moisNom = mois[now.getMonth()];
  const annee = now.getFullYear();
  const dateFormatee = `${jourSemaine} ${jour} ${moisNom} ${annee}`;
  const dateISO = `${annee}-${String(now.getMonth()+1).padStart(2,'0')}-${String(jour).padStart(2,'0')}`;

  // Determiner le terme pour le lieu (adapte au business type)
  const lieuTerme = businessType === 'service_domicile'
    ? (gerant ? `chez ${gerant}` : 'sur place')
    : 'sur place';

  return `Tu es l'assistante virtuelle de ${nom}.

=== DATE DU JOUR ===
Nous sommes le ${dateFormatee}.
Date ISO pour les outils : ${dateISO}

CALCUL DES DATES RELATIVES :
- "demain" = ${calculerDateRelative(1)}
- "apres-demain" = ${calculerDateRelative(2)}
- "samedi prochain" = ${calculerProchainJour(6)}
- "lundi prochain" = ${calculerProchainJour(1)}
Utilise TOUJOURS l'outil parse_date pour convertir les dates relatives en format YYYY-MM-DD.

=== INFORMATIONS BUSINESS ===
- Nom : ${nom}
- Responsable : ${gerant || 'non renseigne'}
- Adresse : ${adresse || 'non renseignee'}
- Telephone : ${telephone || 'non renseigne'}
- Type : ${businessType}

=== PERSONNALITE ===
- Chaleureuse, professionnelle, efficace
- Tu vouvoies toujours les clients
- Tu es concise mais pas froide
- Tu peux utiliser des emojis avec moderation (sauf au telephone)

=== REGLES ABSOLUES ===
1. Tu ne dois JAMAIS inventer un prix → Utilise l'outil get_price ou get_services
2. Tu ne dois JAMAIS inventer une disponibilite → Utilise check_availability
3. Tu ne dois JAMAIS confirmer un RDV sans utiliser create_booking
4. Tu dois TOUJOURS utiliser parse_date pour convertir les dates relatives
5. Tu dois TOUJOURS verifier la disponibilite AVANT de proposer un creneau

=== PROCESSUS DE RESERVATION (SUIVRE EXACTEMENT) ===

ETAPE 1 - COMPRENDRE LA DEMANDE :
- Le client demande un service → Note le service
- Le client donne une date/heure → Utilise parse_date puis check_availability
- Si pas de date donnee → Demande "Vous preferez quel jour ?"

ETAPE 2 - VERIFIER LA DISPONIBILITE :
- Utilise d'ABORD check_availability avec la date/heure demandee
- Si disponible → Propose ce creneau
- Si non disponible → Utilise get_next_available_slot puis propose une alternative

ETAPE 3 - CONFIRMER LE CRENEAU :
- Quand le client dit "oui", "ok", "d'accord", "parfait", "ca marche" → C'est une CONFIRMATION
- Apres confirmation du creneau → Demande le lieu (domicile ou ${lieuTerme})

ETAPE 4 - COLLECTER LES INFOS :
- Si domicile → Demande l'adresse
- Demande : "Pour finaliser, j'ai besoin de votre nom et telephone"

ETAPE 5 - CREER LA RESERVATION :
- Recapitule TOUT (service, date, heure, lieu, prix)
- Demande confirmation finale
- Quand le client confirme → Utilise create_booking

=== GESTION DES CONFIRMATIONS ===
Ces mots/phrases signifient OUI :
- "oui", "ok", "d'accord", "parfait", "ca marche", "super", "tres bien", "nickel", "impec", "c'est bon", "je confirme", "on fait comme ca"

Ces mots signifient NON :
- "non", "pas vraiment", "autre chose", "plutot", "je prefere"

=== IMPORTANT ===
- GARDE LE CONTEXTE : Si le client a mentionne un service, ne propose pas autre chose
- RESPECTE L'HEURE DEMANDEE : Si le client dit "10h", verifie 10h, pas 16h
- ECOUTE LE CLIENT : Ne change pas arbitrairement ses choix
- Reponses courtes et claires, pas de bavardage`;
}

// Fonctions utilitaires pour les dates
function calculerDateRelative(joursAAjouter) {
  const date = new Date();
  date.setDate(date.getDate() + joursAAjouter);
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return `${jours[date.getDay()]} ${date.getDate()}/${date.getMonth()+1} (${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')})`;
}

function calculerProchainJour(jourCible) {
  // jourCible: 0=dimanche, 1=lundi, ... 6=samedi
  const now = new Date();
  const jourActuel = now.getDay();
  let joursAAjouter = jourCible - jourActuel;
  if (joursAAjouter <= 0) joursAAjouter += 7; // Prochain occurrence

  const date = new Date();
  date.setDate(date.getDate() + joursAAjouter);
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  return `${jours[date.getDay()]} ${date.getDate()}/${date.getMonth()+1} (${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')})`;
}

// ============================================
// FONCTION PRINCIPALE
// ============================================

// Stockage des conversations (en mémoire, à remplacer par Redis/DB en prod)
const conversations = new Map();

export async function chat(sessionId, userMessage, canal = 'chat', tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: chat requires explicit tenantId');
  }
  logger.info(`[HALIMAH AI] Session: ${sessionId}, Canal: ${canal}, Tenant: ${tenantId}`);
  logger.info(`[HALIMAH AI] Message: ${userMessage}`);

  // Récupérer ou créer l'historique
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, []);
  }
  const messages = conversations.get(sessionId);

  // Ajouter le message utilisateur
  messages.push({ role: 'user', content: userMessage });

  // Adapter le systeme prompt selon le canal (dynamique par tenant)
  let systemPrompt = await getSystemPrompt(tenantId);
  if (canal === 'phone') {
    // Utiliser le prompt vocal naturel optimise pour la synthese vocale
    systemPrompt = getVoicePrompt({
      includePrice: true,
      includeDate: true,
      includeAddress: true
    });
  }

  try {
    // Routage intelligent Haiku/Sonnet
    const routing = modelRouter.selectModel({
      userMessage: userMessage,
      context: { conversationLength: messages.length }
    });
    const selectedModel = routing.model;
    logger.info(`[HALIMAH AI] [ROUTER] ${selectedModel.includes('haiku') ? '⚡ HAIKU' : '🧠 SONNET'} — ${routing.reason}`);

    // Appel à Claude avec les outils (prompt caching = -90% input tokens)
    const cachedToolsDef = cachedTools(tools);
    let response = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: 1024,
      system: cachedSystem(systemPrompt),
      tools: cachedToolsDef,
      messages: messages
    });

    // Boucle pour gérer les appels d'outils
    while (response.stop_reason === 'tool_use') {
      // Trouver TOUS les tool_use blocks dans la réponse
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
      if (toolUseBlocks.length === 0) break;

      // Ajouter d'abord la réponse de l'assistant
      messages.push({ role: 'assistant', content: response.content });

      // Exécuter TOUS les outils et collecter les résultats
      const toolResults = [];
      for (const toolUseBlock of toolUseBlocks) {
        const toolResult = await executeTool(toolUseBlock.name, toolUseBlock.input, tenantId);
        logger.info(`[HALIMAH AI] Résultat outil ${toolUseBlock.name}:`, { toolResult });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify(toolResult)
        });
      }

      // Ajouter tous les résultats d'outils en une seule fois
      messages.push({ role: 'user', content: toolResults });

      // Continuer la conversation (cache hit sur system + tools)
      response = await anthropic.messages.create({
        model: MODEL_DEFAULT,
        max_tokens: 1024,
        system: cachedSystem(systemPrompt),
        tools: cachedToolsDef,
        messages: messages
      });
    }

    // Extraire la réponse textuelle
    const textBlock = response.content.find(block => block.type === 'text');
    const assistantMessage = textBlock ? textBlock.text : "Je suis désolée, je n'ai pas pu traiter votre demande.";

    // Sauvegarder la réponse dans l'historique (content complet pour maintenir le contexte)
    messages.push({ role: 'assistant', content: response.content });

    // Limiter l'historique à 20 messages
    if (messages.length > 20) {
      messages.splice(0, messages.length - 20);
    }

    logger.info(`[HALIMAH AI] Réponse: ${assistantMessage.substring(0, 100)}...`);

    return {
      success: true,
      response: assistantMessage,
      sessionId
    };

  } catch (error) {
    logger.error('[HALIMAH AI] Erreur:', { error });
    return {
      success: false,
      response: "Désolée, j'ai rencontré un problème technique. Pouvez-vous réessayer ?",
      error: error.message
    };
  }
}

// Nettoyer une session
export function clearSession(sessionId) {
  conversations.delete(sessionId);
}

export { SERVICES, HORAIRES, SALON_INFO, getSalonInfo, getSalonInfoSync };
