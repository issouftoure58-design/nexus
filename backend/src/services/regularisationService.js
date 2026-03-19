/**
 * Service de regularisation retroactive
 * Gere les rappels de salaire, corrections de paie et augmentations retroactives
 * Tous les montants en CENTIMES
 */

import { supabase } from '../config/supabase.js';
import { calculatePayroll, calculateCotisations, calculateBrut, TAUX_2026 } from './payrollEngine.js';

/**
 * Calcule les ecarts de regularisation entre l'ancien et le nouveau calcul
 * @param {string} tenantId
 * @param {string} membreId
 * @param {string} periodeOrigine - Mois a corriger (YYYY-MM)
 * @param {Object} corrections - { nouveau_salaire?, primes_ajout?, heures_supp_corr?, taux_ir? }
 * @returns {Object} Ecarts calcules
 */
export async function calculateRegularisation(tenantId, membreId, periodeOrigine, corrections) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!membreId) throw new Error('membre_id requis');
  if (!periodeOrigine) throw new Error('periodeOrigine requis');

  // Recuperer le bulletin d'origine
  const { data: bulletinOrigine, error } = await supabase
    .from('rh_bulletins_paie')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('membre_id', membreId)
    .eq('periode', periodeOrigine)
    .maybeSingle();

  if (error) throw error;

  // Recuperer le membre
  const { data: membre } = await supabase
    .from('rh_membres')
    .select('*')
    .eq('id', membreId)
    .eq('tenant_id', tenantId)
    .single();

  if (!membre) throw new Error('Employe non trouve');

  // Ancien brut (depuis bulletin ou depuis salaire membre)
  const ancienBrut = bulletinOrigine?.brut_total || membre.salaire_mensuel || 0;
  const anciennesCotisS = bulletinOrigine?.total_cotisations_salariales || 0;
  const anciennesCotisP = bulletinOrigine?.total_cotisations_patronales || 0;
  const ancienNet = bulletinOrigine?.net_a_payer || 0;

  // Calculer le nouveau brut avec les corrections
  let nouveauSalaireBase = corrections.nouveau_salaire || (bulletinOrigine?.salaire_base || membre.salaire_mensuel || 0);
  const primesAjout = corrections.primes_ajout || [];
  const totalPrimesAjout = primesAjout.reduce((s, p) => s + (p.montant || 0), 0);

  // Reconstituer le brut complet corrige
  const hsOrig25 = bulletinOrigine?.montant_hs_25 || 0;
  const hsOrig50 = bulletinOrigine?.montant_hs_50 || 0;
  const primesOrig = (bulletinOrigine?.primes || []).reduce((s, p) => s + (p.montant || 0), 0);

  // Si correction heures supp
  let hsCorr25 = hsOrig25;
  let hsCorr50 = hsOrig50;
  if (corrections.heures_supp_corr) {
    const tauxH = Math.round(nouveauSalaireBase / (membre.heures_mensuelles || 151.67));
    hsCorr25 = Math.round((corrections.heures_supp_corr.heures_25 || 0) * tauxH * 1.25);
    hsCorr50 = Math.round((corrections.heures_supp_corr.heures_50 || 0) * tauxH * 1.50);
  }

  const nouveauBrut = nouveauSalaireBase + hsCorr25 + hsCorr50 + primesOrig + totalPrimesAjout;

  // Recalculer les cotisations
  const moisEcoule = parseInt(periodeOrigine.split('-')[1]);
  const nouvellesCotisations = calculateCotisations(
    nouveauBrut, membre, {}, {}, { moisEcoule }
  );

  // PAS
  const tauxIR = corrections.taux_ir || bulletinOrigine?.taux_ir || 0;
  const nouveauNetSocial = nouveauBrut - nouvellesCotisations.totalSalarial;
  const csgNonDed = nouvellesCotisations.salariales.find(c => c.code === 'CSG_NON_DED')?.montant || 0;
  const crds = nouvellesCotisations.salariales.find(c => c.code === 'CRDS')?.montant || 0;
  const nouveauNetImposable = nouveauBrut - nouvellesCotisations.totalSalarial + csgNonDed + crds;
  const nouveauPAS = Math.round(nouveauNetImposable * tauxIR / 100);
  const nouveauNet = nouveauNetSocial - nouveauPAS;

  // Calculer les ecarts
  const ecartBrut = nouveauBrut - ancienBrut;
  const ecartCotisS = nouvellesCotisations.totalSalarial - anciennesCotisS;
  const ecartCotisP = nouvellesCotisations.totalPatronal - anciennesCotisP;
  const ecartNet = nouveauNet - ancienNet;

  // Lignes de regularisation pour le bulletin
  const lignesRegul = [];

  if (ecartBrut !== 0) {
    lignesRegul.push({
      type: 'rappel_brut',
      libelle: `Rappel de salaire (${periodeOrigine})`,
      montant: ecartBrut,
    });
  }

  if (ecartCotisS !== 0) {
    lignesRegul.push({
      type: 'rappel_cotisations_salariales',
      libelle: `Regularisation cotisations salariales (${periodeOrigine})`,
      montant: -ecartCotisS, // Negatif car c'est une retenue supplementaire
    });
  }

  if (totalPrimesAjout > 0) {
    for (const p of primesAjout) {
      lignesRegul.push({
        type: 'prime_ajout',
        libelle: `${p.nom || 'Prime'} (rappel ${periodeOrigine})`,
        montant: p.montant,
      });
    }
  }

  return {
    periodeOrigine,
    ancien: {
      brut: ancienBrut,
      cotisationsSalariales: anciennesCotisS,
      cotisationsPatronales: anciennesCotisP,
      net: ancienNet,
    },
    nouveau: {
      brut: nouveauBrut,
      cotisationsSalariales: nouvellesCotisations.totalSalarial,
      cotisationsPatronales: nouvellesCotisations.totalPatronal,
      net: nouveauNet,
    },
    ecartBrut,
    ecartCotisationsSalariales: ecartCotisS,
    ecartCotisationsPatronales: ecartCotisP,
    ecartNet,
    lignesRegul,
    detailCotisations: nouvellesCotisations,
  };
}

