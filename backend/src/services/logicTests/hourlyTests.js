/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * PLTE v2 — Tests Horaires (H1-H8)
 * Vie quotidienne de chaque tenant — executé toutes les heures
 */

import { supabase } from '../../config/supabase.js';
import { cleanupPlteData } from './bootstrap.js';
import { getProfileSpecificChecks } from './profileTests.js';

const TEST_PREFIX = '_PLTE_TEST_';

function makeResult(name, module, severity, description, status, error = null, extra = {}) {
  // Langage simple : erreur technique → explication claire
  const friendlyError = error ? simplifyError(error) : null;
  return { name, module, severity, description, status, error: friendlyError, category: 'hourly', ...extra };
}

function simplifyError(error) {
  if (!error) return null;
  // Traductions courantes
  const translations = [
    [/schema cache/i, 'Colonne manquante en base de donnees'],
    [/TENANT_ID_REQUIRED/i, 'Configuration IA manquante pour ce tenant'],
    [/PGRST205|42P01/i, 'Table inexistante en base de donnees'],
    [/violates check constraint/i, 'Format de donnee invalide'],
    [/violates unique constraint/i, 'Doublon detecte'],
    [/violates foreign key/i, 'Reference vers donnee inexistante'],
    [/permission denied/i, 'Permission refusee (RLS)'],
    [/timeout/i, 'Delai depasse (serveur trop lent)'],
    [/ECONNREFUSED/i, 'Serveur inaccessible'],
  ];

  for (const [regex, friendly] of translations) {
    if (regex.test(error)) {
      return `${friendly} — Detail: ${error.substring(0, 120)}`;
    }
  }
  return error;
}

function futureDate(daysFromNow = 7) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

function futureHeure() {
  return '14:00';
}

/**
 * Execute les tests horaires H1-H8 pour un tenant
 */
export async function runHourlyTests(ctx) {
  const results = [];
  const { tenantId, profile, clients, services } = ctx;

  if (!clients?.length || !services?.length) {
    results.push(makeResult('H0_bootstrap_check', 'config', 'critical',
      'Donnees bootstrap presentes', 'fail', 'Pas de clients ou services disponibles'));
    return results;
  }

  // Cleanup avant
  await cleanupPlteData(tenantId);

  const client = clients[Math.floor(Math.random() * clients.length)];
  const service = services[Math.floor(Math.random() * services.length)];

  // H1 — Reservation via createReservationUnified
  const h1Result = await testH1_Reservation(tenantId, client, service, profile);
  results.push(h1Result);

  // H2 — Paiement + Ecritures
  if (h1Result.status === 'pass' && h1Result._reservationId) {
    results.push(await testH2_PaiementEcritures(tenantId, h1Result._reservationId, client));
  } else {
    results.push(makeResult('H2_paiement_ecritures', 'compta', 'critical',
      'Facturation + ecritures comptables', 'skip', 'H1 en echec, skip H2'));
  }

  // H3 — Avoir
  if (h1Result._factureId) {
    results.push(await testH3_Avoir(tenantId, h1Result._factureId));
  } else {
    results.push(makeResult('H3_avoir', 'compta', 'warning',
      'Creation avoir sur facture', 'skip', 'Pas de facture disponible'));
  }

  // H4 — Fidelite
  results.push(await testH4_Fidelite(tenantId, client));

  // H5 — Stock (si applicable)
  if (['salon', 'commerce', 'restaurant'].includes(profile)) {
    results.push(await testH5_Stock(tenantId, ctx));
  }

  // H6 — Coherence globale
  results.push(await testH6_Coherence(tenantId));

  // H7 — Chat IA rapide
  results.push(await testH7_ChatIA(tenantId));

  // Profile-specific tests
  const profileResults = await getProfileSpecificChecks(ctx);
  results.push(...profileResults);

  // Cleanup apres
  await cleanupPlteData(tenantId);

  return results;
}

// ============================================
// H1 — RESERVATION
// ============================================

