/**
 * Keyword Analyzer - Business Plan
 * Analyse mots-clés et recommandations SEO
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../config/supabase.js';

const anthropic = new Anthropic();

/**
 * Analyse mots-clés pour un secteur
 */
export async function analyzeKeywords(secteur, niche = '') {
  try {
    const prompt = `Tu es un expert SEO français. Analyse les mots-clés pertinents pour une entreprise.

CONTEXTE:
- Secteur: ${secteur}
- Niche spécifique: ${niche || 'généraliste'}
- Marché: France

Fournis 10 mots-clés pertinents avec:
- mot_cle: le terme exact à cibler
- volume: estimation volume recherche mensuel (nombre ou "faible"/"moyen"/"élevé")
- difficulte: 1-100 (100 = très difficile à ranker)
- intention: informationnelle/commerciale/transactionnelle/navigationnelle
- suggestions: 2-3 variations longue traîne du mot-clé

Format: JSON array UNIQUEMENT, sans texte avant ou après
[{"mot_cle": "...", "volume": "...", "difficulte": 50, "intention": "...", "suggestions": ["...", "..."]}]`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const response = message.content[0].text;
    const jsonMatch = response.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      return generateDefaultKeywords(secteur);
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[SEO] Erreur analyse keywords:', error);
    return generateDefaultKeywords(secteur);
  }
}

/**
 * Mots-clés par défaut selon secteur
 */
function generateDefaultKeywords(secteur) {
  const defaults = {
    salon: [
      { mot_cle: 'coiffeur afro', volume: 'élevé', difficulte: 60, intention: 'commerciale', suggestions: ['coiffeur afro paris', 'coiffeur afro à domicile'] },
      { mot_cle: 'tresses africaines', volume: 'élevé', difficulte: 55, intention: 'commerciale', suggestions: ['tresses africaines prix', 'tresses africaines modèles'] },
      { mot_cle: 'salon coiffure afro', volume: 'moyen', difficulte: 50, intention: 'commerciale', suggestions: ['salon coiffure afro près de moi'] },
      { mot_cle: 'locks entretien', volume: 'moyen', difficulte: 40, intention: 'informationnelle', suggestions: ['entretien locks maison', 'produits entretien locks'] },
      { mot_cle: 'coiffure mariage afro', volume: 'moyen', difficulte: 45, intention: 'commerciale', suggestions: ['coiffure mariage afro tresses'] },
      { mot_cle: 'box braids', volume: 'élevé', difficulte: 50, intention: 'commerciale', suggestions: ['box braids prix', 'box braids courtes'] },
      { mot_cle: 'soins cheveux crépus', volume: 'moyen', difficulte: 55, intention: 'informationnelle', suggestions: ['routine cheveux crépus', 'masque cheveux crépus'] }
    ],
    restaurant: [
      { mot_cle: 'restaurant [ville]', volume: 'élevé', difficulte: 70, intention: 'commerciale', suggestions: ['meilleur restaurant [ville]', 'restaurant gastronomique [ville]'] },
      { mot_cle: 'réservation restaurant', volume: 'élevé', difficulte: 80, intention: 'transactionnelle', suggestions: ['réserver restaurant en ligne'] },
      { mot_cle: 'menu restaurant', volume: 'moyen', difficulte: 50, intention: 'informationnelle', suggestions: ['idées menu restaurant', 'menu restaurant semaine'] },
      { mot_cle: 'restaurant livraison', volume: 'élevé', difficulte: 75, intention: 'transactionnelle', suggestions: ['livraison restaurant proche'] },
      { mot_cle: 'brunch', volume: 'élevé', difficulte: 65, intention: 'commerciale', suggestions: ['brunch paris', 'meilleur brunch'] }
    ],
    beaute: [
      { mot_cle: 'institut beauté', volume: 'élevé', difficulte: 60, intention: 'commerciale', suggestions: ['institut beauté près de moi'] },
      { mot_cle: 'soin visage', volume: 'élevé', difficulte: 55, intention: 'commerciale', suggestions: ['soin visage hydratant', 'soin visage anti-âge'] },
      { mot_cle: 'épilation', volume: 'élevé', difficulte: 50, intention: 'commerciale', suggestions: ['épilation définitive', 'épilation laser prix'] },
      { mot_cle: 'manucure', volume: 'moyen', difficulte: 45, intention: 'commerciale', suggestions: ['manucure gel', 'nail art'] }
    ],
    default: [
      { mot_cle: secteur, volume: 'moyen', difficulte: 50, intention: 'commerciale', suggestions: [`${secteur} prix`, `meilleur ${secteur}`] },
      { mot_cle: `${secteur} avis`, volume: 'moyen', difficulte: 40, intention: 'informationnelle', suggestions: [`avis ${secteur}`, `${secteur} recommandation`] },
      { mot_cle: `${secteur} près de moi`, volume: 'élevé', difficulte: 60, intention: 'transactionnelle', suggestions: [`${secteur} proche`, `${secteur} à proximité`] }
    ]
  };

  return defaults[secteur] || defaults.default;
}

/**
 * Recommandations SEO basées sur analyse
 */
