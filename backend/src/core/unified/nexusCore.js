/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║                                                                   ║
 * ║   🔒 NEXUS CORE UNIFIÉ - SERVICE CENTRAL                          ║
 * ║                                                                   ║
 * ║   TOUS les canaux DOIVENT passer par ce service.                 ║
 * ║   C'est la SEULE source de vérité.                               ║
 * ║                                                                   ║
 * ║   Canaux supportés:                                               ║
 * ║   - whatsapp : Messages WhatsApp                                  ║
 * ║   - web      : Chat web public                                    ║
 * ║   - phone    : Appels téléphoniques (Twilio Voice)               ║
 * ║   - sms      : SMS (Twilio)                                       ║
 * ║   - admin    : Halimah Pro (Dashboard admin)                     ║
 * ║                                                                   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import logger from '../../config/logger.js';

// 🔒 IMPORT DE LA SOURCE UNIQUE DE VÉRITÉ
import {
  SERVICES,
  TRAVEL_FEES,
  BUSINESS_HOURS,
  BOOKING_RULES,
  SERVICE_OPTIONS,
  AMBIGUOUS_TERMS,
  BLOCKING_STATUTS,  // 🔒 C3: Statuts bloquants unifiés
  validateBooking,
  findServiceByName,
  checkAmbiguousTerm,
  getServicesByCategory,
  getAllServices,
} from '../../config/businessRules.js';

import {
  validateBeforeCreate,
  calculateTotalPrice,
  getAvailableSlots,
  getConsecutiveBusinessDays,
} from '../../services/bookingValidator.js';

// 🔒 NOUVEAU: Validateur multi-tenant
import {
  validateBeforeCreateForTenant,
  checkBookingConflicts,
  findServiceForTenant,
} from '../TenantAwareValidator.js';

// 🆕 TEMPLATE ENGINE: Prompts et règles dynamiques par tenant
import { getEffectiveConfig, getFullAgentConfig } from '../../templates/templateLoader.js';
import { generateSystemPrompt as dynamicSystemPrompt } from '../../templates/promptEngine.js';

// 🎯 DEMO TENANT: Prompt commercial spécialisé
import { getDemoPrompt } from '../../prompts/demoAgentPrompt.js';

// 🤝 Reconnaissance client (accueil personnalisé)
import { recognizeClient } from '../../services/clientRecognition.js';
import {
  getServicesForTenant,
  findServiceByNameForTenant,
  getTravelFeesForTenant,
  calculateTravelFeeForTenant,
  getBusinessHoursForTenant,
  getBookingRulesForTenant,
} from '../../services/tenantBusinessRules.js';

// 🍽️ Restaurant availability
import { findAvailableTable, getTableAvailability, isRestaurantFull, getServiceType, getRestaurantCapacityForDay } from '../../services/restaurantAvailability.js';
import { getBusinessInfo, getBusinessInfoSync } from '../../services/tenantBusinessService.js';

// 📱 Notification de confirmation (cascade: Email → WhatsApp → SMS)
import { sendConfirmation as _sendConfirmationCascade } from '../../services/notificationService.js';

async function sendConfirmationNotification(tenantId, phone, details, clientEmail = null) {
  if (process.env.MOCK_SMS === 'true' || (process.env.NODE_ENV !== 'production' && !process.env.TWILIO_ACCOUNT_SID)) {
    const { envoyerConfirmation } = await import('../../../../tests/mocks/notificationService.mock.js');
    return envoyerConfirmation({
      client_telephone: phone,
      service_nom: details.service,
      date: details.date,
      heure: details.heure,
      prix_total: (details.prixTotal || 0) * 100,
    });
  }
  // Cascade: Email → WhatsApp → SMS (comme les rappels J-1)
  return _sendConfirmationCascade({
    client_telephone: phone,
    client_email: clientEmail,
    service_nom: details.service,
    date: details.date,
    heure: details.heure,
    total: details.prixTotal || 0,
    prix_service: details.prixTotal || 0,
    frais_deplacement: details.fraisDeplacement || 0,
    adresse_client: details.adresse,
  }, 0, tenantId);
}

// 🔧 TOOLS REGISTRY - Source unique des outils + filtrage par business type
import { TOOLS_CLIENT, getToolsForPlanAndBusiness } from '../../tools/toolsRegistry.js';

// 🏢 MULTI-TENANT - Loader de configuration par tenant
import { getTenantConfig, identifyTenant } from '../../config/tenants/index.js';

// 📊 SENTINEL - Suivi des coûts par tenant
import { trackTenantCall } from '../../sentinel/monitors/tenantCostTracker.js';

// 📍 Calcul de distance - import statique
import * as googleMapsService from '../../services/googleMapsService.js';
const getDistanceFromSalon = googleMapsService.getDistanceFromSalon || null;

// 💰 OPTIMISATION COÛTS - Réduction 88%
import modelRouter, { MODELS as ROUTER_MODELS } from '../../services/modelRouter.js';
import promptOptimizer from '../../services/promptOptimizer.js';
import responseCache from '../../services/responseCache.js';

// 🫀 NEXUS PULSE - Événements temps réel
import liveEventStream from '../../services/liveEventStream.js';
import { registerInterval } from '../../utils/intervalRegistry.js';

// ============================================
// CONFIGURATION
// ============================================

// Modèles centralisés dans modelRouter.js (source unique de vérité)
const CLAUDE_HAIKU = ROUTER_MODELS.HAIKU;
const CLAUDE_SONNET = ROUTER_MODELS.SONNET;
const MAX_TOKENS = 1024;

// ============================================
// SÉLECTION ADAPTATIVE DU MODÈLE
// ============================================
// Déléguée à modelRouter.selectModel() — source unique de vérité
// Voir backend/src/services/modelRouter.js

// 🔒 C5: Cache sécurisé - TTL réduit pour éviter les race conditions
// ⚠️ TODO: Remplacer par Redis en production pour invalidation synchrone
const cache = new Map();
const CACHE_TTL_MS = 30 * 1000; // 🔒 Réduit de 5min à 30sec pour MVP
const CACHE_VERSION = { value: 0 }; // Incrémenté à chaque modification

// Incrémenter la version du cache (invalide toutes les entrées de disponibilité)
function bumpCacheVersion() {
  CACHE_VERSION.value++;
  console.log(`[CACHE] Version bumped to ${CACHE_VERSION.value}`);
}

// Supabase client singleton
let supabaseClient = null;
function getSupabase() {
  if (!supabaseClient && process.env.SUPABASE_URL) {
    supabaseClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
  }
  return supabaseClient;
}

// Anthropic client singleton
let anthropicClient = null;
function getAnthropic() {
  if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }
  return anthropicClient;
}

// ============================================
// INFORMATIONS BUSINESS - DYNAMIQUES PAR TENANT
// ============================================

/**
 * Charge les informations business d'un tenant depuis la config/DB.
 * REMPLACE l'ancien SALON_INFO hardcode.
 *
 * @param {string} tenantId - ID du tenant (OBLIGATOIRE)
 * @returns {Promise<Object>} Infos business du tenant
 */
async function getBusinessInfoForTenant(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: getBusinessInfoForTenant requires explicit tenantId');
  }

  const info = await getBusinessInfo(tenantId);
  return {
    nom: info.nom || tenantId,
    concept: info.businessTypeLabel || '',
    gerante: info.gerant || '',
    adresse: info.adresse || '',
    telephone: info.telephone || '',
    whatsapp: info.whatsapp || '',
    email: info.email || '',
    businessType: info.businessType || 'salon',
    locationMode: info.locationMode || 'fixed',
    travelFeesEnabled: info.travelFees?.enabled || false,
  };
}

/**
 * Version synchrone (cache only, pas d'appel DB).
 * Pour les contextes ou async n'est pas possible.
 */
function getBusinessInfoForTenantSync(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: getBusinessInfoForTenantSync requires explicit tenantId');
  }

  const info = getBusinessInfoSync(tenantId);
  return {
    nom: info.nom || tenantId,
    concept: info.businessTypeLabel || '',
    gerante: info.gerant || '',
    adresse: info.adresse || '',
    telephone: info.telephone || '',
    whatsapp: info.whatsapp || '',
    email: info.email || '',
    businessType: info.businessType || 'salon',
    locationMode: info.locationMode || 'fixed',
    travelFeesEnabled: info.travelFees?.enabled || false,
  };
}

// @deprecated - SALON_INFO est maintenu pour compatibilite avec les imports existants.
// Les appelants DOIVENT migrer vers getBusinessInfoForTenant(tenantId).
export const SALON_INFO = Object.freeze({
  nom: '[DEPRECATED - use getBusinessInfoForTenant(tenantId)]',
  concept: '',
  gerante: '',
  adresse: '',
  telephone: '',
  telephoneTwilio: '',
  peutRecevoirChezElle: false
});

// ============================================
// CACHE HELPER FUNCTIONS
// ============================================

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  // 🔒 C5: Vérifier expiration ET version
  if (Date.now() > item.expiresAt || item.version !== CACHE_VERSION.value) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data, ttlMs = CACHE_TTL_MS) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    version: CACHE_VERSION.value  // 🔒 Associer à la version courante
  });
}

function invalidateCache(pattern) {
  // 🔒 C5: Invalidation par pattern + bump de version
  let deleted = 0;
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
      deleted++;
    }
  }
  if (deleted > 0) {
    bumpCacheVersion(); // Invalider globalement aussi
  }
}

// ============================================
// OUTILS IA - Importés depuis toolsRegistry.js
// ============================================
// Note: TOOLS_CLIENT est importé depuis '../../tools/toolsRegistry.js'

