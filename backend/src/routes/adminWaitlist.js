/**
 * Routes admin waitlist — /api/admin/waitlist
 * CRUD liste d'attente, notification, conversion
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import * as waitlistService from '../services/waitlistService.js';

const router = express.Router();

// GET /api/admin/waitlist — Liste avec filtres
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const { status, date, client_id, page, limit } = req.query;
    const result = await waitlistService.getWaitlist(
      req.admin.tenant_id,
      { status, date, client_id: client_id ? parseInt(client_id) : undefined },
      { page: parseInt(page) || 1, limit: parseInt(limit) || 20 }
    );
    res.json(result);
  } catch (error) {
    console.error('[WAITLIST] Erreur list:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/admin/waitlist/stats — Statistiques
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await waitlistService.getStats(req.admin.tenant_id);
    res.json({ stats });
  } catch (error) {
    console.error('[WAITLIST] Erreur stats:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/waitlist — Ajouter à la liste
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const entry = await waitlistService.addToWaitlist(req.admin.tenant_id, req.body);
    res.status(201).json({ success: true, entry });
  } catch (error) {
    console.error('[WAITLIST] Erreur add:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/admin/waitlist/:id — Détail
router.get('/:id', authenticateAdmin, async (req, res) => {
  try {
    const entry = await waitlistService.getEntry(req.admin.tenant_id, parseInt(req.params.id));
    if (!entry) return res.status(404).json({ error: 'Entrée introuvable' });
    res.json({ entry });
  } catch (error) {
    console.error('[WAITLIST] Erreur get:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PATCH /api/admin/waitlist/:id — Modifier
router.patch('/:id', authenticateAdmin, async (req, res) => {
  try {
    const entry = await waitlistService.updateEntry(req.admin.tenant_id, parseInt(req.params.id), req.body);
    res.json({ entry });
  } catch (error) {
    console.error('[WAITLIST] Erreur update:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/admin/waitlist/:id — Supprimer
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    await waitlistService.deleteEntry(req.admin.tenant_id, parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error('[WAITLIST] Erreur delete:', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/waitlist/:id/notify — Notifier manuellement
router.post('/:id/notify', authenticateAdmin, async (req, res) => {
  try {
    const entry = await waitlistService.getEntry(req.admin.tenant_id, parseInt(req.params.id));
    if (!entry) return res.status(404).json({ error: 'Entrée introuvable' });
    if (entry.status !== 'waiting') return res.status(400).json({ error: 'Seules les entrées en attente peuvent être notifiées' });

    const updated = await waitlistService.updateEntry(req.admin.tenant_id, parseInt(req.params.id), {
      status: 'notified'
    });
    res.json({ success: true, entry: updated });
  } catch (error) {
    console.error('[WAITLIST] Erreur notify:', error.message);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/admin/waitlist/:id/convert — Convertir en réservation
router.post('/:id/convert', authenticateAdmin, async (req, res) => {
  try {
    const { reservation_id } = req.body;
    if (!reservation_id) return res.status(400).json({ error: 'reservation_id requis' });

    const entry = await waitlistService.convertToReservation(
      req.admin.tenant_id, parseInt(req.params.id), parseInt(reservation_id)
    );
    res.json({ success: true, entry });
  } catch (error) {
    console.error('[WAITLIST] Erreur convert:', error.message);
    res.status(400).json({ error: error.message });
  }
});

export default router;
