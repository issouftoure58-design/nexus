/**
 * Scénarios de test DSN — données fictives réalistes
 * Couvre : CDI, CDD, temps partiel, multi-salarié, étranger, multi-contrat, DSN néant
 *
 * SIREN/SIRET valides Luhn, IBAN valide modulo 97, BIC format ISO 9362
 * NIR 13 chiffres (sans clé — la clé est optionnelle en DSN)
 */

import { validerDSN, genererRapport } from '../services/dsnValidator.js';

// ============================================
// HELPERS
// ============================================

function buildDSN(blocs) {
  const lines = [];
  for (const [code, val] of blocs) {
    lines.push(`${code},'${val}'`);
  }
  // Ajouter le total
  const nbRubriques = lines.length + 2; // +2 pour S90 lui-même
  lines.push(`S90.G00.90.001,'${String(nbRubriques).padStart(10, '0')}'`);
  lines.push(`S90.G00.90.002,'01'`);
  return lines.join('\n');
}

// Bloc envoi standard
function blocEnvoi(norme = 'P25V01') {
  return [
    ['S10.G00.00.001', 'NEXUS SIRH'],
    ['S10.G00.00.002', 'NEXUS'],
    ['S10.G00.00.003', '1.0.0'],
    ['S10.G00.00.005', '01'],
    ['S10.G00.00.006', norme],
    ['S10.G00.00.007', '01'],
    ['S10.G00.00.008', '01'],
  ];
}

// Bloc émetteur — SIREN/NIC valides Luhn
function blocEmetteur(siren = '443061841', nic = '00013', raison = 'SOCIETE TEST SAS') {
  return [
    ['S10.G00.01.001', siren],
    ['S10.G00.01.002', nic],
    ['S10.G00.01.003', raison],
    ['S10.G00.01.004', '15 RUE DE LA PAIX'],
    ['S10.G00.01.005', '75002'],
    ['S10.G00.01.006', 'PARIS'],
  ];
}

// Bloc contact émetteur
function blocContact() {
  return [
    ['S10.G00.02.001', '01'],
    ['S10.G00.02.002', 'DUPONT'],
    ['S10.G00.02.004', 'contact@societe-test.fr'],
    ['S10.G00.02.005', '0145678900'],
  ];
}

// Bloc déclaration
function blocDeclaration(mois = '01122025', siretAssujetti = '44306184100013') {
  return [
    ['S20.G00.05.001', '01'],
    ['S20.G00.05.002', '01'],
    ['S20.G00.05.003', '11'],
    ['S20.G00.05.004', '1'],
    ['S20.G00.05.005', mois],
    ['S20.G00.05.007', '15012026'],
    ['S20.G00.05.008', '01'],
    ['S20.G00.05.009', siretAssujetti],
    ['S20.G00.05.010', '01'],
  ];
}

// Bloc contact déclaration
function blocContactDecl() {
  return [
    ['S20.G00.07.001', 'SOCIETE TEST SAS'],
    ['S20.G00.07.002', '0145678900'],
    ['S20.G00.07.003', 'contact@societe-test.fr'],
    ['S20.G00.07.004', '01'],
  ];
}

// Bloc entreprise
function blocEntreprise(siren = '443061841', nic = '00013') {
  return [
    ['S21.G00.06.001', siren],
    ['S21.G00.06.002', nic],
    ['S21.G00.06.003', '6201Z'],
    ['S21.G00.06.004', '15 RUE DE LA PAIX'],
    ['S21.G00.06.005', '75002'],
    ['S21.G00.06.006', 'PARIS'],
    ['S21.G00.06.015', '0016'],
  ];
}

// Bloc établissement
function blocEtablissement(nic = '00013') {
  return [
    ['S21.G00.11.001', nic],
    ['S21.G00.11.002', '6201Z'],
    ['S21.G00.11.003', '15 RUE DE LA PAIX'],
    ['S21.G00.11.004', '75002'],
    ['S21.G00.11.005', 'PARIS'],
    ['S21.G00.11.022', '0016'],
  ];
}

