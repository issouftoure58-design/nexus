/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES DÉPENSES - API pour le suivi des charges                 ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { MODEL_DEFAULT } from '../services/modelRouter.js';

const router = express.Router();
const anthropic = new Anthropic();

// ============================================
// HELPER: GÉNÉRATION ÉCRITURES COMPTABLES
// ============================================

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
 * Génère les écritures comptables pour une dépense (AC + BQ si payée)
 */
async function genererEcrituresDepense(tenantId, depenseId) {
  try {
    // Récupérer la dépense
    const { data: depense, error: errDep } = await supabase
      .from('depenses')
      .select('*')
      .eq('id', depenseId)
      .eq('tenant_id', tenantId)
      .single();

    if (errDep || !depense) {
      console.error('[DEPENSES] Dépense non trouvée pour écritures:', depenseId);
      return;
    }

    // Supprimer les anciennes écritures si elles existent
    await supabase
      .from('ecritures_comptables')
      .delete()
      .eq('depense_id', depenseId)
      .eq('tenant_id', tenantId);

    const dateDepense = depense.date_depense;
    const periode = dateDepense?.slice(0, 7);
    const exercice = parseInt(dateDepense?.slice(0, 4)) || new Date().getFullYear();
    const montantTTC = depense.montant_ttc || depense.montant || 0;
    const montantHT = depense.montant || montantTTC;
    const montantTVA = depense.montant_tva || 0;
    const compteCharge = COMPTE_DEPENSE[depense.categorie] || COMPTE_DEPENSE.autre;

    // Déterminer si c'est une charge de personnel
    const isChargePersonnel = ['salaires', 'cotisations_sociales'].includes(depense.categorie);

    // Journal et compte contrepartie selon le type de dépense
    let journalCode, compteContrepartie, libelleContrepartie;
    if (depense.categorie === 'salaires') {
      journalCode = 'PA';
      compteContrepartie = '421';
      libelleContrepartie = 'Personnel - Rémunérations dues';
    } else if (depense.categorie === 'cotisations_sociales') {
      journalCode = 'PA';
      compteContrepartie = '431';
      libelleContrepartie = 'Sécurité sociale';
    } else {
      journalCode = 'AC';
      compteContrepartie = '401';
      libelleContrepartie = 'Fournisseurs';
    }

    const ecritures = [];

    // Débit compte de charge
    ecritures.push({
      tenant_id: tenantId,
      journal_code: journalCode,
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
    });

    // Débit 44566 TVA déductible (pas pour les charges de personnel)
    if (montantTVA > 0 && depense.deductible_tva !== false && !isChargePersonnel) {
      ecritures.push({
        tenant_id: tenantId,
        journal_code: journalCode,
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

    // Crédit compte contrepartie (401 Fournisseurs, 421 Personnel, ou 431 Sécu)
    ecritures.push({
      tenant_id: tenantId,
      journal_code: journalCode,
      date_ecriture: dateDepense,
      numero_piece: `DEP-${depense.id}`,
      compte_numero: compteContrepartie,
      compte_libelle: libelleContrepartie,
      libelle: depense.libelle || depense.categorie,
      debit: 0,
      credit: isChargePersonnel ? montantHT : montantTTC, // Pas de TVA sur charges personnel
      depense_id: depenseId,
      periode,
      exercice
    });

    // Si dépense payée, écriture banque ou caisse
    if (depense.payee !== false) {
      const datePaiement = depense.date_paiement?.split('T')[0] || dateDepense;
      const periodePaie = datePaiement?.slice(0, 7);

      // Déterminer le journal et compte selon le mode de paiement
      const MODES_PAIEMENT = {
        especes: { journal: 'CA', compte: '530', libelle: 'Caisse' },
        cb: { journal: 'BQ', compte: '512', libelle: 'Banque' },
        virement: { journal: 'BQ', compte: '512', libelle: 'Banque' },
        prelevement: { journal: 'BQ', compte: '512', libelle: 'Banque' },
        cheque: { journal: 'BQ', compte: '512', libelle: 'Banque' }
      };

      const modePaiement = depense.mode_paiement || 'cb';
      const configPaiement = MODES_PAIEMENT[modePaiement] || MODES_PAIEMENT.cb;
      const journalPaiement = configPaiement.journal;
      const compteTreso = configPaiement.compte;
      const libelleTreso = configPaiement.libelle;

      // Montant du règlement (HT pour charges personnel, TTC pour autres)
      const montantReglement = isChargePersonnel ? montantHT : montantTTC;

      // Journal BQ/CA - Paiement
      // Débit du compte tiers (421/431/401) pour solder la dette
      ecritures.push({
        tenant_id: tenantId,
        journal_code: journalPaiement,
        date_ecriture: datePaiement,
        numero_piece: `DEP-${depense.id}`,
        compte_numero: compteContrepartie,
        compte_libelle: libelleContrepartie,
        libelle: `Règlement ${depense.libelle || depense.categorie}`,
        debit: montantReglement,
        credit: 0,
        depense_id: depenseId,
        periode: periodePaie,
        exercice
      });

      // Crédit du compte de trésorerie
      ecritures.push({
        tenant_id: tenantId,
        journal_code: journalPaiement,
        date_ecriture: datePaiement,
        numero_piece: `DEP-${depense.id}`,
        compte_numero: compteTreso,
        compte_libelle: libelleTreso,
        libelle: `Paiement ${depense.libelle || depense.categorie}`,
        debit: 0,
        credit: montantReglement,
        depense_id: depenseId,
        periode: periodePaie,
        exercice
      });
    }

    if (ecritures.length > 0) {
      const { error } = await supabase
        .from('ecritures_comptables')
        .insert(ecritures);

      if (error) {
        console.error('[DEPENSES] Erreur insertion écritures:', error);
      } else {
        console.log(`[DEPENSES] ${ecritures.length} écritures générées pour dépense ${depense.id}`);
      }
    }
  } catch (err) {
    console.error('[DEPENSES] Erreur génération écritures:', err);
  }
}

// Configuration multer pour upload en mémoire
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non supporté. Formats acceptés: JPEG, PNG, GIF, WEBP, PDF'));
    }
  }
});

