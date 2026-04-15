#!/usr/bin/env node
/**
 * NEXUS SMOKE TEST — Diagnostic temps reel des flows critiques
 *
 * Importe les vrais services, se connecte a la vraie DB,
 * teste les data flows critiques pour chaque tenant actif.
 *
 * Usage: npm run smoke (depuis backend/)
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { loadAllTenants, getCachedTenantIds, getCachedConfig, findTenantByPhone } from '../src/config/tenants/tenantCache.js';
import { getBusinessInfoSync } from '../src/services/tenantBusinessService.js';
import { getVoiceSystemPrompt } from '../src/prompts/voicePrompt.js';
import { getDepositConfig } from '../src/services/depositService.js';
import { createReservationUnified } from '../src/core/unified/nexusCore.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ── Helpers ────────────────────────────────────────────────────────

const COLORS = {
  ok: '\x1b[32m',    // green
  fail: '\x1b[31m',  // red
  skip: '\x1b[90m',  // gray
  title: '\x1b[36m', // cyan
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

let totalOk = 0;
let totalFail = 0;
let totalSkip = 0;
const failures = [];
let currentTenant = '';

function ok(check, detail) {
  totalOk++;
  console.log(`  ${COLORS.ok}[OK]${COLORS.reset}   ${check}: ${detail}`);
}

function fail(check, detail, fix) {
  totalFail++;
  failures.push({ tenant: currentTenant, check, detail, fix });
  console.log(`  ${COLORS.fail}[FAIL]${COLORS.reset} ${check}: ${detail}`);
  if (fix) console.log(`         ${COLORS.skip}Fix: ${fix}${COLORS.reset}`);
}

function skip(check, detail) {
  totalSkip++;
  console.log(`  ${COLORS.skip}[--]${COLORS.reset}   ${check}: ${detail}`);
}

/** Filtrer les tenants E2E/test generes automatiquement */
function isRealTenant(tenantId) {
  return !tenantId.startsWith('_E2E_') && !tenantId.startsWith('plte-');
}

// ── Checks ─────────────────────────────────────────────────────────

async function checkC1_RoutingTelephone(tenantId, config) {
  const label = 'C1 Routing telephone';
  const phone = config.twilio_phone_number || config.phone_number;
  if (!phone) {
    skip(label, 'pas de numero Twilio configure');
    return;
  }
  const resolved = findTenantByPhone(phone);
  if (resolved === tenantId) {
    ok(label, `${phone} → ${tenantId}`);
  } else {
    fail(label, `${phone} → ${resolved || 'null'} (attendu: ${tenantId})`,
      'Verifier tenant_phone_numbers ou tenantCache phoneMap');
  }
}

function checkC2_ConfigBusiness(tenantId, config) {
  const label = 'C2 Config business';
  const isDemo = tenantId === 'nexus-test';
  try {
    const info = getBusinessInfoSync(tenantId);
    const errors = [];

    if (!info.nom) errors.push('nom=null');
    if (!info.telephone) errors.push('telephone=null');

    const assistantName = info.assistant_name || info.assistant?.name;
    if (!assistantName) {
      errors.push('assistant_name=null');
    } else if (assistantName === 'Nexus' && !isDemo) {
      errors.push(`assistant_name='Nexus' (generique)`);
    }

    if (errors.length > 0) {
      fail(label, errors.join(', ') + (isDemo ? '' : ' → IA dira le mauvais nom'),
        'Verifier tenants.config JSONB contient assistantName + telephone');
    } else {
      const detail = isDemo
        ? `${info.nom} (demo OK)`
        : `${assistantName} / ${info.nom} / ${info.telephone}`;
      ok(label, detail);
    }
  } catch (e) {
    fail(label, `Erreur: ${e.message}`, 'getBusinessInfoSync a plante');
  }
}

function checkC3_PromptVocal(tenantId) {
  const label = 'C3 Prompt vocal';
  const isDemo = tenantId === 'nexus-test';
  if (isDemo) {
    skip(label, 'demo tenant (prompt specifique)');
    return;
  }
  try {
    const info = getBusinessInfoSync(tenantId);
    const prompt = getVoiceSystemPrompt(tenantId);
    const businessName = info.nom;

    if (!businessName) {
      fail(label, 'nom business=null', 'getBusinessInfoSync retourne nom vide');
      return;
    }

    if (prompt.includes(businessName)) {
      ok(label, `contient "${businessName}"`);
    } else {
      fail(label, `prompt ne contient pas "${businessName}"`,
        'getVoiceSystemPrompt ne recoit pas le bon nom du tenant');
    }
  } catch (e) {
    fail(label, `Erreur: ${e.message}`);
  }
}

