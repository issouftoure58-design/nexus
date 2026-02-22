/**
 * Voice Prompt Engine
 *
 * Génère des prompts optimisés pour la synthèse vocale (TTS).
 * Focus sur la concision et le naturel.
 *
 * @module voicePromptEngine
 */

import { getEffectiveConfig, getFullAgentConfig } from './templateLoader.js';

// ============================================
// CONSTANTS
// ============================================

// Limites de longueur pour les réponses vocales
const VOICE_LIMITS = {
  simple: 50,    // Confirmations, oui/non
  medium: 100,   // Réponses courtes
  complex: 150,  // Réponses avec détails
};

// Formulations concises (remplace les versions longues)
const CONCISE_PHRASES = {
  // Confirmations
  "je vous confirme que": "c'est confirmé,",
  "je vous informe que": "",
  "je souhaiterais": "je voudrais",
  "n'hésitez pas à": "",
  "je me permets de": "",
  "votre rendez-vous est confirmé pour": "RDV confirmé :",
  "je vous remercie pour votre appel": "merci",
  "avez-vous d'autres questions": "autre chose ?",

  // Transitions
  "permettez-moi de vérifier": "je vérifie",
  "un petit instant s'il vous plaît": "un instant",
  "laissez-moi regarder": "je regarde",
};

// ============================================
// VOICE PROMPT GENERATOR
// ============================================

/**
 * Génère le system prompt optimisé pour la voix
 *
 * @param {Object} tenantConfig - Configuration du tenant
 * @param {Object} options - Options (includePrice, includeDate, etc.)
 * @returns {Promise<string>}
 */
export async function generateVoicePrompt(tenantConfig, options = {}) {
  const tc = await getEffectiveConfig(tenantConfig);
  const agentConfig = await getFullAgentConfig(tc.id);

  const name = tc.assistantName || 'l\'assistant';
  const gender = tc.assistantGender === 'M' ? '' : 'e';
  const businessName = tc.name || '';
  const gerante = tc.gerante || '';

  let prompt = `Tu es ${name}, assistant${gender} vocal${gender} de ${businessName}.

=== RÈGLE D'OR ===
Sois CONCIS${gender.toUpperCase()}. Chaque mot compte, chaque caractère coûte de l'argent.

=== LIMITES DE LONGUEUR ===
- Réponses simples : MAX ${VOICE_LIMITS.simple} caractères
- Réponses moyennes : MAX ${VOICE_LIMITS.medium} caractères
- Réponses complexes : MAX ${VOICE_LIMITS.complex} caractères

=== PERSONNALITÉ ===
- ${tc.personality?.tutoiement ? 'Tu TUTOIES' : 'Tu VOUVOIES'} toujours
- Ton ${tc.personality?.ton || 'chaleureux'} mais efficace
- Expressions naturelles : "Super !", "Parfait !", "D'accord !"
- Pas de bavardage, va droit au but

=== FORMULATIONS CONCISES ===
Au lieu de "Je vous confirme que votre rendez-vous est bien enregistré..."
Dis : "C'est noté ! ${gerante ? gerante + ' vous attend ' : ''}Samedi 14h, parfait."

Au lieu de "Permettez-moi de vérifier les disponibilités..."
Dis : "Je regarde... Samedi 10h, ça vous va ?"`;

  // Add business context
  prompt += `\n\n=== CONTEXTE ===
- ${businessName}${gerante ? ` = ${gerante}` : ''}, ${tc.secteur || ''}
- ${tc.serviceOptions?.domicile_enabled ? 'À domicile ou sur place' : 'Sur place uniquement'}
${tc.adresse ? `- Adresse : ${tc.adresse}` : ''}`;

  // Add hours if requested
  if (options.includeHours && tc.businessHours) {
    const closedDays = getClosedDays(tc.businessHours);
    prompt += `\n- Fermé : ${closedDays}`;
  }

  // Add role-specific rules
  prompt += `\n\n=== TON RÔLE : ${agentConfig.roleName || 'AGENT'} ===`;

  if (agentConfig.roleId === 'reservation') {
    prompt += `
- Vérifie TOUJOURS la dispo avant de proposer un créneau
- Note : nom + téléphone minimum
- Confirme : service + date + heure + prix`;
  }

  if (agentConfig.roleId === 'standard') {
    prompt += `
- Si personne occupée → "Je prends votre message ?"
- Note TOUJOURS : nom, téléphone, objet
- Après message → "C'est noté, on vous rappelle"`;
  }

  if (agentConfig.roleId === 'receptionniste') {
    prompt += `
- Accueille chaleureusement
- Oriente vers le bon service
- Si tu ne sais pas → "Je me renseigne"`;
  }

  // Add capabilities hints
  if (agentConfig.enabledCapabilities?.includes('transfer_call')) {
    prompt += `\n\n=== TRANSFERT D'APPEL ===
Si besoin de transférer, utilise transfer_call avec le numéro approprié.`;
  }

  if (agentConfig.enabledCapabilities?.includes('take_message')) {
    prompt += `\n\n=== PRISE DE MESSAGE ===
Infos à collecter : nom, téléphone, objet de l'appel.
Après : notifie la personne concernée.`;
  }

  return prompt;
}