// ============================================
// TENANT CONFIG LOADER
// ============================================
// 🔒 TENANT ISOLATION: Charge la config d'un tenant depuis la DB
async function getTenantConfigById(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: getTenantConfigById requires explicit tenantId');
  }

  const cacheKey = `tenant_config_${tenantId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const db = getSupabase();
  if (!db) {
    logger.warn('Supabase non disponible, utilisation fallback', { tag: 'NEXUS CORE' });
    return null;
  }

  try {
    const { data: tenant, error } = await db
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error || !tenant) {
      logger.warn('Tenant non trouvé', { tag: 'NEXUS CORE', tenantId });
      return null;
    }

    // Normaliser la config
    const config = {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      domain: tenant.domain,
      concept: tenant.concept,
      gerante: tenant.gerante,
      adresse: tenant.adresse,
      telephone: tenant.telephone,
      ville: tenant.ville,
      secteur: tenant.secteur_id,
      template_id: tenant.template_id || 'salon',
      assistant_name: tenant.assistant_name || 'l\'assistant',
      assistant_gender: tenant.assistant_gender || 'F',
      personality: tenant.personality || {},
      business_hours: tenant.business_hours || {},
      service_options: tenant.service_options || {},
      prompt_overrides: tenant.prompt_overrides || {},
      voice_config: tenant.voice_config || {},
      features: tenant.features || {},
      branding: tenant.branding || {},
    };

    setCache(cacheKey, config, 5 * 60 * 1000); // Cache 5 min
    return config;
  } catch (err) {
    logger.error('Erreur chargement tenant', { tag: 'NEXUS CORE', tenantId, error: err.message });
    return null;
  }
}

// ============================================
// IMPLÉMENTATION DES OUTILS
// ============================================

async function executeTool(toolName, toolInput, channel, tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: executeTool requires explicit tenantId');
  }
  const startTime = Date.now();
  console.log(`[NEXUS CORE] 🔧 ${channel} → ${toolName} (tenant: ${tenantId})`, JSON.stringify(toolInput).substring(0, 100));

  try {
    let result;

    switch (toolName) {
      case 'parse_date':
        result = parseDate(toolInput.date_text, toolInput.heure);
        break;

      case 'get_services':
        // 🔒 TENANT ISOLATION: Services dynamiques par tenant
        result = await getServicesFormatted(toolInput.categorie, tenantId);
        break;

      case 'get_price':
        // 🔒 TENANT ISOLATION: Prix dynamiques par tenant
        result = await getPriceForService(toolInput.service_name, tenantId);
        break;

      case 'check_availability':
        result = await checkAvailabilityUnified(toolInput.date, toolInput.heure, toolInput.service_name, tenantId);
        break;

      case 'get_available_slots':
        result = await getAvailableSlotsUnified(toolInput.date, toolInput.service_name, tenantId);
        break;

      case 'calculate_travel_fee':
        // 🔒 TENANT ISOLATION: Frais de déplacement dynamiques par tenant
        result = await calculateTravelFeeUnified(toolInput.distance_km, tenantId);
        break;

      case 'create_booking':
        console.log(`\n🔍 ════════════════════════════════════════════════════════`);
        console.log(`🔍 STEP BOOKING 1: Tool create_booking APPELÉ`);
        console.log(`🔍 Channel: ${channel}, Tenant: ${tenantId}`);
        console.log(`🔍 Input reçu:`, JSON.stringify(toolInput, null, 2));
        console.log(`🔍 ════════════════════════════════════════════════════════`);
        // 🔒 TENANT ISOLATION: Injecter tenant_id dans toolInput
        result = await createBookingUnified({ ...toolInput, tenant_id: tenantId }, channel);
        console.log(`\n🔍 ════════════════════════════════════════════════════════`);
        console.log(`🔍 STEP BOOKING 5: Résultat final create_booking`);
        console.log(`🔍 Success: ${result?.success}`);
        console.log(`🔍 Error: ${result?.error || 'aucune'}`);
        console.log(`🔍 Errors array: ${result?.errors?.join(', ') || 'aucune'}`);
        console.log(`🔍 ReservationId: ${result?.reservationId || 'N/A'}`);
        console.log(`🔍 ════════════════════════════════════════════════════════\n`);
        break;

      case 'find_appointment':
        // 🔒 TENANT ISOLATION: Passer tenantId pour filtrer par tenant
        result = await findAppointmentByPhone(toolInput.telephone, tenantId);
        break;

      case 'cancel_appointment':
        // 🔒 TENANT ISOLATION: Passer tenantId pour vérifier la propriété
        result = await cancelAppointmentById(toolInput.appointment_id, toolInput.reason, tenantId);
        break;

      case 'get_salon_info':
        // 🔒 TENANT ISOLATION: Infos business dynamiques par tenant
        result = await getBusinessInfoUnified(tenantId);
        break;

      case 'get_business_hours':
        // 🔒 TENANT ISOLATION: Horaires dynamiques par tenant
        result = await getBusinessHoursUnified(toolInput.jour, tenantId);
        break;

      case 'check_table_availability':
        result = await checkTableAvailabilityTool(toolInput.date, toolInput.heure, toolInput.nb_couverts, tenantId);
        break;

      case 'get_restaurant_info':
        result = await getRestaurantInfoTool(tenantId);
        break;

      case 'get_menu':
        result = await getMenuTool(tenantId, toolInput.categorie, toolInput.service, toolInput.regime);
        break;

      case 'get_menu_du_jour':
        result = await getMenuDuJourTool(tenantId, toolInput.service);
        break;

      case 'check_allergenes':
        result = await checkAllergenesTool(tenantId, toolInput.plat_nom, toolInput.allergene_a_eviter);
        break;

      case 'get_hotel_info':
        result = await getHotelInfoTool(tenantId);
        break;

      case 'get_chambres_disponibles':
        result = await getChambresDisponiblesTool(tenantId, toolInput.type_chambre, toolInput.nb_personnes);
        break;

      case 'check_room_availability':
        result = await checkRoomAvailabilityTool(tenantId, toolInput.date_arrivee, toolInput.date_depart, toolInput.nb_personnes, toolInput.type_chambre);
        break;

      case 'get_upcoming_days':
        result = await getUpcomingDays(toolInput.nb_jours, tenantId);
        break;

      default:
        result = { success: false, error: `Outil inconnu: ${toolName}` };
    }

    const duration = Date.now() - startTime;
    console.log(`[NEXUS CORE] ✓ ${toolName} (${duration}ms)`);

    return result;

  } catch (error) {
    console.error(`[NEXUS CORE] ✗ ${toolName} erreur:`, error.message);
    return { success: false, error: error.message };
  }
}

// --- GET UPCOMING DAYS ---
// IMPORTANT: Cette fonction retourne les dates EXACTES pour éviter les erreurs de calcul de l'IA
// 🔒 TENANT ISOLATION: Filtre par tenant_id pour éviter les conflits inter-tenants
async function getUpcomingDays(nbJours = 14, tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: getUpcomingDays requires explicit tenantId');
  }
  const JOURS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // Limiter à 60 jours max
  const limit = Math.min(Math.max(nbJours || 14, 1), 60);

  const now = new Date();
  now.setHours(12, 0, 0, 0); // Midi pour éviter les problèmes de timezone

  const today = now.toISOString().split('T')[0];
  const jourActuel = JOURS_FR[now.getDay()];
  const dateActuelleFormatee = `${jourActuel} ${now.getDate()} ${MOIS_FR[now.getMonth()]} ${now.getFullYear()}`;

  // Calculer la date de fin pour la requête
  const endDate = new Date(now);
  endDate.setDate(now.getDate() + limit);
  const endDateISO = endDate.toISOString().split('T')[0];

  // 🔧 Récupérer toutes les réservations de la période en une seule requête
  // 🔒 TENANT ISOLATION: Filtre par tenant_id
  let allReservations = [];
  const db = getSupabase();
  if (db) {
    const { data } = await db
      .from('reservations')
      .select('date, heure, duree_minutes, statut')
      .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
      .gte('date', today)
      .lte('date', endDateISO)
      .in('statut', BLOCKING_STATUTS);
    allReservations = data || [];
    console.log(`[NEXUS CORE] 📅 getUpcomingDays: ${allReservations.length} réservations trouvées pour tenant ${tenantId}`);
  }

  // Indexer les réservations par date
  const resByDate = {};
  for (const r of allReservations) {
    if (!resByDate[r.date]) resByDate[r.date] = [];
    resByDate[r.date].push(r);
  }

  const jours = [];

  for (let i = 0; i < limit; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    date.setHours(12, 0, 0, 0); // Garder midi pour éviter décalage

    const dateISO = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const jourNom = JOURS_FR[dayOfWeek];
    const jourNum = date.getDate();
    const moisNom = MOIS_FR[date.getMonth()];

    // Récupérer les horaires depuis BUSINESS_HOURS
    const hours = BUSINESS_HOURS.getHours(dayOfWeek);
    const estOuvert = hours !== null;

    const jour = {
      date: dateISO,
      jour: jourNom,
      jourNum: jourNum,
      mois: moisNom,
      dateFormatee: `${jourNom} ${jourNum} ${moisNom}`,
      ouvert: estOuvert,
      horaires: estOuvert ? `${hours.open} - ${hours.close}` : 'Fermé',
      heureOuverture: estOuvert ? hours.open : null,
      heureFermeture: estOuvert ? hours.close : null
    };

    // 🔧 Calculer l'occupation pour les jours ouverts
    if (estOuvert) {
      jour.occupation = calculateOccupation(hours, resByDate[dateISO] || []);
    }

    jours.push(jour);
  }

  // 🍽️ Restaurant: enrichir avec la capacité par service (midi/soir)
  let isRestaurant = false;
  try {
    const bizInfo = await getBusinessInfo(tenantId);
    isRestaurant = bizInfo.businessType === 'restaurant';
  } catch (e) { /* pas grave */ }

  if (isRestaurant) {
    for (const jour of jours) {
      if (jour.ouvert) {
        try {
          const capacity = await getRestaurantCapacityForDay(tenantId, jour.date);
          jour.restaurant = capacity;
          // Enrichir le résumé avec les infos restaurant
          const midiInfo = capacity.midi;
          const soirInfo = capacity.soir;
          const parts = [];
          if (midiInfo) {
            parts.push(midiInfo.complet
              ? 'Midi: COMPLET'
              : `Midi: ${midiInfo.tables_libres}/${midiInfo.total_tables} tables (${midiInfo.couverts_disponibles} couverts dispo)`);
          }
          if (soirInfo) {
            parts.push(soirInfo.complet
              ? 'Soir: COMPLET'
              : `Soir: ${soirInfo.tables_libres}/${soirInfo.total_tables} tables (${soirInfo.couverts_disponibles} couverts dispo)`);
          }
          if (parts.length > 0) {
            jour.occupation = jour.occupation || {};
            jour.occupation.restaurant_resume = parts.join(' | ');
            jour.occupation.resume = parts.join(' | ');
          }
        } catch (e) {
          // Tables pas configurées, pas grave
        }
      }
    }
  }

  return {
    success: true,
    aujourd_hui: today,
    jour_actuel: jourActuel,
    date_actuelle_formatee: dateActuelleFormatee,
    nb_jours: limit,
    jours: jours,
    is_restaurant: isRestaurant,
    instruction: isRestaurant
      ? "Utilise ces dates EXACTES. Pour chaque jour, vérifie la capacité midi/soir. Si un service est COMPLET, propose l'autre ou un autre jour. Utilise check_table_availability avant create_booking."
      : "Utilise ces dates EXACTES. Ne calcule JAMAIS les dates toi-même. Utilise occupation.resume pour informer le client sur l'état de chaque jour."
  };
}

// 🔧 Calcul d'occupation d'une journée
function calculateOccupation(hours, reservations) {
  const toMin = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const toHHMM = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h${m > 0 ? (m < 10 ? '0' + m : m) : '00'}`;
  };

  const openMin = toMin(hours.open);
  const closeMin = toMin(hours.close);
  const totalMinutes = closeMin - openMin;

  if (reservations.length === 0) {
    return {
      statut: 'libre',
      pourcentage: 0,
      minutesLibres: totalMinutes,
      plagesLibres: [`${toHHMM(openMin)}-${toHHMM(closeMin)}`],
      resume: `Libre toute la journée (${hours.open} - ${hours.close}).`
    };
  }

  // Construire les plages occupées (clampées aux horaires d'ouverture)
  const occupied = reservations.map(r => {
    const start = toMin(r.heure);
    const end = start + (r.duree_minutes || 60);
    return { start: Math.max(start, openMin), end: Math.min(end, closeMin) };
  }).filter(r => r.start < r.end).sort((a, b) => a.start - b.start);

  // Fusionner les plages qui se chevauchent
  const merged = [];
  for (const slot of occupied) {
    if (merged.length > 0 && slot.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, slot.end);
    } else {
      merged.push({ ...slot });
    }
  }

  // Calculer minutes occupées
  const minutesOccupees = merged.reduce((sum, s) => sum + (s.end - s.start), 0);
  const minutesLibres = totalMinutes - minutesOccupees;
  const pourcentage = Math.round((minutesOccupees / totalMinutes) * 100);

  // Identifier les plages libres
  const plagesLibres = [];
  let cursor = openMin;
  for (const slot of merged) {
    if (cursor < slot.start) {
      plagesLibres.push(`${toHHMM(cursor)}-${toHHMM(slot.start)}`);
    }
    cursor = Math.max(cursor, slot.end);
  }
  if (cursor < closeMin) {
    plagesLibres.push(`${toHHMM(cursor)}-${toHHMM(closeMin)}`);
  }

  // Vérifier s'il existe au moins un créneau d'1h libre
  const hasOneHourSlot = plagesLibres.some(p => {
    const [startStr, endStr] = p.split('-');
    const s = toMin(startStr.replace('h', ':').replace(/(\d+):(\d+)/, '$1:$2'));
    const e = toMin(endStr.replace('h', ':').replace(/(\d+):(\d+)/, '$1:$2'));
    return (e - s) >= 60;
  });

  // Déterminer le statut
  let statut;
  if (pourcentage > 95 || !hasOneHourSlot) {
    statut = 'complet';
  } else if (pourcentage >= 70) {
    statut = 'presque_complet';
  } else if (pourcentage >= 20) {
    statut = 'partiel';
  } else {
    statut = 'libre';
  }

  // Résumé en français
  let resume;
  if (statut === 'complet') {
    resume = 'Complet. Aucun créneau disponible.';
  } else if (statut === 'presque_complet') {
    resume = `Presque complet. Créneaux libres : ${plagesLibres.join(' et ')}.`;
  } else if (statut === 'partiel') {
    resume = `Partiellement occupé. Créneaux libres : ${plagesLibres.join(', ')}.`;
  } else {
    resume = `Libre toute la journée (${hours.open} - ${hours.close}).`;
  }

  return { statut, pourcentage, minutesLibres, plagesLibres, resume };
}

// --- CHECK TABLE AVAILABILITY (Restaurant) ---
// 🔒 TENANT ISOLATION: Filtre par tenant_id
async function checkTableAvailabilityTool(date, heure, nbCouverts, tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: checkTableAvailabilityTool requires explicit tenantId');
  }

  try {
    const result = await findAvailableTable(tenantId, date, heure, nbCouverts);

    if (!result.success) {
      return {
        success: false,
        disponible: false,
        message: result.error,
        capacite: result.totals || null
      };
    }

    const serviceType = getServiceType(heure);

    return {
      success: true,
      disponible: true,
      table_suggeree: {
        nom: result.table.nom,
        capacite: result.table.capacite,
        zone: result.table.zone
      },
      alternatives: result.alternatives.map(t => ({
        nom: t.nom,
        capacite: t.capacite,
        zone: t.zone
      })),
      service_type: serviceType,
      capacite: {
        tables_libres: result.totals.tables_libres,
        total_tables: result.totals.total_tables,
        couverts_disponibles: result.totals.couverts_disponibles
      },
      message: `Table ${result.table.nom} disponible (${result.table.capacite} places, ${result.table.zone}). ${result.totals.tables_libres}/${result.totals.total_tables} tables libres.`
    };
  } catch (err) {
    console.error('[NEXUS CORE] checkTableAvailability error:', err.message);
    return { success: false, error: err.message };
  }
}

// --- GET RESTAURANT INFO (texte libre renseigné par l'admin) ---
// 🔒 TENANT ISOLATION: Filtre par tenant_id
async function getRestaurantInfoTool(tenantId) {
  if (!tenantId) throw new Error('TENANT_ID_REQUIRED');

  const db = getSupabase();
  if (!db) return { success: false, error: 'Base de données non disponible' };

  try {
    // Lire profile_config du tenant (champ JSONB)
    const { data: tenant, error } = await db
      .from('tenants')
      .select('name, profile_config, adresse, telephone, email')
      .eq('id', tenantId)
      .single();

    if (error) throw error;

    const config = tenant?.profile_config || {};
    const info = config.restaurant_info || null;

    if (!info) {
      return {
        success: true,
        disponible: false,
        nom: tenant?.name || '',
        adresse: tenant?.adresse || '',
        telephone: tenant?.telephone || '',
        message: "Le gérant n'a pas encore renseigné les informations détaillées du restaurant. Vous pouvez consulter la carte avec get_menu ou proposer de réserver une table."
      };
    }

    return {
      success: true,
      disponible: true,
      nom: tenant?.name || '',
      adresse: tenant?.adresse || '',
      telephone: tenant?.telephone || '',
      informations: info,
      instruction: "Utilise ces informations pour répondre aux questions du client. Ne modifie pas le contenu, transmets fidèlement ce que le gérant a renseigné."
    };
  } catch (err) {
    console.error('[NEXUS CORE] getRestaurantInfo error:', err.message);
    return { success: false, error: err.message };
  }
}

// --- GET MENU (Restaurant) ---
// 🔒 TENANT ISOLATION: Filtre par tenant_id
async function getMenuTool(tenantId, categorie = null, service = null, regime = null) {
  if (!tenantId) throw new Error('TENANT_ID_REQUIRED');

  const db = getSupabase();
  if (!db) return { success: false, error: 'Base de données non disponible' };

  try {
    // Charger les catégories
    const { data: categories } = await db
      .from('menu_categories')
      .select('id, nom, description, ordre')
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .order('ordre', { ascending: true });

    // Charger les plats
    let platsQuery = db
      .from('plats')
      .select('id, nom, description, prix, allergenes, regime, disponible_midi, disponible_soir, plat_du_jour, categorie_id, image_url, stock_limite, stock_quantite')
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .order('ordre', { ascending: true });

    const { data: plats } = await platsQuery;

    if (!plats || plats.length === 0) {
      return { success: true, message: 'La carte n\'est pas encore disponible.', categories: [], plats: [] };
    }

    // Filtrer par service (midi/soir)
    let filteredPlats = plats;
    if (service === 'midi') {
      filteredPlats = filteredPlats.filter(p => p.disponible_midi);
    } else if (service === 'soir') {
      filteredPlats = filteredPlats.filter(p => p.disponible_soir);
    }

    // Filtrer par régime
    if (regime) {
      filteredPlats = filteredPlats.filter(p => p.regime && p.regime.includes(regime));
    }

    // Filtrer par catégorie (recherche flexible)
    if (categorie) {
      const catLower = categorie.toLowerCase();
      const matchingCat = (categories || []).find(c => c.nom.toLowerCase().includes(catLower));
      if (matchingCat) {
        filteredPlats = filteredPlats.filter(p => p.categorie_id === matchingCat.id);
      }
    }

    // Formater pour l'IA
    const menuByCategory = {};
    for (const plat of filteredPlats) {
      const cat = (categories || []).find(c => c.id === plat.categorie_id);
      const catName = cat?.nom || 'Autres';

      if (!menuByCategory[catName]) menuByCategory[catName] = [];

      const platInfo = {
        nom: plat.nom,
        prix: `${(plat.prix / 100).toFixed(2)}€`,
        description: plat.description || null
      };

      if (plat.allergenes && plat.allergenes.length > 0) {
        platInfo.allergenes = plat.allergenes;
      }
      if (plat.regime && plat.regime.length > 0) {
        platInfo.regime = plat.regime;
      }
      if (plat.plat_du_jour) {
        platInfo.plat_du_jour = true;
      }
      if (plat.stock_limite && plat.stock_quantite <= 0) {
        platInfo.rupture = true;
      }

      menuByCategory[catName].push(platInfo);
    }

    return {
      success: true,
      menu: menuByCategory,
      total_plats: filteredPlats.length,
      plats_du_jour: filteredPlats.filter(p => p.plat_du_jour).map(p => p.nom),
      regimes_disponibles: [...new Set(filteredPlats.flatMap(p => p.regime || []))],
      message: `La carte propose ${filteredPlats.length} plat(s) dans ${Object.keys(menuByCategory).length} catégorie(s).`
    };
  } catch (err) {
    console.error('[NEXUS CORE] getMenu error:', err.message);
    return { success: false, error: err.message };
  }
}

// --- GET MENU DU JOUR (Restaurant) ---
// 🔒 TENANT ISOLATION: Filtre par tenant_id
async function getMenuDuJourTool(tenantId, service = null) {
  if (!tenantId) throw new Error('TENANT_ID_REQUIRED');

  const db = getSupabase();
  if (!db) return { success: false, error: 'Base de données non disponible' };

  try {
    const today = new Date().toISOString().split('T')[0];

    // Déterminer le service selon l'heure si non spécifié
    if (!service) {
      const hour = new Date().getHours();
      service = hour < 15 ? 'midi' : 'soir';
    }

    // Chercher le menu du jour
    const { data: menuDuJour } = await db
      .from('menu_du_jour')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('date', today)
      .eq('actif', true)
      .in('service', [service, 'midi_soir'])
      .order('service', { ascending: true })
      .limit(1)
      .maybeSingle();

    // Aussi récupérer les plats marqués "plat du jour"
    const { data: platsDuJour } = await db
      .from('plats')
      .select('id, nom, description, prix, allergenes, regime, categorie_id')
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .eq('plat_du_jour', true);

    if (!menuDuJour && (!platsDuJour || platsDuJour.length === 0)) {
      return {
        success: true,
        disponible: false,
        message: `Pas de menu du jour configuré pour aujourd'hui (${service}). Consultez la carte avec get_menu.`
      };
    }

    const result = {
      success: true,
      disponible: true,
      date: today,
      service
    };

    // Menu du jour avec formules
    if (menuDuJour) {
      result.formules = {};
      if (menuDuJour.formule_entree_plat > 0) {
        result.formules.entree_plat = `${(menuDuJour.formule_entree_plat / 100).toFixed(2)}€`;
      }
      if (menuDuJour.formule_plat_dessert > 0) {
        result.formules.plat_dessert = `${(menuDuJour.formule_plat_dessert / 100).toFixed(2)}€`;
      }
      if (menuDuJour.formule_complete > 0) {
        result.formules.complete = `${(menuDuJour.formule_complete / 100).toFixed(2)}€`;
      }
      if (menuDuJour.notes) {
        result.notes = menuDuJour.notes;
      }

      // Charger les détails des plats du menu
      const allIds = [
        ...(menuDuJour.entrees || []),
        ...(menuDuJour.plats || []),
        ...(menuDuJour.desserts || [])
      ].filter(Boolean);

      if (allIds.length > 0) {
        const { data: platsDetails } = await db
          .from('plats')
          .select('id, nom, description, prix, allergenes, regime')
          .eq('tenant_id', tenantId)
          .in('id', allIds);

        const findPlat = (id) => platsDetails?.find(p => p.id === id);

        if (menuDuJour.entrees?.length) {
          result.entrees = menuDuJour.entrees.map(id => {
            const p = findPlat(id);
            return p ? { nom: p.nom, description: p.description, allergenes: p.allergenes } : null;
          }).filter(Boolean);
        }
        if (menuDuJour.plats?.length) {
          result.plats_principaux = menuDuJour.plats.map(id => {
            const p = findPlat(id);
            return p ? { nom: p.nom, description: p.description, allergenes: p.allergenes } : null;
          }).filter(Boolean);
        }
        if (menuDuJour.desserts?.length) {
          result.desserts = menuDuJour.desserts.map(id => {
            const p = findPlat(id);
            return p ? { nom: p.nom, description: p.description, allergenes: p.allergenes } : null;
          }).filter(Boolean);
        }
      }
    }

    // Plats marqués "du jour" (en plus ou à la place du menu formel)
    if (platsDuJour && platsDuJour.length > 0) {
      result.suggestions_du_chef = platsDuJour.map(p => ({
        nom: p.nom,
        description: p.description,
        prix: `${(p.prix / 100).toFixed(2)}€`,
        allergenes: p.allergenes
      }));
    }

    return result;
  } catch (err) {
    console.error('[NEXUS CORE] getMenuDuJour error:', err.message);
    return { success: false, error: err.message };
  }
}

