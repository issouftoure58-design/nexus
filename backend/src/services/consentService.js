/**
 * Consent Service - Gestion du consentement RGPD par canal
 *
 * Les notifications transactionnelles (rappels RDV, confirmations)
 * n'exigent PAS de consentement marketing.
 * Ce service gere uniquement le consentement marketing.
 */

import { supabase } from '../config/supabase.js';

const VALID_CHANNELS = ['sms', 'whatsapp', 'email', 'marketing'];

/**
 * Verifie si un client a donne son consentement pour un canal
 * @param {string} tenantId
 * @param {string} clientId
 * @param {string} channel - 'sms' | 'whatsapp' | 'email' | 'marketing'
 * @returns {Promise<boolean>}
 */
export async function hasConsent(tenantId, clientId, channel) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!clientId) throw new Error('client_id requis');
  if (!VALID_CHANNELS.includes(channel)) throw new Error(`Canal invalide: ${channel}`);

  const { data } = await supabase
    .from('client_consents')
    .select('consented')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('channel', channel)
    .single();

  return data?.consented === true;
}

/**
 * Enregistre le consentement d'un client pour un canal
 * @param {string} tenantId
 * @param {string} clientId
 * @param {string} channel
 * @param {string} source - 'manual' | 'web_form' | 'whatsapp_optin' | 'import'
 * @returns {Promise<object>}
 */
export async function grantConsent(tenantId, clientId, channel, source = 'manual') {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!clientId) throw new Error('client_id requis');
  if (!VALID_CHANNELS.includes(channel)) throw new Error(`Canal invalide: ${channel}`);

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('client_consents')
    .upsert({
      tenant_id: tenantId,
      client_id: clientId,
      channel,
      consented: true,
      consented_at: now,
      revoked_at: null,
      source,
      updated_at: now
    }, {
      onConflict: 'tenant_id,client_id,channel'
    })
    .select()
    .single();

  if (error) throw error;

  console.log(`[Consent] ${channel} accorde pour client ${clientId} (tenant ${tenantId}, source: ${source})`);
  return data;
}

/**
 * Revoque le consentement d'un client pour un canal
 * @param {string} tenantId
 * @param {string} clientId
 * @param {string} channel
 * @returns {Promise<object>}
 */
export async function revokeConsent(tenantId, clientId, channel) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!clientId) throw new Error('client_id requis');
  if (!VALID_CHANNELS.includes(channel)) throw new Error(`Canal invalide: ${channel}`);

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('client_consents')
    .upsert({
      tenant_id: tenantId,
      client_id: clientId,
      channel,
      consented: false,
      revoked_at: now,
      updated_at: now
    }, {
      onConflict: 'tenant_id,client_id,channel'
    })
    .select()
    .single();

  if (error) throw error;

  console.log(`[Consent] ${channel} revoque pour client ${clientId} (tenant ${tenantId})`);
  return data;
}

/**
 * Recupere tous les consentements d'un client
 * @param {string} tenantId
 * @param {string} clientId
 * @returns {Promise<object[]>}
 */
export async function getClientConsents(tenantId, clientId) {
  if (!tenantId) throw new Error('tenant_id requis');
  if (!clientId) throw new Error('client_id requis');

  const { data, error } = await supabase
    .from('client_consents')
    .select('channel, consented, consented_at, revoked_at, source, updated_at')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId);

  if (error) throw error;
  return data || [];
}
