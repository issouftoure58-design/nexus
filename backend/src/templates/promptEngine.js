/**
 * Dynamic Prompt Engine — Noyau Général + Couche Adaptative
 *
 * Architecture 2 couches :
 * 1. Noyau général — Règles universelles pour TOUS les tenants/business types
 * 2. Couche adaptative — Comportement spécifique par business type (6 types)
 *
 * Génère des system prompts dynamiques basés sur:
 * - Template métier (salon, restaurant, hotel, commerce, security)
 * - Rôle agent (reservation, standard, receptionniste)
 * - Config tenant (nom, adresse, horaires, services)
 * - Reconnaissance client (accueil personnalisé)
 *
 * @module promptEngine
 */

import { getEffectiveConfig, getFullAgentConfig } from './templateLoader.js';
import { getBusinessTypeRules } from './businessTypePrompts/index.js';

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
// NOYAU GÉNÉRAL — Règles universelles
// ============================================

/**
 * Règles #0–#4 applicables à TOUS les tenants
 */
function buildCoreRules() {
  return `╔═══════════════════════════════════════════════════════════╗
║  RÈGLE ABSOLUE #0 - JAMAIS CONFIRMER SANS CRÉER EN BASE  ║
╚═══════════════════════════════════════════════════════════╝
Tu NE PEUX JAMAIS dire "rendez-vous confirmé/créé/enregistré" ou "vous recevrez un SMS" SANS avoir EFFECTIVEMENT appelé create_booking et reçu success=true.
PROCESSUS OBLIGATOIRE :
1. Collecter TOUTES les infos nécessaires
2. APPELER create_booking
3. ATTENDRE le résultat
4. SI success=true → confirmer au client
5. SI success=false → expliquer le problème, proposer alternative
Si tu n'as pas appelé create_booking → tu n'as PAS le droit de dire que c'est confirmé.

=== RÈGLE #1 — ANTI-PLACEHOLDER ===
Tu ne dois JAMAIS appeler create_booking avec des données fictives, manquantes ou placeholder (ex: "-", "inconnu", "test", "N/A").
CHAQUE champ obligatoire doit être une VRAIE information fournie par le client.
Si le client refuse de donner son nom ou téléphone → ne crée PAS le RDV.
Si tu n'as pas TOUTES les infos → DEMANDE-les, ne remplis JAMAIS avec des valeurs par défaut.

=== RÈGLE #2 — COLLECTER AVANT DE CRÉER ===
Tu DOIS avoir collecté TOUTES les informations obligatoires AVANT d'appeler create_booking.
Ne demande JAMAIS une confirmation au client si tu n'as pas encore toutes les infos.

=== RÈGLE #3 — GARDER LE CONTEXTE ===
RESPECTE le contexte de la conversation :
- Si le client a dit un service spécifique → ne propose pas un autre
- Si le client a dit une heure → vérifie CETTE heure
- Ne change PAS les choix du client sans raison

=== RÈGLE #4 — GESTION DES CONFIRMATIONS ===
"oui", "ok", "d'accord", "parfait", "ça marche" = OUI
"non", "pas vraiment", "plutôt" = NON
En cas de doute sur l'intention → demande une clarification`;
}

/**
 * Règles de gestion des dates — universelles
 */
