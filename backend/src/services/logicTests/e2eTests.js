/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * PLTE E2E — Tests parcours utilisateur complet via HTTP
 * 10 contextes, 34 tests, tenants ephemeres
 */

import { supabase } from '../../config/supabase.js';
import { cleanupE2ETenant } from './bootstrap.js';
import bcrypt from 'bcryptjs';

const BASE_URL = `http://localhost:${process.env.PORT || 3001}`;
const E2E_PREFIX = '_E2E_PLTE_';
const E2E_PASSWORD = 'Nexus2026E2E!Secure';

// ============================================
// HELPERS
// ============================================

async function apiCall(method, path, token = null, body = null, { tenantId } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-ID'] = tenantId;

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      // Response may not be JSON (e.g. 204)
    }

    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: null, error: err.message };
  }
}

function makeResult(name, module, severity, description, passed, error = null) {
  return {
    name,
    category: 'e2e',
    module,
    description,
    severity,
    status: error ? 'error' : passed ? 'pass' : 'fail',
    error: error || (passed ? null : 'Assertion failed'),
  };
}

/**
 * Cree un tenant ephemere via INSERT direct Supabase (pas de signup HTTP)
 * Utilise pour C4, C8, C10 qui n'ont pas besoin du flow signup complet
 */
async function createDirectTenant(suffix, options = {}) {
  const tenantId = `${E2E_PREFIX}${suffix}-${Date.now()}`;
  const email = `${tenantId}@plte.internal`.toLowerCase();
  const plan = options.plan || 'business';
  const statut = options.statut || 'essai';
  const essaiFin = options.essai_fin || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  // Insert tenant (tier + status requis par schema)
  const { error: tenantErr } = await supabase.from('tenants').insert({
    id: tenantId,
    name: `${E2E_PREFIX}${suffix}`,
    tier: plan,
    status: statut === 'essai' ? 'trial' : 'active',
    domain: `${tenantId}.nexus.app`,
    plan,
    statut,
    essai_fin: essaiFin,
    onboarding_completed: true,
    structure_juridique: 'company',
    modules_actifs: ['reservations', 'whatsapp', 'marketing', 'seo', 'comptabilite', 'fidelite', 'rh', 'stock'],
    created_at: new Date().toISOString(),
  });
  if (tenantErr) throw new Error(`Tenant creation failed: ${tenantErr.message}`);

  // Insert admin user with hashed password
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);
  const { data: admin, error: adminErr } = await supabase
    .from('admin_users')
    .insert({
      tenant_id: tenantId,
      email,
      password_hash: passwordHash,
      nom: `${E2E_PREFIX}Admin`,
      role: 'owner',
      actif: true,
      created_at: new Date().toISOString(),
    })
    .select('id, email')
    .single();
  if (adminErr) throw new Error(`Admin creation failed: ${adminErr.message}`);

  // Login to get a real token
  const { status, data } = await apiCall('POST', '/api/admin/auth/login', null, {
    email,
    password: E2E_PASSWORD,
  });

  if (status !== 200 || !data?.token) {
    throw new Error(`Login failed for direct tenant: status=${status}, email=${email}, error=${data?.error || 'unknown'}`);
  }

  return { tenantId, email, token: data.token, adminId: admin.id };
}

// ============================================
// PREREQUIS CHECK
// ============================================

async function checkPrerequisites() {
  // Check plans table has at least one plan
  const { data: plans } = await supabase
    .from('plans')
    .select('id')
    .limit(1);

  // Check secteurs table
  const { data: secteurs } = await supabase
    .from('secteurs')
    .select('id')
    .limit(1);

  return {
    hasPlans: plans?.length > 0,
    hasSecteurs: secteurs?.length > 0,
    planId: plans?.[0]?.id || null,
    secteurId: secteurs?.[0]?.id || null,
  };
}

// ============================================
// C1 — SIGNUP COMPLET
// ============================================

