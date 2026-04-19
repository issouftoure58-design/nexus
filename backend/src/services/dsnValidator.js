/**
 * Service de validation DSN - Controles NEODeS complets
 * Reproduit les controles DSN-CTL / DSN-Val niveau par niveau
 *
 * Niveaux de controle :
 *   1. STRUCTURE   - Blocs obligatoires, ordre, imbrication
 *   2. FORMAT      - Syntaxe ligne, types de donnees, longueurs
 *   3. VALEUR      - Tables de codes officielles, valeurs autorisees
 *   4. COMPLETUDE  - Rubriques obligatoires par bloc et par salarie
 *   5. COHERENCE   - Inter-champs, totaux, dependances conditionnelles
 *   6. METIER      - Regles metier specifiques (regimes, cotisations, CTP)
 */

// ============================================
// TABLES DE CODES OFFICIELLES NEODeS
// ============================================

const CODES_NATURE_CONTRAT = ['01','02','03','04','05','07','08','09','10','29','32','50','60','70','80','81','82','89','90','91','92','93'];
const CODES_STATUT_CONVENTIONNEL = ['01','02','03','04','05','06','07','08','09','10','11','12','13'];
const CODES_STATUT_CATEGORIEL = ['01','02','03','04'];
const CODES_MODALITE_TEMPS = ['01','02','03','04','05'];
const CODES_UNITE_QUOTITE = ['10','12','20','21','31','32','33','99'];
const CODES_DISPOSITIF_POLITIQUE = ['01','02','03','08','09','10','11','21','31','32','41','42','43','44','45','50','51','52','53','54','55','56','57','58','59','60','61','62','63','64','65','70','71','80','81','82','83','99'];
const CODES_REGIME_BASE = ['100','120','134','135','136','137','138','140','141','200','300','400','900'];
const CODES_SEXE = ['01','02'];
const CODES_CODIFICATION_UE = ['01','02'];
const CODES_EMPLOIS_MULTIPLES = ['01','02'];
const CODES_TYPE_REMUNERATION = ['001','002','003','004','005','006','007','008','009','010','011','012','013','014','015','016','017','018','019','020','021','022','023','024','025','026','027','028','029','030','031','032','033','034','035','036','037','038','039','040','041','042','043','090','091'];
const CODES_TYPE_ACTIVITE = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37'];
const CODES_BASE_ASSUJETTIE = ['02','03','04','07','08','09','10','11','12','13','14','15','16','17','18','19','20','22','23','24','25','28','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49','50','51','52','53','54','55','56','57','58','59','60','61','62','63','64'];
const CODES_COTISATION = ['001','002','003','004','005','006','007','008','009','010','011','012','013','014','015','016','017','018','019','020','021','022','023','024','025','026','027','028','029','030','031','033','034','035','036','037','038','039','040','041','042','043','044','045','046','047','048','049','050','051','052','053','054','055','056','057','058','059','060','061','062','063','064','065','066','067','068','069','070','071','072','073','074','075','076','077','078','079','080','081','082','083','084','085','090','091','092','093','094','095','096','097','098','099','100','105','106','107','108','109'];
const CODES_CTP = ['100','101','103','105','110','112','113','114','115','120','200','201','202','206','208','210','211','212','213','215','216','236','237','260','261','262','263','270','280','290','300','310','311','312','332','334','335','336','340','341','352','370','371','372','373','374','376','380','381','382','383','390','400','401','430','450','452','457','462','463','468','469','480','481','483','493','496','500','510','511','520','523','536','537','590','601','602','606','607','608','619','621','671','672','700','730','750','772','801','802','803','810','830','900','901','906','907','910','911','912','913','914','959','990','992'];
const CODES_MODE_PAIEMENT = ['01','02','03','04','05'];
const CODES_NATURE_DECLARATION = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14'];
const CODES_REVENU_NET = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','81','82','83','84','85','86','87','88'];

// ============================================
// PATTERNS DE FORMAT
// ============================================

const PATTERNS = {
  siren: /^\d{9}$/,
  siret: /^\d{14}$/,
  nic: /^\d{5}$/,
  nir: /^\d{13}$/,
  nirCle: /^[12][0-9]{12}(0[1-9]|[1-8][0-9]|9[0-7])$/,
  dateJJMMAAAA: /^\d{8}$/,
  montant: /^-?\d+\.\d{2}$/,
  heures: /^\d+\.\d{2}$/,
  taux: /^\d+\.\d{2}$/,
  codePostal: /^\d{5}$/,
  codePays: /^[A-Z]{2}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  telephone: /^[\d+\s()-]{10,20}$/,
  pcsEse: /^\d{3}[a-z]$/i,
  codeRisqueAT: /^[0-9A-Z]{3,6}$/,
  normeVersion: /^P\d{2}V\d{2}$/
};

// ============================================
// STRUCTURE : Blocs obligatoires et ordre
// ============================================

const BLOCS_OBLIGATOIRES_GLOBAL = {
  'S10.G00.00': 'Envoi',
  'S10.G00.01': 'Emetteur',
  'S10.G00.02': 'Contact emetteur',
  'S20.G00.05': 'Declaration',
  'S20.G00.07': 'Contact declaration',
  'S21.G00.06': 'Entreprise',
  'S21.G00.11': 'Etablissement',
  'S90.G00.90': 'Total envoi'
};

const BLOCS_OBLIGATOIRES_PAR_SALARIE = {
  'S21.G00.30': 'Individu',
  'S21.G00.40': 'Contrat',
  'S21.G00.50': 'Versement individu',
  'S21.G00.51': 'Remunerations',
  'S21.G00.53': 'Activites',
  'S21.G00.58': 'Revenu net',
  'S21.G00.78': 'Bases assujetties',
  'S21.G00.81': 'Cotisations individuelles'
};

const BLOCS_OBLIGATOIRES_SI_SALARIE = {
  'S21.G00.71': 'Retraite complementaire',
  'S21.G00.20': 'Versement organisme',
  'S21.G00.22': 'Bordereau cotisations'
};

// Ordre attendu des blocs (simplifie)
const ORDRE_BLOCS = [
  'S10.G00.00', 'S10.G00.01', 'S10.G00.02',
  'S20.G00.05', 'S20.G00.07',
  'S21.G00.06', 'S21.G00.11',
  'S21.G00.20', 'S21.G00.22',
  'S21.G00.30', 'S21.G00.40', 'S21.G00.71',
  'S21.G00.50', 'S21.G00.51', 'S21.G00.52', 'S21.G00.53',
  'S21.G00.58', 'S21.G00.78', 'S21.G00.81',
  'S21.G00.60', 'S21.G00.62',
  'S90.G00.90'
];

