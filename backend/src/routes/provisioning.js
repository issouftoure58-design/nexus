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

export default router;
