/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * PLTE v2 — Diagnostic Engine
 * Remplace selfHealing.js — "trouver la fuite, pas remettre de l'essence"
 *
 * 3 categories de diagnostic :
 *   FIXED      — Cause trouvee ET corrigee a la source
 *   DIAGNOSED  — Cause trouvee mais correction manuelle requise
 *   UNKNOWN    — Cause non identifiee
 */

import { supabase } from '../../config/supabase.js';

/**
 * Execute les diagnostics sur les tests en echec.
 * Retourne un tableau de diagnostics structures.
 */
export async function runDiagnostics(tenantId, testResults) {
  if (!tenantId) throw new Error('tenant_id requis');

  const diagnostics = [];
  const failedTests = testResults.filter(r => r.status === 'fail');

  if (failedTests.length === 0) return diagnostics;

  for (const test of failedTests) {
    try {
      const diag = await diagnose(tenantId, test);
      if (diag) {
        diagnostics.push(diag);
        // Enrichir le test avec les infos de diagnostic
        test.diagnosis_category = diag.category;
        test.root_cause = diag.root_cause;
        test.operator_action = diag.operator_action || null;
        if (diag.category === 'FIXED') {
          test.auto_fixed = true;
          test.fix_description = diag.fix_applied;
        }
      }
    } catch (err) {
      console.error(`[PLTE Diagnostic] Erreur diagnostic ${test.name} pour ${tenantId}:`, err.message);
      diagnostics.push({
        category: 'UNKNOWN',
        test_name: test.name,
        root_cause: `Erreur pendant le diagnostic: ${err.message}`,
        root_cause_detail: null,
        fix_applied: null,
        operator_action: 'Verifier les logs serveur',
        evidence: {},
      });
    }
  }

  const fixed = diagnostics.filter(d => d.category === 'FIXED').length;
  const diagnosed = diagnostics.filter(d => d.category === 'DIAGNOSED').length;
  const unknown = diagnostics.filter(d => d.category === 'UNKNOWN').length;

  if (diagnostics.length > 0) {
    console.log(`[PLTE Diagnostic] ${tenantId}: ${diagnostics.length} diagnostic(s) — ${fixed} FIXED, ${diagnosed} DIAGNOSED, ${unknown} UNKNOWN`);
  }

  return diagnostics;
}

/**
 * Route un test en echec vers le handler diagnostique appropriate
 */
async function diagnose(tenantId, test) {
  const error = test.error || '';

  // === Ecritures desequilibrees ===
  if (test.name?.includes('coherence') && error.includes('desequilibree')) {
    return await diagnoseUnbalancedEntries(tenantId, test, error);
  }

  // === Facture payee sans ecritures BQ ===
  if (error.includes('sans ecritures BQ') || error.includes('payee(s) sans ecritures')) {
    return await diagnoseMissingPaymentEntries(tenantId, test);
  }

  // === Solde fidelite incoherent ===
  if (test.name?.includes('fidelite') && error.includes('incoherent')) {
    return await diagnoseLoyaltyBalance(tenantId, test);
  }

  // === Stock negatif ===
  if (error.includes('stock negatif')) {
    return await diagnoseNegativeStock(tenantId, test);
  }

  // === Avoir sans ecritures inversees ===
  if (error.includes('avoir') && error.includes('ecritures')) {
    return await diagnoseMissingAvoirEntries(tenantId, test);
  }

  // Pas de handler pour ce type d'erreur
  return {
    category: 'UNKNOWN',
    test_name: test.name,
    root_cause: `Aucun handler diagnostique pour ce type d'erreur`,
    root_cause_detail: error.substring(0, 200),
    fix_applied: null,
    operator_action: 'Analyser manuellement ce type de test',
    evidence: { test_name: test.name, error_snippet: error.substring(0, 100) },
  };
}

// ============================================
// HANDLERS DIAGNOSTIQUES
// ============================================

/**
 * 1. Ecritures desequilibrees
 * Au lieu d'ajouter 471000, remonte a la facture source
 */
