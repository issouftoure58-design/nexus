/**
 * Session Service — NEXUS
 * Gestion des sessions admin avec tracking et révocation à distance.
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

/**
 * Hash un token JWT pour le stocker en DB (SHA-256, pas réversible)
 */
export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Parse le User-Agent pour un affichage lisible
 */
function parseDevice(userAgent) {
  if (!userAgent) return 'Inconnu';
  if (/iPhone|iPad/.test(userAgent)) return 'iOS';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Mac OS/.test(userAgent)) return 'Mac';
  if (/Windows/.test(userAgent)) return 'Windows';
  if (/Linux/.test(userAgent)) return 'Linux';
  return 'Autre';
}

/**
 * Crée une session en DB après login réussi
 */
export async function createSession({ adminId, tenantId, token, ip, userAgent, expiresAt }) {
  const tokenHash = hashToken(token);
  const deviceInfo = parseDevice(userAgent);

  const { data, error } = await supabase
    .from('admin_sessions')
    .insert({
      admin_id: adminId,
      tenant_id: tenantId,
      token_hash: tokenHash,
      ip_address: ip,
      user_agent: userAgent?.substring(0, 500),
      device_info: deviceInfo,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('[Session] Erreur création session:', { error: error.message });
    return null;
  }

  return data.id;
}

/**
 * Vérifie qu'une session est active (non révoquée, non expirée)
 */
export async function validateSession(token) {
  const tokenHash = hashToken(token);

  const { data } = await supabase
    .from('admin_sessions')
    .select('id, admin_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .single();

  if (!data) return false;
  if (data.revoked_at) return false;
  if (new Date(data.expires_at) < new Date()) return false;

  // Mettre à jour last_active_at (fire-and-forget, max 1 fois par minute via le rate naturel)
  supabase
    .from('admin_sessions')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})
    .catch(() => {});

  return true;
}

/**
 * Liste les sessions actives d'un admin
 */
export async function listSessions(adminId, tenantId) {
  const { data, error } = await supabase
    .from('admin_sessions')
    .select('id, ip_address, user_agent, device_info, last_active_at, created_at, expires_at')
    .eq('admin_id', adminId)
    .eq('tenant_id', tenantId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('last_active_at', { ascending: false });

  if (error) {
    logger.error('[Session] Erreur listing:', { error: error.message });
    return [];
  }

  return data || [];
}

/**
 * Révoque une session spécifique
 */
export async function revokeSession(sessionId, adminId, tenantId) {
  const { data, error } = await supabase
    .from('admin_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('admin_id', adminId)
    .eq('tenant_id', tenantId)
    .select('id')
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}

/**
 * Révoque toutes les sessions sauf la courante
 */
export async function revokeAllSessions(adminId, tenantId, exceptTokenHash) {
  let query = supabase
    .from('admin_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('admin_id', adminId)
    .eq('tenant_id', tenantId)
    .is('revoked_at', null);

  if (exceptTokenHash) {
    query = query.neq('token_hash', exceptTokenHash);
  }

  const { error } = await query;
  return !error;
}

export default { hashToken, createSession, validateSession, listSessions, revokeSession, revokeAllSessions };
