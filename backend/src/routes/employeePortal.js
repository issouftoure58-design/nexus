/**
 * Employee Portal Routes — NEXUS
 * Donnees du portail employe : planning, absences, bulletins, profil.
 * Toutes les routes filtrent par tenant_id ET membre_id (employe voit uniquement SES donnees).
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import logger from '../config/logger.js';
import { authenticateEmployee } from './employeeAuth.js';

const router = express.Router();

// Toutes les routes employee sont protegees
router.use(authenticateEmployee);

// ─── GET /planning ───────────────────────────────────────────────────────────

router.get('/planning', async (req, res) => {
  try {
    const { tenant_id, membre_id } = req.employee;
    const { date_debut, date_fin } = req.query;

    // Calculer dates (semaine courante par defaut)
    let dateDebutStr, dateFinStr;
    if (date_debut && date_fin) {
      dateDebutStr = date_debut;
      dateFinStr = date_fin;
    } else {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dateDebutStr = fmt(monday);
      dateFinStr = fmt(sunday);
    }

    // Reservations ou ce membre est assigne (principal)
    const { data: reservationsPrincipales } = await supabase
      .from('reservations')
      .select(`
        id, date, heure, service_nom, duree_minutes, duree_totale_minutes, statut,
        client:clients(id, nom, prenom, telephone)
      `)
      .eq('tenant_id', tenant_id)
      .eq('membre_id', membre_id)
      .gte('date', dateDebutStr)
      .lte('date', dateFinStr)
      .not('statut', 'eq', 'annule');

    // Reservations via reservation_membres
    const { data: reservationsMembres } = await supabase
      .from('reservation_membres')
      .select('reservation_id')
      .eq('tenant_id', tenant_id)
      .eq('membre_id', membre_id);

    const membreResaIds = (reservationsMembres || []).map(rm => rm.reservation_id);
    const principalIds = (reservationsPrincipales || []).map(r => r.id);
    const suppIds = membreResaIds.filter(id => !principalIds.includes(id));

    let reservationsSupp = [];
    if (suppIds.length > 0) {
      const { data } = await supabase
        .from('reservations')
        .select(`
          id, date, heure, service_nom, duree_minutes, duree_totale_minutes, statut,
          client:clients(id, nom, prenom, telephone)
        `)
        .eq('tenant_id', tenant_id)
        .in('id', suppIds)
        .gte('date', dateDebutStr)
        .lte('date', dateFinStr)
        .not('statut', 'eq', 'annule');
      reservationsSupp = data || [];
    }

    const reservations = [...(reservationsPrincipales || []), ...reservationsSupp]
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.heure || '').localeCompare(b.heure || '');
      });

    // Absences approuvees de la periode
    const { data: absences } = await supabase
      .from('rh_absences')
      .select('id, type, date_debut, date_fin, demi_journee, periode, motif, statut')
      .eq('membre_id', membre_id)
      .eq('tenant_id', tenant_id)
      .lte('date_debut', dateFinStr)
      .gte('date_fin', dateDebutStr)
      .eq('statut', 'approuve');

    // Organiser par jour
    const [y1, m1, d1] = dateDebutStr.split('-').map(Number);
    const [y2, m2, d2] = dateFinStr.split('-').map(Number);
    const debut = new Date(y1, m1 - 1, d1);
    const fin = new Date(y2, m2 - 1, d2);

    const planning = {};
    for (let d = new Date(debut); d <= fin; d.setDate(d.getDate() + 1)) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      planning[dateStr] = { rdv: [], absent: false, type_absence: null };
    }

    // Marquer absences
    (absences || []).forEach(abs => {
      const absDebut = new Date(abs.date_debut);
      const absFin = new Date(abs.date_fin);
      for (let d = new Date(absDebut); d <= absFin; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (planning[dateStr]) {
          planning[dateStr].absent = true;
          planning[dateStr].type_absence = abs.type;
        }
      }
    });

    // Ajouter les RDV
    reservations.forEach(r => {
      if (planning[r.date]) {
        planning[r.date].rdv.push({
          id: r.id,
          heure: r.heure,
          service_nom: r.service_nom,
          duree_minutes: r.duree_totale_minutes || r.duree_minutes,
          statut: r.statut,
          client_nom: r.client ? `${r.client.prenom || ''} ${r.client.nom || ''}`.trim() : 'N/A',
          client_telephone: r.client?.telephone || null,
        });
      }
    });

    // Stats
    let totalRdv = 0;
    let totalMinutes = 0;
    Object.values(planning).forEach((jour) => {
      totalRdv += jour.rdv.length;
      jour.rdv.forEach(rdv => { totalMinutes += rdv.duree_minutes || 0; });
    });

    res.json({
      planning,
      stats: {
        total_rdv: totalRdv,
        heures_travaillees: Math.round(totalMinutes / 60 * 10) / 10,
      },
      date_debut: dateDebutStr,
      date_fin: dateFinStr,
    });
  } catch (error) {
    logger.error('[EmployeePortal] Erreur planning:', error);
    res.status(500).json({ error: 'Erreur recuperation planning' });
  }
});

// ─── GET /absences ───────────────────────────────────────────────────────────

router.get('/absences', async (req, res) => {
  try {
    const { tenant_id, membre_id } = req.employee;

    // Liste des absences
    const { data: absences, error } = await supabase
      .from('rh_absences')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('membre_id', membre_id)
      .order('date_debut', { ascending: false });

    if (error) throw error;

    // Compteurs conges
    const annee = new Date().getFullYear();
    const { data: compteur } = await supabase
      .from('rh_compteurs_conges')
      .select('*')
      .eq('tenant_id', tenant_id)
      .eq('membre_id', membre_id)
      .eq('annee', annee)
      .single();

    res.json({
      absences: absences || [],
      compteurs: compteur ? {
        annee: compteur.annee,
        cp: {
          acquis: compteur.cp_acquis || 0,
          pris: compteur.cp_pris || 0,
          report: compteur.cp_report_n1 || 0,
          solde: (compteur.cp_acquis || 0) - (compteur.cp_pris || 0) + (compteur.cp_report_n1 || 0),
        },
        rtt: {
          acquis: compteur.rtt_acquis || 0,
          pris: compteur.rtt_pris || 0,
          solde: (compteur.rtt_acquis || 0) - (compteur.rtt_pris || 0),
        },
        rc: {
          acquis: compteur.rc_acquis || 0,
          pris: compteur.rc_pris || 0,
          solde: (compteur.rc_acquis || 0) - (compteur.rc_pris || 0),
        },
      } : null,
    });
  } catch (error) {
    logger.error('[EmployeePortal] Erreur absences:', error);
    res.status(500).json({ error: 'Erreur recuperation absences' });
  }
});

// ─── POST /absences ──────────────────────────────────────────────────────────

router.post('/absences', async (req, res) => {
  try {
    const { tenant_id, membre_id } = req.employee;
    const { type, date_debut, date_fin, motif, demi_journee, periode } = req.body;

    if (!type || !date_debut) {
      return res.status(400).json({ error: 'Type et date de debut requis' });
    }

    const typesValides = ['conge', 'rtt', 'maladie', 'formation', 'repos_compensateur', 'sans_solde', 'autre'];
    if (!typesValides.includes(type)) {
      return res.status(400).json({ error: 'Type d\'absence invalide' });
    }

    // Verifier chevauchement
    const dateFinEffective = date_fin || date_debut;
    const { data: existing } = await supabase
      .from('rh_absences')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('membre_id', membre_id)
      .not('statut', 'eq', 'refuse')
      .not('statut', 'eq', 'annule')
      .lte('date_debut', dateFinEffective)
      .gte('date_fin', date_debut)
      .limit(1);

    if (existing?.length > 0) {
      return res.status(400).json({ error: 'Une absence existe deja sur cette periode' });
    }

    const { data: absence, error } = await supabase
      .from('rh_absences')
      .insert({
        tenant_id,
        membre_id,
        type,
        date_debut,
        date_fin: dateFinEffective,
        motif: motif || null,
        demi_journee: demi_journee || false,
        periode: demi_journee ? (periode || 'matin') : null,
        statut: 'en_attente',
      })
      .select()
      .single();

    if (error) throw error;

    // Creer notification pour l'admin
    try {
      // Recuperer le nom de l'employe
      const { data: membre } = await supabase
        .from('rh_membres')
        .select('nom, prenom')
        .eq('id', membre_id)
        .eq('tenant_id', tenant_id)
        .single();

      const nomComplet = membre ? `${membre.prenom} ${membre.nom}` : 'Un employe';

      await supabase
        .from('notifications')
        .insert({
          tenant_id,
          type: 'absence_request',
          titre: 'Demande d\'absence',
          message: `${nomComplet} demande un ${type === 'conge' ? 'conge' : type} du ${date_debut} au ${dateFinEffective}`,
          lien: '/rh',
          lu: false,
        });
    } catch (_) { /* non-blocking */ }

    res.json({ success: true, absence });
  } catch (error) {
    logger.error('[EmployeePortal] Erreur creation absence:', error);
    res.status(500).json({ error: 'Erreur creation demande d\'absence' });
  }
});

