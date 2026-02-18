/**
 * Service Comptabilité - Calcul P&L
 * Plan PRO Feature
 */

import { supabase } from '../config/supabase.js';

/**
 * Calcule P&L pour un mois donné
 * @param {string} tenant_id - ID du tenant
 * @param {number} mois - Mois (1-12)
 * @param {number} annee - Année
 */
export async function calculatePnL(tenant_id, mois, annee) {
  try {
    // Dates début et fin du mois
    const dateDebut = new Date(annee, mois - 1, 1);
    const dateFin = new Date(annee, mois, 0, 23, 59, 59);

    const dateDebutStr = dateDebut.toISOString().split('T')[0];
    const dateFinStr = dateFin.toISOString().split('T')[0];

    console.log(`[COMPTA] Calcul P&L pour ${mois}/${annee} (${dateDebutStr} - ${dateFinStr})`);

    // REVENUS : Factures payées du mois
    const { data: factures, error: errFactures } = await supabase
      .from('factures')
      .select('montant_ttc, montant_ht, montant_tva, date_paiement')
      .eq('tenant_id', tenant_id)
      .eq('statut', 'payee')
      .gte('date_paiement', dateDebutStr)
      .lte('date_paiement', dateFinStr + 'T23:59:59');

    if (errFactures) {
      console.error('[COMPTA] Erreur factures:', errFactures);
    }

    // Montants en centimes dans la DB, convertir en euros
    const revenus = (factures || []).reduce((sum, f) => sum + parseFloat(f.montant_ttc || f.montant_ht || 0), 0) / 100;
    const revenusHT = (factures || []).reduce((sum, f) => sum + parseFloat(f.montant_ht || f.montant_ttc || 0), 0) / 100;
    const tvaCollectee = (factures || []).reduce((sum, f) => sum + parseFloat(f.montant_tva || 0), 0) / 100;
    const nbFactures = factures?.length || 0;

    // DÉPENSES : Table dépenses du mois
    const { data: depenses, error: errDepenses } = await supabase
      .from('depenses')
      .select('montant, montant_ttc, montant_tva, categorie, libelle, date_depense')
      .eq('tenant_id', tenant_id)
      .gte('date_depense', dateDebutStr)
      .lte('date_depense', dateFinStr);

    if (errDepenses) {
      console.error('[COMPTA] Erreur dépenses:', errDepenses);
    }

    // Montants en centimes dans la DB, convertir en euros
    const depensesTotal = (depenses || []).reduce((sum, d) => sum + parseFloat(d.montant || 0), 0) / 100;
    const depensesHT = depensesTotal; // montant est déjà HT
    const tvaDeductible = (depenses || []).reduce((sum, d) => sum + parseFloat(d.montant_tva || 0), 0) / 100;
    const nbDepenses = depenses?.length || 0;

    // Grouper dépenses par catégorie (montants en euros)
    const depensesParCategorie = {};
    (depenses || []).forEach(d => {
      const cat = d.categorie || 'Autre';
      if (!depensesParCategorie[cat]) {
        depensesParCategorie[cat] = {
          total: 0,
          count: 0,
          items: []
        };
      }
      const montantEuros = parseFloat(d.montant || 0) / 100;
      depensesParCategorie[cat].total += montantEuros;
      depensesParCategorie[cat].count += 1;
      depensesParCategorie[cat].items.push({
        libelle: d.libelle,
        montant: montantEuros,
        date: d.date_depense
      });
    });

    // RÉSULTAT
    const resultatBrut = revenusHT - depensesHT;
    const resultatNet = revenus - depensesTotal;

    // TVA à payer
    const tvaNette = tvaCollectee - tvaDeductible;

    // Marges
    const margeBrute = revenusHT > 0 ? ((resultatBrut / revenusHT) * 100) : 0;
    const margeNette = revenus > 0 ? ((resultatNet / revenus) * 100) : 0;

    // Nom du mois en français
    const nomsMois = [
      '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    return {
      periode: {
        mois,
        annee,
        nomMois: nomsMois[mois],
        dateDebut: dateDebutStr,
        dateFin: dateFinStr
      },
      revenus: {
        total: revenus.toFixed(2),
        ht: revenusHT.toFixed(2),
        tva: tvaCollectee.toFixed(2),
        nbFactures
      },
      depenses: {
        total: depensesTotal.toFixed(2),
        ht: depensesHT.toFixed(2),
        tva: tvaDeductible.toFixed(2),
        nbDepenses,
        parCategorie: Object.fromEntries(
          Object.entries(depensesParCategorie).map(([cat, data]) => [
            cat,
            {
              total: data.total.toFixed(2),
              count: data.count
            }
          ])
        ),
        detail: depensesParCategorie
      },
      resultat: {
        brut: resultatBrut.toFixed(2),
        net: resultatNet.toFixed(2),
        margeBrute: margeBrute.toFixed(2),
        margeNette: margeNette.toFixed(2),
        statut: resultatNet >= 0 ? 'benefice' : 'perte'
      },
      tva: {
        collectee: tvaCollectee.toFixed(2),
        deductible: tvaDeductible.toFixed(2),
        nette: tvaNette.toFixed(2),
        statut: tvaNette >= 0 ? 'a_payer' : 'credit'
      }
    };
  } catch (error) {
    console.error('[COMPTA] Erreur calcul P&L:', error);
    throw error;
  }
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
 * Calcule P&L pour l'année en cours
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

export default {
  calculatePnL,
  calculatePnLPeriode,
  calculatePnLAnnee,
  comparePnL
};
