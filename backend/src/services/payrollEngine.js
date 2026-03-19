/**
 * Moteur de calcul paie production-ready
 * Gestion des tranches PMSS, reduction Fillon, PAS, cumuls annuels
 * Tous les montants sont en CENTIMES (1€ = 100)
 */

import { supabase } from '../config/supabase.js';

// ============================================
// TAUX COTISATIONS 2026 - URSSAF
// ============================================

export const TAUX_2026 = {
  // SMIC 2026
  smic_horaire: 1202,
  smic_mensuel: 182303,

  // Plafond SS 2026
  pmss: 400500,
  pass: 4806000,

  // Heures reference
  heures_reference: 15167, // 151.67h en centimes (pour division)

  // Cotisations patronales
  patronales: {
    maladie: { taux: 7.00, base: 'brut', seuil_haut: 2.5, taux_haut: 13.00 },
    vieillesse_plafonnee: { taux: 8.55, base: 'T1' },
    vieillesse_deplafonnee: { taux: 2.02, base: 'brut' },
    allocations_familiales: { taux: 3.45, base: 'brut', seuil_haut: 3.5, taux_haut: 5.25 },
    accidents_travail: { taux: 2.08, base: 'brut' },
    chomage: { taux: 4.05, base: 'T1' },
    ags: { taux: 0.20, base: 'T1' },
    fnal: { taux: 0.10, base: 'T1', taux_50_plus: 0.50 },
    csa: { taux: 0.30, base: 'brut' },
    retraite_t1: { taux: 4.72, base: 'T1' },
    retraite_t2: { taux: 12.95, base: 'T2' },
    ceg_t1: { taux: 1.29, base: 'T1' },
    ceg_t2: { taux: 1.62, base: 'T2' },
    formation: { taux: 0.55, base: 'brut', taux_11_plus: 1.00 },
    taxe_apprentissage: { taux: 0.68, base: 'brut' },
    dialogue_social: { taux: 0.016, base: 'brut' },
  },

  // Cotisations salariales
  salariales: {
    maladie: { taux: 0.00, base: 'brut' },
    vieillesse_plafonnee: { taux: 6.90, base: 'T1' },
    vieillesse_deplafonnee: { taux: 0.40, base: 'brut' },
    retraite_t1: { taux: 3.15, base: 'T1' },
    retraite_t2: { taux: 8.64, base: 'T2' },
    ceg_t1: { taux: 0.86, base: 'T1' },
    ceg_t2: { taux: 1.08, base: 'T2' },
    csg_deductible: { taux: 6.80, base: 'CSG' },
    csg_non_deductible: { taux: 2.40, base: 'CSG' },
    crds: { taux: 0.50, base: 'CSG' },
  },

  // Base CSG/CRDS
  base_csg_pct: 98.25,

  // Heures supplementaires
  majoration_hs_25: 25,
  majoration_hs_50: 50,
  contingent_annuel_hs: 220,
};

// ============================================
// CALCUL TRANCHES PMSS
// ============================================

/**
 * Calcule les tranches PMSS avec regularisation progressive annuelle
 * @param {number} brutMensuel - Brut du mois en centimes
 * @param {number} cumulBrutAnnuel - Cumul brut annuel precedent (mois anterieurs) en centimes
 * @param {number} moisEcoule - Numero du mois (1-12)
 * @returns {{ tranche1: number, tranche2: number }}
 */
export function calculateTranchesPMSS(brutMensuel, cumulBrutAnnuel = 0, moisEcoule = 1) {
  const pmss = TAUX_2026.pmss;

  // Methode de regularisation progressive
  // Plafond cumule = PMSS * nombre de mois (incluant le mois en cours)
  const plafondCumule = pmss * moisEcoule;

  // Cumul brut total (anterieurs + mois en cours)
  const cumulBrutTotal = cumulBrutAnnuel + brutMensuel;

  // T1 cumule = min(cumul brut total, plafond cumule)
  const t1Cumule = Math.min(cumulBrutTotal, plafondCumule);

  // T1 des mois precedents
  const t1Precedent = Math.min(cumulBrutAnnuel, pmss * (moisEcoule - 1));

  // T1 du mois = T1 cumule - T1 precedent
  const tranche1 = Math.max(0, t1Cumule - t1Precedent);

  // T2 du mois = brut - T1
  const tranche2 = Math.max(0, brutMensuel - tranche1);

  return { tranche1, tranche2 };
}

