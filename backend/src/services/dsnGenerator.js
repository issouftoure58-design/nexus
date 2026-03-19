/**
 * Generateur DSN complet - Format NEODeS 2026
 * Genere les 150-200+ rubriques necessaires pour une DSN mensuelle conforme
 */

import { supabase } from '../config/supabase.js';
import { TAUX_2026 } from './payrollEngine.js';

// ============================================
// HELPERS
// ============================================

function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '').slice(0, 8);
}

function formatMontant(centimes) {
  if (!centimes && centimes !== 0) return '0';
  return String(Math.round(Math.abs(centimes) / 100));
}

function formatMontantDecimal(centimes) {
  if (!centimes && centimes !== 0) return '0.00';
  return (Math.abs(centimes) / 100).toFixed(2);
}

function formatHeures(heures) {
  return String(Math.round((heures || 0) * 100));
}

function pad(num, len) {
  return String(num || 0).padStart(len, '0');
}

// ============================================
// GENERATEUR DSN
// ============================================

/**
 * Genere une DSN complete
 * @param {string} tenantId
 * @param {string} periode - Format YYYY-MM
 * @param {string} nature - 01=mensuelle, 02=arret, 04=fin contrat, 05=reprise
 * @param {Object} options - membreId (pour evenementielle), evenement details
 * @returns {Object} { content, stats, filename }
 */
export async function generateDSN(tenantId, periode, nature = '01', options = {}) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!periode) throw new Error('periode requis');

  // Recuperer parametres DSN
  const { data: params } = await supabase
    .from('rh_dsn_parametres')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (!params || !params.siret) {
    throw new Error('Parametres DSN incomplets. Configurez les informations entreprise.');
  }

  // Recuperer les membres actifs
  const { data: membres } = await supabase
    .from('rh_membres')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('statut', 'actif');

  // Recuperer bulletins de la periode
  const { data: bulletins } = await supabase
    .from('rh_bulletins_paie')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('periode', periode);

  const bulletinsMap = new Map();
  (bulletins || []).forEach(b => bulletinsMap.set(b.membre_id, b));

  // Construction DSN
  const lines = [];
  let nbRubriques = 0;

  const add = (code, value) => {
    if (value !== null && value !== undefined && value !== '') {
      lines.push(`${code},'${value}'`);
      nbRubriques++;
    }
  };

  const [year, month] = periode.split('-');
  const dateGen = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const moisDecl = `${year}${month}`;
  const dernierJour = new Date(parseInt(year), parseInt(month), 0).getDate();

  // =====================================================
  // S10 - ENVOI
  // =====================================================
  const emetteurLines = generateBlocEmetteur(params, dateGen);
  emetteurLines.forEach(([c, v]) => add(c, v));

  // =====================================================
  // S20 - DECLARATION
  // =====================================================
  add('S20.G00.05.001', nature);
  add('S20.G00.05.002', '01'); // Type: normal
  add('S20.G00.05.003', params.fraction || '11');
  add('S20.G00.05.004', '00');
  add('S20.G00.05.005', `01${moisDecl}`);
  add('S20.G00.05.007', '01'); // Euro
  add('S20.G00.05.008', '01'); // Regime general
  add('S20.G00.05.009', params.urssaf_code || '');
  add('S20.G00.05.010', dateGen);

  // Contact declaration
  add('S20.G00.07.001', params.contact_nom);
  add('S20.G00.07.002', params.contact_email);
  if (params.contact_tel) add('S20.G00.07.004', params.contact_tel);

  // =====================================================
  // S21.G00.06 - ENTREPRISE
  // =====================================================
  const entrepriseLines = generateBlocEntreprise(params, membres);
  entrepriseLines.forEach(([c, v]) => add(c, v));

  // =====================================================
  // S21.G00.11 - ETABLISSEMENT
  // =====================================================
  const etablissementLines = generateBlocEtablissement(params, membres);
  etablissementLines.forEach(([c, v]) => add(c, v));

  // =====================================================
  // S21.G00.20 - VERSEMENT ORGANISME DE PROTECTION SOCIALE
  // =====================================================
  const versementOrgLines = generateBlocVersementOrganisme(bulletins || [], params);
  versementOrgLines.forEach(([c, v]) => add(c, v));

  // =====================================================
  // S21.G00.22/23 - BORDEREAU COTISATIONS
  // =====================================================
  const bordereauLines = generateBlocBordereau(bulletins || [], params, moisDecl);
  bordereauLines.forEach(([c, v]) => add(c, v));

  // =====================================================
  // INDIVIDUS (S21.G00.30 + contrats + versements + remunerations)
  // =====================================================
  let nbSalaries = 0;

  const membresATraiter = nature === '01'
    ? (membres || [])
    : (membres || []).filter(m => m.id === options.membreId);

  for (const membre of membresATraiter) {
    const bulletin = bulletinsMap.get(membre.id);
    if (!bulletin && !membre.salaire_mensuel) continue;

    nbSalaries++;

    // S21.G00.30 - Individu
    const individuLines = generateBlocIndividu(membre);
    individuLines.forEach(([c, v]) => add(c, v));

    // S21.G00.40 - Contrat
    const contratLines = generateBlocContrat(membre, params);
    contratLines.forEach(([c, v]) => add(c, v));

    // S21.G00.50 - Versement individu
    const versementLines = generateBlocVersementIndividu(bulletin, membre, moisDecl);
    versementLines.forEach(([c, v]) => add(c, v));

    // S21.G00.51 - Remunerations
    const remuLines = generateBlocRemunerations(bulletin, membre, moisDecl, dernierJour);
    remuLines.forEach(([c, v]) => add(c, v));

    // S21.G00.53 - Activites
    const activiteLines = generateBlocActivites(bulletin, membre, moisDecl, dernierJour);
    activiteLines.forEach(([c, v]) => add(c, v));

    // S21.G00.78 - Bases assujetties
    const basesLines = generateBlocBasesAssujetties(bulletin, membre);
    basesLines.forEach(([c, v]) => add(c, v));

    // S21.G00.81 - Cotisations individuelles
    const cotisIndivLines = generateBlocCotisationsIndividuelles(bulletin, membre);
    cotisIndivLines.forEach(([c, v]) => add(c, v));

    // Evenementielles
    if (nature === '02' && options.evenement) {
      const arretLines = generateBlocArretTravail(options.evenement);
      arretLines.forEach(([c, v]) => add(c, v));
    }
    if (nature === '04' && options.evenement) {
      const finLines = generateBlocFinContrat(options.evenement);
      finLines.forEach(([c, v]) => add(c, v));
    }
  }

  // =====================================================
  // S90 - TOTAL
  // =====================================================
  const totauxLines = generateTotaux(nbRubriques, nbSalaries);
  totauxLines.forEach(([c, v]) => add(c, v));

  const content = lines.join('\n') + '\n';
  const filename = `DSN_${nature}_${periode.replace('-', '')}_${Date.now()}.dsn`;

  return {
    content,
    stats: {
      blocs: nbRubriques,
      lignes: lines.length,
      individus: nbSalaries,
      nature,
      periode,
    },
    filename,
  };
}