async function checkC4_ConfigSMS(tenantId) {
  const label = 'C4 Config SMS';
  const { data } = await supabase
    .from('tenants')
    .select('twilio_messaging_service_sid, twilio_phone_number')
    .eq('id', tenantId)
    .single();

  const hasMsgSid = !!data?.twilio_messaging_service_sid;
  const hasPhone = !!data?.twilio_phone_number;
  const hasFallback = !!process.env.TWILIO_MESSAGING_SERVICE_SID || !!process.env.TWILIO_PHONE_NUMBER;

  if (hasMsgSid) {
    ok(label, 'messagingServiceSid configure');
  } else if (hasPhone) {
    ok(label, `phoneNumber ${data.twilio_phone_number}`);
  } else if (hasFallback) {
    ok(label, 'fallback env TWILIO_* configure');
  } else {
    fail(label, 'aucun config Twilio (ni tenant ni env)',
      'Ajouter twilio_messaging_service_sid ou TWILIO_PHONE_NUMBER');
  }
}

async function checkC5_ConfigAcompte(tenantId) {
  const label = 'C5 Config acompte';
  try {
    const deposit = await getDepositConfig(tenantId);
    if (!deposit.enabled) {
      skip(label, 'non active');
      return;
    }
    const errors = [];
    if (!deposit.rate || deposit.rate <= 0 || deposit.rate > 100) {
      errors.push(`deposit_rate=${deposit.rate} (invalide)`);
    }
    if (!deposit.paymentUrl) {
      errors.push('deposit_payment_url=null');
    }
    if (errors.length > 0) {
      fail(label, errors.join(', '),
        'Acompte active mais config incomplete dans tenants');
    } else {
      ok(label, `${deposit.rate}%, lien present`);
    }
  } catch (e) {
    fail(label, `Erreur: ${e.message}`);
  }
}

async function checkC6_ReservationDryRun() {
  const label = 'C6 Reservation test';
  const tenantId = 'nexus-test';
  try {
    // Trouver un service existant pour nexus-test
    const { data: services } = await supabase
      .from('services')
      .select('nom')
      .eq('tenant_id', tenantId)
      .limit(1);

    const serviceName = services?.[0]?.nom || 'Consultation test';

    // Date dans le futur pour eviter conflit
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const dateStr = futureDate.toISOString().split('T')[0];

    const result = await createReservationUnified({
      tenant_id: tenantId,
      service_name: serviceName,
      date: dateStr,
      heure: '14:00',
      client_nom: 'Jean Dupont',
      client_telephone: '0600000000',
      client_email: 'smoke@test.local',
      notes: 'SMOKE_TEST_AUTO_DELETE',
    }, 'phone', { sendSMS: false });

    if (!result.success) {
      fail(label, `createReservationUnified echec: ${result.error || result.errors?.join(', ')}`,
        'Verifier nexusCore createReservationUnified');
      return;
    }

    // Verifier telephone en DB
    const { data: rdv, error: rdvErr } = await supabase
      .from('reservations')
      .select('id, telephone')
      .eq('id', result.reservationId)
      .single();

    const hasTel = !!rdv?.telephone;

    // Cleanup
    await supabase
      .from('reservations')
      .delete()
      .eq('id', result.reservationId);
    // Cleanup client test aussi
    await supabase
      .from('clients')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('telephone', '0600000000');

    if (rdvErr) {
      fail(label, `SELECT echec: ${rdvErr.message}`,
        'Reservation creee mais illisible — verifier RLS');
    } else if (hasTel) {
      ok(label, 'telephone sauvegarde OK');
    } else {
      fail(label, `reservation ${rdv?.id} creee mais telephone=null en DB`,
        'createReservationUnified ne sauvegarde pas le telephone');
    }
  } catch (e) {
    fail(label, `Erreur: ${e.message}`, 'createReservationUnified a plante');
    // Cleanup si possible
    try {
      await supabase
        .from('reservations')
        .delete()
        .eq('tenant_id', tenantId)
        .ilike('notes', '%SMOKE_TEST_AUTO_DELETE%');
    } catch (_) { /* best effort */ }
  }
}

