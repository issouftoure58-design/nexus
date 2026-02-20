/**
 * Routes Admin RH - Business Plan
 * Gestion equipe simplifiee
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// ============================================
// HELPER: GÉNÉRATION ÉCRITURES COMPTABLES PAIE
// ============================================

/**
 * Génère les écritures comptables de paie dans le journal PA
 */
async function genererEcrituresPaie(tenantId, periode, salairesNet, cotisationsPatronales, cotisationsSalariales, paieJournalId) {
  const dateEcriture = `${periode}-28`; // Fin de mois
  const exercice = parseInt(periode.slice(0, 4));
  const totalCotisations = cotisationsPatronales + cotisationsSalariales;
  const brutTotal = salairesNet + cotisationsSalariales;

  // Vérifier si écritures déjà générées pour cette période
  const { data: existantes } = await supabase
    .from('ecritures_comptables')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('journal_code', 'PA')
    .eq('periode', periode);

  if (existantes && existantes.length > 0) {
    // Supprimer les anciennes écritures de paie pour cette période
    await supabase
      .from('ecritures_comptables')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('journal_code', 'PA')
      .eq('periode', periode);
  }

  const ecritures = [];

  // 1. Charge de personnel (brut) - Débit 641
  ecritures.push({
    tenant_id: tenantId,
    journal_code: 'PA',
    date_ecriture: dateEcriture,
    numero_piece: `PAIE-${periode}`,
    compte_numero: '641',
    compte_libelle: 'Rémunérations personnel',
    libelle: `Salaires bruts ${periode}`,
    debit: brutTotal,
    credit: 0,
    paie_journal_id: paieJournalId,
    periode,
    exercice
  });

  // 2. Charges sociales patronales - Débit 645
  if (cotisationsPatronales > 0) {
    ecritures.push({
      tenant_id: tenantId,
      journal_code: 'PA',
      date_ecriture: dateEcriture,
      numero_piece: `PAIE-${periode}`,
      compte_numero: '645',
      compte_libelle: 'Charges sociales',
      libelle: `Cotisations patronales ${periode}`,
      debit: cotisationsPatronales,
      credit: 0,
      paie_journal_id: paieJournalId,
      periode,
      exercice
    });
  }

  // 3. Personnel - rémunérations dues (net à payer) - Crédit 421
  ecritures.push({
    tenant_id: tenantId,
    journal_code: 'PA',
    date_ecriture: dateEcriture,
    numero_piece: `PAIE-${periode}`,
    compte_numero: '421',
    compte_libelle: 'Personnel - Rémunérations dues',
    libelle: `Salaires nets à payer ${periode}`,
    debit: 0,
    credit: salairesNet,
    paie_journal_id: paieJournalId,
    periode,
    exercice
  });

  // 4. Organismes sociaux (total cotisations) - Crédit 431
  if (totalCotisations > 0) {
    ecritures.push({
      tenant_id: tenantId,
      journal_code: 'PA',
      date_ecriture: dateEcriture,
      numero_piece: `PAIE-${periode}`,
      compte_numero: '431',
      compte_libelle: 'Sécurité sociale',
      libelle: `Cotisations sociales ${periode}`,
      debit: 0,
      credit: totalCotisations,
      paie_journal_id: paieJournalId,
      periode,
      exercice
    });
  }

  const { data, error } = await supabase
    .from('ecritures_comptables')
    .insert(ecritures)
    .select();

  if (error) throw error;

  return data || [];
}

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
    const { nom, prenom, email, telephone, role, date_embauche, salaire_mensuel, nir, date_naissance, notes } = req.body;

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
        salaire_mensuel: salaire_mensuel || 0,
        nir,
        date_naissance,
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
    const { nom, prenom, email, telephone, role, statut, date_embauche, salaire_mensuel, nir, date_naissance, notes } = req.body;

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
        salaire_mensuel: salaire_mensuel || 0,
        nir,
        date_naissance,
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
    // Membres avec salaires
    const { data: membres } = await supabase
      .from('rh_membres')
      .select('id, role, statut, salaire_mensuel')
      .eq('tenant_id', req.admin.tenant_id);

    const actifs = membres?.filter(m => m.statut === 'actif').length || 0;
    const enConge = membres?.filter(m => m.statut === 'conge').length || 0;

    // Roles distribution
    const rolesCount = {};
    membres?.forEach(m => {
      rolesCount[m.role] = (rolesCount[m.role] || 0) + 1;
    });

    // Calcul masse salariale (somme des salaires des actifs)
    const masseSalariale = membres
      ?.filter(m => m.statut === 'actif')
      .reduce((sum, m) => sum + (m.salaire_mensuel || 0), 0) || 0;

    // Coût moyen par employé
    const coutMoyenEmploye = actifs > 0 ? Math.round(masseSalariale / actifs) : 0;

    // Absences du mois courant
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: absences } = await supabase
      .from('rh_absences')
      .select('id, statut, date_debut, date_fin')
      .eq('tenant_id', req.admin.tenant_id);

    const absencesEnAttente = absences?.filter(a => a.statut === 'en_attente').length || 0;

    // Calculer les jours d'absence du mois
    const absencesMois = absences?.filter(a =>
      a.statut === 'approuve' &&
      a.date_debut <= endOfMonth &&
      a.date_fin >= startOfMonth
    ) || [];

    let totalJoursAbsence = 0;
    absencesMois.forEach(a => {
      const debut = new Date(Math.max(new Date(a.date_debut), new Date(startOfMonth)));
      const fin = new Date(Math.min(new Date(a.date_fin), new Date(endOfMonth)));
      const jours = Math.ceil((fin - debut) / (1000 * 60 * 60 * 24)) + 1;
      totalJoursAbsence += jours;
    });

    // Taux d'absentéisme: jours absence / (nb employés * jours ouvrés du mois) * 100
    const joursOuvresMois = 22; // Approximation
    const tauxAbsenteisme = actifs > 0
      ? (totalJoursAbsence / (actifs * joursOuvresMois)) * 100
      : 0;

    // Heures travaillées estimées (151.67h/mois standard en France)
    const heuresMensuelles = 151.67;
    const heuresTravaillees = Math.round(actifs * heuresMensuelles * (1 - tauxAbsenteisme / 100));

    // Période formatée
    const periode = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    res.json({
      equipe: {
        total: membres?.length || 0,
        actifs,
        en_conge: enConge,
        roles: rolesCount
      },
      absences: {
        en_attente: absencesEnAttente,
        total_jours_mois: totalJoursAbsence
      },
      paie: {
        periode,
        masse_salariale: masseSalariale,
        heures_travaillees: heuresTravaillees,
        taux_absenteisme: Math.round(tauxAbsenteisme * 10) / 10,
        cout_moyen_employe: coutMoyenEmploye
      }
    });
  } catch (error) {
    console.error('[RH] Erreur dashboard:', error);
    res.status(500).json({ error: 'Erreur dashboard RH' });
  }
});

