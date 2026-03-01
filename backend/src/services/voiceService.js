/**
 * Service de synthèse vocale OPTIMISÉ pour économiser les crédits ElevenLabs
 *
 * Stratégies d'économie :
 * 1. CACHE AUDIO : Ne pas re-générer les phrases répétitives (~70% économie)
 * 2. TEXTE CONCIS : Réduire sans perdre le naturel (~30% économie)
 * 3. PRÉ-GÉNÉRATION : Générer les phrases courantes à l'avance (100% économie)
 * 4. CHUNKS INTELLIGENTS : Découper et cacher les segments communs
 *
 * @module voiceService
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import logger from '../config/logger.js';

// ============================================
// CONFIGURATION
// ============================================

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Dossier de cache audio
const CACHE_DIR = path.join(process.cwd(), 'data', 'voice-cache');

// Créer le dossier cache s'il n'existe pas
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  logger.info('Dossier cache créé', { tag: 'VOICE SERVICE', path: CACHE_DIR });
}

// Statistiques d'utilisation
let stats = {
  totalCharacters: 0,
  cachedHits: 0,
  apiCalls: 0,
  charactersSaved: 0,
  sessionStart: new Date().toISOString()
};

// 📊 Logger l'usage ElevenLabs pour tracking des coûts
async function logElevenLabsUsage(tenantId, characters, voiceId, cached = false) {
  if (cached) return; // Ne pas logger les hits de cache (pas de coût)
  if (!tenantId) {
    logger.warn('tenant_id requis pour logging usage', { tag: 'VOICE' });
    return;
  }

  try {
    const { supabase } = await import('../config/supabase.js');
    await supabase.from('twilio_call_logs').insert({
      channel: 'elevenlabs',
      direction: 'outbound',
      call_duration: characters, // On réutilise ce champ pour stocker les caractères
      from_number: voiceId,
      tenant_id: tenantId,
      sms_body: `TTS: ${characters} chars`,
    });
    console.log(`[VOICE] ✅ Usage loggé: ${characters} caractères`);
  } catch (err) {
    logger.warn('Erreur logging usage', { tag: 'VOICE', error: err.message });
  }
}

// Voix par défaut (Ingrid - française naturelle)
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'FFXYdAYPzn8Tw8KiHZqg';

// Paramètres optimisés pour qualité/coût
const VOICE_SETTINGS = {
  stability: 0.7,           // Plus stable pour le téléphone
  similarity_boost: 0.75,
  style: 0.35,              // Pas trop haut pour éviter les artefacts
  use_speaker_boost: true
};

// Modèle : turbo = moins cher et plus rapide, v2 = meilleure qualité
const MODEL_ID = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5';

// ============================================
// PHRASES PRÉ-GÉNÉRÉES (à générer 1 fois)
// V2: Phrases génériques + phrases spécifiques par tenant
// ============================================

// Import pour phrases dynamiques par tenant
import { getBusinessInfoSync } from './tenantBusinessService.js';

/**
 * V2 - Génère les phrases de bienvenue dynamiques pour un tenant
 */
function getTenantPhrases(tenantId = 'fatshairafro') {
  try {
    const info = getBusinessInfoSync(tenantId);
    const assistant = info.assistant_name || 'Nexus';
    const gerant = info.gerant || 'notre équipe';
    return {
      'presentation': `Moi c'est ${assistant}, enchanté${assistant === 'Halimah' ? 'e' : ''} !`,
      'bienvenue': `Bienvenue chez ${info.nom} !`,
      'bienvenue_complet': `${info.nom} bonjour ! Moi c'est ${assistant}...`,
      'lieu_question': info.business_type === 'service_domicile'
        ? `Chez vous ou chez ${gerant} ?`
        : `Chez vous ou au salon ?`,
      'adresse': info.adresse ? `C'est au ${info.adresse}.` : null,
    };
  } catch (e) {
    return null; // Utiliser les phrases par défaut
  }
}

