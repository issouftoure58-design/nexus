/**
 * Filtre anti-injures FR + EN
 * Normalisation leet-speak, accents, espaces entre lettres
 * Lookup O(1) via Set + substring check pour expressions multi-mots
 */

// ~200 mots FR
const PROFANITY_FR = [
  'putain', 'pute', 'merde', 'connard', 'connasse', 'enculer', 'encule',
  'enculé', 'nique', 'niquer', 'ntm', 'nique ta mere', 'fils de pute',
  'fdp', 'salope', 'salaud', 'batard', 'bâtard', 'bordel', 'foutre',
  'baiser', 'couille', 'couilles', 'bite', 'chier', 'chiasse', 'cul',
  'trouduc', 'trou du cul', 'petasse', 'pétasse', 'pouffiasse', 'garce',
  'con', 'conne', 'abruti', 'abrutie', 'debile', 'débile', 'cretin',
  'crétin', 'imbecile', 'imbécile', 'idiot', 'idiote', 'gogol', 'mongol',
  'mongolien', 'attardé', 'attarde', 'taré', 'tare', 'tarée', 'taree',
  'pd', 'pédé', 'pede', 'tapette', 'tantouze', 'gouine', 'enfoiré',
  'enfoire', 'enfoirée', 'enfoiree', 'branleur', 'branleuse', 'branlette',
  'bouffon', 'bouffonne', 'casse toi', 'ta gueule', 'ferme ta gueule',
  'ftg', 'tg', 'va te faire foutre', 'vtff', 'va te faire', 'naze', 'nazes',
  'tocard', 'tocarde', 'abruti fini', 'sous merde', 'raclure', 'ordure',
  'pourriture', 'fumier', 'charogne', 'crevard', 'crevarde', 'clochard',
  'merdeux', 'merdeuse', 'merdique', 'dégueulasse', 'degueulasse',
  'poufiasse', 'grognasse', 'morue', 'trainée', 'trainee', 'catin',
  'putassier', 'putassiere', 'pédale', 'pedale', 'fiotte', 'lopette',
  'baltringue', 'pignouf', 'couillon', 'couillonne', 'andouille',
  'gland', 'glandeur', 'glandeuse', 'flemmard', 'brele', 'boloss',
  'bolosse', 'blaireau', 'beauf', 'plouc', 'péquenaud', 'pequenaud',
  'nigaud', 'nigaude', 'cruche', 'cloche', 'nouille', 'empaffé',
  'empaffe', 'enflure', 'foutriquet', 'feignasse', 'fainéant',
  'faineant', 'crasseux', 'crasseuse', 'dégueu', 'degueu',
  'bougnoule', 'négro', 'negro', 'nègre', 'negre', 'sale arabe',
  'sale noir', 'sale blanc', 'sale juif', 'sale musulman', 'racaille',
  'bamboula', 'bicot', 'youpin', 'feuj', 'melon', 'bougnoul',
  'chinetoque', 'bridé', 'bride', 'sale race', 'sale français',
  'crouille', 'raton', 'boche', 'chleuh', 'rital', 'rosbif',
  'gringo', 'gaouri', 'gwer', 'toubab', 'karcher',
  'niqueur', 'niqueuse', 'petite bite', 'grosse merde', 'sac a merde',
  'tête de noeud', 'tete de noeud', 'face de pet', 'face de cul',
  'mange merde', 'espece de', 'sale con', 'gros con', 'pauvre con',
  'pauvre type', 'pauvre mec', 'minable', 'lamentable', 'pathétique',
  'pathetique', 'dégage', 'degage', 'casse couille',
  'péteux', 'peteux', 'chiant', 'chiante', 'emmerdeur', 'emmerdeuse',
  'enculeur', 'suce', 'sucer', 'suceur', 'suceuse', 'branler',
  'masturber', 'sodomie', 'sodomiser', 'fellation',
  'niquer ta race', 'ntr', 'je te baise', 'je te nique',
  'ta mere', 'ta mère', 'ton père', 'ton pere', 'ta race',
  'wesh la mif', 'sale pute', 'grosse pute',
];