// ============================================
// CALCUL BRUT
// ============================================

/**
 * Calcule le salaire brut avec decomposition
 * @param {Object} membre - Donnees employe
 * @param {Object} pointage - Heures supplementaires du mois
 * @param {Array} primes - Primes a ajouter
 * @param {Object} convention - Config convention collective (optionnel)
 * @returns {Object} Detail du brut
 */
export function calculateBrut(membre, pointage = {}, primes = [], convention = null) {
  const salaireBase = membre.salaire_mensuel || 0;
  const heuresNormales = membre.heures_mensuelles || 151.67;
  const tauxHoraire = Math.round(salaireBase / heuresNormales);

  // Heures supplementaires
  const hs25 = pointage.heures_25 || 0;
  const hs50 = pointage.heures_50 || 0;
  const montantHS25 = pointage.montant_25 || Math.round(hs25 * tauxHoraire * 1.25);
  const montantHS50 = pointage.montant_50 || Math.round(hs50 * tauxHoraire * 1.50);

  // Primes (peuvent venir de la convention ou etre manuelles)
  const totalPrimes = primes.reduce((sum, p) => sum + (p.montant || 0), 0);

  const totalBrut = salaireBase + montantHS25 + montantHS50 + totalPrimes;

  return {
    salaireBase,
    heuresNormales,
    tauxHoraire,
    heuresSupp25: hs25,
    heuresSupp50: hs50,
    montantHS25,
    montantHS50,
    primes,
    totalPrimes,
    totalBrut,
  };
}

// ============================================
// CALCUL COTISATIONS
// ============================================

/**
 * Calcule toutes les cotisations salariales et patronales
 * @param {number} brut - Brut total en centimes
 * @param {Object} membre - Donnees employe (pour taux specifiques)
 * @param {Object} parametres - Parametres paie tenant (surcharges)
 * @param {Object} cumulsAnnuels - Cumuls annuels anterieurs
 * @param {Object} options - effectif, convention, etc.
 * @returns {Object} Cotisations detaillees
 */
