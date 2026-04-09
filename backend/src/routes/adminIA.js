/**
 * Routes Admin - Configuration IA (Telephone & WhatsApp)
 *
 * Permet aux tenants de configurer leurs agents IA vocaux et messaging.
 *
 * 🔒 SÉCURITÉ: Ces routes nécessitent:
 * - Authentification admin
 * - Plan Pro ou Business (telephone/whatsapp = modules Pro)
 */

import express from 'express';
import { rawSupabase as supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// ============================================
// VALIDATION - Champs autorisés par channel
// ============================================

const ALLOWED_FIELDS = {
  telephone: ['greeting_message', 'voice_style', 'tone', 'language', 'transfer_phone',
              'max_duration_seconds', 'business_hours', 'personality', 'services_description',
              'booking_enabled', 'active'],
  whatsapp: ['greeting_message', 'tone', 'language', 'response_delay_ms', 'business_hours',
             'personality', 'services_description', 'booking_enabled', 'send_images',
             'send_location', 'quick_replies_enabled', 'quick_replies', 'active']
};

const MAX_STRING_LENGTH = 500;

/**
 * Filtre et valide les champs de config IA
 */
function sanitizeConfig(config, channel) {
  const allowed = ALLOWED_FIELDS[channel];
  if (!allowed) return {};

  const sanitized = {};
  for (const key of allowed) {
    if (config[key] === undefined) continue;

    const value = config[key];

    // Limiter la longueur des strings
    if (typeof value === 'string') {
      sanitized[key] = value.slice(0, MAX_STRING_LENGTH);
    } else if (Array.isArray(value)) {
      // quick_replies : max 10 items, chaque item max 50 chars
      sanitized[key] = value.slice(0, 10).map(item =>
        typeof item === 'string' ? item.slice(0, 50) : String(item).slice(0, 50)
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * 🔒 Middleware: Vérifie que le tenant a le plan Pro ou Business
 */
const requireProPlan = async (req, res, next) => {
  try {
    const tenantId = req.admin?.tenant_id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('plan')
      .eq('id', tenantId)
      .single();

    if (error) throw error;

    const plan = (tenant?.plan || 'free').toLowerCase();

    // Modele 2026 : Free n'a pas l'IA. Basic et Business OK (Basic via credits, Business avec inclus)
    // 'starter' = alias retro-compat de 'free'
    if (plan === 'free' || plan === 'starter') {
      return res.status(403).json({
        error: 'Plan insuffisant',
        code: 'PLAN_UPGRADE_REQUIRED',
        message: 'Les fonctionnalités IA vocale nécessitent le plan Basic (29€/mois) ou Business — IA via crédits',
        current_plan: plan,
        required_plan: 'basic',
        upgrade_url: '/subscription'
      });
    }

    next();
  } catch (error) {
    console.error('[ADMIN IA] Erreur vérification plan:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// ============================================
// TELEPHONE IA CONFIG
// ============================================

/**
 * GET /api/admin/ia/telephone/config
 * Recupere la configuration IA telephone du tenant
 * 🔒 Requires: Pro/Business plan
 */
router.get('/telephone/config', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

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
 * 🔒 Requires: Pro/Business plan
 */
router.put('/telephone/config', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const config = sanitizeConfig(req.body, 'telephone');

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
 * 🔒 Requires: Pro/Business plan
 */
router.post('/telephone/test', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { message } = req.body;

    const { processMessage } = await import('../core/unified/nexusCore.js');

    const result = await processMessage(message || 'Bonjour', 'phone', {
      conversationId: `test_phone_${Date.now()}`,
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
 * 🔒 Requires: Pro/Business plan
 */
router.get('/whatsapp/config', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

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
 * 🔒 Requires: Pro/Business plan
 */
router.put('/whatsapp/config', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const config = sanitizeConfig(req.body, 'whatsapp');

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
 * 🔒 Requires: Pro/Business plan
 */
router.post('/whatsapp/test', authenticateAdmin, requireProPlan, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
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
