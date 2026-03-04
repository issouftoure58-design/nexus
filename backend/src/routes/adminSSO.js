/**
 * Routes SSO — SAML/OIDC pour tenants enterprise
 * Sprint 4.1 — SSO
 *
 * Endpoints:
 * GET    /api/admin/sso/providers       — Liste les providers SSO du tenant
 * POST   /api/admin/sso/providers       — Configurer un provider SSO
 * DELETE /api/admin/sso/providers/:id   — Supprimer un provider
 * POST   /api/admin/sso/oidc/initiate   — Initier login OIDC
 * POST   /api/admin/sso/oidc/callback   — Callback OIDC
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticateAdmin } from './adminAuth.js';
import {
  getSSOConfig,
  configureSSOProvider,
  deleteSSOProvider,
  initiateOIDCLogin,
  handleOIDCCallback,
  findOrCreateSSOUser
} from '../services/ssoService.js';
import { createSession } from '../services/sessionService.js';
import logger from '../config/logger.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// =============================================
// Routes protégées (configuration SSO)
// =============================================

/**
 * GET /providers — Liste les providers SSO du tenant
 */
router.get('/providers', authenticateAdmin, async (req, res) => {
  try {
    const { tenantId } = req;
    const providers = await getSSOConfig(tenantId);
    res.json({ providers });
  } catch (error) {
    logger.error('Erreur get SSO providers', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

/**
 * POST /providers — Configurer un provider SSO
 * Requiert role admin ou owner
 */
router.post('/providers', authenticateAdmin, async (req, res) => {
  try {
    const { tenantId } = req;
    const role = req.admin?.role;

    if (role !== 'admin' && role !== 'owner' && role !== 'super_admin') {
      return res.status(403).json({ error: 'Seul un admin peut configurer le SSO' });
    }

    const provider = await configureSSOProvider(tenantId, req.body);
    res.status(201).json(provider);
  } catch (error) {
    logger.error('Erreur config SSO', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /providers/:id — Supprimer un provider
 */
router.delete('/providers/:id', authenticateAdmin, async (req, res) => {
  try {
    const { tenantId } = req;
    const result = await deleteSSOProvider(tenantId, req.params.id);
    res.json(result);
  } catch (error) {
    logger.error('Erreur delete SSO', { error: error.message });
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// =============================================
// Routes publiques (flow SSO login)
// =============================================

/**
 * POST /oidc/initiate — Initier login OIDC
 * Body: { tenant_id, provider_id }
 * Pas besoin d'auth (c'est le flow de login)
 */
router.post('/oidc/initiate', async (req, res) => {
  try {
    const { tenant_id, provider_id } = req.body;

    if (!tenant_id || !provider_id) {
      return res.status(400).json({ error: 'tenant_id et provider_id requis' });
    }

    const callbackUrl = `${process.env.ADMIN_UI_URL || 'http://localhost:5173'}/sso/callback`;
    const result = await initiateOIDCLogin(tenant_id, provider_id, callbackUrl);

    res.json(result);
  } catch (error) {
    logger.error('Erreur OIDC initiate', { error: error.message });
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /oidc/callback — Callback OIDC
 * Body: { tenant_id, provider_id, code, state }
 * Retourne un JWT comme le login normal
 */
router.post('/oidc/callback', async (req, res) => {
  try {
    const { tenant_id, provider_id, code } = req.body;

    if (!tenant_id || !provider_id || !code) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }

    const callbackUrl = `${process.env.ADMIN_UI_URL || 'http://localhost:5173'}/sso/callback`;

    // Echange code → user info
    const ssoUserInfo = await handleOIDCCallback(tenant_id, provider_id, code, callbackUrl);

    // Trouver ou creer l'admin
    const admin = await findOrCreateSSOUser(tenant_id, ssoUserInfo);

    // Generer JWT (meme format que login normal)
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        nom: admin.nom,
        role: admin.role,
        tenant_id: admin.tenant_id,
        tenant_slug: admin.tenant_id,
        sso: true
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Creer session
    try {
      await createSession(admin.id, admin.tenant_id, token, req);
    } catch (e) {
      // Non bloquant
    }

    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        nom: admin.nom,
        role: admin.role,
        tenant_id: admin.tenant_id
      }
    });
  } catch (error) {
    logger.error('Erreur OIDC callback', { error: error.message });
    res.status(401).json({ error: error.message });
  }
});

export default router;
