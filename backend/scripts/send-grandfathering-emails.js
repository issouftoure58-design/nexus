#!/usr/bin/env node
/**
 * Grandfathering Email Broadcast — Pricing 2026
 *
 * Envoie l'email d'annonce du nouveau modèle de prix à tous les tenants
 * marqués `legacy_pricing = TRUE` (anciens plans Starter/Pro/Business).
 *
 * Usage :
 *   node scripts/send-grandfathering-emails.js --dry-run         (par défaut)
 *   node scripts/send-grandfathering-emails.js --send            (envoi réel)
 *   node scripts/send-grandfathering-emails.js --send --tenant ID (un seul tenant test)
 *   node scripts/send-grandfathering-emails.js --send --limit 5  (envoi par lot)
 *
 * Le script :
 *   1. Récupère tous les tenants legacy_pricing=TRUE qui n'ont pas encore reçu l'email
 *   2. Pour chaque tenant, récupère l'email du contact principal (admin_users)
 *   3. Construit l'email via grandfatheringEmail.js
 *   4. Envoie via emailService.sendEmail()
 *   5. Marque tenants.grandfathering_email_sent_at = NOW() pour éviter les doublons
 *
 * Mode dry-run par défaut : aucun email envoyé, juste un récap.
 */

import 'dotenv/config'; // doit charger AVANT l'import de emailService (qui lit RESEND_API_KEY au top-level)
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '../src/services/emailService.js';
import { buildGrandfatheringEmail } from '../src/templates/grandfatheringEmail.js';

// ────────────────────────────────────────────────────────────────────────
// Parse CLI args
// ────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = !args.includes('--send');
const tenantArgIdx = args.indexOf('--tenant');
const onlyTenantId = tenantArgIdx >= 0 ? args[tenantArgIdx + 1] : null;
const limitArgIdx = args.indexOf('--limit');
const limit = limitArgIdx >= 0 ? parseInt(args[limitArgIdx + 1], 10) : null;
// --override-to <email> : redirige TOUS les envois vers cette adresse (test visuel)
const overrideArgIdx = args.indexOf('--override-to');
const overrideTo = overrideArgIdx >= 0 ? args[overrideArgIdx + 1] : null;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────

const LEGACY_PRICES = { starter: 99, pro: 249, business: 499 };

// Patterns d'IDs et emails de test à exclure du broadcast
const TEST_TENANT_PATTERNS = [/^plte-/i, /^_E2E_/i, /^test-/i, /^nexus-test$/i];
const TEST_EMAIL_PATTERNS = [/@nexus\.dev$/i, /@test\.dev$/i, /@e2e\.test$/i, /^demo@/i, /^test\./i];

function isTestTenant(tenantId) {
  return TEST_TENANT_PATTERNS.some((p) => p.test(tenantId));
}

function isTestEmail(email) {
  return TEST_EMAIL_PATTERNS.some((p) => p.test(email));
}

function getDashboardUrl(tenant) {
  const base = process.env.ADMIN_BASE_URL || 'https://admin.nexus-ai-saas.com';
  return tenant.slug ? `${base}/${tenant.slug}` : base;
}

function getBillingPortalUrl(tenant) {
  const base = process.env.ADMIN_BASE_URL || 'https://admin.nexus-ai-saas.com';
  return tenant.slug ? `${base}/${tenant.slug}/abonnement` : `${base}/abonnement`;
}

/**
 * Récupère le contact principal d'un tenant.
 * Priorité : role=owner > role=admin (le plus ancien), en excluant les emails de test.
 */
async function getTenantContact(tenantId) {
  const { data, error } = await supabase
    .from('admin_users')
    .select('email, nom, role, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn(`  ⚠️  admin_users lookup failed: ${error.message}`);
    return null;
  }

  if (!data || data.length === 0) return null;

  // Filtrer les emails de test
  const real = data.filter((u) => u.email && !isTestEmail(u.email));
  if (real.length === 0) return null;

  // Préférer owner, sinon admin (le plus ancien)
  const owner = real.find((u) => u.role === 'owner');
  return owner || real[0];
}

