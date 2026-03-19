/**
 * Service Export FEC Conforme
 * Art. L47 A-I LPF — 18 colonnes obligatoires
 *
 * Corrections vs ancien code dans journaux.js :
 * 1. SIREN → lu depuis tenants.siren
 * 2. CompAuxNum → extrait depuis comptes 411xxx (clients) / 401xxx (fournisseurs)
 * 3. CompAuxLib → libellé du compte auxiliaire
 * 4. PieceDate → date du document source (facture/dépense)
 * 5. ValidDate → date de validation/lettrage
 * 6. Validation pré-export → écritures équilibrées, champs requis
 */

import { supabase } from '../config/supabase.js';

const JOURNAUX = {
  BQ: 'Banque',
  CA: 'Caisse',
  VT: 'Ventes',
  AC: 'Achats',
  PA: 'Paie',
  OD: 'Opérations Diverses',
  AN: 'À Nouveaux'
};

/**
 * Validation pré-export FEC
 */
export async function validateFEC(tenantId, exercice) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!exercice) throw new Error('exercice requis');

  const errors = [];
  const warnings = [];

  // Vérifier SIREN
  const { data: tenant } = await supabase
    .from('tenants')
    .select('siren, name')
    .eq('id', tenantId)
    .single();

  if (!tenant?.siren || tenant.siren === '000000000') {
    errors.push('SIREN manquant ou invalide. Renseignez-le dans les paramètres du tenant.');
  }

  // Récupérer écritures
  const { data: ecritures, error } = await supabase
    .from('ecritures_comptables')
    .select('id, journal_code, date_ecriture, numero_piece, compte_numero, compte_libelle, libelle, debit, credit, lettrage, date_lettrage, exercice')
    .eq('tenant_id', tenantId)
    .eq('exercice', parseInt(exercice))
    .order('date_ecriture')
    .order('id');

  if (error) throw error;

  if (!ecritures || ecritures.length === 0) {
    errors.push('Aucune écriture trouvée pour cet exercice');
    return { valid: false, errors, warnings, stats: { nb_ecritures: 0 } };
  }

  // Vérifier équilibre global
  const totalDebit = ecritures.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = ecritures.reduce((s, e) => s + (e.credit || 0), 0);
  if (totalDebit !== totalCredit) {
    errors.push(`Écritures globalement déséquilibrées : débit=${totalDebit} crédit=${totalCredit}`);
  }

  // Vérifier champs requis
  let nbSansPiece = 0;
  let nbSansCompte = 0;
  let nbSansLibelle = 0;
  ecritures.forEach(e => {
    if (!e.numero_piece) nbSansPiece++;
    if (!e.compte_numero) nbSansCompte++;
    if (!e.libelle) nbSansLibelle++;
  });

  if (nbSansCompte > 0) errors.push(`${nbSansCompte} écriture(s) sans numéro de compte`);
  if (nbSansPiece > 0) warnings.push(`${nbSansPiece} écriture(s) sans numéro de pièce`);
  if (nbSansLibelle > 0) warnings.push(`${nbSansLibelle} écriture(s) sans libellé`);

  // Vérifier journaux
  const journaux = new Set(ecritures.map(e => e.journal_code));
  const periodes = new Set(ecritures.map(e => e.date_ecriture?.slice(0, 7)));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      nb_ecritures: ecritures.length,
      nb_journaux: journaux.size,
      journaux: [...journaux],
      nb_periodes: periodes.size,
      periodes: [...periodes].sort(),
      total_debit: totalDebit,
      total_credit: totalCredit,
      siren: tenant?.siren || null
    }
  };
}

/**
 * Génère le FEC conforme (18 colonnes TSV, UTF-8 BOM)
 */
export async function generateFEC(tenantId, exercice) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!exercice) throw new Error('exercice requis');

  // Récupérer SIREN
  const { data: tenant } = await supabase
    .from('tenants')
    .select('siren, name')
    .eq('id', tenantId)
    .single();

  const siren = tenant?.siren || '000000000';

  // Récupérer écritures avec jointures
  const { data: ecritures, error } = await supabase
    .from('ecritures_comptables')
    .select('*, facture:factures(date_facture, numero, client_id), depense:depenses(date_depense, fournisseur)')
    .eq('tenant_id', tenantId)
    .eq('exercice', parseInt(exercice))
    .order('date_ecriture', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    // Fallback sans jointures si les FK n'existent pas
    const { data: ecrituresSimple, error: err2 } = await supabase
      .from('ecritures_comptables')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('exercice', parseInt(exercice))
      .order('date_ecriture', { ascending: true })
      .order('id', { ascending: true });

    if (err2) throw err2;
    return buildFEC(ecrituresSimple || [], siren, exercice, tenantId);
  }

  return buildFEC(ecritures || [], siren, exercice, tenantId);
}

/**
 * Construit le contenu FEC
 */