// ============================================
// TRAITEMENT PAIE - Génération écritures comptables
// ============================================

// Taux de cotisations 2026
const TAUX_COTISATIONS = {
  maladie_employeur: 13.00,
  vieillesse_plafonnee_employeur: 8.55,
  vieillesse_plafonnee_salarie: 6.90,
  vieillesse_deplafonnee_employeur: 2.02,
  vieillesse_deplafonnee_salarie: 0.40,
  allocations_familiales: 5.25,
  accidents_travail: 2.00,
  chomage_employeur: 4.05,
  ags: 0.15,
  retraite_t1_employeur: 4.72,
  retraite_t1_salarie: 3.15,
  ceg_t1_employeur: 1.29,
  ceg_t1_salarie: 0.86,
  csg_deductible: 6.80,
  csg_non_deductible: 2.40,
  crds: 0.50,
  plafond_ss_mensuel: 394100 // en centimes
};

/**
 * POST /api/admin/rh/paie/generer
 * Génère les écritures comptables de paie pour un mois
 */
router.post('/paie/generer', authenticateAdmin, async (req, res) => {
  try {
    const { periode, heures_supp } = req.body; // periode: "2026-02", heures_supp: [{membre_id, heures_25, heures_50}]

    if (!periode) {
      return res.status(400).json({ error: 'Période requise (format: YYYY-MM)' });
    }

    const [year, month] = periode.split('-');
    const dateDepense = `${year}-${month}-01`;

    // Récupérer les membres actifs
    const { data: membres } = await supabase
      .from('rh_membres')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('statut', 'actif');

    if (!membres || membres.length === 0) {
      return res.status(400).json({ error: 'Aucun employé actif' });
    }

    let totalSalairesNets = 0;
    let totalCotisationsPatronales = 0;
    let totalCotisationsSalariales = 0;
    const detailParMembre = [];

    // Calculer pour chaque membre
    for (const membre of membres) {
      const salaireBrut = membre.salaire_mensuel || 0;
      if (salaireBrut === 0) continue;

      // Heures supp pour ce membre
      const hs = heures_supp?.find(h => h.membre_id === membre.id) || { heures_25: 0, heures_50: 0 };
      const tauxHoraire = salaireBrut / 15167; // 151.67h en centimes
      const montantHS = Math.round((hs.heures_25 * tauxHoraire * 1.25) + (hs.heures_50 * tauxHoraire * 1.50));

      const brutTotal = salaireBrut + montantHS;
      const plafondSS = TAUX_COTISATIONS.plafond_ss_mensuel;
      const tranche1 = Math.min(brutTotal, plafondSS);

      // Cotisations patronales
      const cotisPatronales = Math.round(
        brutTotal * (TAUX_COTISATIONS.maladie_employeur +
                     TAUX_COTISATIONS.vieillesse_deplafonnee_employeur +
                     TAUX_COTISATIONS.allocations_familiales +
                     TAUX_COTISATIONS.accidents_travail +
                     TAUX_COTISATIONS.chomage_employeur +
                     TAUX_COTISATIONS.ags) / 100 +
        tranche1 * (TAUX_COTISATIONS.vieillesse_plafonnee_employeur +
                    TAUX_COTISATIONS.retraite_t1_employeur +
                    TAUX_COTISATIONS.ceg_t1_employeur) / 100
      );

      // Cotisations salariales
      const cotisSalariales = Math.round(
        brutTotal * (TAUX_COTISATIONS.vieillesse_deplafonnee_salarie) / 100 +
        tranche1 * (TAUX_COTISATIONS.vieillesse_plafonnee_salarie +
                    TAUX_COTISATIONS.retraite_t1_salarie +
                    TAUX_COTISATIONS.ceg_t1_salarie) / 100 +
        brutTotal * 0.9825 * (TAUX_COTISATIONS.csg_deductible +
                              TAUX_COTISATIONS.csg_non_deductible +
                              TAUX_COTISATIONS.crds) / 100
      );

      const salaireNet = brutTotal - cotisSalariales;

      totalSalairesNets += salaireNet;
      totalCotisationsPatronales += cotisPatronales;
      totalCotisationsSalariales += cotisSalariales;

      detailParMembre.push({
        membre_id: membre.id,
        nom: `${membre.prenom} ${membre.nom}`,
        brut: brutTotal,
        heures_supp: montantHS,
        cotisations_salariales: cotisSalariales,
        cotisations_patronales: cotisPatronales,
        net: salaireNet
      });
    }

    // Créer les écritures comptables (dépenses)
    // Vérifier si des dépenses existent déjà pour cette période (éviter doublons)
    const libelleSalaires = `Salaires nets - ${month}/${year}`;
    const libelleCotisations = `Cotisations sociales - ${month}/${year}`;

    const { data: depensesExistantes } = await supabase
      .from('depenses')
      .select('id, libelle')
      .eq('tenant_id', req.admin.tenant_id)
      .in('libelle', [libelleSalaires, libelleCotisations]);

    const salairesExiste = depensesExistantes?.some(d => d.libelle === libelleSalaires);
    const cotisationsExiste = depensesExistantes?.some(d => d.libelle === libelleCotisations);

    const ecritures = [];
    let depSalaires, depCotis;

    // 1. Dépense Salaires (net à payer) - seulement si n'existe pas
    if (!salairesExiste) {
      const { data, error: errSal } = await supabase
        .from('depenses')
        .insert({
          tenant_id: req.admin.tenant_id,
          categorie: 'salaires',
          libelle: libelleSalaires,
          description: `Paie du mois de ${month}/${year} - ${membres.length} salarié(s)`,
          montant: totalSalairesNets,
          montant_ttc: totalSalairesNets,
          taux_tva: 0,
          deductible_tva: false,
          date_depense: dateDepense,
          recurrence: 'ponctuelle',
          payee: false
        })
        .select()
        .single();

      if (errSal) throw errSal;
      depSalaires = data;
      ecritures.push(depSalaires);
    } else {
      // Récupérer l'existante
      depSalaires = depensesExistantes.find(d => d.libelle === libelleSalaires);
      console.log(`[RH] Dépense salaires déjà existante pour ${periode}, skip`);
    }

    // 2. Dépense Cotisations sociales (patronales + salariales) - seulement si n'existe pas
    const totalCotisations = totalCotisationsPatronales + totalCotisationsSalariales;

    if (!cotisationsExiste) {
      const { data, error: errCot } = await supabase
        .from('depenses')
        .insert({
          tenant_id: req.admin.tenant_id,
          categorie: 'cotisations_sociales',
          libelle: libelleCotisations,
          description: `Charges sociales: ${(totalCotisationsPatronales/100).toFixed(2)}€ patron + ${(totalCotisationsSalariales/100).toFixed(2)}€ salarié`,
          montant: totalCotisations,
          montant_ttc: totalCotisations,
          taux_tva: 0,
          deductible_tva: false,
          date_depense: dateDepense,
          recurrence: 'ponctuelle',
          payee: false
        })
        .select()
        .single();

      if (errCot) throw errCot;
      depCotis = data;
      ecritures.push(depCotis);
    } else {
      depCotis = depensesExistantes.find(d => d.libelle === libelleCotisations);
      console.log(`[RH] Dépense cotisations déjà existante pour ${periode}, skip`);
    }

    // Enregistrer le journal de paie
    const { data: journal, error: errJournal } = await supabase
      .from('rh_journal_paie')
      .upsert({
        tenant_id: req.admin.tenant_id,
        periode,
        total_brut: detailParMembre.reduce((s, m) => s + m.brut, 0),
        total_net: totalSalairesNets,
        total_cotisations_patronales: totalCotisationsPatronales,
        total_cotisations_salariales: totalCotisationsSalariales,
        nb_salaries: detailParMembre.length,
        detail: detailParMembre,
        depense_salaires_id: depSalaires.id,
        depense_cotisations_id: depCotis.id
      }, {
        onConflict: 'tenant_id,periode'
      })
      .select()
      .single();

    if (errJournal) throw errJournal;

    // Générer les écritures comptables dans le journal PA
    let ecrituresPA = [];
    try {
      ecrituresPA = await genererEcrituresPaie(
        req.admin.tenant_id,
        periode,
        totalSalairesNets,
        totalCotisationsPatronales,
        totalCotisationsSalariales,
        journal?.id
      );
      console.log(`[RH] Écritures PA générées: ${ecrituresPA.length} lignes`);
    } catch (errEcritures) {
      console.error('[RH] Erreur génération écritures PA:', errEcritures);
      // Ne pas bloquer si les écritures ne peuvent être générées
    }

    res.json({
      success: true,
      periode,
      journal,
      ecritures_comptables: ecrituresPA.length,
      ecritures: ecritures.map(e => ({
        id: e.id,
        categorie: e.categorie,
        libelle: e.libelle,
        montant: e.montant / 100
      })),
      totaux: {
        brut: detailParMembre.reduce((s, m) => s + m.brut, 0) / 100,
        net: totalSalairesNets / 100,
        cotisations_patronales: totalCotisationsPatronales / 100,
        cotisations_salariales: totalCotisationsSalariales / 100,
        cout_total: (totalSalairesNets + totalCotisations) / 100
      },
      detail: detailParMembre.map(m => ({
        ...m,
        brut: m.brut / 100,
        heures_supp: m.heures_supp / 100,
        cotisations_salariales: m.cotisations_salariales / 100,
        cotisations_patronales: m.cotisations_patronales / 100,
        net: m.net / 100
      }))
    });
  } catch (error) {
    console.error('[RH] Erreur génération paie:', error);
    res.status(500).json({ error: 'Erreur génération paie' });
  }
});

