import { socialMediaConfig, isPlatformConfigured, getAvailablePlatforms, getPlatformStatus } from '../config/socialMedia.js';
import { getBusinessInfoSync } from './tenantBusinessService.js';

// === FACEBOOK ===
async function postToFacebook(content, imageUrl = null) {
  if (!isPlatformConfigured('facebook')) {
    return { success: false, error: 'Facebook non configuré. Ajoute META_ACCESS_TOKEN et FACEBOOK_PAGE_ID dans .env' };
  }

  try {
    const { accessToken, facebookPageId } = socialMediaConfig.meta;
    let endpoint = `https://graph.facebook.com/v18.0/${facebookPageId}/feed`;
    let body = { message: content, access_token: accessToken };

    // Si image fournie, utiliser /photos endpoint
    if (imageUrl) {
      endpoint = `https://graph.facebook.com/v18.0/${facebookPageId}/photos`;
      body = { url: imageUrl, caption: content, access_token: accessToken };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    return {
      success: true,
      postId: data.id || data.post_id,
      platform: 'facebook',
      url: `https://facebook.com/${data.id}`,
      message: 'Post publié sur Facebook !'
    };
  } catch (error) {
    console.error('[FACEBOOK] Erreur:', error);
    return { success: false, error: error.message };
  }
}

// === INSTAGRAM ===
async function postToInstagram(content, imageUrl) {
  if (!isPlatformConfigured('instagram')) {
    return { success: false, error: 'Instagram non configuré. Ajoute META_ACCESS_TOKEN et INSTAGRAM_ACCOUNT_ID dans .env' };
  }

  if (!imageUrl) {
    return { success: false, error: 'Instagram requiert une image pour publier' };
  }

  try {
    const { accessToken, instagramAccountId } = socialMediaConfig.meta;

    // Étape 1: Créer le conteneur média
    const containerResponse = await fetch(
      `https://graph.facebook.com/v18.0/${instagramAccountId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          caption: content,
          access_token: accessToken
        })
      }
    );

    const containerData = await containerResponse.json();

    if (containerData.error) {
      return { success: false, error: containerData.error.message };
    }

    // Attendre que le conteneur soit prêt (polling)
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Étape 2: Publier le conteneur
    const publishResponse = await fetch(
      `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: accessToken
        })
      }
    );

    const publishData = await publishResponse.json();

    if (publishData.error) {
      return { success: false, error: publishData.error.message };
    }

    return {
      success: true,
      postId: publishData.id,
      platform: 'instagram',
      message: 'Post publié sur Instagram !'
    };
  } catch (error) {
    console.error('[INSTAGRAM] Erreur:', error);
    return { success: false, error: error.message };
  }
}

// === TWITTER/X ===
async function postToTwitter(content, imageUrl = null) {
  if (!isPlatformConfigured('twitter')) {
    return { success: false, error: 'Twitter/X non configuré. Ajoute les clés TWITTER_* dans .env' };
  }

  try {
    const { apiKey, apiSecret, accessToken, accessTokenSecret } = socialMediaConfig.twitter;

    // Pour Twitter, on utilise OAuth 1.0a
    // Note: En production, utiliser une lib comme 'twitter-api-v2'

    const tweetBody = { text: content };

    // Simplification - en production utiliser twitter-api-v2
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${socialMediaConfig.twitter.bearerToken}`
      },
      body: JSON.stringify(tweetBody)
    });

    const data = await response.json();

    if (data.errors || data.detail) {
      return { success: false, error: data.errors?.[0]?.message || data.detail || 'Erreur Twitter' };
    }

    return {
      success: true,
      postId: data.data?.id,
      platform: 'twitter',
      url: data.data?.id ? `https://twitter.com/i/status/${data.data.id}` : null,
      message: 'Tweet publié sur X !'
    };
  } catch (error) {
    console.error('[TWITTER] Erreur:', error);
    return { success: false, error: error.message };
  }
}

