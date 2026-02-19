import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// VITE_API_URL peut inclure /api, on extrait l'URL de base pour le proxy
const VITE_API_URL = process.env.VITE_API_URL || 'https://nexus-backend-dev.onrender.com/api';
const API_BASE_URL = VITE_API_URL.replace(/\/api\/?$/, '');

// Proxy API requests - forward /api/* to backend
app.use('/api', createProxyMiddleware({
  target: API_BASE_URL,
  changeOrigin: true,
  secure: true,
}));

// Serve static files from dist
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback - serve index.html for all routes
app.get('/{*path}', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API proxy target: ${API_BASE_URL}`);
});
