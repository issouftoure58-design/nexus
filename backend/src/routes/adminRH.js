/**
 * Routes Admin RH - Business Plan
 * Gestion equipe simplifiee
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// ============================================
// MEMBRES EQUIPE
// ============================================

/**
 * GET /api/admin/rh/membres
 * Liste des membres de l'equipe
 */
router.get('/membres', authenticateAdmin, async (req, res) => {
  try {
    const { data: membres, error } = await supabase
      .from('rh_membres')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .order('nom');

    if (error) throw error;

    res.json(membres || []);
  } catch (error) {
    console.error('[RH] Erreur liste membres:', error);
    res.status(500).json({ error: 'Erreur recuperation equipe' });
  }
});

/**
 * POST /api/admin/rh/membres
 * Ajouter un membre
 */
router.post('/membres', authenticateAdmin, async (req, res) => {
  try {
    const { nom, prenom, email, telephone, role, date_embauche, notes } = req.body;

    if (!nom || !prenom || !role) {
      return res.status(400).json({ error: 'Nom, prenom et role requis' });
    }

    const { data: membre, error } = await supabase
      .from('rh_membres')
      .insert({
        tenant_id: req.admin.tenant_id,
        nom,
        prenom,
        email,
        telephone,
        role,
        date_embauche,
        notes,
        statut: 'actif'
      })
      .select()
      .single();

    if (error) throw error;

    res.json(membre);
  } catch (error) {
    console.error('[RH] Erreur ajout membre:', error);
    res.status(500).json({ error: 'Erreur ajout membre' });
  }
});

/**
 * PUT /api/admin/rh/membres/:id
 * Modifier un membre
 */
router.put('/membres/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, prenom, email, telephone, role, statut, date_embauche, notes } = req.body;

    const { data: membre, error } = await supabase
      .from('rh_membres')
      .update({
        nom,
        prenom,
        email,
        telephone,
        role,
        statut,
        date_embauche,
        notes
      })
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    res.json(membre);
  } catch (error) {
    console.error('[RH] Erreur modification membre:', error);
    res.status(500).json({ error: 'Erreur modification membre' });
  }
});

/**
 * DELETE /api/admin/rh/membres/:id
 * Supprimer un membre (soft delete via statut)
 */
router.delete('/membres/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('rh_membres')
      .update({ statut: 'inactif' })
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('[RH] Erreur suppression membre:', error);
    res.status(500).json({ error: 'Erreur suppression membre' });
  }
});

// ============================================
// PERFORMANCES
// ============================================

/**
 * GET /api/admin/rh/performances
 * Liste des performances (derniers mois)
 */
