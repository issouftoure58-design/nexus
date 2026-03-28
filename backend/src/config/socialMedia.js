// Configuration des APIs réseaux sociaux

export const socialMediaConfig = {
  meta: {
    // Facebook & Instagram utilisent la même API Meta
    appId: process.env.META_APP_ID,
    appSecret: process.env.META_APP_SECRET,
    accessToken: process.env.META_ACCESS_TOKEN, // Long-lived token
    instagramAccountId: process.env.INSTAGRAM_ACCOUNT_ID,
    facebookPageId: process.env.FACEBOOK_PAGE_ID,
  },
  tiktok: {
    clientKey: process.env.TIKTOK_CLIENT_KEY,
    clientSecret: process.env.TIKTOK_CLIENT_SECRET,
    accessToken: process.env.TIKTOK_ACCESS_TOKEN,
  },
  twitter: {
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    bearerToken: process.env.TWITTER_BEARER_TOKEN,
  },
  linkedin: {
    clientId: process.env.LINKEDIN_CLIENT_ID,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
    accessToken: process.env.LINKEDIN_ACCESS_TOKEN,
    organizationId: process.env.LINKEDIN_ORGANIZATION_ID,
  }
};

// Vérifier si une plateforme est configurée
export function isPlatformConfigured(platform) {
  switch (platform) {
    case 'instagram':
      return !!(socialMediaConfig.meta.accessToken && socialMediaConfig.meta.instagramAccountId);
    case 'facebook':
      return !!(socialMediaConfig.meta.accessToken && socialMediaConfig.meta.facebookPageId);
    case 'tiktok':
      return !!(socialMediaConfig.tiktok.accessToken);
    case 'twitter':
    case 'x':
      return !!(socialMediaConfig.twitter.accessToken && socialMediaConfig.twitter.accessTokenSecret);
    case 'linkedin':
      return !!(socialMediaConfig.linkedin.accessToken);
    default:
      return false;
  }
}

// Liste des plateformes disponibles
export function getAvailablePlatforms() {
  const platforms = ['instagram', 'facebook', 'twitter', 'linkedin', 'tiktok'];
  return platforms.filter(p => isPlatformConfigured(p));
}

/**
 * Cherche le token OAuth en DB pour un tenant + plateforme,
 * avec fallback sur les variables d'environnement globales.
 */
export async function getAccountToken(tenantId, platform) {
  if (!tenantId) throw new Error('tenant_id requis');

  try {
    const { supabase } = await import('../config/supabase.js');

    const { data } = await supabase
      .from('social_accounts')
      .select('access_token, page_id, ig_account_id, token_expires_at, account_name')
      .eq('tenant_id', tenantId)
      .eq('platform', platform)
      .eq('is_active', true)
      .order('connected_at', { ascending: false })
      .limit(1)
      .single();

    if (data?.access_token) {
      // Mettre à jour last_used_at
      await supabase
        .from('social_accounts')
        .update({ last_used_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('platform', platform)
        .eq('is_active', true);

      return {
        accessToken: data.access_token,
        pageId: data.page_id,
        igAccountId: data.ig_account_id,
        accountName: data.account_name,
        expiresAt: data.token_expires_at,
        source: 'db',
      };
    }
  } catch {
    // Pas de compte en DB → fallback env vars
  }

  // Fallback : variables d'environnement globales
  if (platform === 'facebook' && socialMediaConfig.meta.accessToken) {
    return {
      accessToken: socialMediaConfig.meta.accessToken,
      pageId: socialMediaConfig.meta.facebookPageId,
      source: 'env',
    };
  }
  if (platform === 'instagram' && socialMediaConfig.meta.accessToken) {
    return {
      accessToken: socialMediaConfig.meta.accessToken,
      igAccountId: socialMediaConfig.meta.instagramAccountId,
      source: 'env',
    };
  }

  return null;
}

// Obtenir les infos de configuration pour l'affichage
export function getPlatformStatus() {
  const platforms = [
    { name: 'instagram', label: 'Instagram', icon: '📸' },
    { name: 'facebook', label: 'Facebook', icon: '👤' },
    { name: 'twitter', label: 'Twitter/X', icon: '🐦' },
    { name: 'linkedin', label: 'LinkedIn', icon: '💼' },
    { name: 'tiktok', label: 'TikTok', icon: '🎵' }
  ];

  return platforms.map(p => ({
    ...p,
    configured: isPlatformConfigured(p.name),
    status: isPlatformConfigured(p.name) ? '✅ Prêt' : '❌ Non configuré'
  }));
}
