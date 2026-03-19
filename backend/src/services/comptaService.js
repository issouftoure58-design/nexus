/**
 * Service Comptabilité - P&L + TVA
 * SOURCE DE VÉRITÉ : ecritures_comptables (Grand Livre)
 *
 * Réécriture complète : lit depuis ecritures_comptables au lieu de factures/depenses
 * pour cohérence avec Bilan et Compte de Résultat.
 * Backward-compatible (même shape de retour).
 */

import { supabase } from '../config/supabase.js';

const NOMS_MOIS = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/**
 * Calcule P&L pour un mois donné depuis le Grand Livre
 */
export async function calculatePnL(tenant_id, mois, annee) {
  if (!tenant_id) throw new Error('tenant_id requis');

  const periode = `${annee}-${String(mois).padStart(2, '0')}`;

  console.log(`[COMPTA] Calcul P&L GL pour ${periode}`);

  // Toutes les écritures de la période
  const { data: ecritures, error } = await supabase
    .from('ecritures_comptables')
    .select('compte_numero, compte_libelle, debit, credit, journal_code')
    .eq('tenant_id', tenant_id)
    .eq('periode', periode);

  if (error) {
    console.error('[COMPTA] Erreur écritures:', error);
    throw error;
  }

  // Agréger par classe de compte
  let produitsTotal = 0;   // Classe 7 : crédit - débit
  let chargesTotal = 0;    // Classe 6 : débit - crédit
  let tvaCollectee = 0;    // 44571 : crédit
  let tvaDeductible = 0;   // 44566 : débit
  let nbEcritures = 0;

  const chargesParCompte = {};

  (ecritures || []).forEach(e => {
    nbEcritures++;
    const num = e.compte_numero || '';
    const classe = num.charAt(0);

    if (classe === '7') {
      // Produits (solde créditeur = chiffre d'affaires)
      produitsTotal += (e.credit || 0) - (e.debit || 0);
    } else if (classe === '6') {
      // Charges (solde débiteur = dépenses)
      const montant = (e.debit || 0) - (e.credit || 0);
      chargesTotal += montant;

      // Détail par compte
      const cat = e.compte_libelle || num;
      if (!chargesParCompte[cat]) {
        chargesParCompte[cat] = { total: 0, count: 0 };
      }
      chargesParCompte[cat].total += montant;
      chargesParCompte[cat].count += 1;
    }

    // TVA
    if (num.startsWith('44571')) {
      tvaCollectee += (e.credit || 0) - (e.debit || 0);
    } else if (num.startsWith('44566')) {
      tvaDeductible += (e.debit || 0) - (e.credit || 0);
    }
  });

  // Convertir centimes → euros
  const revenus = produitsTotal / 100;
  const revenusHT = revenus; // Les écritures sont déjà HT
  const depensesHT = chargesTotal / 100;
  const tvaCol = tvaCollectee / 100;
  const tvaDed = tvaDeductible / 100;

  const resultatBrut = revenusHT - depensesHT;
  const resultatNet = resultatBrut;
  const tvaNette = tvaCol - tvaDed;

  const margeBrute = revenusHT > 0 ? ((resultatBrut / revenusHT) * 100) : 0;
  const margeNette = revenusHT > 0 ? ((resultatNet / revenusHT) * 100) : 0;

  // Formater catégories de charges (centimes → euros)
  const parCategorie = {};
  Object.entries(chargesParCompte).forEach(([cat, data]) => {
    parCategorie[cat] = {
      total: (data.total / 100).toFixed(2),
      count: data.count
    };
  });

  return {
    periode: {
      mois,
      annee,
      nomMois: NOMS_MOIS[mois],
      dateDebut: `${annee}-${String(mois).padStart(2, '0')}-01`,
      dateFin: `${annee}-${String(mois).padStart(2, '0')}-${new Date(annee, mois, 0).getDate()}`
    },
    revenus: {
      total: revenus.toFixed(2),
      ht: revenusHT.toFixed(2),
      tva: tvaCol.toFixed(2),
      nbFactures: nbEcritures
    },
    depenses: {
      total: depensesHT.toFixed(2),
      ht: depensesHT.toFixed(2),
      tva: tvaDed.toFixed(2),
      nbDepenses: Object.values(chargesParCompte).reduce((s, d) => s + d.count, 0),
      parCategorie,
      detail: {}
    },
    resultat: {
      brut: resultatBrut.toFixed(2),
      net: resultatNet.toFixed(2),
      margeBrute: margeBrute.toFixed(2),
      margeNette: margeNette.toFixed(2),
      statut: resultatNet >= 0 ? 'benefice' : 'perte'
    },
    tva: {
      collectee: tvaCol.toFixed(2),
      deductible: tvaDed.toFixed(2),
      nette: tvaNette.toFixed(2),
      statut: tvaNette >= 0 ? 'a_payer' : 'credit'
    }
  };
}