async function runContext_C1_signup() {
  const results = [];
  const companyName = `${E2E_PREFIX}Salon-${Date.now()}`;
  const email = `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}@plte.internal`;
  let tenantId = null;
  let token = null;

  // Check prerequisites
  const prereqs = await checkPrerequisites();
  if (!prereqs.hasSecteurs) {
    results.push(makeResult('C1_01_signup', 'signup', 'critical',
      'POST /api/signup retourne 200 avec token + tenant_id', false,
      'SKIP: table secteurs vide, impossible de tester signup'));
    return { results, tenantId: null, token: null };
  }

  // C1_01: Signup
  try {
    const signupBody = {
      company_name: companyName,
      email,
      password: E2E_PASSWORD,
      plan_id: 'business',
      secteur_id: prereqs.secteurId,
      prenom: 'PLTE',
      nom: 'E2E',
      structure_juridique: 'company',
    };

    const { status, data } = await apiCall('POST', '/api/signup', null, signupBody);

    if (status === 429) {
      // Rate limited — fallback to direct tenant creation
      results.push(makeResult('C1_01_signup', 'signup', 'critical',
        'POST /api/signup retourne 200 avec token + tenant_id', false,
        'Rate limited (429) — fallback direct tenant'));

      const direct = await createDirectTenant('signup', { plan: 'business', statut: 'essai' });
      tenantId = direct.tenantId;
      token = direct.token;

      // Mark onboarding as not completed for C2
      await supabase.from('tenants').update({ onboarding_completed: false }).eq('id', tenantId);
    } else {
      const passed = status === 200 && data?.tenant_id && (data?.token || data?.admin);
      tenantId = data?.tenant_id || null;

      results.push(makeResult('C1_01_signup', 'signup', 'critical',
        'POST /api/signup retourne 200 avec token + tenant_id', passed,
        passed ? null : `status=${status}, tenant_id=${data?.tenant_id}`));

      // Login to get a proper token (signup may not return one directly)
      if (tenantId) {
        const loginRes = await apiCall('POST', '/api/admin/auth/login', null, {
          email,
          password: E2E_PASSWORD,
        });
        token = loginRes.data?.token || null;
      }
    }
  } catch (err) {
    results.push(makeResult('C1_01_signup', 'signup', 'critical',
      'POST /api/signup retourne 200 avec token + tenant_id', false, err.message));
  }

  if (!tenantId || !token) {
    // Cannot continue C1 without tenant
    results.push(makeResult('C1_02_tenant_existe', 'signup', 'critical',
      'GET /api/tenants/me retourne le tenant', false, 'No tenant_id/token from signup'));
    results.push(makeResult('C1_03_admin_existe', 'signup', 'critical',
      'Token valide, pas de 401', false, 'No token'));
    results.push(makeResult('C1_04_services_seeded', 'signup', 'warning',
      'Services du template crees', false, 'No token'));
    return { results, tenantId: null, token: null };
  }

  // C1_02: Tenant exists
  try {
    const { status, data } = await apiCall('GET', '/api/tenants/me', token);
    const tenant = data?.tenant;
    const passed = status === 200 && tenant?.name && tenant?.statut;
    results.push(makeResult('C1_02_tenant_existe', 'signup', 'critical',
      'GET /api/tenants/me retourne le tenant', passed,
      passed ? null : `status=${status}, name=${tenant?.name}`));
  } catch (err) {
    results.push(makeResult('C1_02_tenant_existe', 'signup', 'critical',
      'GET /api/tenants/me retourne le tenant', false, err.message));
  }

  // C1_03: Admin has valid access
  try {
    const { status } = await apiCall('GET', '/api/tenants/me', token);
    const passed = status !== 401;
    results.push(makeResult('C1_03_admin_existe', 'signup', 'critical',
      'Token valide, pas de 401', passed,
      passed ? null : 'Got 401 with valid token'));
  } catch (err) {
    results.push(makeResult('C1_03_admin_existe', 'signup', 'critical',
      'Token valide, pas de 401', false, err.message));
  }

  // C1_04: Services seeded
  try {
    const { status, data } = await apiCall('GET', '/api/admin/services', token);
    const services = data?.services || data?.data || data || [];
    const passed = status === 200 && Array.isArray(services) && services.length >= 1;
    results.push(makeResult('C1_04_services_seeded', 'signup', 'warning',
      'Services du template crees (length >= 1)', passed,
      passed ? null : `status=${status}, count=${Array.isArray(services) ? services.length : 0}`));
  } catch (err) {
    results.push(makeResult('C1_04_services_seeded', 'signup', 'warning',
      'Services du template crees (length >= 1)', false, err.message));
  }

  return { results, tenantId, token, email };
}

// ============================================
// C2 — ONBOARDING
// ============================================