// ~100 mots EN
const PROFANITY_EN = [
  'fuck', 'fucking', 'fucker', 'fucked', 'motherfucker', 'motherfucking',
  'shit', 'shitty', 'bullshit', 'horseshit', 'dipshit', 'shithead',
  'ass', 'asshole', 'arsehole', 'arse', 'dumbass', 'fatass', 'jackass',
  'bitch', 'bitchy', 'son of a bitch', 'sob',
  'damn', 'goddamn', 'dammit',
  'dick', 'dickhead', 'dickface',
  'cock', 'cocksucker', 'cocksucking',
  'cunt', 'twat', 'pussy', 'wanker', 'wank',
  'bastard', 'slut', 'whore', 'hoe', 'skank',
  'retard', 'retarded', 'moron', 'idiot', 'stupid',
  'nigger', 'nigga', 'negro', 'spic', 'chink', 'gook', 'kike',
  'cracker', 'honky', 'wetback', 'beaner', 'raghead', 'towelhead',
  'faggot', 'fag', 'dyke', 'homo', 'queer',
  'piss', 'piss off', 'pissed',
  'crap', 'screw you', 'screw off',
  'stfu', 'gtfo', 'lmfao', 'wtf', 'omfg',
  'douche', 'douchebag', 'jerk', 'jerkoff',
  'trash', 'scum', 'scumbag', 'lowlife',
  'kill yourself', 'kys', 'go die', 'die',
  'suck my', 'blow me', 'eat shit',
  'bloody hell', 'bollocks', 'bugger', 'wanking',
  'tits', 'boobs', 'titties',
  'porn', 'porno', 'pornography',
];

// Combine into a Set for O(1) lookup
const PROFANITY_SET = new Set([...PROFANITY_FR, ...PROFANITY_EN].map(w => w.toLowerCase()));

// Multi-word expressions for substring matching
const MULTI_WORD_EXPRESSIONS = [...PROFANITY_FR, ...PROFANITY_EN]
  .filter(w => w.includes(' '))
  .map(w => w.toLowerCase());

// Leet-speak mapping
const LEET_MAP = {
  '@': 'a', '4': 'a', '^': 'a',
  '3': 'e', '€': 'e',
  '1': 'i', '!': 'i', '|': 'i',
  '0': 'o',
  '$': 's', '5': 's',
  '7': 't', '+': 't',
  'µ': 'u',
  '8': 'b',
  '9': 'g',
};

/**
 * Normalize text: lowercase, strip accents, decode leet-speak, remove isolated spaces
 */
function normalize(text) {
  if (!text) return '';

  let result = text.toLowerCase();

  // Strip accents (NFD decomposition)
  result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Decode leet-speak
  result = result.split('').map(c => LEET_MAP[c] || c).join('');

  // Remove repeated chars (e.g. "fuuuuck" → "fuck") — keep max 2
  result = result.replace(/(.)\1{2,}/g, '$1$1');

  return result;
}

/**
 * Remove spaces between isolated single letters (e.g. "f u c k" → "fuck")
 */
function collapseSpacedLetters(text) {
  // Match sequences of single letter + space + single letter
  return text.replace(/\b(\w)\s+(?=\w\b)/g, '$1');
}

/**
 * Check if text contains profanity
 * @param {string} text
 * @returns {{ hasProfanity: boolean, flaggedWords: string[] }}
 */
export function containsProfanity(text) {
  if (!text || typeof text !== 'string') {
    return { hasProfanity: false, flaggedWords: [] };
  }

  const normalized = normalize(text);
  const collapsed = collapseSpacedLetters(normalized);
  const flaggedWords = [];

  // Split into words and check each against Set
  const words = normalized.split(/[\s,.;:!?'"()\-_/\\]+/).filter(Boolean);
  for (const word of words) {
    if (word.length >= 2 && PROFANITY_SET.has(word)) {
      flaggedWords.push(word);
    }
  }

  // Also check collapsed version (catches "f u c k" → "fuck")
  const collapsedWords = collapsed.split(/[\s,.;:!?'"()\-_/\\]+/).filter(Boolean);
  for (const word of collapsedWords) {
    if (word.length >= 2 && PROFANITY_SET.has(word) && !flaggedWords.includes(word)) {
      flaggedWords.push(word);
    }
  }

  // Check multi-word expressions as substrings
  for (const expr of MULTI_WORD_EXPRESSIONS) {
    if (normalized.includes(expr) && !flaggedWords.includes(expr)) {
      flaggedWords.push(expr);
    }
  }

  return {
    hasProfanity: flaggedWords.length > 0,
    flaggedWords,
  };
}

export default { containsProfanity };
