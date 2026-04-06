/**
 * Routes Admin Push Subscriptions — NEXUS
 * Gestion des abonnements Web Push pour les notifications navigateur.
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { getVapidPublicKey } from '../services/pushNotificationService.js';
import logger from '../config/logger.js';

const router = express.Router();

// GET /vapid-key — Retourne la clé publique VAPID
router.get('/vapid-key', authenticateAdmin, (req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    return res.status(503).json({ error: 'Push notifications non configurées' });
  }
  res.json({ vapidPublicKey: key });
});

// POST / — Sauvegarder une subscription push (upsert sur endpoint)
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const userId = req.admin.id;
    const { endpoint, keys } = req.body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'endpoint et keys (p256dh, auth) requis' });
    }

    // Upsert: si l'endpoint existe déjà pour ce tenant, mettre à jour
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('endpoint', endpoint)
      .single();

    if (existing) {
      await supabase
        .from('push_subscriptions')
        .update({ keys, user_id: userId })
        .eq('tenant_id', tenantId)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('push_subscriptions')
        .insert({
          tenant_id: tenantId,
          user_id: userId,
          endpoint,
          keys,
        });
    }

    logger.info(`[Push] Subscription enregistrée pour admin ${userId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('[Push] Erreur subscription:', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE / — Supprimer une subscription push
router.delete('/', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const endpoint = req.query.endpoint || req.body?.endpoint;

    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint requis (query ou body)' });
    }

    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('endpoint', endpoint);

    logger.info(`[Push] Subscription supprimée pour tenant ${tenantId}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('[Push] Erreur unsubscribe:', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /status — Vérifie si l'admin a des subscriptions actives
router.get('/status', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const userId = req.admin.id;

    const { count } = await supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId);

    res.json({ subscribed: (count || 0) > 0, count: count || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
