/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES SOCIAL - API Réseaux Sociaux avec génération IA          ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║   POST /api/social/generate-post  - Génère un post avec l'IA      ║
 * ║   POST /api/social/generate-image - Génère une image DALL-E       ║
 * ║   GET  /api/social/quotas         - Quotas utilisation IA         ║
 * ║   POST /api/social/posts          - Sauvegarde un post            ║
 * ║   GET  /api/social/posts          - Liste les posts               ║
 * ║   GET  /api/social/posts/:id      - Récupère un post              ║
 * ║   PATCH /api/social/posts/:id     - Met à jour un post            ║
 * ║   DELETE /api/social/posts/:id    - Supprime un post              ║
 * ║   GET  /api/social/stats          - Statistiques posts            ║
 * ║   POST /api/social/generate-ideas - Génère des idées de posts     ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware auth admin pour toutes les routes
router.use(authenticateAdmin);

// ============ HELPERS QUOTAS ============

/**
 * Récupère les limites du plan et l'utilisation actuelle du tenant
 */
async function getQuotaInfo(tenantId) {
  // Récupérer le plan du tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('plan_id')
    .eq('id', tenantId)
    .single();

  const planId = tenant?.plan_id || 'starter';

  // Récupérer les limites du plan
  const { data: plan } = await supabase
    .from('plans')
    .select('posts_ia_mois, images_dalle_mois')
    .eq('id', planId)
    .single();

  const limites = {
    posts: plan?.posts_ia_mois || 200,
    images: plan?.images_dalle_mois || 200,
  };

  // Compter l'utilisation ce mois-ci
  const debutMois = new Date();
  debutMois.setDate(1);
  debutMois.setHours(0, 0, 0, 0);

  // Posts générés ce mois (compter les posts créés)
  const { count: postsCount } = await supabase
    .from('social_posts')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('created_at', debutMois.toISOString());

  // Images générées ce mois (posts avec media_urls non vide)
  const { data: postsWithMedia } = await supabase
    .from('social_posts')
    .select('media_urls')
    .eq('tenant_id', tenantId)
    .gte('created_at', debutMois.toISOString())
    .not('media_urls', 'is', null);

  let imagesCount = 0;
  if (postsWithMedia) {
    for (const post of postsWithMedia) {
      if (Array.isArray(post.media_urls)) {
        imagesCount += post.media_urls.length;
      }
    }
  }

  return {
    plan: planId,
    limites,
    utilisation: {
      posts: postsCount || 0,
      images: imagesCount,
    },
    restant: {
      posts: Math.max(0, limites.posts - (postsCount || 0)),
      images: Math.max(0, limites.images - imagesCount),
    },
  };
}

// ============ CONSTANTES ============

const PLATFORMS = ['linkedin', 'facebook', 'instagram', 'twitter', 'tiktok'];
const STATUSES = ['draft', 'scheduled', 'published', 'failed'];
const CATEGORIES = ['promo', 'event', 'product', 'news', 'tips', 'behind_scenes'];

