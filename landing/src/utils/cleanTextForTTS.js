/**
 * Nettoie le texte pour une lecture TTS naturelle
 * - Supprime emojis, markdown, caractères spéciaux
 * - Convertit les prix et pourcentages en format parlé
 * - Améliore la ponctuation pour des pauses naturelles
 */
export default function cleanTextForTTS(text) {
  if (!text) return ''

  let cleaned = text
    // Supprimer tous les emojis
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/[\u{231A}-\u{231B}]/gu, '')
    .replace(/[\u{23E9}-\u{23F3}]/gu, '')
    .replace(/[\u{23F8}-\u{23FA}]/gu, '')
    .replace(/[\u{25AA}-\u{25AB}]/gu, '')
    .replace(/[\u{25B6}]/gu, '')
    .replace(/[\u{25C0}]/gu, '')
    .replace(/[\u{25FB}-\u{25FE}]/gu, '')
    .replace(/[\u{2614}-\u{2615}]/gu, '')
    .replace(/[\u{2648}-\u{2653}]/gu, '')
    .replace(/[\u{267F}]/gu, '')
    .replace(/[\u{2693}]/gu, '')
    .replace(/[\u{26A1}]/gu, '')
    .replace(/[\u{26AA}-\u{26AB}]/gu, '')
    .replace(/[\u{26BD}-\u{26BE}]/gu, '')
    .replace(/[\u{26C4}-\u{26C5}]/gu, '')
    .replace(/[\u{26CE}]/gu, '')
    .replace(/[\u{26D4}]/gu, '')
    .replace(/[\u{26EA}]/gu, '')
    .replace(/[\u{26F2}-\u{26F3}]/gu, '')
    .replace(/[\u{26F5}]/gu, '')
    .replace(/[\u{26FA}]/gu, '')
    .replace(/[\u{26FD}]/gu, '')
    .replace(/[\u{2702}]/gu, '')
    .replace(/[\u{2705}]/gu, '')
    .replace(/[\u{2708}-\u{270D}]/gu, '')
    .replace(/[\u{270F}]/gu, '')
    .replace(/[\u{2712}]/gu, '')
    .replace(/[\u{2714}]/gu, '')
    .replace(/[\u{2716}]/gu, '')
    .replace(/[\u{271D}]/gu, '')
    .replace(/[\u{2721}]/gu, '')
    .replace(/[\u{2728}]/gu, '')
    .replace(/[\u{2733}-\u{2734}]/gu, '')
    .replace(/[\u{2744}]/gu, '')
    .replace(/[\u{2747}]/gu, '')
    .replace(/[\u{274C}]/gu, '')
    .replace(/[\u{274E}]/gu, '')
    .replace(/[\u{2753}-\u{2755}]/gu, '')
    .replace(/[\u{2757}]/gu, '')
    .replace(/[\u{2763}-\u{2764}]/gu, '')
    .replace(/[\u{2795}-\u{2797}]/gu, '')
    .replace(/[\u{27A1}]/gu, '')
    .replace(/[\u{27B0}]/gu, '')
    .replace(/[\u{27BF}]/gu, '')
    .replace(/[\u{2934}-\u{2935}]/gu, '')
    .replace(/[\u{2B05}-\u{2B07}]/gu, '')
    .replace(/[\u{2B1B}-\u{2B1C}]/gu, '')
    .replace(/[\u{2B50}]/gu, '')
    .replace(/[\u{2B55}]/gu, '')
    .replace(/[\u{3030}]/gu, '')
    .replace(/[\u{303D}]/gu, '')
    .replace(/[\u{3297}]/gu, '')
    .replace(/[\u{3299}]/gu, '')

    // Supprimer le markdown
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__/g, '')
    .replace(/_/g, ' ')
    .replace(/`/g, '')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

    // Convertir les prix en format parlé
    .replace(/(\d+)€\/mois/g, '$1 euros par mois')
    .replace(/(\d+)€/g, '$1 euros')
    .replace(/(\d+)\$/g, '$1 dollars')

    // Convertir les pourcentages
    .replace(/(\d+)%/g, '$1 pour cent')

    // Convertir les fractions de temps
    .replace(/24h\/24/g, 'vingt-quatre heures sur vingt-quatre')
    .replace(/7j\/7/g, 'sept jours sur sept')
    .replace(/24\/7/g, 'vingt-quatre sept')

    // Améliorer les nombres pour une meilleure lecture
    .replace(/(\d+)-(\d+)/g, '$1 à $2')

    // Nettoyer les listes
    .replace(/^[-•]\s*/gm, '')
    .replace(/\n[-•]\s*/g, ', ')
    .replace(/^\d+\.\s*/gm, '')

    // Nettoyer la ponctuation excessive
    .replace(/\.{2,}/g, '.')
    .replace(/!{2,}/g, '!')
    .replace(/\?{2,}/g, '?')
    .replace(/,{2,}/g, ',')
    .replace(/:\s*$/gm, '.')
    .replace(/;\s/g, ', ')

    // Améliorer les pauses
    .replace(/\n+/g, '. ')
    .replace(/\s*\.\s*\.\s*/g, '. ')

    // Nettoyer les espaces
    .replace(/\s+/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/\s+,/g, ',')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')

    // Supprimer les parenthèses vides
    .replace(/\(\s*\)/g, '')

    // Trim final
    .trim()

  if (cleaned && !/[.!?]$/.test(cleaned)) {
    cleaned += '.'
  }

  return cleaned
}
