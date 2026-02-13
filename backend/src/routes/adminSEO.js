/**
 * Routes Admin SEO - Business Plan
 * Génération articles, analyse mots-clés, recommandations
 *
 * NOTE: Adapté au schéma DB existant
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { generateArticle, generateArticleIdeas, improveArticle } from '../ai/seoArticleGenerator.js';
import { analyzeKeywords, generateSEORecommendations, analyzeCompetition } from '../ai/keywordAnalyzer.js';

const router = express.Router();

// ============= ARTICLES =============

/**
 * POST /api/admin/seo/articles/generate
 * Générer article IA
 */
router.post('/articles/generate', authenticateAdmin, async (req, res) => {
  try {
    const { mot_cle_principal, mots_cles_secondaires, longueur } = req.body;

    if (!mot_cle_principal) {
      return res.status(400).json({ error: 'Mot-clé principal requis' });
    }

    // Récupérer info tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('secteur')
      .eq('id', req.admin.tenant_id)
      .single();

    const result = await generateArticle({
      tenant_id: req.admin.tenant_id,
      secteur: tenant?.secteur || 'services',
      mot_cle_principal,
      mots_cles_secondaires: mots_cles_secondaires || [],
      longueur: longueur || 'moyen'
    });

    res.json(result);
  } catch (error) {
    console.error('[SEO] Erreur génération article:', error);
    res.status(500).json({ error: 'Erreur génération article', details: error.message });
  }
});

/**
 * GET /api/admin/seo/articles/ideas
 * Générer idées d'articles
 */
router.get('/articles/ideas', authenticateAdmin, async (req, res) => {
  try {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('secteur')
      .eq('id', req.admin.tenant_id)
      .single();

    const ideas = await generateArticleIdeas(tenant?.secteur || 'services', 5);

    res.json({ ideas });
  } catch (error) {
    console.error('[SEO] Erreur génération idées:', error);
    res.status(500).json({ error: 'Erreur génération idées' });
  }
});

/**
 * GET /api/admin/seo/articles
 * Liste articles
 */
router.get('/articles', authenticateAdmin, async (req, res) => {
  try {
    const { statut, limit = 50 } = req.query;

    let query = supabase
      .from('seo_articles')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (statut) {
      query = query.eq('statut', statut);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Mapper pour compatibilité UI
    const mappedData = (data || []).map(article => ({
      ...article,
      mot_cle_principal: article.mots_cles_cibles?.[0] || '',
      mots_cles_secondaires: article.mots_cles_cibles?.slice(1) || [],
      lectures: article.vues || 0
    }));

    res.json(mappedData);
  } catch (error) {
    console.error('[SEO] Erreur get articles:', error);
    res.status(500).json({ error: 'Erreur récupération articles' });
  }
});

/**
 * GET /api/admin/seo/articles/:id
 */
router.get('/articles/:id', authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('seo_articles')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }

    // Mapper pour compatibilité UI
    res.json({
      ...data,
      mot_cle_principal: data.mots_cles_cibles?.[0] || '',
      mots_cles_secondaires: data.mots_cles_cibles?.slice(1) || [],
      lectures: data.vues || 0
    });
  } catch (error) {
    console.error('[SEO] Erreur get article:', error);
    res.status(500).json({ error: 'Article non trouvé' });
  }
});

/**
 * PATCH /api/admin/seo/articles/:id
 */
router.patch('/articles/:id', authenticateAdmin, async (req, res) => {
  try {
    const updates = { updated_at: new Date() };

    // Mapper les champs UI vers DB
    if (req.body.titre !== undefined) updates.titre = req.body.titre;
    if (req.body.slug !== undefined) updates.slug = req.body.slug;
    if (req.body.meta_description !== undefined) updates.meta_description = req.body.meta_description;
    if (req.body.contenu !== undefined) updates.contenu = req.body.contenu;
    if (req.body.statut !== undefined) updates.statut = req.body.statut;
    if (req.body.image_principale !== undefined) updates.image_principale = req.body.image_principale;

    // Combiner mot_cle_principal et mots_cles_secondaires en mots_cles_cibles
    if (req.body.mot_cle_principal !== undefined || req.body.mots_cles_secondaires !== undefined) {
      const principal = req.body.mot_cle_principal || '';
      const secondaires = req.body.mots_cles_secondaires || [];
      updates.mots_cles_cibles = [principal, ...secondaires].filter(Boolean);
    }

    const { data, error } = await supabase
      .from('seo_articles')
      .update(updates)
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[SEO] Erreur update article:', error);
    res.status(500).json({ error: 'Erreur mise à jour article' });
  }
});

/**
 * DELETE /api/admin/seo/articles/:id
 */
router.delete('/articles/:id', authenticateAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('seo_articles')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('[SEO] Erreur delete article:', error);
    res.status(500).json({ error: 'Erreur suppression article' });
  }
});

/**
 * POST /api/admin/seo/articles/:id/publier
 */