export async function generateSEORecommendations(tenant_id, data) {
  const recommendations = [];

  // Récupérer recommandations existantes pour éviter doublons
  const { data: existingRecos } = await supabase
    .from('seo_recommendations')
    .select('titre')
    .eq('tenant_id', tenant_id)
    .eq('statut', 'active');

  const existingTitles = new Set((existingRecos || []).map(r => r.titre));

  // Reco 1: Mots-clés non exploités
  const keywordsNotUsed = (data.keywords || []).filter(k => {
    return !(data.articles || []).some(a =>
      a.mot_cle_principal === k.mot_cle ||
      (a.mots_cles_secondaires || []).includes(k.mot_cle)
    );
  });

  if (keywordsNotUsed.length > 0) {
    const titre = `${keywordsNotUsed.length} mots-clés non exploités`;
    if (!existingTitles.has(titre)) {
      recommendations.push({
        type: 'content',
        titre,
        description: `Créer des articles sur: ${keywordsNotUsed.slice(0, 3).map(k => k.mot_cle).join(', ')}`,
        priorite: 'high',
        impact_estime: 'Gain potentiel: +20% trafic organique'
      });
    }
  }

  // Reco 2: Positions à améliorer (page 2 Google)
  const keywordsNearTop = (data.positions || []).filter(p =>
    p.position_actuelle >= 11 && p.position_actuelle <= 20
  );

  if (keywordsNearTop.length > 0) {
    const titre = 'Optimiser pages en page 2 Google';
    if (!existingTitles.has(titre)) {
      recommendations.push({
        type: 'technical',
        titre,
        description: `${keywordsNearTop.length} mots-clés proches du top 10 - améliorer contenu et backlinks`,
        priorite: 'medium',
        impact_estime: 'Passage top 10 = +50% clics sur ces pages'
      });
    }
  }

  // Reco 3: Créer contenu régulièrement
  const sortedArticles = [...(data.articles || [])].sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at)
  );
  const lastArticle = sortedArticles[0];

  const daysSinceLastArticle = lastArticle
    ? Math.floor((Date.now() - new Date(lastArticle.created_at)) / (1000 * 60 * 60 * 24))
    : 999;

  if (daysSinceLastArticle > 30) {
    const titre = 'Publier plus régulièrement';
    if (!existingTitles.has(titre)) {
      recommendations.push({
        type: 'content',
        titre,
        description: daysSinceLastArticle === 999
          ? 'Aucun article publié - commencer à créer du contenu'
          : `Dernier article il y a ${daysSinceLastArticle} jours - viser 2-4 articles/mois`,
        priorite: 'medium',
        impact_estime: 'Fréquence publication = fraîcheur = meilleur ranking'
      });
    }
  }

  // Reco 4: Articles sans meta description
  const articlesNoMeta = (data.articles || []).filter(a => !a.meta_description || a.meta_description.length < 100);

  if (articlesNoMeta.length > 0) {
    const titre = 'Meta descriptions manquantes ou courtes';
    if (!existingTitles.has(titre)) {
      recommendations.push({
        type: 'technical',
        titre,
        description: `${articlesNoMeta.length} articles sans meta description optimisée (150-160 caractères)`,
        priorite: 'medium',
        impact_estime: 'Meta description = +15% CTR dans les résultats Google'
      });
    }
  }

  // Reco 5: Diversifier les mots-clés
  if ((data.keywords || []).length < 5) {
    const titre = 'Élargir le suivi de mots-clés';
    if (!existingTitles.has(titre)) {
      recommendations.push({
        type: 'content',
        titre,
        description: 'Moins de 5 mots-clés suivis - ajouter des termes stratégiques',
        priorite: 'low',
        impact_estime: 'Plus de mots-clés = plus d\'opportunités de trafic'
      });
    }
  }

  // Reco 6: Optimiser les titres longs
  const articlesLongTitle = (data.articles || []).filter(a => a.titre && a.titre.length > 60);

  if (articlesLongTitle.length > 0) {
    const titre = 'Titres trop longs';
    if (!existingTitles.has(titre)) {
      recommendations.push({
        type: 'technical',
        titre,
        description: `${articlesLongTitle.length} articles avec titre > 60 caractères (tronqué dans Google)`,
        priorite: 'low',
        impact_estime: 'Titres optimisés = meilleur affichage SERP'
      });
    }
  }

  return recommendations;
}

/**
 * Analyser la concurrence pour un mot-clé
 */
export async function analyzeCompetition(mot_cle, secteur) {
  try {
    const prompt = `Tu es un expert SEO. Analyse la concurrence pour le mot-clé "${mot_cle}" dans le secteur "${secteur}" en France.

Fournis:
- niveau_concurrence: faible/moyen/élevé
- top_concurrents: 3 types de sites qui rankent (ex: "grandes marques", "blogs spécialisés")
- opportunites: 2-3 angles pour se différencier
- strategie_recommandee: approche pour ranker sur ce mot-clé

Format JSON uniquement:
{
  "niveau_concurrence": "...",
  "top_concurrents": ["...", "...", "..."],
  "opportunites": ["...", "..."],
  "strategie_recommandee": "..."
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const response = message.content[0].text;
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return {
        niveau_concurrence: 'moyen',
        top_concurrents: ['Sites généralistes', 'Annuaires locaux', 'Blogs thématiques'],
        opportunites: ['Contenu local', 'Expertise métier'],
        strategie_recommandee: 'Focus sur le contenu de qualité et le référencement local'
      };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[SEO] Erreur analyse concurrence:', error);
    return {
      niveau_concurrence: 'moyen',
      top_concurrents: ['Non disponible'],
      opportunites: ['Analyser manuellement'],
      strategie_recommandee: 'Erreur lors de l\'analyse'
    };
  }
}

export default {
  analyzeKeywords,
  generateSEORecommendations,
  analyzeCompetition
};