// ────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  GRANDFATHERING EMAIL BROADCAST — Mode : ${isDryRun ? 'DRY-RUN' : 'SEND'}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (isDryRun) {
    console.log('ℹ️  Mode dry-run actif. Aucun email ne sera envoyé.');
    console.log('   Pour envoyer réellement : ajoutez --send\n');
  }

  // 1. Récupérer les tenants concernés
  let query = supabase
    .from('tenants')
    .select('id, name, slug, plan, legacy_pricing, grandfathering_email_sent_at')
    .eq('legacy_pricing', true)
    .is('grandfathering_email_sent_at', null);

  if (onlyTenantId) query = query.eq('id', onlyTenantId);
  if (limit) query = query.limit(limit);

  const { data: rawTenants, error } = await query;

  if (error) {
    console.error('❌ Erreur récupération tenants :', error.message);
    process.exit(1);
  }

  if (!rawTenants || rawTenants.length === 0) {
    console.log('✓ Aucun tenant à traiter (tous déjà notifiés ou pas de legacy_pricing).');
    process.exit(0);
  }

  // Filtrer les tenants de test
  const tenants = rawTenants.filter((t) => {
    if (isTestTenant(t.id)) {
      console.log(`  ⊘  ${t.id} : tenant de test (filtré)`);
      return false;
    }
    return true;
  });

  if (tenants.length === 0) {
    console.log('\n✓ Aucun tenant légitime à notifier après filtrage.');
    process.exit(0);
  }

  console.log(`\n📋 ${tenants.length} tenant(s) à traiter (sur ${rawTenants.length} récupérés) :\n`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // 2. Pour chaque tenant : construire + envoyer
  for (const tenant of tenants) {
    const planLabel = tenant.plan;
    const currentPrice = LEGACY_PRICES[planLabel] || 0;

    console.log(`→ ${tenant.name} (${tenant.id}) — plan ${planLabel} (${currentPrice}€)`);

    const contact = await getTenantContact(tenant.id);
    if (!contact?.email) {
      console.log(`  ⊘  Skip : pas de contact admin légitime trouvé`);
      skipped++;
      continue;
    }

    // `nom` est un champ libre — on prend le premier mot comme prénom
    const firstName = (contact.nom || '').trim().split(/\s+/)[0] || '';

    const { subject, html, text } = buildGrandfatheringEmail({
      firstName,
      tenantName: tenant.name,
      currentPlan: planLabel,
      currentPrice,
      billingPortalUrl: getBillingPortalUrl(tenant),
      dashboardUrl: getDashboardUrl(tenant),
    });

    const destEmail = overrideTo || contact.email;
    const overrideTag = overrideTo ? ` [override → ${overrideTo}, original ${contact.email}]` : '';

    if (isDryRun) {
      console.log(`  📨 [DRY] would send to ${destEmail}${overrideTag}`);
      console.log(`     Subject: ${subject}`);
      sent++;
      continue;
    }

    const finalSubject = overrideTo ? `[TEST] ${subject}` : subject;

    const result = await sendEmail({
      to: destEmail,
      subject: finalSubject,
      html,
      text,
      tags: overrideTo ? ['grandfathering', 'pricing-2026', 'test'] : ['grandfathering', 'pricing-2026'],
    });

    if (result.success) {
      console.log(`  ✓  Envoyé à ${destEmail}${overrideTag}`);
      // Marquer comme envoyé UNIQUEMENT si pas en mode override (test visuel)
      if (!overrideTo) {
        await supabase
          .from('tenants')
          .update({ grandfathering_email_sent_at: new Date().toISOString() })
          .eq('id', tenant.id);
      }
      sent++;
    } else {
      console.log(`  ✗  Échec : ${result.error}`);
      failed++;
    }
  }

  // 3. Récap
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  RECAP : ${sent} envoyé · ${skipped} skip · ${failed} échec`);
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('❌ Erreur fatale :', err);
  process.exit(1);
});