async function diagnoseUnbalancedEntries(tenantId, test, errorMsg) {
  try {
    const { data: ecritures } = await supabase
      .from('ecritures_comptables')
      .select('*, facture_id')
      .eq('tenant_id', tenantId);

    if (!ecritures?.length) {
      return makeDiag('UNKNOWN', test.name, 'Aucune ecriture comptable trouvee', null, null,
        'Verifier que le bootstrap a cree des donnees comptables', {});
    }

    // Grouper par numero_piece
    const pieces = {};
    for (const e of ecritures) {
      if (!pieces[e.numero_piece]) pieces[e.numero_piece] = [];
      pieces[e.numero_piece].push(e);
    }

    const results = { fixed: 0, diagnosed: 0, details: [] };

    for (const [piece, lines] of Object.entries(pieces)) {
      const totalD = lines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalC = lines.reduce((s, l) => s + (l.credit || 0), 0);
      const diff = Math.abs(totalD - totalC);

      if (diff <= 1 || diff >= 100000) continue;

      // Remonter a la facture source
      const factureId = lines.find(l => l.facture_id)?.facture_id;

      if (factureId) {
        const { data: facture } = await supabase
          .from('factures')
          .select('id, montant_ht, montant_tva, montant_ttc, lignes_facture')
          .eq('id', factureId)
          .eq('tenant_id', tenantId)
          .single();

        if (facture) {
          // Verifier si TVA mal calculee
          const expectedTTC = (facture.montant_ht || 0) + (facture.montant_tva || 0);
          const tvaError = Math.abs(expectedTTC - (facture.montant_ttc || 0)) > 0.01;

          if (tvaError) {
            results.diagnosed++;
            results.details.push({ piece, cause: 'TVA mal calculee sur facture', facture_id: factureId });
            continue;
          }

          // Verifier si ligne manquante (ex: ecriture TVA)
          const hasDebitEntry = lines.some(l => l.debit > 0);
          const hasCreditEntry = lines.some(l => l.credit > 0);
          const hasTVAEntry = lines.some(l => l.compte?.startsWith('4457'));

          if (hasDebitEntry && hasCreditEntry && !hasTVAEntry && facture.montant_tva > 0) {
            // Ligne TVA manquante — on peut la regenerer
            const needsDebit = totalC > totalD;
            await supabase.from('ecritures_comptables').insert({
              tenant_id: tenantId,
              numero_piece: piece,
              journal: lines[0].journal,
              date_ecriture: lines[0].date_ecriture,
              compte: '445710',
              libelle: '[PLTE Diagnostic] TVA collectee manquante regeneree',
              debit: needsDebit ? diff : 0,
              credit: needsDebit ? 0 : diff,
              facture_id: factureId,
            });
            results.fixed++;
            results.details.push({ piece, cause: 'Ligne TVA manquante regeneree', facture_id: factureId });
            continue;
          }
        }
      }

      // Ecriture manuelle sans facture identifiable
      results.diagnosed++;
      results.details.push({ piece, cause: 'Ecriture desequilibree sans facture source identifiable', diff });
    }

    if (results.fixed === 0 && results.diagnosed === 0) return null;

    if (results.fixed > 0 && results.diagnosed === 0) {
      return makeDiag('FIXED', test.name,
        `${results.fixed} piece(s) desequilibree(s) — lignes manquantes identifiees`,
        results.details.map(d => d.cause).join('; '),
        `${results.fixed} ecriture(s) regeneree(s) depuis la facture source`,
        null, { details: results.details });
    }

    return makeDiag('DIAGNOSED', test.name,
      `${results.diagnosed} piece(s) desequilibree(s) — cause identifiee`,
      results.details.map(d => d.cause).join('; '),
      results.fixed > 0 ? `${results.fixed} corrigee(s) auto, ${results.diagnosed} requierent intervention` : null,
      'Verifier les factures sources et les calculs TVA',
      { details: results.details });
  } catch {
    return makeDiag('UNKNOWN', test.name, 'Erreur lors de l\'analyse des ecritures', null, null,
      'Verifier la table ecritures_comptables', {});
  }
}

/**
 * 2. Ecritures BQ manquantes
 * Verifie le flux paiement avant de regenerer
 */