// Toutes les routes nécessitent une authentification admin
router.use(authenticateAdmin);

// Catégories disponibles
const CATEGORIES = [
  'fournitures', 'loyer', 'charges', 'telecom', 'assurance',
  'transport', 'marketing', 'bancaire', 'formation', 'materiel',
  'logiciel', 'comptabilite', 'taxes', 'salaires', 'cotisations_sociales', 'autre'
];

const RECURRENCES = ['ponctuelle', 'mensuelle', 'trimestrielle', 'annuelle'];

// Taux de TVA disponibles
const TAUX_TVA = [20, 10, 5.5, 2.1, 0];

/**
 * Formate une dépense pour la réponse API
 */
function formatDepense(d) {
  const montantHT = d.montant || 0;
  const montantTTC = d.montant_ttc || montantHT;
  const tauxTVA = d.taux_tva || 0;
  const montantTVA = d.montant_tva || (montantTTC - montantHT);

  return {
    id: d.id,
    categorie: d.categorie,
    libelle: d.libelle,
    description: d.description,
    // Montants
    montant: montantHT,
    montant_euros: (montantHT / 100).toFixed(2),
    montant_ttc: montantTTC,
    montant_ttc_euros: (montantTTC / 100).toFixed(2),
    montant_tva: montantTVA,
    montant_tva_euros: (montantTVA / 100).toFixed(2),
    // TVA
    taux_tva: tauxTVA,
    deductible_tva: d.deductible_tva !== false,
    // Autres
    date_depense: d.date_depense,
    recurrence: d.recurrence,
    justificatif_url: d.justificatif_url,
    // Statut paiement
    payee: d.payee !== false,
    date_paiement: d.date_paiement,
    created_at: d.created_at,
    updated_at: d.updated_at
  };
}

/**
 * GET /api/depenses
 * Liste des dépenses avec filtres optionnels
 * Query: ?mois=2026-02&categorie=fournitures
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { mois, categorie, limit = 100 } = req.query;

    let query = supabase
      .from('depenses')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date_depense', { ascending: false })
      .limit(parseInt(limit));

    // Filtre par mois (format: 2026-02)
    if (mois) {
      const [year, month] = mois.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];
      query = query.gte('date_depense', startDate).lte('date_depense', endDate);
    }

    // Filtre par catégorie
    if (categorie && CATEGORIES.includes(categorie)) {
      query = query.eq('categorie', categorie);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculs des totaux
    const totalHT = data.reduce((sum, d) => sum + (d.montant || 0), 0);
    const totalTTC = data.reduce((sum, d) => sum + (d.montant_ttc || d.montant || 0), 0);
    const totalTVA = data.reduce((sum, d) => sum + (d.montant_tva || 0), 0);
    const totalTVADeductible = data
      .filter(d => d.deductible_tva !== false)
      .reduce((sum, d) => sum + (d.montant_tva || 0), 0);

    res.json({
      success: true,
      depenses: data.map(formatDepense),
      totaux: {
        ht: (totalHT / 100).toFixed(2),
        ttc: (totalTTC / 100).toFixed(2),
        tva: (totalTVA / 100).toFixed(2),
        tva_deductible: (totalTVADeductible / 100).toFixed(2)
      },
      total: totalHT / 100 // Legacy
    });
  } catch (error) {
    console.error('[DEPENSES] Erreur liste:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/depenses/resume
 * Résumé par catégorie pour un mois
 * Query: ?mois=2026-02
 */