async function runContext_C2_onboarding(tenantId, token) {
  const results = [];
  if (!tenantId || !token) {
    results.push(makeResult('C2_01_onboarding_requis', 'onboarding', 'critical',
      'onboarding_completed === false', false, 'No tenant/token from C1'));
    return results;
  }

  // C2_01: Onboarding not yet completed
  try {
    const { status, data } = await apiCall('GET', '/api/tenants/me', token);
    const tenant = data?.tenant;
    const passed = status === 200 && tenant?.onboarding_completed === false;
    results.push(makeResult('C2_01_onboarding_requis', 'onboarding', 'critical',
      'onboarding_completed === false', passed,
      passed ? null : `onboarding_completed=${tenant?.onboarding_completed}`));
  } catch (err) {
    results.push(makeResult('C2_01_onboarding_requis', 'onboarding', 'critical',
      'onboarding_completed === false', false, err.message));
  }

  // C2_02: Complete onboarding
  try {
    const { status, data } = await apiCall('PATCH', '/api/tenants/me/complete-onboarding', token);
    const passed = status === 200;
    results.push(makeResult('C2_02_complete_onboarding', 'onboarding', 'critical',
      'PATCH complete-onboarding retourne 200', passed,
      passed ? null : `status=${status}, error=${data?.error}`));
  } catch (err) {
    results.push(makeResult('C2_02_complete_onboarding', 'onboarding', 'critical',
      'PATCH complete-onboarding retourne 200', false, err.message));
  }

  // C2_03: Onboarding now completed
  try {
    const { status, data } = await apiCall('GET', '/api/tenants/me', token);
    const tenant = data?.tenant;
    const passed = status === 200 && tenant?.onboarding_completed === true;
    results.push(makeResult('C2_03_onboarding_fait', 'onboarding', 'critical',
      'onboarding_completed === true apres complete', passed,
      passed ? null : `onboarding_completed=${tenant?.onboarding_completed}`));
  } catch (err) {
    results.push(makeResult('C2_03_onboarding_fait', 'onboarding', 'critical',
      'onboarding_completed === true apres complete', false, err.message));
  }

  return results;
}

// ============================================
// C3 — RESTRICTIONS ESSAI
// ============================================

async function runContext_C3_restrictions(tenantId, token) {
  const results = [];
  if (!tenantId || !token) {
    return [makeResult('C3_01_plan_starter', 'plan', 'critical',
      'Plan effectif = starter en mode essai', false, 'No tenant/token')];
  }

  // C3_01: Plan effectif = starter en essai
  try {
    const { status, data } = await apiCall('GET', '/api/tenants/me', token);
    const tenant = data?.tenant;
    const passed = status === 200 && tenant?.plan === 'starter' && tenant?.plan_choisi === 'business';
    results.push(makeResult('C3_01_plan_starter', 'plan', 'critical',
      'plan=starter, plan_choisi=business en mode essai', passed,
      passed ? null : `plan=${tenant?.plan}, plan_choisi=${tenant?.plan_choisi}, statut=${tenant?.statut}`));
  } catch (err) {
    results.push(makeResult('C3_01_plan_starter', 'plan', 'critical',
      'plan=starter, plan_choisi=business en mode essai', false, err.message));
  }

  // C3_02: WhatsApp bloqué en essai
  try {
    const { status, data } = await apiCall('GET', '/api/tenants/me', token);
    const modules = data?.tenant?.modules;
    const passed = status === 200 && modules?.whatsapp !== true;
    results.push(makeResult('C3_02_whatsapp_bloque', 'plan', 'critical',
      'Module whatsapp non actif en essai (starter)', passed,
      passed ? null : `whatsapp=${modules?.whatsapp}`));
  } catch (err) {
    results.push(makeResult('C3_02_whatsapp_bloque', 'plan', 'critical',
      'Module whatsapp non actif en essai', false, err.message));
  }

  // C3_03: Telephone bloqué en essai
  try {
    const { status, data } = await apiCall('GET', '/api/tenants/me', token);
    const modules = data?.tenant?.modules;
    const passed = status === 200 && modules?.telephone !== true;
    results.push(makeResult('C3_03_telephone_bloque', 'plan', 'critical',
      'Module telephone non actif en essai (starter)', passed,
      passed ? null : `telephone=${modules?.telephone}`));
  } catch (err) {
    results.push(makeResult('C3_03_telephone_bloque', 'plan', 'critical',
      'Module telephone non actif en essai', false, err.message));
  }

  // C3_04: Invitation bloquée (max 1 user pour starter)
  try {
    const { status, data } = await apiCall('POST', '/api/admin/invitations', token, {
      email: 'test-invite@plte.internal',
      role: 'manager',
    });
    const passed = status === 403 && data?.maxUsers === 1;
    results.push(makeResult('C3_04_invitation_bloquee', 'plan', 'critical',
      'POST invitation retourne 403, maxUsers=1 (starter)', passed,
      passed ? null : `status=${status}, maxUsers=${data?.maxUsers}`));
  } catch (err) {
    results.push(makeResult('C3_04_invitation_bloquee', 'plan', 'critical',
      'POST invitation retourne 403 en essai', false, err.message));
  }

  // C3_05: Sentinel bloqué en essai
  try {
    const { status, data } = await apiCall('GET', '/api/tenants/me', token);
    const modules = data?.tenant?.modules;
    const passed = status === 200 && modules?.sentinel !== true;
    results.push(makeResult('C3_05_sentinel_bloque', 'plan', 'warning',
      'Module sentinel non actif en essai (starter)', passed,
      passed ? null : `sentinel=${modules?.sentinel}`));
  } catch (err) {
    results.push(makeResult('C3_05_sentinel_bloque', 'plan', 'warning',
      'Module sentinel non actif en essai', false, err.message));
  }

  return results;
}

