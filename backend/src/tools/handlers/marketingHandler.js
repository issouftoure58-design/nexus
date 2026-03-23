/**
 * Marketing Handler — Posts sociaux, Campagnes, Promos, Email, SMS
 * Extracted from adminChatService.js (L712-886) + new tools
 * FIX: Uses 'social_posts' table (NOT posts_marketing)
 * FIX: Uses 'platform'/'content'/'status' columns (NOT type/contenu/statut)
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';
import { generateContent, getTenantContext } from './shared/claudeHelper.js';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL_DEFAULT } from '../../services/modelRouter.js';

let anthropicClient = null;

function getAnthropicClient() {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY non configuree');
    }
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

// ═══════════════════════════════════════════════════════════════
// marketing_generer_post — Generer un post social via Claude
// FIX: social_posts table, platform/content/status columns
// ═══════════════════════════════════════════════════════════════

async function marketing_generer_post(toolInput, tenantId, adminId) {
  const { plateforme, occasion, tone, details } = toolInput;

  logger.debug(`[MARKETING HANDLER] Generation post - plateforme: ${plateforme}, occasion: ${occasion}`);

  // Recuperer infos tenant pour personnaliser
  const { data: tenant } = await supabase
    .from('tenants')
    .select('business_name, business_profile, name, description')
    .eq('id', tenantId)
    .single();

  // Recuperer les services pour inspiration
  const { data: services } = await supabase
    .from('services')
    .select('nom, prix, description')
    .eq('tenant_id', tenantId)
    .eq('actif', true)
    .limit(10);

  const servicesText = services?.map(s => `- ${s.nom}: ${(s.prix / 100).toFixed(0)}EUR`).join('\n') || '';

  // Generer le post via Claude Sonnet (qualite superieure pour contenu marketing)
  const client = getAnthropicClient();
  const prompt = `Tu es expert en marketing digital et community management pour ${tenant?.business_name || 'cette entreprise'}.

Genere un post ${plateforme || 'Instagram'} professionnel et engageant.

CONTEXTE :
- Business : ${tenant?.business_name || 'Mon entreprise'}
- Type : ${tenant?.business_profile || 'Services'}
- Description : ${tenant?.description || 'Entreprise specialisee'}
- Services proposes :
${servicesText}

DEMANDE :
- Occasion : ${occasion || 'promotion generale'}
- Ton souhaite : ${tone || 'professionnel et engageant'}
- Details specifiques : ${details || 'Aucun detail particulier'}

REGLES :
1. Le texte doit faire 150-280 caracteres (adapte ${plateforme || 'Instagram'})
2. Utilise 2-4 emojis pertinents
3. Inclus un call-to-action engageant
4. Propose 5-8 hashtags pertinents

Reponds UNIQUEMENT en JSON valide (pas de markdown) :
{
  "titre": "Titre accrocheur court (optionnel, max 50 car)",
  "contenu": "Texte du post avec emojis integres",
  "hashtags": ["hashtag1", "hashtag2"],
  "call_to_action": "Phrase finale engageante"
}`;

  try {
    const response = await client.messages.create({
      model: MODEL_DEFAULT,
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].text.trim();
    const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const postJson = JSON.parse(cleanJson);

    // Construire le contenu final
    const contenuFinal = postJson.call_to_action
      ? `${postJson.contenu}\n\n${postJson.call_to_action}`
      : postJson.contenu;

    // Sauvegarder en brouillon — FIX: table social_posts, colonnes platform/content/status
    const { data: savedPost, error } = await supabase
      .from('social_posts')
      .insert({
        tenant_id: tenantId,
        platform: plateforme || 'instagram',
        content: contenuFinal,
        hashtags: postJson.hashtags || [],
        status: 'draft'
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: 'Post genere et sauvegarde en brouillon',
      post: {
        id: savedPost.id,
        platform: savedPost.platform,
        content: savedPost.content,
        hashtags: savedPost.hashtags,
        status: savedPost.status
      },
      preview: {
        texte: savedPost.content,
        hashtags_formatte: savedPost.hashtags?.map(h => `#${h}`).join(' ')
      }
    };
  } catch (parseError) {
    logger.error('[MARKETING HANDLER] Erreur parsing JSON post:', parseError);
    return {
      success: false,
      error: 'Erreur lors de la generation du post. Reessayez.'
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// marketing_lister_posts — Lister les posts sociaux
// FIX: social_posts table, platform/content/status columns
// ═══════════════════════════════════════════════════════════════

async function marketing_lister_posts(toolInput, tenantId, adminId) {
  const { status, platform, limit: postLimit } = toolInput;

  let query = supabase
    .from('social_posts')
    .select('id, platform, content, hashtags, media_url, status, scheduled_at, published_at, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(postLimit || 10);

  if (status) query = query.eq('status', status);
  if (platform) query = query.eq('platform', platform);

  const { data: posts, error } = await query;

  if (error) throw error;

  return {
    success: true,
    posts: posts?.map(p => ({
      id: p.id,
      platform: p.platform,
      extrait: p.content?.substring(0, 80) + (p.content?.length > 80 ? '...' : ''),
      hashtags_count: p.hashtags?.length || 0,
      status: p.status,
      media_url: p.media_url,
      scheduled_at: p.scheduled_at,
      published_at: p.published_at,
      date: p.created_at
    })) || [],
    count: posts?.length || 0
  };
}

// ═══════════════════════════════════════════════════════════════
// marketing_publier_post — Publier un post (mettre a jour le status)
// FIX: social_posts table, status column
// ═══════════════════════════════════════════════════════════════

async function marketing_publier_post(toolInput, tenantId, adminId) {
  const { post_id } = toolInput;

  if (!post_id) {
    return { success: false, error: 'ID du post requis' };
  }

  const { data, error } = await supabase
    .from('social_posts')
    .update({
      status: 'published',
      published_at: new Date().toISOString()
    })
    .eq('id', post_id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) throw error;

  return {
    success: true,
    message: 'Post marque comme publie',
    post: {
      id: data.id,
      platform: data.platform,
      content: data.content,
      status: data.status,
      published_at: data.published_at
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// marketing_campaign — Generer un plan de campagne via Claude Haiku
// ═══════════════════════════════════════════════════════════════

async function marketing_campaign(toolInput, tenantId, adminId) {
  const { objectif, budget, duree, cible } = toolInput;

  const ctx = await getTenantContext(supabase, tenantId);

  const prompt = `Tu es expert en strategie marketing pour ${ctx.businessName} (${ctx.businessType}).

Genere un plan de campagne marketing structure.

CONTEXTE :
- Business : ${ctx.businessName}
- Type : ${ctx.businessType}
- Description : ${ctx.description}
- Services :
${ctx.servicesText}

DEMANDE :
- Objectif : ${objectif || 'augmenter la visibilite et le CA'}
- Budget : ${budget || 'a definir'}
- Duree : ${duree || '1 mois'}
- Cible : ${cible || 'clients existants et prospects'}

Reponds UNIQUEMENT en JSON valide :
{
  "nom_campagne": "Nom accrocheur",
  "objectifs": ["objectif1", "objectif2"],
  "actions": [
    {"action": "description", "canal": "email/sms/instagram/facebook", "timing": "semaine 1", "budget_estime": "X EUR"}
  ],
  "budget_total": "X EUR",
  "timeline": "Description du calendrier",
  "kpi": ["indicateur1", "indicateur2"],
  "recommandations": ["conseil1", "conseil2"]
}`;

  try {
    const result = await generateContent(prompt, 1500);

    return {
      success: true,
      message: 'Plan de campagne genere',
      campagne: result
    };
  } catch (error) {
    logger.error('[MARKETING HANDLER] Erreur generation campagne:', error);
    return { success: false, error: 'Erreur lors de la generation du plan de campagne.' };
  }
}

// ═══════════════════════════════════════════════════════════════
// marketing_promo — Generer une offre promotionnelle
// ═══════════════════════════════════════════════════════════════

async function marketing_promo(toolInput, tenantId, adminId) {
  const { type_promo, reduction, service, date_debut, date_fin, conditions } = toolInput;

  const ctx = await getTenantContext(supabase, tenantId);

  const prompt = `Tu es expert en promotions commerciales pour ${ctx.businessName} (${ctx.businessType}).

Genere une offre promotionnelle complete et attractive.

CONTEXTE :
- Business : ${ctx.businessName}
- Services :
${ctx.servicesText}

DEMANDE :
- Type de promo : ${type_promo || 'reduction'}
- Reduction : ${reduction || '10%'}
- Service concerne : ${service || 'tous les services'}
- Date debut : ${date_debut || "aujourd'hui"}
- Date fin : ${date_fin || 'dans 2 semaines'}
- Conditions : ${conditions || 'aucune condition particuliere'}

Reponds UNIQUEMENT en JSON valide :
{
  "nom_offre": "Nom commercial attractif",
  "code_promo": "CODE_PROMO (6-8 caracteres majuscules)",
  "description": "Description marketing courte",
  "conditions": ["condition1", "condition2"],
  "date_debut": "YYYY-MM-DD",
  "date_fin": "YYYY-MM-DD",
  "message_client": "Message a envoyer aux clients",
  "post_social": "Texte pour les reseaux sociaux (150 car max)"
}`;

  try {
    const result = await generateContent(prompt, 1000);

    return {
      success: true,
      message: 'Offre promotionnelle generee',
      promo: result
    };
  } catch (error) {
    logger.error('[MARKETING HANDLER] Erreur generation promo:', error);
    return { success: false, error: 'Erreur lors de la generation de la promo.' };
  }
}

// ═══════════════════════════════════════════════════════════════
// marketing_email — Generer un email marketing
// ═══════════════════════════════════════════════════════════════

async function marketing_email(toolInput, tenantId, adminId) {
  const { objectif, cible, ton, details } = toolInput;

  const ctx = await getTenantContext(supabase, tenantId);

  const prompt = `Tu es expert en email marketing pour ${ctx.businessName} (${ctx.businessType}).

Genere un email marketing professionnel et efficace.

CONTEXTE :
- Business : ${ctx.businessName}
- Type : ${ctx.businessType}
- Services :
${ctx.servicesText}

DEMANDE :
- Objectif : ${objectif || 'fidélisation client'}
- Cible : ${cible || 'clients existants'}
- Ton : ${ton || 'professionnel et chaleureux'}
- Details : ${details || 'email general'}

REGLES :
1. Objet accrocheur (max 60 caracteres, avec emoji si pertinent)
2. Corps clair et structure (150-250 mots)
3. Call-to-action visible et engageant
4. Personnalisation avec [PRENOM]

Reponds UNIQUEMENT en JSON valide :
{
  "objet": "Objet de l'email",
  "preheader": "Texte de pre-visualisation (max 90 car)",
  "corps": "Corps de l'email en texte structure",
  "cta": {
    "texte": "Texte du bouton",
    "url_suggestion": "/reservation ou /promo"
  },
  "variantes_objet": ["variante1", "variante2"]
}`;

  try {
    const result = await generateContent(prompt, 1200);

    return {
      success: true,
      message: 'Email marketing genere',
      email: result
    };
  } catch (error) {
    logger.error('[MARKETING HANDLER] Erreur generation email:', error);
    return { success: false, error: 'Erreur lors de la generation de l\'email.' };
  }
}

// ═══════════════════════════════════════════════════════════════
// marketing_sms — Generer un SMS marketing (max 160 caracteres)
// ═══════════════════════════════════════════════════════════════

async function marketing_sms(toolInput, tenantId, adminId) {
  const { objectif, offre, details } = toolInput;

  const ctx = await getTenantContext(supabase, tenantId);

  const prompt = `Tu es expert en SMS marketing pour ${ctx.businessName} (${ctx.businessType}).

Genere un SMS marketing impactant.

CONTEXTE :
- Business : ${ctx.businessName}
- Services :
${ctx.servicesText}

DEMANDE :
- Objectif : ${objectif || 'promotion'}
- Offre : ${offre || 'a definir'}
- Details : ${details || 'SMS general'}

REGLES STRICTES :
1. MAXIMUM 160 caracteres (obligatoire, c'est la limite SMS)
2. Message direct et accrocheur
3. Inclure le nom du business
4. Call-to-action clair (numero, lien court)
5. Mention STOP en fin de message

Reponds UNIQUEMENT en JSON valide :
{
  "message": "Le SMS complet (max 160 car)",
  "nb_caracteres": 0,
  "variantes": ["variante1 (max 160 car)", "variante2 (max 160 car)"]
}`;

  try {
    const result = await generateContent(prompt, 600);

    // Verifier la longueur du SMS
    const smsLength = result.message?.length || 0;
    const warning = smsLength > 160
      ? `Attention: le SMS fait ${smsLength} caracteres (max 160). Il sera envoye en ${Math.ceil(smsLength / 160)} parties.`
      : null;

    return {
      success: true,
      message: 'SMS marketing genere',
      sms: {
        ...result,
        nb_caracteres: smsLength,
        conforme_160: smsLength <= 160
      },
      ...(warning && { warning })
    };
  } catch (error) {
    logger.error('[MARKETING HANDLER] Erreur generation SMS:', error);
    return { success: false, error: 'Erreur lors de la generation du SMS.' };
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

export const marketingHandlers = {
  marketing_generer_post,
  generer_post_marketing: marketing_generer_post,
  generate_social_post: marketing_generer_post,
  marketing_lister_posts,
  lister_posts_marketing: marketing_lister_posts,
  marketing_publier_post,
  marketing_campaign,
  marketing_promo,
  marketing_email,
  marketing_sms
};