function buildDateRules() {
  return `=== RÈGLES CRITIQUES DATES ===
⚠️ Tu ne dois JAMAIS calculer les dates toi-même.
TOUJOURS utiliser l'outil get_upcoming_days AVANT de parler des disponibilités.
Cet outil te donne les dates EXACTES (ex: "Lundi 2 février", "Mardi 3 février").

- Pour TOUTE question sur "demain", "après-demain", "la semaine prochaine", un jour précis → TOUJOURS utiliser get_upcoming_days AVANT de répondre
- Ne dis JAMAIS "demain c'est [jour]" sans avoir appelé get_upcoming_days
- INTERDIT de calculer les dates toi-même, même si ça semble simple
- Utilise parse_date pour convertir les dates relatives ("samedi prochain" → date ISO)
- Chaque jour inclut un champ "occupation" avec le statut (libre, partiel, presque_complet, complet)
- Utilise occupation.resume pour informer précisément le client :
  • statut="complet" → "Ce jour est complet, plus de créneaux disponibles."
  • statut="presque_complet" → informer avec le résumé de l'occupation
  • statut="partiel" → proposer les créneaux libres
  • statut="libre" → "disponible toute la journée"
- Ne propose JAMAIS un créneau sur un jour complet
- Un service PEUT finir pile à l'heure de fermeture (ex: 4h le jeudi 9h-13h commençant à 9h = VALIDE)
- En cas de doute → utilise check_availability au lieu de décider toi-même`;
}

/**
 * Processus de réservation universel (enrichi par la couche adaptative)
 */
function buildBookingProcessRules() {
  return `=== PROCESSUS DE RÉSERVATION (UNIVERSEL) ===
1. Identifier le service/produit demandé
2. Vérifier les disponibilités (get_upcoming_days → check_availability)
3. Collecter les informations client (nom complet, téléphone 10 chiffres)
4. RÉCAPITULER toutes les infos et demander confirmation
5. Créer avec create_booking UNIQUEMENT après confirmation du client
6. Vérifier success=true avant de confirmer

⚠️ Le téléphone DOIT être 10 chiffres commençant par 0 (ex: 0612345678)`;
}

/**
 * Règles d'annulation et modification — universelles
 */
function buildCancellationRules() {
  return `=== GESTION ANNULATION / MODIFICATION ===

PROCESSUS ANNULATION :
1. Client dit "annuler", "je ne peux plus venir", "empêchement"
2. Demande son numéro de téléphone pour retrouver le RDV
3. Appelle find_appointment avec le téléphone
4. Affiche les RDV trouvés
5. Demande confirmation : "Souhaitez-vous annuler ce rendez-vous ?"
6. Si oui → Appelle cancel_appointment avec l'ID
7. Confirme l'annulation

PROCESSUS MODIFICATION :
1. Client dit "déplacer", "changer l'heure", "repousser"
2. Retrouve le RDV (même process que annulation)
3. Demande la nouvelle date/heure souhaitée
4. Vérifie la disponibilité du nouveau créneau
5. Annule l'ancien RDV avec cancel_appointment
6. Crée le nouveau avec create_booking
7. Confirme le changement

RÈGLES :
- TOUJOURS demander le téléphone pour identifier le client
- TOUJOURS confirmer avant d'annuler (jamais annuler sans accord explicite)
- Si plusieurs RDV trouvés → demander lequel
- Être empathique : "Je comprends, pas de problème"`;
}

/**
 * Règles spécifiques par canal de communication
 * @param {string} channel - phone, whatsapp, web/chat, sms
 * @returns {string}
 */
function buildChannelRules(channel) {
  switch (channel) {
    case 'phone':
      return `=== MODE VOCAL (TÉLÉPHONE) ===
- Sois TRÈS concis(e) (max 2-3 phrases par réponse)
- Réponses courtes : 50-100 caractères max
- Ne liste JAMAIS tous les services spontanément
- Attends que le client précise avant de donner les détails
- Une information à la fois, puis attends la réponse
- Pas d'emoji, pas de listes longues
- Expressions naturelles : "Super !", "Parfait !", "C'est noté !"
- Pour les dates, TOUJOURS appeler get_upcoming_days avant de répondre`;

    case 'whatsapp':
      return `=== MODE WHATSAPP ===
- Réponses structurées et claires
- Emojis avec parcimonie (1-2 par message max)
- Tu peux envoyer des liens
- Format lisible (listes courtes OK)`;

    case 'sms':
      return `=== MODE SMS ===
- Ultra concis : 160 caractères max par message
- Pas d'emoji
- Va droit au but`;

    default: // web, chat
      return `=== MODE CHAT WEB ===
- Réponses complètes mais concises
- Emojis avec modération
- Formatage clair (listes OK)`;
  }
}

