/**
 * Service Facebook/Instagram OAuth + Publication
 * Graph API v21.0
 */

const FB_APP_ID = process.env.FACEBOOK_APP_ID;
const FB_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const REDIRECT_URI = process.env.FACEBOOK_REDIRECT_URI || 'https://nexus-backend-dev.onrender.com/api/social/auth/facebook/callback';
const GRAPH_VERSION = 'v21.0';

/**
 * Obtenir URL OAuth Facebook avec state (tenantId encodé)
 */
export function getAuthUrl(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!FB_APP_ID) throw new Error('FACEBOOK_APP_ID non configuré');

  const scopes = [
    'email',
    'public_profile',
  ].join(',');

  const state = Buffer.from(JSON.stringify({ tenantId })).toString('base64url');

  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scopes}&response_type=code&state=${state}`;
}

/**
 * Décoder le state OAuth pour récupérer le tenantId
 */
export function decodeState(state) {
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Échanger code contre access token
 */
export async function exchangeCodeForToken(code) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code=${code}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.access_token;
}

/**
 * Obtenir long-lived token (60 jours)
 */
export async function getLongLivedToken(shortToken) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${shortToken}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return {
    access_token: data.access_token,
    expires_in: data.expires_in, // secondes (environ 5184000 = 60j)
  };
}

/**
 * Lister les pages Facebook de l'utilisateur + comptes IG liés
 */
export async function getPages(accessToken) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${accessToken}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return (data.data || []).map(page => ({
    pageId: page.id,
    pageName: page.name,
    pageAccessToken: page.access_token,
    igAccount: page.instagram_business_account ? {
      id: page.instagram_business_account.id,
      username: page.instagram_business_account.username,
      profilePic: page.instagram_business_account.profile_picture_url,
    } : null,
  }));
}

/**
 * Obtenir l'ID du compte Instagram Business lié à une page
 */
export async function getInstagramAccountId(pageId, accessToken) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${accessToken}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return data.instagram_business_account || null;
}

/**
 * Publier sur page Facebook
 */
export async function publishToFacebook(pageId, accessToken, options) {
  const { message, imageUrl } = options;

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/photos`;

  const body = {
    message,
    url: imageUrl,
    access_token: accessToken
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  return {
    success: true,
    postId: data.id,
    platform: 'facebook'
  };
}

/**
 * Publier sur Instagram Business
 */
export async function publishToInstagram(igAccountId, accessToken, options) {
  const { caption, imageUrl } = options;

  // Étape 1: Créer container
  const createUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${igAccountId}/media`;

  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: accessToken
    })
  });

  const createData = await createResponse.json();

  if (createData.error) {
    throw new Error(createData.error.message);
  }

  const containerId = createData.id;

  // Étape 2: Publier
  const publishUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${igAccountId}/media_publish`;

  const publishResponse = await fetch(publishUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: containerId,
      access_token: accessToken
    })
  });

  const publishData = await publishResponse.json();

  if (publishData.error) {
    throw new Error(publishData.error.message);
  }

  return {
    success: true,
    postId: publishData.id,
    platform: 'instagram'
  };
}