// ============================================
// C4 — EXPIRATION ESSAI
// ============================================

async function runContext_C4_expiration() {
  const results = [];
  let tenantId = null;

  try {
    // Create tenant with expired trial — INSERT direct (pas de login, car expire = 403)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    tenantId = `${E2E_PREFIX}expired-${Date.now()}`;
    const email = `${tenantId}@plte.internal`.toLowerCase();

    const { error: tenantErr } = await supabase.from('tenants').insert({
      id: tenantId,
      name: `${E2E_PREFIX}expired`,
      tier: 'business',
      status: 'trial',
      domain: `${tenantId}.nexus.app`,
      plan: 'business',
      statut: 'essai',
      essai_fin: yesterday,
      onboarding_completed: true,
      structure_juridique: 'company',
      modules_actifs: ['reservations'],
      created_at: new Date().toISOString(),
    });
    if (tenantErr) throw new Error(`Tenant insert: ${tenantErr.message}`);

    const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);
    const { error: adminErr } = await supabase.from('admin_users').insert({
      tenant_id: tenantId,
      email,
      password_hash: passwordHash,
      nom: `${E2E_PREFIX}Admin`,
      role: 'owner',
      actif: true,
      created_at: new Date().toISOString(),
    });
    if (adminErr) throw new Error(`Admin insert: ${adminErr.message}`);

    // C4_01: Tenant created
    results.push(makeResult('C4_01_create_expired', 'expiration', 'critical',
      'Tenant avec essai expire cree', true));

    // C4_02: Login doit retourner 403 TRIAL_EXPIRED
    try {
      const { status, data } = await apiCall('POST', '/api/admin/auth/login', null, {
        email,
        password: E2E_PASSWORD,
      });
      const passed = status === 403 && data?.code === 'TRIAL_EXPIRED';
      results.push(makeResult('C4_02_login_bloque', 'expiration', 'critical',
        'Login retourne 403 TRIAL_EXPIRED', passed,
        passed ? null : `status=${status}, code=${data?.code}`));
    } catch (err) {
      results.push(makeResult('C4_02_login_bloque', 'expiration', 'critical',
        'Login bloque pour essai expire', false, err.message));
    }

    // C4_03: Verification directe en DB — essai_fin < now
    try {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('essai_fin, statut')
        .eq('id', tenantId)
        .single();
      const passed = tenant?.essai_fin && new Date(tenant.essai_fin) < new Date();
      results.push(makeResult('C4_03_essai_expire', 'expiration', 'warning',
        'essai_fin dans le passe (expire)', passed,
        passed ? null : `essai_fin=${tenant?.essai_fin}`));
    } catch (err) {
      results.push(makeResult('C4_03_essai_expire', 'expiration', 'warning',
        'essai_fin dans le passe', false, err.message));
    }
  } catch (err) {
    results.push(makeResult('C4_01_create_expired', 'expiration', 'critical',
      'Tenant avec essai expire cree', false, err.message));
  } finally {
    if (tenantId) {
      try { await cleanupE2ETenant(tenantId); } catch { /* best effort */ }
    }
  }

  return results;
}

// ============================================
// C5 — SOUSCRIPTION ABONNEMENT
// ============================================

async function runContext_C5_souscription(tenantId, token) {
  const results = [];
  if (!tenantId || !token) {
    return [makeResult('C5_01_activer_plan', 'billing', 'critical',
      'Activation plan business', false, 'No tenant/token')];
  }

  // C5_01: Activer le plan (simulate Stripe payment via direct DB update)
  try {
    const { error } = await supabase
      .from('tenants')
      .update({ statut: 'actif' })
      .eq('id', tenantId);
    const passed = !error;
    results.push(makeResult('C5_01_activer_plan', 'billing', 'critical',
      'UPDATE statut=actif sur le tenant', passed,
      passed ? null : error?.message));
  } catch (err) {
    results.push(makeResult('C5_01_activer_plan', 'billing', 'critical',
      'UPDATE statut=actif', false, err.message));
  }

  // C5_02: Plan now business + actif
  try {
    const { status, data } = await apiCall('GET', '/api/tenants/me', token);
    const tenant = data?.tenant;
    const passed = status === 200 && tenant?.plan === 'business' && tenant?.statut === 'actif';
    results.push(makeResult('C5_02_plan_business', 'billing', 'critical',
      'Plan effectif = business, statut = actif', passed,
      passed ? null : `plan=${tenant?.plan}, statut=${tenant?.statut}`));
  } catch (err) {
    results.push(makeResult('C5_02_plan_business', 'billing', 'critical',
      'Plan effectif = business', false, err.message));
  }

  // C5_03: Modules debloqués
  try {
    const { status, data } = await apiCall('GET', '/api/tenants/me', token);
    const modules = data?.tenant?.modules;
    const passed = status === 200 && modules?.whatsapp === true && modules?.telephone === true && modules?.sentinel === true;
    results.push(makeResult('C5_03_modules_debloques', 'billing', 'critical',
      'Modules whatsapp+telephone+sentinel actifs apres paiement', passed,
      passed ? null : `whatsapp=${modules?.whatsapp}, telephone=${modules?.telephone}, sentinel=${modules?.sentinel}`));
  } catch (err) {
    results.push(makeResult('C5_03_modules_debloques', 'billing', 'critical',
      'Modules debloques apres paiement', false, err.message));
  }

  // C5_04: Invitation now OK (business = 20 users max)
  try {
    const { status, data } = await apiCall('POST', '/api/admin/invitations', token, {
      email: 'team-e2e@plte.internal',
      role: 'manager',
    });
    const passed = status === 201 || (status === 200 && data?.invitation);
    results.push(makeResult('C5_04_invitation_ok', 'billing', 'warning',
      'POST invitation reussit apres activation (pas 403)', passed,
      passed ? null : `status=${status}, error=${data?.error}`));
  } catch (err) {
    results.push(makeResult('C5_04_invitation_ok', 'billing', 'warning',
      'Invitation autorisee apres activation', false, err.message));
  }

  return results;
}