export function calculateCotisations(brut, membre = {}, parametres = {}, cumulsAnnuels = {}, options = {}) {
  const effectif = options.effectif || 10;
  const moisEcoule = options.moisEcoule || 1;
  const cumulBrutAnnuel = cumulsAnnuels.brut || 0;

  // Tranches
  const { tranche1, tranche2 } = calculateTranchesPMSS(brut, cumulBrutAnnuel, moisEcoule);

  // Base CSG/CRDS = 98.25% du brut
  const baseCSG = Math.round(brut * TAUX_2026.base_csg_pct / 100);

  // Ratio brut / SMIC pour les taux reduits
  const ratioSMIC = brut / TAUX_2026.smic_mensuel;

  // ---- COTISATIONS SALARIALES ----
  const salariales = [];

  // Maladie (0% depuis 2018)
  salariales.push({
    code: 'MALADIE',
    libelle: 'Securite sociale - Maladie',
    base: brut,
    taux: 0,
    montant: 0,
    plafonne: false,
  });

  // Vieillesse plafonnee
  salariales.push({
    code: 'VIEILLESSE_PLAF',
    libelle: 'Securite sociale - Vieillesse plafonnee',
    base: tranche1,
    taux: TAUX_2026.salariales.vieillesse_plafonnee.taux,
    montant: Math.round(tranche1 * TAUX_2026.salariales.vieillesse_plafonnee.taux / 100),
    plafonne: true,
  });

  // Vieillesse deplafonnee
  salariales.push({
    code: 'VIEILLESSE_DEPLAF',
    libelle: 'Securite sociale - Vieillesse deplafonnee',
    base: brut,
    taux: TAUX_2026.salariales.vieillesse_deplafonnee.taux,
    montant: Math.round(brut * TAUX_2026.salariales.vieillesse_deplafonnee.taux / 100),
    plafonne: false,
  });

  // Retraite complementaire T1
  salariales.push({
    code: 'AGIRC_ARRCO_T1',
    libelle: 'Retraite complementaire T1',
    base: tranche1,
    taux: TAUX_2026.salariales.retraite_t1.taux,
    montant: Math.round(tranche1 * TAUX_2026.salariales.retraite_t1.taux / 100),
    plafonne: true,
  });

  // Retraite complementaire T2 (si brut > PMSS)
  if (tranche2 > 0) {
    salariales.push({
      code: 'AGIRC_ARRCO_T2',
      libelle: 'Retraite complementaire T2',
      base: tranche2,
      taux: TAUX_2026.salariales.retraite_t2.taux,
      montant: Math.round(tranche2 * TAUX_2026.salariales.retraite_t2.taux / 100),
      plafonne: true,
    });
  }

  // CEG T1
  salariales.push({
    code: 'CEG_T1',
    libelle: 'CEG Tranche 1',
    base: tranche1,
    taux: TAUX_2026.salariales.ceg_t1.taux,
    montant: Math.round(tranche1 * TAUX_2026.salariales.ceg_t1.taux / 100),
    plafonne: true,
  });

  // CEG T2
  if (tranche2 > 0) {
    salariales.push({
      code: 'CEG_T2',
      libelle: 'CEG Tranche 2',
      base: tranche2,
      taux: TAUX_2026.salariales.ceg_t2.taux,
      montant: Math.round(tranche2 * TAUX_2026.salariales.ceg_t2.taux / 100),
      plafonne: true,
    });
  }

  // CSG deductible
  salariales.push({
    code: 'CSG_DED',
    libelle: 'CSG deductible',
    base: baseCSG,
    taux: TAUX_2026.salariales.csg_deductible.taux,
    montant: Math.round(baseCSG * TAUX_2026.salariales.csg_deductible.taux / 100),
    plafonne: false,
  });

  // CSG non deductible
  salariales.push({
    code: 'CSG_NON_DED',
    libelle: 'CSG non deductible',
    base: baseCSG,
    taux: TAUX_2026.salariales.csg_non_deductible.taux,
    montant: Math.round(baseCSG * TAUX_2026.salariales.csg_non_deductible.taux / 100),
    plafonne: false,
  });

  // CRDS
  salariales.push({
    code: 'CRDS',
    libelle: 'CRDS',
    base: baseCSG,
    taux: TAUX_2026.salariales.crds.taux,
    montant: Math.round(baseCSG * TAUX_2026.salariales.crds.taux / 100),
    plafonne: false,
  });

  // ---- COTISATIONS PATRONALES ----
  const patronales = [];

  // Maladie (taux reduit si < 2.5 SMIC)
  const tauxMaladie = ratioSMIC <= 2.5 ? TAUX_2026.patronales.maladie.taux : TAUX_2026.patronales.maladie.taux_haut;
  patronales.push({
    code: 'MALADIE',
    libelle: 'Securite sociale - Maladie',
    base: brut,
    taux: tauxMaladie,
    montant: Math.round(brut * tauxMaladie / 100),
    plafonne: false,
  });

  // Vieillesse plafonnee
  patronales.push({
    code: 'VIEILLESSE_PLAF',
    libelle: 'Securite sociale - Vieillesse plafonnee',
    base: tranche1,
    taux: TAUX_2026.patronales.vieillesse_plafonnee.taux,
    montant: Math.round(tranche1 * TAUX_2026.patronales.vieillesse_plafonnee.taux / 100),
    plafonne: true,
  });

  // Vieillesse deplafonnee
  patronales.push({
    code: 'VIEILLESSE_DEPLAF',
    libelle: 'Securite sociale - Vieillesse deplafonnee',
    base: brut,
    taux: TAUX_2026.patronales.vieillesse_deplafonnee.taux,
    montant: Math.round(brut * TAUX_2026.patronales.vieillesse_deplafonnee.taux / 100),
    plafonne: false,
  });

  // Allocations familiales (taux reduit si < 3.5 SMIC)
  const tauxAF = ratioSMIC <= 3.5 ? TAUX_2026.patronales.allocations_familiales.taux : TAUX_2026.patronales.allocations_familiales.taux_haut;
  patronales.push({
    code: 'AF',
    libelle: 'Allocations familiales',
    base: brut,
    taux: tauxAF,
    montant: Math.round(brut * tauxAF / 100),
    plafonne: false,
  });

  // Accidents du travail
  const tauxAT = parametres?.taux_at || TAUX_2026.patronales.accidents_travail.taux;
  patronales.push({
    code: 'AT_MP',
    libelle: 'Accidents du travail / Maladies prof.',
    base: brut,
    taux: tauxAT,
    montant: Math.round(brut * tauxAT / 100),
    plafonne: false,
  });

  // Chomage
  patronales.push({
    code: 'CHOMAGE',
    libelle: 'Assurance chomage',
    base: tranche1,
    taux: TAUX_2026.patronales.chomage.taux,
    montant: Math.round(tranche1 * TAUX_2026.patronales.chomage.taux / 100),
    plafonne: true,
  });

  // AGS
  patronales.push({
    code: 'AGS',
    libelle: 'AGS (garantie salaires)',
    base: tranche1,
    taux: TAUX_2026.patronales.ags.taux,
    montant: Math.round(tranche1 * TAUX_2026.patronales.ags.taux / 100),
    plafonne: true,
  });

  // FNAL
  const tauxFNAL = effectif >= 50 ? TAUX_2026.patronales.fnal.taux_50_plus : TAUX_2026.patronales.fnal.taux;
  const baseFNAL = effectif >= 50 ? brut : tranche1;
  patronales.push({
    code: 'FNAL',
    libelle: 'FNAL',
    base: baseFNAL,
    taux: tauxFNAL,
    montant: Math.round(baseFNAL * tauxFNAL / 100),
    plafonne: effectif < 50,
  });

  // CSA
  patronales.push({
    code: 'CSA',
    libelle: 'Contribution solidarite autonomie',
    base: brut,
    taux: TAUX_2026.patronales.csa.taux,
    montant: Math.round(brut * TAUX_2026.patronales.csa.taux / 100),
    plafonne: false,
  });

  // Retraite complementaire T1
  patronales.push({
    code: 'AGIRC_ARRCO_T1',
    libelle: 'Retraite complementaire T1',
    base: tranche1,
    taux: TAUX_2026.patronales.retraite_t1.taux,
    montant: Math.round(tranche1 * TAUX_2026.patronales.retraite_t1.taux / 100),
    plafonne: true,
  });

  // Retraite complementaire T2
  if (tranche2 > 0) {
    patronales.push({
      code: 'AGIRC_ARRCO_T2',
      libelle: 'Retraite complementaire T2',
      base: tranche2,
      taux: TAUX_2026.patronales.retraite_t2.taux,
      montant: Math.round(tranche2 * TAUX_2026.patronales.retraite_t2.taux / 100),
      plafonne: true,
    });
  }

  // CEG T1
  patronales.push({
    code: 'CEG_T1',
    libelle: 'CEG Tranche 1',
    base: tranche1,
    taux: TAUX_2026.patronales.ceg_t1.taux,
    montant: Math.round(tranche1 * TAUX_2026.patronales.ceg_t1.taux / 100),
    plafonne: true,
  });

  // CEG T2
  if (tranche2 > 0) {
    patronales.push({
      code: 'CEG_T2',
      libelle: 'CEG Tranche 2',
      base: tranche2,
      taux: TAUX_2026.patronales.ceg_t2.taux,
      montant: Math.round(tranche2 * TAUX_2026.patronales.ceg_t2.taux / 100),
      plafonne: true,
    });
  }

  // Formation professionnelle
  const tauxFormation = effectif >= 11 ? TAUX_2026.patronales.formation.taux_11_plus : TAUX_2026.patronales.formation.taux;
  patronales.push({
    code: 'FORMATION',
    libelle: 'Formation professionnelle',
    base: brut,
    taux: tauxFormation,
    montant: Math.round(brut * tauxFormation / 100),
    plafonne: false,
  });

  // Taxe apprentissage
  patronales.push({
    code: 'TAXE_APPRENTISSAGE',
    libelle: 'Taxe d\'apprentissage',
    base: brut,
    taux: TAUX_2026.patronales.taxe_apprentissage.taux,
    montant: Math.round(brut * TAUX_2026.patronales.taxe_apprentissage.taux / 100),
    plafonne: false,
  });

  // Dialogue social
  patronales.push({
    code: 'DIALOGUE_SOCIAL',
    libelle: 'Contribution dialogue social',
    base: brut,
    taux: TAUX_2026.patronales.dialogue_social.taux,
    montant: Math.round(brut * TAUX_2026.patronales.dialogue_social.taux / 100),
    plafonne: false,
  });

  const totalSalarial = salariales.reduce((sum, c) => sum + c.montant, 0);
  const totalPatronal = patronales.reduce((sum, c) => sum + c.montant, 0);

  return {
    salariales,
    patronales,
    totalSalarial,
    totalPatronal,
    tranches: { tranche1, tranche2 },
    baseCSG,
  };
}

