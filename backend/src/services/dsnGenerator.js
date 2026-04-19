/**
 * Generateur DSN complet - Format NEODeS P25V01 / P26V01
 * Conforme au cahier technique DSN-CTL
 *
 * Rubriques verifiees contre le bilan DSN-CTL-V25R01 v1.4.3
 */

import { supabase } from '../config/supabase.js';
import { TAUX_2026 } from './payrollEngine.js';

// ============================================
// HELPERS
// ============================================

function formatDate(dateStr) {
  if (!dateStr) return '';
  const clean = dateStr.replace(/-/g, '').slice(0, 8); // YYYYMMDD
  if (clean.length !== 8) return clean;
  return clean.slice(6, 8) + clean.slice(4, 6) + clean.slice(0, 4); // JJMMAAAA
}

function formatMontantDecimal(centimes) {
  if (!centimes && centimes !== 0) return '0.00';
  return (Math.abs(centimes) / 100).toFixed(2);
}

function formatHeures(heures) {
  return (heures || 0).toFixed(2);
}

function pad(num, len) {
  return String(num || 0).padStart(len, '0');
}

// ============================================
// DERIVATION AUTOMATIQUE depuis les donnees existantes
// ============================================

/** Extrait le departement de naissance depuis le NIR (positions 5-6, ou 5-7 pour DOM-TOM) */
function deptFromNIR(nir) {
  if (!nir || nir.length < 7) return '';
  const dept = nir.slice(5, 7);
  // DOM-TOM: 97x → 3 chars
  if (dept === '97' || dept === '98') return nir.slice(5, 8);
  return dept;
}

/** Mappe categorie_sociopro vers statut conventionnel DSN (S21.G00.40.002) */
function statutConventionnelFromCategorie(categorie) {
  const map = {
    'cadre_dirigeant': '03',
    'cadre': '04',
    'agent_maitrise': '05',
    'technicien': '05',
    'employe': '06',
    'ouvrier': '07',
  };
  return map[categorie] || '06'; // default employe
}

/** Mappe categorie_sociopro vers statut categoriel retraite (S21.G00.40.003) */
function statutCategorielFromCategorie(categorie) {
  if (categorie === 'cadre' || categorie === 'cadre_dirigeant') return '01';
  return '02'; // non-cadre
}

// ============================================
// CODES COTISATION INDIVIDUELLES (S21.G00.81.001)
// ============================================

const CODES_COTISATION_PATRONALE = {
  'MALADIE': '001',
  'VIEILLESSE_PLAF': '002',
  'VIEILLESSE_DEPLAF': '003',
  'AF': '004',
  'AT_MP': '005',
  'CHOMAGE': '006',
  'AGS': '007',
  'FORMATION': '026',
  'TAXE_APPRENTISSAGE': '027',
  'DIALOGUE_SOCIAL': '028',
  'FNAL': '030',
  'CSA': '059',
  'AGIRC_ARRCO_T1': '063',
  'AGIRC_ARRCO_T2': '064',
  'CEG_T1': '065',
  'CEG_T2': '066',
};