/**
 * GET /api/admin/rh/paie/journal
 * Récupère le journal de paie pour une période
 */
router.get('/paie/journal', authenticateAdmin, async (req, res) => {
  try {
    const { periode, annee } = req.query;

    let query = supabase
      .from('rh_journal_paie')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .order('periode', { ascending: false });

    if (periode) {
      query = query.eq('periode', periode);
    } else if (annee) {
      query = query.like('periode', `${annee}-%`);
    }

    const { data: journaux, error } = await query.limit(12);

    if (error) throw error;

    res.json(journaux || []);
  } catch (error) {
    console.error('[RH] Erreur journal paie:', error);
    res.status(500).json({ error: 'Erreur récupération journal' });
  }
});

// ============================================
// RECRUTEMENTS
// ============================================

/**
 * GET /api/admin/rh/recrutements
 * Liste des offres de recrutement
 */
router.get('/recrutements', authenticateAdmin, async (req, res) => {
  try {
    const { statut } = req.query;

    let query = supabase
      .from('rh_recrutements')
      .select(`
        *,
        candidatures:rh_candidatures(count)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .order('created_at', { ascending: false });

    if (statut) {
      query = query.eq('statut', statut);
    }

    const { data: recrutements, error } = await query;

    if (error) throw error;

    res.json(recrutements || []);
  } catch (error) {
    console.error('[RH] Erreur liste recrutements:', error);
    res.status(500).json({ error: 'Erreur récupération recrutements' });
  }
});

/**
 * POST /api/admin/rh/recrutements
 * Créer une offre de recrutement
 */
router.post('/recrutements', authenticateAdmin, async (req, res) => {
  try {
    const { titre, description, type_contrat, salaire_min, salaire_max, lieu, competences, date_limite } = req.body;

    if (!titre || !type_contrat) {
      return res.status(400).json({ error: 'Titre et type de contrat requis' });
    }

    const { data: recrutement, error } = await supabase
      .from('rh_recrutements')
      .insert({
        tenant_id: req.admin.tenant_id,
        titre,
        description,
        type_contrat,
        salaire_min: salaire_min || null,
        salaire_max: salaire_max || null,
        lieu,
        competences: competences || [],
        date_limite,
        statut: 'ouvert'
      })
      .select()
      .single();

    if (error) throw error;

    res.json(recrutement);
  } catch (error) {
    console.error('[RH] Erreur création recrutement:', error);
    res.status(500).json({ error: 'Erreur création offre' });
  }
});

/**
 * PUT /api/admin/rh/recrutements/:id
 * Modifier une offre de recrutement
 */
router.put('/recrutements/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { titre, description, type_contrat, salaire_min, salaire_max, lieu, competences, date_limite, statut } = req.body;

    const { data: recrutement, error } = await supabase
      .from('rh_recrutements')
      .update({
        titre,
        description,
        type_contrat,
        salaire_min,
        salaire_max,
        lieu,
        competences,
        date_limite,
        statut
      })
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    res.json(recrutement);
  } catch (error) {
    console.error('[RH] Erreur modification recrutement:', error);
    res.status(500).json({ error: 'Erreur modification offre' });
  }
});

/**
 * GET /api/admin/rh/candidatures
 * Liste des candidatures
 */
router.get('/candidatures', authenticateAdmin, async (req, res) => {
  try {
    const { recrutement_id, statut } = req.query;

    let query = supabase
      .from('rh_candidatures')
      .select(`
        *,
        recrutement:rh_recrutements(id, titre)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .order('created_at', { ascending: false });

    if (recrutement_id) {
      query = query.eq('recrutement_id', recrutement_id);
    }
    if (statut) {
      query = query.eq('statut', statut);
    }

    const { data: candidatures, error } = await query;

    if (error) throw error;

    res.json(candidatures || []);
  } catch (error) {
    console.error('[RH] Erreur liste candidatures:', error);
    res.status(500).json({ error: 'Erreur récupération candidatures' });
  }
});

/**
 * POST /api/admin/rh/candidatures
 * Ajouter une candidature
 */
router.post('/candidatures', authenticateAdmin, async (req, res) => {
  try {
    const { recrutement_id, nom, prenom, email, telephone, cv_url, lettre_motivation, source, notes } = req.body;

    if (!recrutement_id || !nom || !prenom || !email) {
      return res.status(400).json({ error: 'Recrutement, nom, prénom et email requis' });
    }

    const { data: candidature, error } = await supabase
      .from('rh_candidatures')
      .insert({
        tenant_id: req.admin.tenant_id,
        recrutement_id,
        nom,
        prenom,
        email,
        telephone,
        cv_url,
        lettre_motivation,
        source: source || 'direct',
        notes,
        statut: 'nouveau'
      })
      .select()
      .single();

    if (error) throw error;

    res.json(candidature);
  } catch (error) {
    console.error('[RH] Erreur ajout candidature:', error);
    res.status(500).json({ error: 'Erreur ajout candidature' });
  }
});

/**
 * PUT /api/admin/rh/candidatures/:id
 * Modifier le statut d'une candidature
 */
router.put('/candidatures/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { statut, notes, date_entretien } = req.body;

    const updates = {};
    if (statut) updates.statut = statut;
    if (notes !== undefined) updates.notes = notes;
    if (date_entretien) updates.date_entretien = date_entretien;

    const { data: candidature, error } = await supabase
      .from('rh_candidatures')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    res.json(candidature);
  } catch (error) {
    console.error('[RH] Erreur modification candidature:', error);
    res.status(500).json({ error: 'Erreur modification candidature' });
  }
});

