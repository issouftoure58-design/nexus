/**
 * Sitemap XML dynamique — Pages statiques + articles blog
 * Endpoint public sans auth pour chaque tenant avec domaine custom
 * Monté sur /sitemap.xml dans index.js
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { resolveTenantByDomain } from '../middleware/resolveTenant.js';

const router = express.Router();

/**
 * Echappe les caracteres XML dangereux
 */
function escapeXML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Pages statiques standard pour les tenants nexus-app
 * Priorité basée sur l'importance SEO
 */
const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/services', changefreq: 'monthly', priority: '0.9' },
  { path: '/reserver', changefreq: 'monthly', priority: '0.9' },
  { path: '/galerie', changefreq: 'weekly', priority: '0.8' },
  { path: '/avis', changefreq: 'weekly', priority: '0.8' },
  { path: '/a-propos', changefreq: 'monthly', priority: '0.7' },
  { path: '/blog', changefreq: 'daily', priority: '0.8' },
  { path: '/cgv', changefreq: 'yearly', priority: '0.3' },
  { path: '/confidentialite', changefreq: 'yearly', priority: '0.3' },
  { path: '/charte', changefreq: 'yearly', priority: '0.3' },
];

/**
 * GET /sitemap.xml — Sitemap complet (pages statiques + articles blog)
 */
router.get('/', resolveTenantByDomain, async (req, res) => {
  try {
    if (!req.tenantId) {
      return res.status(400).set('Content-Type', 'application/xml; charset=utf-8')
        .send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
    }

    // Récupérer le domaine du tenant pour construire les URLs
    const { data: tenant } = await supabase
      .from('tenants')
      .select('domain')
      .eq('id', req.tenantId)
      .single();

    const domain = tenant?.domain;
    const baseUrl = domain ? `https://${domain}` : `${req.protocol}://${req.get('host')}`;
    const today = new Date().toISOString().split('T')[0];

    // Pages statiques
    const staticUrls = STATIC_PAGES.map(page => `
  <url>
    <loc>${escapeXML(baseUrl)}${escapeXML(page.path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('');

    // Articles blog (pas de check plan — le sitemap doit toujours être accessible)
    let blogUrls = '';
    const { data: articles } = await supabase
      .from('seo_articles')
      .select('slug, date_publication')
      .eq('tenant_id', req.tenantId)
      .eq('statut', 'publie')
      .order('date_publication', { ascending: false });

    if (articles && articles.length > 0) {
      blogUrls = articles.map(a => `
  <url>
    <loc>${escapeXML(baseUrl)}/blog/${escapeXML(a.slug)}</loc>
    ${a.date_publication ? `<lastmod>${new Date(a.date_publication).toISOString().split('T')[0]}</lastmod>` : `<lastmod>${today}</lastmod>`}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('');
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticUrls}${blogUrls}
</urlset>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);

  } catch (err) {
    console.error('[SITEMAP] Erreur generation:', err);
    res.status(500).set('Content-Type', 'application/xml; charset=utf-8')
      .send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

export default router;