// Phrases génériques (communes à tous les tenants)
const GENERIC_PHRASES = {
  // Salutations
  'bonjour': "Bonjour ! Comment allez-vous ?",
  'bonjour_matin': "Bonjour ! Bien dormi ?",
  'bonjour_aprem': "Bonjour ! Comment se passe votre journée ?",
  'bonsoir': "Bonsoir ! Comment allez-vous ?",

  // Confirmations (ci-dessous)
};

// Phrases spécifiques Fat's Hair Afro (legacy - pour cache existant)
const FATSHAIRAFRO_PHRASES = {
  // Présentations
  'je_suis_halimah': "Moi c'est Halimah, enchantée !",
  'bienvenue': "Bienvenue chez Fat's Hair-Afro !",
  'bienvenue_complet': "Fat's Hair-Afro bonjour ! Moi c'est Halimah...",

  // Confirmations
  'ok': "D'accord !",
  'parfait': "Parfait !",
  'super': "Super !",
  'cest_note': "C'est noté !",
  'tres_bien': "Très bien !",
  'entendu': "Bien entendu !",
  'cest_bon': "C'est bon !",
  'ca_marche': "Ça marche !",

  // Transitions
  'alors': "Alors...",
  'voyons': "Voyons voir...",
  'attendez': "Attendez, je vérifie...",
  'un_instant': "Un petit instant...",
  'je_regarde': "Je regarde ça...",
  'je_verifie': "Je vérifie les disponibilités...",

  // Questions
  'ca_vous_va': "Ça vous va ?",
  'autre_chose': "Vous avez besoin d'autre chose ?",
  'des_questions': "Vous avez des questions ?",
  'on_fait_ca': "On fait comme ça ?",
  'vous_preferez_quand': "Vous préférez quand ?",
  'quel_jour': "Quel jour vous arrangerait ?",
  'quelle_heure': "À quelle heure ?",
  'votre_adresse': "Quelle est votre adresse ?",
  'votre_nom': "C'est à quel nom ?",
  'votre_telephone': "Votre numéro de téléphone ?",

  // Empathie
  'je_comprends': "Je comprends...",
  'pas_de_souci': "Pas de souci !",
  'aucun_probleme': "Aucun problème !",
  'desolee': "Je suis désolée...",
  'ah_mince': "Ah mince...",

  // Au revoir
  'au_revoir': "Au revoir, à bientôt !",
  'a_samedi': "Allez, à samedi !",
  'bonne_journee': "Bonne journée !",
  'bonne_soiree': "Bonne soirée !",
  'prenez_soin': "Prenez soin de vous !",
  'a_tres_vite': "À très vite !",
  'merci_au_revoir': "Merci et à bientôt !",

  // Services courants
  'locks_reprise': "Reprise de locks, cinquante euros.",
  'locks_creation': "Création de locks, deux cents euros.",
  'tresses_braids': "Des braids, soixante euros.",
  'soin_complet': "Un soin complet, cinquante euros.",

  // Lieux (spécifiques Fat's Hair Afro)
  'chez_vous_ou_fatou': "Chez vous ou chez Fatou ?",
  'domicile_ou_salon': "À domicile ou au salon ?",
  'adresse_fatou': "C'est au huit rue des Monts Rouges, à Franconville."
};

// V2 - Combinaison des phrases pour rétrocompatibilité
// Les phrases génériques + Fat's Hair Afro pour le tenant par défaut
const PREGENERATED_PHRASES = {
  ...GENERIC_PHRASES,
  ...FATSHAIRAFRO_PHRASES,
};

/**
 * V2 - Récupère les phrases pré-générées pour un tenant
 * Utilise le cache existant pour fatshairafro, génère dynamiquement pour les autres
 */
function getPregeneratedPhrasesForTenant(tenantId = 'fatshairafro') {
  if (tenantId === 'fatshairafro') {
    return PREGENERATED_PHRASES;
  }
  // Pour les autres tenants, combiner les génériques avec les phrases dynamiques
  const tenantPhrases = getTenantPhrases(tenantId);
  if (!tenantPhrases) {
    return GENERIC_PHRASES;
  }
  return {
    ...GENERIC_PHRASES,
    ...tenantPhrases,
  };
}

// ============================================
// CACHE AUDIO
// ============================================