// ============================================
// DOCUMENTS RH
// ============================================

/**
 * GET /api/admin/rh/documents/registre-personnel
 * Génère le registre unique du personnel
 */
router.get('/documents/registre-personnel', authenticateAdmin, async (req, res) => {
  try {
    const { data: membres } = await supabase
      .from('rh_membres')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .order('date_embauche', { ascending: true });

    res.json({
      titre: 'Registre Unique du Personnel',
      date_generation: new Date().toISOString(),
      employes: membres?.map((m, idx) => ({
        numero_ordre: idx + 1,
        nom: m.nom,
        prenom: m.prenom,
        date_naissance: m.date_naissance,
        sexe: m.sexe || 'Non renseigné',
        nationalite: m.nationalite || 'Française',
        emploi: m.role,
        qualification: m.qualification || m.role,
        date_entree: m.date_embauche,
        date_sortie: m.statut === 'inactif' ? m.updated_at : null,
        type_contrat: m.type_contrat || 'CDI',
        nir: m.nir ? `${m.nir.slice(0, 7)}***` : 'Non renseigné'
      })) || []
    });
  } catch (error) {
    console.error('[RH] Erreur registre personnel:', error);
    res.status(500).json({ error: 'Erreur génération registre' });
  }
});

/**
 * GET /api/admin/rh/documents/etat-cotisations
 * État récapitulatif des cotisations
 */
