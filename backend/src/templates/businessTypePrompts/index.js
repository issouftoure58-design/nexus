/**
 * Business Type Prompt Dispatcher
 *
 * Couche adaptative : charge les règles spécifiques au type de business
 * et fournit le BUSINESS_CONTEXTS unifié pour l'admin chat.
 *
 * @module businessTypePrompts
 */

import { getPromptRules as getServiceDomicileRules } from './serviceDomicile.js';
import { getPromptRules as getSalonRules } from './salon.js';
import { getPromptRules as getRestaurantRules } from './restaurant.js';
import { getPromptRules as getHotelRules } from './hotel.js';
import { getPromptRules as getCommerceRules } from './commerce.js';
import { getPromptRules as getSecurityRules } from './security.js';
import { getPromptRules as getServiceRules } from './service.js';

// Mapping type → adapter
const ADAPTERS = {
  service_domicile: getServiceDomicileRules,
  salon: getSalonRules,
  restaurant: getRestaurantRules,
  hotel: getHotelRules,
  commerce: getCommerceRules,
  security: getSecurityRules,
  service: getServiceRules,
};

/**
 * Retourne les règles prompt pour un type de business donné
 * @param {string} businessType - Type de business (service_domicile, salon, restaurant, hotel, commerce, security, service)
 * @param {Object} tenantConfig - Configuration du tenant
 * @returns {Object} - { rules, bookingProcess, terminology, tools, specialServices? }
 */
export function getBusinessTypeRules(businessType, tenantConfig) {
  const adapter = ADAPTERS[businessType] || ADAPTERS.salon;
  return adapter(tenantConfig);
}

/**
 * BUSINESS_CONTEXTS — Contextes métier pour l'admin chat et le prompt engine
 * Remplace l'ancien BUSINESS_CONTEXTS de systemPrompt.js
 * Inclut les 7 types (service ajouté en v3.25)
 */
export const BUSINESS_CONTEXTS = {
  service_domicile: {
    description: 'prestataire de services à domicile',
    actions: [
      'Se déplace chez les clients',
      'Calcule les frais de déplacement selon la distance',
      'Gère les zones de couverture géographique',
    ],
    terminology: {
      booking: 'rendez-vous',
      client: 'client',
      staff: 'prestataire',
    },
  },
  salon: {
    description: 'établissement avec un lieu fixe',
    actions: [
      'Accueille les clients sur place',
      'Gère les postes de travail et le personnel',
      'Pas de frais de déplacement',
    ],
    terminology: {
      booking: 'rendez-vous',
      client: 'client',
      staff: 'membre de l\'équipe',
    },
  },
  restaurant: {
    description: 'restaurant',
    actions: [
      'Gère les réservations de tables',
      'Prend en compte le nombre de couverts',
      'Propose différents services (déjeuner, dîner, brunch)',
    ],
    terminology: {
      booking: 'réservation',
      client: 'client',
      staff: 'serveur',
    },
  },
  hotel: {
    description: 'hôtel / hébergement',
    actions: [
      'Gère les réservations de chambres',
      'Prend en compte les dates d\'arrivée et de départ',
      'Propose des extras et services additionnels',
    ],
    terminology: {
      booking: 'réservation',
      client: 'hôte',
      staff: 'réceptionniste',
    },
  },
  commerce: {
    description: 'commerce / restauration rapide',
    actions: [
      'Gère les commandes (click & collect, livraison)',
      'Catalogue de produits avec gestion de stock',
      'Pas de notion de durée ni de rendez-vous',
    ],
    terminology: {
      booking: 'commande',
      client: 'client',
      staff: 'équipe',
    },
  },
  security: {
    description: 'sécurité privée / mise à disposition',
    actions: [
      'Gère les missions et devis de sécurité',
      'Allocation d\'agents sur plusieurs sites',
      'Planification multi-jours et tarification horaire/journalière',
    ],
    terminology: {
      booking: 'mission',
      client: 'client',
      staff: 'agent',
    },
  },
  service: {
    description: 'prestataire de services, conseil ou formation',
    actions: [
      'Gère les rendez-vous et prestations',
      'Suivi client et facturation',
      'Pas de frais de déplacement par défaut',
    ],
    terminology: {
      booking: 'rendez-vous',
      client: 'client',
      staff: 'collaborateur',
    },
  },
};

export default {
  getBusinessTypeRules,
  BUSINESS_CONTEXTS,
};