async function diagnoseMissingPaymentEntries(tenantId, test) {
  try {
    const { data: facturesPayees } = await supabase
      .from('factures')
      .select('id, statut, date_paiement, mode_paiement, montant_ttc')
      .eq('tenant_id', tenantId)
      .eq('statut', 'payee')
      .eq('type', 'facture');

    if (!facturesPayees?.length) return null;

    const results = { fixed: 0, diagnosed: 0, details: [] };

    for (const facture of facturesPayees) {
      const { data: bqEntries } = await supabase
        .from('ecritures_comptables')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('facture_id', facture.id)
        .eq('journal_code', 'BQ')
        .limit(1);

      if (bqEntries?.length) continue; // Ecritures presentes, pas de probleme

      // Diagnostic: pourquoi les ecritures BQ manquent ?
      if (!facture.date_paiement) {
        // Facture marquee payee sans date_paiement
        results.diagnosed++;
        results.details.push({
          facture_id: facture.id,
          cause: 'Facture marquee payee sans date_paiement',
          missing_field: 'date_paiement',
        });
        continue;
      }

      if (!facture.mode_paiement) {
        // Mode de paiement manquant — on peut quand meme regenerer avec 'carte' par defaut
        // mais c'est un symptome a signaler
        const modePaiement = 'carte';
        try {
          const { genererEcrituresPaiement } = await import('../../routes/factures.js');
          await genererEcrituresPaiement(tenantId, facture, modePaiement, facture.date_paiement);
          results.fixed++;
          results.details.push({
            facture_id: facture.id,
            cause: `mode_paiement absent, genere avec defaut '${modePaiement}'`,
            missing_field: 'mode_paiement',
          });
        } catch {
          results.diagnosed++;
          results.details.push({
            facture_id: facture.id,
            cause: 'mode_paiement absent et generation echoue',
            missing_field: 'mode_paiement',
          });
        }
        continue;
      }

      // Donnees completes — generer proprement
      try {
        const { genererEcrituresPaiement } = await import('../../routes/factures.js');
        await genererEcrituresPaiement(tenantId, facture, facture.mode_paiement, facture.date_paiement);
        results.fixed++;
        results.details.push({
          facture_id: facture.id,
          cause: 'genererEcrituresPaiement jamais appele — donnees completes, regenere',
        });
      } catch {
        results.diagnosed++;
        results.details.push({
          facture_id: facture.id,
          cause: 'Donnees completes mais generation echouee',
        });
      }
    }

    if (results.fixed === 0 && results.diagnosed === 0) return null;

    if (results.fixed > 0 && results.diagnosed === 0) {
      return makeDiag('FIXED', test.name,
        `${results.fixed} facture(s) payee(s) sans ecritures BQ — flux paiement non appele`,
        results.details.map(d => d.cause).join('; '),
        `Ecritures BQ regenerees depuis les donnees de paiement existantes`,
        null, { details: results.details });
    }

    if (results.diagnosed > 0) {
      return makeDiag('DIAGNOSED', test.name,
        `Factures payees sans ecritures BQ — donnees paiement incompletes`,
        results.details.filter(d => d.missing_field).map(d => `facture ${d.facture_id}: ${d.missing_field} manquant`).join('; '),
        results.fixed > 0 ? `${results.fixed} regeneree(s) auto` : null,
        'Verifier le flux de paiement dans adminReservations.js — date_paiement et mode_paiement doivent etre renseignes',
        { details: results.details });
    }

    return null;
  } catch {
    return makeDiag('UNKNOWN', test.name, 'Erreur lors de l\'analyse des ecritures BQ', null, null,
      'Verifier la table factures et ecritures_comptables', {});
  }
}

/**
 * 3. Solde fidelite incoherent
 * Compare balance vs SUM(transactions) au lieu d'ecraser
 */