// ============================================
// BLOCS INDIVIDUELS
// ============================================

export function generateBlocEmetteur(params, dateGen) {
  const lines = [];
  lines.push(['S10.G00.00.001', params.logiciel_paie || 'NEXUS SIRH']);
  lines.push(['S10.G00.00.002', 'NEXUS']);
  lines.push(['S10.G00.00.003', '1.0.0']);
  lines.push(['S10.G00.00.005', '01']); // Reel
  lines.push(['S10.G00.00.006', params.version_norme || 'P26V01']);
  lines.push(['S10.G00.00.007', '01']); // net-entreprises
  lines.push(['S10.G00.00.008', '01']); // Normal

  // Emetteur
  lines.push(['S10.G00.01.001', params.siren]);
  lines.push(['S10.G00.01.002', params.nic || params.siret?.slice(9)]);
  lines.push(['S10.G00.01.004', params.raison_sociale]);
  lines.push(['S10.G00.01.005', params.adresse_siege]);
  lines.push(['S10.G00.01.006', params.code_postal_siege]);
  lines.push(['S10.G00.01.007', params.ville_siege]);

  // Contact emetteur
  if (params.contact_nom) lines.push(['S10.G00.02.001', params.contact_nom]);
  if (params.contact_email) lines.push(['S10.G00.02.002', params.contact_email]);
  if (params.contact_tel) lines.push(['S10.G00.02.004', params.contact_tel]);

  return lines;
}