const CODES_COTISATION_SALARIALE = {
  'CHOMAGE': '008',
  'MALADIE': '010',
  'VIEILLESSE_PLAF': '015',
  'VIEILLESSE_DEPLAF': '016',
  'AGIRC_ARRCO_T1': '063',
  'AGIRC_ARRCO_T2': '064',
  'CEG_T1': '065',
  'CEG_T2': '066',
  'CSG_DED': '100',
  'CSG_NON_DED': '105',
  'CRDS': '105',
};

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

  const { data: params } = await supabase
    .from('rh_dsn_parametres')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (!params || !params.siret) {
    throw new Error('Parametres DSN incomplets. Configurez les informations entreprise.');
  }

  const { data: membres } = await supabase
    .from('rh_membres')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('statut', 'actif');

  const { data: bulletins } = await supabase
    .from('rh_bulletins_paie')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('periode', periode);

  const bulletinsMap = new Map();
  (bulletins || []).forEach(b => bulletinsMap.set(b.membre_id, b));

  const lines = [];
  let nbRubriques = 0;

  const add = (code, value) => {
    if (value !== null && value !== undefined && value !== '') {
      lines.push(`${code},'${value}'`);
      nbRubriques++;
    }
  };

  const [year, month] = periode.split('-');
  const now = new Date();
  const dateGen = pad(now.getDate(), 2) + pad(now.getMonth() + 1, 2) + now.getFullYear();
  const moisDecl = `${month}${year}`;
  const dernierJour = new Date(parseInt(year), parseInt(month), 0).getDate();
  const dateDebut = `01${moisDecl}`;
  const dateFin = `${pad(dernierJour, 2)}${moisDecl}`;

  // Detecter la norme DSN selon la periode (priorite sur la valeur en base qui peut etre obsolete)
  const normeVersion = parseInt(year) >= 2026 ? 'P26V01' : 'P25V01';

  // =====================================================
  // S10 - ENVOI + EMETTEUR + CONTACT EMETTEUR
  // =====================================================
  const emetteurLines = generateBlocEmetteur(params, dateGen, normeVersion);
  emetteurLines.forEach(([c, v]) => add(c, v));

  // =====================================================
  // S20 - DECLARATION + CONTACT DECLARATION
  // =====================================================
  add('S20.G00.05.001', nature);                    // Nature de la declaration
  add('S20.G00.05.002', '01');                       // Type: 01=normale
  add('S20.G00.05.003', params.fraction || '11');    // Fraction
  add('S20.G00.05.004', '1');                        // Numero d'ordre (pas de zero non significatif)
  add('S20.G00.05.005', dateDebut);                  // Date du mois principal declare (JJMMAAAA)
  add('S20.G00.05.007', dateGen);                    // Date de constitution du fichier
  add('S20.G00.05.008', '01');                       // Champ de la declaration: 01=total
  if (params.urssaf_siret) {
    add('S20.G00.05.009', params.urssaf_siret);      // Identifiant metier (SIRET URSSAF)
  }
  add('S20.G00.05.010', '01');                       // Devise: 01=euro

  // S20.G00.07 - Contact declaration (obligatoire)
  add('S20.G00.07.001', params.contact_nom || params.raison_sociale);
  add('S20.G00.07.002', params.contact_email || 'contact@entreprise.fr');
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
  const versementOrgLines = generateBlocVersementOrganisme(bulletins || [], params, dateDebut, dateFin);
  versementOrgLines.forEach(([c, v]) => add(c, v));

  // =====================================================
  // S21.G00.22 - BORDEREAU COTISATIONS DUE
  // =====================================================
  const bordereauLines = generateBlocBordereau(bulletins || [], params, dateDebut, dateFin);
  bordereauLines.forEach(([c, v]) => add(c, v));

  // =====================================================
  // INDIVIDUS
  // =====================================================
  let nbSalaries = 0;

  const membresATraiter = nature === '01'
    ? (membres || [])
    : (membres || []).filter(m => m.id === options.membreId);

  for (const membre of membresATraiter) {
    const bulletin = bulletinsMap.get(membre.id);
    if (!bulletin && !membre.salaire_mensuel) continue;

    nbSalaries++;
    const numeroContrat = membre.numero_contrat || pad(nbSalaries, 5);

    // S21.G00.30 - Individu
    const individuLines = generateBlocIndividu(membre);
    individuLines.forEach(([c, v]) => add(c, v));

    // S21.G00.40 - Contrat
    const contratLines = generateBlocContrat(membre, params, numeroContrat);
    contratLines.forEach(([c, v]) => add(c, v));

    // S21.G00.71 - Retraite complementaire (obligatoire)
    const retraiteLines = generateBlocRetraiteComplementaire(membre, params);
    retraiteLines.forEach(([c, v]) => add(c, v));

    // S21.G00.50 - Versement individu
    const versementLines = generateBlocVersementIndividu(bulletin, membre, moisDecl, dateDebut);
    versementLines.forEach(([c, v]) => add(c, v));

    // S21.G00.51 - Remunerations + S21.G00.53 Activites (imbriquees dans type 002)
    const remuLines = generateBlocRemunerations(bulletin, membre, dateDebut, dateFin, numeroContrat);
    remuLines.forEach(([c, v]) => add(c, v));

    // S21.G00.58 - Elements de revenu calcule en net (obligatoire)
    const netLines = generateBlocRevenuNet(bulletin, membre, dateDebut, dateFin, numeroContrat);
    netLines.forEach(([c, v]) => add(c, v));

    // S21.G00.78 - Bases assujetties
    const basesLines = generateBlocBasesAssujetties(bulletin, membre, dateDebut, dateFin);
    basesLines.forEach(([c, v]) => add(c, v));

    // S21.G00.81 - Cotisations individuelles
    const cotisIndivLines = generateBlocCotisationsIndividuelles(bulletin, membre, params);
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
// S10 - ENVOI + EMETTEUR + CONTACT
// ============================================

export function generateBlocEmetteur(params, dateGen, normeVersion) {
  const lines = [];
  // S10.G00.00 - Envoi
  lines.push(['S10.G00.00.001', params.logiciel_paie || 'NEXUS SIRH']);
  lines.push(['S10.G00.00.002', 'NEXUS']);
  lines.push(['S10.G00.00.003', '1.0.0']);
  lines.push(['S10.G00.00.005', '01']);         // Code envoi: 01=reel
  lines.push(['S10.G00.00.006', normeVersion]); // Version norme
  lines.push(['S10.G00.00.007', '01']);         // Point de depot: 01=net-entreprises
  lines.push(['S10.G00.00.008', '01']);         // Type envoi: 01=normal

  // S10.G00.01 - Emetteur
  lines.push(['S10.G00.01.001', params.siren]);
  lines.push(['S10.G00.01.002', params.nic || params.siret?.slice(9)]);
  lines.push(['S10.G00.01.003', params.raison_sociale]);
  lines.push(['S10.G00.01.004', params.adresse_siege]);
  lines.push(['S10.G00.01.005', params.code_postal_siege]);
  lines.push(['S10.G00.01.006', params.ville_siege]);
  // NE PAS inclure S10.G00.01.007 (code pays) pour la France (erreur M641)

  // S10.G00.02 - Contact emetteur (obligatoire — doit suivre S10.G00.01)
  lines.push(['S10.G00.02.001', params.contact_nom || params.raison_sociale]);
  lines.push(['S10.G00.02.002', params.contact_email || 'contact@entreprise.fr']);
  if (params.contact_tel) lines.push(['S10.G00.02.004', params.contact_tel]);

  return lines;
}

// ============================================
// S21.G00.06 - ENTREPRISE
// ============================================

export function generateBlocEntreprise(params, membres) {
  const lines = [];
  lines.push(['S21.G00.06.001', params.siren]);
  lines.push(['S21.G00.06.002', params.nic || params.siret?.slice(9)]);
  lines.push(['S21.G00.06.003', params.code_naf]);
  lines.push(['S21.G00.06.004', params.adresse_siege]);
  lines.push(['S21.G00.06.005', params.code_postal_siege]);
  lines.push(['S21.G00.06.006', params.ville_siege]);
  lines.push(['S21.G00.06.009', pad(params.effectif_moyen || membres?.length || 0, 5)]);
  // NE PAS inclure S21.G00.06.010 (code pays) pour la France
  return lines;
}

// ============================================
// S21.G00.11 - ETABLISSEMENT
// ============================================

export function generateBlocEtablissement(params, membres) {
  const lines = [];
  lines.push(['S21.G00.11.001', params.nic || params.siret?.slice(9)]);
  lines.push(['S21.G00.11.002', params.code_naf]);
  lines.push(['S21.G00.11.003', params.adresse_etablissement || params.adresse_siege]);
  lines.push(['S21.G00.11.004', params.code_postal_etablissement || params.code_postal_siege]);
  lines.push(['S21.G00.11.005', params.ville_etablissement || params.ville_siege]);
  lines.push(['S21.G00.11.008', pad(params.effectif_moyen || membres?.length || 0, 5)]);
  // S21.G00.11.022 - Code convention collective (IDCC) — obligatoire
  if (params.idcc) lines.push(['S21.G00.11.022', params.idcc]);
  return lines;
}

// ============================================
// S21.G00.20 - VERSEMENT ORGANISME
// ============================================

export function generateBlocVersementOrganisme(bulletins, params, dateDebut, dateFin) {
  const lines = [];
  if (!bulletins.length) return lines;

  let totalCotisPatronales = 0;
  let totalCotisSalariales = 0;
  for (const b of bulletins) {
    totalCotisPatronales += b.total_cotisations_patronales || 0;
    totalCotisSalariales += b.total_cotisations_salariales || 0;
  }

  const opsUrssaf = params.urssaf_siret || params.urssaf_code || '';

  // Versement URSSAF
  lines.push(['S21.G00.20.001', opsUrssaf]);           // Identifiant OPS (SIRET URSSAF)
  if (params.urssaf_bic) lines.push(['S21.G00.20.002', params.urssaf_bic]);
  if (params.urssaf_iban) lines.push(['S21.G00.20.003', params.urssaf_iban]);
  lines.push(['S21.G00.20.005', formatMontantDecimal(totalCotisPatronales + totalCotisSalariales)]);
  lines.push(['S21.G00.20.006', dateDebut]);            // Date debut periode (JJMMAAAA)
  lines.push(['S21.G00.20.007', dateFin]);              // Date fin periode (JJMMAAAA)
  lines.push(['S21.G00.20.010', '01']);                  // Mode de paiement: 01=virement

  // Versement Retraite complementaire (si renseigne)
  if (params.caisse_retraite_siret || params.retraite_code) {
    const opsRetraite = params.caisse_retraite_siret || params.retraite_code;
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
    lines.push(['S21.G00.20.001', opsRetraite]);
    lines.push(['S21.G00.20.005', formatMontantDecimal(totalRetraite)]);
    lines.push(['S21.G00.20.006', dateDebut]);
    lines.push(['S21.G00.20.007', dateFin]);
    lines.push(['S21.G00.20.010', '01']);
  }

  return lines;
}

// ============================================
// S21.G00.22 - BORDEREAU COTISATIONS DUE
// ============================================

export function generateBlocBordereau(bulletins, params, dateDebut, dateFin) {
  const lines = [];
  if (!bulletins.length) return lines;

  const opsUrssaf = params.urssaf_siret || params.urssaf_code || '';

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

  // CTP 100 - Cas general
  lines.push(['S21.G00.22.001', opsUrssaf]);                    // Identifiant OPS
  lines.push(['S21.G00.22.002', '100']);                          // Code decompte (CTP)
  lines.push(['S21.G00.22.003', dateDebut]);                     // Date debut (JJMMAAAA)
  lines.push(['S21.G00.22.004', dateFin]);                       // Date fin (JJMMAAAA)
  lines.push(['S21.G00.22.005', formatMontantDecimal(totalCotisSS)]); // Montant total

  // CTP 260 - Reduction Fillon
  let totalFillon = 0;
  for (const b of bulletins) {
    totalFillon += b.reduction_fillon || 0;
  }
  if (totalFillon > 0) {
    lines.push(['S21.G00.22.001', opsUrssaf]);
    lines.push(['S21.G00.22.002', '260']);
    lines.push(['S21.G00.22.003', dateDebut]);
    lines.push(['S21.G00.22.004', dateFin]);
    lines.push(['S21.G00.22.005', formatMontantDecimal(totalFillon)]);
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
    const baseCSG = Math.round(baseBrut * 0.9825);
    lines.push(['S21.G00.22.001', opsUrssaf]);
    lines.push(['S21.G00.22.002', '332']);
    lines.push(['S21.G00.22.003', dateDebut]);
    lines.push(['S21.G00.22.004', dateFin]);
    lines.push(['S21.G00.22.005', formatMontantDecimal(totalCSG)]);
  }

  return lines;
}

// ============================================
// S21.G00.30 - INDIVIDU
// ============================================

export function generateBlocIndividu(membre) {
  const lines = [];

  // NIR sans cle (13 caracteres max)
  const nir = (membre.nir || '').replace(/\s/g, '').slice(0, 13);
  lines.push(['S21.G00.30.001', nir]);                                         // NIR (max 13 chars)
  lines.push(['S21.G00.30.002', (membre.nom || '').toUpperCase()]);            // Nom de famille
  if (membre.nom_usage) lines.push(['S21.G00.30.003', membre.nom_usage.toUpperCase()]); // Nom d'usage
  lines.push(['S21.G00.30.004', membre.prenom || '']);                         // Prenoms
  lines.push(['S21.G00.30.005', membre.sexe === 'M' ? '01' : '02']);          // Sexe
  if (membre.date_naissance) {
    lines.push(['S21.G00.30.006', formatDate(membre.date_naissance)]);         // Date de naissance (JJMMAAAA)
  }
  if (membre.lieu_naissance) {
    lines.push(['S21.G00.30.007', membre.lieu_naissance]);                      // Lieu de naissance (commune)
  }

  // Adresse du salarie
  if (membre.adresse_rue) lines.push(['S21.G00.30.008', membre.adresse_rue]); // Adresse
  if (membre.adresse_cp) lines.push(['S21.G00.30.009', membre.adresse_cp]);   // Code postal
  if (membre.adresse_ville) lines.push(['S21.G00.30.010', membre.adresse_ville]); // Localite
  // NE PAS inclure S21.G00.30.011 (code pays) pour la France

  // Codification UE (obligatoire)
  lines.push(['S21.G00.30.013', membre.codification_ue || '01']);              // 01=UE, 02=hors UE

  // Naissance
  const deptNaissance = membre.dept_naissance || deptFromNIR(membre.nir);
  if (deptNaissance) {
    lines.push(['S21.G00.30.014', deptNaissance.slice(0, 3)]);                 // Code departement naissance
  }
  lines.push(['S21.G00.30.015', membre.code_pays_naissance || 'FR']);          // Code pays de naissance

  if (membre.email) lines.push(['S21.G00.30.018', membre.email]);             // Email

  return lines;
}

// ============================================
// S21.G00.40 - CONTRAT
// ============================================

export function generateBlocContrat(membre, params, numeroContrat) {
  const lines = [];

  // .001 - Date de debut du contrat (JJMMAAAA)
  if (membre.date_embauche) lines.push(['S21.G00.40.001', formatDate(membre.date_embauche)]);

  // .002 - Statut du salarie (conventionnel)
  // 03=cadre dirigeant, 04=autre cadre, 05=prof intermediaire, 06=employe, 07=ouvrier
  lines.push(['S21.G00.40.002', membre.statut_conventionnel || statutConventionnelFromCategorie(membre.categorie_sociopro)]);

  // .003 - Statut categoriel Retraite Complementaire
  // 01=cadre (art.4/4bis), 02=non-cadre
  lines.push(['S21.G00.40.003', membre.statut_categoriel || statutCategorielFromCategorie(membre.categorie_sociopro)]);

  // .004 - Code PCS-ESE (profession et categorie socioprofessionnelle)
  lines.push(['S21.G00.40.004', membre.code_pcs || '561b']);

  // .006 - Nature du contrat (01=CDI, 02=CDD, 03=mission temporaire)
  lines.push(['S21.G00.40.006', membre.type_contrat === 'cdi' ? '01' : '02']);

  // .007 - Libelle de l'emploi
  if (membre.poste || membre.role) {
    lines.push(['S21.G00.40.007', membre.poste || membre.role]);
  }

  // .008 - Dispositif de politique publique (99=non concerne)
  lines.push(['S21.G00.40.008', membre.dispositif_politique || '99']);

  // .009 - Numero du contrat (min 5 caracteres)
  lines.push(['S21.G00.40.009', numeroContrat]);

  // .010 - Date de fin previsionnelle du contrat (si CDD)
  if (membre.date_fin_contrat) {
    lines.push(['S21.G00.40.010', formatDate(membre.date_fin_contrat)]);
  }

  // .011 - Unite de mesure de la quotite de travail (10=heure, 12=journee, 32=forfait jour)
  lines.push(['S21.G00.40.011', membre.unite_quotite || '10']);

  // .012 - Quotite de travail de reference de l'entreprise (ex: "151.67" ou "35.00")
  lines.push(['S21.G00.40.012', formatHeures(membre.quotite_reference || 151.67)]);

  // .013 - Quotite de travail du contrat (ex: "151.67" ou "1.0000")
  lines.push(['S21.G00.40.013', formatHeures(membre.quotite_contrat || membre.heures_mensuelles || 151.67)]);

  // .014 - Modalite d'exercice du temps de travail (01=temps complet, 02=temps partiel)
  lines.push(['S21.G00.40.014', membre.modalite_temps || '01']);

  // .017 - Code convention collective (IDCC)
  if (params.idcc) lines.push(['S21.G00.40.017', params.idcc]);

  // .018 - Code regime de base risque maladie (200=regime general SS)
  lines.push(['S21.G00.40.018', membre.regime_maladie || '200']);

  // .019 - Identifiant du lieu de travail (SIRET de l'etablissement)
  lines.push(['S21.G00.40.019', params.siret]);

  // .020 - Code regime de base risque vieillesse (200=regime general)
  lines.push(['S21.G00.40.020', membre.regime_vieillesse || '200']);

  // .024 - Travailleur a l'etranger (01=oui, 02=non)
  lines.push(['S21.G00.40.024', '02']);

  // .036 - Code emplois multiples (01=oui, 02=non)
  lines.push(['S21.G00.40.036', membre.emplois_multiples || '02']);

  // .037 - Code employeurs multiples (01=oui, 02=non)
  lines.push(['S21.G00.40.037', membre.employeurs_multiples || '02']);

  // .039 - Code regime de base risque accident du travail (200=regime general)
  lines.push(['S21.G00.40.039', membre.regime_at || '200']);

  // .040 - Code risque accident du travail
  lines.push(['S21.G00.40.040', membre.code_risque_at || '852AA']);

  // .043 - Taux de cotisation accident du travail
  lines.push(['S21.G00.40.043', String(membre.taux_at || '1.50')]);

  return lines;
}

// ============================================
// S21.G00.71 - RETRAITE COMPLEMENTAIRE (obligatoire)
// ============================================

export function generateBlocRetraiteComplementaire(membre, params) {
  const lines = [];
  const opsRetraite = params.caisse_retraite_siret || params.retraite_code || '';

  // Code regime retraite complementaire
  lines.push(['S21.G00.71.001', opsRetraite]);
  // Code regime: AGIRC-ARRCO pour le prive
  lines.push(['S21.G00.71.002', 'AGIRC-ARRCO']);

  return lines;
}

// ============================================
// S21.G00.50 - VERSEMENT INDIVIDU
// ============================================

export function generateBlocVersementIndividu(bulletin, membre, moisDecl, dateDebut) {
  const lines = [];
  const brut = bulletin ? bulletin.brut_total : (membre.salaire_mensuel || 0);
  const netImposable = bulletin ? (bulletin.net_imposable || 0) : Math.round(brut * 0.78);
  const netVerse = bulletin ? bulletin.net_a_payer : Math.round(brut * 0.75);

  // .001 - Date de versement (JJMMAAAA)
  lines.push(['S21.G00.50.001', dateDebut]);

  // .002 - Remuneration nette fiscale
  lines.push(['S21.G00.50.002', formatMontantDecimal(netImposable)]);

  // .004 - Montant net verse
  lines.push(['S21.G00.50.004', formatMontantDecimal(netVerse)]);

  // .006 - Taux de prelevement a la source (format: xx.xx, min 4 chars)
  const tauxPAS = bulletin?.taux_ir || 0;
  const montantPAS = bulletin?.montant_ir || 0;
  lines.push(['S21.G00.50.006', (tauxPAS || 0).toFixed(2)]);

  // .007 - Type du taux de PAS (01=bareme, 02=personnalise, 03=neutre)
  lines.push(['S21.G00.50.007', bulletin?.type_taux_pas || '01']);

  // .009 - Montant de PAS
  lines.push(['S21.G00.50.009', formatMontantDecimal(montantPAS)]);

  // .013 - Montant soumis au PAS
  lines.push(['S21.G00.50.013', formatMontantDecimal(netImposable)]);

  return lines;
}

// ============================================
// S21.G00.51 - REMUNERATIONS + S21.G00.53 ACTIVITES
// ============================================

export function generateBlocRemunerations(bulletin, membre, dateDebut, dateFin, numeroContrat) {
  const lines = [];
  const brut = bulletin ? bulletin.brut_total : (membre.salaire_mensuel || 0);
  const salaireBase = bulletin ? bulletin.salaire_base : (membre.salaire_mensuel || 0);
  const netImposable = bulletin ? (bulletin.net_imposable || 0) : Math.round(brut * 0.78);
  const netSocial = bulletin ? (bulletin.net_social || bulletin.net_avant_ir || 0) : Math.round(brut * 0.78);
  const heures = membre.heures_mensuelles || 151.67;

  // === Type 001 - Remuneration brute non plafonnee ===
  lines.push(['S21.G00.51.001', dateDebut]);
  lines.push(['S21.G00.51.002', dateFin]);
  lines.push(['S21.G00.51.010', numeroContrat]);       // Numero du contrat (min 5 chars)
  lines.push(['S21.G00.51.011', '001']);                 // Type
  lines.push(['S21.G00.51.012', formatHeures(heures)]); // Nombre d'heures
  lines.push(['S21.G00.51.013', formatMontantDecimal(brut)]); // Montant

  // === Type 002 - Salaire brut chomage (avec activites imbriquees) ===
  lines.push(['S21.G00.51.001', dateDebut]);
  lines.push(['S21.G00.51.002', dateFin]);
  lines.push(['S21.G00.51.010', numeroContrat]);
  lines.push(['S21.G00.51.011', '002']);
  lines.push(['S21.G00.51.013', formatMontantDecimal(salaireBase)]);

  // S21.G00.53 - Activite (doit etre DANS le bloc remuneration type 002)
  lines.push(['S21.G00.53.001', '01']);                  // Type: 01=travail remunere
  lines.push(['S21.G00.53.002', formatHeures(heures)]); // Mesure (decimal: "151.67")
  lines.push(['S21.G00.53.003', '10']);                   // Unite: 10=heure

  // Heures supplementaires (dans type 002)
  if (bulletin) {
    const hs25 = bulletin.heures_supp_25 || 0;
    const hs50 = bulletin.heures_supp_50 || 0;
    if (hs25 > 0) {
      lines.push(['S21.G00.53.001', '03']);
      lines.push(['S21.G00.53.002', formatHeures(hs25)]);
      lines.push(['S21.G00.53.003', '10']);
    }
    if (hs50 > 0) {
      lines.push(['S21.G00.53.001', '04']);
      lines.push(['S21.G00.53.002', formatHeures(hs50)]);
      lines.push(['S21.G00.53.003', '10']);
    }
  }

  // === Type 003 - Salaire retabli reconstitue ===
  lines.push(['S21.G00.51.001', dateDebut]);
  lines.push(['S21.G00.51.002', dateFin]);
  lines.push(['S21.G00.51.010', numeroContrat]);
  lines.push(['S21.G00.51.011', '003']);
  lines.push(['S21.G00.51.013', formatMontantDecimal(brut)]);

  // === Type 010 - Salaire de base ===
  lines.push(['S21.G00.51.001', dateDebut]);
  lines.push(['S21.G00.51.002', dateFin]);
  lines.push(['S21.G00.51.010', numeroContrat]);
  lines.push(['S21.G00.51.011', '010']);
  lines.push(['S21.G00.51.013', formatMontantDecimal(salaireBase)]);

  // === Type 011 - Net a payer avant PAS ===
  lines.push(['S21.G00.51.001', dateDebut]);
  lines.push(['S21.G00.51.002', dateFin]);
  lines.push(['S21.G00.51.010', numeroContrat]);
  lines.push(['S21.G00.51.011', '011']);
  lines.push(['S21.G00.51.013', formatMontantDecimal(netSocial)]);

  // Heures supplementaires (remuneration)
  if (bulletin && (bulletin.montant_hs_25 > 0 || bulletin.montant_hs_50 > 0)) {
    const montantHS = (bulletin.montant_hs_25 || 0) + (bulletin.montant_hs_50 || 0);
    lines.push(['S21.G00.51.001', dateDebut]);
    lines.push(['S21.G00.51.002', dateFin]);
    lines.push(['S21.G00.51.010', numeroContrat]);
    lines.push(['S21.G00.51.011', '017']);
    lines.push(['S21.G00.51.013', formatMontantDecimal(montantHS)]);
  }

  // Primes
  if (bulletin?.primes && Array.isArray(bulletin.primes)) {
    for (const prime of bulletin.primes) {
      if (prime.montant > 0) {
        lines.push(['S21.G00.52.001', '01']);
        lines.push(['S21.G00.52.002', formatMontantDecimal(prime.montant)]);
        lines.push(['S21.G00.52.006', dateDebut]);
        lines.push(['S21.G00.52.007', dateFin]);
      }
    }
  }

  return lines;
}

// ============================================
// S21.G00.58 - ELEMENT DE REVENU CALCULE EN NET (obligatoire)
// ============================================

export function generateBlocRevenuNet(bulletin, membre, dateDebut, dateFin, numeroContrat) {
  const lines = [];
  const brut = bulletin ? bulletin.brut_total : (membre.salaire_mensuel || 0);
  const netSocial = bulletin ? (bulletin.net_social || bulletin.net_avant_ir || 0) : Math.round(brut * 0.78);

  // Type 03 - Montant net social (obligatoire)
  lines.push(['S21.G00.58.001', dateDebut]);             // Date debut
  lines.push(['S21.G00.58.002', dateFin]);               // Date fin
  lines.push(['S21.G00.58.003', '03']);                    // Type: 03=montant net social
  lines.push(['S21.G00.58.004', formatMontantDecimal(netSocial)]); // Montant
  lines.push(['S21.G00.58.005', numeroContrat]);          // Numero de contrat

  return lines;
}

// ============================================
// S21.G00.78 - BASES ASSUJETTIES
// ============================================

export function generateBlocBasesAssujetties(bulletin, membre, dateDebut, dateFin) {
  const lines = [];
  const brut = bulletin ? bulletin.brut_total : (membre.salaire_mensuel || 0);
  const pmss = TAUX_2026.pmss;
  const tranche1 = Math.min(brut, pmss);
  const tranche2 = Math.max(0, brut - pmss);
  const baseCSG = Math.round(brut * 0.9825);

  const addBase = (code, montant) => {
    lines.push(['S21.G00.78.001', code]);
    lines.push(['S21.G00.78.002', dateDebut]);           // Date debut (obligatoire)
    lines.push(['S21.G00.78.003', dateFin]);             // Date fin (obligatoire)
    lines.push(['S21.G00.78.004', formatMontantDecimal(montant)]);
  };

  addBase('02', tranche1);       // Base plafonnee (T1) — vieillesse plafonnee
  addBase('03', brut);            // Base deplafonnee — vieillesse deplafonnee
  addBase('04', baseCSG);         // Base CSG/CRDS
  addBase('07', tranche1);        // Base retraite complementaire T1
  if (tranche2 > 0) {
    addBase('08', tranche2);      // Base retraite complementaire T2
  }
  addBase('11', tranche1);        // Base chomage
  addBase('31', brut);            // Base accident du travail

  return lines;
}

// ============================================
// S21.G00.81 - COTISATIONS INDIVIDUELLES
// ============================================

export function generateBlocCotisationsIndividuelles(bulletin, membre, params) {
  const lines = [];
  if (!bulletin) return lines;

  const cotisP = bulletin.cotisations_patronales || [];
  const cotisS = bulletin.cotisations_salariales || [];
  const opsUrssaf = params.urssaf_siret || params.urssaf_code || '';
  const opsRetraite = params.caisse_retraite_siret || params.retraite_code || opsUrssaf;

  // Cotisations patronales
  for (const c of cotisP) {
    const code = CODES_COTISATION_PATRONALE[c.code];
    if (!code) continue;
    const isRetraite = c.code.includes('AGIRC') || c.code.includes('CEG');
    lines.push(['S21.G00.81.001', code]);                           // Code de cotisation
    lines.push(['S21.G00.81.002', isRetraite ? opsRetraite : opsUrssaf]); // Identifiant OPS (SIRET)
    lines.push(['S21.G00.81.003', formatMontantDecimal(c.base || 0)]);    // Montant d'assiette
    lines.push(['S21.G00.81.004', formatMontantDecimal(c.montant || 0)]); // Montant de cotisation
  }

  // Cotisations salariales
  for (const c of cotisS) {
    if (c.montant <= 0) continue;
    const code = CODES_COTISATION_SALARIALE[c.code];
    if (!code) continue;
    const isRetraite = c.code.includes('AGIRC') || c.code.includes('CEG');
    lines.push(['S21.G00.81.001', code]);
    lines.push(['S21.G00.81.002', isRetraite ? opsRetraite : opsUrssaf]);
    lines.push(['S21.G00.81.003', formatMontantDecimal(c.base || 0)]);
    lines.push(['S21.G00.81.004', formatMontantDecimal(c.montant || 0)]);
  }

  return lines;
}

// ============================================
// S21.G00.60 - ARRET DE TRAVAIL (evenementielle)
// ============================================

export function generateBlocArretTravail(evenement) {
  const lines = [];
  if (!evenement) return lines;

  lines.push(['S21.G00.60.001', evenement.motif || '01']);
  lines.push(['S21.G00.60.002', formatDate(evenement.date_debut)]);
  lines.push(['S21.G00.60.003', formatDate(evenement.date_arret)]);
  if (evenement.date_fin) {
    lines.push(['S21.G00.60.010', formatDate(evenement.date_fin)]);
  }
  if (evenement.subrogation) {
    lines.push(['S21.G00.60.007', '01']);
    lines.push(['S21.G00.60.008', formatDate(evenement.date_debut_subrogation)]);
    lines.push(['S21.G00.60.009', formatDate(evenement.date_fin_subrogation)]);
  }

  return lines;
}

// ============================================
// S21.G00.62 - FIN DE CONTRAT (evenementielle)
// ============================================

export function generateBlocFinContrat(evenement) {
  const lines = [];
  if (!evenement) return lines;

  lines.push(['S21.G00.62.001', formatDate(evenement.date_fin)]);
  lines.push(['S21.G00.62.002', evenement.motif_rupture || '011']);
  lines.push(['S21.G00.62.006', formatDate(evenement.dernier_jour_travaille)]);
  if (evenement.date_notification) {
    lines.push(['S21.G00.62.003', formatDate(evenement.date_notification)]);
  }
  if (evenement.indemnite_licenciement) {
    lines.push(['S21.G00.62.012', formatMontantDecimal(evenement.indemnite_licenciement)]);
  }
  if (evenement.indemnite_preavis) {
    lines.push(['S21.G00.62.013', formatMontantDecimal(evenement.indemnite_preavis)]);
  }

  return lines;
}

// ============================================
// S90 - TOTAL
// ============================================

export function generateTotaux(nbRubriques, nbSalaries) {
  const lines = [];
  lines.push(['S90.G00.90.001', pad(nbRubriques + 2, 10)]);
  lines.push(['S90.G00.90.002', '01']);
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
  generateBlocRetraiteComplementaire,
  generateBlocVersementIndividu,
  generateBlocRemunerations,
  generateBlocRevenuNet,
  generateBlocActivites: generateBlocRemunerations, // activites sont integrees dans remunerations
  generateBlocBasesAssujetties,
  generateBlocCotisationsIndividuelles,
  generateBlocArretTravail,
  generateBlocFinContrat,
  generateTotaux,
};