router.get('/documents/etat-cotisations', authenticateAdmin, async (req, res) => {
  try {
    const { periode } = req.query;

    if (!periode) {
      return res.status(400).json({ error: 'Période requise' });
    }

    const { data: journal } = await supabase
      .from('rh_journal_paie')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('periode', periode)
      .single();

    if (!journal) {
      return res.status(404).json({ error: 'Aucune paie pour cette période' });
    }

    // Répartition des cotisations
    const totalBrut = journal.total_brut;
    const plafondSS = TAUX_COTISATIONS.plafond_ss_mensuel * journal.nb_salaries;
    const tranche1 = Math.min(totalBrut, plafondSS);

    res.json({
      titre: 'État des Cotisations Sociales',
      periode,
      date_generation: new Date().toISOString(),
      nb_salaries: journal.nb_salaries,
      masse_salariale_brute: totalBrut / 100,
      cotisations: {
        urssaf: {
          maladie: (totalBrut * TAUX_COTISATIONS.maladie_employeur / 100) / 100,
          vieillesse: ((totalBrut * TAUX_COTISATIONS.vieillesse_deplafonnee_employeur / 100) +
                       (tranche1 * TAUX_COTISATIONS.vieillesse_plafonnee_employeur / 100)) / 100,
          allocations_familiales: (totalBrut * TAUX_COTISATIONS.allocations_familiales / 100) / 100,
          accidents_travail: (totalBrut * TAUX_COTISATIONS.accidents_travail / 100) / 100,
          csg_crds: (totalBrut * 0.9825 * (TAUX_COTISATIONS.csg_deductible +
                                           TAUX_COTISATIONS.csg_non_deductible +
                                           TAUX_COTISATIONS.crds) / 100) / 100
        },
        pole_emploi: {
          chomage: (totalBrut * TAUX_COTISATIONS.chomage_employeur / 100) / 100,
          ags: (totalBrut * TAUX_COTISATIONS.ags / 100) / 100
        },
        retraite: {
          agirc_arrco_t1: (tranche1 * (TAUX_COTISATIONS.retraite_t1_employeur + TAUX_COTISATIONS.retraite_t1_salarie) / 100) / 100,
          ceg: (tranche1 * (TAUX_COTISATIONS.ceg_t1_employeur + TAUX_COTISATIONS.ceg_t1_salarie) / 100) / 100
        }
      },
      total_patronal: journal.total_cotisations_patronales / 100,
      total_salarial: journal.total_cotisations_salariales / 100,
      total_cotisations: (journal.total_cotisations_patronales + journal.total_cotisations_salariales) / 100
    });
  } catch (error) {
    console.error('[RH] Erreur état cotisations:', error);
    res.status(500).json({ error: 'Erreur génération état' });
  }
});

