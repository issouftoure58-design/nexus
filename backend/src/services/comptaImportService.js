/**
 * Service Import Comptable
 * 3 modes : FEC (Sage/Cegid/etc), CSV libre, Soldes d'ouverture
 */

import { supabase } from '../config/supabase.js';

/**
 * Parse un fichier FEC (18 colonnes, TAB ou pipe séparé)
 */
export async function parseFEC(tenantId, content) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!content) throw new Error('contenu FEC requis');

  const errors = [];
  const ecritures = [];

  // Détecter séparateur (TAB ou pipe)
  const firstLine = content.split('\n')[0] || '';
  const separator = firstLine.includes('\t') ? '\t' : '|';

  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) {
    errors.push('Fichier FEC vide ou sans données');
    return { ecritures: [], errors, stats: { nb_lignes: 0 } };
  }

  // Header = première ligne
  const headers = lines[0].split(separator).map(h => h.trim().replace(/^\uFEFF/, ''));

  // Mapping colonnes FEC standard
  const colIndex = {};
  const FEC_COLS = ['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
    'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
    'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
    'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise'];

  FEC_COLS.forEach((col, i) => {
    const idx = headers.findIndex(h => h.toLowerCase() === col.toLowerCase());
    colIndex[col] = idx >= 0 ? idx : i; // fallback positionnel
  });

  // Parser les lignes
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator);
    if (cols.length < 13) {
      errors.push(`Ligne ${i + 1}: nombre de colonnes insuffisant (${cols.length})`);
      continue;
    }

    try {
      const dateStr = cols[colIndex['EcritureDate']]?.trim();
      const date = parseDateFEC(dateStr);
      if (!date) {
        errors.push(`Ligne ${i + 1}: date invalide "${dateStr}"`);
        continue;
      }

      const debitStr = cols[colIndex['Debit']]?.trim().replace(',', '.') || '0';
      const creditStr = cols[colIndex['Credit']]?.trim().replace(',', '.') || '0';
      const debit = Math.round(parseFloat(debitStr) * 100) || 0;
      const credit = Math.round(parseFloat(creditStr) * 100) || 0;

      if (debit === 0 && credit === 0) continue; // Ignorer lignes à zéro

      const compteNum = cols[colIndex['CompteNum']]?.trim();
      if (!compteNum) {
        errors.push(`Ligne ${i + 1}: numéro de compte manquant`);
        continue;
      }

      ecritures.push({
        journal_code: cols[colIndex['JournalCode']]?.trim() || 'OD',
        date_ecriture: date,
        numero_piece: cols[colIndex['PieceRef']]?.trim() || `IMP-${i}`,
        compte_numero: compteNum,
        compte_libelle: cols[colIndex['CompteLib']]?.trim() || '',
        libelle: cols[colIndex['EcritureLib']]?.trim() || '',
        debit,
        credit,
        lettrage: cols[colIndex['EcritureLet']]?.trim() || null,
        date_lettrage: parseDateFEC(cols[colIndex['DateLet']]?.trim()) || null,
        periode: date.slice(0, 7),
        exercice: parseInt(date.slice(0, 4))
      });
    } catch (err) {
      errors.push(`Ligne ${i + 1}: ${err.message}`);
    }
  }

  return {
    ecritures,
    errors,
    stats: {
      nb_lignes: lines.length - 1,
      nb_ecritures: ecritures.length,
      nb_erreurs: errors.length,
      journaux: [...new Set(ecritures.map(e => e.journal_code))],
      exercices: [...new Set(ecritures.map(e => e.exercice))],
      comptes: [...new Set(ecritures.map(e => e.compte_numero))]
    }
  };
}

/**
 * Parse un CSV libre avec mapping colonnes
 */
