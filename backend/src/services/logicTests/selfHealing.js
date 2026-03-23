/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * PLTE v2 — Self-Healing (Auto-corrections)
 * Detecte et corrige automatiquement les problemes courants
 */

import { supabase } from '../../config/supabase.js';

/**
 * Execute les auto-corrections apres les tests horaires
 * Retourne les corrections effectuees
 */
export async function runSelfHealing(tenantId, testResults) {
  if (!tenantId) throw new Error('tenant_id requis');

  const fixes = [];
  const failedTests = testResults.filter(r => r.status === 'fail');

  if (failedTests.length === 0) return fixes;

  for (const test of failedTests) {
    try {
      const fix = await attemptFix(tenantId, test);
      if (fix) {
        fixes.push(fix);
        // Marquer le test comme auto-fixed
        test.auto_fixed = true;
        test.fix_description = fix.description;
      }
    } catch (err) {
      console.error(`[PLTE Self-Heal] Erreur fix ${test.name} pour ${tenantId}:`, err.message);
    }
  }

  if (fixes.length > 0) {
    console.log(`[PLTE Self-Heal] ${tenantId}: ${fixes.length} correction(s) appliquee(s)`);
  }

  return fixes;
}

/**
 * Tente de corriger automatiquement un test en echec
 */
async function attemptFix(tenantId, test) {
  const error = test.error || '';

  // === Ecritures desequilibrees ===
  if (test.name?.includes('coherence') && error.includes('desequilibree')) {
    return await fixUnbalancedEntries(tenantId, error);
  }

  // === Facture payee sans ecritures BQ ===
  if (error.includes('sans ecritures BQ') || error.includes('payee(s) sans ecritures')) {
    return await fixMissingPaymentEntries(tenantId);
  }

  // === Solde fidelite incoherent ===
  if (test.name?.includes('fidelite') && error.includes('incoherent')) {
    return await fixLoyaltyBalance(tenantId, error);
  }

  // === Stock negatif ===
  if (error.includes('stock negatif')) {
    return await fixNegativeStock(tenantId);
  }

  // === Avoir sans ecritures inversees ===
  if (error.includes('avoir') && error.includes('ecritures')) {
    return await fixMissingAvoirEntries(tenantId);
  }

  // Pas de fix disponible pour ce type d'erreur
  return null;
}

// ============================================
// CORRECTIONS AUTOMATIQUES
// ============================================

/**
 * Corrige les ecritures desequilibrees en ajoutant la ligne manquante
 */
async function fixUnbalancedEntries(tenantId, errorMsg) {
  try {
    const { data: ecritures } = await supabase
      .from('ecritures_comptables')
      .select('*')
      .eq('tenant_id', tenantId);

    if (!ecritures?.length) return null;

    const pieces = {};
    for (const e of ecritures) {
      if (!pieces[e.numero_piece]) pieces[e.numero_piece] = [];
      pieces[e.numero_piece].push(e);
    }

    let fixCount = 0;
    for (const [piece, lines] of Object.entries(pieces)) {
      const totalD = lines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalC = lines.reduce((s, l) => s + (l.credit || 0), 0);
      const diff = Math.abs(totalD - totalC);

      if (diff > 1 && diff < 100000) { // Limiter aux petits ecarts
        // Ajouter la ligne d'equilibrage
        const needsDebit = totalC > totalD;
        const adjustEntry = {
          tenant_id: tenantId,
          numero_piece: piece,
          journal: lines[0].journal,
          date_ecriture: lines[0].date_ecriture,
          compte: '471000', // Compte d'attente
          libelle: '[PLTE Auto-fix] Ajustement equilibre',
          debit: needsDebit ? diff : 0,
          credit: needsDebit ? 0 : diff,
        };

        await supabase.from('ecritures_comptables').insert(adjustEntry);
        fixCount++;
      }
    }

    if (fixCount === 0) return null;

    return {
      type: 'auto_fix',
      action: 'fix_unbalanced_entries',
      description: `${fixCount} piece(s) reequilibree(s) via compte 471000 (attente)`,
      count: fixCount,
    };
  } catch {
    return null;
  }
}

/**
 * Genere les ecritures BQ manquantes pour factures payees
 */
