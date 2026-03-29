/**
 * Routes Journaux Comptables
 * Gestion des journaux et écritures comptables
 */

import express from 'express';
import { authenticateAdmin } from './adminAuth.js';
import { supabase } from '../config/supabase.js';
import { paginate } from '../middleware/paginate.js';
import { paginated } from '../utils/response.js';
import { isPeriodeVerrouillee } from '../services/exerciceService.js';
import { generateFEC, validateFEC, rapportControleFEC } from '../services/fecExportService.js';
import { prefillCA3, prefillCA12 } from '../services/comptaService.js';

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
router.get('/ecritures', paginate({ limit: 100 }), async (req, res) => {
  try {
    const { journal, periode, compte, non_lettrees } = req.query;
    const { page, limit, offset } = req.pagination;

    let countQuery = supabase
      .from('ecritures_comptables')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', req.admin.tenant_id);

    let query = supabase
      .from('ecritures_comptables')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .order('date_ecriture', { ascending: false })
      .order('id', { ascending: false });

    if (journal) {
      query = query.eq('journal_code', journal);
      countQuery = countQuery.eq('journal_code', journal);
    }
    if (periode) {
      query = query.eq('periode', periode);
      countQuery = countQuery.eq('periode', periode);
    }
    if (compte) {
      query = query.eq('compte_numero', compte);
      countQuery = countQuery.eq('compte_numero', compte);
    }
    if (non_lettrees === 'true') {
      query = query.is('lettrage', null);
      countQuery = countQuery.is('lettrage', null);
    }

    const { count: total } = await countQuery;
    const { data: ecritures, error } = await query.range(offset, offset + limit - 1);

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

    paginated(res, {
      data: {
        ecritures: ecritures || [],
        totaux: {
          debit: totalDebit,
          credit: totalCredit,
          solde: totalDebit - totalCredit,
          ...(soldeTresorerie !== null && { [labelSolde]: soldeTresorerie }),
          // Garder solde_banque pour rétrocompatibilité
          ...(journal === 'BQ' && soldeTresorerie !== null && { solde_banque: soldeTresorerie })
        }
      },
      page, limit, total: total || 0
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

    // Garde verrouillage période
    const verrouillee = await isPeriodeVerrouillee(req.admin.tenant_id, periode);
    if (verrouillee) {
      return res.status(403).json({ error: `Période ${periode} verrouillée — écriture interdite` });
    }

    // Auto-générer numero_piece si absent
    const pieceNum = numero_piece || `${journal_code}-${periode}-${Date.now().toString(36).toUpperCase()}`;

    const ecritures = lignes.map(l => ({
      tenant_id: req.admin.tenant_id,
      journal_code,
      date_ecriture,
      numero_piece: pieceNum,
      compte_numero: l.compte_numero,
      compte_libelle: l.compte_libelle,
      libelle: l.libelle,
      debit: l.debit || 0,
      credit: l.credit || 0,
      justificatif_url: l.justificatif_url || null,
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
    // Débit 411XXX Client (compte auxiliaire alphabétique)
    const compteClientManuel = facture.client_id ? getCompteClient(facture.client_id, facture.client_nom) : '411';
    ecritures.push({
      tenant_id: req.admin.tenant_id,
      journal_code: 'VT',
      date_ecriture: dateFacture,
      numero_piece: facture.numero,
      compte_numero: compteClientManuel,
      compte_libelle: facture.client_nom ? `Client ${facture.client_nom}` : 'Clients',
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

    // Crédit 44571 TVA collectée (négatif pour avoirs)
    if (montantTVA !== 0) {
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

      // Crédit 411XXX Client
      ecritures.push({
        tenant_id: req.admin.tenant_id,
        journal_code: journalCode,
        date_ecriture: datePaiement,
        numero_piece: facture.numero,
        compte_numero: compteClientManuel,
        compte_libelle: facture.client_nom ? `Client ${facture.client_nom}` : 'Clients',
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
    const montantTVA = depense.montant_tva || (montantTTC > montantHT ? montantTTC - montantHT : 0);
    const compteCharge = COMPTE_DEPENSE[depense.categorie] || COMPTE_DEPENSE.autre;

    // Numéro de facture et libellé enrichi (même logique que depenses.js)
    const fournisseur = depense.libelle || depense.categorie || '';
    const numFacture = depense.description?.match(/^Fact\.\s*(.+?)\s*—/)?.[1] || depense.description?.match(/^Fact\.\s*(\S+)/)?.[1] || null;
    const libelleComplet = numFacture ? `${fournisseur} — Fact. ${numFacture}` : fournisseur;
    const codeAux = fournisseur.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3) || 'DIV';

    const ecritures = [];

    // Les charges de personnel (salaires, cotisations) sont gérées par le journal PA
    // On ne génère PAS d'écritures AC pour éviter les doubles charges
    const isChargePersonnel = ['salaires', 'cotisations_sociales'].includes(depense.categorie);

    if (!isChargePersonnel) {
      // Journal AC - Écriture d'achat
      ecritures.push({
        tenant_id: req.admin.tenant_id,
        journal_code: 'AC',
        date_ecriture: dateDepense,
        numero_piece: numFacture || `DEP-${depense.id}`,
        compte_numero: compteCharge.numero,
        compte_libelle: compteCharge.libelle,
        libelle: libelleComplet,
        debit: montantHT,
        credit: 0,
        depense_id,
        periode,
        exercice
      });

      if (montantTVA > 0 && depense.deductible_tva !== false) {
        ecritures.push({
          tenant_id: req.admin.tenant_id,
          journal_code: 'AC',
          date_ecriture: dateDepense,
          numero_piece: numFacture || `DEP-${depense.id}`,
          compte_numero: '44566',
          compte_libelle: 'TVA déductible',
          libelle: `TVA ${libelleComplet}`,
          debit: montantTVA,
          credit: 0,
          depense_id,
          periode,
          exercice
        });
      }

      ecritures.push({
        tenant_id: req.admin.tenant_id,
        journal_code: 'AC',
        date_ecriture: dateDepense,
        numero_piece: numFacture || `DEP-${depense.id}`,
        compte_numero: `401${codeAux}`,
        compte_libelle: `Fournisseur ${fournisseur}`,
        libelle: libelleComplet,
        debit: 0,
        credit: montantTTC,
        depense_id,
        periode,
        exercice
      });
    }

    // Si dépense payée, écriture banque
    if (depense.payee !== false) {
      const datePaiement = depense.date_paiement?.split('T')[0] || dateDepense;
      const periodePaie = datePaiement.slice(0, 7);

      // Pour les charges de personnel, le compte tiers est 421/431 (pas 401)
      const compteTiers = isChargePersonnel
        ? (depense.categorie === 'salaires' ? '421' : '431')
        : `401${codeAux}`;
      const libelleTiers = isChargePersonnel
        ? (depense.categorie === 'salaires' ? 'Personnel - Rémunérations dues' : 'Sécurité sociale')
        : `Fournisseur ${fournisseur}`;

      ecritures.push({
        tenant_id: req.admin.tenant_id,
        journal_code: 'BQ',
        date_ecriture: datePaiement,
        numero_piece: numFacture || `DEP-${depense.id}`,
        compte_numero: compteTiers,
        compte_libelle: libelleTiers,
        libelle: `Règlement ${libelleComplet}`,
        debit: montantTTC,
        credit: 0,
        depense_id,
        periode: periodePaie,
        exercice
      });

      ecritures.push({
        tenant_id: req.admin.tenant_id,
        journal_code: 'BQ',
        date_ecriture: datePaiement,
        numero_piece: numFacture || `DEP-${depense.id}`,
        compte_numero: '512',
        compte_libelle: 'Banque',
        libelle: `Paiement ${libelleComplet}`,
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

    // Supprimer uniquement les écritures de ventes (VT), achats (AC) et banque (BQ)
    // PRÉSERVER les journaux AN (à nouveaux) et PA (paie) qui ne sont pas régénérés ici
    const journauxARegenerer = ['VT', 'AC', 'BQ'];
    for (const code of journauxARegenerer) {
      const { error: deleteError } = await supabase
        .from('ecritures_comptables')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('journal_code', code);

      if (deleteError) {
        console.error(`[JOURNAUX] Erreur suppression journal ${code}:`, deleteError);
      }
    }
    console.log(`[JOURNAUX] Écritures VT/HA supprimées (AN et PA préservés)`);

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

  // Sous-compte client auxiliaire (411XXX — 3 premières lettres du nom)
  const compteClient = facture.client_id ? getCompteClient(facture.client_id, facture.client_nom) : '411';
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

  if (montantTVA !== 0) {
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
  const montantTVA = depense.montant_tva || (montantTTC > montantHT ? montantTTC - montantHT : 0);
  const compteCharge = COMPTE_DEPENSE[depense.categorie] || COMPTE_DEPENSE.autre;

  // Numéro de facture et libellé enrichi (même logique que depenses.js)
  const fournisseur = depense.libelle || depense.categorie || '';
  const numFacture = depense.description?.match(/^Fact\.\s*(.+?)\s*—/)?.[1] || depense.description?.match(/^Fact\.\s*(\S+)/)?.[1] || null;
  const libelleComplet = numFacture ? `${fournisseur} — Fact. ${numFacture}` : fournisseur;
  const codeAux = fournisseur.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3) || 'DIV';
  const compteFournisseur = `401${codeAux}`;
  const libelleFournisseur = `Fournisseur ${fournisseur}`;

  const ecritures = [];

  // Les charges de personnel (salaires, cotisations) sont gérées par le journal PA (641/421, 645/431)
  // On ne génère PAS d'écritures AC pour éviter les doubles charges
  // On génère SEULEMENT les écritures BQ de paiement avec les bons comptes (421/431)
  const isChargePersonnel = ['salaires', 'cotisations_sociales'].includes(depense.categorie);

  if (!isChargePersonnel) {
    // Écritures AC normales (charge + fournisseur 401)
    ecritures.push(
      {
        tenant_id: tenantId,
        journal_code: 'AC',
        date_ecriture: dateDepense,
        numero_piece: numFacture || `DEP-${depense.id}`,
        compte_numero: compteCharge.numero,
        compte_libelle: compteCharge.libelle,
        libelle: libelleComplet,
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
        numero_piece: numFacture || `DEP-${depense.id}`,
        compte_numero: compteFournisseur,
        compte_libelle: libelleFournisseur,
        libelle: libelleComplet,
        debit: 0,
        credit: montantTTC,
        depense_id: depenseId,
        periode,
        exercice
      }
    );

    if (montantTVA > 0 && depense.deductible_tva !== false) {
      ecritures.push({
        tenant_id: tenantId,
        journal_code: 'AC',
        date_ecriture: dateDepense,
        numero_piece: numFacture || `DEP-${depense.id}`,
        compte_numero: '44566',
        compte_libelle: 'TVA déductible',
        libelle: `TVA ${libelleComplet}`,
        debit: montantTVA,
        credit: 0,
        depense_id: depenseId,
        periode,
        exercice
      });
    }
  }

  if (depense.payee !== false) {
    const datePaiement = depense.date_paiement?.split('T')[0] || dateDepense;
    const periodePaie = datePaiement.slice(0, 7);

    // Pour les charges de personnel, le compte tiers est 421/431 (pas 401)
    const compteTiers = isChargePersonnel
      ? (depense.categorie === 'salaires' ? '421' : '431')
      : compteFournisseur;
    const libelleTiers = isChargePersonnel
      ? (depense.categorie === 'salaires' ? 'Personnel - Rémunérations dues' : 'Sécurité sociale')
      : libelleFournisseur;

    ecritures.push(
      {
        tenant_id: tenantId,
        journal_code: 'BQ',
        date_ecriture: datePaiement,
        numero_piece: numFacture || `DEP-${depense.id}`,
        compte_numero: compteTiers,
        compte_libelle: libelleTiers,
        libelle: `Règlement ${libelleComplet}`,
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
        numero_piece: numFacture || `DEP-${depense.id}`,
        compte_numero: '512',
        compte_libelle: 'Banque',
        libelle: `Paiement ${libelleComplet}`,
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
 * Génère un code auxiliaire à partir d'un nom (3 premières lettres, sans accents)
 * @param {string} nom - Nom du tiers (client ou fournisseur)
 * @returns {string} - Code auxiliaire (ex: MAR, ORA, BEA)
 */
function genererCodeAuxiliaire(nom) {
  if (!nom) return 'DIV';
  return nom
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // retirer accents
    .replace(/[^a-zA-Z]/g, '') // garder que les lettres
    .toUpperCase()
    .slice(0, 3) || 'DIV';
}

/**
 * Génère un numéro de sous-compte client (411XXX)
 * Convention : 411 + 3 premières lettres du nom client
 * Ex: 411MAR (Martin), 411DUB (Dubois)
 * @param {number} clientId - ID du client (fallback numérique)
 * @param {string} clientNom - Nom du client
 * @returns {string} - Numéro de compte (ex: 411MAR)
 */
function getCompteClient(clientId, clientNom) {
  if (clientNom) return `411${genererCodeAuxiliaire(clientNom)}`;
  return `411${String(clientId).padStart(5, '0')}`;
}

/**
 * Génère un numéro de sous-compte fournisseur (401XXX)
 * Convention : 401 + 3 premières lettres du nom fournisseur
 * Ex: 401ORA (Orange), 401BEA (Beauté Pro)
 * @param {number} fournisseurId - ID du fournisseur (fallback numérique)
 * @param {string} fournisseurNom - Nom du fournisseur
 * @returns {string} - Numéro de compte (ex: 401ORA)
 */
function getCompteFournisseur(fournisseurId, fournisseurNom) {
  if (fournisseurNom) return `401${genererCodeAuxiliaire(fournisseurNom)}`;
  return `401${String(fournisseurId).padStart(5, '0')}`;
}

/**
 * GET /api/journaux/plan-comptable
 * Retourne le plan comptable avec tous les comptes utilisés
 */
router.get('/plan-comptable', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // 1. Comptes référencés dans la table comptes_comptables
    const { data: comptesDB } = await supabase
      .from('comptes_comptables')
      .select('numero, libelle, classe, type, nature, actif')
      .eq('tenant_id', tenantId)
      .order('numero');

    // 2. Comptes découverts dans les écritures (complémentaire)
    const { data: ecritures, error } = await supabase
      .from('ecritures_comptables')
      .select('compte_numero, compte_libelle')
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Fusionner : comptes DB prioritaires, puis écritures pour les comptes non référencés
    const comptesMap = new Map();
    comptesDB?.forEach(c => {
      comptesMap.set(c.numero, {
        numero: c.numero,
        libelle: c.libelle,
        classe: String(c.classe),
        type: c.type,
        nature: c.nature,
        actif: c.actif
      });
    });

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
// PLAN COMPTABLE — CRUD comptes
// ============================================

/**
 * POST /api/journaux/plan-comptable/comptes
 * Créer un nouveau compte comptable
 */
router.post('/plan-comptable/comptes', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { numero, libelle, type, nature } = req.body;

    if (!numero || !libelle) {
      return res.status(400).json({ error: 'Numéro et libellé requis' });
    }

    if (!/^\d{3,8}$/.test(numero)) {
      return res.status(400).json({ error: 'Numéro de compte invalide (3-8 chiffres)' });
    }

    const classe = parseInt(numero.charAt(0));
    if (classe < 1 || classe > 8) {
      return res.status(400).json({ error: 'Classe de compte invalide (1-8)' });
    }

    const { data, error } = await supabase
      .from('comptes_comptables')
      .insert({
        tenant_id: tenantId,
        numero,
        libelle,
        classe,
        type: type || 'general',
        nature: nature || null
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `Le compte ${numero} existe déjà` });
      }
      throw error;
    }

    res.status(201).json({ success: true, compte: data });
  } catch (error) {
    console.error('[JOURNAUX] Erreur création compte:', error);
    res.status(500).json({ error: 'Erreur création compte' });
  }
});

/**
 * PUT /api/journaux/plan-comptable/comptes/:numero
 * Modifier un compte comptable
 */
router.put('/plan-comptable/comptes/:numero', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { numero } = req.params;
    const { libelle, type, nature, actif } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (libelle !== undefined) updates.libelle = libelle;
    if (type !== undefined) updates.type = type;
    if (nature !== undefined) updates.nature = nature;
    if (actif !== undefined) updates.actif = actif;

    const { data, error } = await supabase
      .from('comptes_comptables')
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('numero', numero)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Compte non trouvé' });

    res.json({ success: true, compte: data });
  } catch (error) {
    console.error('[JOURNAUX] Erreur modification compte:', error);
    res.status(500).json({ error: 'Erreur modification compte' });
  }
});

/**
 * DELETE /api/journaux/plan-comptable/comptes/:numero
 * Supprimer un compte (uniquement si non utilisé)
 */
router.delete('/plan-comptable/comptes/:numero', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { numero } = req.params;

    // Vérifier si le compte est utilisé dans des écritures
    const { count } = await supabase
      .from('ecritures_comptables')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('compte_numero', numero);

    if (count > 0) {
      return res.status(409).json({
        error: `Ce compte est utilisé dans ${count} écriture(s). Désactivez-le plutôt.`
      });
    }

    const { error } = await supabase
      .from('comptes_comptables')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('numero', numero);

    if (error) throw error;

    res.json({ success: true, message: `Compte ${numero} supprimé` });
  } catch (error) {
    console.error('[JOURNAUX] Erreur suppression compte:', error);
    res.status(500).json({ error: 'Erreur suppression compte' });
  }
});

/**
 * POST /api/journaux/plan-comptable/init
 * Initialiser le PCG avec les comptes standards français
 */
router.post('/plan-comptable/init', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    // Vérifier si déjà initialisé
    const { count } = await supabase
      .from('comptes_comptables')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (count > 0) {
      return res.status(409).json({ error: 'Le plan comptable est déjà initialisé', count });
    }

    const pcgStandard = [
      // Classe 1 — Capitaux
      { numero: '101', libelle: 'Capital social', classe: 1, nature: 'credit' },
      { numero: '106', libelle: 'Réserves', classe: 1, nature: 'credit' },
      { numero: '108', libelle: 'Compte de l\'exploitant', classe: 1, nature: 'credit' },
      { numero: '110', libelle: 'Report à nouveau (solde créditeur)', classe: 1, nature: 'credit' },
      { numero: '119', libelle: 'Report à nouveau (solde débiteur)', classe: 1, nature: 'debit' },
      { numero: '120', libelle: 'Résultat de l\'exercice (bénéfice)', classe: 1, nature: 'credit' },
      { numero: '129', libelle: 'Résultat de l\'exercice (perte)', classe: 1, nature: 'debit' },
      { numero: '164', libelle: 'Emprunts auprès des établissements de crédit', classe: 1, nature: 'credit' },
      // Classe 2 — Immobilisations
      { numero: '205', libelle: 'Concessions, brevets, licences', classe: 2, nature: 'debit' },
      { numero: '2183', libelle: 'Matériel de bureau et informatique', classe: 2, nature: 'debit' },
      { numero: '2184', libelle: 'Mobilier', classe: 2, nature: 'debit' },
      { numero: '2182', libelle: 'Matériel de transport', classe: 2, nature: 'debit' },
      { numero: '2815', libelle: 'Amort. installations techniques', classe: 2, nature: 'credit' },
      { numero: '2818', libelle: 'Amort. autres immobilisations corporelles', classe: 2, nature: 'credit' },
      // Classe 3 — Stocks
      { numero: '311', libelle: 'Matières premières', classe: 3, nature: 'debit' },
      { numero: '355', libelle: 'Produits finis', classe: 3, nature: 'debit' },
      { numero: '371', libelle: 'Marchandises', classe: 3, nature: 'debit' },
      // Classe 4 — Tiers
      { numero: '401', libelle: 'Fournisseurs', classe: 4, nature: 'credit' },
      { numero: '4011', libelle: 'Fournisseurs — Achats de biens', classe: 4, nature: 'credit', type: 'auxiliaire' },
      { numero: '4012', libelle: 'Fournisseurs — Achats de services', classe: 4, nature: 'credit', type: 'auxiliaire' },
      { numero: '411', libelle: 'Clients', classe: 4, nature: 'debit' },
      { numero: '4111', libelle: 'Clients — Ventes de services', classe: 4, nature: 'debit', type: 'auxiliaire' },
      { numero: '421', libelle: 'Personnel — Rémunérations dues', classe: 4, nature: 'credit' },
      { numero: '431', libelle: 'Sécurité sociale', classe: 4, nature: 'credit' },
      { numero: '437', libelle: 'Autres organismes sociaux', classe: 4, nature: 'credit' },
      { numero: '4456', libelle: 'TVA déductible', classe: 4, nature: 'debit' },
      { numero: '44562', libelle: 'TVA déductible sur immobilisations', classe: 4, nature: 'debit' },
      { numero: '44566', libelle: 'TVA déductible sur biens et services', classe: 4, nature: 'debit' },
      { numero: '4457', libelle: 'TVA collectée', classe: 4, nature: 'credit' },
      { numero: '44571', libelle: 'TVA collectée', classe: 4, nature: 'credit' },
      { numero: '44551', libelle: 'TVA à décaisser', classe: 4, nature: 'credit' },
      { numero: '44567', libelle: 'Crédit de TVA à reporter', classe: 4, nature: 'debit' },
      { numero: '455', libelle: 'Associés — Comptes courants', classe: 4, nature: 'credit' },
      { numero: '467', libelle: 'Autres comptes débiteurs ou créditeurs', classe: 4 },
      // Classe 5 — Trésorerie
      { numero: '512', libelle: 'Banque', classe: 5, nature: 'debit' },
      { numero: '5121', libelle: 'Banque — Compte courant', classe: 5, nature: 'debit' },
      { numero: '514', libelle: 'Chèques postaux', classe: 5, nature: 'debit' },
      { numero: '530', libelle: 'Caisse', classe: 5, nature: 'debit' },
      { numero: '580', libelle: 'Virements internes', classe: 5 },
      // Classe 6 — Charges
      { numero: '601', libelle: 'Achats de matières premières', classe: 6, nature: 'debit' },
      { numero: '602', libelle: 'Achats de fournitures', classe: 6, nature: 'debit' },
      { numero: '604', libelle: 'Achats d\'études et de prestations', classe: 6, nature: 'debit' },
      { numero: '606', libelle: 'Achats non stockés de matières et fournitures', classe: 6, nature: 'debit' },
      { numero: '607', libelle: 'Achats de marchandises', classe: 6, nature: 'debit' },
      { numero: '611', libelle: 'Sous-traitance générale', classe: 6, nature: 'debit' },
      { numero: '613', libelle: 'Locations', classe: 6, nature: 'debit' },
      { numero: '615', libelle: 'Entretien et réparations', classe: 6, nature: 'debit' },
      { numero: '616', libelle: 'Primes d\'assurance', classe: 6, nature: 'debit' },
      { numero: '618', libelle: 'Divers', classe: 6, nature: 'debit' },
      { numero: '622', libelle: 'Rémunérations d\'intermédiaires et honoraires', classe: 6, nature: 'debit' },
      { numero: '623', libelle: 'Publicité, publications, relations publiques', classe: 6, nature: 'debit' },
      { numero: '625', libelle: 'Déplacements, missions et réceptions', classe: 6, nature: 'debit' },
      { numero: '626', libelle: 'Frais postaux et de télécommunications', classe: 6, nature: 'debit' },
      { numero: '627', libelle: 'Services bancaires', classe: 6, nature: 'debit' },
      { numero: '635', libelle: 'Autres impôts, taxes et versements assimilés', classe: 6, nature: 'debit' },
      { numero: '641', libelle: 'Rémunérations du personnel', classe: 6, nature: 'debit' },
      { numero: '645', libelle: 'Charges de sécurité sociale et de prévoyance', classe: 6, nature: 'debit' },
      { numero: '651', libelle: 'Redevances pour concessions, brevets, licences', classe: 6, nature: 'debit' },
      { numero: '658', libelle: 'Charges diverses de gestion courante', classe: 6, nature: 'debit' },
      { numero: '661', libelle: 'Charges d\'intérêts', classe: 6, nature: 'debit' },
      { numero: '671', libelle: 'Charges exceptionnelles sur opérations de gestion', classe: 6, nature: 'debit' },
      { numero: '681', libelle: 'Dotations aux amortissements et provisions', classe: 6, nature: 'debit' },
      // Classe 7 — Produits
      { numero: '706', libelle: 'Prestations de services', classe: 7, nature: 'credit' },
      { numero: '707', libelle: 'Ventes de marchandises', classe: 7, nature: 'credit' },
      { numero: '708', libelle: 'Produits des activités annexes', classe: 7, nature: 'credit' },
      { numero: '741', libelle: 'Subventions d\'exploitation', classe: 7, nature: 'credit' },
      { numero: '761', libelle: 'Produits de participations', classe: 7, nature: 'credit' },
      { numero: '764', libelle: 'Revenus des valeurs mobilières', classe: 7, nature: 'credit' },
      { numero: '771', libelle: 'Produits exceptionnels sur opérations de gestion', classe: 7, nature: 'credit' },
      { numero: '781', libelle: 'Reprises sur amortissements et provisions', classe: 7, nature: 'credit' },
    ];

    const rows = pcgStandard.map(c => ({
      tenant_id: tenantId,
      numero: c.numero,
      libelle: c.libelle,
      classe: c.classe,
      type: c.type || 'general',
      nature: c.nature || null
    }));

    const { data, error } = await supabase
      .from('comptes_comptables')
      .insert(rows)
      .select('numero');

    if (error) throw error;

    res.json({ success: true, message: `${data.length} comptes créés`, count: data.length });
  } catch (error) {
    console.error('[JOURNAUX] Erreur init PCG:', error);
    res.status(500).json({ error: 'Erreur initialisation plan comptable' });
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
 * Export FEC conforme (Fichier des Écritures Comptables) - Art. L47 A-I LPF
 * Délégué à fecExportService pour conformité SIREN, CompAux, dates
 */
router.get('/fec', async (req, res) => {
  try {
    const { exercice } = req.query;
    if (!exercice) {
      return res.status(400).json({ error: 'Exercice requis pour le FEC' });
    }

    const result = await generateFEC(req.admin.tenant_id, exercice);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  } catch (error) {
    console.error('[JOURNAUX] Erreur export FEC:', error);
    res.status(500).json({ error: 'Erreur export FEC' });
  }
});

/**
 * GET /api/journaux/fec/validation — Validation pré-export FEC
 */
router.get('/fec/validation', async (req, res) => {
  try {
    const { exercice } = req.query;
    if (!exercice) return res.status(400).json({ error: 'Exercice requis' });

    const result = await validateFEC(req.admin.tenant_id, exercice);
    res.json(result);
  } catch (error) {
    console.error('[JOURNAUX] Erreur validation FEC:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/journaux/fec/rapport — Rapport de contrôle FEC
 */
router.get('/fec/rapport', async (req, res) => {
  try {
    const { exercice } = req.query;
    if (!exercice) return res.status(400).json({ error: 'Exercice requis' });

    const result = await rapportControleFEC(req.admin.tenant_id, exercice);
    res.json(result);
  } catch (error) {
    console.error('[JOURNAUX] Erreur rapport FEC:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/journaux/tva/ca3 — Pré-remplissage déclaration TVA CA3
 */
router.get('/tva/ca3', async (req, res) => {
  try {
    const { periode } = req.query;
    if (!periode) return res.status(400).json({ error: 'Période requise (YYYY-MM)' });

    const result = await prefillCA3(req.admin.tenant_id, periode);
    res.json(result);
  } catch (error) {
    console.error('[JOURNAUX] Erreur CA3:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/journaux/tva/ca12 — Pré-remplissage déclaration TVA CA12
 */
router.get('/tva/ca12', async (req, res) => {
  try {
    const { exercice } = req.query;
    if (!exercice) return res.status(400).json({ error: 'Exercice requis' });

    const result = await prefillCA12(req.admin.tenant_id, exercice);
    res.json(result);
  } catch (error) {
    console.error('[JOURNAUX] Erreur CA12:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/journaux/ecritures/contrepasser — Contrepassation d'écritures
 */
router.post('/ecritures/contrepasser', async (req, res) => {
  try {
    const { ecriture_ids, date_contrepassation, motif } = req.body;

    if (!ecriture_ids || ecriture_ids.length === 0) {
      return res.status(400).json({ error: 'IDs d\'écritures requis' });
    }

    const dateCP = date_contrepassation || new Date().toISOString().slice(0, 10);
    const periode = dateCP.slice(0, 7);

    // Garde verrouillage
    const verrouillee = await isPeriodeVerrouillee(req.admin.tenant_id, periode);
    if (verrouillee) {
      return res.status(403).json({ error: `Période ${periode} verrouillée` });
    }

    // Charger les écritures originales
    const { data: originales, error } = await supabase
      .from('ecritures_comptables')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .in('id', ecriture_ids);

    if (error) throw error;
    if (!originales || originales.length === 0) {
      return res.status(404).json({ error: 'Écritures introuvables' });
    }

    // Créer les écritures miroir (débit↔crédit)
    const exercice = parseInt(dateCP.slice(0, 4));
    const pieceNum = `CP-${periode}-${Date.now().toString(36).toUpperCase()}`;

    const contrepassations = originales.map(e => ({
      tenant_id: req.admin.tenant_id,
      journal_code: 'OD',
      date_ecriture: dateCP,
      numero_piece: pieceNum,
      compte_numero: e.compte_numero,
      compte_libelle: e.compte_libelle,
      libelle: `Contrepassation : ${motif || e.libelle}`,
      debit: e.credit || 0,   // Inversé
      credit: e.debit || 0,   // Inversé
      contrepassation_de: e.id,
      periode,
      exercice
    }));

    const { data: created, error: insertErr } = await supabase
      .from('ecritures_comptables')
      .insert(contrepassations)
      .select();

    if (insertErr) throw insertErr;

    res.json({
      success: true,
      nb_ecritures: created.length,
      ecritures: created
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur contrepassation:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/journaux/modeles-ecritures — Liste des modèles
 */
router.get('/modeles-ecritures', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('modeles_ecritures')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('actif', true)
      .order('nom');

    if (error) throw error;
    res.json({ modeles: data || [] });
  } catch (error) {
    console.error('[JOURNAUX] Erreur modèles:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/journaux/modeles-ecritures — Créer un modèle
 */
router.post('/modeles-ecritures', async (req, res) => {
  try {
    const { nom, description, journal_code, lignes, recurrence } = req.body;

    if (!nom || !lignes || lignes.length === 0) {
      return res.status(400).json({ error: 'Nom et lignes requis' });
    }

    const { data, error } = await supabase
      .from('modeles_ecritures')
      .insert({
        tenant_id: req.admin.tenant_id,
        nom,
        description,
        journal_code: journal_code || 'OD',
        lignes,
        recurrence
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, modele: data });
  } catch (error) {
    console.error('[JOURNAUX] Erreur création modèle:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/journaux/modeles-ecritures/:id/appliquer — Appliquer un modèle
 */
router.post('/modeles-ecritures/:id/appliquer', async (req, res) => {
  try {
    const { date_ecriture } = req.body;
    if (!date_ecriture) return res.status(400).json({ error: 'Date requise' });

    // Charger le modèle
    const { data: modele, error } = await supabase
      .from('modeles_ecritures')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('id', parseInt(req.params.id))
      .single();

    if (error || !modele) return res.status(404).json({ error: 'Modèle introuvable' });

    const periode = date_ecriture.slice(0, 7);
    const exercice = parseInt(date_ecriture.slice(0, 4));

    // Garde verrouillage
    const verrouillee = await isPeriodeVerrouillee(req.admin.tenant_id, periode);
    if (verrouillee) {
      return res.status(403).json({ error: `Période ${periode} verrouillée` });
    }

    const pieceNum = `${modele.journal_code}-${periode}-${Date.now().toString(36).toUpperCase()}`;

    const ecritures = modele.lignes.map(l => ({
      tenant_id: req.admin.tenant_id,
      journal_code: modele.journal_code,
      date_ecriture,
      numero_piece: pieceNum,
      compte_numero: l.compte_numero,
      compte_libelle: l.compte_libelle,
      libelle: l.libelle,
      debit: l.debit || 0,
      credit: l.credit || 0,
      periode,
      exercice
    }));

    const { data: created, error: insertErr } = await supabase
      .from('ecritures_comptables')
      .insert(ecritures)
      .select();

    if (insertErr) throw insertErr;

    res.json({ success: true, nb_ecritures: created.length, ecritures: created });
  } catch (error) {
    console.error('[JOURNAUX] Erreur application modèle:', error);
    res.status(500).json({ error: error.message });
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

// ============================================
// DASHBOARD ANALYTIQUE COMPTABLE
// ============================================

/**
 * Helper : construit un compte de résultat à partir d'écritures filtrées
 */
function buildCompteResultatFromEcritures(ecritures) {
  const comptes = {};
  ecritures?.forEach(e => {
    const classe = e.compte_numero.charAt(0);
    if (classe !== '6' && classe !== '7') return;
    const num = e.compte_numero.substring(0, 3);
    if (!comptes[num]) {
      comptes[num] = { numero: num, libelle: getLibelleCompte(num), debit: 0, credit: 0 };
    }
    comptes[num].debit += e.debit || 0;
    comptes[num].credit += e.credit || 0;
  });

  const charges = { exploitation: [], financieres: [], exceptionnelles: [] };
  const produits = { exploitation: [], financiers: [], exceptionnels: [] };

  Object.values(comptes).forEach(c => {
    const num = parseInt(c.numero);
    const montant = c.numero.charAt(0) === '6'
      ? (c.debit - c.credit) / 100
      : (c.credit - c.debit) / 100;
    if (num >= 600 && num <= 659) charges.exploitation.push({ ...c, montant });
    else if (num >= 660 && num <= 669) charges.financieres.push({ ...c, montant });
    else if (num >= 670 && num <= 679) charges.exceptionnelles.push({ ...c, montant });
    else if (num >= 700 && num <= 759) produits.exploitation.push({ ...c, montant });
    else if (num >= 760 && num <= 769) produits.financiers.push({ ...c, montant });
    else if (num >= 770 && num <= 779) produits.exceptionnels.push({ ...c, montant });
  });

  const tCE = charges.exploitation.reduce((s, c) => s + c.montant, 0);
  const tCF = charges.financieres.reduce((s, c) => s + c.montant, 0);
  const tCX = charges.exceptionnelles.reduce((s, c) => s + c.montant, 0);
  const tPE = produits.exploitation.reduce((s, c) => s + c.montant, 0);
  const tPF = produits.financiers.reduce((s, c) => s + c.montant, 0);
  const tPX = produits.exceptionnels.reduce((s, c) => s + c.montant, 0);
  const totalCharges = tCE + tCF + tCX;
  const totalProduits = tPE + tPF + tPX;
  const net = totalProduits - totalCharges;

  return {
    charges, produits,
    totaux: {
      charges: { exploitation: tCE, financieres: tCF, exceptionnelles: tCX, total: totalCharges },
      produits: { exploitation: tPE, financiers: tPF, exceptionnels: tPX, total: totalProduits },
      resultats: {
        exploitation: tPE - tCE, financier: tPF - tCF, exceptionnel: tPX - tCX,
        net, type: net >= 0 ? 'bénéfice' : 'perte'
      }
    }
  };
}

/**
 * GET /api/journaux/analytics/dashboard
 * Dashboard KPI comptable consolidé
 */
router.get('/analytics/dashboard', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const exercice = parseInt(req.query.exercice) || new Date().getFullYear();
    const now = new Date();
    const currentMonth = `${exercice}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Période courante = du 1er janvier au dernier jour du mois courant
    const startOfYear = `${exercice}-01-01`;
    const endOfYear = `${exercice}-12-31`;

    // Période précédente (année N-1)
    const prevExercice = exercice - 1;
    const prevStartOfYear = `${prevExercice}-01-01`;
    const prevEndOfYear = `${prevExercice}-12-31`;

    // 6 requêtes parallèles
    const [ecrituresCur, ecrituresPrev, ecrituresMensuelles, facturesRes, facturesImpayeesRes, tresoMensuelle] = await Promise.all([
      // 1. Écritures exercice courant
      supabase.from('ecritures_comptables')
        .select('compte_numero, debit, credit, date_ecriture, periode')
        .eq('tenant_id', tenantId)
        .eq('exercice', exercice),

      // 2. Écritures exercice précédent
      supabase.from('ecritures_comptables')
        .select('compte_numero, debit, credit')
        .eq('tenant_id', tenantId)
        .eq('exercice', prevExercice),

      // 3. Écritures par mois (12 derniers mois, classes 6+7)
      supabase.from('ecritures_comptables')
        .select('compte_numero, debit, credit, periode')
        .eq('tenant_id', tenantId)
        .gte('periode', `${prevExercice}-${String(now.getMonth() + 2).padStart(2, '0')}`)
        .lte('periode', currentMonth),

      // 4. Factures pour top services + top clients
      supabase.from('factures')
        .select('service_nom, client_id, client_nom, montant_ht, montant_ttc, statut')
        .eq('tenant_id', tenantId)
        .in('statut', ['payee', 'envoyee', 'generee'])
        .gte('date_facture', startOfYear)
        .lte('date_facture', endOfYear),

      // 5. Factures impayées
      supabase.from('factures')
        .select('id, montant_ttc')
        .eq('tenant_id', tenantId)
        .in('statut', ['generee', 'envoyee']),

      // 6. Trésorerie mensuelle (journal BQ + CA, compte 512 et 530)
      supabase.from('ecritures_comptables')
        .select('compte_numero, debit, credit, periode')
        .eq('tenant_id', tenantId)
        .in('compte_numero', ['512', '530'])
        .gte('periode', `${prevExercice}-${String(now.getMonth() + 2).padStart(2, '0')}`)
        .lte('periode', currentMonth),
    ]);

    const ecCur = ecrituresCur.data || [];
    const ecPrev = ecrituresPrev.data || [];
    const factures = facturesRes.data || [];

    // --- KPIs ---
    let ca_ht = 0, charges = 0, ca_ht_prev = 0, charges_prev = 0;
    let tva_collectee = 0, tva_deductible = 0;

    for (const e of ecCur) {
      const cl = e.compte_numero.charAt(0);
      if (cl === '7') ca_ht += (e.credit - e.debit) / 100;
      if (cl === '6') charges += (e.debit - e.credit) / 100;
      if (e.compte_numero.startsWith('44571')) tva_collectee += (e.credit - e.debit) / 100;
      if (e.compte_numero.startsWith('44566')) tva_deductible += (e.debit - e.credit) / 100;
    }

    for (const e of ecPrev) {
      const cl = e.compte_numero.charAt(0);
      if (cl === '7') ca_ht_prev += (e.credit - e.debit) / 100;
      if (cl === '6') charges_prev += (e.debit - e.credit) / 100;
    }

    const resultat_net = ca_ht - charges;
    const resultat_net_prev = ca_ht_prev - charges_prev;
    const marge_pct = ca_ht > 0 ? (resultat_net / ca_ht) * 100 : 0;
    const tva_nette = tva_collectee - tva_deductible;

    const impayees = facturesImpayeesRes.data || [];
    const factures_impayees_count = impayees.length;
    const factures_impayees_montant = impayees.reduce((s, f) => s + (f.montant_ttc || 0), 0) / 100;

    const variation = (cur, prev) => prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : 0;

    const kpis = {
      ca_ht: Math.round(ca_ht * 100) / 100,
      ca_ht_prev: Math.round(ca_ht_prev * 100) / 100,
      variation_ca_pct: Math.round(variation(ca_ht, ca_ht_prev) * 10) / 10,
      charges: Math.round(charges * 100) / 100,
      charges_prev: Math.round(charges_prev * 100) / 100,
      variation_charges_pct: Math.round(variation(charges, charges_prev) * 10) / 10,
      resultat_net: Math.round(resultat_net * 100) / 100,
      resultat_net_prev: Math.round(resultat_net_prev * 100) / 100,
      variation_resultat_pct: Math.round(variation(resultat_net, resultat_net_prev) * 10) / 10,
      marge_pct: Math.round(marge_pct * 10) / 10,
      tva_nette: Math.round(tva_nette * 100) / 100,
      factures_impayees_count,
      factures_impayees_montant: Math.round(factures_impayees_montant * 100) / 100,
    };

    // --- Tendance 12 mois ---
    const tendanceMap = {};
    for (const e of (ecrituresMensuelles.data || [])) {
      const mois = e.periode;
      if (!mois) continue;
      if (!tendanceMap[mois]) tendanceMap[mois] = { mois, ca_ht: 0, charges: 0, resultat: 0 };
      const cl = e.compte_numero.charAt(0);
      if (cl === '7') tendanceMap[mois].ca_ht += (e.credit - e.debit) / 100;
      if (cl === '6') tendanceMap[mois].charges += (e.debit - e.credit) / 100;
    }
    const tendance_12mois = Object.values(tendanceMap)
      .map(t => ({ ...t, resultat: Math.round((t.ca_ht - t.charges) * 100) / 100, ca_ht: Math.round(t.ca_ht * 100) / 100, charges: Math.round(t.charges * 100) / 100 }))
      .sort((a, b) => a.mois.localeCompare(b.mois));

    // --- Trésorerie mensuelle ---
    const tresoMap = {};
    for (const e of (tresoMensuelle.data || [])) {
      const mois = e.periode;
      if (!mois) continue;
      if (!tresoMap[mois]) tresoMap[mois] = { mois, encaissements: 0, decaissements: 0, solde_fin: 0 };
      tresoMap[mois].encaissements += (e.debit || 0) / 100;
      tresoMap[mois].decaissements += (e.credit || 0) / 100;
    }
    let soldeCumul = 0;
    const tresorerie_mensuelle = Object.values(tresoMap)
      .sort((a, b) => a.mois.localeCompare(b.mois))
      .map(t => {
        soldeCumul += t.encaissements - t.decaissements;
        return { ...t, encaissements: Math.round(t.encaissements * 100) / 100, decaissements: Math.round(t.decaissements * 100) / 100, solde_fin: Math.round(soldeCumul * 100) / 100 };
      });

    // --- Charges par catégorie (sous-classes de 6) ---
    const chargesMap = {};
    for (const e of ecCur) {
      if (e.compte_numero.charAt(0) !== '6') continue;
      const sousClasse = e.compte_numero.substring(0, 2);
      const montant = (e.debit - e.credit) / 100;
      if (!chargesMap[sousClasse]) chargesMap[sousClasse] = { categorie: getLibelleCompte(sousClasse + '0') || `Classe ${sousClasse}x`, montant: 0 };
      chargesMap[sousClasse].montant += montant;
    }
    const totalChargesCateg = Object.values(chargesMap).reduce((s, c) => s + c.montant, 0);
    const charges_par_categorie = Object.values(chargesMap)
      .filter(c => c.montant > 0)
      .map(c => ({ ...c, montant: Math.round(c.montant * 100) / 100, pct: totalChargesCateg > 0 ? Math.round((c.montant / totalChargesCateg) * 1000) / 10 : 0 }))
      .sort((a, b) => b.montant - a.montant);

    // --- Top services ---
    const serviceMap = {};
    for (const f of factures) {
      const nom = f.service_nom || 'Non catégorisé';
      if (!serviceMap[nom]) serviceMap[nom] = { nom, ca_ht: 0, nb_factures: 0 };
      serviceMap[nom].ca_ht += (f.montant_ht || f.montant_ttc || 0) / 100;
      serviceMap[nom].nb_factures += 1;
    }
    const totalCAServices = Object.values(serviceMap).reduce((s, v) => s + v.ca_ht, 0);
    const top_services = Object.values(serviceMap)
      .map(s => ({ ...s, ca_ht: Math.round(s.ca_ht * 100) / 100, pct: totalCAServices > 0 ? Math.round((s.ca_ht / totalCAServices) * 1000) / 10 : 0 }))
      .sort((a, b) => b.ca_ht - a.ca_ht)
      .slice(0, 10);

    // --- Top clients ---
    const clientMap = {};
    for (const f of factures) {
      const key = f.client_id || f.client_nom || 'Inconnu';
      if (!clientMap[key]) clientMap[key] = { client_id: f.client_id, client_nom: f.client_nom || 'Inconnu', ca_ht: 0, nb_factures: 0 };
      clientMap[key].ca_ht += (f.montant_ht || f.montant_ttc || 0) / 100;
      clientMap[key].nb_factures += 1;
    }
    const totalCAClients = Object.values(clientMap).reduce((s, v) => s + v.ca_ht, 0);
    const top_clients = Object.values(clientMap)
      .map(c => ({ ...c, ca_ht: Math.round(c.ca_ht * 100) / 100, pct: totalCAClients > 0 ? Math.round((c.ca_ht / totalCAClients) * 1000) / 10 : 0 }))
      .sort((a, b) => b.ca_ht - a.ca_ht)
      .slice(0, 10);

    res.json({ kpis, tendance_12mois, tresorerie_mensuelle, charges_par_categorie, top_services, top_clients });
  } catch (error) {
    console.error('[JOURNAUX] Erreur dashboard analytique:', error);
    res.status(500).json({ error: 'Erreur dashboard analytique' });
  }
});

/**
 * GET /api/journaux/compte-resultat/compare
 * Compare P&L entre 2 périodes
 */
router.get('/compte-resultat/compare', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { exercice1, periode1, exercice2, periode2 } = req.query;

    if (!exercice1 || !exercice2) {
      return res.status(400).json({ error: 'exercice1 et exercice2 requis' });
    }

    // Helper : filtrer écritures pour un jeu de params
    async function fetchEcritures(exercice, periode) {
      let query = supabase.from('ecritures_comptables')
        .select('compte_numero, compte_libelle, debit, credit')
        .eq('tenant_id', tenantId)
        .eq('exercice', parseInt(exercice));

      if (periode) {
        const [year, month] = periode.split('-').map(Number);
        const startOfYear = `${year}-01-01`;
        const daysInMonth = new Date(year, month, 0).getDate();
        const endOfMonth = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
        query = query.gte('date_ecriture', startOfYear).lte('date_ecriture', endOfMonth);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }

    const [ec1, ec2] = await Promise.all([
      fetchEcritures(exercice1, periode1),
      fetchEcritures(exercice2, periode2),
    ]);

    const cr1 = buildCompteResultatFromEcritures(ec1);
    const cr2 = buildCompteResultatFromEcritures(ec2);

    // Calculer variations
    const vari = (a, b) => ({ montant: Math.round((a - b) * 100) / 100, pct: b !== 0 ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10 : 0 });

    const variations = {
      charges_exploitation: vari(cr1.totaux.charges.exploitation, cr2.totaux.charges.exploitation),
      charges_financieres: vari(cr1.totaux.charges.financieres, cr2.totaux.charges.financieres),
      produits_exploitation: vari(cr1.totaux.produits.exploitation, cr2.totaux.produits.exploitation),
      resultat_exploitation: vari(cr1.totaux.resultats.exploitation, cr2.totaux.resultats.exploitation),
      resultat_net: vari(cr1.totaux.resultats.net, cr2.totaux.resultats.net),
    };

    res.json({
      periode1: { ...cr1, exercice: parseInt(exercice1), periode: periode1 || 'annuel' },
      periode2: { ...cr2, exercice: parseInt(exercice2), periode: periode2 || 'annuel' },
      variations,
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur compare P&L:', error);
    res.status(500).json({ error: 'Erreur comparaison P&L' });
  }
});

/**
 * GET /api/journaux/analytics/tresorerie
 * Vue trésorerie dédiée
 */
router.get('/analytics/tresorerie', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const exercice = parseInt(req.query.exercice) || new Date().getFullYear();
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevYear = exercice - 1;

    // 4 requêtes parallèles
    const [soldesRes, fluxRes, facturesAEncaisser, depensesAPayer] = await Promise.all([
      // 1. Soldes cumulatifs (banque 512 + caisse 530)
      supabase.from('ecritures_comptables')
        .select('compte_numero, debit, credit')
        .eq('tenant_id', tenantId)
        .in('compte_numero', ['512', '530']),

      // 2. Flux mensuels (12 derniers mois)
      supabase.from('ecritures_comptables')
        .select('compte_numero, debit, credit, periode')
        .eq('tenant_id', tenantId)
        .in('compte_numero', ['512', '530'])
        .gte('periode', `${prevYear}-${String(now.getMonth() + 2).padStart(2, '0')}`)
        .lte('periode', currentMonth),

      // 3. Factures à encaisser
      supabase.from('factures')
        .select('numero, client_nom, montant_ttc, date_facture')
        .eq('tenant_id', tenantId)
        .in('statut', ['envoyee', 'generee'])
        .order('date_facture', { ascending: true }),

      // 4. Dépenses non payées
      supabase.from('depenses')
        .select('libelle, montant_ttc, montant, date_depense, categorie')
        .eq('tenant_id', tenantId)
        .eq('payee', false)
        .order('date_depense', { ascending: true }),
    ]);

    // Soldes
    let banque = 0, caisse = 0;
    for (const e of (soldesRes.data || [])) {
      const val = ((e.debit || 0) - (e.credit || 0)) / 100;
      if (e.compte_numero === '512') banque += val;
      if (e.compte_numero === '530') caisse += val;
    }

    // Flux 12 mois
    const fluxMap = {};
    for (const e of (fluxRes.data || [])) {
      const mois = e.periode;
      if (!mois) continue;
      if (!fluxMap[mois]) fluxMap[mois] = { mois, encaissements: 0, decaissements: 0, solde_fin: 0 };
      fluxMap[mois].encaissements += (e.debit || 0) / 100;
      fluxMap[mois].decaissements += (e.credit || 0) / 100;
    }
    let cumul = 0;
    const flux_12mois = Object.values(fluxMap)
      .sort((a, b) => a.mois.localeCompare(b.mois))
      .map(t => {
        cumul += t.encaissements - t.decaissements;
        return {
          mois: t.mois,
          encaissements: Math.round(t.encaissements * 100) / 100,
          decaissements: Math.round(t.decaissements * 100) / 100,
          solde_fin: Math.round(cumul * 100) / 100,
        };
      });

    // Prévisions
    const fae = (facturesAEncaisser.data || []).map(f => ({
      numero: f.numero,
      client: f.client_nom,
      montant: Math.round((f.montant_ttc || 0) / 100 * 100) / 100,
      date_facture: f.date_facture,
    }));

    const dap = (depensesAPayer.data || []).map(d => ({
      libelle: d.libelle || d.categorie || 'Dépense',
      montant: Math.round(((d.montant_ttc || d.montant || 0) / 100) * 100) / 100,
      date_depense: d.date_depense,
    }));

    const totalAEncaisser = fae.reduce((s, f) => s + f.montant, 0);
    const totalAPayer = dap.reduce((s, d) => s + d.montant, 0);
    const solde_previsionnel_30j = Math.round((banque + caisse + totalAEncaisser - totalAPayer) * 100) / 100;

    res.json({
      soldes: {
        banque: Math.round(banque * 100) / 100,
        caisse: Math.round(caisse * 100) / 100,
        total: Math.round((banque + caisse) * 100) / 100,
      },
      flux_12mois,
      previsions: {
        factures_a_encaisser: fae,
        depenses_a_payer: dap,
        solde_previsionnel_30j,
      },
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur trésorerie:', error);
    res.status(500).json({ error: 'Erreur trésorerie' });
  }
});

// ============================================
// RAPPROCHEMENT BANCAIRE AUTOMATIQUE
// ============================================

/**
 * POST /api/journaux/rapprochement-auto
 * Rapprochement automatique v2 : matching écritures BQ ↔ transactions relevé,
 * identification intelligente (frais bancaires 627, fournisseurs 401xxx, clients 411xxx),
 * compte 471 pour inconnus totaux, pointage automatique, rapport.
 */

// Dictionnaire d'identification des transactions relevé
const IDENTIFICATION_RELEVE = {
  // Frais bancaires → 627
  frais_bancaires: {
    compte: '627', libelle_compte: 'Services bancaires',
    mots_cles: ['FRAIS', 'COMMISSION', 'AGIOS', 'COTIS CARTE', 'ABONNEMENT BQ', 'FRAIS TENUE']
  },
  // Organismes sociaux → 431
  organismes_sociaux: [
    { mots_cles: ['URSSAF'], code_aux: '431', libelle: 'Sécurité sociale' },
    { mots_cles: ['RETRAITE', 'AGIRC', 'ARRCO', 'CIPAV', 'RSI'], code_aux: '437', libelle: 'Autres organismes sociaux' },
  ],
  // Fisc → 447
  fisc: [
    { mots_cles: ['IMPOT', 'TAXE', 'CFE', 'CVAE', 'DGFIP', 'TRESOR PUBLIC'], code_aux: '447', libelle: 'État — Impôts et taxes' },
  ],
  // Fournisseurs connus → 401xxx
  fournisseurs: [
    { mots_cles: ['EDF', 'ENGIE', 'ELECTRICITE'], code_aux: '401EDF', libelle: 'EDF/Engie' },
    { mots_cles: ['ORANGE', 'SFR', 'BOUYGUES TEL', 'FREE MOBILE'], code_aux: '401TEL', libelle: 'Télécom' },
    { mots_cles: ['AXA', 'MAIF', 'ALLIANZ', 'GENERALI', 'MACIF'], code_aux: '401ASS', libelle: 'Assurance' },
    { mots_cles: ['AMAZON'], code_aux: '401AMA', libelle: 'Amazon' },
    { mots_cles: ['LOYER', 'BAILLEUR', 'FONCIERE'], code_aux: '401LOY', libelle: 'Bailleur' },
    { mots_cles: ['METRO', 'BEAUTE PRO'], code_aux: '401FOU', libelle: 'Fournisseur produits' },
  ],
  // Patterns client → 411xxx
  clients: {
    patterns: [/VIR(?:EMENT)?\s+(?:RECU\s+)?(?:DE\s+)?CLIENT\s+(\w+)/i, /REF\s+FAC-/i]
  }
};

// Identifier une transaction du relevé → { type: 'frais_bancaires'|'fournisseur'|'client'|'inconnu', compte, libelle_compte, code_client? }
function identifierTransaction(libelle) {
  const upper = (libelle || '').toUpperCase();

  // 1. Frais bancaires ?
  const fb = IDENTIFICATION_RELEVE.frais_bancaires;
  if (fb.mots_cles.some(mc => upper.includes(mc))) {
    return { type: 'frais_bancaires', compte: fb.compte, libelle_compte: fb.libelle_compte };
  }

  // 2. Organismes sociaux (431/437) ?
  for (const o of IDENTIFICATION_RELEVE.organismes_sociaux) {
    if (o.mots_cles.some(mc => upper.includes(mc))) {
      return { type: 'fournisseur', compte: o.code_aux, libelle_compte: o.libelle };
    }
  }

  // 3. Fisc (447) ?
  for (const f of IDENTIFICATION_RELEVE.fisc) {
    if (f.mots_cles.some(mc => upper.includes(mc))) {
      return { type: 'fournisseur', compte: f.code_aux, libelle_compte: f.libelle };
    }
  }

  // 4. Fournisseur connu ?
  for (const f of IDENTIFICATION_RELEVE.fournisseurs) {
    if (f.mots_cles.some(mc => upper.includes(mc))) {
      return { type: 'fournisseur', compte: f.code_aux, libelle_compte: f.libelle };
    }
  }

  // 5. Client identifiable ?
  for (const pattern of IDENTIFICATION_RELEVE.clients.patterns) {
    const m = libelle.match(pattern);
    if (m) {
      const nomClient = m[1] || '';
      const codeClient = nomClient.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3) || 'DIV';
      return { type: 'client', compte: `411${codeClient}`, libelle_compte: `Client ${nomClient}`, code_client: codeClient };
    }
  }

  // 6. Inconnu total → 471
  return { type: 'inconnu', compte: '471', libelle_compte: 'Compte d\'attente' };
}

router.post('/rapprochement-auto', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { transactions, solde_debut, solde_fin, banque, periode } = req.body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'Aucune transaction fournie' });
    }

    console.log(`[RAPPROCHEMENT] Début — ${transactions.length} transactions, période: ${periode || 'non spécifiée'}, tenant: ${tenantId}`);

    // Extraire la période au format YYYY-MM si fournie
    let periodeISO = null;
    if (periode) {
      // Accepte "2025-11" ou "01/11/2025 - 30/11/2025" ou "11/2025"
      const isoMatch = periode.match(/^(\d{4})-(\d{2})$/);
      const slashMatch = periode.match(/(\d{2})\/(\d{4})/);
      const rangeMatch = periode.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (isoMatch) periodeISO = periode;
      else if (rangeMatch) periodeISO = `${rangeMatch[3]}-${rangeMatch[2]}`;
      else if (slashMatch) periodeISO = `${slashMatch[2]}-${slashMatch[1]}`;
    }

    // 1. Récupérer TOUTES les écritures BQ/512 non lettrées du tenant (pas de filtre période)
    // Un chèque de novembre peut être encaissé en février, un virement peut arriver des mois après.
    // Le matching se fait sur le montant exact, pas sur la période de l'écriture.
    const { data: ecrituresBQ, error: errBQ } = await supabase
      .from('ecritures_comptables')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('journal_code', 'BQ')
      .eq('compte_numero', '512')
      .is('lettrage', null)
      .order('date_ecriture', { ascending: true });

    if (errBQ) throw errBQ;

    const ecrituresDisponibles = (ecrituresBQ || []).map(e => ({ ...e, matched: false }));
    console.log(`[RAPPROCHEMENT] ${ecrituresDisponibles.length} écritures BQ/512 non lettrées trouvées`);

    // 1b. Récupérer les écritures RA-* existantes (déjà créées par un rapprochement précédent)
    // Pour éviter les doublons : si une transaction du relevé matche une RA-* existante → "déjà pointée"
    let queryRA = supabase
      .from('ecritures_comptables')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('journal_code', 'BQ')
      .eq('compte_numero', '512')
      .not('lettrage', 'is', null)
      .like('numero_piece', 'RA-%');

    if (periodeISO) {
      queryRA = queryRA.eq('periode', periodeISO);
    }

    const { data: ecrituresRAData } = await queryRA;
    const ecrituresRA = (ecrituresRAData || []).map(e => ({ ...e, matched: false }));
    console.log(`[RAPPROCHEMENT] ${ecrituresRA.length} écritures RA-* existantes trouvées (anti-doublon)`);

    // Helpers
    const parseDate = (str) => {
      if (!str) return null;
      const s = str.trim();
      const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
      const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (ymd) return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
      return new Date(s);
    };

    const diffJours = (d1, d2) => {
      if (!d1 || !d2 || isNaN(d1) || isNaN(d2)) return 999;
      return Math.abs(Math.round((d1 - d2) / (1000 * 60 * 60 * 24)));
    };

    const similariteLibelle = (lib1, lib2) => {
      if (!lib1 || !lib2) return 0;
      const mots1 = lib1.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(m => m.length > 2);
      const mots2 = lib2.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(m => m.length > 2);
      if (mots1.length === 0 || mots2.length === 0) return 0;
      const communs = mots1.filter(m => mots2.includes(m)).length;
      return communs / Math.max(mots1.length, mots2.length);
    };

    // 2. Matching + identification intelligente
    const pointees = [];
    const ecrituresCreees = [];
    const regulariser471 = [];
    let lettrageIndex = 1;

    // Extraire mois/année pour le code lettrage — supporte YYYY-MM (ISO) et MM/YYYY
    const periodeMatchISO = (periode || '').match(/(\d{4})-(\d{2})/);
    const periodeMatchFR = (periode || '').match(/(\d{2})\/(\d{4})/);
    const moisLettrage = periodeMatchISO ? periodeMatchISO[2] : periodeMatchFR ? periodeMatchFR[1] : String(new Date().getMonth() + 1).padStart(2, '0');
    const anneeLettrage = periodeMatchISO ? periodeMatchISO[1] : periodeMatchFR ? periodeMatchFR[2] : String(new Date().getFullYear());

    // Collections pour le mode preview (aucune écriture n'est créée/modifiée en DB)
    const proposed_pointages = [];
    const proposed_ecritures = [];

    for (const tx of transactions) {
      const txDate = parseDate(tx.date);
      const txMontant = Math.round(Math.abs(tx.type === 'credit' ? (tx.credit || tx.montant || 0) : (tx.debit || tx.montant || 0)) * 100);

      if (txMontant === 0) continue;

      const isCredit = tx.type === 'credit';
      // --- Étape 1 : Chercher un match dans les écritures BQ existantes ---
      let meilleurMatch = null;
      let meilleurScore = -1;

      for (const ec of ecrituresDisponibles) {
        if (ec.matched) continue;
        // Number() obligatoire : Supabase retourne les colonnes NUMERIC/DECIMAL comme des strings
        const montantCompta = Number(isCredit ? (ec.debit || 0) : (ec.credit || 0));
        if (montantCompta !== txMontant) continue;

        // Montant exact trouvé → candidat. Date = scoring uniquement (jamais rejet).
        // Un client peut payer des mois/années après la facture.
        const ecDate = parseDate(ec.date_ecriture);
        const jours = diffJours(txDate, ecDate);

        let score = 100; // montant exact = toujours candidat
        if (jours <= 3) score += 50;
        else if (jours <= 7) score += 40;
        else if (jours <= 30) score += 20;
        else if (jours <= 90) score += 10;
        // > 90 jours : score reste 100 (montant seul)

        score += similariteLibelle(tx.libelle, ec.libelle) * 30;

        if (score > meilleurScore) {
          meilleurScore = score;
          meilleurMatch = ec;
        }
      }

      if (meilleurMatch) {
        // Match trouvé → proposer le pointage (preview, pas d'écriture en DB)
        console.log(`[RAPPROCHEMENT]   → MATCH trouvé: écriture ${meilleurMatch.id} (score: ${meilleurScore})`);
        const codeLettrage = `RA${moisLettrage}${anneeLettrage.slice(2)}-${String(lettrageIndex).padStart(3, '0')}`;
        lettrageIndex++;

        meilleurMatch.matched = true;
        proposed_pointages.push({
          ecriture_id: meilleurMatch.id,
          lettrage: codeLettrage,
          date_lettrage: new Date().toISOString().split('T')[0]
        });
        pointees.push({
          date: tx.date,
          libelle_releve: tx.libelle,
          libelle_compta: meilleurMatch.libelle,
          montant: txMontant / 100,
          type: tx.type,
          lettrage: codeLettrage
        });
        continue;
      }

      // --- Étape 1b : Vérifier si une écriture RA-* existe déjà (anti-doublon) ---
      let dejaPointe = false;
      for (const ra of ecrituresRA) {
        if (ra.matched) continue;
        const montantRA = Number(isCredit ? (ra.debit || 0) : (ra.credit || 0));
        if (montantRA === txMontant) {
          ra.matched = true;
          dejaPointe = true;
          pointees.push({
            date: tx.date,
            libelle_releve: tx.libelle,
            libelle_compta: ra.libelle,
            montant: txMontant / 100,
            type: tx.type,
            lettrage: ra.lettrage,
            deja_pointe: true
          });
          break;
        }
      }
      if (dejaPointe) continue;

      // --- Étape 2 : Pas de match → identifier et proposer écriture BQ (preview) ---
      const dateEcriture = txDate ? txDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const periodeEc = dateEcriture.slice(0, 7);
      const exercice = parseInt(dateEcriture.slice(0, 4)) || new Date().getFullYear();
      const codeLettrage = `RA${moisLettrage}${anneeLettrage.slice(2)}-${String(lettrageIndex).padStart(3, '0')}`;
      lettrageIndex++;

      const identification = identifierTransaction(tx.libelle);

      if (identification.type === 'inconnu') {
        // --- Inconnu total → compte 471 (preview, pas d'insertion) ---
        const ecritures471 = isCredit
          ? [
              { tenant_id: tenantId, journal_code: 'BQ', date_ecriture: dateEcriture, numero_piece: `RA-471`, compte_numero: '512', compte_libelle: 'Banque', libelle: tx.libelle, debit: txMontant, credit: 0, lettrage: codeLettrage, date_lettrage: new Date().toISOString().split('T')[0], periode: periodeEc, exercice, _group: codeLettrage },
              { tenant_id: tenantId, journal_code: 'BQ', date_ecriture: dateEcriture, numero_piece: `RA-471`, compte_numero: '471', compte_libelle: 'Compte d\'attente', libelle: tx.libelle, debit: 0, credit: txMontant, periode: periodeEc, exercice, _group: codeLettrage }
            ]
          : [
              { tenant_id: tenantId, journal_code: 'BQ', date_ecriture: dateEcriture, numero_piece: `RA-471`, compte_numero: '471', compte_libelle: 'Compte d\'attente', libelle: tx.libelle, debit: txMontant, credit: 0, periode: periodeEc, exercice, _group: codeLettrage },
              { tenant_id: tenantId, journal_code: 'BQ', date_ecriture: dateEcriture, numero_piece: `RA-471`, compte_numero: '512', compte_libelle: 'Banque', libelle: tx.libelle, debit: 0, credit: txMontant, lettrage: codeLettrage, date_lettrage: new Date().toISOString().split('T')[0], periode: periodeEc, exercice, _group: codeLettrage }
            ];

        proposed_ecritures.push(...ecritures471);
        regulariser471.push({
          date: tx.date,
          libelle: tx.libelle,
          montant: txMontant / 100,
          type: tx.type,
          compte: '471',
          compte_libelle: 'Compte d\'attente',
          lettrage: codeLettrage
        });
      } else if (identification.type === 'frais_bancaires') {
        // Frais bancaires → D 627 / C 512 (preview)
        const ecrituresFrais = [
          { tenant_id: tenantId, journal_code: 'BQ', date_ecriture: dateEcriture, numero_piece: `RA-FRS`, compte_numero: identification.compte, compte_libelle: identification.libelle_compte, libelle: tx.libelle, debit: txMontant, credit: 0, periode: periodeEc, exercice, _group: codeLettrage },
          { tenant_id: tenantId, journal_code: 'BQ', date_ecriture: dateEcriture, numero_piece: `RA-FRS`, compte_numero: '512', compte_libelle: 'Banque', libelle: tx.libelle, debit: 0, credit: txMontant, lettrage: codeLettrage, date_lettrage: new Date().toISOString().split('T')[0], periode: periodeEc, exercice, _group: codeLettrage }
        ];

        proposed_ecritures.push(...ecrituresFrais);
        ecrituresCreees.push({
          date: tx.date,
          libelle: tx.libelle,
          montant: txMontant / 100,
          type: tx.type,
          compte: identification.compte,
          compte_libelle: identification.libelle_compte,
          lettrage: codeLettrage
        });
      } else if (identification.type === 'fournisseur') {
        // Fournisseur identifié → D 401xxx / C 512 (preview)
        const ecrituresFrn = [
          { tenant_id: tenantId, journal_code: 'BQ', date_ecriture: dateEcriture, numero_piece: `RA-FRN`, compte_numero: identification.compte, compte_libelle: identification.libelle_compte, libelle: tx.libelle, debit: txMontant, credit: 0, periode: periodeEc, exercice, _group: codeLettrage },
          { tenant_id: tenantId, journal_code: 'BQ', date_ecriture: dateEcriture, numero_piece: `RA-FRN`, compte_numero: '512', compte_libelle: 'Banque', libelle: tx.libelle, debit: 0, credit: txMontant, lettrage: codeLettrage, date_lettrage: new Date().toISOString().split('T')[0], periode: periodeEc, exercice, _group: codeLettrage }
        ];

        proposed_ecritures.push(...ecrituresFrn);
        ecrituresCreees.push({
          date: tx.date,
          libelle: tx.libelle,
          montant: txMontant / 100,
          type: tx.type,
          compte: identification.compte,
          compte_libelle: identification.libelle_compte,
          lettrage: codeLettrage
        });
      } else if (identification.type === 'client') {
        // Client identifié → D 512 / C 411xxx (preview)
        const ecrituresCli = [
          { tenant_id: tenantId, journal_code: 'BQ', date_ecriture: dateEcriture, numero_piece: `RA-CLI`, compte_numero: '512', compte_libelle: 'Banque', libelle: tx.libelle, debit: txMontant, credit: 0, lettrage: codeLettrage, date_lettrage: new Date().toISOString().split('T')[0], periode: periodeEc, exercice, _group: codeLettrage },
          { tenant_id: tenantId, journal_code: 'BQ', date_ecriture: dateEcriture, numero_piece: `RA-CLI`, compte_numero: identification.compte, compte_libelle: identification.libelle_compte, libelle: tx.libelle, debit: 0, credit: txMontant, periode: periodeEc, exercice, _group: codeLettrage }
        ];

        proposed_ecritures.push(...ecrituresCli);
        ecrituresCreees.push({
          date: tx.date,
          libelle: tx.libelle,
          montant: txMontant / 100,
          type: tx.type,
          compte: identification.compte,
          compte_libelle: identification.libelle_compte,
          lettrage: codeLettrage
        });
      }
    }

    console.log(`[RAPPROCHEMENT] Résultat — ${pointees.length} pointées, ${ecrituresCreees.length} créées, ${regulariser471.length} en 471`);

    // 3. Écritures compta non matchées
    const nonMatcheesCompta = ecrituresDisponibles
      .filter(e => !e.matched)
      .map(e => ({
        id: e.id,
        date: e.date_ecriture,
        libelle: e.libelle,
        montant: Math.max(Number(e.debit || 0), Number(e.credit || 0)) / 100,
        type: Number(e.debit) > 0 ? 'debit' : 'credit',
        raison: Number(e.credit) > 0 ? 'Chèque/virement non encore présenté' : 'Encaissement non figurant sur relevé'
      }));

    // 4. Calcul solde comptable rapproché (cumulé jusqu'à fin de période)
    let querySolde512 = supabase
      .from('ecritures_comptables')
      .select('debit, credit')
      .eq('tenant_id', tenantId)
      .eq('journal_code', 'BQ')
      .eq('compte_numero', '512');

    if (periodeISO) {
      querySolde512 = querySolde512.lte('periode', periodeISO);
    }

    const { data: toutesEcritures512 } = await querySolde512;

    let solde512Cumule = 0;
    if (toutesEcritures512) {
      const totalDebit = toutesEcritures512.reduce((s, e) => s + Number(e.debit || 0), 0);
      const totalCredit = toutesEcritures512.reduce((s, e) => s + Number(e.credit || 0), 0);
      solde512Cumule = (totalDebit - totalCredit) / 100;
    }

    // 5. Calcul méthode des deux tableaux
    // Côté banque : solde relevé + suspens compta (non matchées)
    const suspensComptaDebit = nonMatcheesCompta.filter(e => e.type === 'debit').reduce((s, e) => s + e.montant, 0);
    const suspensComptaCredit = nonMatcheesCompta.filter(e => e.type === 'credit').reduce((s, e) => s + e.montant, 0);
    const soldeRapprocheBanque = (solde_fin || 0) + suspensComptaDebit - suspensComptaCredit;

    // Côté compta : calculer depuis proposed_ecritures sur compte 512
    // Inclut créées + régularisations (658/758) automatiquement
    const proposed512 = proposed_ecritures.filter(e => String(e.compte_numero) === '512');
    // 512 debit (compta) = argent entrant = credit banque → ajouter
    const creditsReleveHorsCompta = proposed512.reduce((s, e) => s + (Number(e.debit) || 0), 0) / 100;
    // 512 credit (compta) = argent sortant = debit banque → soustraire
    const debitsReleveHorsCompta = proposed512.reduce((s, e) => s + (Number(e.credit) || 0), 0) / 100;
    const soldeRapprochéCompta = solde512Cumule + creditsReleveHorsCompta - debitsReleveHorsCompta;

    const ecart = solde_fin != null ? Math.round((soldeRapprocheBanque - soldeRapprochéCompta) * 100) / 100 : null;

    res.json({
      success: true,
      rapport: {
        date_rapprochement: new Date().toISOString().split('T')[0],
        periode: periodeISO || periode || '',
        banque: banque || '',
        solde_releve_debut: solde_debut,
        solde_releve_fin: solde_fin,
        solde_comptable: Math.round(solde512Cumule * 100) / 100,
        solde_512_cumule: Math.round(solde512Cumule * 100) / 100,
        ecart,
        deux_tableaux: {
          cote_banque: {
            solde_releve: solde_fin || 0,
            plus_debits_compta_hors_releve: Math.round(suspensComptaDebit * 100) / 100,
            moins_credits_compta_hors_releve: Math.round(suspensComptaCredit * 100) / 100,
            solde_rapproche: Math.round(soldeRapprocheBanque * 100) / 100
          },
          cote_compta: {
            solde_512: Math.round(solde512Cumule * 100) / 100,
            plus_credits_releve_hors_compta: creditsReleveHorsCompta,
            moins_debits_releve_hors_compta: debitsReleveHorsCompta,
            solde_rapproche: Math.round(soldeRapprochéCompta * 100) / 100
          }
        },
        pointees,
        ecritures_creees: ecrituresCreees,
        regulariser_471: regulariser471,
        non_matchees_compta: nonMatcheesCompta,
        proposed_pointages,
        proposed_ecritures,
        resume: {
          nb_pointees: pointees.length,
          nb_ecritures_creees: ecrituresCreees.length,
          nb_regulariser_471: regulariser471.length,
          nb_non_matchees_compta: nonMatcheesCompta.length
        }
      }
    });
  } catch (error) {
    console.error('[JOURNAUX] Erreur rapprochement auto:', error);
    res.status(500).json({ error: error.message || 'Erreur rapprochement automatique' });
  }
});

/**
 * PATCH /ecritures/:id — Modifier une écriture comptable (libellé, compte, date, pièce)
 */
router.patch('/ecritures/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const ecritureId = parseInt(req.params.id);
    if (!ecritureId || isNaN(ecritureId)) {
      return res.status(400).json({ error: 'ID écriture invalide' });
    }

    const { libelle, compte_numero, compte_libelle, date_ecriture, numero_piece } = req.body;

    // Vérifier que l'écriture existe et appartient au tenant
    const { data: existing, error: errGet } = await supabase
      .from('ecritures_comptables')
      .select('*')
      .eq('id', ecritureId)
      .eq('tenant_id', tenantId)
      .single();

    if (errGet || !existing) {
      return res.status(404).json({ error: 'Écriture non trouvée' });
    }

    // Construire l'objet de mise à jour (champs modifiables uniquement)
    const updates = {};
    if (libelle !== undefined) updates.libelle = libelle;
    if (compte_numero !== undefined) updates.compte_numero = compte_numero;
    if (compte_libelle !== undefined) updates.compte_libelle = compte_libelle;
    if (numero_piece !== undefined) updates.numero_piece = numero_piece;

    if (date_ecriture !== undefined) {
      updates.date_ecriture = date_ecriture;
      // Recalculer période et exercice
      updates.periode = date_ecriture.slice(0, 7);
      updates.exercice = parseInt(date_ecriture.slice(0, 4)) || new Date().getFullYear();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Aucun champ à modifier' });
    }

    const { data: updated, error: errUpdate } = await supabase
      .from('ecritures_comptables')
      .update(updates)
      .eq('id', ecritureId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (errUpdate) throw errUpdate;

    res.json({ success: true, ecriture: updated });
  } catch (error) {
    console.error('[JOURNAUX] Erreur modification écriture:', error);
    res.status(500).json({ error: error.message || 'Erreur modification écriture' });
  }
});

/**
 * POST /api/journaux/rapprochements/sauver
 * Sauvegarder un rapprochement bancaire validé (chaînage mois par mois)
 */
router.post('/rapprochements/sauver', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { periode, rapport } = req.body;
    if (!periode || !rapport) {
      return res.status(400).json({ error: 'Période et rapport requis' });
    }

    // Vérification : période pas déjà validée (anti double-clic)
    const { data: existing } = await supabase
      .from('rapprochements_bancaires')
      .select('id, valide')
      .eq('tenant_id', tenantId)
      .eq('periode', periode)
      .maybeSingle();

    if (existing?.valide) {
      return res.status(409).json({ error: 'Cette période est déjà validée. Déverrouillez d\'abord.' });
    }

    // Exécuter les écritures proposées (preview → DB)
    const proposed_ecritures = rapport.proposed_ecritures || [];
    const proposed_pointages = rapport.proposed_pointages || [];

    // IDEMPOTENT : supprimer les anciennes écritures RA-* de cette période avant réinsertion
    // Évite les doublons si le rapprochement est sauvé plusieurs fois
    if (proposed_ecritures.length > 0) {
      const { data: oldRA, error: errOldRA } = await supabase
        .from('ecritures_comptables')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('journal_code', 'BQ')
        .eq('periode', periode)
        .like('numero_piece', 'RA-%');

      if (!errOldRA && oldRA && oldRA.length > 0) {
        const oldIds = oldRA.map(e => e.id);
        await supabase.from('ecritures_comptables').delete().in('id', oldIds);
        console.log(`[RAPPROCHEMENT] ${oldIds.length} anciennes écritures RA-* supprimées (idempotent) pour ${periode}`);
      }
    }

    // IDEMPOTENT : réinitialiser les lettrages RA stale avant de repointer
    if (proposed_pointages.length > 0) {
      const pointageIds = new Set(proposed_pointages.map(p => p.ecriture_id));
      const newCodes = proposed_pointages.map(p => p.lettrage);

      // Récupérer toutes les écritures 512 avec lettrage RA qui utilisent les mêmes codes
      const { data: allRA } = await supabase
        .from('ecritures_comptables')
        .select('id, lettrage')
        .eq('tenant_id', tenantId)
        .eq('journal_code', 'BQ')
        .eq('compte_numero', '512')
        .in('lettrage', newCodes);

      // Filtrer en JS : reset celles qui ne font PAS partie du nouveau pointage
      const toReset = (allRA || []).filter(e => !pointageIds.has(e.id));

      if (toReset.length > 0) {
        const resetIds = toReset.map(e => e.id);
        await supabase
          .from('ecritures_comptables')
          .update({ lettrage: null, date_lettrage: null })
          .in('id', resetIds);
        console.log(`[RAPPROCHEMENT] ${resetIds.length} lettrages stale RA réinitialisés`);
      }
    }

    // Créer les nouvelles écritures (627, 401, 411, 471, 658, 758) — supprimer le champ _group avant insert
    if (proposed_ecritures.length > 0) {
      const ecrituresClean = proposed_ecritures.map(({ _group, ...rest }) => ({
        ...rest,
        tenant_id: tenantId, // Forcer tenant_id (matching forcé frontend n'en a pas)
      }));

      const { error: errInsert } = await supabase
        .from('ecritures_comptables')
        .insert(ecrituresClean);

      if (errInsert) {
        console.error('[RAPPROCHEMENT] Erreur insertion écritures:', errInsert);
        throw errInsert;
      }
      console.log(`[RAPPROCHEMENT] ${ecrituresClean.length} écritures créées en DB pour période ${periode}`);
    }

    // Pointer les écritures existantes (lettrage)
    for (const p of proposed_pointages) {
      const { error: errPoint } = await supabase
        .from('ecritures_comptables')
        .update({ lettrage: p.lettrage, date_lettrage: p.date_lettrage })
        .eq('id', p.ecriture_id)
        .eq('tenant_id', tenantId);

      if (errPoint) {
        console.error(`[RAPPROCHEMENT] Erreur pointage écriture ${p.ecriture_id}:`, errPoint);
      }
    }
    if (proposed_pointages.length > 0) {
      console.log(`[RAPPROCHEMENT] ${proposed_pointages.length} écritures pointées en DB`);
    }

    const row = {
      tenant_id: tenantId,
      periode,
      date_rapprochement: rapport.date_rapprochement || new Date().toISOString().split('T')[0],
      solde_releve_debut: rapport.solde_releve_debut,
      solde_releve_fin: rapport.solde_releve_fin,
      solde_512_cumule: rapport.solde_512_cumule || rapport.solde_comptable,
      solde_rapproche: rapport.deux_tableaux?.cote_banque?.solde_rapproche || rapport.solde_comptable,
      ecart: rapport.ecart || 0,
      nb_pointees: rapport.resume?.nb_pointees || 0,
      nb_creees: rapport.resume?.nb_ecritures_creees || 0,
      nb_471: rapport.resume?.nb_regulariser_471 || 0,
      nb_non_matchees: rapport.resume?.nb_non_matchees_compta || 0,
      rapport_json: rapport,
      valide: true
    };

    const { data, error } = await supabase
      .from('rapprochements_bancaires')
      .upsert(row, { onConflict: 'tenant_id,periode' })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, rapprochement: data });
  } catch (error) {
    console.error('[JOURNAUX] Erreur sauvegarde rapprochement:', error);
    res.status(500).json({ error: error.message || 'Erreur sauvegarde rapprochement' });
  }
});

/**
 * GET /api/journaux/rapprochements/:periode
 * Récupérer le rapprochement sauvegardé pour une période donnée
 */
router.get('/rapprochements/:periode', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { periode } = req.params;
    if (!periode) return res.status(400).json({ error: 'Période requise' });

    const { data, error } = await supabase
      .from('rapprochements_bancaires')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('periode', periode)
      .maybeSingle();

    if (error) throw error;

    res.json({ rapprochement: data || null });
  } catch (error) {
    console.error('[JOURNAUX] Erreur récupération rapprochement:', error);
    res.status(500).json({ error: error.message || 'Erreur récupération rapprochement' });
  }
});

/**
 * DELETE /api/journaux/rapprochements/:periode
 * Annuler un rapprochement sauvegardé (déverrouiller la période)
 */
router.delete('/rapprochements/:periode', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { periode } = req.params;
    if (!periode) return res.status(400).json({ error: 'Période requise' });

    const { error } = await supabase
      .from('rapprochements_bancaires')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('periode', periode);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('[JOURNAUX] Erreur suppression rapprochement:', error);
    res.status(500).json({ error: error.message || 'Erreur suppression rapprochement' });
  }
});

export default router;
