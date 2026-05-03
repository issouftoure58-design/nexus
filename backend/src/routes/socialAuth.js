/**
 * Routes OAuth Réseaux Sociaux — Facebook/Instagram
 * Gère le flow OAuth, stockage tokens, listing comptes connectés
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import {
  getAuthUrl,
  decodeState,
  exchangeCodeForToken,
  getLongLivedToken,
  getPages,
} from '../services/facebookService.js';

const router = express.Router();

const APP_URL = process.env.APP_URL || 'http://localhost:3002';

// ═══════════════════════════════════════════
// GET /auth/facebook — Lancer OAuth Facebook
// ═══════════════════════════════════════════
router.get('/facebook', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const url = getAuthUrl(tenantId);
    res.json({ url });
  } catch (err) {
    console.error('[SOCIAL AUTH] Erreur getAuthUrl:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// GET /auth/facebook/callback — Callback OAuth
// ═══════════════════════════════════════════
router.get('/facebook/callback', async (req, res) => {
  try {
    const { code, state, error: fbError, error_description } = req.query;

    if (fbError) {
      console.error('[SOCIAL AUTH] Facebook OAuth erreur:', fbError, error_description);
      return res.redirect(`${APP_URL}/reseaux-sociaux?error=${encodeURIComponent(error_description || fbError)}`);
    }

    if (!code || !state) {
      return res.redirect(`${APP_URL}/reseaux-sociaux?error=missing_params`);
    }

    // Décoder le state pour récupérer le tenantId
    const stateData = decodeState(state);
    if (!stateData?.tenantId) {
      return res.redirect(`${APP_URL}/reseaux-sociaux?error=invalid_state`);
    }

    const tenantId = stateData.tenantId;

    // Échanger le code contre un token court
    const shortToken = await exchangeCodeForToken(code);

    // Debug: vérifier les permissions du short token
    const debugRes = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${shortToken}`);
    const debugData = await debugRes.json();
    console.log('[SOCIAL AUTH] Short token permissions:', JSON.stringify(debugData));

    // Obtenir un long-lived token (60 jours)
    const { access_token: longToken, expires_in } = await getLongLivedToken(shortToken);
    const expiresAt = new Date(Date.now() + (expires_in || 5184000) * 1000).toISOString();

    // Debug: vérifier l'identité du token
    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${shortToken}`);
    const meData = await meRes.json();
    console.log('[SOCIAL AUTH] Token identity (me):', JSON.stringify(meData));

    // Tenter getPages avec les DEUX tokens (short puis long)
    console.log('[SOCIAL AUTH] Trying getPages with SHORT token...');
    let pages = await getPages(shortToken);
    console.log(`[SOCIAL AUTH] Short token: ${pages.length} pages found`);

    if (!pages || pages.length === 0) {
      console.log('[SOCIAL AUTH] Trying getPages with LONG token...');
      pages = await getPages(longToken);
      console.log(`[SOCIAL AUTH] Long token: ${pages.length} pages found`);
    }

    // Si toujours vide, essayer endpoint alternatif (pages liked/managed)
    if (!pages || pages.length === 0) {
      console.log('[SOCIAL AUTH] Both tokens returned 0 pages. Trying /me/accounts with minimal fields...');
      const minRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${shortToken}`);
      const minData = await minRes.json();
      console.log('[SOCIAL AUTH] Minimal /me/accounts response:', JSON.stringify(minData).substring(0, 1000));
    }

    if (!pages || pages.length === 0) {
      return res.redirect(`${APP_URL}/reseaux-sociaux?error=no_pages`);
    }

    // Stocker chaque page comme compte Facebook connecté
    for (const page of pages) {
      // Upsert Facebook page
      await supabase
        .from('social_accounts')
        .upsert({
          tenant_id: tenantId,
          platform: 'facebook',
          account_name: page.pageName,
          account_id: page.pageId,
          access_token: page.pageAccessToken,
          page_id: page.pageId,
          ig_account_id: page.igAccount?.id || null,
          token_expires_at: expiresAt,
          is_active: true,
          connected_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        }, {
          onConflict: 'tenant_id,platform,account_id',
        });

      // Si un compte IG est lié, stocker aussi
      if (page.igAccount) {
        await supabase
          .from('social_accounts')
          .upsert({
            tenant_id: tenantId,
            platform: 'instagram',
            account_name: page.igAccount.username,
            account_id: page.igAccount.id,
            access_token: page.pageAccessToken,
            page_id: page.pageId,
            ig_account_id: page.igAccount.id,
            token_expires_at: expiresAt,
            is_active: true,
            connected_at: new Date().toISOString(),
            last_used_at: new Date().toISOString(),
          }, {
            onConflict: 'tenant_id,platform,account_id',
          });
      }
    }

    console.log(`[SOCIAL AUTH] Tenant ${tenantId} connecté: ${pages.length} pages Facebook`);

    return res.redirect(`${APP_URL}/reseaux-sociaux?success=true&pages=${pages.length}`);
  } catch (err) {
    console.error('[SOCIAL AUTH] Erreur callback Facebook:', err.message);
    return res.redirect(`${APP_URL}/reseaux-sociaux?error=${encodeURIComponent(err.message)}`);
  }
});

// ═══════════════════════════════════════════
// GET /accounts — Liste comptes connectés
// ═══════════════════════════════════════════
router.get('/accounts', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { data, error } = await supabase
      .from('social_accounts')
      .select('id, platform, account_name, account_id, page_id, ig_account_id, is_active, connected_at, last_used_at, token_expires_at')
      .eq('tenant_id', tenantId)
      .order('connected_at', { ascending: false });

    if (error) throw error;

    // Ajouter un flag d'expiration proche (< 7 jours)
    const accounts = (data || []).map(acc => ({
      ...acc,
      token_expiring_soon: acc.token_expires_at
        ? new Date(acc.token_expires_at) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : false,
      token_expired: acc.token_expires_at
        ? new Date(acc.token_expires_at) < new Date()
        : false,
    }));

    res.json({ accounts });
  } catch (err) {
    console.error('[SOCIAL AUTH] Erreur liste comptes:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════
// DELETE /accounts/:id — Déconnecter un compte
// ═══════════════════════════════════════════
router.delete('/accounts/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    if (!tenantId) return res.status(403).json({ error: 'TENANT_REQUIRED' });

    const { id } = req.params;

    const { error } = await supabase
      .from('social_accounts')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    console.log(`[SOCIAL AUTH] Compte ${id} déconnecté pour tenant ${tenantId}`);

    res.json({ success: true });
  } catch (err) {
    console.error('[SOCIAL AUTH] Erreur déconnexion:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
