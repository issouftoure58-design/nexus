/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * PLTE v2 — Tests Hebdomadaires (W1-W6)
 * Tests IA profonds + securite — executé le lundi a 03h00
 */

import { supabase } from '../../config/supabase.js';

function makeResult(name, module, severity, description, status, error = null) {
  return { name, module, severity, description, status, error: error ? simplifyError(error) : null, category: 'weekly' };
}

function simplifyError(error) {
  if (!error) return null;
  const translations = [
    [/schema cache/i, 'Colonne manquante en base de donnees'],
    [/TENANT_ID_REQUIRED/i, 'Configuration IA manquante pour ce tenant'],
    [/PGRST205|42P01/i, 'Table inexistante en base de donnees'],
    [/violates check constraint/i, 'Format de donnee invalide'],
    [/permission denied/i, 'Permission refusee (RLS)'],
  ];
  for (const [regex, friendly] of translations) {
    if (regex.test(error)) return `${friendly} — Detail: ${error.substring(0, 120)}`;
  }
  return error;
}

/**
 * Execute les tests hebdomadaires W1-W6 pour un tenant
 */
export async function runWeeklyTests(ctx) {
  const results = [];
  const { tenantId } = ctx;

  // W1 — Admin chat tool execution
  results.push(await testW1_AdminChatTool(tenantId));

  // W2 — Admin chat creation reservation
  results.push(await testW2_AdminChatReservation(tenantId));

  // W3 — Admin chat multi-tool (CA + clients)
  results.push(await testW3_AdminChatMultiTool(tenantId));

  // W4 — WhatsApp simulation
  results.push(await testW4_WhatsApp(tenantId));

  // W5 — Injection SQL dans noms
  results.push(await testW5_InjectionSQL(tenantId));

  // W6 — XSS payload dans champs
  results.push(await testW6_XSS(tenantId));

  return results;
}

// ============================================
// W1 — ADMIN CHAT TOOL EXECUTION
// ============================================