export function generateBlocEntreprise(params, membres) {
  const lines = [];
  lines.push(['S21.G00.06.001', params.siren]);
  lines.push(['S21.G00.06.002', params.code_naf]);
  lines.push(['S21.G00.06.003', params.adresse_siege]);
  lines.push(['S21.G00.06.004', params.code_postal_siege]);
  lines.push(['S21.G00.06.005', params.ville_siege]);
  lines.push(['S21.G00.06.006', pad(params.effectif_moyen || membres?.length || 0, 5)]);
  if (params.raison_sociale) lines.push(['S21.G00.06.007', params.raison_sociale]);
  return lines;
}

export function generateBlocEtablissement(params, membres) {
  const lines = [];
  lines.push(['S21.G00.11.001', params.nic || params.siret?.slice(9)]);
  lines.push(['S21.G00.11.003', params.code_naf]);
  lines.push(['S21.G00.11.004', params.adresse_etablissement || params.adresse_siege]);
  lines.push(['S21.G00.11.005', params.code_postal_etablissement || params.code_postal_siege]);
  lines.push(['S21.G00.11.006', params.ville_etablissement || params.ville_siege]);
  lines.push(['S21.G00.11.008', pad(params.effectif_moyen || membres?.length || 0, 5)]);
  return lines;
}

export function generateBlocVersementOrganisme(bulletins, params) {
  const lines = [];
  if (!bulletins.length) return lines;

  // Agreger les montants
  let totalCotisPatronales = 0;
  let totalCotisSalariales = 0;
  for (const b of bulletins) {
    totalCotisPatronales += b.total_cotisations_patronales || 0;
    totalCotisSalariales += b.total_cotisations_salariales || 0;
  }

  // URSSAF
  lines.push(['S21.G00.20.001', params.urssaf_code || '']);
  if (params.urssaf_bic) lines.push(['S21.G00.20.002', params.urssaf_bic]);
  if (params.urssaf_iban) lines.push(['S21.G00.20.003', params.urssaf_iban]);
  lines.push(['S21.G00.20.005', formatMontantDecimal(totalCotisPatronales + totalCotisSalariales)]);
  lines.push(['S21.G00.20.006', '01']); // Mode paiement

  // Retraite complementaire (si renseigne)
  if (params.retraite_code) {
    lines.push(['S21.G00.20.001', params.retraite_code]);
    // Calculer cotis retraite (approximation depuis bulletins)
    let totalRetraite = 0;
    for (const b of bulletins) {
      const cotisP = b.cotisations_patronales || [];
      const cotisS = b.cotisations_salariales || [];
      for (const c of [...cotisP, ...cotisS]) {
        if (c.code && (c.code.includes('AGIRC') || c.code.includes('CEG'))) {
          totalRetraite += c.montant || 0;
        }
      }
    }
    lines.push(['S21.G00.20.005', formatMontantDecimal(totalRetraite)]);
    lines.push(['S21.G00.20.006', '01']);
  }

  return lines;
}

export function generateBlocBordereau(bulletins, params, moisDecl) {
  const lines = [];
  if (!bulletins.length) return lines;

  // CTP 100 - Cas general (cotisations SS)
  let baseBrut = 0;
  let totalCotisSS = 0;
  for (const b of bulletins) {
    baseBrut += b.brut_total || 0;
    const cotisP = b.cotisations_patronales || [];
    const cotisS = b.cotisations_salariales || [];
    for (const c of [...cotisP, ...cotisS]) {
      if (c.code && !c.code.includes('AGIRC') && !c.code.includes('CEG') && !c.code.includes('CSG') && !c.code.includes('CRDS')) {
        totalCotisSS += c.montant || 0;
      }
    }
  }

  // Bordereau URSSAF
  lines.push(['S21.G00.22.001', '100']); // CTP 100 - Cas general
  lines.push(['S21.G00.22.003', formatMontantDecimal(baseBrut)]);
  lines.push(['S21.G00.22.004', formatMontantDecimal(totalCotisSS)]);

  // CTP 260 - Reduction Fillon
  let totalFillon = 0;
  for (const b of bulletins) {
    totalFillon += b.reduction_fillon || 0;
  }
  if (totalFillon > 0) {
    lines.push(['S21.G00.22.001', '260']);
    lines.push(['S21.G00.22.003', formatMontantDecimal(baseBrut)]);
    lines.push(['S21.G00.22.004', formatMontantDecimal(totalFillon)]);
  }

  // CTP 332 - CSG/CRDS
  let totalCSG = 0;
  for (const b of bulletins) {
    const cotisS = b.cotisations_salariales || [];
    for (const c of cotisS) {
      if (c.code && (c.code.includes('CSG') || c.code.includes('CRDS'))) {
        totalCSG += c.montant || 0;
      }
    }
  }
  if (totalCSG > 0) {
    lines.push(['S21.G00.22.001', '332']);
    const baseCSG = Math.round(baseBrut * 0.9825);
    lines.push(['S21.G00.22.003', formatMontantDecimal(baseCSG)]);
    lines.push(['S21.G00.22.004', formatMontantDecimal(totalCSG)]);
  }

  return lines;
}