/**
 * Calcule P&L pour une période (plusieurs mois)
 */
export async function calculatePnLPeriode(tenant_id, moisDebut, anneeDebut, moisFin, anneeFin) {
  const results = [];
  let totaux = {
    revenus: 0,
    depenses: 0,
    resultat: 0,
    tvaCollectee: 0,
    tvaDeductible: 0
  };

  let mois = moisDebut;
  let annee = anneeDebut;

  while (annee < anneeFin || (annee === anneeFin && mois <= moisFin)) {
    const pnl = await calculatePnL(tenant_id, mois, annee);
    results.push(pnl);

    totaux.revenus += parseFloat(pnl.revenus.total);
    totaux.depenses += parseFloat(pnl.depenses.total);
    totaux.resultat += parseFloat(pnl.resultat.net);
    totaux.tvaCollectee += parseFloat(pnl.tva.collectee);
    totaux.tvaDeductible += parseFloat(pnl.tva.deductible);

    mois++;
    if (mois > 12) {
      mois = 1;
      annee++;
    }
  }

  return {
    periodes: results,
    totaux: {
      revenus: totaux.revenus.toFixed(2),
      depenses: totaux.depenses.toFixed(2),
      resultat: totaux.resultat.toFixed(2),
      tvaCollectee: totaux.tvaCollectee.toFixed(2),
      tvaDeductible: totaux.tvaDeductible.toFixed(2),
      tvaNette: (totaux.tvaCollectee - totaux.tvaDeductible).toFixed(2)
    }
  };
}

/**
 * Calcule P&L pour l'année
 */
export async function calculatePnLAnnee(tenant_id, annee) {
  return calculatePnLPeriode(tenant_id, 1, annee, 12, annee);
}

/**
 * Compare P&L entre deux périodes
 */
export async function comparePnL(tenant_id, periode1, periode2) {
  const pnl1 = await calculatePnL(tenant_id, periode1.mois, periode1.annee);
  const pnl2 = await calculatePnL(tenant_id, periode2.mois, periode2.annee);

  const variation = (valeur1, valeur2) => {
    const v1 = parseFloat(valeur1);
    const v2 = parseFloat(valeur2);
    if (v2 === 0) return v1 > 0 ? 100 : 0;
    return (((v1 - v2) / Math.abs(v2)) * 100).toFixed(2);
  };

  return {
    periode1: pnl1,
    periode2: pnl2,
    variations: {
      revenus: variation(pnl1.revenus.total, pnl2.revenus.total),
      depenses: variation(pnl1.depenses.total, pnl2.depenses.total),
      resultat: variation(pnl1.resultat.net, pnl2.resultat.net)
    }
  };
}

// ─── DÉCLARATIONS TVA ───

/**
 * Pré-remplissage CA3 (TVA mensuelle)
 */