// ============================================
// RUBRIQUES OBLIGATOIRES PAR BLOC
// ============================================

const RUBRIQUES_OBLIGATOIRES = {
  // S10.G00.00 - Envoi
  'S10.G00.00.001': { nom: 'Nom logiciel', format: 'string', maxLen: 100 },
  'S10.G00.00.002': { nom: 'Editeur logiciel', format: 'string', maxLen: 100 },
  'S10.G00.00.003': { nom: 'Version logiciel', format: 'string', maxLen: 20 },
  'S10.G00.00.005': { nom: 'Code envoi', format: 'code', values: ['01','02'] },
  'S10.G00.00.006': { nom: 'Version norme', format: 'pattern', pattern: PATTERNS.normeVersion },
  'S10.G00.00.007': { nom: 'Point de depot', format: 'code', values: ['01','02','03','04'] },
  'S10.G00.00.008': { nom: 'Type envoi', format: 'code', values: ['01','02','03'] },

  // S10.G00.01 - Emetteur
  'S10.G00.01.001': { nom: 'SIREN emetteur', format: 'siren' },
  'S10.G00.01.002': { nom: 'NIC emetteur', format: 'nic' },
  'S10.G00.01.003': { nom: 'Raison sociale emetteur', format: 'string', maxLen: 80 },
  'S10.G00.01.004': { nom: 'Adresse emetteur', format: 'string' },
  'S10.G00.01.005': { nom: 'Code postal emetteur', format: 'codePostal' },
  'S10.G00.01.006': { nom: 'Ville emetteur', format: 'string' },

  // S10.G00.02 - Contact emetteur
  'S10.G00.02.001': { nom: 'Nom contact emetteur', format: 'string' },
  'S10.G00.02.002': { nom: 'Email contact emetteur', format: 'email' },

  // S20.G00.05 - Declaration
  'S20.G00.05.001': { nom: 'Nature declaration', format: 'code', values: CODES_NATURE_DECLARATION },
  'S20.G00.05.002': { nom: 'Type declaration', format: 'code', values: ['01','02','03','04','05','06'] },
  'S20.G00.05.003': { nom: 'Fraction', format: 'string' },
  'S20.G00.05.004': { nom: 'Numero ordre', format: 'number' },
  'S20.G00.05.005': { nom: 'Date mois principal', format: 'dateJJMMAAAA' },
  'S20.G00.05.007': { nom: 'Date constitution fichier', format: 'dateJJMMAAAA' },
  'S20.G00.05.008': { nom: 'Champ declaration', format: 'code', values: ['01','02'] },
  'S20.G00.05.010': { nom: 'Devise', format: 'code', values: ['01'] },

  // S20.G00.07 - Contact declaration
  'S20.G00.07.001': { nom: 'Nom contact declaration', format: 'string' },
  'S20.G00.07.002': { nom: 'Email contact declaration', format: 'email' },

  // S21.G00.06 - Entreprise
  'S21.G00.06.001': { nom: 'SIREN entreprise', format: 'siren' },
  'S21.G00.06.002': { nom: 'NIC siege', format: 'nic' },
  'S21.G00.06.003': { nom: 'Code APE', format: 'string', maxLen: 5 },
  'S21.G00.06.004': { nom: 'Adresse entreprise', format: 'string' },
  'S21.G00.06.005': { nom: 'Code postal entreprise', format: 'codePostal' },
  'S21.G00.06.006': { nom: 'Ville entreprise', format: 'string' },
  'S21.G00.06.009': { nom: 'Effectif entreprise', format: 'number' },

  // S21.G00.11 - Etablissement
  'S21.G00.11.001': { nom: 'NIC etablissement', format: 'nic' },
  'S21.G00.11.002': { nom: 'Code APE etablissement', format: 'string', maxLen: 5 },
  'S21.G00.11.003': { nom: 'Adresse etablissement', format: 'string' },
  'S21.G00.11.004': { nom: 'Code postal etablissement', format: 'codePostal' },
  'S21.G00.11.005': { nom: 'Ville etablissement', format: 'string' },
  'S21.G00.11.008': { nom: 'Effectif etablissement', format: 'number' },

  // S21.G00.20 - Versement organisme
  'S21.G00.20.001': { nom: 'Identifiant OPS', format: 'string' },
  'S21.G00.20.005': { nom: 'Montant versement', format: 'montant' },
  'S21.G00.20.006': { nom: 'Date debut periode', format: 'dateJJMMAAAA' },
  'S21.G00.20.007': { nom: 'Date fin periode', format: 'dateJJMMAAAA' },
  'S21.G00.20.010': { nom: 'Mode paiement', format: 'code', values: CODES_MODE_PAIEMENT },

  // S21.G00.22 - Bordereau
  'S21.G00.22.001': { nom: 'Identifiant OPS bordereau', format: 'string' },
  'S21.G00.22.002': { nom: 'Code CTP', format: 'code', values: CODES_CTP },
  'S21.G00.22.003': { nom: 'Date debut bordereau', format: 'dateJJMMAAAA' },
  'S21.G00.22.004': { nom: 'Date fin bordereau', format: 'dateJJMMAAAA' },
  'S21.G00.22.005': { nom: 'Montant bordereau', format: 'montant' },

  // S21.G00.30 - Individu (par salarie)
  'S21.G00.30.001': { nom: 'NIR', format: 'nir' },
  'S21.G00.30.002': { nom: 'Nom de famille', format: 'string', maxLen: 80 },
  'S21.G00.30.004': { nom: 'Prenoms', format: 'string', maxLen: 80 },
  'S21.G00.30.005': { nom: 'Sexe', format: 'code', values: CODES_SEXE },
  'S21.G00.30.006': { nom: 'Date naissance', format: 'dateJJMMAAAA' },
  'S21.G00.30.013': { nom: 'Codification UE', format: 'code', values: CODES_CODIFICATION_UE },
  'S21.G00.30.015': { nom: 'Code pays naissance', format: 'codePays' },

  // S21.G00.40 - Contrat (par salarie)
  'S21.G00.40.001': { nom: 'Date debut contrat', format: 'dateJJMMAAAA' },
  'S21.G00.40.002': { nom: 'Statut conventionnel', format: 'code', values: CODES_STATUT_CONVENTIONNEL },
  'S21.G00.40.003': { nom: 'Statut categoriel retraite', format: 'code', values: CODES_STATUT_CATEGORIEL },
  'S21.G00.40.004': { nom: 'Code PCS-ESE', format: 'pcsEse' },
  'S21.G00.40.006': { nom: 'Nature contrat', format: 'code', values: CODES_NATURE_CONTRAT },
  'S21.G00.40.007': { nom: 'Libelle emploi', format: 'string' },
  'S21.G00.40.008': { nom: 'Dispositif politique publique', format: 'code', values: CODES_DISPOSITIF_POLITIQUE },
  'S21.G00.40.009': { nom: 'Numero contrat', format: 'string', minLen: 5 },
  'S21.G00.40.011': { nom: 'Unite quotite', format: 'code', values: CODES_UNITE_QUOTITE },
  'S21.G00.40.012': { nom: 'Quotite reference', format: 'heures' },
  'S21.G00.40.013': { nom: 'Quotite contrat', format: 'heures' },
  'S21.G00.40.014': { nom: 'Modalite temps', format: 'code', values: CODES_MODALITE_TEMPS },
  'S21.G00.40.018': { nom: 'Regime maladie', format: 'code', values: CODES_REGIME_BASE },
  'S21.G00.40.019': { nom: 'Lieu travail SIRET', format: 'siret' },
  'S21.G00.40.020': { nom: 'Regime vieillesse', format: 'code', values: CODES_REGIME_BASE },
  'S21.G00.40.024': { nom: 'Travailleur etranger', format: 'code', values: ['01','02'] },
  'S21.G00.40.036': { nom: 'Emplois multiples', format: 'code', values: CODES_EMPLOIS_MULTIPLES },
  'S21.G00.40.037': { nom: 'Employeurs multiples', format: 'code', values: CODES_EMPLOIS_MULTIPLES },
  'S21.G00.40.039': { nom: 'Regime AT', format: 'code', values: CODES_REGIME_BASE },
  'S21.G00.40.040': { nom: 'Code risque AT', format: 'codeRisqueAT' },
  'S21.G00.40.043': { nom: 'Taux AT', format: 'taux' },

  // S21.G00.50 - Versement individu
  'S21.G00.50.001': { nom: 'Date versement', format: 'dateJJMMAAAA' },
  'S21.G00.50.002': { nom: 'Net fiscal', format: 'montant' },
  'S21.G00.50.004': { nom: 'Net verse', format: 'montant' },
  'S21.G00.50.006': { nom: 'Taux PAS', format: 'taux' },
  'S21.G00.50.007': { nom: 'Type taux PAS', format: 'code', values: ['01','02','03','04','05','99'] },
  'S21.G00.50.009': { nom: 'Montant PAS', format: 'montant' },

  // S21.G00.51 - Remunerations
  'S21.G00.51.001': { nom: 'Date debut remuneration', format: 'dateJJMMAAAA' },
  'S21.G00.51.002': { nom: 'Date fin remuneration', format: 'dateJJMMAAAA' },
  'S21.G00.51.010': { nom: 'Numero contrat remuneration', format: 'string', minLen: 5 },
  'S21.G00.51.011': { nom: 'Type remuneration', format: 'code', values: CODES_TYPE_REMUNERATION },
  'S21.G00.51.013': { nom: 'Montant remuneration', format: 'montant' },

  // S21.G00.53 - Activites
  'S21.G00.53.001': { nom: 'Type activite', format: 'code', values: CODES_TYPE_ACTIVITE },
  'S21.G00.53.002': { nom: 'Mesure activite', format: 'heures' },
  'S21.G00.53.003': { nom: 'Unite mesure activite', format: 'code', values: CODES_UNITE_QUOTITE },

  // S21.G00.58 - Revenu net
  'S21.G00.58.001': { nom: 'Date debut revenu net', format: 'dateJJMMAAAA' },
  'S21.G00.58.002': { nom: 'Date fin revenu net', format: 'dateJJMMAAAA' },
  'S21.G00.58.003': { nom: 'Type revenu net', format: 'code', values: CODES_REVENU_NET },
  'S21.G00.58.004': { nom: 'Montant revenu net', format: 'montant' },
  'S21.G00.58.005': { nom: 'Numero contrat revenu net', format: 'string', minLen: 5 },

  // S21.G00.78 - Bases assujetties
  'S21.G00.78.001': { nom: 'Code base assujettie', format: 'code', values: CODES_BASE_ASSUJETTIE },
  'S21.G00.78.002': { nom: 'Date debut base', format: 'dateJJMMAAAA' },
  'S21.G00.78.003': { nom: 'Date fin base', format: 'dateJJMMAAAA' },
  'S21.G00.78.004': { nom: 'Montant base', format: 'montant' },

  // S21.G00.81 - Cotisations individuelles
  'S21.G00.81.001': { nom: 'Code cotisation', format: 'code', values: CODES_COTISATION },
  'S21.G00.81.002': { nom: 'Identifiant OPS cotisation', format: 'string' },
  'S21.G00.81.003': { nom: 'Montant assiette', format: 'montant' },
  'S21.G00.81.004': { nom: 'Montant cotisation', format: 'montant' },

  // S90.G00.90 - Total
  'S90.G00.90.001': { nom: 'Nombre total rubriques', format: 'number' },
  'S90.G00.90.002': { nom: 'Nombre envois', format: 'number' },
};

