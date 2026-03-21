/**
 * Video Handler — script_video_viral
 * Génère des scripts de vidéos virales pour TikTok, Reels, YouTube Shorts
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';
import { generateContent, getTenantContext } from './shared/claudeHelper.js';

async function script_video_viral(toolInput, tenantId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  const { plateforme, service_produit, style, duree_secondes } = toolInput;
  const platform = plateforme || 'tiktok';
  const duration = duree_secondes || 30;

  try {
    const ctx = await getTenantContext(supabase, tenantId);

    const prompt = `Tu es un expert viral marketing spécialisé dans les scripts TikTok/Reels/Shorts.

Entreprise: ${ctx.businessName}
Type: ${ctx.businessType}
${ctx.description ? `Description: ${ctx.description}` : ''}
Service/Produit à promouvoir: ${service_produit || 'l\'activité principale'}
Plateforme: ${platform}
Durée: ${duration}s
Style: ${style || 'viral'}

Services disponibles:
${ctx.servicesText || 'Non renseignés'}

Génère un script vidéo viral. IMPÉRATIF:
- Le HOOK (3 premières secondes) est CRITIQUE — il doit stopper le scroll
- Le storytelling doit être progressif et captivant
- Le CTA doit être clair et créer de l'urgence
- Propose 3 variantes d'angle (humour, émotion, choc)

Réponds UNIQUEMENT en JSON valide:
{
  "titre": "Titre du concept créatif",
  "hook_3s": "Phrase d'accroche des 3 premières secondes — CRITIQUE",
  "script_complet": "Script séquencé avec timecodes: [0-3s] Hook... [3-15s] Développement... [15-${duration}s] CTA...",
  "cta": "Call-to-action final",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "props_visuels": ["Description prop/décor 1", "Description prop/décor 2"],
  "musique_mood": "Genre ou mood musical suggéré",
  "variantes": [
    { "angle": "humour", "hook": "Accroche version humour", "twist": "Ce qui rend cette version drôle" },
    { "angle": "emotion", "hook": "Accroche version émotion", "twist": "Ce qui touche le spectateur" },
    { "angle": "choc", "hook": "Accroche version choc/surprise", "twist": "L'élément de surprise" }
  ],
  "conseils_tournage": ["Conseil 1", "Conseil 2", "Conseil 3"]
}`;

    const script = await generateContent(prompt, 2000);

    return {
      success: true,
      message: `Script vidéo viral généré pour ${platform} (${duration}s)`,
      script,
      plateforme: platform,
      duree: duration
    };
  } catch (error) {
    logger.error('[VIDEO HANDLER] Erreur script_video_viral:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

export const videoHandlers = {
  script_video_viral,
  generer_script_viral: script_video_viral,
  video_script_tiktok: script_video_viral,
};
