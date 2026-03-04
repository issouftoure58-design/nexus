/**
 * Inbox Service — NEXUS
 * Notifications in-app pour les admins.
 */

import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

/**
 * Crée une notification pour un admin spécifique
 */
export async function createNotification(tenantId, { adminId, type = 'info', title, message, link, icon }) {
  if (!tenantId) {
    logger.error('[Inbox] tenant_id requis');
    return null;
  }

  const { data, error } = await supabase
    .from('notifications_inbox')
    .insert({
      tenant_id: tenantId,
      admin_id: adminId || null,
      type,
      title,
      message,
      link,
      icon,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('[Inbox] Erreur création:', { error: error.message });
    return null;
  }

  return data.id;
}

/**
 * Crée une notification pour tous les admins d'un tenant
 */
export async function notifyAllAdmins(tenantId, { type = 'info', title, message, link, icon }) {
  if (!tenantId) return;

  const { data: admins } = await supabase
    .from('admin_users')
    .select('id')
    .eq('tenant_id', tenantId);

  if (!admins?.length) return;

  const notifications = admins.map(admin => ({
    tenant_id: tenantId,
    admin_id: admin.id,
    type,
    title,
    message,
    link,
    icon,
  }));

  const { error } = await supabase
    .from('notifications_inbox')
    .insert(notifications);

  if (error) {
    logger.error('[Inbox] Erreur bulk:', { error: error.message });
  }
}

export default { createNotification, notifyAllAdmins };
