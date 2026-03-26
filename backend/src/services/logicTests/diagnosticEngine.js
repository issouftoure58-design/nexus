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
  const failedTests = testResults.filter(r => r.status === 'fail' || r.status === 'error');

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
  const error = (test.error || '').toLowerCase();
  const name = (test.name || '').toLowerCase();
  const desc = (test.description || '').toLowerCase();

  // === H1 — Reservation echouee ===
  if (name.includes('h1') || name.includes('reservation_unified')) {
    return diagnoseReservationFailure(tenantId, test);
  }

  // === H2 — Facturation / ecritures VT/BQ ===
  if (name.includes('h2') || name.includes('paiement_ecritures') ||
      desc.includes('facturation') || desc.includes('ecritures comptables')) {
    return diagnoseFacturationFailure(tenantId, test);
  }

  // === H7 — Chat IA ===
  if (name.includes('h7') || name.includes('chat_ia') || desc.includes('chat ia') || desc.includes('assistant ia')) {
    return diagnoseChatIAFailure(tenantId, test);
  }

  // === Profile bootstrap — tables, chambres, agents, sites, zones ===
  if (name.startsWith('p_') || error.includes('aucune table') || error.includes('aucune chambre') ||
      error.includes('aucun agent') || error.includes('aucun site') || error.includes('aucune zone') ||
      error.includes('configure') || desc.includes('tables presentes') || desc.includes('chambres configurees') ||
      desc.includes('agents et sites') || desc.includes('zones intervention')) {
    return diagnoseProfileBootstrap(tenantId, test);
  }

  // === N15 — Order cycle ===
  if (name.includes('n15') || name.includes('order')) {
    return diagnoseOrderFailure(tenantId, test);
  }

  // === N17 — CRM pipeline ===
  if (name.includes('n17') || name.includes('crm_pipeline')) {
    return diagnoseCRMFailure(tenantId, test);
  }

  // === N21 — Notification cascade ===
  if (name.includes('n21') || name.includes('notification_cascade')) {
    return diagnoseNotificationCascade(tenantId, test);
  }

  // === N22 — Social post ===
  if (name.includes('n22') || name.includes('social_post')) {
    return diagnoseSocialFailure(tenantId, test);
  }

  // === N23 — Voice AI ===
  if (name.includes('n23') || name.includes('voice_ai')) {
    return diagnoseVoiceAI(tenantId, test);
  }

  // === N25 — RGPD ===
  if (name.includes('n25') || name.includes('rgpd')) {
    return diagnoseRGPDFailure(tenantId, test);
  }

  // === N26 — Usage quotas ===
  if (name.includes('n26') || name.includes('usage_quota')) {
    return diagnoseUsageQuota(tenantId, test);
  }

  // === N27 — FEC export ===
  if (name.includes('n27') || name.includes('fec')) {
    return diagnoseFECFailure(tenantId, test);
  }

  // === N3 — Bulletin paie ===
  if (name.includes('n3_') || name.includes('bulletin_paie')) {
    return diagnoseBulletinPaie(tenantId, test);
  }

  // === N28 — RH avance ===
  if (name.includes('n28') || name.includes('rh_avance')) {
    return diagnoseRHAvance(tenantId, test);
  }

  // === N29 — Pointage sync ===
  if (name.includes('n29') || name.includes('pointage_sync')) {
    return diagnosePointageSync(tenantId, test);
  }

  // === N32 — Referrals ===
  if (name.includes('n32') || name.includes('referral')) {
    return diagnoseReferralFailure(tenantId, test);
  }

  // === Ecritures desequilibrees (N6/H6 coherence) ===
  if (name.includes('coherence') && error.includes('desequilibree')) {
    return await diagnoseUnbalancedEntries(tenantId, test, test.error || '');
  }

  // === Facture payee sans ecritures BQ (nightly) ===
  if (error.includes('sans ecritures bq') || error.includes('payee(s) sans ecritures')) {
    return await diagnoseMissingPaymentEntries(tenantId, test);
  }

  // === Solde fidelite incoherent ===
  if (name.includes('fidelite') && error.includes('incoherent')) {
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

  // === Fidelite schema/BDD ===
  if (name.includes('fidelite') && (error.includes('schema') || error.includes('colonne'))) {
    return makeDiag('DIAGNOSED', test.name,
      'Schema BDD fidelite incomplet',
      test.error?.substring(0, 200),
      null,
      'Verifier les colonnes de la table loyalty_transactions (migration manquante ?)',
      { error: test.error?.substring(0, 100) });
  }

  // === Bootstrap check (H0) ===
  if (name.includes('h0') || name.includes('bootstrap')) {
    return makeDiag('DIAGNOSED', test.name,
      'Donnees bootstrap manquantes',
      test.error?.substring(0, 200),
      null,
      'Verifier seedProfileData — clients et/ou services non crees pour ce tenant',
      { error: test.error?.substring(0, 100) });
  }

  // Fallback — UNKNOWN avec info utile
  return {
    category: 'UNKNOWN',
    test_name: test.name,
    root_cause: `Pas de handler diagnostique pour: ${test.name}`,
    root_cause_detail: test.error?.substring(0, 200),
    fix_applied: null,
    operator_action: 'Analyser manuellement — verifier les logs serveur',
    evidence: { test_name: test.name, error_snippet: test.error?.substring(0, 100) },
  };
}