// Bloc versement organisme (URSSAF)
function blocVersement(siretOPS = '78861779300013', montant = '2500.00', debut = '01122025', fin = '31122025') {
  return [
    ['S21.G00.20.001', siretOPS],
    ['S21.G00.20.002', '44306184100013'],
    ['S21.G00.20.003', 'BNPAFRPP'],
    ['S21.G00.20.004', 'FR7630006000011234567890189'],
    ['S21.G00.20.005', montant],
    ['S21.G00.20.006', debut],
    ['S21.G00.20.007', fin],
    ['S21.G00.20.010', '05'],
  ];
}

// Bloc bordereau cotisations
function blocBordereau(siretOPS = '78861779300013', ctp = '100', montant = '2500.00', debut = '01122025', fin = '31122025') {
  return [
    ['S21.G00.22.001', siretOPS],
    ['S21.G00.22.002', ctp],
    ['S21.G00.22.003', debut],
    ['S21.G00.22.004', fin],
    ['S21.G00.22.005', montant],
  ];
}

// Bloc individu
function blocIndividu({ nir, nom, prenom, sexe = '01', dateNaissance = '15031985', lieuNaissance = 'PARIS', adresse = '25 RUE VICTOR HUGO', cp = '75016', ville = 'PARIS', codifUE = '01', deptNaissance = '75', paysNaissance = 'FR' }) {
  return [
    ['S21.G00.30.001', nir],
    ['S21.G00.30.002', nom],
    ['S21.G00.30.004', prenom],
    ['S21.G00.30.005', sexe],
    ['S21.G00.30.006', dateNaissance],
    ['S21.G00.30.007', lieuNaissance],
    ['S21.G00.30.008', adresse],
    ['S21.G00.30.009', cp],
    ['S21.G00.30.010', ville],
    ['S21.G00.30.013', codifUE],
    ['S21.G00.30.014', deptNaissance],
    ['S21.G00.30.015', paysNaissance],
  ];
}

// Bloc contrat
function blocContrat({
  dateDebut = '01092020',
  statutConv = '05',
  statutCat = '04',
  pcsEse = '641a',
  libelleEmploi = 'Developpeur informatique',
  natureContrat = '01', // CDI
  dispositif = '99',
  numContrat = '00001',
  dateFinPrev = null,
  uniteQuotite = '10',
  quotiteRef = '151.67',
  quotiteCtr = '151.67',
  modaliteTemps = '10', // temps plein
  complementPCS = '99',
  ccn = '0016',
  regimeMaladie = '200',
  siretLieu = '44306184100013',
  regimeVieillesse = '200',
  motifRecours = null,
  travailleurEtranger = '99',
  statutEmploi = '99',
  emploisMultiples = '03',
  employeursMultiples = '03',
  regimeAT = '200',
  codeRisqueAT = '631AE',
  tauxAT = '1.10',
}) {
  const lines = [
    ['S21.G00.40.001', dateDebut],
    ['S21.G00.40.002', statutConv],
    ['S21.G00.40.003', statutCat],
    ['S21.G00.40.004', pcsEse],
    ['S21.G00.40.006', libelleEmploi],
    ['S21.G00.40.007', natureContrat],
    ['S21.G00.40.008', dispositif],
    ['S21.G00.40.009', numContrat],
  ];
  if (dateFinPrev) lines.push(['S21.G00.40.010', dateFinPrev]);
  lines.push(
    ['S21.G00.40.011', uniteQuotite],
    ['S21.G00.40.012', quotiteRef],
    ['S21.G00.40.013', quotiteCtr],
    ['S21.G00.40.014', modaliteTemps],
    ['S21.G00.40.016', complementPCS],
    ['S21.G00.40.017', ccn],
    ['S21.G00.40.018', regimeMaladie],
    ['S21.G00.40.019', siretLieu],
    ['S21.G00.40.020', regimeVieillesse],
  );
  if (motifRecours) lines.push(['S21.G00.40.021', motifRecours]);
  lines.push(
    ['S21.G00.40.024', travailleurEtranger],
    ['S21.G00.40.026', statutEmploi],
    ['S21.G00.40.036', emploisMultiples],
    ['S21.G00.40.037', employeursMultiples],
    ['S21.G00.40.039', regimeAT],
    ['S21.G00.40.040', codeRisqueAT],
    ['S21.G00.40.043', tauxAT],
  );
  return lines;
}

