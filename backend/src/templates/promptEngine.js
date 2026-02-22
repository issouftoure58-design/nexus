/**
 * Dynamic Prompt Engine
 *
 * Génère des system prompts dynamiques basés sur:
 * - Template métier (salon, restaurant, hotel)
 * - Rôle agent (reservation, standard, receptionniste)
 * - Config tenant (nom, adresse, horaires, services)
 *
 * @module promptEngine
 */

import { getEffectiveConfig, getFullAgentConfig, isFrozenTenant } from './templateLoader.js';

// ============================================
// DATE FORMATTING
// ============================================

const JOURS_SEMAINE = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/**
 * Formate une date en français
 * @param {Date} date
 * @returns {string}
 */
function formatDateFr(date) {
  const jour = JOURS_SEMAINE[date.getDay()];
  const numero = date.getDate();
  const mois = MOIS[date.getMonth()];
  const annee = date.getFullYear();
  return `${jour} ${numero} ${mois} ${annee}`;
}

/**
 * Formate une durée en texte lisible
 * @param {number} minutes
 * @returns {string}
 */
function formatDuration(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

// ============================================
// TEXT BUILDERS
// ============================================

/**
 * Construit le texte des horaires
 * @param {Object} businessHours - Horaires par jour (0-6)
 * @returns {string}
 */
function buildHoursText(businessHours) {
  if (!businessHours || Object.keys(businessHours).length === 0) {
    return 'Horaires non configurés. Utilise l\'outil get_business_hours si disponible.';
  }

  return JOURS_SEMAINE.map((jour, i) => {
    const h = businessHours[i] || businessHours[String(i)];
    if (!h || h === null) return `• ${jour} : Fermé`;
    return `• ${jour} : ${h.open} - ${h.close}`;
  }).join('\n');
}

/**
 * Construit le texte des services groupés par catégorie
 * @param {Array|Object} services - Liste ou objet de services
 * @param {Object} categoryLabels - Labels des catégories
 * @returns {string}
 */
function buildServicesText(services, categoryLabels = {}) {
  if (!services) {
    return 'Utilise l\'outil get_services pour obtenir la liste des services et tarifs.';
  }

  // Convertir objet en array si nécessaire
  const serviceArray = Array.isArray(services)
    ? services
    : Object.values(services);

  if (serviceArray.length === 0) {
    return 'Aucun service configuré.';
  }

  // Grouper par catégorie
  const grouped = {};
  for (const svc of serviceArray) {
    const cat = svc.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(svc);
  }

  let text = '';
  for (const [cat, svcs] of Object.entries(grouped)) {
    const label = categoryLabels[cat] || cat.toUpperCase();
    text += `\n${label} :\n`;
    for (const svc of svcs) {
      const name = svc.name || svc.nom;
      const price = svc.price || svc.prix;
      const priceText = svc.priceIsMinimum || svc.price_is_minimum
        ? `à partir de ${price}€`
        : `${price}€`;
      const duration = formatDuration(svc.durationMinutes || svc.duree);
      text += `• ${name} - ${priceText}${duration ? ` (${duration})` : ''}\n`;
    }
  }

  return text.trim();
}

/**
 * Construit le texte de personnalité
 * @param {Object} personality
 * @param {boolean} isVoice - Mode vocal (plus concis)
 * @returns {string}
 */
function buildPersonalityText(personality, isVoice = false) {
  const p = personality || {};

  const tutoiement = p.tutoiement ? 'Tu TUTOIES les clients' : 'Tu VOUVOIES toujours les clients';
  const ton = p.ton || 'chaleureux';
  const emojis = p.emojis === 'aucun' ? 'Pas d\'emojis' :
    p.emojis === 'beaucoup' ? 'Emojis fréquents' : 'Emojis avec modération';

  if (isVoice) {
    return `- ${tutoiement}
- Ton ${ton}, efficace
- Concis(e), va droit au but`;
  }

  return `- ${tutoiement}
- Ton ${ton} et professionnel
- ${emojis}
- ${p.description || 'Serviable et efficace'}`;
}

/**
 * Construit le texte des frais de déplacement
 * @param {Object} travelFees
 * @returns {string}
 */
function buildTravelFeesText(travelFees) {
  if (!travelFees) return '';

  const base = travelFees.base_distance_km || travelFees.baseDistanceKm || 0;
  const fee = travelFees.base_fee || travelFees.baseFee || 0;
  const perKm = travelFees.per_km_beyond || travelFees.perKmBeyond || 0;

  return `=== FRAIS DE DÉPLACEMENT ===
• Gratuit jusqu'à ${base} km
• Au-delà : ${fee}€ + ${perKm}€/km supplémentaire
• Utilise l'outil calculate_travel_fee pour calculer`;
}

/**
 * Construit les règles selon le rôle
 * @param {string} roleId
 * @param {Array} capabilities
 * @param {Object} autonomy
 * @returns {string}
 */
function buildRulesText(roleId, capabilities, autonomy) {
  const rules = [];

  // Règles communes
  rules.push('1. Tu ne dois JAMAIS inventer d\'informations');
  rules.push('2. Si tu ne sais pas, dis-le et propose une alternative');

  // Règles par rôle
  if (roleId === 'reservation') {
    rules.push('3. Pour les DISPONIBILITÉS → Utilise TOUJOURS check_availability ou get_upcoming_days');
    rules.push('4. Pour les PRIX → Utilise get_price ou get_services (pas d\'invention)');
    rules.push('5. Pour CRÉER UN RDV → Utilise create_booking ET vérifie success=true');

    if (!autonomy?.can_cancel_appointments) {
      rules.push('6. ANNULATION → Ne pas annuler toi-même, prends les coordonnées et transmets');
    }
  }

  if (roleId === 'standard') {
    rules.push('3. Si la personne demandée est OCCUPÉE → Propose de prendre un message');
    rules.push('4. TOUJOURS noter : nom, téléphone, objet de l\'appel');
    rules.push('5. Après avoir pris un message → Notifie la personne concernée');
  }

  if (roleId === 'receptionniste') {
    rules.push('3. ACCUEILLE chaleureusement chaque visiteur');
    rules.push('4. ORIENTE vers le bon service ou la bonne personne');
    rules.push('5. Si tu ne peux pas répondre → Propose de contacter un responsable');
  }

  return rules.join('\n');
}

/**
 * Construit le texte des capacités activées
 * @param {Array} capabilities
 * @returns {string}
 */
function buildCapabilitiesText(capabilities) {
  if (!capabilities || capabilities.length === 0) {
    return 'Aucune capacité spéciale configurée.';
  }

  const capLabels = {
    check_availability: 'Vérifier les disponibilités',
    create_booking: 'Créer des réservations',
    cancel_booking: 'Annuler des réservations',
    modify_booking: 'Modifier des réservations',
    get_services: 'Consulter les services',
    get_prices: 'Consulter les prix',
    calculate_travel_fee: 'Calculer les frais de déplacement',
    take_payment: 'Prendre des paiements',
    send_confirmation_sms: 'Envoyer des SMS de confirmation',
    answer_faq: 'Répondre aux questions fréquentes',
    take_message: 'Prendre des messages',
    transfer_call: 'Transférer des appels',
    notify_by_email: 'Notifier par email',
    notify_by_sms: 'Notifier par SMS',
  };

  return capabilities
    .map(cap => `• ${capLabels[cap] || cap}`)
    .join('\n');
}

// ============================================
// MAIN PROMPT GENERATOR
// ============================================

/**
 * Génère le system prompt complet pour un tenant
 *
 * @param {string} channel - Canal ('chat', 'phone', 'whatsapp')
 * @param {Object} tenantConfig - Configuration du tenant
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<string>} - System prompt
 */
export async function generateSystemPrompt(channel, tenantConfig, options = {}) {
  if (!tenantConfig) {
    throw new Error('TENANT_CONFIG_REQUIRED');
  }

  const tenantId = tenantConfig.id || tenantConfig.tenant_id;

  // Pour les tenants frozen, on pourrait retourner le prompt hardcodé original
  // Mais ici on génère dynamiquement avec les mêmes données
  const isVoice = channel === 'phone';

  // Get effective config (merged with template)
  const tc = await getEffectiveConfig(tenantConfig);

  // Get agent config (role, capabilities, autonomy)
  const agentConfig = await getFullAgentConfig(tenantId);

  // Build date info
  const now = new Date();
  const dateFormatee = formatDateFr(now);
  const dateISO = now.toISOString().split('T')[0];

  // Build prompt sections
  const assistantIntro = buildAssistantIntro(tc, agentConfig, isVoice);
  const dateSection = buildDateSection(dateFormatee, dateISO);
  const businessInfo = buildBusinessInfo(tc);
  const hoursSection = buildHoursText(tc.businessHours);
  const servicesSection = buildServicesText(tc.services, tc.categoryLabels);
  const travelSection = tc.serviceOptions?.domicile_enabled ? buildTravelFeesText(tc.travelFees) : '';
  const taxSection = buildTaxInfo(tc);
  const personalitySection = buildPersonalityText(tc.personality, isVoice);
  const rulesSection = buildRulesText(agentConfig.roleId, agentConfig.enabledCapabilities, agentConfig.autonomy);
  const capabilitiesSection = buildCapabilitiesText(agentConfig.enabledCapabilities);

  // Assemble prompt
  let prompt = `${assistantIntro}

${dateSection}

=== INFORMATIONS ${tc.name?.toUpperCase() || 'BUSINESS'} ===
${businessInfo}

=== HORAIRES ===
${hoursSection}

=== TARIFS ET SERVICES ===
${servicesSection}

${travelSection}

${taxSection}

=== TON RÔLE : ${agentConfig.roleName?.toUpperCase() || 'AGENT'} ===
${agentConfig.roleDescription || ''}

=== CE QUE TU PEUX FAIRE ===
${capabilitiesSection}

=== PERSONNALITÉ ===
${personalitySection}

=== RÈGLES ABSOLUES ===
${rulesSection}`;

  // Add custom overrides if any
  if (tc.promptOverrides?.additionalRules) {
    prompt += `\n\n=== RÈGLES SUPPLÉMENTAIRES ===\n${tc.promptOverrides.additionalRules}`;
  }

  if (tc.promptOverrides?.customContext) {
    prompt += `\n\n=== CONTEXTE SPÉCIFIQUE ===\n${tc.promptOverrides.customContext}`;
  }

  // Voice-specific additions
  if (isVoice) {
    prompt += `\n\n=== MODE VOCAL ===
- Sois CONCIS(E). Chaque mot compte.
- Réponses courtes : 50-100 caractères max
- Pas de listes longues, résume
- Expressions naturelles : "Super !", "Parfait !", "C'est noté !"`;
  }

  return prompt.trim();
}

// ============================================
// PROMPT SECTION BUILDERS
// ============================================

function buildAssistantIntro(tc, agentConfig, isVoice) {
  const name = tc.assistantName || 'l\'assistant';
  const businessName = tc.name || 'notre établissement';
  const gender = tc.assistantGender === 'M' ? '' : 'e';

  if (isVoice) {
    return `Tu es ${name}, assistant${gender} vocal${gender} de ${businessName}.`;
  }

  return `Tu es ${name}, l'assistant${gender} virtuel${gender} de ${businessName}, ${tc.concept || 'à votre service'}.`;
}

function buildDateSection(dateFormatee, dateISO) {
  return `=== DATE DU JOUR ===
Nous sommes le ${dateFormatee}.
Date ISO pour les outils : ${dateISO}`;
}

function buildBusinessInfo(tc) {
  const lines = [];

  if (tc.name) lines.push(`• Nom : ${tc.name}`);
  if (tc.gerante) lines.push(`• Gérant(e) : ${tc.gerante}`);
  if (tc.adresse) lines.push(`• Adresse : ${tc.adresse}`);
  if (tc.telephone) lines.push(`• Téléphone : ${tc.telephone}`);
  if (tc.concept) lines.push(`• Concept : ${tc.concept}`);
  if (tc.secteur) lines.push(`• Secteur : ${tc.secteur}`);

  return lines.join('\n');
}

/**
 * Construit le texte sur la fiscalité/TVA
 * @param {Object} tc - Tenant config
 * @returns {string}
 */
function buildTaxInfo(tc) {
  const businessType = tc.business_type || tc.businessType || 'company';
  const taxStatus = tc.tax_status || tc.taxStatus || 'franchise_tva';

  if (taxStatus === 'franchise_tva') {
    return `=== FISCALITÉ ===
• Statut : ${businessType === 'independent' ? 'Auto-entrepreneur / Indépendant' : 'Entreprise'}
• TVA : Non assujetti (franchise en base)
• Prix affichés : Prix NETS (pas de TVA à ajouter)
• Mention légale : "TVA non applicable, art. 293 B du CGI"

IMPORTANT : Quand tu donnes un prix, c'est le prix final. Ne mentionne JAMAIS la TVA.`;
  } else {
    const tvaRate = tc.tva_rate || tc.tvaRate || 20;
    return `=== FISCALITÉ ===
• Statut : Entreprise assujettie à la TVA
• Taux TVA : ${tvaRate}%
• Prix affichés : TTC (TVA incluse)

IMPORTANT : Les prix que tu donnes sont TTC. Si le client demande le prix HT, calcule : prix / 1.${tvaRate}.`;
  }
}

// ============================================
// GREETING GENERATORS
// ============================================

/**
 * Génère le greeting approprié selon l'heure et le canal
 * @param {Object} tenantConfig
 * @param {string} channel
 * @returns {Promise<string>}
 */
export async function generateGreeting(tenantConfig, channel) {
  const tc = await getEffectiveConfig(tenantConfig);
  const hour = new Date().getHours();

  const salut = hour < 12 ? 'Bonjour' : (hour < 18 ? 'Bonjour' : 'Bonsoir');
  const name = tc.assistantName || 'votre assistant';
  const businessName = tc.name || '';

  // Check for custom greeting in channels config
  const agentConfig = await getFullAgentConfig(tc.id);
  const channelConfig = agentConfig.channels?.[channel];

  if (channelConfig?.greeting) {
    return channelConfig.greeting;
  }

  // Generate default greeting
  if (channel === 'phone') {
    return `${businessName} ${salut.toLowerCase()} ! Moi c'est ${name}, comment puis-je vous aider ?`;
  }

  return `${salut} ! Je suis ${name}${businessName ? `, l'assistant de ${businessName}` : ''}. Comment puis-je vous aider ?`;
}

/**
 * Génère le goodbye approprié
 * @param {Object} tenantConfig
 * @param {boolean} hasBooking - Si un RDV a été créé
 * @returns {Promise<string>}
 */
export async function generateGoodbye(tenantConfig, hasBooking = false) {
  const hour = new Date().getHours();

  if (hasBooking) {
    return 'À très bientôt !';
  }

  if (hour >= 18) {
    return 'Bonne soirée !';
  }

  return 'Bonne journée !';
}

// ============================================
// EXPORTS
// ============================================

export default {
  generateSystemPrompt,
  generateGreeting,
  generateGoodbye,
  formatDateFr,
  formatDuration,
  buildHoursText,
  buildServicesText,
  buildPersonalityText,
  buildTravelFeesText,
};