// Prompts par secteur et plateforme
const PROMPTS_SECTEUR = {
  salon: {
    linkedin: "Tu es expert marketing pour un salon de coiffure/beauté. Crée un post LinkedIn professionnel mais chaleureux sur le thème : {sujet}. Ton : expert accessible. Longueur : 150-200 mots. Inclus 2-3 émojis pertinents.",
    facebook: "Tu es community manager d'un salon de coiffure/beauté. Crée un post Facebook engageant sur : {sujet}. Ton : convivial et proche. Longueur : 100-150 mots. Inclus emojis et call-to-action.",
    instagram: "Tu es influenceur beauté. Crée une caption Instagram inspirante sur : {sujet}. Ton : enthousiaste et tendance. Longueur : 80-120 mots. Inclus 5-7 hashtags pertinents.",
    twitter: "Tu es community manager beauté. Crée un tweet accrocheur sur : {sujet}. Max 280 caractères. Inclus 2-3 hashtags.",
    tiktok: "Tu es créateur TikTok beauté. Crée une description vidéo tendance sur : {sujet}. Max 150 caractères. Inclus hashtags viraux.",
  },
  restaurant: {
    linkedin: "Tu es expert marketing pour un restaurant. Crée un post LinkedIn sur : {sujet}. Ton : professionnel gourmand. Longueur : 150-200 mots. Focus qualité et savoir-faire.",
    facebook: "Tu es community manager d'un restaurant. Crée un post Facebook appétissant sur : {sujet}. Ton : chaleureux et gourmand. Longueur : 100-150 mots. Inclus call-to-action réservation.",
    instagram: "Tu es food influenceur. Crée une caption Instagram sur : {sujet}. Ton : passionné et visuel. Longueur : 80-120 mots. Inclus hashtags food.",
    twitter: "Tu es community manager food. Crée un tweet appétissant sur : {sujet}. Max 280 caractères.",
    tiktok: "Tu es créateur TikTok food. Crée une description vidéo gourmande sur : {sujet}. Max 150 caractères.",
  },
  services: {
    linkedin: "Tu es expert marketing B2B. Crée un post LinkedIn professionnel sur : {sujet}. Ton : expert et crédible. Longueur : 150-200 mots. Focus valeur ajoutée.",
    facebook: "Tu es community manager d'une entreprise de services. Crée un post Facebook sur : {sujet}. Ton : professionnel et accessible. Longueur : 100-150 mots.",
    instagram: "Tu es créateur de contenu professionnel. Crée une caption Instagram sur : {sujet}. Ton : inspirant et humain. Longueur : 80-120 mots.",
    twitter: "Tu es expert services B2B. Crée un tweet impactant sur : {sujet}. Max 280 caractères.",
    tiktok: "Tu es créateur TikTok business. Crée une description sur : {sujet}. Max 150 caractères.",
  },
  ecommerce: {
    linkedin: "Tu es expert e-commerce. Crée un post LinkedIn sur : {sujet}. Ton : expert digital. Longueur : 150-200 mots. Focus innovation et tendances.",
    facebook: "Tu es community manager e-commerce. Crée un post Facebook engageant sur : {sujet}. Ton : dynamique et commercial. Longueur : 100-150 mots. Inclus promo/offre.",
    instagram: "Tu es influenceur shopping. Crée une caption Instagram sur : {sujet}. Ton : tendance et désirable. Longueur : 80-120 mots. Inclus hashtags shopping.",
    twitter: "Tu es expert e-commerce. Crée un tweet accrocheur sur : {sujet}. Max 280 caractères.",
    tiktok: "Tu es créateur TikTok shopping. Crée une description tendance sur : {sujet}. Max 150 caractères.",
  },
  autre: {
    linkedin: "Tu es expert marketing. Crée un post LinkedIn professionnel sur : {sujet}. Ton : expert accessible. Longueur : 150-200 mots.",
    facebook: "Tu es community manager. Crée un post Facebook engageant sur : {sujet}. Ton : convivial. Longueur : 100-150 mots.",
    instagram: "Tu es créateur de contenu. Crée une caption Instagram sur : {sujet}. Ton : inspirant. Longueur : 80-120 mots. Inclus hashtags.",
    twitter: "Tu es community manager. Crée un tweet accrocheur sur : {sujet}. Max 280 caractères.",
    tiktok: "Tu es créateur TikTok. Crée une description tendance sur : {sujet}. Max 150 caractères.",
  },
};

// ============ GÉNÉRATION IA ============

/**
 * POST /api/social/generate-post
 * Génère un post avec l'IA selon le sujet et la plateforme
 */