export function generateBlocIndividu(membre) {
  const lines = [];
  lines.push(['S21.G00.30.001', membre.nir || '']);
  lines.push(['S21.G00.30.002', (membre.nom || '').toUpperCase()]);
  lines.push(['S21.G00.30.004', membre.prenom || '']);
  lines.push(['S21.G00.30.006', membre.sexe === 'M' ? '01' : '02']);
  if (membre.date_naissance) lines.push(['S21.G00.30.007', formatDate(membre.date_naissance)]);
  if (membre.lieu_naissance) lines.push(['S21.G00.30.008', membre.lieu_naissance]);
  if (membre.code_pays_naissance) lines.push(['S21.G00.30.009', membre.code_pays_naissance]);
  else lines.push(['S21.G00.30.009', '99100']); // France par defaut
  if (membre.adresse_rue) lines.push(['S21.G00.30.014', membre.adresse_rue]);
  if (membre.adresse_cp) lines.push(['S21.G00.30.015', membre.adresse_cp]);
  if (membre.adresse_ville) lines.push(['S21.G00.30.016', membre.adresse_ville]);
  if (membre.email) lines.push(['S21.G00.30.018', membre.email]);
  return lines;
}

export function generateBlocContrat(membre, params) {
  const lines = [];
  if (membre.date_embauche) lines.push(['S21.G00.40.001', formatDate(membre.date_embauche)]);
  lines.push(['S21.G00.40.002', '01']); // Statut: 01=salarie general
  lines.push(['S21.G00.40.003', '01']); // Statut conventionnel
  lines.push(['S21.G00.40.004', formatHeures(membre.heures_mensuelles || 151.67)]);
  lines.push(['S21.G00.40.006', '01']); // Unite: 01=heure
  lines.push(['S21.G00.40.007', membre.type_contrat === 'cdi' ? '01' : '02']);
  if (membre.poste || membre.role) lines.push(['S21.G00.40.008', membre.poste || membre.role]);
  lines.push(['S21.G00.40.009', '99']); // Dispositif politique publique: 99=non concerne
  lines.push(['S21.G00.40.011', formatHeures(membre.heures_mensuelles || 151.67)]);
  lines.push(['S21.G00.40.012', '01']); // Unite mesure quotite
  if (params.idcc) lines.push(['S21.G00.40.016', params.idcc]);
  if (membre.categorie_sociopro) lines.push(['S21.G00.40.019', membre.categorie_sociopro]);
  lines.push(['S21.G00.40.026', '01']); // Regime base: 01=general
  if (membre.date_fin_contrat) lines.push(['S21.G00.40.010', formatDate(membre.date_fin_contrat)]);
  return lines;
}