// ============================================
// REDUCTION FILLON
// ============================================

/**
 * Calcule la reduction generale de cotisations patronales (ex-Fillon)
 * Applicable si brut < 1.6 SMIC
 * @param {number} brutMensuel - Brut mensuel en centimes
 * @param {number} smicMensuel - SMIC mensuel en centimes
 * @param {number} effectif - Effectif entreprise
 * @returns {{ eligible: boolean, coefficient: number, montant: number }}
 */
export function calculateReductionFillon(brutMensuel, smicMensuel = TAUX_2026.smic_mensuel, effectif = 10) {
  // La reduction s'applique si le salaire est < 1.6 SMIC
  const seuil = smicMensuel * 1.6;
  if (brutMensuel >= seuil || brutMensuel <= 0) {
    return { eligible: false, coefficient: 0, montant: 0 };
  }

  // Valeur T (parametre selon effectif)
  // < 50 salaries: T = 0.3194 (2026)
  // >= 50 salaries: T = 0.3234 (FNAL majore)
  const T = effectif >= 50 ? 0.3234 : 0.3194;

  // Coefficient C = (T / 0.6) * ((1.6 * SMIC / brut) - 1)
  let C = (T / 0.6) * ((1.6 * smicMensuel / brutMensuel) - 1);

  // C est plafonne a T
  C = Math.min(C, T);
  C = Math.max(C, 0);

  // Arrondir a 4 decimales
  C = Math.round(C * 10000) / 10000;

  const montant = Math.round(brutMensuel * C);

  return { eligible: true, coefficient: C, montant };
}