// ============================================
// HANDLERS DIAGNOSTIQUES — NOUVEAUX (H1, H2, H7, Profile)
// ============================================

/**
 * H1 — Reservation echouee
 * Diagnostic de la cause racine de l'echec reservation
 */
function diagnoseReservationFailure(tenantId, test) {
  const error = test.error || '';

  // Service non trouve
  if (/service.*introuvable|service.*trouve|service_nom.*match/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Service non trouve lors de la reservation',
      error.substring(0, 200),
      null,
      'Verifier que les services crees par seedProfileData matchent les noms utilises dans createReservationUnified',
      { tenantId });
  }

  // Erreur BDD / schema
  if (/schema|PGRST|42P01|column|colonne/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Erreur schema BDD lors de la reservation',
      error.substring(0, 200),
      null,
      'Migration BDD manquante — verifier la structure de la table reservations',
      { tenantId });
  }

  // Permission / RLS
  if (/permission|denied|RLS/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Permission refusee (RLS) pour creer la reservation',
      error.substring(0, 200),
      null,
      'Verifier les policies RLS sur la table reservations pour ce tenant',
      { tenantId });
  }

  // Erreur createReservationUnified generique
  return makeDiag('DIAGNOSED', test.name,
    'Reservation echouee — createReservationUnified a retourne une erreur',
    error.substring(0, 200),
    null,
    'Verifier createReservationUnified dans nexusCore.js — logs serveur pour detail',
    { tenantId });
}

/**
 * H2 — Facturation / ecritures VT/BQ echouee
 * Diagnostique la cascade reservation → facture → ecritures
 */