router.post('/articles/:id/publier', authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('seo_articles')
      .update({
        statut: 'publie',
        date_publication: new Date(),
        updated_at: new Date()
      })
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[SEO] Erreur publication:', error);
    res.status(500).json({ error: 'Erreur publication' });
  }
});

/**
 * POST /api/admin/seo/articles/:id/improve
 * Améliorer article avec IA
 */
router.post('/articles/:id/improve', authenticateAdmin, async (req, res) => {
  try {
    const { instructions } = req.body;

    if (!instructions) {
      return res.status(400).json({ error: 'Instructions requises' });
    }

    const result = await improveArticle(
      parseInt(req.params.id),
      req.admin.tenant_id,
      instructions
    );

    res.json(result);
  } catch (error) {
    console.error('[SEO] Erreur amélioration article:', error);
    res.status(500).json({ error: 'Erreur amélioration article' });
  }
});

// ============= KEYWORDS =============

/**
 * POST /api/admin/seo/keywords/analyze
 * Analyser mots-clés secteur
 */
router.post('/keywords/analyze', authenticateAdmin, async (req, res) => {
  try {
    const { niche } = req.body;

    const { data: tenant } = await supabase
      .from('tenants')
      .select('secteur')
      .eq('id', req.admin.tenant_id)
      .single();

    const keywords = await analyzeKeywords(tenant?.secteur || 'services', niche || '');

    res.json({ keywords });
  } catch (error) {
    console.error('[SEO] Erreur analyse keywords:', error);
    res.status(500).json({ error: 'Erreur analyse mots-clés' });
  }
});

/**
 * POST /api/admin/seo/keywords/competition
 * Analyser concurrence mot-clé
 */
router.post('/keywords/competition', authenticateAdmin, async (req, res) => {
  try {
    const { mot_cle } = req.body;

    if (!mot_cle) {
      return res.status(400).json({ error: 'Mot-clé requis' });
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('secteur')
      .eq('id', req.admin.tenant_id)
      .single();

    const analysis = await analyzeCompetition(mot_cle, tenant?.secteur || 'services');

    res.json(analysis);
  } catch (error) {
    console.error('[SEO] Erreur analyse concurrence:', error);
    res.status(500).json({ error: 'Erreur analyse concurrence' });
  }
});

/**
 * GET /api/admin/seo/keywords
 * Liste mots-clés suivis
 */
router.get('/keywords', authenticateAdmin, async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('seo_keywords')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .order('created_at', { ascending: false });

    if (status !== undefined) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Mapper pour compatibilité UI
    const mappedData = (data || []).map(kw => ({
      ...kw,
      mot_cle: kw.keyword,
      url_cible: kw.target_url,
      position_actuelle: kw.current_position,
      volume_recherche: kw.search_volume,
      actif: kw.status === 'active'
    }));

    res.json(mappedData);
  } catch (error) {
    console.error('[SEO] Erreur get keywords:', error);
    res.status(500).json({ error: 'Erreur récupération mots-clés' });
  }
});

/**
 * POST /api/admin/seo/keywords
 * Ajouter mot-clé à suivre
 */
router.post('/keywords', authenticateAdmin, async (req, res) => {
  try {
    const { mot_cle, keyword, volume_recherche, search_volume, url_cible, target_url } = req.body;

    const keywordValue = mot_cle || keyword;
    if (!keywordValue) {
      return res.status(400).json({ error: 'Mot-clé requis' });
    }

    const { data, error } = await supabase
      .from('seo_keywords')
      .insert({
        tenant_id: req.admin.tenant_id,
        keyword: keywordValue,
        target_url: url_cible || target_url || null,
        search_volume: volume_recherche || search_volume || null,
        status: 'active'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Mot-clé déjà suivi' });
      }
      throw error;
    }

    // Mapper pour compatibilité UI
    res.json({
      ...data,
      mot_cle: data.keyword,
      url_cible: data.target_url,
      position_actuelle: data.current_position,
      actif: data.status === 'active'
    });
  } catch (error) {
    console.error('[SEO] Erreur add keyword:', error);
    res.status(500).json({ error: 'Erreur ajout mot-clé' });
  }
});

/**
 * DELETE /api/admin/seo/keywords/:id
 */
router.delete('/keywords/:id', authenticateAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('seo_keywords')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('[SEO] Erreur delete keyword:', error);
    res.status(500).json({ error: 'Erreur suppression mot-clé' });
  }
});

/**
 * GET /api/admin/seo/keywords/:id/history
 * Historique positions d'un mot-clé
 */
router.get('/keywords/:id/history', authenticateAdmin, async (req, res) => {
  try {
    // Vérifier que le keyword appartient au tenant
    const { data: keyword } = await supabase
      .from('seo_keywords')
      .select('id')
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!keyword) {
      return res.status(404).json({ error: 'Mot-clé non trouvé' });
    }

    const { data, error } = await supabase
      .from('seo_positions')
      .select('*')
      .eq('keyword_id', req.params.id)
      .order('checked_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    // Mapper pour compatibilité UI
    const mappedData = (data || []).map(pos => ({
      ...pos,
      url_classee: pos.url,
      date_mesure: pos.checked_at
    }));

    res.json(mappedData);
  } catch (error) {
    console.error('[SEO] Erreur get history:', error);
    res.status(500).json({ error: 'Erreur récupération historique' });
  }
});