// === LINKEDIN ===
async function postToLinkedIn(content, imageUrl = null) {
  if (!isPlatformConfigured('linkedin')) {
    return { success: false, error: 'LinkedIn non configuré. Ajoute les clés LINKEDIN_* dans .env' };
  }

  try {
    const { accessToken, organizationId } = socialMediaConfig.linkedin;

    // Déterminer si c'est un post personnel ou d'organisation
    const author = organizationId
      ? `urn:li:organization:${organizationId}`
      : 'urn:li:person:me';

    const postBody = {
      author: author,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: content },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    };

    const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      },
      body: JSON.stringify(postBody)
    });

    if (response.status === 401 || response.status === 403) {
      return { success: false, error: 'Token LinkedIn expiré ou permissions insuffisantes' };
    }

    const data = await response.json();

    if (data.message) {
      return { success: false, error: data.message };
    }

    return {
      success: true,
      postId: data.id,
      platform: 'linkedin',
      message: 'Post publié sur LinkedIn !'
    };
  } catch (error) {
    console.error('[LINKEDIN] Erreur:', error);
    return { success: false, error: error.message };
  }
}

// === TIKTOK ===
async function postToTikTok(content, videoUrl) {
  if (!isPlatformConfigured('tiktok')) {
    return { success: false, error: 'TikTok non configuré. Ajoute les clés TIKTOK_* dans .env' };
  }

  if (!videoUrl) {
    return { success: false, error: 'TikTok requiert une vidéo pour publier' };
  }

  try {
    const { accessToken } = socialMediaConfig.tiktok;

    // TikTok Content Posting API
    const response = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        post_info: {
          title: content.substring(0, 150), // TikTok limite le titre à 150 chars
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message || 'Erreur TikTok' };
    }

    return {
      success: true,
      postId: data.data?.publish_id,
      platform: 'tiktok',
      message: 'Vidéo en cours de publication sur TikTok (peut prendre quelques minutes)'
    };
  } catch (error) {
    console.error('[TIKTOK] Erreur:', error);
    return { success: false, error: error.message };
  }
}

// === FONCTION PRINCIPALE DE PUBLICATION ===
export async function publishToSocialMedia(platforms, content, mediaUrl = null, mediaType = 'image') {
  const results = [];

  for (const platform of platforms) {
    let result;
    const platformLower = platform.toLowerCase();

    console.log(`[SOCIAL] Publication sur ${platform}...`);

    switch (platformLower) {
      case 'facebook':
        result = await postToFacebook(content, mediaUrl);
        break;
      case 'instagram':
        result = await postToInstagram(content, mediaUrl);
        break;
      case 'twitter':
      case 'x':
        result = await postToTwitter(content, mediaUrl);
        break;
      case 'linkedin':
        result = await postToLinkedIn(content, mediaUrl);
        break;
      case 'tiktok':
        if (mediaType === 'video') {
          result = await postToTikTok(content, mediaUrl);
        } else {
          result = { success: false, error: 'TikTok nécessite une vidéo, pas une image' };
        }
        break;
      default:
        result = { success: false, error: `Plateforme "${platform}" non supportée` };
    }

    results.push({ platform: platformLower, ...result });
  }

  // Résumé
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  return {
    total: results.length,
    succes: successful.length,
    echecs: failed.length,
    resultats: results,
    resume: successful.length === results.length
      ? `Publié sur ${successful.length} plateforme(s) avec succès !`
      : `${successful.length}/${results.length} publication(s) réussie(s)`
  };
}

// === PLANIFICATION DE POSTS ===
export async function schedulePost(tenantId, platforms, content, mediaUrl, scheduledTime) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    const { supabase } = await import('../config/supabase.js');

    // Valider la date
    const scheduleDate = new Date(scheduledTime);
    if (scheduleDate <= new Date()) {
      return { success: false, error: 'La date de programmation doit être dans le futur' };
    }

    const { data, error } = await supabase
      .from('scheduled_posts')
      .insert({
        tenant_id: tenantId,
        platforms: platforms,
        content: content,
        media_url: mediaUrl,
        scheduled_time: scheduledTime,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      // Si la table n'existe pas, informer l'utilisateur
      if (error.code === '42P01') {
        return {
          success: false,
          error: 'La table scheduled_posts n\'existe pas encore. Exécute la migration SQL.',
          conseil: 'Crée la table scheduled_posts dans Supabase pour activer la programmation'
        };
      }
      return { success: false, error: error.message };
    }

    const dateFormatted = new Date(scheduledTime).toLocaleString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      success: true,
      postId: data.id,
      platforms: platforms,
      scheduled_time: scheduledTime,
      message: `Post programmé pour ${dateFormatted} sur ${platforms.join(', ')}`
    };
  } catch (error) {
    console.error('[SCHEDULE] Erreur:', error);
    return { success: false, error: error.message };
  }
}