// ─── GET /bulletins ──────────────────────────────────────────────────────────

router.get('/bulletins', async (req, res) => {
  try {
    const { tenant_id, membre_id } = req.employee;
    const { annee } = req.query;

    let query = supabase
      .from('rh_bulletins_paie')
      .select('id, periode, salaire_brut, salaire_net, net_a_payer, statut, created_at')
      .eq('tenant_id', tenant_id)
      .eq('membre_id', membre_id)
      .eq('statut', 'envoye')
      .order('periode', { ascending: false });

    if (annee) {
      query = query.gte('periode', `${annee}-01`).lte('periode', `${annee}-12`);
    }

    const { data: bulletins, error } = await query;

    if (error) throw error;

    res.json({ bulletins: bulletins || [] });
  } catch (error) {
    logger.error('[EmployeePortal] Erreur bulletins:', error);
    res.status(500).json({ error: 'Erreur recuperation bulletins' });
  }
});

// ─── GET /bulletins/:id/pdf ──────────────────────────────────────────────────

router.get('/bulletins/:id/pdf', async (req, res) => {
  try {
    const { tenant_id, membre_id } = req.employee;
    const { id } = req.params;

    // Verifier que le bulletin appartient a cet employe ET est envoye
    const { data: bulletin, error } = await supabase
      .from('rh_bulletins_paie')
      .select('id, membre_id, statut')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .eq('membre_id', membre_id)
      .eq('statut', 'envoye')
      .single();

    if (error || !bulletin) {
      return res.status(404).json({ error: 'Bulletin non trouve' });
    }

    // Importer dynamiquement le generateur PDF
    const { streamPayslipPDF } = await import('../services/payslipPDFService.js');
    await streamPayslipPDF(tenant_id, id, res);
  } catch (error) {
    logger.error('[EmployeePortal] Erreur PDF bulletin:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erreur generation PDF' });
    }
  }
});

