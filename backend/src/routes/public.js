/**
 * Routes publiques pour les clients (sans authentification)
 *
 * GET /api/services - Liste des services du tenant
 * POST /api/chat - Chat avec l'IA
 * POST /api/chat/stream - Chat streaming (SSE)
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { identifyTenant } from '../config/tenants/index.js';

const router = express.Router();

// Middleware pour identifier le tenant depuis le domaine ou header
const resolveTenant = (req, res, next) => {
  // Essayer d'identifier le tenant depuis le domaine
  const host = req.get('host') || '';
  const tenantHeader = req.get('X-Tenant-ID');

  // Mapping domaine -> tenant_id
  const domainToTenant = {
    'fatshairafro.fr': 'fatshairafro',
    'www.fatshairafro.fr': 'fatshairafro',
    'halimah-api.onrender.com': 'fatshairafro',
    'nexus-backend-dev.onrender.com': 'fatshairafro', // Default pour dev
    'localhost': 'fatshairafro', // Local dev
  };

  // Chercher le tenant depuis le domaine
  let tenantId = null;
  for (const [domain, tenant] of Object.entries(domainToTenant)) {
    if (host.includes(domain)) {
      tenantId = tenant;
      break;
    }
  }

  // Fallback sur header ou query param
  req.tenantId = tenantId || tenantHeader || req.query.tenant_id || 'fatshairafro';

  console.log(`[PUBLIC] Tenant resolved: ${req.tenantId} (host: ${host})`);
  next();
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
        response = `${salutation} ! Je suis Halimah, l'assistante de Fatou.\nComment puis-je vous aider ?\n\n${response}`;
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
      const greeting = `${salutation} ! Je suis Halimah, l'assistante de Fatou.\n`;
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
    // Import du service de disponibilites
    const dispoService = await import('../services/dispoService.js');
    const creneaux = await dispoService.getCreneauxDisponibles(req.tenantId, date, service_id);

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
    // Import du service de booking
    const bookingService = await import('../services/bookingService.js');

    const result = await bookingService.createReservationUnified({
      tenant_id: req.tenantId,
      client_name,
      client_phone,
      client_email,
      service_id,
      date,
      heure,
      lieu_type: lieu_type || 'domicile',
      adresse
    }, {
      channel: 'web',
      sendSMS: true
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      reservation: result.reservation,
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
