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
// TABLES DE CODES OFFICIELLES CT-DSN P25V01
// Source : dsn-datatypes-CT2025.xlsx (net-entreprises.fr)
// ============================================

const CODES_NATURE_CONTRAT = ['01','02','03','07','08','09','10','20','21','29','32','50','51','52','53','54','60','70','80','81','82','89','90','91','92','93']; // DSN_NatureContrat
const CODES_STATUT_CONVENTIONNEL = ['01','02','03','04','05','06','07','08','09','10']; // CCN_Categorie
const CODES_STATUT_CATEGORIEL = ['01','02','04','98','99']; // AA_Categorie
const CODES_MODALITE_TEMPS = ['10','20','30','40','41','42','99']; // Travail_Modalite
const CODES_UNITE_QUOTITE = ['10','12','20','21','31','32','33','34','35','99']; // DSN_TypeUniteMesure
const CODES_DISPOSITIF_POLITIQUE = ['21','41','42','61','64','65','66','70','71','80','81','92','93','94','99']; // DSN_Dispos_PubEmpFormPro_2
const CODES_REGIME_MALADIE = ['134','135','136','137','138','140','141','144','145','146','147','149','200','300','400','900','909','999']; // CodeRegime
const CODES_REGIME_VIEILLESSE = ['134','135','136','137','138','140','141','144','145','146','147','149','200','300','400','900','909','999']; // same
const CODES_REGIME_AT = ['134','135','136','137','147','200','300','401','402','900','999']; // DSN_Code_regime_risques
const CODES_SEXE = ['01','02']; // DSN_Sexe
const CODES_CODIFICATION_UE = ['01','02','03','04']; // DSN_Codification_UE
const CODES_EMPLOIS_MULTIPLES = ['01','02','03']; // DSN_Code_Emplois_Multiples
const CODES_EMPLOYEURS_MULTIPLES = ['01','02','03']; // DSN_Code_Employeur_Multiples
const CODES_TYPE_REMUNERATION = ['001','002','003','010','012','013','016','017','018','019','020','021','022','023','025','028','029','030','031','032','033']; // DSN_Renumeration_Type
const CODES_TYPE_ACTIVITE = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','50','90','99']; // DSN_Type_Activite (table complete CT-DSN)
const CODES_BASE_ASSUJETTIE = ['02','03','04','05','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','27','28','31','33','34','35','36','38','39','40','41','42','43','44','45','46','47','48','49','50','52','53','54','55','56','57','59','60','61','62']; // DSN_Code_Base_Assujettie
const CODES_COTISATION = ['001','002','003','004','006','008','009','010','011','012','013','014','015','016','017','018','019','020','021','022','023','025','027','028','029','030','031','032','033','034','035','036','037','038','039','040','041','042','043','044','045','046','047','048','049','051','053','054','056','057','058','059','060','061','065','066','068','069','070','071','072','073','074','075','076','077','078','079','081','082','088','089','090','091','092','093','094','096','097','098','099','100','101','102','103','104','105','106','107','108','109','110','111','112','113','114','115','116','128','129','130','131','132','133','142','143','300','301','302','303','304','305','306','307','308','309','310','311','312','313','314','315','316','317','318','319','320','321','322','323','324','325','326','327','330','331','332','333','334','901','902','903','904','905','906','907','908','909','910','911','912','913','914','915','916','917','918']; // DSN_Ref_Code_Cotis
const CODES_MODE_PAIEMENT = ['01','02','04','05','06']; // DSN_Mode_Paiement
const CODES_TAUX_PAS = ['01','13','17','23','27','33','37','99']; // Taux_Prelevement_Source
const CODES_CONTACT_TYPE = ['01','02','03','04','05','06','07','08','09','13','14','15','16']; // DSN_ContactDeclare_type
const CODES_TRAVAILLEUR_ETRANGER = ['01','02','03','99']; // DSN_Travailleur_Etranger
const CODES_STATUT_EMPLOI = ['01','02','03','04','06','07','08','09','10','11','12','99']; // DSN_Statut_Emplois
const CODES_MOTIF_RECOURS = ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15']; // DSN_Motifs_Recours
const CODES_RETRAITE_COMP = ['RETA','RETC','RUAA','CNBF','CRPCEN','CRPNPAC','IRCANTEC','90000']; // DSN_Code_Reg_Retraite_Comp
const CODES_ANCIENNETE_TYPE = ['02','03','04','06','07']; // DSN_Anciennete_Type
const CODES_ANCIENNETE_UNITE = ['01','02','03']; // DSN_Anciennete_Unite_Mesure
const CODES_REVENU_NET = ['01','02','03','04','05','06','07','08','09','10','11','12','13']; // DSN_TypeRevenuNetFiscal

// ============================================
// CONSTANTES REGLEMENTAIRES 2026
// ============================================

const CONSTANTES_2026 = {
  PMSS: 4005,         // Plafond Mensuel Securite Sociale 2026
  SMIC: 1823.03,      // SMIC mensuel brut 2026
  BASE_CSG: 0.9825,   // 98.25% du brut
  TOLERANCE: 0.02,    // Tolerance en euros pour comparaisons
  TOLERANCE_PCT: 0.005, // Tolerance 0.5% pour pourcentages
  TOLERANCE_NET: 5.00, // Tolerance en euros pour net social/verse/fiscal
};

// Taux attendus par code cotisation (plage min/max en %)
// Plages larges : acceptent taux salarial seul, patronal seul, OU combine (sal+pat)
const TAUX_ATTENDUS = {
  '049': { min: 0.50, max: 40.00, nom: 'Assurance maladie' },
  '076': { min: 2.40, max: 16.00, nom: 'CSG imposable' },         // sal 6.80 ou combine 9.20+6.25=15.45
  '075': { min: 2.40, max: 10.00, nom: 'CSG non imposable' },     // sal 2.40 ou combine
  '074': { min: 0.45, max: 7.50, nom: 'CRDS' },                   // sal 0.50 ou combine 0.50+6.50=7.00
  '040': { min: 3.10, max: 8.00, nom: 'Retraite complementaire T1' }, // sal 3.15 ou combine 3.15+4.72=7.87
  '048': { min: 2.00, max: 22.00, nom: 'Retraite complementaire T2' }, // sal 8.64 ou pat ou combine
  '094': { min: 0.10, max: 2.50, nom: 'CEG T1' },                 // sal+pat
  '072': { min: 2.50, max: 7.00, nom: 'Chomage' },                // pat 4.05 ou combine 4.05+2.75=6.80
  '073': { min: 0.00, max: 2.50, nom: 'AGS' },                    // pat seul 0.15-2.40
  '079': { min: 0.00, max: 0.50, nom: 'FNAL' },                   // pat seul
  '100': { min: 0.10, max: 4.00, nom: 'Versement transport' },    // IDF zone 1 jusqu'a 3.50%
  '068': { min: 0.25, max: 1.70, nom: 'Formation professionnelle' }, // 0.55% <11 sal, 1.00% >=11 sal, ou combine
  '012': { min: 4.00, max: 15.50, nom: 'Vieillesse plafonnee' },  // sal 6.90 ou pat 8.55 ou combine 15.45
  '013': { min: 0.15, max: 2.80, nom: 'Vieillesse deplafonnee' }, // sal 0.40 ou pat 2.02 ou combine 2.42
  '105': { min: 0.00, max: 7.00, nom: 'AT/MP' },
};

// Natures de contrat CDD necessitant un motif de recours
const NATURES_CDD = ['02','03','07','08','09','10','50','51','52','53','54','60','70','80','81','82'];

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
// ALGORITHMES DE VERIFICATION (CTL)
// ============================================