// --- CHECK ALLERGENES (Restaurant) ---
// 🔒 TENANT ISOLATION: Filtre par tenant_id
async function checkAllergenesTool(tenantId, platNom = null, allergeneAEviter = null) {
  if (!tenantId) throw new Error('TENANT_ID_REQUIRED');

  const db = getSupabase();
  if (!db) return { success: false, error: 'Base de données non disponible' };

  try {
    // Cas 1: Vérifier les allergènes d'un plat spécifique
    if (platNom) {
      const { data: plats } = await db
        .from('plats')
        .select('nom, allergenes, regime, description')
        .eq('tenant_id', tenantId)
        .eq('actif', true)
        .ilike('nom', `%${platNom}%`)
        .limit(3);

      if (!plats || plats.length === 0) {
        return { success: true, message: `Plat "${platNom}" non trouvé dans la carte.` };
      }

      return {
        success: true,
        resultats: plats.map(p => ({
          nom: p.nom,
          allergenes: p.allergenes?.length ? p.allergenes : ['Aucun allergène renseigné'],
          regime: p.regime?.length ? p.regime : [],
          description: p.description
        }))
      };
    }

    // Cas 2: Trouver des plats sans un allergène donné
    if (allergeneAEviter) {
      const { data: allPlats } = await db
        .from('plats')
        .select('nom, prix, allergenes, regime, description, categorie_id')
        .eq('tenant_id', tenantId)
        .eq('actif', true);

      // Filtrer côté JS (Postgres array NOT contains)
      const safePlats = (allPlats || []).filter(p => {
        if (!p.allergenes || p.allergenes.length === 0) return true;
        return !p.allergenes.includes(allergeneAEviter);
      });

      return {
        success: true,
        allergene_evite: allergeneAEviter,
        plats_compatibles: safePlats.map(p => ({
          nom: p.nom,
          prix: `${(p.prix / 100).toFixed(2)}€`,
          description: p.description,
          allergenes: p.allergenes || []
        })),
        total: safePlats.length,
        message: `${safePlats.length} plat(s) sans ${allergeneAEviter} disponible(s).`
      };
    }

    return { success: false, error: 'Spécifiez un plat à vérifier ou un allergène à éviter.' };
  } catch (err) {
    console.error('[NEXUS CORE] checkAllergenes error:', err.message);
    return { success: false, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL TOOLS
// ══════════════════════════════════════════════════════════════════════════════

async function getHotelInfoTool(tenantId) {
  try {
    const { data: tenant, error } = await db
      .from('tenants')
      .select('name, profile_config, adresse, telephone, email')
      .eq('id', tenantId)
      .single();

    if (error) throw error;

    const config = tenant?.profile_config || {};
    const info = config.hotel_info || null;

    if (!info) {
      return {
        success: true,
        disponible: false,
        message: "Le gérant n'a pas encore renseigné les informations détaillées de l'hôtel. Vous pouvez indiquer au client les coordonnées de base.",
        etablissement: { nom: tenant?.name, adresse: tenant?.adresse, telephone: tenant?.telephone, email: tenant?.email }
      };
    }

    return {
      success: true,
      disponible: true,
      informations: info,
      etablissement: { nom: tenant?.name, adresse: tenant?.adresse, telephone: tenant?.telephone },
      instruction: "Utilise ces informations pour répondre aux questions du client sur l'hôtel. Ne mentionne pas que tu lis un champ technique."
    };
  } catch (err) {
    console.error('[NEXUS CORE] getHotelInfo error:', err.message);
    return { success: false, error: err.message };
  }
}

async function getChambresDisponiblesTool(tenantId, typeChambre = null, nbPersonnes = null) {
  try {
    let query = db
      .from('services')
      .select('id, nom, description, prix, duree, capacite, capacite_max, type_chambre, etage, vue, equipements, actif')
      .eq('tenant_id', tenantId)
      .not('type_chambre', 'is', null)
      .eq('actif', true)
      .order('type_chambre')
      .order('nom');

    if (typeChambre) {
      query = query.eq('type_chambre', typeChambre);
    }
    if (nbPersonnes) {
      query = query.gte('capacite_max', nbPersonnes);
    }

    const { data: chambres, error } = await query;
    if (error) throw error;

    if (!chambres || chambres.length === 0) {
      return {
        success: true,
        chambres: [],
        message: nbPersonnes
          ? `Aucune chambre disponible pour ${nbPersonnes} personne(s).`
          : "Aucune chambre n'est configurée pour cet hôtel."
      };
    }

    // Charger les tarifs saisonniers pour chaque chambre
    const serviceIds = chambres.map(c => c.id);
    const today = new Date().toISOString().split('T')[0];
    const { data: tarifs } = await db
      .from('tarifs_saisonniers')
      .select('service_id, nom, prix_nuit, prix_weekend, prix_petit_dejeuner, petit_dejeuner_inclus, date_debut, date_fin')
      .eq('tenant_id', tenantId)
      .in('service_id', serviceIds)
      .lte('date_debut', today)
      .gte('date_fin', today)
      .eq('actif', true);

    const tarifMap = {};
    (tarifs || []).forEach(t => {
      tarifMap[t.service_id] = t;
    });

    const result = chambres.map(c => {
      const tarif = tarifMap[c.id];
      return {
        nom: c.nom,
        type: c.type_chambre,
        capacite: c.capacite_max || c.capacite || 2,
        etage: c.etage,
        vue: c.vue,
        equipements: c.equipements || [],
        prix_nuit: tarif ? `${(tarif.prix_nuit / 100).toFixed(0)}€` : `${(c.prix / 100).toFixed(0)}€`,
        prix_weekend: tarif?.prix_weekend ? `${(tarif.prix_weekend / 100).toFixed(0)}€` : null,
        petit_dejeuner: tarif?.petit_dejeuner_inclus ? 'Inclus' : (tarif?.prix_petit_dejeuner ? `${(tarif.prix_petit_dejeuner / 100).toFixed(0)}€/pers` : null),
        saison: tarif?.nom || null
      };
    });

    return {
      success: true,
      chambres: result,
      total: result.length,
      message: `${result.length} chambre(s) disponible(s).`
    };
  } catch (err) {
    console.error('[NEXUS CORE] getChambresDisponibles error:', err.message);
    return { success: false, error: err.message };
  }
}

async function checkRoomAvailabilityTool(tenantId, dateArrivee, dateDepart, nbPersonnes = null, typeChambre = null) {
  try {
    if (!dateArrivee || !dateDepart) {
      return { success: false, error: "Les dates d'arrivée et de départ sont requises." };
    }

    // 1. Récupérer toutes les chambres actives
    let roomQuery = db
      .from('services')
      .select('id, nom, description, prix, capacite_max, type_chambre, etage, vue, equipements')
      .eq('tenant_id', tenantId)
      .not('type_chambre', 'is', null)
      .eq('actif', true);

    if (typeChambre) roomQuery = roomQuery.eq('type_chambre', typeChambre);
    if (nbPersonnes) roomQuery = roomQuery.gte('capacite_max', nbPersonnes);

    const { data: allRooms, error: roomErr } = await roomQuery;
    if (roomErr) throw roomErr;

    if (!allRooms || allRooms.length === 0) {
      return { success: true, disponibles: [], message: "Aucune chambre ne correspond à vos critères." };
    }

    // 2. Vérifier les occupations existantes (réservations + blocages)
    const roomIds = allRooms.map(r => r.id);
    const { data: occupations } = await db
      .from('chambres_occupation')
      .select('service_id, date_occupation, statut')
      .eq('tenant_id', tenantId)
      .in('service_id', roomIds)
      .gte('date_occupation', dateArrivee)
      .lt('date_occupation', dateDepart);

    // Aussi vérifier les réservations directes
    const { data: reservations } = await db
      .from('reservations')
      .select('service_id, date_debut, date_fin')
      .eq('tenant_id', tenantId)
      .in('service_id', roomIds)
      .in('statut', ['confirmee', 'en_attente'])
      .lt('date_debut', dateDepart)
      .gt('date_fin', dateArrivee);

    // Chambres occupées sur la période
    const occupiedRoomIds = new Set();
    (occupations || []).forEach(o => {
      if (['reservee', 'occupee', 'maintenance', 'bloquee'].includes(o.statut)) {
        occupiedRoomIds.add(o.service_id);
      }
    });
    (reservations || []).forEach(r => {
      occupiedRoomIds.add(r.service_id);
    });

    // 3. Filtrer les chambres libres
    const freeRooms = allRooms.filter(r => !occupiedRoomIds.has(r.id));

    // 4. Charger les tarifs saisonniers pour le prix
    const freeIds = freeRooms.map(r => r.id);
    let tarifMap = {};
    if (freeIds.length > 0) {
      const { data: tarifs } = await db
        .from('tarifs_saisonniers')
        .select('service_id, nom, prix_nuit, prix_weekend, prix_petit_dejeuner, petit_dejeuner_inclus, date_debut, date_fin')
        .eq('tenant_id', tenantId)
        .in('service_id', freeIds)
        .lte('date_debut', dateArrivee)
        .gte('date_fin', dateDepart)
        .eq('actif', true);

      (tarifs || []).forEach(t => { tarifMap[t.service_id] = t; });
    }

    // Calcul du nombre de nuits
    const d1 = new Date(dateArrivee);
    const d2 = new Date(dateDepart);
    const nbNuits = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));

    const disponibles = freeRooms.map(r => {
      const tarif = tarifMap[r.id];
      const prixNuit = tarif ? tarif.prix_nuit : r.prix;
      const totalEstime = prixNuit * nbNuits;
      return {
        nom: r.nom,
        type: r.type_chambre,
        capacite: r.capacite_max || 2,
        etage: r.etage,
        vue: r.vue,
        equipements: r.equipements || [],
        prix_nuit: `${(prixNuit / 100).toFixed(0)}€`,
        total_estime: `${(totalEstime / 100).toFixed(0)}€ pour ${nbNuits} nuit(s)`,
        saison: tarif?.nom || 'Tarif standard',
        petit_dejeuner: tarif?.petit_dejeuner_inclus ? 'Inclus' : (tarif?.prix_petit_dejeuner ? `${(tarif.prix_petit_dejeuner / 100).toFixed(0)}€/pers` : null)
      };
    });

    if (disponibles.length === 0) {
      return {
        success: true,
        disponibles: [],
        message: `Aucune chambre disponible du ${dateArrivee} au ${dateDepart}. Suggérez d'autres dates au client.`
      };
    }

    return {
      success: true,
      disponibles,
      nb_nuits: nbNuits,
      dates: { arrivee: dateArrivee, depart: dateDepart },
      message: `${disponibles.length} chambre(s) disponible(s) du ${dateArrivee} au ${dateDepart} (${nbNuits} nuit(s)).`
    };
  } catch (err) {
    console.error('[NEXUS CORE] checkRoomAvailability error:', err.message);
    return { success: false, error: err.message };
  }
}

// --- PARSE DATE ---
function parseDate(dateText, heure) {
  const now = new Date();
  now.setHours(12, 0, 0, 0);

  let targetDate = null;
  const text = dateText.toLowerCase().trim();

  const joursMap = {
    'dimanche': 0, 'lundi': 1, 'mardi': 2, 'mercredi': 3,
    'jeudi': 4, 'vendredi': 5, 'samedi': 6
  };

  // Cas simples
  if (text === 'demain') {
    targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (text.includes('après-demain') || text.includes('apres-demain')) {
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
        if (daysToAdd <= 0) daysToAdd += 7;
        targetDate.setDate(targetDate.getDate() + daysToAdd);
        break;
      }
    }

    // Format "25 janvier" ou "25/01"
    if (!targetDate) {
      const moisMap = {
        'janvier': 0, 'février': 1, 'fevrier': 1, 'mars': 2, 'avril': 3,
        'mai': 4, 'juin': 5, 'juillet': 6, 'août': 7, 'aout': 7,
        'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11, 'decembre': 11
      };

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

      // Format "25/01"
      if (!targetDate) {
        const slashMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
        if (slashMatch) {
          targetDate = new Date(now.getFullYear(), parseInt(slashMatch[2]) - 1, parseInt(slashMatch[1]));
          if (targetDate < now) {
            targetDate.setFullYear(targetDate.getFullYear() + 1);
          }
        }
      }

      // Format "le 24" ou juste "24" (jour seul, mois courant ou suivant)
      if (!targetDate) {
        const jourSeulMatch = text.match(/\b(\d{1,2})\b/);
        if (jourSeulMatch) {
          const jour = parseInt(jourSeulMatch[1]);
          if (jour >= 1 && jour <= 31) {
            // Essayer le mois courant d'abord
            targetDate = new Date(now.getFullYear(), now.getMonth(), jour);
            targetDate.setHours(12, 0, 0, 0);
            // Si la date est passée, prendre le mois suivant
            if (targetDate < now) {
              targetDate = new Date(now.getFullYear(), now.getMonth() + 1, jour);
              targetDate.setHours(12, 0, 0, 0);
            }
          }
        }
      }
    }
  }

  if (!targetDate) {
    return { success: false, error: `Date non reconnue: "${dateText}"` };
  }

  const dateStr = targetDate.toISOString().split('T')[0];
  const jourSemaine = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][targetDate.getDay()];

  return {
    success: true,
    date: dateStr,
    jour: jourSemaine,
    jour_numero: targetDate.getDate(),
    mois: targetDate.getMonth() + 1,
    heure: heure || null,
    dateFormatee: `${jourSemaine} ${targetDate.getDate()}/${targetDate.getMonth() + 1}/${targetDate.getFullYear()}`
  };
}

// --- GET SERVICES ---
// 🔒 TENANT ISOLATION: Services dynamiques par tenant
async function getServicesFormatted(categorie = 'all', tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: getServicesFormatted requires explicit tenantId');
  }

  // Utiliser le système multi-tenant
  const allServices = await getServicesForTenant(tenantId);
  const filtered = categorie === 'all'
    ? allServices
    : allServices.filter(s => s.category === categorie);

  const formatted = filtered.map(s => ({
    id: s.id,
    nom: s.name,
    prix: s.priceIsMinimum ? `À partir de ${s.price}€` : `${s.price}€`,
    prixExact: s.price,
    duree: s.durationMinutes >= 60
      ? `${Math.floor(s.durationMinutes / 60)}h${s.durationMinutes % 60 > 0 ? s.durationMinutes % 60 : ''}`
      : `${s.durationMinutes}min`,
    dureeMinutes: s.durationMinutes,
    categorie: s.category,
    bloqueJournee: s.blocksFullDay || false,
    joursNecessaires: s.blocksDays || 1
  }));

  return { success: true, services: formatted, count: formatted.length };
}

