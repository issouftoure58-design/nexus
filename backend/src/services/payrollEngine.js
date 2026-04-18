/**
 * Moteur de calcul paie production-ready
 * Gestion des tranches PMSS, reduction Fillon, PAS, cumuls annuels
 * Primes mensuelles, absences maladie/AT/maternite
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
// CONSTANTES ABSENCES / IJSS 2026
// ============================================

export const ABSENCE_CONFIG = {
  maladie: {
    label: 'Maladie',
    carenceSS: 3,             // 3 jours avant versement IJSS
    carenceEmployeur: 7,       // 7 jours avant complement
    ijssTaux: 0.50,           // 50% du SJB
    ijssMaxJour: 4195,        // 41,95€/jour max en centimes
    ancienneteMinComplement: 12, // 1 an = 12 mois
  },
  accident_travail: {
    label: 'Accident du travail',
    carenceSS: 0,             // Pas de carence
    carenceEmployeur: 0,       // Pas de carence
    ijssTauxJ1_28: 0.60,     // 60% J1-J28
    ijssTauxJ29plus: 0.80,   // 80% J29+
    ijssMaxJ1_28: 24049,     // 240,49€/jour
    ijssMaxJ29plus: 32066,   // 320,66€/jour
    ancienneteMinComplement: 0, // Pas de condition
    jourAccidentPayeEmployeur: true,
  },
  maladie_pro: {
    label: 'Maladie professionnelle',
    carenceSS: 0,
    carenceEmployeur: 0,
    ijssTauxJ1_28: 0.60,
    ijssTauxJ29plus: 0.80,
    ijssMaxJ1_28: 24049,
    ijssMaxJ29plus: 32066,
    ancienneteMinComplement: 0,
    jourAccidentPayeEmployeur: false,
  },
  maternite: {
    label: 'Maternite',
    carenceSS: 0,
    carenceEmployeur: 0,
    ijssTaux: 0.79,           // ~79% du SJB (apres abattement 21%)
    ijssMaxJour: 10402,       // 104,02€/jour
    ancienneteMinComplement: 0,
    complementLegal: false,    // Pas de maintien legal (verifier convention)
  },
  paternite: {
    label: 'Paternite',
    carenceSS: 0,
    carenceEmployeur: 0,
    ijssTaux: 0.79,
    ijssMaxJour: 10402,
    ancienneteMinComplement: 0,
    complementLegal: false,
  },
  conge_sans_solde: {
    label: 'Conge sans solde',
    carenceSS: 0,
    carenceEmployeur: 0,
    ijssTaux: 0,
    ijssMaxJour: 0,
    ancienneteMinComplement: 9999, // Pas de complement
    complementLegal: false,
  },
  formation: {
    label: 'Formation (CPF)',
    carenceSS: 0,
    carenceEmployeur: 0,
    ijssTaux: 0,           // Pas d'IJSS, finance par OPCO/CPF
    ijssMaxJour: 0,
    ancienneteMinComplement: 0,
    complementLegal: true,   // Maintien salaire pendant formation
  },
  // CSG/CRDS sur IJSS (taux specifiques revenus de remplacement)
  csgDeductibleIJSS: 3.80,   // 3,80%
  csgNonDeductibleIJSS: 2.40, // 2,40%
  crdsIJSS: 0.50,            // 0,50%
};

// Bareme maintien employeur (jours calendaires) — Article D1226-1 Code du travail
const BAREME_MAINTIEN = [
  { min: 12, max: 60,  jours90: 30, jours66: 30 },  // 1-5 ans
  { min: 61, max: 120, jours90: 40, jours66: 40 },  // 6-10 ans
  { min: 121, max: 180, jours90: 50, jours66: 50 }, // 11-15 ans
  { min: 181, max: 240, jours90: 60, jours66: 60 }, // 16-20 ans
  { min: 241, max: 300, jours90: 70, jours66: 70 }, // 21-25 ans
  { min: 301, max: 360, jours90: 80, jours66: 80 }, // 26-30 ans
  { min: 361, max: 9999, jours90: 90, jours66: 90 }, // 31+ ans
];

// ============================================
// PRIMES PREDEFINIES (codes standards)
// ============================================

export const PRIMES_TYPES = {
  PANIER: { nom: 'Prime panier / Titre-restaurant', exonere: true, parJourTravaille: true, plafondExo: 732 },
  TRANSPORT: { nom: 'Prime transport', exonere: true, parJourTravaille: false, plafondExo: 5000 },
  ANCIENNETE: { nom: "Prime d'anciennete", exonere: false, parJourTravaille: false, typeCalcul: 'pourcentage' },
  EXCEPTIONNELLE: { nom: 'Prime exceptionnelle', exonere: false, parJourTravaille: false },
  VACANCES: { nom: 'Prime de vacances', exonere: false, parJourTravaille: false },
  TREIZIEME_MOIS: { nom: '13eme mois', exonere: false, parJourTravaille: false },
  ASSIDUITE: { nom: "Prime d'assiduite", exonere: false, parJourTravaille: false },
  NUIT: { nom: 'Majoration nuit', exonere: false, parJourTravaille: false },
  DIMANCHE: { nom: 'Majoration dimanche', exonere: false, parJourTravaille: false },
  FERIE: { nom: 'Majoration jour ferie', exonere: false, parJourTravaille: false },
  HABILLAGE: { nom: 'Prime habillage/deshabillage', exonere: false, parJourTravaille: false },
  SALISSURE: { nom: 'Prime de salissure', exonere: true, parJourTravaille: false },
  TELETRAVAIL: { nom: 'Indemnite teletravail', exonere: true, parJourTravaille: true, plafondExo: 250 },
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
/**
 * Calcule le prorata pour un mois partiel (entree ou sortie en cours de mois)
 * @param {string} periode - Format YYYY-MM
 * @param {string|null} dateEmbauche - Date d'embauche ISO
 * @param {string|null} dateFinContrat - Date de fin de contrat ISO
 * @returns {{ ratio: number, joursTravailes: number, joursMois: number, premierJour: number, dernierJour: number }}
 */
