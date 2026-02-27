/**
 * SYSTEM PROMPT GENERATOR - Multi-tenant & Multi-business
 *
 * Génère des prompts système dynamiques basés sur:
 * - Le type de business (salon, restaurant, hotel, service_domicile)
 * - La configuration du tenant
 * - Le canal de communication (phone, whatsapp, web, admin)
 *
 * @module systemPrompt
 */

import { getBusinessInfoSync, getAIContext, getTerminology, hasFeature } from '../services/tenantBusinessService.js';
import { BUSINESS_TYPES } from '../config/businessTypes.js';

// ============================================
// CONTEXTES PAR TYPE DE BUSINESS
// ============================================

const BUSINESS_CONTEXTS = {
  service_domicile: {
    description: 'prestataire de services à domicile',
    actions: [
      'Se déplace chez les clients',
      'Calcule les frais de déplacement selon la distance',
      'Gère les zones de couverture géographique'
    ],
    terminology: {
      booking: 'rendez-vous',
      client: 'client',
      staff: 'prestataire'
    }
  },
  salon: {
    description: 'établissement avec un lieu fixe',
    actions: [
      'Accueille les clients sur place',
      'Gère les postes de travail et le personnel',
      'Pas de frais de déplacement'
    ],
    terminology: {
      booking: 'rendez-vous',
      client: 'client',
      staff: 'membre de l\'équipe'
    }
  },
  restaurant: {
    description: 'restaurant',
    actions: [
      'Gère les réservations de tables',
      'Prend en compte le nombre de couverts',
      'Propose différents services (déjeuner, dîner, brunch)'
    ],
    terminology: {
      booking: 'réservation',
      client: 'client',
      staff: 'serveur'
    }
  },
  hotel: {
    description: 'hôtel',
    actions: [
      'Gère les réservations de chambres',
      'Prend en compte les dates d\'arrivée et de départ',
      'Propose des extras et services additionnels'
    ],
    terminology: {
      booking: 'séjour',
      client: 'hôte',
      staff: 'réceptionniste'
    }
  }
};

// ============================================
// GÉNÉRATEUR DE PROMPT PRINCIPAL
// ============================================

/**
 * Génère le prompt système pour un tenant
 *
 * @param {string} tenantId - ID du tenant
 * @param {Object} options - Options de génération
 * @param {string} options.channel - Canal (phone, whatsapp, web, admin)
 * @param {boolean} options.isAdmin - Si c'est pour l'interface admin
 * @param {boolean} options.includeTools - Inclure les instructions pour les outils
 * @returns {string} - Prompt système complet
 */
export function generateSystemPrompt(tenantId, options = {}) {
  const { channel = 'web', isAdmin = false, includeTools = false } = options;

  try {
    const info = getBusinessInfoSync(tenantId);
    const businessType = info.business_type || 'service_domicile';
    const businessContext = BUSINESS_CONTEXTS[businessType] || BUSINESS_CONTEXTS.service_domicile;

    // Informations de base
    const assistantName = info.assistant_name || 'Nexus';
    const businessName = info.nom || 'Notre établissement';
    const ownerName = info.gerant || 'le responsable';
    const address = info.adresse || '';
    const phone = info.telephone || '';

    // Construction du prompt
    let prompt = '';

    if (isAdmin) {
      prompt = generateAdminPrompt(tenantId, info, businessContext, assistantName, businessName, ownerName);
    } else {
      prompt = generateClientPrompt(tenantId, info, businessContext, assistantName, businessName, ownerName, channel);
    }

    // Ajout du contexte business spécifique
    prompt += generateBusinessRules(info, businessType);

    // Instructions pour les outils si demandé
    if (includeTools) {
      prompt += generateToolInstructions(tenantId);
    }

    return prompt;
  } catch (error) {
    console.error(`[SystemPrompt] Erreur génération prompt pour ${tenantId}:`, error);
    return getFallbackPrompt();
  }
}

// ============================================
// PROMPTS POUR LES CLIENTS
// ============================================

function generateClientPrompt(tenantId, info, businessContext, assistantName, businessName, ownerName, channel) {
  const isFeminine = assistantName === 'Halimah';
  const termBooking = businessContext.terminology.booking;

  let prompt = `Tu es ${assistantName}, l'assistant${isFeminine ? 'e' : ''} virtuel${isFeminine ? 'le' : ''} de ${businessName}.

IDENTITÉ:
- Nom: ${assistantName}
- Établissement: ${businessName}
- Responsable: ${ownerName}
- Type: ${businessContext.description}

PERSONNALITÉ:
- Chaleureux${isFeminine ? 'se' : ''} et professionnel${isFeminine ? 'le' : ''}
- Tu VOUVOIES toujours les clients
- Efficace, tu vas droit au but
- Empathique sans être trop familier${isFeminine ? 'ière' : ''}

MISSION PRINCIPALE:
- Aider les clients à prendre ${termBooking}
- Répondre aux questions sur les services et tarifs
- Fournir les informations pratiques
`;

  // Ajustements par canal
  if (channel === 'phone') {
    prompt += `
CANAL: TÉLÉPHONE
- Sois TRÈS concis${isFeminine ? 'e' : ''} (chaque caractère coûte)
- Réponses courtes et naturelles
- Utilise des confirmations: "Parfait !", "C'est noté !"
- Maximum 100-150 caractères par réponse
`;
  } else if (channel === 'whatsapp') {
    prompt += `
CANAL: WHATSAPP
- Utilise des emojis avec parcimonie
- Réponses structurées et claires
- Tu peux envoyer des liens de réservation
`;
  }

  // Informations de contact
  if (info.telephone) {
    prompt += `\nTÉLÉPHONE: ${info.telephone}`;
  }
  if (info.adresse) {
    prompt += `\nADRESSE: ${info.adresse}`;
  }

  return prompt;
}

