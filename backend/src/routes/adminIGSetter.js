/**
 * Routes Admin IG Setter — Dashboard conversations Instagram
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();
router.use(authenticateAdmin);

/**
 * GET /api/admin/ig-setter/conversations
 * Liste les conversations du tenant
 */
router.get('/conversations', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { limit = 50, offset = 0, status } = req.query;

    let query = supabase
      .from('ig_setter_conversations')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      conversations: data || [],
      total: count || 0,
    });
  } catch (error) {
    console.error('[IG SETTER] Erreur liste conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/ig-setter/conversations/:id/messages
 * Messages d'une conversation
 */
router.get('/conversations/:id/messages', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { data, error } = await supabase
      .from('ig_setter_messages')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('conversation_id', req.params.id)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    res.json({ messages: data || [] });
  } catch (error) {
    console.error('[IG SETTER] Erreur messages:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/ig-setter/stats
 * Stats globales setter
 */
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { data, error } = await supabase
      .from('ig_setter_conversations')
      .select('status, score')
      .eq('tenant_id', tenantId);

    if (error) throw error;

    const conversations = data || [];
    const stats = {
      total: conversations.length,
      by_status: {
        new: conversations.filter(c => c.status === 'new').length,
        qualifying: conversations.filter(c => c.status === 'qualifying' || c.status === 'pending_first_contact').length,
        qualified: conversations.filter(c => c.status === 'qualified').length,
        not_qualified: conversations.filter(c => c.status === 'not_qualified').length,
        nurture: conversations.filter(c => c.status === 'nurture').length,
      },
      avg_score: conversations.length > 0
        ? Math.round(conversations.reduce((sum, c) => sum + (c.score || 0), 0) / conversations.length)
        : 0,
      conversion_rate: conversations.length > 0
        ? Math.round((conversations.filter(c => c.status === 'qualified').length / conversations.length) * 100)
        : 0,
    };

    res.json({ success: true, stats });
  } catch (error) {
    console.error('[IG SETTER] Erreur stats:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