export async function prefillCA3(tenantId, periode) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!periode) throw new Error('période requise (YYYY-MM)');

  const { data: ecritures } = await supabase
    .from('ecritures_comptables')
    .select('compte_numero, debit, credit')
    .eq('tenant_id', tenantId)
    .eq('periode', periode);

  // Bases HT par taux
  let caHT = 0;         // Total CA HT
  let base20 = 0;       // Base 20%
  let base10 = 0;       // Base 10%
  let base55 = 0;       // Base 5.5%
  let tvaCol20 = 0;     // TVA collectée 20%
  let tvaCol10 = 0;     // TVA collectée 10%
  let tvaCol55 = 0;     // TVA collectée 5.5%
  let tvaDedImmo = 0;   // TVA déductible immobilisations
  let tvaDedABS = 0;    // TVA déductible autres biens/services

  (ecritures || []).forEach(e => {
    const num = e.compte_numero || '';

    // Produits classe 7 = CA HT
    if (num.charAt(0) === '7') {
      const montant = (e.credit || 0) - (e.debit || 0);
      caHT += montant;
      // On attribue au taux 20% par défaut (le plus courant)
      base20 += montant;
    }

    // TVA collectée 44571
    if (num.startsWith('44571')) {
      const montant = (e.credit || 0) - (e.debit || 0);
      // Par défaut 20% (affiner si sous-comptes existent)
      if (num === '4457110') {
        tvaCol10 += montant;
        // Recalculer base à partir de la TVA
        base10 += Math.round(montant / 0.10);
        base20 -= Math.round(montant / 0.10); // retirer du 20% par défaut
      } else if (num === '4457155') {
        tvaCol55 += montant;
        base55 += Math.round(montant / 0.055);
        base20 -= Math.round(montant / 0.055);
      } else {
        tvaCol20 += montant;
      }
    }

    // TVA déductible 44566
    if (num.startsWith('44566')) {
      const montant = (e.debit || 0) - (e.credit || 0);
      // 44562 = immobilisations, 44566 = ABS
      if (num.startsWith('44562')) {
        tvaDedImmo += montant;
      } else {
        tvaDedABS += montant;
      }
    }
  });

  const totalCollectee = tvaCol20 + tvaCol10 + tvaCol55;
  const totalDeductible = tvaDedImmo + tvaDedABS;
  const tvaNette = totalCollectee - totalDeductible;

  return {
    periode,
    // Montants en centimes
    ligne_01_ca_ht: caHT,
    ligne_08_base_20: base20,
    ligne_09_base_10: base10,
    ligne_9B_base_55: base55,
    ligne_10_tva_20: tvaCol20,
    ligne_11_tva_10: tvaCol10,
    ligne_14_tva_55: tvaCol55,
    ligne_19_total_collectee: totalCollectee,
    ligne_20_tva_ded_immo: tvaDedImmo,
    ligne_21_tva_ded_abs: tvaDedABS,
    ligne_23_total_deductible: totalDeductible,
    ligne_28_tva_nette: tvaNette,
    // En euros
    resume: {
      ca_ht: (caHT / 100).toFixed(2),
      tva_collectee: (totalCollectee / 100).toFixed(2),
      tva_deductible: (totalDeductible / 100).toFixed(2),
      tva_nette: (tvaNette / 100).toFixed(2),
      statut: tvaNette >= 0 ? 'a_payer' : 'credit_tva'
    }
  };
}

/**
 * Pré-remplissage CA12 (TVA annuelle simplifiée)
 */
export async function prefillCA12(tenantId, exercice) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!exercice) throw new Error('exercice requis');

  // Agréger toutes les périodes de l'exercice
  const { data: ecritures } = await supabase
    .from('ecritures_comptables')
    .select('compte_numero, debit, credit')
    .eq('tenant_id', tenantId)
    .eq('exercice', parseInt(exercice));

  let caHT = 0;
  let tvaCollectee = 0;
  let tvaDeductible = 0;

  (ecritures || []).forEach(e => {
    const num = e.compte_numero || '';

    if (num.charAt(0) === '7') {
      caHT += (e.credit || 0) - (e.debit || 0);
    }

    if (num.startsWith('44571')) {
      tvaCollectee += (e.credit || 0) - (e.debit || 0);
    }

    if (num.startsWith('44566') || num.startsWith('44562')) {
      tvaDeductible += (e.debit || 0) - (e.credit || 0);
    }
  });

  const tvaNette = tvaCollectee - tvaDeductible;

  return {
    exercice: parseInt(exercice),
    ca_ht: caHT,
    tva_collectee: tvaCollectee,
    tva_deductible: tvaDeductible,
    tva_nette: tvaNette,
    resume: {
      ca_ht: (caHT / 100).toFixed(2),
      tva_collectee: (tvaCollectee / 100).toFixed(2),
      tva_deductible: (tvaDeductible / 100).toFixed(2),
      tva_nette: (tvaNette / 100).toFixed(2),
      statut: tvaNette >= 0 ? 'a_payer' : 'credit_tva'
    }
  };
}

export default {
  calculatePnL,
  calculatePnLPeriode,
  calculatePnLAnnee,
  comparePnL,
  prefillCA3,
  prefillCA12
};