function diagnoseFacturationFailure(tenantId, test) {
  const error = test.error || '';

  // H1 en echec → cascade
  if (/h1.*echec|skip.*h2|h1.*skip/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Test saute — depend de H1 (reservation) qui a echoue',
      'H2 facturation ne peut pas s\'executer sans reservation H1 reussie',
      null,
      'Corriger d\'abord l\'echec H1 (reservation) — H2 suivra automatiquement',
      { tenantId, dependency: 'H1_reservation_unified' });
  }

  // Creation facture echouee
  if (/creation facture echouee|facture.*echouee|factureresult/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Creation de la facture echouee',
      error.substring(0, 200),
      null,
      'Verifier createFactureFromReservation dans factures.js — reservation peut manquer de service_nom ou de montant',
      { tenantId });
  }

  // Ecritures VT non generees
  if (/ecritures vt non generees|vt.*non.*genere/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Ecritures comptables VT non generees apres creation facture',
      error.substring(0, 200),
      null,
      'Verifier genererEcrituresFacture dans factures.js — facture existe mais ecritures VT absentes',
      { tenantId });
  }

  // Ecritures VT desequilibrees
  if (/vt.*desequilibree/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Ecritures VT desequilibrees (debit != credit)',
      error.substring(0, 200),
      null,
      'Verifier le calcul TVA dans genererEcrituresFacture — debit/credit totaux ne matchent pas',
      { tenantId });
  }

  // Ecritures BQ non generees
  if (/ecritures bq non generees|bq.*non.*genere/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Ecritures BQ (paiement) non generees',
      error.substring(0, 200),
      null,
      'Verifier genererEcrituresPaiement dans factures.js — facture payee mais ecritures BQ absentes',
      { tenantId });
  }

  // Ecritures BQ desequilibrees
  if (/bq.*desequilibree/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Ecritures BQ desequilibrees (debit != credit)',
      error.substring(0, 200),
      null,
      'Verifier le calcul dans genererEcrituresPaiement — montant TTC vs ecritures banque/client',
      { tenantId });
  }

  // Erreur schema / BDD
  if (/schema|PGRST|42P01|column|colonne/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Erreur schema BDD lors de la facturation',
      error.substring(0, 200),
      null,
      'Migration manquante — verifier les colonnes des tables factures et ecritures_comptables',
      { tenantId });
  }

  // Erreur generique facturation
  return makeDiag('DIAGNOSED', test.name,
    'Echec facturation — erreur dans le flux facture/ecritures',
    error.substring(0, 200),
    null,
    'Verifier les logs serveur pour createFactureFromReservation et genererEcrituresFacture',
    { tenantId });
}

/**
 * H7 — Chat IA echoue
 * Diagnostique les erreurs de l'assistant IA
 */
function diagnoseChatIAFailure(tenantId, test) {
  const error = test.error || '';

  // Config IA manquante
  if (/TENANT_ID_REQUIRED|configuration.*manquante|config.*ia/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Configuration IA manquante pour ce tenant',
      error.substring(0, 200),
      null,
      'Verifier que le tenant a une config IA active (cle API, modele, etc.) dans profile_config',
      { tenantId });
  }

  // Erreur API Claude / timeout
  if (/timeout|delai.*depasse|ECONNREFUSED|502|503|529|overloaded/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'API Claude indisponible ou timeout',
      error.substring(0, 200),
      null,
      'Probleme temporaire API — aucune action requise si ponctuel. Verifier le statut Anthropic si recurrent.',
      { tenantId });
  }

  // Quota / rate limit
  if (/rate.*limit|quota|429|credit/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Rate limit ou quota API IA atteint',
      error.substring(0, 200),
      null,
      'Verifier les credits Anthropic et le rate limiting. Reduire la frequence PLTE si necessaire.',
      { tenantId });
  }

  // Reponse vide ou trop courte
  if (/reponse.*trop courte|reponse.*vide|pas de reponse/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Reponse IA vide ou trop courte',
      error.substring(0, 200),
      null,
      'L\'IA a repondu mais contenu insuffisant — verifier le prompt systeme et les outils disponibles',
      { tenantId });
  }

  // Erreur schema BDD
  if (/schema|PGRST|colonne/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Erreur BDD dans le traitement IA',
      error.substring(0, 200),
      null,
      'Schema BDD incomplet — migration manquante affectant processMessage',
      { tenantId });
  }

  // Erreur generique IA
  return makeDiag('DIAGNOSED', test.name,
    'Echec Chat IA — erreur dans processMessage',
    error.substring(0, 200),
    null,
    'Verifier les logs serveur pour processMessage — erreur IA non categorisee',
    { tenantId });
}

/**
 * P_* — Tests profil (bootstrap data manquante)
 * Diagnostique les donnees metier manquantes par profil
 */