// --- GET PRICE ---
// 🔒 TENANT ISOLATION: Prix dynamiques par tenant
async function getPriceForService(serviceName, tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: getPriceForService requires explicit tenantId');
  }

  const service = await findServiceByNameForTenant(tenantId, serviceName);
  if (!service) {
    return { success: false, error: `Service non trouvé: "${serviceName}"` };
  }

  return {
    success: true,
    service: service.name,
    prix: service.price,
    prixTexte: service.priceIsMinimum ? `À partir de ${service.price}€` : `${service.price}€`,
    dureeMinutes: service.durationMinutes,
    bloqueJournee: service.blocksFullDay || false
  };
}

// --- CHECK AVAILABILITY ---
// 🔒 TENANT ISOLATION: Filtre par tenant_id et services dynamiques
async function checkAvailabilityUnified(date, heure, serviceName, tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: checkAvailabilityUnified requires explicit tenantId');
  }
  // Vérifier cache (inclut tenantId dans la clé)
  const cacheKey = `availability_${tenantId}_${date}_${heure}_${serviceName}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // 🔒 TENANT ISOLATION: Utiliser le système multi-tenant pour trouver le service
  const service = await findServiceByNameForTenant(tenantId, serviceName);
  if (!service) {
    return { success: false, error: `Service non trouvé: "${serviceName}"` };
  }

  // Vérifier ambiguïté (TODO: rendre multi-tenant via template)
  const ambiguity = checkAmbiguousTerm(serviceName);
  if (ambiguity) {
    return {
      success: false,
      needsClarification: true,
      message: ambiguity.message,
      options: ambiguity.options
    };
  }

  // 🔒 TENANT ISOLATION: Récupérer les réservations existantes pour CE tenant uniquement
  const db = getSupabase();
  let existingBookings = [];

  if (db) {
    const { data } = await db
      .from('reservations')
      .select('id, date, heure, duree_minutes, service_nom, statut')
      .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
      .eq('date', date)
      .in('statut', BLOCKING_STATUTS);  // 🔒 C3: Statuts unifiés
    existingBookings = data || [];
  }

  // Charger les horaires dynamiques du tenant
  const businessHours = await getBusinessHoursForTenant(tenantId);

  // Utiliser le validateur centralisé avec horaires dynamiques
  const result = await validateBeforeCreate({
    serviceName,
    date,
    heure
  }, existingBookings, null, businessHours);

  const response = {
    success: true,
    disponible: result.valid,
    service: service.name,
    date,
    heure,
    errors: result.errors,
    warnings: result.warnings,
    bloqueJournee: service.blocksFullDay || false,
    joursNecessaires: service.blocksDays || 1
  };

  if (!result.valid && result.errors.length > 0) {
    response.message = result.errors[0];
  }

  setCache(cacheKey, response);
  return response;
}

// --- GET AVAILABLE SLOTS ---
// 🔒 TENANT ISOLATION: Filtre par tenant_id et services dynamiques
async function getAvailableSlotsUnified(date, serviceName, tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: getAvailableSlotsUnified requires explicit tenantId');
  }
  // Vérifier cache (inclut tenantId dans la clé)
  const cacheKey = `slots_${tenantId}_${date}_${serviceName}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  // 🔒 TENANT ISOLATION: Utiliser le système multi-tenant pour trouver le service
  const service = await findServiceByNameForTenant(tenantId, serviceName);
  if (!service) {
    return { success: false, error: `Service non trouvé: "${serviceName}"` };
  }

  // 🔒 TENANT ISOLATION: Récupérer les réservations existantes pour CE tenant uniquement
  const db = getSupabase();
  let existingBookings = [];

  if (db) {
    const { data } = await db
      .from('reservations')
      .select('id, date, heure, duree_minutes, service_nom, statut')
      .eq('tenant_id', tenantId)  // 🔒 TENANT ISOLATION
      .eq('date', date)
      .in('statut', BLOCKING_STATUTS);  // 🔒 C3: Statuts unifiés
    existingBookings = data || [];
  }

  // Charger les horaires dynamiques du tenant
  const businessHours = await getBusinessHoursForTenant(tenantId);

  const result = getAvailableSlots(date, service, existingBookings, businessHours);

  const response = {
    success: true,
    date,
    service: service.name,
    ...result
  };

  setCache(cacheKey, response);
  return response;
}

// --- CALCULATE TRAVEL FEE ---
// 🔒 TENANT ISOLATION: Frais de déplacement dynamiques par tenant
async function calculateTravelFeeUnified(distanceKm, tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: calculateTravelFeeUnified requires explicit tenantId');
  }

  // Vérifier si le domicile est activé pour ce tenant
  const tenantConfig = await getTenantConfigById(tenantId);
  const serviceOptions = tenantConfig?.service_options || tenantConfig?.serviceOptions || {};

  if (serviceOptions.domicile_enabled === false) {
    return {
      success: false,
      error: serviceOptions.domicile_disabled_message || "Le service à domicile n'est pas disponible pour le moment.",
      domicile_disabled: true
    };
  }

  // Calculer les frais via le système multi-tenant
  const result = await calculateTravelFeeForTenant(tenantId, distanceKm);

  if (!result.success) {
    // Pas de frais configurés - utiliser fallback
    return {
      success: true,
      distance_km: distanceKm,
      frais: 0,
      fraisCentimes: 0,
      message: "Frais de déplacement non configurés pour ce tenant"
    };
  }

  return {
    success: true,
    distance_km: result.distanceKm,
    frais: result.frais,
    fraisCentimes: result.fraisInCents,
    gratuit: result.gratuit,
    message: result.details
  };
}

// ============================================
// 🔒 FONCTION UNIQUE DE CRÉATION DE RDV
// ============================================
/**
 * FONCTION UNIQUE de création de RDV
 * Utilisée par TOUS les canaux (WhatsApp, Téléphone, Web, Admin, Panier)
 *
 * @param {Object} data - Données du RDV
 * @param {string} data.service_name - Nom du service
 * @param {string} data.date - Date (YYYY-MM-DD)
 * @param {string} data.heure - Heure (HH:MM ou HHh)
 * @param {string} data.client_nom - Nom du client
 * @param {string} data.client_telephone - Téléphone du client
 * @param {string} [data.client_prenom] - Prénom du client (optionnel)
 * @param {string} [data.client_email] - Email du client (optionnel)
 * @param {string} [data.lieu] - 'domicile' ou 'salon' (défaut: salon)
 * @param {string} [data.adresse] - Adresse client (si domicile)
 * @param {number} [data.order_id] - ID de commande panier (optionnel)
 * @param {string} [data.statut] - Statut initial (défaut: 'demande')
 * @param {string} [data.notes] - Notes additionnelles
 * @param {string} channel - Canal source ('whatsapp', 'phone', 'web', 'admin', 'panier')
 * @param {Object} [options] - Options
 * @param {boolean} [options.sendSMS=true] - Envoyer SMS de confirmation
 * @param {boolean} [options.skipValidation=false] - Sauter validation (admin uniquement)
 * @returns {Object} { success, reservationId, recap, error }
 */
