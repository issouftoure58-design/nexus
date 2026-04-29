/**
 * Routes Admin API Keys & Webhooks
 * CRUD pour la gestion des cles API et webhooks depuis admin-ui
 * Utilise authenticateAdmin (JWT) au lieu de authenticateApiKey
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/moduleProtection.js';
import { generateApiKey, hashApiKey, API_SCOPES } from '../middleware/apiAuth.js';
import logger from '../config/logger.js';

const router = express.Router();

// API keys = module Business uniquement
router.use(authenticateAdmin, requireModule('api'));

// ════════════════════════════════════════════════════════════════════
// API KEYS
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/api-keys
 * Liste les cles API du tenant
 */
router.get('/api-keys', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, rate_limit_per_hour, last_used_at, expires_at, is_active, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, api_keys: keys || [] });
  } catch (error) {
    logger.error('[ADMIN API-KEYS] List error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/api-keys
 * Creer une nouvelle cle API
 * Body: { name, scopes?: string[], rate_limit_per_hour?: number, expires_at?: string }
 */
router.post('/api-keys', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { name, scopes = ['admin'], rate_limit_per_hour = 1000, expires_at } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Nom de la cle requis' });
    }

    // Valider scopes
    const validScopes = Object.keys(API_SCOPES);
    for (const scope of scopes) {
      if (!validScopes.includes(scope)) {
        return res.status(400).json({ success: false, error: `Scope invalide: ${scope}` });
      }
    }

    // Generer la cle
    const rawKey = generateApiKey('prod');
    const keyHash = await hashApiKey(rawKey);
    const keyPrefix = rawKey.substring(0, 13);

    const { data: apiKey, error } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: tenantId,
        name: name.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes,
        rate_limit_per_hour,
        expires_at: expires_at || null,
        is_active: true,
        created_by: req.admin.id
      })
      .select('id, name, key_prefix, scopes, rate_limit_per_hour, expires_at, is_active, created_at')
      .single();

    if (error) throw error;

    // Retourner la cle en clair UNE SEULE FOIS
    res.status(201).json({
      success: true,
      api_key: apiKey,
      raw_key: rawKey,
      warning: 'Conservez cette cle, elle ne sera plus affichee.'
    });
  } catch (error) {
    logger.error('[ADMIN API-KEYS] Create error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/admin/api-keys/:id
 * Revoquer une cle API
 */
router.delete('/api-keys/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('api_keys')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: req.admin.id
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id')
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Cle non trouvee' });
    }

    res.json({ success: true, message: 'Cle revoquee' });
  } catch (error) {
    logger.error('[ADMIN API-KEYS] Revoke error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// ════════════════════════════════════════════════════════════════════
// WEBHOOKS
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/webhooks
 * Liste les webhooks du tenant
 */
router.get('/webhooks', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('id, name, url, events, is_active, last_triggered_at, last_status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, webhooks: webhooks || [] });
  } catch (error) {
    logger.error('[ADMIN WEBHOOKS] List error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/admin/webhooks
 * Creer un webhook
 * Body: { name, url, events: string[] }
 */
router.post('/webhooks', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { name, url, events } = req.body;

    if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ success: false, error: 'name, url et events (array) requis' });
    }

    // Valider URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: 'URL invalide' });
    }

    // Generer secret pour signature HMAC
    const { randomBytes } = await import('crypto');
    const secret = `whsec_${randomBytes(24).toString('hex')}`;

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .insert({
        tenant_id: tenantId,
        name: name.trim(),
        url,
        events,
        secret,
        is_active: true
      })
      .select('id, name, url, events, is_active, created_at')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      webhook,
      secret,
      warning: 'Conservez ce secret, il ne sera plus affiche.'
    });
  } catch (error) {
    logger.error('[ADMIN WEBHOOKS] Create error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/admin/webhooks/:id
 * Supprimer un webhook
 */
router.delete('/webhooks/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Webhook supprime' });
  } catch (error) {
    logger.error('[ADMIN WEBHOOKS] Delete error:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

export default router;