export function generateBlocVersementIndividu(bulletin, membre, moisDecl) {
  const lines = [];
  const brut = bulletin ? bulletin.brut_total : (membre.salaire_mensuel || 0);
  const netImposable = bulletin ? (bulletin.net_imposable || 0) : Math.round(brut * 0.78);
  const netVerse = bulletin ? bulletin.net_a_payer : Math.round(brut * 0.75);

  lines.push(['S21.G00.50.001', `01${moisDecl}`]); // Date versement
  lines.push(['S21.G00.50.002', formatMontantDecimal(netImposable)]); // Remuneration nette fiscale
  lines.push(['S21.G00.50.004', formatMontantDecimal(netVerse)]); // Montant net verse
  lines.push(['S21.G00.50.006', '01']); // Virement
  lines.push(['S21.G00.50.009', formatMontantDecimal(brut)]); // Remuneration brute

  // PAS
  const tauxPAS = bulletin?.taux_ir || 0;
  const montantPAS = bulletin?.montant_ir || 0;
  if (tauxPAS > 0) {
    lines.push(['S21.G00.50.011', String(tauxPAS)]); // Taux PAS
    lines.push(['S21.G00.50.012', '01']); // Type taux: 01=bareme
    lines.push(['S21.G00.50.013', formatMontantDecimal(montantPAS)]); // Montant PAS
  }

  return lines;
}

export function generateBlocRemunerations(bulletin, membre, moisDecl, dernierJour) {
  const lines = [];
  const dateDebut = `01${moisDecl}`;
  const dateFin = `${pad(dernierJour, 2)}${moisDecl}`;

  // Type 001 - Remuneration brute non plafonnee
  const brut = bulletin ? bulletin.brut_total : (membre.salaire_mensuel || 0);
  lines.push(['S21.G00.51.001', dateDebut]);
  lines.push(['S21.G00.51.002', dateFin]);
  lines.push(['S21.G00.51.010', '001']);
  lines.push(['S21.G00.51.011', formatMontantDecimal(brut)]);
  lines.push(['S21.G00.51.012', formatHeures(membre.heures_mensuelles || 151.67)]);

  // Type 002 - Salaire brut
  const salaireBase = bulletin ? bulletin.salaire_base : (membre.salaire_mensuel || 0);
  lines.push(['S21.G00.51.001', dateDebut]);
  lines.push(['S21.G00.51.002', dateFin]);
  lines.push(['S21.G00.51.010', '002']);
  lines.push(['S21.G00.51.011', formatMontantDecimal(salaireBase)]);

  // Type 010 - Net fiscal (net imposable)
  const netImposable = bulletin ? (bulletin.net_imposable || 0) : Math.round(brut * 0.78);
  lines.push(['S21.G00.51.001', dateDebut]);
  lines.push(['S21.G00.51.002', dateFin]);
  lines.push(['S21.G00.51.010', '010']);
  lines.push(['S21.G00.51.011', formatMontantDecimal(netImposable)]);

  // Type 011 - Net a payer avant PAS
  const netSocial = bulletin ? (bulletin.net_social || bulletin.net_avant_ir || 0) : Math.round(brut * 0.78);
  lines.push(['S21.G00.51.001', dateDebut]);
  lines.push(['S21.G00.51.002', dateFin]);
  lines.push(['S21.G00.51.010', '011']);
  lines.push(['S21.G00.51.011', formatMontantDecimal(netSocial)]);

  // Heures supplementaires si presentes
  if (bulletin && (bulletin.montant_hs_25 > 0 || bulletin.montant_hs_50 > 0)) {
    const montantHS = (bulletin.montant_hs_25 || 0) + (bulletin.montant_hs_50 || 0);
    lines.push(['S21.G00.51.001', dateDebut]);
    lines.push(['S21.G00.51.002', dateFin]);
    lines.push(['S21.G00.51.010', '017']); // Heures supp exonerees
    lines.push(['S21.G00.51.011', formatMontantDecimal(montantHS)]);
  }

  // Primes
  if (bulletin?.primes && Array.isArray(bulletin.primes)) {
    for (const prime of bulletin.primes) {
      if (prime.montant > 0) {
        // S21.G00.52 - Prime/gratification
        lines.push(['S21.G00.52.001', '01']); // Type prime
        lines.push(['S21.G00.52.002', formatMontantDecimal(prime.montant)]);
        lines.push(['S21.G00.52.006', dateDebut]);
        lines.push(['S21.G00.52.007', dateFin]);
      }
    }
  }

  return lines;
}

