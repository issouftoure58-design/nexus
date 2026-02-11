/**
 * API REST Publique v1
 * Endpoints exposes aux clients Business via API keys
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import {
  authenticateApiKey,
  requireScope,
  generateApiKey,
  hashApiKey,
  API_SCOPES
} from '../middleware/apiAuth.js';

const router = express.Router();

// ============================================
// MIDDLEWARE - Toutes les routes requierent auth API
// ============================================
router.use(authenticateApiKey);

// ============================================
// AUTHENTICATION
// ============================================

/**
 * POST /api/v1/auth/token
 * Echanger API key contre JWT temporaire (optionnel)
 */
router.post('/auth/token', async (req, res) => {
  try {
    // L'API key est deja validee par le middleware
    // On retourne les infos de la key
    res.json({
      success: true,
      data: {
        tenant_id: req.tenantId,
        key_name: req.apiKey.name,
        scopes: req.apiKey.scopes,
        is_test: req.apiKey.isTest
      }
    });
  } catch (error) {
    console.error('[API] Auth token error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

// ============================================
// CLIENTS
// ============================================

/**
 * GET /api/v1/clients
 * Liste des clients avec pagination et filtres
 */
router.get('/clients', requireScope('read:clients'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('clients')
      .select('*', { count: 'exact' })
      .eq('tenant_id', req.tenantId)
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    // Filtre recherche
    if (search) {
      query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%,telephone.ilike.%${search}%`);
    }

    const { data: clients, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: clients,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        total_pages: Math.ceil(count / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('[API] List clients error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * GET /api/v1/clients/:id
 * Detail d'un client
 */
router.get('/clients/:id', requireScope('read:clients'), async (req, res) => {
  try {
    const { id } = req.params;

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', req.tenantId)
      .single();

    if (error || !client) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Client not found'
      });
    }

    res.json({ success: true, data: client });

  } catch (error) {
    console.error('[API] Get client error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * POST /api/v1/clients
 * Creer un nouveau client
 */
router.post('/clients', requireScope('write:clients'), async (req, res) => {
  try {
    const { nom, prenom, email, telephone, adresse, notes, tags } = req.body;

    // Validation
    if (!nom || !telephone) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'nom and telephone are required'
      });
    }

    const { data: client, error } = await supabase
      .from('clients')
      .insert({
        tenant_id: req.tenantId,
        nom,
        prenom,
        email,
        telephone,
        adresse,
        notes,
        tags: tags || []
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          error: 'duplicate',
          message: 'A client with this phone number already exists'
        });
      }
      throw error;
    }

    res.status(201).json({ success: true, data: client });

  } catch (error) {
    console.error('[API] Create client error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * PATCH /api/v1/clients/:id
 * Modifier un client
 */
router.patch('/clients/:id', requireScope('write:clients'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Retirer les champs non modifiables
    delete updates.id;
    delete updates.tenant_id;
    delete updates.created_at;

    const { data: client, error } = await supabase
      .from('clients')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', req.tenantId)
      .select()
      .single();

    if (error || !client) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Client not found'
      });
    }

    res.json({ success: true, data: client });

  } catch (error) {
    console.error('[API] Update client error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * DELETE /api/v1/clients/:id
 * Supprimer un client
 */
router.delete('/clients/:id', requireScope('delete:clients'), async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id)
      .eq('tenant_id', req.tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Client deleted' });

  } catch (error) {
    console.error('[API] Delete client error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

// ============================================
// RESERVATIONS
// ============================================

/**
 * GET /api/v1/reservations
 * Liste des reservations avec filtres
 */
router.get('/reservations', requireScope('read:reservations'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      date_from,
      date_to,
      client_id,
      sort_by = 'date',
      sort_order = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from('rendezvous')
      .select(`
        *,
        client:clients(id, nom, prenom, telephone, email)
      `, { count: 'exact' })
      .eq('tenant_id', req.tenantId)
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(offset, offset + parseInt(limit) - 1);

    // Filtres
    if (status) query = query.eq('statut', status);
    if (client_id) query = query.eq('client_id', client_id);
    if (date_from) query = query.gte('date', date_from);
    if (date_to) query = query.lte('date', date_to);

    const { data: reservations, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: reservations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        total_pages: Math.ceil(count / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('[API] List reservations error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * GET /api/v1/reservations/:id
 * Detail d'une reservation
 */
router.get('/reservations/:id', requireScope('read:reservations'), async (req, res) => {
  try {
    const { id } = req.params;

    const { data: reservation, error } = await supabase
      .from('rendezvous')
      .select(`
        *,
        client:clients(id, nom, prenom, telephone, email)
      `)
      .eq('id', id)
      .eq('tenant_id', req.tenantId)
      .single();

    if (error || !reservation) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Reservation not found'
      });
    }

    res.json({ success: true, data: reservation });

  } catch (error) {
    console.error('[API] Get reservation error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * POST /api/v1/reservations
 * Creer une reservation
 */
router.post('/reservations', requireScope('write:reservations'), async (req, res) => {
  try {
    const {
      client_id,
      service_id,
      service_name,
      date,
      heure,
      duree,
      notes,
      employee_id
    } = req.body;

    // Validation
    if (!client_id || !date || !heure) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'client_id, date, and heure are required'
      });
    }

    // Verifier que le client existe
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .eq('tenant_id', req.tenantId)
      .single();

    if (!client) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Client not found'
      });
    }

    const { data: reservation, error } = await supabase
      .from('rendezvous')
      .insert({
        tenant_id: req.tenantId,
        client_id,
        service_id,
        service_name,
        date,
        heure,
        duree: duree || 60,
        notes,
        employee_id,
        statut: 'confirme',
        source: 'api'
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data: reservation });

  } catch (error) {
    console.error('[API] Create reservation error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * PATCH /api/v1/reservations/:id
 * Modifier une reservation
 */
router.patch('/reservations/:id', requireScope('write:reservations'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Retirer les champs non modifiables
    delete updates.id;
    delete updates.tenant_id;
    delete updates.created_at;

    const { data: reservation, error } = await supabase
      .from('rendezvous')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', req.tenantId)
      .select()
      .single();

    if (error || !reservation) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Reservation not found'
      });
    }

    res.json({ success: true, data: reservation });

  } catch (error) {
    console.error('[API] Update reservation error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * DELETE /api/v1/reservations/:id
 * Annuler une reservation
 */
router.delete('/reservations/:id', requireScope('delete:reservations'), async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete - on met le statut a "annule"
    const { data: reservation, error } = await supabase
      .from('rendezvous')
      .update({
        statut: 'annule',
        cancelled_at: new Date().toISOString(),
        cancelled_via: 'api'
      })
      .eq('id', id)
      .eq('tenant_id', req.tenantId)
      .select()
      .single();

    if (error || !reservation) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Reservation not found'
      });
    }

    res.json({ success: true, data: reservation });

  } catch (error) {
    console.error('[API] Cancel reservation error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

// ============================================
// SERVICES
// ============================================

/**
 * GET /api/v1/services
 * Liste des services disponibles
 */
router.get('/services', requireScope('read:services'), async (req, res) => {
  try {
    const { data: services, error } = await supabase
      .from('services')
      .select('*')
      .eq('tenant_id', req.tenantId)
      .eq('is_active', true)
      .order('ordre', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data: services });

  } catch (error) {
    console.error('[API] List services error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

// ============================================
// WEBHOOKS MANAGEMENT
// ============================================

/**
 * GET /api/v1/webhooks
 * Liste des webhooks configures
 */
router.get('/webhooks', requireScope('read:webhooks'), async (req, res) => {
  try {
    const { data: webhooks, error } = await supabase
      .from('webhooks')
      .select('id, name, url, events, is_active, last_triggered_at, last_status, created_at')
      .eq('tenant_id', req.tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: webhooks });

  } catch (error) {
    console.error('[API] List webhooks error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * POST /api/v1/webhooks
 * Creer un webhook
 */
router.post('/webhooks', requireScope('write:webhooks'), async (req, res) => {
  try {
    const { name, url, events, headers, retry_count, timeout_seconds } = req.body;

    // Validation
    if (!name || !url || !events || events.length === 0) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'name, url, and events are required'
      });
    }

    // Valider URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Invalid URL format'
      });
    }

    // Generer secret pour signature HMAC
    const secret = generateApiKey('webhook').substring(0, 32);

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .insert({
        tenant_id: req.tenantId,
        name,
        url,
        events,
        secret,
        headers: headers || {},
        retry_count: retry_count || 3,
        timeout_seconds: timeout_seconds || 30,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;

    // Retourner avec le secret (une seule fois)
    res.status(201).json({
      success: true,
      data: {
        ...webhook,
        secret // Affiche une seule fois
      },
      message: 'Save the secret! It will not be shown again.'
    });

  } catch (error) {
    console.error('[API] Create webhook error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * PATCH /api/v1/webhooks/:id
 * Modifier un webhook
 */
router.patch('/webhooks/:id', requireScope('write:webhooks'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, events, headers, is_active, retry_count, timeout_seconds } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (url !== undefined) {
      try {
        new URL(url);
        updates.url = url;
      } catch {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Invalid URL format'
        });
      }
    }
    if (events !== undefined) updates.events = events;
    if (headers !== undefined) updates.headers = headers;
    if (is_active !== undefined) updates.is_active = is_active;
    if (retry_count !== undefined) updates.retry_count = retry_count;
    if (timeout_seconds !== undefined) updates.timeout_seconds = timeout_seconds;

    const { data: webhook, error } = await supabase
      .from('webhooks')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', req.tenantId)
      .select('id, name, url, events, is_active, headers, retry_count, timeout_seconds')
      .single();

    if (error || !webhook) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Webhook not found'
      });
    }

    res.json({ success: true, data: webhook });

  } catch (error) {
    console.error('[API] Update webhook error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * DELETE /api/v1/webhooks/:id
 * Supprimer un webhook
 */
router.delete('/webhooks/:id', requireScope('write:webhooks'), async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id)
      .eq('tenant_id', req.tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Webhook deleted' });

  } catch (error) {
    console.error('[API] Delete webhook error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

// ============================================
// API KEYS MANAGEMENT (pour le dashboard)
// ============================================

/**
 * GET /api/v1/api-keys
 * Liste des API keys du tenant (sans les secrets)
 */
router.get('/api-keys', requireScope('admin'), async (req, res) => {
  try {
    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, rate_limit_per_hour, is_active, last_used_at, expires_at, created_at')
      .eq('tenant_id', req.tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: keys });

  } catch (error) {
    console.error('[API] List API keys error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * POST /api/v1/api-keys
 * Creer une nouvelle API key
 */
router.post('/api-keys', requireScope('admin'), async (req, res) => {
  try {
    const {
      name,
      scopes = ['read:clients', 'read:reservations', 'read:services'],
      type = 'prod',
      rate_limit_per_hour = 1000,
      expires_in_days
    } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'name is required'
      });
    }

    // Generer la cle
    const apiKey = generateApiKey(type);
    const keyHash = await hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 13);

    // Calculer expiration
    let expiresAt = null;
    if (expires_in_days) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    }

    const { data: key, error } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: req.tenantId,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes,
        rate_limit_per_hour,
        expires_at: expiresAt,
        is_active: true
      })
      .select('id, name, key_prefix, scopes, rate_limit_per_hour, expires_at, created_at')
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data: {
        ...key,
        api_key: apiKey // Affiche une seule fois
      },
      message: 'Save the API key! It will not be shown again.'
    });

  } catch (error) {
    console.error('[API] Create API key error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

/**
 * DELETE /api/v1/api-keys/:id
 * Revoquer une API key
 */
router.delete('/api-keys/:id', requireScope('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Ne pas permettre de supprimer sa propre cle
    if (id === req.apiKey.id) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Cannot revoke the key currently in use'
      });
    }

    const { error } = await supabase
      .from('api_keys')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', req.tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'API key revoked' });

  } catch (error) {
    console.error('[API] Revoke API key error:', error);
    res.status(500).json({ error: 'internal_error', message: error.message });
  }
});

// ============================================
// API INFO & SCOPES
// ============================================

/**
 * GET /api/v1/scopes
 * Liste des scopes disponibles
 */
router.get('/scopes', (req, res) => {
  res.json({
    success: true,
    data: API_SCOPES
  });
});

/**
 * GET /api/v1/events
 * Liste des events webhook disponibles
 */
router.get('/events', (req, res) => {
  res.json({
    success: true,
    data: {
      'client.created': 'Triggered when a new client is created',
      'client.updated': 'Triggered when a client is updated',
      'client.deleted': 'Triggered when a client is deleted',
      'reservation.created': 'Triggered when a new reservation is created',
      'reservation.confirmed': 'Triggered when a reservation is confirmed',
      'reservation.cancelled': 'Triggered when a reservation is cancelled',
      'reservation.completed': 'Triggered when a reservation is marked as completed',
      'payment.succeeded': 'Triggered when a payment succeeds',
      'payment.failed': 'Triggered when a payment fails'
    }
  });
});

export default router;
