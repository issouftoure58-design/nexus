/**
 * Webhook Service
 * Gestion des webhooks sortants avec retry et logging
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase.js';

// Events supportes
export const WEBHOOK_EVENTS = [
  'client.created',
  'client.updated',
  'client.deleted',
  'reservation.created',
  'reservation.confirmed',
  'reservation.cancelled',
  'reservation.completed',
  'payment.succeeded',
  'payment.failed',
  'invoice.created',
  'invoice.paid',
  'stock.low',
  'employee.created'
];

// Delais de retry en millisecondes (backoff exponentiel)
const RETRY_DELAYS = [
  0,        // Immediat
  5000,     // 5 secondes
  30000,    // 30 secondes
  120000,   // 2 minutes
  600000    // 10 minutes
];

/**
 * Signe un payload avec HMAC-SHA256
 * @param {object} payload
 * @param {string} secret
 * @returns {string}
 */
function signPayload(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Envoie un webhook a une URL
 * @param {object} webhook - Configuration webhook
 * @param {object} payload - Donnees a envoyer
 * @param {number} retryCount - Numero de tentative
 * @returns {Promise<object>}
 */
async function sendWebhookRequest(webhook, payload, retryCount = 0) {
  const timestamp = Date.now();

  // Construire le payload complet
  const fullPayload = {
    id: crypto.randomUUID(),
    event: payload.event,
    created_at: new Date().toISOString(),
    data: payload.data,
    tenant_id: webhook.tenant_id
  };

  // Signer si secret configure
  const signature = webhook.secret ? signPayload(fullPayload, webhook.secret) : null;

  // Headers
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'NEXUS-Webhooks/1.0',
    'X-Webhook-ID': fullPayload.id,
    'X-Webhook-Event': payload.event,
    'X-Webhook-Timestamp': timestamp.toString(),
    ...(signature && { 'X-Webhook-Signature': signature }),
    ...webhook.headers
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), (webhook.timeout_seconds || 30) * 1000);

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(fullPayload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const responseText = await response.text();

    return {
      success: response.ok,
      status_code: response.status,
      response_body: responseText.substring(0, 1000), // Limiter taille
      error_message: response.ok ? null : `HTTP ${response.status}`,
      responded_at: new Date().toISOString()
    };

  } catch (error) {
    clearTimeout(timeout);

    const isTimeout = error.name === 'AbortError';
    return {
      success: false,
      status_code: null,
      response_body: null,
      error_message: isTimeout ? 'Request timeout' : error.message,
      responded_at: new Date().toISOString()
    };
  }
}

/**
 * Log un webhook dans la base de donnees
 * @param {object} logData
 */
async function logWebhook(logData) {
  try {
    await supabase.from('webhook_logs').insert(logData);
  } catch (error) {
    console.error('[WEBHOOK] Erreur logging:', error.message);
  }
}

/**
 * Declenche les webhooks pour un evenement
 * @param {string} tenantId - ID du tenant
 * @param {string} eventType - Type d'evenement (ex: 'client.created')
 * @param {object} data - Donnees de l'evenement
 */
