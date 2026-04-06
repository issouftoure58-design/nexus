/**
 * Push Notification Service — NEXUS
 * Envoie des notifications Web Push aux admins abonnés.
 * Utilise la librairie web-push avec VAPID.
 */

import webpush from 'web-push';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';

// Configuration VAPID
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@nexus-ai-saas.com';

let pushEnabled = false;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  pushEnabled = true;
  logger.info('[Push] Web Push configuré avec VAPID');
} else {
  logger.warn('[Push] VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY manquant — push désactivé');
}

/**
 * Envoie un push à un admin spécifique (toutes ses subscriptions)
 */
export async function sendPushToUser(tenantId, userId, { title, body, link, icon }) {
  if (!pushEnabled) return;
  if (!tenantId || !userId) return;

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, keys')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId);

  if (error || !subscriptions?.length) return;

  const payload = JSON.stringify({
    title,
    body,
    icon,
    data: { link },
  });

  const expiredIds = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expirée — marquer pour suppression
          expiredIds.push(sub.id);
        } else {
          logger.error('[Push] Erreur envoi:', { endpoint: sub.endpoint, status: err.statusCode, message: err.message });
        }
      }
    })
  );

  // Nettoyer les subscriptions expirées
  if (expiredIds.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', expiredIds);

    logger.info(`[Push] ${expiredIds.length} subscription(s) expirée(s) supprimée(s)`);
  }
}

/**
 * Envoie un push à tous les admins d'un tenant
 */
export async function sendPushToAllAdmins(tenantId, { title, body, link, icon }) {
  if (!pushEnabled) return;
  if (!tenantId) return;

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, keys')
    .eq('tenant_id', tenantId);

  if (error || !subscriptions?.length) return;

  const payload = JSON.stringify({
    title,
    body,
    icon,
    data: { link },
  });

  const expiredIds = [];

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredIds.push(sub.id);
        } else {
          logger.error('[Push] Erreur envoi:', { endpoint: sub.endpoint, status: err.statusCode, message: err.message });
        }
      }
    })
  );

  if (expiredIds.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('tenant_id', tenantId)
      .in('id', expiredIds);

    logger.info(`[Push] ${expiredIds.length} subscription(s) expirée(s) supprimée(s)`);
  }
}

/**
 * Retourne la clé publique VAPID (pour le frontend)
 */
export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY || null;
}

export default { sendPushToUser, sendPushToAllAdmins, getVapidPublicKey };