/**
 * Applique une regularisation en creant/modifiant le bulletin du mois d'application
 * @param {string} tenantId
 * @param {string} membreId
 * @param {string} periodeApplication - Mois ou integrer la regul (YYYY-MM)
 * @param {Object} regul - Resultat de calculateRegularisation
 * @returns {Object} Bulletin avec lignes de rappel integrees
 */
export async function applyRegularisation(tenantId, membreId, periodeApplication, regul) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!membreId) throw new Error('membre_id requis');

  // Determiner le type
  let type = 'correction';
  if (regul.ecartBrut > 0) type = 'rappel_salaire';
  if (regul.ecartBrut < 0) type = 'correction';

  // Sauvegarder la regularisation
  const { data: regulData, error: regulError } = await supabase
    .from('rh_regularisations')
    .insert({
      tenant_id: tenantId,
      membre_id: membreId,
      periode_origine: regul.periodeOrigine,
      periode_application: periodeApplication,
      type,
      ecart_brut: regul.ecartBrut,
      ecart_net: regul.ecartNet,
      details: {
        ancien: regul.ancien,
        nouveau: regul.nouveau,
        lignesRegul: regul.lignesRegul,
      },
      status: 'applique',
    })
    .select()
    .single();

  if (regulError) throw regulError;

  // Verifier si un bulletin existe deja pour le mois d'application
  const { data: bulletinExistant } = await supabase
    .from('rh_bulletins_paie')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('membre_id', membreId)
    .eq('periode', periodeApplication)
    .maybeSingle();

  if (bulletinExistant) {
    // Ajouter les lignes de regul au brut du bulletin existant
    const primesCourantes = bulletinExistant.primes || [];
    const primesAvecRegul = [
      ...primesCourantes,
      ...regul.lignesRegul.filter(l => l.type !== 'rappel_cotisations_salariales').map(l => ({
        code: 'REGUL',
        nom: l.libelle,
        montant: l.montant,
        source: 'regularisation',
      })),
    ];

    const nouveauBrut = bulletinExistant.brut_total + regul.ecartBrut;
    const nouveauNetAPayer = bulletinExistant.net_a_payer + regul.ecartNet;

    const { data: bulletinMaj, error: updateErr } = await supabase
      .from('rh_bulletins_paie')
      .update({
        primes: primesAvecRegul,
        brut_total: nouveauBrut,
        total_cotisations_salariales: bulletinExistant.total_cotisations_salariales + regul.ecartCotisationsSalariales,
        total_cotisations_patronales: bulletinExistant.total_cotisations_patronales + regul.ecartCotisationsPatronales,
        net_avant_ir: bulletinExistant.net_avant_ir + regul.ecartNet + (regul.ecartCotisationsSalariales > 0 ? 0 : Math.abs(regul.ecartCotisationsSalariales)),
        net_a_payer: nouveauNetAPayer,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bulletinExistant.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateErr) throw updateErr;
    return { bulletin: bulletinMaj, regularisation: regulData };
  }

  // Si pas de bulletin existant, il faudra d'abord generer le bulletin du mois
  return {
    bulletin: null,
    regularisation: regulData,
    message: `Regularisation enregistree. Generez d'abord le bulletin de ${periodeApplication} puis les ecarts seront appliques.`,
  };
}

