/**
 * Routes Audit Log — NEXUS
 * GET /api/admin/audit-logs — consultation des logs d'audit
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import logger from '../config/logger.js';

const router = express.Router();

// GET /api/admin/audit-logs
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ error: 'tenant_id requis' });
    }

    const {
      action,
      entite,
      admin_id,
      date_from,
      date_to,
      search,
      limit = '50',
      offset = '0',
    } = req.query;

    let query = supabase
      .from('historique_admin')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (action) {
      query = query.eq('action', action);
    }
    if (entite) {
      query = query.eq('entite', entite);
    }
    if (admin_id) {
      query = query.eq('admin_id', admin_id);
    }
    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    if (date_to) {
      query = query.lte('created_at', date_to);
    }
    if (search) {
      query = query.or(`action.ilike.%${search}%,entite.ilike.%${search}%`);
    }

    const parsedLimit = Math.min(parseInt(limit, 10) || 50, 200);
    const parsedOffset = parseInt(offset, 10) || 0;

    query = query.range(parsedOffset, parsedOffset + parsedLimit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({
      logs: data || [],
      total: count || 0,
      limit: parsedLimit,
      offset: parsedOffset,
    });
  } catch (error) {
    logger.error('[AUDIT LOG] Erreur lecture:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des logs' });
  }
});

// GET /api/admin/audit-logs/filters — valeurs distinctes pour les filtres
router.get('/filters', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ error: 'tenant_id requis' });
    }

    // Récupérer les actions et entités distinctes
    const { data: logs } = await supabase
      .from('historique_admin')
      .select('action, entite')
      .eq('tenant_id', tenantId)
      .limit(1000);

    const actions = [...new Set((logs || []).map(l => l.action).filter(Boolean))].sort();
    const entites = [...new Set((logs || []).map(l => l.entite).filter(Boolean))].sort();

    res.json({ actions, entites });
  } catch (error) {
    logger.error('[AUDIT LOG] Erreur filters:', error);
    res.status(500).json({ error: 'Erreur' });
  }
});

export default router;
