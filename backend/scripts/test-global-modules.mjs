/**
 * TEST GLOBAL — Tous les modules NEXUS sur un tenant
 * Usage: node scripts/test-global-modules.mjs
 */

const BASE = 'http://localhost:3001/api';
const TENANT_ID = 'nexus-test';

async function login() {
  const res = await fetch(`${BASE}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID },
    body: JSON.stringify({ email: 'admin@nexus-test.com', password: 'Test123!' })
  });
  const data = await res.json();
  if (!data.token) throw new Error('Login failed: ' + JSON.stringify(data));
  return data.token;
}

async function testEndpoint(token, method, path, body = null, label = '') {
  const name = label || `${method} ${path}`;
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': TENANT_ID }
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, opts);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    const ok = res.status >= 200 && res.status < 400;
    const icon = ok ? '\x1b[32mOK\x1b[0m' : `\x1b[31mFAIL ${res.status}\x1b[0m`;
    const detail = typeof data === 'object'
      ? (Array.isArray(data) ? `${data.length} items`
        : (data.data?.length !== undefined ? `${data.data.length} items`
          : JSON.stringify(data).slice(0, 80)))
      : String(data).slice(0, 80);
    console.log(`  ${icon}  ${name} — ${detail}`);
    return { ok, status: res.status, data, name };
  } catch (err) {
    console.log(`  \x1b[31mERR\x1b[0m  ${name} — ${err.message}`);
    return { ok: false, status: 0, data: null, name, error: err.message };
  }
}

async function main() {
  console.log('\n======================================================================');
  console.log('   TEST GLOBAL NEXUS — Tous les modules — tenant: nexus-test');
  console.log('======================================================================\n');

  console.log('Login...');
  const token = await login();
  console.log('  OK — Token obtenu\n');

  const results = [];
  const t = (m, p, b, l) => testEndpoint(token, m, p, b, l).then(r => results.push(r));

  // 1. PROFIL & CONFIG
  console.log('--- 1. PROFIL & CONFIG ---');
  await t('GET', '/admin/profile', null, 'Profil metier');
  await t('GET', '/admin/parametres', null, 'Parametres tenant');

  // 2. CLIENTS / CRM
  console.log('\n--- 2. CLIENTS / CRM ---');
  await t('GET', '/admin/clients', null, 'Liste clients');
  await t('GET', '/admin/segments', null, 'Segments');
  await t('GET', '/admin/rfm/analysis', null, 'Analyse RFM');

  // 3. RESERVATIONS
  console.log('\n--- 3. RESERVATIONS ---');
  await t('GET', '/admin/reservations', null, 'Liste reservations');
  await t('GET', '/admin/services', null, 'Services');
  await t('GET', '/admin/disponibilites/horaires', null, 'Horaires');
  await t('GET', '/admin/disponibilites/conges', null, 'Conges');

  // 4. FACTURATION
  console.log('\n--- 4. FACTURATION ---');
  await t('GET', '/factures', null, 'Factures');

  // 5. COMPTABILITE
  console.log('\n--- 5. COMPTABILITE ---');
  await t('GET', '/admin/compta/dashboard', null, 'Dashboard compta');
  await t('GET', '/admin/compta/pnl?mois=3&annee=2026', null, 'P&L mars 2026');
  await t('GET', '/comptabilite/transactions', null, 'Transactions');
  await t('GET', '/comptabilite/categories', null, 'Categories comptables');
  await t('GET', '/comptabilite/dashboard', null, 'Dashboard comptabilite');

  // 6. STOCK
  console.log('\n--- 6. STOCK ---');
  await t('GET', '/admin/stock', null, 'Produits stock');
  await t('GET', '/stock/mouvements', null, 'Mouvements stock');
  await t('GET', '/stock/alertes', null, 'Alertes stock');

  // 7. RH / EQUIPE
  console.log('\n--- 7. RH / EQUIPE ---');
  await t('GET', '/admin/team', null, 'Equipe');
  await t('GET', '/admin/rh/planning', null, 'Planning RH');

  // 8. MARKETING & WORKFLOWS
  console.log('\n--- 8. MARKETING & WORKFLOWS ---');
  await t('GET', '/admin/workflows', null, 'Workflows');
  await t('GET', '/marketing/campagnes', null, 'Campagnes A/B');
  await t('GET', '/marketing/email-templates', null, 'Templates email');

  // 9. PIPELINE CRM
  console.log('\n--- 9. PIPELINE CRM ---');
  await t('GET', '/admin/pipeline', null, 'Pipeline');

  // 10. DEVIS
  console.log('\n--- 10. DEVIS ---');
  await t('GET', '/admin/devis', null, 'Devis');

  // 11. SEO
  console.log('\n--- 11. SEO ---');
  await t('GET', '/admin/seo/articles', null, 'Articles SEO');

  // 12. ANALYTICS
  console.log('\n--- 12. ANALYTICS ---');
  await t('GET', '/admin/analytics/dashboard', null, 'Dashboard analytics');
  await t('GET', '/admin/stats/dashboard', null, 'Stats dashboard');

  // 13. SENTINEL
  console.log('\n--- 13. SENTINEL ---');
  await t('GET', '/sentinel/dashboard', null, 'Sentinel dashboard');
  await t('GET', '/sentinel/insights', null, 'Sentinel insights');

  // 14. FIDELITE
  console.log('\n--- 14. FIDELITE ---');
  await t('GET', '/admin/loyalty/config', null, 'Config fidelite');
  await t('GET', '/admin/loyalty/stats', null, 'Stats fidelite');

  // 15. AGENTS IA
  console.log('\n--- 15. AGENTS IA ---');
  await t('GET', '/admin/agents', null, 'Agents IA config');

  // 16. API PUBLIQUE
  console.log('\n--- 16. API PUBLIQUE ---');
  await t('GET', '/admin/api-keys', null, 'Cles API');
  await t('GET', '/admin/webhooks', null, 'Webhooks sortants');

  // 17. SIGNATURES (Yousign)
  console.log('\n--- 17. SIGNATURES ---');
  await t('GET', '/admin/signatures', null, 'Signatures Yousign');

  // 18. QUESTIONNAIRES
  console.log('\n--- 18. QUESTIONNAIRES ---');
  await t('GET', '/questionnaires/admin', null, 'Questionnaires');

  // 19. SATISFACTION
  console.log('\n--- 19. SATISFACTION ---');
  await t('GET', '/satisfaction/admin/enquetes', null, 'Enquetes satisfaction');
  await t('GET', '/satisfaction/admin/templates', null, 'Templates satisfaction');

  // 20. PARRAINAGE
  console.log('\n--- 20. PARRAINAGE ---');
  await t('GET', '/admin/referrals', null, 'Parrainages');

  // 21. BILLING
  console.log('\n--- 21. BILLING ---');
  await t('GET', '/billing/subscription', null, 'Abonnement');
  await t('GET', '/trial/status', null, 'Statut trial');

  // 22. RGPD
  console.log('\n--- 22. RGPD ---');
  await t('GET', '/rgpd/export', null, 'Export RGPD');

  // 23. QUALIOPI
  console.log('\n--- 23. QUALIOPI ---');
  await t('GET', '/admin/qualiopi/documents-types', null, 'Types documents Qualiopi');
  await t('GET', '/admin/qualiopi/apprenants', null, 'Apprenants Qualiopi');
  await t('GET', '/admin/qualiopi/alertes', null, 'Alertes Qualiopi');

  // 24. MODULES
  console.log('\n--- 24. MODULES ---');
  await t('GET', '/admin/modules/plans', null, 'Plans disponibles');
  await t('GET', '/admin/modules/options', null, 'Options modules');
  await t('GET', '/modules/available', null, 'Modules disponibles');

  // 25. BRANDING
  console.log('\n--- 25. BRANDING ---');
  await t('GET', '/branding/themes', null, 'Themes disponibles');

  // 26. CGV (public, sans auth)
  console.log('\n--- 26. CGV (public) ---');
  await testEndpoint(null, 'GET', '/cgv', null, 'CGV publiques').then(r => results.push(r));

  // === RESUME ===
  console.log('\n======================================================================');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  const total = results.length;
  const pct = Math.round(passed / total * 100);
  const color = failed === 0 ? '\x1b[32m' : (failed <= 3 ? '\x1b[33m' : '\x1b[31m');
  console.log(`   ${color}RESULTAT: ${passed}/${total} OK (${pct}%) — ${failed} FAIL\x1b[0m`);
  console.log('======================================================================');

  if (failed > 0) {
    console.log('\n\x1b[31mEndpoints en echec:\x1b[0m');
    results.filter(r => !r.ok).forEach(r => {
      const detail = typeof r.data === 'object' ? JSON.stringify(r.data).slice(0, 120) : String(r.data || r.error).slice(0, 120);
      console.log(`  x ${r.name} (${r.status}) — ${detail}`);
    });
  }

  console.log('');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