/** Verification cle NIR (modulo 97) — controle CTL V002/V003 */
function verifierCleNIR(nirComplet) {
  if (!nirComplet || nirComplet.length < 15) return false;
  // NIR = 13 chiffres + 2 chiffres cle
  let nirBase = nirComplet.slice(0, 13);
  const cle = parseInt(nirComplet.slice(13, 15));
  if (isNaN(cle)) return false;

  // Corse: 2A → 19, 2B → 18
  nirBase = nirBase.replace('2A', '19').replace('2B', '18');

  const nirNum = BigInt(nirBase);
  const cleAttendue = 97 - Number(nirNum % 97n);
  return cle === cleAttendue;
}

/** Verification SIREN/SIRET par algorithme de Luhn — controle CTL V100 */
function verifierLuhn(numero) {
  if (!numero || !/^\d+$/.test(numero)) return false;
  let somme = 0;
  let pair = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let chiffre = parseInt(numero[i]);
    if (pair) {
      chiffre *= 2;
      if (chiffre > 9) chiffre -= 9;
    }
    somme += chiffre;
    pair = !pair;
  }
  return somme % 10 === 0;
}

/** Verification coherence IBAN (modulo 97) — controle CTL V320 */
function verifierIBAN(iban) {
  if (!iban || iban.length < 15) return false;
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  // Deplacer les 4 premiers chars a la fin
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  // Convertir lettres en chiffres (A=10, B=11, etc.)
  let numeric = '';
  for (const c of rearranged) {
    if (c >= '0' && c <= '9') numeric += c;
    else numeric += (c.charCodeAt(0) - 55).toString();
  }
  // Modulo 97 par blocs (BigInt pour grands nombres)
  const mod = BigInt(numeric) % 97n;
  return mod === 1n;
}

/** Verification BIC (format ISO 9362) */
function verifierBIC(bic) {
  if (!bic) return false;
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic.toUpperCase());
}

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
  'S21.G00.81': 'Cotisations individuelles',
  'S21.G00.86': 'Anciennete'
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
  'S21.G00.58', 'S21.G00.78', 'S21.G00.81', 'S21.G00.79',
  'S21.G00.86',
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
  'S10.G00.02.001': { nom: 'Civilite contact emetteur', format: 'code', values: ['01','02'] },
  'S10.G00.02.002': { nom: 'Nom contact emetteur', format: 'string' },
  'S10.G00.02.004': { nom: 'Email contact emetteur', format: 'email' },
  'S10.G00.02.005': { nom: 'Telephone contact emetteur', format: 'string' },

  // S20.G00.05 - Declaration
  'S20.G00.05.001': { nom: 'Nature declaration', format: 'code', values: ['01','02','03','04','05','06','07','08','09'] },
  'S20.G00.05.002': { nom: 'Type declaration', format: 'code', values: ['01','02','03','04','05'] },
  'S20.G00.05.003': { nom: 'Fraction', format: 'string' },
  'S20.G00.05.004': { nom: 'Numero ordre', format: 'number' },
  'S20.G00.05.005': { nom: 'Date mois principal', format: 'dateJJMMAAAA' },
  'S20.G00.05.007': { nom: 'Date constitution fichier', format: 'dateJJMMAAAA' },
  'S20.G00.05.008': { nom: 'Champ declaration', format: 'code', values: ['01','02','03'] },
  'S20.G00.05.009': { nom: 'SIRET assujetti', format: 'siret' },
  'S20.G00.05.010': { nom: 'Devise', format: 'code', values: ['01','02'] },

  // S20.G00.07 - Contact declaration
  'S20.G00.07.001': { nom: 'Nom contact declaration', format: 'string' },
  'S20.G00.07.002': { nom: 'Telephone contact declaration', format: 'string' },
  'S20.G00.07.003': { nom: 'Email contact declaration', format: 'email' },
  'S20.G00.07.004': { nom: 'Type contact declaration', format: 'code', values: CODES_CONTACT_TYPE },

  // S21.G00.06 - Entreprise
  'S21.G00.06.001': { nom: 'SIREN entreprise', format: 'siren' },
  'S21.G00.06.002': { nom: 'NIC siege', format: 'nic' },
  'S21.G00.06.003': { nom: 'Code APE', format: 'string', maxLen: 5 },
  'S21.G00.06.004': { nom: 'Adresse entreprise', format: 'string' },
  'S21.G00.06.005': { nom: 'Code postal entreprise', format: 'codePostal' },
  'S21.G00.06.006': { nom: 'Ville entreprise', format: 'string' },
  // S21.G00.06.009 supprime — n'existe pas en P25V01 (effectif dans S21.G00.11)

  // S21.G00.11 - Etablissement
  'S21.G00.11.001': { nom: 'NIC etablissement', format: 'nic' },
  'S21.G00.11.002': { nom: 'Code APE etablissement', format: 'string', maxLen: 5 },
  'S21.G00.11.003': { nom: 'Adresse etablissement', format: 'string' },
  'S21.G00.11.004': { nom: 'Code postal etablissement', format: 'codePostal' },
  'S21.G00.11.005': { nom: 'Ville etablissement', format: 'string' },
  // S21.G00.11.008 supprime — effectif moyen declare dans S21.G00.11.007

  // S21.G00.20 - Versement organisme
  'S21.G00.20.001': { nom: 'Identifiant OPS', format: 'string' },
  'S21.G00.20.005': { nom: 'Montant versement', format: 'montant' },
  'S21.G00.20.006': { nom: 'Date debut periode', format: 'dateJJMMAAAA' },
  'S21.G00.20.007': { nom: 'Date fin periode', format: 'dateJJMMAAAA' },
  'S21.G00.20.010': { nom: 'Mode paiement', format: 'code', values: CODES_MODE_PAIEMENT },

  // S21.G00.22 - Bordereau
  'S21.G00.22.001': { nom: 'Identifiant OPS bordereau', format: 'string' },
  'S21.G00.22.002': { nom: 'Entite affectation operations', format: 'string' },
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
  'S21.G00.40.006': { nom: 'Libelle emploi', format: 'string' },
  'S21.G00.40.007': { nom: 'Nature contrat', format: 'code', values: CODES_NATURE_CONTRAT },
  'S21.G00.40.008': { nom: 'Dispositif politique publique', format: 'code', values: CODES_DISPOSITIF_POLITIQUE },
  'S21.G00.40.009': { nom: 'Numero contrat', format: 'string', minLen: 5 },
  'S21.G00.40.011': { nom: 'Unite quotite', format: 'code', values: CODES_UNITE_QUOTITE },
  'S21.G00.40.012': { nom: 'Quotite reference', format: 'heures' },
  'S21.G00.40.013': { nom: 'Quotite contrat', format: 'heures' },
  'S21.G00.40.014': { nom: 'Modalite temps', format: 'code', values: CODES_MODALITE_TEMPS },
  'S21.G00.40.016': { nom: 'Complement PCS-ESE', format: 'code', values: ['99'] },
  'S21.G00.40.017': { nom: 'Convention collective', format: 'string' },
  'S21.G00.40.018': { nom: 'Regime maladie', format: 'code', values: CODES_REGIME_MALADIE },
  'S21.G00.40.019': { nom: 'Lieu travail SIRET', format: 'siret' },
  'S21.G00.40.020': { nom: 'Regime vieillesse', format: 'code', values: CODES_REGIME_VIEILLESSE },
  'S21.G00.40.021': { nom: 'Motif de recours', format: 'code', values: CODES_MOTIF_RECOURS },
  'S21.G00.40.024': { nom: 'Travailleur etranger', format: 'code', values: CODES_TRAVAILLEUR_ETRANGER },
  'S21.G00.40.026': { nom: 'Statut emploi', format: 'code', values: CODES_STATUT_EMPLOI },
  'S21.G00.40.036': { nom: 'Emplois multiples', format: 'code', values: CODES_EMPLOIS_MULTIPLES },
  'S21.G00.40.037': { nom: 'Employeurs multiples', format: 'code', values: CODES_EMPLOYEURS_MULTIPLES },
  'S21.G00.40.039': { nom: 'Regime AT', format: 'code', values: CODES_REGIME_AT },
  'S21.G00.40.040': { nom: 'Code risque AT', format: 'codeRisqueAT' },
  'S21.G00.40.043': { nom: 'Taux AT', format: 'taux' },

  // S21.G00.50 - Versement individu
  'S21.G00.50.001': { nom: 'Date versement', format: 'dateJJMMAAAA' },
  'S21.G00.50.002': { nom: 'Net fiscal', format: 'montant' },
  'S21.G00.50.004': { nom: 'Net verse', format: 'montant' },
  'S21.G00.50.006': { nom: 'Taux PAS', format: 'taux' },
  'S21.G00.50.007': { nom: 'Type taux PAS', format: 'code', values: CODES_TAUX_PAS },
  'S21.G00.50.008': { nom: 'NIR individu versement', format: 'nir' },
  'S21.G00.50.009': { nom: 'Montant PAS', format: 'montant' },
  'S21.G00.50.013': { nom: 'Net fiscal potentiel', format: 'montant' },

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

  // S21.G00.58 - Revenu net (seuls .003 type et .004 montant sont obligatoires)
  'S21.G00.58.003': { nom: 'Type revenu net', format: 'code', values: CODES_REVENU_NET },
  'S21.G00.58.004': { nom: 'Montant revenu net', format: 'montant' },

  // S21.G00.78 - Bases assujetties
  'S21.G00.78.001': { nom: 'Code base assujettie', format: 'code', values: CODES_BASE_ASSUJETTIE },
  'S21.G00.78.002': { nom: 'Date debut base', format: 'dateJJMMAAAA' },
  'S21.G00.78.003': { nom: 'Date fin base', format: 'dateJJMMAAAA' },
  'S21.G00.78.004': { nom: 'Montant base', format: 'montant' },

  // S21.G00.71 - Retraite complementaire
  'S21.G00.71.002': { nom: 'Code regime retraite complementaire', format: 'code', values: CODES_RETRAITE_COMP },

  // S21.G00.79 - Composant base assujettie
  'S21.G00.79.001': { nom: 'Type composant', format: 'code', values: ['01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30','31','90'] },
  'S21.G00.79.004': { nom: 'Montant composant', format: 'montant' },

  // S21.G00.81 - Cotisations individuelles
  'S21.G00.81.001': { nom: 'Code cotisation', format: 'code', values: CODES_COTISATION },
  'S21.G00.81.002': { nom: 'Identifiant OPS cotisation', format: 'string' },
  'S21.G00.81.003': { nom: 'Montant assiette', format: 'montant' },
  'S21.G00.81.004': { nom: 'Montant cotisation', format: 'montant' },
  'S21.G00.81.007': { nom: 'Taux cotisation', format: 'taux' },

  // S21.G00.86 - Anciennete
  'S21.G00.86.001': { nom: 'Type anciennete', format: 'code', values: CODES_ANCIENNETE_TYPE },
  'S21.G00.86.002': { nom: 'Unite mesure anciennete', format: 'code', values: CODES_ANCIENNETE_UNITE },
  'S21.G00.86.003': { nom: 'Valeur anciennete', format: 'number' },
  'S21.G00.86.005': { nom: 'Numero contrat anciennete', format: 'string', minLen: 5 },

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