function diagnoseProfileBootstrap(tenantId, test) {
  const error = test.error || '';
  const name = test.name || '';

  // Restaurant — tables
  if (/table/i.test(error) || name.includes('restaurant_table')) {
    return makeDiag('DIAGNOSED', test.name,
      'Tables restaurant non configurees dans le bootstrap',
      error.substring(0, 200),
      null,
      'Verifier seedProfileData pour le profil restaurant — tables avec zone et capacite doivent etre creees',
      { tenantId, profile: 'restaurant', missing: 'tables' });
  }

  // Hotel — chambres
  if (/chambre/i.test(error) || name.includes('hotel_chambre')) {
    return makeDiag('DIAGNOSED', test.name,
      'Chambres hotel non configurees dans le bootstrap',
      error.substring(0, 200),
      null,
      'Verifier seedProfileData pour le profil hotel — chambres avec type et capacite doivent etre creees',
      { tenantId, profile: 'hotel', missing: 'chambres' });
  }

  // Securite — agents / sites
  if (/agent/i.test(error) || /site/i.test(error) || name.includes('securite')) {
    return makeDiag('DIAGNOSED', test.name,
      'Agents ou sites securite non configures dans le bootstrap',
      error.substring(0, 200),
      null,
      'Verifier seedProfileData pour le profil securite — agents et sites doivent etre crees',
      { tenantId, profile: 'securite', missing: 'agents/sites' });
  }

  // Domicile — zones intervention
  if (/zone/i.test(error) || name.includes('domicile')) {
    return makeDiag('DIAGNOSED', test.name,
      'Zones intervention non configurees dans le bootstrap',
      error.substring(0, 200),
      null,
      'Verifier seedProfileData pour le profil domicile — zones avec rayon_km doivent etre creees',
      { tenantId, profile: 'domicile', missing: 'zones' });
  }

  // Generique profil — prix, services, forfaits
  if (/prix|service|forfait/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Configuration metier manquante (services/prix)',
      error.substring(0, 200),
      null,
      'Verifier seedProfileData — services avec prix doivent etre crees pour ce profil',
      { tenantId, missing: 'services/prix' });
  }

  // Capacite manquante
  if (/capacite/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Capacite non definie sur les entites metier',
      error.substring(0, 200),
      null,
      'Verifier seedProfileData — champ capacite requis sur tables/chambres/zones',
      { tenantId, missing: 'capacite' });
  }

  // Generique profil
  return makeDiag('DIAGNOSED', test.name,
    'Donnees metier profil manquantes dans le bootstrap',
    error.substring(0, 200),
    null,
    'Verifier seedProfileData pour ce profil — donnees metier non creees ou incompletes',
    { tenantId });
}

// ============================================
// HANDLERS DIAGNOSTIQUES — ORIGINAUX (coherence, BQ, fidelite, stock, avoir)
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
// HANDLERS DIAGNOSTIQUES — N15-N34
// ============================================

/**
 * N15 — Order cycle failure
 */
async function diagnoseOrderFailure(tenantId, test) {
  const error = test.error || '';

  try {
    const { data } = await supabase
      .from('product_stock')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);

    if (!data?.length) {
      return makeDiag('DIAGNOSED', test.name,
        'Table product_stock vide — seedProductStock non execute',
        error.substring(0, 200),
        null,
        'Verifier que seedProductStock() est appele dans le bootstrap commerce',
        { tenantId });
    }
  } catch { /* table may not exist */ }

  if (/PGRST205|42P01/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Table orders ou product_stock inexistante',
      error.substring(0, 200),
      null,
      'Migration BDD manquante — creer les tables orders et product_stock',
      { tenantId });
  }

  return makeDiag('DIAGNOSED', test.name,
    'Cycle commande echoue',
    error.substring(0, 200),
    null,
    'Verifier orderService.js — createOrder/updateOrderStatus/cancelOrder',
    { tenantId });
}

/**
 * N17 — CRM pipeline failure
 */
async function diagnoseCRMFailure(tenantId, test) {
  const error = test.error || '';

  try {
    const { data: contacts } = await supabase
      .from('crm_contacts')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);

    if (!contacts) {
      return makeDiag('DIAGNOSED', test.name,
        'Table crm_contacts inaccessible',
        error.substring(0, 200),
        null,
        'Migration CRM manquante — verifier tables crm_contacts et quotes',
        { tenantId });
    }
  } catch { /* table may not exist */ }

  try {
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);

    if (!quotes) {
      return makeDiag('DIAGNOSED', test.name,
        'Table quotes inaccessible',
        error.substring(0, 200),
        null,
        'Migration CRM manquante — creer la table quotes',
        { tenantId });
    }
  } catch { /* table may not exist */ }

  return makeDiag('DIAGNOSED', test.name,
    'Pipeline CRM echoue',
    error.substring(0, 200),
    null,
    'Verifier crmService.js — createContact/createQuote/sendQuote/acceptQuote',
    { tenantId });
}

