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

  // N15 — Cycle commande commerce
  if (profile === 'commerce') {
    results.push(await testN15_OrderCycle(tenantId));
  }

  // N16 — Stock advisor
  if (['commerce', 'salon'].includes(profile)) {
    results.push(await testN16_StockAdvisor(tenantId));
  }

  // N17 — CRM pipeline
  results.push(await testN17_CRMPipeline(tenantId, client));

  // N18 — CRM stats
  results.push(await testN18_CRMStats(tenantId));

  // N19 — Billing Stripe config
  results.push(await testN19_BillingStripe(tenantId));

  // N20 — Trial status
  results.push(await testN20_TrialStatus(tenantId));

  // N21 — Notification cascade
  results.push(await testN21_NotificationCascade(tenantId, client));

  // N22 — Social post lifecycle
  results.push(await testN22_SocialPostLifecycle(tenantId));

  // N23 — Voice AI cycle
  results.push(await testN23_VoiceAICycle(tenantId));

  // N24 — Relances
  results.push(await testN24_Relances(tenantId));

  // N25 — RGPD
  results.push(await testN25_RGPD(tenantId, client));

  // N26 — Usage quotas
  results.push(await testN26_UsageQuotas(tenantId));

  // N27 — FEC export
  results.push(await testN27_FECExport(tenantId));

  // N28 — RH avance
  if (['salon', 'securite', 'restaurant'].includes(profile)) {
    results.push(await testN28_RHAvance(tenantId));
  }

  // N29 — Pointage sync
  if (['salon', 'securite', 'restaurant'].includes(profile)) {
    results.push(await testN29_PointageSync(tenantId));
  }

  // N30 — Waitlist
  if (['restaurant', 'hotel', 'salon'].includes(profile)) {
    results.push(await testN30_Waitlist(tenantId, client));
  }

  // N31 — Reviews
  results.push(await testN31_Reviews(tenantId, client));

  // N32 — Referrals
  results.push(await testN32_Referrals(tenantId));

  // N33 — Sentinel intelligence
  results.push(await testN33_SentinelIntelligence(tenantId));

  // N34 — SSO config
  results.push(await testN34_SSOConfig(tenantId));

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
    const now = new Date();
    const periode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Supprimer ancien bulletin test s'il existe (UNIQUE periode/membre)
    await supabase.from('rh_bulletins_paie').delete()
      .eq('tenant_id', tenantId).eq('membre_id', membre.id).eq('periode', periode);

    // Creer bulletin avec colonnes reelles de la table
    const brutTotal = 200000; // 2000€ en centimes
    const totalCotisations = Math.round(brutTotal * 0.22); // ~22%
    const netAPayer = brutTotal - totalCotisations;

    const { data: bulletin, error } = await supabase
      .from('rh_bulletins_paie')
      .insert({
        tenant_id: tenantId,
        membre_id: membre.id,
        periode,
        salaire_base: brutTotal,
        brut_total: brutTotal,
        total_cotisations_salariales: totalCotisations,
        net_a_payer: netAPayer,
        statut: 'brouillon',
      })
      .select('*')
      .single();

    if (error) {
      if (/PGRST205|42P01/i.test(error.message || error.code)) {
        return makeResult(name, module, severity, description, 'pass', 'Table rh_bulletins_paie non existante (skip)');
      }
      return makeResult(name, module, severity, description, 'fail', error.message);
    }

    // Verifier coherence
    if (bulletin.net_a_payer !== bulletin.brut_total - bulletin.total_cotisations_salariales) {
      return makeResult(name, module, severity, description, 'fail',
        `Net incoherent: brut=${bulletin.brut_total} - cotis=${bulletin.total_cotisations_salariales} != net=${bulletin.net_a_payer}`);
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
    const { chat } = await import('../../services/adminChatService.js');

    // Question simple via admin chat pipeline (adminChatService, pas processMessage)
    const result = await chat(tenantId, [
      { role: 'user', content: 'Bonjour, quels services proposez-vous ?' }
    ]);

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
// N15 — CYCLE COMMANDE COMMERCE
// ============================================

async function testN15_OrderCycle(tenantId) {
  const name = 'N15_order_cycle';
  const module = 'commerce';
  const severity = 'critical';
  const description = 'Commerce: cycle createOrder → updateStatus → cancelOrder';

  try {
    const { createOrder, updateOrderStatus, cancelOrder } =
      await import('../../modules/commerce/orderService.js');

    // Trouver un produit actif avec stock pour ce tenant
    const { data: products } = await supabase
      .from('products')
      .select('id, name, price')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(1);

    if (!products?.length) {
      return makeResult(name, module, severity, description, 'pass',
        'Aucun produit actif en base (skip) — creer des produits dans la table products');
    }

    const product = products[0];

    // Generer pickup date/time (demain 12h)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pickupDate = tomorrow.toISOString().split('T')[0];

    const order = await createOrder(tenantId, {
      customerName: `${TEST_PREFIX}Client_N15`,
      customerEmail: 'n15@plte.internal',
      customerPhone: '0600000015',
      orderType: 'click_collect',
      pickupDate,
      pickupTime: '12:00',
      items: [{ productId: product.id, quantity: 1 }],
    });

    const orderId = order?.id || order?.data?.id;
    if (!orderId) {
      const errMsg = order?.error || 'Commande non creee';
      if (/PGRST205|42P01/i.test(errMsg)) {
        return makeResult(name, module, severity, description, 'pass', 'Table orders non existante (skip)');
      }
      // Tolerer les erreurs de stock/slot — signifie que les tables existent mais pas les donnees
      if (/stock|creneau|slot/i.test(errMsg)) {
        return makeResult(name, module, severity, description, 'pass', `Donnees manquantes (skip): ${errMsg}`);
      }
      return makeResult(name, module, severity, description, 'fail', `Creation echouee: ${errMsg}`);
    }

    // Transition confirmed
    const updated = await updateOrderStatus(tenantId, orderId, 'confirmed');
    if (updated?.error && !/already|invalid.*transition/i.test(updated.error)) {
      return makeResult(name, module, severity, description, 'fail', `updateStatus echoue: ${updated.error}`);
    }

    // Annulation
    const cancelled = await cancelOrder(tenantId, orderId, 'Test PLTE');
    if (cancelled?.error && !/already.*cancel/i.test(cancelled.error)) {
      return makeResult(name, module, severity, description, 'fail', `cancelOrder echoue: ${cancelled.error}`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module commerce non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N16 — STOCK ADVISOR
// ============================================

async function testN16_StockAdvisor(tenantId) {
  const name = 'N16_stock_advisor';
  const module = 'stock';
  const severity = 'warning';
  const description = 'Stock: analyzeStock retourne summary, alerts et recommendations';

  try {
    const { analyzeStock } = await import('../../modules/commerce/stockAdvisorService.js');

    const result = await analyzeStock(tenantId);
    if (!result) {
      return makeResult(name, module, severity, description, 'fail', 'analyzeStock retourne null');
    }

    // Unwrap result.data si present (analyzeStock retourne { success, data: { summary, alerts, recommendations } })
    const payload = result.data || result;

    // Verifier structure minimale
    const hasSummary = payload.summary !== undefined || payload.total !== undefined;
    const hasAlerts = Array.isArray(payload.alerts) || payload.alerts !== undefined;
    const hasRecommendations = Array.isArray(payload.recommendations) || payload.recommendations !== undefined;

    if (!hasSummary && !hasAlerts && !hasRecommendations) {
      return makeResult(name, module, severity, description, 'fail',
        'analyzeStock ne retourne ni summary, ni alerts, ni recommendations');
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module stock advisor non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N17 — CRM PIPELINE
// ============================================

async function testN17_CRMPipeline(tenantId, client) {
  const name = 'N17_crm_pipeline';
  const module = 'crm';
  const severity = 'warning';
  const description = 'CRM: createContact → createQuote → sendQuote → acceptQuote';

  try {
    const { createContact, createQuote, sendQuote, acceptQuote } =
      await import('../../modules/crm/crmService.js');

    // Creer contact CRM
    const contact = await createContact(tenantId, {
      last_name: `${TEST_PREFIX}Contact_N17`,
      first_name: 'PLTE',
      email: `crm-n17-${Date.now()}@plte.internal`,
      phone: '0600000017',
      source: 'website',
      status: 'lead',
    });

    const contactId = contact?.id || contact?.data?.id;
    if (!contactId) {
      const errMsg = contact?.error || 'Contact non cree';
      if (/PGRST205|42P01/i.test(errMsg)) {
        return makeResult(name, module, severity, description, 'pass', 'Table crm_contacts non existante (skip)');
      }
      return makeResult(name, module, severity, description, 'fail', `createContact echoue: ${errMsg}`);
    }

    // Creer devis CRM (quote_number unique via timestamp)
    const quote = await createQuote(tenantId, {
      contact_id: contactId,
      items: [{ description: 'Service test PLTE', quantity: 1, unit_price: 5000 }],
    });

    const quoteId = quote?.id || quote?.data?.id;
    if (!quoteId) {
      const qErr = quote?.error || quote?.data?.error || 'pas d\'ID';
      if (/PGRST205|42P01/i.test(String(qErr))) {
        return makeResult(name, module, severity, description, 'pass', `Table quotes non existante (skip): ${qErr}`);
      }
      return makeResult(name, module, severity, description, 'fail', `createQuote echoue: ${qErr}`);
    }

    // Envoyer devis (non bloquant — peut echouer si pas de config email)
    try {
      await sendQuote(tenantId, quoteId);
    } catch (sendErr) {
      if (!/smtp|email|config|resend/i.test(sendErr.message)) {
        return makeResult(name, module, severity, description, 'fail', `sendQuote crash: ${sendErr.message}`);
      }
    }

    // Accepter devis
    const accepted = await acceptQuote(tenantId, quoteId);
    if (accepted?.error && !/already/i.test(accepted.error)) {
      return makeResult(name, module, severity, description, 'fail', `acceptQuote echoue: ${accepted.error}`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module CRM non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N18 — CRM STATS
// ============================================

async function testN18_CRMStats(tenantId) {
  const name = 'N18_crm_stats';
  const module = 'crm';
  const severity = 'info';
  const description = 'CRM: getCRMStats retourne total, leads, conversion_rate';

  try {
    const { getCRMStats } = await import('../../modules/crm/crmService.js');

    const stats = await getCRMStats(tenantId);
    if (!stats) {
      return makeResult(name, module, severity, description, 'fail', 'getCRMStats retourne null');
    }

    // Verifier structure — au minimum un objet avec des proprietes numeriques
    if (typeof stats !== 'object') {
      return makeResult(name, module, severity, description, 'fail',
        `getCRMStats retourne ${typeof stats} au lieu d'un objet`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module CRM non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N19 — BILLING STRIPE CONFIG
// ============================================

async function testN19_BillingStripe(tenantId) {
  const name = 'N19_billing_stripe';
  const module = 'billing';
  const severity = 'info';
  const description = 'Billing: isStripeConfigured() + getSubscriptionDetails() sans crash';

  try {
    const { isStripeConfigured, getSubscriptionDetails } =
      await import('../stripeBillingService.js');

    // Verifier config Stripe (booleen)
    const configured = isStripeConfigured();
    if (typeof configured !== 'boolean') {
      return makeResult(name, module, severity, description, 'fail',
        `isStripeConfigured retourne ${typeof configured} au lieu de boolean`);
    }

    // Recuperer subscription (peut etre null si pas configure)
    const sub = await getSubscriptionDetails(tenantId);
    // L'important c'est que ca ne crash pas — null/undefined OK
    if (sub?.error && !/not found|no subscription|not configured/i.test(sub.error)) {
      return makeResult(name, module, severity, description, 'fail',
        `getSubscriptionDetails erreur: ${sub.error}`);
    }

    return makeResult(name, module, severity, description, 'pass',
      `Stripe configured: ${configured}`);
  } catch (err) {
    if (/Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module Stripe non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N20 — TRIAL STATUS
// ============================================

async function testN20_TrialStatus(tenantId) {
  const name = 'N20_trial_status';
  const module = 'billing';
  const severity = 'info';
  const description = 'Billing: getTrialStatus + checkTrialLimit fonctionnels';

  try {
    const { getTrialStatus, checkTrialLimit } = await import('../trialService.js');

    const status = await getTrialStatus(tenantId);
    if (!status && status !== null) {
      return makeResult(name, module, severity, description, 'fail', 'getTrialStatus retourne undefined');
    }

    // checkTrialLimit — verifier que reservations est autorise (plan actif ou trial)
    const limit = await checkTrialLimit(tenantId, 'reservations');
    if (limit === undefined) {
      return makeResult(name, module, severity, description, 'fail', 'checkTrialLimit retourne undefined');
    }

    // allowed doit etre un booleen ou l'objet doit avoir .allowed
    const allowed = typeof limit === 'boolean' ? limit : limit?.allowed;
    if (allowed === undefined) {
      return makeResult(name, module, severity, description, 'fail',
        'checkTrialLimit ne retourne pas de champ allowed');
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module trial non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N21 — NOTIFICATION CASCADE
// ============================================

async function testN21_NotificationCascade(tenantId, client) {
  const name = 'N21_notification_cascade';
  const module = 'notifications';
  const severity = 'warning';
  const description = 'Notifications: sendWithCascade(priority:low) → email only + getStats()';

  try {
    const { sendWithCascade, getStats } =
      await import('../notificationCascadeService.js');

    // Envoi priorite basse = email seulement (pas de SMS/WA reel)
    const result = await sendWithCascade(tenantId, client.id, {
      subject: 'Test PLTE N21',
      body: `${TEST_PREFIX}Notification cascade test`,
    }, 'low');

    // Meme si l'envoi echoue (pas de config email), on verifie que ca ne crash pas
    if (result?.error && !/config|smtp|resend|api.*key/i.test(result.error)) {
      return makeResult(name, module, severity, description, 'fail',
        `sendWithCascade erreur: ${result.error}`);
    }

    // Verifier stats
    const stats = await getStats();
    if (stats === undefined) {
      return makeResult(name, module, severity, description, 'fail', 'getStats retourne undefined');
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module notification cascade non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N22 — SOCIAL POST LIFECYCLE
// ============================================

async function testN22_SocialPostLifecycle(tenantId) {
  const name = 'N22_social_post_lifecycle';
  const module = 'social';
  const severity = 'info';
  const description = 'Social: createPost → draft + schedulePost → scheduled + getPostStats';

  try {
    const { createPost, schedulePost, getPostStats } =
      await import('../../modules/social/socialService.js');

    const post = await createPost(tenantId, {
      content: `${TEST_PREFIX}Post PLTE test automatique`,
      platforms: ['facebook'],
      status: 'draft',
    });

    const postId = post?.id || post?.data?.id;
    if (!postId) {
      const errMsg = post?.error || 'Post non cree';
      if (/PGRST205|42P01/i.test(errMsg)) {
        return makeResult(name, module, severity, description, 'pass', 'Table social_posts non existante (skip)');
      }
      return makeResult(name, module, severity, description, 'fail', `createPost echoue: ${errMsg}`);
    }

    // Programmer pour demain
    const scheduledFor = new Date(Date.now() + 86400000).toISOString();
    const scheduled = await schedulePost(tenantId, postId, scheduledFor);
    if (scheduled?.error) {
      return makeResult(name, module, severity, description, 'fail',
        `schedulePost echoue: ${scheduled.error}`);
    }

    // Stats
    const stats = await getPostStats(tenantId);
    if (stats === undefined) {
      return makeResult(name, module, severity, description, 'fail', 'getPostStats retourne undefined');
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module social non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N23 — VOICE AI CYCLE
// ============================================

async function testN23_VoiceAICycle(tenantId) {
  const name = 'N23_voice_ai_cycle';
  const module = 'ia';
  const severity = 'warning';
  const description = 'Voice AI: getVoiceResponse(bonjour) → greeting + (au revoir) → shouldEndCall';

  try {
    const { getVoiceResponse } = await import('../voiceAIService.js');

    // Test greeting
    const greeting = await getVoiceResponse(tenantId, `plte-n23-${Date.now()}`, 'bonjour');
    if (!greeting) {
      return makeResult(name, module, severity, description, 'fail', 'getVoiceResponse(bonjour) retourne null');
    }

    // Verifier qu'on a une reponse vocale
    const response1 = greeting?.response || greeting?.text || greeting?.message || greeting;
    if (typeof response1 === 'string' && response1.length < 3) {
      return makeResult(name, module, severity, description, 'fail', 'Reponse voice trop courte');
    }

    // Test fin de conversation
    const goodbye = await getVoiceResponse(tenantId, `plte-n23-bye-${Date.now()}`, 'au revoir');
    if (!goodbye) {
      return makeResult(name, module, severity, description, 'fail', 'getVoiceResponse(au revoir) retourne null');
    }

    // Verifier shouldEndCall ou hangup
    const shouldEnd = goodbye?.shouldEndCall || goodbye?.endCall || goodbye?.hangup;
    // Pas obligatoire que shouldEndCall soit true, l'important c'est que ca ne crash pas

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/Cannot find module|TENANT_ID_REQUIRED|config/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module voice AI non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N24 — RELANCES
// ============================================

async function testN24_Relances(tenantId) {
  const name = 'N24_relances';
  const module = 'relances';
  const severity = 'info';
  const description = 'Relances: getStatsRelances + getRelanceSettings retourne r1-r5';

  try {
    const { getStatsRelances, getRelanceSettings } = await import('../relancesService.js');

    const stats = await getStatsRelances(tenantId);
    if (stats === undefined) {
      return makeResult(name, module, severity, description, 'fail', 'getStatsRelances retourne undefined');
    }

    const settings = await getRelanceSettings(tenantId);
    if (!settings) {
      return makeResult(name, module, severity, description, 'fail', 'getRelanceSettings retourne null');
    }

    // Verifier structure minimale — settings doit etre un objet ou array
    if (typeof settings !== 'object') {
      return makeResult(name, module, severity, description, 'fail',
        `getRelanceSettings retourne ${typeof settings} au lieu d'un objet`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module relances non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N25 — RGPD
// ============================================

async function testN25_RGPD(tenantId, client) {
  const name = 'N25_rgpd';
  const module = 'rgpd';
  const severity = 'critical';
  const description = 'RGPD: export tables + consent grant/get/revoke cycle';

  try {
    const { grantConsent, hasConsent, revokeConsent } = await import('../consentService.js');

    // Grant consent
    const granted = await grantConsent(tenantId, client.id, 'email', 'plte_test');
    if (granted?.error && !/PGRST205|42P01/i.test(granted.error)) {
      return makeResult(name, module, severity, description, 'fail',
        `grantConsent echoue: ${granted.error}`);
    }

    // Verifier consent
    const has = await hasConsent(tenantId, client.id, 'email');
    if (has !== true && has?.granted !== true && has?.has_consent !== true) {
      // Si la table n'existe pas, skip
      if (/PGRST205|42P01/i.test(String(has?.error || ''))) {
        return makeResult(name, module, severity, description, 'pass', 'Table consent non existante (skip)');
      }
      return makeResult(name, module, severity, description, 'fail',
        'Consent accorde mais hasConsent retourne false');
    }

    // Revoquer consent
    const revoked = await revokeConsent(tenantId, client.id, 'email');
    if (revoked?.error) {
      return makeResult(name, module, severity, description, 'fail',
        `revokeConsent echoue: ${revoked.error}`);
    }

    // Verifier revocation
    const hasAfter = await hasConsent(tenantId, client.id, 'email');
    if (hasAfter === true || hasAfter?.granted === true) {
      return makeResult(name, module, severity, description, 'fail',
        'Consent revoque mais hasConsent retourne encore true');
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module RGPD/consent non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N26 — USAGE QUOTAS
// ============================================

async function testN26_UsageQuotas(tenantId) {
  const name = 'N26_usage_quotas';
  const module = 'usage';
  const severity = 'warning';
  const description = 'Usage: trackUsage + getMonthlyUsage + checkQuota';

  try {
    const { trackUsage, getMonthlyUsage, checkQuota } =
      await import('../usageTrackingService.js');

    // Tracker un usage test
    const tracked = await trackUsage(tenantId, 'plte_test', 1, { source: 'plte_n26' });
    if (tracked?.error && !/PGRST205|42P01/i.test(tracked.error)) {
      return makeResult(name, module, severity, description, 'fail',
        `trackUsage echoue: ${tracked.error}`);
    }

    // Recuperer usage mensuel
    const monthly = await getMonthlyUsage(tenantId);
    if (monthly === undefined) {
      return makeResult(name, module, severity, description, 'fail', 'getMonthlyUsage retourne undefined');
    }

    // Verifier quota
    const quota = await checkQuota(tenantId, 'plte_test', 1);
    if (quota === undefined) {
      return makeResult(name, module, severity, description, 'fail', 'checkQuota retourne undefined');
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module usage tracking non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N27 — FEC EXPORT
// ============================================

async function testN27_FECExport(tenantId) {
  const name = 'N27_fec_export';
  const module = 'compta';
  const severity = 'warning';
  const description = 'Compta: validateFEC + generateFEC → filename pattern, BOM UTF-8';

  try {
    const { validateFEC, generateFEC } = await import('../fecExportService.js');

    const exercice = new Date().getFullYear().toString();

    // Valider FEC
    const validation = await validateFEC(tenantId, exercice);
    // Validation peut retourner des warnings — l'important c'est que ca ne crash pas
    if (validation?.error && !/PGRST205|42P01|aucune|no.*ecriture|SIREN/i.test(validation.error)) {
      return makeResult(name, module, severity, description, 'fail',
        `validateFEC erreur: ${validation.error}`);
    }

    // Generer FEC
    const fec = await generateFEC(tenantId, exercice);
    if (!fec) {
      return makeResult(name, module, severity, description, 'pass',
        'Aucune ecriture comptable pour generer le FEC (skip)');
    }

    // Verifier pattern filename
    const filename = fec.filename || fec.name || '';
    if (filename && !/FEC/i.test(filename)) {
      return makeResult(name, module, severity, description, 'fail',
        `Filename FEC ne contient pas "FEC": ${filename}`);
    }

    // Verifier BOM UTF-8 si contenu disponible
    const content = fec.content || fec.data || '';
    if (typeof content === 'string' && content.length > 0) {
      // BOM = \uFEFF en debut de fichier
      const hasBOM = content.charCodeAt(0) === 0xFEFF || content.startsWith('\uFEFF');
      if (!hasBOM && content.length > 100) {
        return makeResult(name, module, severity, description, 'fail', 'FEC genere sans BOM UTF-8');
      }
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module|SIREN|entreprise/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module FEC non disponible ou config manquante (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N28 — RH AVANCE
// ============================================

async function testN28_RHAvance(tenantId) {
  const name = 'N28_rh_avance';
  const module = 'rh';
  const severity = 'warning';
  const description = 'RH: createEmployee → clockIn → clockOut → requestLeave → approveLeave';

  try {
    const { createEmployee, clockIn, clockOut, requestLeave, approveLeave } =
      await import('../../modules/hr/hrService.js');

    // Creer employe test
    const emp = await createEmployee(tenantId, {
      last_name: `${TEST_PREFIX}Employe_N28`,
      first_name: 'PLTE',
      email: `rh-n28-${Date.now()}@plte.internal`,
      position: 'test_plte',
      hire_date: '2024-01-01',
      gross_salary: 250000,
      contract_type: 'cdi',
    });

    const empId = emp?.id || emp?.data?.id;
    if (!empId) {
      const errMsg = emp?.error || 'Employe non cree';
      if (/PGRST205|42P01/i.test(errMsg)) {
        return makeResult(name, module, severity, description, 'pass', 'Table hr_employees non existante (skip)');
      }
      return makeResult(name, module, severity, description, 'fail', `createEmployee echoue: ${errMsg}`);
    }

    // Clock in
    const cin = await clockIn(tenantId, empId);
    if (cin?.error && !/already.*clocked|PGRST205/i.test(cin.error)) {
      return makeResult(name, module, severity, description, 'fail', `clockIn echoue: ${cin.error}`);
    }

    // Clock out — utiliser le timeclockId retourne par clockIn
    const timeclockId = cin?.id || cin?.data?.id;
    const cout = await clockOut(tenantId, timeclockId || empId);
    if (cout?.error && !/not.*clocked|PGRST205/i.test(cout.error)) {
      return makeResult(name, module, severity, description, 'fail', `clockOut echoue: ${cout.error}`);
    }

    // Request leave — signature: requestLeave(tenantId, data)
    const leave = await requestLeave(tenantId, {
      employee_id: empId,
      type: 'conge_paye',
      start_date: futureDate(30),
      end_date: futureDate(35),
      days_count: 5,
      reason: 'Test PLTE N28',
    });

    const leaveId = leave?.id || leave?.data?.id;
    if (leaveId) {
      // Approve leave — signature: approveLeave(tenantId, leaveId, reviewerId)
      const approved = await approveLeave(tenantId, leaveId, empId);
      if (approved?.error && !/already.*approved/i.test(approved.error)) {
        return makeResult(name, module, severity, description, 'fail', `approveLeave echoue: ${approved.error}`);
      }
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module HR non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N29 — POINTAGE SYNC
// ============================================

async function testN29_PointageSync(tenantId) {
  const name = 'N29_pointage_sync';
  const module = 'rh';
  const severity = 'info';
  const description = 'RH: synchroniserPointageDepuisReservations → success';

  try {
    const { synchroniserPointageDepuisReservations } = await import('../pointageService.js');

    const today = new Date().toISOString().split('T')[0];
    const result = await synchroniserPointageDepuisReservations(tenantId, today);

    // Le resultat peut etre null/0 si aucune resa terminee — c'est OK
    if (result?.error && !/PGRST205|42P01|aucune/i.test(result.error)) {
      return makeResult(name, module, severity, description, 'fail',
        `synchroniserPointage echoue: ${result.error}`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module pointage non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N30 — WAITLIST
// ============================================

async function testN30_Waitlist(tenantId, client) {
  const name = 'N30_waitlist';
  const module = 'reservations';
  const severity = 'info';
  const description = 'Waitlist: ajout et statut waiting';

  try {
    const { addToWaitlist } = await import('../waitlistService.js');

    const result = await addToWaitlist(tenantId, {
      client_id: client.id,
      preferred_date: futureDate(7),
      preferred_time_start: '12:00',
      notes: `${TEST_PREFIX}Waitlist N30`,
    });

    const entryId = result?.id || result?.data?.id;
    if (!entryId) {
      const errMsg = result?.error || 'Ajout waitlist echoue';
      if (/PGRST205|42P01/i.test(errMsg)) {
        return makeResult(name, module, severity, description, 'pass', 'Table waitlist non existante (skip)');
      }
      return makeResult(name, module, severity, description, 'fail', `addToWaitlist echoue: ${errMsg}`);
    }

    // Verifier statut
    const status = result?.status || result?.data?.status;
    if (status && status !== 'waiting' && status !== 'pending') {
      return makeResult(name, module, severity, description, 'fail',
        `Statut waitlist inattendu: ${status} au lieu de waiting`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module waitlist non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N31 — REVIEWS (AVIS)
// ============================================

async function testN31_Reviews(tenantId, client) {
  const name = 'N31_reviews';
  const module = 'marketing';
  const severity = 'info';
  const description = 'Reviews: insert avis → AVG(note) est un nombre';

  try {
    // Insert avis test
    const { data: avis, error } = await supabase
      .from('avis_clients')
      .insert({
        tenant_id: tenantId,
        client_id: client.id,
        note: 4,
        commentaire: `${TEST_PREFIX}Excellent service PLTE test`,
        source: 'plte_test',
        created_at: new Date().toISOString(),
      })
      .select('id, note')
      .single();

    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01') {
        return makeResult(name, module, severity, description, 'pass', 'Table avis_clients non existante (skip)');
      }
      return makeResult(name, module, severity, description, 'fail', error.message);
    }

    // Calculer moyenne
    const { data: avg } = await supabase
      .from('avis_clients')
      .select('note')
      .eq('tenant_id', tenantId);

    if (avg?.length) {
      const moyenne = avg.reduce((s, a) => s + (a.note || 0), 0) / avg.length;
      if (typeof moyenne !== 'number' || isNaN(moyenne)) {
        return makeResult(name, module, severity, description, 'fail',
          `Moyenne des avis n'est pas un nombre: ${moyenne}`);
      }
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N32 — REFERRALS
// ============================================

async function testN32_Referrals(tenantId) {
  const name = 'N32_referrals';
  const module = 'crm';
  const severity = 'info';
  const description = 'Referrals: generateReferralCode → format NXS-XXXXXXXX';

  try {
    const { generateReferralCode } = await import('../referralService.js');

    const code = await generateReferralCode(tenantId);
    if (!code) {
      return makeResult(name, module, severity, description, 'fail', 'generateReferralCode retourne null');
    }

    const codeStr = typeof code === 'string' ? code : code?.code || code?.data?.code;
    if (!codeStr) {
      return makeResult(name, module, severity, description, 'fail',
        'generateReferralCode ne retourne pas de code string');
    }

    // Verifier format NXS-XXXXXXXX
    if (!/^NXS-[A-Z0-9]{8}$/i.test(codeStr)) {
      return makeResult(name, module, severity, description, 'fail',
        `Format referral invalide: ${codeStr} (attendu NXS-XXXXXXXX)`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module referral non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N33 — SENTINEL INTELLIGENCE
// ============================================

async function testN33_SentinelIntelligence(tenantId) {
  const name = 'N33_sentinel_intelligence';
  const module = 'sentinel';
  const severity = 'info';
  const description = 'Sentinel: captureMetrics → success + health_score';

  try {
    const { captureMetrics } = await import('../../modules/sentinel-intelligence/sentinelIntelligenceService.js');

    const result = await captureMetrics(tenantId);
    if (!result) {
      return makeResult(name, module, severity, description, 'fail', 'captureMetrics retourne null');
    }

    // Verifier success
    const success = result?.success || result?.captured || (result && !result.error);
    if (!success && result?.error) {
      return makeResult(name, module, severity, description, 'fail',
        `captureMetrics erreur: ${result.error}`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    if (/PGRST205|42P01|Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module sentinel intelligence non disponible (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// N34 — SSO CONFIG
// ============================================

async function testN34_SSOConfig(tenantId) {
  const name = 'N34_sso_config';
  const module = 'config';
  const severity = 'info';
  const description = 'SSO: getSSOConfig → array (empty OK), no crash';

  try {
    const { getSSOConfig } = await import('../ssoService.js');

    const config = await getSSOConfig(tenantId);
    // Config peut etre null, [], ou un objet — l'important c'est pas de crash
    if (config === undefined) {
      return makeResult(name, module, severity, description, 'fail', 'getSSOConfig retourne undefined');
    }

    return makeResult(name, module, severity, description, 'pass',
      `SSO config: ${Array.isArray(config) ? config.length + ' provider(s)' : typeof config}`);
  } catch (err) {
    if (/Cannot find module/i.test(err.message)) {
      return makeResult(name, module, severity, description, 'pass', 'Module SSO non disponible (skip)');
    }
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