// ============================================
// C6 — QUOTAS & LIMITES PLAN
// ============================================

async function runContext_C6_quotas(tenantId, token) {
  const results = [];
  if (!tenantId || !token) {
    return [makeResult('C6_01_limits', 'quotas', 'warning',
      'Limites invitation business', false, 'No tenant/token')];
  }

  // C6_01: Invitation limits = 20 for business
  try {
    const { status, data } = await apiCall('GET', '/api/admin/invitations/limits', token);
    const passed = status === 200 && data?.maxUsers === 20;
    results.push(makeResult('C6_01_limits', 'quotas', 'warning',
      'maxUsers=20 pour plan business', passed,
      passed ? null : `status=${status}, maxUsers=${data?.maxUsers}`));
  } catch (err) {
    results.push(makeResult('C6_01_limits', 'quotas', 'warning',
      'maxUsers=20 pour plan business', false, err.message));
  }

  // C6_02: Quotas tenant (clients_max = -1 = illimité)
  try {
    const { status, data } = await apiCall('GET', '/api/tenants/me', token);
    const quotas = data?.tenant?.quotas;
    const passed = status === 200 && quotas?.clients_max === -1;
    results.push(makeResult('C6_02_quotas_tenant', 'quotas', 'warning',
      'clients_max=-1 (illimite) pour plan business', passed,
      passed ? null : `clients_max=${quotas?.clients_max}`));
  } catch (err) {
    results.push(makeResult('C6_02_quotas_tenant', 'quotas', 'warning',
      'clients_max illimite business', false, err.message));
  }

  // C6_03: Create a reservation
  try {
    // First get a service (admin endpoint, pas public)
    const { data: svcData } = await apiCall('GET', '/api/admin/services', token);
    const services = svcData?.services || svcData?.data || svcData || [];
    const service = Array.isArray(services) && services.length > 0 ? services[0] : null;

    // Get or create a client
    const { data: clientData } = await apiCall('GET', '/api/admin/clients', token);
    const clients = clientData?.clients || clientData?.data || [];
    let clientId = Array.isArray(clients) && clients.length > 0 ? clients[0].id : null;

    if (!clientId) {
      // Create a test client
      const { data: newClient } = await apiCall('POST', '/api/admin/clients', token, {
        nom: `${E2E_PREFIX}Client`,
        prenom: 'Test',
        email: 'client-e2e@plte.internal',
        telephone: '0600000099',
      });
      clientId = newClient?.client?.id || newClient?.id;
    }

    if (service && clientId) {
      // Create reservation for tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Pick a weekday
      while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
        tomorrow.setDate(tomorrow.getDate() + 1);
      }
      const dateStr = tomorrow.toISOString().split('T')[0];

      const { status, data } = await apiCall('POST', '/api/admin/reservations', token, {
        client_id: clientId,
        service: service.nom || service.name,
        date_rdv: dateStr,
        heure_rdv: '10:00',
        notes: `${E2E_PREFIX}reservation test`,
      });
      const passed = status === 200 || status === 201;
      results.push(makeResult('C6_03_reservation_ok', 'quotas', 'warning',
        'Creation reservation reussie', passed,
        passed ? null : `status=${status}, error=${data?.error}`));
    } else {
      results.push(makeResult('C6_03_reservation_ok', 'quotas', 'warning',
        'Creation reservation reussie', false,
        `Missing: service=${!!service}, clientId=${clientId}`));
    }
  } catch (err) {
    results.push(makeResult('C6_03_reservation_ok', 'quotas', 'warning',
      'Creation reservation reussie', false, err.message));
  }

  return results;
}

// ============================================
// C7 — DOWNGRADE PLAN
// ============================================

