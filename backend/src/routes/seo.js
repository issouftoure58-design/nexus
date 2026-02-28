/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES SEO - Génération articles, mots-clés, Google My Business ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║   Tables: articles_seo, mots_cles_suivis, meta_seo_pages,         ║
 * ║           google_my_business, gmb_posts                            ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║   ARTICLES BLOG                                                    ║
 * ║   POST /api/seo/articles/generer     - Générer article IA          ║
 * ║   POST /api/seo/articles             - Créer article               ║
 * ║   GET  /api/seo/articles             - Liste articles              ║
 * ║   GET  /api/seo/articles/:id         - Détail article              ║
 * ║   PATCH /api/seo/articles/:id        - Modifier article            ║
 * ║   POST /api/seo/articles/:id/publier - Publier article             ║
 * ║   DELETE /api/seo/articles/:id       - Supprimer article           ║
 * ║   MOTS-CLÉS                                                        ║
 * ║   POST /api/seo/mots-cles            - Ajouter mot-clé suivi       ║
 * ║   GET  /api/seo/mots-cles            - Liste mots-clés             ║
 * ║   PATCH /api/seo/mots-cles/:id       - MAJ position                ║
 * ║   DELETE /api/seo/mots-cles/:id      - Supprimer mot-clé           ║
 * ║   META SEO                                                         ║
 * ║   POST /api/seo/meta                 - Créer/MAJ meta page         ║
 * ║   GET  /api/seo/meta                 - Liste meta pages            ║
 * ║   GOOGLE MY BUSINESS                                               ║
 * ║   POST /api/seo/gmb                  - Créer/MAJ fiche GMB         ║
 * ║   GET  /api/seo/gmb                  - Récupérer fiche GMB         ║
 * ║   POST /api/seo/gmb/posts            - Créer post GMB              ║
 * ║   GET  /api/seo/gmb/posts            - Liste posts GMB             ║
 * ║   DASHBOARD                                                        ║
 * ║   GET  /api/seo/dashboard            - Stats SEO globales          ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/checkPlan.js';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL_DEFAULT } from '../services/modelRouter.js';

const router = express.Router();

// Middleware auth admin
router.use(authenticateAdmin);

// Middleware verification plan (seo = Business+)
router.use(requireModule('seo'));

// Client Anthropic pour génération IA
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Génère un slug à partir d'un titre
 */