async function fixMissingPaymentEntries(tenantId) {
  try {
    const { genererEcrituresPaiement } = await import('../../routes/factures.js');

    // Trouver factures payees sans ecritures BQ
    const { data: facturesPayees } = await supabase
      .from('factures')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('statut', 'payee')
      .eq('type', 'facture');

    if (!facturesPayees?.length) return null;

    let fixCount = 0;
    for (const facture of facturesPayees) {
      const { data: bqEntries } = await supabase
        .from('ecritures_comptables')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('piece_origine_id', facture.id)
        .eq('journal', 'BQ')
        .limit(1);

      if (!bqEntries?.length) {
        try {
          await genererEcrituresPaiement(tenantId, facture, 'carte',
            facture.date_paiement || new Date().toISOString().split('T')[0]);
          fixCount++;
        } catch {
          // Skip this facture
        }
      }
    }

    if (fixCount === 0) return null;

    return {
      type: 'auto_fix',
      action: 'fix_missing_payment_entries',
      description: `${fixCount} facture(s) payee(s) → ecritures BQ generees`,
      count: fixCount,
    };
  } catch {
    return null;
  }
}

/**
 * Recalcule le solde fidelite depuis les transactions
 */
async function fixLoyaltyBalance(tenantId, errorMsg) {
  try {
    // Extraire le client_id si possible
    const { data: clients } = await supabase
      .from('clients')
      .select('id, loyalty_points')
      .eq('tenant_id', tenantId);

    if (!clients?.length) return null;

    let fixCount = 0;
    for (const client of clients) {
      const { data: transactions } = await supabase
        .from('loyalty_transactions')
        .select('type, points')
        .eq('tenant_id', tenantId)
        .eq('client_id', client.id);

      if (!transactions?.length) continue;

      const calculatedBalance = transactions.reduce((sum, t) => {
        return sum + (t.type === 'earn' ? t.points : -t.points);
      }, 0);

      const correctBalance = Math.max(0, calculatedBalance);

      if (client.loyalty_points !== correctBalance) {
        await supabase
          .from('clients')
          .update({ loyalty_points: correctBalance })
          .eq('id', client.id)
          .eq('tenant_id', tenantId);
        fixCount++;
      }
    }

    if (fixCount === 0) return null;

    return {
      type: 'auto_fix',
      action: 'fix_loyalty_balance',
      description: `${fixCount} solde(s) fidelite recalcule(s) depuis SUM transactions`,
      count: fixCount,
    };
  } catch {
    return null;
  }
}

/**
 * Ajuste les stocks negatifs a 0
 */
async function fixNegativeStock(tenantId) {
  try {
    const { data: negStock } = await supabase
      .from('produits')
      .select('id, nom, stock_actuel')
      .eq('tenant_id', tenantId)
      .lt('stock_actuel', 0);

    if (!negStock?.length) return null;

    for (const p of negStock) {
      await supabase
        .from('produits')
        .update({ stock_actuel: 0 })
        .eq('id', p.id)
        .eq('tenant_id', tenantId);

      // Creer mouvement d'ajustement
      try {
        await supabase.from('stock_mouvements').insert({
          tenant_id: tenantId,
          produit_id: p.id,
          type: 'adjustment',
          quantite: Math.abs(p.stock_actuel),
          motif: `[PLTE Auto-fix] Ajustement stock negatif (${p.stock_actuel} → 0)`,
          created_at: new Date().toISOString(),
        });
      } catch { /* table may not exist */ }
    }

    return {
      type: 'auto_fix',
      action: 'fix_negative_stock',
      description: `${negStock.length} produit(s) ajuste(s) de negatif a 0`,
      count: negStock.length,
    };
  } catch {
    return null;
  }
}

/**
 * Genere les ecritures inversees pour avoirs sans ecritures
 */
async function fixMissingAvoirEntries(tenantId) {
  try {
    const { data: avoirs } = await supabase
      .from('factures')
      .select('id, facture_origine_id, montant_ttc')
      .eq('tenant_id', tenantId)
      .eq('type', 'avoir');

    if (!avoirs?.length) return null;

    let fixCount = 0;
    for (const avoir of avoirs) {
      const { data: entries } = await supabase
        .from('ecritures_comptables')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('piece_origine_id', avoir.id)
        .limit(1);

      if (!entries?.length && avoir.facture_origine_id) {
        try {
          const { genererEcrituresFacture } = await import('../../routes/factures.js');
          await genererEcrituresFacture(tenantId, avoir.id);
          fixCount++;
        } catch { /* skip */ }
      }
    }

    if (fixCount === 0) return null;

    return {
      type: 'auto_fix',
      action: 'fix_missing_avoir_entries',
      description: `${fixCount} avoir(s) → ecritures inversees generees`,
      count: fixCount,
    };
  } catch {
    return null;
  }
}