async function checkC7_NotificationDataFlow(tenantId) {
  const label = 'C7 Notification data';
  try {
    const { data: rdv } = await supabase
      .from('reservations')
      .select('id, telephone, client_telephone, clients(telephone, email)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!rdv) {
      skip(label, 'aucune reservation recente');
      return;
    }

    const tel = rdv.telephone || rdv.client_telephone || rdv.clients?.telephone;
    if (tel) {
      ok(label, `telephone client resolu (${tel.slice(0, 4)}...)`);
    } else {
      fail(label, `reservation ${rdv.id.slice(0, 8)}... sans telephone resolvable`,
        'Verifier que clients.telephone est rempli ou rdv.telephone non null');
    }
  } catch (e) {
    fail(label, `Erreur: ${e.message}`);
  }
}

async function checkC8_DepositReceivedFlow(tenantId) {
  const label = 'C8 Deposit received';
  try {
    const deposit = await getDepositConfig(tenantId);
    if (!deposit.enabled) {
      skip(label, 'acompte non active');
      return;
    }

    // Charger un RDV en 'demande' (si existe)
    const { data: rdv } = await supabase
      .from('reservations')
      .select('id, telephone, client_telephone, clients(telephone)')
      .eq('tenant_id', tenantId)
      .eq('statut', 'demande')
      .limit(1)
      .maybeSingle();

    if (!rdv) {
      skip(label, 'aucun RDV en demande (pas de simulation possible)');
      return;
    }

    const tel = rdv.clients?.telephone || rdv.telephone || rdv.client_telephone;
    if (tel) {
      ok(label, 'confirmation SMS resolvable');
    } else {
      fail(label, `RDV ${rdv.id.slice(0, 8)}... en demande mais telephone irresolvable`,
        'handleDepositReceived ne pourra pas envoyer de SMS');
    }
  } catch (e) {
    fail(label, `Erreur: ${e.message}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${COLORS.bold}NEXUS SMOKE TEST${COLORS.reset}`);
  console.log('================\n');

  // Initialiser le cache tenants
  try {
    await loadAllTenants();
  } catch (e) {
    console.error(`${COLORS.fail}ERREUR: Impossible de charger les tenants: ${e.message}${COLORS.reset}`);
    process.exit(1);
  }

  const tenantIds = getCachedTenantIds();
  if (tenantIds.length === 0) {
    console.error(`${COLORS.fail}ERREUR: Aucun tenant actif trouve${COLORS.reset}`);
    process.exit(1);
  }

  const realTenants = tenantIds.filter(isRealTenant);
  const skippedCount = tenantIds.length - realTenants.length;
  console.log(`${realTenants.length} tenant(s) reel(s)${skippedCount > 0 ? ` (${skippedCount} E2E/test ignores)` : ''}\n`);

  // Checks par tenant
  for (const tenantId of realTenants) {
    currentTenant = tenantId;
    const config = getCachedConfig(tenantId) || {};
    const businessType = config.business_profile || config.business_type || '?';
    console.log(`${COLORS.title}${tenantId}${COLORS.reset} (${businessType})`);

    await checkC1_RoutingTelephone(tenantId, config);
    checkC2_ConfigBusiness(tenantId, config);
    checkC3_PromptVocal(tenantId);
    await checkC4_ConfigSMS(tenantId);
    await checkC5_ConfigAcompte(tenantId);
    await checkC7_NotificationDataFlow(tenantId);
    await checkC8_DepositReceivedFlow(tenantId);

    console.log('');
  }

  // C6 — Reservation dry-run (nexus-test — peut etre absent du cache DB)
  currentTenant = 'nexus-test';
  console.log(`${COLORS.title}nexus-test${COLORS.reset} (reservation dry-run)`);
  await checkC6_ReservationDryRun();
  console.log('');

  // Rapport final
  const total = totalOk + totalFail;
  console.log('────────────────────────────────────');
  if (totalFail === 0) {
    console.log(`${COLORS.ok}${COLORS.bold}RESULTAT: ${totalOk}/${total} OK, 0 FAIL${COLORS.reset}${totalSkip > 0 ? ` (${totalSkip} skip)` : ''}`);
  } else {
    console.log(`${COLORS.fail}${COLORS.bold}RESULTAT: ${totalOk}/${total} OK, ${totalFail} FAIL${COLORS.reset}${totalSkip > 0 ? ` (${totalSkip} skip)` : ''}`);
    console.log(`\n${COLORS.fail}Failures:${COLORS.reset}`);
    for (const f of failures) {
      console.log(`  - ${COLORS.title}${f.tenant}${COLORS.reset} ${f.check}: ${f.detail}`);
    }
  }
  console.log('');

  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(`${COLORS.fail}FATAL: ${e.message}${COLORS.reset}`);
  process.exit(1);
});
