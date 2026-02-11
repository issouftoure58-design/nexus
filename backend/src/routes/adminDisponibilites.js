import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/moduleProtection.js';

const router = express.Router();

// 🔒 MODULE PROTECTION: Toutes les routes disponibilités nécessitent le module 'reservations'
router.use(requireModule('reservations'));

// Noms des jours en français
const JOURS_SEMAINE = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// ════════════════════════════════════════════════════════════════════
// HORAIRES HEBDOMADAIRES
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/disponibilites/horaires
// Retourne les horaires hebdomadaires (7 jours)
router.get('/horaires', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { data: horaires, error } = await supabase
      .from('horaires_hebdo')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('jour_semaine', { ascending: true });

    if (error) throw error;

    // Formater pour inclure le nom du jour
    const horairesMapped = horaires.map(h => ({
      jour: h.jour_semaine,
      nom: JOURS_SEMAINE[h.jour_semaine],
      heure_debut: h.heure_debut,
      heure_fin: h.heure_fin,
      is_active: h.is_active,
      id: h.id
    }));

    res.json({ horaires: horairesMapped });
  } catch (error) {
    console.error('[ADMIN DISPONIBILITES] Erreur liste horaires:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/admin/disponibilites/horaires
// Met à jour tous les horaires hebdomadaires
router.put('/horaires', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { horaires } = req.body;

    if (!horaires || !Array.isArray(horaires)) {
      return res.status(400).json({ error: 'Format horaires invalide' });
    }

    // Mettre à jour chaque jour (🔒 TENANT ISOLATION)
    const updates = horaires.map(async (h) => {
      return supabase
        .from('horaires_hebdo')
        .update({
          heure_debut: h.is_active ? h.heure_debut : null,
          heure_fin: h.is_active ? h.heure_fin : null,
          is_active: h.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .eq('jour_semaine', h.jour);
    });

    await Promise.all(updates);

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'update_horaires',
      entite: 'horaires_hebdo',
      details: { horaires }
    });

    res.json({ message: 'Horaires mis à jour avec succès' });
  } catch (error) {
    console.error('[ADMIN DISPONIBILITES] Erreur update horaires:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// CONGÉS (Vacances)
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/disponibilites/conges
// Liste tous les congés
router.get('/conges', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { data: conges, error } = await supabase
      .from('conges')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date_debut', { ascending: false });

    if (error) throw error;

    res.json({ conges });
  } catch (error) {
    console.error('[ADMIN DISPONIBILITES] Erreur liste congés:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/disponibilites/conges
// Créer un nouveau congé
router.post('/conges', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { date_debut, date_fin, motif, type } = req.body;

    if (!date_debut || !date_fin) {
      return res.status(400).json({ error: 'Dates de début et fin requises' });
    }

    // Vérifier que date_fin >= date_debut
    if (new Date(date_fin) < new Date(date_debut)) {
      return res.status(400).json({ error: 'La date de fin doit être après la date de début' });
    }

    // 🔒 TENANT ISOLATION: Inclure tenant_id dans l'insert
    const { data: conge, error } = await supabase
      .from('conges')
      .insert({
        tenant_id: tenantId,
        date_debut,
        date_fin,
        motif: motif || 'Congé',
        type: type || 'conge'
      })
      .select()
      .single();

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'create',
      entite: 'conge',
      entite_id: conge.id,
      details: { date_debut, date_fin, motif }
    });

    res.json({ conge });
  } catch (error) {
    console.error('[ADMIN DISPONIBILITES] Erreur création congé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/disponibilites/conges/:id
// Supprimer un congé
router.delete('/conges/:id', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    // 🔒 TENANT ISOLATION
    const { error } = await supabase
      .from('conges')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'delete',
      entite: 'conge',
      entite_id: req.params.id
    });

    res.json({ message: 'Congé supprimé' });
  } catch (error) {
    console.error('[ADMIN DISPONIBILITES] Erreur suppression congé:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// BLOCS TEMPORAIRES
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/disponibilites/blocs
// Liste les blocs d'indisponibilité
router.get('/blocs', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { from, to } = req.query;

    // 🔒 TENANT ISOLATION
    let query = supabase
      .from('blocs_indispo')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true });

    if (from) {
      query = query.gte('date', from);
    }
    if (to) {
      query = query.lte('date', to);
    }

    const { data: blocs, error } = await query;

    if (error) throw error;

    res.json({ blocs });
  } catch (error) {
    console.error('[ADMIN DISPONIBILITES] Erreur liste blocs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/admin/disponibilites/blocs
// Créer un bloc d'indisponibilité
router.post('/blocs', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { date, heure_debut, heure_fin, motif, recurrent } = req.body;

    if (!date || !heure_debut || !heure_fin) {
      return res.status(400).json({ error: 'Date, heure début et heure fin requises' });
    }

    // Vérifier que heure_fin > heure_debut
    if (heure_fin <= heure_debut) {
      return res.status(400).json({ error: 'L\'heure de fin doit être après l\'heure de début' });
    }

    // 🔒 TENANT ISOLATION: Inclure tenant_id dans l'insert
    const { data: bloc, error } = await supabase
      .from('blocs_indispo')
      .insert({
        tenant_id: tenantId,
        date,
        heure_debut,
        heure_fin,
        motif: motif || 'Indisponible',
        recurrent: recurrent || false
      })
      .select()
      .single();

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'create',
      entite: 'bloc_indispo',
      entite_id: bloc.id,
      details: { date, heure_debut, heure_fin, motif }
    });

    res.json({ bloc });
  } catch (error) {
    console.error('[ADMIN DISPONIBILITES] Erreur création bloc:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/admin/disponibilites/blocs/:id
// Supprimer un bloc d'indisponibilité
router.delete('/blocs/:id', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    // 🔒 TENANT ISOLATION
    const { error } = await supabase
      .from('blocs_indispo')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Logger l'action (🔒 TENANT ISOLATION)
    await supabase.from('historique_admin').insert({
      tenant_id: tenantId,
      admin_id: req.admin.id,
      action: 'delete',
      entite: 'bloc_indispo',
      entite_id: req.params.id
    });

    res.json({ message: 'Bloc supprimé' });
  } catch (error) {
    console.error('[ADMIN DISPONIBILITES] Erreur suppression bloc:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// CALENDRIER GLOBAL
// ════════════════════════════════════════════════════════════════════

// GET /api/admin/disponibilites/calendrier
// Retourne le calendrier complet d'un mois avec toutes les infos
router.get('/calendrier', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { mois } = req.query; // Format: YYYY-MM

    if (!mois || !/^\d{4}-\d{2}$/.test(mois)) {
      return res.status(400).json({ error: 'Format mois invalide (attendu: YYYY-MM)' });
    }

    const [year, month] = mois.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    // Récupérer horaires hebdomadaires (🔒 TENANT ISOLATION)
    const { data: horaires } = await supabase
      .from('horaires_hebdo')
      .select('*')
      .eq('tenant_id', tenantId);

    const horairesMap = {};
    horaires?.forEach(h => {
      horairesMap[h.jour_semaine] = h;
    });

    // Récupérer congés du mois (🔒 TENANT ISOLATION)
    const { data: conges } = await supabase
      .from('conges')
      .select('*')
      .eq('tenant_id', tenantId)
      .lte('date_debut', lastDay.toISOString().split('T')[0])
      .gte('date_fin', firstDay.toISOString().split('T')[0]);

    // Récupérer blocs du mois (🔒 TENANT ISOLATION)
    const { data: blocs } = await supabase
      .from('blocs_indispo')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date', firstDay.toISOString().split('T')[0])
      .lte('date', lastDay.toISOString().split('T')[0]);

    // Récupérer RDV du mois (🔒 TENANT ISOLATION)
    const { data: rdv } = await supabase
      .from('reservations')
      .select('*, clients(nom, prenom)')
      .eq('tenant_id', tenantId)
      .gte('date', firstDay.toISOString().split('T')[0])
      .lte('date', lastDay.toISOString().split('T')[0])
      .order('heure', { ascending: true });

    // Construire le calendrier jour par jour
    const calendrier = [];
    const currentDate = new Date(firstDay);

    while (currentDate <= lastDay) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();

      // Horaires du jour
      const horairesDuJour = horairesMap[dayOfWeek];

      // Vérifier si c'est un jour de congé
      const estConge = conges?.some(c =>
        dateStr >= c.date_debut && dateStr <= c.date_fin
      );

      // Blocs du jour
      const blocsDuJour = blocs?.filter(b => b.date === dateStr) || [];

      // RDV du jour
      const rdvDuJour = rdv?.filter(r => r.date === dateStr) || [];

      calendrier.push({
        date: dateStr,
        jour_semaine: dayOfWeek,
        nom_jour: JOURS_SEMAINE[dayOfWeek],
        horaires: horairesDuJour ? {
          heure_debut: horairesDuJour.heure_debut,
          heure_fin: horairesDuJour.heure_fin,
          is_active: horairesDuJour.is_active
        } : null,
        est_conge: estConge,
        conge: estConge ? conges.find(c => dateStr >= c.date_debut && dateStr <= c.date_fin) : null,
        blocs_indispo: blocsDuJour,
        rendez_vous: rdvDuJour.map(r => ({
          id: r.id,
          heure: r.heure,
          service: r.service,
          client: `${r.clients.prenom} ${r.clients.nom}`,
          statut: r.statut
        }))
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json({ calendrier });
  } catch (error) {
    console.error('[ADMIN DISPONIBILITES] Erreur calendrier:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
