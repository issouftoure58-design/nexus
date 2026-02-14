/**
 * Génération d'images avec Replicate Flux (13x moins cher que DALL-E)
 *
 * OPTIMISATION COÛTS:
 * - DALL-E 3 HD: $0.080/image
 * - Replicate Flux Schnell: $0.003/image (gratuit pour les premiers)
 * - Replicate Flux Pro: $0.055/image
 *
 * Économie: ~92% sur la génération d'images
 *
 * @module generateImage
 */

import fs from 'fs';
import path from 'path';
import { generateImage as replicateGenerateImage, generateImageHD } from '../../services/replicateService.js';
import EnvironmentManager from '../../services/environmentManager.js';
import { isDevelopment, isFeatureEnabled, getCurrentEnvironment } from '../../config/environments.js';

// Fallback DALL-E si Replicate non configuré
import OpenAI from 'openai';
let openaiClient = null;

function getOpenAIClient() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// Provider par défaut (replicate = 13x moins cher)
const DEFAULT_PROVIDER = process.env.IMAGE_PROVIDER || 'replicate';

/**
 * Génère une image avec routing intelligent
 * - Replicate Flux par défaut (moins cher)
 * - Fallback DALL-E si Replicate non configuré
 *
 * @param {string} prompt - Description de l'image à générer
 * @param {string} style - Style visuel (african, modern, elegant, vibrant)
 * @param {string} format - Format (square, portrait, landscape)
 * @param {string} outputName - Nom du fichier de sortie
 * @param {string} provider - Force le provider ('replicate' ou 'dalle')
 * @param {boolean} hd - Utiliser la version HD (Flux Pro ou DALL-E HD)
 */