// ─── GET /profil ─────────────────────────────────────────────────────────────

router.get('/profil', async (req, res) => {
  try {
    const { tenant_id, membre_id } = req.employee;

    // Champs visibles employe — PAS de salaire, NIR, etc.
    const { data: membre, error } = await supabase
      .from('rh_membres')
      .select(`
        id, nom, prenom, email, telephone, sexe,
        date_naissance, nationalite,
        adresse_rue, adresse_cp, adresse_ville, adresse_pays,
        role, poste, type_contrat, date_embauche, date_fin_contrat,
        temps_travail, heures_hebdo, jours_travailles,
        avatar_url,
        contact_urgence_nom, contact_urgence_tel, contact_urgence_lien,
        mutuelle_obligatoire, mutuelle_dispense
      `)
      .eq('id', membre_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (error || !membre) {
      return res.status(404).json({ error: 'Profil non trouve' });
    }

    res.json(membre);
  } catch (error) {
    logger.error('[EmployeePortal] Erreur profil:', error);
    res.status(500).json({ error: 'Erreur recuperation profil' });
  }
});

// ─── PUT /profil ─────────────────────────────────────────────────────────────

router.put('/profil', async (req, res) => {
  try {
    const { tenant_id, membre_id } = req.employee;
    const { telephone, adresse_rue, adresse_cp, adresse_ville, adresse_pays } = req.body;

    // Seuls certains champs sont modifiables par l'employe
    const updateData = {};
    if (telephone !== undefined) updateData.telephone = telephone;
    if (adresse_rue !== undefined) updateData.adresse_rue = adresse_rue;
    if (adresse_cp !== undefined) updateData.adresse_cp = adresse_cp;
    if (adresse_ville !== undefined) updateData.adresse_ville = adresse_ville;
    if (adresse_pays !== undefined) updateData.adresse_pays = adresse_pays;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Aucun champ a modifier' });
    }

    updateData.updated_at = new Date().toISOString();

    const { data: membre, error } = await supabase
      .from('rh_membres')
      .update(updateData)
      .eq('id', membre_id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, membre });
  } catch (error) {
    logger.error('[EmployeePortal] Erreur mise a jour profil:', error);
    res.status(500).json({ error: 'Erreur mise a jour profil' });
  }
});

export default router;