async function runContext_C7_downgrade(tenantId, token) {
  const results = [];
  if (!tenantId || !token) {
    return [makeResult('C7_01_downgrade', 'plan', 'critical',
      'Downgrade business -> starter', false, 'No tenant/token')];
  }

  // C7_01: Downgrade to starter
  try {
    const { error } = await supabase
      .from('tenants')
      .update({ plan: 'starter' })
      .eq('id', tenantId);
    const passed = !error;
    results.push(makeResult('C7_01_downgrade', 'plan', 'critical',
      'UPDATE plan=starter', passed,
      passed ? null : error?.message));
  } catch (err) {
    results.push(makeResult('C7_01_downgrade', 'plan', 'critical',
      'Downgrade plan', false, err.message));
  }

  // C7_02: Modules restreints apres downgrade
  try {
    const { status, data } = await apiCall('GET', '/api/tenants/me', token);
    const modules = data?.tenant?.modules;
    const passed = status === 200 && modules?.whatsapp !== true && modules?.sentinel !== true;
    results.push(makeResult('C7_02_modules_restreints', 'plan', 'critical',
      'Modules whatsapp+sentinel inactifs apres downgrade starter', passed,
      passed ? null : `whatsapp=${modules?.whatsapp}, sentinel=${modules?.sentinel}`));
  } catch (err) {
    results.push(makeResult('C7_02_modules_restreints', 'plan', 'critical',
      'Modules restreints apres downgrade', false, err.message));
  }

  // C7_03: Donnees intactes (services still there)
  try {
    const { status, data } = await apiCall('GET', '/api/admin/services', token);
    const services = data?.services || data?.data || data || [];
    const passed = status === 200 && Array.isArray(services) && services.length >= 1;
    results.push(makeResult('C7_03_donnees_intactes', 'plan', 'warning',
      'Services toujours presents apres downgrade', passed,
      passed ? null : `count=${Array.isArray(services) ? services.length : 0}`));
  } catch (err) {
    results.push(makeResult('C7_03_donnees_intactes', 'plan', 'warning',
      'Donnees intactes apres downgrade', false, err.message));
  }

  return results;
}

// ============================================
// C8 — SECURITE AUTHENTIFICATION
// ============================================

async function runContext_C8_securite() {
  const results = [];
  let tenantId = null;

  try {
    const direct = await createDirectTenant('security');
    tenantId = direct.tenantId;
    const newPassword = 'Nexus2026E2E!New99';

    // C8_01: Login OK
    results.push(makeResult('C8_01_login_ok', 'auth', 'critical',
      'POST login retourne 200 + token', true));

    // C8_02: Token invalide
    try {
      const { status } = await apiCall('GET', '/api/tenants/me', 'fake_invalid_token_12345');
      const passed = status === 401;
      results.push(makeResult('C8_02_token_invalide', 'auth', 'critical',
        'Token invalide retourne 401', passed,
        passed ? null : `status=${status} (expected 401)`));
    } catch (err) {
      results.push(makeResult('C8_02_token_invalide', 'auth', 'critical',
        'Token invalide retourne 401', false, err.message));
    }

    // C8_03: Change password
    try {
      const { status, data } = await apiCall('POST', '/api/admin/auth/change-password', direct.token, {
        currentPassword: E2E_PASSWORD,
        newPassword,
      });
      const passed = status === 200 && data?.success;
      results.push(makeResult('C8_03_change_password', 'auth', 'warning',
        'Changement de mot de passe reussi', passed,
        passed ? null : `status=${status}, error=${data?.error}`));
    } catch (err) {
      results.push(makeResult('C8_03_change_password', 'auth', 'warning',
        'Changement mot de passe', false, err.message));
    }

    // C8_04: Old token should be invalidated after password change
    try {
      // Small delay to let session invalidation propagate
      await new Promise(r => setTimeout(r, 500));
      const { status } = await apiCall('GET', '/api/tenants/me', direct.token);
      // Token may or may not be invalidated depending on implementation
      // If session-based invalidation: 401. If JWT-only: still 200.
      const passed = status === 401;
      results.push(makeResult('C8_04_ancien_token_invalide', 'auth', 'warning',
        'Ancien token invalide apres changement password', passed,
        passed ? null : `status=${status} (ancien token encore valide — comportement accepte si JWT sans blacklist)`));
    } catch (err) {
      results.push(makeResult('C8_04_ancien_token_invalide', 'auth', 'warning',
        'Ancien token invalide', false, err.message));
    }
  } catch (err) {
    results.push(makeResult('C8_01_login_ok', 'auth', 'critical',
      'Login + creation tenant securite', false, err.message));
  } finally {
    if (tenantId) {
      try { await cleanupE2ETenant(tenantId); } catch { /* best effort */ }
    }
  }

  return results;
}