// Bloc retraite complémentaire
function blocRetraite(codeRegime = 'RETC') {
  return [
    ['S21.G00.71.002', codeRegime],
  ];
}

// Bloc versement individu
function blocVersementIndividu({ dateVersement = '31122025', netFiscal = '2200.00', netVerse = '2100.50', tauxPAS = '7.50', typePAS = '01', nir, montantPAS = '165.00', netFiscalPot = '2200.00' }) {
  return [
    ['S21.G00.50.001', dateVersement],
    ['S21.G00.50.002', netFiscal],
    ['S21.G00.50.004', netVerse],
    ['S21.G00.50.006', tauxPAS],
    ['S21.G00.50.007', typePAS],
    ['S21.G00.50.008', nir],
    ['S21.G00.50.009', montantPAS],
    ['S21.G00.50.013', netFiscalPot],
  ];
}

// Bloc rémunérations (001=brut non plaf, 002=brut chômage, 003=brut plaf, 010=salaire base)
function blocRemunerations({ debut = '01122025', fin = '31122025', numContrat = '00001', brutMensuel = '2800.00' }) {
  return [
    ['S21.G00.51.001', debut], ['S21.G00.51.002', fin], ['S21.G00.51.010', numContrat], ['S21.G00.51.011', '001'], ['S21.G00.51.013', brutMensuel],
    ['S21.G00.51.001', debut], ['S21.G00.51.002', fin], ['S21.G00.51.010', numContrat], ['S21.G00.51.011', '002'], ['S21.G00.51.013', brutMensuel],
    ['S21.G00.51.001', debut], ['S21.G00.51.002', fin], ['S21.G00.51.010', numContrat], ['S21.G00.51.011', '003'], ['S21.G00.51.013', brutMensuel],
    ['S21.G00.51.001', debut], ['S21.G00.51.002', fin], ['S21.G00.51.010', numContrat], ['S21.G00.51.011', '010'], ['S21.G00.51.013', brutMensuel],
  ];
}

// Bloc activité
function blocActivite({ type = '01', heures = '151.67', unite = '10' }) {
  return [
    ['S21.G00.53.001', type],
    ['S21.G00.53.002', heures],
    ['S21.G00.53.003', unite],
  ];
}

// Bloc revenu net fiscal
function blocRevenuNet(montant = '2100.50') {
  return [
    ['S21.G00.58.003', '03'],
    ['S21.G00.58.004', montant],
  ];
}

// Bases assujetties (02=plafonnée, 03=déplafonnée, 04=CSG/CRDS, 07=chômage)
function blocBasesAssujetties({ brutMensuel = '2800.00', brutCSG = '2744.00', debut = '01122025', fin = '31122025' }) {
  return [
    // 02 - Base plafonnée SS
    ['S21.G00.78.001', '02'], ['S21.G00.78.002', debut], ['S21.G00.78.003', fin], ['S21.G00.78.004', brutMensuel],
    // 03 - Base déplafonnée SS
    ['S21.G00.78.001', '03'], ['S21.G00.78.002', debut], ['S21.G00.78.003', fin], ['S21.G00.78.004', brutMensuel],
    ['S21.G00.79.001', '01'], ['S21.G00.79.004', brutMensuel],
    // 04 - Base CSG/CRDS
    ['S21.G00.78.001', '04'], ['S21.G00.78.002', debut], ['S21.G00.78.003', fin], ['S21.G00.78.004', brutCSG],
    // 07 - Base chômage
    ['S21.G00.78.001', '07'], ['S21.G00.78.002', debut], ['S21.G00.78.003', fin], ['S21.G00.78.004', brutMensuel],
  ];
}