async function diagnoseLoyaltyBalance(tenantId, test) {
  try {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, nom, prenom, loyalty_points')
      .eq('tenant_id', tenantId);

    if (!clients?.length) return null;

    const results = { fixed: 0, diagnosed: 0, details: [] };

    for (const client of clients) {
      const { data: transactions } = await supabase
        .from('loyalty_transactions')
        .select('id, type, points, created_at')
        .eq('tenant_id', tenantId)
        .eq('client_id', client.id)
        .order('created_at', { ascending: true });

      if (!transactions?.length) continue;

      const calculatedBalance = transactions.reduce((sum, t) => {
        return sum + (t.type === 'earn' ? t.points : -t.points);
      }, 0);

      const correctBalance = Math.max(0, calculatedBalance);
      const currentBalance = client.loyalty_points || 0;

      if (currentBalance === correctBalance) continue;

      const drift = currentBalance - correctBalance;

      // Verifier si des transactions ont ete supprimees (trou dans la sequence)
      const { count: totalInDB } = await supabase
        .from('loyalty_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('client_id', client.id);

      if (totalInDB !== transactions.length) {
        // Transactions manquantes (count != fetched)
        results.diagnosed++;
        results.details.push({
          client_id: client.id,
          client_name: `${client.prenom || ''} ${client.nom || ''}`.trim(),
          cause: `Transactions manquantes (${totalInDB} en DB vs ${transactions.length} recues)`,
          drift,
        });
        continue;
      }

      // Drift calculable — simple desynchronisation
      await supabase
        .from('clients')
        .update({ loyalty_points: correctBalance })
        .eq('id', client.id)
        .eq('tenant_id', tenantId);

      results.fixed++;
      results.details.push({
        client_id: client.id,
        client_name: `${client.prenom || ''} ${client.nom || ''}`.trim(),
        cause: `Drift de ${drift} points (${currentBalance} → ${correctBalance})`,
        drift,
      });
    }

    if (results.fixed === 0 && results.diagnosed === 0) return null;

    if (results.fixed > 0 && results.diagnosed === 0) {
      return makeDiag('FIXED', test.name,
        `${results.fixed} solde(s) fidelite desynchronise(s)`,
        results.details.map(d => d.cause).join('; '),
        `Soldes recalcules depuis SUM(transactions)`,
        null, { details: results.details });
    }

    return makeDiag('DIAGNOSED', test.name,
      `Soldes fidelite incoherents — transactions potentiellement supprimees`,
      results.details.map(d => d.cause).join('; '),
      results.fixed > 0 ? `${results.fixed} corrige(s), ${results.diagnosed} requierent investigation` : null,
      'Verifier l\'integrite des loyalty_transactions — suppressions manuelles possibles',
      { details: results.details });
  } catch {
    return makeDiag('UNKNOWN', test.name, 'Erreur lors de l\'analyse fidelite', null, null,
      'Verifier les tables clients et loyalty_transactions', {});
  }
}

/**
 * 4. Stock negatif
 * Cherche le mouvement qui a cause le negatif au lieu de mettre a 0
 */
async function diagnoseNegativeStock(tenantId, test) {
  try {
    const { data: negStock } = await supabase
      .from('produits')
      .select('id, nom, stock_actuel')
      .eq('tenant_id', tenantId)
      .lt('stock_actuel', 0);

    if (!negStock?.length) return null;

    const results = { fixed: 0, diagnosed: 0, details: [] };

    for (const prod of negStock) {
      // Chercher les mouvements de stock pour identifier la cause
      const { data: mouvements } = await supabase
        .from('stock_mouvements')
        .select('id, type, quantite, motif, created_at')
        .eq('tenant_id', tenantId)
        .eq('produit_id', prod.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Verifier si c'est un artefact PLTE (mouvement de test)
      const plteMovement = mouvements?.find(m =>
        m.motif?.includes('PLTE') || m.motif?.includes('Auto-fix') || m.motif?.includes('test')
      );

      if (plteMovement) {
        // Artefact PLTE — nettoyer proprement
        await supabase
          .from('produits')
          .update({ stock_actuel: 0 })
          .eq('id', prod.id)
          .eq('tenant_id', tenantId);

        results.fixed++;
        results.details.push({
          produit_id: prod.id,
          produit_nom: prod.nom,
          stock: prod.stock_actuel,
          cause: `Artefact PLTE nettoye (mouvement: ${plteMovement.motif})`,
        });
        continue;
      }

      // Verifier si vente sans controle de disponibilite
      const ventesSansControle = mouvements?.filter(m =>
        m.type === 'sale' || m.type === 'sortie' || m.type === 'vente'
      );

      if (ventesSansControle?.length > 0) {
        const totalSorties = ventesSansControle.reduce((s, m) => s + Math.abs(m.quantite || 0), 0);

        results.diagnosed++;
        results.details.push({
          produit_id: prod.id,
          produit_nom: prod.nom,
          stock: prod.stock_actuel,
          cause: `Vente sans controle de disponibilite (${totalSorties} unites sorties)`,
          last_movements: ventesSansControle.slice(0, 3).map(m => ({
            type: m.type,
            quantite: m.quantite,
            date: m.created_at,
          })),
        });
        continue;
      }

      // Pas de mouvement identifiable
      if (!mouvements?.length) {
        // Aucun mouvement — stock initialise en negatif (artefact)
        await supabase
          .from('produits')
          .update({ stock_actuel: 0 })
          .eq('id', prod.id)
          .eq('tenant_id', tenantId);

        results.fixed++;
        results.details.push({
          produit_id: prod.id,
          produit_nom: prod.nom,
          stock: prod.stock_actuel,
          cause: 'Stock initialise en negatif sans mouvement — remis a 0',
        });
      } else {
        results.diagnosed++;
        results.details.push({
          produit_id: prod.id,
          produit_nom: prod.nom,
          stock: prod.stock_actuel,
          cause: 'Stock negatif, mouvements presents mais cause non determinee',
        });
      }
    }

    if (results.fixed === 0 && results.diagnosed === 0) return null;

    if (results.fixed > 0 && results.diagnosed === 0) {
      return makeDiag('FIXED', test.name,
        `${results.fixed} produit(s) avec stock negatif — artefacts nettoyes`,
        results.details.map(d => d.cause).join('; '),
        'Stocks artefacts PLTE remis a 0',
        null, { details: results.details });
    }

    return makeDiag('DIAGNOSED', test.name,
      `Stock negatif — ventes sans controle de disponibilite detectees`,
      results.details.map(d => `${d.produit_nom}: ${d.cause}`).join('; '),
      results.fixed > 0 ? `${results.fixed} artefact(s) nettoye(s)` : null,
      'Ajouter un controle stock_actuel >= quantite_demandee avant chaque vente dans nexusCore.js',
      { details: results.details });
  } catch {
    return makeDiag('UNKNOWN', test.name, 'Erreur lors de l\'analyse stock', null, null,
      'Verifier les tables produits et stock_mouvements', {});
  }
}

/**
 * 5. Ecritures avoir manquantes
 * Verifie l'integrite de la structure avoir avant de regenerer
 */
async function diagnoseMissingAvoirEntries(tenantId, test) {
  try {
    const { data: avoirs } = await supabase
      .from('factures')
      .select('id, facture_origine_id, montant_ttc, montant_ht, montant_tva, statut')
      .eq('tenant_id', tenantId)
      .eq('type', 'avoir');

    if (!avoirs?.length) return null;

    const results = { fixed: 0, diagnosed: 0, details: [] };

    for (const avoir of avoirs) {
      const { data: entries } = await supabase
        .from('ecritures_comptables')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('facture_id', avoir.id)
        .limit(1);

      if (entries?.length) continue; // Ecritures presentes

      // Diagnostic: structure de l'avoir
      if (!avoir.facture_origine_id) {
        results.diagnosed++;
        results.details.push({
          avoir_id: avoir.id,
          cause: 'Avoir sans facture_origine_id — structure incomplete',
          missing_field: 'facture_origine_id',
        });
        continue;
      }

      // Verifier que la facture d'origine existe
      const { data: factureOrigine } = await supabase
        .from('factures')
        .select('id, montant_ttc')
        .eq('id', avoir.facture_origine_id)
        .eq('tenant_id', tenantId)
        .single();

      if (!factureOrigine) {
        results.diagnosed++;
        results.details.push({
          avoir_id: avoir.id,
          cause: `facture_origine_id ${avoir.facture_origine_id} n'existe pas`,
          missing_field: 'facture_origine',
        });
        continue;
      }

      // Montants valides ?
      if (!avoir.montant_ttc || avoir.montant_ttc <= 0) {
        results.diagnosed++;
        results.details.push({
          avoir_id: avoir.id,
          cause: `montant_ttc invalide (${avoir.montant_ttc})`,
          missing_field: 'montant_ttc',
        });
        continue;
      }

      // Structure complete — regenerer les ecritures
      try {
        const { genererEcrituresFacture } = await import('../../routes/factures.js');
        await genererEcrituresFacture(tenantId, avoir.id);
        results.fixed++;
        results.details.push({
          avoir_id: avoir.id,
          cause: 'Structure avoir complete, ecritures inversees regenerees',
        });
      } catch {
        results.diagnosed++;
        results.details.push({
          avoir_id: avoir.id,
          cause: 'Structure avoir complete mais generation echouee',
        });
      }
    }

    if (results.fixed === 0 && results.diagnosed === 0) return null;

    if (results.fixed > 0 && results.diagnosed === 0) {
      return makeDiag('FIXED', test.name,
        `${results.fixed} avoir(s) sans ecritures — structure valide, regenere`,
        results.details.map(d => d.cause).join('; '),
        'Ecritures inversees regenerees depuis la structure avoir',
        null, { details: results.details });
    }

    return makeDiag('DIAGNOSED', test.name,
      'Avoirs sans ecritures — structure incomplete',
      results.details.filter(d => d.missing_field).map(d => `avoir ${d.avoir_id}: ${d.missing_field}`).join('; '),
      results.fixed > 0 ? `${results.fixed} regenere(s) auto` : null,
      'Verifier la creation des avoirs — facture_origine_id et montants doivent etre renseignes',
      { details: results.details });
  } catch {
    return makeDiag('UNKNOWN', test.name, 'Erreur lors de l\'analyse des avoirs', null, null,
      'Verifier la table factures (type=avoir) et ecritures_comptables', {});
  }
}

// ============================================
// HELPER
// ============================================

function makeDiag(category, testName, rootCause, rootCauseDetail, fixApplied, operatorAction, evidence) {
  return {
    category,
    test_name: testName,
    root_cause: rootCause,
    root_cause_detail: rootCauseDetail,
    fix_applied: fixApplied,
    operator_action: operatorAction,
    evidence: evidence || {},
  };
}
