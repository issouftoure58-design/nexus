/**
 * Employee Session Service — NEXUS
 * Gestion des sessions employe (portail employe).
 * Pattern identique a sessionService.js mais sur employee_sessions.
 */

import { supabase } from '../config/supabase.js';
import { hashToken } from './sessionService.js';
import logger from '../config/logger.js';

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
 * Cree une session employe en DB apres login reussi
 */
export async function createEmployeeSession({ employeeId, tenantId, token, ip, userAgent, expiresAt }) {
  const tokenHash = hashToken(token);
  const deviceInfo = parseDevice(userAgent);

  const { data, error } = await supabase
    .from('employee_sessions')
    .insert({
      employee_id: employeeId,
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
    logger.error('[EmployeeSession] Erreur creation session:', { error: error.message });
    return null;
  }

  return data.id;
}

/**
 * Verifie qu'une session employe est active (non revoquee, non expiree)
 */
export async function validateEmployeeSession(token) {
  const tokenHash = hashToken(token);

  const { data } = await supabase
    .from('employee_sessions')
    .select('id, employee_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .single();

  if (!data) return false;
  if (data.revoked_at) return false;
  if (new Date(data.expires_at) < new Date()) return false;

  // Mettre a jour last_active_at (fire-and-forget)
  supabase
    .from('employee_sessions')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})
    .catch(() => {});

  return true;
}

/**
 * Revoque une session employe specifique
 */
export async function revokeEmployeeSession(token) {
  const tokenHash = hashToken(token);

  const { error } = await supabase
    .from('employee_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('token_hash', tokenHash)
    .is('revoked_at', null);

  return !error;
}

/**
 * Revoque toutes les sessions d'un employe
 */
export async function revokeAllEmployeeSessions(employeeId, tenantId) {
  const { error } = await supabase
    .from('employee_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('employee_id', employeeId)
    .eq('tenant_id', tenantId)
    .is('revoked_at', null);

  return !error;
}

export default { createEmployeeSession, validateEmployeeSession, revokeEmployeeSession, revokeAllEmployeeSessions };