// ============================================
// PLANNING EMPLOYÉS
// ============================================

/**
 * GET /api/admin/rh/planning
 * Planning des réservations par employé
 */
router.get('/planning', authenticateAdmin, async (req, res) => {
  try {
    const { membre_id, date_debut, date_fin } = req.query;

    let query = supabase
      .from('reservations')
      .select(`
        id,
        date,
        heure,
        service_nom,
        duree_minutes,
        statut,
        prix_total,
        notes,
        membre_id,
        client:clients(id, nom, prenom, telephone),
        membre:rh_membres(id, nom, prenom, role)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .not('statut', 'eq', 'annule')
      .order('date', { ascending: true })
      .order('heure', { ascending: true });

    if (membre_id) {
      query = query.eq('membre_id', membre_id);
    }
    if (date_debut) {
      query = query.gte('date', date_debut);
    }
    if (date_fin) {
      query = query.lte('date', date_fin);
    }

    const { data: planning, error } = await query;

    if (error) throw error;

    // Grouper par jour
    const planningParJour = {};
    (planning || []).forEach(rdv => {
      const jour = rdv.date;
      if (!planningParJour[jour]) {
        planningParJour[jour] = [];
      }
      planningParJour[jour].push({
        id: rdv.id,
        heure: rdv.heure,
        service: rdv.service_nom,
        duree: rdv.duree_minutes,
        statut: rdv.statut,
        prix: rdv.prix_total ? rdv.prix_total / 100 : 0,
        client: rdv.client ? `${rdv.client.prenom} ${rdv.client.nom}` : 'N/A',
        client_tel: rdv.client?.telephone,
        employe: rdv.membre ? `${rdv.membre.prenom} ${rdv.membre.nom}` : 'Non assigné',
        employe_id: rdv.membre_id
      });
    });

    // Calculer les stats
    const totalRdv = planning?.length || 0;
    const totalHeures = (planning || []).reduce((sum, rdv) => sum + (rdv.duree_minutes || 60), 0) / 60;
    const totalCA = (planning || []).filter(r => r.statut === 'termine').reduce((sum, r) => sum + (r.prix_total || 0), 0) / 100;

    res.json({
      planning: planningParJour,
      stats: {
        total_rdv: totalRdv,
        total_heures: Math.round(totalHeures * 10) / 10,
        ca_potentiel: totalCA
      }
    });
  } catch (error) {
    console.error('[RH] Erreur planning:', error);
    res.status(500).json({ error: 'Erreur récupération planning' });
  }
});

/**
 * GET /api/admin/rh/membres/:id/planning
 * Planning d'un employé spécifique
 */
router.get('/membres/:id/planning', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { semaine } = req.query; // format: YYYY-WW ou date de début de semaine

    // Calculer les dates de la semaine
    let dateDebut, dateFin;
    if (semaine) {
      const [year, week] = semaine.split('-W');
      const firstDayOfYear = new Date(parseInt(year), 0, 1);
      const daysOffset = (parseInt(week) - 1) * 7;
      dateDebut = new Date(firstDayOfYear.getTime() + daysOffset * 24 * 60 * 60 * 1000);
      dateFin = new Date(dateDebut.getTime() + 6 * 24 * 60 * 60 * 1000);
    } else {
      // Semaine courante par défaut
      const now = new Date();
      const dayOfWeek = now.getDay();
      dateDebut = new Date(now);
      dateDebut.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      dateFin = new Date(dateDebut);
      dateFin.setDate(dateDebut.getDate() + 6);
    }

    const dateDebutStr = dateDebut.toISOString().split('T')[0];
    const dateFinStr = dateFin.toISOString().split('T')[0];

    // Récupérer l'employé
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!membre) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    // Récupérer les réservations
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select(`
        id,
        date,
        heure,
        service_nom,
        duree_minutes,
        statut,
        prix_total,
        client:clients(id, nom, prenom, telephone)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .eq('membre_id', id)
      .gte('date', dateDebutStr)
      .lte('date', dateFinStr)
      .not('statut', 'eq', 'annule')
      .order('date', { ascending: true })
      .order('heure', { ascending: true });

    if (error) throw error;

    // Récupérer les absences de la période
    const { data: absences } = await supabase
      .from('rh_absences')
      .select('*')
      .eq('membre_id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .lte('date_debut', dateFinStr)
      .gte('date_fin', dateDebutStr)
      .eq('statut', 'approuve');

    // Organiser par jour
    const planningHebdo = {};
    for (let d = new Date(dateDebut); d <= dateFin; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      planningHebdo[dateStr] = {
        rdv: [],
        absent: false,
        type_absence: null
      };
    }

    // Marquer les jours d'absence
    (absences || []).forEach(abs => {
      for (let d = new Date(abs.date_debut); d <= new Date(abs.date_fin); d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (planningHebdo[dateStr]) {
          planningHebdo[dateStr].absent = true;
          planningHebdo[dateStr].type_absence = abs.type;
        }
      }
    });

    // Ajouter les RDV
    (reservations || []).forEach(rdv => {
      if (planningHebdo[rdv.date]) {
        planningHebdo[rdv.date].rdv.push({
          id: rdv.id,
          heure: rdv.heure,
          service: rdv.service_nom,
          duree: rdv.duree_minutes || 60,
          statut: rdv.statut,
          prix: rdv.prix_total ? rdv.prix_total / 100 : 0,
          client: rdv.client ? `${rdv.client.prenom} ${rdv.client.nom}` : 'N/A',
          client_tel: rdv.client?.telephone
        });
      }
    });

    // Stats de la semaine
    const totalMinutes = (reservations || []).reduce((sum, r) => sum + (r.duree_minutes || 60), 0);
    const caRealise = (reservations || []).filter(r => r.statut === 'termine').reduce((sum, r) => sum + (r.prix_total || 0), 0) / 100;

    res.json({
      membre: {
        id: membre.id,
        nom: membre.nom,
        prenom: membre.prenom,
        role: membre.role
      },
      semaine: {
        debut: dateDebutStr,
        fin: dateFinStr
      },
      planning: planningHebdo,
      stats: {
        total_rdv: reservations?.length || 0,
        heures_travaillees: Math.round((totalMinutes / 60) * 10) / 10,
        ca_realise: caRealise,
        jours_absence: Object.values(planningHebdo).filter(j => j.absent).length
      }
    });
  } catch (error) {
    console.error('[RH] Erreur planning membre:', error);
    res.status(500).json({ error: 'Erreur récupération planning' });
  }
});

export default router;