export async function createReservationUnified(data, channel = 'web', options = {}) {
  const { sendSMS = true, skipValidation = false } = options;

  console.log(`\n💾 ════════════════════════════════════════════════════════`);
  console.log(`💾 STEP BOOKING 2: createReservationUnified APPELÉ`);
  console.log(`💾 ════════════════════════════════════════════════════════`);
  console.log(`💾 Channel: ${channel}`);
  console.log(`💾 Options: sendSMS=${sendSMS}, skipValidation=${skipValidation}`);
  console.log(`💾 Données reçues:`, JSON.stringify(data, null, 2));

  const db = getSupabase();
  console.log(`💾 STEP BOOKING 2.1: Supabase client: ${db ? '✅ OK' : '❌ NULL'}`);
  if (!db) {
    console.error(`💾 ❌ ÉCHEC: Base de données non disponible`);
    return { success: false, error: "Base de données non disponible" };
  }

  try {
    // 0. VALIDATION ANTI-PLACEHOLDER
    console.log(`💾 STEP BOOKING 2.2: Validation anti-placeholder...`);
    const PLACEHOLDER_VALUES = ['-', '--', 'n/a', 'na', 'inconnu', 'unknown', 'none', 'null', 'undefined', 'x', 'xx', 'xxx', '.', '..', 'test'];
    const isPlaceholder = (val) => !val || PLACEHOLDER_VALUES.includes(String(val).trim().toLowerCase()) || String(val).trim().length < 2;

    // 🔧 FIX: Combiner client_prenom + client_nom si les deux sont fournis
    let fullName = String(data.client_nom || '').trim();
    if (data.client_prenom && data.client_prenom.trim()) {
      fullName = `${data.client_prenom.trim()} ${fullName}`.trim();
    }
    data.client_nom = fullName;
    console.log(`💾 Nom complet construit: "${fullName}"`);

    if (isPlaceholder(fullName)) {
      console.log(`💾 ❌ ÉCHEC: Nom est un placeholder`);
      return { success: false, error: "Le nom complet du client est obligatoire (prénom + nom de famille). Demandez-le avant de créer le rendez-vous." };
    }
    const nameParts = fullName.split(/\s+/);
    console.log(`💾 Nom parts: ${nameParts.length} (${nameParts.join(' | ')})`);
    if (nameParts.length < 2) {
      console.log(`💾 ❌ ÉCHEC: Nom incomplet (${nameParts.length} parts)`);
      return { success: false, error: `Le nom "${fullName}" semble incomplet. Il faut le prénom ET le nom de famille du client.` };
    }

    const phone = String(data.client_telephone || '').replace(/[\s\-\.]/g, '');
    console.log(`💾 Téléphone nettoyé: "${phone}"`);
    if (isPlaceholder(data.client_telephone) || !/^0[1-9][0-9]{8}$/.test(phone)) {
      console.log(`💾 ❌ ÉCHEC: Téléphone invalide`);
      return { success: false, error: "Le numéro de téléphone doit contenir 10 chiffres commençant par 0 (ex: 0612345678)." };
    }
    console.log(`💾 ✅ Validation nom/tel OK`);

    // 1. VALIDER LE SERVICE (config hardcodée → fallback BDD avec tenant_id)
    console.log(`💾 STEP BOOKING 2.3: Validation service "${data.service_name}"...`);
    let service = findServiceByName(data.service_name);
    console.log(`💾 Service trouvé en config: ${service ? '✅ ' + service.name : '❌ NON'}`);
    if (!service) {
      // Fallback: chercher dans la table services de la BDD (services ajoutés via admin)
      // 🔒 TENANT ISOLATION: Filtrer par tenant_id
      console.log(`💾 Recherche en BDD pour tenant ${data.tenant_id}...`);
      // 🔒 TENANT ISOLATION: tenant_id est OBLIGATOIRE pour la recherche de service
      if (!data.tenant_id) {
        console.error(`[NEXUS CORE] ❌ CRITICAL: tenant_id manquant pour recherche service`);
        return { success: false, error: 'tenant_id est requis pour rechercher un service' };
      }

      let serviceQuery = db
        .from('services')
        .select('id, nom, duree, prix, description')
        .eq('tenant_id', data.tenant_id)  // 🔒 TENANT ISOLATION: Toujours filtrer
        .ilike('nom', `%${data.service_name}%`);  // Recherche partielle avec wildcards

      const { data: dbService, error: serviceError } = await serviceQuery.limit(1).maybeSingle();

      if (serviceError) {
        console.error(`[NEXUS CORE] ❌ Erreur recherche service:`, serviceError.message);
      }

      if (dbService) {
        // Note: dbService.prix est en CENTIMES dans la BDD (ex: 6000 = 60€)
        service = {
          key: `db_${dbService.id}`,
          id: `db_${dbService.id}`,
          name: dbService.nom,
          durationMinutes: dbService.duree,
          price: dbService.prix / 100,  // Convertir centimes → euros
          priceInCents: dbService.prix,  // Déjà en centimes
          priceIsMinimum: false,
          category: 'other',
          blocksFullDay: dbService.duree >= 480,
          blocksDays: 1,
        };
        console.log(`[NEXUS CORE] ✅ Service trouvé en BDD: "${dbService.nom}" (${dbService.duree}min, ${dbService.prix / 100}€)`);
      } else {
        console.error(`[NEXUS CORE] ❌ Service non trouvé ni en config ni en BDD: "${data.service_name}" (tenant: ${data.tenant_id})`);
        return { success: false, error: `Service non trouvé: "${data.service_name}"` };
      }
    }

    // 2. VÉRIFIER AMBIGUÏTÉ
    console.log(`💾 STEP BOOKING 2.4: Vérification ambiguïté...`);
    const ambiguity = checkAmbiguousTerm(data.service_name);
    if (ambiguity && !skipValidation) {
      console.log(`💾 ❌ ÉCHEC: Service ambigu - ${ambiguity.message}`);
      return {
        success: false,
        needsClarification: true,
        message: ambiguity.message,
        options: ambiguity.options
      };
    }
    console.log(`💾 ✅ Pas d'ambiguïté`);

    // 3. VALIDER DATE/HEURE/DISPONIBILITÉ (sauf si skipValidation)
    console.log(`💾 STEP BOOKING 3: Validation date/heure/dispo (skipValidation=${skipValidation})...`);
    console.log(`💾 Date: ${data.date}, Heure: ${data.heure}, Tenant: ${data.tenant_id || 'non spécifié'}`);

    // 🔒 MULTI-TENANT: Exiger tenant_id pour la validation
    if (!data.tenant_id) {
      console.log(`💾 ❌ ÉCHEC: tenant_id manquant pour validation`);
      return { success: false, errors: ['tenant_id est requis pour créer une réservation'] };
    }

    if (!skipValidation) {
      // 🔒 NOUVEAU: Utiliser le validateur multi-tenant
      try {
        const validation = await validateBeforeCreateForTenant(
          data.tenant_id,
          { date: data.date, heure: data.heure },
          service
        );

        console.log(`💾 Résultat validation: valid=${validation.valid}`);
        if (!validation.valid) {
          console.log(`💾 ❌ ÉCHEC VALIDATION: ${validation.errors?.join(', ')}`);
          return { success: false, errors: validation.errors };
        }
        console.log(`💾 ✅ Validation OK (multi-tenant)`);
      } catch (validationError) {
        console.error(`💾 ❌ ERREUR VALIDATION:`, validationError);
        return { success: false, errors: [validationError.message] };
      }
    }

    // 4. NORMALISER LE TÉLÉPHONE
    const telephone = data.client_telephone
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(/^0/, '+33');

    // 5. CALCULER DISTANCE ET FRAIS DE DÉPLACEMENT
    let distanceKm = 0;
    let fraisDeplacement = 0;

    if (data.lieu === 'domicile' && data.adresse) {
      if (getDistanceFromSalon) {
        try {
          const distanceResult = await getDistanceFromSalon(data.adresse);
          // Note: getDistanceFromSalon retourne { distance_km, duree_minutes, ... }
          if (distanceResult?.distance_km) {
            distanceKm = distanceResult.distance_km;
          }
        } catch (e) {
          logger.warn('Erreur calcul distance, utilisation forfait', { tag: 'NEXUS CORE' });
        }
      }

      // Calcul frais via TRAVEL_FEES.calculate() - source unique de vérité
      const fraisUnitaire = TRAVEL_FEES.calculate(distanceKm);
      const nbJours = service.blocksDays || 1;
      fraisDeplacement = Math.round(fraisUnitaire * nbJours * 100) / 100;
      console.log(`[NEXUS CORE] Distance: ${distanceKm}km × ${nbJours} jour(s) → Frais: ${fraisDeplacement}€`);
    }

    // 6. CHERCHER OU CRÉER LE CLIENT
    console.log(`💾 STEP BOOKING 4: Recherche/création client...`);
    console.log(`💾 Téléphone recherché: ${telephone.replace('+33', '0')}, Tenant: ${data.tenant_id}`);
    let clientId;
    // 🔒 TENANT ISOLATION: tenant_id est OBLIGATOIRE (vérifié plus haut)
    let clientQuery = db
      .from('clients')
      .select('id, email')
      .eq('tenant_id', data.tenant_id)  // 🔒 TENANT ISOLATION: Toujours filtrer
      .eq('telephone', telephone.replace('+33', '0'));

    const { data: existingClient } = await clientQuery.single();

    if (existingClient) {
      clientId = existingClient.id;
      // Récupérer l'email du client existant pour les notifications (si pas déjà fourni)
      if (!data.client_email && existingClient.email) {
        data.client_email = existingClient.email;
        console.log(`💾 📧 Email client récupéré depuis la BDD: ${existingClient.email}`);
      }
      console.log(`💾 ✅ Client existant trouvé: ID=${clientId}`);
    } else {
      console.log(`💾 Client non trouvé, création...`);
      // Extraire prénom/nom
      const prenom = data.client_prenom || data.client_nom.split(' ')[0] || 'Client';
      const nom = data.client_nom.split(' ').slice(1).join(' ') || data.client_nom;
      console.log(`💾 Prénom: "${prenom}", Nom: "${nom}"`);

      const { data: newClient, error: clientError } = await db
        .from('clients')
        .insert({
          tenant_id: data.tenant_id,  // 🔒 TENANT ISOLATION
          prenom,
          nom,
          telephone: telephone.replace('+33', '0'),
          email: data.client_email || null
        })
        .select('id')
        .single();

      if (clientError) {
        console.log(`💾 ❌ ÉCHEC création client: ${clientError.message}`);
        return { success: false, error: `Erreur création client: ${clientError.message}` };
      }
      clientId = newClient.id;
      console.log(`💾 ✅ Nouveau client créé: ID=${clientId}`);
    }

    // 7. CALCULER PRIX TOTAL (gestion services variables: Réparation Locks = 10€/lock, 30min/lock)
    let prixService = service.priceInCents;
    if (service.pricePerUnit && data.duree_minutes && data.duree_minutes > service.durationMinutes) {
      const quantite = Math.round(data.duree_minutes / service.durationMinutes);
      prixService = quantite * service.priceInCents;
      console.log(`[NEXUS CORE] 🔧 Service variable: ${quantite} × ${service.priceInCents/100}€ = ${prixService/100}€`);
    }
    const fraisDeplacementCents = Math.round(fraisDeplacement * 100);
    const prixTotal = prixService + fraisDeplacementCents;

    // 7b. RESTAURANT: Vérifier capacité et attribuer table
    let assignedTableId = null;
    let assignedTableNom = null;
    let nbCouverts = data.nb_couverts ? parseInt(data.nb_couverts) : null;
    let serviceType = data.heure ? getServiceType(data.heure) : null;

    if (nbCouverts && data.tenant_id) {
      try {
        const tableResult = await findAvailableTable(
          data.tenant_id,
          data.date,
          data.heure,
          nbCouverts,
          data.zone_preference || null
        );

        if (!tableResult.success) {
          console.log(`[NEXUS CORE] 🍽️ Restaurant complet: ${tableResult.error}`);
          return { success: false, error: tableResult.error };
        }

        assignedTableId = tableResult.table.id;
        assignedTableNom = tableResult.table.nom;
        console.log(`[NEXUS CORE] 🍽️ Table attribuée: ${assignedTableNom} (ID: ${assignedTableId}, ${tableResult.table.capacite} places, zone: ${tableResult.table.zone})`);
      } catch (tableErr) {
        // Si erreur de capacité (pas de tables configurées), continuer sans table
        console.warn(`[NEXUS CORE] 🍽️ Pas de gestion de tables: ${tableErr.message}`);
      }
    }

    // 8. PRÉPARER LES RÉSERVATIONS (multi-jours si nécessaire)
    const nbJours = service.blocksDays || 1;
    let reservationDates = [data.date];
    let multidayGroupId = null;

    // Si service multi-jours, calculer les dates ouvrables consécutives
    if (nbJours > 1) {
      reservationDates = getConsecutiveBusinessDays(data.date, nbJours);
      multidayGroupId = crypto.randomUUID();
      console.log(`[NEXUS CORE] 📅 Service multi-jours (${nbJours} jours): ${reservationDates.join(', ')}`);
    }

    // 9. INSÉRER LES RÉSERVATIONS (une par jour ouvrable)
    console.log(`💾 STEP BOOKING 4.5: Insertion réservation(s)...`);
    console.log(`💾 Nombre de jours à réserver: ${reservationDates.length}`);
    const createdReservations = [];
    const baseNotes = data.notes || (data.lieu === 'domicile' ? `Domicile: ${data.adresse}` : 'Sur place');

    for (let dayIndex = 0; dayIndex < reservationDates.length; dayIndex++) {
      const reservationDate = reservationDates[dayIndex];
      const isFirstDay = dayIndex === 0;

      // 💰 IMPORTANT: La BDD stocke en CENTIMES (standard financier)
    const reservationData = {
        tenant_id: data.tenant_id,  // 🔒 TENANT ISOLATION
        client_id: clientId,
        date: reservationDate,
        heure: data.heure,
        duree_minutes: data.duree_minutes || service.durationMinutes,
        duree_totale_minutes: data.duree_totale_minutes || data.duree_minutes || service.durationMinutes,
        service_nom: service.name,
        prix_service: isFirstDay ? prixService : 0,  // En centimes
        distance_km: isFirstDay ? (distanceKm || null) : null,
        frais_deplacement: isFirstDay ? fraisDeplacementCents : 0,  // En centimes
        prix_total: isFirstDay ? prixTotal : 0,  // En centimes
        adresse_client: data.lieu === 'domicile' ? data.adresse : null,
        telephone: telephone.replace('+33', '0'),
        statut: data.statut || 'demande',
        created_via: `nexus-${channel}`,
        notes: nbJours > 1
          ? `${baseNotes} [Jour ${dayIndex + 1}/${nbJours}]${multidayGroupId ? ` [Group: ${multidayGroupId}]` : ''}`
          : baseNotes,
        // Restaurant fields (null si non-restaurant)
        ...(nbCouverts ? { nb_couverts: nbCouverts } : {}),
        ...(assignedTableId ? { table_id: assignedTableId, service_id: assignedTableId } : {}),
        ...(serviceType ? { service_type: serviceType } : {})
      };

      console.log(`💾 Données réservation jour ${dayIndex + 1}:`, JSON.stringify(reservationData, null, 2));

      const { data: newBooking, error: bookingError } = await db
        .from('reservations')
        .insert(reservationData)
        .select('id')
        .single();

      if (bookingError) {
        console.error('╔═══════════════════════════════════════════════════════════╗');
        console.error(`║ ❌ ERREUR CRÉATION RDV - Jour ${dayIndex + 1}/${nbJours}                    ║`);
        console.error('╠═══════════════════════════════════════════════════════════╣');
        console.error(`║ Code: ${bookingError.code || 'N/A'}`);
        console.error(`║ Message: ${bookingError.message}`);
        console.error(`║ Details: ${JSON.stringify(bookingError.details || {})}`);
        console.error(`║ Data envoyée: ${JSON.stringify(reservationData)}`);
        console.error('╚═══════════════════════════════════════════════════════════╝');

        // Si erreur sur un jour suivant, annuler les précédents (rollback manuel)
        if (createdReservations.length > 0) {
          console.log(`[NEXUS CORE] 🔄 Rollback: suppression de ${createdReservations.length} réservation(s)...`);
          try {
            await db.from('reservations').delete().in('id', createdReservations.map(r => r.id));
            console.log('[NEXUS CORE] ✅ Rollback réussi');
          } catch (rollbackErr) {
            console.error(`[NEXUS CORE] ❌ CRITIQUE: Échec rollback - réservations orphelines possibles:`, rollbackErr.message);
          }
        }
        return { success: false, error: `Erreur création RDV: ${bookingError.message}` };
      }

      createdReservations.push({ id: newBooking.id, date: reservationDate });
      console.log(`[NEXUS CORE] ✅ RDV jour ${dayIndex + 1}/${nbJours} créé ! ID: ${newBooking.id}, Date: ${reservationDate}`);

      // 9.1 INSERTION reservation_lignes (détail du service pour affichage multi-services)
      try {
        const ligneData = {
          reservation_id: newBooking.id,
          tenant_id: data.tenant_id,
          service_id: null, // Set below if DB service
          service_nom: service.name,
          quantite: 1,
          duree_minutes: data.duree_minutes || service.durationMinutes,
          prix_unitaire: isFirstDay ? (service.priceInCents || Math.round(service.price * 100)) : 0,
          prix_total: isFirstDay ? (service.priceInCents || Math.round(service.price * 100)) : 0,
          membre_id: null,
          heure_debut: data.heure || null,
          heure_fin: data.heure ? (() => {
            const [h, m] = data.heure.split(':').map(Number);
            const totalMin = h * 60 + (m || 0) + (data.duree_minutes || service.durationMinutes);
            return `${String(Math.floor(totalMin / 60) % 24).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
          })() : null
        };

        // Ajouter service_id si c'est un service BDD (pas config hardcodée)
        if (service.id && String(service.id).startsWith('db_')) {
          ligneData.service_id = parseInt(String(service.id).replace('db_', ''));
        }

        const { error: ligneError } = await db
          .from('reservation_lignes')
          .insert(ligneData);

        if (ligneError) {
          console.warn(`[NEXUS CORE] ⚠️ Erreur insertion reservation_lignes:`, ligneError.message);
        } else {
          console.log(`[NEXUS CORE] ✅ reservation_lignes créée pour RDV ${newBooking.id}`);
        }
      } catch (ligneErr) {
        console.warn(`[NEXUS CORE] ⚠️ Exception reservation_lignes:`, ligneErr.message);
      }

      // Invalider le cache pour chaque date
      invalidateCache(`slots_${reservationDate}`);
      invalidateCache(`availability_${reservationDate}`);
    }

    // 10. FACTURE: Pas de création automatique ici
    // La facture sera créée quand la réservation passera en statut "terminé"
    // (voir adminReservations.js - PATCH /:id/statut)
    let facture = null;

    // 11. ENVOYER CONFIRMATION CASCADE (Email → WhatsApp → SMS)
    if (sendSMS && data.client_telephone) {
      try {
        const datesFormatees = reservationDates.map(d => {
          const dateObj = new Date(d);
          return `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
        }).join(' et ');

        await sendConfirmationNotification(data.tenant_id, data.client_telephone, {
          service: service.name,
          date: nbJours > 1 ? datesFormatees : data.date,
          heure: data.heure,
          prixTotal: prixTotal / 100,
          fraisDeplacement: fraisDeplacement,
          adresse: data.adresse || null,
          nbJours: nbJours
        }, data.client_email || null);
        console.log('[NEXUS CORE] ✅ Confirmation envoyée (cascade Email→WA→SMS)');
      } catch (notifError) {
        logger.warn('Erreur envoi confirmation', { tag: 'NEXUS CORE', error: notifError.message });
        // Ne pas échouer la réservation pour une notification
      }
    }

    console.log('[NEXUS CORE] ========================================');

    // 11. RETOURNER LE RÉSULTAT
    const pricing = calculateTotalPrice(service, distanceKm);
    const primaryReservation = createdReservations[0];

    // Charger l'adresse du tenant pour le recap (dynamique, pas hardcode)
    let tenantAddress = '';
    try {
      const bizInfo = await getBusinessInfo(data.tenant_id);
      tenantAddress = bizInfo.adresse || '';
    } catch (e) {
      console.warn('[NEXUS CORE] Could not load tenant address for recap:', e.message);
    }

    return {
      success: true,
      message: nbJours > 1
        ? `Réservation créée avec succès sur ${nbJours} jours`
        : "Réservation créée avec succès",
      reservationId: primaryReservation.id,
      reservationIds: createdReservations.map(r => r.id),
      multidayGroupId: multidayGroupId,
      recap: {
        service: service.name,
        prix: service.price,
        prixTexte: service.priceIsMinimum ? `À partir de ${service.price}€` : `${service.price}€`,
        date: data.date,
        dates: reservationDates,
        nbJours: nbJours,
        heure: data.heure,
        lieu: data.lieu === 'domicile' ? data.adresse : tenantAddress,
        lieuType: data.lieu || 'salon',
        client: data.client_nom,
        telephone: data.client_telephone,
        distanceKm,
        fraisDeplacement,
        prixTotal: prixTotal / 100,
        acompte: pricing.deposit,
        acompteTexte: `${pricing.deposit}€ (${BOOKING_RULES.DEPOSIT_PERCENT}%)`
      },
      facture: facture ? { id: facture.id, numero: facture.numero, statut: facture.statut } : null
    };

  } catch (error) {
    console.error('[NEXUS CORE] ❌ Exception:', error.message);
    console.error('[NEXUS CORE] Stack:', error.stack?.substring(0, 300));
    return { success: false, error: error.message };
  }
}

// Alias pour compatibilité avec l'ancien code
async function createBookingUnified(data, channel) {
  return createReservationUnified(data, channel);
}

// --- FIND APPOINTMENT BY PHONE ---
// 🔒 TENANT ISOLATION: Filtrer par tenant_id obligatoire
async function findAppointmentByPhone(telephone, tenantId) {
  if (!tenantId) {
    console.error('[NEXUS CORE] ❌ find_appointment: tenant_id manquant');
    return { success: false, error: "tenant_id requis pour rechercher des rendez-vous" };
  }

  const db = getSupabase();
  if (!db) return { success: false, error: "Base de données non disponible" };

  const cleanPhone = String(telephone).replace(/[\s\-\.]/g, '');
  const today = new Date().toISOString().split('T')[0];

  try {
    // 🔒 Filtrer par tenant_id
    const { data, error } = await db
      .from('reservations')
      .select('id, date, heure, service_nom, duree_minutes, prix_service, statut, notes, clients(nom, prenom, telephone)')
      .eq('tenant_id', tenantId)
      .eq('telephone', cleanPhone)
      .gte('date', today)
      .in('statut', ['confirme', 'demande'])
      .order('date', { ascending: true });

    // Also search via client table - 🔒 Filtrer par tenant_id
    let clientResults = [];
    const { data: clients } = await db
      .from('clients')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('telephone', cleanPhone)
      .limit(1);

    if (clients && clients.length > 0) {
      const { data: byClient } = await db
        .from('reservations')
        .select('id, date, heure, service_nom, duree_minutes, prix_service, statut, notes')
        .eq('tenant_id', tenantId)
        .eq('client_id', clients[0].id)
        .gte('date', today)
        .in('statut', ['confirme', 'demande'])
        .order('date', { ascending: true });
      clientResults = byClient || [];
    }

    // Merge and dedupe
    const allResults = [...(data || []), ...clientResults];
    const seen = new Set();
    const unique = allResults.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    if (unique.length === 0) {
      return { success: true, appointments: [], message: "Aucun rendez-vous trouvé pour ce numéro." };
    }

    // Fetch client info - 🔒 Filtrer par tenant_id
    let clientInfo = null;
    if (clients && clients.length > 0) {
      const { data: clientData } = await db
        .from('clients')
        .select('nom, prenom, telephone')
        .eq('id', clients[0].id)
        .eq('tenant_id', tenantId)
        .single();
      clientInfo = clientData;
    }

    return {
      success: true,
      client: clientInfo ? { nom: clientInfo.nom, prenom: clientInfo.prenom, telephone: clientInfo.telephone } : null,
      appointments: unique.map(r => ({
        id: r.id,
        date: r.date,
        heure: r.heure,
        service: r.service_nom,
        duree: r.duree_minutes,
        prix: r.prix_service ? (r.prix_service / 100) + '€' : null,  // Centimes → Euros
        statut: r.statut
      })),
      message: `${unique.length} rendez-vous trouvé(s).`
    };
  } catch (error) {
    console.error('[NEXUS CORE] Erreur find_appointment:', error.message);
    return { success: false, error: error.message };
  }
}

// --- CANCEL APPOINTMENT ---
// 🔒 TENANT ISOLATION: Vérifier propriété du RDV par tenant_id
async function cancelAppointmentById(appointmentId, reason, tenantId) {
  if (!tenantId) {
    console.error('[NEXUS CORE] ❌ cancel_appointment: tenant_id manquant');
    return { success: false, error: "tenant_id requis pour annuler un rendez-vous" };
  }

  const db = getSupabase();
  if (!db) return { success: false, error: "Base de données non disponible" };

  try {
    // Fetch appointment - 🔒 Filtrer par tenant_id
    const { data: rdv, error: fetchErr } = await db
      .from('reservations')
      .select('id, date, heure, service_nom, statut, client_id, telephone, clients(nom, prenom, telephone)')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchErr || !rdv) {
      return { success: false, error: "Rendez-vous non trouvé." };
    }
    if (rdv.statut === 'annule') {
      return { success: false, error: "Ce rendez-vous est déjà annulé." };
    }

    // Cancel - 🔒 Filtrer par tenant_id pour éviter annulation cross-tenant
    const noteAnnulation = reason
      ? `Annulé via assistant IA: ${reason}`
      : 'Annulé via assistant IA (demande client)';
    const existingNotes = rdv.notes ? rdv.notes + ' | ' : '';

    const { error: updateErr } = await db
      .from('reservations')
      .update({ statut: 'annule', notes: existingNotes + noteAnnulation })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    if (updateErr) throw updateErr;

    // Send cancellation SMS
    try {
      const clientPhone = rdv.clients?.telephone || rdv.telephone;
      const clientNom = rdv.clients?.nom || '';
      const clientPrenom = rdv.clients?.prenom || '';
      if (clientPhone) {
        const { sendCancellationSMS } = await import('../../server/sms-service.ts');
        await sendCancellationSMS(clientPhone, clientNom, clientPrenom, rdv.service_nom, rdv.date, rdv.heure);
      }
    } catch (smsErr) {
      logger.warn('SMS annulation non envoyé', { tag: 'NEXUS CORE', error: smsErr.message });
    }

    console.log(`[NEXUS CORE] ✅ RDV #${appointmentId} annulé`);
    return {
      success: true,
      message: `Rendez-vous du ${rdv.date} à ${rdv.heure} (${rdv.service_nom}) annulé avec succès.`
    };
  } catch (error) {
    console.error('[NEXUS CORE] Erreur cancel_appointment:', error.message);
    return { success: false, error: error.message };
  }
}

