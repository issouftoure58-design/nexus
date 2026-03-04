/**
 * Routes Admin Notifications — NEXUS
 * Inbox de notifications in-app.
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// GET / — Liste les notifications (paginées)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = parseInt(req.query.offset) || 0;
    const unreadOnly = req.query.unread === 'true';

    let query = supabase
      .from('notifications_inbox')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .or(`admin_id.eq.${adminId},admin_id.is.null`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (unreadOnly) {
      query = query.is('read_at', null);
    }

    const { data, count, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    // Compter les non-lues
    const { count: unreadCount } = await supabase
      .from('notifications_inbox')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .or(`admin_id.eq.${adminId},admin_id.is.null`)
      .is('read_at', null);

    res.json({
      notifications: data || [],
      total: count || 0,
      unread_count: unreadCount || 0,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /:id/read — Marquer une notification comme lue
router.patch('/:id/read', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;

    const { data, error } = await supabase
      .from('notifications_inbox')
      .update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId)
      .or(`admin_id.eq.${adminId},admin_id.is.null`)
      .is('read_at', null)
      .select('id')
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Notification non trouvée' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /read-all — Marquer toutes comme lues
router.patch('/read-all', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;

    await supabase
      .from('notifications_inbox')
      .update({ read_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .or(`admin_id.eq.${adminId},admin_id.is.null`)
      .is('read_at', null);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