// Cotisations individuelles
function blocCotisations(siretOPS = '78861779300013', brutMensuel = '2800.00') {
  const b = brutMensuel;
  return [
    // URSSAF maladie (068)
    ['S21.G00.81.001', '068'], ['S21.G00.81.002', siretOPS], ['S21.G00.81.003', b], ['S21.G00.81.004', '18.20'], ['S21.G00.81.007', '0.65'],
    // URSSAF vieillesse plafonnée (074)
    ['S21.G00.81.001', '074'], ['S21.G00.81.002', siretOPS], ['S21.G00.81.003', b], ['S21.G00.81.004', '196.00'], ['S21.G00.81.007', '7.00'],
    // URSSAF vieillesse déplafonnée (075)
    ['S21.G00.81.001', '075'], ['S21.G00.81.002', siretOPS], ['S21.G00.81.003', b], ['S21.G00.81.004', '67.76'], ['S21.G00.81.007', '2.42'],
    // Allocations familiales (076)
    ['S21.G00.81.001', '076'], ['S21.G00.81.002', siretOPS], ['S21.G00.81.003', b], ['S21.G00.81.004', '96.60'], ['S21.G00.81.007', '3.45'],
    // CSG déductible (100)
    ['S21.G00.81.001', '100'], ['S21.G00.81.002', siretOPS], ['S21.G00.81.003', b], ['S21.G00.81.004', '96.60'], ['S21.G00.81.007', '3.45'],
    // AT (049)
    ['S21.G00.81.001', '049'], ['S21.G00.81.002', siretOPS], ['S21.G00.81.003', b], ['S21.G00.81.004', '30.80'], ['S21.G00.81.007', '1.10'],
    // Chômage (040)
    ['S21.G00.81.001', '040'], ['S21.G00.81.002', siretOPS], ['S21.G00.81.003', b], ['S21.G00.81.004', '117.60'], ['S21.G00.81.007', '4.20'],
    // AGS (048)
    ['S21.G00.81.001', '048'], ['S21.G00.81.002', siretOPS], ['S21.G00.81.003', b], ['S21.G00.81.004', '42.00'], ['S21.G00.81.007', '1.50'],
  ];
}

// Bloc ancienneté
function blocAnciennete({ type = '07', unite = '01', valeur = '62', numContrat = '00001' }) {
  return [
    ['S21.G00.86.001', type],
    ['S21.G00.86.002', unite],
    ['S21.G00.86.003', valeur],
    ['S21.G00.86.005', numContrat],
  ];
}

// ============================================
// SCÉNARIOS
// ============================================

const scenarios = [];

// --- SCÉNARIO 1 : CDI temps plein, régime général ---
scenarios.push({
  nom: '1. CDI temps plein - Développeur',
  description: 'Cas standard : 1 salarié CDI temps plein, régime général, cadre',
  dsn: buildDSN([
    ...blocEnvoi(),
    ...blocEmetteur(),
    ...blocContact(),
    ...blocDeclaration(),
    ...blocContactDecl(),
    ...blocEntreprise(),
    ...blocEtablissement(),
    ...blocVersement(),
    ...blocBordereau('78861779300013', '100', '2500.00'),
    ...blocBordereau('78861779300013', '260', '1400.00'),
    ...blocIndividu({ nir: '1850375123456', nom: 'MARTIN', prenom: 'Jean', sexe: '01', dateNaissance: '15031985', lieuNaissance: 'PARIS' }),
    ...blocContrat({ natureContrat: '01', statutCat: '02', pcsEse: '388a', libelleEmploi: 'Developpeur informatique', dateDebut: '01092020' }),
    ...blocRetraite('RETC'),
    ...blocVersementIndividu({ nir: '1850375123456', netFiscal: '2200.00', netVerse: '2100.50' }),
    ...blocRemunerations({ brutMensuel: '2800.00' }),
    ...blocActivite({}),
    ...blocRevenuNet('2100.50'),
    ...blocBasesAssujetties({ brutMensuel: '2800.00' }),
    ...blocCotisations(),
    ...blocAnciennete({ valeur: '62' }),
  ]),
});