export function generateBlocActivites(bulletin, membre, moisDecl, dernierJour) {
  const lines = [];
  const dateDebut = `01${moisDecl}`;
  const dateFin = `${pad(dernierJour, 2)}${moisDecl}`;

  // Activite principale - Travail
  const heures = membre.heures_mensuelles || 151.67;
  lines.push(['S21.G00.53.001', '01']); // Type: 01=travail remunere
  lines.push(['S21.G00.53.002', formatHeures(heures)]); // Mesure
  lines.push(['S21.G00.53.003', '01']); // Unite: 01=heure
  lines.push(['S21.G00.53.004', dateDebut]);
  lines.push(['S21.G00.53.005', dateFin]);

  // Heures supplementaires
  if (bulletin) {
    const hs25 = bulletin.heures_supp_25 || 0;
    const hs50 = bulletin.heures_supp_50 || 0;
    if (hs25 > 0) {
      lines.push(['S21.G00.53.001', '03']); // Heures supp structurelles
      lines.push(['S21.G00.53.002', formatHeures(hs25)]);
      lines.push(['S21.G00.53.003', '01']);
      lines.push(['S21.G00.53.004', dateDebut]);
      lines.push(['S21.G00.53.005', dateFin]);
    }
    if (hs50 > 0) {
      lines.push(['S21.G00.53.001', '04']); // Heures supp exceptionelles
      lines.push(['S21.G00.53.002', formatHeures(hs50)]);
      lines.push(['S21.G00.53.003', '01']);
      lines.push(['S21.G00.53.004', dateDebut]);
      lines.push(['S21.G00.53.005', dateFin]);
    }
  }

  return lines;
}

export function generateBlocBasesAssujetties(bulletin, membre) {
  const lines = [];
  const brut = bulletin ? bulletin.brut_total : (membre.salaire_mensuel || 0);
  const pmss = TAUX_2026.pmss;
  const tranche1 = Math.min(brut, pmss);
  const tranche2 = Math.max(0, brut - pmss);

  // Code 02 - Base plafonnee (T1)
  lines.push(['S21.G00.78.001', '02']);
  lines.push(['S21.G00.78.004', formatMontantDecimal(tranche1)]);

  // Code 03 - Base deplafonnee (brut total)
  lines.push(['S21.G00.78.001', '03']);
  lines.push(['S21.G00.78.004', formatMontantDecimal(brut)]);

  // Code 04 - Base CSG
  const baseCSG = Math.round(brut * 0.9825);
  lines.push(['S21.G00.78.001', '04']);
  lines.push(['S21.G00.78.004', formatMontantDecimal(baseCSG)]);

  // Code 07 - Base retraite complementaire T1
  lines.push(['S21.G00.78.001', '07']);
  lines.push(['S21.G00.78.004', formatMontantDecimal(tranche1)]);

  // Code 08 - Base retraite complementaire T2 (si applicable)
  if (tranche2 > 0) {
    lines.push(['S21.G00.78.001', '08']);
    lines.push(['S21.G00.78.004', formatMontantDecimal(tranche2)]);
  }

  // Code 11 - Base chomage
  lines.push(['S21.G00.78.001', '11']);
  lines.push(['S21.G00.78.004', formatMontantDecimal(tranche1)]);

  // Code 28 - Base Fillon
  lines.push(['S21.G00.78.001', '28']);
  lines.push(['S21.G00.78.004', formatMontantDecimal(brut)]);

  return lines;
}

