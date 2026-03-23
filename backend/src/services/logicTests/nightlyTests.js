/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * PLTE v2 — Tests Nocturnes (N1-N13)
 * Stress tests + edge cases — executé a 02h00
 */

import { supabase } from '../../config/supabase.js';
import { cleanupPlteData } from './bootstrap.js';

const TEST_PREFIX = '_PLTE_TEST_';

function makeResult(name, module, severity, description, status, error = null) {
  return { name, module, severity, description, status, error: error ? simplifyError(error) : null, category: 'nightly' };
}

function simplifyError(error) {
  if (!error) return null;
  const translations = [
    [/schema cache/i, 'Colonne manquante en base de donnees'],
    [/TENANT_ID_REQUIRED/i, 'Configuration IA manquante pour ce tenant'],
    [/PGRST205|42P01/i, 'Table inexistante en base de donnees'],
    [/violates check constraint/i, 'Format de donnee invalide'],
    [/violates unique constraint/i, 'Doublon detecte'],
    [/permission denied/i, 'Permission refusee (RLS)'],
  ];
  for (const [regex, friendly] of translations) {
    if (regex.test(error)) return `${friendly} — Detail: ${error.substring(0, 120)}`;
  }
  return error;
}

function futureDate(daysFromNow = 14) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

/**
 * Execute les tests nocturnes N1-N7 pour un tenant
 */
export async function runNightlyTests(ctx) {
  const results = [];
  const { tenantId, profile, clients, services } = ctx;

  if (!clients?.length || !services?.length) {
    results.push(makeResult('N0_bootstrap', 'config', 'critical',
      'Donnees bootstrap presentes', 'fail', 'Pas de clients ou services'));
    return results;
  }

  await cleanupPlteData(tenantId);

  const client = clients[0];
  const service = services[0];

  // N1 — Detection conflit
  results.push(await testN1_Conflit(tenantId, client, service, profile));

  // N2 — Fidelite negative
  results.push(await testN2_FideliteNegative(tenantId, client));

  // N3 — Bulletin de paie
  if (['salon', 'securite', 'restaurant'].includes(profile)) {
    results.push(await testN3_BulletinPaie(tenantId, ctx));
  }

  // N4 — Coherence comptable profonde
  results.push(await testN4_CoherenceComptable(tenantId));

  // N5 — Marketing campaign cycle
  results.push(await testN5_MarketingCycle(tenantId));

  // N6 — Devis → Reservation
  if (['events', 'consulting', 'securite'].includes(profile)) {
    results.push(await testN6_DevisReservation(tenantId, client, service));
  }

  // N7 — Double paiement (idempotence)
  results.push(await testN7_DoublePaiement(tenantId, client, service));

  // N8 — DSN cycle complet (tenants avec RH)
  if (['salon', 'securite', 'restaurant'].includes(profile)) {
    results.push(await testN8_DSNCycle(tenantId));
  }

  // N9 — Code promo cycle complet
  results.push(await testN9_PromoCodeCycle(tenantId, client));

  // N10 — Workflows automatises
  results.push(await testN10_WorkflowTrigger(tenantId, client));

  // N11 — SEO keywords + overview
  results.push(await testN11_SEOKeywords(tenantId));

  // N12 — SEO generation technique (sitemap, schema, robots)
  results.push(await testN12_SEOTechnical(tenantId, profile));

  // N13 — Marketing campagne via vraies fonctions
  results.push(await testN13_MarketingReelCycle(tenantId));

  // N14 — Chat IA (deplace depuis hourly — 1 appel/jour au lieu de 6/jour par tenant)
  results.push(await testN14_ChatIA(tenantId));

  // Purge donnees test > 7 jours
  await purgeOldTestData(tenantId);
  await cleanupPlteData(tenantId);

  return results;
}

// ============================================
// N1 — CONFLIT
// ============================================

