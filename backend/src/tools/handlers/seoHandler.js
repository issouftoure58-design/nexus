/**
 * SEO Handler — seo_analyze, seo_keywords, seo_meta_generate
 * Outils SEO utilisant Claude Haiku pour l'analyse et la generation.
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';
import { generateContent, getTenantContext } from './shared/claudeHelper.js';

async function seo_analyze(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const ctx = await getTenantContext(supabase, tenantId);

    const prompt = `Tu es un expert SEO. Analyse le profil SEO de cette entreprise et donne des recommandations concretes.

Entreprise: ${ctx.businessName}
Type: ${ctx.businessType}
Description: ${ctx.description}
Services:
${ctx.servicesText}

${toolInput.url ? `URL a analyser: ${toolInput.url}` : ''}
${toolInput.focus ? `Focus specifique: ${toolInput.focus}` : ''}

Reponds en JSON avec cette structure:
{
  "score_estime": 0-100,
  "points_forts": ["..."],
  "points_faibles": ["..."],
  "recommandations": [
    { "priorite": "haute|moyenne|basse", "action": "...", "impact_estime": "..." }
  ],
  "mots_cles_suggeres": ["..."]
}`;

    const analysis = await generateContent(prompt, 1500);

    return {
      success: true,
      analyse: analysis,
      entreprise: ctx.businessName
    };
  } catch (error) {
    logger.error('[SEO HANDLER] Erreur seo_analyze:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function seo_keywords(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const ctx = await getTenantContext(supabase, tenantId);

    const service = toolInput.service || ctx.businessType;
    const location = toolInput.location || '';

    const prompt = `Tu es un expert SEO specialise dans le referencement local. Genere des suggestions de mots-cles pour:

Entreprise: ${ctx.businessName}
Type: ${ctx.businessType}
Service cible: ${service}
${location ? `Localisation: ${location}` : ''}

Services proposes:
${ctx.servicesText}

Reponds en JSON avec cette structure:
{
  "mots_cles_principaux": [
    { "mot_cle": "...", "volume_estime": "fort|moyen|faible", "difficulte": "haute|moyenne|basse", "pertinence": 1-10 }
  ],
  "mots_cles_longue_traine": ["..."],
  "mots_cles_locaux": ["..."],
  "questions_frequentes": ["..."]
}`;

    const keywords = await generateContent(prompt, 1500);

    return {
      success: true,
      service,
      location: location || 'non specifiee',
      keywords
    };
  } catch (error) {
    logger.error('[SEO HANDLER] Erreur seo_keywords:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function seo_meta_generate(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const ctx = await getTenantContext(supabase, tenantId);

    if (!toolInput.page) {
      return { success: false, error: 'Parametre "page" requis (ex: accueil, services, contact)' };
    }

    const prompt = `Tu es un expert SEO. Genere des balises meta optimisees pour cette page.

Entreprise: ${ctx.businessName}
Type: ${ctx.businessType}
Page: ${toolInput.page}
${toolInput.description ? `Description de la page: ${toolInput.description}` : ''}
${toolInput.keywords ? `Mots-cles cibles: ${toolInput.keywords}` : ''}

Services:
${ctx.servicesText}

Reponds en JSON avec cette structure:
{
  "meta_title": "... (max 60 caracteres)",
  "meta_description": "... (max 160 caracteres)",
  "og_title": "...",
  "og_description": "...",
  "h1_suggere": "...",
  "schema_type": "LocalBusiness|Service|...",
  "conseils": ["..."]
}`;

    const meta = await generateContent(prompt, 1000);

    return {
      success: true,
      page: toolInput.page,
      meta
    };
  } catch (error) {
    logger.error('[SEO HANDLER] Erreur seo_meta_generate:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

export const seoHandlers = {
  seo_analyze,
  seo_keywords,
  seo_meta_generate
};