// --- SCÉNARIO 2 : CDD remplacement ---
scenarios.push({
  nom: '2. CDD remplacement - Secrétaire',
  description: 'CDD motif remplacement, non-cadre, avec date fin prévisionnelle',
  dsn: buildDSN([
    ...blocEnvoi(),
    ...blocEmetteur(),
    ...blocContact(),
    ...blocDeclaration(),
    ...blocContactDecl(),
    ...blocEntreprise(),
    ...blocEtablissement(),
    ...blocVersement('78861779300013', '1200.00'),
    ...blocBordereau('78861779300013', '100', '1200.00'),
    ...blocIndividu({ nir: '2900175234567', nom: 'DURAND', prenom: 'Marie', sexe: '02', dateNaissance: '22011990', lieuNaissance: 'LYON' }),
    ...blocContrat({
      natureContrat: '02',
      motifRecours: '02',
      dateFinPrev: '31032026',
      statutConv: '03',
      statutCat: '04',
      pcsEse: '542a',
      libelleEmploi: 'Secretaire administrative',
      dateDebut: '15112025',
      ccn: '2098',
    }),
    ...blocRetraite('RETC'),
    ...blocVersementIndividu({ nir: '2900175234567', netFiscal: '1350.00', netVerse: '1280.00', tauxPAS: '5.00', montantPAS: '67.50' }),
    ...blocRemunerations({ brutMensuel: '1801.80', numContrat: '00001' }),
    ...blocActivite({ heures: '151.67' }),
    ...blocRevenuNet('1280.00'),
    ...blocBasesAssujetties({ brutMensuel: '1801.80', brutCSG: '1766.00' }),
    ...blocCotisations('78861779300013', '1801.80'),
    ...blocAnciennete({ valeur: '1' }),
  ]),
});

// --- SCÉNARIO 3 : CDI temps partiel 80% ---
scenarios.push({
  nom: '3. CDI temps partiel 80% - Comptable',
  description: 'CDI temps partiel, non-cadre, 121.33h/mois',
  dsn: buildDSN([
    ...blocEnvoi(),
    ...blocEmetteur(),
    ...blocContact(),
    ...blocDeclaration(),
    ...blocContactDecl(),
    ...blocEntreprise(),
    ...blocEtablissement(),
    ...blocVersement('78861779300013', '1500.00'),
    ...blocBordereau('78861779300013', '100', '1500.00'),
    ...blocIndividu({ nir: '2880692345678', nom: 'PETIT', prenom: 'Sophie', sexe: '02', dateNaissance: '10061988', lieuNaissance: 'MARSEILLE', deptNaissance: '13' }),
    ...blocContrat({
      natureContrat: '01',
      modaliteTemps: '20', // temps partiel
      quotiteCtr: '121.33',
      quotiteRef: '151.67',
      statutConv: '04',
      statutCat: '04',
      pcsEse: '543a',
      libelleEmploi: 'Comptable',
      dateDebut: '01032018',
    }),
    ...blocRetraite('RETC'),
    ...blocVersementIndividu({ nir: '2880692345678', netFiscal: '1600.00', netVerse: '1520.00', tauxPAS: '3.50', montantPAS: '56.00' }),
    ...blocRemunerations({ brutMensuel: '2000.00' }),
    ...blocActivite({ heures: '121.33' }),
    ...blocRevenuNet('1520.00'),
    ...blocBasesAssujetties({ brutMensuel: '2000.00', brutCSG: '1960.00' }),
    ...blocCotisations('78861779300013', '2000.00'),
    ...blocAnciennete({ valeur: '93' }),
  ]),
});

// --- SCÉNARIO 4 : Salarié étranger (hors UE) ---
scenarios.push({
  nom: '4. CDI salarié étranger hors UE - Cuisinier',
  description: 'Salarié non-UE avec autorisation de travail',
  dsn: buildDSN([
    ...blocEnvoi(),
    ...blocEmetteur('552032534', '00018', 'RESTAURANT LE GOURMET'),
    ...blocContact(),
    ...blocDeclaration('01122025', '55203253400018'),
    ...blocContactDecl(),
    ...blocEntreprise('552032534', '00018'),
    ...blocEtablissement('00018'),
    ...blocVersement('78861779300013', '1800.00'),
    ...blocBordereau('78861779300013', '100', '1800.00'),
    ...blocIndividu({
      nir: '1951299345678',
      nom: 'DIALLO',
      prenom: 'Amadou',
      sexe: '01',
      dateNaissance: '03051995',
      lieuNaissance: 'DAKAR',
      adresse: '8 RUE DES LILAS',
      cp: '93100',
      ville: 'MONTREUIL',
      codifUE: '02', // hors UE
      deptNaissance: '99',
      paysNaissance: 'SN',
    }),
    ...blocContrat({
      natureContrat: '01',
      travailleurEtranger: '01', // avec autorisation
      pcsEse: '636d',
      libelleEmploi: 'Cuisinier',
      dateDebut: '15062023',
      ccn: '1979',
      siretLieu: '55203253400018',
      codeRisqueAT: '553AB',
      tauxAT: '2.22',
    }),
    ...blocRetraite('RETC'),
    ...blocVersementIndividu({ nir: '1951299345678', netFiscal: '1500.00', netVerse: '1430.00', tauxPAS: '0.00', typePAS: '01', montantPAS: '0.00' }),
    ...blocRemunerations({ brutMensuel: '1900.00' }),
    ...blocActivite({}),
    ...blocRevenuNet('1430.00'),
    ...blocBasesAssujetties({ brutMensuel: '1900.00', brutCSG: '1862.00' }),
    ...blocCotisations('78861779300013', '1900.00'),
    ...blocAnciennete({ valeur: '30' }),
  ]),
});