// ============= RECOMMENDATIONS =============

/**
 * GET /api/admin/seo/recommendations
 * Recommandations SEO
 */
router.get('/recommendations', authenticateAdmin, async (req, res) => {
  try {
    // Récupérer données nécessaires
    const [keywordsRes, articlesRes] = await Promise.all([
      supabase
        .from('seo_keywords')
        .select('*')
        .eq('tenant_id', req.admin.tenant_id),

      supabase
        .from('seo_articles')
        .select('*')
        .eq('tenant_id', req.admin.tenant_id)
    ]);

    const keywords = keywordsRes.data || [];
    const articles = articlesRes.data || [];

    const positions = keywords.filter(k => k.current_position !== null);

    // Générer nouvelles recommandations
    const newRecommendations = await generateSEORecommendations(req.admin.tenant_id, {
      keywords,
      articles,
      positions
    });

    // Enregistrer en BDD
    for (const reco of newRecommendations) {
      await supabase
        .from('seo_recommendations')
        .insert({
          tenant_id: req.admin.tenant_id,
          ...reco
        });
    }

    // Retourner toutes recommandations actives
    const { data: allRecommendations, error } = await supabase
      .from('seo_recommendations')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .in('statut', ['active', 'pending'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Mapper statut pour compatibilité UI
    const mappedRecos = (allRecommendations || []).map(r => ({
      ...r,
      statut: r.statut === 'active' ? 'pending' : r.statut
    }));

    res.json(mappedRecos);
  } catch (error) {
    console.error('[SEO] Erreur recommendations:', error);
    res.status(500).json({ error: 'Erreur génération recommandations' });
  }
});

/**
 * PATCH /api/admin/seo/recommendations/:id
 * Marquer recommandation comme complétée/ignorée
 */
router.patch('/recommendations/:id', authenticateAdmin, async (req, res) => {
  try {
    const { statut } = req.body;

    // Mapper les statuts UI vers DB
    const statutMapping = {
      'appliquee': 'completed',
      'ignoree': 'ignored',
      'pending': 'active',
      'completed': 'completed',
      'ignored': 'ignored',
      'active': 'active'
    };

    const dbStatut = statutMapping[statut] || statut;

    if (!['completed', 'ignored', 'active'].includes(dbStatut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const { data, error } = await supabase
      .from('seo_recommendations')
      .update({ statut: dbStatut })
      .eq('id', req.params.id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('[SEO] Erreur update reco:', error);
    res.status(500).json({ error: 'Erreur mise à jour recommandation' });
  }
});

// ============= STATS =============

/**
 * GET /api/admin/seo/stats
 * Statistiques SEO globales
 */
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const [keywordsRes, articlesRes, recosRes] = await Promise.all([
      supabase
        .from('seo_keywords')
        .select('id, current_position, status')
        .eq('tenant_id', req.admin.tenant_id),

      supabase
        .from('seo_articles')
        .select('id, statut, vues, partages')
        .eq('tenant_id', req.admin.tenant_id),

      supabase
        .from('seo_recommendations')
        .select('id, statut, priorite')
        .eq('tenant_id', req.admin.tenant_id)
    ]);

    const keywords = keywordsRes.data || [];
    const articles = articlesRes.data || [];
    const recommendations = recosRes.data || [];

    // Format pour UI SEODashboard
    const stats = {
      totalKeywords: keywords.length,
      keywordsTop10: keywords.filter(k => k.current_position && k.current_position <= 10).length,
      totalArticles: articles.length,
      articlesPublies: articles.filter(a => a.statut === 'publie').length,
      totalRecommendations: recommendations.length,
      recommendationsPending: recommendations.filter(r => r.statut === 'active' || r.statut === 'pending').length,
      // Stats détaillées
      keywords: {
        total: keywords.length,
        actifs: keywords.filter(k => k.status === 'active').length,
        top3: keywords.filter(k => k.current_position && k.current_position <= 3).length,
        top10: keywords.filter(k => k.current_position && k.current_position <= 10).length,
        top20: keywords.filter(k => k.current_position && k.current_position <= 20).length
      },
      articles: {
        total: articles.length,
        publies: articles.filter(a => a.statut === 'publie').length,
        brouillons: articles.filter(a => a.statut === 'brouillon').length,
        lectures_total: articles.reduce((sum, a) => sum + (a.vues || 0), 0),
        partages_total: articles.reduce((sum, a) => sum + (a.partages || 0), 0)
      },
      recommendations: {
        total: recommendations.length,
        actives: recommendations.filter(r => r.statut === 'active' || r.statut === 'pending').length,
        high_priority: recommendations.filter(r => (r.statut === 'active' || r.statut === 'pending') && r.priorite === 'high').length
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('[SEO] Erreur stats:', error);
    res.status(500).json({ error: 'Erreur récupération stats' });
  }
});

export default router;