export function generateBlocCotisationsIndividuelles(bulletin, membre) {
  const lines = [];
  if (!bulletin) return lines;

  const cotisP = bulletin.cotisations_patronales || [];
  const cotisS = bulletin.cotisations_salariales || [];

  // Mapper les cotisations vers les CTP individuels
  const ctpMap = {
    'MALADIE': { ctp: '100', typeContrib: '01' },
    'VIEILLESSE_PLAF': { ctp: '100', typeContrib: '02' },
    'VIEILLESSE_DEPLAF': { ctp: '100', typeContrib: '03' },
    'AF': { ctp: '100', typeContrib: '04' },
    'AT_MP': { ctp: '100', typeContrib: '05' },
    'CHOMAGE': { ctp: '100', typeContrib: '06' },
    'AGS': { ctp: '100', typeContrib: '07' },
    'AGIRC_ARRCO_T1': { ctp: '400', typeContrib: '08' },
    'AGIRC_ARRCO_T2': { ctp: '400', typeContrib: '09' },
    'CEG_T1': { ctp: '400', typeContrib: '10' },
    'CEG_T2': { ctp: '400', typeContrib: '11' },
    'CSG_DED': { ctp: '332', typeContrib: '12' },
    'CSG_NON_DED': { ctp: '332', typeContrib: '13' },
    'CRDS': { ctp: '332', typeContrib: '14' },
    'FNAL': { ctp: '100', typeContrib: '15' },
    'CSA': { ctp: '100', typeContrib: '16' },
    'FORMATION': { ctp: '100', typeContrib: '17' },
    'TAXE_APPRENTISSAGE': { ctp: '100', typeContrib: '18' },
    'DIALOGUE_SOCIAL': { ctp: '100', typeContrib: '19' },
  };

  // Ecrire cotisations patronales
  for (const c of cotisP) {
    const mapping = ctpMap[c.code];
    if (!mapping) continue;
    lines.push(['S21.G00.81.001', mapping.ctp]);
    lines.push(['S21.G00.81.002', mapping.typeContrib]);
    lines.push(['S21.G00.81.003', formatMontantDecimal(c.base || 0)]);
    lines.push(['S21.G00.81.004', formatMontantDecimal(c.montant || 0)]);
  }

  // Ecrire cotisations salariales (celles qui ont un montant > 0)
  for (const c of cotisS) {
    if (c.montant <= 0) continue;
    const mapping = ctpMap[c.code];
    if (!mapping) continue;
    lines.push(['S21.G00.81.001', mapping.ctp]);
    lines.push(['S21.G00.81.002', `${mapping.typeContrib}S`]); // S pour salariale
    lines.push(['S21.G00.81.003', formatMontantDecimal(c.base || 0)]);
    lines.push(['S21.G00.81.004', formatMontantDecimal(c.montant || 0)]);
  }

  return lines;
}

export function generateBlocArretTravail(evenement) {
  const lines = [];
  if (!evenement) return lines;

  lines.push(['S21.G00.60.001', evenement.motif || '01']); // Motif: 01=maladie
  lines.push(['S21.G00.60.002', formatDate(evenement.date_debut)]); // Date dernier jour travaille
  lines.push(['S21.G00.60.003', formatDate(evenement.date_arret)]); // Date arret
  if (evenement.date_fin) {
    lines.push(['S21.G00.60.010', formatDate(evenement.date_fin)]); // Date fin prevue
  }
  if (evenement.subrogation) {
    lines.push(['S21.G00.60.007', '01']); // Subrogation: 01=oui
    lines.push(['S21.G00.60.008', formatDate(evenement.date_debut_subrogation)]);
    lines.push(['S21.G00.60.009', formatDate(evenement.date_fin_subrogation)]);
  }

  return lines;
}

export function generateBlocFinContrat(evenement) {
  const lines = [];
  if (!evenement) return lines;

  lines.push(['S21.G00.62.001', formatDate(evenement.date_fin)]); // Date fin
  lines.push(['S21.G00.62.002', evenement.motif_rupture || '011']); // Motif: 011=licenciement
  lines.push(['S21.G00.62.006', formatDate(evenement.dernier_jour_travaille)]); // Dernier jour
  if (evenement.date_notification) {
    lines.push(['S21.G00.62.003', formatDate(evenement.date_notification)]);
  }
  if (evenement.indemnite_licenciement) {
    lines.push(['S21.G00.62.012', formatMontantDecimal(evenement.indemnite_licenciement)]); // Transaction
  }
  if (evenement.indemnite_preavis) {
    lines.push(['S21.G00.62.013', formatMontantDecimal(evenement.indemnite_preavis)]);
  }

  return lines;
}

export function generateTotaux(nbRubriques, nbSalaries) {
  const lines = [];
  // Le total inclut les lignes S90 elles-memes (+2)
  lines.push(['S90.G00.90.001', pad(nbRubriques + 2, 10)]);
  lines.push(['S90.G00.90.002', '01']); // Nombre declarations
  return lines;
}

export default {
  generateDSN,
  generateBlocEmetteur,
  generateBlocEntreprise,
  generateBlocEtablissement,
  generateBlocVersementOrganisme,
  generateBlocBordereau,
  generateBlocIndividu,
  generateBlocContrat,
  generateBlocVersementIndividu,
  generateBlocRemunerations,
  generateBlocActivites,
  generateBlocBasesAssujetties,
  generateBlocCotisationsIndividuelles,
  generateBlocArretTravail,
  generateBlocFinContrat,
  generateTotaux,
};