/**
 * N21 — Notification cascade failure
 */
function diagnoseNotificationCascade(tenantId, test) {
  const error = test.error || '';

  if (/config|smtp|resend|api.*key/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Configuration email/notification manquante',
      error.substring(0, 200),
      null,
      'Configurer Resend API key ou SMTP pour activer les notifications email',
      { tenantId });
  }

  return makeDiag('DIAGNOSED', test.name,
    'Cascade notification echouee',
    error.substring(0, 200),
    null,
    'Verifier notificationCascadeService.js — sendWithCascade et getStats',
    { tenantId });
}

/**
 * N22 — Social post failure
 */
async function diagnoseSocialFailure(tenantId, test) {
  const error = test.error || '';

  try {
    const { data } = await supabase
      .from('social_posts')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);

    if (!data) {
      return makeDiag('DIAGNOSED', test.name,
        'Table social_posts inaccessible',
        error.substring(0, 200),
        null,
        'Migration manquante — creer la table social_posts',
        { tenantId });
    }
  } catch { /* table may not exist */ }

  return makeDiag('DIAGNOSED', test.name,
    'Cycle social post echoue',
    error.substring(0, 200),
    null,
    'Verifier socialService.js — createPost/schedulePost/getPostStats',
    { tenantId });
}

/**
 * N23 — Voice AI failure
 */
function diagnoseVoiceAI(tenantId, test) {
  const error = test.error || '';

  // Reuse chat IA pattern
  if (/TENANT_ID_REQUIRED|configuration.*manquante|config/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Configuration Voice AI manquante pour ce tenant',
      error.substring(0, 200),
      null,
      'Verifier que le tenant a une config IA active dans profile_config',
      { tenantId });
  }

  if (/timeout|ECONNREFUSED|502|503|529|overloaded/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'API IA indisponible ou timeout lors du voice AI',
      error.substring(0, 200),
      null,
      'Probleme temporaire API — aucune action requise si ponctuel',
      { tenantId });
  }

  return makeDiag('DIAGNOSED', test.name,
    'Voice AI echoue',
    error.substring(0, 200),
    null,
    'Verifier voiceAIService.js — getVoiceResponse',
    { tenantId });
}

/**
 * N25 — RGPD failure
 */
async function diagnoseRGPDFailure(tenantId, test) {
  const error = test.error || '';

  try {
    const { data } = await supabase
      .from('client_consents')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);

    if (!data) {
      return makeDiag('DIAGNOSED', test.name,
        'Table client_consents inaccessible',
        error.substring(0, 200),
        null,
        'Migration RGPD manquante — verifier migration 082_client_consents.sql',
        { tenantId });
    }
  } catch { /* table may not exist */ }

  return makeDiag('DIAGNOSED', test.name,
    'RGPD consent cycle echoue',
    error.substring(0, 200),
    null,
    'Verifier consentService.js — grantConsent/hasConsent/revokeConsent',
    { tenantId });
}

/**
 * N26 — Usage quota failure
 */
async function diagnoseUsageQuota(tenantId, test) {
  const error = test.error || '';

  try {
    const { data } = await supabase
      .from('usage_tracking')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);

    if (!data) {
      return makeDiag('DIAGNOSED', test.name,
        'Table usage_tracking inaccessible',
        error.substring(0, 200),
        null,
        'Migration manquante — creer la table usage_tracking',
        { tenantId });
    }
  } catch { /* table may not exist */ }

  return makeDiag('DIAGNOSED', test.name,
    'Usage quota echoue',
    error.substring(0, 200),
    null,
    'Verifier usageTrackingService.js — trackUsage/getMonthlyUsage/checkQuota',
    { tenantId });
}

/**
 * N27 — FEC export failure
 */
