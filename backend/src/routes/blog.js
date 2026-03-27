/**
 * Blog SSR — Pages HTML publiques pour SEO
 * Sert /blog (liste), /blog/sitemap.xml, /blog/:slug
 * Chaque tenant avec articles publiés a son blog sur son domaine custom
 */

import express from 'express';
import { supabase } from '../config/supabase.js';
import { resolveTenantByDomain } from '../middleware/resolveTenant.js';

const router = express.Router();

// ============= HELPERS =============

/**
 * Echappe les caracteres HTML dangereux (XSS)
 */
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Convertit markdown en HTML securise
 * Escape d'abord tout le HTML, puis applique les transformations markdown
 */
function markdownToHTML(content) {
  if (!content) return '';

  const escaped = escapeHTML(content);

  return escaped
    // Titres
    .replace(/^### (.*$)/gim, '<h3 style="font-size:1.25rem;font-weight:600;margin:1.5rem 0 0.75rem;color:#1f2937">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="font-size:1.5rem;font-weight:700;margin:2rem 0 1rem;color:#111827">$1</h2>')
    // Gras et italique
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Listes a puces (groupees dans <ul>)
    .replace(/((?:^- .*$\n?)+)/gim, (match) => {
      const items = match.trim().split('\n')
        .map(line => line.replace(/^- (.*)$/, '<li style="margin:0.25rem 0;color:#374151">$1</li>'))
        .join('');
      return `<ul style="list-style:disc;padding-left:1.5rem;margin:1rem 0">${items}</ul>`;
    })
    // Paragraphes (lignes vides = separation)
    .replace(/\n\n+/g, '</p><p style="margin:1rem 0;line-height:1.75;color:#374151">')
    // Retours a la ligne simples
    .replace(/\n/g, '<br/>');
}

/**
 * Formate une date en francais
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const d = new Date(dateStr);
  return `${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Charge le branding complet d'un tenant depuis Supabase
 */
async function loadBranding(tenantId) {
  const { data } = await supabase
    .from('branding')
    .select('company_name, logo_url, primary_color')
    .eq('tenant_id', tenantId)
    .single();

  return data || { company_name: 'Blog', logo_url: null, primary_color: '#0891b2' };
}

// ============= MIDDLEWARE =============

// Resolution tenant par domaine/header
router.use(resolveTenantByDomain);

// Require tenant — version HTML (pas JSON)
router.use((req, res, next) => {
  if (!req.tenantId) {
    return res.status(400).send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Blog indisponible</title></head><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f9fafb"><div style="text-align:center"><h1 style="color:#6b7280">Blog indisponible</h1><p style="color:#9ca3af">Domaine non reconnu.</p></div></body></html>`);
  }
  next();
});

// ============= ROUTES =============

/**
 * GET /blog — Page liste articles
 */
router.get('/', async (req, res) => {
  try {
    const { data: articles, error } = await supabase
      .from('seo_articles')
      .select('id, titre, slug, meta_description, mots_cles_cibles, date_publication')
      .eq('tenant_id', req.tenantId)
      .eq('statut', 'publie')
      .order('date_publication', { ascending: false });

    if (error) throw error;

    const branding = req.branding || await loadBranding(req.tenantId);
    const companyName = escapeHTML(branding.company_name || 'Blog');
    const color = branding.primary_color || '#0891b2';
    const logoUrl = branding.logo_url;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const articlesCards = (articles || []).map(a => `
      <a href="/blog/${escapeHTML(a.slug)}" style="display:block;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;text-decoration:none;color:inherit;transition:box-shadow 0.2s">
        <div style="padding:1.5rem">
          <h2 style="font-size:1.25rem;font-weight:600;color:#111827;margin:0 0 0.5rem">${escapeHTML(a.titre)}</h2>
          ${a.date_publication ? `<time style="font-size:0.875rem;color:#6b7280">${formatDate(a.date_publication)}</time>` : ''}
          ${a.meta_description ? `<p style="color:#4b5563;margin:0.75rem 0 0;line-height:1.6;font-size:0.95rem">${escapeHTML(a.meta_description)}</p>` : ''}
          ${a.mots_cles_cibles && a.mots_cles_cibles.length ? `<div style="margin-top:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap">${a.mots_cles_cibles.map(k => `<span style="background:#f0f9ff;color:${color};padding:0.25rem 0.75rem;border-radius:9999px;font-size:0.75rem">${escapeHTML(k)}</span>`).join('')}</div>` : ''}
        </div>
      </a>
    `).join('');

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: `Blog ${branding.company_name || ''}`.trim(),
      url: `${baseUrl}/blog`,
      publisher: {
        '@type': 'Organization',
        name: branding.company_name || '',
        ...(logoUrl ? { logo: { '@type': 'ImageObject', url: logoUrl } } : {})
      }
    };

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blog — ${companyName}</title>
  <meta name="description" content="Découvrez les articles et conseils de ${companyName}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${baseUrl}/blog">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="Blog — ${companyName}">
  <meta property="og:description" content="Découvrez les articles et conseils de ${companyName}">
  <meta property="og:url" content="${baseUrl}/blog">
  ${logoUrl ? `<meta property="og:image" content="${escapeHTML(logoUrl)}">` : ''}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="Blog — ${companyName}">
  <meta name="twitter:description" content="Découvrez les articles et conseils de ${companyName}">

  <!-- JSON-LD -->
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

  <link rel="sitemap" type="application/xml" href="/blog/sitemap.xml">
</head>
<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;color:#111827">
  <!-- Header -->
  <header style="background:#fff;border-bottom:1px solid #e5e7eb;padding:1rem 0">
    <div style="max-width:960px;margin:0 auto;padding:0 1rem;display:flex;align-items:center;gap:0.75rem">
      ${logoUrl ? `<img src="${escapeHTML(logoUrl)}" alt="${companyName}" style="height:40px;width:auto;border-radius:6px">` : ''}
      <a href="/blog" style="font-size:1.25rem;font-weight:700;color:#111827;text-decoration:none">${companyName}</a>
    </div>
  </header>

  <!-- Main -->
  <main style="max-width:960px;margin:0 auto;padding:2rem 1rem">
    <h1 style="font-size:2rem;font-weight:800;margin:0 0 0.5rem;color:#111827">Blog</h1>
    <p style="color:#6b7280;margin:0 0 2rem;font-size:1.1rem">Nos derniers articles et conseils</p>

    ${(articles || []).length === 0
      ? '<p style="text-align:center;color:#9ca3af;padding:3rem 0">Aucun article publié pour le moment.</p>'
      : `<div style="display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${articlesCards}</div>`
    }
  </main>

  <!-- Footer -->
  <footer style="text-align:center;padding:2rem 1rem;color:#9ca3af;font-size:0.875rem;border-top:1px solid #e5e7eb;margin-top:2rem">
    &copy; ${new Date().getFullYear()} ${companyName}
  </footer>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(html);

  } catch (err) {
    console.error('[BLOG SSR] Erreur liste:', err);
    res.status(500).send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Erreur</title></head><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0"><h1 style="color:#ef4444">Erreur serveur</h1></body></html>`);
  }
});

