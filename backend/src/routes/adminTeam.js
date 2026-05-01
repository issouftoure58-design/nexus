/**
 * Routes Gestion d'Equipe — NEXUS
 * CRUD membres du tenant (liste, modifier role/permissions, desactiver)
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { revokeAllSessions } from '../services/sessionService.js';
import logger from '../config/logger.js';

const router = express.Router();

const VALID_ROLES = ['admin', 'manager', 'viewer', 'comptable'];

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/admin/team — Liste des membres actifs du tenant
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'tenant_id requis' });

    // Seul admin peut voir l'equipe
    if (req.admin.role !== 'admin' && req.admin.role !== 'super_admin') {
      return res.status(403).json({ error: 'Seul un admin peut gerer l\'equipe' });
    }

    let data;
    let error;

    ({ data, error } = await supabase
      .from('admin_users')
      .select('id, email, nom, role, custom_permissions, actif, created_at')
      .eq('tenant_id', tenantId)
      .eq('actif', true)
      .neq('id', req.admin.id)
      .order('created_at', { ascending: true }));

    // Fallback si custom_permissions n'existe pas encore (migration 069)
    if (error) {
      ({ data, error } = await supabase
        .from('admin_users')
        .select('id, email, nom, role, actif, created_at')
        .eq('tenant_id', tenantId)
        .eq('actif', true)
        .neq('id', req.admin.id)
        .order('created_at', { ascending: true }));
    }

    if (error) throw error;

    res.json({ members: (data || []).map(m => ({ ...m, custom_permissions: m.custom_permissions || null })) });
  } catch (error) {
    logger.error('[TEAM] Erreur list:', error);
    res.status(500).json({ error: 'Erreur lors de la recuperation de l\'equipe' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PUT /api/admin/team/:userId — Modifier role + permissions d'un membre
// ═══════════════════════════════════════════════════════════════════════════════

router.put('/:userId', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'tenant_id requis' });

    // Seul admin peut modifier
    if (req.admin.role !== 'admin' && req.admin.role !== 'super_admin') {
      return res.status(403).json({ error: 'Seul un admin peut modifier les membres' });
    }

    const { userId } = req.params;
    const { role, custom_permissions } = req.body;

    // Pas de self-edit
    if (userId === req.admin.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre compte' });
    }

    // Verifier que le membre existe dans le meme tenant
    const { data: targetUser, error: fetchError } = await supabase
      .from('admin_users')
      .select('id, role, actif')
      .eq('id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !targetUser) {
      return res.status(404).json({ error: 'Membre non trouve' });
    }

    if (!targetUser.actif) {
      return res.status(400).json({ error: 'Ce membre est desactive' });
    }

    // Un admin ne peut pas modifier un autre admin (sauf super_admin)
    if (targetUser.role === 'admin' && req.admin.role !== 'super_admin') {
      return res.status(403).json({ error: 'Impossible de modifier un autre admin' });
    }

    // Validation du role
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role invalide. Valeurs possibles: ${VALID_ROLES.join(', ')}` });
    }

    // Pas de promotion a admin par un non-super_admin
    if (role === 'admin' && req.admin.role !== 'super_admin') {
      return res.status(403).json({ error: 'Seul le super admin peut promouvoir au role admin' });
    }

    // Construire l'update
    const updateData = {};
    if (role) updateData.role = role;
    if (custom_permissions !== undefined) updateData.custom_permissions = custom_permissions;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Aucune modification fournie (role ou custom_permissions requis)' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('admin_users')
      .update(updateData)
      .eq('id', userId)
      .eq('tenant_id', tenantId)
      .select('id, email, nom, role, custom_permissions')
      .single();

    if (updateError) throw updateError;

    logger.info(`[TEAM] Membre ${userId} modifie par admin ${req.admin.id} (tenant: ${tenantId})`);

    res.json({ member: updated });
  } catch (error) {
    logger.error('[TEAM] Erreur update:', error);
    res.status(500).json({ error: 'Erreur lors de la modification du membre' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/admin/team/:userId — Desactiver un membre (soft delete)
// ═══════════════════════════════════════════════════════════════════════════════

router.delete('/:userId', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'tenant_id requis' });

    // Seul admin peut desactiver
    if (req.admin.role !== 'admin' && req.admin.role !== 'super_admin') {
      return res.status(403).json({ error: 'Seul un admin peut desactiver des membres' });
    }

    const { userId } = req.params;

    // Pas de self-delete
    if (userId === req.admin.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous desactiver vous-meme' });
    }

    // Verifier que le membre existe dans le meme tenant
    const { data: targetUser, error: fetchError } = await supabase
      .from('admin_users')
      .select('id, role, actif')
      .eq('id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !targetUser) {
      return res.status(404).json({ error: 'Membre non trouve' });
    }

    // Un admin ne peut pas desactiver un autre admin (sauf super_admin)
    if (targetUser.role === 'admin' && req.admin.role !== 'super_admin') {
      return res.status(403).json({ error: 'Impossible de desactiver un autre admin' });
    }

    // Soft delete
    const { error: updateError } = await supabase
      .from('admin_users')
      .update({ actif: false })
      .eq('id', userId)
      .eq('tenant_id', tenantId);

    if (updateError) throw updateError;

    // Invalider toutes les sessions actives du membre
    revokeAllSessions(userId, tenantId).catch(err =>
      logger.error('[TEAM] Erreur revocation sessions:', { error: err.message })
    );

    logger.info(`[TEAM] Membre ${userId} desactive par admin ${req.admin.id} (tenant: ${tenantId})`);

    res.json({ success: true, message: 'Membre desactive avec succes' });
  } catch (error) {
    logger.error('[TEAM] Erreur delete:', error);
    res.status(500).json({ error: 'Erreur lors de la desactivation du membre' });
  }
});

export default router;