/**
 * Génère un hash unique pour un texte
 * @param {string} text - Texte à hasher
 * @param {string} voiceId - ID de la voix
 * @returns {string} - Hash MD5
 */
function getTextHash(text, voiceId) {
  const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
  return crypto.createHash('md5').update(`${normalized}_${voiceId}`).digest('hex');
}

/**
 * Vérifie si l'audio est en cache
 * @param {string} text - Texte à vérifier
 * @param {string} voiceId - ID de la voix
 * @returns {Buffer|null} - Buffer audio ou null
 */
function getCachedAudio(text, voiceId = DEFAULT_VOICE_ID) {
  const hash = getTextHash(text, voiceId);
  const cachePath = path.join(CACHE_DIR, `${hash}.mp3`);

  if (fs.existsSync(cachePath)) {
    stats.cachedHits++;
    stats.charactersSaved += text.length;
    console.log(`[VOICE] Cache HIT: "${text.substring(0, 30)}..." (${text.length} chars économisés)`);
    return fs.readFileSync(cachePath);
  }

  return null;
}

/**
 * Sauvegarde l'audio en cache
 * @param {string} text - Texte généré
 * @param {string} voiceId - ID de la voix
 * @param {Buffer} audioBuffer - Buffer audio à cacher
 */
function cacheAudio(text, voiceId, audioBuffer) {
  const hash = getTextHash(text, voiceId);
  const cachePath = path.join(CACHE_DIR, `${hash}.mp3`);
  fs.writeFileSync(cachePath, audioBuffer);
  console.log(`[VOICE] Cached: "${text.substring(0, 30)}..."`);
}

// ============================================
// OPTIMISATION DU TEXTE
// ============================================

/**
 * Formate un numéro de téléphone français pour une meilleure prononciation TTS
 * @param {string} phone - Numéro de téléphone (ex: "0612345678", "06 12 34 56 78", "+33612345678")
 * @returns {string} - Format prononcé (ex: "zéro six, douze, trente-quatre, cinquante-six, soixante-dix-huit")
 */
