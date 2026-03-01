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
import { authenticateAdmin } from './adminAuth.js';

const router = express.Router();

// ⚠️ SECURITY: All provisioning routes require authentication

/**
 * POST /api/provisioning/phone/auto
 * Provisionne automatiquement un numéro pour le tenant
 * ⚠️ SECURED: Requires admin authentication
 */
router.post('/phone/auto', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }
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
 * ⚠️ SECURED: Requires admin authentication
 */
router.get('/phone/available', authenticateAdmin, async (req, res) => {
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
 * ⚠️ SECURED: Requires admin authentication
 */
router.post('/phone/purchase', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }
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
 * ⚠️ SECURED: Requires admin authentication
 */
router.get('/status', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

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
 * ⚠️ SECURED: Requires admin authentication
 */
router.post('/whatsapp', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

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
 * ⚠️ SECURED: Requires admin authentication
 */
router.delete('/phone', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

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
 * Récupère le solde Twilio (superadmin seulement)
 * ⚠️ SECURED: Requires superadmin authentication
 */
router.get('/balance', authenticateAdmin, async (req, res) => {
  // Only superadmin can see Twilio balance
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'SUPERADMIN_REQUIRED' });
  }
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
 * Liste tous les numéros actifs (superadmin seulement)
 * ⚠️ SECURED: Requires superadmin authentication
 */
router.get('/numbers', authenticateAdmin, async (req, res) => {
  // Only superadmin can list all numbers
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'SUPERADMIN_REQUIRED' });
  }
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
 * ⚠️ SECURED: Requires SUPERADMIN - this can assign phones to ANY tenant
 */
router.post('/phone/register', authenticateAdmin, async (req, res) => {
  try {
    // 🔒 CRITICAL: Only superadmin can register numbers to arbitrary tenants
    if (req.admin?.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: 'SUPERADMIN_REQUIRED',
        message: 'Seul un superadmin peut enregistrer des numéros pour d\'autres tenants'
      });
    }

    const { tenantId, phoneNumber, type = 'whatsapp' } = req.body;

    if (!tenantId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'tenantId et phoneNumber requis',
      });
    }

    console.log(`[PROVISIONING] Superadmin ${req.admin.email} registering ${phoneNumber} to tenant ${tenantId}`);

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
 * ⚠️ SECURED: Requires superadmin authentication
 */
router.get('/debug/phone-cache', authenticateAdmin, async (req, res) => {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'SUPERADMIN_REQUIRED' });
  }
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
 * ⚠️ SECURED: Requires superadmin authentication
 */
router.post('/debug/refresh-cache', authenticateAdmin, async (req, res) => {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'SUPERADMIN_REQUIRED' });
  }
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
 * ⚠️ SECURED: Requires superadmin authentication
 */
router.get('/debug/db-phones', authenticateAdmin, async (req, res) => {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'SUPERADMIN_REQUIRED' });
  }
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

// ============================================
// ARCEP COMPLIANCE (Numéros français)
// ============================================

/**
 * GET /api/provisioning/arcep/status
 * Vérifie le statut de conformité ARCEP pour les numéros français
 * ⚠️ SECURED: Requires superadmin authentication
 */
router.get('/arcep/status', authenticateAdmin, async (req, res) => {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'SUPERADMIN_REQUIRED' });
  }
  try {
    const status = await provisioningService.getARCEPComplianceStatus();

    res.json({
      success: true,
      ...status,
      help: {
        bundleCreation: 'https://console.twilio.com/us1/develop/phone-numbers/regulatory-compliance/bundles',
        addressCreation: 'https://console.twilio.com/us1/develop/phone-numbers/manage/addresses',
        documentation: 'https://www.twilio.com/docs/phone-numbers/regulatory/france'
      }
    });
  } catch (error) {
    console.error('[PROVISIONING] ARCEP status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/provisioning/arcep/bundles
 * Liste les Regulatory Bundles disponibles
 * ⚠️ SECURED: Requires superadmin authentication
 */
router.get('/arcep/bundles', authenticateAdmin, async (req, res) => {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'SUPERADMIN_REQUIRED' });
  }
  try {
    const bundles = await provisioningService.listRegulatoryBundles();

    res.json({
      success: true,
      count: bundles.length,
      bundles,
      note: 'Copiez le SID du bundle approuvé dans TWILIO_FR_BUNDLE_SID'
    });
  } catch (error) {
    console.error('[PROVISIONING] List bundles error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/provisioning/arcep/addresses
 * Liste les adresses disponibles sur Twilio
 * ⚠️ SECURED: Requires superadmin authentication
 */
router.get('/arcep/addresses', authenticateAdmin, async (req, res) => {
  if (req.admin?.role !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'SUPERADMIN_REQUIRED' });
  }
  try {
    const addresses = await provisioningService.listAddresses();

    res.json({
      success: true,
      count: addresses.length,
      addresses,
      note: 'Copiez le SID de l\'adresse vérifiée dans TWILIO_FR_ADDRESS_SID'
    });
  } catch (error) {
    console.error('[PROVISIONING] List addresses error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/provisioning/phone/auto-fr
 * Auto-provisionne un numéro français (nécessite ARCEP configuré)
 * ⚠️ SECURED: Requires admin authentication
 */
router.post('/phone/auto-fr', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id;
    if (!tenantId) {
      return res.status(403).json({ success: false, error: 'TENANT_REQUIRED' });
    }

    // Vérifier d'abord la conformité ARCEP
    const arcepStatus = await provisioningService.getARCEPComplianceStatus();

    if (!arcepStatus.canPurchaseFR) {
      return res.status(400).json({
        success: false,
        error: 'ARCEP_NOT_CONFIGURED',
        message: 'La conformité ARCEP n\'est pas configurée. Les numéros français ne peuvent pas être achetés.',
        requirements: arcepStatus.requirements,
        help: {
          bundleCreation: 'https://console.twilio.com/us1/develop/phone-numbers/regulatory-compliance/bundles',
          addressCreation: 'https://console.twilio.com/us1/develop/phone-numbers/manage/addresses'
        }
      });
    }

    console.log(`[PROVISIONING API] Auto-provision FR pour ${tenantId}`);

    const result = await provisioningService.autoProvisionNumber(tenantId, 'FR');

    res.json({
      success: true,
      message: result.alreadyExists
        ? 'Numéro français déjà attribué'
        : 'Numéro français provisionné avec succès',
      ...result,
    });
  } catch (error) {
    console.error('[PROVISIONING API] Erreur auto-fr:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
