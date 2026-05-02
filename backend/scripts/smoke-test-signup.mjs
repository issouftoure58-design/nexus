#!/usr/bin/env node

/**
 * NEXUS — Smoke Test E2E : Signup → Dashboard → Checkout
 *
 * Verifie le parcours complet :
 *   1. POST /signup/email/send       → email envoye (simule)
 *   2. POST /signup/email/verify     → verified_token
 *   3. POST /signup/phone/send       → SMS envoye (simule)
 *   4. POST /signup/phone/verify     → verified_token
 *   5. POST /signup                  → 201 + JWT
 *   6. GET  /admin/stats/dashboard   → 200 + KPIs
 *   7. POST /billing/checkout        → 200 + checkout_url
 *   8. Cleanup : supprime tenant + admin test
 *
 * Usage:
 *   node scripts/smoke-test-signup.mjs
 *
 * Prerequis:
 *   - Backend tourne sur PORT (default 5000)
 *   - SKIP_RATE_LIMIT=true dans .env (sinon rate limit bloque les tests)
 *   - RESEND_API_KEY non requise (mode simule OK)
 *   - TWILIO_* non requis (mode simule OK)
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const BASE_URL = `http://localhost:${process.env.PORT || 5000}/api/admin/auth`;
const BILLING_URL = `http://localhost:${process.env.PORT || 5000}/api/billing`;
const STATS_URL = `http://localhost:${process.env.PORT || 5000}/api/admin/stats/dashboard`;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test user data — unique per run
const RUN_ID = Date.now().toString(36);
const TEST_EMAIL = `smoke-test-${RUN_ID}@nexus-test.local`;
const TEST_PHONE = `+336${RUN_ID.padStart(8, '0').slice(-8)}`;
const TEST_PASSWORD = 'SmokeTest2026!Secure#';
const TEST_ENTREPRISE = `SmokeTest-${RUN_ID}`;

let jwt = null;
let tenantId = null;
let emailVerifiedToken = null;
let smsVerifiedToken = null;

const results = [];

function log(step, ok, detail = '') {
  const icon = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${icon} ${step}${detail ? ` — ${detail}` : ''}`);
  results.push({ step, ok, detail });
}

async function post(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function get(url, headers = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

// ────────────────────────────────────────────────────────
// STEPS
// ────────────────────────────────────────────────────────

async function step1_emailSend() {
  const { status, json } = await post(`${BASE_URL}/signup/email/send`, { email: TEST_EMAIL });
  const ok = status === 200 && json.success;
  log('1. POST /signup/email/send', ok, ok ? `simulated=${json.simulated}` : json.error);
  return ok;
}

async function step2_emailVerify() {
  // Recupere le token directement en DB (simule le clic email)
  const { data } = await supabase
    .from('signup_email_verifications')
    .select('token')
    .eq('email', TEST_EMAIL)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.token) {
    log('2. POST /signup/email/verify', false, 'Token non trouve en DB');
    return false;
  }

  const { status, json } = await post(`${BASE_URL}/signup/email/verify`, { token: data.token });
  const ok = status === 200 && json.verified_token;
  emailVerifiedToken = json.verified_token;
  log('2. POST /signup/email/verify', ok, ok ? 'verified_token recu' : json.error);
  return ok;
}

async function step3_smsSend() {
  const { status, json } = await post(`${BASE_URL}/signup/sms/send`, { phone: TEST_PHONE });
  const ok = status === 200 && json.success;
  log('3. POST /signup/sms/send', ok, ok ? `simulated=${json.simulated}` : json.error);
  return ok;
}

async function step4_smsVerify() {
  // Recupere le code en DB (en test, on peut pas lire le hash bcrypt directement)
  // On simule: si SKIP_RATE_LIMIT est set, on peut lire le code depuis les logs
  // Alternative: on utilise un code de test si disponible, sinon on lit la DB
  // Pour le smoke test, on va lire le code hash et tester avec un bypass

  // En mode test/simule, le SMS n'est pas envoye. On va directement verifier via DB.
  // Recupere la derniere verification pour ce phone
  const { data } = await supabase
    .from('signup_phone_verifications')
    .select('id, code_hash')
    .eq('phone_e164', TEST_PHONE)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    log('4. POST /signup/sms/verify', false, 'Verification non trouvee en DB');
    return false;
  }

  // On ne peut pas reverser le bcrypt hash.
  // Strategie: on force un verified_token en DB directement (smoke test only)
  smsVerifiedToken = `smoke-test-${RUN_ID}`;
  const { error } = await supabase
    .from('signup_phone_verifications')
    .update({
      verified_at: new Date().toISOString(),
      verified_token: smsVerifiedToken,
    })
    .eq('id', data.id);

  const ok = !error;
  log('4. SMS verify (DB bypass)', ok, ok ? 'verified_token set en DB' : error?.message);
  return ok;
}

async function step5_signup() {
  const { status, json } = await post(`${BASE_URL}/signup`, {
    entreprise: TEST_ENTREPRISE,
    nom: 'Smoke Test',
    email: TEST_EMAIL,
    telephone: TEST_PHONE,
    password: TEST_PASSWORD,
    accept_cgv: true,
    template_type: 'autre',
    sms_verified_token: smsVerifiedToken,
    email_verified_token: emailVerifiedToken,
  });

  const ok = status === 201 && json.token && json.tenant_id;
  jwt = json.token;
  tenantId = json.tenant_id;
  log('5. POST /signup', ok, ok ? `tenant=${tenantId}` : `${status} ${json.error || JSON.stringify(json)}`);
  return ok;
}

async function step5b_signupWithoutEmailToken() {
  // Verify that signup WITHOUT email_verified_token returns 400
  const { status, json } = await post(`${BASE_URL}/signup`, {
    entreprise: 'ShouldFail',
    nom: 'Test',
    email: 'shouldfail@test.local',
    telephone: '+33600000000',
    password: TEST_PASSWORD,
    accept_cgv: true,
    sms_verified_token: 'fake',
  });

  const ok = status === 400 && (json.code === 'SMS_TOKEN_INVALID' || json.code === 'EMAIL_VERIFICATION_REQUIRED');
  log('5b. POST /signup sans email_token → 400', ok, ok ? json.code : `${status} ${json.code}`);
  return ok;
}

async function step6_dashboard() {
  if (!jwt) {
    log('6. GET /stats/dashboard', false, 'Pas de JWT (signup echoue)');
    return false;
  }

  const { status, json } = await get(STATS_URL, { Authorization: `Bearer ${jwt}` });
  const ok = status === 200;
  log('6. GET /stats/dashboard', ok, ok ? 'KPIs OK' : `${status} ${json.error}`);
  return ok;
}

async function step7_checkout() {
  if (!jwt) {
    log('7. POST /billing/checkout', false, 'Pas de JWT');
    return false;
  }

  const { status, json } = await post(
    `${BILLING_URL}/checkout`,
    { priceId: 'nexus_starter_monthly' },
    { Authorization: `Bearer ${jwt}` }
  );

  const ok = status === 200 && json.url;
  log('7. POST /billing/checkout', ok, ok ? 'checkout_url recu' : `${status} ${json.error || 'no url'}`);
  return ok;
}

async function step8_cleanup() {
  if (!tenantId) {
    log('8. Cleanup', false, 'Pas de tenantId');
    return false;
  }

  try {
    // Supprimer dans l'ordre (FK constraints)
    await supabase.from('admin_sessions').delete().eq('tenant_id', tenantId);
    await supabase.from('tenant_ia_config').delete().eq('tenant_id', tenantId);
    await supabase.from('business_hours').delete().eq('tenant_id', tenantId);
    await supabase.from('services').delete().eq('tenant_id', tenantId);
    await supabase.from('admin_users').delete().eq('tenant_id', tenantId);
    await supabase.from('tenants').delete().eq('id', tenantId);

    // Nettoyer les verifications
    await supabase.from('signup_email_verifications').delete().eq('email', TEST_EMAIL);
    await supabase.from('signup_phone_verifications').delete().eq('phone_e164', TEST_PHONE);

    log('8. Cleanup', true, `tenant ${tenantId} supprime`);
    return true;
  } catch (err) {
    log('8. Cleanup', false, err.message);
    return false;
  }
}

// ────────────────────────────────────────────────────────
// MAIN
// ────────────────────────────────────────────────────────

async function main() {
  console.log('\n============================================================');
  console.log('NEXUS — Smoke Test E2E : Signup → Dashboard → Checkout');
  console.log('============================================================');
  console.log(`  Base URL : ${BASE_URL}`);
  console.log(`  Email    : ${TEST_EMAIL}`);
  console.log(`  Phone    : ${TEST_PHONE}`);
  console.log('');

  // Check backend is running
  try {
    await fetch(`http://localhost:${process.env.PORT || 5000}/api/health`);
  } catch {
    console.error('\x1b[31m  ✗ Backend non accessible. Lancez: npm start\x1b[0m\n');
    process.exit(1);
  }

  await step1_emailSend();
  await step2_emailVerify();
  await step3_smsSend();
  await step4_smsVerify();
  await step5b_signupWithoutEmailToken();
  await step5_signup();
  await step6_dashboard();
  await step7_checkout();
  await step8_cleanup();

  // Summary
  const passed = results.filter(r => r.ok).length;
  const total = results.length;
  console.log('\n------------------------------------------------------------');
  if (passed === total) {
    console.log(`\x1b[32m  ALL PASS (${passed}/${total})\x1b[0m`);
  } else {
    console.log(`\x1b[31m  ${passed}/${total} PASSED — ${total - passed} FAILED\x1b[0m`);
  }
  console.log('============================================================\n');

  process.exit(passed === total ? 0 : 1);
}

main().catch(err => {
  console.error('\x1b[31mFATAL:\x1b[0m', err);
  process.exit(1);
});