function formatPhoneForTTS(phone) {
  // Nettoyer et normaliser le numéro
  let cleaned = phone.replace(/[\s.-]/g, '');

  // Gérer +33 → 0
  if (cleaned.startsWith('+33')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('33')) {
    cleaned = '0' + cleaned.slice(2);
  }

  // Doit être 10 chiffres
  if (!/^\d{10}$/.test(cleaned)) {
    return phone; // Retourner l'original si format non reconnu
  }

  // Table de conversion des paires de chiffres en mots français
  const pairToWords = {
    '00': 'zéro zéro', '01': 'zéro un', '02': 'zéro deux', '03': 'zéro trois', '04': 'zéro quatre',
    '05': 'zéro cinq', '06': 'zéro six', '07': 'zéro sept', '08': 'zéro huit', '09': 'zéro neuf',
    '10': 'dix', '11': 'onze', '12': 'douze', '13': 'treize', '14': 'quatorze',
    '15': 'quinze', '16': 'seize', '17': 'dix-sept', '18': 'dix-huit', '19': 'dix-neuf',
    '20': 'vingt', '21': 'vingt-et-un', '22': 'vingt-deux', '23': 'vingt-trois', '24': 'vingt-quatre',
    '25': 'vingt-cinq', '26': 'vingt-six', '27': 'vingt-sept', '28': 'vingt-huit', '29': 'vingt-neuf',
    '30': 'trente', '31': 'trente-et-un', '32': 'trente-deux', '33': 'trente-trois', '34': 'trente-quatre',
    '35': 'trente-cinq', '36': 'trente-six', '37': 'trente-sept', '38': 'trente-huit', '39': 'trente-neuf',
    '40': 'quarante', '41': 'quarante-et-un', '42': 'quarante-deux', '43': 'quarante-trois', '44': 'quarante-quatre',
    '45': 'quarante-cinq', '46': 'quarante-six', '47': 'quarante-sept', '48': 'quarante-huit', '49': 'quarante-neuf',
    '50': 'cinquante', '51': 'cinquante-et-un', '52': 'cinquante-deux', '53': 'cinquante-trois', '54': 'cinquante-quatre',
    '55': 'cinquante-cinq', '56': 'cinquante-six', '57': 'cinquante-sept', '58': 'cinquante-huit', '59': 'cinquante-neuf',
    '60': 'soixante', '61': 'soixante-et-un', '62': 'soixante-deux', '63': 'soixante-trois', '64': 'soixante-quatre',
    '65': 'soixante-cinq', '66': 'soixante-six', '67': 'soixante-sept', '68': 'soixante-huit', '69': 'soixante-neuf',
    '70': 'soixante-dix', '71': 'soixante-et-onze', '72': 'soixante-douze', '73': 'soixante-treize', '74': 'soixante-quatorze',
    '75': 'soixante-quinze', '76': 'soixante-seize', '77': 'soixante-dix-sept', '78': 'soixante-dix-huit', '79': 'soixante-dix-neuf',
    '80': 'quatre-vingts', '81': 'quatre-vingt-un', '82': 'quatre-vingt-deux', '83': 'quatre-vingt-trois', '84': 'quatre-vingt-quatre',
    '85': 'quatre-vingt-cinq', '86': 'quatre-vingt-six', '87': 'quatre-vingt-sept', '88': 'quatre-vingt-huit', '89': 'quatre-vingt-neuf',
    '90': 'quatre-vingt-dix', '91': 'quatre-vingt-onze', '92': 'quatre-vingt-douze', '93': 'quatre-vingt-treize', '94': 'quatre-vingt-quatorze',
    '95': 'quatre-vingt-quinze', '96': 'quatre-vingt-seize', '97': 'quatre-vingt-dix-sept', '98': 'quatre-vingt-dix-huit', '99': 'quatre-vingt-dix-neuf'
  };

  // Découper en paires et convertir
  const pairs = [];
  for (let i = 0; i < 10; i += 2) {
    const pair = cleaned.slice(i, i + 2);
    pairs.push(pairToWords[pair] || pair);
  }

  // Joindre avec des virgules pour créer des pauses naturelles
  return pairs.join(', ');
}

/**
 * Convertit un nombre en mots français pour meilleure prononciation TTS
 * @param {number|string} num - Le nombre à convertir
 * @returns {string} - Le nombre en mots
 */
function numberToWordsFR(num) {
  const n = parseInt(num, 10);
  if (isNaN(n) || n < 0 || n > 999) return String(num);

  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

  if (n === 0) return 'zéro';
  if (n < 20) return units[n];

  if (n < 100) {
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (t === 7 || t === 9) {
      // 70-79 et 90-99 (soixante-dix, quatre-vingt-dix)
      return tens[t] + (u === 0 ? (t === 8 ? 's' : '-dix') : '-' + units[10 + u]);
    }
    if (u === 0) return tens[t] + (t === 8 ? 's' : '');
    if (u === 1 && t !== 8) return tens[t] + '-et-un';
    return tens[t] + '-' + units[u];
  }

  // 100-999
  const c = Math.floor(n / 100);
  const rest = n % 100;
  let result = c === 1 ? 'cent' : units[c] + ' cent';
  if (rest === 0 && c > 1) result += 's';
  else if (rest > 0) result += ' ' + numberToWordsFR(rest);
  return result;
}

/**
 * Optimise le texte pour réduire les caractères sans perdre le naturel
 * @param {string} text - Texte à optimiser
 * @returns {string} - Texte optimisé
 */