// --- SCÉNARIO 5 : Multi-salariés (3 salariés) ---
scenarios.push({
  nom: '5. Multi-salariés - 3 employés',
  description: '3 salariés : 1 cadre CDI + 1 non-cadre CDI + 1 CDD',
  dsn: buildDSN([
    ...blocEnvoi(),
    ...blocEmetteur('443061841', '00013', 'PME SERVICES PLUS'),
    ...blocContact(),
    ...blocDeclaration('01122025', '44306184100013'),
    ...blocContactDecl(),
    ...blocEntreprise('443061841', '00013'),
    ...blocEtablissement('00013'),
    ...blocVersement('78861779300013', '6500.00'),
    ...blocBordereau('78861779300013', '100', '6500.00'),
    ...blocBordereau('78861779300013', '260', '3600.00'),

    // Salarié 1 — Cadre CDI
    ...blocIndividu({ nir: '1780175456789', nom: 'LEFEBVRE', prenom: 'Pierre', sexe: '01', dateNaissance: '20071978' }),
    ...blocContrat({ natureContrat: '01', statutCat: '02', pcsEse: '372a', libelleEmploi: 'Directeur commercial', dateDebut: '01012015', siretLieu: '44306184100013' }),
    ...blocRetraite('RETC'),
    ...blocVersementIndividu({ nir: '1780175456789', netFiscal: '3800.00', netVerse: '3500.00', tauxPAS: '12.00', montantPAS: '456.00' }),
    ...blocRemunerations({ brutMensuel: '5000.00' }),
    ...blocActivite({}),
    ...blocRevenuNet('3500.00'),
    ...blocBasesAssujetties({ brutMensuel: '5000.00', brutCSG: '4900.00' }),
    ...blocCotisations('78861779300013', '5000.00'),
    ...blocAnciennete({ valeur: '131' }),

    // Salarié 2 — Non-cadre CDI
    ...blocIndividu({ nir: '2920693567890', nom: 'MOREAU', prenom: 'Camille', sexe: '02', dateNaissance: '14091992', deptNaissance: '93', lieuNaissance: 'BOBIGNY' }),
    ...blocContrat({ natureContrat: '01', statutCat: '04', pcsEse: '543d', libelleEmploi: 'Assistante de direction', dateDebut: '01092021', siretLieu: '44306184100013' }),
    ...blocRetraite('RETC'),
    ...blocVersementIndividu({ nir: '2920693567890', netFiscal: '1900.00', netVerse: '1800.00', tauxPAS: '5.50', montantPAS: '104.50' }),
    ...blocRemunerations({ brutMensuel: '2400.00' }),
    ...blocActivite({}),
    ...blocRevenuNet('1800.00'),
    ...blocBasesAssujetties({ brutMensuel: '2400.00', brutCSG: '2352.00' }),
    ...blocCotisations('78861779300013', '2400.00'),
    ...blocAnciennete({ valeur: '51' }),

    // Salarié 3 — CDD
    ...blocIndividu({ nir: '1000175678901', nom: 'BERNARD', prenom: 'Lucas', sexe: '01', dateNaissance: '28022000', lieuNaissance: 'NANTES', deptNaissance: '44' }),
    ...blocContrat({ natureContrat: '02', motifRecours: '01', dateFinPrev: '28022026', statutCat: '04', pcsEse: '651a', libelleEmploi: 'Agent de maintenance', dateDebut: '01102025', siretLieu: '44306184100013' }),
    ...blocRetraite('RETC'),
    ...blocVersementIndividu({ nir: '1000175678901', netFiscal: '1400.00', netVerse: '1350.00', tauxPAS: '0.00', montantPAS: '0.00' }),
    ...blocRemunerations({ brutMensuel: '1801.80' }),
    ...blocActivite({}),
    ...blocRevenuNet('1350.00'),
    ...blocBasesAssujetties({ brutMensuel: '1801.80', brutCSG: '1766.00' }),
    ...blocCotisations('78861779300013', '1801.80'),
    ...blocAnciennete({ valeur: '2' }),
  ]),
});

