/**
 * Routes Journaux Comptables
 * Gestion des journaux et écritures comptables
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import { supabase } from '../config/supabase.js';

const router = express.Router();

// Tous les routes nécessitent authentification
router.use(authenticateAdmin);

// Codes journaux disponibles
const JOURNAUX = {
  BQ: { code: 'BQ', libelle: 'Journal de Banque', description: 'Mouvements bancaires (CB, virement, prélèvement)' },
  CA: { code: 'CA', libelle: 'Journal de Caisse', description: 'Mouvements espèces' },
  VT: { code: 'VT', libelle: 'Journal des Ventes', description: 'Factures clients' },
  AC: { code: 'AC', libelle: 'Journal des Achats', description: 'Factures fournisseurs' },
  PA: { code: 'PA', libelle: 'Journal de Paie', description: 'Salaires et cotisations' },
  OD: { code: 'OD', libelle: 'Opérations Diverses', description: 'Écritures diverses' },
  AN: { code: 'AN', libelle: 'À Nouveaux', description: 'Reports à nouveau' }
};

// Modes de paiement et leur journal associé
const MODES_PAIEMENT = {
  especes: { journal: 'CA', compte: '530', libelle: 'Caisse' },
  cb: { journal: 'BQ', compte: '512', libelle: 'Banque' },
  virement: { journal: 'BQ', compte: '512', libelle: 'Banque' },
  prelevement: { journal: 'BQ', compte: '512', libelle: 'Banque' },
  cheque: { journal: 'BQ', compte: '512', libelle: 'Banque' }
};

// Mapping catégories dépenses vers comptes
const COMPTE_DEPENSE = {
  fournitures: { numero: '601', libelle: 'Achats fournitures' },
  loyer: { numero: '613', libelle: 'Loyers' },
  charges: { numero: '606', libelle: 'Électricité/Eau' },
  telecom: { numero: '626', libelle: 'Télécom/Internet' },
  assurance: { numero: '616', libelle: 'Assurances' },
  transport: { numero: '625', libelle: 'Déplacements' },
  marketing: { numero: '623', libelle: 'Publicité' },
  bancaire: { numero: '627', libelle: 'Frais bancaires' },
  formation: { numero: '618', libelle: 'Formation' },
  materiel: { numero: '615', libelle: 'Entretien matériel' },
  logiciel: { numero: '651', libelle: 'Abonnements' },
  comptabilite: { numero: '622', libelle: 'Honoraires' },
  taxes: { numero: '635', libelle: 'Impôts et taxes' },
  salaires: { numero: '641', libelle: 'Rémunérations personnel' },
  cotisations_sociales: { numero: '645', libelle: 'Charges sociales' },
  autre: { numero: '658', libelle: 'Charges diverses' }
};

/**
 * Initialise les journaux pour un tenant s'ils n'existent pas
 */
async function initJournaux(tenantId) {
  for (const j of Object.values(JOURNAUX)) {
    await supabase
      .from('journaux_comptables')
      .upsert({
        tenant_id: tenantId,
        code: j.code,
        libelle: j.libelle,
        description: j.description
      }, {
        onConflict: 'tenant_id,code'
      });
  }
}

// ============================================
// JOURNAUX
// ============================================

/**
 * GET /api/journaux
 * Liste des journaux comptables
 */
router.get('/', async (req, res) => {
  try {
    await initJournaux(req.admin.tenant_id);

    const { data: journaux, error } = await supabase
      .from('journaux_comptables')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .order('code');

    if (error) throw error;

    res.json(journaux || []);
  } catch (error) {
    console.error('[JOURNAUX] Erreur liste:', error);
    res.status(500).json({ error: 'Erreur récupération journaux' });
  }
});

// ============================================
// ÉCRITURES
// ============================================

/**
 * GET /api/journaux/ecritures
 * Liste des écritures avec filtres
 */
