/**
 * Service SSO — SAML/OIDC pour tenants enterprise
 * Sprint 4.1 — SSO
 *
 * Architecture:
 * - OIDC: flow authorization code (redirect → callback → token exchange → userinfo)
 * - SAML: SP-initiated SSO (redirect → IdP → callback with assertion)
 * - Auto-provisioning: creation automatique des comptes admin si domain match
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

/**
 * Recupere la config SSO d'un tenant
 */
export async function getSSOConfig(tenantId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error } = await supabase
    .from('sso_providers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('enabled', true);

  if (error) {
    logger.error('Erreur get SSO config', { error: error.message, tenantId });
    return [];
  }

  // Ne jamais exposer les secrets
  return (data || []).map(p => ({
    id: p.id,
    provider_type: p.provider_type,
    name: p.name,
    enabled: p.enabled,
    domain_restriction: p.domain_restriction,
    auto_provision: p.auto_provision,
    default_role: p.default_role,
    // SAML
    saml_entity_id: p.saml_entity_id,
    saml_sso_url: p.saml_sso_url,
    saml_metadata_url: p.saml_metadata_url,
    // OIDC (pas de secret)
    oidc_issuer: p.oidc_issuer,
    oidc_client_id: p.oidc_client_id,
    oidc_discovery_url: p.oidc_discovery_url,
    oidc_scopes: p.oidc_scopes,
  }));
}

/**
 * Configure un provider SSO pour un tenant
 */
export async function configureSSOProvider(tenantId, config) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!config.provider_type || !['saml', 'oidc'].includes(config.provider_type)) {
    throw new Error('provider_type doit être saml ou oidc');
  }

  const data = {
    tenant_id: tenantId,
    provider_type: config.provider_type,
    name: config.name || (config.provider_type === 'saml' ? 'SAML SSO' : 'OIDC SSO'),
    enabled: config.enabled !== false,
    domain_restriction: config.domain_restriction || null,
    auto_provision: config.auto_provision !== false,
    default_role: config.default_role || 'viewer',
  };

  if (config.provider_type === 'saml') {
    data.saml_entity_id = config.saml_entity_id;
    data.saml_sso_url = config.saml_sso_url;
    data.saml_certificate = config.saml_certificate;
    data.saml_metadata_url = config.saml_metadata_url;
  } else {
    data.oidc_issuer = config.oidc_issuer;
    data.oidc_client_id = config.oidc_client_id;
    data.oidc_client_secret = config.oidc_client_secret; // TODO: chiffrer en DB
    data.oidc_discovery_url = config.oidc_discovery_url;
    data.oidc_scopes = config.oidc_scopes || 'openid email profile';
  }

  // Upsert: un seul provider par type par tenant
  const { data: existing } = await supabase
    .from('sso_providers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider_type', config.provider_type)
    .single();

  let result;
  if (existing) {
    const { data: updated, error } = await supabase
      .from('sso_providers')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    result = updated;
  } else {
    const { data: created, error } = await supabase
      .from('sso_providers')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    result = created;
  }

  logger.info('SSO provider configure', {
    tenantId,
    type: config.provider_type,
    name: data.name
  });

  return result;
}

/**
 * Desactive un provider SSO
 */
export async function disableSSOProvider(tenantId, providerId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { error } = await supabase
    .from('sso_providers')
    .update({ enabled: false, updated_at: new Date().toISOString() })
    .eq('id', providerId)
    .eq('tenant_id', tenantId);

  if (error) throw error;
  return { success: true };
}

/**
 * Supprime un provider SSO
 */
export async function deleteSSOProvider(tenantId, providerId) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { error } = await supabase
    .from('sso_providers')
    .delete()
    .eq('id', providerId)
    .eq('tenant_id', tenantId);

  if (error) throw error;
  return { success: true };
}

/**
 * Genere l'URL d'initiation SSO OIDC (authorization code flow)
 */