function generateSlug(titre) {
  return titre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ═══════════════════════════════════════════════════════════
// ARTICLES BLOG SEO
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/seo/articles/generer
 * Générer un article SEO avec IA
 */
router.post('/articles/generer', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { sujet, mot_cle_principal, mots_cles_secondaires, longueur, secteur } = req.body;

    if (!sujet || !mot_cle_principal) {
      return res.status(400).json({
        success: false,
        error: 'Sujet et mot-clé principal requis',
      });
    }

    // Prompt génération article SEO
    const prompt = `Tu es un expert en rédaction SEO pour le secteur ${secteur || 'services'}.

Génère un article de blog optimisé SEO sur le sujet : "${sujet}"

Mot-clé principal : ${mot_cle_principal}
Mots-clés secondaires : ${mots_cles_secondaires?.join(', ') || 'aucun'}
Longueur cible : ${longueur || 1000} mots

INSTRUCTIONS :
- Structure H1 > H2 > H3 (le H1 est le titre)
- Utiliser naturellement le mot-clé principal (densité 1-2%)
- Intégrer les mots-clés secondaires
- Paragraphes courts (3-4 lignes max)
- Ton professionnel mais accessible
- Inclure des exemples concrets
- Format Markdown

Réponds UNIQUEMENT avec le contenu de l'article (pas de préambule, pas d'explication).`;

    console.log(`[SEO] Génération article: "${sujet}"`);

    const message = await anthropic.messages.create({
      model: MODEL_DEFAULT,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const contenu = message.content[0].text;

    // Générer slug
    const slug = generateSlug(sujet);

    // Générer meta description
    const metaPrompt = `Rédige une meta description SEO de 150-160 caractères pour cet article :
Titre : ${sujet}
Mot-clé : ${mot_cle_principal}

Réponds UNIQUEMENT avec la meta description (pas de préambule, pas de guillemets).`;

    const metaMessage = await anthropic.messages.create({
      model: MODEL_DEFAULT,
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: metaPrompt,
      }],
    });

    const metaDescription = metaMessage.content[0].text.trim();

    console.log(`[SEO] Article généré: ${contenu.length} caractères`);

    res.json({
      success: true,
      article: {
        titre: sujet,
        slug,
        contenu,
        meta_description: metaDescription,
        mot_cle_principal,
        mots_cles: [mot_cle_principal, ...(mots_cles_secondaires || [])],
      },
    });
  } catch (error) {
    console.error('[SEO] Erreur génération article:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/seo/articles
 * Créer un article
 */
router.post('/articles', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      titre,
      slug,
      meta_description,
      contenu,
      mots_cles,
      mot_cle_principal,
      image_principale_url,
      categorie,
      statut,
      date_planification,
    } = req.body;

    if (!titre || !contenu) {
      return res.status(400).json({
        success: false,
        error: 'Titre et contenu requis',
      });
    }

    const finalSlug = slug || generateSlug(titre);

    const { data: article, error } = await supabase
      .from('articles_seo')
      .insert({
        tenant_id: tenantId,
        titre,
        slug: finalSlug,
        meta_description,
        contenu,
        mots_cles: mots_cles || [],
        mot_cle_principal,
        image_principale_url,
        categorie,
        statut: statut || 'brouillon',
        date_planification: date_planification || null,
        date_publication: statut === 'publie' ? new Date().toISOString() : null,
        auteur_nom: req.admin.email || 'Admin',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ success: false, error: 'Slug déjà utilisé' });
      }
      throw error;
    }

    console.log(`[SEO] Article créé: ${article.titre}`);

    res.status(201).json({
      success: true,
      article,
    });
  } catch (error) {
    console.error('[SEO] Erreur création article:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/seo/articles
 * Liste des articles
 */
router.get('/articles', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { statut, categorie, limit = 50 } = req.query;

    let query = supabase
      .from('articles_seo')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (statut) query = query.eq('statut', statut);
    if (categorie) query = query.eq('categorie', categorie);

    const { data: articles, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      articles: articles || [],
      count: articles?.length || 0,
    });
  } catch (error) {
    console.error('[SEO] Erreur liste articles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/seo/articles/:id
 * Détail d'un article
 */
router.get('/articles/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: article, error } = await supabase
      .from('articles_seo')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !article) {
      return res.status(404).json({ success: false, error: 'Article non trouvé' });
    }

    res.json({
      success: true,
      article,
    });
  } catch (error) {
    console.error('[SEO] Erreur détail article:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/seo/articles/:id
 * Modifier un article
 */
router.patch('/articles/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const updates = { ...req.body };

    // Nettoyer les champs non modifiables
    delete updates.id;
    delete updates.tenant_id;
    delete updates.created_at;

    updates.updated_at = new Date().toISOString();

    const { data: article, error } = await supabase
      .from('articles_seo')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      article,
    });
  } catch (error) {
    console.error('[SEO] Erreur modification article:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/seo/articles/:id/publier
 * Publier un article
 */
router.post('/articles/:id/publier', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: article, error } = await supabase
      .from('articles_seo')
      .update({
        statut: 'publie',
        date_publication: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    console.log(`[SEO] Article publié: ${article.titre}`);

    res.json({
      success: true,
      article,
      message: 'Article publié avec succès',
    });
  } catch (error) {
    console.error('[SEO] Erreur publication:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/seo/articles/:id
 * Supprimer un article
 */
router.delete('/articles/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('articles_seo')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Article supprimé' });
  } catch (error) {
    console.error('[SEO] Erreur suppression article:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// MOTS-CLÉS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/seo/mots-cles
 * Ajouter un mot-clé suivi
 */
router.post('/mots-cles', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { mot_cle, volume_mensuel, difficulte, url_cible } = req.body;

    if (!mot_cle) {
      return res.status(400).json({ success: false, error: 'Mot-clé requis' });
    }

    const { data: motCle, error } = await supabase
      .from('mots_cles_suivis')
      .insert({
        tenant_id: tenantId,
        mot_cle: mot_cle.toLowerCase().trim(),
        volume_mensuel: volume_mensuel || 0,
        difficulte: difficulte || 50,
        url_cible,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ success: false, error: 'Mot-clé déjà suivi' });
      }
      throw error;
    }

    console.log(`[SEO] Mot-clé ajouté: ${mot_cle}`);

    res.status(201).json({
      success: true,
      mot_cle: motCle,
    });
  } catch (error) {
    console.error('[SEO] Erreur ajout mot-clé:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/seo/mots-cles
 * Liste des mots-clés suivis
 */
router.get('/mots-cles', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: motsCles, error } = await supabase
      .from('mots_cles_suivis')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('position_actuelle', { ascending: true, nullsFirst: false });

    if (error) throw error;

    res.json({
      success: true,
      mots_cles: motsCles || [],
      count: motsCles?.length || 0,
    });
  } catch (error) {
    console.error('[SEO] Erreur liste mots-clés:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/seo/mots-cles/:id
 * Mettre à jour un mot-clé (position, etc.)
 */
router.patch('/mots-cles/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { position, volume_mensuel, difficulte, url_cible } = req.body;

    // Récupérer mot-clé actuel
    const { data: motCle, error: errFetch } = await supabase
      .from('mots_cles_suivis')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (errFetch || !motCle) {
      return res.status(404).json({ success: false, error: 'Mot-clé non trouvé' });
    }

    const updates = {
      derniere_maj: new Date().toISOString(),
    };

    if (position !== undefined) {
      // Ajouter à l'historique
      const nouvelHistorique = [
        ...(motCle.historique_positions || []),
        {
          date: new Date().toISOString().split('T')[0],
          position: parseInt(position),
        },
      ];
      updates.position_actuelle = parseInt(position);
      updates.historique_positions = nouvelHistorique;
    }

    if (volume_mensuel !== undefined) updates.volume_mensuel = volume_mensuel;
    if (difficulte !== undefined) updates.difficulte = difficulte;
    if (url_cible !== undefined) updates.url_cible = url_cible;

    const { data: updated, error } = await supabase
      .from('mots_cles_suivis')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      mot_cle: updated,
    });
  } catch (error) {
    console.error('[SEO] Erreur MAJ mot-clé:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/seo/mots-cles/:id
 * Supprimer un mot-clé suivi
 */
router.delete('/mots-cles/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('mots_cles_suivis')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Mot-clé supprimé' });
  } catch (error) {
    console.error('[SEO] Erreur suppression mot-clé:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// META SEO PAGES
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/seo/meta
 * Créer ou mettre à jour les meta d'une page
 */
router.post('/meta', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      page_url,
      page_titre,
      meta_title,
      meta_description,
      meta_keywords,
      og_title,
      og_description,
      og_image,
      twitter_card,
      twitter_title,
      twitter_description,
      canonical_url,
      index_page,
      follow_links,
    } = req.body;

    if (!page_url || !page_titre || !meta_title || !meta_description) {
      return res.status(400).json({
        success: false,
        error: 'page_url, page_titre, meta_title et meta_description requis',
      });
    }

    const { data: meta, error } = await supabase
      .from('meta_seo_pages')
      .upsert({
        tenant_id: tenantId,
        page_url,
        page_titre,
        meta_title,
        meta_description,
        meta_keywords: meta_keywords || [],
        og_title: og_title || meta_title,
        og_description: og_description || meta_description,
        og_image,
        twitter_card: twitter_card || 'summary_large_image',
        twitter_title: twitter_title || meta_title,
        twitter_description: twitter_description || meta_description,
        canonical_url,
        index_page: index_page !== false,
        follow_links: follow_links !== false,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id,page_url',
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[SEO] Meta page MAJ: ${page_url}`);

    res.json({
      success: true,
      meta,
    });
  } catch (error) {
    console.error('[SEO] Erreur meta page:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/seo/meta
 * Liste des meta pages
 */
router.get('/meta', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: metas, error } = await supabase
      .from('meta_seo_pages')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('page_url');

    if (error) throw error;

    res.json({
      success: true,
      metas: metas || [],
    });
  } catch (error) {
    console.error('[SEO] Erreur liste metas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// GOOGLE MY BUSINESS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/seo/gmb
 * Créer ou mettre à jour la fiche Google My Business
 */
router.post('/gmb', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      nom_etablissement,
      categorie_principale,
      categories_secondaires,
      adresse_complete,
      latitude,
      longitude,
      telephone,
      site_web,
      horaires,
      description_courte,
      description_longue,
      attributs,
    } = req.body;

    if (!nom_etablissement || !adresse_complete) {
      return res.status(400).json({
        success: false,
        error: 'Nom établissement et adresse requis',
      });
    }

    const { data: gmb, error } = await supabase
      .from('google_my_business')
      .upsert({
        tenant_id: tenantId,
        nom_etablissement,
        categorie_principale,
        categories_secondaires: categories_secondaires || [],
        adresse_complete,
        latitude,
        longitude,
        telephone,
        site_web,
        horaires,
        description_courte,
        description_longue,
        attributs: attributs || [],
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tenant_id',
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[SEO] Fiche GMB MAJ: ${nom_etablissement}`);

    res.json({
      success: true,
      gmb,
    });
  } catch (error) {
    console.error('[SEO] Erreur GMB:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/seo/gmb
 * Récupérer la fiche Google My Business
 */
router.get('/gmb', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: gmb, error } = await supabase
      .from('google_my_business')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) throw error;

    res.json({
      success: true,
      gmb: gmb || null,
    });
  } catch (error) {
    console.error('[SEO] Erreur récup GMB:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/seo/gmb/posts
 * Créer un post Google My Business
 */
router.post('/gmb/posts', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      titre,
      contenu,
      type,
      cta_type,
      cta_url,
      images,
      date_publication,
      date_expiration,
      statut,
    } = req.body;

    if (!contenu || !type) {
      return res.status(400).json({
        success: false,
        error: 'Contenu et type requis',
      });
    }

    // Récupérer l'ID GMB
    const { data: gmb } = await supabase
      .from('google_my_business')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const { data: post, error } = await supabase
      .from('gmb_posts')
      .insert({
        tenant_id: tenantId,
        gmb_id: gmb?.id || null,
        titre,
        contenu,
        type,
        cta_type: cta_type || 'aucun',
        cta_url,
        images: images || [],
        date_publication: statut === 'publie' ? new Date().toISOString() : date_publication,
        date_expiration,
        statut: statut || 'brouillon',
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`[SEO] Post GMB créé: ${type}`);

    res.status(201).json({
      success: true,
      post,
    });
  } catch (error) {
    console.error('[SEO] Erreur création post GMB:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/seo/gmb/posts
 * Liste des posts Google My Business
 */
router.get('/gmb/posts', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { statut, type, limit = 50 } = req.query;

    let query = supabase
      .from('gmb_posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (statut) query = query.eq('statut', statut);
    if (type) query = query.eq('type', type);

    const { data: posts, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      posts: posts || [],
    });
  } catch (error) {
    console.error('[SEO] Erreur liste posts GMB:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════
// DASHBOARD SEO
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/seo/dashboard
 * Dashboard SEO avec stats globales
 */
router.get('/dashboard', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Stats articles
    const { data: articles } = await supabase
      .from('articles_seo')
      .select('statut, vues')
      .eq('tenant_id', tenantId);

    const nbArticles = articles?.length || 0;
    const nbPublies = articles?.filter(a => a.statut === 'publie').length || 0;
    const nbBrouillons = articles?.filter(a => a.statut === 'brouillon').length || 0;
    const totalVues = articles?.reduce((sum, a) => sum + (a.vues || 0), 0) || 0;

    // Stats mots-clés
    const { data: motsCles } = await supabase
      .from('mots_cles_suivis')
      .select('position_actuelle')
      .eq('tenant_id', tenantId);

    const nbMotsCles = motsCles?.length || 0;
    const top10 = motsCles?.filter(m => m.position_actuelle && m.position_actuelle <= 10).length || 0;
    const top3 = motsCles?.filter(m => m.position_actuelle && m.position_actuelle <= 3).length || 0;
    const top20 = motsCles?.filter(m => m.position_actuelle && m.position_actuelle <= 20).length || 0;

    // Stats GMB
    const { data: gmb } = await supabase
      .from('google_my_business')
      .select('nb_avis, note_moyenne')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // Stats posts GMB
    const { data: posts } = await supabase
      .from('gmb_posts')
      .select('statut')
      .eq('tenant_id', tenantId);

    const nbPosts = posts?.length || 0;
    const nbPostsPublies = posts?.filter(p => p.statut === 'publie').length || 0;

    // Stats meta pages
    const { data: metas } = await supabase
      .from('meta_seo_pages')
      .select('id')
      .eq('tenant_id', tenantId);

    res.json({
      success: true,
      stats: {
        articles: {
          total: nbArticles,
          publies: nbPublies,
          brouillons: nbBrouillons,
          total_vues: totalVues,
        },
        mots_cles: {
          total: nbMotsCles,
          top3,
          top10,
          top20,
        },
        gmb: {
          nb_avis: gmb?.nb_avis || 0,
          note_moyenne: gmb?.note_moyenne || 0,
          nb_posts: nbPosts,
          posts_publies: nbPostsPublies,
        },
        meta_pages: metas?.length || 0,
      },
    });
  } catch (error) {
    console.error('[SEO] Erreur dashboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
