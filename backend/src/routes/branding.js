/**
 * Routes Branding & White-Label
 * Personnalisation complete de l'interface tenant
 */

import express from 'express';
import dns from 'dns';
import { promisify } from 'util';
import { supabase } from '../config/supabase.js';
import { authenticateToken, requirePlan } from '../middleware/auth.js';

const router = express.Router();
const dnsResolve = promisify(dns.resolveCname);

// ============================================
// BRANDING PRINCIPAL
// ============================================

/**
 * GET /api/branding
 * Recuperer branding du tenant
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: branding, error } = await supabase
      .from('branding')
      .select('*')
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Si pas de branding, retourner valeurs par defaut
    if (!branding) {
      return res.json({
        success: true,
        data: getDefaultBranding(req.user.tenant_id)
      });
    }

    res.json({ success: true, data: branding });

  } catch (error) {
    console.error('[BRANDING] Get error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/branding
 * Mettre a jour branding
 */
router.put('/', authenticateToken, requirePlan('business'), async (req, res) => {
  try {
    const {
      logo_url,
      logo_dark_url,
      favicon_url,
      primary_color,
      secondary_color,
      accent_color,
      background_color,
      text_color,
      font_family,
      font_url,
      company_name,
      tagline,
      welcome_message,
      footer_text,
      email_from_name,
      email_from_address,
      email_reply_to,
      email_header_color,
      email_footer_text,
      sms_sender_name,
      social_facebook,
      social_instagram,
      social_twitter,
      social_linkedin,
      theme_mode,
      language,
      timezone,
      currency,
      custom_css,
      meta_title,
      meta_description,
      google_analytics_id,
      facebook_pixel_id
    } = req.body;

    // Validation couleurs hex
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    const colors = { primary_color, secondary_color, accent_color, background_color, text_color, email_header_color };

    for (const [name, value] of Object.entries(colors)) {
      if (value && !hexPattern.test(value)) {
        return res.status(400).json({
          success: false,
          error: `Invalid hex color for ${name}: ${value}`
        });
      }
    }

    // Validation SMS sender (max 11 chars alphanumeric)
    if (sms_sender_name && !/^[a-zA-Z0-9]{1,11}$/.test(sms_sender_name)) {
      return res.status(400).json({
        success: false,
        error: 'SMS sender name must be 1-11 alphanumeric characters'
      });
    }

    const updates = {
      logo_url,
      logo_dark_url,
      favicon_url,
      primary_color,
      secondary_color,
      accent_color,
      background_color,
      text_color,
      font_family,
      font_url,
      company_name,
      tagline,
      welcome_message,
      footer_text,
      email_from_name,
      email_from_address,
      email_reply_to,
      email_header_color,
      email_footer_text,
      sms_sender_name,
      social_facebook,
      social_instagram,
      social_twitter,
      social_linkedin,
      theme_mode,
      language,
      timezone,
      currency,
      custom_css,
      meta_title,
      meta_description,
      google_analytics_id,
      facebook_pixel_id,
      updated_at: new Date().toISOString()
    };

    // Upsert
    const { data: branding, error } = await supabase
      .from('branding')
      .upsert({
        tenant_id: req.user.tenant_id,
        ...updates
      }, { onConflict: 'tenant_id' })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data: branding });

  } catch (error) {
    console.error('[BRANDING] Update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/branding/apply-theme
 * Appliquer un theme predefini
 */
router.post('/apply-theme', authenticateToken, requirePlan('business'), async (req, res) => {
  try {
    const { theme_id } = req.body;

    if (!theme_id) {
      return res.status(400).json({
        success: false,
        error: 'theme_id is required'
      });
    }

    // Recuperer le theme
    const { data: theme, error: themeError } = await supabase
      .from('themes')
      .select('*')
      .eq('id', theme_id)
      .single();

    if (themeError || !theme) {
      return res.status(404).json({
        success: false,
        error: 'Theme not found'
      });
    }

    // Verifier plan pour themes premium
    if (theme.is_premium && req.user.plan !== 'enterprise') {
      return res.status(403).json({
        success: false,
        error: 'Premium themes require Enterprise plan'
      });
    }

    // Appliquer les settings du theme
    const { data: branding, error } = await supabase
      .from('branding')
      .upsert({
        tenant_id: req.user.tenant_id,
        ...theme.settings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id' })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: branding,
      message: `Theme "${theme.name}" applied`
    });

  } catch (error) {
    console.error('[BRANDING] Apply theme error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/branding/themes
 * Liste des themes disponibles
 */
router.get('/themes', authenticateToken, async (req, res) => {
  try {
    const { data: themes, error } = await supabase
      .from('themes')
      .select('*')
      .order('is_premium', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data: themes });

  } catch (error) {
    console.error('[BRANDING] List themes error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DOMAINE CUSTOM
// ============================================

/**
 * POST /api/branding/domain
 * Configurer domaine custom
 */
router.post('/domain', authenticateToken, requirePlan('business'), async (req, res) => {
  try {
    const { custom_domain } = req.body;

    if (!custom_domain) {
      return res.status(400).json({
        success: false,
        error: 'custom_domain is required'
      });
    }

    // Valider format domaine
    const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainPattern.test(custom_domain)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid domain format'
      });
    }

    // Generer token de verification
    const verificationToken = `nexus-verify-${crypto.randomUUID().substring(0, 8)}`;

    const { data: branding, error } = await supabase
      .from('branding')
      .upsert({
        tenant_id: req.user.tenant_id,
        custom_domain,
        custom_domain_verified: false,
        custom_domain_ssl: false,
        domain_verification_token: verificationToken,
        updated_at: new Date().toISOString()
      }, { onConflict: 'tenant_id' })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        custom_domain,
        verification_token: verificationToken,
        instructions: {
          step1: `Add a CNAME record: ${custom_domain} -> nexus.ai`,
          step2: `Add a TXT record: _nexus-verify.${custom_domain} -> ${verificationToken}`,
          step3: 'Call POST /api/branding/domain/verify to verify'
        }
      }
    });

  } catch (error) {
    console.error('[BRANDING] Domain config error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/branding/domain/verify
 * Verifier domaine custom (DNS check)
 */
router.post('/domain/verify', authenticateToken, requirePlan('business'), async (req, res) => {
  try {
    // Recuperer branding actuel
    const { data: branding, error: fetchError } = await supabase
      .from('branding')
      .select('custom_domain, domain_verification_token')
      .eq('tenant_id', req.user.tenant_id)
      .single();

    if (fetchError || !branding || !branding.custom_domain) {
      return res.status(400).json({
        success: false,
        error: 'No custom domain configured'
      });
    }

    const { custom_domain, domain_verification_token } = branding;

    // Verifier CNAME
    let cnameValid = false;
    try {
      const cnames = await dnsResolve(custom_domain);
      cnameValid = cnames.some(c => c.includes('nexus') || c.includes('render'));
    } catch {
      // CNAME pas trouve
    }

    // Verifier TXT
    let txtValid = false;
    try {
      const resolveTxt = promisify(dns.resolveTxt);
      const txtRecords = await resolveTxt(`_nexus-verify.${custom_domain}`);
      txtValid = txtRecords.flat().includes(domain_verification_token);
    } catch {
      // TXT pas trouve
    }

    if (!cnameValid || !txtValid) {
      return res.status(400).json({
        success: false,
        error: 'DNS verification failed',
        details: {
          cname_valid: cnameValid,
          txt_valid: txtValid,
          expected_cname: 'nexus.ai or render.com',
          expected_txt: domain_verification_token
        }
      });
    }

    // Marquer comme verifie
    const { error: updateError } = await supabase
      .from('branding')
      .update({
        custom_domain_verified: true,
        custom_domain_ssl: true, // SSL auto via Render/Cloudflare
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', req.user.tenant_id);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: `Domain ${custom_domain} verified successfully!`,
      data: {
        custom_domain,
        verified: true,
        ssl: true
      }
    });

  } catch (error) {
    console.error('[BRANDING] Domain verify error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/branding/domain
 * Supprimer domaine custom
 */
router.delete('/domain', authenticateToken, async (req, res) => {
  try {
    const { error } = await supabase
      .from('branding')
      .update({
        custom_domain: null,
        custom_domain_verified: false,
        custom_domain_ssl: false,
        domain_verification_token: null,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', req.user.tenant_id);

    if (error) throw error;

    res.json({ success: true, message: 'Custom domain removed' });

  } catch (error) {
    console.error('[BRANDING] Domain delete error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CSS DYNAMIQUE
// ============================================

/**
 * GET /api/branding/theme.css
 * Generer CSS dynamique base sur branding
 */
router.get('/theme.css', async (req, res) => {
  try {
    // 🔒 SÉCURITÉ: Récupérer tenant depuis domaine ou session UNIQUEMENT
    // Ne JAMAIS accepter tenant_id depuis query params (spoofing)
    const host = req.get('host') || '';
    const origin = req.get('origin') || '';

    // Mapping domaine -> tenant_id (même que reviews.js)
    const domainToTenant = {
      'fatshairafro.fr': 'fatshairafro',
      'www.fatshairafro.fr': 'fatshairafro',
      'nexus-backend-dev.onrender.com': 'fatshairafro',
      'localhost': 'fatshairafro',
    };

    let tenantId = null;
    for (const [domain, tenant] of Object.entries(domainToTenant)) {
      if (origin.includes(domain) || host.includes(domain)) {
        tenantId = tenant;
        break;
      }
    }

    // Fallback authentifié seulement
    if (!tenantId && req.user?.tenant_id) {
      tenantId = req.user.tenant_id;
    }

    if (!tenantId) {
      return res.status(400).send('/* tenant not resolved from domain */');
    }

    const { data: branding } = await supabase
      .from('branding')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    const b = branding || getDefaultBranding(tenantId);

    const css = generateThemeCSS(b);

    res.set('Content-Type', 'text/css');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(css);

  } catch (error) {
    console.error('[BRANDING] CSS error:', error);
    res.status(500).send('/* Error generating CSS */');
  }
});

/**
 * GET /api/branding/preview
 * Preview du branding (pour admin)
 */
router.get('/preview', authenticateToken, async (req, res) => {
  try {
    const { data: branding } = await supabase
      .from('branding')
      .select('*')
      .eq('tenant_id', req.user.tenant_id)
      .single();

    const b = branding || getDefaultBranding(req.user.tenant_id);

    res.json({
      success: true,
      data: {
        branding: b,
        css: generateThemeCSS(b),
        preview_url: `https://${b.custom_domain || req.user.tenant_id + '.nexus.ai'}`
      }
    });

  } catch (error) {
    console.error('[BRANDING] Preview error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PAGES CUSTOM
// ============================================

/**
 * GET /api/branding/pages
 * Liste des pages custom
 */
router.get('/pages', authenticateToken, async (req, res) => {
  try {
    const { data: pages, error } = await supabase
      .from('custom_pages')
      .select('id, page_type, slug, title, is_published, order_index, show_in_menu, created_at, updated_at')
      .eq('tenant_id', req.user.tenant_id)
      .order('order_index', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data: pages });

  } catch (error) {
    console.error('[BRANDING] List pages error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/branding/pages/:slug
 * Detail d'une page
 * 🔒 SÉCURITÉ: Résolution tenant depuis domaine ou session uniquement
 */
router.get('/pages/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // 🔒 SÉCURITÉ: JAMAIS de fallback à query param (spoofing)
    // Résoudre tenant depuis domaine ou session authentifiée
    const host = req.get('host') || '';
    const origin = req.get('origin') || '';

    const domainToTenant = {
      'fatshairafro.fr': 'fatshairafro',
      'www.fatshairafro.fr': 'fatshairafro',
      'nexus-backend-dev.onrender.com': 'fatshairafro',
      'localhost': 'fatshairafro',
    };

    let tenantId = null;
    for (const [domain, tenant] of Object.entries(domainToTenant)) {
      if (origin.includes(domain) || host.includes(domain)) {
        tenantId = tenant;
        break;
      }
    }

    // Fallback: utilisateur authentifié uniquement
    if (!tenantId && req.user?.tenant_id) {
      tenantId = req.user.tenant_id;
    }

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'tenant not resolved from domain' });
    }

    const { data: page, error } = await supabase
      .from('custom_pages')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('slug', slug)
      .single();

    if (error || !page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    // Si pas publiee, verifier auth
    if (!page.is_published && (!req.user || req.user.tenant_id !== tenantId)) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    res.json({ success: true, data: page });

  } catch (error) {
    console.error('[BRANDING] Get page error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/branding/pages
 * Creer une page
 */
router.post('/pages', authenticateToken, requirePlan('business'), async (req, res) => {
  try {
    const {
      page_type,
      slug,
      title,
      content,
      content_format = 'html',
      meta_title,
      meta_description,
      featured_image_url,
      is_published = false,
      order_index = 0,
      show_in_menu = true
    } = req.body;

    // Validation
    if (!page_type || !slug || !title) {
      return res.status(400).json({
        success: false,
        error: 'page_type, slug, and title are required'
      });
    }

    // Valider slug (alphanumeric + hyphens)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({
        success: false,
        error: 'Slug must be lowercase alphanumeric with hyphens'
      });
    }

    const { data: page, error } = await supabase
      .from('custom_pages')
      .insert({
        tenant_id: req.user.tenant_id,
        page_type,
        slug,
        title,
        content,
        content_format,
        meta_title,
        meta_description,
        featured_image_url,
        is_published,
        order_index,
        show_in_menu,
        created_by: req.user.id
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({
          success: false,
          error: 'A page with this slug already exists'
        });
      }
      throw error;
    }

    res.status(201).json({ success: true, data: page });

  } catch (error) {
    console.error('[BRANDING] Create page error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/branding/pages/:id
 * Modifier une page
 */
router.put('/pages/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updated_at: new Date().toISOString() };

    // Retirer champs non modifiables
    delete updates.id;
    delete updates.tenant_id;
    delete updates.created_at;
    delete updates.created_by;

    const { data: page, error } = await supabase
      .from('custom_pages')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', req.user.tenant_id)
      .select()
      .single();

    if (error || !page) {
      return res.status(404).json({ success: false, error: 'Page not found' });
    }

    res.json({ success: true, data: page });

  } catch (error) {
    console.error('[BRANDING] Update page error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/branding/pages/:id
 * Supprimer une page
 */
router.delete('/pages/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('custom_pages')
      .delete()
      .eq('id', id)
      .eq('tenant_id', req.user.tenant_id);

    if (error) throw error;

    res.json({ success: true, message: 'Page deleted' });

  } catch (error) {
    console.error('[BRANDING] Delete page error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// HELPERS
// ============================================

function getDefaultBranding(tenantId) {
  return {
    tenant_id: tenantId,
    primary_color: '#3B82F6',
    secondary_color: '#10B981',
    accent_color: '#F59E0B',
    background_color: '#FFFFFF',
    text_color: '#111827',
    font_family: 'Inter',
    theme_mode: 'light',
    language: 'fr',
    timezone: 'Europe/Paris',
    currency: 'EUR'
  };
}

function generateThemeCSS(branding) {
  return `
/* NEXUS Theme - Generated for ${branding.tenant_id} */
:root {
  --color-primary: ${branding.primary_color || '#3B82F6'};
  --color-secondary: ${branding.secondary_color || '#10B981'};
  --color-accent: ${branding.accent_color || '#F59E0B'};
  --color-background: ${branding.background_color || '#FFFFFF'};
  --color-text: ${branding.text_color || '#111827'};
  --font-family: '${branding.font_family || 'Inter'}', system-ui, sans-serif;
}

body {
  font-family: var(--font-family);
  background-color: var(--color-background);
  color: var(--color-text);
}

.btn-primary, .bg-primary {
  background-color: var(--color-primary);
}

.btn-secondary, .bg-secondary {
  background-color: var(--color-secondary);
}

.text-primary {
  color: var(--color-primary);
}

.text-secondary {
  color: var(--color-secondary);
}

.border-primary {
  border-color: var(--color-primary);
}

.ring-primary:focus {
  --tw-ring-color: var(--color-primary);
}

a {
  color: var(--color-primary);
}

a:hover {
  color: var(--color-secondary);
}

${branding.custom_css || ''}
`.trim();
}

export default router;
