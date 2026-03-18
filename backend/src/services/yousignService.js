/**
 * Yousign Service — Signature électronique
 * API v3 : https://developers.yousign.com/docs
 *
 * Environnement:
 *   YOUSIGN_API_KEY   — clé API (sandbox ou production)
 *   YOUSIGN_ENV       — 'sandbox' | 'production' (défaut: sandbox)
 *   YOUSIGN_WEBHOOK_SECRET — secret pour vérifier les webhooks
 */

import { supabase } from '../config/supabase.js';

const YOUSIGN_API_KEY = process.env.YOUSIGN_API_KEY;
const YOUSIGN_ENV = process.env.YOUSIGN_ENV || 'sandbox';
const BASE_URL = YOUSIGN_ENV === 'production'
  ? 'https://api.yousign.app/v3'
  : 'https://api-sandbox.yousign.app/v3';

function isConfigured() {
  return !!YOUSIGN_API_KEY;
}

async function yousignFetch(path, options = {}) {
  if (!isConfigured()) {
    console.log('[YOUSIGN] API non configurée — opération simulée:', path);
    return { simulated: true };
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${YOUSIGN_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Yousign API ${res.status}: ${body}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

/**
 * Crée une demande de signature
 * @param {string} tenantId
 * @param {object} params
 * @param {string} params.name — nom de la procédure (ex: "Contrat Formation")
 * @param {string} params.signerEmail
 * @param {string} params.signerFirstName
 * @param {string} params.signerLastName
 * @param {string} params.signerPhone — format +33...
 * @param {Buffer} params.fileContent — contenu PDF du document
 * @param {string} params.fileName — nom du fichier
 * @param {string} [params.clientId] — ID client NEXUS pour traçabilité
 * @param {object} [params.metadata] — métadonnées additionnelles
 * @returns {object} { signatureRequestId, signerId, documentId }
 */
export async function createSignatureRequest(tenantId, params) {
  if (!tenantId) throw new Error('tenant_id requis');

  const {
    name,
    signerEmail,
    signerFirstName,
    signerLastName,
    signerPhone,
    fileContent,
    fileName,
    clientId,
    metadata = {}
  } = params;

  if (!signerEmail) throw new Error('signerEmail requis');
  if (!fileContent) throw new Error('fileContent requis');

  // 1. Créer la signature request
  const signatureRequest = await yousignFetch('/signature_requests', {
    method: 'POST',
    body: JSON.stringify({
      name: name || 'Document à signer',
      delivery_mode: 'email',
      timezone: 'Europe/Paris',
      external_id: `nexus_${tenantId}_${clientId || 'unknown'}`,
    }),
  });

  if (signatureRequest.simulated) {
    const simId = `sim_${Date.now()}`;
    await saveSignatureRecord(tenantId, {
      yousign_request_id: simId,
      client_id: clientId,
      document_name: fileName || name,
      signer_email: signerEmail,
      status: 'draft',
      metadata: { ...metadata, simulated: true },
    });
    return { signatureRequestId: simId, simulated: true };
  }

  const requestId = signatureRequest.id;

  // 2. Uploader le document
  const formData = new FormData();
  formData.append('file', new Blob([fileContent], { type: 'application/pdf' }), fileName || 'document.pdf');
  formData.append('nature', 'signable_document');

  const document = await fetch(`${BASE_URL}/signature_requests/${requestId}/documents`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${YOUSIGN_API_KEY}` },
    body: formData,
  }).then(r => {
    if (!r.ok) throw new Error(`Yousign upload ${r.status}`);
    return r.json();
  });

  // 3. Ajouter le signataire
  const signer = await yousignFetch(`/signature_requests/${requestId}/signers`, {
    method: 'POST',
    body: JSON.stringify({
      info: {
        first_name: signerFirstName || 'Client',
        last_name: signerLastName || '',
        email: signerEmail,
        phone_number: signerPhone || undefined,
        locale: 'fr',
      },
      signature_level: 'electronic_signature',
      signature_authentication_mode: signerPhone ? 'otp_sms' : 'no_otp',
      fields: [
        {
          type: 'signature',
          document_id: document.id,
          page: 1,
          x: 77,
          y: 581,
          width: 228,
          height: 68,
        }
      ]
    }),
  });

  // 4. Activer la signature request
  await yousignFetch(`/signature_requests/${requestId}/activate`, {
    method: 'POST',
  });

  // 5. Sauvegarder en DB
  await saveSignatureRecord(tenantId, {
    yousign_request_id: requestId,
    yousign_document_id: document.id,
    yousign_signer_id: signer.id,
    client_id: clientId,
    document_name: fileName || name,
    signer_email: signerEmail,
    status: 'ongoing',
    metadata,
  });

  console.log(`[YOUSIGN] Signature request créée: ${requestId} pour ${signerEmail} (tenant: ${tenantId})`);

  return {
    signatureRequestId: requestId,
    signerId: signer.id,
    documentId: document.id,
  };
}

/**
 * Récupère le statut d'une signature request
 */
export async function getSignatureStatus(tenantId, requestId) {
  if (!tenantId) throw new Error('tenant_id requis');

  if (!isConfigured()) {
    const { data } = await supabase
      .from('signature_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('yousign_request_id', requestId)
      .single();
    return data;
  }

  const result = await yousignFetch(`/signature_requests/${requestId}`);
  return result;
}

/**
 * Liste les signatures d'un tenant
 */
export async function listSignatures(tenantId, { limit = 20, offset = 0 } = {}) {
  if (!tenantId) throw new Error('tenant_id requis');

  const { data, error, count } = await supabase
    .from('signature_requests')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { signatures: data || [], total: count || 0 };
}

/**
 * Traite un webhook Yousign
 * Events: signature_request.done, signature_request.declined, signer.done
 */
export async function handleWebhook(event) {
  const { event_name, data } = event;

  console.log(`[YOUSIGN WEBHOOK] ${event_name}`);

  const requestId = data?.signature_request?.id || data?.id;
  if (!requestId) {
    console.warn('[YOUSIGN WEBHOOK] Pas de signature_request ID dans l\'event');
    return;
  }

  // Trouver le record en DB
  const { data: record, error } = await supabase
    .from('signature_requests')
    .select('*')
    .eq('yousign_request_id', requestId)
    .single();

  if (error || !record) {
    console.warn(`[YOUSIGN WEBHOOK] Signature request ${requestId} non trouvée en DB`);
    return;
  }

  let newStatus = record.status;

  switch (event_name) {
    case 'signature_request.done':
      newStatus = 'done';
      break;
    case 'signature_request.declined':
    case 'signature_request.refused':
      newStatus = 'declined';
      break;
    case 'signature_request.expired':
      newStatus = 'expired';
      break;
    case 'signer.done':
      newStatus = 'signed';
      break;
    default:
      console.log(`[YOUSIGN WEBHOOK] Event ignoré: ${event_name}`);
      return;
  }

  // Mettre à jour le statut
  await supabase
    .from('signature_requests')
    .update({
      status: newStatus,
      signed_at: newStatus === 'done' || newStatus === 'signed' ? new Date().toISOString() : null,
      webhook_data: event,
    })
    .eq('id', record.id)
    .eq('tenant_id', record.tenant_id);

  console.log(`[YOUSIGN WEBHOOK] Signature ${requestId} → ${newStatus} (tenant: ${record.tenant_id})`);

  // Si signé, déclencher le workflow
  if (newStatus === 'done' || newStatus === 'signed') {
    try {
      const { triggerWorkflows } = await import('../automation/workflowEngine.js');

      // Récupérer le client si disponible
      let clientData = {};
      if (record.client_id) {
        const { data: client } = await supabase
          .from('clients')
          .select('id, prenom, nom, email, telephone')
          .eq('id', record.client_id)
          .eq('tenant_id', record.tenant_id)
          .single();
        if (client) clientData = client;
      }

      await triggerWorkflows('contract_signed', {
        tenant_id: record.tenant_id,
        entity: {
          ...clientData,
          type: 'signature',
          signature_request_id: requestId,
          document_name: record.document_name,
          signer_email: record.signer_email,
        }
      });
    } catch (e) {
      console.error('[YOUSIGN WEBHOOK] Erreur trigger workflow:', e);
    }
  }

  return { status: newStatus, tenant_id: record.tenant_id };
}

/**
 * Sauvegarde un record de signature en DB
 */
async function saveSignatureRecord(tenantId, data) {
  const { error } = await supabase
    .from('signature_requests')
    .insert({
      tenant_id: tenantId,
      ...data,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[YOUSIGN] Erreur sauvegarde signature record:', error);
  }
}

export default {
  isConfigured,
  createSignatureRequest,
  getSignatureStatus,
  listSignatures,
  handleWebhook,
};