// --- GET BUSINESS INFO ---
// 🔒 TENANT ISOLATION: Infos business dynamiques par tenant
async function getBusinessInfoUnified(tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: getBusinessInfoUnified requires explicit tenantId');
  }

  const tenantConfig = await getTenantConfigById(tenantId);
  if (!tenantConfig) {
    return { success: false, error: 'Tenant non trouvé' };
  }

  const hoursResult = await getBusinessHoursUnified(null, tenantId);

  return {
    success: true,
    nom: tenantConfig.name,
    concept: tenantConfig.concept || '',
    gerante: tenantConfig.gerante || '',
    adresse: tenantConfig.adresse || '',
    telephone: tenantConfig.telephone || '',
    ville: tenantConfig.ville || '',
    horaires: hoursResult.horaires || []
  };
}

// --- GET BUSINESS HOURS ---
// 🔒 TENANT ISOLATION: Horaires dynamiques par tenant
async function getBusinessHoursUnified(jour = null, tenantId) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: getBusinessHoursUnified requires explicit tenantId');
  }

  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  // Charger les horaires depuis le système multi-tenant
  const businessHours = await getBusinessHoursForTenant(tenantId);

  if (jour) {
    const dayIndex = jours.indexOf(jour.toLowerCase());
    if (dayIndex === -1) {
      return { success: false, error: `Jour invalide: ${jour}` };
    }
    const hours = businessHours.getHours(dayIndex);
    return {
      success: true,
      jour,
      ouvert: businessHours.isOpen(dayIndex),
      horaires: hours ? `${hours.open} - ${hours.close}` : 'Fermé'
    };
  }

  const horaires = jours.map((j, i) => {
    const hours = businessHours.getHours(i);
    return {
      jour: j,
      ouvert: businessHours.isOpen(i),
      horaires: hours ? `${hours.open} - ${hours.close}` : 'Fermé'
    };
  });

  return { success: true, horaires };
}

// ============================================
// IA CONFIG - Charger la config admin IA par channel
// ============================================

const IA_CONFIG_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

