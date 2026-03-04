/**
 * Contenu Handler — creer_image, creer_legende, creer_post_complet, lister_templates, lister_images_generees
 * Outils de creation de contenu (images, legendes, posts complets).
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';

let generateImageFn = null;
let generateCaptionFn = null;

async function loadGenerateImage() {
  if (generateImageFn) return generateImageFn;

  try {
    const mod = await import('../halimahPro/generateImage.js');
    generateImageFn = mod.generateImage || mod.default;
    return generateImageFn;
  } catch (error) {
    logger.warn('[CONTENU HANDLER] Module generateImage non disponible:', { error: error.message });
    return null;
  }
}

async function loadGenerateCaption() {
  if (generateCaptionFn) return generateCaptionFn;

  try {
    const mod = await import('../halimahPro/generateCaption.js');
    generateCaptionFn = mod.generateCaption || mod.default;
    return generateCaptionFn;
  } catch (error) {
    logger.warn('[CONTENU HANDLER] Module generateCaption non disponible:', { error: error.message });
    return null;
  }
}

async function creer_image(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.prompt) {
      return { success: false, error: 'Parametre "prompt" requis' };
    }

    const genImage = await loadGenerateImage();
    if (!genImage) {
      return { success: false, error: 'Service de generation d\'images non disponible' };
    }

    const result = await genImage({
      prompt: toolInput.prompt,
      style: toolInput.style || 'african',
      format: toolInput.format || 'square'
    });

    return {
      success: true,
      message: 'Image generee',
      image: result
    };
  } catch (error) {
    logger.error('[CONTENU HANDLER] Erreur creer_image:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function creer_legende(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const genCaption = await loadGenerateCaption();
    if (!genCaption) {
      return { success: false, error: 'Service de generation de legendes non disponible' };
    }

    const result = await genCaption({
      type: toolInput.type || 'post',
      platform: toolInput.platform || 'instagram',
      data: toolInput.data || {}
    });

    return {
      success: true,
      message: 'Legende generee',
      legende: result
    };
  } catch (error) {
    logger.error('[CONTENU HANDLER] Erreur creer_legende:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function creer_post_complet(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    if (!toolInput.prompt) {
      return { success: false, error: 'Parametre "prompt" requis pour generer l\'image' };
    }

    const [genImage, genCaption] = await Promise.all([
      loadGenerateImage(),
      loadGenerateCaption()
    ]);

    const results = { image: null, legende: null };

    if (genImage) {
      try {
        results.image = await genImage({
          prompt: toolInput.prompt,
          style: toolInput.style || 'african',
          format: toolInput.format || 'square'
        });
      } catch (imgError) {
        logger.warn('[CONTENU HANDLER] Erreur generation image:', { error: imgError.message });
        results.image = { error: imgError.message };
      }
    }

    if (genCaption) {
      try {
        results.legende = await genCaption({
          type: toolInput.type || 'post',
          platform: toolInput.platform || 'instagram',
          data: toolInput.data || { sujet: toolInput.prompt }
        });
      } catch (capError) {
        logger.warn('[CONTENU HANDLER] Erreur generation legende:', { error: capError.message });
        results.legende = { error: capError.message };
      }
    }

    const hasImage = results.image && !results.image.error;
    const hasLegende = results.legende && !results.legende.error;

    return {
      success: hasImage || hasLegende,
      message: hasImage && hasLegende
        ? 'Post complet genere (image + legende)'
        : hasImage
          ? 'Image generee (legende non disponible)'
          : hasLegende
            ? 'Legende generee (image non disponible)'
            : 'Erreur: aucun contenu genere',
      image: results.image,
      legende: results.legende
    };
  } catch (error) {
    logger.error('[CONTENU HANDLER] Erreur creer_post_complet:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function lister_templates(_toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  return {
    success: true,
    templates: [
      { id: 'promo', nom: 'Promotion', description: 'Post promotionnel avec offre speciale', platforms: ['instagram', 'facebook'] },
      { id: 'nouveau_service', nom: 'Nouveau service', description: 'Annonce d\'un nouveau service', platforms: ['instagram', 'facebook', 'twitter'] },
      { id: 'temoignage', nom: 'Temoignage client', description: 'Mise en avant d\'un avis client', platforms: ['instagram', 'facebook'] },
      { id: 'avant_apres', nom: 'Avant/Apres', description: 'Transformation ou resultat visuel', platforms: ['instagram'] },
      { id: 'equipe', nom: 'Equipe', description: 'Presentation d\'un membre de l\'equipe', platforms: ['instagram', 'facebook', 'linkedin'] },
      { id: 'conseil', nom: 'Conseil expert', description: 'Astuce ou conseil professionnel', platforms: ['instagram', 'facebook', 'twitter'] },
      { id: 'evenement', nom: 'Evenement', description: 'Annonce d\'un evenement ou journee speciale', platforms: ['instagram', 'facebook', 'twitter'] },
      { id: 'coulisses', nom: 'Coulisses', description: 'Behind the scenes du quotidien', platforms: ['instagram', 'tiktok'] },
      { id: 'citation', nom: 'Citation inspirante', description: 'Citation motivante liee au metier', platforms: ['instagram', 'facebook'] },
      { id: 'faq', nom: 'FAQ', description: 'Reponse a une question frequente', platforms: ['instagram', 'facebook', 'twitter'] }
    ]
  };
}

async function lister_images_generees(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const limit = toolInput.limit || 20;

    const { data, error } = await supabase
      .from('social_posts')
      .select('id, content, media_url, platform, status, created_at')
      .eq('tenant_id', tenantId)
      .not('media_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.warn('[CONTENU HANDLER] Erreur requete social_posts:', { error: error.message });
      return {
        success: true,
        images: [],
        count: 0,
        message: 'Table social_posts non accessible ou vide'
      };
    }

    return {
      success: true,
      images: data || [],
      count: data?.length || 0
    };
  } catch (error) {
    logger.error('[CONTENU HANDLER] Erreur lister_images_generees:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

export const contenuHandlers = {
  creer_image,
  creer_legende,
  creer_post_complet,
  lister_templates,
  lister_images_generees
};