// --- SCÉNARIO 6 : Multi-contrat (même salarié, 2 contrats) ---
scenarios.push({
  nom: '6. Multi-contrat - 1 salarié avec 2 contrats',
  description: 'Salarié avec CDI principal + CDD complémentaire',
  dsn: buildDSN([
    ...blocEnvoi(),
    ...blocEmetteur(),
    ...blocContact(),
    ...blocDeclaration(),
    ...blocContactDecl(),
    ...blocEntreprise(),
    ...blocEtablissement(),
    ...blocVersement('78861779300013', '3500.00'),
    ...blocBordereau('78861779300013', '100', '3500.00'),
    ...blocIndividu({ nir: '1870275789012', nom: 'GARCIA', prenom: 'Thomas', sexe: '01', dateNaissance: '12021987' }),

    // Contrat 1 — CDI principal
    ...blocContrat({
      natureContrat: '01', numContrat: '00001', pcsEse: '461e', libelleEmploi: 'Technicien reseau',
      emploisMultiples: '01', employeursMultiples: '01',
    }),
    ...blocRetraite('RETC'),

    // Contrat 2 — CDD complémentaire
    ...blocContrat({
      natureContrat: '02', numContrat: '00002', motifRecours: '03', dateFinPrev: '31032026',
      pcsEse: '461e', libelleEmploi: 'Technicien reseau projet',
      emploisMultiples: '01', employeursMultiples: '01',
      dateDebut: '01112025',
    }),
    ...blocRetraite('RETC'),

    ...blocVersementIndividu({ nir: '1870275789012', netFiscal: '2800.00', netVerse: '2650.00', tauxPAS: '8.00', montantPAS: '224.00' }),
    // Rémunérations contrat 1
    ...blocRemunerations({ brutMensuel: '2500.00', numContrat: '00001' }),
    // Rémunérations contrat 2
    ...blocRemunerations({ brutMensuel: '1000.00', numContrat: '00002' }),
    ...blocActivite({}),
    ...blocRevenuNet('2650.00'),
    ...blocBasesAssujetties({ brutMensuel: '3500.00', brutCSG: '3430.00' }),
    ...blocCotisations('78861779300013', '3500.00'),
    ...blocAnciennete({ type: '07', valeur: '60', numContrat: '00001' }),
    ...blocAnciennete({ type: '07', valeur: '1', numContrat: '00002' }),
  ]),
});

// --- SCÉNARIO 7 : Erreurs volontaires (doit échouer) ---
scenarios.push({
  nom: '7. ERREURS VOLONTAIRES - doit échouer',
  description: 'DSN avec erreurs connues : NIR invalide, CDD sans motif, code PCS invalide, nature contrat inconnue',
  attendu: 'INVALIDE',
  dsn: buildDSN([
    ...blocEnvoi(),
    ...blocEmetteur(),
    ...blocContact(),
    ...blocDeclaration(),
    ...blocContactDecl(),
    ...blocEntreprise(),
    ...blocEtablissement(),
    ...blocVersement('78861779300013', '1500.00'),
    ...blocBordereau('78861779300013', '100', '1500.00'),
    ...blocIndividu({ nir: '3990175999999', nom: 'ERREUR', prenom: 'Test', sexe: '01', dateNaissance: '01011990' }), // NIR invalide (commence par 3)
    ...blocContrat({
      natureContrat: '02', // CDD
      // PAS de motifRecours → erreur MET-12
      // PAS de dateFinPrev → erreur MET-05
      pcsEse: 'XXXX', // PCS invalide
      libelleEmploi: 'Test erreur',
    }),
    ...blocRetraite('RETC'),
    ...blocVersementIndividu({ nir: '3990175999999', netFiscal: '1000.00', netVerse: '950.00', tauxPAS: '0.00', montantPAS: '0.00' }),
    ...blocRemunerations({ brutMensuel: '1500.00' }),
    ...blocActivite({}),
    ...blocRevenuNet('950.00'),
    ...blocBasesAssujetties({ brutMensuel: '1500.00' }),
    ...blocCotisations('78861779300013', '1500.00'),
    ...blocAnciennete({ valeur: '5' }),
  ]),
});