// ============================================
// PARSER DSN
// ============================================

function parserDSN(contenuDSN) {
  const lignes = contenuDSN.split('\n').filter(l => l.trim());
  const rubriquesOrdonnees = []; // [{code, valeur, ligne}] dans l'ordre
  const rubriquesMap = new Map();   // code -> [{valeur, ligne}]
  const blocsPresents = new Set();
  const blocsOrdre = [];         // ordre d'apparition des blocs
  let nbSalaries = 0;
  const lignesMalFormees = [];

  lignes.forEach((ligne, index) => {
    const match = ligne.match(/^([A-Z]\d{2}\.G\d{2}\.\d{2}\.\d{3}),'(.*)'/);
    if (match) {
      const [, code, valeur] = match;
      const bloc = code.substring(0, 10);

      rubriquesOrdonnees.push({ code, valeur, ligne: index + 1 });

      if (!rubriquesMap.has(code)) rubriquesMap.set(code, []);
      rubriquesMap.get(code).push({ valeur, ligne: index + 1 });

      if (!blocsPresents.has(bloc)) {
        blocsPresents.add(bloc);
        blocsOrdre.push(bloc);
      }

      if (code === 'S21.G00.30.001') nbSalaries++;
    } else if (ligne.trim()) {
      lignesMalFormees.push({ ligne: index + 1, contenu: ligne.substring(0, 80) });
    }
  });

  // Extraire les individus (regroupement par NIR)
  const individus = extraireIndividus(rubriquesOrdonnees);

  return {
    rubriquesOrdonnees,
    rubriquesMap,
    blocsPresents,
    blocsOrdre,
    nbSalaries,
    nbRubriques: rubriquesOrdonnees.length,
    lignesMalFormees,
    individus
  };
}