// ============================================
// PRELEVEMENT A LA SOURCE (PAS)
// ============================================

/**
 * Calcule le prelevement a la source
 * @param {number} netImposable - Net imposable mensuel en centimes
 * @param {number} tauxPAS - Taux PAS en % (ex: 7.5)
 * @param {Object} cumuls - Cumuls pour regularisation
 * @returns {{ montant: number, taux: number }}
 */
export function calculatePAS(netImposable, tauxPAS = 0, cumuls = {}) {
  if (!tauxPAS || tauxPAS <= 0) {
    return { montant: 0, taux: 0 };
  }

  const montant = Math.round(netImposable * tauxPAS / 100);

  return { montant, taux: tauxPAS };
}

// ============================================
// CALCUL NET
// ============================================

/**
 * Calcule le net social, net imposable et net a payer
 * @param {number} brut
 * @param {Object} cotisations - Resultat de calculateCotisations
 * @param {number} tauxPAS
 * @returns {Object}
 */
function calculateNets(brut, cotisations, tauxPAS = 0) {
  const { totalSalarial, salariales } = cotisations;

  // Net social = brut - total cotisations salariales
  const netSocial = brut - totalSalarial;

  // Net imposable = brut - cotisations salariales deductibles
  // (toutes sauf CSG non deductible et CRDS)
  const csgNonDed = salariales.find(c => c.code === 'CSG_NON_DED')?.montant || 0;
  const crds = salariales.find(c => c.code === 'CRDS')?.montant || 0;
  const netImposable = brut - totalSalarial + csgNonDed + crds;

  // PAS
  const pas = calculatePAS(netImposable, tauxPAS);

  // Net a payer = net social - PAS
  // (net social car le net imposable sert au calcul PAS mais le net verse = brut - cotis salariales - PAS)
  const netAPayer = netSocial - pas.montant;

  return {
    netSocial,
    netImposable,
    pas,
    netAPayer,
  };
}

// ============================================
// CALCUL COMPLET PAIE
// ============================================

/**
 * Fonction principale: calcule la paie complete d'un employe pour un mois
 * @param {string} tenantId
 * @param {string} membreId
 * @param {string} periode - Format YYYY-MM
 * @param {Object} options - heures_supp, primes, convention, etc.
 * @returns {Object} Bulletin complet
 */
