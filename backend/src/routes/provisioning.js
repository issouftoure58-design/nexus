/**
 * Routes Provisioning - Gestion automatique des numéros Twilio
 *
 * POST /api/provisioning/phone/auto     - Auto-provisionner un numéro
 * GET  /api/provisioning/phone/available - Lister numéros disponibles
 * GET  /api/provisioning/status         - Status provisioning du tenant
 * POST /api/provisioning/whatsapp       - Configurer WhatsApp
 * DELETE /api/provisioning/phone        - Libérer le numéro
 * GET  /api/provisioning/balance        - Solde Twilio (admin)
 */

import express from 'express';
import provisioningService from '../services/twilioProvisioningService.js';

const router = express.Router();

/**
 * POST /api/provisioning/phone/auto
 * Provisionne automatiquement un numéro pour le tenant
 */
router.post('/phone/auto', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { country = 'FR' } = req.body;

    console.log(`[PROVISIONING API] Auto-provision pour ${tenantId}`);

    const result = await provisioningService.autoProvisionNumber(tenantId, country);

    res.json({
      success: true,
      message: result.alreadyExists
        ? 'Numéro déjà attribué'
        : 'Numéro provisionné avec succès',
      ...result,
    });
  } catch (error) {
    console.error('[PROVISIONING API] Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/provisioning/phone/available
 * Liste les numéros disponibles à l'achat
 */
router.get('/phone/available', async (req, res) => {
  try {
    const { country = 'FR', limit = 5 } = req.query;

    const numbers = await provisioningService.searchAvailableNumbers(
      country,
      parseInt(limit)
    );

    res.json({
      success: true,
      country,
      numbers,
    });
  } catch (error) {
    console.error('[PROVISIONING API] Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/provisioning/phone/purchase
 * Achète un numéro spécifique pour le tenant
 */
router.post('/phone/purchase', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { phoneNumber, type = 'voice' } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber requis',
      });
    }

    const result = await provisioningService.purchasePhoneNumber(
      tenantId,
      phoneNumber,
      type
    );

    res.json({
      success: true,
      message: 'Numéro acheté avec succès',
      ...result,
    });
  } catch (error) {
    console.error('[PROVISIONING API] Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/provisioning/status
 * Récupère le status de provisioning du tenant
 */
router.get('/status', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const status = await provisioningService.getProvisioningStatus(tenantId);

    res.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('[PROVISIONING API] Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/provisioning/whatsapp
 * Configure WhatsApp pour le tenant
 */
router.post('/whatsapp', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const result = await provisioningService.configureWhatsApp(tenantId);

    res.json({
      success: true,
      message: 'WhatsApp configuré',
      ...result,
    });
  } catch (error) {
    console.error('[PROVISIONING API] Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/provisioning/phone
 * Libère le numéro du tenant (annulation module)
 */
router.delete('/phone', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const result = await provisioningService.releasePhoneNumber(tenantId);

    res.json({
      success: true,
      message: 'Numéro libéré',
      ...result,
    });
  } catch (error) {
    console.error('[PROVISIONING API] Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/provisioning/balance
 * Récupère le solde Twilio (admin seulement)
 */
router.get('/balance', async (req, res) => {
  try {
    const balance = await provisioningService.getTwilioBalance();

    res.json({
      success: true,
      ...balance,
    });
  } catch (error) {
    console.error('[PROVISIONING API] Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/provisioning/numbers
 * Liste tous les numéros actifs (admin seulement)
 */
router.get('/numbers', async (req, res) => {
  try {
    const numbers = await provisioningService.listActiveNumbers();

    res.json({
      success: true,
      count: numbers.length,
      numbers,
    });
  } catch (error) {
    console.error('[PROVISIONING API] Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/provisioning/phone/register
 * Enregistre manuellement un mapping numéro → tenant (pour numéros existants)
 */
router.post('/phone/register', async (req, res) => {
  try {
    const { tenantId, phoneNumber, type = 'whatsapp' } = req.body;

    if (!tenantId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'tenantId et phoneNumber requis',
      });
    }

    const result = await provisioningService.registerExistingNumber(tenantId, phoneNumber, type);

    res.json({
      success: true,
      message: 'Numéro enregistré avec succès',
      ...result,
    });
  } catch (error) {
    console.error('[PROVISIONING API] Erreur register:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/provisioning/debug/phone-cache
 * Debug: affiche le contenu du cache de routing téléphonique
 */
router.get('/debug/phone-cache', async (req, res) => {
  try {
    const { getTenantByPhone } = await import('../config/tenants/index.js');
    const { getPhoneMapDebug } = await import('../config/tenants/tenantCache.js');

    // Test quelques numéros
    const testNumbers = [
      '+14155238886',
      'whatsapp:+14155238886',
      '+33939240269',
    ];

    const lookupResults = {};
    for (const num of testNumbers) {
      try {
        const result = getTenantByPhone(num);
        lookupResults[num] = result.tenantId || 'NOT_FOUND';
      } catch (e) {
        lookupResults[num] = `ERROR: ${e.message}`;
      }
    }

    // Get raw cache state
    const cacheState = getPhoneMapDebug();

    res.json({
      success: true,
      lookupResults,
      cacheState,
      message: 'Debug phone cache lookup'
    });
  } catch (error) {
    console.error('[PROVISIONING] Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/provisioning/debug/refresh-cache
 * Force le rafraîchissement du cache des tenants et numéros
 */
router.post('/debug/refresh-cache', async (req, res) => {
  try {
    const { loadAllTenants } = await import('../config/tenants/tenantCache.js');

    console.log('[PROVISIONING] Force cache refresh requested...');

    const result = await loadAllTenants();

    res.json({
      success: true,
      loadedFromDb: result,
      message: 'Cache refreshed successfully'
    });
  } catch (error) {
    console.error('[PROVISIONING] Cache refresh error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/provisioning/debug/db-phones
 * Debug: liste les numéros directement depuis la BDD (bypass cache)
 */
router.get('/debug/db-phones', async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: phones, error } = await supabase
      .from('tenant_phone_numbers')
      .select('*')
      .eq('status', 'active');

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      count: phones?.length || 0,
      phones: phones || [],
      message: 'Direct DB query (bypasses cache)'
    });
  } catch (error) {
    console.error('[PROVISIONING] DB debug error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