/**
 * Regroupe les rubriques par individu (chaque S21.G00.30.001 demarre un nouvel individu)
 */
function extraireIndividus(rubriquesOrdonnees) {
  const individus = [];
  let currentIndividu = null;
  let blocsIndividu = new Set();

  for (const r of rubriquesOrdonnees) {
    if (r.code === 'S21.G00.30.001') {
      if (currentIndividu) {
        currentIndividu.blocs = blocsIndividu;
        individus.push(currentIndividu);
      }
      currentIndividu = { nir: r.valeur, ligne: r.ligne, rubriques: [], blocs: new Set() };
      blocsIndividu = new Set();
    }
    if (currentIndividu && r.code.startsWith('S21.G00.')) {
      currentIndividu.rubriques.push(r);
      blocsIndividu.add(r.code.substring(0, 10));
    }
  }
  if (currentIndividu) {
    currentIndividu.blocs = blocsIndividu;
    individus.push(currentIndividu);
  }

  return individus;
}

// ============================================
// VALIDATEUR PRINCIPAL
// ============================================

function validerDSN(contenuDSN) {
  const resultat = {
    valide: true,
    erreurs: [],         // bloquantes
    avertissements: [],  // non-bloquantes
    stats: {
      nb_rubriques: 0,
      nb_salaries: 0,
      blocs_trouves: [],
      rubriques_manquantes: [],
      controles_effectues: 0
    }
  };

  if (!contenuDSN || typeof contenuDSN !== 'string') {
    resultat.valide = false;
    resultat.erreurs.push({ code: 'CSL-00', type: 'STRUCTURE', message: 'Contenu DSN vide ou invalide' });
    return resultat;
  }

  const dsn = parserDSN(contenuDSN);
  resultat.stats.nb_rubriques = dsn.nbRubriques;
  resultat.stats.nb_salaries = dsn.nbSalaries;
  resultat.stats.blocs_trouves = Array.from(dsn.blocsPresents);

  // --- Niveau 1 : STRUCTURE ---
  controleStructure(dsn, resultat);

  // --- Niveau 2 : FORMAT ---
  controleFormat(dsn, resultat);

  // --- Niveau 3 : VALEURS (tables de codes) ---
  controleValeurs(dsn, resultat);

  // --- Niveau 4 : COMPLETUDE ---
  controleCompletude(dsn, resultat);

  // --- Niveau 5 : COHERENCE ---
  controleCoherence(dsn, resultat);

  // --- Niveau 6 : METIER ---
  controleMetier(dsn, resultat);

  // Marquer invalide si au moins une erreur bloquante
  if (resultat.erreurs.length > 0) resultat.valide = false;

  return resultat;
}

// ============================================
// NIVEAU 1 : STRUCTURE
// ============================================

function controleStructure(dsn, resultat) {
  // Lignes mal formatees
  for (const l of dsn.lignesMalFormees) {
    addErreur(resultat, 'SYN-01', 'FORMAT', `Ligne ${l.ligne} mal formatee: "${l.contenu}"`);
  }

  // Blocs obligatoires globaux
  for (const [bloc, nom] of Object.entries(BLOCS_OBLIGATOIRES_GLOBAL)) {
    if (!dsn.blocsPresents.has(bloc)) {
      addErreur(resultat, 'STR-01', 'STRUCTURE', `Bloc obligatoire absent: ${bloc} (${nom})`);
    }
  }

  // Blocs obligatoires si au moins 1 salarie
  if (dsn.nbSalaries > 0) {
    for (const [bloc, nom] of Object.entries(BLOCS_OBLIGATOIRES_SI_SALARIE)) {
      if (!dsn.blocsPresents.has(bloc)) {
        addErreur(resultat, 'STR-02', 'STRUCTURE', `Bloc obligatoire (salarie present) absent: ${bloc} (${nom})`);
      }
    }
  }

  // Verifier l'ordre des blocs
  let lastOrderIndex = -1;
  for (const bloc of dsn.blocsOrdre) {
    const orderIndex = ORDRE_BLOCS.indexOf(bloc);
    if (orderIndex === -1) continue; // bloc non dans la liste de reference (ok)
    if (orderIndex < lastOrderIndex) {
      addAvertissement(resultat, 'STR-03', 'STRUCTURE', `Bloc ${bloc} hors ordre (attendu apres ${ORDRE_BLOCS[lastOrderIndex]})`);
    } else {
      lastOrderIndex = orderIndex;
    }
  }

  // Aucun salarie
  if (dsn.nbSalaries === 0) {
    addAvertissement(resultat, 'STR-04', 'STRUCTURE', 'Aucun salarie declare (bloc S21.G00.30 absent)');
  }

  resultat.stats.controles_effectues += dsn.blocsOrdre.length + Object.keys(BLOCS_OBLIGATOIRES_GLOBAL).length;
}

// ============================================
// NIVEAU 2 : FORMAT
// ============================================