function optimizeText(text) {
  let optimized = text;

  // 1. Supprimer les espaces multiples
  optimized = optimized.replace(/\s+/g, ' ').trim();

  // 2. Supprimer les emojis (ne se prononcent pas)
  optimized = optimized.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

  // 3. Raccourcir les formulations verbeuses
  const shortenings = {
    "je vous confirme que": "c'est confirmé,",
    "je vous informe que": "",
    "je souhaiterais": "je voudrais",
    "est-ce que vous": "vous",
    "est-ce que": "",
    "n'hésitez pas à": "",
    "je me permets de": "",
    "je vous remercie pour": "merci pour",
    "je vous remercie de": "merci de",
    "dans le cadre de": "pour",
    "au niveau de": "pour",
    "en ce qui concerne": "pour",
    "il est possible de": "on peut",
    "afin de": "pour",
    "permettre de": "",
    "actuellement": "",
    "également": "aussi",
    "néanmoins": "mais",
    "toutefois": "mais",
    "cependant": "mais",
    "par conséquent": "donc",
    "je reste à votre disposition": "",
    "n'hésitez pas": "",
    "il est important de noter que": "",
    "je tiens à vous informer que": "",
    "je vous prie de": ""
  };

  for (const [long, short] of Object.entries(shortenings)) {
    optimized = optimized.replace(new RegExp(long, 'gi'), short);
  }

  // 4. Convertir les numéros de téléphone français pour meilleure prononciation
  // Format: 06 12 34 56 78, 0612345678, +33 6 12 34 56 78
  optimized = optimized.replace(/(?:\+33\s?|0)([1-9])(?:[\s.-]?\d{2}){4}/g, (match) => {
    return formatPhoneForTTS(match);
  });

  // 5. Convertir les prix pour une meilleure prononciation
  // Ex: "80€" → "quatre-vingts euros", "150€" → "cent cinquante euros"
  optimized = optimized.replace(/(\d+)\s*€/g, (_, num) => {
    const n = parseInt(num, 10);
    if (n <= 200) {
      return numberToWordsFR(n) + ' euro' + (n > 1 ? 's' : '');
    }
    return num + ' euros';
  });
  optimized = optimized.replace(/(\d+)\s*EUR/gi, (_, num) => {
    const n = parseInt(num, 10);
    if (n <= 200) {
      return numberToWordsFR(n) + ' euro' + (n > 1 ? 's' : '');
    }
    return num + ' euros';
  });

  // 6. Convertir les heures
  // D'abord les heures rondes (9h00, 17H00 → "9 heures", "17 heures")
  optimized = optimized.replace(/(\d{1,2})\s*[hH]00(?!\s*heure)/g, '$1 heures');
  // Puis les heures avec minutes (9h30 → "9 heures 30")
  optimized = optimized.replace(/(\d{1,2})\s*[hH](\d{2})(?!\s*heure)/g, '$1 heures $2');
  // Puis les heures sans minutes (9h → "9 heures") — (?![a-zà-ü\d]) évite de matcher le h de "heures"
  optimized = optimized.replace(/(\d{1,2})\s*[hH](?![a-z\u00e0-\u00fc\d])/gi, '$1 heures');

  // 7. Ajouter des micro-pauses avec des virgules pour un rythme plus naturel
  // Après "Bonjour" ou "Bonsoir" au début
  optimized = optimized.replace(/^(Bonjour|Bonsoir)([^,!])/i, '$1,$2');

  // 8. Nettoyer les espaces créés
  optimized = optimized.replace(/\s+/g, ' ').trim();
  optimized = optimized.replace(/\s+([,.\?!])/g, '$1');
  optimized = optimized.replace(/,\s*,/g, ',');

  // 9. Supprimer le markdown
  optimized = optimized.replace(/\*\*(.*?)\*\*/g, '$1');
  optimized = optimized.replace(/\*(.*?)\*/g, '$1');
  optimized = optimized.replace(/`(.*?)`/g, '$1');
  optimized = optimized.replace(/#{1,6}\s/g, '');
  optimized = optimized.replace(/[-*+]\s/g, '');

  return optimized;
}

/**
 * Détecte si une phrase pré-générée peut être utilisée
 * @param {string} text - Texte à analyser
 * @returns {string|null} - Clé de la phrase pré-générée ou null
 */
function findPregeneratedMatch(text) {
  const normalized = text.toLowerCase().trim();

  // Correspondance exacte
  for (const [key, phrase] of Object.entries(PREGENERATED_PHRASES)) {
    if (normalized === phrase.toLowerCase()) {
      return key;
    }
  }

  // Détection par patterns
  if (/^bonjour\s*[!.]?\s*$/i.test(normalized)) return 'bonjour';
  if (/^bonsoir\s*[!.]?\s*$/i.test(normalized)) return 'bonsoir';
  if (/^d'accord\s*[!.]?\s*$/i.test(normalized) || /^ok\s*[!.]?\s*$/i.test(normalized)) return 'ok';
  if (/^parfait\s*[!.]?\s*$/i.test(normalized)) return 'parfait';
  if (/^super\s*[!.]?\s*$/i.test(normalized)) return 'super';
  if (/^c'est not[eé]\s*[!.]?\s*$/i.test(normalized)) return 'cest_note';
  if (/^tr[eè]s bien\s*[!.]?\s*$/i.test(normalized)) return 'tres_bien';
  if (/au revoir|[aà] bient[oô]t/i.test(normalized)) return 'au_revoir';
  if (/[çc]a vous va\s*\??\s*$/i.test(normalized)) return 'ca_vous_va';
  if (/je comprends/i.test(normalized)) return 'je_comprends';
  if (/pas de souci/i.test(normalized)) return 'pas_de_souci';
  if (/un instant|un moment/i.test(normalized)) return 'un_instant';
  if (/je v[eé]rifie/i.test(normalized)) return 'je_verifie';
  if (/bonne journ[eé]e/i.test(normalized)) return 'bonne_journee';
  if (/bonne soir[eé]e/i.test(normalized)) return 'bonne_soiree';

  return null;
}

// ============================================
// APPEL API ELEVENLABS
// ============================================

/**
 * Appelle l'API ElevenLabs (seulement si pas en cache)
 * @param {string} text - Texte à synthétiser
 * @param {string} voiceId - ID de la voix
 * @param {string} tenantId - ID du tenant pour le logging (optionnel)
 * @returns {Promise<Buffer>} - Buffer audio
 */
async function callElevenLabsAPI(text, voiceId = DEFAULT_VOICE_ID, tenantId = null) {
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY non configurée');
  }

  stats.apiCalls++;
  stats.totalCharacters += text.length;

  console.log(`[VOICE] API Call: "${text.substring(0, 40)}..." (${text.length} chars)`);

  const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text: text,
      model_id: MODEL_ID,
      voice_settings: VOICE_SETTINGS,
      speed: 0.9
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs error ${response.status}: ${error}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());

  // 📊 Logger l'usage pour tracking des coûts
  if (tenantId) {
    await logElevenLabsUsage(tenantId, text.length, voiceId);
  }

  return audioBuffer;
}

// ============================================
// FONCTIONS PRINCIPALES
// ============================================

/**
 * Convertit du texte en audio avec optimisation maximale
 * @param {string} text - Texte à convertir
 * @param {Object} options - Options (incluant tenantId pour le logging)
 * @returns {Promise<Object>} - Résultat avec audio et stats
 */
async function textToSpeech(text, options = {}) {
  const {
    voiceId = DEFAULT_VOICE_ID,
    useCache = true,
    optimize = true,
    tenantId = null
  } = options;

  // 1. Optimiser le texte si demandé
  let processedText = optimize ? optimizeText(text) : text;

  // Log l'économie
  if (optimize && processedText.length < text.length) {
    const saved = text.length - processedText.length;
    console.log(`[VOICE] Optimisé: ${text.length} → ${processedText.length} chars (-${saved})`);
  }

  // 2. Vérifier le cache
  if (useCache) {
    const cached = getCachedAudio(processedText, voiceId);
    if (cached) {
      return {
        success: true,
        audio: cached,
        fromCache: true,
        characters: 0  // Pas de caractères consommés
      };
    }
  }

  // 3. Appeler l'API
  try {
    const audio = await callElevenLabsAPI(processedText, voiceId, tenantId);

    // 4. Mettre en cache
    if (useCache) {
      cacheAudio(processedText, voiceId, audio);
    }

    return {
      success: true,
      audio,
      fromCache: false,
      characters: processedText.length
    };

  } catch (error) {
    console.error('[VOICE] Erreur TTS:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Génère l'audio pour une réponse complète (découpe en segments)
 * @param {string} text - Texte complet
 * @param {Object} options - Options (incluant tenantId pour le logging)
 * @returns {Promise<Object>} - Résultat avec audio et stats
 */
async function textToSpeechSmart(text, options = {}) {
  const { voiceId = DEFAULT_VOICE_ID, tenantId = null } = options;

  // Découper en segments (par phrase)
  const segments = text
    .split(/(?<=[.!?])\s+/)
    .filter(s => s.trim().length > 0);

  const audioBuffers = [];
  let totalChars = 0;
  let cachedChars = 0;

  for (const segment of segments) {
    // Vérifier si c'est une phrase pré-générée
    const pregenKey = findPregeneratedMatch(segment);
    const textToGenerate = pregenKey
      ? PREGENERATED_PHRASES[pregenKey]
      : segment;

    const result = await textToSpeech(textToGenerate, { voiceId, tenantId });

    if (result.success) {
      audioBuffers.push(result.audio);
      if (result.fromCache) {
        cachedChars += textToGenerate.length;
      } else {
        totalChars += result.characters;
      }
    }
  }

  // Concaténer les audios
  const finalAudio = Buffer.concat(audioBuffers);

  return {
    success: true,
    audio: finalAudio,
    stats: {
      segments: segments.length,
      charactersUsed: totalChars,
      charactersCached: cachedChars,
      percentSaved: cachedChars > 0
        ? Math.round((cachedChars / (totalChars + cachedChars)) * 100)
        : 0
    }
  };
}

/**
 * Synthèse vocale en streaming pour réponses temps réel
 * @param {string} text - Texte à convertir
 * @param {Object} options - Options (incluant tenantId pour le logging)
 * @returns {Promise<ReadableStream>} - Stream audio
 */
async function textToSpeechStream(text, options = {}) {
  if (!ELEVENLABS_API_KEY) {
    logger.warn('ElevenLabs API key non configurée', { tag: 'VOICE' });
    return null;
  }

  const processedText = optimizeText(text);
  const voiceId = options.voiceId || DEFAULT_VOICE_ID;
  const tenantId = options.tenantId || null;

  console.log(`[VOICE] Stream: "${processedText.substring(0, 50)}..."`);

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY
      },
      body: JSON.stringify({
        text: processedText,
        model_id: MODEL_ID,
        voice_settings: VOICE_SETTINGS,
        speed: 0.9,
        optimize_streaming_latency: 3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs streaming error ${response.status}: ${errorText}`);
    }

    stats.apiCalls++;
    stats.totalCharacters += processedText.length;

    // 📊 Logger l'usage pour tracking des coûts
    if (tenantId) {
      await logElevenLabsUsage(tenantId, processedText.length, voiceId);
    }

    return response.body;

  } catch (error) {
    console.error('[VOICE] Erreur stream:', error.message);
    throw error;
  }
}

// ============================================
// PRÉ-GÉNÉRATION DES PHRASES COURANTES
// ============================================

/**
 * Pré-génère toutes les phrases courantes (à appeler au démarrage ou 1 fois)
 * @param {string} voiceId - ID de la voix
 * @returns {Promise<Object>} - Résultat avec compteurs
 */
async function pregenerateCommonPhrases(voiceId = DEFAULT_VOICE_ID) {
  console.log('[VOICE] Pré-génération des phrases courantes...');

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  const phrases = Object.entries(PREGENERATED_PHRASES);

  for (const [key, phrase] of phrases) {
    // Vérifier si déjà en cache
    const cached = getCachedAudio(phrase, voiceId);
    if (cached) {
      skipped++;
      continue;
    }

    // Générer et cacher
    try {
      const result = await textToSpeech(phrase, { voiceId, useCache: true, optimize: false });
      if (result.success) {
        generated++;
        console.log(`[VOICE] Généré: ${key}`);
      } else {
        errors++;
      }
    } catch (error) {
      console.error(`[VOICE] Erreur pour ${key}:`, error.message);
      errors++;
    }

    // Pause pour éviter le rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[VOICE] Pré-génération terminée: ${generated} générés, ${skipped} en cache, ${errors} erreurs`);

  return { generated, skipped, errors, total: phrases.length };
}

// ============================================
// GESTION DU CACHE
// ============================================

/**
 * Vide le cache audio
 * @returns {Object} - Nombre de fichiers supprimés
 */
function clearCache() {
  const files = fs.readdirSync(CACHE_DIR);
  files.forEach(file => {
    if (file.endsWith('.mp3')) {
      fs.unlinkSync(path.join(CACHE_DIR, file));
    }
  });
  console.log(`[VOICE] Cache vidé: ${files.length} fichiers supprimés`);
  return { cleared: files.length };
}

/**
 * Statistiques du cache
 * @returns {Object} - Stats du cache et de la session
 */
function getCacheStats() {
  let files = [];
  let totalSize = 0;

  try {
    files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.mp3'));
    files.forEach(file => {
      const stat = fs.statSync(path.join(CACHE_DIR, file));
      totalSize += stat.size;
    });
  } catch (error) {
    console.error('[VOICE] Erreur lecture cache:', error.message);
  }

  return {
    cacheFiles: files.length,
    cacheSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
    ...stats,
    savingsPercent: stats.totalCharacters > 0
      ? Math.round((stats.charactersSaved / (stats.totalCharacters + stats.charactersSaved)) * 100)
      : 0
  };
}

// ============================================
// UTILITAIRES
// ============================================

/**
 * Obtenir le quota ElevenLabs restant
 * @returns {Promise<Object>} - Informations de quota
 */
async function getQuota() {
  if (!ELEVENLABS_API_KEY) {
    return { available: false, reason: 'API key non configurée' };
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/user/subscription`, {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY }
    });

    if (!response.ok) {
      throw new Error(`Quota check failed: ${response.status}`);
    }

    const data = await response.json();
    return {
      available: true,
      used: data.character_count,
      limit: data.character_limit,
      remaining: data.character_limit - data.character_count,
      percentUsed: Math.round((data.character_count / data.character_limit) * 100),
      tier: data.tier
    };
  } catch (error) {
    console.error('[VOICE] Erreur quota:', error.message);
    return { available: false, error: error.message };
  }
}

/**
 * Liste les voix disponibles
 * @returns {Promise<Array>} - Liste des voix
 */
async function listVoices() {
  if (!ELEVENLABS_API_KEY) {
    return [];
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY }
    });

    if (!response.ok) {
      throw new Error(`Voice list failed: ${response.status}`);
    }

    const data = await response.json();
    return data.voices.map(v => ({
      id: v.voice_id,
      name: v.name,
      category: v.category,
      labels: v.labels
    }));
  } catch (error) {
    console.error('[VOICE] Erreur liste voix:', error.message);
    return [];
  }
}

/**
 * Réinitialise les statistiques de session
 * @returns {Object} - Stats réinitialisées
 */
function resetStats() {
  stats = {
    totalCharacters: 0,
    cachedHits: 0,
    apiCalls: 0,
    charactersSaved: 0,
    sessionStart: new Date().toISOString()
  };
  return stats;
}

/**
 * Vérifie si le service est configuré
 * @returns {boolean}
 */
function isConfigured() {
  return !!ELEVENLABS_API_KEY;
}

// ============================================
// EXPORTS
// ============================================

export default {
  textToSpeech,
  textToSpeechSmart,
  textToSpeechStream,
  pregenerateCommonPhrases,
  clearCache,
  getCacheStats,
  getQuota,
  listVoices,
  resetStats,
  isConfigured,
  optimizeText,
  findPregeneratedMatch,
  getTextHash,
  PREGENERATED_PHRASES,
  VOICE_SETTINGS,
  DEFAULT_VOICE_ID,
  CACHE_DIR
};

export {
  textToSpeech,
  textToSpeechSmart,
  textToSpeechStream,
  pregenerateCommonPhrases,
  clearCache,
  getCacheStats,
  getQuota,
  listVoices,
  resetStats,
  isConfigured,
  optimizeText,
  findPregeneratedMatch,
  getTextHash,
  PREGENERATED_PHRASES,
  VOICE_SETTINGS,
  DEFAULT_VOICE_ID,
  CACHE_DIR
};
