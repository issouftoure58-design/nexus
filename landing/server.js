import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// API_PROXY_TARGET = URL de base du backend (sans /api)
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || 'https://nexus-backend-dev.onrender.com';

// Proxy API requests - forward /api/* to backend
app.use('/api', createProxyMiddleware({
  target: API_PROXY_TARGET,
  changeOrigin: true,
  secure: true,
  pathRewrite: (path) => `/api${path}`,
}));

// Serve static files from dist
app.use(express.static(join(__dirname, 'dist'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Landing server running on port ${PORT}`);
  console.log(`API proxy target: ${API_PROXY_TARGET}`);
});