router.post('/generate-post', async (req, res) => {
  try {
    const { sujet, plateforme } = req.body;
    const tenantId = req.admin.tenant_id;

    if (!sujet || !plateforme) {
      return res.status(400).json({
        success: false,
        error: 'Sujet et plateforme requis'
      });
    }

    if (!PLATFORMS.includes(plateforme)) {
      return res.status(400).json({
        success: false,
        error: `Plateforme invalide. Valides: ${PLATFORMS.join(', ')}`
      });
    }

    // Récupérer secteur du tenant
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('secteur, nom')
      .eq('id', tenantId)
      .single();

    const secteur = tenantData?.secteur || 'autre';
    const nomEntreprise = tenantData?.nom || '';

    // Sélectionner prompt selon secteur et plateforme
    const promptTemplate = PROMPTS_SECTEUR[secteur]?.[plateforme] || PROMPTS_SECTEUR.autre[plateforme];
    let prompt = promptTemplate.replace('{sujet}', sujet);

    if (nomEntreprise) {
      prompt += `\n\nNom de l'entreprise : ${nomEntreprise}`;
    }

    console.log(`[SOCIAL] Génération post: tenant=${tenantId}, secteur=${secteur}, plateforme=${plateforme}`);

    // Appel Claude API
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const contenuGenere = message.content[0].text;

    console.log(`[SOCIAL] Post généré: ${contenuGenere.substring(0, 50)}...`);

    res.json({
      success: true,
      contenu: contenuGenere,
      plateforme,
      sujet,
      secteur,
    });
  } catch (error) {
    console.error('[SOCIAL] Erreur génération post:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/social/generate-ideas
 * Génère des idées de posts avec l'IA
 */
router.post('/generate-ideas', async (req, res) => {
  try {
    const { theme, count = 5 } = req.body;
    const tenantId = req.admin.tenant_id;

    // Récupérer contexte tenant
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('secteur, nom')
      .eq('id', tenantId)
      .single();

    const secteur = tenantData?.secteur || 'autre';

    const prompt = `Tu es expert en social media marketing.

CONTEXTE:
- Type d'entreprise: ${secteur}
- Nom: ${tenantData?.nom || 'Non spécifié'}
${theme ? `- Thème demandé: ${theme}` : ''}

Génère ${count} idées de posts pour les réseaux sociaux.
Pour chaque idée, fournis:
1. Le sujet en une phrase
2. La plateforme recommandée (facebook, instagram, linkedin, twitter)
3. Le type (promo, tips, behind_scenes, event, product)

Réponds en JSON:
{
  "ideas": [
    {
      "sujet": "...",
      "plateforme": "instagram",
      "type": "tips",
      "description": "Courte description de l'idée"
    }
  ]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    // Extraire JSON de la réponse
    const text = response.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({
        success: false,
        error: 'Format de réponse IA invalide'
      });
    }

    const result = JSON.parse(match[0]);

    res.json({
      success: true,
      ideas: result.ideas,
      secteur,
    });
  } catch (error) {
    console.error('[SOCIAL] Erreur génération idées:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ GÉNÉRATION IMAGE DALL-E ============

/**
 * POST /api/social/generate-image
 * Génère une image avec DALL-E 3
 */
router.post('/generate-image', async (req, res) => {
  try {
    const { prompt, style = 'natural', size = '1024x1024' } = req.body;
    const tenantId = req.admin.tenant_id;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt requis pour générer une image'
      });
    }

    // Vérifier quota images
    const quotaInfo = await getQuotaInfo(tenantId);
    if (quotaInfo.restant.images <= 0) {
      return res.status(403).json({
        success: false,
        error: `Quota images épuisé. Limite: ${quotaInfo.limites.images}/mois. Passez au plan supérieur pour plus d'images.`,
        quota: quotaInfo
      });
    }

    // Récupérer contexte tenant pour enrichir le prompt
    const { data: tenantData } = await supabase
      .from('tenants')
      .select('secteur, nom')
      .eq('id', tenantId)
      .single();

    const secteur = tenantData?.secteur || 'autre';

    // Enrichir le prompt selon le secteur
    let enrichedPrompt = prompt;
    const styleModifiers = {
      salon: 'Style: photographie professionnelle de salon de beauté/coiffure, éclairage doux, ambiance élégante.',
      restaurant: 'Style: photographie culinaire professionnelle, présentation appétissante, éclairage chaleureux.',
      services: 'Style: image corporate moderne, professionnelle et épurée.',
      ecommerce: 'Style: photographie produit e-commerce, fond neutre, mise en valeur du produit.',
      autre: 'Style: image professionnelle et moderne.',
    };

    enrichedPrompt = `${prompt}. ${styleModifiers[secteur] || styleModifiers.autre}`;

    // Valider la taille demandée
    const validSizes = ['1024x1024', '1792x1024', '1024x1792'];
    const imageSize = validSizes.includes(size) ? size : '1024x1024';

    console.log(`[SOCIAL] Génération image DALL-E: tenant=${tenantId}, size=${imageSize}`);

    // Appel DALL-E 3
    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: enrichedPrompt,
      n: 1,
      size: imageSize,
      quality: 'standard',
      style: style === 'vivid' ? 'vivid' : 'natural',
    });

    const imageUrl = response.data[0].url;
    const revisedPrompt = response.data[0].revised_prompt;

    console.log(`[SOCIAL] Image générée avec succès`);

    res.json({
      success: true,
      image_url: imageUrl,
      revised_prompt: revisedPrompt,
      size: imageSize,
      quota: {
        restant: quotaInfo.restant.images - 1,
        limite: quotaInfo.limites.images,
      },
    });
  } catch (error) {
    console.error('[SOCIAL] Erreur génération image DALL-E:', error);

    // Gestion des erreurs spécifiques OpenAI
    if (error.code === 'content_policy_violation') {
      return res.status(400).json({
        success: false,
        error: 'Le prompt ne respecte pas les règles de contenu. Veuillez reformuler votre demande.'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ QUOTAS ============

/**
 * GET /api/social/quotas
 * Récupère les quotas du tenant
 */
router.get('/quotas', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const quotaInfo = await getQuotaInfo(tenantId);

    // Calculer les pourcentages d'utilisation
    const pourcentages = {
      posts: Math.round((quotaInfo.utilisation.posts / quotaInfo.limites.posts) * 100),
      images: Math.round((quotaInfo.utilisation.images / quotaInfo.limites.images) * 100),
    };

    res.json({
      success: true,
      quotas: {
        plan: quotaInfo.plan,
        posts: {
          utilise: quotaInfo.utilisation.posts,
          limite: quotaInfo.limites.posts,
          restant: quotaInfo.restant.posts,
          pourcentage: pourcentages.posts,
        },
        images: {
          utilise: quotaInfo.utilisation.images,
          limite: quotaInfo.limites.images,
          restant: quotaInfo.restant.images,
          pourcentage: pourcentages.images,
        },
      },
      periode: 'Mois en cours',
    });
  } catch (error) {
    console.error('[SOCIAL] Erreur récupération quotas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ CRUD POSTS ============

/**
 * POST /api/social/posts
 * Sauvegarde un post (brouillon ou programmé)
 */
router.post('/posts', async (req, res) => {
  try {
    const { plateforme, contenu, sujet, scheduled_at, media_urls, category } = req.body;
    const tenantId = req.admin.tenant_id;

    if (!contenu) {
      return res.status(400).json({
        success: false,
        error: 'Contenu requis'
      });
    }

    const platforms = Array.isArray(plateforme) ? plateforme : [plateforme || 'instagram'];
    const status = scheduled_at ? 'scheduled' : 'draft';

    const { data, error } = await supabase
      .from('social_posts')
      .insert({
        tenant_id: tenantId,
        platforms,
        content: contenu,
        category: category || null,
        status,
        scheduled_at: scheduled_at || null,
        media_urls: media_urls || [],
        created_by: req.admin.id,
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[SOCIAL] Post créé: id=${data.id}, status=${status}`);

    res.json({
      success: true,
      post: data,
    });
  } catch (error) {
    console.error('[SOCIAL] Erreur sauvegarde post:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/social/posts
 * Liste les posts du tenant
 */
router.get('/posts', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { status, category, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('social_posts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status && STATUSES.includes(status)) {
      query = query.eq('status', status);
    }

    if (category && CATEGORIES.includes(category)) {
      query = query.eq('category', category);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      posts: data,
      count,
      total: count,
    });
  } catch (error) {
    console.error('[SOCIAL] Erreur récupération posts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/social/posts/:id
 * Récupère un post par son ID
 */
router.get('/posts/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('social_posts')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Post non trouvé'
      });
    }

    res.json({
      success: true,
      post: data,
    });
  } catch (error) {
    console.error('[SOCIAL] Erreur récupération post:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/social/posts/:id
 * Met à jour un post
 */
router.patch('/posts/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { contenu, platforms, scheduled_at, category, media_urls } = req.body;

    // Vérifier que le post existe et appartient au tenant
    const { data: existing, error: checkError } = await supabase
      .from('social_posts')
      .select('status')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({
        success: false,
        error: 'Post non trouvé'
      });
    }

    if (existing.status === 'published') {
      return res.status(400).json({
        success: false,
        error: 'Impossible de modifier un post publié'
      });
    }

    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (contenu !== undefined) updateData.content = contenu;
    if (platforms !== undefined) updateData.platforms = platforms;
    if (category !== undefined) updateData.category = category;
    if (media_urls !== undefined) updateData.media_urls = media_urls;
    if (scheduled_at !== undefined) {
      updateData.scheduled_at = scheduled_at;
      updateData.status = scheduled_at ? 'scheduled' : 'draft';
    }

    const { data, error } = await supabase
      .from('social_posts')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      post: data,
    });
  } catch (error) {
    console.error('[SOCIAL] Erreur mise à jour post:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/social/posts/:id
 * Supprime un post
 */
router.delete('/posts/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('social_posts')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    console.log(`[SOCIAL] Post supprimé: id=${id}`);

    res.json({
      success: true,
      message: 'Post supprimé',
    });
  } catch (error) {
    console.error('[SOCIAL] Erreur suppression post:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ STATS ============

/**
 * GET /api/social/stats
 * Statistiques des posts
 */
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const { data: posts, error } = await supabase
      .from('social_posts')
      .select('status, platforms, category, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    const stats = {
      total: posts.length,
      byStatus: {},
      byPlatform: {},
      byCategory: {},
      published: 0,
      scheduled: 0,
      drafts: 0,
    };

    for (const post of posts) {
      // Par status
      stats.byStatus[post.status] = (stats.byStatus[post.status] || 0) + 1;
      if (post.status === 'published') stats.published++;
      if (post.status === 'scheduled') stats.scheduled++;
      if (post.status === 'draft') stats.drafts++;

      // Par plateforme
      for (const platform of post.platforms || []) {
        stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;
      }

      // Par catégorie
      if (post.category) {
        stats.byCategory[post.category] = (stats.byCategory[post.category] || 0) + 1;
      }
    }

    res.json({
      success: true,
      stats,
      period: `${days} derniers jours`,
    });
  } catch (error) {
    console.error('[SOCIAL] Erreur stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