export async function calculatePayroll(tenantId, membreId, periode, options = {}) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!membreId) throw new Error('membre_id requis');
  if (!periode) throw new Error('periode requis');

  // Recuperer le membre
  const { data: membre, error: mErr } = await supabase
    .from('rh_membres')
    .select('*')
    .eq('id', membreId)
    .eq('tenant_id', tenantId)
    .single();

  if (mErr || !membre) throw new Error('Employe non trouve');

  // Recuperer parametres paie tenant
  const { data: parametres } = await supabase
    .from('rh_parametres_paie')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  // Recuperer heures supplementaires du mois
  const { data: heuresSupp } = await supabase
    .from('rh_heures_supp_mensuel')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('membre_id', membreId)
    .eq('periode', periode)
    .maybeSingle();

  // Recuperer cumuls annuels anterieurs
  const cumulsAnnuels = await getCumulsMensuels(tenantId, membreId, periode);

  // Numero du mois
  const moisEcoule = parseInt(periode.split('-')[1]);

  // Effectif pour les seuils
  const { count: effectifCount } = await supabase
    .from('rh_membres')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('statut', 'actif');
  const effectif = effectifCount || 1;

  // Primes (manuelles + convention)
  const primes = options.primes || [];

  // 1. Calcul brut
  const brutDetail = calculateBrut(
    membre,
    heuresSupp || options.heures_supp || {},
    primes
  );

  // 2. Calcul cotisations
  const cotisations = calculateCotisations(
    brutDetail.totalBrut,
    membre,
    parametres || {},
    cumulsAnnuels,
    { effectif, moisEcoule }
  );

  // 3. Reduction Fillon
  const fillon = calculateReductionFillon(brutDetail.totalBrut, TAUX_2026.smic_mensuel, effectif);

  // 4. Calcul nets
  const tauxPAS = membre.taux_ir || parametres?.taux_ir_defaut || 0;
  const nets = calculateNets(brutDetail.totalBrut, cotisations, tauxPAS);

  // 5. Cumuls annuels mis a jour
  const newCumuls = {
    brut: (cumulsAnnuels.brut || 0) + brutDetail.totalBrut,
    netImposable: (cumulsAnnuels.netImposable || 0) + nets.netImposable,
    pas: (cumulsAnnuels.pas || 0) + nets.pas.montant,
    cotisationsSalariales: (cumulsAnnuels.cotisationsSalariales || 0) + cotisations.totalSalarial,
    cotisationsPatronales: (cumulsAnnuels.cotisationsPatronales || 0) + cotisations.totalPatronal,
  };

  // 6. Conges payes
  const annee = parseInt(periode.split('-')[0]);
  const { data: compteur } = await supabase
    .from('rh_compteurs_conges')
    .select('cp_acquis, cp_pris')
    .eq('tenant_id', tenantId)
    .eq('membre_id', membreId)
    .eq('annee', annee)
    .maybeSingle();

  // 7. Anciennete
  const dateEmbauche = new Date(membre.date_embauche);
  const datePeriode = new Date(periode + '-01');
  const ancienneteMois = Math.floor((datePeriode - dateEmbauche) / (1000 * 60 * 60 * 24 * 30.44));

  return {
    // Identite
    tenantId,
    membreId,
    periode,
    membre: {
      nom: membre.nom,
      prenom: membre.prenom,
      nir: membre.nir,
      poste: membre.poste || membre.role,
      classification: membre.classification_niveau,
      type_contrat: membre.type_contrat,
      date_embauche: membre.date_embauche,
      adresse: [membre.adresse_rue, membre.adresse_cp, membre.adresse_ville].filter(Boolean).join(', '),
    },
    ancienneteMois,

    // Brut
    brut: brutDetail,

    // Cotisations
    cotisations,

    // Reduction Fillon
    reductionFillon: fillon,

    // Nets
    netSocial: nets.netSocial,
    netImposable: nets.netImposable,
    pas: nets.pas,
    netAPayer: nets.netAPayer,

    // Cumuls
    cumuls: newCumuls,

    // Conges
    conges: {
      acquis: compteur?.cp_acquis || 0,
      pris: compteur?.cp_pris || 0,
      solde: (compteur?.cp_acquis || 0) - (compteur?.cp_pris || 0),
    },

    // Cout employeur
    coutEmployeur: brutDetail.totalBrut + cotisations.totalPatronal - fillon.montant,
  };
}

// ============================================
// CUMULS MENSUELS
// ============================================

/**
 * Recupere les cumuls annuels anterieurs au mois donne
 */