/**
 * Génère le greeting vocal
 * @param {Object} tenantConfig
 * @returns {Promise<string>}
 */
export async function generateVoiceGreeting(tenantConfig) {
  const tc = await getEffectiveConfig(tenantConfig);
  const agentConfig = await getFullAgentConfig(tc.id);

  // Check for custom greeting
  const customGreeting = agentConfig.channels?.phone?.greeting;
  if (customGreeting) {
    return customGreeting;
  }

  // Generate based on time
  const hour = new Date().getHours();
  const salut = hour < 12 ? 'bonjour' : (hour < 18 ? 'bonjour' : 'bonsoir');
  const name = tc.assistantName || 'votre assistant';
  const businessName = tc.name || '';

  return `${businessName} ${salut} ! Moi c'est ${name}, comment puis-je vous aider ?`;
}

/**
 * Génère des confirmations courtes
 * @param {string} type - Type de confirmation
 * @param {Object} data - Données contextuelles
 * @returns {string}
 */
export function generateConfirmation(type, data = {}) {
  const confirmations = {
    booking: data.time
      ? `C'est noté ! ${data.day || ''} ${data.time}, parfait.`
      : "C'est noté !",
    understood: "D'accord !",
    noted: "Noté !",
    perfect: "Parfait !",
    thanks: "Merci !",
    goodbye: data.hasBooking ? "À très bientôt !" : "Bonne journée !",
    wait: "Un instant...",
    checking: "Je vérifie...",
    transfer: "Je vous transfère.",
    message_taken: "C'est noté, on vous rappelle.",
  };

  return confirmations[type] || confirmations.understood;
}

/**
 * Génère une réponse vocale pour les erreurs
 * @param {string} errorType
 * @returns {string}
 */
export function generateErrorResponse(errorType) {
  const errors = {
    not_available: "Désolé, ce créneau n'est plus disponible. Je regarde autre chose ?",
    service_not_found: "Je ne connais pas ce service. Vous pouvez me décrire ce que vous cherchez ?",
    date_past: "Cette date est passée. Quel jour vous arrangerait ?",
    closed: "On est fermé ce jour-là. Un autre jour peut-être ?",
    busy: "La ligne est occupée. Je prends un message ?",
    generic: "Pardon, je n'ai pas compris. Pouvez-vous répéter ?",
  };

  return errors[errorType] || errors.generic;
}

// ============================================
// HELPERS
// ============================================

/**
 * Obtient les jours fermés
 * @param {Object} businessHours
 * @returns {string}
 */
function getClosedDays(businessHours) {
  const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const closed = [];

  for (let i = 0; i < 7; i++) {
    const h = businessHours[i] || businessHours[String(i)];
    if (!h || h === null) {
      closed.push(JOURS[i]);
    }
  }

  return closed.length > 0 ? closed.join(', ') : 'Aucun';
}

/**
 * Optimise un texte pour la voix (raccourcit)
 * @param {string} text
 * @returns {string}
 */
export function optimizeForVoice(text) {
  let optimized = text;

  // Apply concise replacements
  for (const [long, short] of Object.entries(CONCISE_PHRASES)) {
    optimized = optimized.replace(new RegExp(long, 'gi'), short);
  }

  // Clean up
  optimized = optimized.replace(/\s+/g, ' ').trim();
  optimized = optimized.replace(/\s+([,.\?!])/g, '$1');

  return optimized;
}

/**
 * Vérifie si une réponse respecte les limites vocales
 * @param {string} text
 * @param {string} type - 'simple', 'medium', 'complex'
 * @returns {boolean}
 */
export function isWithinVoiceLimit(text, type = 'medium') {
  const limit = VOICE_LIMITS[type] || VOICE_LIMITS.medium;
  return text.length <= limit;
}

// ============================================
// EXPORTS
// ============================================

export default {
  generateVoicePrompt,
  generateVoiceGreeting,
  generateConfirmation,
  generateErrorResponse,
  optimizeForVoice,
  isWithinVoiceLimit,
  getClosedDays,
  VOICE_LIMITS,
  CONCISE_PHRASES,
};
