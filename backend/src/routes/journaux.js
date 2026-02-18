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
  BQ: { code: 'BQ', libelle: 'Journal de Banque', description: 'Mouvements bancaires' },
  VT: { code: 'VT', libelle: 'Journal des Ventes', description: 'Factures clients' },
  AC: { code: 'AC', libelle: 'Journal des Achats', description: 'Factures fournisseurs' },
  PA: { code: 'PA', libelle: 'Journal de Paie', description: 'Salaires et cotisations' },
  OD: { code: 'OD', libelle: 'Opérations Diverses', description: 'Écritures diverses' },
  AN: { code: 'AN', libelle: 'À Nouveaux', description: 'Reports à nouveau' }
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

    // Calculer totaux
    const totalDebit = ecritures?.reduce((s, e) => s + (e.debit || 0), 0) || 0;
    const totalCredit = ecritures?.reduce((s, e) => s + (e.credit || 0), 0) || 0;

    res.json({
      ecritures: ecritures || [],
      totaux: {
        debit: totalDebit,
        credit: totalCredit,
        solde: totalDebit - totalCredit
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

    // Calculer solde
    const totalDebit = ecritures?.reduce((s, e) => s + (e.debit || 0), 0) || 0;
    const totalCredit = ecritures?.reduce((s, e) => s + (e.credit || 0), 0) || 0;

    res.json({
      ecritures: ecritures?.map(e => ({
        ...e,
        debit_euros: (e.debit / 100).toFixed(2),
        credit_euros: (e.credit / 100).toFixed(2)
      })) || [],
      solde_comptable: (totalDebit - totalCredit) / 100
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

    // Si facture payée, écriture banque
    if (facture.statut === 'payee') {
      const datePaiement = facture.date_paiement || dateFacture;
      const periodePaie = datePaiement.slice(0, 7);

      // Journal BQ - Encaissement
      // Débit 512 Banque
      ecritures.push({
        tenant_id: req.admin.tenant_id,
        journal_code: 'BQ',
        date_ecriture: datePaiement,
        numero_piece: facture.numero,
        compte_numero: '512',
        compte_libelle: 'Banque',
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
        journal_code: 'BQ',
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

    // Supprimer les anciennes écritures
    await supabase
      .from('ecritures_comptables')
      .delete()
      .eq('tenant_id', tenantId);

    // Récupérer toutes les factures
    const { data: factures } = await supabase
      .from('factures')
      .select('id')
      .eq('tenant_id', tenantId);

    // Récupérer toutes les dépenses
    const { data: depenses } = await supabase
      .from('depenses')
      .select('id')
      .eq('tenant_id', tenantId);

    let nbFactures = 0;
    let nbDepenses = 0;

    // Générer écritures factures
    for (const f of factures || []) {
      try {
        await generateFactureEcritures(tenantId, f.id);
        nbFactures++;
      } catch (e) {
        console.error(`Erreur facture ${f.id}:`, e);
      }
    }

    // Générer écritures dépenses
    for (const d of depenses || []) {
      try {
        await generateDepenseEcritures(tenantId, d.id);
        nbDepenses++;
      } catch (e) {
        console.error(`Erreur dépense ${d.id}:`, e);
      }
    }

    res.json({
      success: true,
      message: `Écritures générées: ${nbFactures} factures, ${nbDepenses} dépenses`
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur génération complète:', error);
    res.status(500).json({ error: 'Erreur génération écritures' });
  }
});

// Fonction helper pour générer écritures facture
async function generateFactureEcritures(tenantId, factureId) {
  const { data: facture } = await supabase
    .from('factures')
    .select('*')
    .eq('id', factureId)
    .single();

  if (!facture) return;

  const dateFacture = facture.date_facture;
  const periode = dateFacture.slice(0, 7);
  const exercice = parseInt(dateFacture.slice(0, 4));
  const montantTTC = facture.montant_ttc || 0;
  const montantHT = facture.montant_ht || montantTTC;
  const montantTVA = facture.montant_tva || 0;

  const ecritures = [
    {
      tenant_id: tenantId,
      journal_code: 'VT',
      date_ecriture: dateFacture,
      numero_piece: facture.numero,
      compte_numero: '411',
      compte_libelle: 'Clients',
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

    ecritures.push(
      {
        tenant_id: tenantId,
        journal_code: 'BQ',
        date_ecriture: datePaiement,
        numero_piece: facture.numero,
        compte_numero: '512',
        compte_libelle: 'Banque',
        libelle: `Encaissement ${facture.numero}`,
        debit: montantTTC,
        credit: 0,
        facture_id: factureId,
        periode: periodePaie,
        exercice
      },
      {
        tenant_id: tenantId,
        journal_code: 'BQ',
        date_ecriture: datePaiement,
        numero_piece: facture.numero,
        compte_numero: '411',
        compte_libelle: 'Clients',
        libelle: `Règlement ${facture.numero}`,
        debit: 0,
        credit: montantTTC,
        facture_id: factureId,
        periode: periodePaie,
        exercice
      }
    );
  }

  await supabase.from('ecritures_comptables').insert(ecritures);
}

// Fonction helper pour générer écritures dépense
async function generateDepenseEcritures(tenantId, depenseId) {
  const { data: depense } = await supabase
    .from('depenses')
    .select('*')
    .eq('id', depenseId)
    .single();

  if (!depense) return;

  const dateDepense = depense.date_depense;
  const periode = dateDepense.slice(0, 7);
  const exercice = parseInt(dateDepense.slice(0, 4));
  const montantTTC = depense.montant_ttc || depense.montant || 0;
  const montantHT = depense.montant || montantTTC;
  const montantTVA = depense.montant_tva || 0;
  const compteCharge = COMPTE_DEPENSE[depense.categorie] || COMPTE_DEPENSE.autre;

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
      compte_numero: '401',
      compte_libelle: 'Fournisseurs',
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
        compte_numero: '401',
        compte_libelle: 'Fournisseurs',
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

  await supabase.from('ecritures_comptables').insert(ecritures);
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

export default router;