async function getCumulsMensuels(tenantId, membreId, periode) {
  const [year] = periode.split('-');
  const anneeDebut = `${year}-01`;

  // Recuperer tous les bulletins anterieurs de l'annee
  const { data: bulletins } = await supabase
    .from('rh_bulletins_paie')
    .select('brut_total, net_imposable, montant_ir, total_cotisations_salariales, total_cotisations_patronales, cumuls')
    .eq('tenant_id', tenantId)
    .eq('membre_id', membreId)
    .gte('periode', anneeDebut)
    .lt('periode', periode)
    .order('periode');

  if (!bulletins || bulletins.length === 0) {
    return { brut: 0, netImposable: 0, pas: 0, cotisationsSalariales: 0, cotisationsPatronales: 0 };
  }

  // Si le dernier bulletin a des cumuls stockes, on les utilise
  const dernierBulletin = bulletins[bulletins.length - 1];
  if (dernierBulletin.cumuls && Object.keys(dernierBulletin.cumuls).length > 0) {
    return dernierBulletin.cumuls;
  }

  // Sinon recalculer depuis les bulletins
  return bulletins.reduce((acc, b) => ({
    brut: acc.brut + (b.brut_total || 0),
    netImposable: acc.netImposable + (b.net_imposable || 0),
    pas: acc.pas + (b.montant_ir || 0),
    cotisationsSalariales: acc.cotisationsSalariales + (b.total_cotisations_salariales || 0),
    cotisationsPatronales: acc.cotisationsPatronales + (b.total_cotisations_patronales || 0),
  }), { brut: 0, netImposable: 0, pas: 0, cotisationsSalariales: 0, cotisationsPatronales: 0 });
}

/**
 * Met a jour les cumuls mensuels dans le bulletin
 */
export async function updateCumulsMensuels(tenantId, membreId, periode, cumuls) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { error } = await supabase
    .from('rh_bulletins_paie')
    .update({ cumuls, updated_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .eq('membre_id', membreId)
    .eq('periode', periode);

  if (error) throw error;
  return cumuls;
}

/**
 * Convertit le resultat calculatePayroll en format bulletin DB
 */
export function payrollToBulletinData(payroll) {
  const p = payroll;

  // Convertir cotisations au format existant DB
  const cotisationsSalariales = p.cotisations.salariales.map(c => ({
    nom: c.libelle,
    code: c.code,
    base: c.base,
    taux: c.taux,
    montant: c.montant,
    plafonne: c.plafonne,
  }));

  const cotisationsPatronales = p.cotisations.patronales.map(c => ({
    nom: c.libelle,
    code: c.code,
    base: c.base,
    taux: c.taux,
    montant: c.montant,
    plafonne: c.plafonne,
  }));

  return {
    tenant_id: p.tenantId,
    membre_id: p.membreId,
    periode: p.periode,
    employe_nom: p.membre.nom,
    employe_prenom: p.membre.prenom,
    employe_nir: p.membre.nir,
    employe_adresse: p.membre.adresse,
    employe_poste: p.membre.poste,
    employe_classification: p.membre.classification,
    type_contrat: p.membre.type_contrat,
    date_embauche: p.membre.date_embauche,
    anciennete_mois: p.ancienneteMois,
    salaire_base: p.brut.salaireBase,
    heures_normales: p.brut.heuresNormales,
    heures_supp_25: p.brut.heuresSupp25,
    montant_hs_25: p.brut.montantHS25,
    heures_supp_50: p.brut.heuresSupp50,
    montant_hs_50: p.brut.montantHS50,
    primes: p.brut.primes,
    brut_total: p.brut.totalBrut,
    cotisations_salariales: cotisationsSalariales,
    cotisations_patronales: cotisationsPatronales,
    total_cotisations_salariales: p.cotisations.totalSalarial,
    total_cotisations_patronales: p.cotisations.totalPatronal,
    net_social: p.netSocial,
    net_avant_ir: p.netSocial,
    taux_ir: p.pas.taux,
    montant_ir: p.pas.montant,
    net_a_payer: p.netAPayer,
    net_imposable: p.netImposable,
    reduction_fillon: p.reductionFillon.montant,
    cumul_brut: p.cumuls.brut,
    cumul_net_imposable: p.cumuls.netImposable,
    cumul_ir: p.cumuls.pas,
    cumuls: p.cumuls,
    cp_acquis: p.conges.acquis,
    cp_pris: p.conges.pris,
    cp_solde: p.conges.solde,
    statut: 'brouillon',
    updated_at: new Date().toISOString(),
  };
}

export default {
  TAUX_2026,
  calculateTranchesPMSS,
  calculateBrut,
  calculateCotisations,
  calculateReductionFillon,
  calculatePAS,
  calculatePayroll,
  updateCumulsMensuels,
  payrollToBulletinData,
};