export function calculateProrata(periode, dateEmbauche, dateFinContrat) {
  const [year, month] = periode.split('-').map(Number);
  const joursMois = new Date(year, month, 0).getDate();
  let premierJour = 1;
  let dernierJour = joursMois;

  // Si embauche dans ce mois
  if (dateEmbauche) {
    const d = new Date(dateEmbauche);
    if (d.getFullYear() === year && (d.getMonth() + 1) === month) {
      premierJour = d.getDate();
    } else if (d > new Date(year, month - 1, joursMois)) {
      // Embauche apres ce mois — pas encore employe
      return { ratio: 0, joursTravailes: 0, joursMois, premierJour: 0, dernierJour: 0 };
    }
  }

  // Si fin de contrat dans ce mois
  if (dateFinContrat) {
    const d = new Date(dateFinContrat);
    if (d.getFullYear() === year && (d.getMonth() + 1) === month) {
      dernierJour = d.getDate();
    } else if (d < new Date(year, month - 1, 1)) {
      // Contrat fini avant ce mois — ne doit pas etre paye
      return { ratio: 0, joursTravailes: 0, joursMois, premierJour: 0, dernierJour: 0 };
    }
  }

  const joursTravailes = Math.max(0, dernierJour - premierJour + 1);
  const ratio = joursTravailes / joursMois;

  return { ratio, joursTravailes, joursMois, premierJour, dernierJour };
}

/**
 * Verifie si un membre est concerne par une periode de paie
 */
export function isMembreDansPeriode(membre, periode) {
  const [year, month] = periode.split('-').map(Number);
  const debutMois = new Date(year, month - 1, 1);
  const finMois = new Date(year, month, 0);

  // Embauche apres la fin du mois → pas concerne
  if (membre.date_embauche) {
    const embauche = new Date(membre.date_embauche);
    if (embauche > finMois) return false;
  }

  // Fin de contrat avant le debut du mois → pas concerne
  if (membre.date_fin_contrat) {
    const finContrat = new Date(membre.date_fin_contrat);
    if (finContrat < debutMois) return false;
  }

  return true;
}