// ============================================
// C9 — MULTI-UTILISATEUR
// ============================================

async function runContext_C9_multiuser(tenantId, token) {
  const results = [];
  if (!tenantId || !token) {
    return [makeResult('C9_01_invite_membre', 'team', 'warning',
      'Invitation membre', false, 'No tenant/token')];
  }

  // Make sure plan is business and actif for invitations
  await supabase.from('tenants').update({ plan: 'business', statut: 'actif' }).eq('id', tenantId);

  const viewerEmail = `viewer-e2e-${Date.now()}@plte.internal`;
  const viewerPassword = 'Nexus2026Viewer!Ok';
  let inviteToken = null;

  // C9_01: Invite a viewer
  try {
    const { status, data } = await apiCall('POST', '/api/admin/invitations', token, {
      email: viewerEmail,
      role: 'viewer',
    });
    const passed = status === 201 && data?.invitation;
    results.push(makeResult('C9_01_invite_membre', 'team', 'warning',
      'POST invitation viewer retourne 201', passed,
      passed ? null : `status=${status}, error=${data?.error}`));

    // Get invite token from DB
    if (passed) {
      const { data: inv } = await supabase
        .from('invitations')
        .select('token')
        .eq('tenant_id', tenantId)
        .eq('email', viewerEmail)
        .is('accepted_at', null)
        .single();
      inviteToken = inv?.token;
    }
  } catch (err) {
    results.push(makeResult('C9_01_invite_membre', 'team', 'warning',
      'Invitation viewer', false, err.message));
  }

  // C9_02: Accept invitation
  if (inviteToken) {
    try {
      const { status, data } = await apiCall('POST', '/api/admin/invitations/accept', null, {
        token: inviteToken,
        nom: `${E2E_PREFIX}Viewer`,
        password: viewerPassword,
      });
      const passed = status === 200 && data?.success;
      results.push(makeResult('C9_02_accept_invite', 'team', 'warning',
        'Accept invitation cree le user', passed,
        passed ? null : `status=${status}, error=${data?.error}`));
    } catch (err) {
      results.push(makeResult('C9_02_accept_invite', 'team', 'warning',
        'Accept invitation', false, err.message));
    }
  } else {
    results.push(makeResult('C9_02_accept_invite', 'team', 'warning',
      'Accept invitation cree le user', false, 'No invite token'));
  }

  // C9_03: Viewer login + access
  try {
    const loginRes = await apiCall('POST', '/api/admin/auth/login', null, {
      email: viewerEmail,
      password: viewerPassword,
    });

    if (loginRes.status === 200 && loginRes.data?.token) {
      const { status, data } = await apiCall('GET', '/api/tenants/me', loginRes.data.token);
      const passed = status === 200;
      results.push(makeResult('C9_03_viewer_access', 'team', 'info',
        'Viewer peut acceder a /tenants/me', passed,
        passed ? null : `status=${status}`));
    } else {
      results.push(makeResult('C9_03_viewer_access', 'team', 'info',
        'Viewer peut acceder a /tenants/me', false,
        `Login failed: status=${loginRes.status}`));
    }
  } catch (err) {
    results.push(makeResult('C9_03_viewer_access', 'team', 'info',
      'Viewer login + access', false, err.message));
  }

  return results;
}

// ============================================
// C10 — RGPD / SUPPRESSION
// ============================================

async function runContext_C10_rgpd() {
  const results = [];
  let tenantId = null;

  try {
    const direct = await createDirectTenant('rgpd');
    tenantId = direct.tenantId;

    // C10_01: Export data
    try {
      const { status } = await apiCall('GET', '/api/rgpd/export', direct.token);
      const passed = status === 200;
      results.push(makeResult('C10_01_export_data', 'rgpd', 'info',
        'GET /api/rgpd/export retourne 200', passed,
        passed ? null : `status=${status}`));
    } catch (err) {
      results.push(makeResult('C10_01_export_data', 'rgpd', 'info',
        'Export RGPD', false, err.message));
    }

    // C10_02: Cleanup (tenant supprime)
    try {
      await cleanupE2ETenant(tenantId);
      // Verify tenant is gone
      const { data } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', tenantId)
        .single();
      const passed = !data;
      results.push(makeResult('C10_02_cleanup', 'rgpd', 'info',
        'Suppression complete du tenant', passed,
        passed ? null : 'Tenant still exists after cleanup'));
      tenantId = null; // Already cleaned up
    } catch (err) {
      results.push(makeResult('C10_02_cleanup', 'rgpd', 'info',
        'Suppression tenant', false, err.message));
    }
  } catch (err) {
    results.push(makeResult('C10_01_export_data', 'rgpd', 'info',
      'Creation tenant RGPD', false, err.message));
  } finally {
    if (tenantId) {
      try { await cleanupE2ETenant(tenantId); } catch { /* best effort */ }
    }
  }

  return results;
}

