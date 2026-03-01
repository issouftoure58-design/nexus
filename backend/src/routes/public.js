/**
 * Routes publiques pour les clients (sans authentification)
 *
 * GET /api/services - Liste des services du tenant
 * POST /api/chat - Chat avec l'IA
 * POST /api/chat/stream - Chat streaming (SSE)
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { resolveTenantFromDomain, loadTenant } from '../core/TenantContext.js';
// V2 - Multi-tenant messages
import { getBusinessInfoSync, getDefaultLocation } from '../services/tenantBusinessService.js';
import logger from '../config/logger.js';

/**
 * V2 - Génère le message d'accueil dynamique
 */
function getGreetingMessage(tenantId, salutation = 'Bonjour') {
  try {
    const info = getBusinessInfoSync(tenantId);
    const assistant = info.assistant?.name || 'Nexus';
    const gerant = info.gerant || 'notre équipe';
    return `${salutation} ! Je suis ${assistant}, l'assistant${assistant === 'Halimah' ? 'e' : ''} de ${gerant}.\n`;
  } catch (e) {
    return `${salutation} ! Je suis Halimah, l'assistante de Fatou.\n`;
  }
}

const router = express.Router();

/**
 * 🔒 MIDDLEWARE MULTI-TENANT SÉCURISÉ
 * Résout le tenant depuis le domaine, header ou query param
 * JAMAIS de fallback sur un tenant par défaut!
 *
 * IMPORTANT: Ce middleware ne s'applique PAS aux routes /admin/*
 * qui utilisent leur propre système d'auth avec tenant_id dans le JWT.
 */
const resolveTenant = async (req, res, next) => {
  // 🔒 SKIP pour les routes avec leur propre système d'auth
  // - /admin/* : Auth admin JWT
  // - /sentinel/* : Auth JWT + requirePlan
  // - /tenants/* : Auth admin JWT
  // - /billing/* : Auth admin JWT
  // - /quotas/* : Auth admin JWT
  // - /whatsapp/* : Routing par numéro Twilio
  // - /twilio/* : Webhooks Twilio (voice)
  // - /voice/* : TTS routes
  // - /reviews/* : Public + Admin routes
  // - /payment/* : Routes de paiement
  const skipPrefixes = ['/admin', '/sentinel', '/tenants', '/billing', '/quotas', '/trial', '/modules', '/whatsapp', '/twilio', '/voice', '/reviews', '/payment', '/provisioning', '/webhooks', '/signup'];
  if (skipPrefixes.some(prefix => req.path.startsWith(prefix))) {
    return next();
  }

  const host = req.get('host') || '';
  const tenantHeader = req.get('X-Tenant-ID');
  const tenantQuery = req.query.tenant_id;

  let tenantId = null;

  // 1. Header X-Tenant-ID (priorité max pour API)
  if (tenantHeader) {
    tenantId = tenantHeader;
  }
  // 2. Query param tenant_id
  else if (tenantQuery) {
    tenantId = tenantQuery;
  }
  // 3. Résolution par domaine (depuis BDD)
  else {
    try {
      const context = await resolveTenantFromDomain(host);
      tenantId = context.id;
    } catch (e) {
      // Si le domaine n'est pas trouvé, vérifier si c'est un domaine de dev
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        // En dev, exiger un header ou query param
        console.warn(`[PUBLIC] Dev mode: tenant_id required via header or query param`);
        return res.status(400).json({
          error: 'tenant_required',
          message: 'En mode développement, utilisez le header X-Tenant-ID ou le query param tenant_id',
        });
      }
      console.error(`[PUBLIC] Cannot resolve tenant for host: ${host}`, e.message);
      return res.status(400).json({
        error: 'tenant_not_found',
        message: `Aucun tenant trouvé pour le domaine ${host}`,
      });
    }
  }

  // Valider que le tenant existe
  try {
    const context = await loadTenant(tenantId);
    req.tenantId = context.id;
    req.tenantContext = context;
    console.log(`[PUBLIC] Tenant resolved: ${req.tenantId} (host: ${host})`);
    next();
  } catch (loadError) {
    console.error(`[PUBLIC] Invalid tenant_id: ${tenantId}`, loadError.message);
    return res.status(404).json({
      error: 'tenant_invalid',
      message: `Tenant '${tenantId}' non trouvé`,
    });
  }
};