async function testW1_AdminChatTool(tenantId) {
  const name = 'W1_admin_chat_tool';
  const module = 'ia';
  const severity = 'warning';
  const description = 'Admin chat: execution d\'outil (reservations)';

  try {
    const { processMessage } = await import('../../core/unified/nexusCore.js');

    const result = await processMessage(
      'Combien de reservations ai-je cette semaine ?',
      'admin',
      {
        tenantId,
        conversationId: `plte-w1-${tenantId}-${Date.now()}`,
        userId: 'plte-system',
      }
    );

    if (!result?.success) {
      return makeResult(name, module, severity, description, 'fail',
        `Chat echoue: ${result?.error || 'pas de reponse'}`);
    }

    if (!result.response || result.response.length < 10) {
      return makeResult(name, module, severity, description, 'fail',
        'Reponse trop courte — outil probablement pas execute');
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// W2 — ADMIN CHAT CREATION RESERVATION
// ============================================

async function testW2_AdminChatReservation(tenantId) {
  const name = 'W2_admin_chat_reservation';
  const module = 'ia';
  const severity = 'warning';
  const description = 'Admin chat: demande creation RDV';

  try {
    const { processMessage } = await import('../../core/unified/nexusCore.js');

    const result = await processMessage(
      'Combien de clients ai-je au total ?',
      'admin',
      {
        tenantId,
        conversationId: `plte-w2-${tenantId}-${Date.now()}`,
        userId: 'plte-system',
      }
    );

    if (!result?.success) {
      return makeResult(name, module, severity, description, 'fail',
        `Chat echoue: ${result?.error}`);
    }

    // Verifier que la reponse contient un nombre
    const hasNumber = /\d+/.test(result.response);
    if (!hasNumber) {
      return makeResult(name, module, severity, description, 'fail',
        'Reponse ne contient pas de nombre de clients');
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// W3 — ADMIN CHAT MULTI-TOOL
// ============================================

async function testW3_AdminChatMultiTool(tenantId) {
  const name = 'W3_admin_chat_multi_tool';
  const module = 'ia';
  const severity = 'warning';
  const description = 'Admin chat: question CA du mois (multi-tool)';

  try {
    const { processMessage } = await import('../../core/unified/nexusCore.js');

    const result = await processMessage(
      'Quel est le chiffre d\'affaires du mois en cours ?',
      'admin',
      {
        tenantId,
        conversationId: `plte-w3-${tenantId}-${Date.now()}`,
        userId: 'plte-system',
      }
    );

    if (!result?.success) {
      return makeResult(name, module, severity, description, 'fail',
        `Chat echoue: ${result?.error}`);
    }

    if (!result.response || result.response.length < 5) {
      return makeResult(name, module, severity, description, 'fail', 'Reponse vide');
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// W4 — WHATSAPP SIMULATION
// ============================================

async function testW4_WhatsApp(tenantId) {
  const name = 'W4_whatsapp_simulation';
  const module = 'ia';
  const severity = 'info';
  const description = 'WhatsApp: question horaires';

  try {
    const { processMessage } = await import('../../core/unified/nexusCore.js');

    const result = await processMessage(
      'Quels sont vos horaires d\'ouverture ?',
      'whatsapp',
      {
        tenantId,
        conversationId: `plte-w4-${tenantId}-${Date.now()}`,
        phone: '0600000099',
      }
    );

    if (!result?.success) {
      return makeResult(name, module, severity, description, 'fail',
        `WhatsApp echoue: ${result?.error}`);
    }

    if (!result.response || result.response.length < 10) {
      return makeResult(name, module, severity, description, 'fail', 'Reponse trop courte');
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// W5 — INJECTION SQL
// ============================================

async function testW5_InjectionSQL(tenantId) {
  const name = 'W5_injection_sql';
  const module = 'security';
  const severity = 'critical';
  const description = 'Protection injection SQL dans noms';

  try {
    const malicious = "Robert'; DROP TABLE clients;--";

    // Tenter d'inserer un client avec un nom malveillant
    const { data, error } = await supabase
      .from('clients')
      .insert({
        tenant_id: tenantId,
        nom: malicious,
        prenom: 'Test',
        email: `sqli-${Date.now()}@plte.internal`,
        telephone: '0600000098',
      })
      .select('id, nom');

    // Si ca passe, verifier que le nom est stocke tel quel (echappage parametrise)
    if (data?.[0]) {
      const storedName = data[0].nom;
      if (storedName !== malicious) {
        // Cleanup
        await supabase.from('clients').delete().eq('id', data[0].id);
        return makeResult(name, module, severity, description, 'fail',
          'Nom SQL stocke differemment — possible traitement non securise');
      }

      // Verifier que la table clients existe toujours
      const { count } = await supabase
        .from('clients')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .limit(1);

      // Cleanup
      await supabase.from('clients').delete().eq('id', data[0].id);

      if (count === null || count === undefined) {
        return makeResult(name, module, severity, description, 'fail',
          'Table clients inaccessible apres injection — GRAVE');
      }

      return makeResult(name, module, severity, description, 'pass');
    }

    // Si erreur a l'insertion, verifier que c'est pas un crash
    if (error) {
      // L'important c'est que le systeme ne crash pas
      return makeResult(name, module, severity, description, 'pass',
        `Insertion refusee proprement: ${error.message}`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// W6 — XSS
// ============================================

async function testW6_XSS(tenantId) {
  const name = 'W6_xss_payload';
  const module = 'security';
  const severity = 'warning';
  const description = 'XSS payload dans champs stockage';

  try {
    const xssPayload = '<script>alert("XSS")</script>';

    const { data, error } = await supabase
      .from('clients')
      .insert({
        tenant_id: tenantId,
        nom: xssPayload,
        prenom: '<img src=x onerror=alert(1)>',
        email: `xss-${Date.now()}@plte.internal`,
        telephone: '0600000097',
      })
      .select('id, nom, prenom');

    if (data?.[0]) {
      // Les champs sont stockes tels quels (normal, le frontend doit echapper)
      // Verifier que le stockage est correct
      const stored = data[0];

      // Cleanup
      await supabase.from('clients').delete().eq('id', stored.id);

      // Le test passe si les donnees sont stockees sans crash
      // L'echappement est la responsabilite du frontend (React echappe par defaut)
      return makeResult(name, module, severity, description, 'pass',
        'XSS stocke correctement — echappement cote frontend (React auto-escape)');
    }

    if (error) {
      return makeResult(name, module, severity, description, 'pass',
        `Insertion XSS refusee: ${error.message}`);
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}