router.get('/performances', authenticateAdmin, async (req, res) => {
  try {
    const { membre_id, periode } = req.query;

    let query = supabase
      .from('rh_performances')
      .select(`
        *,
        membre:rh_membres(id, nom, prenom, role)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .order('periode', { ascending: false });

    if (membre_id) {
      query = query.eq('membre_id', membre_id);
    }
    if (periode) {
      query = query.eq('periode', periode);
    }

    const { data: performances, error } = await query.limit(50);

    if (error) throw error;

    res.json(performances || []);
  } catch (error) {
    console.error('[RH] Erreur performances:', error);
    res.status(500).json({ error: 'Erreur recuperation performances' });
  }
});

/**
 * POST /api/admin/rh/performances
 * Enregistrer une performance mensuelle
 */
router.post('/performances', authenticateAdmin, async (req, res) => {
  try {
    const { membre_id, periode, ca_genere, rdv_realises, taux_conversion, clients_acquis, note_satisfaction, objectif_atteint } = req.body;

    if (!membre_id || !periode) {
      return res.status(400).json({ error: 'Membre et periode requis' });
    }

    // Verifier que le membre appartient au tenant
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('id')
      .eq('id', membre_id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!membre) {
      return res.status(404).json({ error: 'Membre non trouve' });
    }

    // Upsert pour eviter les doublons periode/membre
    const { data: perf, error } = await supabase
      .from('rh_performances')
      .upsert({
        tenant_id: req.admin.tenant_id,
        membre_id,
        periode,
        ca_genere: ca_genere || 0,
        rdv_realises: rdv_realises || 0,
        taux_conversion: taux_conversion || 0,
        clients_acquis: clients_acquis || 0,
        note_satisfaction: note_satisfaction || 0,
        objectif_atteint: objectif_atteint || false
      }, {
        onConflict: 'membre_id,periode'
      })
      .select()
      .single();

    if (error) throw error;

    res.json(perf);
  } catch (error) {
    console.error('[RH] Erreur enregistrement performance:', error);
    res.status(500).json({ error: 'Erreur enregistrement performance' });
  }
});

// ============================================
// ABSENCES
// ============================================

/**
 * GET /api/admin/rh/absences
 * Liste des absences
 */
router.get('/absences', authenticateAdmin, async (req, res) => {
  try {
    const { membre_id, statut } = req.query;

    let query = supabase
      .from('rh_absences')
      .select(`
        *,
        membre:rh_membres(id, nom, prenom, role)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .order('date_debut', { ascending: false });

    if (membre_id) {
      query = query.eq('membre_id', membre_id);
    }
    if (statut) {
      query = query.eq('statut', statut);
    }

    const { data: absences, error } = await query;

    if (error) throw error;

    res.json(absences || []);
  } catch (error) {
    console.error('[RH] Erreur absences:', error);
    res.status(500).json({ error: 'Erreur recuperation absences' });
  }
});

/**
 * POST /api/admin/rh/absences
 * Demander une absence
 */
router.post('/absences', authenticateAdmin, async (req, res) => {
  try {
    const { membre_id, type, date_debut, date_fin, motif } = req.body;

    if (!membre_id || !type || !date_debut || !date_fin) {
      return res.status(400).json({ error: 'Membre, type et dates requis' });
    }

    // Verifier que le membre appartient au tenant
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('id')
      .eq('id', membre_id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!membre) {
      return res.status(404).json({ error: 'Membre non trouve' });
    }

    const { data: absence, error } = await supabase
      .from('rh_absences')
      .insert({
        tenant_id: req.admin.tenant_id,
        membre_id,
        type,
        date_debut,
        date_fin,
        motif,
        statut: 'en_attente'
      })
      .select()
      .single();

    if (error) throw error;

    res.json(absence);
  } catch (error) {
    console.error('[RH] Erreur demande absence:', error);
    res.status(500).json({ error: 'Erreur demande absence' });
  }
});

/**
 * PUT /api/admin/rh/absences/:id/approve
 * Approuver/Refuser une absence
 */
router.put('/absences/:id/:action', authenticateAdmin, async (req, res) => {
  try {
    const { id, action } = req.params;

    if (!['approve', 'refuse'].includes(action)) {
      return res.status(400).json({ error: 'Action invalide' });
    }

    const statut = action === 'approve' ? 'approuve' : 'refuse';

    const { data: absence, error } = await supabase
      .from('rh_absences')
      .update({ statut })
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    // Si approuve, mettre a jour le statut du membre
    if (statut === 'approuve') {
      await supabase
        .from('rh_membres')
        .update({ statut: 'conge' })
        .eq('id', absence.membre_id);
    }

    res.json(absence);
  } catch (error) {
    console.error('[RH] Erreur action absence:', error);
    res.status(500).json({ error: 'Erreur action absence' });
  }
});

// ============================================
// DASHBOARD RH
// ============================================

/**
 * GET /api/admin/rh/dashboard
 * Stats RH globales
 */
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    // Membres actifs
    const { data: membres } = await supabase
      .from('rh_membres')
      .select('id, role, statut')
      .eq('tenant_id', req.admin.tenant_id);

    const actifs = membres?.filter(m => m.statut === 'actif').length || 0;
    const enConge = membres?.filter(m => m.statut === 'conge').length || 0;

    // Roles distribution
    const rolesCount = {};
    membres?.forEach(m => {
      rolesCount[m.role] = (rolesCount[m.role] || 0) + 1;
    });

    // Absences en attente
    const { data: absences } = await supabase
      .from('rh_absences')
      .select('id')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('statut', 'en_attente');

    // Performances du mois courant
    const currentMonth = new Date().toISOString().slice(0, 7);
    const { data: perfs } = await supabase
      .from('rh_performances')
      .select('ca_genere, rdv_realises, objectif_atteint')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('periode', currentMonth);

    const totalCA = perfs?.reduce((sum, p) => sum + parseFloat(p.ca_genere || 0), 0) || 0;
    const totalRDV = perfs?.reduce((sum, p) => sum + (p.rdv_realises || 0), 0) || 0;
    const objectifsAtteints = perfs?.filter(p => p.objectif_atteint).length || 0;

    res.json({
      equipe: {
        total: membres?.length || 0,
        actifs,
        en_conge: enConge,
        roles: rolesCount
      },
      absences: {
        en_attente: absences?.length || 0
      },
      performances_mois: {
        periode: currentMonth,
        ca_total: totalCA,
        rdv_total: totalRDV,
        objectifs_atteints: objectifsAtteints,
        membres_evalues: perfs?.length || 0
      }
    });
  } catch (error) {
    console.error('[RH] Erreur dashboard:', error);
    res.status(500).json({ error: 'Erreur dashboard RH' });
  }
});

export default router;