/**
 * Construit la section de reconnaissance client pour le prompt
 * @param {Object} clientContext - Résultat de recognizeClient()
 * @returns {string} - Section à ajouter au prompt (vide si client inconnu)
 */
function buildClientRecognitionContext(clientContext) {
  if (!clientContext || !clientContext.known) return '';

  const { displayName, lastVisit, visitCount, recentServices } = clientContext;

  let section = `\n=== CLIENT RECONNU ===
Le client est ${displayName}, client(e) existant(e).`;

  if (lastVisit) {
    section += `\nDernier RDV : ${lastVisit}`;
  }
  if (visitCount > 0) {
    section += `\nNombre de visites : ${visitCount}`;
  }
  if (recentServices && recentServices.length > 0) {
    section += `\nServices habituels : ${recentServices.join(', ')}`;
  }

  section += `\nAccueille-le/la chaleureusement en utilisant son prénom.
Tu as déjà son nom et téléphone — ne les redemande PAS sauf pour vérification.`;

  return section;
}

// ============================================
// TEXT BUILDERS (existants)
// ============================================

/**
 * Construit le texte des horaires
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
 */
function buildServicesText(services, categoryLabels = {}) {
  if (!services) {
    return 'Utilise l\'outil get_services pour obtenir la liste des services et tarifs.';
  }

  const serviceArray = Array.isArray(services) ? services : Object.values(services);

  if (serviceArray.length === 0) {
    return 'Aucun service configuré.';
  }

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
 */
function buildRulesText(roleId, capabilities, autonomy) {
  const rules = [];

  rules.push('1. Tu ne dois JAMAIS inventer d\'informations');
  rules.push('2. Si tu ne sais pas, dis-le et propose une alternative');

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
 */
function buildTaxInfo(tc) {
  const structure = tc.structure_juridique || tc.business_type || tc.businessType || 'company';
  const taxStatus = tc.tax_status || tc.taxStatus || 'franchise_tva';

  if (taxStatus === 'franchise_tva') {
    return `=== FISCALITÉ ===
• Statut : ${structure === 'independent' ? 'Auto-entrepreneur / Indépendant' : 'Entreprise'}
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
// MAIN PROMPT GENERATOR
// ============================================

/**
 * Génère le system prompt complet pour un tenant
 *
 * Architecture 2 couches :
 * 1. Noyau général (règles universelles)
 * 2. Couche adaptative (règles business type)
 *
 * @param {string} channel - Canal ('chat', 'phone', 'whatsapp', 'sms')
 * @param {Object} tenantConfig - Configuration du tenant
 * @param {Object} options - Options supplémentaires
 * @returns {Promise<string>} - System prompt
 */
export async function generateSystemPrompt(channel, tenantConfig, options = {}) {
  if (!tenantConfig) {
    throw new Error('TENANT_CONFIG_REQUIRED');
  }

  const tenantId = tenantConfig.id || tenantConfig.tenant_id;
  const isVoice = channel === 'phone';

  // Get effective config (merged with template)
  const tc = await getEffectiveConfig(tenantConfig);

  // Get agent config (role, capabilities, autonomy)
  const agentConfig = await getFullAgentConfig(tenantId);

  // Determine business type
  const businessType = tenantConfig.business_profile || tenantConfig.businessProfile || tc.templateId || 'salon';

  // Get business-type-specific rules (couche adaptative)
  const btRules = getBusinessTypeRules(businessType, tc);

  // Build date info
  const now = new Date();
  const dateFormatee = formatDateFr(now);
  const dateISO = now.toISOString().split('T')[0];

  // Build sections — Informations tenant
  const assistantIntro = buildAssistantIntro(tc, agentConfig, isVoice);
  const dateSection = buildDateSection(dateFormatee, dateISO);
  const businessInfo = buildBusinessInfo(tc);
  const hoursSection = buildHoursText(tc.businessHours);
  const servicesSection = buildServicesText(tc.services, tc.categoryLabels);
  const travelSection = tc.serviceOptions?.domicile_enabled ? buildTravelFeesText(tc.travelFees) : '';
  const taxSection = buildTaxInfo(tc);
  const personalitySection = buildPersonalityText(tc.personality, isVoice);
  const roleRulesSection = buildRulesText(agentConfig.roleId, agentConfig.enabledCapabilities, agentConfig.autonomy);
  const capabilitiesSection = buildCapabilitiesText(agentConfig.enabledCapabilities);

  // Build sections — Noyau général
  const coreRules = buildCoreRules();
  const dateRules = buildDateRules();
  const bookingProcess = buildBookingProcessRules();
  const cancellationRules = buildCancellationRules();
  const channelRules = buildChannelRules(channel);

  // Build section — Reconnaissance client
  const clientSection = buildClientRecognitionContext(tenantConfig.clientContext);

  // ============================================
  // ASSEMBLAGE DU PROMPT
  // ============================================

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
${clientSection}

=== PERSONNALITÉ ===
${personalitySection}

=== TON RÔLE : ${agentConfig.roleName?.toUpperCase() || 'AGENT'} ===
${agentConfig.roleDescription || ''}

=== CE QUE TU PEUX FAIRE ===
${capabilitiesSection}

${coreRules}

${dateRules}

${bookingProcess}

${btRules.bookingProcess}

${btRules.rules}

${cancellationRules}

=== RÈGLES DE RÔLE ===
${roleRulesSection}

${channelRules}`;

  // Business-type special services (if any)
  if (btRules.specialServices) {
    prompt += `\n\n${btRules.specialServices}`;
  }

  // Custom overrides from admin
  if (tc.promptOverrides?.additionalRules) {
    prompt += `\n\n=== RÈGLES SUPPLÉMENTAIRES ===\n${tc.promptOverrides.additionalRules}`;
  }

  if (tc.promptOverrides?.customContext) {
    prompt += `\n\n=== CONTEXTE SPÉCIFIQUE ===\n${tc.promptOverrides.customContext}`;
  }

  // IA Config admin overrides
  if (tc.greetingMessage) {
    prompt += `\n\nMessage d'accueil personnalisé : "${tc.greetingMessage}"`;
  }
  if (tc.servicesDescription) {
    prompt += `\n\n=== DESCRIPTION SUPPLÉMENTAIRE DES SERVICES ===\n${tc.servicesDescription}`;
  }
  if (tc.bookingEnabled === false) {
    prompt += `\n\n⚠️ La prise de RDV est DÉSACTIVÉE. Oriente les clients vers le téléphone.`;
  }

  // Cleanup: remove double blank lines
  prompt = prompt.replace(/\n{3,}/g, '\n\n');

  return prompt.trim();
}

// ============================================
// GREETING GENERATORS
// ============================================

/**
 * Génère le greeting approprié selon l'heure et le canal
 */
export async function generateGreeting(tenantConfig, channel) {
  const tc = await getEffectiveConfig(tenantConfig);
  const hour = new Date().getHours();

  const salut = hour < 12 ? 'Bonjour' : (hour < 18 ? 'Bonjour' : 'Bonsoir');
  const name = tc.assistantName || 'votre assistant';
  const businessName = tc.name || '';

  const agentConfig = await getFullAgentConfig(tc.id);
  const channelConfig = agentConfig.channels?.[channel];

  if (channelConfig?.greeting) {
    return channelConfig.greeting;
  }

  if (channel === 'phone') {
    return `${businessName} ${salut.toLowerCase()} ! Moi c'est ${name}, comment puis-je vous aider ?`;
  }

  return `${salut} ! Je suis ${name}${businessName ? `, l'assistant de ${businessName}` : ''}. Comment puis-je vous aider ?`;
}

/**
 * Génère le goodbye approprié
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
