import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Cache headers middleware
const setNoCacheHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
};

const setImmutableCacheHeaders = (res) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
};

// Serve assets with long-term caching (they have hashes in filenames)
app.use('/assets', express.static(join(__dirname, 'dist', 'assets'), {
  setHeaders: setImmutableCacheHeaders
}));

// Serve other static files (images, etc.) with moderate caching
app.use(express.static(join(__dirname, 'dist'), {
  index: false, // Don't serve index.html from here
  setHeaders: (res, path) => {
    // Assets get immutable cache, others get short cache
    if (path.includes('/assets/')) {
      setImmutableCacheHeaders(res);
    }
  }
}));

// Force cache bust version - increment this to force all clients to reload
const CACHE_BUST_VERSION = '20260227v2';

// SPA fallback - serve index.html with NO CACHE for all routes
app.get('*', (req, res) => {
  // Force redirect to cache-busted URL if not already there
  // This bypasses browser cache by changing the URL
  if (!req.query._v || req.query._v !== CACHE_BUST_VERSION) {
    const url = new URL(req.originalUrl, `http://${req.headers.host}`);
    url.searchParams.set('_v', CACHE_BUST_VERSION);
    return res.redirect(302, url.pathname + url.search);
  }

  setNoCacheHeaders(res);
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Fat's Hair Afro - Server running on port ${PORT}`);
  console.log(`Cache policy: index.html=no-cache, assets=immutable`);
});