function controleFormat(dsn, resultat) {
  for (const r of dsn.rubriquesOrdonnees) {
    const spec = RUBRIQUES_OBLIGATOIRES[r.code];
    if (!spec) continue;

    resultat.stats.controles_effectues++;

    // Valeur vide pour rubrique obligatoire
    if (!r.valeur && r.valeur !== '0') {
      addErreur(resultat, 'FMT-01', 'FORMAT', `${r.code} (${spec.nom}): valeur vide — ligne ${r.ligne}`);
      continue;
    }

    // Controles de format specifiques
    switch (spec.format) {
      case 'siren':
        if (!PATTERNS.siren.test(r.valeur)) {
          addErreur(resultat, 'FMT-02', 'FORMAT', `${r.code} (${spec.nom}): SIREN invalide "${r.valeur}" (9 chiffres attendus) — ligne ${r.ligne}`);
        }
        break;

      case 'siret':
        if (!PATTERNS.siret.test(r.valeur)) {
          addErreur(resultat, 'FMT-03', 'FORMAT', `${r.code} (${spec.nom}): SIRET invalide "${r.valeur}" (14 chiffres attendus) — ligne ${r.ligne}`);
        }
        break;

      case 'nic':
        if (!PATTERNS.nic.test(r.valeur)) {
          addErreur(resultat, 'FMT-04', 'FORMAT', `${r.code} (${spec.nom}): NIC invalide "${r.valeur}" (5 chiffres attendus) — ligne ${r.ligne}`);
        }
        break;

      case 'nir':
        if (!PATTERNS.nir.test(r.valeur)) {
          addErreur(resultat, 'FMT-05', 'FORMAT', `${r.code} (${spec.nom}): NIR invalide "${r.valeur}" (13 chiffres attendus sans cle) — ligne ${r.ligne}`);
        }
        break;

      case 'dateJJMMAAAA':
        if (!PATTERNS.dateJJMMAAAA.test(r.valeur)) {
          addErreur(resultat, 'FMT-06', 'FORMAT', `${r.code} (${spec.nom}): date invalide "${r.valeur}" (JJMMAAAA attendu) — ligne ${r.ligne}`);
        } else {
          const j = parseInt(r.valeur.slice(0, 2)), m = parseInt(r.valeur.slice(2, 4)), a = parseInt(r.valeur.slice(4));
          if (m < 1 || m > 12 || j < 1 || j > 31) {
            addErreur(resultat, 'FMT-07', 'FORMAT', `${r.code} (${spec.nom}): date invalide ${j}/${m}/${a} — ligne ${r.ligne}`);
          }
        }
        break;

      case 'montant':
        if (!PATTERNS.montant.test(r.valeur)) {
          addAvertissement(resultat, 'FMT-08', 'FORMAT', `${r.code} (${spec.nom}): montant "${r.valeur}" format attendu "X.XX" — ligne ${r.ligne}`);
        }
        break;

      case 'heures':
        if (!PATTERNS.heures.test(r.valeur)) {
          addAvertissement(resultat, 'FMT-09', 'FORMAT', `${r.code} (${spec.nom}): heures "${r.valeur}" format attendu "X.XX" — ligne ${r.ligne}`);
        }
        break;

      case 'taux':
        if (!PATTERNS.taux.test(r.valeur)) {
          addAvertissement(resultat, 'FMT-10', 'FORMAT', `${r.code} (${spec.nom}): taux "${r.valeur}" format attendu "X.XX" — ligne ${r.ligne}`);
        }
        break;

      case 'codePostal':
        if (!PATTERNS.codePostal.test(r.valeur)) {
          addErreur(resultat, 'FMT-11', 'FORMAT', `${r.code} (${spec.nom}): code postal invalide "${r.valeur}" — ligne ${r.ligne}`);
        }
        break;

      case 'codePays':
        if (!PATTERNS.codePays.test(r.valeur)) {
          addErreur(resultat, 'FMT-12', 'FORMAT', `${r.code} (${spec.nom}): code pays invalide "${r.valeur}" (2 lettres attendues) — ligne ${r.ligne}`);
        }
        break;

      case 'email':
        if (!PATTERNS.email.test(r.valeur)) {
          addAvertissement(resultat, 'FMT-13', 'FORMAT', `${r.code} (${spec.nom}): email invalide "${r.valeur}" — ligne ${r.ligne}`);
        }
        break;

      case 'pcsEse':
        if (!PATTERNS.pcsEse.test(r.valeur)) {
          addErreur(resultat, 'FMT-14', 'FORMAT', `${r.code} (${spec.nom}): code PCS-ESE invalide "${r.valeur}" (format attendu: 3 chiffres + 1 lettre, ex: 641a) — ligne ${r.ligne}`);
        }
        break;

      case 'codeRisqueAT':
        if (!PATTERNS.codeRisqueAT.test(r.valeur)) {
          addAvertissement(resultat, 'FMT-15', 'FORMAT', `${r.code} (${spec.nom}): code risque AT "${r.valeur}" format non standard — ligne ${r.ligne}`);
        }
        break;

      case 'pattern':
        if (spec.pattern && !spec.pattern.test(r.valeur)) {
          addErreur(resultat, 'FMT-16', 'FORMAT', `${r.code} (${spec.nom}): format invalide "${r.valeur}" — ligne ${r.ligne}`);
        }
        break;

      case 'string':
        if (spec.maxLen && r.valeur.length > spec.maxLen) {
          addAvertissement(resultat, 'FMT-17', 'FORMAT', `${r.code} (${spec.nom}): longueur ${r.valeur.length} depasse max ${spec.maxLen} — ligne ${r.ligne}`);
        }
        if (spec.minLen && r.valeur.length < spec.minLen) {
          addErreur(resultat, 'FMT-18', 'FORMAT', `${r.code} (${spec.nom}): longueur ${r.valeur.length} sous min ${spec.minLen} — ligne ${r.ligne}`);
        }
        break;

      case 'number':
        if (!/^\d+$/.test(r.valeur)) {
          addErreur(resultat, 'FMT-19', 'FORMAT', `${r.code} (${spec.nom}): nombre entier attendu, recu "${r.valeur}" — ligne ${r.ligne}`);
        }
        break;
    }
  }
}

// ============================================
// NIVEAU 3 : VALEURS (tables de codes)
// ============================================

function controleValeurs(dsn, resultat) {
  for (const r of dsn.rubriquesOrdonnees) {
    const spec = RUBRIQUES_OBLIGATOIRES[r.code];
    if (!spec || spec.format !== 'code' || !spec.values) continue;

    resultat.stats.controles_effectues++;

    if (!spec.values.includes(r.valeur)) {
      addErreur(resultat, 'VAL-01', 'VALEUR', `${r.code} (${spec.nom}): code "${r.valeur}" non autorise. Valeurs: ${spec.values.slice(0, 10).join(',')}${spec.values.length > 10 ? '...' : ''} — ligne ${r.ligne}`);
    }
  }
}

// ============================================
// NIVEAU 4 : COMPLETUDE (rubriques obligatoires par salarie)
// ============================================

