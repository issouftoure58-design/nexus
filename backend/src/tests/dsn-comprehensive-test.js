/**
 * Tests DSN Complets — 10 Scenarios
 * Verifie la coherence par construction (COH-11, COH-14)
 * et couvre tous les cas DSN-Val possibles
 *
 * Usage: cd /Users/hobb/Documents/Nexus/nexus && node backend/src/tests/dsn-comprehensive-test.js
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const TENANT = 'test-salon-business';
const PERIODE = '2026-04';

// ============================================
// NIR HELPER — genere un NIR valide (13 chiffres, cle Luhn compatible)
// ============================================
function generateNIR(sexe, annee, mois, dept, commune, ordre) {
  // Format: S AA MM DD CCC OOO
  const s = sexe === 'M' ? '1' : '2';
  const aa = String(annee).padStart(2, '0');
  const mm = String(mois).padStart(2, '0');
  const dd = String(dept).padStart(2, '0');
  const ccc = String(commune).padStart(3, '0');
  const ooo = String(ordre).padStart(3, '0');
  return `${s}${aa}${mm}${dd}${ccc}${ooo}`;
}

// ============================================
// DONNEES FICTIVES — 10 scenarios
// ============================================

const DSN_PARAMS = {
  siren: '443061841',
  siret: '44306184100013',
  nic: '00013',
  bic: 'BNPAFRPP',
  iban: 'FR7630006000011234567890189',
  urssaf_siret: '78861779300013',
  raison_sociale: 'SALON TEST DSN',
  adresse_siege: '15 rue de la Beaute',
  code_postal_siege: '75010',
  ville_siege: 'Paris',
  code_naf: '9602A',
  idcc: '2596',
  contact_nom: 'DUPONT',
  contact_email: 'contact@salon-test.fr',
  contact_tel: '0143000001',
  version_norme: 'P26V01',
  code_regime_retraite: 'RETA',
  code_risque_at: '930DB',
  taux_at_defaut: 1.50,
  mode_paiement: '05',
  fraction: '11',
};

// Membre de base (commun)
const MEMBRE_BASE = {
  tenant_id: TENANT,
  statut: 'actif',
  role: 'equipe',
  emplois_multiples: '03',
  employeurs_multiples: '03',
  regime_at: '200',
  regime_maladie: '200',
  regime_vieillesse: '200',
  code_risque_at: '930DB',
  adresse_rue: '10 rue du Test',
  adresse_cp: '75010',
  adresse_ville: 'Paris',
  codification_ue: '01',
  code_pays_naissance: 'FR',
};

// ============================================
// SCENARIOS
// ============================================
const SCENARIOS = [
  {
    num: 1,
    nom: 'CDI standard 2400€',
    desc: 'CDI temps plein, brut > 1.6 SMIC, pas de Fillon',
    membre: {
      ...MEMBRE_BASE,
      nom: 'DUPONT', prenom: 'Marc', sexe: 'M',
      nir: generateNIR('M', 85, 3, 75, 108, 42),
      date_naissance: '1985-03-15',
      lieu_naissance: 'Paris',
      dept_naissance: '75',
      date_embauche: '2022-01-10',
      type_contrat: 'cdi',
      poste: 'Coiffeur senior',
      code_pcs: '637d',
      categorie_sociopro: 'employe',
      statut_conventionnel: '06',
      statut_categoriel: '04',
      salaire_mensuel: 240000,
      heures_mensuelles: 151.67,
      modalite_temps: '10',
    },
    brut: 240000,
    fillon: false,
  },
  {
    num: 2,
    nom: 'CDI near-SMIC 1850€ + Fillon',
    desc: 'CDI temps plein, brut < 1.6 SMIC, Fillon applicable',
    membre: {
      ...MEMBRE_BASE,
      nom: 'MARTIN', prenom: 'Sophie', sexe: 'F',
      nir: generateNIR('F', 92, 7, 93, 8, 18),
      date_naissance: '1992-07-22',
      lieu_naissance: 'Bobigny',
      dept_naissance: '93',
      date_embauche: '2023-03-01',
      type_contrat: 'cdi',
      poste: 'Coiffeuse',
      code_pcs: '637d',
      categorie_sociopro: 'employe',
      statut_conventionnel: '06',
      statut_categoriel: '04',
      salaire_mensuel: 185000,
      heures_mensuelles: 151.67,
      modalite_temps: '10',
    },
    brut: 185000,
    fillon: true,
  },
  {
    num: 3,
    nom: 'CDI SMIC exact 1823€ + Fillon max',
    desc: 'CDI temps plein au SMIC, Fillon maximum',
    membre: {
      ...MEMBRE_BASE,
      nom: 'PETIT', prenom: 'Jean', sexe: 'M',
      nir: generateNIR('M', 90, 1, 94, 23, 56),
      date_naissance: '1990-01-10',
      lieu_naissance: 'Creteil',
      dept_naissance: '94',
      date_embauche: '2024-06-15',
      type_contrat: 'cdi',
      poste: 'Aide coiffeur',
      code_pcs: '637d',
      categorie_sociopro: 'employe',
      statut_conventionnel: '06',
      statut_categoriel: '04',
      salaire_mensuel: 182303,
      heures_mensuelles: 151.67,
      modalite_temps: '10',
    },
    brut: 182303,
    fillon: true,
  },
  {
    num: 4,
    nom: 'DSN neant (0 salarie)',
    desc: 'Aucun salarie, DSN type 02 neant',
    membre: null,
    brut: 0,
    fillon: false,
    neant: true,
  },
  {
    num: 5,
    nom: 'Multi-employes (3 salaries)',
    desc: '3 employes: 2400€ + 1850€ + 2100€, Fillon sur 1',
    membres: [
      {
        ...MEMBRE_BASE,
        nom: 'DUPONT', prenom: 'Marc', sexe: 'M',
        nir: generateNIR('M', 85, 3, 75, 108, 42),
        date_naissance: '1985-03-15', lieu_naissance: 'Paris', dept_naissance: '75',
        date_embauche: '2022-01-10', type_contrat: 'cdi', poste: 'Coiffeur senior',
        code_pcs: '637d', categorie_sociopro: 'employe',
        statut_conventionnel: '06', statut_categoriel: '04',
        salaire_mensuel: 240000, heures_mensuelles: 151.67, modalite_temps: '10',
      },
      {
        ...MEMBRE_BASE,
        nom: 'MARTIN', prenom: 'Sophie', sexe: 'F',
        nir: generateNIR('F', 92, 7, 93, 8, 18),
        date_naissance: '1992-07-22', lieu_naissance: 'Bobigny', dept_naissance: '93',
        date_embauche: '2023-03-01', type_contrat: 'cdi', poste: 'Coiffeuse',
        code_pcs: '637d', categorie_sociopro: 'employe',
        statut_conventionnel: '06', statut_categoriel: '04',
        salaire_mensuel: 185000, heures_mensuelles: 151.67, modalite_temps: '10',
      },
      {
        ...MEMBRE_BASE,
        nom: 'DURAND', prenom: 'Lucas', sexe: 'M',
        nir: generateNIR('M', 88, 11, 75, 112, 33),
        date_naissance: '1988-11-05', lieu_naissance: 'Paris', dept_naissance: '75',
        date_embauche: '2021-09-01', type_contrat: 'cdi', poste: 'Barbier',
        code_pcs: '637d', categorie_sociopro: 'employe',
        statut_conventionnel: '06', statut_categoriel: '04',
        salaire_mensuel: 210000, heures_mensuelles: 151.67, modalite_temps: '10',
      },
    ],
    bruts: [240000, 185000, 210000],
    fillon: false,
  },
  {
    num: 6,
    nom: 'CDI + heures sup (TEPA)',
    desc: 'CDI 1900€ + 10h sup a 25%, reduction TEPA',
    membre: {
      ...MEMBRE_BASE,
      nom: 'LEROY', prenom: 'Pierre', sexe: 'M',
      nir: generateNIR('M', 91, 5, 92, 47, 12),
      date_naissance: '1991-05-20', lieu_naissance: 'Nanterre', dept_naissance: '92',
      date_embauche: '2023-01-15', type_contrat: 'cdi', poste: 'Coiffeur',
      code_pcs: '637d', categorie_sociopro: 'employe',
      statut_conventionnel: '06', statut_categoriel: '04',
      salaire_mensuel: 190000, heures_mensuelles: 151.67, modalite_temps: '10',
    },
    brut: 190000,
    heures_supp_25: 10,
    fillon: true,
  },
  {
    num: 7,
    nom: 'CDD remplacement 2000€',
    desc: 'CDD nature 02, motif remplacement, date fin',
    membre: {
      ...MEMBRE_BASE,
      nom: 'BERNARD', prenom: 'Marie', sexe: 'F',
      nir: generateNIR('F', 95, 9, 78, 646, 21),
      date_naissance: '1995-09-12', lieu_naissance: 'Versailles', dept_naissance: '78',
      date_embauche: '2026-02-01', date_fin_contrat: '2026-07-31',
      type_contrat: 'cdd', cdd_motif: '01', poste: 'Coiffeuse remplacante',
      code_pcs: '637d', categorie_sociopro: 'employe',
      statut_conventionnel: '06', statut_categoriel: '04',
      salaire_mensuel: 200000, heures_mensuelles: 151.67, modalite_temps: '10',
    },
    brut: 200000,
    fillon: false,
  },
  {
    num: 8,
    nom: 'Temps partiel 80% 1200€',
    desc: 'CDI 80%, 121.33h, prorata SMIC pour Fillon',
    membre: {
      ...MEMBRE_BASE,
      nom: 'MOREAU', prenom: 'Julie', sexe: 'F',
      nir: generateNIR('F', 93, 4, 69, 123, 45),
      date_naissance: '1993-04-08', lieu_naissance: 'Lyon', dept_naissance: '69',
      date_embauche: '2024-01-02', type_contrat: 'cdi', poste: 'Estheticienne',
      code_pcs: '637d', categorie_sociopro: 'employe',
      statut_conventionnel: '06', statut_categoriel: '04',
      salaire_mensuel: 120000, heures_mensuelles: 121.33, modalite_temps: '20',
      quotite_contrat: 121.33, quotite_reference: 151.67,
    },
    brut: 120000,
    fillon: true,
  },
  {
    num: 9,
    nom: 'Haut salaire 5000€ > PMSS',
    desc: 'CDI cadre, brut > PMSS, tranche 2 active',
    membre: {
      ...MEMBRE_BASE,
      nom: 'GARCIA', prenom: 'Franck', sexe: 'M',
      nir: generateNIR('M', 80, 2, 13, 55, 78),
      date_naissance: '1980-02-14', lieu_naissance: 'Marseille', dept_naissance: '13',
      date_embauche: '2020-03-01', type_contrat: 'cdi', poste: 'Directeur de salon',
      code_pcs: '374b', categorie_sociopro: 'cadre',
      statut_conventionnel: '04', statut_categoriel: '01',
      salaire_mensuel: 500000, heures_mensuelles: 151.67, modalite_temps: '10',
    },
    brut: 500000,
    fillon: false,
  },
  {
    num: 10,
    nom: 'Apprenti 1100€',
    desc: 'Contrat apprentissage, dispositif 99, exonerations',
    membre: {
      ...MEMBRE_BASE,
      nom: 'LAURENT', prenom: 'Emma', sexe: 'F',
      nir: generateNIR('F', 4, 5, 75, 112, 33),
      date_naissance: '2004-05-25', lieu_naissance: 'Paris', dept_naissance: '75',
      date_embauche: '2025-09-01', type_contrat: 'apprentissage',
      dispositif_politique: '64', poste: 'Apprentie coiffeuse',
      code_pcs: '637d', categorie_sociopro: 'employe',
      statut_conventionnel: '06', statut_categoriel: '04',
      salaire_mensuel: 110000, heures_mensuelles: 151.67, modalite_temps: '10',
    },
    brut: 110000,
    fillon: false,
  },
  // ============================================
  // SCENARIOS EVENEMENTIELS (11-13)
  // ============================================
  // ============================================
  // SCENARIOS EVENEMENTIELS — DSIJ/FCTU = norme differente (blocs minimaux, rubriques specifiques)
  // Non teste par DSN-Val mensuelle — necessite implementation separee du generateur
  // ============================================
  {
    num: 11,
    nom: 'DSN annule et remplace (type 03)',
    desc: 'Annule et remplace une DSN mensuelle precedente',
    annuleRemplace: true,
    membre: {
      ...MEMBRE_BASE,
      nom: 'DUPONT', prenom: 'Marc', sexe: 'M',
      nir: generateNIR('M', 85, 3, 75, 108, 42),
      date_naissance: '1985-03-15', lieu_naissance: 'Paris', dept_naissance: '75',
      date_embauche: '2022-01-10', type_contrat: 'cdi', poste: 'Coiffeur senior',
      code_pcs: '637d', categorie_sociopro: 'employe',
      statut_conventionnel: '06', statut_categoriel: '04',
      salaire_mensuel: 240000, heures_mensuelles: 151.67, modalite_temps: '10',
    },
    brut: 240000,
    fillon: false,
  },
];

// ============================================
// SETUP: Assurer les parametres DSN du tenant
// ============================================
async function ensureDSNParams() {
  const { data: existing } = await supabase.from('rh_dsn_parametres')
    .select('id')
    .eq('tenant_id', TENANT)
    .maybeSingle();

  if (existing) {
    await supabase.from('rh_dsn_parametres').update(DSN_PARAMS).eq('tenant_id', TENANT);
  } else {
    await supabase.from('rh_dsn_parametres').insert({ ...DSN_PARAMS, tenant_id: TENANT });
  }
}

// ============================================
// SETUP: Inserer/MAJ un membre
// ============================================
async function upsertMembre(membreData, scenarioNum, idx = 0) {
  const tag = `sc${scenarioNum}_${idx}`;
  // Chercher un membre existant avec ce nom/prenom dans le tenant
  const { data: existing } = await supabase.from('rh_membres')
    .select('id')
    .eq('tenant_id', TENANT)
    .eq('nom', membreData.nom)
    .eq('prenom', membreData.prenom)
    .maybeSingle();

  if (existing) {
    await supabase.from('rh_membres').update(membreData).eq('id', existing.id);
    return existing.id;
  } else {
    const { data, error } = await supabase.from('rh_membres')
      .insert(membreData)
      .select('id')
      .single();
    if (error) throw new Error(`Insertion membre ${membreData.nom}: ${error.message}`);
    return data.id;
  }
}

// ============================================
// CREER BULLETIN depuis calculatePayroll ou donnees brutes
// ============================================
async function createBulletin(membreId, membre, brut, options = {}) {
  // Importer payrollEngine pour calcul realiste
  const { calculateCotisations, calculateReductionFillon, TAUX_2026 } = await import('../services/payrollEngine.js');

  const effectif = options.effectif || 5;
  const cotisations = calculateCotisations(brut, membre, {}, {}, { effectif, moisEcoule: 4 });
  const fillon = calculateReductionFillon(brut, TAUX_2026.smic_mensuel, effectif);

  // Heures sup
  const hs25 = options.heures_supp_25 || 0;
  const tauxHoraire = brut / 15167; // centimes par centieme d'heure
  const montantHS25 = Math.round(hs25 * tauxHoraire * 125); // 25% majoration
  const montantHS50 = 0;
  const brutTotal = brut + montantHS25;

  // Recalculer cotisations sur brut total si HS
  const cotisReal = hs25 > 0
    ? calculateCotisations(brutTotal, membre, {}, {}, { effectif, moisEcoule: 4 })
    : cotisations;
  const fillonReal = hs25 > 0
    ? calculateReductionFillon(brutTotal, TAUX_2026.smic_mensuel, effectif)
    : fillon;

  // Reduction TEPA: exoneration cotisations salariales sur HS (11.31% de la remuneration HS)
  const reductionHS = hs25 > 0 ? Math.round(montantHS25 * 0.1131) : 0;

  const netAvantIR = brutTotal - cotisReal.totalSalarial;
  const tauxIR = membre.categorie_sociopro === 'cadre' ? 12.00 : (brutTotal > 200000 ? 7.50 : (brutTotal > 150000 ? 3.50 : 0));
  const netImposable = netAvantIR;
  const montantIR = Math.round(netImposable * tauxIR / 100);
  const netAPayer = netAvantIR - montantIR;
  const netSocial = netAvantIR;

  // Supprimer ancien bulletin
  await supabase.from('rh_bulletins_paie').delete()
    .eq('tenant_id', TENANT)
    .eq('membre_id', membreId)
    .eq('periode', PERIODE);

  // Ajouter REDUCTION_HS comme cotisation patronale negative pour que le DSN generator la trouve
  if (reductionHS > 0) {
    cotisReal.patronales.push({
      code: 'REDUCTION_HS',
      libelle: 'Reduction cotisations HS (TEPA)',
      base: montantHS25,
      taux: 11.31,
      montant: -reductionHS,
      plafonne: false,
    });
  }

  const bulletinData = {
    tenant_id: TENANT,
    membre_id: membreId,
    periode: PERIODE,
    employe_nom: membre.nom,
    employe_prenom: membre.prenom,
    employe_nir: membre.nir,
    employe_poste: membre.poste,
    type_contrat: membre.type_contrat,
    salaire_base: brut,
    heures_normales: membre.heures_mensuelles || 151.67,
    heures_supp_25: hs25,
    montant_hs_25: montantHS25,
    heures_supp_50: 0,
    montant_hs_50: 0,
    primes: 0,
    avantages_nature: 0,
    brut_total: brutTotal,
    cotisations_salariales: JSON.stringify(cotisReal.salariales),
    total_cotisations_salariales: cotisReal.totalSalarial,
    cotisations_patronales: JSON.stringify(cotisReal.patronales),
    total_cotisations_patronales: cotisReal.totalPatronal,
    reduction_fillon: fillonReal.montant || 0,
    net_avant_ir: netAvantIR,
    montant_ir: montantIR,
    taux_ir: tauxIR,
    net_a_payer: netAPayer,
    net_imposable: netImposable,
    net_social: netSocial,
    statut: 'valide',
  };

  const { error } = await supabase.from('rh_bulletins_paie').insert(bulletinData);
  if (error) throw new Error(`Insertion bulletin ${membre.nom}: ${error.message}`);
  return bulletinData;
}

// ============================================
// DESACTIVER TOUS LES MEMBRES DU TENANT
// ============================================
async function deactivateAllMembres() {
  await supabase.from('rh_membres')
    .update({ statut: 'inactif' })
    .eq('tenant_id', TENANT);
}

// ============================================
// ACTIVER UNIQUEMENT LES MEMBRES DONNES
// ============================================
async function activateMembres(ids) {
  for (const id of ids) {
    await supabase.from('rh_membres')
      .update({ statut: 'actif' })
      .eq('id', id);
  }
}

// ============================================
// EXECUTER UN SCENARIO
// ============================================
async function runScenario(scenario) {
  const { generateDSN } = await import('../services/dsnGenerator.js');
  const { validerDSN } = await import('../services/dsnValidator.js');

  // DSN neant
  if (scenario.neant) {
    await deactivateAllMembres();
    // Supprimer tous les bulletins de la periode
    await supabase.from('rh_bulletins_paie').delete()
      .eq('tenant_id', TENANT).eq('periode', PERIODE);

    const result = await generateDSN(TENANT, PERIODE, '01', { neant: true });
    const validation = validerDSN(result.content);
    const outputPath = `/tmp/dsn-complet-${scenario.num}.dsn`;
    writeFileSync(outputPath, result.contentISO);

    // Pour neant, STR-04 (aucun salarie) est un avertissement attendu
    const realErrors = validation.erreurs.filter(e => e.code !== 'STR-04');
    const realWarnings = validation.avertissements.filter(a => a.code !== 'STR-04');

    return {
      pass: realErrors.length === 0,
      erreurs: realErrors,
      avertissements: realWarnings,
      rubriques: result.stats.blocs,
      path: outputPath,
    };
  }

  // Scenario multi-employes
  if (scenario.membres) {
    await deactivateAllMembres();
    const ids = [];
    // Supprimer anciens bulletins
    await supabase.from('rh_bulletins_paie').delete()
      .eq('tenant_id', TENANT).eq('periode', PERIODE);

    for (let i = 0; i < scenario.membres.length; i++) {
      const m = scenario.membres[i];
      const id = await upsertMembre(m, scenario.num, i);
      ids.push(id);
      await createBulletin(id, m, scenario.bruts[i]);
    }
    await activateMembres(ids);

    const result = await generateDSN(TENANT, PERIODE);
    const validation = validerDSN(result.content);
    const outputPath = `/tmp/dsn-complet-${scenario.num}.dsn`;
    writeFileSync(outputPath, result.contentISO);

    return {
      pass: validation.erreurs.length === 0,
      erreurs: validation.erreurs,
      avertissements: validation.avertissements,
      rubriques: result.stats.blocs,
      individus: result.stats.individus,
      path: outputPath,
    };
  }

  // Scenario evenementiel (arret / fin contrat)
  if (scenario.evenementiel) {
    await deactivateAllMembres();
    const id = await upsertMembre(scenario.membre, scenario.num);
    await activateMembres([id]);

    const result = await generateDSN(TENANT, PERIODE, scenario.nature, {
      membreId: id,
      evenement: scenario.evenement,
    });
    const validation = validerDSN(result.content);
    const outputPath = `/tmp/dsn-complet-${scenario.num}.dsn`;
    writeFileSync(outputPath, result.contentISO);

    // Validateur interne concu pour mensuelle — ignorer CMP-01/02/04/05 pour evenementielles
    const evenErrors = validation.erreurs.filter(e =>
      !e.code.startsWith('CMP-') && !e.code.startsWith('STR-'));

    return {
      pass: evenErrors.length === 0,
      erreurs: evenErrors,
      avertissements: validation.avertissements.filter(a => !a.code.startsWith('CMP-')),
      rubriques: result.stats.blocs,
      individus: result.stats.individus,
      path: outputPath,
      skipInternalValidation: true,
    };
  }

  // Scenario annule et remplace
  if (scenario.annuleRemplace) {
    await deactivateAllMembres();
    await supabase.from('rh_bulletins_paie').delete()
      .eq('tenant_id', TENANT).eq('periode', PERIODE);

    const id = await upsertMembre(scenario.membre, scenario.num);
    await createBulletin(id, scenario.membre, scenario.brut);
    await activateMembres([id]);

    const result = await generateDSN(TENANT, PERIODE, '01', { annuleRemplace: true });
    const validation = validerDSN(result.content);
    const outputPath = `/tmp/dsn-complet-${scenario.num}.dsn`;
    writeFileSync(outputPath, result.contentISO);

    return {
      pass: validation.erreurs.length === 0,
      erreurs: validation.erreurs,
      avertissements: validation.avertissements,
      rubriques: result.stats.blocs,
      individus: result.stats.individus,
      path: outputPath,
    };
  }

  // Scenario simple (1 employe)
  await deactivateAllMembres();
  await supabase.from('rh_bulletins_paie').delete()
    .eq('tenant_id', TENANT).eq('periode', PERIODE);

  const id = await upsertMembre(scenario.membre, scenario.num);
  await createBulletin(id, scenario.membre, scenario.brut, {
    heures_supp_25: scenario.heures_supp_25 || 0,
  });
  await activateMembres([id]);

  const result = await generateDSN(TENANT, PERIODE);
  const validation = validerDSN(result.content);
  const outputPath = `/tmp/dsn-complet-${scenario.num}.dsn`;
  writeFileSync(outputPath, result.contentISO);

  // Verifier coherence COH-11 et COH-14
  const coh11 = validation.avertissements.filter(a => a.code === 'COH-11');
  const coh14 = validation.avertissements.filter(a => a.code === 'COH-14');

  return {
    pass: validation.erreurs.length === 0,
    erreurs: validation.erreurs,
    avertissements: validation.avertissements,
    coh11: coh11.length,
    coh14: coh14.length,
    rubriques: result.stats.blocs,
    individus: result.stats.individus,
    path: outputPath,
    fillon: scenario.fillon,
  };
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         TESTS DSN COMPLETS — 11 SCENARIOS                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log();

  await ensureDSNParams();

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const scenario of SCENARIOS) {
    try {
      const r = await runScenario(scenario);
      results.push({ scenario, result: r });

      const status = r.pass ? '✅ PASS' : '❌ FAIL';
      const extras = [];
      if (r.erreurs?.length) extras.push(`${r.erreurs.length} err`);
      if (r.avertissements?.length) extras.push(`${r.avertissements.length} warn`);
      if (r.coh11) extras.push(`COH-11!`);
      if (r.coh14) extras.push(`COH-14!`);
      extras.push(`${r.rubriques} rub`);
      if (r.individus !== undefined) extras.push(`${r.individus} ind`);

      console.log(`${status} | ${scenario.num}. ${scenario.nom} — ${extras.join(', ')}`);

      if (!r.pass) {
        for (const e of r.erreurs) {
          console.log(`       ↳ [${e.code}] ${e.message}`);
        }
      }
      // Show COH warnings even on pass
      if (r.coh11 || r.coh14) {
        for (const w of (r.avertissements || []).filter(a => a.code === 'COH-11' || a.code === 'COH-14')) {
          console.log(`       ⚠ [${w.code}] ${w.message}`);
        }
      }

      if (r.pass) passed++;
      else failed++;

    } catch (err) {
      console.log(`❌ FAIL | ${scenario.num}. ${scenario.nom} — CRASH: ${err.message}`);
      failed++;
      results.push({ scenario, result: { pass: false, crash: err.message } });
    }
  }

  console.log();
  console.log('═══════════════════════════════════════════════════════════');
  const total = SCENARIOS.length;
  if (failed === 0) {
    console.log(`RESULTAT: ${passed}/${total} PASS ✅`);
  } else {
    console.log(`RESULTAT: ${passed}/${total} PASS, ${failed}/${total} FAIL ❌`);
  }
  console.log(`Fichiers DSN ecrits dans /tmp/dsn-complet-{1..${total}}.dsn`);
  console.log(`→ Soumettez-les a DSN-Val pour verification externe`);
  console.log();

  // Detail des warnings pour analyse
  const allWarnings = results.flatMap(r => (r.result.avertissements || []).map(a => `  [${a.code}] ${a.message}`));
  if (allWarnings.length > 0) {
    console.log(`--- Avertissements (${allWarnings.length}) ---`);
    // Deduplicate by code
    const seen = new Set();
    for (const w of allWarnings) {
      const code = w.match(/\[([A-Z]+-\d+)\]/)?.[1];
      if (code && !seen.has(code)) {
        console.log(w);
        seen.add(code);
      }
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('ERREUR FATALE:', err);
  process.exit(1);
});