export async function generateImage({ prompt, style = 'african', format = 'square', outputName, provider, hd = false }) {
  // En dev, retourner une image placeholder
  if (isDevelopment() || !isFeatureEnabled('imageGeneration')) {
    EnvironmentManager.log('info', 'Image Generation (MOCK)', { prompt: prompt.slice(0, 50) + '...' });

    const placeholderText = encodeURIComponent(prompt.slice(0, 30) + '...');
    const sizeMap = { square: '1024x1024', portrait: '1024x1792', landscape: '1792x1024' };
    const size = sizeMap[format] || sizeMap.square;

    return {
      success: true,
      url: `https://via.placeholder.com/${size.replace('x', '/')}.png?text=${placeholderText}`,
      localPath: `/generated/mock-image-${Date.now()}.png`,
      prompt: prompt,
      format,
      style,
      mock: true,
      provider: 'mock',
      environment: getCurrentEnvironment(),
      message: `[MOCK] Image simulée en environnement ${getCurrentEnvironment()}.`
    };
  }

  // Enrichir le prompt avec le style
  const stylePrompts = {
    african: 'Style africain élégant, couleurs chaudes (or, bordeaux, crème), motifs wax subtils, luxueux mais chaleureux',
    modern: 'Style moderne et épuré, minimaliste, tons neutres avec accents dorés',
    elegant: 'Style haut de gamme, sophistiqué, éclairage doux, finitions premium',
    vibrant: 'Couleurs vives et énergiques, style tendance TikTok/Instagram, dynamique'
  };

  const fullPrompt = `${prompt}. ${stylePrompts[style] || stylePrompts.african}. Image professionnelle, haute qualité.`;

  // Sélection du provider
  const selectedProvider = provider || DEFAULT_PROVIDER;
  const useReplicate = selectedProvider === 'replicate' && process.env.REPLICATE_API_TOKEN;
  const useDallE = selectedProvider === 'dalle' || !useReplicate;

  // ============================================
  // REPLICATE FLUX (défaut - 13x moins cher)
  // ============================================
  if (useReplicate) {
    try {
      console.log('[GENERATE IMAGE] Génération avec Replicate Flux...');
      console.log('[GENERATE IMAGE] Prompt:', fullPrompt.substring(0, 100) + '...');

      // Mapping format vers aspect ratio Flux
      const aspectRatios = {
        square: '1:1',
        portrait: '9:16',
        landscape: '16:9'
      };

      const generateFn = hd ? generateImageHD : replicateGenerateImage;
      const options = hd
        ? { width: format === 'portrait' ? 768 : 1024, height: format === 'portrait' ? 1344 : 1024 }
        : { aspect_ratio: aspectRatios[format] || '1:1', quality: 90 };

      const result = await generateFn(fullPrompt, options);

      if (!result.success) {
        throw new Error(result.error || 'Erreur Replicate');
      }

      // Télécharger et sauvegarder localement
      const fileName = outputName || `image-${Date.now()}`;
      const generatedDir = path.join(process.cwd(), 'client/public/generated');
      const imagePath = path.join(generatedDir, `${fileName}.png`);

      if (!fs.existsSync(generatedDir)) {
        fs.mkdirSync(generatedDir, { recursive: true });
      }

      console.log('[GENERATE IMAGE] Téléchargement de l\'image...');
      const imageResponse = await fetch(result.url);

      if (!imageResponse.ok) {
        throw new Error(`Erreur téléchargement: ${imageResponse.status}`);
      }

      const buffer = await imageResponse.arrayBuffer();
      fs.writeFileSync(imagePath, Buffer.from(buffer));

      console.log('[GENERATE IMAGE] ✅ Image sauvegardée:', imagePath);

      // Calcul économie vs DALL-E
      const dalleCost = hd ? 0.080 : 0.040;
      const replicateCost = hd ? 0.055 : 0.003;
      const savings = ((dalleCost - replicateCost) / dalleCost * 100).toFixed(0);

      return {
        success: true,
        url: result.url,
        localPath: `/generated/${fileName}.png`,
        prompt: fullPrompt,
        format,
        style,
        provider: 'replicate',
        model: result.model,
        costSavings: `${savings}% vs DALL-E`
      };

    } catch (error) {
      console.error('[GENERATE IMAGE] Erreur Replicate:', error.message);

      // Fallback sur DALL-E si disponible
      if (process.env.OPENAI_API_KEY) {
        console.log('[GENERATE IMAGE] Fallback sur DALL-E...');
        return generateImage({ prompt, style, format, outputName, provider: 'dalle', hd });
      }

      return {
        success: false,
        error: error.message,
        provider: 'replicate'
      };
    }
  }

  // ============================================
  // DALL-E (fallback ou forcé)
  // ============================================
  const openai = getOpenAIClient();

  if (!openai) {
    return {
      success: false,
      error: 'Aucun provider d\'image configuré (REPLICATE_API_TOKEN ou OPENAI_API_KEY requis)'
    };
  }

  try {
    console.log('[GENERATE IMAGE] Génération avec DALL-E 3...');

    const sizeMap = {
      square: '1024x1024',
      portrait: '1024x1792',
      landscape: '1792x1024'
    };

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: fullPrompt,
      n: 1,
      size: sizeMap[format] || sizeMap.square,
      quality: hd ? 'hd' : 'standard'
    });

    const imageUrl = response.data[0].url;
    const revisedPrompt = response.data[0].revised_prompt;

    const fileName = outputName || `image-${Date.now()}`;
    const generatedDir = path.join(process.cwd(), 'client/public/generated');
    const imagePath = path.join(generatedDir, `${fileName}.png`);

    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Erreur téléchargement: ${imageResponse.status}`);
    }

    const buffer = await imageResponse.arrayBuffer();
    fs.writeFileSync(imagePath, Buffer.from(buffer));

    console.log('[GENERATE IMAGE] ✅ Image sauvegardée:', imagePath);

    return {
      success: true,
      url: imageUrl,
      localPath: `/generated/${fileName}.png`,
      prompt: fullPrompt,
      revisedPrompt,
      format,
      style,
      provider: 'dalle',
      model: 'dall-e-3'
    };

  } catch (error) {
    console.error('[GENERATE IMAGE] Erreur DALL-E:', error.message);

    let errorMessage = error.message;
    if (error.message.includes('billing')) {
      errorMessage = 'Le compte OpenAI nécessite une mise à jour de facturation.';
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'Trop de demandes. Réessaie dans quelques secondes.';
    } else if (error.message.includes('content_policy')) {
      errorMessage = 'Le contenu demandé ne respecte pas les règles de sécurité.';
    }

    return {
      success: false,
      error: errorMessage,
      provider: 'dalle'
    };
  }
}

/**
 * Statistiques d'utilisation
 */
export function getImageStats() {
  return {
    defaultProvider: DEFAULT_PROVIDER,
    replicateConfigured: !!process.env.REPLICATE_API_TOKEN,
    dalleConfigured: !!process.env.OPENAI_API_KEY,
    costComparison: {
      'dalle-standard': '$0.040/image',
      'dalle-hd': '$0.080/image',
      'flux-schnell': '$0.003/image (gratuit au début)',
      'flux-pro': '$0.055/image',
      'sdxl': '$0.006/image'
    },
    recommendation: 'Utilisez Replicate Flux Schnell pour 92% d\'économies'
  };
}

export default generateImage;