function controleCompletude(dsn, resultat) {
  // Rubriques obligatoires par individu
  const RUBRIQUES_SALARIE = {
    'S21.G00.30.001': 'NIR',
    'S21.G00.30.002': 'Nom',
    'S21.G00.30.004': 'Prenoms',
    'S21.G00.30.005': 'Sexe',
    'S21.G00.30.006': 'Date naissance',
    'S21.G00.30.013': 'Codification UE',
    'S21.G00.30.015': 'Pays naissance',
    'S21.G00.40.001': 'Date debut contrat',
    'S21.G00.40.002': 'Statut conventionnel',
    'S21.G00.40.003': 'Statut categoriel',
    'S21.G00.40.004': 'Code PCS-ESE',
    'S21.G00.40.006': 'Nature contrat',
    'S21.G00.40.008': 'Dispositif politique publique',
    'S21.G00.40.009': 'Numero contrat',
    'S21.G00.40.011': 'Unite quotite',
    'S21.G00.40.012': 'Quotite reference',
    'S21.G00.40.013': 'Quotite contrat',
    'S21.G00.40.014': 'Modalite temps',
    'S21.G00.40.018': 'Regime maladie',
    'S21.G00.40.019': 'Lieu travail SIRET',
    'S21.G00.40.020': 'Regime vieillesse',
    'S21.G00.40.036': 'Emplois multiples',
    'S21.G00.40.037': 'Employeurs multiples',
    'S21.G00.40.039': 'Regime AT',
    'S21.G00.40.040': 'Code risque AT',
    'S21.G00.40.043': 'Taux AT',
    'S21.G00.50.001': 'Date versement',
    'S21.G00.50.002': 'Net fiscal',
    'S21.G00.50.004': 'Net verse',
    'S21.G00.50.006': 'Taux PAS',
    'S21.G00.50.007': 'Type taux PAS',
  };

  for (const individu of dsn.individus) {
    const codesPresents = new Set(individu.rubriques.map(r => r.code));
    const nomSalarie = individu.rubriques.find(r => r.code === 'S21.G00.30.002')?.valeur || individu.nir;

    for (const [code, nom] of Object.entries(RUBRIQUES_SALARIE)) {
      resultat.stats.controles_effectues++;
      if (!codesPresents.has(code)) {
        addErreur(resultat, 'CMP-01', 'COMPLETUDE', `Salarie ${nomSalarie}: rubrique obligatoire absente ${code} (${nom})`);
        resultat.stats.rubriques_manquantes.push(code);
      }
    }

    // Blocs obligatoires par salarie
    for (const [bloc, nom] of Object.entries(BLOCS_OBLIGATOIRES_PAR_SALARIE)) {
      resultat.stats.controles_effectues++;
      if (!individu.blocs.has(bloc)) {
        addErreur(resultat, 'CMP-02', 'COMPLETUDE', `Salarie ${nomSalarie}: bloc obligatoire absent ${bloc} (${nom})`);
      }
    }

    // Retraite complementaire (S21.G00.71)
    if (!individu.blocs.has('S21.G00.71')) {
      addErreur(resultat, 'CMP-03', 'COMPLETUDE', `Salarie ${nomSalarie}: bloc retraite complementaire absent (S21.G00.71)`);
    }

    // Revenu net social (S21.G00.58 type 03) obligatoire
    const types58 = individu.rubriques.filter(r => r.code === 'S21.G00.58.003').map(r => r.valeur);
    if (!types58.includes('03')) {
      addErreur(resultat, 'CMP-04', 'COMPLETUDE', `Salarie ${nomSalarie}: revenu net social (S21.G00.58 type 03) obligatoire absent`);
    }

    // Types remuneration obligatoires : 001 (brut non plafonne), 002 (brut chomage), 010 (salaire de base)
    const types51 = individu.rubriques.filter(r => r.code === 'S21.G00.51.011').map(r => r.valeur);
    for (const typeOblig of ['001', '002', '010']) {
      resultat.stats.controles_effectues++;
      if (!types51.includes(typeOblig)) {
        addErreur(resultat, 'CMP-05', 'COMPLETUDE', `Salarie ${nomSalarie}: remuneration type ${typeOblig} obligatoire absente`);
      }
    }

    // Bases assujetties obligatoires : 02 (plafonnee), 03 (deplafonnee), 04 (CSG), 11 (chomage), 31 (AT)
    const types78 = individu.rubriques.filter(r => r.code === 'S21.G00.78.001').map(r => r.valeur);
    for (const baseOblig of ['02', '03', '04', '11', '31']) {
      resultat.stats.controles_effectues++;
      if (!types78.includes(baseOblig)) {
        addAvertissement(resultat, 'CMP-06', 'COMPLETUDE', `Salarie ${nomSalarie}: base assujettie ${baseOblig} attendue absente`);
      }
    }

    // Au moins une activite (S21.G00.53.001 type 01 = travail)
    const typesActivite = individu.rubriques.filter(r => r.code === 'S21.G00.53.001').map(r => r.valeur);
    if (!typesActivite.includes('01')) {
      addAvertissement(resultat, 'CMP-07', 'COMPLETUDE', `Salarie ${nomSalarie}: activite type 01 (travail remunere) attendue absente`);
    }
  }
}

// ============================================
// NIVEAU 5 : COHERENCE
// ============================================

