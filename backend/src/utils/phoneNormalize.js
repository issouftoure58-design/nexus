/**
 * Normalisation des numéros de téléphone français
 * Utilisé pour la détection admin WhatsApp
 */

/**
 * Extrait les 9 derniers chiffres d'un numéro français
 * Gère +33, 0033, 0, espaces, tirets, points, préfixe whatsapp:
 * @param {string} phone - Numéro brut
 * @returns {string|null} 9 derniers chiffres ou null si invalide
 */
export function extractFrenchSuffix(phone) {
  if (!phone || typeof phone !== 'string') return null;

  // Retirer préfixe whatsapp: et nettoyer
  const cleaned = phone
    .replace(/^whatsapp:/i, '')
    .replace(/[\s\-\.\(\)]/g, '')
    .trim();

  if (!cleaned) return null;

  // Extraire uniquement les chiffres
  const digits = cleaned.replace(/\D/g, '');

  if (digits.length < 9) return null;

  // Derniers 9 chiffres (couvre +33XXXXXXXXX, 0XXXXXXXXX, 33XXXXXXXXX)
  return digits.slice(-9);
}

/**
 * Compare deux numéros de téléphone par leurs 9 derniers chiffres
 * @param {string} phone1
 * @param {string} phone2
 * @returns {boolean}
 */
export function phonesMatch(phone1, phone2) {
  const suffix1 = extractFrenchSuffix(phone1);
  const suffix2 = extractFrenchSuffix(phone2);

  if (!suffix1 || !suffix2) return false;

  return suffix1 === suffix2;
}
