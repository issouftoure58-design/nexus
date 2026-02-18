/**
 * Routes Admin - Configuration IA (Telephone & WhatsApp)
 *
 * Permet aux tenants de configurer leurs agents IA vocaux et messaging.
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ============================================
// TELEPHONE IA CONFIG
// ============================================

/**
 * GET /api/admin/ia/telephone/config
 * Recupere la configuration IA telephone du tenant
 */
router.get('/telephone/config', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const { data, error } = await supabase
      .from('tenant_ia_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('channel', 'telephone')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Config par defaut si pas encore configuree
    const defaultConfig = {
      greeting_message: "Bonjour ! Je suis l'assistante virtuelle. Comment puis-je vous aider ?",
      voice_style: 'polly_lea',
      tone: 'professionnel',
      language: 'fr-FR',
      transfer_phone: '',
      max_duration_seconds: 300,
      business_hours: {
        enabled: false,
        message_outside_hours: "Nous sommes actuellement fermes."
      },
      personality: 'Assistante professionnelle et chaleureuse',
      services_description: '',
      booking_enabled: true,
      active: true
    };

    res.json({
      success: true,
      config: data?.config || defaultConfig
    });
  } catch (error) {
    console.error('[IA Config] Erreur GET telephone:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/ia/telephone/config
 * Sauvegarde la configuration IA telephone
 */
router.put('/telephone/config', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const config = req.body;

    const { error } = await supabase
      .from('tenant_ia_config')
      .upsert({
        tenant_id: tenantId,
        channel: 'telephone',
        config: config,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,channel'
      });

    if (error) throw error;

    console.log(`[IA Config] Telephone config saved for ${tenantId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[IA Config] Erreur PUT telephone:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/ia/telephone/test
 * Teste l'agent IA telephone avec un message
 */
router.post('/telephone/test', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { message } = req.body;

    // Importer processMessage pour tester
    const { processMessage } = await import('../core/unified/nexusCore.js');

    const result = await processMessage(message || 'Bonjour', 'phone', {
      conversationId: `test_${Date.now()}`,
      tenantId,
      isTest: true
    });

    res.json({
      success: true,
      response: result.response,
      duration: result.duration
    });
  } catch (error) {
    console.error('[IA Config] Erreur test telephone:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// WHATSAPP IA CONFIG
// ============================================

/**
 * GET /api/admin/ia/whatsapp/config
 * Recupere la configuration IA WhatsApp du tenant
 */
router.get('/whatsapp/config', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const { data, error } = await supabase
      .from('tenant_ia_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('channel', 'whatsapp')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Config par defaut
    const defaultConfig = {
      greeting_message: "Bonjour ! Comment puis-je vous aider ?",
      tone: 'professionnel',
      language: 'fr-FR',
      response_delay_ms: 1000,
      business_hours: {
        enabled: false,
        message_outside_hours: "Nous vous repondrons des notre reouverture."
      },
      personality: 'Assistante chaleureuse',
      services_description: '',
      booking_enabled: true,
      send_images: true,
      send_location: true,
      quick_replies_enabled: true,
      quick_replies: ['Prendre RDV', 'Nos services', 'Horaires', 'Contact'],
      active: true
    };

    res.json({
      success: true,
      config: data?.config || defaultConfig
    });
  } catch (error) {
    console.error('[IA Config] Erreur GET whatsapp:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/ia/whatsapp/config
 * Sauvegarde la configuration IA WhatsApp
 */
router.put('/whatsapp/config', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const config = req.body;

    const { error } = await supabase
      .from('tenant_ia_config')
      .upsert({
        tenant_id: tenantId,
        channel: 'whatsapp',
        config: config,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,channel'
      });

    if (error) throw error;

    console.log(`[IA Config] WhatsApp config saved for ${tenantId}`);

    res.json({ success: true });
  } catch (error) {
    console.error('[IA Config] Erreur PUT whatsapp:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/ia/whatsapp/test
 * Teste l'agent IA WhatsApp avec un message
 */
router.post('/whatsapp/test', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { message } = req.body;

    const { processMessage } = await import('../core/unified/nexusCore.js');

    const result = await processMessage(message || 'Bonjour', 'whatsapp', {
      conversationId: `test_wa_${Date.now()}`,
      tenantId,
      isTest: true
    });

    res.json({
      success: true,
      response: result.response,
      duration: result.duration
    });
  } catch (error) {
    console.error('[IA Config] Erreur test whatsapp:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