function controleCoherence(dsn, resultat) {
  // Coherence total rubriques S90
  const nbDeclare = parseInt(dsn.rubriquesMap.get('S90.G00.90.001')?.[0]?.valeur || '0');
  if (nbDeclare > 0 && Math.abs(dsn.nbRubriques - nbDeclare) > 1) {
    addErreur(resultat, 'COH-01', 'COHERENCE', `Nombre rubriques : declare=${nbDeclare}, reel=${dsn.nbRubriques}`);
  }
  resultat.stats.controles_effectues++;

  // SIREN coherent entre S10.G00.01.001 et S21.G00.06.001
  const sirenEmetteur = dsn.rubriquesMap.get('S10.G00.01.001')?.[0]?.valeur;
  const sirenEntreprise = dsn.rubriquesMap.get('S21.G00.06.001')?.[0]?.valeur;
  if (sirenEmetteur && sirenEntreprise && sirenEmetteur !== sirenEntreprise) {
    addAvertissement(resultat, 'COH-02', 'COHERENCE', `SIREN emetteur (${sirenEmetteur}) different de SIREN entreprise (${sirenEntreprise})`);
  }
  resultat.stats.controles_effectues++;

  // NIC coherent entre S10.G00.01.002 et S21.G00.11.001
  const nicEmetteur = dsn.rubriquesMap.get('S10.G00.01.002')?.[0]?.valeur;
  const nicEtablissement = dsn.rubriquesMap.get('S21.G00.11.001')?.[0]?.valeur;
  if (nicEmetteur && nicEtablissement && nicEmetteur !== nicEtablissement) {
    addAvertissement(resultat, 'COH-03', 'COHERENCE', `NIC emetteur (${nicEmetteur}) different de NIC etablissement (${nicEtablissement})`);
  }
  resultat.stats.controles_effectues++;

  // Code pays France interdit pour adresse en France (erreur M641 du bilan DSN-CTL)
  for (const code of ['S10.G00.01.007', 'S21.G00.06.010', 'S21.G00.30.011']) {
    const vals = dsn.rubriquesMap.get(code);
    if (vals) {
      for (const v of vals) {
        if (v.valeur === 'FR') {
          addErreur(resultat, 'COH-04', 'COHERENCE', `${code}: code pays "FR" interdit pour adresse en France (rubrique ne doit pas etre presente) — ligne ${v.ligne}`);
        }
      }
    }
    resultat.stats.controles_effectues++;
  }

  // Lieu de travail SIRET = SIREN + NIC
  if (sirenEntreprise && nicEtablissement) {
    const siretAttendu = sirenEntreprise + nicEtablissement;
    const siretLieuTravail = dsn.rubriquesMap.get('S21.G00.40.019');
    if (siretLieuTravail) {
      for (const v of siretLieuTravail) {
        if (v.valeur !== siretAttendu) {
          addAvertissement(resultat, 'COH-05', 'COHERENCE', `SIRET lieu de travail "${v.valeur}" different du SIREN+NIC "${siretAttendu}" — ligne ${v.ligne}`);
        }
        resultat.stats.controles_effectues++;
      }
    }
  }

  // Net fiscal >= Net verse
  for (const individu of dsn.individus) {
    const netFiscal = parseFloat(individu.rubriques.find(r => r.code === 'S21.G00.50.002')?.valeur || '0');
    const netVerse = parseFloat(individu.rubriques.find(r => r.code === 'S21.G00.50.004')?.valeur || '0');
    if (netFiscal > 0 && netVerse > 0 && netVerse > netFiscal * 1.1) {
      const nom = individu.rubriques.find(r => r.code === 'S21.G00.30.002')?.valeur || individu.nir;
      addAvertissement(resultat, 'COH-06', 'COHERENCE', `Salarie ${nom}: net verse (${netVerse}) superieur au net fiscal (${netFiscal})`);
    }
    resultat.stats.controles_effectues++;
  }

  // Date debut contrat avant date de declaration
  const datePrincipale = dsn.rubriquesMap.get('S20.G00.05.005')?.[0]?.valeur;
  if (datePrincipale) {
    const moisDecl = parseInt(datePrincipale.slice(0, 2));
    const anneeDecl = parseInt(datePrincipale.slice(4));
    for (const individu of dsn.individus) {
      const dateContrat = individu.rubriques.find(r => r.code === 'S21.G00.40.001')?.valeur;
      if (dateContrat && dateContrat.length === 8) {
        const jourC = parseInt(dateContrat.slice(0, 2));
        const moisC = parseInt(dateContrat.slice(2, 4));
        const anneeC = parseInt(dateContrat.slice(4));
        // Contrat commence apres la fin de la periode declaree = avertissement
        if (anneeC > anneeDecl || (anneeC === anneeDecl && moisC > moisDecl)) {
          const nom = individu.rubriques.find(r => r.code === 'S21.G00.30.002')?.valeur || individu.nir;
          addAvertissement(resultat, 'COH-07', 'COHERENCE', `Salarie ${nom}: date contrat ${jourC}/${moisC}/${anneeC} posterieure a la periode declaree ${moisDecl}/${anneeDecl}`);
        }
      }
      resultat.stats.controles_effectues++;
    }
  }
}

// ============================================
// NIVEAU 6 : METIER
// ============================================