export async function initiateOIDCLogin(tenantId, providerId, callbackUrl) {
  const { data: provider, error } = await supabase
    .from('sso_providers')
    .select('*')
    .eq('id', providerId)
    .eq('tenant_id', tenantId)
    .eq('provider_type', 'oidc')
    .eq('enabled', true)
    .single();

  if (error || !provider) {
    throw new Error('Provider OIDC non trouvé ou désactivé');
  }

  // State anti-CSRF
  const state = crypto.randomBytes(32).toString('hex');

  // Nonce pour id_token
  const nonce = crypto.randomBytes(32).toString('hex');

  // Decouvrir les endpoints via OIDC discovery
  let authEndpoint = provider.oidc_issuer + '/authorize';
  try {
    const discoveryUrl = provider.oidc_discovery_url || (provider.oidc_issuer + '/.well-known/openid-configuration');
    const discoveryResp = await fetch(discoveryUrl);
    if (discoveryResp.ok) {
      const config = await discoveryResp.json();
      authEndpoint = config.authorization_endpoint || authEndpoint;
    }
  } catch (e) {
    logger.warn('OIDC discovery failed, using fallback', { error: e.message });
  }

  // Construire l'URL d'autorisation
  const authUrl = new URL(authEndpoint);
  authUrl.searchParams.set('client_id', provider.oidc_client_id);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('scope', provider.oidc_scopes || 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('prompt', 'select_account');

  return {
    authorization_url: authUrl.toString(),
    state,
    nonce,
    provider_id: provider.id
  };
}

/**
 * Echange le code OIDC contre un token et retourne les infos user
 */
export async function handleOIDCCallback(tenantId, providerId, code, callbackUrl) {
  const { data: provider, error } = await supabase
    .from('sso_providers')
    .select('*')
    .eq('id', providerId)
    .eq('tenant_id', tenantId)
    .eq('provider_type', 'oidc')
    .single();

  if (error || !provider) {
    throw new Error('Provider OIDC non trouvé');
  }

  // Decouvrir les endpoints via OIDC discovery
  let tokenUrl = provider.oidc_issuer + '/token';
  let userinfoEndpoint = provider.oidc_issuer + '/userinfo';
  try {
    const discoveryUrl = provider.oidc_discovery_url || (provider.oidc_issuer + '/.well-known/openid-configuration');
    const discoveryResp = await fetch(discoveryUrl);
    if (discoveryResp.ok) {
      const config = await discoveryResp.json();
      tokenUrl = config.token_endpoint || tokenUrl;
      userinfoEndpoint = config.userinfo_endpoint || userinfoEndpoint;
    }
  } catch (e) {
    logger.warn('OIDC discovery failed in callback', { error: e.message });
  }

  // Token exchange
  logger.info('OIDC token exchange', { tokenUrl, callbackUrl, client_id: provider.oidc_client_id, code: code?.substring(0, 10) + '...' });
  const tokenResp = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
      client_id: provider.oidc_client_id,
      client_secret: provider.oidc_client_secret,
    })
  });

  if (!tokenResp.ok) {
    const err = await tokenResp.text();
    logger.error('OIDC token exchange failed', { error: err, tenantId });
    throw new Error('Échec de l\'authentification SSO');
  }

  const tokens = await tokenResp.json();
  logger.info('OIDC tokens received', { has_access_token: !!tokens.access_token, has_id_token: !!tokens.id_token });

  // Userinfo
  const userinfoResp = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });

  if (!userinfoResp.ok) {
    const uiErr = await userinfoResp.text();
    logger.error('OIDC userinfo failed', { status: userinfoResp.status, error: uiErr });
    throw new Error('Impossible de récupérer les informations utilisateur');
  }

  const userInfo = await userinfoResp.json();

  // Verifier domain restriction
  if (provider.domain_restriction) {
    const emailDomain = '@' + (userInfo.email || '').split('@')[1];
    if (emailDomain !== provider.domain_restriction) {
      throw new Error(`Seuls les emails ${provider.domain_restriction} sont autorisés`);
    }
  }

  return {
    email: userInfo.email,
    name: userInfo.name || userInfo.preferred_username,
    given_name: userInfo.given_name,
    family_name: userInfo.family_name,
    picture: userInfo.picture,
    provider_type: 'oidc',
    provider_id: provider.id,
    auto_provision: provider.auto_provision,
    default_role: provider.default_role,
  };
}

/**
 * Provisionne ou retrouve un admin user via SSO
 */
export async function findOrCreateSSOUser(tenantId, ssoUserInfo) {
  if (!tenantId) throw new Error('tenant_id requis');

  const email = ssoUserInfo.email?.toLowerCase();
  if (!email) throw new Error('Email requis depuis le provider SSO');

  // Chercher un admin existant avec cet email
  const { data: existingAdmin } = await supabase
    .from('admin_users')
    .select('id, email, nom, role, tenant_id')
    .eq('email', email)
    .eq('tenant_id', tenantId)
    .single();

  if (existingAdmin) {
    return existingAdmin;
  }

  // Auto-provisioning si active
  if (!ssoUserInfo.auto_provision) {
    throw new Error('Compte non trouvé et auto-provisioning désactivé');
  }

  const fullName = ssoUserInfo.name ||
    [ssoUserInfo.given_name, ssoUserInfo.family_name].filter(Boolean).join(' ') ||
    email.split('@')[0];

  // Creer le compte admin (pas de mot de passe — auth SSO uniquement)
  const { data: newAdmin, error: createError } = await supabase
    .from('admin_users')
    .insert({
      tenant_id: tenantId,
      email,
      nom: fullName,
      password_hash: 'SSO_ONLY', // Pas de mot de passe local
      role: ssoUserInfo.default_role || 'viewer',
      actif: true,
    })
    .select('id, email, nom, role, tenant_id')
    .single();

  if (createError) {
    logger.error('Erreur creation admin SSO', { error: createError.message, tenantId, email });
    throw createError;
  }

  logger.info('Admin SSO auto-provisionne', { tenantId, email, role: newAdmin.role });
  return newAdmin;
}