// ============================================
// PROMPTS POUR L'ADMIN (BACK-OFFICE)
// ============================================

function generateAdminPrompt(tenantId, info, businessContext, assistantName, businessName, ownerName) {
  const isFeminine = assistantName === 'Halimah';

  return `Tu es ${assistantName} Pro, l'assistant${isFeminine ? 'e' : ''} IA personnel${isFeminine ? 'le' : ''} de ${ownerName} pour gérer ${businessName}.

IDENTITÉ ADMIN:
- Tu travailles pour ${ownerName} (ton/ta patron${isFeminine ? 'ne' : ''})
- Tu gères le back-office de ${businessName}
- Tu as accès aux données métier (clients, réservations, CA, etc.)

PERSONNALITÉ ADMIN:
- Tu tutoies ${ownerName}
- Tu es complice et efficace
- Tu anticipes les besoins
- Tu mémorises les préférences

CAPACITÉS:
- Analyse des données business
- Génération de rapports et bilans
- Gestion des clients et réservations
- Création de contenus marketing
- Insights et recommandations

TON ET STYLE:
- Chaleureux mais professionnel
- Proactif${isFeminine ? 've' : ''} et orienté${isFeminine ? 'e' : ''} solutions
- Tu peux utiliser de l'humour léger

RÈGLES:
- Confirme les actions importantes avant de les exécuter
- Ne jamais supprimer de données sans demander
- Toujours inclure les URLs des fichiers générés
`;
}

// ============================================
// RÈGLES BUSINESS SPÉCIFIQUES
// ============================================

function generateBusinessRules(info, businessType) {
  let rules = '\n\nRÈGLES MÉTIER:\n';

  // Règles communes
  rules += '- Ne jamais divulguer d\'informations confidentielles sur les autres clients\n';
  rules += '- Toujours confirmer les détails importants avant de finaliser\n';

  // Règles par type de business
  switch (businessType) {
    case 'service_domicile':
      rules += '- Toujours demander l\'adresse complète du client\n';
      rules += '- Calculer et annoncer les frais de déplacement\n';
      rules += '- Vérifier que l\'adresse est dans la zone de couverture\n';
      break;

    case 'salon':
      rules += '- Proposer les créneaux disponibles\n';
      rules += '- Informer sur le temps de service estimé\n';
      break;

    case 'restaurant':
      rules += '- Toujours demander le nombre de couverts\n';
      rules += '- Mentionner les allergies/régimes spéciaux si demandé\n';
      rules += '- Proposer les différents services (déjeuner, dîner)\n';
      break;

    case 'hotel':
      rules += '- Demander les dates d\'arrivée et de départ\n';
      rules += '- Proposer les types de chambres disponibles\n';
      rules += '- Mentionner les extras possibles\n';
      break;
  }

  // Horaires si disponibles
  if (info.horaires) {
    rules += '\nHORAIRES:\n';
    const jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    for (const jour of jours) {
      const h = info.horaires[jour];
      if (h && h.ouvert) {
        rules += `- ${jour.charAt(0).toUpperCase() + jour.slice(1)}: ${h.debut} - ${h.fin}\n`;
      } else if (h && !h.ouvert) {
        rules += `- ${jour.charAt(0).toUpperCase() + jour.slice(1)}: Fermé\n`;
      }
    }
  }

  return rules;
}

// ============================================
// INSTRUCTIONS OUTILS
// ============================================

function generateToolInstructions(tenantId) {
  return `

UTILISATION DES OUTILS:
- Utilise les outils disponibles pour exécuter les actions demandées
- Ne pas simuler les résultats des outils
- Confirmer les actions avant de les exécuter si elles sont irréversibles
- Toujours inclure les URLs/liens dans tes réponses quand applicable
`;
}

// ============================================
// FALLBACK
// ============================================

function getFallbackPrompt() {
  return `Tu es un assistant virtuel professionnel.

PERSONNALITÉ:
- Chaleureux et professionnel
- Tu VOUVOIES les clients
- Efficace et concis

MISSION:
- Aider les clients avec leurs demandes
- Répondre aux questions
- Fournir des informations pratiques

RÈGLES:
- Sois poli et serviable
- Va droit au but
- Ne divulgue pas d'informations confidentielles
`;
}

// ============================================
// PROMPTS SPÉCIALISÉS
// ============================================

/**
 * Génère un prompt pour le canal vocal (téléphone)
 */
export function generateVoicePrompt(tenantId) {
  const basePrompt = generateSystemPrompt(tenantId, { channel: 'phone' });

  return basePrompt + `

OPTIMISATION VOCALE:
- SOIS TRÈS CONCIS (chaque caractère coûte de l'argent ElevenLabs)
- Réponses de MAX 100-150 caractères
- Utilise des expressions courtes: "Super !", "Parfait !", "C'est noté !"
- Évite les formules longues comme "Je vous confirme que..."
- Format prix: "50 euros" (pas "cinquante euros")
- Format horaires: "Samedi 14h" (pas "samedi à quatorze heures")
`;
}

/**
 * Génère un prompt pour WhatsApp
 */
export function generateWhatsAppPrompt(tenantId) {
  return generateSystemPrompt(tenantId, { channel: 'whatsapp' });
}

/**
 * Génère un prompt pour l'interface admin
 */
export function generateAdminAIPrompt(tenantId) {
  return generateSystemPrompt(tenantId, { isAdmin: true, includeTools: true });
}

// ============================================
// EXPORTS
// ============================================

export default {
  generateSystemPrompt,
  generateVoicePrompt,
  generateWhatsAppPrompt,
  generateAdminAIPrompt,
  BUSINESS_CONTEXTS
};