/**
 * Recalcule les cumuls annuels depuis janvier pour un employe
 * @param {string} tenantId
 * @param {string} membreId
 * @param {number} annee
 * @returns {Object} Cumuls recalcules
 */
export async function recalculateCumuls(tenantId, membreId, annee) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!membreId) throw new Error('membre_id requis');

  const anneeStr = String(annee);

  // Recuperer tous les bulletins de l'annee
  const { data: bulletins, error } = await supabase
    .from('rh_bulletins_paie')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('membre_id', membreId)
    .gte('periode', `${anneeStr}-01`)
    .lte('periode', `${anneeStr}-12`)
    .order('periode');

  if (error) throw error;
  if (!bulletins || bulletins.length === 0) {
    return { brut: 0, netImposable: 0, pas: 0, cotisationsSalariales: 0, cotisationsPatronales: 0 };
  }

  // Recalculer progressivement
  let cumuls = { brut: 0, netImposable: 0, pas: 0, cotisationsSalariales: 0, cotisationsPatronales: 0 };

  for (const b of bulletins) {
    cumuls.brut += b.brut_total || 0;
    cumuls.netImposable += b.net_imposable || 0;
    cumuls.pas += b.montant_ir || 0;
    cumuls.cotisationsSalariales += b.total_cotisations_salariales || 0;
    cumuls.cotisationsPatronales += b.total_cotisations_patronales || 0;

    // Mettre a jour les cumuls du bulletin
    await supabase
      .from('rh_bulletins_paie')
      .update({
        cumul_brut: cumuls.brut,
        cumul_net_imposable: cumuls.netImposable,
        cumul_ir: cumuls.pas,
        cumuls: { ...cumuls },
        updated_at: new Date().toISOString(),
      })
      .eq('id', b.id)
      .eq('tenant_id', tenantId);
  }

  return cumuls;
}

/**
 * Liste les regularisations d'un employe
 */
export async function listRegularisations(tenantId, membreId = null, annee = null) {
  if (!tenantId) throw new Error('tenant_id requis');

  let query = supabase
    .from('rh_regularisations')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (membreId) query = query.eq('membre_id', membreId);
  if (annee) {
    query = query.gte('periode_origine', `${annee}-01`).lte('periode_origine', `${annee}-12`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export default {
  calculateRegularisation,
  applyRegularisation,
  recalculateCumuls,
  listRegularisations,
};