export async function parseCSV(tenantId, content, mapping) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!content) throw new Error('contenu CSV requis');
  if (!mapping) throw new Error('mapping colonnes requis');

  const errors = [];
  const ecritures = [];

  // Détecter séparateur
  const firstLine = content.split('\n')[0] || '';
  const separator = firstLine.includes(';') ? ';' : (firstLine.includes('\t') ? '\t' : ',');

  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) {
    errors.push('Fichier CSV vide');
    return { ecritures: [], errors, stats: { nb_lignes: 0 } };
  }

  const headers = lines[0].split(separator).map(h => h.trim().replace(/^\uFEFF/, '').replace(/"/g, ''));

  // Résoudre le mapping : nom colonne → index
  const idx = {};
  Object.entries(mapping).forEach(([field, colName]) => {
    const i = headers.findIndex(h => h.toLowerCase() === colName.toLowerCase());
    if (i >= 0) idx[field] = i;
  });

  const requiredFields = ['date', 'compte', 'debit', 'credit'];
  const missing = requiredFields.filter(f => idx[f] === undefined);
  if (missing.length > 0) {
    errors.push(`Colonnes manquantes dans le mapping : ${missing.join(', ')}`);
    return { ecritures: [], errors, stats: { nb_lignes: lines.length - 1 } };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map(c => c.trim().replace(/"/g, ''));

    try {
      const dateRaw = cols[idx['date']] || '';
      const date = parseFlexDate(dateRaw);
      if (!date) {
        errors.push(`Ligne ${i + 1}: date invalide "${dateRaw}"`);
        continue;
      }

      const debit = Math.round(parseFloat((cols[idx['debit']] || '0').replace(',', '.').replace(/\s/g, '')) * 100) || 0;
      const credit = Math.round(parseFloat((cols[idx['credit']] || '0').replace(',', '.').replace(/\s/g, '')) * 100) || 0;
      if (debit === 0 && credit === 0) continue;

      const compteNum = cols[idx['compte']] || '';
      if (!compteNum) {
        errors.push(`Ligne ${i + 1}: numéro de compte manquant`);
        continue;
      }

      ecritures.push({
        journal_code: idx['journal'] !== undefined ? (cols[idx['journal']] || 'OD') : 'OD',
        date_ecriture: date,
        numero_piece: idx['piece'] !== undefined ? (cols[idx['piece']] || `CSV-${i}`) : `CSV-${i}`,
        compte_numero: compteNum,
        compte_libelle: idx['compte_libelle'] !== undefined ? (cols[idx['compte_libelle']] || '') : '',
        libelle: idx['libelle'] !== undefined ? (cols[idx['libelle']] || '') : '',
        debit,
        credit,
        periode: date.slice(0, 7),
        exercice: parseInt(date.slice(0, 4))
      });
    } catch (err) {
      errors.push(`Ligne ${i + 1}: ${err.message}`);
    }
  }

  return {
    ecritures,
    errors,
    stats: {
      nb_lignes: lines.length - 1,
      nb_ecritures: ecritures.length,
      nb_erreurs: errors.length,
      comptes: [...new Set(ecritures.map(e => e.compte_numero))]
    }
  };
}

/**
 * Valide un lot d'écritures avant import
 */
export async function validateImport(tenantId, ecritures) {
  if (!tenantId) throw new Error('tenant_id requis');

  const errors = [];
  const warnings = [];

  // Charger plan comptable (tenant-specific + default)
  const { data: planTenant } = await supabase
    .from('plan_comptable')
    .select('numero')
    .eq('tenant_id', tenantId);

  const { data: planDefault } = await supabase
    .from('plan_comptable')
    .select('numero')
    .eq('tenant_id', '__default__');

  const planComptable = [...(planTenant || []), ...(planDefault || [])];

  const comptesConnus = new Set((planComptable || []).map(c => c.numero));

  // Vérifier équilibre par pièce
  const pieces = {};
  const comptesManquants = new Set();

  ecritures.forEach(e => {
    const key = e.numero_piece || 'SANS_PIECE';
    if (!pieces[key]) pieces[key] = { debit: 0, credit: 0 };
    pieces[key].debit += e.debit || 0;
    pieces[key].credit += e.credit || 0;

    // Vérifier si le compte existe
    if (!comptesConnus.has(e.compte_numero)) {
      comptesManquants.add(e.compte_numero);
    }
  });

  // Equilibre par pièce
  Object.entries(pieces).forEach(([piece, totaux]) => {
    if (Math.abs(totaux.debit - totaux.credit) > 1) { // tolérance 1 centime arrondi
      errors.push(`Pièce "${piece}" déséquilibrée : D=${totaux.debit} C=${totaux.credit}`);
    }
  });

  // Equilibre global
  const totalDebit = ecritures.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = ecritures.reduce((s, e) => s + (e.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 1) {
    errors.push(`Import globalement déséquilibré : D=${totalDebit} C=${totalCredit}`);
  }

  if (comptesManquants.size > 0) {
    warnings.push(`${comptesManquants.size} compte(s) absent(s) du plan comptable : ${[...comptesManquants].slice(0, 10).join(', ')}${comptesManquants.size > 10 ? '...' : ''}`);
  }

  // Vérifier périodes non verrouillées
  const periodes = [...new Set(ecritures.map(e => e.periode))];
  const { data: periodesVerrouillees } = await supabase
    .from('periodes_comptables')
    .select('periode')
    .eq('tenant_id', tenantId)
    .eq('verrouillee', true)
    .in('periode', periodes);

  if (periodesVerrouillees && periodesVerrouillees.length > 0) {
    errors.push(`Période(s) verrouillée(s) : ${periodesVerrouillees.map(p => p.periode).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    comptes_manquants: [...comptesManquants],
    stats: {
      nb_ecritures: ecritures.length,
      nb_pieces: Object.keys(pieces).length,
      total_debit: totalDebit,
      total_credit: totalCredit
    }
  };
}

/**
 * Crée les comptes manquants dans le plan comptable
 */
export async function createMissingAccounts(tenantId, comptesManquants) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!comptesManquants || comptesManquants.length === 0) return { created: 0 };

  const CLASSES = {
    '1': { libelle: 'Comptes de capitaux', type: 'passif' },
    '2': { libelle: 'Comptes d\'immobilisations', type: 'actif' },
    '3': { libelle: 'Comptes de stocks', type: 'actif' },
    '4': { libelle: 'Comptes de tiers', type: 'actif' },
    '5': { libelle: 'Comptes financiers', type: 'actif' },
    '6': { libelle: 'Comptes de charges', type: 'charge' },
    '7': { libelle: 'Comptes de produits', type: 'produit' }
  };

  const comptes = comptesManquants.map(num => {
    const classe = num.charAt(0);
    const classInfo = CLASSES[classe] || { libelle: 'Inconnu', type: 'actif' };
    return {
      tenant_id: tenantId,
      numero: num,
      libelle: `Compte ${num} (importé)`,
      classe: parseInt(classe) || 0,
      type: classInfo.type
    };
  });

  const { error } = await supabase
    .from('plan_comptable')
    .upsert(comptes, { onConflict: 'tenant_id,numero', ignoreDuplicates: true });

  if (error) throw error;
  return { created: comptes.length };
}

/**
 * Exécute l'import des écritures
 */
export async function executeImport(tenantId, ecritures, source = 'fec') {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!ecritures || ecritures.length === 0) throw new Error('aucune écriture à importer');

  // Ajouter tenant_id à chaque écriture
  const ecrituresInsert = ecritures.map(e => ({
    ...e,
    tenant_id: tenantId
  }));

  // Insérer par batch de 500
  let nbInserted = 0;
  const batchSize = 500;

  for (let i = 0; i < ecrituresInsert.length; i += batchSize) {
    const batch = ecrituresInsert.slice(i, i + batchSize);
    const { error } = await supabase
      .from('ecritures_comptables')
      .insert(batch);

    if (error) throw error;
    nbInserted += batch.length;
  }

  // Enregistrer l'import
  await supabase
    .from('imports_comptables')
    .insert({
      tenant_id: tenantId,
      type: source,
      nb_ecritures: nbInserted,
      statut: 'termine'
    });

  return {
    success: true,
    nb_ecritures: nbInserted
  };
}

/**
 * Import soldes d'ouverture (bilan initial)
 */
export async function importSoldesOuverture(tenantId, soldes, dateOuverture) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!soldes || soldes.length === 0) throw new Error('soldes requis');
  if (!dateOuverture) throw new Error('date d\'ouverture requise');

  const periode = dateOuverture.slice(0, 7);
  const exercice = parseInt(dateOuverture.slice(0, 4));

  const ecritures = [];

  soldes.forEach(s => {
    if (!s.compte_numero || s.solde === 0 || s.solde === undefined) return;

    const solde = Math.round(parseFloat(s.solde) * 100); // euros → centimes

    ecritures.push({
      tenant_id: tenantId,
      journal_code: 'AN',
      date_ecriture: dateOuverture,
      numero_piece: `OUVERTURE-${exercice}`,
      compte_numero: s.compte_numero,
      compte_libelle: s.compte_libelle || '',
      libelle: `Solde d'ouverture ${s.compte_libelle || s.compte_numero}`,
      debit: solde > 0 ? solde : 0,
      credit: solde < 0 ? Math.abs(solde) : 0,
      periode,
      exercice
    });
  });

  // Vérifier équilibre
  const totalDebit = ecritures.reduce((s, e) => s + e.debit, 0);
  const totalCredit = ecritures.reduce((s, e) => s + e.credit, 0);
  const diff = totalDebit - totalCredit;

  // Ajuster par un compte d'attente si déséquilibré
  if (diff !== 0) {
    ecritures.push({
      tenant_id: tenantId,
      journal_code: 'AN',
      date_ecriture: dateOuverture,
      numero_piece: `OUVERTURE-${exercice}`,
      compte_numero: '471',
      compte_libelle: 'Compte d\'attente',
      libelle: 'Écart d\'ouverture à régulariser',
      debit: diff < 0 ? Math.abs(diff) : 0,
      credit: diff > 0 ? diff : 0,
      periode,
      exercice
    });
  }

  if (ecritures.length > 0) {
    const { error } = await supabase
      .from('ecritures_comptables')
      .insert(ecritures);

    if (error) throw error;
  }

  // Historiser
  await supabase
    .from('imports_comptables')
    .insert({
      tenant_id: tenantId,
      type: 'soldes_ouverture',
      nb_ecritures: ecritures.length,
      statut: 'termine'
    });

  return {
    success: true,
    nb_ecritures: ecritures.length,
    equilibre: diff === 0
  };
}

// ─── Helpers ───

function parseDateFEC(dateStr) {
  if (!dateStr || dateStr.length < 8) return null;
  // Format AAAAMMJJ
  if (/^\d{8}$/.test(dateStr)) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  // Format AAAA-MM-JJ
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.slice(0, 10);
  }
  return null;
}

function parseFlexDate(dateStr) {
  if (!dateStr) return null;

  // AAAA-MM-JJ
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  // AAAAMMJJ
  if (/^\d{8}$/.test(dateStr)) return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  // JJ/MM/AAAA
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/');
    return `${y}-${m}-${d}`;
  }
  // DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('.');
    return `${y}-${m}-${d}`;
  }

  return null;
}

export default {
  parseFEC,
  parseCSV,
  validateImport,
  createMissingAccounts,
  executeImport,
  importSoldesOuverture
};