// === RÉCUPÉRER LES POSTS PROGRAMMÉS ===
export async function getScheduledPosts(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    const { supabase } = await import('../config/supabase.js');

    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('scheduled_time', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return {
          success: true,
          posts: [],
          message: 'Aucun post programmé (table non créée)'
        };
      }
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: true,
        posts: [],
        message: 'Aucun post programmé pour le moment'
      };
    }

    const postsFormatted = data.map(post => ({
      id: post.id,
      platforms: post.platforms,
      content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
      scheduled_time: new Date(post.scheduled_time).toLocaleString('fr-FR'),
      has_media: !!post.media_url
    }));

    return {
      success: true,
      count: data.length,
      posts: postsFormatted
    };
  } catch (error) {
    console.error('[SCHEDULED] Erreur:', error);
    return { success: false, error: error.message };
  }
}

// === ANNULER UN POST PROGRAMMÉ ===
export async function cancelScheduledPost(tenantId, postId) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    const { supabase } = await import('../config/supabase.js');

    const { error } = await supabase
      .from('scheduled_posts')
      .update({ status: 'cancelled' })
      .eq('tenant_id', tenantId)
      .eq('id', postId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: 'Post programmé annulé' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// === HASHTAGS PAR TYPE DE BUSINESS ===
const BUSINESS_HASHTAGS = {
  salon: {
    base: ['#coiffure', '#beaute', '#salon', '#soincheveux', '#hairstyle'],
    promo: ['#promo', '#offrespeciale', '#beaute'],
    conseil: ['#conseilbeaute', '#haircare', '#astuce'],
    avant_apres: ['#avantapres', '#transformation', '#beforeandafter'],
    inspiration: ['#inspiration', '#ideecoiffure', '#tendance'],
    coulisses: ['#behindthescenes', '#coulisses', '#passionmetier'],
    temoignage: ['#avis', '#temoignage', '#clientsatisfait']
  },
  service_domicile: {
    base: ['#serviceadomicile', '#confort', '#qualite', '#surplace'],
    promo: ['#promo', '#offrespeciale', '#adomicile'],
    conseil: ['#conseil', '#astuce', '#expertise'],
    avant_apres: ['#avantapres', '#transformation', '#resultat'],
    inspiration: ['#inspiration', '#idee', '#tendance'],
    coulisses: ['#behindthescenes', '#coulisses', '#monquotidien'],
    temoignage: ['#avis', '#temoignage', '#clientsatisfait']
  },
  restaurant: {
    base: ['#restaurant', '#gastronomie', '#foodie', '#bonneadresse'],
    promo: ['#promo', '#offrespeciale', '#bonplan'],
    conseil: ['#conseilculinaire', '#recette', '#astuce'],
    avant_apres: ['#avantapres', '#transformation', '#deco'],
    inspiration: ['#inspiration', '#food', '#cuisine'],
    coulisses: ['#behindthescenes', '#encuisine', '#coulisses'],
    temoignage: ['#avis', '#temoignage', '#clientsatisfait']
  },
  hotel: {
    base: ['#hotel', '#hebergement', '#voyage', '#sejour'],
    promo: ['#promo', '#offrespeciale', '#bonplan'],
    conseil: ['#conseilhbergement', '#voyage', '#astuce'],
    avant_apres: ['#avantapres', '#renovation', '#transformation'],
    inspiration: ['#inspiration', '#destination', '#weekend'],
    coulisses: ['#behindthescenes', '#coulisses', '#hotellerie'],
    temoignage: ['#avis', '#temoignage', '#clientsatisfait']
  },
  commerce: {
    base: ['#commerce', '#shopping', '#bonplan', '#nouveaute'],
    promo: ['#promo', '#offrespeciale', '#soldes'],
    conseil: ['#conseil', '#astuce', '#recommandation'],
    avant_apres: ['#avantapres', '#transformation', '#resultat'],
    inspiration: ['#inspiration', '#tendance', '#decouverte'],
    coulisses: ['#behindthescenes', '#coulisses', '#moncommerce'],
    temoignage: ['#avis', '#temoignage', '#clientsatisfait']
  },
  security: {
    base: ['#securite', '#protection', '#gardiennage', '#surveillance'],
    promo: ['#promo', '#offrespeciale', '#securiteprivee'],
    conseil: ['#conseil', '#securite', '#prevention'],
    avant_apres: ['#avantapres', '#transformation', '#resultat'],
    inspiration: ['#inspiration', '#securiteprivee', '#innovation'],
    coulisses: ['#behindthescenes', '#coulisses', '#metier'],
    temoignage: ['#avis', '#temoignage', '#clientsatisfait']
  }
};

/**
 * Retourne les hashtags pour un business type et un type de contenu.
 */
function getHashtags(businessType, contentType) {
  const tags = BUSINESS_HASHTAGS[businessType] || BUSINESS_HASHTAGS.salon;
  const baseTags = tags.base || [];
  const typeTags = tags[contentType] || tags.promo || [];
  return [...typeTags, ...baseTags].slice(0, 8).join(' ');
}

// === GÉNÉRATION DE CONTENU OPTIMISÉ ===
export function generateSocialContent(sujet, type, platforms = ['instagram', 'facebook', 'twitter'], tenantId) {
  if (!tenantId) throw new Error('tenant_id requis pour generateSocialContent');

  const info = getBusinessInfoSync(tenantId);
  const nom = info.nom || tenantId;
  const gerant = info.gerant || 'Nexus';
  const telephone = info.telephone || '';
  const adresse = info.adresse || '';
  const businessType = info.businessType || 'salon';

  // Build contact lines dynamically (only show if data exists)
  const phoneLine = telephone ? `📞 ${telephone}` : '';
  const addressLine = adresse ? `📍 ${adresse}` : '';

  const templates = {
    instagram: {
      promo: `✨ ${sujet} ✨

🎁 Offre spéciale chez ${nom} !

${addressLine}
${phoneLine}
🌐 Lien en bio

${getHashtags(businessType, 'promo')}`.trim(),

      conseil: `💡 CONSEIL PRO 💡

${sujet}

Un conseil de ${gerant} pour vous ! 💜

Tu as des questions ? Demande en commentaire !

${getHashtags(businessType, 'conseil')}`.trim(),

      avant_apres: `✨ TRANSFORMATION ✨

Avant ➡️ Après

${sujet}

Tu veux le même résultat ?
${phoneLine}
${addressLine}

${getHashtags(businessType, 'avant_apres')}`.trim(),

      inspiration: `✨ INSPIRATION DU JOUR ✨

${sujet}

Qu'est-ce qui vous inspire ? Dites-le en commentaire ! 💜

${phoneLine}

${getHashtags(businessType, 'inspiration')}`.trim(),

      coulisses: `🎬 BEHIND THE SCENES 🎬

${sujet}

Un aperçu du quotidien chez ${nom} 💜

${getHashtags(businessType, 'coulisses')}`.trim(),

      temoignage: `⭐ AVIS CLIENT ⭐

"${sujet}"

Merci pour votre confiance ! 💜

Vous aussi, faites-nous confiance !
${phoneLine}

${getHashtags(businessType, 'temoignage')}`.trim()
    },

    facebook: {
      promo: `🎉 OFFRE SPÉCIALE 🎉

${sujet}

${nom} — à votre service !

${addressLine}
${phoneLine}
💻 Réservation en ligne disponible

N'hésitez pas à partager ! 💜`.trim(),

      conseil: `💡 Le conseil de ${gerant} 💡

${sujet}

Notre expertise à votre service !

Des questions ? Posez-les en commentaire, on répond à toutes ! 😊`.trim(),

      avant_apres: `✨ AVANT / APRÈS ✨

${sujet}

Vous aussi, profitez de notre savoir-faire !

${phoneLine}
${addressLine}`.trim(),

      temoignage: `⭐⭐⭐⭐⭐

"${sujet}"

Merci à nos clients pour leur confiance ! 💜

Vous aussi, faites-nous confiance !
${phoneLine}`.trim(),

      inspiration: `💜 INSPIRATION 💜

${sujet}

Envie de découvrir ${nom} ?

${phoneLine}
${addressLine}`.trim(),

      coulisses: `🎬 Dans les coulisses...

${sujet}

La passion du métier, c'est ça qui fait la différence ! 💜`.trim()
    },

    twitter: {
      promo: `✨ ${sujet}

${addressLine}
${phoneLine}

${getHashtags(businessType, 'promo')}`.trim(),

      conseil: `💡 Conseil pro :

${sujet}

${getHashtags(businessType, 'conseil')}`.trim(),

      avant_apres: `✨ Avant ➡️ Après

${sujet}

${phoneLine}

${getHashtags(businessType, 'avant_apres')}`.trim(),

      inspiration: `✨ ${sujet}

Découvrez ${nom} ! 💜

${getHashtags(businessType, 'inspiration')}`.trim(),

      temoignage: `⭐ "${sujet}"

Merci pour la confiance !

${getHashtags(businessType, 'temoignage')}`.trim(),

      coulisses: `🎬 ${sujet}

${getHashtags(businessType, 'coulisses')}`.trim()
    },

    linkedin: {
      promo: `🚀 Offre spéciale — ${nom}

${sujet}

Notre engagement : vous offrir un service de qualité. Découvrez notre offre !

${nom} — ${adresse || 'Contactez-nous'}
${phoneLine}

#entrepreneuriat #business #serviceclient ${getHashtags(businessType, 'promo')}`.trim(),

      conseil: `💡 Conseil d'expert

${sujet}

L'expertise de ${gerant} au service de la qualité.

#expertise #conseil ${getHashtags(businessType, 'conseil')}`.trim(),

      avant_apres: `✨ Transformation

${sujet}

La qualité fait la différence.

${nom}
#transformation #qualite ${getHashtags(businessType, 'avant_apres')}`.trim(),

      coulisses: `📸 Un jour dans la vie de ${nom}

${sujet}

La passion du métier, c'est ce qui fait la différence.

#entrepreneuriat #passionmetier ${getHashtags(businessType, 'coulisses')}`.trim(),

      temoignage: `⭐ Témoignage client

"${sujet}"

Ces retours nous motivent chaque jour à donner le meilleur.

#satisfaction #qualite ${getHashtags(businessType, 'temoignage')}`.trim(),

      inspiration: `💜 Inspiration

${sujet}

Découvrez l'univers de ${nom}.

#inspiration ${getHashtags(businessType, 'inspiration')}`.trim()
    },

    tiktok: {
      promo: `${sujet} ✨ ${getHashtags(businessType, 'promo')} #fyp #pourtoi`,
      conseil: `Conseil pro 💡 ${sujet} ${getHashtags(businessType, 'conseil')} #fyp`,
      avant_apres: `Transformation incroyable ✨ ${sujet} ${getHashtags(businessType, 'avant_apres')} #fyp`,
      coulisses: `POV: Coulisses de ${nom} 🎬 ${sujet} ${getHashtags(businessType, 'coulisses')} #fyp`,
      inspiration: `Inspo du jour 💜 ${sujet} ${getHashtags(businessType, 'inspiration')} #fyp`,
      temoignage: `Client satisfait 🥹 ${sujet} ${getHashtags(businessType, 'temoignage')} #fyp`
    }
  };

  const results = {};

  for (const platform of platforms) {
    const platformLower = platform.toLowerCase();
    const platformTemplates = templates[platformLower] || templates.instagram;
    // Clean up any double newlines from empty contact fields
    const content = (platformTemplates[type] || platformTemplates.promo).replace(/\n{3,}/g, '\n\n').trim();
    results[platform] = {
      contenu: content,
      caracteres: content.length,
      limite: platformLower === 'twitter' ? 280 : platformLower === 'tiktok' ? 150 : 2200
    };
  }

  return {
    sujet,
    type,
    contenus: results,
    conseil: 'Adapte légèrement chaque post selon la plateforme pour de meilleurs résultats !',
    meilleur_moment: {
      instagram: 'Mardi-Jeudi 11h-13h ou 19h-21h',
      facebook: 'Mercredi-Vendredi 13h-16h',
      twitter: 'Mardi-Jeudi 9h-11h',
      linkedin: 'Mardi-Jeudi 8h-10h ou 17h-18h',
      tiktok: 'Soir 18h-22h, weekend'
    }
  };
}

// Export des fonctions utilitaires
export { getAvailablePlatforms, getPlatformStatus };