async function buildFEC(ecritures, siren, exercice, tenantId) {
  // Charger les comptes auxiliaires pour résolution CompAuxNum/Lib
  const compteAuxMap = {};

  // Clients : comptes 411xxxxx → client_id
  const { data: clients } = await supabase
    .from('clients')
    .select('id, nom, prenom')
    .eq('tenant_id', tenantId);

  (clients || []).forEach(c => {
    const auxNum = `411${String(c.id).padStart(5, '0')}`;
    compteAuxMap[auxNum] = { num: auxNum, lib: `${c.nom || ''} ${c.prenom || ''}`.trim() };
  });

  // En-tête FEC (18 colonnes)
  const header = [
    'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
    'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
    'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
    'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise'
  ].join('\t');

  const lines = [header];
  let ecritureNum = 1;

  ecritures.forEach(e => {
    // CompAuxNum / CompAuxLib — comptes auxiliaires clients (411) et fournisseurs (401)
    let compAuxNum = '';
    let compAuxLib = '';

    if (e.compte_numero?.startsWith('411') && e.compte_numero.length > 3) {
      const aux = compteAuxMap[e.compte_numero];
      compAuxNum = e.compte_numero;
      compAuxLib = aux?.lib || e.compte_libelle || '';
    } else if (e.compte_numero?.startsWith('401') && e.compte_numero.length > 3) {
      compAuxNum = e.compte_numero;
      compAuxLib = e.compte_libelle || e.depense?.fournisseur || '';
    }

    // PieceDate — date du document source (pas la date d'écriture)
    let pieceDate = e.date_ecriture;
    if (e.facture?.date_facture) {
      pieceDate = e.facture.date_facture;
    } else if (e.depense?.date_depense) {
      pieceDate = e.depense.date_depense;
    }

    // ValidDate — date de lettrage si lettrée, sinon date d'écriture
    const validDate = e.date_lettrage || e.date_ecriture;

    const line = [
      e.journal_code,                                        // JournalCode
      JOURNAUX[e.journal_code] || e.journal_code,           // JournalLib
      String(ecritureNum++).padStart(8, '0'),               // EcritureNum
      formatDateFEC(e.date_ecriture),                       // EcritureDate
      e.compte_numero,                                       // CompteNum
      (e.compte_libelle || '').replace(/\t/g, ' '),         // CompteLib
      compAuxNum,                                            // CompAuxNum
      compAuxLib.replace(/\t/g, ' '),                       // CompAuxLib
      (e.numero_piece || '').replace(/\t/g, ' '),           // PieceRef
      formatDateFEC(pieceDate),                             // PieceDate
      (e.libelle || '').replace(/\t/g, ' '),                // EcritureLib
      formatMontantFEC(e.debit),                            // Debit
      formatMontantFEC(e.credit),                           // Credit
      e.lettrage || '',                                      // EcritureLet
      e.date_lettrage ? formatDateFEC(e.date_lettrage) : '', // DateLet
      formatDateFEC(validDate),                             // ValidDate
      '',                                                    // Montantdevise
      ''                                                     // Idevise
    ];

    lines.push(line.join('\t'));
  });

  const dateClot = `${exercice}1231`;
  const filename = `${siren}FEC${dateClot}.txt`;

  // UTF-8 BOM + contenu
  const bom = '\uFEFF';
  const content = bom + lines.join('\n');

  return {
    content,
    filename,
    stats: {
      nb_ecritures: ecritures.length,
      siren
    }
  };
}

/**
 * Rapport de contrôle FEC
 */
export async function rapportControleFEC(tenantId, exercice) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data: ecritures } = await supabase
    .from('ecritures_comptables')
    .select('journal_code, date_ecriture, compte_numero, debit, credit')
    .eq('tenant_id', tenantId)
    .eq('exercice', parseInt(exercice));

  if (!ecritures || ecritures.length === 0) {
    return { nb_ecritures: 0, equilibre: true };
  }

  const totalDebit = ecritures.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = ecritures.reduce((s, e) => s + (e.credit || 0), 0);

  const journaux = {};
  const comptes = new Set();
  const periodes = new Set();

  ecritures.forEach(e => {
    journaux[e.journal_code] = (journaux[e.journal_code] || 0) + 1;
    comptes.add(e.compte_numero);
    periodes.add(e.date_ecriture?.slice(0, 7));
  });

  return {
    equilibre: totalDebit === totalCredit,
    total_debit: totalDebit,
    total_credit: totalCredit,
    nb_ecritures: ecritures.length,
    nb_journaux: Object.keys(journaux).length,
    journaux,
    nb_comptes_utilises: comptes.size,
    periodes_couvertes: [...periodes].sort()
  };
}

// ─── Helpers FEC ───

function formatDateFEC(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function formatMontantFEC(centimes) {
  if (!centimes) return '0,00';
  return (centimes / 100).toFixed(2).replace('.', ',');
}

export default {
  validateFEC,
  generateFEC,
  rapportControleFEC
};