router.get('/resume', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { mois } = req.query;

    // Par défaut, mois en cours
    const now = new Date();
    const targetMois = mois || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, month] = targetMois.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('depenses')
      .select('categorie, montant')
      .eq('tenant_id', tenantId)
      .gte('date_depense', startDate)
      .lte('date_depense', endDate);

    if (error) throw error;

    // Grouper par catégorie
    const parCategorie = {};
    let total = 0;

    data.forEach(d => {
      parCategorie[d.categorie] = (parCategorie[d.categorie] || 0) + d.montant;
      total += d.montant;
    });

    // Formater
    const resume = Object.entries(parCategorie)
      .map(([categorie, montant]) => ({
        categorie,
        montant_centimes: montant,
        montant_euros: (montant / 100).toFixed(2),
        pourcentage: ((montant / total) * 100).toFixed(1)
      }))
      .sort((a, b) => b.montant_centimes - a.montant_centimes);

    res.json({
      success: true,
      mois: targetMois,
      total_centimes: total,
      total_euros: (total / 100).toFixed(2),
      par_categorie: resume
    });
  } catch (error) {
    console.error('[DEPENSES] Erreur résumé:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/depenses/compte-resultat
 * Compte de résultat complet (revenus - charges)
 * Query: ?mois=2026-02
 */
router.get('/compte-resultat', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { mois } = req.query;

    // Par défaut, mois en cours
    const now = new Date();
    const targetMois = mois || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, month] = targetMois.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(year, parseInt(month), 0).toISOString().split('T')[0];

    // 1. Récupérer les revenus (réservations confirmées/terminées)
    const { data: reservations } = await supabase
      .from('reservations')
      .select('prix_total, prix_service, frais_deplacement, statut')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lte('date', endDate)
      .in('statut', ['confirme', 'termine']);

    const revenus = reservations?.reduce((sum, r) => {
      const prix = r.prix_total || (r.prix_service || 0) + (r.frais_deplacement || 0);
      return sum + prix;
    }, 0) || 0;

    // 2. Récupérer les charges
    const { data: depenses } = await supabase
      .from('depenses')
      .select('categorie, montant')
      .eq('tenant_id', tenantId)
      .gte('date_depense', startDate)
      .lte('date_depense', endDate);

    const chargesParCategorie = {};
    let totalCharges = 0;

    depenses?.forEach(d => {
      chargesParCategorie[d.categorie] = (chargesParCategorie[d.categorie] || 0) + d.montant;
      totalCharges += d.montant;
    });

    // 3. Calculer le résultat
    const resultatNet = revenus - totalCharges;
    const margeNette = revenus > 0 ? ((resultatNet / revenus) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      mois: targetMois,
      compte_resultat: {
        chiffre_affaires: {
          total_centimes: revenus,
          total_euros: (revenus / 100).toFixed(2)
        },
        charges: {
          total_centimes: totalCharges,
          total_euros: (totalCharges / 100).toFixed(2),
          detail: Object.entries(chargesParCategorie).map(([cat, montant]) => ({
            categorie: cat,
            montant_euros: (montant / 100).toFixed(2)
          }))
        },
        resultat_net: {
          total_centimes: resultatNet,
          total_euros: (resultatNet / 100).toFixed(2),
          marge_nette: margeNette,
          marge_nette_pourcent: margeNette,
          positif: resultatNet >= 0
        }
      }
    });
  } catch (error) {
    console.error('[DEPENSES] Erreur compte résultat:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/depenses
 * Ajouter une dépense
 * @param {string} mode_paiement - Mode de paiement si payée: especes, cb, virement, prelevement, cheque
 * @param {boolean} a_credit - Si true, dépense à crédit (non payée), sinon comptant (payée)
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const {
      categorie,
      libelle,
      description,
      montant,          // Montant HT en centimes (legacy)
      montant_ttc,      // Montant TTC en centimes (nouveau)
      taux_tva,         // Taux TVA (20, 10, 5.5, 0)
      deductible_tva,   // TVA déductible ?
      date_depense,
      recurrence,
      justificatif_url,
      payee,            // Marquer comme payée à la création (legacy)
      a_credit,         // Si true = à crédit (non payée), false = comptant (payée)
      mode_paiement     // Mode de paiement requis si comptant
    } = req.body;

    // Modes de paiement valides
    const modesPaiementValides = ['especes', 'cb', 'virement', 'prelevement', 'cheque'];

    // Validation
    if (!categorie || !CATEGORIES.includes(categorie)) {
      return res.status(400).json({ success: false, error: 'Catégorie invalide' });
    }

    // Accepter libelle ou description comme nom de la dépense
    const nomDepense = libelle || description;
    if (!nomDepense || nomDepense.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Libellé/description requis' });
    }

    // Calcul des montants
    const tauxTVA = parseFloat(taux_tva) || 20;
    const estDeductible = deductible_tva !== false;
    let montantTTC, montantHT;

    if (montant_ttc) {
      // Nouveau mode: saisie TTC
      montantTTC = Math.round(montant_ttc);
      if (estDeductible && tauxTVA > 0) {
        // Calcul HT depuis TTC
        montantHT = Math.round(montantTTC / (1 + tauxTVA / 100));
      } else {
        // Non assujetti ou taux 0: HT = TTC
        montantHT = montantTTC;
      }
    } else if (montant) {
      // Mode legacy: montant direct (considéré comme HT)
      montantHT = Math.round(montant);
      montantTTC = estDeductible && tauxTVA > 0
        ? Math.round(montantHT * (1 + tauxTVA / 100))
        : montantHT;
    } else {
      return res.status(400).json({ success: false, error: 'Montant requis' });
    }

    if (montantHT <= 0) {
      return res.status(400).json({ success: false, error: 'Montant invalide' });
    }

    // Déterminer si payée: a_credit=true → non payée, sinon payée
    // Rétrocompatibilité: si payee est explicitement défini, l'utiliser
    const estPayee = payee !== undefined ? payee !== false : a_credit !== true;

    // Mode de paiement requis si comptant (payée à la création)
    if (estPayee) {
      if (!mode_paiement) {
        return res.status(400).json({
          success: false,
          error: 'Mode de paiement requis pour une dépense comptant'
        });
      }
      if (!modesPaiementValides.includes(mode_paiement)) {
        return res.status(400).json({
          success: false,
          error: `Mode de paiement invalide. Valeurs acceptées : ${modesPaiementValides.join(', ')}`
        });
      }
    }

    const { data, error } = await supabase
      .from('depenses')
      .insert({
        tenant_id: tenantId,
        categorie,
        libelle: nomDepense.trim(),
        description: description?.trim() || null,
        montant: montantHT,
        montant_ttc: montantTTC,
        taux_tva: tauxTVA,
        deductible_tva: estDeductible,
        date_depense: date_depense || new Date().toISOString().split('T')[0],
        recurrence: recurrence && RECURRENCES.includes(recurrence) ? recurrence : 'ponctuelle',
        justificatif_url: justificatif_url || null,
        payee: estPayee,
        date_paiement: estPayee ? new Date().toISOString() : null,
        mode_paiement: estPayee ? mode_paiement : null
      })
      .select()
      .single();

    if (error) throw error;

    // Générer les écritures comptables
    await genererEcrituresDepense(tenantId, data.id);

    res.status(201).json({
      success: true,
      depense: formatDepense(data)
    });
  } catch (error) {
    console.error('[DEPENSES] Erreur création:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

/**
 * PUT /api/depenses/:id
 * Modifier une dépense
 */
router.put('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const {
      categorie,
      libelle,
      description,
      montant,
      montant_ttc,
      taux_tva,
      deductible_tva,
      date_depense,
      recurrence,
      justificatif_url
    } = req.body;

    const updates = {};
    if (categorie && CATEGORIES.includes(categorie)) updates.categorie = categorie;
    if (libelle) updates.libelle = libelle.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (date_depense) updates.date_depense = date_depense;
    if (recurrence && RECURRENCES.includes(recurrence)) updates.recurrence = recurrence;
    if (justificatif_url !== undefined) updates.justificatif_url = justificatif_url || null;

    // Gestion TVA
    if (taux_tva !== undefined) updates.taux_tva = parseFloat(taux_tva) || 0;
    if (deductible_tva !== undefined) updates.deductible_tva = deductible_tva !== false;

    // Recalcul des montants si modifiés
    const tauxTVA = updates.taux_tva !== undefined ? updates.taux_tva : 20;
    const estDeductible = updates.deductible_tva !== undefined ? updates.deductible_tva : true;

    if (montant_ttc) {
      updates.montant_ttc = Math.round(montant_ttc);
      if (estDeductible && tauxTVA > 0) {
        updates.montant = Math.round(updates.montant_ttc / (1 + tauxTVA / 100));
      } else {
        updates.montant = updates.montant_ttc;
      }
    } else if (montant && montant > 0) {
      updates.montant = Math.round(montant);
      updates.montant_ttc = estDeductible && tauxTVA > 0
        ? Math.round(updates.montant * (1 + tauxTVA / 100))
        : updates.montant;
    }

    const { data, error } = await supabase
      .from('depenses')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Dépense non trouvée' });

    // Régénérer les écritures comptables
    await genererEcrituresDepense(tenantId, parseInt(id));

    res.json({
      success: true,
      depense: formatDepense(data)
    });
  } catch (error) {
    console.error('[DEPENSES] Erreur modification:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

/**
 * DELETE /api/depenses/:id
 * Supprimer une dépense
 */
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Supprimer d'abord les écritures comptables liées
    await supabase
      .from('ecritures_comptables')
      .delete()
      .eq('depense_id', parseInt(id))
      .eq('tenant_id', tenantId);

    const { error } = await supabase
      .from('depenses')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Dépense supprimée' });
  } catch (error) {
    console.error('[DEPENSES] Erreur suppression:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * PATCH /api/depenses/:id/payer
 * Marquer une dépense comme payée ou non payée
 * @param {boolean} payee - true pour payée, false pour non payée
 * @param {string} mode_paiement - Mode de paiement requis si payee=true: especes, cb, virement, prelevement, cheque
 */
router.patch('/:id/payer', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { payee, mode_paiement } = req.body;

    const estPayee = payee !== false;

    // Mode de paiement requis si on marque comme payée
    if (estPayee) {
      const modesPaiementValides = ['especes', 'cb', 'virement', 'prelevement', 'cheque'];
      if (!mode_paiement) {
        return res.status(400).json({
          success: false,
          error: 'Mode de paiement requis pour marquer comme payée'
        });
      }
      if (!modesPaiementValides.includes(mode_paiement)) {
        return res.status(400).json({
          success: false,
          error: `Mode de paiement invalide. Valeurs acceptées : ${modesPaiementValides.join(', ')}`
        });
      }
    }

    const updates = {
      payee: estPayee,
      date_paiement: estPayee ? new Date().toISOString() : null,
      mode_paiement: estPayee ? mode_paiement : null
    };

    const { data, error } = await supabase
      .from('depenses')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Dépense non trouvée' });

    // Régénérer les écritures comptables (pour ajouter les écritures BQ/CA si payée)
    await genererEcrituresDepense(tenantId, parseInt(id));

    res.json({
      success: true,
      depense: formatDepense(data)
    });
  } catch (error) {
    console.error('[DEPENSES] Erreur marquage payée:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
  }
});

/**
 * GET /api/depenses/tva
 * Résumé TVA pour un mois (TVA collectée depuis factures, TVA déductible depuis dépenses)
 * Query: ?mois=2026-02
 */
router.get('/tva', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { mois } = req.query;

    // Par défaut, mois en cours
    const now = new Date();
    const targetMois = mois || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, month] = targetMois.split('-');
    const startDate = `${year}-${month}-01`;
    // Calculer le dernier jour du mois sans conversion UTC
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    console.log(`[TVA] Recherche période: ${startDate} -> ${endDate} pour tenant ${tenantId}`);

    // 1. TVA COLLECTÉE - depuis les FACTURES (pas les réservations)
    // On prend les factures confirmées, envoyées ou payées du mois
    const { data: factures, error: facturesError } = await supabase
      .from('factures')
      .select('montant_ht, montant_ttc, montant_tva, taux_tva, statut, date_facture')
      .eq('tenant_id', tenantId)
      .gte('date_facture', startDate)
      .lte('date_facture', endDate)
      .in('statut', ['generee', 'envoyee', 'payee']);

    console.log(`[TVA] Factures trouvées: ${factures?.length || 0}`, facturesError || '', factures?.map(f => ({ date: f.date_facture, tva: f.montant_tva })));

    // Calcul CA TTC et TVA collectée depuis les factures
    let chiffreAffairesTTC = 0;
    let chiffreAffairesHT = 0;
    let tvaCollectee = 0;
    const tvaParTaux = {};

    factures?.forEach(f => {
      const montantHT = f.montant_ht || 0;
      const montantTTC = f.montant_ttc || montantHT;
      const montantTVA = f.montant_tva || (montantTTC - montantHT);
      const tauxTVA = f.taux_tva || 20;

      chiffreAffairesTTC += montantTTC;
      chiffreAffairesHT += montantHT;
      tvaCollectee += montantTVA;

      // Grouper par taux
      if (!tvaParTaux[tauxTVA]) {
        tvaParTaux[tauxTVA] = { base_ht: 0, tva: 0, nb: 0 };
      }
      tvaParTaux[tauxTVA].base_ht += montantHT;
      tvaParTaux[tauxTVA].tva += montantTVA;
      tvaParTaux[tauxTVA].nb += 1;
    });

    // 2. TVA DÉDUCTIBLE - depuis les dépenses
    const { data: depenses } = await supabase
      .from('depenses')
      .select('montant, montant_ttc, montant_tva, taux_tva, deductible_tva')
      .eq('tenant_id', tenantId)
      .gte('date_depense', startDate)
      .lte('date_depense', endDate);

    // Calcul TVA déductible (uniquement les dépenses avec deductible_tva = true)
    let tvaDeductible = 0;
    let totalDepensesHT = 0;
    let totalDepensesTTC = 0;

    depenses?.forEach(d => {
      const montantHT = d.montant || 0;
      const montantTTC = d.montant_ttc || montantHT;
      const tauxTVA = d.taux_tva || 0;
      const montantTVA = d.montant_tva || (tauxTVA > 0 ? Math.round(montantTTC - montantHT) : 0);

      totalDepensesHT += montantHT;
      totalDepensesTTC += montantTTC;

      // TVA déductible uniquement si marquée comme telle
      if (d.deductible_tva !== false && montantTVA > 0) {
        tvaDeductible += montantTVA;
      }
    });

    // 3. TVA À PAYER = TVA collectée - TVA déductible
    const tvaAPayer = tvaCollectee - tvaDeductible;

    // 4. Détail par taux de TVA (dépenses)
    const detailParTaux = {};
    depenses?.forEach(d => {
      if (d.deductible_tva !== false) {
        const taux = d.taux_tva || 0;
        const montantTVA = d.montant_tva || 0;
        if (!detailParTaux[taux]) {
          detailParTaux[taux] = { base_ht: 0, tva: 0 };
        }
        detailParTaux[taux].base_ht += d.montant || 0;
        detailParTaux[taux].tva += montantTVA;
      }
    });

    res.json({
      success: true,
      mois: targetMois,
      tva: {
        // TVA Collectée (sur ventes - depuis factures)
        collectee: {
          base_ht: chiffreAffairesHT,
          base_ht_euros: (chiffreAffairesHT / 100).toFixed(2),
          tva: tvaCollectee,
          tva_euros: (tvaCollectee / 100).toFixed(2),
          nb_operations: factures?.length || 0,
          detail_par_taux: Object.entries(tvaParTaux).map(([taux, data]) => ({
            taux: parseFloat(taux),
            base_ht_euros: (data.base_ht / 100).toFixed(2),
            tva_euros: (data.tva / 100).toFixed(2),
            nb_operations: data.nb
          }))
        },
        // TVA Déductible (sur achats)
        deductible: {
          base_ht: totalDepensesHT,
          base_ht_euros: (totalDepensesHT / 100).toFixed(2),
          tva: tvaDeductible,
          tva_euros: (tvaDeductible / 100).toFixed(2),
          nb_operations: depenses?.filter(d => d.deductible_tva !== false).length || 0,
          detail_par_taux: Object.entries(detailParTaux).map(([taux, data]) => ({
            taux: parseFloat(taux),
            base_ht_euros: (data.base_ht / 100).toFixed(2),
            tva_euros: (data.tva / 100).toFixed(2)
          }))
        },
        // Solde TVA à payer (ou crédit si négatif)
        solde: {
          montant: tvaAPayer,
          montant_euros: (tvaAPayer / 100).toFixed(2),
          a_payer: tvaAPayer > 0,
          credit: tvaAPayer < 0
        }
      }
    });
  } catch (error) {
    console.error('[DEPENSES] Erreur TVA:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/depenses/categories
 * Liste des catégories disponibles
 */
router.get('/categories', (req, res) => {
  const categoriesLabels = {
    fournitures: 'Fournitures (produits)',
    loyer: 'Loyer / Local',
    charges: 'Charges (électricité, eau)',
    telecom: 'Téléphone / Internet',
    assurance: 'Assurances',
    transport: 'Transport / Essence',
    marketing: 'Marketing / Publicité',
    bancaire: 'Frais bancaires',
    formation: 'Formation',
    materiel: 'Matériel / Équipement',
    logiciel: 'Logiciels / Abonnements',
    comptabilite: 'Comptabilité',
    taxes: 'Taxes / Impôts',
    salaires: 'Salaires',
    cotisations_sociales: 'Cotisations sociales',
    autre: 'Autre'
  };

  res.json({
    success: true,
    categories: CATEGORIES.map(c => ({
      id: c,
      label: categoriesLabels[c]
    }))
  });
});

/**
 * GET /api/depenses/categories/:categorie
 * Détail d'une catégorie avec historique des dépenses
 */
router.get('/categories/:categorie', async (req, res) => {
  // 🔒 SÉCURITÉ: Utiliser tenant depuis session authentifiée
  const tenantId = req.admin?.tenant_id;
  const { categorie } = req.params;

  if (!tenantId) {
    return res.status(403).json({ error: 'TENANT_ID_REQUIRED' });
  }

  try {
    // Toutes les dépenses de cette catégorie
    const { data: depenses, error } = await supabase
      .from('depenses')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('categorie', categorie)
      .order('date_depense', { ascending: false });

    if (error) {
      console.error('[DEPENSES] Erreur récupération catégorie:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    // Calculer les stats
    const totalTTC = (depenses || []).reduce((s, d) => s + (d.montant_ttc || d.montant || 0), 0);
    const totalHT = (depenses || []).reduce((s, d) => s + (d.montant || 0), 0);
    const totalTVA = (depenses || []).reduce((s, d) => s + (d.montant_tva || 0), 0);
    const nbDepenses = (depenses || []).length;
    const nbPayees = (depenses || []).filter(d => d.payee !== false).length;

    // Labels des catégories
    const categoriesLabels = {
      fournitures: 'Fournitures (produits)',
      loyer: 'Loyer / Local',
      charges: 'Charges (électricité, eau)',
      telecom: 'Téléphone / Internet',
      assurance: 'Assurances',
      transport: 'Transport / Essence',
      marketing: 'Marketing / Publicité',
      bancaire: 'Frais bancaires',
      formation: 'Formation',
      materiel: 'Matériel / Équipement',
      logiciel: 'Logiciels / Abonnements',
      comptabilite: 'Comptabilité',
      taxes: 'Taxes / Impôts',
      salaires: 'Salaires',
      cotisations_sociales: 'Cotisations sociales',
      autre: 'Autre'
    };

    res.json({
      success: true,
      categorie: {
        id: categorie,
        label: categoriesLabels[categorie] || categorie,
        compte: COMPTE_DEPENSE[categorie] || COMPTE_DEPENSE.autre
      },
      stats: {
        total_ttc: totalTTC,
        total_ttc_euros: (totalTTC / 100).toFixed(2),
        total_ht: totalHT,
        total_ht_euros: (totalHT / 100).toFixed(2),
        total_tva: totalTVA,
        total_tva_euros: (totalTVA / 100).toFixed(2),
        nb_depenses: nbDepenses,
        nb_payees: nbPayees,
        nb_non_payees: nbDepenses - nbPayees,
        moyenne_ttc: nbDepenses > 0 ? Math.round(totalTTC / nbDepenses) : 0,
        derniere_depense: depenses?.[0]?.date_depense || null
      },
      depenses: (depenses || []).map(d => ({
        id: d.id,
        date: d.date_depense,
        libelle: d.libelle || d.description,
        montant_ttc: d.montant_ttc || d.montant,
        montant_ttc_euros: ((d.montant_ttc || d.montant || 0) / 100).toFixed(2),
        payee: d.payee !== false,
        recurrence: d.recurrence || 'ponctuelle'
      }))
    });
  } catch (error) {
    console.error('[DEPENSES] Erreur catégorie detail:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/depenses/upload-facture
 * Upload une facture (image/PDF) et extrait automatiquement les données via IA
 */
router.post('/upload-facture', upload.single('file'), async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Aucun fichier uploadé' });
    }

    console.log('[DEPENSES] Upload facture:', {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });

    // Convertir le fichier en base64 pour Claude Vision
    const base64Data = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype;

    // Vérifier si c'est un PDF (Claude ne supporte pas directement les PDF pour vision)
    // Pour les PDFs, on pourrait utiliser pdf-parse ou autre, mais pour l'instant on rejette
    if (mediaType === 'application/pdf') {
      return res.status(400).json({
        success: false,
        error: 'Les fichiers PDF ne sont pas encore supportés. Veuillez uploader une image (photo de la facture).'
      });
    }

    // Appel à Claude Vision pour analyser la facture
    const response = await anthropic.messages.create({
      model: MODEL_DEFAULT,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data
              }
            },
            {
              type: 'text',
              text: `Analyse cette facture/ticket de caisse et extrait les informations suivantes au format JSON strict.

IMPORTANT: Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte avant ou après.

Format attendu:
{
  "fournisseur": "nom du fournisseur/magasin",
  "date": "YYYY-MM-DD",
  "montant_ttc": 12.50,
  "taux_tva": 20,
  "description": "description courte des achats",
  "categorie": "une parmi: fournitures, loyer, charges, telecom, assurance, transport, marketing, bancaire, formation, materiel, logiciel, comptabilite, taxes, autre"
}

Règles:
- montant_ttc: le montant TOTAL TTC en euros (nombre décimal, pas de symbole €)
- taux_tva: le taux de TVA principal (20, 10, 5.5, 2.1 ou 0)
- date: format ISO YYYY-MM-DD, utilise la date d'aujourd'hui si non visible
- categorie: choisis la plus appropriée parmi la liste
- Si une information n'est pas lisible, fais une estimation raisonnable

Réponds UNIQUEMENT avec le JSON, rien d'autre.`
            }
          ]
        }
      ]
    });

    // Parser la réponse JSON
    let extractedData;
    try {
      const jsonText = response.content[0].text.trim();
      // Nettoyer si entouré de backticks markdown
      const cleanJson = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      extractedData = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error('[DEPENSES] Erreur parsing JSON IA:', parseError, 'Réponse:', response.content[0].text);
      return res.status(422).json({
        success: false,
        error: 'Impossible d\'extraire les données de la facture. Veuillez réessayer avec une image plus nette.',
        raw_response: response.content[0].text
      });
    }

    // Valider et normaliser les données
    const tauxTVA = parseFloat(extractedData.taux_tva) || 20;
    const montantTTC = Math.round((parseFloat(extractedData.montant_ttc) || 0) * 100); // Convertir en centimes
    const montantHT = tauxTVA > 0 ? Math.round(montantTTC / (1 + tauxTVA / 100)) : montantTTC;
    const montantTVA = montantTTC - montantHT;

    // Valider la catégorie
    let categorie = extractedData.categorie?.toLowerCase() || 'autre';
    if (!CATEGORIES.includes(categorie)) {
      categorie = 'autre';
    }

    // Valider la date
    let dateDepense = extractedData.date;
    if (!dateDepense || !/^\d{4}-\d{2}-\d{2}$/.test(dateDepense)) {
      dateDepense = new Date().toISOString().split('T')[0];
    }

    // Créer la dépense
    const { data: depense, error: insertError } = await supabase
      .from('depenses')
      .insert({
        tenant_id: tenantId,
        categorie: categorie,
        libelle: extractedData.fournisseur || 'Facture importée',
        description: extractedData.description || null,
        montant: montantHT,
        montant_ttc: montantTTC,
        montant_tva: montantTVA,
        taux_tva: tauxTVA,
        deductible_tva: true,
        date_depense: dateDepense,
        recurrence: 'ponctuelle',
        justificatif_url: null // TODO: on pourrait stocker le fichier dans Supabase Storage
      })
      .select()
      .single();

    if (insertError) {
      console.error('[DEPENSES] Erreur insertion:', insertError);
      throw insertError;
    }

    // Générer les écritures comptables
    await genererEcrituresDepense(tenantId, depense.id);

    console.log('[DEPENSES] Dépense créée via IA:', depense.id, extractedData.fournisseur);

    res.status(201).json({
      success: true,
      message: 'Facture analysée et dépense créée avec succès',
      depense: formatDepense(depense),
      extracted: {
        fournisseur: extractedData.fournisseur,
        date: dateDepense,
        montant_ttc_euros: (montantTTC / 100).toFixed(2),
        montant_ht_euros: (montantHT / 100).toFixed(2),
        tva_euros: (montantTVA / 100).toFixed(2),
        taux_tva: tauxTVA,
        categorie: categorie,
        description: extractedData.description
      }
    });

  } catch (error) {
    console.error('[DEPENSES] Erreur upload facture:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors de l\'analyse de la facture'
    });
  }
});

export default router;