export async function triggerWebhook(tenantId, eventType, data) {
  try {
    // Trouver webhooks actifs pour ce tenant + event
    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .contains('events', [eventType]);

    if (error) {
      console.error('[WEBHOOK] Erreur fetch webhooks:', error);
      return;
    }

    if (!webhooks || webhooks.length === 0) {
      return; // Pas de webhooks configures pour cet event
    }

    console.log(`[WEBHOOK] Triggering ${webhooks.length} webhook(s) for ${eventType}`);

    // Envoyer a chaque webhook (en parallele)
    const promises = webhooks.map(async (webhook) => {
      const payload = { event: eventType, data };

      // Tentative initiale
      let result = await sendWebhookRequest(webhook, payload, 0);

      // Retries si echec
      let retryCount = 0;
      while (!result.success && retryCount < (webhook.retry_count || 3)) {
        retryCount++;
        const delay = RETRY_DELAYS[retryCount] || RETRY_DELAYS[RETRY_DELAYS.length - 1];

        console.log(`[WEBHOOK] Retry ${retryCount}/${webhook.retry_count} for ${webhook.name} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));

        result = await sendWebhookRequest(webhook, payload, retryCount);
      }

      // Log le resultat final
      await logWebhook({
        webhook_id: webhook.id,
        tenant_id: tenantId,
        event_type: eventType,
        payload: data,
        status: result.success ? 'success' : 'failed',
        status_code: result.status_code,
        response_body: result.response_body,
        error_message: result.error_message,
        retry_count: retryCount,
        responded_at: result.responded_at
      });

      // Mettre a jour le webhook
      await supabase
        .from('webhooks')
        .update({
          last_triggered_at: new Date().toISOString(),
          last_status: result.success ? 'success' : 'failed'
        })
        .eq('id', webhook.id);

      return { webhook: webhook.name, ...result };
    });

    const results = await Promise.all(promises);

    // Log resume
    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    if (failed > 0) {
      console.log(`[WEBHOOK] ${eventType}: ${succeeded} succeeded, ${failed} failed`);
    }

    return results;

  } catch (error) {
    console.error('[WEBHOOK] Erreur trigger:', error);
  }
}

/**
 * Helpers pour declencher des webhooks specifiques
 */

export async function onClientCreated(tenantId, client) {
  await triggerWebhook(tenantId, 'client.created', {
    id: client.id,
    nom: client.nom,
    prenom: client.prenom,
    telephone: client.telephone,
    email: client.email,
    created_at: client.created_at
  });
}

export async function onClientUpdated(tenantId, client, changes) {
  await triggerWebhook(tenantId, 'client.updated', {
    id: client.id,
    changes,
    updated_at: client.updated_at
  });
}

export async function onClientDeleted(tenantId, clientId) {
  await triggerWebhook(tenantId, 'client.deleted', {
    id: clientId,
    deleted_at: new Date().toISOString()
  });
}

export async function onReservationCreated(tenantId, reservation) {
  await triggerWebhook(tenantId, 'reservation.created', {
    id: reservation.id,
    client_id: reservation.client_id,
    service_name: reservation.service_name,
    date: reservation.date,
    heure: reservation.heure,
    statut: reservation.statut,
    created_at: reservation.created_at
  });
}

export async function onReservationConfirmed(tenantId, reservation) {
  await triggerWebhook(tenantId, 'reservation.confirmed', {
    id: reservation.id,
    client_id: reservation.client_id,
    date: reservation.date,
    heure: reservation.heure,
    confirmed_at: new Date().toISOString()
  });
}

export async function onReservationCancelled(tenantId, reservation, reason) {
  await triggerWebhook(tenantId, 'reservation.cancelled', {
    id: reservation.id,
    client_id: reservation.client_id,
    date: reservation.date,
    reason,
    cancelled_at: new Date().toISOString()
  });
}

export async function onReservationCompleted(tenantId, reservation) {
  await triggerWebhook(tenantId, 'reservation.completed', {
    id: reservation.id,
    client_id: reservation.client_id,
    date: reservation.date,
    completed_at: new Date().toISOString()
  });
}

export async function onPaymentSucceeded(tenantId, payment) {
  await triggerWebhook(tenantId, 'payment.succeeded', {
    id: payment.id,
    amount: payment.amount,
    currency: payment.currency || 'EUR',
    reservation_id: payment.reservation_id,
    client_id: payment.client_id,
    method: payment.method,
    paid_at: new Date().toISOString()
  });
}

export async function onPaymentFailed(tenantId, payment, error) {
  await triggerWebhook(tenantId, 'payment.failed', {
    id: payment.id,
    amount: payment.amount,
    reservation_id: payment.reservation_id,
    client_id: payment.client_id,
    error: error,
    failed_at: new Date().toISOString()
  });
}

export async function onStockLow(tenantId, product) {
  await triggerWebhook(tenantId, 'stock.low', {
    product_id: product.id,
    product_name: product.nom,
    current_stock: product.quantite,
    threshold: product.seuil_alerte,
    alert_at: new Date().toISOString()
  });
}

/**
 * Teste un webhook (envoie un event de test)
 * @param {string} webhookId
 * @param {string} tenantId
 */
export async function testWebhook(webhookId, tenantId) {
  const { data: webhook, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('id', webhookId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !webhook) {
    throw new Error('Webhook not found');
  }

  const testPayload = {
    event: 'webhook.test',
    data: {
      message: 'This is a test webhook from NEXUS',
      timestamp: new Date().toISOString(),
      webhook_name: webhook.name
    }
  };

  const result = await sendWebhookRequest(webhook, testPayload);

  await logWebhook({
    webhook_id: webhook.id,
    tenant_id: tenantId,
    event_type: 'webhook.test',
    payload: testPayload.data,
    status: result.success ? 'success' : 'failed',
    status_code: result.status_code,
    response_body: result.response_body,
    error_message: result.error_message,
    retry_count: 0,
    responded_at: result.responded_at
  });

  return result;
}

export default {
  triggerWebhook,
  testWebhook,
  WEBHOOK_EVENTS,
  onClientCreated,
  onClientUpdated,
  onClientDeleted,
  onReservationCreated,
  onReservationConfirmed,
  onReservationCancelled,
  onReservationCompleted,
  onPaymentSucceeded,
  onPaymentFailed,
  onStockLow
};