router.get('/ecritures', async (req, res) => {
  try {
    const { journal, periode, compte, non_lettrees } = req.query;

    let query = supabase
      .from('ecritures_comptables')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .order('date_ecriture', { ascending: false })
      .order('id', { ascending: false });

    if (journal) {
      query = query.eq('journal_code', journal);
    }
    if (periode) {
      query = query.eq('periode', periode);
    }
    if (compte) {
      query = query.eq('compte_numero', compte);
    }
    if (non_lettrees === 'true') {
      query = query.is('lettrage', null);
    }

    const { data: ecritures, error } = await query.limit(500);

    if (error) throw error;

    // Calculer totaux (pour la période affichée)
    const totalDebit = ecritures?.reduce((s, e) => s + (e.debit || 0), 0) || 0;
    const totalCredit = ecritures?.reduce((s, e) => s + (e.credit || 0), 0) || 0;

    // Pour les journaux BQ et CA, calculer le solde CUMULATIF
    // Le solde doit inclure TOUTES les écritures jusqu'à la période sélectionnée
    let soldeTresorerie = null;
    let labelSolde = null;

    // Configuration des journaux de trésorerie
    const journauxTresorerie = {
      BQ: { compte: '512', label: 'solde_banque' },
      CA: { compte: '530', label: 'solde_caisse' }
    };

    if (journauxTresorerie[journal]) {
      const config = journauxTresorerie[journal];
      labelSolde = config.label;

      // Récupérer TOUTES les écritures du compte jusqu'à la période sélectionnée (cumulatif)
      let queryTresorerie = supabase
        .from('ecritures_comptables')
        .select('debit, credit')
        .eq('tenant_id', req.admin.tenant_id)
        .eq('journal_code', journal)
        .eq('compte_numero', config.compte);

      // Si période spécifiée, prendre tout jusqu'à cette période incluse
      if (periode) {
        queryTresorerie = queryTresorerie.lte('periode', periode);
      }

      const { data: ecrituresTreso, error: errTreso } = await queryTresorerie;

      if (!errTreso && ecrituresTreso) {
        const debitTreso = ecrituresTreso.reduce((s, e) => s + (e.debit || 0), 0);
        const creditTreso = ecrituresTreso.reduce((s, e) => s + (e.credit || 0), 0);
        // Solde: débit = encaissements, crédit = décaissements
        // Solde positif = plus d'encaissements que de décaissements
        soldeTresorerie = (debitTreso - creditTreso) / 100; // Convertir en euros
      }
    }

    res.json({
      ecritures: ecritures || [],
      totaux: {
        debit: totalDebit,
        credit: totalCredit,
        solde: totalDebit - totalCredit,
        ...(soldeTresorerie !== null && { [labelSolde]: soldeTresorerie }),
        // Garder solde_banque pour rétrocompatibilité
        ...(journal === 'BQ' && soldeTresorerie !== null && { solde_banque: soldeTresorerie })
      }
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur écritures:', error);
    res.status(500).json({ error: 'Erreur récupération écritures' });
  }
});

/**
 * GET /api/journaux/ecritures/banque
 * Écritures du journal banque pour le rapprochement
 */
router.get('/ecritures/banque', async (req, res) => {
  try {
    const { periode, non_pointees } = req.query;

    let query = supabase
      .from('ecritures_comptables')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('journal_code', 'BQ')
      .eq('compte_numero', '512')
      .order('date_ecriture', { ascending: false });

    if (periode) {
      query = query.eq('periode', periode);
    }
    if (non_pointees === 'true') {
      query = query.is('lettrage', null);
    }

    const { data: ecritures, error } = await query;

    if (error) throw error;

    // Calculer le solde CUMULATIF (toutes les écritures jusqu'à la période incluse)
    let queryCumulatif = supabase
      .from('ecritures_comptables')
      .select('debit, credit')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('journal_code', 'BQ')
      .eq('compte_numero', '512');

    if (periode) {
      queryCumulatif = queryCumulatif.lte('periode', periode);
    }

    const { data: ecrituresCumulatif, error: errCumulatif } = await queryCumulatif;

    let soldeCumulatif = 0;
    if (!errCumulatif && ecrituresCumulatif) {
      const totalDebit = ecrituresCumulatif.reduce((s, e) => s + (e.debit || 0), 0);
      const totalCredit = ecrituresCumulatif.reduce((s, e) => s + (e.credit || 0), 0);
      soldeCumulatif = (totalDebit - totalCredit) / 100;
    }

    // Calculer le mouvement du mois (pour info)
    const mouvementDebit = ecritures?.reduce((s, e) => s + (e.debit || 0), 0) || 0;
    const mouvementCredit = ecritures?.reduce((s, e) => s + (e.credit || 0), 0) || 0;

    res.json({
      ecritures: ecritures?.map(e => ({
        ...e,
        debit_euros: (e.debit / 100).toFixed(2),
        credit_euros: (e.credit / 100).toFixed(2)
      })) || [],
      solde_comptable: soldeCumulatif, // Solde cumulatif
      mouvement_mois: {
        debit: mouvementDebit / 100,
        credit: mouvementCredit / 100,
        solde: (mouvementDebit - mouvementCredit) / 100
      }
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur écritures banque:', error);
    res.status(500).json({ error: 'Erreur récupération écritures banque' });
  }
});

/**
 * POST /api/journaux/ecritures
 * Créer une écriture manuelle (OD)
 */
router.post('/ecritures', async (req, res) => {
  try {
    const { journal_code, date_ecriture, numero_piece, lignes } = req.body;

    if (!journal_code || !date_ecriture || !lignes || lignes.length === 0) {
      return res.status(400).json({ error: 'Données incomplètes' });
    }

    // Vérifier équilibre débit/crédit
    const totalDebit = lignes.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lignes.reduce((s, l) => s + (l.credit || 0), 0);

    if (totalDebit !== totalCredit) {
      return res.status(400).json({ error: 'Écriture non équilibrée' });
    }

    const periode = date_ecriture.slice(0, 7);
    const exercice = parseInt(date_ecriture.slice(0, 4));

    const ecritures = lignes.map(l => ({
      tenant_id: req.admin.tenant_id,
      journal_code,
      date_ecriture,
      numero_piece,
      compte_numero: l.compte_numero,
      compte_libelle: l.compte_libelle,
      libelle: l.libelle,
      debit: l.debit || 0,
      credit: l.credit || 0,
      periode,
      exercice
    }));

    const { data, error } = await supabase
      .from('ecritures_comptables')
      .insert(ecritures)
      .select();

    if (error) throw error;

    res.json({ success: true, ecritures: data });
  } catch (error) {
    console.error('[JOURNAUX] Erreur création écriture:', error);
    res.status(500).json({ error: 'Erreur création écriture' });
  }
});

/**
 * POST /api/journaux/ecritures/pointer
 * Pointer des écritures (lettrage pour rapprochement)
 */
router.post('/ecritures/pointer', async (req, res) => {
  try {
    const { ids, lettrage } = req.body;

    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: 'Aucune écriture sélectionnée' });
    }

    const { error } = await supabase
      .from('ecritures_comptables')
      .update({
        lettrage: lettrage || `R${Date.now().toString(36).toUpperCase()}`,
        date_lettrage: new Date().toISOString().split('T')[0]
      })
      .in('id', ids)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('[JOURNAUX] Erreur pointage:', error);
    res.status(500).json({ error: 'Erreur pointage écritures' });
  }
});

// ============================================
// GÉNÉRATION AUTOMATIQUE DES ÉCRITURES
// ============================================

/**
 * POST /api/journaux/generer/facture
 * Génère les écritures pour une facture
 */
router.post('/generer/facture', async (req, res) => {
  try {
    const { facture_id } = req.body;

    // Récupérer la facture
    const { data: facture, error: errFact } = await supabase
      .from('factures')
      .select('*')
      .eq('id', facture_id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (errFact || !facture) {
      return res.status(404).json({ error: 'Facture non trouvée' });
    }

    // Vérifier si écritures déjà générées
    const { data: existantes } = await supabase
      .from('ecritures_comptables')
      .select('id')
      .eq('facture_id', facture_id)
      .eq('tenant_id', req.admin.tenant_id);

    if (existantes && existantes.length > 0) {
      return res.status(400).json({ error: 'Écritures déjà générées pour cette facture' });
    }

    const dateFacture = facture.date_facture;
    const periode = dateFacture.slice(0, 7);
    const exercice = parseInt(dateFacture.slice(0, 4));
    const montantTTC = facture.montant_ttc || 0;
    const montantHT = facture.montant_ht || montantTTC;
    const montantTVA = facture.montant_tva || (montantTTC - montantHT);

    const ecritures = [];

    // Journal VT - Écriture de vente
    // Débit 411 Client
    ecritures.push({
      tenant_id: req.admin.tenant_id,
      journal_code: 'VT',
      date_ecriture: dateFacture,
      numero_piece: facture.numero,
      compte_numero: '411',
      compte_libelle: 'Clients',
      libelle: `Facture ${facture.numero} - ${facture.client_nom}`,
      debit: montantTTC,
      credit: 0,
      facture_id,
      periode,
      exercice
    });

    // Crédit 706 Prestations
    ecritures.push({
      tenant_id: req.admin.tenant_id,
      journal_code: 'VT',
      date_ecriture: dateFacture,
      numero_piece: facture.numero,
      compte_numero: '706',
      compte_libelle: 'Prestations de services',
      libelle: `Facture ${facture.numero} - ${facture.client_nom}`,
      debit: 0,
      credit: montantHT,
      facture_id,
      periode,
      exercice
    });

    // Crédit 44571 TVA collectée
    if (montantTVA > 0) {
      ecritures.push({
        tenant_id: req.admin.tenant_id,
        journal_code: 'VT',
        date_ecriture: dateFacture,
        numero_piece: facture.numero,
        compte_numero: '44571',
        compte_libelle: 'TVA collectée',
        libelle: `TVA Facture ${facture.numero}`,
        debit: 0,
        credit: montantTVA,
        facture_id,
        periode,
        exercice
      });
    }

    // Si facture payée, écriture banque ou caisse selon mode de paiement
    if (facture.statut === 'payee') {
      const datePaiement = facture.date_paiement || dateFacture;
      const periodePaie = datePaiement.slice(0, 7);

      // Déterminer le journal et compte selon le mode de paiement
      const modePaiement = facture.mode_paiement || 'cb';
      const configPaiement = MODES_PAIEMENT[modePaiement] || MODES_PAIEMENT.cb;
      const journalCode = configPaiement.journal;
      const compteNumero = configPaiement.compte;
      const compteLibelle = configPaiement.libelle;

      // Débit compte trésorerie (512 Banque ou 530 Caisse)
      ecritures.push({
        tenant_id: req.admin.tenant_id,
        journal_code: journalCode,
        date_ecriture: datePaiement,
        numero_piece: facture.numero,
        compte_numero: compteNumero,
        compte_libelle: compteLibelle,
        libelle: `Encaissement ${facture.numero} - ${facture.client_nom}`,
        debit: montantTTC,
        credit: 0,
        facture_id,
        periode: periodePaie,
        exercice
      });

      // Crédit 411 Client
      ecritures.push({
        tenant_id: req.admin.tenant_id,
        journal_code: journalCode,
        date_ecriture: datePaiement,
        numero_piece: facture.numero,
        compte_numero: '411',
        compte_libelle: 'Clients',
        libelle: `Règlement ${facture.numero} - ${facture.client_nom}`,
        debit: 0,
        credit: montantTTC,
        facture_id,
        periode: periodePaie,
        exercice
      });
    }

    const { data, error } = await supabase
      .from('ecritures_comptables')
      .insert(ecritures)
      .select();

    if (error) throw error;

    res.json({ success: true, ecritures: data });
  } catch (error) {
    console.error('[JOURNAUX] Erreur génération facture:', error);
    res.status(500).json({ error: 'Erreur génération écritures facture' });
  }
});

/**
 * POST /api/journaux/generer/depense
 * Génère les écritures pour une dépense
 */
router.post('/generer/depense', async (req, res) => {
  try {
    const { depense_id } = req.body;

    // Récupérer la dépense
    const { data: depense, error: errDep } = await supabase
      .from('depenses')
      .select('*')
      .eq('id', depense_id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (errDep || !depense) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    // Vérifier si écritures déjà générées
    const { data: existantes } = await supabase
      .from('ecritures_comptables')
      .select('id')
      .eq('depense_id', depense_id)
      .eq('tenant_id', req.admin.tenant_id);

    if (existantes && existantes.length > 0) {
      return res.status(400).json({ error: 'Écritures déjà générées pour cette dépense' });
    }

    const dateDepense = depense.date_depense;
    const periode = dateDepense.slice(0, 7);
    const exercice = parseInt(dateDepense.slice(0, 4));
    const montantTTC = depense.montant_ttc || depense.montant || 0;
    const montantHT = depense.montant || montantTTC;
    const montantTVA = depense.montant_tva || 0;
    const compteCharge = COMPTE_DEPENSE[depense.categorie] || COMPTE_DEPENSE.autre;

    const ecritures = [];

    // Journal AC - Écriture d'achat
    // Débit compte de charge
    ecritures.push({
      tenant_id: req.admin.tenant_id,
      journal_code: 'AC',
      date_ecriture: dateDepense,
      numero_piece: `DEP-${depense.id}`,
      compte_numero: compteCharge.numero,
      compte_libelle: compteCharge.libelle,
      libelle: depense.libelle || depense.categorie,
      debit: montantHT,
      credit: 0,
      depense_id,
      periode,
      exercice
    });

    // Débit 44566 TVA déductible
    if (montantTVA > 0 && depense.deductible_tva !== false) {
      ecritures.push({
        tenant_id: req.admin.tenant_id,
        journal_code: 'AC',
        date_ecriture: dateDepense,
        numero_piece: `DEP-${depense.id}`,
        compte_numero: '44566',
        compte_libelle: 'TVA déductible',
        libelle: `TVA ${depense.libelle || depense.categorie}`,
        debit: montantTVA,
        credit: 0,
        depense_id,
        periode,
        exercice
      });
    }

    // Crédit 401 Fournisseurs
    ecritures.push({
      tenant_id: req.admin.tenant_id,
      journal_code: 'AC',
      date_ecriture: dateDepense,
      numero_piece: `DEP-${depense.id}`,
      compte_numero: '401',
      compte_libelle: 'Fournisseurs',
      libelle: depense.libelle || depense.categorie,
      debit: 0,
      credit: montantTTC,
      depense_id,
      periode,
      exercice
    });

    // Si dépense payée, écriture banque
    if (depense.payee !== false) {
      const datePaiement = depense.date_paiement?.split('T')[0] || dateDepense;
      const periodePaie = datePaiement.slice(0, 7);

      // Journal BQ - Paiement
      // Débit 401 Fournisseurs
      ecritures.push({
        tenant_id: req.admin.tenant_id,
        journal_code: 'BQ',
        date_ecriture: datePaiement,
        numero_piece: `DEP-${depense.id}`,
        compte_numero: '401',
        compte_libelle: 'Fournisseurs',
        libelle: `Règlement ${depense.libelle || depense.categorie}`,
        debit: montantTTC,
        credit: 0,
        depense_id,
        periode: periodePaie,
        exercice
      });

      // Crédit 512 Banque
      ecritures.push({
        tenant_id: req.admin.tenant_id,
        journal_code: 'BQ',
        date_ecriture: datePaiement,
        numero_piece: `DEP-${depense.id}`,
        compte_numero: '512',
        compte_libelle: 'Banque',
        libelle: `Paiement ${depense.libelle || depense.categorie}`,
        debit: 0,
        credit: montantTTC,
        depense_id,
        periode: periodePaie,
        exercice
      });
    }

    const { data, error } = await supabase
      .from('ecritures_comptables')
      .insert(ecritures)
      .select();

    if (error) throw error;

    res.json({ success: true, ecritures: data });
  } catch (error) {
    console.error('[JOURNAUX] Erreur génération dépense:', error);
    res.status(500).json({ error: 'Erreur génération écritures dépense' });
  }
});

/**
 * POST /api/journaux/generer/paie
 * Génère les écritures de paie
 */
router.post('/generer/paie', async (req, res) => {
  try {
    const { periode, salaires_net, cotisations_patronales, cotisations_salariales, paie_journal_id } = req.body;

    if (!periode || salaires_net === undefined) {
      return res.status(400).json({ error: 'Données de paie incomplètes' });
    }

    const dateEcriture = `${periode}-28`; // Fin de mois
    const exercice = parseInt(periode.slice(0, 4));
    const totalCotisations = (cotisations_patronales || 0) + (cotisations_salariales || 0);
    const brutTotal = salaires_net + (cotisations_salariales || 0);

    const ecritures = [];

    // Journal PA - Écritures de paie

    // 1. Charge de personnel (brut)
    ecritures.push({
      tenant_id: req.admin.tenant_id,
      journal_code: 'PA',
      date_ecriture: dateEcriture,
      numero_piece: `PAIE-${periode}`,
      compte_numero: '641',
      compte_libelle: 'Rémunérations personnel',
      libelle: `Salaires bruts ${periode}`,
      debit: brutTotal,
      credit: 0,
      paie_journal_id,
      periode,
      exercice
    });

    // 2. Charges sociales patronales
    if (cotisations_patronales > 0) {
      ecritures.push({
        tenant_id: req.admin.tenant_id,
        journal_code: 'PA',
        date_ecriture: dateEcriture,
        numero_piece: `PAIE-${periode}`,
        compte_numero: '645',
        compte_libelle: 'Charges sociales',
        libelle: `Cotisations patronales ${periode}`,
        debit: cotisations_patronales,
        credit: 0,
        paie_journal_id,
        periode,
        exercice
      });
    }

    // 3. Personnel - rémunérations dues (net à payer)
    ecritures.push({
      tenant_id: req.admin.tenant_id,
      journal_code: 'PA',
      date_ecriture: dateEcriture,
      numero_piece: `PAIE-${periode}`,
      compte_numero: '421',
      compte_libelle: 'Personnel - Rémunérations dues',
      libelle: `Salaires nets à payer ${periode}`,
      debit: 0,
      credit: salaires_net,
      paie_journal_id,
      periode,
      exercice
    });

    // 4. Organismes sociaux (total cotisations)
    if (totalCotisations > 0) {
      ecritures.push({
        tenant_id: req.admin.tenant_id,
        journal_code: 'PA',
        date_ecriture: dateEcriture,
        numero_piece: `PAIE-${periode}`,
        compte_numero: '431',
        compte_libelle: 'Sécurité sociale',
        libelle: `Cotisations sociales ${periode}`,
        debit: 0,
        credit: totalCotisations,
        paie_journal_id,
        periode,
        exercice
      });
    }

    const { data, error } = await supabase
      .from('ecritures_comptables')
      .insert(ecritures)
      .select();

    if (error) throw error;

    res.json({ success: true, ecritures: data });
  } catch (error) {
    console.error('[JOURNAUX] Erreur génération paie:', error);
    res.status(500).json({ error: 'Erreur génération écritures paie' });
  }
});

/**
 * POST /api/journaux/generer/tout
 * Régénère toutes les écritures depuis les factures et dépenses existantes
 */
router.post('/generer/tout', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    console.log(`[JOURNAUX] Début régénération complète pour tenant ${tenantId}`);

    // Supprimer les anciennes écritures
    const { error: deleteError } = await supabase
      .from('ecritures_comptables')
      .delete()
      .eq('tenant_id', tenantId);

    if (deleteError) {
      console.error('[JOURNAUX] Erreur suppression anciennes écritures:', deleteError);
    }

    // Récupérer toutes les factures (sauf annulées)
    const { data: factures, error: factError } = await supabase
      .from('factures')
      .select('id, numero, statut')
      .eq('tenant_id', tenantId)
      .neq('statut', 'annulee');

    if (factError) {
      console.error('[JOURNAUX] Erreur récupération factures:', factError);
    }

    console.log(`[JOURNAUX] ${factures?.length || 0} factures à traiter`);

    // Récupérer toutes les dépenses
    const { data: depenses, error: depError } = await supabase
      .from('depenses')
      .select('id')
      .eq('tenant_id', tenantId);

    if (depError) {
      console.error('[JOURNAUX] Erreur récupération dépenses:', depError);
    }

    console.log(`[JOURNAUX] ${depenses?.length || 0} dépenses à traiter`);

    let nbFactures = 0;
    let nbDepenses = 0;
    const erreurs = [];

    // Générer écritures factures
    for (const f of factures || []) {
      try {
        await generateFactureEcritures(tenantId, f.id);
        nbFactures++;
      } catch (e) {
        console.error(`[JOURNAUX] Erreur facture ${f.numero || f.id}:`, e.message);
        erreurs.push({ type: 'facture', id: f.id, numero: f.numero, error: e.message });
      }
    }

    // Générer écritures dépenses
    for (const d of depenses || []) {
      try {
        await generateDepenseEcritures(tenantId, d.id);
        nbDepenses++;
      } catch (e) {
        console.error(`[JOURNAUX] Erreur dépense ${d.id}:`, e.message);
        erreurs.push({ type: 'depense', id: d.id, error: e.message });
      }
    }

    console.log(`[JOURNAUX] Régénération terminée: ${nbFactures} factures, ${nbDepenses} dépenses, ${erreurs.length} erreurs`);

    res.json({
      success: true,
      message: `Écritures générées: ${nbFactures} factures, ${nbDepenses} dépenses`,
      details: {
        factures: nbFactures,
        depenses: nbDepenses,
        erreurs: erreurs.length
      },
      erreurs: erreurs.length > 0 ? erreurs : undefined
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur génération complète:', error);
    res.status(500).json({ error: 'Erreur génération écritures', details: error.message });
  }
});

// Fonction helper pour générer écritures facture
async function generateFactureEcritures(tenantId, factureId) {
  const { data: facture, error } = await supabase
    .from('factures')
    .select('*')
    .eq('id', factureId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !facture) {
    console.error(`[JOURNAUX] Facture ${factureId} non trouvée:`, error?.message);
    return;
  }

  const dateFacture = facture.date_facture;
  const periode = dateFacture.slice(0, 7);
  const exercice = parseInt(dateFacture.slice(0, 4));
  const montantTTC = facture.montant_ttc || 0;
  const montantHT = facture.montant_ht || montantTTC;
  const montantTVA = facture.montant_tva || 0;

  // Sous-compte client (411 + client_id sur 5 chiffres)
  const compteClient = facture.client_id ? getCompteClient(facture.client_id) : '411';
  const libelleClient = facture.client_nom ? `Client ${facture.client_nom}` : 'Clients';

  const ecritures = [
    {
      tenant_id: tenantId,
      journal_code: 'VT',
      date_ecriture: dateFacture,
      numero_piece: facture.numero,
      compte_numero: compteClient,
      compte_libelle: libelleClient,
      libelle: `Facture ${facture.numero} - ${facture.client_nom}`,
      debit: montantTTC,
      credit: 0,
      facture_id: factureId,
      periode,
      exercice
    },
    {
      tenant_id: tenantId,
      journal_code: 'VT',
      date_ecriture: dateFacture,
      numero_piece: facture.numero,
      compte_numero: '706',
      compte_libelle: 'Prestations de services',
      libelle: `Facture ${facture.numero}`,
      debit: 0,
      credit: montantHT,
      facture_id: factureId,
      periode,
      exercice
    }
  ];

  if (montantTVA > 0) {
    ecritures.push({
      tenant_id: tenantId,
      journal_code: 'VT',
      date_ecriture: dateFacture,
      numero_piece: facture.numero,
      compte_numero: '44571',
      compte_libelle: 'TVA collectée',
      libelle: `TVA ${facture.numero}`,
      debit: 0,
      credit: montantTVA,
      facture_id: factureId,
      periode,
      exercice
    });
  }

  if (facture.statut === 'payee') {
    const datePaiement = facture.date_paiement || dateFacture;
    const periodePaie = datePaiement.slice(0, 7);

    // Déterminer le journal et compte selon le mode de paiement
    const modePaiement = facture.mode_paiement || 'cb'; // Par défaut CB
    const configPaiement = MODES_PAIEMENT[modePaiement] || MODES_PAIEMENT.cb;
    const journalCode = configPaiement.journal;
    const compteNumero = configPaiement.compte;
    const compteLibelle = configPaiement.libelle;

    ecritures.push(
      {
        tenant_id: tenantId,
        journal_code: journalCode,
        date_ecriture: datePaiement,
        numero_piece: facture.numero,
        compte_numero: compteNumero,
        compte_libelle: compteLibelle,
        libelle: `Encaissement ${facture.numero}`,
        debit: montantTTC,
        credit: 0,
        facture_id: factureId,
        periode: periodePaie,
        exercice
      },
      {
        tenant_id: tenantId,
        journal_code: journalCode,
        date_ecriture: datePaiement,
        numero_piece: facture.numero,
        compte_numero: compteClient,
        compte_libelle: libelleClient,
        libelle: `Règlement ${facture.numero}`,
        debit: 0,
        credit: montantTTC,
        facture_id: factureId,
        periode: periodePaie,
        exercice
      }
    );
  }

  if (ecritures.length > 0) {
    const { error: insertError } = await supabase.from('ecritures_comptables').insert(ecritures);
    if (insertError) {
      console.error(`[JOURNAUX] Erreur insertion écritures facture ${facture.numero}:`, insertError.message);
      throw insertError;
    }
    console.log(`[JOURNAUX] ${ecritures.length} écritures générées pour facture ${facture.numero}`);
  }
}

// Fonction helper pour générer écritures dépense
async function generateDepenseEcritures(tenantId, depenseId) {
  const { data: depense, error } = await supabase
    .from('depenses')
    .select('*')
    .eq('id', depenseId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !depense) {
    console.error(`[JOURNAUX] Dépense ${depenseId} non trouvée:`, error?.message);
    return;
  }

  const dateDepense = depense.date_depense;
  const periode = dateDepense.slice(0, 7);
  const exercice = parseInt(dateDepense.slice(0, 4));
  const montantTTC = depense.montant_ttc || depense.montant || 0;
  const montantHT = depense.montant || montantTTC;
  const montantTVA = depense.montant_tva || 0;
  const compteCharge = COMPTE_DEPENSE[depense.categorie] || COMPTE_DEPENSE.autre;

  // Sous-compte fournisseur (401 + depense_id sur 5 chiffres)
  const compteFournisseur = getCompteFournisseur(depenseId);
  const libelleFournisseur = depense.fournisseur || depense.libelle || 'Fournisseur';

  const ecritures = [
    {
      tenant_id: tenantId,
      journal_code: 'AC',
      date_ecriture: dateDepense,
      numero_piece: `DEP-${depense.id}`,
      compte_numero: compteCharge.numero,
      compte_libelle: compteCharge.libelle,
      libelle: depense.libelle || depense.categorie,
      debit: montantHT,
      credit: 0,
      depense_id: depenseId,
      periode,
      exercice
    },
    {
      tenant_id: tenantId,
      journal_code: 'AC',
      date_ecriture: dateDepense,
      numero_piece: `DEP-${depense.id}`,
      compte_numero: compteFournisseur,
      compte_libelle: libelleFournisseur,
      libelle: depense.libelle || depense.categorie,
      debit: 0,
      credit: montantTTC,
      depense_id: depenseId,
      periode,
      exercice
    }
  ];

  if (montantTVA > 0 && depense.deductible_tva !== false) {
    ecritures.push({
      tenant_id: tenantId,
      journal_code: 'AC',
      date_ecriture: dateDepense,
      numero_piece: `DEP-${depense.id}`,
      compte_numero: '44566',
      compte_libelle: 'TVA déductible',
      libelle: `TVA ${depense.libelle || depense.categorie}`,
      debit: montantTVA,
      credit: 0,
      depense_id: depenseId,
      periode,
      exercice
    });
  }

  if (depense.payee !== false) {
    const datePaiement = depense.date_paiement?.split('T')[0] || dateDepense;
    const periodePaie = datePaiement.slice(0, 7);

    ecritures.push(
      {
        tenant_id: tenantId,
        journal_code: 'BQ',
        date_ecriture: datePaiement,
        numero_piece: `DEP-${depense.id}`,
        compte_numero: compteFournisseur,
        compte_libelle: libelleFournisseur,
        libelle: `Règlement ${depense.libelle || depense.categorie}`,
        debit: montantTTC,
        credit: 0,
        depense_id: depenseId,
        periode: periodePaie,
        exercice
      },
      {
        tenant_id: tenantId,
        journal_code: 'BQ',
        date_ecriture: datePaiement,
        numero_piece: `DEP-${depense.id}`,
        compte_numero: '512',
        compte_libelle: 'Banque',
        libelle: `Paiement ${depense.libelle || depense.categorie}`,
        debit: 0,
        credit: montantTTC,
        depense_id: depenseId,
        periode: periodePaie,
        exercice
      }
    );
  }

  if (ecritures.length > 0) {
    const { error: insertError } = await supabase.from('ecritures_comptables').insert(ecritures);
    if (insertError) {
      console.error(`[JOURNAUX] Erreur insertion écritures dépense ${depenseId}:`, insertError.message);
      throw insertError;
    }
    console.log(`[JOURNAUX] ${ecritures.length} écritures générées pour dépense ${depenseId}`);
  }
}

// ============================================
// BALANCE / GRAND LIVRE
// ============================================

/**
 * GET /api/journaux/balance
 * Balance des comptes
 */
router.get('/balance', async (req, res) => {
  try {
    const { periode, exercice } = req.query;

    let query = supabase
      .from('ecritures_comptables')
      .select('compte_numero, compte_libelle, debit, credit')
      .eq('tenant_id', req.admin.tenant_id);

    if (periode) {
      query = query.eq('periode', periode);
    }
    if (exercice) {
      query = query.eq('exercice', parseInt(exercice));
    }

    const { data: ecritures, error } = await query;

    if (error) throw error;

    // Agréger par compte
    const comptes = {};
    ecritures?.forEach(e => {
      if (!comptes[e.compte_numero]) {
        comptes[e.compte_numero] = {
          numero: e.compte_numero,
          libelle: e.compte_libelle,
          debit: 0,
          credit: 0
        };
      }
      comptes[e.compte_numero].debit += e.debit || 0;
      comptes[e.compte_numero].credit += e.credit || 0;
    });

    // Calculer soldes
    const balance = Object.values(comptes).map(c => ({
      ...c,
      solde_debiteur: c.debit > c.credit ? c.debit - c.credit : 0,
      solde_crediteur: c.credit > c.debit ? c.credit - c.debit : 0
    })).sort((a, b) => a.numero.localeCompare(b.numero));

    // Totaux
    const totaux = {
      debit: balance.reduce((s, c) => s + c.debit, 0),
      credit: balance.reduce((s, c) => s + c.credit, 0),
      solde_debiteur: balance.reduce((s, c) => s + c.solde_debiteur, 0),
      solde_crediteur: balance.reduce((s, c) => s + c.solde_crediteur, 0)
    };

    res.json({ balance, totaux });
  } catch (error) {
    console.error('[JOURNAUX] Erreur balance:', error);
    res.status(500).json({ error: 'Erreur génération balance' });
  }
});

// ============================================
// À NOUVEAUX (REPORT À NOUVEAU)
// ============================================

/**
 * POST /api/journaux/generer/a-nouveaux
 * Génère les écritures d'à nouveaux pour le nouvel exercice
 *
 * Les à nouveaux reprennent les soldes des comptes de bilan (classes 1-5)
 * et transfèrent le résultat (classes 6-7) vers le compte 120 (bénéfice) ou 129 (perte)
 */
router.post('/generer/a-nouveaux', async (req, res) => {
  try {
    const { exercice_precedent } = req.body;

    if (!exercice_precedent) {
      return res.status(400).json({ error: 'Exercice précédent requis' });
    }

    const exercicePrecedent = parseInt(exercice_precedent);
    const nouvelExercice = exercicePrecedent + 1;
    const dateAN = `${nouvelExercice}-01-01`;
    const periodeAN = `${nouvelExercice}-01`;

    // Vérifier si les AN existent déjà pour ce nouvel exercice
    const { data: existants } = await supabase
      .from('ecritures_comptables')
      .select('id')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('journal_code', 'AN')
      .eq('exercice', nouvelExercice)
      .limit(1);

    if (existants && existants.length > 0) {
      return res.status(400).json({
        error: `Les à nouveaux pour l'exercice ${nouvelExercice} existent déjà`
      });
    }

    // Récupérer toutes les écritures de l'exercice précédent
    const { data: ecritures, error } = await supabase
      .from('ecritures_comptables')
      .select('compte_numero, compte_libelle, debit, credit')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('exercice', exercicePrecedent);

    if (error) throw error;

    // Agréger par compte
    const comptes = {};
    ecritures?.forEach(e => {
      if (!comptes[e.compte_numero]) {
        comptes[e.compte_numero] = {
          numero: e.compte_numero,
          libelle: e.compte_libelle,
          debit: 0,
          credit: 0
        };
      }
      comptes[e.compte_numero].debit += e.debit || 0;
      comptes[e.compte_numero].credit += e.credit || 0;
    });

    // Calculer les soldes
    const soldes = Object.values(comptes).map(c => ({
      ...c,
      solde: c.debit - c.credit
    })).filter(c => c.solde !== 0); // Ne garder que les comptes avec solde non nul

    // Séparer les comptes de bilan (1-5) et de résultat (6-7)
    const comptesBilan = soldes.filter(c => {
      const classe = c.numero.charAt(0);
      return ['1', '2', '3', '4', '5'].includes(classe);
    });

    const comptesResultat = soldes.filter(c => {
      const classe = c.numero.charAt(0);
      return ['6', '7'].includes(classe);
    });

    // Calculer le résultat de l'exercice (Produits - Charges)
    // Classe 7 = Produits (créditeur = positif)
    // Classe 6 = Charges (débiteur = positif)
    let resultat = 0;
    comptesResultat.forEach(c => {
      if (c.numero.charAt(0) === '7') {
        // Produits: crédit - débit = solde créditeur positif = bénéfice
        resultat += (c.credit - c.debit);
      } else {
        // Charges: débit - crédit = solde débiteur positif = charge
        resultat -= (c.debit - c.credit);
      }
    });

    const ecrituresAN = [];

    // 1. Reports des comptes de bilan (classes 1-5)
    comptesBilan.forEach(c => {
      if (c.solde > 0) {
        // Solde débiteur → débit dans AN
        ecrituresAN.push({
          tenant_id: req.admin.tenant_id,
          journal_code: 'AN',
          date_ecriture: dateAN,
          numero_piece: `AN-${nouvelExercice}`,
          compte_numero: c.numero,
          compte_libelle: c.libelle,
          libelle: `À nouveau ${c.libelle}`,
          debit: c.solde,
          credit: 0,
          periode: periodeAN,
          exercice: nouvelExercice
        });
      } else {
        // Solde créditeur → crédit dans AN
        ecrituresAN.push({
          tenant_id: req.admin.tenant_id,
          journal_code: 'AN',
          date_ecriture: dateAN,
          numero_piece: `AN-${nouvelExercice}`,
          compte_numero: c.numero,
          compte_libelle: c.libelle,
          libelle: `À nouveau ${c.libelle}`,
          debit: 0,
          credit: Math.abs(c.solde),
          periode: periodeAN,
          exercice: nouvelExercice
        });
      }
    });

    // 2. Affectation du résultat
    if (resultat !== 0) {
      if (resultat > 0) {
        // Bénéfice → Crédit 120 Report à nouveau (bénéfice)
        ecrituresAN.push({
          tenant_id: req.admin.tenant_id,
          journal_code: 'AN',
          date_ecriture: dateAN,
          numero_piece: `AN-${nouvelExercice}`,
          compte_numero: '120',
          compte_libelle: 'Report à nouveau (bénéfice)',
          libelle: `Résultat exercice ${exercicePrecedent}`,
          debit: 0,
          credit: resultat,
          periode: periodeAN,
          exercice: nouvelExercice
        });
      } else {
        // Perte → Débit 129 Report à nouveau (perte)
        ecrituresAN.push({
          tenant_id: req.admin.tenant_id,
          journal_code: 'AN',
          date_ecriture: dateAN,
          numero_piece: `AN-${nouvelExercice}`,
          compte_numero: '129',
          compte_libelle: 'Report à nouveau (perte)',
          libelle: `Résultat exercice ${exercicePrecedent}`,
          debit: Math.abs(resultat),
          credit: 0,
          periode: periodeAN,
          exercice: nouvelExercice
        });
      }
    }

    // Vérifier l'équilibre des écritures AN
    const totalDebit = ecrituresAN.reduce((s, e) => s + e.debit, 0);
    const totalCredit = ecrituresAN.reduce((s, e) => s + e.credit, 0);

    if (totalDebit !== totalCredit) {
      console.error('[JOURNAUX] AN déséquilibrés:', { totalDebit, totalCredit, diff: totalDebit - totalCredit });
      return res.status(500).json({
        error: 'Écritures à nouveaux déséquilibrées',
        detail: { totalDebit, totalCredit, diff: totalDebit - totalCredit }
      });
    }

    // Insérer les écritures
    if (ecrituresAN.length > 0) {
      const { data, error: insertError } = await supabase
        .from('ecritures_comptables')
        .insert(ecrituresAN)
        .select();

      if (insertError) throw insertError;

      res.json({
        success: true,
        message: `${ecrituresAN.length} écritures à nouveaux générées pour l'exercice ${nouvelExercice}`,
        resultat: resultat / 100, // En euros
        resultat_type: resultat >= 0 ? 'bénéfice' : 'perte',
        nb_ecritures: ecrituresAN.length,
        exercice: nouvelExercice
      });
    } else {
      res.json({
        success: true,
        message: `Aucune écriture à nouveau à générer (pas de soldes sur l'exercice ${exercicePrecedent})`,
        nb_ecritures: 0
      });
    }

  } catch (error) {
    console.error('[JOURNAUX] Erreur génération à nouveaux:', error);
    res.status(500).json({ error: 'Erreur génération à nouveaux' });
  }
});

/**
 * GET /api/journaux/a-nouveaux/status
 * Vérifie si les à nouveaux ont été générés pour un exercice
 */
router.get('/a-nouveaux/status', async (req, res) => {
  try {
    const { exercice } = req.query;

    if (!exercice) {
      return res.status(400).json({ error: 'Exercice requis' });
    }

    const { data: ecrituresAN, error } = await supabase
      .from('ecritures_comptables')
      .select('id, date_ecriture, compte_numero, debit, credit')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('journal_code', 'AN')
      .eq('exercice', parseInt(exercice));

    if (error) throw error;

    const generes = ecrituresAN && ecrituresAN.length > 0;
    const totalDebit = ecrituresAN?.reduce((s, e) => s + (e.debit || 0), 0) || 0;
    const totalCredit = ecrituresAN?.reduce((s, e) => s + (e.credit || 0), 0) || 0;

    res.json({
      exercice: parseInt(exercice),
      generes,
      nb_ecritures: ecrituresAN?.length || 0,
      totaux: {
        debit: totalDebit / 100,
        credit: totalCredit / 100
      }
    });

  } catch (error) {
    console.error('[JOURNAUX] Erreur status à nouveaux:', error);
    res.status(500).json({ error: 'Erreur vérification à nouveaux' });
  }
});

// ============================================
// SOUS-COMPTES AUXILIAIRES
// ============================================

/**
 * Génère un numéro de sous-compte client (411XXXXX)
 * @param {number} clientId - ID du client
 * @returns {string} - Numéro de compte (ex: 41100001)
 */
function getCompteClient(clientId) {
  return `411${String(clientId).padStart(5, '0')}`;
}

/**
 * Génère un numéro de sous-compte fournisseur (401XXXXX)
 * @param {number} fournisseurId - ID du fournisseur ou dépense
 * @returns {string} - Numéro de compte (ex: 40100001)
 */
function getCompteFournisseur(fournisseurId) {
  return `401${String(fournisseurId).padStart(5, '0')}`;
}

/**
 * GET /api/journaux/plan-comptable
 * Retourne le plan comptable avec tous les comptes utilisés
 */
router.get('/plan-comptable', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Récupérer tous les comptes distincts utilisés
    const { data: ecritures, error } = await supabase
      .from('ecritures_comptables')
      .select('compte_numero, compte_libelle')
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Dédupliquer et trier
    const comptesMap = new Map();
    ecritures?.forEach(e => {
      if (!comptesMap.has(e.compte_numero)) {
        comptesMap.set(e.compte_numero, {
          numero: e.compte_numero,
          libelle: e.compte_libelle || getLibelleCompte(e.compte_numero),
          classe: e.compte_numero.charAt(0)
        });
      }
    });

    const comptes = Array.from(comptesMap.values())
      .sort((a, b) => a.numero.localeCompare(b.numero));

    // Grouper par classe
    const classes = {
      '1': { libelle: 'Capitaux', comptes: [] },
      '2': { libelle: 'Immobilisations', comptes: [] },
      '3': { libelle: 'Stocks', comptes: [] },
      '4': { libelle: 'Tiers', comptes: [] },
      '5': { libelle: 'Trésorerie', comptes: [] },
      '6': { libelle: 'Charges', comptes: [] },
      '7': { libelle: 'Produits', comptes: [] }
    };

    comptes.forEach(c => {
      if (classes[c.classe]) {
        classes[c.classe].comptes.push(c);
      }
    });

    res.json({ comptes, classes });
  } catch (error) {
    console.error('[JOURNAUX] Erreur plan comptable:', error);
    res.status(500).json({ error: 'Erreur récupération plan comptable' });
  }
});

// ============================================
// GRAND LIVRE
// ============================================

/**
 * GET /api/journaux/grand-livre
 * Grand livre par compte avec détail des mouvements
 */
router.get('/grand-livre', async (req, res) => {
  try {
    const { compte, periode_debut, periode_fin, exercice } = req.query;
    const tenantId = req.admin.tenant_id;

    let query = supabase
      .from('ecritures_comptables')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('compte_numero', { ascending: true })
      .order('date_ecriture', { ascending: true });

    // Filtres
    if (compte) {
      // Permet de filtrer par préfixe (ex: 411 pour tous les clients)
      query = query.like('compte_numero', `${compte}%`);
    }
    if (periode_debut) {
      query = query.gte('periode', periode_debut);
    }
    if (periode_fin) {
      query = query.lte('periode', periode_fin);
    }
    if (exercice) {
      query = query.eq('exercice', parseInt(exercice));
    }

    const { data: ecritures, error } = await query;

    if (error) throw error;

    // Grouper par compte
    const grandLivre = {};
    let soldeGlobal = 0;

    ecritures?.forEach(e => {
      const num = e.compte_numero;
      if (!grandLivre[num]) {
        grandLivre[num] = {
          compte_numero: num,
          compte_libelle: e.compte_libelle || getLibelleCompte(num),
          mouvements: [],
          total_debit: 0,
          total_credit: 0,
          solde: 0
        };
      }

      grandLivre[num].mouvements.push({
        id: e.id,
        date: e.date_ecriture,
        journal: e.journal_code,
        piece: e.numero_piece,
        libelle: e.libelle,
        debit: e.debit / 100,
        credit: e.credit / 100,
        lettrage: e.lettrage
      });

      grandLivre[num].total_debit += e.debit || 0;
      grandLivre[num].total_credit += e.credit || 0;
    });

    // Calculer les soldes
    Object.values(grandLivre).forEach(compte => {
      compte.solde = (compte.total_debit - compte.total_credit) / 100;
      compte.total_debit /= 100;
      compte.total_credit /= 100;
      soldeGlobal += compte.solde;
    });

    // Convertir en array trié
    const comptes = Object.values(grandLivre)
      .sort((a, b) => a.compte_numero.localeCompare(b.compte_numero));

    res.json({
      grand_livre: comptes,
      totaux: {
        debit: comptes.reduce((s, c) => s + c.total_debit, 0),
        credit: comptes.reduce((s, c) => s + c.total_credit, 0),
        solde: soldeGlobal
      },
      nb_comptes: comptes.length,
      nb_ecritures: ecritures?.length || 0
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur grand livre:', error);
    res.status(500).json({ error: 'Erreur génération grand livre' });
  }
});

/**
 * GET /api/journaux/grand-livre/:compte
 * Détail d'un compte spécifique avec solde progressif
 */
router.get('/grand-livre/:compte', async (req, res) => {
  try {
    const { compte } = req.params;
    const { exercice } = req.query;
    const tenantId = req.admin.tenant_id;

    let query = supabase
      .from('ecritures_comptables')
      .select('*')
      .eq('tenant_id', tenantId)
      .like('compte_numero', `${compte}%`)
      .order('date_ecriture', { ascending: true })
      .order('id', { ascending: true });

    if (exercice) {
      query = query.eq('exercice', parseInt(exercice));
    }

    const { data: ecritures, error } = await query;

    if (error) throw error;

    // Calculer le solde progressif (toujours D - C)
    let soldeProgressif = 0;
    const ecrituresFormatted = ecritures?.map(e => {
      soldeProgressif += (e.debit || 0) - (e.credit || 0);
      return {
        id: e.id,
        date_ecriture: e.date_ecriture,
        journal_code: e.journal_code,
        numero_piece: e.numero_piece,
        libelle: e.libelle,
        debit: e.debit || 0,
        credit: e.credit || 0,
        solde_progressif: soldeProgressif,
        lettrage: e.lettrage,
        facture_id: e.facture_id,
        depense_id: e.depense_id
      };
    }) || [];

    const totalDebit = ecritures?.reduce((s, e) => s + (e.debit || 0), 0) || 0;
    const totalCredit = ecritures?.reduce((s, e) => s + (e.credit || 0), 0) || 0;

    res.json({
      compte: compte,
      libelle: ecritures?.[0]?.compte_libelle || getLibelleCompte(compte),
      exercice: parseInt(exercice) || new Date().getFullYear(),
      ecritures: ecrituresFormatted,
      totaux: {
        debit: totalDebit / 100,
        credit: totalCredit / 100,
        solde: (totalDebit - totalCredit) / 100
      },
      nb_ecritures: ecrituresFormatted.length
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur détail compte:', error);
    res.status(500).json({ error: 'Erreur récupération compte' });
  }
});

// ============================================
// BALANCE DÉTAILLÉE
// ============================================

/**
 * GET /api/journaux/balance-generale
 * Balance générale avec sous-comptes
 */
router.get('/balance-generale', async (req, res) => {
  try {
    const { periode, exercice, avec_sous_comptes, compte } = req.query;
    const tenantId = req.admin.tenant_id;

    let query = supabase
      .from('ecritures_comptables')
      .select('compte_numero, compte_libelle, debit, credit')
      .eq('tenant_id', tenantId);

    // Filtre par compte (préfixe) - ex: 606, 411004, etc.
    if (compte) {
      query = query.like('compte_numero', `${compte}%`);
    }
    if (periode) {
      query = query.eq('periode', periode);
    }
    if (exercice) {
      query = query.eq('exercice', parseInt(exercice));
    }

    const { data: ecritures, error } = await query;

    if (error) throw error;

    // Agréger par compte
    const comptes = {};
    ecritures?.forEach(e => {
      const num = avec_sous_comptes === 'true' ? e.compte_numero : e.compte_numero.substring(0, 3);
      if (!comptes[num]) {
        comptes[num] = {
          numero: num,
          libelle: e.compte_libelle || getLibelleCompte(num),
          debit: 0,
          credit: 0,
          sous_comptes: {}
        };
      }
      comptes[num].debit += e.debit || 0;
      comptes[num].credit += e.credit || 0;

      // Ajouter aux sous-comptes si différent du compte principal
      if (avec_sous_comptes === 'true' && e.compte_numero.length > 3) {
        const sousCompte = e.compte_numero;
        if (!comptes[num].sous_comptes[sousCompte]) {
          comptes[num].sous_comptes[sousCompte] = {
            numero: sousCompte,
            libelle: e.compte_libelle,
            debit: 0,
            credit: 0
          };
        }
        comptes[num].sous_comptes[sousCompte].debit += e.debit || 0;
        comptes[num].sous_comptes[sousCompte].credit += e.credit || 0;
      }
    });

    // Calculer soldes et formater
    const balance = Object.values(comptes).map(c => ({
      numero: c.numero,
      libelle: c.libelle,
      debit: c.debit / 100,
      credit: c.credit / 100,
      solde_debiteur: c.debit > c.credit ? (c.debit - c.credit) / 100 : 0,
      solde_crediteur: c.credit > c.debit ? (c.credit - c.debit) / 100 : 0,
      sous_comptes: Object.values(c.sous_comptes).map(sc => ({
        ...sc,
        debit: sc.debit / 100,
        credit: sc.credit / 100,
        solde: (sc.debit - sc.credit) / 100
      }))
    })).sort((a, b) => a.numero.localeCompare(b.numero));

    // Totaux
    const totaux = {
      debit: balance.reduce((s, c) => s + c.debit, 0),
      credit: balance.reduce((s, c) => s + c.credit, 0),
      solde_debiteur: balance.reduce((s, c) => s + c.solde_debiteur, 0),
      solde_crediteur: balance.reduce((s, c) => s + c.solde_crediteur, 0)
    };

    res.json({ balance, totaux, nb_comptes: balance.length });
  } catch (error) {
    console.error('[JOURNAUX] Erreur balance générale:', error);
    res.status(500).json({ error: 'Erreur génération balance' });
  }
});

/**
 * GET /api/journaux/balance-clients
 * Balance auxiliaire clients (comptes 411)
 */
router.get('/balance-clients', async (req, res) => {
  try {
    const { exercice } = req.query;
    const tenantId = req.admin.tenant_id;
    const exerciceNum = exercice ? parseInt(exercice) : new Date().getFullYear();

    let query = supabase
      .from('ecritures_comptables')
      .select('compte_numero, compte_libelle, debit, credit, facture_id, date_ecriture')
      .eq('tenant_id', tenantId)
      .like('compte_numero', '411%');

    if (exercice) {
      query = query.eq('exercice', exerciceNum);
    }

    const { data: ecritures, error } = await query;

    if (error) throw error;

    // Agréger par sous-compte client
    const clients = {};
    ecritures?.forEach(e => {
      const num = e.compte_numero;
      if (!clients[num]) {
        clients[num] = {
          compte: num,
          nom: e.compte_libelle || 'Client',
          mouvement_debit: 0,
          mouvement_credit: 0,
          dernier_mouvement: null,
          nb_factures: new Set()
        };
      }
      clients[num].mouvement_debit += e.debit || 0;
      clients[num].mouvement_credit += e.credit || 0;
      if (e.date_ecriture && (!clients[num].dernier_mouvement || e.date_ecriture > clients[num].dernier_mouvement)) {
        clients[num].dernier_mouvement = e.date_ecriture;
      }
      if (e.facture_id) clients[num].nb_factures.add(e.facture_id);
    });

    const comptes = Object.values(clients).map(c => ({
      compte: c.compte,
      nom: c.nom,
      mouvement_debit: c.mouvement_debit / 100,
      mouvement_credit: c.mouvement_credit / 100,
      solde: (c.mouvement_debit - c.mouvement_credit) / 100,
      dernier_mouvement: c.dernier_mouvement,
      nb_factures: c.nb_factures.size
    })).sort((a, b) => b.solde - a.solde); // Plus gros soldes en premier

    const totaux = {
      mouvement_debit: comptes.reduce((s, c) => s + c.mouvement_debit, 0),
      mouvement_credit: comptes.reduce((s, c) => s + c.mouvement_credit, 0),
      solde: comptes.reduce((s, c) => s + c.solde, 0),
      nb_comptes: comptes.length
    };

    res.json({
      type: 'clients',
      compte_collectif: '411',
      exercice: exerciceNum,
      comptes,
      totaux
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur balance clients:', error);
    res.status(500).json({ error: 'Erreur génération balance clients' });
  }
});

/**
 * GET /api/journaux/balance-fournisseurs
 * Balance auxiliaire fournisseurs (comptes 401)
 */
router.get('/balance-fournisseurs', async (req, res) => {
  try {
    const { exercice } = req.query;
    const tenantId = req.admin.tenant_id;
    const exerciceNum = exercice ? parseInt(exercice) : new Date().getFullYear();

    let query = supabase
      .from('ecritures_comptables')
      .select('compte_numero, compte_libelle, debit, credit, depense_id, date_ecriture')
      .eq('tenant_id', tenantId)
      .like('compte_numero', '401%');

    if (exercice) {
      query = query.eq('exercice', exerciceNum);
    }

    const { data: ecritures, error } = await query;

    if (error) throw error;

    // Agréger par sous-compte fournisseur
    const fournisseurs = {};
    ecritures?.forEach(e => {
      const num = e.compte_numero;
      if (!fournisseurs[num]) {
        fournisseurs[num] = {
          compte: num,
          nom: e.compte_libelle || 'Fournisseur',
          mouvement_debit: 0,
          mouvement_credit: 0,
          dernier_mouvement: null,
          nb_factures: new Set()
        };
      }
      fournisseurs[num].mouvement_debit += e.debit || 0;
      fournisseurs[num].mouvement_credit += e.credit || 0;
      if (e.date_ecriture && (!fournisseurs[num].dernier_mouvement || e.date_ecriture > fournisseurs[num].dernier_mouvement)) {
        fournisseurs[num].dernier_mouvement = e.date_ecriture;
      }
      if (e.depense_id) fournisseurs[num].nb_factures.add(e.depense_id);
    });

    const comptes = Object.values(fournisseurs).map(f => ({
      compte: f.compte,
      nom: f.nom,
      mouvement_debit: f.mouvement_debit / 100,
      mouvement_credit: f.mouvement_credit / 100,
      solde: (f.mouvement_debit - f.mouvement_credit) / 100, // D - C standard
      dernier_mouvement: f.dernier_mouvement,
      nb_factures: f.nb_factures.size
    })).sort((a, b) => a.solde - b.solde); // Plus négatif (on doit plus) en premier

    const totaux = {
      mouvement_debit: comptes.reduce((s, f) => s + f.mouvement_debit, 0),
      mouvement_credit: comptes.reduce((s, f) => s + f.mouvement_credit, 0),
      solde: comptes.reduce((s, f) => s + f.solde, 0),
      nb_comptes: comptes.length
    };

    res.json({
      type: 'fournisseurs',
      compte_collectif: '401',
      exercice: exerciceNum,
      comptes,
      totaux
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur balance fournisseurs:', error);
    res.status(500).json({ error: 'Erreur génération balance fournisseurs' });
  }
});

/**
 * GET /api/journaux/balance-personnel
 * Balance auxiliaire personnel (comptes 421, 431)
 */
router.get('/balance-personnel', async (req, res) => {
  try {
    const { exercice } = req.query;
    const tenantId = req.admin.tenant_id;
    const exerciceNum = exercice ? parseInt(exercice) : new Date().getFullYear();

    // Récupérer les écritures des comptes 421 et 431
    let query = supabase
      .from('ecritures_comptables')
      .select('compte_numero, compte_libelle, debit, credit, depense_id, date_ecriture')
      .eq('tenant_id', tenantId)
      .or('compte_numero.like.421%,compte_numero.like.431%');

    if (exercice) {
      query = query.eq('exercice', exerciceNum);
    }

    const { data: ecritures, error } = await query;

    if (error) throw error;

    // Agréger par compte
    const personnel = {};
    ecritures?.forEach(e => {
      const num = e.compte_numero;
      if (!personnel[num]) {
        personnel[num] = {
          compte: num,
          nom: e.compte_libelle || (num.startsWith('421') ? 'Personnel' : 'Organismes sociaux'),
          mouvement_debit: 0,
          mouvement_credit: 0,
          dernier_mouvement: null,
          nb_ecritures: new Set()
        };
      }
      personnel[num].mouvement_debit += e.debit || 0;
      personnel[num].mouvement_credit += e.credit || 0;
      if (e.date_ecriture && (!personnel[num].dernier_mouvement || e.date_ecriture > personnel[num].dernier_mouvement)) {
        personnel[num].dernier_mouvement = e.date_ecriture;
      }
      if (e.depense_id) personnel[num].nb_ecritures.add(e.depense_id);
    });

    const comptes = Object.values(personnel).map(p => ({
      compte: p.compte,
      nom: p.nom,
      mouvement_debit: p.mouvement_debit / 100,
      mouvement_credit: p.mouvement_credit / 100,
      solde: (p.mouvement_debit - p.mouvement_credit) / 100, // D - C standard
      dernier_mouvement: p.dernier_mouvement,
      nb_ecritures: p.nb_ecritures.size
    })).sort((a, b) => a.solde - b.solde); // Plus négatif (on doit plus) en premier

    const totaux = {
      mouvement_debit: comptes.reduce((s, p) => s + p.mouvement_debit, 0),
      mouvement_credit: comptes.reduce((s, p) => s + p.mouvement_credit, 0),
      solde: comptes.reduce((s, p) => s + p.solde, 0),
      nb_comptes: comptes.length
    };

    res.json({
      type: 'personnel',
      compte_collectif: '421/431',
      exercice: exerciceNum,
      comptes,
      totaux
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur balance personnel:', error);
    res.status(500).json({ error: 'Erreur génération balance personnel' });
  }
});

// ============================================
// BILAN & COMPTE DE RÉSULTAT
// ============================================

/**
 * GET /api/journaux/bilan
 * Bilan comptable (Actif / Passif)
 * Params: exercice, periode (YYYY-MM), date_fin (YYYY-MM-DD)
 */
router.get('/bilan', async (req, res) => {
  try {
    const { exercice, periode, date_fin } = req.query;
    const tenantId = req.admin.tenant_id;

    let query = supabase
      .from('ecritures_comptables')
      .select('compte_numero, compte_libelle, debit, credit, date_ecriture')
      .eq('tenant_id', tenantId);

    if (exercice) {
      query = query.eq('exercice', parseInt(exercice));
    }

    // Filtre par période (mois) - cumulatif jusqu'à fin du mois
    if (periode) {
      const [year, month] = periode.split('-').map(Number);
      const daysInMonth = new Date(year, month, 0).getDate();
      const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      query = query.lte('date_ecriture', endOfMonth);
    }

    // Filtre par date exacte - cumulatif jusqu'à cette date
    if (date_fin) {
      query = query.lte('date_ecriture', date_fin);
    }

    const { data: ecritures, error } = await query;

    if (error) throw error;

    // Séparer les "à nouveaux" (1er janvier) des écritures courantes
    const exerciceYear = exercice || new Date().getFullYear();
    const dateANouveaux = `${exerciceYear}-01-01`;

    // Agréger par compte (racine 3 caractères)
    // On sépare les "à nouveaux" pour 120/129 qui représentent le report des exercices précédents
    const comptes = {};
    let reportANouveauBenefice = 0; // À nouveaux compte 120
    let reportANouveauPerte = 0;    // À nouveaux compte 129

    ecritures?.forEach(e => {
      const num = e.compte_numero.substring(0, 3);

      // Identifier les "à nouveaux" pour les comptes de résultat (120/129)
      // Ce sont les écritures au 1er janvier ou avec libellé contenant "Report" ou "à nouveau"
      const isANouveau = e.date_ecriture === dateANouveaux ||
                         (e.libelle && (e.libelle.toLowerCase().includes('report') ||
                                       e.libelle.toLowerCase().includes('nouveau') ||
                                       e.libelle.toLowerCase().includes('exercice précédent')));

      if ((num === '120' || num === '129') && isANouveau) {
        // Report à nouveau des exercices précédents
        // 120 au crédit = bénéfice reporté, 129 au débit = perte reportée
        if (num === '120') {
          reportANouveauBenefice += ((e.credit || 0) - (e.debit || 0)) / 100;
        } else {
          reportANouveauPerte += ((e.debit || 0) - (e.credit || 0)) / 100;
        }
      } else {
        // Écritures normales
        if (!comptes[num]) {
          comptes[num] = {
            numero: num,
            libelle: getLibelleCompte(num),
            debit: 0,
            credit: 0
          };
        }
        comptes[num].debit += e.debit || 0;
        comptes[num].credit += e.credit || 0;
      }
    });

    // Séparer Actif (classes 2, 3, 4 débiteur, 5 débiteur) et Passif (classes 1, 4 créditeur, 5 créditeur)
    const actif = {
      immobilisations: [], // Classe 2
      stocks: [],          // Classe 3
      creances: [],        // Classe 4 débiteur
      tresorerie: []       // Classe 5 débiteur (avoir en banque/caisse)
    };

    const passif = {
      capitaux: [],        // Classe 1
      dettes: [],          // Classe 4 créditeur
      decouvertsBancaires: [] // Classe 5 créditeur (découvert bancaire)
    };

    Object.values(comptes).forEach(c => {
      const classe = c.numero.charAt(0);
      const solde = (c.debit - c.credit) / 100;

      if (classe === '2') {
        actif.immobilisations.push({ ...c, solde });
      } else if (classe === '3') {
        actif.stocks.push({ ...c, solde });
      } else if (classe === '5') {
        // Classe 5 - Trésorerie
        // Solde débiteur (positif) = avoir en banque/caisse → Actif
        // Solde créditeur (négatif) = découvert bancaire → Passif (dettes financières)
        if (solde >= 0) {
          actif.tresorerie.push({ ...c, solde });
        } else {
          // Découvert bancaire : va au passif avec valeur positive
          passif.decouvertsBancaires.push({ ...c, solde: Math.abs(solde), libelle: c.libelle + ' (découvert)' });
        }
      } else if (classe === '4') {
        if (solde > 0) {
          actif.creances.push({ ...c, solde });
        } else if (solde < 0) {
          passif.dettes.push({ ...c, solde: Math.abs(solde) });
        }
        // Si solde = 0, on ignore
      } else if (classe === '1') {
        // Exclure 120/129 car traités séparément (à nouveaux + résultat calculé)
        if (c.numero !== '120' && c.numero !== '129') {
          // Pour les capitaux propres, le solde est généralement créditeur (négatif en solde débit-crédit)
          // On garde la valeur absolue pour l'affichage
          passif.capitaux.push({ ...c, solde: -solde }); // Inverser car crédit = positif en capitaux
        }
      }
    });

    // Ajouter le report à nouveau si existant
    const totalReportANouveau = reportANouveauBenefice - reportANouveauPerte;
    if (Math.abs(totalReportANouveau) > 0.01) {
      passif.capitaux.push({
        numero: totalReportANouveau >= 0 ? '110' : '119',
        libelle: 'Report à nouveau',
        solde: totalReportANouveau
      });
    }

    // Calculer le résultat de l'exercice (classes 6 et 7)
    let produits = 0;
    let charges = 0;
    Object.values(comptes).forEach(c => {
      const classe = c.numero.charAt(0);
      if (classe === '7') {
        produits += (c.credit - c.debit) / 100;
      } else if (classe === '6') {
        charges += (c.debit - c.credit) / 100;
      }
    });
    const resultat = produits - charges;

    // Ajouter le résultat de l'exercice au passif
    if (Math.abs(resultat) > 0.01) {
      passif.capitaux.push({
        numero: resultat >= 0 ? '120' : '129',
        libelle: resultat >= 0 ? 'Résultat de l\'exercice (bénéfice)' : 'Résultat de l\'exercice (perte)',
        solde: resultat
      });
    }

    // Totaux
    const totalActif =
      actif.immobilisations.reduce((s, c) => s + c.solde, 0) +
      actif.stocks.reduce((s, c) => s + c.solde, 0) +
      actif.creances.reduce((s, c) => s + c.solde, 0) +
      actif.tresorerie.reduce((s, c) => s + c.solde, 0);

    const totalPassif =
      passif.capitaux.reduce((s, c) => s + c.solde, 0) +
      passif.dettes.reduce((s, c) => s + c.solde, 0) +
      passif.decouvertsBancaires.reduce((s, c) => s + c.solde, 0);

    res.json({
      actif,
      passif,
      totaux: {
        actif: totalActif,
        passif: totalPassif,
        equilibre: Math.abs(totalActif - totalPassif) < 0.01
      },
      resultat: {
        produits,
        charges,
        resultat,
        type: resultat >= 0 ? 'bénéfice' : 'perte'
      },
      exercice: exercice || new Date().getFullYear()
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur bilan:', error);
    res.status(500).json({ error: 'Erreur génération bilan' });
  }
});

/**
 * GET /api/journaux/compte-resultat
 * Compte de résultat (Charges / Produits)
 */
router.get('/compte-resultat', async (req, res) => {
  try {
    const { exercice, periode, date_fin } = req.query;
    const tenantId = req.admin.tenant_id;

    let query = supabase
      .from('ecritures_comptables')
      .select('compte_numero, compte_libelle, debit, credit, date_ecriture')
      .eq('tenant_id', tenantId);

    if (exercice) {
      query = query.eq('exercice', parseInt(exercice));
    }

    // Filtre par période (mois) - du début d'année jusqu'à fin du mois
    if (periode) {
      const [year, month] = periode.split('-').map(Number);
      const startOfYear = `${year}-01-01`;
      const daysInMonth = new Date(year, month, 0).getDate();
      const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      query = query
        .gte('date_ecriture', startOfYear)
        .lte('date_ecriture', endOfMonth);
    }

    // Filtre par date exacte - du début d'année jusqu'à cette date
    if (date_fin) {
      const year = date_fin.substring(0, 4);
      query = query
        .gte('date_ecriture', `${year}-01-01`)
        .lte('date_ecriture', date_fin);
    }

    const { data: ecritures, error } = await query;

    if (error) throw error;

    // Agréger par compte (racine 3 caractères)
    const comptes = {};
    ecritures?.forEach(e => {
      const classe = e.compte_numero.charAt(0);
      if (classe !== '6' && classe !== '7') return; // Que charges et produits

      const num = e.compte_numero.substring(0, 3);
      if (!comptes[num]) {
        comptes[num] = {
          numero: num,
          libelle: getLibelleCompte(num),
          debit: 0,
          credit: 0
        };
      }
      comptes[num].debit += e.debit || 0;
      comptes[num].credit += e.credit || 0;
    });

    // Séparer charges (classe 6) et produits (classe 7)
    const charges = {
      exploitation: [],    // 60-65
      financieres: [],     // 66
      exceptionnelles: []  // 67
    };

    const produits = {
      exploitation: [],    // 70-75
      financiers: [],      // 76
      exceptionnels: []    // 77
    };

    Object.values(comptes).forEach(c => {
      const num = parseInt(c.numero);
      const montant = c.numero.charAt(0) === '6'
        ? (c.debit - c.credit) / 100   // Charges = débiteur
        : (c.credit - c.debit) / 100;  // Produits = créditeur

      if (num >= 600 && num <= 659) {
        charges.exploitation.push({ ...c, montant });
      } else if (num >= 660 && num <= 669) {
        charges.financieres.push({ ...c, montant });
      } else if (num >= 670 && num <= 679) {
        charges.exceptionnelles.push({ ...c, montant });
      } else if (num >= 700 && num <= 759) {
        produits.exploitation.push({ ...c, montant });
      } else if (num >= 760 && num <= 769) {
        produits.financiers.push({ ...c, montant });
      } else if (num >= 770 && num <= 779) {
        produits.exceptionnels.push({ ...c, montant });
      }
    });

    // Calculs
    const totalChargesExploitation = charges.exploitation.reduce((s, c) => s + c.montant, 0);
    const totalChargesFinancieres = charges.financieres.reduce((s, c) => s + c.montant, 0);
    const totalChargesExceptionnelles = charges.exceptionnelles.reduce((s, c) => s + c.montant, 0);
    const totalCharges = totalChargesExploitation + totalChargesFinancieres + totalChargesExceptionnelles;

    const totalProduitsExploitation = produits.exploitation.reduce((s, c) => s + c.montant, 0);
    const totalProduitsFinanciers = produits.financiers.reduce((s, c) => s + c.montant, 0);
    const totalProduitsExceptionnels = produits.exceptionnels.reduce((s, c) => s + c.montant, 0);
    const totalProduits = totalProduitsExploitation + totalProduitsFinanciers + totalProduitsExceptionnels;

    const resultatExploitation = totalProduitsExploitation - totalChargesExploitation;
    const resultatFinancier = totalProduitsFinanciers - totalChargesFinancieres;
    const resultatExceptionnel = totalProduitsExceptionnels - totalChargesExceptionnelles;
    const resultatNet = totalProduits - totalCharges;

    res.json({
      charges,
      produits,
      totaux: {
        charges: {
          exploitation: totalChargesExploitation,
          financieres: totalChargesFinancieres,
          exceptionnelles: totalChargesExceptionnelles,
          total: totalCharges
        },
        produits: {
          exploitation: totalProduitsExploitation,
          financiers: totalProduitsFinanciers,
          exceptionnels: totalProduitsExceptionnels,
          total: totalProduits
        },
        resultats: {
          exploitation: resultatExploitation,
          financier: resultatFinancier,
          exceptionnel: resultatExceptionnel,
          net: resultatNet,
          type: resultatNet >= 0 ? 'bénéfice' : 'perte'
        }
      },
      exercice: exercice || new Date().getFullYear(),
      periode: periode || 'annuel'
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur compte résultat:', error);
    res.status(500).json({ error: 'Erreur génération compte de résultat' });
  }
});

// ============================================
// BALANCE ÂGÉE (Créances et Dettes)
// ============================================

/**
 * GET /api/journaux/balance-agee
 * Balance âgée des créances clients
 */
router.get('/balance-agee', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const today = new Date();

    // Récupérer les factures non soldées
    const { data: factures, error } = await supabase
      .from('factures')
      .select('id, numero, client_nom, montant_ttc, date_facture, statut')
      .eq('tenant_id', tenantId)
      .in('statut', ['generee', 'envoyee'])
      .order('date_facture', { ascending: true });

    if (error) throw error;

    // Catégoriser par ancienneté
    const tranches = {
      non_echu: { label: 'Non échu', factures: [], total: 0 },
      de_0_30: { label: '0-30 jours', factures: [], total: 0 },
      de_31_60: { label: '31-60 jours', factures: [], total: 0 },
      de_61_90: { label: '61-90 jours', factures: [], total: 0 },
      plus_90: { label: '> 90 jours', factures: [], total: 0 }
    };

    factures?.forEach(f => {
      const dateFacture = new Date(f.date_facture);
      const echeance = new Date(dateFacture);
      echeance.setDate(echeance.getDate() + 30); // Échéance 30 jours par défaut

      const joursRetard = Math.floor((today - echeance) / (1000 * 60 * 60 * 24));
      const montant = f.montant_ttc / 100;

      const factureData = {
        id: f.id,
        numero: f.numero,
        client: f.client_nom,
        date: f.date_facture,
        montant,
        jours_retard: Math.max(0, joursRetard)
      };

      if (joursRetard < 0) {
        tranches.non_echu.factures.push(factureData);
        tranches.non_echu.total += montant;
      } else if (joursRetard <= 30) {
        tranches.de_0_30.factures.push(factureData);
        tranches.de_0_30.total += montant;
      } else if (joursRetard <= 60) {
        tranches.de_31_60.factures.push(factureData);
        tranches.de_31_60.total += montant;
      } else if (joursRetard <= 90) {
        tranches.de_61_90.factures.push(factureData);
        tranches.de_61_90.total += montant;
      } else {
        tranches.plus_90.factures.push(factureData);
        tranches.plus_90.total += montant;
      }
    });

    const totalCreances = Object.values(tranches).reduce((s, t) => s + t.total, 0);

    res.json({
      tranches,
      total: totalCreances,
      nb_factures: factures?.length || 0,
      date_analyse: today.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur balance âgée:', error);
    res.status(500).json({ error: 'Erreur génération balance âgée' });
  }
});

// ============================================
// FEC - FICHIER DES ÉCRITURES COMPTABLES
// ============================================

/**
 * GET /api/journaux/fec
 * Export FEC (Fichier des Écritures Comptables) - Format légal français
 */
router.get('/fec', async (req, res) => {
  try {
    const { exercice } = req.query;
    const tenantId = req.admin.tenant_id;

    if (!exercice) {
      return res.status(400).json({ error: 'Exercice requis pour le FEC' });
    }

    // Récupérer le tenant pour le SIREN
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, slug')
      .eq('id', tenantId)
      .single();

    // Récupérer toutes les écritures de l'exercice
    const { data: ecritures, error } = await supabase
      .from('ecritures_comptables')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('exercice', parseInt(exercice))
      .order('date_ecriture', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;

    // Format FEC (18 colonnes obligatoires)
    const fecLines = [];

    // En-tête
    fecLines.push([
      'JournalCode',
      'JournalLib',
      'EcritureNum',
      'EcritureDate',
      'CompteNum',
      'CompteLib',
      'CompAuxNum',
      'CompAuxLib',
      'PieceRef',
      'PieceDate',
      'EcritureLib',
      'Debit',
      'Credit',
      'EcritureLet',
      'DateLet',
      'ValidDate',
      'Montantdevise',
      'Idevise'
    ].join('\t'));

    let ecritureNum = 1;
    ecritures?.forEach(e => {
      const line = [
        e.journal_code,                                          // JournalCode
        JOURNAUX[e.journal_code]?.libelle || e.journal_code,    // JournalLib
        String(ecritureNum++).padStart(8, '0'),                 // EcritureNum
        formatDateFEC(e.date_ecriture),                         // EcritureDate
        e.compte_numero,                                         // CompteNum
        e.compte_libelle || '',                                  // CompteLib
        '',                                                      // CompAuxNum (auxiliaire)
        '',                                                      // CompAuxLib
        e.numero_piece || '',                                    // PieceRef
        formatDateFEC(e.date_ecriture),                         // PieceDate
        (e.libelle || '').replace(/\t/g, ' '),                  // EcritureLib
        formatMontantFEC(e.debit),                              // Debit
        formatMontantFEC(e.credit),                             // Credit
        e.lettrage || '',                                        // EcritureLet
        e.date_lettrage ? formatDateFEC(e.date_lettrage) : '',  // DateLet
        formatDateFEC(e.date_ecriture),                         // ValidDate
        '',                                                      // Montantdevise
        ''                                                       // Idevise
      ];
      fecLines.push(line.join('\t'));
    });

    // Nom du fichier FEC: SIREN + FEC + date de clôture
    const siren = '000000000'; // À remplacer par le vrai SIREN
    const dateClot = `${exercice}1231`;
    const filename = `${siren}FEC${dateClot}.txt`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(fecLines.join('\n'));

  } catch (error) {
    console.error('[JOURNAUX] Erreur export FEC:', error);
    res.status(500).json({ error: 'Erreur export FEC' });
  }
});

// Helpers pour le FEC
function formatDateFEC(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function formatMontantFEC(centimes) {
  if (!centimes) return '0,00';
  return (centimes / 100).toFixed(2).replace('.', ',');
}

/**
 * Retourne le libellé standard d'un compte
 */
function getLibelleCompte(numero) {
  const libelles = {
    '101': 'Capital social',
    '106': 'Réserves',
    '120': 'Résultat de l\'exercice (bénéfice)',
    '129': 'Résultat de l\'exercice (perte)',
    '164': 'Emprunts',
    '401': 'Fournisseurs',
    '411': 'Clients',
    '421': 'Personnel - Rémunérations dues',
    '431': 'Sécurité sociale',
    '44566': 'TVA déductible',
    '44571': 'TVA collectée',
    '512': 'Banque',
    '530': 'Caisse',
    '601': 'Achats fournitures',
    '606': 'Achats non stockés',
    '613': 'Locations',
    '615': 'Entretien et réparations',
    '616': 'Assurances',
    '618': 'Divers',
    '622': 'Honoraires',
    '623': 'Publicité',
    '625': 'Déplacements',
    '626': 'Frais postaux et télécom',
    '627': 'Services bancaires',
    '635': 'Impôts et taxes',
    '641': 'Rémunérations du personnel',
    '645': 'Charges sociales',
    '651': 'Redevances',
    '658': 'Charges diverses',
    '706': 'Prestations de services',
    '707': 'Ventes de marchandises',
    '708': 'Produits annexes',
    '761': 'Produits financiers',
    '771': 'Produits exceptionnels'
  };

  // Chercher correspondance exacte ou par préfixe
  if (libelles[numero]) return libelles[numero];

  const prefixes = ['44571', '44566', '411', '401', '512', '530', '706', '707'];
  for (const prefix of prefixes) {
    if (numero.startsWith(prefix)) {
      return libelles[prefix] || numero;
    }
  }

  return numero;
}

export default router;