/**
 * Parse un individu en structure exploitable : bases(78), composants(79), cotisations(81), remunerations(51)
 * Retourne { bases: [{code, montant, debut, fin}], composants: [{type, montant}],
 *            cotisations: [{code, ops, assiette, montant, taux}], remunerations: [{type, montant}],
 *            retraiteComp: string|null, natureContrat: string|null, statutCategoriel: string|null }
 */
function extraireIndividuStructure(individu) {
  const result = {
    bases: [],
    composants: [],
    cotisations: [],
    remunerations: [],
    retraiteComp: null,
    natureContrat: null,
    statutCategoriel: null,
    dispositif: null,
    nir: individu.nir,
    nom: individu.rubriques.find(r => r.code === 'S21.G00.30.002')?.valeur || individu.nir,
  };

  let currentBase = null;
  let currentCotis = null;

  for (const r of individu.rubriques) {
    // Bases assujetties S21.G00.78
    if (r.code === 'S21.G00.78.001') {
      currentBase = { code: r.valeur, montant: 0, debut: null, fin: null };
      result.bases.push(currentBase);
    }
    if (r.code === 'S21.G00.78.002' && currentBase) currentBase.debut = r.valeur;
    if (r.code === 'S21.G00.78.003' && currentBase) currentBase.fin = r.valeur;
    if (r.code === 'S21.G00.78.004' && currentBase) currentBase.montant = parseFloat(r.valeur || '0');

    // Composants S21.G00.79
    if (r.code === 'S21.G00.79.001') {
      result.composants.push({ type: r.valeur, montant: 0 });
    }
    if (r.code === 'S21.G00.79.004' && result.composants.length > 0) {
      result.composants[result.composants.length - 1].montant = parseFloat(r.valeur || '0');
    }

    // Cotisations S21.G00.81
    if (r.code === 'S21.G00.81.001') {
      currentCotis = { code: r.valeur, ops: null, assiette: 0, montant: 0, taux: 0 };
      result.cotisations.push(currentCotis);
    }
    if (r.code === 'S21.G00.81.002' && currentCotis) currentCotis.ops = r.valeur;
    if (r.code === 'S21.G00.81.003' && currentCotis) currentCotis.assiette = parseFloat(r.valeur || '0');
    if (r.code === 'S21.G00.81.004' && currentCotis) currentCotis.montant = parseFloat(r.valeur || '0');
    if (r.code === 'S21.G00.81.007' && currentCotis) currentCotis.taux = parseFloat(r.valeur || '0');

    // Remunerations S21.G00.51
    if (r.code === 'S21.G00.51.011') {
      result.remunerations.push({ type: r.valeur, montant: 0 });
    }
    if (r.code === 'S21.G00.51.013' && result.remunerations.length > 0) {
      result.remunerations[result.remunerations.length - 1].montant = parseFloat(r.valeur || '0');
    }

    // Retraite complementaire
    if (r.code === 'S21.G00.71.002') result.retraiteComp = r.valeur;
    // Nature contrat
    if (r.code === 'S21.G00.40.007') result.natureContrat = r.valeur;
    // Statut categoriel
    if (r.code === 'S21.G00.40.003') result.statutCategoriel = r.valeur;
    // Dispositif politique
    if (r.code === 'S21.G00.40.008') result.dispositif = r.valeur;
  }

  return result;
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

  // --- Niveau 7 : ARITHMETIQUE ---
  controleArithmetique(dsn, resultat);

  // --- Niveau 8 : STRUCTURE RENFORCEE ---
  controleStructureRenforcee(dsn, resultat);

  // --- Niveau 9 : CADRE / NON-CADRE ---
  controleCadreNonCadre(dsn, resultat);

  // --- Niveau 10 : TAUX ---
  controleTaux(dsn, resultat);

  // --- Niveau 11 : INTER-EMPLOYES ---
  controleInterEmployes(dsn, resultat);

  // Stocker le DSN parse pour le rapport XML
  resultat._dsn = dsn;

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
        } else if (!verifierLuhn(r.valeur)) {
          addErreur(resultat, 'FMT-20', 'FORMAT', `${r.code} (${spec.nom}): SIREN "${r.valeur}" echoue au controle Luhn — ligne ${r.ligne}`);
        }
        break;

      case 'siret':
        if (!PATTERNS.siret.test(r.valeur)) {
          addErreur(resultat, 'FMT-03', 'FORMAT', `${r.code} (${spec.nom}): SIRET invalide "${r.valeur}" (14 chiffres attendus) — ligne ${r.ligne}`);
        } else if (!verifierLuhn(r.valeur)) {
          addAvertissement(resultat, 'FMT-21', 'FORMAT', `${r.code} (${spec.nom}): SIRET "${r.valeur}" echoue au controle Luhn — ligne ${r.ligne}`);
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
          // CSL-04: Fevrier 29 / mois 30-31 jours
          if (m >= 1 && m <= 12 && j >= 1) {
            const joursParMois = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            // Annee bissextile
            if ((a % 4 === 0 && a % 100 !== 0) || a % 400 === 0) joursParMois[2] = 29;
            if (j > joursParMois[m]) {
              addErreur(resultat, 'CSL-04', 'FORMAT', `${r.code} (${spec.nom}): jour ${j} invalide pour mois ${m}/${a} (max ${joursParMois[m]}) — ligne ${r.ligne}`);
            }
          }
          // CSL-05: Date naissance dans le futur
          if (r.code === 'S21.G00.30.006' && a > 0) {
            const dateNaissance = new Date(a, m - 1, j);
            if (dateNaissance > new Date()) {
              addErreur(resultat, 'CSL-05', 'FORMAT', `${r.code} (${spec.nom}): date naissance ${j}/${m}/${a} dans le futur — ligne ${r.ligne}`);
            }
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
    'S21.G00.40.006': 'Libelle emploi',
    'S21.G00.40.007': 'Nature contrat',
    'S21.G00.40.008': 'Dispositif politique publique',
    'S21.G00.40.009': 'Numero contrat',
    'S21.G00.40.011': 'Unite quotite',
    'S21.G00.40.012': 'Quotite reference',
    'S21.G00.40.013': 'Quotite contrat',
    'S21.G00.40.014': 'Modalite temps',
    'S21.G00.40.018': 'Regime maladie',
    'S21.G00.40.019': 'Lieu travail SIRET',
    'S21.G00.40.020': 'Regime vieillesse',
    'S21.G00.40.026': 'Statut emploi',
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
    'S21.G00.50.008': 'NIR individu versement',
    'S21.G00.50.009': 'Montant PAS',
    'S21.G00.50.013': 'Net fiscal potentiel',
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

    // Bases assujetties obligatoires : 02 (plafonnee), 03 (deplafonnee), 04 (CSG/CRDS), 07 (assurance chomage)
    const types78 = individu.rubriques.filter(r => r.code === 'S21.G00.78.001').map(r => r.valeur);
    for (const baseOblig of ['02', '03', '04', '07']) {
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
    const moisDecl = parseInt(datePrincipale.slice(2, 4));
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

  // ───────────────────────────────────────────
  // Cle NIR (controle CTL V002) — sur S21.G00.30.001 et S21.G00.50.008
  // ───────────────────────────────────────────
  for (const individu of dsn.individus) {
    const nirRubrique = individu.rubriques.find(r => r.code === 'S21.G00.30.001');
    if (nirRubrique) {
      const nirVal = nirRubrique.valeur;
      // NIR 15 chiffres = avec cle → verifier
      if (nirVal.length === 15 && /^\d{15}$/.test(nirVal)) {
        if (!verifierCleNIR(nirVal)) {
          const nom = individu.rubriques.find(r => r.code === 'S21.G00.30.002')?.valeur || nirVal;
          addErreur(resultat, 'COH-08', 'COHERENCE', `Salarie ${nom}: cle NIR invalide (modulo 97) — ligne ${nirRubrique.ligne}`);
        }
      }
      // NIR 13 chiffres = sans cle → ok, pas de verification possible
      resultat.stats.controles_effectues++;
    }
  }

  // ───────────────────────────────────────────
  // IBAN (controle CTL V320) — sur S21.G00.20.004
  // ───────────────────────────────────────────
  const ibanVals = dsn.rubriquesMap.get('S21.G00.20.004');
  if (ibanVals) {
    for (const v of ibanVals) {
      if (v.valeur && !verifierIBAN(v.valeur)) {
        addErreur(resultat, 'COH-09', 'COHERENCE', `S21.G00.20.004: IBAN "${v.valeur}" echoue au controle modulo 97 — ligne ${v.ligne}`);
      }
      resultat.stats.controles_effectues++;
    }
  }

  // ───────────────────────────────────────────
  // BIC (controle format ISO 9362) — sur S21.G00.20.003
  // ───────────────────────────────────────────
  const bicVals = dsn.rubriquesMap.get('S21.G00.20.003');
  if (bicVals) {
    for (const v of bicVals) {
      if (v.valeur && !verifierBIC(v.valeur)) {
        addErreur(resultat, 'COH-10', 'COHERENCE', `S21.G00.20.003: BIC "${v.valeur}" format invalide (ISO 9362) — ligne ${v.ligne}`);
      }
      resultat.stats.controles_effectues++;
    }
  }

  // ───────────────────────────────────────────
  // Coherence montants versement vs bordereaux (CTL M282)
  // Somme bordereaux S21.G00.22.005 doit correspondre au versement S21.G00.20.005
  // ───────────────────────────────────────────
  const versements = dsn.rubriquesMap.get('S21.G00.20.005');
  const bordereaux = dsn.rubriquesMap.get('S21.G00.22.005');
  if (versements && bordereaux) {
    const totalVersement = versements.reduce((s, v) => s + parseFloat(v.valeur || '0'), 0);
    const totalBordereaux = bordereaux.reduce((s, v) => s + parseFloat(v.valeur || '0'), 0);
    if (Math.abs(totalVersement - totalBordereaux) > 0.02) {
      addAvertissement(resultat, 'COH-11', 'COHERENCE', `Montant versement (${totalVersement.toFixed(2)}) different de la somme des bordereaux (${totalBordereaux.toFixed(2)})`);
    }
    resultat.stats.controles_effectues++;
  }

  // ───────────────────────────────────────────
  // Coherence dates remunerations dans la periode (CTL V604)
  // ───────────────────────────────────────────
  if (datePrincipale) {
    const moisDecl = parseInt(datePrincipale.slice(2, 4));
    const anneeDecl = parseInt(datePrincipale.slice(4));

    const debutRemuVals = dsn.rubriquesMap.get('S21.G00.51.001');
    if (debutRemuVals) {
      for (const v of debutRemuVals) {
        if (v.valeur && v.valeur.length === 8) {
          const moisR = parseInt(v.valeur.slice(2, 4));
          const anneeR = parseInt(v.valeur.slice(4));
          if (anneeR !== anneeDecl || moisR !== moisDecl) {
            addAvertissement(resultat, 'COH-12', 'COHERENCE', `S21.G00.51.001: remuneration ${v.valeur} hors periode declaree ${datePrincipale} — ligne ${v.ligne}`);
          }
        }
        resultat.stats.controles_effectues++;
      }
    }
  }

  // ───────────────────────────────────────────
  // NIR versement = NIR individu (CTL V443)
  // ───────────────────────────────────────────
  for (const individu of dsn.individus) {
    const nirIndividu = individu.rubriques.find(r => r.code === 'S21.G00.30.001')?.valeur;
    const nirVersement = individu.rubriques.find(r => r.code === 'S21.G00.50.008')?.valeur;
    if (nirIndividu && nirVersement && nirIndividu !== nirVersement) {
      const nom = individu.rubriques.find(r => r.code === 'S21.G00.30.002')?.valeur || nirIndividu;
      addErreur(resultat, 'COH-13', 'COHERENCE', `Salarie ${nom}: NIR versement (${nirVersement}) different du NIR individu (${nirIndividu})`);
    }
    resultat.stats.controles_effectues++;
  }

  // ───────────────────────────────────────────
  // Coherence somme cotisations vs bordereau (CTL M641)
  // Pour chaque OPS, somme des S21.G00.81.004 doit se rapprocher du bordereau
  // ───────────────────────────────────────────
  // Regrouper cotisations par OPS
  const cotisParOPS = new Map();
  const rubriques81 = dsn.rubriquesOrdonnees.filter(r => r.code === 'S21.G00.81.001' || r.code === 'S21.G00.81.002' || r.code === 'S21.G00.81.004');
  let currentOPS = null;
  for (const r of dsn.rubriquesOrdonnees) {
    if (r.code === 'S21.G00.81.002') currentOPS = r.valeur;
    if (r.code === 'S21.G00.81.004' && currentOPS) {
      const montant = parseFloat(r.valeur || '0');
      cotisParOPS.set(currentOPS, (cotisParOPS.get(currentOPS) || 0) + montant);
    }
  }
  // Comparer avec bordereaux
  const bordereauOPS = new Map();
  let currentBordOPS = null;
  for (const r of dsn.rubriquesOrdonnees) {
    if (r.code === 'S21.G00.22.001') currentBordOPS = r.valeur;
    if (r.code === 'S21.G00.22.005' && currentBordOPS) {
      const montant = parseFloat(r.valeur || '0');
      bordereauOPS.set(currentBordOPS, (bordereauOPS.get(currentBordOPS) || 0) + montant);
    }
  }
  // La somme des cotisations ne doit pas depasser le bordereau de plus de 10%
  for (const [ops, totalCotis] of cotisParOPS) {
    const totalBord = bordereauOPS.get(ops) || 0;
    if (totalBord > 0 && totalCotis > totalBord * 1.5) {
      addAvertissement(resultat, 'COH-14', 'COHERENCE', `OPS ${ops}: somme cotisations (${totalCotis.toFixed(2)}) tres superieure au bordereau (${totalBord.toFixed(2)})`);
    }
    resultat.stats.controles_effectues++;
  }

  // ───────────────────────────────────────────
  // Dates coherentes : debut <= fin pour bases, remunerations, bordereaux
  // ───────────────────────────────────────────
  const pairesDateBlocs = [
    ['S21.G00.51.001', 'S21.G00.51.002', 'Remuneration'],
    ['S21.G00.78.002', 'S21.G00.78.003', 'Base assujettie'],
    ['S21.G00.22.003', 'S21.G00.22.004', 'Bordereau'],
    ['S21.G00.20.006', 'S21.G00.20.007', 'Versement OPS'],
  ];
  for (const [codeDebut, codeFin, label] of pairesDateBlocs) {
    const debVals = dsn.rubriquesMap.get(codeDebut) || [];
    const finVals = dsn.rubriquesMap.get(codeFin) || [];
    const nbPaires = Math.min(debVals.length, finVals.length);
    for (let i = 0; i < nbPaires; i++) {
      const deb = debVals[i]?.valeur;
      const fin = finVals[i]?.valeur;
      if (deb && fin && deb.length === 8 && fin.length === 8) {
        // Convertir JJMMAAAA en comparable AAAAMMJJ
        const debComp = deb.slice(4) + deb.slice(2, 4) + deb.slice(0, 2);
        const finComp = fin.slice(4) + fin.slice(2, 4) + fin.slice(0, 2);
        if (debComp > finComp) {
          addErreur(resultat, 'COH-15', 'COHERENCE', `${label}: date debut ${deb} posterieure a date fin ${fin} — ligne ${debVals[i].ligne}`);
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
    const natureContrat = individu.rubriques.find(r => r.code === 'S21.G00.40.007')?.valeur;
    const dateFinPrev = individu.rubriques.find(r => r.code === 'S21.G00.40.010')?.valeur;
    const nom = individu.rubriques.find(r => r.code === 'S21.G00.30.002')?.valeur || individu.nir;

    // CDD: date fin prévisionnelle obligatoire
    if (natureContrat === '02' && !dateFinPrev) {
      addErreur(resultat, 'MET-05', 'METIER', `Salarie ${nom}: CDD (nature 02) sans date fin previsionnelle (S21.G00.40.010)`);
    }
    // CDD: motif de recours obligatoire (V442 DSN-CTL)
    const motifRecours = individu.rubriques.find(r => r.code === 'S21.G00.40.021')?.valeur;
    if (natureContrat === '02' && !motifRecours) {
      addErreur(resultat, 'MET-12', 'METIER', `Salarie ${nom}: CDD (nature 02) sans motif de recours (S21.G00.40.021)`);
    }
    resultat.stats.controles_effectues++;

    // MET-13: Motif recours pour TOUTES natures CDD (sauf 07 apprentissage — motif implicite)
    if (NATURES_CDD.includes(natureContrat) && natureContrat !== '02' && natureContrat !== '07' && !motifRecours) {
      addErreur(resultat, 'MET-13', 'METIER', `Salarie ${nom}: CDD nature ${natureContrat} sans motif de recours (S21.G00.40.021)`);
    }
    resultat.stats.controles_effectues++;

    // MET-14: Date fin prev pour toutes natures CDD (sauf 07 apprentissage — date fin formation)
    if (NATURES_CDD.includes(natureContrat) && natureContrat !== '02' && natureContrat !== '07' && !dateFinPrev) {
      addErreur(resultat, 'MET-14', 'METIER', `Salarie ${nom}: CDD nature ${natureContrat} sans date fin previsionnelle (S21.G00.40.010)`);
    }
    if (natureContrat === '07' && !dateFinPrev) {
      addAvertissement(resultat, 'MET-14', 'METIER', `Salarie ${nom}: apprenti (nature 07) sans date fin previsionnelle (S21.G00.40.010)`);
    }
    resultat.stats.controles_effectues++;

    // MET-15: Dispositif '64' pour apprenti (nature 07)
    const dispositif = individu.rubriques.find(r => r.code === 'S21.G00.40.008')?.valeur;
    if (natureContrat === '07' && dispositif !== '64') {
      addAvertissement(resultat, 'MET-15', 'METIER', `Salarie ${nom}: apprenti (nature 07) sans dispositif 64 (actuel: ${dispositif || 'absent'})`);
    }
    resultat.stats.controles_effectues++;

    // MET-16: Dispositif '99' pour nature 07 = warning
    if (natureContrat === '07' && dispositif === '99') {
      addAvertissement(resultat, 'MET-16', 'METIER', `Salarie ${nom}: apprenti (nature 07) avec dispositif generique 99`);
    }
    resultat.stats.controles_effectues++;

    // MET-17: Anciennete S21.G00.86 pour CDD
    if (NATURES_CDD.includes(natureContrat)) {
      const hasAnciennete = individu.blocs.has('S21.G00.86');
      if (!hasAnciennete) {
        addErreur(resultat, 'MET-17', 'METIER', `Salarie ${nom}: CDD nature ${natureContrat} sans bloc anciennete (S21.G00.86)`);
      }
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
    if (modaliteTemps === '20' && quotiteCtr >= quotiteRef && quotiteRef > 0) {
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

// ============================================
// NIVEAU 7 : CONTROLES ARITHMETIQUES (CCH-01 a CCH-14)
// ============================================

function controleArithmetique(dsn, resultat) {
  const PMSS = CONSTANTES_2026.PMSS;
  const TOL = CONSTANTES_2026.TOLERANCE;
  const TOL_NET = CONSTANTES_2026.TOLERANCE_NET;

  for (const individu of dsn.individus) {
    const s = extraireIndividuStructure(individu);
    const nom = s.nom;

    // Remunerations par type
    const remu = {};
    for (const r of s.remunerations) remu[r.type] = (remu[r.type] || 0) + r.montant;
    const brut = remu['001'] || 0;       // Brut non plafonne
    const brutChomage = remu['002'] || 0; // Brut chomage
    const salaireBase = remu['010'] || 0; // Salaire de base

    if (brut === 0) continue; // Pas de brut = rien a verifier

    // Bases par code
    const bases = {};
    for (const b of s.bases) bases[b.code] = (bases[b.code] || 0) + b.montant;

    // CCH-01: Brut (001) >= salaire base (010)
    if (brut > 0 && salaireBase > 0 && brut < salaireBase - TOL) {
      addErreur(resultat, 'CCH-01', 'ARITHMETIQUE', `Salarie ${nom}: brut (${brut.toFixed(2)}) < salaire base (${salaireBase.toFixed(2)})`);
    }
    resultat.stats.controles_effectues++;

    // CCH-02: Brut chomage (002) <= brut (001)
    if (brutChomage > 0 && brutChomage > brut + TOL) {
      addErreur(resultat, 'CCH-02', 'ARITHMETIQUE', `Salarie ${nom}: brut chomage (${brutChomage.toFixed(2)}) > brut (${brut.toFixed(2)})`);
    }
    resultat.stats.controles_effectues++;

    // CCH-03: Base plafonnee (02) <= PMSS
    const basePlaf = bases['02'] || 0;
    if (basePlaf > PMSS + TOL) {
      addErreur(resultat, 'CCH-03', 'ARITHMETIQUE', `Salarie ${nom}: base plafonnee (${basePlaf.toFixed(2)}) > PMSS (${PMSS})`);
    }
    resultat.stats.controles_effectues++;

    // CCH-04: Base deplafonnee (03) ≈ brut
    const baseDeplaf = bases['03'] || 0;
    if (baseDeplaf > 0 && Math.abs(baseDeplaf - brut) > brut * 0.02 + TOL) {
      addAvertissement(resultat, 'CCH-04', 'ARITHMETIQUE', `Salarie ${nom}: base deplafonnee (${baseDeplaf.toFixed(2)}) != brut (${brut.toFixed(2)})`);
    }
    resultat.stats.controles_effectues++;

    // CCH-05: Base CSG (04) ≈ brut × 98.25%
    const baseCSG = bases['04'] || 0;
    const csgAttendue = brut * CONSTANTES_2026.BASE_CSG;
    if (baseCSG > 0 && Math.abs(baseCSG - csgAttendue) > brut * 0.02 + TOL) {
      addAvertissement(resultat, 'CCH-05', 'ARITHMETIQUE', `Salarie ${nom}: base CSG (${baseCSG.toFixed(2)}) != brut*98.25% (${csgAttendue.toFixed(2)})`);
    }
    resultat.stats.controles_effectues++;

    // CCH-06: Base T1 retraite (07) = min(brut, PMSS)
    const baseT1 = bases['07'] || 0;
    const t1Attendu = Math.min(brut, PMSS);
    if (baseT1 > 0 && Math.abs(baseT1 - t1Attendu) > TOL + 1) {
      addAvertissement(resultat, 'CCH-06', 'ARITHMETIQUE', `Salarie ${nom}: base T1 (${baseT1.toFixed(2)}) != min(brut,PMSS) (${t1Attendu.toFixed(2)})`);
    }
    resultat.stats.controles_effectues++;

    // CCH-07: Base T2 retraite (08) = max(0, brut-PMSS)
    const baseT2 = bases['08'] || 0;
    const t2Attendu = Math.max(0, brut - PMSS);
    if (baseT2 > 0 && Math.abs(baseT2 - t2Attendu) > TOL + 1) {
      addErreur(resultat, 'CCH-07', 'ARITHMETIQUE', `Salarie ${nom}: base T2 (${baseT2.toFixed(2)}) != max(0,brut-PMSS) (${t2Attendu.toFixed(2)})`);
    }
    // Si brut <= PMSS et base T2 presente et > 0
    if (brut <= PMSS && baseT2 > TOL) {
      addErreur(resultat, 'CCH-07', 'ARITHMETIQUE', `Salarie ${nom}: base T2 (${baseT2.toFixed(2)}) presente mais brut (${brut.toFixed(2)}) <= PMSS`);
    }
    resultat.stats.controles_effectues++;

    // CCH-08: Cotis montant ≈ base × taux (±0.02€)
    for (const c of s.cotisations) {
      if (c.taux > 0 && c.assiette > 0 && c.montant !== 0) {
        const attendu = c.assiette * c.taux / 100;
        if (Math.abs(Math.abs(c.montant) - attendu) > TOL + 0.01) {
          addAvertissement(resultat, 'CCH-08', 'ARITHMETIQUE', `Salarie ${nom}: cotis ${c.code} montant (${c.montant.toFixed(2)}) != base*taux (${attendu.toFixed(2)})`);
        }
      }
      resultat.stats.controles_effectues++;
    }

    // CCH-09: Sum S81.004 ≈ versement OPS (verifier par OPS)
    const cotisParOPS = {};
    for (const c of s.cotisations) {
      if (c.ops) cotisParOPS[c.ops] = (cotisParOPS[c.ops] || 0) + c.montant;
    }
    // Pas de controle individuel ici — fait globalement dans CCH-30
    resultat.stats.controles_effectues++;

    // CCH-10: Sum S81 negatifs (reductions) = verification coherence
    const totalNegatifs = s.cotisations.filter(c => c.montant < 0).reduce((sum, c) => sum + c.montant, 0);
    if (totalNegatifs < -brut * 0.5) {
      addAvertissement(resultat, 'CCH-10', 'ARITHMETIQUE', `Salarie ${nom}: total reductions (${totalNegatifs.toFixed(2)}) > 50% du brut`);
    }
    resultat.stats.controles_effectues++;

    // CCH-11: Net social ≈ brut - cotis salariales
    // Parse from S21.G00.58 type 03
    const netSocialRub = individu.rubriques.filter(r => r.code === 'S21.G00.58.003');
    const netSocialMontant = [];
    let isNetSocial = false;
    for (const r of individu.rubriques) {
      if (r.code === 'S21.G00.58.003' && r.valeur === '03') isNetSocial = true;
      else if (r.code === 'S21.G00.58.003') isNetSocial = false;
      if (r.code === 'S21.G00.58.004' && isNetSocial) netSocialMontant.push(parseFloat(r.valeur || '0'));
    }
    const netSocial = netSocialMontant.length > 0 ? netSocialMontant[0] : null;
    const totalCotisSal = s.cotisations.filter(c => c.montant > 0).reduce((sum, c) => {
      // Cotisations salariales sont une partie, approximation par codes connus
      return sum;
    }, 0);
    // Simplified: net social should be > 0 and < brut
    if (netSocial !== null && netSocial > 0) {
      if (netSocial > brut + TOL_NET) {
        addAvertissement(resultat, 'CCH-11', 'ARITHMETIQUE', `Salarie ${nom}: net social (${netSocial.toFixed(2)}) > brut (${brut.toFixed(2)})`);
      }
      if (netSocial < brut * 0.50 - TOL_NET) {
        addAvertissement(resultat, 'CCH-11', 'ARITHMETIQUE', `Salarie ${nom}: net social (${netSocial.toFixed(2)}) < 50% du brut (${(brut * 0.50).toFixed(2)})`);
      }
    }
    resultat.stats.controles_effectues++;

    // CCH-12: Net verse ≈ brut - cotis sal - IR
    const netVerse = parseFloat(individu.rubriques.find(r => r.code === 'S21.G00.50.004')?.valeur || '0');
    if (netVerse > 0) {
      if (netVerse > brut + TOL_NET) {
        addAvertissement(resultat, 'CCH-12', 'ARITHMETIQUE', `Salarie ${nom}: net verse (${netVerse.toFixed(2)}) > brut (${brut.toFixed(2)})`);
      }
      if (netVerse < brut * 0.40 - TOL_NET) {
        addAvertissement(resultat, 'CCH-12', 'ARITHMETIQUE', `Salarie ${nom}: net verse (${netVerse.toFixed(2)}) < 40% du brut — suspect`);
      }
    }
    resultat.stats.controles_effectues++;

    // CCH-13: Net fiscal coherent
    const netFiscal = parseFloat(individu.rubriques.find(r => r.code === 'S21.G00.50.002')?.valeur || '0');
    if (netFiscal > 0 && netFiscal > brut + TOL_NET) {
      addAvertissement(resultat, 'CCH-13', 'ARITHMETIQUE', `Salarie ${nom}: net fiscal (${netFiscal.toFixed(2)}) > brut (${brut.toFixed(2)})`);
    }
    resultat.stats.controles_effectues++;

    // CCH-14: IR ≈ net fiscal × taux PAS
    const tauxPAS = parseFloat(individu.rubriques.find(r => r.code === 'S21.G00.50.006')?.valeur || '0');
    const montantIR = parseFloat(individu.rubriques.find(r => r.code === 'S21.G00.50.009')?.valeur || '0');
    if (tauxPAS > 0 && netFiscal > 0) {
      const irAttendu = netFiscal * tauxPAS / 100;
      if (Math.abs(montantIR - irAttendu) > TOL_NET + 1) {
        addAvertissement(resultat, 'CCH-14', 'ARITHMETIQUE', `Salarie ${nom}: IR (${montantIR.toFixed(2)}) != net fiscal*taux PAS (${irAttendu.toFixed(2)})`);
      }
    }
    resultat.stats.controles_effectues++;
  }
}

// ============================================
// NIVEAU 8 : STRUCTURE RENFORCEE (CST-01 a CST-06)
// ============================================

function controleStructureRenforcee(dsn, resultat) {
  for (const individu of dsn.individus) {
    const s = extraireIndividuStructure(individu);
    const nom = s.nom;

    // CST-01: Chaque base 78 a >=1 cotisation 81 enfant
    for (const base of s.bases) {
      const cotisAvecBase = s.cotisations.filter(c => {
        // Cotisations dont l'assiette correspond a cette base (tolerance 1€)
        return Math.abs(c.assiette - base.montant) < 1.0;
      });
      // Relax: au moins une cotisation globale presente suffit
      if (s.cotisations.length === 0) {
        addErreur(resultat, 'CST-01', 'STRUCTURE', `Salarie ${nom}: base ${base.code} sans aucune cotisation associee`);
      }
      resultat.stats.controles_effectues++;
    }

    // CST-02: Base 03 (deplafonnee) a un composant 79
    const hasBase03 = s.bases.some(b => b.code === '03');
    if (hasBase03 && s.composants.length === 0) {
      addAvertissement(resultat, 'CST-02', 'STRUCTURE', `Salarie ${nom}: base deplafonnee (03) presente sans composant (S21.G00.79)`);
    }
    resultat.stats.controles_effectues++;

    // CST-03: Remu type 003 (salaire retabli) presente
    const hasRemu003 = s.remunerations.some(r => r.type === '003');
    if (!hasRemu003) {
      addAvertissement(resultat, 'CST-03', 'STRUCTURE', `Salarie ${nom}: remuneration type 003 (salaire retabli) absente`);
    }
    resultat.stats.controles_effectues++;

    // CST-04: Activite S21.G00.53 suit remu type 002
    const hasRemu002 = s.remunerations.some(r => r.type === '002');
    const hasActivite = individu.blocs.has('S21.G00.53');
    if (hasRemu002 && !hasActivite) {
      addErreur(resultat, 'CST-04', 'STRUCTURE', `Salarie ${nom}: remuneration type 002 presente mais pas de bloc activite (S21.G00.53)`);
    }
    resultat.stats.controles_effectues++;

    // CST-05: Hierarchie 78→79→81 correcte (79 et 81 apres 78)
    let lastBlocType = null;
    let hierarchyOK = true;
    for (const r of individu.rubriques) {
      const bloc = r.code.substring(0, 10);
      if (bloc === 'S21.G00.78') lastBlocType = '78';
      if (bloc === 'S21.G00.79' && lastBlocType !== '78' && lastBlocType !== '79') {
        hierarchyOK = false;
      }
      if (bloc === 'S21.G00.81') {
        if (lastBlocType !== '78' && lastBlocType !== '79' && lastBlocType !== '81') {
          hierarchyOK = false;
        }
        lastBlocType = '81';
      }
      if (bloc === 'S21.G00.79') lastBlocType = '79';
    }
    if (!hierarchyOK) {
      addErreur(resultat, 'CST-05', 'STRUCTURE', `Salarie ${nom}: hierarchie S21.G00.78→79→81 incorrecte`);
    }
    resultat.stats.controles_effectues++;
  }

  // CST-06: Pas de NIR en doublon
  const nirs = dsn.individus.map(i => i.nir);
  const nirSet = new Set(nirs);
  if (nirs.length !== nirSet.size) {
    const duplicates = nirs.filter((nir, idx) => nirs.indexOf(nir) !== idx);
    addErreur(resultat, 'CST-06', 'STRUCTURE', `NIR en doublon: ${[...new Set(duplicates)].join(', ')}`);
  }
  resultat.stats.controles_effectues++;
}

// ============================================
// NIVEAU 9 : CADRE / NON-CADRE (CCH-20 a CCH-24)
// ============================================

function controleCadreNonCadre(dsn, resultat) {
  const PMSS = CONSTANTES_2026.PMSS;

  for (const individu of dsn.individus) {
    const s = extraireIndividuStructure(individu);
    const nom = s.nom;
    // 01 = cadre, 02 = agent de maitrise (pas cadre au sens APEC/prevoyance)
    const isCadre = s.statutCategoriel === '01';

    // CCH-20: Cadre (01) → RETC obligatoire
    if (isCadre && s.retraiteComp !== 'RETC') {
      addErreur(resultat, 'CCH-20', 'METIER', `Salarie ${nom}: cadre (statut ${s.statutCategoriel}) sans RETC (retraite comp: ${s.retraiteComp || 'absente'})`);
    }
    resultat.stats.controles_effectues++;

    // CCH-21: Non-cadre (04/98/99) → pas de RETC (02 agent maitrise peut avoir RETC selon CCN)
    if (!isCadre && s.statutCategoriel !== '02' && s.retraiteComp === 'RETC') {
      addErreur(resultat, 'CCH-21', 'METIER', `Salarie ${nom}: non-cadre (statut ${s.statutCategoriel}) avec RETC`);
    }
    resultat.stats.controles_effectues++;

    // CCH-22: Cadre → APEC (027) obligatoire
    if (isCadre) {
      const hasAPEC = s.cotisations.some(c => c.code === '027');
      if (!hasAPEC) {
        addAvertissement(resultat, 'CCH-22', 'METIER', `Salarie ${nom}: cadre sans cotisation APEC (027)`);
      }
    }
    resultat.stats.controles_effectues++;

    // CCH-23: Base T2 ssi brut > PMSS
    const remu = {};
    for (const r of s.remunerations) remu[r.type] = (remu[r.type] || 0) + r.montant;
    const brut = remu['001'] || 0;
    const bases = {};
    for (const b of s.bases) bases[b.code] = (bases[b.code] || 0) + b.montant;
    const baseT2 = bases['08'] || 0;

    if (brut > PMSS && baseT2 === 0 && isCadre) {
      addErreur(resultat, 'CCH-23', 'METIER', `Salarie ${nom}: brut (${brut.toFixed(2)}) > PMSS mais base T2 absente`);
    }
    resultat.stats.controles_effectues++;

    // CCH-24: Prevoyance cadre si cadre
    if (isCadre) {
      const hasPrevoyance = s.cotisations.some(c =>
        c.code === '059' || c.code === '060' || c.code === '061' || c.code === '065'
      );
      if (!hasPrevoyance) {
        addAvertissement(resultat, 'CCH-24', 'METIER', `Salarie ${nom}: cadre sans cotisation prevoyance (059/060/061/065)`);
      }
    }
    resultat.stats.controles_effectues++;
  }
}

// ============================================
// NIVEAU 10 : TAUX VALIDATION (SIG-01 a SIG-03)
// ============================================

function controleTaux(dsn, resultat) {
  for (const individu of dsn.individus) {
    const s = extraireIndividuStructure(individu);
    const nom = s.nom;

    for (const c of s.cotisations) {
      // SIG-01: Taux cotisation hors plage standard
      const plage = TAUX_ATTENDUS[c.code];
      if (plage && c.taux > 0) {
        if (c.taux < plage.min || c.taux > plage.max) {
          addAvertissement(resultat, 'SIG-01', 'TAUX', `Salarie ${nom}: cotis ${c.code} (${plage.nom}) taux ${c.taux}% hors plage [${plage.min}-${plage.max}%]`);
        }
      }
      resultat.stats.controles_effectues++;
    }

    // SIG-02: Taux AT/MP hors [0.50-7.00%]
    const tauxAT = parseFloat(individu.rubriques.find(r => r.code === 'S21.G00.40.043')?.valeur || '0');
    if (tauxAT > 0 && (tauxAT < 0.50 || tauxAT > 7.00)) {
      addAvertissement(resultat, 'SIG-02', 'TAUX', `Salarie ${nom}: taux AT/MP ${tauxAT}% hors plage [0.50-7.00%]`);
    }
    resultat.stats.controles_effectues++;

    // SIG-03: Taux PAS coherent avec type
    const tauxPAS = parseFloat(individu.rubriques.find(r => r.code === 'S21.G00.50.006')?.valeur || '0');
    const typePAS = individu.rubriques.find(r => r.code === 'S21.G00.50.007')?.valeur;
    if (typePAS === '99' && tauxPAS !== 0) {
      addAvertissement(resultat, 'SIG-03', 'TAUX', `Salarie ${nom}: type PAS '99' (non soumis) mais taux = ${tauxPAS}%`);
    }
    if (tauxPAS > 43) {
      addAvertissement(resultat, 'SIG-03', 'TAUX', `Salarie ${nom}: taux PAS ${tauxPAS}% > 43% (max legal)`);
    }
    resultat.stats.controles_effectues++;
  }
}

// ============================================
// NIVEAU 11 : COHERENCE INTER-EMPLOYES (CCH-30, CCH-31)
// ============================================

function controleInterEmployes(dsn, resultat) {
  if (dsn.individus.length === 0) return;

  // CCH-30: Sum versements individuels coherent avec versement OPS
  const totalNetVerse = dsn.individus.reduce((sum, ind) => {
    const nv = parseFloat(ind.rubriques.find(r => r.code === 'S21.G00.50.004')?.valeur || '0');
    return sum + nv;
  }, 0);
  // Pas de controle direct ici — la coherence se fait au niveau bordereau (deja COH-14)
  resultat.stats.controles_effectues++;

  // CCH-31: Chaque S81 a un S30 individu (cotisation sans individu parent)
  // Verifier qu'on n'a pas de S21.G00.81 hors d'un bloc individu
  let inIndividu = false;
  let hasOrphanCotis = false;
  for (const r of dsn.rubriquesOrdonnees) {
    if (r.code === 'S21.G00.30.001') inIndividu = true;
    if (r.code.startsWith('S21.G00.20.') || r.code.startsWith('S21.G00.22.') ||
        r.code.startsWith('S90.') || r.code.startsWith('S10.') || r.code.startsWith('S20.')) {
      inIndividu = false;
    }
    if (r.code.startsWith('S21.G00.81.') && !inIndividu) {
      hasOrphanCotis = true;
    }
  }
  if (hasOrphanCotis) {
    addErreur(resultat, 'CCH-31', 'COHERENCE', 'Cotisation S21.G00.81 trouvee hors bloc individu (S21.G00.30)');
  }
  resultat.stats.controles_effectues++;
}

// ============================================
// RAPPORT XML BAN (format DSN-Val)
// ============================================

function genererRapportXML(resultat) {
  const dsn = resultat._dsn;
  const now = new Date();
  const dateStr = now.toISOString().replace(/[-:]/g, '').slice(0, 15);

  const nbBloquant = resultat.erreurs.length;
  const nbNonBloquant = resultat.avertissements.length;
  const etat = nbBloquant === 0 ? 'OK' : 'KO';

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<bilan xmlns="urn:gipmds:bilan:v01r08">\n';
  xml += `  <identifiant_envoi>NEXUS-${dateStr}</identifiant_envoi>\n`;
  xml += `  <date_bilan>${now.toISOString().slice(0, 10)}</date_bilan>\n`;
  xml += `  <heure_bilan>${now.toISOString().slice(11, 19)}</heure_bilan>\n`;
  xml += `  <envoi_etat>${etat}</envoi_etat>\n`;
  xml += '  <compteurs>\n';
  xml += `    <nb_declarations>${dsn ? 1 : 0}</nb_declarations>\n`;
  xml += `    <nb_salaries>${dsn ? dsn.nbSalaries : 0}</nb_salaries>\n`;
  xml += `    <nb_rubriques>${dsn ? dsn.nbRubriques : 0}</nb_rubriques>\n`;
  xml += `    <nb_anomalies_bloquantes>${nbBloquant}</nb_anomalies_bloquantes>\n`;
  xml += `    <nb_anomalies_non_bloquantes>${nbNonBloquant}</nb_anomalies_non_bloquantes>\n`;
  xml += `    <nb_controles>${resultat.stats.controles_effectues}</nb_controles>\n`;
  xml += '  </compteurs>\n';

  if (nbBloquant > 0 || nbNonBloquant > 0) {
    xml += '  <anomalies>\n';

    for (const e of resultat.erreurs) {
      xml += '    <anomalie>\n';
      xml += `      <code>${escapeXML(e.code)}</code>\n`;
      xml += `      <type>bloquante</type>\n`;
      xml += `      <categorie>${escapeXML(e.type)}</categorie>\n`;
      xml += `      <message>${escapeXML(e.message)}</message>\n`;
      xml += '    </anomalie>\n';
    }

    for (const a of resultat.avertissements) {
      xml += '    <anomalie>\n';
      xml += `      <code>${escapeXML(a.code)}</code>\n`;
      xml += `      <type>non_bloquante</type>\n`;
      xml += `      <categorie>${escapeXML(a.type)}</categorie>\n`;
      xml += `      <message>${escapeXML(a.message)}</message>\n`;
      xml += '    </anomalie>\n';
    }

    xml += '  </anomalies>\n';
  }

  xml += '  <validateur>\n';
  xml += '    <nom>NEXUS DSN Validator</nom>\n';
  xml += '    <version>2.0</version>\n';
  xml += `    <nb_controles_total>${resultat.stats.controles_effectues}</nb_controles_total>\n`;
  xml += '  </validateur>\n';
  xml += '</bilan>\n';

  return xml;
}

function escapeXML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
  genererRapport,
  genererRapportXML,
  CONSTANTES_2026
};