async function loadIAConfig(tenantId, channel) {
  if (!tenantId) {
    throw new Error('TENANT_ID_REQUIRED: loadIAConfig requires explicit tenantId');
  }

  const channelMap = { phone: 'telephone', whatsapp: 'whatsapp', web: 'web', sms: 'sms' };
  const dbChannel = channelMap[channel] || channel;

  const cacheKey = `ia_config_${tenantId}_${dbChannel}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const db = getSupabase();
  if (!db) return null;

  try {
    const { data, error } = await db
      .from('tenant_ia_config')
      .select('config')
      .eq('tenant_id', tenantId)
      .eq('channel', dbChannel)
      .single();

    if (error && error.code !== 'PGRST116') {
      logger.warn('Erreur chargement IA config', { tag: 'NEXUS CORE', tenantId, channel: dbChannel, error: error.message });
    }

    const config = data?.config || null;
    if (config) {
      setCache(cacheKey, config, IA_CONFIG_CACHE_TTL);
    }
    return config;
  } catch (err) {
    logger.error('Erreur loadIAConfig', { tag: 'NEXUS CORE', tenantId, channel: dbChannel, error: err.message });
    return null;
  }
}

/**
 * Applique les overrides de la config IA admin sur le tenantConfig
 * Alimente aussi personality.ton pour le prompt dynamique (promptEngine.js)
 */
function applyIAConfig(tenantConfig, iaConfig) {
  if (!iaConfig) return;

  tenantConfig.iaConfig = iaConfig;

  if (iaConfig.personality) {
    if (typeof tenantConfig.personality === 'object') {
      tenantConfig.personality = { ...tenantConfig.personality, description: iaConfig.personality };
    } else {
      tenantConfig.personality = { description: iaConfig.personality };
    }
  }

  if (iaConfig.tone) {
    tenantConfig.agentTone = iaConfig.tone;
    // Alimenter personality.ton pour promptEngine.js → buildPersonalityText()
    if (typeof tenantConfig.personality === 'object') {
      tenantConfig.personality.ton = iaConfig.tone;
    } else {
      tenantConfig.personality = { ton: iaConfig.tone };
    }
  }

  if (iaConfig.greeting_message) tenantConfig.greetingMessage = iaConfig.greeting_message;
  if (iaConfig.booking_enabled !== undefined) tenantConfig.bookingEnabled = iaConfig.booking_enabled;
  if (iaConfig.services_description) tenantConfig.servicesDescription = iaConfig.services_description;
}

// ============================================
// AI AGENTS - Enrichir tenant config avec ai_agents
// ============================================
async function enrichTenantWithAgent(tenantId, tenantConfig) {
  try {
    const { rawSupabase } = await import('../../config/supabase.js');
    const { data: agent } = await rawSupabase
      .from('ai_agents')
      .select('custom_name, greeting_message, tone')
      .eq('tenant_id', tenantId)
      .eq('agent_type', 'reception')
      .eq('active', true)
      .single();
    // Seul un custom_name explicite (non-générique) override le nom statique du tenant.
    // Si ai_agents.custom_name est le défaut 'Nexus' et que le tenant a déjà un nom spécifique
    // (ex: 'Halimah' dans fatshairafro.js), on conserve le nom du tenant.
    if (agent?.custom_name) {
      const hasSpecificName = tenantConfig.assistantName && tenantConfig.assistantName !== 'Nexus';
      const isGenericDefault = agent.custom_name === 'Nexus';
      if (!isGenericDefault || !hasSpecificName) {
        tenantConfig.assistantName = agent.custom_name;
        tenantConfig.assistant_name = agent.custom_name; // Also set snake_case for getEffectiveConfig()
      }
    }
    if (agent?.greeting_message) tenantConfig.greetingMessage = agent.greeting_message;
    if (agent?.tone) tenantConfig.agentTone = agent.tone;
  } catch (_) { /* fallback to static config */ }
  return tenantConfig;
}

// ============================================
// SYSTEM PROMPT UNIFIÉ
// ============================================

/**
 * Génère le system prompt pour TOUS les tenants via le moteur dynamique.
 * Plus de prompt frozen — tous les tenants utilisent promptEngine.js.
 *
 * @param {string} channel - Canal ('phone', 'chat', 'whatsapp', etc.)
 * @param {Object} tenantConfig - Configuration du tenant
 * @returns {Promise<string>} - System prompt
 */
async function getSystemPromptUnified(channel, tenantConfig) {
  if (!tenantConfig) {
    throw new Error('TENANT_CONFIG_REQUIRED');
  }

  const tenantId = tenantConfig.id || tenantConfig.tenant_id || tenantConfig.slug;

  // 🎯 DEMO TENANT: Utiliser le prompt commercial spécialisé
  // Check par flag config OU par tenantId (le flag peut manquer si chargé depuis DB)
  console.log(`[NEXUS CORE] getSystemPromptUnified CHECK: tenantId="${tenantId}", isDemoTenant=${tenantConfig.isDemoTenant}, name="${tenantConfig.name}"`);
  if (tenantConfig.isDemoTenant || tenantId === 'nexus-test') {
    console.log(`[NEXUS CORE] ✅ Using DEMO prompt for ${tenantId} (channel: ${channel})`);
    return getDemoPrompt(channel);
  }

  console.log(`[NEXUS CORE] ➡️ Generating dynamic prompt for ${tenantId} (NOT demo)`);
  return dynamicSystemPrompt(channel, tenantConfig);
}

// ============================================
// HISTORIQUE DE CONVERSATION
// ============================================

const conversationHistories = new Map();
const conversationLastActivity = new Map();

// Nettoyage automatique des conversations > 30min d'inactivité
const CONVERSATION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const _convCleanupId = setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [sessionId, lastActivity] of conversationLastActivity) {
    if (now - lastActivity > CONVERSATION_TTL_MS) {
      conversationHistories.delete(sessionId);
      conversationLastActivity.delete(sessionId);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`[NEXUS CORE] ${cleaned} session(s) expiree(s) (30min inactivite)`);
  }
}, 5 * 60 * 1000); // Verifier toutes les 5 minutes
registerInterval('nexusCore:conversationCleanup', _convCleanupId);

function getConversationHistory(conversationId) {
  if (!conversationHistories.has(conversationId)) {
    conversationHistories.set(conversationId, []);
  }
  conversationLastActivity.set(conversationId, Date.now()); // MAJ activité
  return conversationHistories.get(conversationId);
}

function clearConversation(conversationId) {
  conversationHistories.delete(conversationId);
}

// ============================================
// POINT D'ENTRÉE PRINCIPAL - processMessage
// ============================================

/**
 * 🔒 Point d'entrée UNIQUE pour toutes les conversations
 *
 * @param {string} message - Message de l'utilisateur
 * @param {string} channel - Canal (whatsapp, web, phone, sms, admin)
 * @param {object} context - Contexte (conversationId, userId, phone, etc.)
 * @returns {Promise<{success: boolean, response: string, channel: string, duration: number}>}
 */
export async function processMessage(message, channel, context = {}) {
  const startTime = Date.now();
  const conversationId = context.conversationId || `${channel}_${context.phone || context.userId || Date.now()}`;

  // 🏢 Multi-tenant : charger la config du tenant + agent IA
  // 🔒 TENANT ISOLATION: tenantId est OBLIGATOIRE - pas de fallback
  const tenantId = context.tenantId;
  if (!tenantId) {
    console.error(`[NEXUS CORE] TENANT_ID_REQUIRED: processMessage called without tenantId`);
    return {
      success: false,
      response: 'Erreur de configuration. Veuillez réessayer.',
      channel,
      duration: Date.now() - startTime,
      error: 'TENANT_ID_REQUIRED'
    };
  }
  const tenantConfig = await enrichTenantWithAgent(tenantId, { ...getTenantConfig(tenantId) });

  // Charger config IA admin pour ce channel
  applyIAConfig(tenantConfig, await loadIAConfig(tenantId, channel));

  // 🤝 Reconnaissance client : lookup par téléphone pour accueil personnalisé
  if (context.phone) {
    try {
      const clientContext = await recognizeClient(tenantId, context.phone);
      tenantConfig.clientContext = clientContext;
      if (clientContext.known) {
        console.log(`[NEXUS CORE] 🤝 Client reconnu: ${clientContext.displayName} (${clientContext.visitCount} visites)`);
      }
    } catch (err) {
      console.warn(`[NEXUS CORE] Client recognition failed:`, err.message);
    }
  }

  console.log(`[NEXUS CORE] 🏢 Tenant: ${tenantId} (${tenantConfig.name}) Agent: ${tenantConfig.assistantName}`);

  console.log(`\n[NEXUS CORE] ══════════════════════════════════════`);
  console.log(`[NEXUS CORE] 📨 ${channel.toUpperCase()} - ${conversationId}`);
  console.log(`[NEXUS CORE] Message: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`);
  console.log(`[NEXUS CORE] 🔑 ANTHROPIC_API_KEY présente: ${!!process.env.ANTHROPIC_API_KEY}`);
  console.log(`[NEXUS CORE] 🔧 Timestamp: ${new Date().toISOString()}`);

  // 💰 OPTIMISATION 1: Vérifier le cache pour les FAQ
  const cacheContext = { tenantId, channel };
  const cached = responseCache.get(message, cacheContext);
  if (cached) {
    const cacheDuration = Date.now() - startTime;
    console.log(`[NEXUS CORE] 💰 CACHE HIT - Économie API !`);

    // 🫀 PULSE: Événement cache hit
    liveEventStream.cache({
      action: 'Cache HIT',
      question: message.substring(0, 50),
      responseTime: `${cacheDuration}ms`,
      saving: '0.02',
      cacheHits: cached.cacheHits,
      tenantId,
      channel
    });

    return {
      success: true,
      response: cached.response,
      channel,
      conversationId,
      duration: cacheDuration,
      fromCache: true
    };
  }

  try {
    const anthropic = getAnthropic();
    if (!anthropic) {
      console.error('[NEXUS CORE] ❌ Client Anthropic non configuré - clé API manquante ?');
      throw new Error('Client Anthropic non configuré - vérifiez ANTHROPIC_API_KEY');
    }
    console.log(`[NEXUS CORE] ✅ Client Anthropic initialisé`);

    // Récupérer l'historique
    const history = getConversationHistory(conversationId);

    // Ajouter le message utilisateur
    history.push({ role: 'user', content: message });

    // 💰 OPTIMISATION 2: Sélection intelligente du modèle via modelRouter
    // Compter uniquement les vrais tours utilisateur (pas les tool_results)
    const userTurnCount = history.filter(m => m.role === 'user' && typeof m.content === 'string').length;
    const routerResult = modelRouter.selectModel({
      userMessage: message,
      context: {
        conversationLength: userTurnCount,
        intent: context.intent,
        hasPersonalData: context.hasPersonalData
      }
    });
    const selectedModel = routerResult.model;
    const modelReason = routerResult.reason;
    const modelEmoji = selectedModel.includes('haiku') ? '⚡' : '🧠';

    // 💰 OPTIMISATION 3: Optimiser le prompt système (moteur dynamique pour TOUS les tenants)
    const rawSystemPrompt = await getSystemPromptUnified(channel, tenantConfig);
    const optimizedSystemPrompt = promptOptimizer.optimize(rawSystemPrompt, {
      isSimple: routerResult.complexity < 3
    });
    // 🔒 Cache le prompt pour toute la session (tool loop cohérent)
    const sessionSystemPrompt = optimizedSystemPrompt;

    const promptSavings = promptOptimizer.calculateSavings(rawSystemPrompt, optimizedSystemPrompt);
    if (promptSavings.saved > 0) {
      console.log(`[NEXUS CORE] 💰 Prompt optimisé: -${promptSavings.saved} tokens (${promptSavings.percentage}%)`);
    }

    // 🔧 Filtrage outils par business type + plan
    const businessType = tenantConfig.business_profile || tenantConfig.businessProfile || 'salon';
    const tenantPlan = tenantConfig.plan || 'free';
    let filteredTools = getToolsForPlanAndBusiness(tenantPlan, businessType);

    // 💰 OPTIMISATION: Réduire les outils pour Haiku (questions simples)
    // Sonnet reçoit tous les outils, Haiku ne reçoit que les essentiels
    // Économie: ~10,000 tokens d'input par appel simple
    if (selectedModel.includes('haiku')) {
      const ESSENTIAL_TOOL_NAMES = [
        'parse_date', 'get_services', 'get_available_slots', 'create_booking',
        'get_salon_info', 'get_business_hours', 'get_price', 'check_availability',
        'find_appointment', 'get_upcoming_days',
      ];
      const essentialTools = filteredTools.filter(t => ESSENTIAL_TOOL_NAMES.includes(t.name));
      if (essentialTools.length > 0) {
        console.log(`[NEXUS CORE] 💰 Haiku: ${essentialTools.length} outils essentiels (au lieu de ${filteredTools.length})`);
        filteredTools = essentialTools;
      }
    }

    // 🫀 PULSE: Événement sélection modèle
    liveEventStream.optimization({
      action: 'Model Router',
      model: selectedModel.includes('haiku') ? 'Haiku' : 'Sonnet',
      reason: modelReason,
      complexity: routerResult.complexity,
      expectedCost: routerResult.expectedCost,
      tenantId,
      channel
    });

    // 🫀 PULSE: Événement optimisation prompt
    if (promptSavings.saved > 0) {
      liveEventStream.optimization({
        action: 'Prompt Optimizer',
        tokensSaved: promptSavings.saved,
        percentage: promptSavings.percentage,
        tenantId,
        channel
      });
    }

    // Appeler Claude avec les outils filtrés par business type
    console.log(`[NEXUS CORE] ${modelEmoji} Modèle: ${selectedModel.includes('haiku') ? 'HAIKU' : 'SONNET'} (${modelReason})`);
    console.log(`[NEXUS CORE] 📊 Historique: ${history.length} messages, Outils: ${filteredTools.length} (${businessType})`);

    // 💰 PROMPT CACHING: system + outils cachés ~5min (90% moins cher sur tokens cachés)
    const cachedSystem = [{
      type: 'text',
      text: sessionSystemPrompt,
      cache_control: { type: 'ephemeral' }
    }];
    const cachedTools = filteredTools.length > 0
      ? filteredTools.map((t, i) =>
          i === filteredTools.length - 1
            ? { ...t, cache_control: { type: 'ephemeral' } }
            : t
        )
      : [];

    let response = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: MAX_TOKENS,
      system: cachedSystem,
      tools: cachedTools,
      messages: history
    });
    console.log(`[NEXUS CORE] ✅ Réponse Claude reçue - stop_reason: ${response.stop_reason}`);

    // Flag: create_booking a-t-il été appelé avec succès ?
    let bookingToolCalled = false;

    // Boucle pour gérer les appels d'outils
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
      if (toolUseBlocks.length === 0) break;

      // Sauvegarder la réponse assistant
      history.push({ role: 'assistant', content: response.content });

      // Exécuter tous les outils
      const toolResults = [];
      for (const toolBlock of toolUseBlocks) {
        const result = await executeTool(toolBlock.name, toolBlock.input, channel, tenantId);
        // Tracker si create_booking/create_appointment a été appelé avec succès
        if ((toolBlock.name === 'create_booking' || toolBlock.name === 'create_appointment') && result?.success) {
          bookingToolCalled = true;
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify(result)
        });
      }

      // Ajouter les résultats
      history.push({ role: 'user', content: toolResults });

      // Continuer la conversation — escalade Sonnet UNIQUEMENT si booking
      // 🔒 Utilise sessionSystemPrompt (prompt caché en début de session, pas re-généré)
      const needsSonnet = toolUseBlocks.some(tb =>
        tb.name === 'create_booking' || tb.name === 'create_appointment'
      );
      const toolModel = needsSonnet ? CLAUDE_SONNET : selectedModel;
      // Si escalade Sonnet, remettre les outils complets (Haiku avait les essentiels seulement)
      const toolLoopTools = needsSonnet
        ? getToolsForPlanAndBusiness(tenantPlan, businessType)
        : filteredTools;

      if (needsSonnet && selectedModel !== CLAUDE_SONNET) {
        console.log(`[NEXUS CORE] 🔄 Escalade HAIKU → SONNET (booking détecté)`);
      }

      // 💰 PROMPT CACHING sur tool loop
      const cachedToolLoopTools = toolLoopTools.length > 0
        ? toolLoopTools.map((t, i) =>
            i === toolLoopTools.length - 1
              ? { ...t, cache_control: { type: 'ephemeral' } }
              : t
          )
        : [];

      response = await anthropic.messages.create({
        model: toolModel,
        max_tokens: MAX_TOKENS,
        system: cachedSystem,
        tools: cachedToolLoopTools,
        messages: history
      });
    }

    // Extraire la réponse textuelle
    const textBlock = response.content.find(block => block.type === 'text');
    let responseText = textBlock?.text || "Je suis désolée, je n'ai pas pu traiter votre demande.";

    // ════════════════════════════════════════
    // DÉTECTION HALLUCINATION CONFIRMATION RDV
    // ════════════════════════════════════════
    const confirmationKeywords = [
      // Formes directes
      'rendez-vous est confirmé', 'rdv est confirmé', 'réservation est confirmée',
      'rendez-vous créé', 'rdv créé', 'réservation enregistrée',
      'votre rendez-vous est confirmé', 'votre réservation est validée',
      'c\'est enregistré', 'j\'ai bien noté votre rendez-vous',
      'vous recevrez un sms de confirmation',
      // Formes avec "je confirme" (souvent utilisées par l'IA)
      'je confirme votre', 'je vous confirme', 'je confirme le rendez-vous',
      'je confirme la réservation', 'confirmé pour le', 'confirmée pour le',
      // Formes implicites
      'c\'est noté pour', 'c\'est bon pour', 'c\'est parfait',
      'votre créneau est réservé', 'créneau réservé',
      'à bientôt donc', 'on se retrouve', 'on se voit',
      // Formes avec date (hallucination fréquente)
      'rendez-vous le', 'rdv le', 'réservation le'
    ];
    const lowerResponse = responseText.toLowerCase();
    const claimsConfirmation = confirmationKeywords.some(kw => lowerResponse.includes(kw));

    if (claimsConfirmation && !bookingToolCalled) {
      console.error('╔═══════════════════════════════════════════════════╗');
      console.error('║ ❌ HALLUCINATION DÉTECTÉE: Confirmation sans tool  ║');
      console.error('╚═══════════════════════════════════════════════════╝');
      console.error(`[HALLUCINATION] Canal: ${channel}, Session: ${conversationId}`);

      // Retry: injecter message correctif et relancer
      history.push({ role: 'assistant', content: response.content });
      history.push({ role: 'user', content: [{
        type: 'text',
        text: '[SYSTÈME] ERREUR: Tu as dit que le RDV est confirmé mais tu n\'as PAS appelé create_booking. Le RDV N\'EXISTE PAS en base. Tu DOIS appeler create_booking maintenant avec toutes les infos du client, OU demander les infos manquantes. Ne dis JAMAIS "confirmé" sans appeler l\'outil.'
      }] });

      const retryResponse = await anthropic.messages.create({
        model: CLAUDE_SONNET,
        max_tokens: MAX_TOKENS,
        system: sessionSystemPrompt,
        tools: filteredTools,
        messages: history
      });

      // Traiter les tool_use du retry
      let retryFinal = retryResponse;
      while (retryFinal.stop_reason === 'tool_use') {
        const retryToolBlocks = retryFinal.content.filter(b => b.type === 'tool_use');
        if (retryToolBlocks.length === 0) break;
        history.push({ role: 'assistant', content: retryFinal.content });
        const retryResults = [];
        for (const tb of retryToolBlocks) {
          const res = await executeTool(tb.name, tb.input, channel, tenantId);
          if ((tb.name === 'create_booking' || tb.name === 'create_appointment') && res?.success) {
            bookingToolCalled = true;
          }
          retryResults.push({ type: 'tool_result', tool_use_id: tb.id, content: JSON.stringify(res) });
        }
        history.push({ role: 'user', content: retryResults });
        retryFinal = await anthropic.messages.create({
          model: CLAUDE_SONNET, max_tokens: MAX_TOKENS,
          system: sessionSystemPrompt,
          tools: filteredTools, messages: history
        });
      }

      const retryText = retryFinal.content.find(b => b.type === 'text');
      if (bookingToolCalled) {
        console.log('[HALLUCINATION] ✅ Retry réussi — RDV créé au 2ème essai');
        responseText = retryText?.text || responseText;
        response = retryFinal;
      } else {
        console.error('[HALLUCINATION] ❌ Retry échoué — forçage message correctif');
        responseText = "Je m'excuse, j'ai eu un souci technique. Pour finaliser votre réservation, pouvez-vous me redonner votre nom complet et votre numéro de téléphone ?";
        response = retryFinal;
      }
    }

    // Sauvegarder dans l'historique
    history.push({ role: 'assistant', content: response.content });

    // Limiter l'historique à 30 messages
    while (history.length > 30) {
      history.shift();
    }

    const duration = Date.now() - startTime;

    // 📊 SENTINEL - Track coûts par tenant
    if (response.usage) {
      const tracking = await trackTenantCall(tenantId, response.model || 'sonnet', response.usage.input_tokens || 0, response.usage.output_tokens || 0);
      console.log(`[SENTINEL] ${tenantId} - Coût appel: ${tracking.callCost.toFixed(4)}€ | Total: ${tracking.totalCost.toFixed(4)}€`);
      // 💰 Log prompt caching
      const cacheWrite = response.usage.cache_creation_input_tokens || 0;
      const cacheRead = response.usage.cache_read_input_tokens || 0;
      if (cacheWrite > 0 || cacheRead > 0) {
        console.log(`[CACHE] 💰 write: ${cacheWrite} | read: ${cacheRead} | input: ${response.usage.input_tokens} (${cacheRead > 0 ? Math.round(cacheRead / (cacheRead + response.usage.input_tokens) * 100) + '% cached' : 'creation'})`);
      }
    }

    console.log(`[NEXUS CORE] ✅ Réponse en ${duration}ms`);
    if (duration > 3000) {
      logger.warn('Réponse lente', { tag: 'NEXUS CORE', duration, channel });
    }

    // 💰 OPTIMISATION 4: Mettre en cache si FAQ (pas de booking)
    if (!bookingToolCalled && responseCache.isCacheable(message, cacheContext)) {
      responseCache.set(message, responseText, cacheContext);
      console.log(`[NEXUS CORE] 💰 Réponse mise en cache pour futures requêtes similaires`);

      // 🫀 PULSE: Événement cache set
      liveEventStream.cache({
        action: 'Cache SET',
        question: message.substring(0, 50),
        ttl: '24h',
        tenantId,
        channel
      });
    }

    // 🫀 PULSE: Événement conversation terminée
    const callCost = response.usage
      ? ((response.usage.input_tokens * 0.000003) + (response.usage.output_tokens * 0.000015))
      : 0;

    liveEventStream.conversation({
      action: 'Conversation completed',
      question: message.substring(0, 60),
      model: selectedModel.includes('haiku') ? 'Haiku' : 'Sonnet',
      tokens: response.usage?.input_tokens + response.usage?.output_tokens || 0,
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0,
      cost: callCost.toFixed(4),
      responseTime: `${duration}ms`,
      tenantId,
      channel,
      hasBooking: bookingToolCalled
    });

    // 🫀 PULSE: Événement économies (si Haiku utilisé)
    if (selectedModel.includes('haiku')) {
      const sonnetCost = response.usage
        ? ((response.usage.input_tokens * 0.000003) + (response.usage.output_tokens * 0.000015))
        : 0;
      const haikuCost = response.usage
        ? ((response.usage.input_tokens * 0.00000025) + (response.usage.output_tokens * 0.00000125))
        : 0;
      const saving = sonnetCost - haikuCost;

      if (saving > 0) {
        liveEventStream.cost({
          action: 'Cost Saved (Haiku)',
          saving: saving.toFixed(4),
          percentage: ((saving / sonnetCost) * 100).toFixed(1),
          tenantId
        });
      }
    }

    // 📊 Stats d'optimisation
    const cacheStats = responseCache.getStats();
    const routerStats = modelRouter.getStats();
    if (cacheStats.hits > 0 || routerStats.haiku > 0) {
      console.log(`[NEXUS CORE] 💰 Optimisations: Cache ${cacheStats.hitRate}% hit | Haiku ${routerStats.haikuPercentage}% | Économies ~${cacheStats.estimatedSavings}€`);
    }
    console.log(`[NEXUS CORE] ══════════════════════════════════════\n`);

    return {
      success: true,
      response: responseText,
      channel,
      conversationId,
      duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[NEXUS CORE] ❌ ERREUR DÉTAILLÉE:`);
    console.error(`[NEXUS CORE] ❌ Type: ${error.constructor.name}`);
    console.error(`[NEXUS CORE] ❌ Message: ${error.message}`);
    console.error(`[NEXUS CORE] ❌ Canal: ${channel}`);
    console.error(`[NEXUS CORE] ❌ Durée: ${duration}ms`);
    if (error.status) console.error(`[NEXUS CORE] ❌ Status HTTP: ${error.status}`);
    if (error.response) console.error(`[NEXUS CORE] ❌ Response:`, JSON.stringify(error.response, null, 2));
    console.error(`[NEXUS CORE] ══════════════════════════════════════\n`);

    // 🫀 PULSE: Événement erreur
    liveEventStream.error({
      action: 'API Error',
      errorType: error.constructor.name,
      errorMessage: error.message.substring(0, 100),
      channel,
      tenantId,
      duration: `${duration}ms`
    });

    return {
      success: false,
      response: "Désolée, j'ai rencontré un problème technique. Pouvez-vous réessayer ?",
      channel,
      conversationId,
      duration,
      error: error.message
    };
  }
}

// ============================================
// POINT D'ENTRÉE STREAMING - processMessageStreaming
// ============================================

/**
 * 🚀 Version streaming pour réponses progressives (SSE)
 * Utilise anthropic.messages.stream() pour envoyer les tokens au fur et à mesure
 *
 * @param {string} message - Message de l'utilisateur
 * @param {string} channel - Canal (whatsapp, web, phone, sms, admin)
 * @param {object} context - Contexte (conversationId, userId, phone, etc.)
 * @yields {Object} { type: 'text_delta' | 'tool_use' | 'done', content: string }
 */
/**
 * Extrait des quick replies contextuels basés sur le message user, la réponse assistant et les résultats d'outils.
 */
