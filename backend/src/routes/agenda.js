/**
 * Routes Agenda - Gestion des RDV business de l'entrepreneur
 * CRUD pour les événements personnels (meetings, appels, tâches, rappels)
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// ============================================
// GET /api/agenda/events - Liste des événements
// ============================================
router.get('/events', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const { start, end } = req.query;

    let query = supabase
      .from('agenda_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('admin_id', adminId)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });

    if (start) {
      query = query.gte('date', start);
    }
    if (end) {
      query = query.lte('date', end);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('[AGENDA] Get events error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET /api/agenda/events/:id - Détail d'un événement
// ============================================
router.get('/events/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('agenda_events')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('admin_id', adminId)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: 'Événement non trouvé' });
    }

    res.json({ success: true, data });

  } catch (error) {
    console.error('[AGENDA] Get event error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// POST /api/agenda/events - Créer un événement
// ============================================
router.post('/events', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const {
      title,
      description,
      date,
      start_time,
      end_time,
      type,
      location,
      attendees
    } = req.body;

    if (!title || !date) {
      return res.status(400).json({
        success: false,
        error: 'Titre et date requis'
      });
    }

    const { data, error } = await supabase
      .from('agenda_events')
      .insert({
        tenant_id: tenantId,
        admin_id: adminId,
        title,
        description,
        date,
        start_time: start_time || '09:00',
        end_time,
        type: type || 'meeting',
        location,
        attendees,
        completed: false
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Événement créé'
    });

  } catch (error) {
    console.error('[AGENDA] Create event error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PUT /api/agenda/events/:id - Modifier un événement
// ============================================
router.put('/events/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const { id } = req.params;
    const {
      title,
      description,
      date,
      start_time,
      end_time,
      type,
      location,
      attendees,
      completed
    } = req.body;

    // Vérifier que l'événement existe et appartient à l'admin
    const { data: existing } = await supabase
      .from('agenda_events')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('admin_id', adminId)
      .single();

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Événement non trouvé' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) updateData.date = date;
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (type !== undefined) updateData.type = type;
    if (location !== undefined) updateData.location = location;
    if (attendees !== undefined) updateData.attendees = attendees;
    if (completed !== undefined) updateData.completed = completed;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('agenda_events')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: 'Événement modifié'
    });

  } catch (error) {
    console.error('[AGENDA] Update event error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DELETE /api/agenda/events/:id - Supprimer un événement
// ============================================
router.delete('/events/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('agenda_events')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('admin_id', adminId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Événement supprimé'
    });

  } catch (error) {
    console.error('[AGENDA] Delete event error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PATCH /api/agenda/events/:id/complete - Marquer comme terminé
// ============================================
router.patch('/events/:id/complete', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const { id } = req.params;
    const { completed } = req.body;

    const { data, error } = await supabase
      .from('agenda_events')
      .update({
        completed: completed !== undefined ? completed : true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('admin_id', adminId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: completed ? 'Marqué comme terminé' : 'Marqué comme non terminé'
    });

  } catch (error) {
    console.error('[AGENDA] Complete event error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET /api/agenda/today - Événements du jour
// ============================================
router.get('/today', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('agenda_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('admin_id', adminId)
      .eq('date', today)
      .order('start_time', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      date: today
    });

  } catch (error) {
    console.error('[AGENDA] Get today error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET /api/agenda/upcoming - Prochains événements
// ============================================
router.get('/upcoming', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const adminId = req.admin.id;
    const today = new Date().toISOString().split('T')[0];
    const limit = parseInt(req.query.limit) || 10;

    const { data, error } = await supabase
      .from('agenda_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('admin_id', adminId)
      .gte('date', today)
      .eq('completed', false)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(limit);

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('[AGENDA] Get upcoming error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