router.use(resolveTenant);

/**
 * GET /api/services
 * Liste publique des services du tenant
 */
router.get('/services', async (req, res) => {
  try {
    const { data: services, error } = await supabase
      .from('services')
      .select('*')
      .eq('tenant_id', req.tenantId)
      .order('ordre', { ascending: true, nullsFirst: false });

    if (error) throw error;

    // Mapper les champs pour le frontend
    const mappedServices = (services || []).map(s => ({
      id: s.id,
      nom: s.nom,
      description: s.description || '',
      duree: s.duree || 0,
      prix: s.prix || 0,
      categorie: s.categorie || 'Coiffure',
      image: s.image || null,
      populaire: s.populaire || false,
      prix_variable: s.prix_variable || false,
      prix_min: s.prix_min || null,
      prix_max: s.prix_max || null,
    }));

    res.json({ services: mappedServices });
  } catch (error) {
    console.error('[PUBLIC SERVICES] Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/chat
 * Chat avec l'IA (Halimah)
 */
router.post('/chat', async (req, res) => {
  const { message, sessionId, isFirstMessage = false } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  try {
    // Import dynamique du nexusCore
    const nexusCore = await import('../core/unified/nexusCore.js');
    const { processMessage } = nexusCore;

    const conversationId = sessionId || `web_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log(`[CHAT-WEB] Session: ${conversationId} | Tenant: ${req.tenantId}`);

    // Traiter le message avec NEXUS Core
    const result = await processMessage(message, 'web', {
      conversationId,
      isFirstMessage,
      tenantId: req.tenantId
    });

    console.log(`[CHAT-WEB] Reponse en ${result.duration}ms`);

    // Gerer le premier message (salutation)
    let response = result.response;
    if (isFirstMessage) {
      const currentHour = new Date().getHours();
      const salutation = currentHour >= 18 ? 'Bonsoir' : 'Bonjour';
      const startsWithGreeting = /^(Bonjour|Bonsoir)/i.test(response.trim());

      if (!startsWithGreeting) {
        const greeting = getGreetingMessage(req.tenantId, salutation);
        response = `${greeting}Comment puis-je vous aider ?\n\n${response}`;
      }
    }

    res.json({
      response,
      sessionId: conversationId,
      duration: result.duration
    });

  } catch (error) {
    console.error('[CHAT-WEB] Erreur:', error);
    res.status(500).json({
      message: error.message || 'Erreur du service de chat'
    });
  }
});

/**
 * POST /api/chat/stream
 * Chat streaming avec Server-Sent Events (SSE)
 */
router.post('/chat/stream', async (req, res) => {
  const { message, sessionId, isFirstMessage = false } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  // Configurer headers SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const nexusCore = await import('../core/unified/nexusCore.js');
    const { processMessageStreaming } = nexusCore;

    const conversationId = sessionId || `web_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log(`[CHAT-STREAM] Session: ${conversationId} | Tenant: ${req.tenantId}`);

    // Salutation pour premier message
    if (isFirstMessage) {
      const currentHour = new Date().getHours();
      const salutation = currentHour >= 18 ? 'Bonsoir' : 'Bonjour';
      const greeting = getGreetingMessage(req.tenantId, salutation);
      res.write(`data: ${JSON.stringify({ type: 'text', content: greeting })}\n\n`);
    }

    // Iterer sur le generateur streaming
    const generator = processMessageStreaming(message, 'web', {
      conversationId,
      isFirstMessage,
      tenantId: req.tenantId
    });

    for await (const event of generator) {
      if (event.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ type: 'text', content: event.content })}\n\n`);
      } else if (event.type === 'tool_use') {
        res.write(`data: ${JSON.stringify({ type: 'tool', tool: event.name })}\n\n`);
      } else if (event.type === 'done') {
        res.write(`data: ${JSON.stringify({ type: 'done', sessionId: conversationId, response: event.response })}\n\n`);
      }
    }

    res.end();

  } catch (error) {
    console.error('[CHAT-STREAM] Erreur:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

/**
 * GET /api/disponibilites
 * Creneaux disponibles pour une date
 */
router.get('/disponibilites', async (req, res) => {
  const { date, service_id } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date requise' });
  }

  try {
    // Récupérer la durée du service si fourni
    let duree_minutes = 60; // Durée par défaut
    if (service_id) {
      const { data: service } = await supabase
        .from('services')
        .select('duree')
        .eq('id', service_id)
        .eq('tenant_id', req.tenantId)
        .maybeSingle();

      if (service?.duree) {
        duree_minutes = service.duree;
      }
    }

    // Récupérer les RDV existants pour cette date
    const { data: rdvExistants } = await supabase
      .from('reservations')
      .select('id, heure, duree_minutes, client_nom, service_nom')
      .eq('tenant_id', req.tenantId)
      .eq('date', date)
      .in('statut', ['confirmé', 'en_attente']);

    // Import du service de disponibilites
    const dispoService = await import('../services/dispoService.js');

    // Appel avec les bons paramètres: (date, duree, adresse, rdv_existants)
    const creneaux = await dispoService.getCreneauxDisponibles(
      date,
      duree_minutes,
      null, // pas d'adresse client pour l'instant
      rdvExistants || []
    );

    res.json({ creneaux });
  } catch (error) {
    console.error('[DISPONIBILITES] Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /api/rendez-vous
 * Creer un rendez-vous (public)
 */
router.post('/rendez-vous', async (req, res) => {
  const {
    client_name,
    client_phone,
    client_email,
    service_id,
    date,
    heure,
    lieu_type,
    adresse
  } = req.body;

  // Validation
  if (!client_name || !client_phone || !service_id || !date || !heure) {
    return res.status(400).json({
      error: 'Donnees manquantes',
      required: ['client_name', 'client_phone', 'service_id', 'date', 'heure']
    });
  }

  try {
    // Récupérer le nom du service depuis la BDD
    const { data: serviceData, error: serviceError } = await supabase
      .from('services')
      .select('nom')
      .eq('id', service_id)
      .eq('tenant_id', req.tenantId)
      .single();

    if (serviceError || !serviceData) {
      return res.status(400).json({ error: 'Service non trouvé' });
    }

    // Import du service de booking
    const bookingService = await import('../services/bookingService.js');

    // Mapper les champs vers les noms attendus par createReservationUnified
    const result = await bookingService.createReservationUnified({
      tenant_id: req.tenantId,
      client_nom: client_name,
      client_telephone: client_phone,
      client_email,
      service_name: serviceData.nom,
      date,
      heure,
      lieu: lieu_type || getDefaultLocation(req.tenantId),
      adresse
    }, {
      channel: 'web',
      sendSMS: true
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error || result.errors?.join(', ') });
    }

    res.json({
      success: true,
      reservation: result,
      message: 'Rendez-vous cree avec succes'
    });

  } catch (error) {
    console.error('[RENDEZ-VOUS] Erreur:', error);
    res.status(500).json({ error: 'Erreur lors de la creation du rendez-vous' });
  }
});

/**
 * GET /api/rendez-vous/:id
 * Details d'un rendez-vous
 */
router.get('/rendez-vous/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { data: rdv, error } = await supabase
      .from('reservations')
      .select(`
        *,
        clients (id, nom, prenom, telephone, email),
        services (id, nom, duree, prix)
      `)
      .eq('id', id)
      .eq('tenant_id', req.tenantId)
      .single();

    if (error || !rdv) {
      return res.status(404).json({ error: 'Rendez-vous non trouve' });
    }

    res.json({ reservation: rdv });
  } catch (error) {
    console.error('[RENDEZ-VOUS GET] Erreur:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
