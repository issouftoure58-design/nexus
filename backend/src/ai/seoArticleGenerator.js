/**
 * SEO Article Generator - Business Plan
 * Génération d'articles de blog SEO-optimisés via Claude
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../config/supabase.js';
import { MODEL_DEFAULT } from '../services/modelRouter.js';

const anthropic = new Anthropic();

/**
 * Appel Anthropic avec retry automatique (gère erreurs 529 surcharge)
 */
async function callWithRetry(params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await anthropic.messages.create(params);
    } catch (error) {
      const isRetryable = error.status === 429 || error.status === 529 || error.status === 503;
      if (!isRetryable || attempt === maxRetries) throw error;
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
      console.log(`[SEO] API surcharge (${error.status}), retry ${attempt}/${maxRetries} dans ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * Génère un article de blog SEO-optimisé (niveau agence pro)
 */
export async function generateArticle({
  tenant_id,
  secteur,
  description = '',
  businessName = '',
  mot_cle_principal,
  mots_cles_secondaires = [],
  longueur = 'moyen',
  // Nouveaux champs pour brief métier précis
  services_proposes = [],
  services_exclus = [],
  valeurs = '',
  zone_geographique = '',
  public_cible = '',
}) {
  // Validate tenant_id before any operation
  if (!tenant_id) {
    throw new Error('TENANT_ID_REQUIRED: generateArticle requires explicit tenant_id');
  }

  try {
    const longueurs = {
      court: 800,
      moyen: 1500,
      long: 2500
    };

    const targetWords = longueurs[longueur] || 1500;

    const contextLines = [`- Secteur d'activité: ${secteur}`];
    if (description) contextLines.push(`- Spécialité: ${description}`);
    if (businessName) contextLines.push(`- Nom de l'entreprise: ${businessName}`);
    if (zone_geographique) contextLines.push(`- Zone géographique: ${zone_geographique}`);
    if (public_cible) contextLines.push(`- Public cible: ${public_cible}`);
    if (valeurs) contextLines.push(`- Valeurs/Positionnement: ${valeurs}`);
    if (services_proposes.length > 0) contextLines.push(`- Services proposés: ${services_proposes.join(', ')}`);
    if (services_exclus.length > 0) contextLines.push(`- ⚠️ Services NON proposés (NE JAMAIS mentionner): ${services_exclus.join(', ')}`);

    const prompt = `Tu es un rédacteur SEO senior avec 10 ans d'expérience en référencement naturel français. Tu produis des articles de qualité agence (Semrush, 1ère Position).

CONTEXTE ENTREPRISE:
${contextLines.join('\n')}
- Mot-clé principal: "${mot_cle_principal}"
- Mots-clés secondaires: ${mots_cles_secondaires.length > 0 ? mots_cles_secondaires.join(', ') : 'aucun'}
- Longueur cible: ${targetWords} mots MINIMUM
- Marché: France

BRIEF STRICT:
${services_exclus.length > 0 ? `⚠️ NE JAMAIS mentionner ces services/sujets dans l'article: ${services_exclus.join(', ')}. L'entreprise est CONTRE ces pratiques.` : ''}
${services_proposes.length > 0 ? `✅ Concentre-toi UNIQUEMENT sur ces services: ${services_proposes.join(', ')}` : ''}

CONSIGNES SEO PRO:
1. Titre accrocheur avec mot-clé principal (55-65 caractères)
2. Introduction captivante avec le mot-clé dans les 100 premiers mots + promesse de valeur
3. 5-7 sections H2 développées avec sous-titres H3
4. Intégrer naturellement les mots-clés (densité 1-2%) + variantes sémantiques (LSI)
5. Meta description avec mot-clé + bénéfice + CTA (150-155 caractères)
6. Section FAQ (3-5 questions/réponses) pour featured snippets — questions que les internautes posent réellement
7. CTA en conclusion avec proposition de valeur claire
8. Ton expert mais accessible — démontrer l'EXPERTISE (E-E-A-T)
9. Listes à puces, tableaux comparatifs, chiffres concrets quand pertinent
10. SEO local: mentionner la zone géographique naturellement (${zone_geographique || 'France'})
11. Chaque section doit apporter de la VALEUR (pas de remplissage)
12. Utiliser des transitions fluides entre sections

FORMAT JSON (UNIQUEMENT, sans texte avant ou après):
{
  "titre": "...",
  "slug": "...",
  "meta_description": "...",
  "contenu": "... (Markdown avec ## et ###)",
  "faq": [{"question": "...", "answer": "..."}, ...],
  "images_suggestions": ["description image 1", "description image 2", "description image 3"]
}

Le contenu DOIT être en Markdown. La section FAQ dans "faq" est séparée pour le Schema FAQ JSON-LD.`;

    const message = await callWithRetry({
      model: MODEL_DEFAULT,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const response = message.content[0].text;

    // Extraire JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Format JSON invalide dans réponse IA');
    }

    const article = JSON.parse(jsonMatch[0]);

    // Générer slug si manquant
    const finalSlug = article.slug || slugify(article.titre);

    // Ajouter FAQ au contenu Markdown si présent
    let fullContent = article.contenu || '';
    if (article.faq && article.faq.length > 0) {
      fullContent += '\n\n## Questions fréquentes\n\n';
      for (const item of article.faq) {
        fullContent += `### ${item.question}\n\n${item.answer}\n\n`;
      }
    }

    // Enregistrer en BDD (schéma existant utilise mots_cles_cibles array)
    const { data, error } = await supabase
      .from('seo_articles')
      .insert({
        tenant_id,
        titre: article.titre,
        slug: finalSlug,
        meta_description: article.meta_description,
        contenu: fullContent,
        mots_cles_cibles: [mot_cle_principal, ...mots_cles_secondaires].filter(Boolean),
        auteur: 'IA',
        statut: 'brouillon'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      article: data,
      faq: article.faq || [],
      images_suggestions: article.images_suggestions || []
    };
  } catch (error) {
    console.error('[SEO] Erreur génération article:', error);
    throw error;
  }
}

/**
 * Génère idées d'articles basées sur le métier du tenant
 * @param {string|object} contextOrSecteur - Contexte SEO riche ou string secteur (backward compat)
 * @param {number} nb - Nombre d'idées
 */
export async function generateArticleIdeas(contextOrSecteur, nb = 5) {
  // Backward compatibility: accepte string ou objet
  const context = typeof contextOrSecteur === 'string'
    ? { secteur: contextOrSecteur, description: '', category: '' }
    : contextOrSecteur;

  const { secteur, description, category, businessName } = context;

  try {
    const contextLines = [`- Métier: ${secteur}`];
    if (description) contextLines.push(`- Spécialité: ${description}`);
    if (category) contextLines.push(`- Catégorie: ${category}`);
    if (businessName) contextLines.push(`- Nom: ${businessName}`);

    const prompt = `Tu es un expert SEO français. Propose ${nb} idées d'articles de blog spécifiquement adaptées à ce type d'entreprise.

ENTREPRISE:
${contextLines.join('\n')}
- Marché: France

IMPORTANT: Les idées doivent être très spécifiques au métier "${secteur}". Pas d'idées génériques.

Pour chaque idée, fournis:
- titre: Titre accrocheur et spécifique au métier
- mot_cle: Mot-clé principal à cibler (longue traîne recommandée)
- angle: Angle d'attaque de l'article
- public: Public cible

Format: JSON array UNIQUEMENT, sans texte avant ou après
[{\"titre\": \"...\", \"mot_cle\": \"...\", \"angle\": \"...\", \"public\": \"...\"}]`;

    const message = await callWithRetry({
      model: MODEL_DEFAULT,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const response = message.content[0].text;
    const jsonMatch = response.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      return generateFallbackIdeas(secteur, nb);
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[SEO] Erreur génération idées:', error);
    return generateFallbackIdeas(secteur, nb);
  }
}

/**
 * Idées par défaut selon secteur
 */
function generateFallbackIdeas(secteur, nb) {
  const idees = {
    salon: [
      { titre: '10 Tendances Coiffure 2026 à Adopter', mot_cle: 'tendances coiffure 2026', angle: 'Guide pratique', public: 'Femmes 25-45 ans' },
      { titre: 'Comment Entretenir ses Locks au Quotidien', mot_cle: 'entretien locks', angle: 'Tutoriel complet', public: 'Porteurs locks' },
      { titre: 'Cheveux Afro: 5 Erreurs à Éviter Absolument', mot_cle: 'cheveux afro erreurs', angle: 'Conseils expert', public: 'Cheveux texturés' },
      { titre: 'Tresses Africaines: Guide Complet des Styles', mot_cle: 'tresses africaines styles', angle: 'Catalogue inspirations', public: 'Femmes afro' },
      { titre: 'Soins Naturels pour Cheveux Crépus', mot_cle: 'soins cheveux crépus', angle: 'Recettes maison', public: 'DIY beauté' }
    ],
    restaurant: [
      { titre: 'Les Secrets d\'un Bon Restaurant Révélés', mot_cle: 'bon restaurant', angle: 'Coulisses métier', public: 'Gourmets curieux' },
      { titre: 'Comment Choisir son Menu au Restaurant', mot_cle: 'choisir menu restaurant', angle: 'Guide pratique', public: 'Grand public' },
      { titre: 'Les Tendances Gastronomiques 2026', mot_cle: 'tendances gastronomie 2026', angle: 'Analyse marché', public: 'Foodies' },
      { titre: 'Accord Mets et Vins: Le Guide Ultime', mot_cle: 'accord mets vins', angle: 'Expertise sommelier', public: 'Amateurs vin' },
      { titre: 'Réservation Restaurant: Astuces Insider', mot_cle: 'réservation restaurant', angle: 'Tips pratiques', public: 'Citadins' }
    ],
    beaute: [
      { titre: 'Routine Beauté: Les Étapes Essentielles', mot_cle: 'routine beauté', angle: 'Guide débutant', public: 'Femmes 18-35' },
      { titre: 'Maquillage Naturel: Tendance 2026', mot_cle: 'maquillage naturel', angle: 'Tutoriel', public: 'Adeptes naturel' },
      { titre: 'Soins Anti-Âge: Ce Qui Fonctionne Vraiment', mot_cle: 'soins anti-âge efficaces', angle: 'Décryptage', public: 'Femmes 40+' }
    ],
    default: [
      { titre: `Les 5 Tendances ${secteur} en 2026`, mot_cle: `tendances ${secteur} 2026`, angle: 'Analyse marché', public: 'Professionnels' },
      { titre: `Guide Complet: Comment Choisir son ${secteur}`, mot_cle: `choisir ${secteur}`, angle: 'Comparatif', public: 'Grand public' },
      { titre: `${secteur}: Les Erreurs de Débutant`, mot_cle: `erreurs ${secteur}`, angle: 'Conseils', public: 'Débutants' },
      { titre: `Pourquoi Investir dans un Bon ${secteur}`, mot_cle: `investir ${secteur}`, angle: 'Argumentaire', public: 'Décideurs' },
      { titre: `${secteur}: Questions Fréquentes`, mot_cle: `faq ${secteur}`, angle: 'FAQ', public: 'Tous' }
    ]
  };

  const list = idees[secteur] || idees.default;
  return list.slice(0, nb);
}

/**
 * Slugify titre pour URL
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Améliorer article existant
 */
export async function improveArticle(articleId, tenant_id, instructions) {
  // Validate tenant_id before any operation
  if (!tenant_id) {
    throw new Error('TENANT_ID_REQUIRED: improveArticle requires explicit tenant_id');
  }

  try {
    // Récupérer article existant
    const { data: article, error: fetchError } = await supabase
      .from('seo_articles')
      .select('*')
      .eq('id', articleId)
      .eq('tenant_id', tenant_id)
      .single();

    if (fetchError || !article) {
      throw new Error('Article non trouvé');
    }

    const prompt = `Tu es un rédacteur SEO expert. Améliore cet article existant.

ARTICLE ACTUEL:
Titre: ${article.titre}
Mot-clé: ${article.mots_cles_cibles?.[0] || 'non défini'}
Contenu:
${article.contenu}

INSTRUCTIONS D'AMÉLIORATION:
${instructions}

Retourne l'article amélioré au format JSON:
{
  "titre": "...",
  "meta_description": "...",
  "contenu": "..."
}`;

    const message = await callWithRetry({
      model: MODEL_DEFAULT,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const response = message.content[0].text;
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Format JSON invalide');
    }

    const improved = JSON.parse(jsonMatch[0]);

    // Mettre à jour en BDD
    const { data, error } = await supabase
      .from('seo_articles')
      .update({
        titre: improved.titre || article.titre,
        meta_description: improved.meta_description || article.meta_description,
        contenu: improved.contenu || article.contenu,
        updated_at: new Date()
      })
      .eq('id', articleId)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw error;

    return { success: true, article: data };
  } catch (error) {
    console.error('[SEO] Erreur amélioration article:', error);
    throw error;
  }
}

export default {
  generateArticle,
  generateArticleIdeas,
  improveArticle,
  slugify
};