/**
 * GET /blog/sitemap.xml — Sitemap XML articles
 * Declare AVANT /:slug pour eviter conflit
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    const { data: articles, error } = await supabase
      .from('seo_articles')
      .select('slug, date_publication')
      .eq('tenant_id', req.tenantId)
      .eq('statut', 'publie')
      .order('date_publication', { ascending: false });

    if (error) throw error;

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const urls = (articles || []).map(a => `
  <url>
    <loc>${baseUrl}/blog/${escapeHTML(a.slug)}</loc>
    ${a.date_publication ? `<lastmod>${new Date(a.date_publication).toISOString().split('T')[0]}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>${urls}
</urlset>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);

  } catch (err) {
    console.error('[BLOG SSR] Erreur sitemap:', err);
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
  }
});

/**
 * GET /blog/:slug — Page article complet
 */
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;

  try {
    // Charge article + branding + articles lies en parallele
    const [articleResult, brandingData, relatedResult] = await Promise.all([
      supabase
        .from('seo_articles')
        .select('id, titre, slug, contenu, meta_description, mots_cles_cibles, date_publication, lectures')
        .eq('tenant_id', req.tenantId)
        .eq('slug', slug)
        .eq('statut', 'publie')
        .maybeSingle(),
      req.branding ? Promise.resolve(req.branding) : loadBranding(req.tenantId),
      supabase
        .from('seo_articles')
        .select('titre, slug, meta_description, date_publication')
        .eq('tenant_id', req.tenantId)
        .eq('statut', 'publie')
        .neq('slug', slug)
        .order('date_publication', { ascending: false })
        .limit(3)
    ]);

    if (articleResult.error) throw articleResult.error;

    const article = articleResult.data;

    if (!article) {
      const branding = brandingData;
      const companyName = escapeHTML((branding && branding.company_name) || 'Blog');
      return res.status(404).send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Article introuvable — ${companyName}</title>
  <meta name="robots" content="noindex">
</head>
<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;display:flex;justify-content:center;align-items:center;min-height:100vh">
  <div style="text-align:center;padding:2rem">
    <h1 style="font-size:1.5rem;color:#374151;margin-bottom:1rem">Article introuvable</h1>
    <p style="color:#6b7280;margin-bottom:2rem">Cet article n'existe pas ou n'est plus disponible.</p>
    <a href="/blog" style="color:#0891b2;text-decoration:none;font-weight:600">&larr; Retour au blog</a>
  </div>
</body>
</html>`);
    }

    // Incrementer lectures (fire-and-forget)
    supabase
      .from('seo_articles')
      .update({ lectures: (article.lectures || 0) + 1 })
      .eq('id', article.id)
      .eq('tenant_id', req.tenantId)
      .then(() => {})
      .catch(err => console.error('[BLOG SSR] Erreur increment lectures:', err));

    const branding = brandingData;
    const companyName = escapeHTML((branding && branding.company_name) || 'Blog');
    const color = (branding && branding.primary_color) || '#0891b2';
    const logoUrl = branding && branding.logo_url;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const articleUrl = `${baseUrl}/blog/${escapeHTML(article.slug)}`;
    const related = relatedResult.data || [];

    const keywords = article.mots_cles_cibles || [];
    const contentHtml = `<p style="margin:1rem 0;line-height:1.75;color:#374151">${markdownToHTML(article.contenu)}</p>`;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: article.titre,
      description: article.meta_description || '',
      url: articleUrl,
      datePublished: article.date_publication || undefined,
      keywords: keywords.join(', '),
      publisher: {
        '@type': 'Organization',
        name: (branding && branding.company_name) || '',
        ...(logoUrl ? { logo: { '@type': 'ImageObject', url: logoUrl } } : {})
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': articleUrl
      }
    };

    const relatedHTML = related.length > 0 ? `
    <section style="margin-top:3rem;padding-top:2rem;border-top:1px solid #e5e7eb">
      <h2 style="font-size:1.25rem;font-weight:700;color:#111827;margin-bottom:1rem">Articles similaires</h2>
      <div style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">
        ${related.map(r => `
          <a href="/blog/${escapeHTML(r.slug)}" style="display:block;background:#fff;border-radius:8px;padding:1rem;box-shadow:0 1px 3px rgba(0,0,0,0.08);text-decoration:none;color:inherit">
            <h3 style="font-size:1rem;font-weight:600;color:#111827;margin:0 0 0.25rem">${escapeHTML(r.titre)}</h3>
            ${r.date_publication ? `<time style="font-size:0.8rem;color:#9ca3af">${formatDate(r.date_publication)}</time>` : ''}
            ${r.meta_description ? `<p style="font-size:0.875rem;color:#6b7280;margin:0.5rem 0 0;line-height:1.5">${escapeHTML(r.meta_description).substring(0, 120)}${r.meta_description.length > 120 ? '...' : ''}</p>` : ''}
          </a>
        `).join('')}
      </div>
    </section>` : '';

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(article.titre)} — ${companyName}</title>
  <meta name="description" content="${escapeHTML(article.meta_description || '')}">
  ${keywords.length ? `<meta name="keywords" content="${escapeHTML(keywords.join(', '))}">` : ''}
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${articleUrl}">

  <!-- Open Graph -->
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHTML(article.titre)}">
  <meta property="og:description" content="${escapeHTML(article.meta_description || '')}">
  <meta property="og:url" content="${articleUrl}">
  ${logoUrl ? `<meta property="og:image" content="${escapeHTML(logoUrl)}">` : ''}
  ${article.date_publication ? `<meta property="article:published_time" content="${article.date_publication}">` : ''}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHTML(article.titre)}">
  <meta name="twitter:description" content="${escapeHTML(article.meta_description || '')}">

  <!-- JSON-LD -->
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body style="margin:0;font-family:system-ui,-apple-system,sans-serif;background:#f9fafb;color:#111827">
  <!-- Header -->
  <header style="background:#fff;border-bottom:1px solid #e5e7eb;padding:1rem 0">
    <div style="max-width:768px;margin:0 auto;padding:0 1rem;display:flex;align-items:center;gap:0.75rem">
      ${logoUrl ? `<img src="${escapeHTML(logoUrl)}" alt="${companyName}" style="height:40px;width:auto;border-radius:6px">` : ''}
      <a href="/blog" style="font-size:1.25rem;font-weight:700;color:#111827;text-decoration:none">${companyName}</a>
    </div>
  </header>

  <!-- Article -->
  <main style="max-width:768px;margin:0 auto;padding:2rem 1rem">
    <nav style="margin-bottom:1.5rem">
      <a href="/blog" style="color:${color};text-decoration:none;font-size:0.875rem;font-weight:500">&larr; Retour au blog</a>
    </nav>

    <article>
      <header style="margin-bottom:2rem">
        <h1 style="font-size:2rem;font-weight:800;color:#111827;margin:0 0 1rem;line-height:1.3">${escapeHTML(article.titre)}</h1>

        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
          ${article.date_publication ? `<time style="font-size:0.875rem;color:#6b7280">${formatDate(article.date_publication)}</time>` : ''}
          ${keywords.length ? `<div style="display:flex;gap:0.5rem;flex-wrap:wrap">${keywords.map(k => `<span style="background:#f0f9ff;color:${color};padding:0.2rem 0.6rem;border-radius:9999px;font-size:0.75rem">${escapeHTML(k)}</span>`).join('')}</div>` : ''}
        </div>

        ${article.meta_description ? `<p style="font-size:1.1rem;color:#4b5563;margin:1rem 0 0;font-style:italic;line-height:1.6">${escapeHTML(article.meta_description)}</p>` : ''}
      </header>

      <!-- Contenu -->
      <div style="line-height:1.8;font-size:1.05rem">
        ${contentHtml}
      </div>

      <!-- CTA -->
      <div style="margin-top:3rem;padding:1.5rem;background:#f0f9ff;border-radius:12px;text-align:center;border:1px solid #e0f2fe">
        <h3 style="font-size:1.1rem;font-weight:600;color:#111827;margin:0 0 0.5rem">Envie de prendre rendez-vous ?</h3>
        <p style="color:#4b5563;margin:0 0 1rem;font-size:0.95rem">Réservez en ligne en quelques clics</p>
        <a href="/" style="display:inline-block;background:${color};color:#fff;padding:0.75rem 2rem;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.95rem">Réserver maintenant</a>
      </div>

      ${relatedHTML}
    </article>

    <!-- Retour -->
    <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid #e5e7eb">
      <a href="/blog" style="color:${color};text-decoration:none;font-weight:500;font-size:0.9rem">&larr; Voir tous les articles</a>
    </div>
  </main>

  <!-- Footer -->
  <footer style="text-align:center;padding:2rem 1rem;color:#9ca3af;font-size:0.875rem;border-top:1px solid #e5e7eb;margin-top:2rem">
    &copy; ${new Date().getFullYear()} ${companyName}
  </footer>
</body>
</html>`;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(html);

  } catch (err) {
    console.error('[BLOG SSR] Erreur article:', err);
    res.status(500).send(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Erreur</title></head><body style="font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0"><h1 style="color:#ef4444">Erreur serveur</h1></body></html>`);
  }
});

export default router;