// ============================================
// CALCUL ABSENCES (Maladie, AT, Maternite)
// ============================================

/**
 * Retourne les durees de maintien employeur selon l'anciennete
 */
function getMaintenanceDurations(ancienneteMois) {
  for (const b of BAREME_MAINTIEN) {
    if (ancienneteMois >= b.min && ancienneteMois <= b.max) {
      return { jours90: b.jours90, jours66: b.jours66 };
    }
  }
  return { jours90: 0, jours66: 0 };
}

/**
 * Calcule la retenue pour absence et les IJSS/complement
 * @param {Object} params
 * @param {string} params.type - 'maladie', 'accident_travail', 'maladie_pro', 'maternite', 'paternite'
 * @param {number} params.joursAbsence - Nombre de jours calendaires d'absence
 * @param {number} params.salaireMensuel - Salaire brut mensuel en centimes
 * @param {number} params.ancienneteMois - Anciennete en mois
 * @param {boolean} params.subrogation - Si l'employeur subroge les IJSS (defaut true)
 * @returns {Object} Detail de l'absence
 */
/**
 * Calcule les montants d'une absence (retenue, IJSS, complement employeur)
 * @param {Object} params
 * @param {string} params.type - Type d'absence (maladie, accident_travail, etc.)
 * @param {number} params.joursAbsence - Nombre de jours calendaires d'absence
 * @param {number} params.salaireMensuel - Salaire mensuel brut en centimes
 * @param {number} params.ancienneteMois - Anciennete en mois
 * @param {boolean} params.subrogation - Subrogation employeur (defaut: true)
 * @param {string} params.categorie - Categorie socioprofessionnelle (cadre, employe, etc.)
 */