// --- SCÉNARIO 8 : Période 2026 avec norme P26V01 ---
scenarios.push({
  nom: '8. Période janvier 2026 - P26V01',
  description: 'DSN de janvier 2026 avec norme P26V01',
  dsn: buildDSN([
    ...blocEnvoi('P26V01'),
    ...blocEmetteur(),
    ...blocContact(),
    ...blocDeclaration('01012026'),
    ...blocContactDecl(),
    ...blocEntreprise(),
    ...blocEtablissement(),
    ...blocVersement('78861779300013', '2500.00', '01012026', '31012026'),
    ...blocBordereau('78861779300013', '100', '2500.00', '01012026', '31012026'),
    ...blocIndividu({ nir: '1900475890123', nom: 'ROBERT', prenom: 'Alexandre', sexe: '01', dateNaissance: '05041990' }),
    ...blocContrat({ natureContrat: '01', dateDebut: '01062019', siretLieu: '12345678900011' }),
    ...blocRetraite('RETC'),
    ...blocVersementIndividu({ nir: '1900475890123', netFiscal: '2200.00', netVerse: '2050.00', tauxPAS: '7.00', montantPAS: '154.00' }),
    ...blocRemunerations({ brutMensuel: '2800.00', debut: '01012026', fin: '31012026' }),
    ...blocActivite({}),
    ...blocRevenuNet('2050.00'),
    ...blocBasesAssujetties({ brutMensuel: '2800.00', debut: '01012026', fin: '31012026' }),
    ...blocCotisations('78861779300013', '2800.00'),
    ...blocAnciennete({ valeur: '79' }),
  ]),
});

// ============================================
// EXÉCUTION
// ============================================

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║           SUITE DE TESTS DSN — NEXUS VALIDATOR             ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

let passed = 0;
let failed = 0;

for (const scenario of scenarios) {
  const result = validerDSN(scenario.dsn);
  const attenduValide = scenario.attendu !== 'INVALIDE';
  const ok = result.valide === attenduValide;

  const status = ok ? '✅ PASS' : '❌ FAIL';
  if (ok) passed++; else failed++;

  console.log(`${status} | ${scenario.nom}`);
  console.log(`       ${scenario.description}`);
  console.log(`       Rubriques: ${result.stats.nb_rubriques} | Salariés: ${result.stats.nb_salaries} | Contrôles: ${result.stats.controles_effectues}`);
  console.log(`       Erreurs: ${result.erreurs.length} | Avertissements: ${result.avertissements.length}`);

  if (result.erreurs.length > 0) {
    result.erreurs.forEach(e => console.log(`       ⚠ [${e.code}] ${e.message}`));
  }
  if (result.avertissements.length > 0) {
    result.avertissements.forEach(a => console.log(`       ℹ [${a.code}] ${a.message}`));
  }
  console.log('');
}

console.log('═'.repeat(62));
console.log(`RÉSULTAT: ${passed}/${scenarios.length} PASS | ${failed} FAIL`);
console.log('═'.repeat(62));

// Écrire les DSN dans /tmp pour test CTL si besoin
import { writeFileSync } from 'fs';
for (let i = 0; i < scenarios.length; i++) {
  const filename = `/tmp/dsn-test-${i + 1}.dsn`;
  writeFileSync(filename, scenarios[i].dsn, 'utf-8');
}
console.log(`\n📁 Fichiers DSN écrits dans /tmp/dsn-test-{1..${scenarios.length}}.dsn`);
console.log('   → Soumettez-les à DSN-CTL pour vérifier la conformité\n');