// ============================================
// MAIN RUNNER
// ============================================

export async function runE2ETests() {
  console.log('[PLTE E2E] Demarrage des tests E2E (10 contextes, 34 tests)...');
  const allResults = [];
  let mainTenantId = null;

  try {
    // ====== C1: Signup ======
    console.log('[PLTE E2E] C1 — Signup complet...');
    const c1 = await runContext_C1_signup();
    allResults.push(...c1.results);
    mainTenantId = c1.tenantId;
    const mainToken = c1.token;
    console.log(`[PLTE E2E] C1 done: ${c1.results.filter(r => r.status === 'pass').length}/${c1.results.length} pass`);

    // ====== C2: Onboarding ======
    console.log('[PLTE E2E] C2 — Onboarding...');
    const c2 = await runContext_C2_onboarding(mainTenantId, mainToken);
    allResults.push(...c2);
    console.log(`[PLTE E2E] C2 done: ${c2.filter(r => r.status === 'pass').length}/${c2.length} pass`);

    // ====== C3: Restrictions essai ======
    console.log('[PLTE E2E] C3 — Restrictions essai...');
    const c3 = await runContext_C3_restrictions(mainTenantId, mainToken);
    allResults.push(...c3);
    console.log(`[PLTE E2E] C3 done: ${c3.filter(r => r.status === 'pass').length}/${c3.length} pass`);

    // ====== C4: Expiration essai (tenant secondaire) ======
    console.log('[PLTE E2E] C4 — Expiration essai...');
    const c4 = await runContext_C4_expiration();
    allResults.push(...c4);
    console.log(`[PLTE E2E] C4 done: ${c4.filter(r => r.status === 'pass').length}/${c4.length} pass`);

    // ====== C5: Souscription ======
    console.log('[PLTE E2E] C5 — Souscription abonnement...');
    const c5 = await runContext_C5_souscription(mainTenantId, mainToken);
    allResults.push(...c5);
    console.log(`[PLTE E2E] C5 done: ${c5.filter(r => r.status === 'pass').length}/${c5.length} pass`);

    // ====== C6: Quotas ======
    console.log('[PLTE E2E] C6 — Quotas & limites...');
    const c6 = await runContext_C6_quotas(mainTenantId, mainToken);
    allResults.push(...c6);
    console.log(`[PLTE E2E] C6 done: ${c6.filter(r => r.status === 'pass').length}/${c6.length} pass`);

    // ====== C7: Downgrade ======
    console.log('[PLTE E2E] C7 — Downgrade plan...');
    const c7 = await runContext_C7_downgrade(mainTenantId, mainToken);
    allResults.push(...c7);
    console.log(`[PLTE E2E] C7 done: ${c7.filter(r => r.status === 'pass').length}/${c7.length} pass`);

    // ====== C8: Securite (tenant secondaire) ======
    console.log('[PLTE E2E] C8 — Securite authentification...');
    const c8 = await runContext_C8_securite();
    allResults.push(...c8);
    console.log(`[PLTE E2E] C8 done: ${c8.filter(r => r.status === 'pass').length}/${c8.length} pass`);

    // ====== C9: Multi-utilisateur (restore business for invitations) ======
    console.log('[PLTE E2E] C9 — Multi-utilisateur...');
    const c9 = await runContext_C9_multiuser(mainTenantId, mainToken);
    allResults.push(...c9);
    console.log(`[PLTE E2E] C9 done: ${c9.filter(r => r.status === 'pass').length}/${c9.length} pass`);

    // ====== C10: RGPD (tenant secondaire) ======
    console.log('[PLTE E2E] C10 — RGPD / suppression...');
    const c10 = await runContext_C10_rgpd();
    allResults.push(...c10);
    console.log(`[PLTE E2E] C10 done: ${c10.filter(r => r.status === 'pass').length}/${c10.length} pass`);

  } catch (err) {
    console.error('[PLTE E2E] Erreur globale:', err.message);
    allResults.push(makeResult('E2E_GLOBAL_ERROR', 'e2e', 'critical',
      'Erreur globale E2E', false, err.message));
  } finally {
    // Cleanup main tenant
    if (mainTenantId) {
      try {
        console.log(`[PLTE E2E] Cleanup tenant principal: ${mainTenantId}`);
        await cleanupE2ETenant(mainTenantId);
      } catch (err) {
        console.error(`[PLTE E2E] Cleanup failed for ${mainTenantId}:`, err.message);
      }
    }
  }

  const passed = allResults.filter(r => r.status === 'pass').length;
  const failed = allResults.filter(r => r.status === 'fail').length;
  const errors = allResults.filter(r => r.status === 'error').length;
  console.log(`[PLTE E2E] === TERMINE: ${passed}P/${failed}F/${errors}E sur ${allResults.length} tests ===`);

  return allResults;
}