export function calculateAbsence({ type, joursAbsence, salaireMensuel, ancienneteMois, subrogation = true, categorie = '' }) {
  if (!joursAbsence || joursAbsence <= 0) {
    return { retenue: 0, ijssBrutes: 0, ijssNettes: 0, complementEmployeur: 0, joursAbsence: 0, detail: null };
  }

  const config = ABSENCE_CONFIG[type] || ABSENCE_CONFIG.maladie;
  const isCadre = categorie === 'cadre' || categorie === 'agent_maitrise';

  // 1. Retenue sur salaire (methode du 30eme)
  const retenue = Math.round((salaireMensuel / 30) * joursAbsence);

  // 2. Calcul IJSS
  // SJB = salaire 3 derniers mois / 91.25 (on approxime avec salaire mensuel * 3 / 91.25)
  const sjb = Math.round((salaireMensuel * 3) / 91.25);
  let ijssBrutesJour = 0;
  let totalIJSSBrutes = 0;

  if (type === 'accident_travail' || type === 'maladie_pro') {
    // AT/MP: 60% J1-28, 80% J29+
    const joursIndemnises = joursAbsence - config.carenceSS;
    if (joursIndemnises > 0) {
      const joursPhase1 = Math.min(joursIndemnises, 28);
      const joursPhase2 = Math.max(0, joursIndemnises - 28);
      const ijssJ1 = Math.min(Math.round(sjb * config.ijssTauxJ1_28), config.ijssMaxJ1_28);
      const ijssJ2 = Math.min(Math.round(sjb * config.ijssTauxJ29plus), config.ijssMaxJ29plus);
      totalIJSSBrutes = (ijssJ1 * joursPhase1) + (ijssJ2 * joursPhase2);
      ijssBrutesJour = joursPhase1 > 0 ? ijssJ1 : ijssJ2;
    }
  } else {
    // Maladie / Maternite / Paternite: taux fixe
    const taux = config.ijssTaux || 0.50;
    const max = config.ijssMaxJour || 4195;
    ijssBrutesJour = Math.min(Math.round(sjb * taux), max);
    const joursIndemnises = Math.max(0, joursAbsence - (config.carenceSS || 0));
    totalIJSSBrutes = ijssBrutesJour * joursIndemnises;
  }

  // 3. CSG/CRDS sur IJSS (6,70% total)
  const csgCrdsIJSS = Math.round(totalIJSSBrutes * (ABSENCE_CONFIG.csgDeductibleIJSS + ABSENCE_CONFIG.csgNonDeductibleIJSS + ABSENCE_CONFIG.crdsIJSS) / 100);
  const ijssNettes = totalIJSSBrutes - csgCrdsIJSS;

  // 4. Complement employeur (maintien de salaire)
  // Convention collective cadres: maintien a 100% sans carence (selon CCN applicable)
  // Non-cadres: maintien legal Article D1226-1 Code du travail (90% puis 66,66%)
  let complementEmployeur = 0;
  const complementLegal = config.complementLegal !== false; // true par defaut (maladie, AT)
  // Maternite/paternite: complement uniquement si convention le prevoit
  const isCongeParental = type === 'maternite' || type === 'paternite';

  // Cadres: complement pour maternite/paternite aussi (100% du salaire garanti par convention)
  const forceComplement = isCadre && isCongeParental;

  if ((complementLegal || forceComplement) && ancienneteMois >= (config.ancienneteMinComplement || 0)) {
    if (isCadre) {
      // Convention cadres: maintien a 100% sans carence employeur
      // Duree selon anciennete mais sans carence
      const { jours90, jours66 } = getMaintenanceDurations(ancienneteMois);
      const totalJoursMaintien = jours90 + jours66;
      const joursIndemnisables = Math.min(joursAbsence, totalJoursMaintien);

      // Maintien 100% pour cadres
      const objectif100 = Math.round(salaireMensuel / 30 * joursIndemnisables);
      const joursIndemnisesSS = Math.max(0, joursIndemnisables - (config.carenceSS || 0));
      const ijssPeriode = ijssBrutesJour * joursIndemnisesSS;
      complementEmployeur = Math.max(0, objectif100 - ijssPeriode);
    } else {
      // Non-cadres: maintien legal 90% puis 66,66%
      const { jours90, jours66 } = getMaintenanceDurations(ancienneteMois);
      const carenceComp = config.carenceEmployeur || 0;
      const joursIndemnisables = Math.max(0, joursAbsence - carenceComp);

      // Periode 1 : maintien a 90%
      const j90 = Math.min(joursIndemnisables, jours90);
      if (j90 > 0) {
        const objectif90 = Math.round(salaireMensuel * 0.90 / 30 * j90);
        const ijssPeriode = ijssBrutesJour * Math.min(j90, Math.max(0, joursAbsence - (config.carenceSS || 0)));
        complementEmployeur += Math.max(0, objectif90 - ijssPeriode);
      }

      // Periode 2 : maintien a 66,66%
      const joursRestants = Math.max(0, joursIndemnisables - jours90);
      const j66 = Math.min(joursRestants, jours66);
      if (j66 > 0) {
        const objectif66 = Math.round(salaireMensuel * 0.6666 / 30 * j66);
        const ijssPeriode = ijssBrutesJour * j66;
        complementEmployeur += Math.max(0, objectif66 - ijssPeriode);
      }
    }
  }

  return {
    type,
    label: config.label,
    joursAbsence,
    retenue,
    ijssBrutes: totalIJSSBrutes,
    ijssNettes,
    csgCrdsIJSS,
    ijssBrutesJour,
    complementEmployeur,
    subrogation,
    categorie: isCadre ? 'cadre' : 'non-cadre',
    detail: {
      sjb,
      carenceSS: config.carenceSS || 0,
      carenceEmployeur: isCadre ? 0 : (config.carenceEmployeur || 0),
    },
  };
}

// ============================================
// CALCUL PRIMES AUTOMATIQUES
// ============================================

/**
 * Calcule les primes mensuelles d'un employe a partir de sa config
 * @param {Array} primesConfig - Config primes du membre (rh_membres.primes_mensuelles)
 * @param {Object} membre - Donnees employe
 * @param {number} joursOuvres - Jours ouvres du mois (pour primes par jour)
 * @param {number} joursAbsence - Jours d'absence (pour deduire paniers repas)
 * @param {number} ancienneteMois - Anciennete en mois
 * @returns {Array} Primes calculees [{code, nom, montant, exonere}]
 */
