/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES RH MULTI-EMPLOYÉS - Gestion des ressources humaines      ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 *
 * Tables: employes, planning_equipe, conges_absences, compteurs_conges, heures_travaillees
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/checkPlan.js';

const router = express.Router();
router.use(authenticateAdmin);
router.use(requireModule('rh'));

// ═══════════════════════════════════════════════════════════════════════
// EMPLOYÉS - CRUD
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/rh/employes
 * Liste des employés
 */
router.get('/employes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { actif, poste, departement } = req.query;

    let query = supabase
      .from('employes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('nom', { ascending: true });

    if (actif !== undefined) {
      query = query.eq('actif', actif === 'true');
    }
    if (poste) {
      query = query.eq('poste', poste);
    }
    if (departement) {
      query = query.eq('departement', departement);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, employes: data, count: data?.length || 0 });
  } catch (error) {
    console.error('[RH] Erreur liste employés:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/rh/employes/:id
 * Détail d'un employé
 */
router.get('/employes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;

    const { data, error } = await supabase
      .from('employes')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;

    // Récupérer les compteurs de congés
    const anneeActuelle = new Date().getFullYear();
    const { data: compteur } = await supabase
      .from('compteurs_conges')
      .select('*')
      .eq('employe_id', id)
      .eq('annee', anneeActuelle)
      .single();

    res.json({ success: true, employe: data, compteur_conges: compteur || null });
  } catch (error) {
    console.error('[RH] Erreur détail employé:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rh/employes
 * Ajouter un employé + créer compteur congés automatique
 */
router.post('/employes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      nom, prenom, email, telephone,
      photo_url, poste, departement,
      type_contrat, date_embauche, date_fin_contrat,
      salaire_brut, taux_horaire,
      horaires_hebdo, jours_travailles,
      competences, certifications,
      acces_admin, acces_modules,
      notes
    } = req.body;

    // Validation
    if (!nom || !prenom || !poste || !date_embauche) {
      return res.status(400).json({
        success: false,
        error: 'nom, prenom, poste et date_embauche sont requis'
      });
    }

    // Créer l'employé
    const { data: employe, error: empError } = await supabase
      .from('employes')
      .insert({
        tenant_id: tenantId,
        nom,
        prenom,
        email: email || null,
        telephone: telephone || null,
        photo_url: photo_url || null,
        poste,
        departement: departement || null,
        type_contrat: type_contrat || 'cdi',
        date_embauche,
        date_fin_contrat: date_fin_contrat || null,
        salaire_brut: salaire_brut || null,
        taux_horaire: taux_horaire || null,
        horaires_hebdo: horaires_hebdo || 35,
        jours_travailles: jours_travailles || ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'],
        competences: competences || [],
        certifications: certifications || [],
        acces_admin: acces_admin || false,
        acces_modules: acces_modules || [],
        notes: notes || null,
        actif: true
      })
      .select()
      .single();

    if (empError) throw empError;

    // Créer automatiquement le compteur de congés pour l'année en cours
    const anneeActuelle = new Date().getFullYear();
    const { data: compteur, error: cptError } = await supabase
      .from('compteurs_conges')
      .insert({
        tenant_id: tenantId,
        employe_id: employe.id,
        annee: anneeActuelle,
        cp_acquis: 25, // 25 jours de CP par défaut
        cp_pris: 0,
        cp_restants: 25,
        rtt_acquis: 10, // 10 RTT par défaut
        rtt_pris: 0,
        rtt_restants: 10,
        autres_jours: {}
      })
      .select()
      .single();

    if (cptError) {
      console.warn('[RH] Erreur création compteur (non bloquant):', cptError);
    }

    res.status(201).json({
      success: true,
      employe,
      compteur_conges: compteur || null,
      message: 'Employé créé avec compteur congés'
    });
  } catch (error) {
    console.error('[RH] Erreur ajout employé:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/rh/employes/:id
 * Modifier un employé
 */
router.patch('/employes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const updates = { ...req.body, updated_at: new Date().toISOString() };
    delete updates.id;
    delete updates.tenant_id;
    delete updates.created_at;

    const { data, error } = await supabase
      .from('employes')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, employe: data });
  } catch (error) {
    console.error('[RH] Erreur modification employé:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/rh/employes/:id
 * Désactiver un employé (soft delete)
 */
router.delete('/employes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const { hard } = req.query;

    if (hard === 'true') {
      const { error } = await supabase
        .from('employes')
        .delete()
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      res.json({ success: true, message: 'Employé supprimé définitivement' });
    } else {
      const { error } = await supabase
        .from('employes')
        .update({ actif: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      res.json({ success: true, message: 'Employé désactivé' });
    }
  } catch (error) {
    console.error('[RH] Erreur suppression employé:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PLANNING ÉQUIPE
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/rh/planning
 * Planning de l'équipe
 */
router.get('/planning', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { employe_id, date_debut, date_fin, semaine } = req.query;

    let query = supabase
      .from('planning_equipe')
      .select('*, employes(id, nom, prenom, poste)')
      .eq('tenant_id', tenantId)
      .order('date_travail', { ascending: true })
      .order('heure_debut', { ascending: true });

    if (employe_id) {
      query = query.eq('employe_id', employe_id);
    }

    // Si semaine spécifiée (YYYY-WXX)
    if (semaine) {
      const [year, week] = semaine.split('-W').map(Number);
      const startOfWeek = getStartOfWeek(year, week);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      query = query
        .gte('date_travail', startOfWeek.toISOString().split('T')[0])
        .lte('date_travail', endOfWeek.toISOString().split('T')[0]);
    } else if (date_debut && date_fin) {
      query = query
        .gte('date_travail', date_debut)
        .lte('date_travail', date_fin);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, planning: data, count: data?.length || 0 });
  } catch (error) {
    console.error('[RH] Erreur planning:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rh/planning
 * Créer une entrée de planning
 */
router.post('/planning', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      employe_id, date_travail, heure_debut, heure_fin,
      duree_pause_minutes, type_journee, site, notes
    } = req.body;

    if (!employe_id || !date_travail || !heure_debut || !heure_fin) {
      return res.status(400).json({
        success: false,
        error: 'employe_id, date_travail, heure_debut et heure_fin sont requis'
      });
    }

    const { data, error } = await supabase
      .from('planning_equipe')
      .insert({
        tenant_id: tenantId,
        employe_id,
        date_travail,
        heure_debut,
        heure_fin,
        duree_pause_minutes: duree_pause_minutes || 60,
        type_journee: type_journee || 'normal',
        site: site || null,
        notes: notes || null
      })
      .select('*, employes(id, nom, prenom)')
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, planning: data });
  } catch (error) {
    console.error('[RH] Erreur création planning:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/rh/planning/:id
 * Supprimer une entrée de planning
 */
router.delete('/planning/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;

    const { error } = await supabase
      .from('planning_equipe')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Planning supprimé' });
  } catch (error) {
    console.error('[RH] Erreur suppression planning:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// CONGÉS ET ABSENCES
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/rh/conges
 * Liste des congés/absences
 */
router.get('/conges', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { employe_id, statut, type, date_debut, date_fin } = req.query;

    let query = supabase
      .from('conges_absences')
      .select('*, employes(id, nom, prenom, poste)')
      .eq('tenant_id', tenantId)
      .order('date_debut', { ascending: false });

    if (employe_id) query = query.eq('employe_id', employe_id);
    if (statut) query = query.eq('statut', statut);
    if (type) query = query.eq('type', type);
    if (date_debut) query = query.gte('date_debut', date_debut);
    if (date_fin) query = query.lte('date_fin', date_fin);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, conges: data, count: data?.length || 0 });
  } catch (error) {
    console.error('[RH] Erreur liste congés:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rh/conges
 * Créer une demande de congé/absence
 */
router.post('/conges', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      employe_id, type, date_debut, date_fin,
      demi_journee_debut, demi_journee_fin,
      motif, justificatif_url
    } = req.body;

    if (!employe_id || !type || !date_debut || !date_fin) {
      return res.status(400).json({
        success: false,
        error: 'employe_id, type, date_debut et date_fin sont requis'
      });
    }

    // Calculer le nombre de jours ouvrés
    const nbJoursOuvres = calculerJoursOuvres(
      new Date(date_debut),
      new Date(date_fin),
      demi_journee_debut,
      demi_journee_fin
    );

    const { data, error } = await supabase
      .from('conges_absences')
      .insert({
        tenant_id: tenantId,
        employe_id,
        type,
        date_debut,
        date_fin,
        demi_journee_debut: demi_journee_debut || false,
        demi_journee_fin: demi_journee_fin || false,
        nb_jours_ouvres: nbJoursOuvres,
        motif: motif || null,
        justificatif_url: justificatif_url || null,
        statut: 'en_attente'
      })
      .select('*, employes(id, nom, prenom)')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      conge: data,
      nb_jours_calcules: nbJoursOuvres
    });
  } catch (error) {
    console.error('[RH] Erreur création congé:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/rh/conges/:id/approuver
 * Approuver un congé et déduire automatiquement du compteur
 */
router.patch('/conges/:id/approuver', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;

    // Récupérer le congé
    const { data: conge, error: congeError } = await supabase
      .from('conges_absences')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (congeError) throw congeError;

    if (conge.statut !== 'en_attente') {
      return res.status(400).json({
        success: false,
        error: 'Ce congé a déjà été traité'
      });
    }

    // Mettre à jour le statut
    const { data: congeUpdated, error: updateError } = await supabase
      .from('conges_absences')
      .update({
        statut: 'approuve',
        approuve_par: req.admin.id || null,
        date_approbation: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Déduire du compteur si c'est un congé payé ou RTT
    let compteurMaj = null;
    if (['conges_payes', 'rtt'].includes(conge.type)) {
      const annee = new Date(conge.date_debut).getFullYear();
      const nbJours = conge.nb_jours_ouvres || 0;

      // Récupérer le compteur
      const { data: compteur, error: cptError } = await supabase
        .from('compteurs_conges')
        .select('*')
        .eq('employe_id', conge.employe_id)
        .eq('annee', annee)
        .single();

      if (!cptError && compteur) {
        const updates = { derniere_maj: new Date().toISOString() };

        if (conge.type === 'conges_payes') {
          updates.cp_pris = (compteur.cp_pris || 0) + nbJours;
          updates.cp_restants = (compteur.cp_acquis || 0) - updates.cp_pris;
        } else if (conge.type === 'rtt') {
          updates.rtt_pris = (compteur.rtt_pris || 0) + nbJours;
          updates.rtt_restants = (compteur.rtt_acquis || 0) - updates.rtt_pris;
        }

        const { data: newCompteur } = await supabase
          .from('compteurs_conges')
          .update(updates)
          .eq('id', compteur.id)
          .select()
          .single();

        compteurMaj = newCompteur;
      }
    }

    res.json({
      success: true,
      conge: congeUpdated,
      compteur_maj: compteurMaj,
      message: 'Congé approuvé et compteur mis à jour'
    });
  } catch (error) {
    console.error('[RH] Erreur approbation congé:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/rh/conges/:id/refuser
 * Refuser un congé
 */
router.patch('/conges/:id/refuser', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const { commentaire_refus } = req.body;

    const { data, error } = await supabase
      .from('conges_absences')
      .update({
        statut: 'refuse',
        commentaire_refus: commentaire_refus || null,
        approuve_par: req.admin.id || null,
        date_approbation: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('statut', 'en_attente')
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, conge: data });
  } catch (error) {
    console.error('[RH] Erreur refus congé:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/rh/conges/:id
 * Annuler/supprimer un congé
 */
router.delete('/conges/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;

    // Vérifier si le congé était approuvé pour rétablir le compteur
    const { data: conge } = await supabase
      .from('conges_absences')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (conge && conge.statut === 'approuve' && ['conges_payes', 'rtt'].includes(conge.type)) {
      // Rétablir le compteur
      const annee = new Date(conge.date_debut).getFullYear();
      const nbJours = conge.nb_jours_ouvres || 0;

      const { data: compteur } = await supabase
        .from('compteurs_conges')
        .select('*')
        .eq('employe_id', conge.employe_id)
        .eq('annee', annee)
        .single();

      if (compteur) {
        const updates = { derniere_maj: new Date().toISOString() };

        if (conge.type === 'conges_payes') {
          updates.cp_pris = Math.max(0, (compteur.cp_pris || 0) - nbJours);
          updates.cp_restants = (compteur.cp_acquis || 0) - updates.cp_pris;
        } else if (conge.type === 'rtt') {
          updates.rtt_pris = Math.max(0, (compteur.rtt_pris || 0) - nbJours);
          updates.rtt_restants = (compteur.rtt_acquis || 0) - updates.rtt_pris;
        }

        await supabase
          .from('compteurs_conges')
          .update(updates)
          .eq('id', compteur.id);
      }
    }

    // Supprimer le congé
    const { error } = await supabase
      .from('conges_absences')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Congé supprimé' });
  } catch (error) {
    console.error('[RH] Erreur suppression congé:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// COMPTEURS CONGÉS
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/rh/compteurs/:employeId
 * Compteurs de congés d'un employé
 */
router.get('/compteurs/:employeId', async (req, res) => {
  try {
    const { employeId } = req.params;
    const tenantId = req.admin.tenant_id;
    const { annee } = req.query;

    const targetAnnee = annee ? parseInt(annee) : new Date().getFullYear();

    const { data, error } = await supabase
      .from('compteurs_conges')
      .select('*')
      .eq('employe_id', employeId)
      .eq('annee', targetAnnee)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({
      success: true,
      compteur: data || null,
      annee: targetAnnee
    });
  } catch (error) {
    console.error('[RH] Erreur compteurs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/rh/compteurs/:employeId
 * Modifier les compteurs d'un employé
 */
router.put('/compteurs/:employeId', async (req, res) => {
  try {
    const { employeId } = req.params;
    const tenantId = req.admin.tenant_id;
    const { annee, cp_acquis, rtt_acquis, autres_jours } = req.body;

    const targetAnnee = annee || new Date().getFullYear();

    // Upsert: créer ou mettre à jour
    const { data: existing } = await supabase
      .from('compteurs_conges')
      .select('*')
      .eq('employe_id', employeId)
      .eq('annee', targetAnnee)
      .single();

    let result;
    if (existing) {
      const updates = { derniere_maj: new Date().toISOString() };
      if (cp_acquis !== undefined) {
        updates.cp_acquis = cp_acquis;
        updates.cp_restants = cp_acquis - (existing.cp_pris || 0);
      }
      if (rtt_acquis !== undefined) {
        updates.rtt_acquis = rtt_acquis;
        updates.rtt_restants = rtt_acquis - (existing.rtt_pris || 0);
      }
      if (autres_jours !== undefined) {
        updates.autres_jours = autres_jours;
      }

      const { data, error } = await supabase
        .from('compteurs_conges')
        .update(updates)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('compteurs_conges')
        .insert({
          tenant_id: tenantId,
          employe_id: employeId,
          annee: targetAnnee,
          cp_acquis: cp_acquis || 25,
          cp_pris: 0,
          cp_restants: cp_acquis || 25,
          rtt_acquis: rtt_acquis || 10,
          rtt_pris: 0,
          rtt_restants: rtt_acquis || 10,
          autres_jours: autres_jours || {}
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json({ success: true, compteur: result });
  } catch (error) {
    console.error('[RH] Erreur modification compteurs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// HEURES TRAVAILLÉES (POINTAGE)
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/rh/heures
 * Liste des heures travaillées
 */
router.get('/heures', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { employe_id, date_debut, date_fin, mois, valide } = req.query;

    let query = supabase
      .from('heures_travaillees')
      .select('*, employes(id, nom, prenom, poste)')
      .eq('tenant_id', tenantId)
      .order('date_travail', { ascending: false });

    if (employe_id) query = query.eq('employe_id', employe_id);
    if (valide !== undefined) query = query.eq('valide', valide === 'true');

    // Si mois spécifié (YYYY-MM)
    if (mois) {
      const [year, month] = mois.split('-').map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);

      query = query
        .gte('date_travail', startOfMonth.toISOString().split('T')[0])
        .lte('date_travail', endOfMonth.toISOString().split('T')[0]);
    } else if (date_debut && date_fin) {
      query = query
        .gte('date_travail', date_debut)
        .lte('date_travail', date_fin);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Calculer totaux
    const totalHeuresReelles = data?.reduce((sum, h) => sum + (parseFloat(h.heures_reelles) || 0), 0) || 0;
    const totalHeuresSupp = data?.reduce((sum, h) => sum + (parseFloat(h.heures_supplementaires) || 0), 0) || 0;

    res.json({
      success: true,
      heures: data,
      count: data?.length || 0,
      totaux: {
        heures_reelles: Math.round(totalHeuresReelles * 100) / 100,
        heures_supplementaires: Math.round(totalHeuresSupp * 100) / 100
      }
    });
  } catch (error) {
    console.error('[RH] Erreur liste heures:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/rh/heures
 * Créer un pointage
 */
router.post('/heures', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      employe_id, date_travail, heure_arrivee, heure_depart,
      heures_theoriques, duree_pause_minutes, notes
    } = req.body;

    if (!employe_id || !date_travail) {
      return res.status(400).json({
        success: false,
        error: 'employe_id et date_travail sont requis'
      });
    }

    // Calculer heures réelles si arrivée et départ fournis
    let heuresReelles = null;
    let heuresSupp = 0;

    if (heure_arrivee && heure_depart) {
      const debut = parseTime(heure_arrivee);
      const fin = parseTime(heure_depart);
      const pauseMinutes = duree_pause_minutes || 0;
      heuresReelles = (fin - debut) / 60 - pauseMinutes / 60;

      if (heures_theoriques && heuresReelles > heures_theoriques) {
        heuresSupp = heuresReelles - heures_theoriques;
      }
    }

    const { data, error } = await supabase
      .from('heures_travaillees')
      .insert({
        tenant_id: tenantId,
        employe_id,
        date_travail,
        heure_arrivee: heure_arrivee || null,
        heure_depart: heure_depart || null,
        heures_theoriques: heures_theoriques || null,
        heures_reelles: heuresReelles,
        heures_supplementaires: heuresSupp,
        duree_pause_minutes: duree_pause_minutes || 0,
        valide: false,
        notes: notes || null
      })
      .select('*, employes(id, nom, prenom)')
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, pointage: data });
  } catch (error) {
    console.error('[RH] Erreur création pointage:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/rh/heures/:id
 * Modifier un pointage
 */
router.patch('/heures/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;
    const updates = { ...req.body };
    delete updates.id;
    delete updates.tenant_id;
    delete updates.created_at;

    // Recalculer heures si modifiées
    if (updates.heure_arrivee && updates.heure_depart) {
      const debut = parseTime(updates.heure_arrivee);
      const fin = parseTime(updates.heure_depart);
      const pauseMinutes = updates.duree_pause_minutes || 0;
      updates.heures_reelles = (fin - debut) / 60 - pauseMinutes / 60;

      if (updates.heures_theoriques && updates.heures_reelles > updates.heures_theoriques) {
        updates.heures_supplementaires = updates.heures_reelles - updates.heures_theoriques;
      }
    }

    const { data, error } = await supabase
      .from('heures_travaillees')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*, employes(id, nom, prenom)')
      .single();

    if (error) throw error;

    res.json({ success: true, pointage: data });
  } catch (error) {
    console.error('[RH] Erreur modification pointage:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/rh/heures/:id/valider
 * Valider un pointage
 */
router.patch('/heures/:id/valider', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.admin.tenant_id;

    const { data, error } = await supabase
      .from('heures_travaillees')
      .update({
        valide: true,
        valide_par: req.admin.id || null
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, pointage: data });
  } catch (error) {
    console.error('[RH] Erreur validation pointage:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD RH
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/rh/dashboard
 * Dashboard RH avec statistiques
 */
router.get('/dashboard', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { mois } = req.query;

    // Période
    const now = new Date();
    const targetMonth = mois || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, month] = targetMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    const dateDebut = startOfMonth.toISOString().split('T')[0];
    const dateFin = endOfMonth.toISOString().split('T')[0];

    // Employés actifs
    const { data: employes } = await supabase
      .from('employes')
      .select('id, nom, prenom, poste, departement')
      .eq('tenant_id', tenantId)
      .eq('actif', true);

    // Congés en attente
    const { data: congesEnAttente } = await supabase
      .from('conges_absences')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('statut', 'en_attente');

    // Congés du mois (approuvés)
    const { data: congesMois } = await supabase
      .from('conges_absences')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('statut', 'approuve')
      .gte('date_debut', dateDebut)
      .lte('date_fin', dateFin);

    // Heures du mois
    const { data: heuresMois } = await supabase
      .from('heures_travaillees')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date_travail', dateDebut)
      .lte('date_travail', dateFin);

    // Calculs
    const totalHeuresTravaillees = heuresMois?.reduce(
      (sum, h) => sum + (parseFloat(h.heures_reelles) || 0), 0
    ) || 0;

    const totalHeuresSupp = heuresMois?.reduce(
      (sum, h) => sum + (parseFloat(h.heures_supplementaires) || 0), 0
    ) || 0;

    const joursCongesTotal = congesMois?.reduce(
      (sum, c) => sum + (parseFloat(c.nb_jours_ouvres) || 0), 0
    ) || 0;

    // Congés par type
    const congesParType = {};
    (congesMois || []).forEach(c => {
      congesParType[c.type] = (congesParType[c.type] || 0) + (parseFloat(c.nb_jours_ouvres) || 0);
    });

    // Employés par département
    const parDepartement = {};
    (employes || []).forEach(e => {
      const dept = e.departement || 'Non assigné';
      parDepartement[dept] = (parDepartement[dept] || 0) + 1;
    });

    res.json({
      success: true,
      mois: targetMonth,
      dashboard: {
        effectif_actif: employes?.length || 0,
        conges_en_attente: congesEnAttente?.length || 0,
        heures_travaillees_mois: Math.round(totalHeuresTravaillees * 100) / 100,
        heures_supplementaires_mois: Math.round(totalHeuresSupp * 100) / 100,
        jours_conges_mois: joursCongesTotal,
        conges_par_type: congesParType,
        employes_par_departement: parDepartement,
        nb_pointages_mois: heuresMois?.length || 0
      }
    });
  } catch (error) {
    console.error('[RH] Erreur dashboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Calcule le début d'une semaine ISO
 */
function getStartOfWeek(year, week) {
  const jan1 = new Date(year, 0, 1);
  const daysOffset = (week - 1) * 7;
  const dayOfWeek = jan1.getDay();
  const start = new Date(jan1);
  start.setDate(jan1.getDate() + daysOffset - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return start;
}

/**
 * Calcule le nombre de jours ouvrés entre deux dates
 */
function calculerJoursOuvres(dateDebut, dateFin, demiJourneeDebut = false, demiJourneeFin = false) {
  let count = 0;
  const current = new Date(dateDebut);

  while (current <= dateFin) {
    const dayOfWeek = current.getDay();
    // Exclure samedi (6) et dimanche (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  // Ajuster pour demi-journées
  if (demiJourneeDebut) count -= 0.5;
  if (demiJourneeFin) count -= 0.5;

  return Math.max(0, count);
}

/**
 * Parse une heure "HH:MM" en minutes depuis minuit
 */
function parseTime(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

export default router;
