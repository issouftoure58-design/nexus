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

// Legal pages (Meta WhatsApp compliance)
app.get('/privacy', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Politique de confidentialité — NEXUS</title></head><body style="font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;line-height:1.6">
<h1>Politique de confidentialité</h1>
<p><strong>NEXUS AI SaaS</strong> — Dernière mise à jour : 30 avril 2026</p>
<h2>Données collectées</h2><p>Nous collectons les données nécessaires au fonctionnement du service : nom, email, téléphone, données de réservation. Les conversations avec l'IA sont traitées en temps réel et ne sont pas stockées au-delà de la session.</p>
<h2>Utilisation</h2><p>Vos données sont utilisées exclusivement pour fournir le service NEXUS (gestion de réservations, notifications, facturation). Aucune donnée n'est vendue à des tiers.</p>
<h2>Hébergement</h2><p>Les données sont hébergées en Europe (Supabase EU, Render EU).</p>
<h2>Conservation</h2><p>Les données sont conservées pendant la durée de la relation commerciale et supprimées dans un délai de 30 jours après demande.</p>
<h2>Droits RGPD</h2><p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Pour exercer ces droits : <a href="mailto:contact@nexus-ai-saas.com">contact@nexus-ai-saas.com</a></p>
<h2>Contact DPO</h2><p>Email : <a href="mailto:contact@nexus-ai-saas.com">contact@nexus-ai-saas.com</a></p>
</body></html>`);
});

app.get('/terms', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conditions générales — NEXUS</title></head><body style="font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;line-height:1.6">
<h1>Conditions générales d'utilisation</h1>
<p><strong>NEXUS AI SaaS</strong> — Dernière mise à jour : 30 avril 2026</p>
<h2>1. Objet</h2><p>NEXUS est une plateforme SaaS de gestion pour professionnels (réservations, facturation, communication IA). Les présentes conditions régissent l'utilisation du service.</p>
<h2>2. Accès au service</h2><p>L'accès nécessite la création d'un compte professionnel. L'utilisateur est responsable de la confidentialité de ses identifiants.</p>
<h2>3. Données</h2><p>Le traitement des données est décrit dans notre <a href="/privacy">politique de confidentialité</a>.</p>
<h2>4. Responsabilité</h2><p>NEXUS s'engage à fournir un service disponible et sécurisé. La responsabilité est limitée au montant de l'abonnement en cours.</p>
<h2>5. Résiliation</h2><p>L'utilisateur peut résilier à tout moment. Les données sont supprimées sous 30 jours après résiliation.</p>
<h2>6. Contact</h2><p>Email : <a href="mailto:contact@nexus-ai-saas.com">contact@nexus-ai-saas.com</a></p>
</body></html>`);
});

app.get('/data-deletion', (req, res) => {
  res.send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Suppression des données — NEXUS</title></head><body style="font-family:system-ui,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;line-height:1.6">
<h1>Suppression de vos données</h1>
<p><strong>NEXUS AI SaaS</strong> — Dernière mise à jour : 30 avril 2026</p>
<h2>Comment demander la suppression</h2><p>Envoyez un email à <a href="mailto:contact@nexus-ai-saas.com">contact@nexus-ai-saas.com</a> avec l'objet "Suppression de données" en précisant votre nom et numéro de téléphone.</p>
<h2>Délai</h2><p>Vos données seront supprimées dans un délai maximum de 30 jours ouvrés.</p>
<h2>Données concernées</h2><p>Toutes les données personnelles associées à votre compte seront supprimées : nom, email, téléphone, historique de réservations et conversations.</p>
</body></html>`);
});

// SPA fallback
app.get('/{*path}', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Landing server running on port ${PORT}`);
  console.log(`API proxy target: ${API_PROXY_TARGET}`);
});