export function calculatePrimes(primesConfig = [], membre = {}, joursOuvres = 22, joursAbsence = 0, ancienneteMois = 0) {
  const primes = [];

  for (const p of primesConfig) {
    if (!p.code || (!p.montant && p.type !== 'pourcentage')) continue;

    let montant = 0;
    const config = PRIMES_TYPES[p.code] || {};

    if (p.type === 'pourcentage' || config.typeCalcul === 'pourcentage') {
      // Prime en % du salaire de base (ex: anciennete)
      const taux = p.taux || 0;
      montant = Math.round((membre.salaire_mensuel || 0) * taux / 100);
    } else if (config.parJourTravaille || p.par_jour_travaille) {
      // Prime par jour travaille (ex: panier repas, teletravail)
      const joursEffectifs = Math.max(0, joursOuvres - joursAbsence);
      montant = (p.montant || 0) * joursEffectifs;
    } else {
      // Forfait mensuel
      montant = p.montant || 0;
    }

    if (montant > 0) {
      primes.push({
        code: p.code,
        nom: p.nom || config.nom || p.code,
        montant,
        exonere: p.exonere !== undefined ? p.exonere : (config.exonere || false),
      });
    }
  }

  return primes;
}

// ============================================
// CALCUL BRUT
// ============================================