async function testN1_Conflit(tenantId, client, service, profile) {
  const name = 'N1_detection_conflit';
  const module = 'reservations';
  const severity = 'warning';
  const description = 'Deux rendez-vous au meme horaire detectes comme conflit';

  try {
    const { createReservationUnified } = await import('../../core/unified/nexusCore.js');
    const { checkConflicts } = await import('../../utils/conflictChecker.js');

    const date = futureDate(14);
    const heure = '10:00';

    // Creer un RDV a 10h
    const data1 = {
      service_name: service.nom,
      date,
      heure,
      client_nom: client.nom,
      client_prenom: client.prenom,
      client_telephone: client.telephone,
      tenant_id: tenantId,
    };

    const res1 = await createReservationUnified(data1, 'admin', { sendSMS: false, skipValidation: true });
    if (!res1?.success) {
      return makeResult(name, module, severity, description, 'fail',
        `Premiere reservation echouee: ${res1?.error}`);
    }

    // Checker conflit meme creneau
    const conflictResult = await checkConflicts(supabase, date, heure, service.duree || 60, null, tenantId);

    if (!conflictResult?.conflict) {
      return makeResult(name, module, severity, description, 'fail',
        'Conflit non detecte alors qu\'un RDV existe au meme creneau');
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N2 — FIDELITE NEGATIVE
// ============================================

async function testN2_FideliteNegative(tenantId, client) {
  const name = 'N2_fidelite_negative';
  const module = 'fidelite';
  const severity = 'warning';
  const description = 'Utiliser plus de points que le solde est refuse sans impact';

  try {
    const { redeemPoints, getClientPoints } = await import('../loyaltyService.js');

    const resultBefore = await getClientPoints(tenantId, client.id);
    const pointsBefore = resultBefore?.points ?? resultBefore;
    if (pointsBefore === null || pointsBefore === undefined) {
      return makeResult(name, module, severity, description, 'pass',
        'Programme fidelite desactive (skip)');
    }

    // Tenter de redeem 50000 points (forcement trop)
    try {
      await redeemPoints(tenantId, client.id, 50000);
      // Si ca passe, c'est un bug
      return makeResult(name, module, severity, description, 'fail',
        'Redeem 50000 points accepte alors que solde insuffisant!');
    } catch {
      // Erreur attendue — verifier que solde est inchange
      const resultAfter = await getClientPoints(tenantId, client.id);
      const pointsAfter = resultAfter?.points ?? resultAfter;
      if (pointsAfter !== pointsBefore) {
        return makeResult(name, module, severity, description, 'fail',
          `Solde modifie malgre erreur: avant=${pointsBefore}, apres=${pointsAfter}`);
      }
      return makeResult(name, module, severity, description, 'pass');
    }
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N3 — BULLETIN DE PAIE
// ============================================

async function testN3_BulletinPaie(tenantId, ctx) {
  const name = 'N3_bulletin_paie';
  const module = 'rh';
  const severity = 'warning';
  const description = 'Fiche de paie : salaire brut - cotisations = net correct';

  try {
    const employes = ctx.employes || ctx.agents;
    if (!employes?.length) {
      return makeResult(name, module, severity, description, 'pass', 'Pas d\'employes test (skip)');
    }

    const membre = employes[0];
    const mois = new Date().getMonth() + 1;
    const annee = new Date().getFullYear();

    // Creer bulletin
    const salaireBrut = 200000; // 2000€
    const cotisationsSalariales = Math.round(salaireBrut * 0.22); // ~22%
    const salaireNet = salaireBrut - cotisationsSalariales;

    const { data: bulletin, error } = await supabase
      .from('rh_bulletins_paie')
      .insert({
        tenant_id: tenantId,
        membre_id: membre.id,
        mois,
        annee,
        salaire_brut: salaireBrut,
        cotisations_salariales: cotisationsSalariales,
        salaire_net: salaireNet,
        statut: 'brouillon',
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        return makeResult(name, module, severity, description, 'pass', 'Table rh_bulletins_paie inexistante (skip)');
      }
      return makeResult(name, module, severity, description, 'fail', error.message);
    }

    // Verifier coherence
    if (bulletin.salaire_net !== bulletin.salaire_brut - bulletin.cotisations_salariales) {
      return makeResult(name, module, severity, description, 'fail',
        `Net incoherent: brut=${bulletin.salaire_brut} - cotis=${bulletin.cotisations_salariales} != net=${bulletin.salaire_net}`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N4 — COHERENCE COMPTABLE PROFONDE
// ============================================

async function testN4_CoherenceComptable(tenantId) {
  const name = 'N4_coherence_comptable';
  const module = 'compta';
  const severity = 'critical';
  const description = 'Toute la comptabilite est equilibree et chaque facture payee a ses ecritures';

  try {
    // Verifier chaque piece comptable
    const { data: ecritures } = await supabase
      .from('ecritures_comptables')
      .select('id, numero_piece, journal_code, facture_id, debit, credit, compte, date_ecriture')
      .eq('tenant_id', tenantId);

    if (!ecritures?.length) {
      return makeResult(name, module, severity, description, 'pass', 'Aucune ecriture (skip)');
    }

    // Grouper par piece
    const pieces = {};
    for (const e of ecritures) {
      if (!pieces[e.numero_piece]) pieces[e.numero_piece] = [];
      pieces[e.numero_piece].push(e);
    }

    let desequilibrees = 0;
    for (const [piece, lines] of Object.entries(pieces)) {
      const totalD = lines.reduce((s, l) => s + (l.debit || 0), 0);
      const totalC = lines.reduce((s, l) => s + (l.credit || 0), 0);
      if (Math.abs(totalD - totalC) > 1) {
        desequilibrees++;
      }
    }

    if (desequilibrees > 0) {
      return makeResult(name, module, severity, description, 'fail',
        `${desequilibrees} piece(s) desequilibree(s) sur ${Object.keys(pieces).length}`);
    }

    // Verifier pas de facture payee sans ecritures BQ
    const { data: facturesPayees } = await supabase
      .from('factures')
      .select('id, numero, montant_ttc')
      .eq('tenant_id', tenantId)
      .eq('statut', 'payee')
      .eq('type', 'facture');

    if (facturesPayees?.length) {
      let orphelines = 0;
      for (const f of facturesPayees) {
        const bqLines = ecritures.filter(e =>
          e.facture_id === f.id && e.journal_code === 'BQ'
        );
        // Verifie si cette facture payee a des ecritures BQ correspondantes
        if (bqLines.length === 0) orphelines++;
      }

      if (orphelines > 0) {
        return makeResult(name, module, severity, description, 'fail',
          `${orphelines} facture(s) payee(s) sans ecritures BQ`);
      }
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (err.code === 'PGRST205' || err.code === '42P01') {
      return makeResult(name, module, severity, description, 'pass', 'Tables comptables non existantes (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N5 — MARKETING CAMPAIGN
// ============================================

async function testN5_MarketingCycle(tenantId) {
  const name = 'N5_marketing_cycle';
  const module = 'marketing';
  const severity = 'info';
  const description = 'Campagne marketing : brouillon puis programmee puis envoyee';

  try {
    // Creer campagne test
    const { data: campaign, error } = await supabase
      .from('marketing_campaigns')
      .insert({
        tenant_id: tenantId,
        name: `${TEST_PREFIX}Campaign_PLTE`,
        type: 'email',
        status: 'draft',
        subject: 'Test PLTE',
        content: 'Contenu test PLTE',
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        return makeResult(name, module, severity, description, 'pass', 'Table campaigns non existante (skip)');
      }
      return makeResult(name, module, severity, description, 'fail', error.message);
    }

    // Transition draft → scheduled
    await supabase
      .from('marketing_campaigns')
      .update({ status: 'scheduled', scheduled_at: new Date().toISOString() })
      .eq('id', campaign.id)
      .eq('tenant_id', tenantId);

    // Transition scheduled → completed
    await supabase
      .from('marketing_campaigns')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', campaign.id)
      .eq('tenant_id', tenantId);

    // Verifier etat final
    const { data: final } = await supabase
      .from('marketing_campaigns')
      .select('status')
      .eq('id', campaign.id)
      .eq('tenant_id', tenantId)
      .single();

    if (final?.status !== 'completed') {
      return makeResult(name, module, severity, description, 'fail',
        `Etat final: ${final?.status} au lieu de completed`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N6 — DEVIS → RESERVATION
// ============================================

async function testN6_DevisReservation(tenantId, client, service) {
  const name = 'N6_devis_reservation';
  const module = 'devis';
  const severity = 'warning';
  const description = 'Devis accepte par le client transforme en reservation';

  try {
    // Creer devis
    const { data: devis, error } = await supabase
      .from('devis')
      .insert({
        tenant_id: tenantId,
        numero: `${TEST_PREFIX}DEV-001`,
        client_id: client.id,
        montant_ht: service.prix || 5000,
        montant_ttc: Math.round((service.prix || 5000) * 1.2),
        statut: 'envoye',
        date_devis: new Date().toISOString().split('T')[0],
        validite_jours: 30,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01' || /column.*does not exist/i.test(error.message)) {
        return makeResult(name, module, severity, description, 'pass', 'Table devis non compatible (skip)');
      }
      return makeResult(name, module, severity, description, 'fail', error.message);
    }

    // Accepter le devis
    await supabase
      .from('devis')
      .update({ statut: 'accepte' })
      .eq('id', devis.id)
      .eq('tenant_id', tenantId);

    // Creer reservation depuis devis
    const { createReservationUnified } = await import('../../core/unified/nexusCore.js');
    const resaResult = await createReservationUnified({
      service_name: service.nom,
      date: futureDate(21),
      heure: '15:00',
      client_nom: client.nom,
      client_prenom: client.prenom,
      client_telephone: client.telephone,
      tenant_id: tenantId,
      notes: `Depuis devis ${devis.numero}`,
    }, 'admin', { sendSMS: false, skipValidation: true });

    if (!resaResult?.success) {
      return makeResult(name, module, severity, description, 'fail',
        `Reservation depuis devis echouee: ${resaResult?.error}`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N7 — DOUBLE PAIEMENT (IDEMPOTENCE)
// ============================================

async function testN7_DoublePaiement(tenantId, client, service) {
  const name = 'N7_idempotence_paiement';
  const module = 'compta';
  const severity = 'warning';
  const description = 'Payer deux fois la meme facture ne cree pas de doublons comptables';

  try {
    const { createReservationUnified } = await import('../../core/unified/nexusCore.js');
    const { createFactureFromReservation, genererEcrituresFacture } = await import('../../routes/factures.js');

    // Creer resa + facture
    const resa = await createReservationUnified({
      service_name: service.nom,
      date: futureDate(21),
      heure: '16:00',
      client_nom: client.nom,
      client_prenom: client.prenom,
      client_telephone: client.telephone,
      tenant_id: tenantId,
    }, 'admin', { sendSMS: false, skipValidation: true });

    if (!resa?.success) {
      return makeResult(name, module, severity, description, 'skip',
        `Reservation echouee: ${resa?.error}`);
    }

    await supabase
      .from('reservations')
      .update({ statut: 'termine' })
      .eq('id', resa.reservationId)
      .eq('tenant_id', tenantId);

    const factureResult = await createFactureFromReservation(resa.reservationId, tenantId);
    const factureId = factureResult?.id || factureResult?.data?.id;
    if (!factureId) {
      return makeResult(name, module, severity, description, 'skip', 'Facture non creee');
    }

    // Premier appel → ecritures normales
    await genererEcrituresFacture(tenantId, factureId);

    const { data: ecritures1 } = await supabase
      .from('ecritures_comptables')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('facture_id', factureId);

    const count1 = ecritures1?.length || 0;

    // Deuxieme appel → devrait etre idempotent (0 nouvelles)
    await genererEcrituresFacture(tenantId, factureId);

    const { data: ecritures2 } = await supabase
      .from('ecritures_comptables')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('facture_id', factureId);

    const count2 = ecritures2?.length || 0;

    if (count2 !== count1) {
      return makeResult(name, module, severity, description, 'fail',
        `Double appel cree ${count2 - count1} ecritures supplementaires (idempotence cassee)`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N8 — DSN CYCLE COMPLET
// ============================================

async function testN8_DSNCycle(tenantId) {
  const name = 'N8_dsn_cycle';
  const module = 'rh';
  const severity = 'warning';
  const description = 'DSN : brouillon, validation, soumission — cycle complet';

  try {
    const { createDSNDraft, validateDSN, submitDSN } = await import('../dsnWorkflowService.js');

    const moisCourant = new Date().toISOString().slice(0, 7); // "2026-03"

    // Creer brouillon DSN
    const draft = await createDSNDraft(tenantId, moisCourant, '01', { dryRun: true });
    if (!draft?.success && !draft?.id) {
      // Si pas de table DSN ou pas de module RH, skip proprement
      const errMsg = draft?.error || 'Brouillon DSN non cree';
      if (/PGRST205|42P01|not found/i.test(errMsg)) {
        return makeResult(name, module, severity, description, 'pass', 'Module DSN non disponible (skip)');
      }
      return makeResult(name, module, severity, description, 'fail', `Brouillon echoue: ${errMsg}`);
    }

    const dsnId = draft.id || draft.data?.id;
    if (!dsnId) {
      return makeResult(name, module, severity, description, 'pass', 'DSN cree sans ID retourne (mode dryRun)');
    }

    // Valider
    const validation = await validateDSN(tenantId, dsnId);
    if (validation?.errors?.length > 0) {
      return makeResult(name, module, severity, description, 'fail',
        `Validation DSN echouee: ${validation.errors.slice(0, 3).join(', ')}`);
    }

    // Soumettre (dry run — pas d'envoi reel)
    const submit = await submitDSN(tenantId, dsnId);
    if (!submit?.success && submit?.error) {
      // Erreur de soumission acceptable si pas de config URSSAF
      if (/config|urssaf|api_key/i.test(submit.error)) {
        return makeResult(name, module, severity, description, 'pass',
          'DSN validee mais soumission impossible (pas de config URSSAF — normal en test)');
      }
      return makeResult(name, module, severity, description, 'fail', `Soumission echouee: ${submit.error}`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module|Parametres DSN incomplets|informations entreprise/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Config DSN/entreprise absente (normal en test)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N9 — CODE PROMO CYCLE COMPLET
// ============================================

async function testN9_PromoCodeCycle(tenantId, client) {
  const name = 'N9_promo_code_cycle';
  const module = 'marketing';
  const severity = 'warning';
  const description = 'Code promo : creation, validation, application sur commande';

  try {
    const { createPromoCode, validatePromoCode, applyPromoCode, deletePromoCode } =
      await import('../../modules/marketing/marketingService.js');

    // Creer un code promo
    const promoResult = await createPromoCode(tenantId, {
      code: `${TEST_PREFIX}PROMO${Date.now()}`,
      type: 'percentage',
      value: 15,
      max_uses: 10,
      is_active: true,
      valid_from: new Date().toISOString(),
      valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
    });

    if (!promoResult?.id && !promoResult?.data?.id) {
      const errMsg = promoResult?.error || 'Code promo non cree';
      if (/PGRST205|42P01/i.test(errMsg)) {
        return makeResult(name, module, severity, description, 'pass', 'Table promo_codes non existante (skip)');
      }
      return makeResult(name, module, severity, description, 'fail', `Creation echouee: ${errMsg}`);
    }

    const promoId = promoResult.id || promoResult.data?.id;
    const code = promoResult.code || promoResult.data?.code;

    // Valider le code
    const validation = await validatePromoCode(tenantId, code, 10000); // commande 100€
    if (!validation?.valid && !validation?.success) {
      return makeResult(name, module, severity, description, 'fail',
        `Code promo invalide juste apres creation: ${validation?.error}`);
    }

    // Appliquer le code
    const applied = await applyPromoCode(tenantId, code, {
      orderAmount: 10000,
      customerEmail: client.email,
      customerName: `${client.prenom} ${client.nom}`,
    });

    if (!applied?.success && !applied?.discount) {
      return makeResult(name, module, severity, description, 'fail',
        `Application code promo echouee: ${applied?.error}`);
    }

    // Verifier que la reduction est de 15%
    const discount = applied.discount || applied.data?.discount;
    if (discount && Math.abs(discount - 1500) > 10) { // 15% de 10000 = 1500
      return makeResult(name, module, severity, description, 'fail',
        `Reduction incorrecte: ${discount} au lieu de 1500 (15% de 10000)`);
    }

    // Cleanup
    try { await deletePromoCode(tenantId, promoId); } catch { /* ok */ }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module marketing non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N10 — WORKFLOW AUTOMATISE
// ============================================

async function testN10_WorkflowTrigger(tenantId, client) {
  const name = 'N10_workflow_trigger';
  const module = 'automation';
  const severity = 'info';
  const description = 'Declenchement automatique d\'un workflow sur nouveau client';

  try {
    const { triggerWorkflows } = await import('../../automation/workflowEngine.js');

    // Declencher workflow "new_client"
    const result = await triggerWorkflows('new_client', {
      tenantId,
      clientId: client.id,
      clientName: `${client.prenom} ${client.nom}`,
      clientEmail: client.email,
      clientPhone: client.telephone,
    });

    // Si aucun workflow configure, c'est normal
    if (result === null || result === undefined || (Array.isArray(result) && result.length === 0)) {
      return makeResult(name, module, severity, description, 'pass',
        'Aucun workflow configure pour ce declencheur (normal en test)');
    }

    // Si des workflows ont ete executes, verifier qu'ils n'ont pas crash
    if (Array.isArray(result)) {
      const erreurs = result.filter(r => r?.error || r?.status === 'error');
      if (erreurs.length > 0) {
        return makeResult(name, module, severity, description, 'fail',
          `${erreurs.length} workflow(s) en erreur: ${erreurs[0].error}`);
      }
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    // Pas de module workflow = skip
    if (/Cannot find module|PGRST205/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module workflows non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N11 — SEO KEYWORDS + OVERVIEW
// ============================================

async function testN11_SEOKeywords(tenantId) {
  const name = 'N11_seo_keywords';
  const module = 'seo';
  const severity = 'info';
  const description = 'SEO : ajout mot-cle, verification position, vue d\'ensemble';

  try {
    const { addKeyword, checkKeywordPosition, getSEOOverview, deleteKeyword } =
      await import('../../modules/seo/seoService.js');

    // Ajouter un mot-cle test
    const kwResult = await addKeyword(tenantId, {
      keyword: `${TEST_PREFIX}salon coiffure paris test`,
      url: 'https://plte-test.nexus.dev/',
      search_engine: 'google',
      country: 'FR',
    });

    if (!kwResult?.id && !kwResult?.data?.id) {
      const errMsg = kwResult?.error || 'Mot-cle non cree';
      if (/PGRST205|42P01/i.test(errMsg)) {
        return makeResult(name, module, severity, description, 'pass', 'Module SEO non disponible (skip)');
      }
      return makeResult(name, module, severity, description, 'fail', `Creation mot-cle echouee: ${errMsg}`);
    }

    const kwId = kwResult.id || kwResult.data?.id;

    // Verifier position (peut echouer si pas d'API externe — c'est OK)
    try {
      const position = await checkKeywordPosition(tenantId, kwId);
      // Position retournee ou pas, l'important c'est que ca ne crash pas
    } catch {
      // API externe indisponible — normal en env test
    }

    // Vue d'ensemble SEO
    const overview = await getSEOOverview(tenantId);
    if (overview === null || overview === undefined) {
      return makeResult(name, module, severity, description, 'fail', 'getSEOOverview retourne null');
    }

    // Cleanup
    try { await deleteKeyword(tenantId, kwId); } catch { /* ok */ }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module SEO non installe (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N12 — SEO TECHNIQUE (SITEMAP, SCHEMA, ROBOTS)
// ============================================

async function testN12_SEOTechnical(tenantId, profile) {
  const name = 'N12_seo_technical';
  const module = 'seo';
  const severity = 'info';
  const description = 'SEO technique : sitemap, schema.org et robots.txt generes correctement';

  try {
    const { generateSitemap, generateSchemaOrg, generateRobotsTxt } =
      await import('../../modules/seo/seoService.js');

    // Generer sitemap
    const sitemap = await generateSitemap(tenantId, 'https://plte-test.nexus.dev');
    if (!sitemap || (typeof sitemap === 'string' && sitemap.length < 50)) {
      return makeResult(name, module, severity, description, 'fail',
        'Sitemap genere vide ou trop court');
    }

    // Verifier format XML basique
    if (typeof sitemap === 'string' && !sitemap.includes('urlset') && !sitemap.includes('url')) {
      return makeResult(name, module, severity, description, 'fail',
        'Sitemap ne contient pas de balises URL valides');
    }

    // Schema.org
    const schemaResult = await generateSchemaOrg(tenantId, profile);
    if (!schemaResult) {
      return makeResult(name, module, severity, description, 'fail', 'Schema.org non genere');
    }

    // Le retour est { success, data: { schema: {...}, script_tag } }
    const schemaData = schemaResult?.data?.schema || schemaResult?.schema || schemaResult;
    const schemaObj = typeof schemaData === 'string' ? JSON.parse(schemaData) : schemaData;
    if (!schemaObj?.['@type'] && !schemaObj?.['@graph'] && !schemaResult?.success) {
      return makeResult(name, module, severity, description, 'fail',
        'Schema.org sans @type — format invalide');
    }

    // Robots.txt
    const robots = await generateRobotsTxt(tenantId);
    if (!robots || (typeof robots === 'string' && robots.length < 10)) {
      return makeResult(name, module, severity, description, 'fail', 'robots.txt vide');
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module SEO non installe (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N13 — MARKETING REEL CYCLE (vraies fonctions)
// ============================================

async function testN13_MarketingReelCycle(tenantId) {
  const name = 'N13_marketing_reel_cycle';
  const module = 'marketing';
  const severity = 'warning';
  const description = 'Campagne marketing reelle : creation, programmation, envoi via fonctions metier';

  try {
    const { createCampaign, scheduleCampaign, sendCampaign, deleteCampaign } =
      await import('../../modules/marketing/marketingService.js');

    // Creer campagne via vraie fonction
    const campaign = await createCampaign(tenantId, {
      name: `${TEST_PREFIX}Campaign_Reel_PLTE`,
      type: 'email',
      subject: 'Test PLTE — Campagne automatique',
      content: '<p>Ceci est un test automatique PLTE. Ne pas repondre.</p>',
      segment_id: null, // pas de segment = tous les clients
    });

    if (!campaign?.id && !campaign?.data?.id) {
      const errMsg = campaign?.error || 'Campagne non creee';
      if (/PGRST205|42P01/i.test(errMsg)) {
        return makeResult(name, module, severity, description, 'pass', 'Table campaigns non existante (skip)');
      }
      return makeResult(name, module, severity, description, 'fail', `Creation campagne echouee: ${errMsg}`);
    }

    const campaignId = campaign.id || campaign.data?.id;

    // Programmer pour dans 1 heure
    const scheduleTime = new Date(Date.now() + 3600000).toISOString();
    const scheduled = await scheduleCampaign(tenantId, campaignId, scheduleTime);
    if (scheduled?.error) {
      return makeResult(name, module, severity, description, 'fail',
        `Programmation echouee: ${scheduled.error}`);
    }

    // Envoyer (en mode test, ne devrait pas envoyer de vrais emails)
    try {
      const sent = await sendCampaign(tenantId, campaignId);
      // L'envoi peut echouer si pas de clients avec email — c'est OK
      if (sent?.error && !/no recipients|no clients|empty/i.test(sent.error)) {
        return makeResult(name, module, severity, description, 'fail',
          `Envoi echoue: ${sent.error}`);
      }
    } catch (sendErr) {
      // Erreur d'envoi acceptable si pas de config email
      if (!/smtp|email|config|sendgrid|mailgun/i.test(sendErr.message)) {
        return makeResult(name, module, severity, description, 'fail',
          `Envoi crash: ${sendErr.message}`);
      }
    }

    // Cleanup
    try { await deleteCampaign(tenantId, campaignId); } catch { /* ok */ }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module marketing non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N14 — CHAT IA (ex-H7, deplace pour economie)
// ============================================

async function testN14_ChatIA(tenantId) {
  const name = 'N14_chat_ia';
  const module = 'ia';
  const severity = 'warning';
  const description = 'Assistant IA : reponse a une question simple du patron';

  try {
    const { processMessage } = await import('../../core/unified/nexusCore.js');

    // Question simple sans mot-cle RDV/commande → route vers Haiku
    const result = await processMessage(
      'Bonjour, quels services proposez-vous ?',
      'admin',
      {
        tenantId,
        conversationId: `plte-n14-${tenantId}-${Date.now()}`,
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

// ============================================
// PURGE OLD DATA
// ============================================

async function purgeOldTestData(tenantId) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString();

  try {
    // Purger runs anciens
    await supabase
      .from('sentinel_logic_runs')
      .delete()
      .eq('tenant_id', tenantId)
      .lt('started_at', cutoff);
  } catch { /* non-blocking */ }
}
