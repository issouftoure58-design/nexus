/**
 * Compta Handler — Depenses, Facturation, Tresorerie, Fiscal, Rapport
 * Extracted from adminChatService.js + new tools
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';

// ═══════════════════════════════════════════════════════════════
// HELPER
// ═══════════════════════════════════════════════════════════════

function getPrixReservation(r) {
  if (r.prix_total) return r.prix_total;
  if (r.prix_service) return (r.prix_service || 0) + (r.frais_deplacement || 0);
  return 0;
}

// ═══════════════════════════════════════════════════════════════
// comptable_depenses — Gestion des depenses (extrait adminChatService L580-652)
// ═══════════════════════════════════════════════════════════════

async function comptable_depenses(toolInput, tenantId, adminId) {
  const action = toolInput.action || 'lister';
  const today = new Date();
  const targetMois = toolInput.periode || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  if (action === 'ajouter') {
    if (!toolInput.categorie || !toolInput.montant) {
      return { success: false, error: 'Categorie et montant requis' };
    }

    const { data, error } = await supabase
      .from('depenses')
      .insert({
        tenant_id: tenantId,
        categorie: toolInput.categorie,
        libelle: toolInput.description || toolInput.categorie,
        montant: Math.round(toolInput.montant * 100), // Convertir en centimes
        date_depense: toolInput.date || today.toISOString().split('T')[0]
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      message: `Depense ajoutee: ${toolInput.montant}EUR (${toolInput.categorie})`,
      depense: data
    };
  }

  if (action === 'analyser' || action === 'lister') {
    const [year, month] = targetMois.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

    const { data: depenses } = await supabase
      .from('depenses')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('date_depense', startDate)
      .lte('date_depense', endDate);

    // Grouper par categorie
    const parCategorie = {};
    let total = 0;
    (depenses || []).forEach(d => {
      parCategorie[d.categorie] = (parCategorie[d.categorie] || 0) + d.montant;
      total += d.montant;
    });

    return {
      success: true,
      mois: targetMois,
      total_euros: (total / 100).toFixed(2),
      nb_depenses: depenses?.length || 0,
      par_categorie: Object.entries(parCategorie).map(([cat, montant]) => ({
        categorie: cat,
        montant_euros: (montant / 100).toFixed(2)
      })),
      depenses: depenses?.map(d => ({
        id: d.id,
        date: d.date_depense,
        categorie: d.categorie,
        libelle: d.libelle,
        montant_euros: (d.montant / 100).toFixed(2)
      }))
    };
  }

  return { success: false, error: 'Action non reconnue. Actions valides: ajouter, lister, analyser' };
}

// ═══════════════════════════════════════════════════════════════
// get_compte_resultat — Compte de resultat mensuel (extrait adminChatService L654-707)
// ═══════════════════════════════════════════════════════════════

async function get_compte_resultat(toolInput, tenantId, adminId) {
  const today = new Date();
  const targetMois = toolInput.mois || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [year, month] = targetMois.split('-');
  const startDate = `${year}-${month}-01`;
  const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

  // Revenus (reservations confirmees/terminees)
  const { data: reservations } = await supabase
    .from('reservations')
    .select('prix_total, prix_service, frais_deplacement, statut')
    .eq('tenant_id', tenantId)
    .gte('date', startDate)
    .lte('date', endDate)
    .in('statut', ['confirme', 'termine']);

  const revenus = (reservations || []).reduce((sum, r) => {
    return sum + getPrixReservation(r);
  }, 0);

  // Charges
  const { data: depenses } = await supabase
    .from('depenses')
    .select('categorie, montant')
    .eq('tenant_id', tenantId)
    .gte('date_depense', startDate)
    .lte('date_depense', endDate);

  const chargesParCategorie = {};
  let totalCharges = 0;
  (depenses || []).forEach(d => {
    chargesParCategorie[d.categorie] = (chargesParCategorie[d.categorie] || 0) + d.montant;
    totalCharges += d.montant;
  });

  const resultatNet = revenus - totalCharges;
  const margeNette = revenus > 0 ? ((resultatNet / revenus) * 100).toFixed(1) : 0;

  return {
    success: true,
    mois: targetMois,
    chiffre_affaires: `${(revenus / 100).toFixed(2)}EUR`,
    charges_totales: `${(totalCharges / 100).toFixed(2)}EUR`,
    resultat_net: `${(resultatNet / 100).toFixed(2)}EUR`,
    marge_nette: `${margeNette}%`,
    detail_charges: Object.entries(chargesParCategorie).map(([cat, montant]) => ({
      categorie: cat,
      montant_euros: (montant / 100).toFixed(2)
    })),
    nb_rdv: reservations?.length || 0,
    nb_depenses: depenses?.length || 0
  };
}

// ═══════════════════════════════════════════════════════════════
// comptable_facturation — Gestion des factures
// ═══════════════════════════════════════════════════════════════

async function comptable_facturation(toolInput, tenantId, adminId) {
  const action = toolInput.action || 'lister';

  if (action === 'lister') {
    let query = supabase
      .from('factures')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(toolInput.limit || 20);

    if (toolInput.statut) query = query.eq('statut', toolInput.statut);
    if (toolInput.client_id) query = query.eq('client_id', toolInput.client_id);
    if (toolInput.date_debut) query = query.gte('date_facture', toolInput.date_debut);
    if (toolInput.date_fin) query = query.lte('date_facture', toolInput.date_fin);

    const { data: factures, error } = await query;

    if (error) throw error;

    const totalTTC = (factures || []).reduce((sum, f) => sum + (f.montant_ttc || 0), 0);
    const totalHT = (factures || []).reduce((sum, f) => sum + (f.montant_ht || 0), 0);

    return {
      success: true,
      nb_factures: factures?.length || 0,
      total_ttc_euros: (totalTTC / 100).toFixed(2),
      total_ht_euros: (totalHT / 100).toFixed(2),
      factures: (factures || []).map(f => ({
        id: f.id,
        numero: f.numero,
        client_nom: f.client_nom,
        montant_ttc_euros: ((f.montant_ttc || 0) / 100).toFixed(2),
        montant_ht_euros: ((f.montant_ht || 0) / 100).toFixed(2),
        statut: f.statut,
        date_facture: f.date_facture,
        date_echeance: f.date_echeance,
        date_paiement: f.date_paiement
      }))
    };
  }

  if (action === 'creer') {
    return {
      success: false,
      message: 'La creation de factures necessite le service PDF. Utilisez POST /api/factures pour creer une facture avec generation PDF automatique.'
    };
  }

  if (action === 'exporter') {
    return {
      success: false,
      message: 'L\'export de factures sera disponible via le module d\'export. Utilisez l\'interface Nexus pour telecharger vos factures en PDF.'
    };
  }

  return { success: false, error: 'Action non reconnue. Actions valides: lister, creer, exporter' };
}

// ═══════════════════════════════════════════════════════════════
// comptable_tresorerie — Situation de tresorerie mensuelle
// ═══════════════════════════════════════════════════════════════

async function comptable_tresorerie(toolInput, tenantId, adminId) {
  try {
    const { calculatePnL } = await import('../../services/comptaService.js');
    const now = new Date();
    const mois = toolInput.mois || (now.getMonth() + 1);
    const annee = toolInput.annee || now.getFullYear();

    const pnl = await calculatePnL(tenantId, mois, annee);

    return {
      success: true,
      periode: pnl.periode,
      revenus: pnl.revenus.total,
      depenses: pnl.depenses.total,
      solde: pnl.resultat.net,
      statut: pnl.resultat.statut,
      detail: {
        revenus_ht: pnl.revenus.ht,
        tva_collectee: pnl.tva.collectee,
        depenses_ht: pnl.depenses.ht,
        tva_deductible: pnl.tva.deductible,
        tva_nette: pnl.tva.nette,
        nb_factures: pnl.revenus.nbFactures,
        nb_depenses: pnl.depenses.nbDepenses
      }
    };
  } catch (error) {
    logger.error('[COMPTA HANDLER] Erreur tresorerie:', error);
    return { success: false, error: `Erreur calcul tresorerie: ${error.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════
// comptable_fiscal — Calcul TVA collectee / deductible / a payer
// ═══════════════════════════════════════════════════════════════

async function comptable_fiscal(toolInput, tenantId, adminId) {
  const now = new Date();
  const mois = toolInput.mois || (now.getMonth() + 1);
  const annee = toolInput.annee || now.getFullYear();

  const startDate = `${annee}-${String(mois).padStart(2, '0')}-01`;
  const endDate = new Date(annee, mois, 0).toISOString().split('T')[0];

  // TVA collectee : depuis les factures payees
  const { data: factures, error: errFactures } = await supabase
    .from('factures')
    .select('montant_tva, montant_ttc, montant_ht, date_paiement')
    .eq('tenant_id', tenantId)
    .eq('statut', 'payee')
    .gte('date_paiement', startDate)
    .lte('date_paiement', endDate + 'T23:59:59');

  if (errFactures) {
    logger.error('[COMPTA HANDLER] Erreur factures fiscal:', errFactures);
  }

  const tvaCollectee = (factures || []).reduce((sum, f) => sum + parseFloat(f.montant_tva || 0), 0);
  const caHT = (factures || []).reduce((sum, f) => sum + parseFloat(f.montant_ht || 0), 0);
  const caTTC = (factures || []).reduce((sum, f) => sum + parseFloat(f.montant_ttc || 0), 0);

  // TVA deductible : depuis les depenses (montant_tva si disponible, sinon estimation 20%)
  const { data: depenses, error: errDepenses } = await supabase
    .from('depenses')
    .select('montant, montant_tva, categorie')
    .eq('tenant_id', tenantId)
    .gte('date_depense', startDate)
    .lte('date_depense', endDate);

  if (errDepenses) {
    logger.error('[COMPTA HANDLER] Erreur depenses fiscal:', errDepenses);
  }

  const tvaDeductible = (depenses || []).reduce((sum, d) => {
    // Utiliser montant_tva si disponible, sinon estimer a 20% du montant HT
    if (d.montant_tva && parseFloat(d.montant_tva) > 0) {
      return sum + parseFloat(d.montant_tva);
    }
    return sum + (parseFloat(d.montant || 0) * 0.2);
  }, 0);

  const totalDepenses = (depenses || []).reduce((sum, d) => sum + parseFloat(d.montant || 0), 0);
  const tvaAPayer = tvaCollectee - tvaDeductible;

  // Grouper depenses par categorie pour detail TVA deductible
  const tvaParCategorie = {};
  (depenses || []).forEach(d => {
    const cat = d.categorie || 'Autre';
    const tva = d.montant_tva && parseFloat(d.montant_tva) > 0
      ? parseFloat(d.montant_tva)
      : parseFloat(d.montant || 0) * 0.2;
    tvaParCategorie[cat] = (tvaParCategorie[cat] || 0) + tva;
  });

  return {
    success: true,
    periode: {
      mois,
      annee,
      debut: startDate,
      fin: endDate
    },
    tva_collectee_euros: (tvaCollectee / 100).toFixed(2),
    tva_deductible_euros: (tvaDeductible / 100).toFixed(2),
    tva_a_payer_euros: (tvaAPayer / 100).toFixed(2),
    statut: tvaAPayer >= 0 ? 'a_payer' : 'credit_tva',
    detail: {
      ca_ht_euros: (caHT / 100).toFixed(2),
      ca_ttc_euros: (caTTC / 100).toFixed(2),
      nb_factures: factures?.length || 0,
      depenses_totales_euros: (totalDepenses / 100).toFixed(2),
      nb_depenses: depenses?.length || 0,
      tva_deductible_par_categorie: Object.entries(tvaParCategorie).map(([cat, montant]) => ({
        categorie: cat,
        tva_euros: (montant / 100).toFixed(2)
      }))
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// comptable_rapport — Rapport P&L via comptaService
// ═══════════════════════════════════════════════════════════════

async function comptable_rapport(toolInput, tenantId, adminId) {
  try {
    const { calculatePnL, calculatePnLPeriode } = await import('../../services/comptaService.js');
    const now = new Date();

    // Si periode demandee (plusieurs mois)
    if (toolInput.mois_debut && toolInput.mois_fin) {
      const [anneeDebut, moisDebut] = toolInput.mois_debut.split('-').map(Number);
      const [anneeFin, moisFin] = toolInput.mois_fin.split('-').map(Number);

      const rapport = await calculatePnLPeriode(tenantId, moisDebut, anneeDebut, moisFin, anneeFin);

      return {
        success: true,
        type: 'periode',
        periode: {
          debut: toolInput.mois_debut,
          fin: toolInput.mois_fin
        },
        totaux: rapport.totaux,
        nb_mois: rapport.periodes.length,
        detail_mensuel: rapport.periodes.map(p => ({
          mois: `${p.periode.nomMois} ${p.periode.annee}`,
          revenus: p.revenus.total,
          depenses: p.depenses.total,
          resultat: p.resultat.net,
          marge: p.resultat.margeNette
        }))
      };
    }

    // Sinon rapport mensuel simple
    const mois = toolInput.mois || (now.getMonth() + 1);
    const annee = toolInput.annee || now.getFullYear();

    const pnl = await calculatePnL(tenantId, mois, annee);

    return {
      success: true,
      type: 'mensuel',
      periode: pnl.periode,
      revenus: {
        total: pnl.revenus.total,
        ht: pnl.revenus.ht,
        tva: pnl.revenus.tva,
        nb_factures: pnl.revenus.nbFactures
      },
      depenses: {
        total: pnl.depenses.total,
        nb_depenses: pnl.depenses.nbDepenses,
        par_categorie: pnl.depenses.parCategorie
      },
      resultat: pnl.resultat,
      tva: pnl.tva
    };
  } catch (error) {
    logger.error('[COMPTA HANDLER] Erreur rapport:', error);
    return { success: false, error: `Erreur generation rapport: ${error.message}` };
  }
}

// ═══════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════

export const comptaHandlers = {
  comptable_depenses,
  get_compte_resultat,
  compte_resultat: get_compte_resultat,
  comptable_facturation,
  comptable_tresorerie,
  comptable_fiscal,
  comptable_rapport
};