function controleMetier(dsn, resultat) {
  // OPS URSSAF = SIRET 14 chars (pas un code court)
  const opsVals = dsn.rubriquesMap.get('S21.G00.20.001');
  if (opsVals) {
    for (const v of opsVals) {
      if (v.valeur.length < 14 && v.valeur.length > 0) {
        addErreur(resultat, 'MET-01', 'METIER', `S21.G00.20.001: identifiant OPS "${v.valeur}" doit etre un SIRET (14 caracteres) — ligne ${v.ligne}`);
      }
      resultat.stats.controles_effectues++;
    }
  }

  // OPS Bordereau = SIRET 14 chars
  const opsBordVals = dsn.rubriquesMap.get('S21.G00.22.001');
  if (opsBordVals) {
    for (const v of opsBordVals) {
      if (v.valeur.length < 14 && v.valeur.length > 0) {
        addErreur(resultat, 'MET-02', 'METIER', `S21.G00.22.001: identifiant OPS bordereau "${v.valeur}" doit etre un SIRET (14 caracteres) — ligne ${v.ligne}`);
      }
      resultat.stats.controles_effectues++;
    }
  }

  // OPS Cotisations = SIRET 14 chars
  const opsCotisVals = dsn.rubriquesMap.get('S21.G00.81.002');
  if (opsCotisVals) {
    for (const v of opsCotisVals) {
      if (v.valeur.length < 14 && v.valeur.length > 0) {
        addErreur(resultat, 'MET-03', 'METIER', `S21.G00.81.002: identifiant OPS cotisation "${v.valeur}" doit etre un SIRET (14 caracteres) — ligne ${v.ligne}`);
      }
      resultat.stats.controles_effectues++;
    }
  }

  // Montant versement OPS > 0
  const montantsVersement = dsn.rubriquesMap.get('S21.G00.20.005');
  if (montantsVersement) {
    for (const v of montantsVersement) {
      const montant = parseFloat(v.valeur);
      if (isNaN(montant) || montant <= 0) {
        addAvertissement(resultat, 'MET-04', 'METIER', `S21.G00.20.005: montant versement OPS nul ou negatif (${v.valeur}) — ligne ${v.ligne}`);
      }
      resultat.stats.controles_effectues++;
    }
  }

  // CDD sans date fin prevue
  for (const individu of dsn.individus) {
    const natureContrat = individu.rubriques.find(r => r.code === 'S21.G00.40.006')?.valeur;
    const dateFinPrev = individu.rubriques.find(r => r.code === 'S21.G00.40.010')?.valeur;
    const nom = individu.rubriques.find(r => r.code === 'S21.G00.30.002')?.valeur || individu.nir;

    if (natureContrat === '02' && !dateFinPrev) {
      addErreur(resultat, 'MET-05', 'METIER', `Salarie ${nom}: CDD (nature 02) sans date fin previsionnelle (S21.G00.40.010)`);
    }
    resultat.stats.controles_effectues++;

    // Taux PAS = 0 mais montant PAS > 0
    const tauxPAS = parseFloat(individu.rubriques.find(r => r.code === 'S21.G00.50.006')?.valeur || '0');
    const montantPAS = parseFloat(individu.rubriques.find(r => r.code === 'S21.G00.50.009')?.valeur || '0');
    if (tauxPAS === 0 && montantPAS > 0) {
      addAvertissement(resultat, 'MET-06', 'METIER', `Salarie ${nom}: taux PAS = 0% mais montant PAS = ${montantPAS}`);
    }
    if (tauxPAS > 0 && montantPAS === 0) {
      addAvertissement(resultat, 'MET-07', 'METIER', `Salarie ${nom}: taux PAS = ${tauxPAS}% mais montant PAS = 0`);
    }
    resultat.stats.controles_effectues++;

    // Quotite contrat > quotite reference = suspect
    const quotiteRef = parseFloat(individu.rubriques.find(r => r.code === 'S21.G00.40.012')?.valeur || '0');
    const quotiteCtr = parseFloat(individu.rubriques.find(r => r.code === 'S21.G00.40.013')?.valeur || '0');
    if (quotiteRef > 0 && quotiteCtr > quotiteRef * 1.1) {
      addAvertissement(resultat, 'MET-08', 'METIER', `Salarie ${nom}: quotite contrat (${quotiteCtr}) superieure a la reference (${quotiteRef})`);
    }
    resultat.stats.controles_effectues++;

    // Modalite temps partiel mais quotite = temps plein
    const modaliteTemps = individu.rubriques.find(r => r.code === 'S21.G00.40.014')?.valeur;
    if (modaliteTemps === '02' && quotiteCtr >= quotiteRef && quotiteRef > 0) {
      addAvertissement(resultat, 'MET-09', 'METIER', `Salarie ${nom}: modalite temps partiel (02) mais quotite = temps plein`);
    }
    resultat.stats.controles_effectues++;
  }

  // Version norme coherente avec periode
  const normeVersion = dsn.rubriquesMap.get('S10.G00.00.006')?.[0]?.valeur;
  if (normeVersion && datePeriodeFromDSN(dsn)) {
    const { annee } = datePeriodeFromDSN(dsn);
    if (annee >= 2026 && normeVersion === 'P25V01') {
      addAvertissement(resultat, 'MET-10', 'METIER', `Norme ${normeVersion} utilisee pour une periode ${annee} (P26V01 attendue)`);
    }
    if (annee <= 2025 && normeVersion === 'P26V01') {
      addAvertissement(resultat, 'MET-11', 'METIER', `Norme ${normeVersion} utilisee pour une periode ${annee} (P25V01 attendue)`);
    }
    resultat.stats.controles_effectues++;
  }
}

function datePeriodeFromDSN(dsn) {
  const dateStr = dsn.rubriquesMap.get('S20.G00.05.005')?.[0]?.valeur;
  if (!dateStr || dateStr.length !== 8) return null;
  return { jour: parseInt(dateStr.slice(0, 2)), mois: parseInt(dateStr.slice(2, 4)), annee: parseInt(dateStr.slice(4)) };
}

// ============================================
// HELPERS
// ============================================

function addErreur(resultat, code, type, message) {
  resultat.erreurs.push({ code, type, message });
}

function addAvertissement(resultat, code, type, message) {
  resultat.avertissements.push({ code, type, message });
}

// ============================================
// RAPPORT
// ============================================

function genererRapport(resultat) {
  let rapport = '='.repeat(60) + '\n';
  rapport += '  RAPPORT DE VALIDATION DSN - NEXUS (equivalent DSN-CTL)\n';
  rapport += '='.repeat(60) + '\n\n';

  rapport += `Statut: ${resultat.valide ? 'VALIDE' : 'INVALIDE'}\n`;
  rapport += `Rubriques analysees: ${resultat.stats.nb_rubriques}\n`;
  rapport += `Salaries declares: ${resultat.stats.nb_salaries}\n`;
  rapport += `Controles effectues: ${resultat.stats.controles_effectues}\n`;
  rapport += `Erreurs bloquantes: ${resultat.erreurs.length}\n`;
  rapport += `Avertissements: ${resultat.avertissements.length}\n\n`;

  if (resultat.erreurs.length > 0) {
    rapport += '-'.repeat(50) + '\n';
    rapport += `ERREURS BLOQUANTES (${resultat.erreurs.length})\n`;
    rapport += '-'.repeat(50) + '\n';
    resultat.erreurs.forEach((e, i) => {
      rapport += `${i + 1}. [${e.code}] [${e.type}] ${e.message}\n`;
    });
    rapport += '\n';
  }

  if (resultat.avertissements.length > 0) {
    rapport += '-'.repeat(50) + '\n';
    rapport += `AVERTISSEMENTS (${resultat.avertissements.length})\n`;
    rapport += '-'.repeat(50) + '\n';
    resultat.avertissements.forEach((a, i) => {
      rapport += `${i + 1}. [${a.code}] [${a.type}] ${a.message}\n`;
    });
    rapport += '\n';
  }

  if (resultat.valide) {
    rapport += '\nLa DSN est conforme aux controles NEXUS (equivalent DSN-CTL).\n';
    rapport += 'Vous pouvez la deposer sur net-entreprises.fr.\n';
  } else {
    rapport += '\nCorrigez les erreurs bloquantes avant de deposer sur net-entreprises.fr.\n';
  }

  // Blocs trouves
  rapport += '\nBlocs detectes: ' + resultat.stats.blocs_trouves.join(', ') + '\n';

  return rapport;
}

export {
  validerDSN,
  genererRapport
};
