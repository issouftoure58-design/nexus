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

// Codes cotisations individuelles S21.G00.81.001
// Mappage verifie contre DSN de reference fiche-paie.net (bot service)
const CODES_COTISATION_PATRONALE = {
  'REDUCTION_FILLON': '018',    // Reduction generale (montant negatif)
  'AGIRC_ARRCO_T1': '040',     // Retraite complementaire T1
  'PREVOYANCE': '045',          // Prevoyance cadre
  'CEG_T1': '048',              // Contribution d'equilibre general T1
  'AT_MP': '049',               // Accident du travail / Maladie professionnelle
  'CSA': '068',                 // Contribution Solidarite Autonomie
  'MALADIE': '074',             // Maladie (hors Alsace-Moselle)
  'VIEILLESSE_DEPLAF': '075',   // Vieillesse deplafonnee
  'VIEILLESSE_PLAF': '076',     // Vieillesse plafonnee
  'AF': '100',                  // Allocations familiales
  'DIALOGUE_SOCIAL': '105',     // Contribution au dialogue social
  'REDUCTION_HS': '106',        // Reduction cotisations HS (TEPA, negatif)
  // Chomage/AGS/FNAL declares en bordereau (CTP), pas en cotisations individuelles
};

const CODES_COTISATION_SALARIALE = {
  'AGIRC_ARRCO_T1': '040',     // Retraite complementaire T1
  'CEG_T1': '048',              // CEG T1
  'CSG_DED': '072',             // CSG deductible
  'MALADIE': '074',             // Maladie
  'VIEILLESSE_DEPLAF': '075',   // Vieillesse deplafonnee
  'VIEILLESSE_PLAF': '076',     // Vieillesse plafonnee
  'CRDS': '079',                // CRDS
  // Chomage salarial declare en bordereau (CTP), pas en cotisation individuelle
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

  // Charger les surcharges DSN du tenant
  const { data: overrides } = await supabase
    .from('rh_dsn_overrides')
    .select('rubrique_code, valeur, membre_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  const globalOverrides = {};   // rubrique_code → valeur (membre_id NULL)
  const membreOverrides = {};   // membre_id → { rubrique_code → valeur }
  for (const o of overrides || []) {
    if (!o.membre_id) {
      globalOverrides[o.rubrique_code] = o.valeur;
    } else {
      if (!membreOverrides[o.membre_id]) membreOverrides[o.membre_id] = {};
      membreOverrides[o.membre_id][o.rubrique_code] = o.valeur;
    }
  }

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
  const emetteurLines = generateBlocEmetteur(params, dateGen, normeVersion, options);
  emetteurLines.forEach(([c, v]) => add(c, v));

  // =====================================================
  // S20 - DECLARATION + CONTACT DECLARATION
  // =====================================================
  add('S20.G00.05.001', nature);                    // Nature de la declaration
  // Type: 01=normale, 02=neant, 03=annule et remplace, 05=annule et remplace sans individu
  add('S20.G00.05.002', options.neant ? '02' : (options.annuleRemplace ? '03' : '01'));
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
  add('S20.G00.07.002', (params.contact_tel || '0100000000').replace(/\s/g, ''));   // .002=telephone
  add('S20.G00.07.003', params.contact_email || 'contact@entreprise.fr');           // .003=email
  add('S20.G00.07.004', '01');  // Type: 01=Correspondant declaration

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
  // S21.G00.22 - BORDEREAU COTISATIONS DUE
  // =====================================================
  // INDIVIDUS
  // =====================================================
  let nbSalaries = 0;
  const membreRanges = []; // Pour appliquer les surcharges par salarie

  if (!options.neant) {
  const isEvenementiel = nature === '02' || nature === '04'; // signalement evenement
  const membresATraiter = nature === '01'
    ? (membres || [])
    : (membres || []).filter(m => m.id === options.membreId);

  // ═══════════════════════════════════════════════════════════════
  // DSN Mensuelle (nature 01): versement/bordereau/S81
  // Evenementielles (nature 02/04): PAS de versement/bordereau/S81
  // ═══════════════════════════════════════════════════════════════
  const s81Cache = new Map();

  if (!isEvenementiel) {
  // PASS 1: Pre-calculer S81 pour chaque employe + sommer les montants
  // Cela garantit COH-11 et COH-14 par construction
  let s81SumPositive = 0;  // EUR (cotisations normales)
  let s81SumNegative = 0;  // EUR (Fillon, TEPA — montants negatifs)

  for (const membre of membresATraiter) {
    const bulletin = bulletinsMap.get(membre.id);
    if (!bulletin && !membre.salaire_mensuel) continue;
    // M773 : date debut ajustee si embauche en cours de mois
    let dateDebutS81 = dateDebut;
    if (membre.date_embauche) {
      const emb = new Date(membre.date_embauche);
      const embMonth = pad(emb.getMonth() + 1, 2);
      const embYear = emb.getFullYear().toString();
      if (embMonth === month && embYear === year && emb.getDate() > 1) {
        dateDebutS81 = pad(emb.getDate(), 2) + moisDecl;
      }
    }
    const s81Lines = generateBlocBasesEtCotisations(bulletin, membre, params, dateDebutS81, dateFin);
    s81Cache.set(membre.id, s81Lines);

    for (const [code, value] of s81Lines) {
      if (code === 'S21.G00.81.004') {
        const v = parseFloat(value);
        if (v >= 0) s81SumPositive += v;
        else s81SumNegative += v;
      }
    }
  }

  // PASS 2: Versement et Bordereau bases sur les vrais totaux S81
  // sum(S81.004) = CTP100 + CTP671 = Versement → COH-14 satisfait
  const montantVersement = s81SumPositive + s81SumNegative;
  const opsUrssaf = params.urssaf_siret || params.urssaf_code || '';

  // S21.G00.20 — Versement organisme
  add('S21.G00.20.001', opsUrssaf);
  add('S21.G00.20.002', params.siret);
  if (params.bic) add('S21.G00.20.003', params.bic);
  if (params.iban) add('S21.G00.20.004', params.iban);
  // DSN-Val V516/V517 : montants URSSAF arrondis a l'entier (.00)
  const montantVersementArrondi = Math.round(montantVersement).toFixed(2);
  add('S21.G00.20.005', montantVersementArrondi);
  add('S21.G00.20.006', dateDebut);
  add('S21.G00.20.007', dateFin);
  add('S21.G00.20.010', params.mode_paiement || '05');

  // S21.G00.22 — Bordereau CTP 100 (montant net = positives + negatives)
  // DSN-Val interdit les bordereaux URSSAF negatifs (CCH-11).
  // Les reductions (Fillon, TEPA) sont incluses dans le CTP 100.
  add('S21.G00.22.001', opsUrssaf);
  add('S21.G00.22.002', '100');
  add('S21.G00.22.003', dateDebut);
  add('S21.G00.22.004', dateFin);
  add('S21.G00.22.005', montantVersementArrondi);
  } // fin !isEvenementiel

  // ═══════════════════════════════════════════════════════════════
  // Boucle employes
  // ═══════════════════════════════════════════════════════════════
  for (const membre of membresATraiter) {
    const bulletin = bulletinsMap.get(membre.id);
    if (!isEvenementiel && !bulletin && !membre.salaire_mensuel) continue;

    nbSalaries++;
    const numeroContrat = membre.numero_contrat || pad(nbSalaries, 5);
    const membreStartIdx = lines.length;

    // S21.G00.30 - Individu
    const individuLines = generateBlocIndividu(membre);
    individuLines.forEach(([c, v]) => add(c, v));

    // S21.G00.40 - Contrat
    const contratLines = generateBlocContrat(membre, params, numeroContrat);
    contratLines.forEach(([c, v]) => add(c, v));

    // S21.G00.71 - Retraite complementaire (obligatoire — M117 si absent)
    const retraiteLines = generateBlocRetraiteComplementaire(membre, params);
    retraiteLines.forEach(([c, v]) => add(c, v));

    if (!isEvenementiel) {
    // M773 : si le contrat commence en cours de mois, dateDebut = date embauche (pas le 1er)
    let dateDebutMembre = dateDebut;
    if (membre.date_embauche) {
      const emb = new Date(membre.date_embauche);
      const embMonth = pad(emb.getMonth() + 1, 2);
      const embYear = emb.getFullYear().toString();
      if (embMonth === month && embYear === year && emb.getDate() > 1) {
        dateDebutMembre = pad(emb.getDate(), 2) + moisDecl;
      }
    }

    // S21.G00.50 - Versement individu
    const versementLines = generateBlocVersementIndividu(bulletin, membre, moisDecl, dateDebutMembre, dateFin);
    versementLines.forEach(([c, v]) => add(c, v));

    // S21.G00.51 - Remunerations + S21.G00.53 Activites (imbriquees dans type 002)
    const remuLines = generateBlocRemunerations(bulletin, membre, dateDebutMembre, dateFin, numeroContrat);
    remuLines.forEach(([c, v]) => add(c, v));

    // S21.G00.58 - Elements de revenu calcule en net (obligatoire)
    const netLines = generateBlocRevenuNet(bulletin, membre, dateDebut, dateFin, numeroContrat);
    netLines.forEach(([c, v]) => add(c, v));

    // S21.G00.78 + S21.G00.81 - Bases assujetties et cotisations (depuis cache)
    const cachedS81 = s81Cache.get(membre.id);
    if (cachedS81) cachedS81.forEach(([c, v]) => add(c, v));

    // S21.G00.86 - Anciennete (obligatoire pour CDD — M772)
    const ancienneteLines = generateBlocAnciennete(membre, numeroContrat);
    ancienneteLines.forEach(([c, v]) => add(c, v));
    } // fin !isEvenementiel

    // Evenementielles — blocs specifiques
    if (nature === '02' && options.evenement) {
      const arretLines = generateBlocArretTravail(options.evenement);
      arretLines.forEach(([c, v]) => add(c, v));
    }
    if (nature === '04' && options.evenement) {
      const finLines = generateBlocFinContrat(options.evenement);
      finLines.forEach(([c, v]) => add(c, v));
    }

    membreRanges.push({ membreId: membre.id, start: membreStartIdx, end: lines.length });
  }

  // Post-traitement: appliquer surcharges DSN
  if (Object.keys(globalOverrides).length > 0) {
    for (let i = 0; i < lines.length; i++) {
      const commaIdx = lines[i].indexOf(',');
      if (commaIdx === -1) continue;
      const code = lines[i].substring(0, commaIdx);
      if (globalOverrides[code] !== undefined) {
        lines[i] = `${code},'${globalOverrides[code]}'`;
      }
    }
  }
  for (const { membreId, start, end } of membreRanges) {
    const moOverrides = membreOverrides[membreId];
    if (!moOverrides) continue;
    for (let i = start; i < end; i++) {
      const commaIdx = lines[i].indexOf(',');
      if (commaIdx === -1) continue;
      const code = lines[i].substring(0, commaIdx);
      if (moOverrides[code] !== undefined) {
        lines[i] = `${code},'${moOverrides[code]}'`;
      }
    }
  }
  } // fin if (!options.neant) — DSN neant = S10+S20+S21.G00.06+S21.G00.11+S90

  // =====================================================
  // S90 - TOTAL
  // =====================================================
  const totauxLines = generateTotaux(nbRubriques, nbSalaries);
  totauxLines.forEach(([c, v]) => add(c, v));

  const content = lines.join('\r\n') + '\r\n';
  const filename = `DSN_${nature}_${periode.replace('-', '')}_${Date.now()}.dsn`;

  // DSN exige ISO-8859-1 (pas UTF-8). Buffer.from(str, 'latin1') prend le byte bas
  // de chaque code point, ce qui donne l'encodage ISO-8859-1 correct pour les accents francais.
  const contentISO = Buffer.from(content, 'latin1');

  return {
    content,
    // Buffer ISO-8859-1 pour ecriture fichier et telechargement
    // IMPORTANT: toujours utiliser contentISO pour les fichiers DSN
    contentISO,
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

export function generateBlocEmetteur(params, dateGen, normeVersion, options = {}) {
  const lines = [];
  // S10.G00.00 - Envoi
  lines.push(['S10.G00.00.001', params.logiciel_paie || 'NEXUS SIRH']);
  lines.push(['S10.G00.00.002', 'NEXUS']);
  lines.push(['S10.G00.00.003', '1.0.0']);
  lines.push(['S10.G00.00.005', '01']);         // Code envoi: 01=reel
  lines.push(['S10.G00.00.006', normeVersion]); // Version norme
  lines.push(['S10.G00.00.007', '01']);         // Point de depot: 01=net-entreprises
  // Type envoi: 01=normal, 02=neant (DSN sans individu — CCH-11 exige 02 si type decla=02)
  lines.push(['S10.G00.00.008', options.neant ? '02' : '01']);

  // S10.G00.01 - Emetteur
  lines.push(['S10.G00.01.001', params.siren]);
  lines.push(['S10.G00.01.002', params.nic || params.siret?.slice(9)]);
  lines.push(['S10.G00.01.003', params.raison_sociale]);
  lines.push(['S10.G00.01.004', params.adresse_siege]);
  lines.push(['S10.G00.01.005', params.code_postal_siege]);
  lines.push(['S10.G00.01.006', params.ville_siege]);
  // NE PAS inclure S10.G00.01.007 (code pays) pour la France (erreur M641)

  // S10.G00.02 - Contact emetteur (obligatoire — doit suivre S10.G00.01)
  lines.push(['S10.G00.02.001', params.contact_civilite || '01']); // 01=M, 02=Mme
  lines.push(['S10.G00.02.002', params.contact_nom || params.raison_sociale]);
  lines.push(['S10.G00.02.004', params.contact_email || 'contact@entreprise.fr']); // .004=email (PAS .003 — M009)
  lines.push(['S10.G00.02.005', (params.contact_tel || '0100000000').replace(/\s/g, '')]);

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
  // .015 - Code IDCC convention collective (obligatoire si applicable)
  if (params.idcc) lines.push(['S21.G00.06.015', params.idcc]);
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
  // NE PAS inclure S21.G00.11.008 (M009 rubrique inconnue)
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
  let totalFillon = 0;
  for (const b of bulletins) {
    totalCotisPatronales += b.total_cotisations_patronales || 0;
    totalCotisSalariales += b.total_cotisations_salariales || 0;
    totalFillon += b.reduction_fillon || 0;
  }

  // Montant net a payer = cotisations totales - reductions (Fillon)
  const montantVersement = totalCotisPatronales + totalCotisSalariales - totalFillon;

  const opsUrssaf = params.urssaf_siret || params.urssaf_code || '';

  // Versement URSSAF
  lines.push(['S21.G00.20.001', opsUrssaf]);                  // Identifiant OPS (SIRET URSSAF)
  lines.push(['S21.G00.20.002', params.siret]);                // Entite d'affectation (SIRET entreprise)
  if (params.bic) lines.push(['S21.G00.20.003', params.bic]); // BIC
  if (params.iban) lines.push(['S21.G00.20.004', params.iban]); // IBAN
  lines.push(['S21.G00.20.005', formatMontantDecimal(montantVersement)]);
  lines.push(['S21.G00.20.006', dateDebut]);                   // Date debut periode (JJMMAAAA)
  lines.push(['S21.G00.20.007', dateFin]);                     // Date fin periode (JJMMAAAA)
  lines.push(['S21.G00.20.010', params.mode_paiement || '05']); // Mode paiement: 05=prelevement

  return lines;
}

// ============================================
// S21.G00.22 - BORDEREAU COTISATIONS DUE
// ============================================

export function generateBlocBordereau(bulletins, params, dateDebut, dateFin) {
  const lines = [];
  if (!bulletins.length) return lines;

  const opsUrssaf = params.urssaf_siret || params.urssaf_code || '';

  let totalCotis = 0;
  let totalFillon = 0;
  for (const b of bulletins) {
    totalCotis += (b.total_cotisations_patronales || 0) + (b.total_cotisations_salariales || 0);
    totalFillon += b.reduction_fillon || 0;
  }

  // S21.G00.22 - Bordereau de cotisation due
  // CTP 100 - Cas general (toutes cotisations patronales + salariales)
  lines.push(['S21.G00.22.001', opsUrssaf]);
  lines.push(['S21.G00.22.002', '100']);                          // Code CTP
  lines.push(['S21.G00.22.003', dateDebut]);
  lines.push(['S21.G00.22.004', dateFin]);
  lines.push(['S21.G00.22.005', formatMontantDecimal(totalCotis)]);

  // CTP 671 - Reduction generale (Fillon) — montant negatif
  // Somme des bordereaux = CTP100 - CTP671 = versement
  if (totalFillon > 0) {
    lines.push(['S21.G00.22.001', opsUrssaf]);
    lines.push(['S21.G00.22.002', '671']);
    lines.push(['S21.G00.22.003', dateDebut]);
    lines.push(['S21.G00.22.004', dateFin]);
    lines.push(['S21.G00.22.005', '-' + formatMontantDecimal(totalFillon)]);
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

  // .025 - Niveau de diplome prepare (obligatoire pour apprentissage — CCH-11)
  // 01=2ème cycle universitaire, 02=bac+3, 03=bac+2, 04=bac, 05=BEP/CAP, 06=CEP, 07=sans diplome
  if (membre.type_contrat === 'apprentissage' || membre.type_contrat === 'alternance') {
    lines.push(['S21.G00.30.025', membre.niveau_diplome || '05']); // default CAP/BEP
  }

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

  // .005 - Code complement PCS-ESE (optionnel — NE PAS inclure sauf professions specifiques)
  // Valeurs valides: '06'-'53', 'C643', 'L643', 'NP352', 'P352', 'S001', '999999', etc.
  // '99' n'est PAS valide (erreur CRE-11). Seul '999999' = non concerne.
  if (membre.complement_pcs && membre.complement_pcs !== '99') {
    lines.push(['S21.G00.40.005', membre.complement_pcs]);
  }

  // .006 - Libelle de l'emploi (texte libre — CT-DSN officiel)
  lines.push(['S21.G00.40.006', membre.poste || membre.intitule_poste || 'Employe']);

  // .007 - Nature du contrat (CT-DSN officiel)
  const NATURE_CONTRAT_MAP = {
    'cdi': '01',
    'cdd': '02',
    'interim': '03',
    'apprentissage': '07',
    'professionnalisation': '08',
    'alternance': '07', // alternance = apprentissage par défaut
    'stage': '29',
    'cej': '10', // contrat engagement jeune
  };
  const natureContratCode = NATURE_CONTRAT_MAP[membre.type_contrat] || '02';
  lines.push(['S21.G00.40.007', natureContratCode]);

  // .008 - Dispositif de politique publique (99=non concerne)
  // Apprentissage (nature 07) → dispositif '64' (contrat d'apprentissage)
  // Professionnalisation (nature 08) → dispositif '61'
  // CCH-15: dispositif '21' interdit avec nature 07/08
  let dispositif = membre.dispositif_politique || '99';
  // Nature 07 (apprentissage) : dispositif '99' obligatoire (les anciens codes 64/65 exigent nature 01/02/03)
  if (natureContratCode === '07') {
    dispositif = '99';
  } else if (natureContratCode === '08' && dispositif !== '61' && dispositif !== '99') {
    dispositif = '61'; // Contrat de professionnalisation
  }
  lines.push(['S21.G00.40.008', dispositif]);

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

  // .014 - Modalite d'exercice du temps de travail (10=temps complet, 20=temps partiel)
  lines.push(['S21.G00.40.014', membre.modalite_temps || '10']);

  // .016 - Complement de base au regime obligatoire (99=non concerne)
  lines.push(['S21.G00.40.016', membre.complement_regime || '99']);

  // .017 - Code convention collective (IDCC)
  if (params.idcc) lines.push(['S21.G00.40.017', params.idcc]);

  // .018 - Code regime de base risque maladie (200=regime general SS)
  lines.push(['S21.G00.40.018', membre.regime_maladie || '200']);

  // .019 - Identifiant du lieu de travail (SIRET de l'etablissement)
  lines.push(['S21.G00.40.019', params.siret]);

  // .020 - Code regime de base risque vieillesse (200=regime general)
  lines.push(['S21.G00.40.020', membre.regime_vieillesse || '200']);

  // .021 - Motif de recours (obligatoire pour CDD nature 02 uniquement)
  // POSITION: doit etre APRES .020 pour eviter qu'un retour a .011 cree un bloc fantome (CCH-12)
  if (natureContratCode === '02') {
    lines.push(['S21.G00.40.021', membre.cdd_motif || membre.motif_recours || '02']);
  }

  // .024 - Travailleur a l'etranger (99=non concerne)
  lines.push(['S21.G00.40.024', membre.travailleur_etranger || '99']);

  // .026 - Statut d'emploi du salarie (99=non concerne)
  lines.push(['S21.G00.40.026', membre.statut_emploi || '99']);

  // .036 - Code emplois multiples (03=non concerne)
  lines.push(['S21.G00.40.036', membre.emplois_multiples || '03']);

  // .037 - Code employeurs multiples (03=non concerne)
  lines.push(['S21.G00.40.037', membre.employeurs_multiples || '03']);

  // .039 - Code regime de base risque accident du travail (200=regime general)
  lines.push(['S21.G00.40.039', membre.regime_at || '200']);

  // .040 - Code risque accident du travail (table RAT officielle)
  // Ex: 930DB=coiffure, 553AC=restaurant, 746ZA=securite, 853AB=aide domicile
  lines.push(['S21.G00.40.040', membre.code_risque_at || params.code_risque_at || '930DB']);

  // .043 - Taux de cotisation accident du travail
  lines.push(['S21.G00.40.043', Number(membre.taux_at || params.taux_at_defaut || 1.50).toFixed(2)]);

  return lines;
}

// ============================================
// S21.G00.71 - RETRAITE COMPLEMENTAIRE (obligatoire)
// ============================================

export function generateBlocRetraiteComplementaire(membre, params) {
  const lines = [];

  // .002 - Code regime retraite complementaire
  // CCH-16: cadre (S21.G00.40.003 = '01') exige RETC, CNBF, RUAA ou CAVEC
  // Non-cadre (S21.G00.40.003 = '02'/'04') → RETA (regime Agirc-Arrco unifie)
  const statutCat = membre.statut_categoriel || statutCategorielFromCategorie(membre.categorie_sociopro);
  let codeRetraite;
  if (statutCat === '01' || statutCat === '02') {
    // Cadre ou extension cadre → RETC (DSN-Val CCH-16)
    codeRetraite = 'RETC';
  } else {
    // Non-cadre → RETA
    codeRetraite = params.code_regime_retraite || 'RETA';
    if (codeRetraite === 'RETC') codeRetraite = 'RETA'; // Non-cadre ne peut pas avoir RETC
  }
  lines.push(['S21.G00.71.002', codeRetraite]);

  return lines;
}

// ============================================
// S21.G00.86 - ANCIENNETE (obligatoire pour CDD — CCH-14 / M772)
// ============================================

export function generateBlocAnciennete(membre, numeroContrat) {
  const lines = [];

  // Calculer anciennete en mois depuis date_embauche
  const dateEmbauche = membre.date_embauche ? new Date(membre.date_embauche) : new Date();
  const now = new Date();
  const totalMois = Math.max(0,
    (now.getFullYear() - dateEmbauche.getFullYear()) * 12
    + (now.getMonth() - dateEmbauche.getMonth()));

  // .001 - Type anciennete (CT-DSN: DSN_Anciennete_Type)
  //   07 = anciennete dans l'entreprise (obligatoire pour CDD — CCH-14)
  lines.push(['S21.G00.86.001', '07']);
  // .002 - Unite de mesure (CT-DSN: DSN_Anciennete_Unite_Mesure)
  //   01 = mois
  lines.push(['S21.G00.86.002', '01']);
  // .003 - Valeur (CT-DSN: Nombre_1_5 — entier)
  lines.push(['S21.G00.86.003', String(totalMois)]);
  // .005 - Numero du contrat
  lines.push(['S21.G00.86.005', numeroContrat || '00001']);

  return lines;
}

// ============================================
// S21.G00.50 - VERSEMENT INDIVIDU
// ============================================

export function generateBlocVersementIndividu(bulletin, membre, moisDecl, dateDebut, dateFin) {
  const lines = [];
  const brut = bulletin ? bulletin.brut_total : (membre.salaire_mensuel || 0);
  const netImposable = bulletin ? (bulletin.net_imposable || 0) : Math.round(brut * 0.78);
  const netVerse = bulletin ? bulletin.net_a_payer : Math.round(brut * 0.75);

  // .001 - Date de versement (JJMMAAAA) — dernier jour du mois
  lines.push(['S21.G00.50.001', dateFin]);

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

  // .008 - Identifiant du taux de PAS (NIR — obligatoire quand type=01)
  if ((bulletin?.type_taux_pas || '01') === '01') {
    const nirPAS = (membre.nir || '').replace(/\s/g, '').slice(0, 13);
    if (nirPAS) lines.push(['S21.G00.50.008', nirPAS]);
  }

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
  const heures = membre.heures_mensuelles || 151.67;

  // Type 001 - Remuneration brute non plafonnee (PAS de .012 heures — M447 interdit)
  lines.push(['S21.G00.51.001', dateDebut]);
  lines.push(['S21.G00.51.002', dateFin]);
  lines.push(['S21.G00.51.010', numeroContrat]);
  lines.push(['S21.G00.51.011', '001']);
  lines.push(['S21.G00.51.013', formatMontantDecimal(brut)]);

  // Type 002 - Salaire brut chomage + S21.G00.53 activites (enfant obligatoire — M725)
  lines.push(['S21.G00.51.001', dateDebut]);
  lines.push(['S21.G00.51.002', dateFin]);
  lines.push(['S21.G00.51.010', numeroContrat]);
  lines.push(['S21.G00.51.011', '002']);
  lines.push(['S21.G00.51.013', formatMontantDecimal(salaireBase)]);

  // S21.G00.53 - Activites (enfant de type 002)
  // Seul type '01' (travail remunere) est valide — les HS sont declarees en remuneration S21.G00.51 type 017
  lines.push(['S21.G00.53.001', '01']);                  // 01=travail remunere
  lines.push(['S21.G00.53.002', formatHeures(heures)]);
  lines.push(['S21.G00.53.003', '10']);                   // 10=heure

  // Type 003 - Salaire retabli reconstitue
  lines.push(['S21.G00.51.001', dateDebut]);
  lines.push(['S21.G00.51.002', dateFin]);
  lines.push(['S21.G00.51.010', numeroContrat]);
  lines.push(['S21.G00.51.011', '003']);
  lines.push(['S21.G00.51.013', formatMontantDecimal(brut)]);

  // Type 010 - Salaire de base
  lines.push(['S21.G00.51.001', dateDebut]);
  lines.push(['S21.G00.51.002', dateFin]);
  lines.push(['S21.G00.51.010', numeroContrat]);
  lines.push(['S21.G00.51.011', '010']);
  lines.push(['S21.G00.51.013', formatMontantDecimal(salaireBase)]);

  // Type 017 - Heures supplementaires aleatoires (remuneration)
  // SIG-11: S21.G00.51.012 (nombre d'heures) obligatoire pour type 017
  if (bulletin && (bulletin.montant_hs_25 > 0 || bulletin.montant_hs_50 > 0)) {
    const montantHS = (bulletin.montant_hs_25 || 0) + (bulletin.montant_hs_50 || 0);
    const heuresHS = (bulletin.heures_supp_25 || 0) + (bulletin.heures_supp_50 || 0);
    lines.push(['S21.G00.51.001', dateDebut]);
    lines.push(['S21.G00.51.002', dateFin]);
    lines.push(['S21.G00.51.010', numeroContrat]);
    lines.push(['S21.G00.51.011', '017']);
    lines.push(['S21.G00.51.012', formatHeures(heuresHS)]);
    lines.push(['S21.G00.51.013', formatMontantDecimal(montantHS)]);
  }

  // S21.G00.52 - Primes (apres tous les .51)
  if (bulletin?.primes && Array.isArray(bulletin.primes)) {
    for (const prime of bulletin.primes) {
      if (prime.montant > 0) {
        lines.push(['S21.G00.52.001', prime.type || '002']); // 3-digit code (002=prime exceptionnelle)
        lines.push(['S21.G00.52.002', formatMontantDecimal(prime.montant)]);
        lines.push(['S21.G00.52.006', numeroContrat]);        // numero du contrat
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
  // Anomalie URSSAF #1: la periode MNS doit etre dans le meme mois
  lines.push(['S21.G00.58.001', dateDebut]);               // Date debut periode de paie
  lines.push(['S21.G00.58.002', dateFin]);                 // Date fin periode de paie
  lines.push(['S21.G00.58.003', '03']);                    // Type: 03=montant net social
  lines.push(['S21.G00.58.004', formatMontantDecimal(netSocial)]); // Montant

  return lines;
}

// ============================================
// S21.G00.78 - BASES ASSUJETTIES
// ============================================

export function generateBlocBasesAssujetties(bulletin, membre, dateDebut, dateFin) {
  // Stub — les bases sont maintenant generees dans generateBlocBasesEtCotisations
  return [];
}

// ============================================
// S21.G00.81 - COTISATIONS INDIVIDUELLES
// ============================================

export function generateBlocCotisationsIndividuelles(bulletin, membre, params) {
  // Stub — les cotisations sont maintenant generees dans generateBlocBasesEtCotisations
  return [];
}

// ============================================
// S21.G00.78 + S21.G00.81 IMBRIQUES
// Structure: Base → Cotisations rattachees (comme la DSN de reference)
// ============================================

export function generateBlocBasesEtCotisations(bulletin, membre, params, dateDebut, dateFin) {
  const lines = [];
  if (!bulletin) return [];

  const brut = bulletin.brut_total || (membre.salaire_mensuel || 0);
  const pmss = TAUX_2026.pmss;
  const tranche1 = Math.min(brut, pmss);
  const baseCSG = Math.round(brut * 0.9825);
  const opsUrssaf = params.urssaf_siret || params.urssaf_code || '';

  // Cotisations: peuvent être un array, un JSON string, ou un objet {code: {montant, taux}}
  const parseCotis = (raw) => {
    if (!raw) return [];
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return []; }
    }
    if (Array.isArray(raw)) return raw;
    // Objet clé-valeur du payrollEngine: {AT_MP: {montant, taux}, ...}
    return Object.entries(raw).map(([code, data]) => ({ code, ...data }));
  };
  const cotisP = parseCotis(bulletin.cotisations_patronales);
  const cotisS = parseCotis(bulletin.cotisations_salariales);

  // Helper: ajoute une base S21.G00.78
  const addBase = (code, montant) => {
    lines.push(['S21.G00.78.001', code]);
    lines.push(['S21.G00.78.002', dateDebut]);
    lines.push(['S21.G00.78.003', dateFin]);
    lines.push(['S21.G00.78.004', formatMontantDecimal(montant)]);
  };

  // Helper: ajoute une cotisation S21.G00.81
  const addCotis = (code, base, montant, taux) => {
    lines.push(['S21.G00.81.001', code]);
    lines.push(['S21.G00.81.002', opsUrssaf]);
    lines.push(['S21.G00.81.003', formatMontantDecimal(base)]);
    // formatMontantDecimal utilise Math.abs — preserver le signe negatif (ex: Fillon, TEPA)
    const montantStr = montant < 0 ? '-' + formatMontantDecimal(montant) : formatMontantDecimal(montant);
    lines.push(['S21.G00.81.004', montantStr]);
    if (taux !== undefined && taux !== null) {
      lines.push(['S21.G00.81.007', Number(taux).toFixed(2)]);
    }
  };

  // Helper: cherche une cotisation par clé textuelle ou code DSN numérique
  // Mappage clé payrollEngine → code DSN pour double recherche
  const KEY_TO_DSN = {
    'AT_MP': '049', 'REDUCTION_FILLON': '018', 'AGIRC_ARRCO_T1': '040',
    'PREVOYANCE': '045', 'CEG_T1': '048', 'CSA': '068', 'MALADIE': '074',
    'VIEILLESSE_DEPLAF': '075', 'VIEILLESSE_PLAF': '076', 'AF': '100',
    'DIALOGUE_SOCIAL': '105', 'CSG_DED': '072', 'CRDS': '079',
    'CHOMAGE': '012', 'AGS': '013', 'CSG_NON_DED': '073',
    'CET': '094', 'AGIRC_ARRCO_T2': '040', 'CEG_T2': '048',
    'APEC': '027', 'PREVOYANCE_CADRE': '045', 'REDUCTION_HS': '106',
  };
  const findCotis = (arr, key) => {
    const dsnCode = KEY_TO_DSN[key] || key;
    const found = arr.find(c => c.code === key || c.code === dsnCode || c.label === key);
    if (!found) return null;
    // Normaliser: accepter montant/taux OU montant_pat/taux_pat OU montant_sal/taux_sal
    return {
      montant: found.montant ?? found.montant_pat ?? found.montant_sal ?? 0,
      taux: found.taux ?? found.taux_pat ?? found.taux_sal ?? 0,
      base: found.base ?? 0,
    };
  };
  const findCotisP = (code) => findCotis(cotisP, code);
  const findCotisS = (code) => findCotis(cotisS, code);

  // ═══════════════════════════════════════════
  // Base 02 - Plafonnee (T1) + cotisations AT/MP, Vieillesse plafonnee
  // ═══════════════════════════════════════════
  addBase('02', tranche1);

  const atmp = findCotisP('AT_MP');
  if (atmp) addCotis('049', tranche1, atmp.montant || 0, atmp.taux || membre.taux_at || 0);

  // Vieillesse plafonnee (patronale + salariale combinees)
  const vieilPlafP = findCotisP('VIEILLESSE_PLAF');
  const vieilPlafS = findCotisS('VIEILLESSE_PLAF');
  const montantVieilPlaf = (vieilPlafP?.montant || 0) + (vieilPlafS?.montant || 0);
  const tauxVieilPlaf = (vieilPlafP?.taux || 0) + (vieilPlafS?.taux || 0);
  if (montantVieilPlaf) addCotis('076', tranche1, montantVieilPlaf, tauxVieilPlaf || 15.45);

  // ═══════════════════════════════════════════
  // Base 03 - Deplafonnee + cotisations generales
  // ═══════════════════════════════════════════
  addBase('03', brut);

  // S21.G00.79 - Composant de base assujettie
  lines.push(['S21.G00.79.001', '01']);
  lines.push(['S21.G00.79.004', formatMontantDecimal(brut)]);

  // Reduction Fillon (montant negatif)
  if (bulletin.reduction_fillon) {
    addCotis('018', brut, -(bulletin.reduction_fillon || 0), null);
  }

  // Prevoyance
  const prevoyance = findCotisP('PREVOYANCE');
  if (prevoyance) addCotis('045', brut, prevoyance.montant || 0, prevoyance.taux || 0);
  else addCotis('045', brut, 0, 0); // Obligatoire meme a 0

  // CSA
  const csa = findCotisP('CSA');
  addCotis('068', brut, csa?.montant || 0, csa?.taux || 0.30);

  // Maladie
  const maladieP = findCotisP('MALADIE');
  const maladieS = findCotisS('MALADIE');
  const montantMaladie = (maladieP?.montant || 0) + (maladieS?.montant || 0);
  addCotis('074', brut, montantMaladie, (maladieP?.taux || 0) + (maladieS?.taux || 0));

  // Vieillesse deplafonnee (patronale + salariale)
  const vieilDepP = findCotisP('VIEILLESSE_DEPLAF');
  const vieilDepS = findCotisS('VIEILLESSE_DEPLAF');
  const montantVieilDep = (vieilDepP?.montant || 0) + (vieilDepS?.montant || 0);
  addCotis('075', brut, montantVieilDep, (vieilDepP?.taux || 0) + (vieilDepS?.taux || 0));

  // Allocations familiales
  const af = findCotisP('AF');
  addCotis('100', brut, af?.montant || 0, af?.taux || 0);

  // Dialogue social
  const dialogue = findCotisP('DIALOGUE_SOCIAL');
  if (dialogue) addCotis('105', brut, dialogue.montant || 0, dialogue.taux || 0);

  // Reduction TEPA (HS) — peut etre dans bulletin.reduction_hs ou dans les cotisations patronales
  const reductionHS = findCotisP('REDUCTION_HS');
  if (reductionHS && reductionHS.montant) {
    // Le montant est deja negatif dans la cotisation
    const montantTEPA = reductionHS.montant < 0 ? reductionHS.montant : -(reductionHS.montant);
    addCotis('106', brut, montantTEPA, null);
  } else if (bulletin.reduction_hs) {
    addCotis('106', brut, -(bulletin.reduction_hs || 0), null);
  }

  // Chomage et AGS — cotisations individuelles S81 (codes 012, 013)
  const chomage = findCotisP('CHOMAGE');
  if (chomage) addCotis('012', tranche1, chomage.montant || 0, chomage.taux || 4.05);

  const ags = findCotisP('AGS');
  if (ags) addCotis('013', tranche1, ags.montant || 0, ags.taux || 0.20);

  // NOTE: FNAL (059 = Prevoyance en DSN, PAS FNAL), Formation (058), Taxe apprentissage (057)
  // sont des cotisations declarees UNIQUEMENT en bordereau CTP, PAS en S81 individuelle.
  // Les inclure en S81 provoque des erreurs CCH-11/CCH-12/CCH-13 DSN-Val.

  // ═══════════════════════════════════════════
  // Base 04 - CSG/CRDS
  // ═══════════════════════════════════════════
  addBase('04', baseCSG);

  // CSG deductible
  const csgDed = findCotisS('CSG_DED');
  addCotis('072', baseCSG, csgDed?.montant || 0, csgDed?.taux || 9.20);

  // CSG non deductible
  const csgNonDed = findCotisS('CSG_NON_DED');
  if (csgNonDed) addCotis('073', baseCSG, csgNonDed.montant || 0, csgNonDed.taux || 2.40);

  // CRDS
  const crds = findCotisS('CRDS');
  addCotis('079', baseCSG, crds?.montant || 0, crds?.taux || 0.50);

  // ═══════════════════════════════════════════
  // Base 07 - Retraite complementaire T1
  // ═══════════════════════════════════════════
  addBase('07', tranche1);

  // AGIRC-ARRCO T1
  const agircP = findCotisP('AGIRC_ARRCO_T1');
  const agircS = findCotisS('AGIRC_ARRCO_T1');
  const montantAgirc = (agircP?.montant || 0) + (agircS?.montant || 0);
  if (montantAgirc) addCotis('040', tranche1, montantAgirc, (agircP?.taux || 0) + (agircS?.taux || 0));

  // CEG T1
  const cegP = findCotisP('CEG_T1');
  const cegS = findCotisS('CEG_T1');
  const montantCeg = (cegP?.montant || 0) + (cegS?.montant || 0);
  if (montantCeg) addCotis('048', tranche1, montantCeg, (cegP?.taux || 0) + (cegS?.taux || 0));

  // CET — Contribution d'Equilibre Technique (code DSN 094)
  const cetP = findCotisP('CET');
  const cetS = findCotisS('CET');
  const montantCet = (cetP?.montant || 0) + (cetS?.montant || 0);
  if (montantCet) addCotis('094', tranche1, montantCet, (cetP?.taux || 0) + (cetS?.taux || 0));

  // ═══════════════════════════════════════════
  // Base 08 - Retraite complementaire T2 (si brut > PMSS)
  // ═══════════════════════════════════════════
  const tranche2 = Math.max(0, brut - pmss);
  if (tranche2 > 0) {
    addBase('08', tranche2);

    // AGIRC-ARRCO T2
    const agircT2P = findCotisP('AGIRC_ARRCO_T2');
    const agircT2S = findCotisS('AGIRC_ARRCO_T2');
    const montantAgircT2 = (agircT2P?.montant || 0) + (agircT2S?.montant || 0);
    if (montantAgircT2) addCotis('040', tranche2, montantAgircT2, (agircT2P?.taux || 0) + (agircT2S?.taux || 0));

    // CEG T2
    const cegT2P = findCotisP('CEG_T2');
    const cegT2S = findCotisS('CEG_T2');
    const montantCegT2 = (cegT2P?.montant || 0) + (cegT2S?.montant || 0);
    if (montantCegT2) addCotis('048', tranche2, montantCegT2, (cegT2P?.taux || 0) + (cegT2S?.taux || 0));
  }

  // APEC (cadres — code 027)
  const apecP = findCotisP('APEC');
  const apecS = findCotisS('APEC');
  const montantApec = (apecP?.montant || 0) + (apecS?.montant || 0);
  if (montantApec) addCotis('027', brut, montantApec, (apecP?.taux || 0) + (apecS?.taux || 0));

  // Prevoyance cadres (code 045 — deja emis plus haut si findCotisP('PREVOYANCE') trouve)
  // Si PREVOYANCE_CADRE est present en plus de PREVOYANCE, l'ajouter
  const prevCadre = findCotisP('PREVOYANCE_CADRE');
  if (prevCadre && prevCadre.montant) addCotis('045', tranche1, prevCadre.montant, prevCadre.taux || 1.50);

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
  generateBlocBasesAssujetties,
  generateBlocCotisationsIndividuelles,
  generateBlocBasesEtCotisations,
  generateBlocArretTravail,
  generateBlocFinContrat,
  generateTotaux,
};