function extractQuickReplies(userMessage, responseText, toolResultsAccum) {
  const replies = [];
  const lowerUser = (userMessage || '').toLowerCase();
  const lowerResponse = (responseText || '').toLowerCase();

  // ═══ CAS 1 : QUESTION SUR SERVICES/PRESTATIONS ═══
  const serviceKw = ['prestations', 'services', 'proposez', 'faites', 'coiffure', 'types de'];
  if (serviceKw.some(kw => lowerUser.includes(kw))) {
    // Try from tool results first
    const svcResult = toolResultsAccum?.find(r => r.name === 'get_services' || r.name === 'list_services');
    let svcData = null;
    if (svcResult) {
      try { svcData = typeof svcResult.result === 'string' ? JSON.parse(svcResult.result) : svcResult.result; } catch {}
    }
    if (svcData?.services?.length || svcData?.success) {
      const services = svcData.services || svcData.data || [];
      for (const s of services.slice(0, 6)) {
        const nom = s.nom || s.name;
        const prix = s.prix || s.prixExact || s.price || null;
        replies.push({
          type: 'service',
          label: prix ? `${nom} - ${Math.round(prix)}€` : nom,
          value: `Je veux réserver ${nom}`
        });
      }
    }
    // Fallback: extract "Service - XXX€" from response text
    if (replies.length === 0) {
      const pricePattern = /[-•]\s*\*{0,2}([^*\n:–-]+?)\*{0,2}\s*[-–:]\s*(\d+)\s*€/g;
      let m;
      while ((m = pricePattern.exec(responseText)) !== null && replies.length < 6) {
        const nom = m[1].trim();
        if (nom.length > 2 && nom.length < 50) {
          replies.push({ type: 'service', label: `${nom} - ${m[2]}€`, value: `Je veux réserver ${nom}` });
        }
      }
    }
  }

  // ═══ CAS 2 : QUESTION SUR HORAIRES/DISPONIBILITÉS ═══
  const schedKw = ['horaires', 'ouvert', 'disponibilit', 'créneaux', 'travaillez', 'dispo'];
  if (replies.length === 0 && schedKw.some(kw => lowerUser.includes(kw))) {
    // Extract time slots from response (Xh or Xh30 patterns between 8-20h)
    const timePattern = /(\d{1,2})h(\d{2})?\b/g;
    const times = [];
    let m;
    while ((m = timePattern.exec(responseText)) !== null) {
      const h = parseInt(m[1]);
      const min = m[2] || '00';
      if (h >= 8 && h <= 20) {
        const label = `${h}h${min === '00' ? '' : min}`;
        if (!times.includes(label)) times.push(label);
      }
    }
    if (times.length >= 2) {
      for (const t of times.slice(0, 6)) {
        replies.push({ type: 'timeslot', label: t, value: `Je veux un rendez-vous à ${t}` });
      }
    }
  }

  // ═══ CAS 3 : QUESTION SUR PRIX/TARIFS ═══
  const priceKw = ['prix', 'tarif', 'combien', 'coût', 'coute'];
  if (replies.length === 0 && priceKw.some(kw => lowerUser.includes(kw))) {
    const pricePattern = /[-•]\s*\*{0,2}([^*\n:–-]+?)\*{0,2}\s*[-–:]\s*(\d+)\s*€/g;
    let m;
    while ((m = pricePattern.exec(responseText)) !== null && replies.length < 6) {
      const nom = m[1].trim();
      if (nom.length > 2 && nom.length < 50) {
        replies.push({ type: 'service', label: `${nom} - ${m[2]}€`, value: `Je veux réserver ${nom}` });
      }
    }
  }

  // ═══ CAS 4 : DEMANDE DE RDV - créneaux proposés ═══
  const rdvKw = ['rendez-vous', 'réserver', 'rdv', 'prendre rdv', 'booking'];
  if (replies.length === 0 && rdvKw.some(kw => lowerUser.includes(kw))) {
    const timePattern = /(\d{1,2})h(\d{2})?\b/g;
    const times = [];
    let m;
    while ((m = timePattern.exec(responseText)) !== null) {
      const h = parseInt(m[1]);
      const min = m[2] || '00';
      if (h >= 8 && h <= 20) {
        const label = `${h}h${min === '00' ? '' : min}`;
        if (!times.includes(label)) times.push(label);
      }
    }
    if (times.length >= 2) {
      for (const t of times.slice(0, 6)) {
        replies.push({ type: 'timeslot', label: t, value: `Je choisis le créneau de ${t}` });
      }
    }
  }

  // ═══ CAS 5 : QUESTIONS OUI/NON (restrictif) ═══
  // On n'affiche Oui/Non QUE pour de vraies confirmations, PAS pour les questions ouvertes
  if (replies.length === 0) {
    // Patterns de vraies questions Oui/Non (fin de phrase, contexte de confirmation)
    const yesNoPatterns = [
      /\bconfirmez[-\s]vous\s*\?/i,
      /\bvous convient[-\s]il\s*\?/i,
      /\bc'est bien ça\s*\?/i,
      /\best[-\s]ce correct\s*\?/i,
      /\bje confirme\s*(le|la|ce|cette|votre)\b/i,
      /\bje peux procéder\s*\?/i,
      /\bsouhaitez[-\s]vous que je\s+(confirme|réserve|enregistre|procède)/i,
      /\bvoulez[-\s]vous que je\s+(confirme|réserve|enregistre|procède)/i,
    ];

    // Patterns de questions ouvertes (ne PAS afficher Oui/Non)
    const openQuestionPatterns = [
      /\bquel(le)?s?\b/i,
      /\bcomment\b/i,
      /\boù\b/i,
      /\bquand\b/i,
      /\bpourquoi\b/i,
      /\bcombien\b/i,
      /\bà quelle\b/i,
      /\bde quel(le)?\b/i,
      /pouvez[-\s]vous me (dire|donner|communiquer|indiquer)/i,
    ];

    // Ne montrer Oui/Non que si c'est une vraie confirmation ET pas une question ouverte
    const isYesNoQuestion = yesNoPatterns.some(p => p.test(responseText));
    const isOpenQuestion = openQuestionPatterns.some(p => p.test(responseText));

    if (isYesNoQuestion && !isOpenQuestion) {
      replies.push({ type: 'confirm', label: 'Oui', value: 'Oui' });
      replies.push({ type: 'confirm', label: 'Non', value: 'Non' });
    }
  }

  return replies.length > 0 ? replies.slice(0, 6) : null;
}

export async function* processMessageStreaming(message, channel, context = {}) {
  const startTime = Date.now();
  const conversationId = context.conversationId || `${channel}_${context.phone || context.userId || Date.now()}`;

  // 🏢 Multi-tenant : charger la config du tenant + agent IA
  // 🔒 TENANT ISOLATION: tenantId est OBLIGATOIRE - pas de fallback
  const tenantId = context.tenantId;
  if (!tenantId) {
    console.error(`[NEXUS CORE] TENANT_ID_REQUIRED: processMessageStreaming called without tenantId`);
    yield { type: 'error', error: 'TENANT_ID_REQUIRED' };
    return;
  }
  const tenantConfig = await enrichTenantWithAgent(tenantId, { ...getTenantConfig(tenantId) });

  // Charger config IA admin pour ce channel
  applyIAConfig(tenantConfig, await loadIAConfig(tenantId, channel));

  // 🤝 Reconnaissance client
  if (context.phone) {
    try {
      const clientContext = await recognizeClient(tenantId, context.phone);
      tenantConfig.clientContext = clientContext;
      if (clientContext.known) {
        console.log(`[NEXUS CORE] 🤝 Client reconnu (stream): ${clientContext.displayName}`);
      }
    } catch (err) {
      console.warn(`[NEXUS CORE] Client recognition failed:`, err.message);
    }
  }

  console.log(`[NEXUS CORE] 🏢 Tenant: ${tenantId} (${tenantConfig.name}) Agent: ${tenantConfig.assistantName}`);

  console.log(`\n[NEXUS CORE] ══════════════════════════════════════`);
  console.log(`[NEXUS CORE] 📨 STREAMING ${channel.toUpperCase()} - ${conversationId}`);
  console.log(`[NEXUS CORE] Message: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"`);

  try {
    const anthropic = getAnthropic();
    if (!anthropic) {
      throw new Error('Client Anthropic non configuré');
    }

    // Récupérer l'historique
    const history = getConversationHistory(conversationId);
    history.push({ role: 'user', content: message });

    // Sélection adaptative du modèle via modelRouter centralisé
    // Compter uniquement les vrais tours utilisateur (pas les tool_results)
    const userTurnCountStream = history.filter(m => m.role === 'user' && typeof m.content === 'string').length;
    const routerResultStream = modelRouter.selectModel({
      userMessage: message,
      context: { conversationLength: userTurnCountStream }
    });
    const selectedModel = routerResultStream.model;
    const modelReason = routerResultStream.reason;
    const modelEmoji = selectedModel.includes('haiku') ? '⚡' : '🧠';
    console.log(`[NEXUS CORE] ${modelEmoji} Modèle: ${selectedModel.includes('haiku') ? 'HAIKU' : 'SONNET'} (${modelReason})`);

    // 🔒 Générer et cacher le prompt pour toute la session streaming
    const rawStreamPrompt = await getSystemPromptUnified(channel, tenantConfig);
    const sessionStreamPrompt = promptOptimizer.optimize(rawStreamPrompt, {
      isSimple: routerResultStream.complexity < 3
    });

    // 🔧 Filtrage outils par business type + plan
    const businessTypeStream = tenantConfig.business_profile || tenantConfig.businessProfile || 'salon';
    const tenantPlanStream = tenantConfig.plan || 'free';
    let filteredToolsStream = getToolsForPlanAndBusiness(tenantPlanStream, businessTypeStream);

    // 💰 OPTIMISATION: Réduire les outils pour Haiku (questions simples)
    if (selectedModel.includes('haiku')) {
      const ESSENTIAL_TOOL_NAMES = [
        'parse_date', 'get_services', 'get_available_slots', 'create_booking',
        'get_salon_info', 'get_business_hours', 'get_price', 'check_availability',
        'find_appointment', 'get_upcoming_days',
      ];
      const essentialTools = filteredToolsStream.filter(t => ESSENTIAL_TOOL_NAMES.includes(t.name));
      if (essentialTools.length > 0) {
        console.log(`[NEXUS CORE] 💰 Haiku stream: ${essentialTools.length} outils essentiels (au lieu de ${filteredToolsStream.length})`);
        filteredToolsStream = essentialTools;
      }
    }

    let currentModel = selectedModel;
    let continueLoop = true;
    let fullResponseText = '';
    let allToolResults = [];

    // 💰 PROMPT CACHING streaming: system + outils cachés ~5min
    const cachedStreamSystem = [{
      type: 'text',
      text: sessionStreamPrompt,
      cache_control: { type: 'ephemeral' }
    }];
    let cachedStreamTools = filteredToolsStream.length > 0
      ? filteredToolsStream.map((t, i) =>
          i === filteredToolsStream.length - 1
            ? { ...t, cache_control: { type: 'ephemeral' } }
            : t
        )
      : [];

    while (continueLoop) {
      console.log(`[NEXUS CORE] 🤖 Appel Claude API (streaming, ${currentModel === CLAUDE_HAIKU ? 'HAIKU' : 'SONNET'})...`);

      // Utiliser le streaming avec prompt caché et outils filtrés + cache
      const stream = await anthropic.messages.stream({
        model: currentModel,
        max_tokens: MAX_TOKENS,
        system: cachedStreamSystem,
        tools: cachedStreamTools,
        messages: history
      });

      let currentToolUse = null;
      let toolUseBlocks = [];
      let contentBlocks = [];

      // Écouter les événements du stream
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolUse = {
              type: 'tool_use',
              id: event.content_block.id,
              name: event.content_block.name,
              input: ''
            };
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            // Envoyer le chunk de texte
            yield { type: 'text_delta', content: event.delta.text };
            fullResponseText += event.delta.text;
          } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
            currentToolUse.input += event.delta.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          if (currentToolUse) {
            try {
              currentToolUse.input = JSON.parse(currentToolUse.input || '{}');
            } catch (e) {
              currentToolUse.input = {};
            }
            toolUseBlocks.push(currentToolUse);
            contentBlocks.push(currentToolUse);
            currentToolUse = null;
          }
        } else if (event.type === 'message_stop') {
          // Message terminé
        }
      }

      // Récupérer le message final pour l'historique
      const finalMessage = await stream.finalMessage();
      history.push({ role: 'assistant', content: finalMessage.content });

      // 📊 SENTINEL - Track coûts par tenant
      if (finalMessage.usage) {
        const tracking = await trackTenantCall(tenantId, finalMessage.model || currentModel || 'sonnet', finalMessage.usage.input_tokens || 0, finalMessage.usage.output_tokens || 0);
        console.log(`[SENTINEL] ${tenantId} - Coût appel: ${tracking.callCost.toFixed(4)}€ | Total: ${tracking.totalCost.toFixed(4)}€`);
        // 💰 Log prompt caching
        const cacheWrite = finalMessage.usage.cache_creation_input_tokens || 0;
        const cacheRead = finalMessage.usage.cache_read_input_tokens || 0;
        if (cacheWrite > 0 || cacheRead > 0) {
          console.log(`[CACHE] 💰 write: ${cacheWrite} | read: ${cacheRead} | input: ${finalMessage.usage.input_tokens} (${cacheRead > 0 ? Math.round(cacheRead / (cacheRead + finalMessage.usage.input_tokens) * 100) + '% cached' : 'creation'})`);
        }
      }

      // Si tool_use, exécuter les outils et continuer
      if (finalMessage.stop_reason === 'tool_use' && toolUseBlocks.length > 0) {
        yield { type: 'tool_processing', content: `Traitement de ${toolUseBlocks.length} outil(s)...` };

        const toolResults = [];
        for (const toolBlock of toolUseBlocks) {
          const result = await executeTool(toolBlock.name, toolBlock.input, channel, tenantId);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify(result)
          });
          // Accumulate for quick replies extraction
          allToolResults.push({ name: toolBlock.name, result });
        }

        history.push({ role: 'user', content: toolResults });
        // Escalade Sonnet UNIQUEMENT si booking
        const needsSonnetStream = toolUseBlocks.some(tb =>
          tb.name === 'create_booking' || tb.name === 'create_appointment'
        );
        if (needsSonnetStream) {
          currentModel = CLAUDE_SONNET;
          // Remettre les outils complets pour Sonnet + cache
          filteredToolsStream = getToolsForPlanAndBusiness(tenantPlanStream, businessTypeStream);
          cachedStreamTools = filteredToolsStream.map((t, i) =>
            i === filteredToolsStream.length - 1
              ? { ...t, cache_control: { type: 'ephemeral' } }
              : t
          );
          console.log(`[NEXUS CORE] 🔄 Stream: Escalade → SONNET (booking détecté)`);
        }
        // Sinon: currentModel reste Haiku
        // Continuer la boucle pour la réponse suivante
      } else {
        continueLoop = false;
      }
    }

    // Limiter l'historique
    while (history.length > 30) {
      history.shift();
    }

    const duration = Date.now() - startTime;
    console.log(`[NEXUS CORE] ✅ Streaming terminé en ${duration}ms`);
    console.log(`[NEXUS CORE] ══════════════════════════════════════\n`);

    // Extract contextual quick replies
    const quickReplies = extractQuickReplies(message, fullResponseText, allToolResults);

    yield {
      type: 'done',
      content: fullResponseText,
      conversationId,
      duration,
      quickReplies
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[NEXUS CORE] ❌ Erreur streaming:`, error.message);

    yield {
      type: 'error',
      content: "Désolée, j'ai rencontré un problème technique.",
      error: error.message,
      duration
    };
  }
}

// ============================================
// FONCTIONS EXPOSÉES POUR LES AUTRES MODULES
// ============================================

export {
  // Re-export depuis businessRules.js
  SERVICES,
  TRAVEL_FEES,
  BUSINESS_HOURS,
  BOOKING_RULES,
  findServiceByName,
  getAllServices,
  getServicesByCategory,

  // Note: createReservationUnified déjà exporté via "export async function"

  // Fonctions utilitaires
  clearConversation,
  getConversationHistory,

  // Cache management
  invalidateCache,

  // Tools execution (pour tests)
  executeTool,

  // 🆕 Dynamic tenant-aware functions
  getSystemPromptUnified,
  getServicesForTenant,
  findServiceByNameForTenant,
  getTravelFeesForTenant,
  calculateTravelFeeForTenant,
  getBusinessHoursForTenant,

  // 🆕 Remplace SALON_INFO hardcode
  getBusinessInfoForTenant,
  getBusinessInfoForTenantSync,
};

// ============================================
// EXPORTS POUR COMPATIBILITÉ (avec ancien nexusCore)
// ============================================

// États de conversation - compatibilité avec l'ancien système basé machine d'états
// Note: Le nouveau nexusCore utilise Claude avec tools, ces états servent
// uniquement pour les services qui vérifient l'état explicitement
export const CONVERSATION_STATES = Object.freeze({
  ACCUEIL: 'accueil',
  ATTENTE_SERVICE: 'attente_service',
  CLARIFICATION_SERVICE: 'clarification_service',
  ATTENTE_DATE: 'attente_date',
  ATTENTE_HEURE: 'attente_heure',
  CONFIRMATION_CRENEAU: 'confirmation_creneau',
  ATTENTE_LIEU: 'attente_lieu',
  ATTENTE_ADRESSE: 'attente_adresse',
  ATTENTE_NOM: 'attente_nom',
  ATTENTE_TELEPHONE: 'attente_telephone',
  CONFIRMATION: 'confirmation',
  TERMINE: 'termine'
});

// Factory pour créer un contexte de conversation - compatibilité
export function createConversationContext(canal = 'chat') {
  return {
    state: CONVERSATION_STATES.ACCUEIL,
    canal,
    services: [],
    date: null,
    heure: null,
    lieu: null,
    adresseClient: null,
    nomClient: null,
    telephone: null,
    messageHistory: []
  };
}

// Pour les modules qui importaient depuis l'ancien nexusCore
export const HORAIRES = BUSINESS_HOURS;
export const DEPLACEMENT = TRAVEL_FEES;

export default {
  processMessage,
  processMessageStreaming,  // 🚀 Version streaming SSE
  SERVICES,
  TRAVEL_FEES,
  BUSINESS_HOURS,
  BOOKING_RULES,
  SERVICE_OPTIONS,  // 🚦 Flag domicile activé/désactivé
  SALON_INFO,  // @deprecated - utiliser getBusinessInfoForTenant(tenantId)
  getBusinessInfoForTenant,  // Remplace SALON_INFO
  getBusinessInfoForTenantSync,  // Version synchrone
  clearConversation,
  findServiceByName,
  getAllServices,
  getServicesByCategory,
  invalidateCache,
  // 🔒 Fonction unique de création RDV
  createReservationUnified,
  // Compatibilité avec ancien nexusCore
  CONVERSATION_STATES,
  createConversationContext
};
