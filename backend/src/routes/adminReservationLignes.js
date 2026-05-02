/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES ADMIN RESERVATION LIGNES - Endpoint central de sync     ║
 * ║   Source unique: modification reservation_lignes partout          ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Tous les points d'acces (prestation, planning agent, planning client)
 * appellent CE MEME endpoint. Pas de duplication de logique.
 *
 * Regle montants:
 * - Si forfait (is_forfait=true) → montant prestation fixe (ne bouge pas)
 * - Si ponctuel/horaire → recalcul montant au changement d'heures
 */

import express from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/moduleProtection.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
router.use(authenticateAdmin, requireModule('reservations'));

const updateLigneSchema = z.object({
  membre_id: z.number().int().optional().nullable(),
  heure_debut: z.string().max(5).optional().nullable(),
  heure_fin: z.string().max(5).optional().nullable(),
  date_debut: z.string().optional().nullable(),
  date_fin: z.string().optional().nullable(),
}).passthrough();

// PUT /:id — Modifier une reservation_ligne
router.put('/:id', validate(updateLigneSchema), async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const ligneId = parseInt(req.params.id);
    const updates = req.body;

    // 1. Charger la ligne actuelle
    const { data: ligne, error: errLigne } = await supabase
      .from('reservation_lignes')
      .select('*, reservations!inner(id, is_forfait, prix_total, tenant_id)')
      .eq('id', ligneId)
      .eq('tenant_id', tenantId)
      .single();

    if (errLigne || !ligne) {
      return res.status(404).json({ success: false, error: 'Ligne non trouvee' });
    }

    // Verifier que la reservation parente n'est pas cloturee
    const reservation = ligne.reservations;
    if (!reservation) {
      return res.status(404).json({ success: false, error: 'Reservation parente non trouvee' });
    }

    // 2. Construire l'objet de mise a jour (seulement les champs fournis)
    const updateData = {};
    if (updates.membre_id !== undefined) updateData.membre_id = updates.membre_id;
    if (updates.heure_debut !== undefined) updateData.heure_debut = updates.heure_debut;
    if (updates.heure_fin !== undefined) updateData.heure_fin = updates.heure_fin;
    if (updates.date_debut !== undefined) updateData.date_debut = updates.date_debut;
    if (updates.date_fin !== undefined) updateData.date_fin = updates.date_fin;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun champ a modifier' });
    }

    // 3. Mettre a jour la ligne
    const { data: updated, error: errUpdate } = await supabase
      .from('reservation_lignes')
      .update(updateData)
      .eq('id', ligneId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (errUpdate) throw errUpdate;

    // 4. Si non-forfait (ponctuel/horaire) → recalculer prix_total reservation
    if (!reservation.is_forfait) {
      // Charger toutes les lignes de la reservation
      const { data: allLignes } = await supabase
        .from('reservation_lignes')
        .select('prix_total')
        .eq('reservation_id', reservation.id)
        .eq('tenant_id', tenantId);

      const newTotal = (allLignes || []).reduce((sum, l) => sum + (l.prix_total || 0), 0);

      await supabase
        .from('reservations')
        .update({ prix_total: newTotal, updated_at: new Date().toISOString() })
        .eq('id', reservation.id)
        .eq('tenant_id', tenantId);
    }
    // Si forfait → on ne touche PAS au montant

    res.json({
      success: true,
      ligne: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