export function calculateBrut(membre, pointage = {}, primes = [], convention = null, prorata = null, absenceData = null) {
  const salaireComplet = membre.salaire_mensuel || 0;
  const heuresNormales = membre.heures_mensuelles || 151.67;
  const tauxHoraire = Math.round(salaireComplet / heuresNormales);

  // Prorata si mois partiel (entree/sortie en cours de mois)
  const ratio = prorata?.ratio ?? 1;
  const salaireBase = ratio < 1 ? Math.round(salaireComplet * ratio) : salaireComplet;

  // Heures supplementaires
  const hs25 = pointage.heures_25 || 0;
  const hs50 = pointage.heures_50 || 0;
  const montantHS25 = pointage.montant_25 || Math.round(hs25 * tauxHoraire * 1.25);
  const montantHS50 = pointage.montant_50 || Math.round(hs50 * tauxHoraire * 1.50);

  // Primes: separer soumises et exonerees
  const primesExonerees = primes.filter(p => p.exonere);
  const primesSoumises = primes.filter(p => !p.exonere);
  const totalPrimesExonerees = primesExonerees.reduce((sum, p) => sum + (p.montant || 0), 0);
  const totalPrimesSoumises = primesSoumises.reduce((sum, p) => sum + (p.montant || 0), 0);
  const totalPrimes = totalPrimesExonerees + totalPrimesSoumises;

  // Retenue absence (si applicable)
  const retenueAbsence = absenceData?.retenue || 0;
  // Complement employeur (soumis aux cotisations)
  const complementEmployeur = absenceData?.complementEmployeur || 0;

  // Brut soumis aux cotisations = base + HS + primes soumises + complement - retenue
  const brutSoumis = Math.max(0, salaireBase + montantHS25 + montantHS50 + totalPrimesSoumises + complementEmployeur - retenueAbsence);
  // Total brut (pour affichage) = brutSoumis + primes exonerees
  const totalBrut = brutSoumis + totalPrimesExonerees;

  return {
    salaireBase,
    salaireComplet,
    heuresNormales,
    tauxHoraire,
    prorata: ratio < 1 ? prorata : null,
    heuresSupp25: hs25,
    heuresSupp50: hs50,
    montantHS25,
    montantHS50,
    primes,
    primesExonerees,
    primesSoumises,
    totalPrimes,
    totalPrimesExonerees,
    totalPrimesSoumises,
    retenueAbsence,
    complementEmployeur,
    brutSoumis,      // Base pour cotisations
    totalBrut,       // Total affiche sur bulletin
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

  // APEC (cadres uniquement)
  const isCadre = membre.categorie_sociopro === 'cadre' || membre.categorie_sociopro === 'agent_maitrise';
  if (isCadre) {
    // APEC salarial: 0.024% sur brut
    salariales.push({
      code: 'APEC',
      libelle: 'APEC (cadres)',
      base: brut,
      taux: 0.024,
      montant: Math.round(brut * 0.024 / 100),
      plafonne: false,
    });

    // APEC patronal: 0.036% sur brut
    patronales.push({
      code: 'APEC',
      libelle: 'APEC (cadres)',
      base: brut,
      taux: 0.036,
      montant: Math.round(brut * 0.036 / 100),
      plafonne: false,
    });

    // Prevoyance cadres obligatoire: 1,50% T1 (minimum)
    // Part patronale minimum: 1,50% T1
    patronales.push({
      code: 'PREVOYANCE_CADRE',
      libelle: 'Prevoyance cadres (1,50% min.)',
      base: tranche1,
      taux: 1.50,
      montant: Math.round(tranche1 * 1.50 / 100),
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

  // Prorata si mois partiel
  const prorata = calculateProrata(periode, membre.date_embauche, membre.date_fin_contrat);

  if (prorata.ratio === 0) {
    throw new Error(`L'employe n'est pas concerne par la periode ${periode}`);
  }

  // Derniere paie ?
  const isDernierePaie = membre.date_fin_contrat && (() => {
    const [y, m] = periode.split('-').map(Number);
    const fin = new Date(membre.date_fin_contrat);
    return fin.getFullYear() === y && (fin.getMonth() + 1) === m;
  })();

  // Anciennete (calculee tot pour les primes et absences)
  const dateEmbauche = new Date(membre.date_embauche);
  const datePeriode = new Date(periode + '-01');
  const ancienneteMois = Math.floor((datePeriode - dateEmbauche) / (1000 * 60 * 60 * 24 * 30.44));

  // Primes: auto-load from membre config + manuelles
  const primesConfig = membre.primes_mensuelles || [];
  const joursOuvresMois = getJoursOuvres(periode);
  const joursAbsenceTotal = (options.absences || []).reduce((sum, a) => sum + (a.jours || 0), 0);
  const primesAuto = calculatePrimes(primesConfig, membre, joursOuvresMois, joursAbsenceTotal, ancienneteMois);
  const primesManuelles = options.primes || [];
  const primes = [...primesAuto, ...primesManuelles];

  // Absences (maladie, AT, maternite, etc.)
  const absencesInput = options.absences || [];
  const categorie = membre.categorie_sociopro || '';
  const absencesDetail = absencesInput.map(a => calculateAbsence({
    type: a.type || 'maladie',
    joursAbsence: a.jours || 0,
    salaireMensuel: membre.salaire_mensuel || 0,
    ancienneteMois,
    subrogation: a.subrogation !== false,
    categorie,
  }));
  // Agreger les absences
  const absenceAgregee = {
    retenue: absencesDetail.reduce((s, a) => s + a.retenue, 0),
    complementEmployeur: absencesDetail.reduce((s, a) => s + a.complementEmployeur, 0),
    ijssBrutes: absencesDetail.reduce((s, a) => s + a.ijssBrutes, 0),
    ijssNettes: absencesDetail.reduce((s, a) => s + a.ijssNettes, 0),
    csgCrdsIJSS: absencesDetail.reduce((s, a) => s + a.csgCrdsIJSS, 0),
    joursTotal: absencesDetail.reduce((s, a) => s + a.joursAbsence, 0),
  };

  // 1. Calcul brut (avec prorata + absences)
  const brutDetail = calculateBrut(
    membre,
    heuresSupp || options.heures_supp || {},
    primes,
    null,
    prorata,
    absenceAgregee
  );

  // 2. Calcul cotisations (sur brut soumis uniquement, IJSS exclues)
  const cotisations = calculateCotisations(
    brutDetail.brutSoumis,
    membre,
    parametres || {},
    cumulsAnnuels,
    { effectif, moisEcoule }
  );

  // 3. Reduction Fillon
  const fillon = calculateReductionFillon(brutDetail.totalBrut, TAUX_2026.smic_mensuel, effectif);

  // 4. Calcul nets (IJSS subrogees ajoutees au net a payer)
  const tauxPAS = membre.taux_ir || parametres?.taux_ir_defaut || 0;
  const nets = calculateNets(brutDetail.brutSoumis, cotisations, tauxPAS);
  // Ajouter IJSS nettes au net a payer si subrogation
  const hasSubrogation = absencesDetail.some(a => a.subrogation);
  if (hasSubrogation && absenceAgregee.ijssNettes > 0) {
    nets.netAPayer += absenceAgregee.ijssNettes;
  }
  // Ajouter primes exonerees au net (elles n'ont pas de cotisations)
  nets.netAPayer += brutDetail.totalPrimesExonerees;

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

  // 7. Solde de tout compte (si derniere paie)
  let soldeToutCompte = null;
  if (isDernierePaie) {
    const cpSolde = (compteur?.cp_acquis || 0) - (compteur?.cp_pris || 0);
    // Indemnite CP = jours restants × salaire journalier (base 21.67 jours ouvres/mois)
    const salaireJournalier = Math.round((membre.salaire_mensuel || 0) / 21.67);
    const indemniteCP = Math.max(0, Math.round(cpSolde * salaireJournalier));
    // Prime de precarite CDD = 10% du total brut cumule (cumuls + brut du mois)
    const isCDD = membre.type_contrat && membre.type_contrat !== 'cdi';
    const totalBrutCumule = newCumuls.brut;
    const primePrecarite = isCDD ? Math.round(totalBrutCumule * 0.10) : 0;

    soldeToutCompte = {
      salaireDu: brutDetail.totalBrut,
      indemniteCP,
      cpRestants: cpSolde,
      primePrecarite,
      isCDD,
      total: brutDetail.totalBrut + indemniteCP + primePrecarite,
    };
  }

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
      date_fin_contrat: membre.date_fin_contrat,
      adresse: [membre.adresse_rue, membre.adresse_cp, membre.adresse_ville].filter(Boolean).join(', '),
    },
    ancienneteMois,
    prorata: prorata.ratio < 1 ? prorata : null,
    isDernierePaie: !!isDernierePaie,

    // Brut
    brut: brutDetail,

    // Absences
    absences: absencesDetail,
    absenceAgregee,

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

    // Solde de tout compte (derniere paie uniquement)
    soldeToutCompte,

    // Cout employeur
    coutEmployeur: brutDetail.brutSoumis + cotisations.totalPatronal - fillon.montant + brutDetail.totalPrimesExonerees,
  };
}

// ============================================
// CUMULS MENSUELS
// ============================================

/**
 * Calcule le nombre de jours ouvres dans un mois
 */
function getJoursOuvres(periode) {
  const [year, month] = periode.split('-').map(Number);
  const joursMois = new Date(year, month, 0).getDate();
  let ouvres = 0;
  for (let d = 1; d <= joursMois; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0 && day !== 6) ouvres++;
  }
  return ouvres;
}

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
    // Absences
    absences: p.absences || [],
    retenue_absences: p.absenceAgregee?.retenue || 0,
    ijss_brutes: p.absenceAgregee?.ijssBrutes || 0,
    complement_employeur: p.absenceAgregee?.complementEmployeur || 0,
    // Cotisations
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
    prorata: p.prorata || null,
    derniere_paie: p.isDernierePaie || false,
    solde_tout_compte: p.soldeToutCompte || null,
    statut: 'brouillon',
    updated_at: new Date().toISOString(),
  };
}

export default {
  TAUX_2026,
  ABSENCE_CONFIG,
  PRIMES_TYPES,
  calculateProrata,
  isMembreDansPeriode,
  calculateTranchesPMSS,
  calculateBrut,
  calculateAbsence,
  calculatePrimes,
  calculateCotisations,
  calculateReductionFillon,
  calculatePAS,
  calculatePayroll,
  updateCumulsMensuels,
  payrollToBulletinData,
};