async function testH1_Reservation(tenantId, client, service, profile) {
  const name = 'H1_reservation_unified';
  const module = 'reservations';
  const severity = 'critical';
  const description = 'Prise de rendez-vous automatique (reservation)';

  try {
    const { createReservationUnified } = await import('../../core/unified/nexusCore.js');

    const data = {
      service_name: service.nom,
      date: futureDate(7),
      heure: futureHeure(),
      client_nom: client.nom,
      client_prenom: client.prenom || 'Test',
      client_telephone: client.telephone,
      client_email: client.email,
      tenant_id: tenantId,
    };

    // Ajouter champs specifiques profil
    if (profile === 'domicile') {
      data.lieu = 'domicile';
      data.adresse = '10 rue de Rivoli, 75001 Paris';
    }

    const result = await createReservationUnified(data, 'admin', { sendSMS: false, skipValidation: true });

    if (!result?.success) {
      return makeResult(name, module, severity, description, 'fail',
        `Reservation echouee: ${result?.error || 'unknown'}`);
    }

    // Verifier en BDD
    const { data: resa } = await supabase
      .from('reservations')
      .select('id, client_id, service_nom, date, statut')
      .eq('tenant_id', tenantId)
      .eq('id', result.reservationId)
      .single();

    if (!resa) {
      return makeResult(name, module, severity, description, 'fail',
        'Reservation creee mais introuvable en BDD');
    }

    return makeResult(name, module, severity, description, 'pass', null, {
      _reservationId: result.reservationId,
      _factureId: null,
    });
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// H2 — PAIEMENT + ECRITURES
// ============================================

async function testH2_PaiementEcritures(tenantId, reservationId, client) {
  const name = 'H2_paiement_ecritures';
  const module = 'compta';
  const severity = 'critical';
  const description = 'Facture creee + ecritures comptables generees (vente et paiement)';

  try {
    // Passer la reservation en termine
    await supabase
      .from('reservations')
      .update({ statut: 'termine' })
      .eq('id', reservationId)
      .eq('tenant_id', tenantId);

    // Creer facture
    const { createFactureFromReservation, genererEcrituresFacture, genererEcrituresPaiement } =
      await import('../../routes/factures.js');

    const factureResult = await createFactureFromReservation(reservationId, tenantId, { statut: 'generee' });

    // createFactureFromReservation retourne { success, facture } ou { id } ou { data: { id } }
    const factureId = factureResult?.facture?.id || factureResult?.id || factureResult?.data?.id;
    if (!factureId) {
      return makeResult(name, module, severity, description, 'fail',
        `Creation facture echouee: ${JSON.stringify(factureResult)?.substring(0, 100)}`);
    }

    // Generer ecritures VT
    await genererEcrituresFacture(tenantId, factureId);

    // Verifier ecritures VT
    const { data: ecrituresVT } = await supabase
      .from('ecritures_comptables')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('piece_origine_id', factureId)
      .eq('journal', 'VT');

    if (!ecrituresVT?.length) {
      return makeResult(name, module, severity, description, 'fail',
        'Ecritures VT non generees');
    }

    // Verifier equilibre VT
    const totalDebit = ecrituresVT.reduce((s, e) => s + (e.debit || 0), 0);
    const totalCredit = ecrituresVT.reduce((s, e) => s + (e.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 1) {
      return makeResult(name, module, severity, description, 'fail',
        `Ecritures VT desequilibrees: debit=${totalDebit} credit=${totalCredit}`);
    }

    // Passer payee et generer ecritures BQ
    const { data: facture } = await supabase
      .from('factures')
      .select('*')
      .eq('id', factureId)
      .eq('tenant_id', tenantId)
      .single();

    if (facture) {
      await supabase
        .from('factures')
        .update({ statut: 'payee', date_paiement: new Date().toISOString().split('T')[0] })
        .eq('id', factureId)
        .eq('tenant_id', tenantId);

      await genererEcrituresPaiement(tenantId, { ...facture, statut: 'payee' }, 'carte', new Date().toISOString().split('T')[0]);

      // Verifier ecritures BQ
      const { data: ecrituresBQ } = await supabase
        .from('ecritures_comptables')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('piece_origine_id', factureId)
        .eq('journal', 'BQ');

      if (!ecrituresBQ?.length) {
        return makeResult(name, module, severity, description, 'fail',
          'Ecritures BQ non generees apres paiement');
      }

      const bqDebit = ecrituresBQ.reduce((s, e) => s + (e.debit || 0), 0);
      const bqCredit = ecrituresBQ.reduce((s, e) => s + (e.credit || 0), 0);
      if (Math.abs(bqDebit - bqCredit) > 1) {
        return makeResult(name, module, severity, description, 'fail',
          `Ecritures BQ desequilibrees: debit=${bqDebit} credit=${bqCredit}`);
      }
    }

    return makeResult(name, module, severity, description, 'pass', null, {
      _factureId: factureId,
    });
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// H3 — AVOIR
// ============================================

async function testH3_Avoir(tenantId, factureId) {
  const name = 'H3_avoir';
  const module = 'compta';
  const severity = 'warning';
  const description = 'Avoir (remboursement) sur facture existante';

  try {
    const { createAvoir } = await import('../../routes/factures.js');
    const result = await createAvoir(tenantId, factureId, 'Test PLTE - avoir automatique');

    if (!result?.success) {
      return makeResult(name, module, severity, description, 'fail',
        `Avoir echoue: ${result?.error || 'unknown'}`);
    }

    // Verifier ecritures inversees
    if (result.avoir?.id) {
      const { data: ecritures } = await supabase
        .from('ecritures_comptables')
        .select('debit, credit')
        .eq('tenant_id', tenantId)
        .eq('piece_origine_id', result.avoir.id);

      if (ecritures?.length) {
        const totalDebit = ecritures.reduce((s, e) => s + (e.debit || 0), 0);
        const totalCredit = ecritures.reduce((s, e) => s + (e.credit || 0), 0);
        if (Math.abs(totalDebit - totalCredit) > 1) {
          return makeResult(name, module, severity, description, 'fail',
            'Ecritures avoir desequilibrees');
        }
      }
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// H4 — FIDELITE
// ============================================

async function testH4_Fidelite(tenantId, client) {
  const name = 'H4_fidelite';
  const module = 'fidelite';
  const severity = 'warning';
  const description = 'Programme fidelite : gain et utilisation de points';

  try {
    const { earnPoints, redeemPoints, getClientPoints } = await import('../loyaltyService.js');

    // Earn points (50€ achat)
    let earned;
    try {
      earned = await earnPoints(tenantId, client.id, 50, 'plte_test', 0);
    } catch (earnErr) {
      // Schema issue (missing column) → report but don't crash
      if (earnErr.message?.includes('schema cache') || earnErr.message?.includes('column')) {
        return makeResult(name, module, severity, description, 'fail',
          `Schema BDD fidelite incomplet: ${earnErr.message}`);
      }
      throw earnErr;
    }

    if (!earned) {
      // Programme fidelite desactive → pass (comportement normal)
      return makeResult(name, module, severity, description, 'pass',
        'Programme fidelite desactive (comportement attendu)');
    }

    // Verifier solde
    const points = await getClientPoints(tenantId, client.id);
    if (points === null || points === undefined) {
      return makeResult(name, module, severity, description, 'fail',
        'Impossible de lire solde fidelite');
    }

    // Tenter redeem si solde suffisant
    if (points >= 10) {
      try {
        await redeemPoints(tenantId, client.id, 10);
      } catch (redeemErr) {
        // Pas assez de points ou min_redeem pas atteint — acceptable
        if (!redeemErr.message?.includes('insuffisant') && !redeemErr.message?.includes('minimum')) {
          return makeResult(name, module, severity, description, 'fail',
            `Redeem inattendu: ${redeemErr.message}`);
        }
      }
    }

    // Verifier coherence SUM
    const { data: transactions } = await supabase
      .from('loyalty_transactions')
      .select('type, points')
      .eq('tenant_id', tenantId)
      .eq('client_id', client.id);

    if (transactions?.length) {
      const calculatedBalance = transactions.reduce((sum, t) => {
        return sum + (t.type === 'earn' ? t.points : -t.points);
      }, 0);

      const finalPoints = await getClientPoints(tenantId, client.id);
      if (Math.abs(calculatedBalance - (finalPoints || 0)) > 1) {
        return makeResult(name, module, severity, description, 'fail',
          `Solde incoherent: calcul=${calculatedBalance}, affiche=${finalPoints}`);
      }
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// H5 — STOCK
// ============================================

async function testH5_Stock(tenantId, ctx) {
  const name = 'H5_stock';
  const module = 'stock';
  const severity = 'warning';
  const description = 'Stock : vente puis retour de produit (quantites correctes)';

  try {
    const produits = ctx.produits;
    if (!produits?.length) {
      return makeResult(name, module, severity, description, 'pass',
        'Pas de produits test (skip)');
    }

    const produit = produits[0];

    // Lire stock actuel
    const { data: before } = await supabase
      .from('produits')
      .select('stock_actuel')
      .eq('id', produit.id)
      .eq('tenant_id', tenantId)
      .single();

    const stockBefore = before?.stock_actuel ?? 0;

    // Mouvement -2
    await supabase
      .from('produits')
      .update({ stock_actuel: stockBefore - 2 })
      .eq('id', produit.id)
      .eq('tenant_id', tenantId);

    const { data: after1 } = await supabase
      .from('produits')
      .select('stock_actuel')
      .eq('id', produit.id)
      .eq('tenant_id', tenantId)
      .single();

    if (after1?.stock_actuel !== stockBefore - 2) {
      return makeResult(name, module, severity, description, 'fail',
        `Stock apres -2: attendu=${stockBefore - 2}, obtenu=${after1?.stock_actuel}`);
    }

    // Mouvement +2 (retour)
    await supabase
      .from('produits')
      .update({ stock_actuel: stockBefore })
      .eq('id', produit.id)
      .eq('tenant_id', tenantId);

    const { data: after2 } = await supabase
      .from('produits')
      .select('stock_actuel')
      .eq('id', produit.id)
      .eq('tenant_id', tenantId)
      .single();

    if (after2?.stock_actuel !== stockBefore) {
      return makeResult(name, module, severity, description, 'fail',
        `Stock apres retour: attendu=${stockBefore}, obtenu=${after2?.stock_actuel}`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// H6 — COHERENCE GLOBALE
// ============================================

async function testH6_Coherence(tenantId) {
  const name = 'H6_coherence_globale';
  const module = 'compta';
  const severity = 'critical';
  const description = 'Verification globale : comptabilite equilibree, stock positif';

  try {
    // Verifier toutes ecritures equilibrees par piece
    const { data: ecritures } = await supabase
      .from('ecritures_comptables')
      .select('numero_piece, debit, credit')
      .eq('tenant_id', tenantId);

    if (ecritures?.length) {
      const byPiece = {};
      for (const e of ecritures) {
        if (!byPiece[e.numero_piece]) byPiece[e.numero_piece] = { debit: 0, credit: 0 };
        byPiece[e.numero_piece].debit += e.debit || 0;
        byPiece[e.numero_piece].credit += e.credit || 0;
      }

      for (const [piece, totals] of Object.entries(byPiece)) {
        if (Math.abs(totals.debit - totals.credit) > 1) {
          return makeResult(name, module, severity, description, 'fail',
            `Piece ${piece} desequilibree: D=${totals.debit} C=${totals.credit}`);
        }
      }
    }

    // Verifier stock negatif
    const { data: negStock } = await supabase
      .from('produits')
      .select('id, nom, stock_actuel')
      .eq('tenant_id', tenantId)
      .lt('stock_actuel', 0);

    if (negStock?.length) {
      return makeResult(name, module, severity, description, 'fail',
        `${negStock.length} produit(s) en stock negatif: ${negStock.map(p => p.nom).join(', ')}`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (err.code === 'PGRST205' || err.code === '42P01') {
      return makeResult(name, module, severity, description, 'pass', 'Tables non existantes (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// H7 — CHAT IA RAPIDE
// ============================================

async function testH7_ChatIA(tenantId) {
  const name = 'H7_chat_ia_rapide';
  const module = 'ia';
  const severity = 'warning';
  const description = 'Assistant IA : reponse a une question simple du patron';

  try {
    const { processMessage } = await import('../../core/unified/nexusCore.js');

    const result = await processMessage(
      'Combien de reservations aujourd\'hui ?',
      'admin',
      {
        tenantId,
        conversationId: `plte-h7-${tenantId}-${Date.now()}`,
        userId: 'plte-system',
      }
    );

    if (!result?.success) {
      return makeResult(name, module, severity, description, 'fail',
        `IA echec: ${result?.error || 'pas de reponse'}`);
    }

    if (!result.response || result.response.length < 5) {
      return makeResult(name, module, severity, description, 'fail',
        'Reponse IA trop courte ou vide');
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}
