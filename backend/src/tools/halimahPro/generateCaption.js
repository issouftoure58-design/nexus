import Anthropic from '@anthropic-ai/sdk';
import { MODEL_FAST } from '../../services/modelRouter.js';
import { getBusinessInfoSync } from '../../services/tenantBusinessService.js';

// Initialisation paresseuse du client Anthropic
let anthropicClient = null;

function getAnthropicClient() {
  if (!anthropicClient && process.env.ANTHROPIC_API_KEY) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }
  return anthropicClient;
}

/**
 * Génère une légende optimisée pour les réseaux sociaux
 * @param {string} type - Type de post (avant-apres, promo, citation, star-semaine, temoignage)
 * @param {string} platform - Plateforme cible (instagram, facebook, tiktok, linkedin)
 * @param {object} data - Données spécifiques au post
 */
export async function generateCaption({ type, platform, data = {}, tenantId = null }) {
  const anthropic = getAnthropicClient();

  if (!anthropic) {
    return {
      success: false,
      error: 'Anthropic API key non configurée.'
    };
  }

  const platformSpecs = {
    instagram: { maxLength: 2200, hashtags: 20, style: 'émojis, engageant, questions' },
    facebook: { maxLength: 500, hashtags: 5, style: 'conversationnel, informatif' },
    tiktok: { maxLength: 300, hashtags: 5, style: 'court, punchy, tendance, Gen-Z' },
    linkedin: { maxLength: 700, hashtags: 5, style: 'professionnel, storytelling' }
  };

  const templates = {
    'avant-apres': `
      Créer une légende pour un post avant/après coiffure.
      Service réalisé : ${data.service || 'Coiffure'}
      Durée : ${data.duree || 'Non spécifié'}
      Détails : ${data.details || ''}

      Inclure : transformation, fierté du résultat, CTA pour réserver
    `,
    'promo': `
      Créer une légende pour une promotion.
      Service : ${data.service || 'Service'}
      Prix normal : ${data.prixNormal || 'XX'}€
      Prix promo : ${data.prixPromo || 'XX'}€
      Réduction : ${data.reduction || 'XX'}%
      Validité : ${data.validite || 'Limitée'}

      Inclure : urgence, valeur, CTA clair
    `,
    'citation': `
      Créer une légende inspirante sur la beauté afro.
      Thème : ${data.theme || 'Beauté naturelle'}

      Inclure : empowerment, fierté, authenticité
    `,
    'star-semaine': `
      Créer une légende pour mettre en avant le service star de la semaine.
      Service : ${data.service || 'Service'}
      Prix : ${data.prix || 'XX'}€
      Pourquoi c'est le star : ${data.raison || 'Très demandé'}

      Inclure : exclusivité, popularité, CTA
    `,
    'temoignage': `
      Créer une légende pour partager un témoignage client.
      Prénom client : ${data.prenom || 'Une cliente'}
      Service : ${data.service || 'Coiffure'}
      Avis : ${data.avis || 'Très satisfaite'}

      Inclure : authenticité, confiance, social proof
    `
  };

  const spec = platformSpecs[platform] || platformSpecs.instagram;

  // Charger les infos du tenant dynamiquement
  let tenantInfo = { nom: 'Notre établissement', gerant: '', telephone: '', businessType: 'service' };
  try {
    if (tenantId) {
      const info = getBusinessInfoSync(tenantId);
      tenantInfo = { nom: info.nom || tenantInfo.nom, gerant: info.gerant || '', telephone: info.telephone || '', businessType: info.businessType || 'service' };
    }
  } catch (e) { /* fallback */ }

  const prompt = `
Tu es le community manager de ${tenantInfo.nom}.
Ton ton est : chaleureux, professionnel, accessible.

Génère une légende pour ${platform} :
- Maximum ${spec.maxLength} caractères
- Style : ${spec.style}
- Maximum ${spec.hashtags} hashtags pertinents

${templates[type] || templates['avant-apres']}

IMPORTANT :
- CTA vers la réservation ou lien en bio
- Hashtags en français ET anglais pour plus de reach
- Émojis adaptés (pas trop, pas trop peu)
${tenantInfo.telephone ? `- Le numéro de contact est ${tenantInfo.telephone}` : ''}

Format de réponse EXACT (respecte ce format) :
LEGENDE:
[La légende ici sans les hashtags]

HASHTAGS:
[Les hashtags ici, séparés par des espaces]
`;

  try {
    console.log('[GENERATE CAPTION] Génération pour', platform, '-', type);

    const response = await anthropic.messages.create({
      model: MODEL_FAST,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text;

    // Parser la réponse
    const legendeMatch = text.match(/LEGENDE:\s*([\s\S]*?)(?=HASHTAGS:|$)/i);
    const hashtagsMatch = text.match(/HASHTAGS:\s*([\s\S]*?)$/i);

    const legende = legendeMatch ? legendeMatch[1].trim() : text;
    const hashtags = hashtagsMatch ? hashtagsMatch[1].trim() : '';

    console.log('[GENERATE CAPTION] ✅ Légende générée:', legende.substring(0, 50) + '...');

    return {
      success: true,
      legende,
      hashtags,
      fullCaption: `${legende}\n\n${hashtags}`,
      platform,
      type,
      charCount: legende.length
    };

  } catch (error) {
    console.error('[GENERATE CAPTION] ❌ Erreur:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

export default generateCaption;