function diagnoseFECFailure(tenantId, test) {
  const error = test.error || '';

  if (/SIREN|entreprise/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'SIREN ou informations entreprise manquantes pour FEC',
      error.substring(0, 200),
      null,
      'Configurer le SIREN du tenant dans les parametres entreprise',
      { tenantId });
  }

  if (/aucune.*ecriture|no.*ecriture/i.test(error)) {
    return makeDiag('DIAGNOSED', test.name,
      'Aucune ecriture comptable pour generer le FEC',
      error.substring(0, 200),
      null,
      'Normal si le tenant n\'a pas encore d\'activite comptable',
      { tenantId });
  }

  return makeDiag('DIAGNOSED', test.name,
    'Export FEC echoue',
    error.substring(0, 200),
    null,
    'Verifier fecExportService.js — validateFEC/generateFEC + config entreprise',
    { tenantId });
}

/**
 * N28 — RH avance failure
 */
async function diagnoseRHAvance(tenantId, test) {
  const error = test.error || '';

  try {
    const { data } = await supabase
      .from('hr_employees')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);

    if (!data) {
      return makeDiag('DIAGNOSED', test.name,
        'Table hr_employees inaccessible',
        error.substring(0, 200),
        null,
        'Migration HR manquante — creer la table hr_employees',
        { tenantId });
    }
  } catch { /* table may not exist */ }

  return makeDiag('DIAGNOSED', test.name,
    'Cycle RH avance echoue',
    error.substring(0, 200),
    null,
    'Verifier hrService.js — createEmployee/clockIn/clockOut/requestLeave/approveLeave',
    { tenantId });
}

/**
 * N3 — Bulletin paie failure
 */
async function diagnoseBulletinPaie(tenantId, test) {
  const error = test.error || '';

  try {
    const { data } = await supabase
      .from('rh_bulletins_paie')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);

    if (!data) {
      return makeDiag('DIAGNOSED', test.name,
        'Table rh_bulletins_paie inaccessible',
        error.substring(0, 200),
        null,
        'Migration paie manquante — verifier table rh_bulletins_paie (migration 089)',
        { tenantId });
    }
  } catch { /* table may not exist */ }

  // Verifier qu'il y a des employes test
  try {
    const { data: membres } = await supabase
      .from('rh_membres')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);

    if (!membres?.length) {
      return makeDiag('DIAGNOSED', test.name,
        'Aucun membre RH pour ce tenant',
        error.substring(0, 200),
        null,
        'Bootstrap RH incomplet — aucun employe dans rh_membres pour generer un bulletin',
        { tenantId });
    }
  } catch { /* table may not exist */ }

  return makeDiag('DIAGNOSED', test.name,
    'Bulletin de paie echoue',
    error.substring(0, 200),
    null,
    'Verifier coherence salaire_brut - cotisations = salaire_net dans rh_bulletins_paie',
    { tenantId });
}

/**
 * N29 — Pointage sync failure
 */
async function diagnosePointageSync(tenantId, test) {
  const error = test.error || '';

  try {
    const { data } = await supabase
      .from('rh_pointage')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);

    if (!data) {
      return makeDiag('DIAGNOSED', test.name,
        'Table rh_pointage inaccessible',
        error.substring(0, 200),
        null,
        'Migration pointage manquante — verifier table rh_pointage (migration 024)',
        { tenantId });
    }
  } catch { /* table may not exist */ }

  return makeDiag('DIAGNOSED', test.name,
    'Synchronisation pointage echouee',
    error.substring(0, 200),
    null,
    'Verifier pointageService.js — synchroniserPointageDepuisReservations requiert des reservations terminees avec membre_id',
    { tenantId });
}

/**
 * N32 — Referral failure
 */
async function diagnoseReferralFailure(tenantId, test) {
  const error = test.error || '';

  try {
    const { data } = await supabase
      .from('referrals')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1);

    if (!data) {
      return makeDiag('DIAGNOSED', test.name,
        'Table referrals inaccessible',
        error.substring(0, 200),
        null,
        'Migration manquante — creer la table referrals',
        { tenantId });
    }
  } catch { /* table may not exist */ }

  return makeDiag('DIAGNOSED', test.name,
    'Generation code referral echoue',
    error.substring(0, 200),
    null,
    'Verifier referralService.js — generateReferralCode',
    { tenantId });
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
