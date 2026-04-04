/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * Backend API - NEXUS Multi-tenant Platform
 * Point d'entrée principal
 */

// ⚠️ IMPORTANT: Charger .env EN PREMIER avant tout autre import
import './config/env.js';

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import logger from './config/logger.js';

// Import des middlewares sécurité
import { apiLimiter, paymentLimiter } from './middleware/rateLimiter.js';

// Import SENTINEL error tracking (replaces Sentry)
import { captureException } from './services/errorTracker.js';
import errorRoutes, { frontendReportRouter } from './routes/errorRoutes.js';

// Import Swagger documentation
import { setupSwagger } from './config/swagger.js';

// Import des routes
import paymentRoutes from './routes/payment.js';
import whatsappRoutes from './routes/whatsapp.js';
import adminAuthRoutes from './routes/adminAuth.js';
import adminChatRoutes from './routes/adminChatRoutes.js';
import adminModulesRoutes from './routes/adminModules.js';
import relancesRoutes from './routes/relances.js';
import queueRoutes from './routes/queueRoutes.js';
import socialRoutes from './routes/social.js';
import crmRoutes from './routes/crm.js';
import marketingRoutes from './routes/marketing.js';
import comptabiliteRoutes from './routes/comptabilite.js';
import commercialRoutes from './routes/commercial.js';
import depensesRoutes from './routes/depenses.js';
import facturesRoutes from './routes/factures.js';
import stockRoutes from './routes/stock.js';
import seoRoutes from './routes/seo.js';
import rhRoutes from './routes/rh.js';
import apiPublicRoutes from './routes/api-public.js';
import brandingRoutes from './routes/branding.js';
import sentinelRoutes from './routes/sentinel.js';
import quotasRoutes from './routes/quotas.js';
import tenantsRoutes from './routes/tenants.js';
import segmentsRoutes from './routes/adminSegments.js';
import rfmRoutes from './routes/adminRFM.js';
import workflowsRoutes from './routes/adminWorkflows.js';
import pipelineRoutes from './routes/adminPipeline.js';
import devisRoutes from './routes/adminDevis.js';
import prestationsRoutes from './routes/adminPrestations.js';
import ressourcesRoutes from './routes/adminRessources.js';
import comptaRoutes from './routes/adminCompta.js';
import adminSEORoutes from './routes/adminSEO.js';
import adminAnalyticsRoutes from './routes/adminAnalytics.js';
import adminRHRoutes from './routes/adminRH.js';
import adminProfileRoutes from './routes/adminProfile.js';
import journauxRoutes from './routes/journaux.js';
import adminClientsRoutes from './routes/adminClients.js';
import adminReservationsRoutes from './routes/adminReservations.js';
import provisioningRoutes from './routes/provisioning.js';
import usageRoutes from './routes/usage.js';
import adminServicesRoutes from './routes/adminServices.js';
import adminStatsRoutes from './routes/adminStats.js';
import adminOrdersRoutes from './routes/adminOrders.js';
import ordersRoutes from './routes/orders.js';
import adminDisponibilitesRoutes from './routes/adminDisponibilites.js';
import adminParametresRoutes from './routes/adminParametres.js';
import adminApiKeysRoutes from './routes/adminApiKeys.js';
import adminAuditLogRoutes from './routes/adminAuditLog.js';
import adminInvitationsRoutes from './routes/adminInvitations.js';
import adminTeamRoutes from './routes/adminTeam.js';
import adminAgentsRoutes from './routes/adminAgents.js';
import adminStockRoutes from './routes/adminStock.js';
import adminNotificationsRoutes from './routes/adminNotifications.js';
import adminDocumentsRoutes from './routes/adminDocuments.js';
import adminReferralsRoutes from './routes/adminReferrals.js';
import adminSSORoutes from './routes/adminSSO.js';
import modulesRoutes from './routes/modules.js';
import adminIARoutes from './routes/adminIA.js';
import adminMenuRoutes from './routes/adminMenu.js';
import adminHotelRoutes from './routes/adminHotel.js';
import adminCommerceOrdersRoutes from './routes/adminCommerceOrders.js';
import orderTrackingRoutes from './routes/orderTracking.js';
import billingRoutes from './routes/billing.js';
import stripeWebhookRoutes from './routes/stripeWebhook.js';
import yousignWebhookRoutes from './routes/yousignWebhook.js';
import adminSignaturesRoutes from './routes/adminSignatures.js';
import instagramWebhookRoutes from './routes/instagramWebhook.js';
import adminIGSetterRoutes from './routes/adminIGSetter.js';
import socialAuthRoutes from './routes/socialAuth.js';
import questionnairesRoutes from './routes/questionnaires.js';
import qualiopiRoutes from './routes/qualiopi.js';
import satisfactionRoutes from './routes/satisfaction.js';
import signupRoutes from './routes/signup.js';
import trialRoutes from './routes/trial.js';
import publicRoutes from './routes/public.js';
import reviewsRoutes from './routes/reviews.js';
import twilioWebhooksRoutes from './routes/twilioWebhooks.js';
import voiceRoutes from './routes/voice.js';
import agendaRoutes from './routes/agenda.js';
import landingAgentRoutes from './routes/landingAgent.js';
import rgpdRoutes from './routes/rgpd.js';
import onboardingRoutes from './routes/onboarding.js';
import onboardingSequencesRoutes from './routes/adminOnboardingSequences.js';
import publicPaymentRoutes from './routes/publicPayment.js';
import nexusAdminRoutes, {
  sentinelIntelligenceRouter,
  sentinelAutopilotRouter,
  sentinelLiveRouter,
  optimizationRouter
} from './routes/nexusAdmin.js';
import nexusAuthRoutes from './routes/nexusAuth.js';
import nexusProspectionRoutes, { prospectionPublicRouter, prospectionWebhookRouter } from './routes/nexusProspection.js';
import employeeAuthRoutes from './routes/employeeAuth.js';
import employeePortalRoutes from './routes/employeePortal.js';
import cgvRoutes from './routes/cgv.js';
import adminLoyaltyRoutes from './routes/adminLoyalty.js';
import adminWaitlistRoutes from './routes/adminWaitlist.js';
import exercicesRoutes from './routes/exercices.js';
import comptaImportRoutes from './routes/comptaImport.js';

// Import du middleware tenant resolution
import { resolveTenantByDomain } from './middleware/resolveTenant.js';

// 🛡️ TENANT SHIELD - Protection isolation multi-tenant
import { tenantShield, validateBodyTenant } from './middleware/tenantShield.js';

// 📋 AUDIT LOG - Logging automatique des mutations admin
import { auditLogMiddleware } from './middleware/auditLog.js';

// 🔐 RBAC - Contrôle d'accès granulaire par rôle
import { rbacMiddleware } from './middleware/rbac.js';

// Import du scheduler
import { startScheduler } from './jobs/scheduler.js';

// Import du worker de notifications (BullMQ)
import { startNotificationWorker, stopNotificationWorker } from './queues/notificationWorker.js';

// Import SENTINEL guardian system
import { sentinel } from './sentinel/index.js';

// Central interval registry for graceful shutdown
import { shutdownAllIntervals } from './utils/intervalRegistry.js';

// V3 - Realtime Voice WebSocket (Twilio Media Streams <-> OpenAI Realtime)
import { WebSocketServer } from 'ws';
import { handleMediaStream, closeAllSessions as closeRealtimeSessions } from './services/realtimeVoiceHandler.js';

// ============= VALIDATION ENV VARS =============
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
const WARN_ENV = ['STRIPE_SECRET_KEY', 'TWILIO_ACCOUNT_SID', 'RESEND_API_KEY', 'OPENAI_API_KEY'];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error(`[BOOT] Variable d'environnement requise manquante: ${key}`);
    process.exit(1);
  }
}
for (const key of WARN_ENV) {
  if (!process.env[key]) {
    logger.warn(`[BOOT] Variable d'environnement optionnelle manquante: ${key}`);
  }
}

// Création de l'application Express
const app = express();
app.set('trust proxy', 1);

// ============= ERROR TRACKING (SENTINEL) =============
// No init needed — errorTracker is always active

// ============= SWAGGER DOCUMENTATION =============
setupSwagger(app);

// ============= MIDDLEWARES =============

// Helmet - Sécurité headers HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "https://js.stripe.com"],
      connectSrc: ["'self'", "https://api.stripe.com", "wss:", "https:"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Headers sécurité supplémentaires
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// Compression GZIP - Réduit la taille des réponses de 60-70%
app.use(compression({
  level: 6, // Bon compromis vitesse/compression
  threshold: 1024, // Compresser seulement > 1KB
  filter: (req, res) => {
    // Ne pas compresser les streams SSE
    if (req.headers['accept'] === 'text/event-stream') {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// CORS — whitelist stricte en production
const corsAllowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
  : [];
const corsIsOpen = !process.env.CORS_ORIGIN && process.env.NODE_ENV !== 'production';

app.use(cors({
  origin: function(origin, callback) {
    // En dev sans CORS_ORIGIN: tout autoriser
    if (corsIsOpen) return callback(null, true);
    // Pas d'origin (curl, server-to-server): autoriser mais logger en prod
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        logger.debug('[CORS] Requete sans origin', { ip: 'server-to-server' });
      }
      return callback(null, true);
    }
    // Verifier la whitelist
    if (corsAllowedOrigins.includes(origin)) return callback(null, true);
    // Bloque — callback(null, false) = pas de header CORS
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key', 'X-Tenant-ID', 'X-Tenant-Slug'],
}));

// Rate limiting global API
app.use('/api/', apiLimiter);

// Stripe Webhook (AVANT json parser - necessite raw body)
app.use('/api/webhooks/stripe', stripeWebhookRoutes);

// Yousign Webhook (signature électronique)
app.use('/api/webhooks/yousign', yousignWebhookRoutes);

// Instagram Webhook (Setter IA DMs)
app.use('/api/webhooks/instagram', instagramWebhookRoutes);

// JSON body parser (limit explicite pour prevenir les gros payloads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Logger des requêtes
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`${new Date().toISOString()} | ${req.method} ${req.path} | ${res.statusCode} | ${duration}ms`);
    }
  });
  next();
});

// ============= STATIC FILES (widget.js, etc.) =============
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    // CORS permissif pour le widget embeddable
    if (filePath.endsWith('widget.js')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
}));

// ============= BLOG SSR (SEO) =============
import blogSSRRoutes from './routes/blog.js';
app.use('/blog', blogSSRRoutes);

// ============= ROUTES =============

// Health check public — minimal, ne revele pas les integrations
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    version: process.env.npm_package_version || '3.24.0'
  });
});

// Status page publique pour monitoring externe et clients
app.get('/api/status', async (req, res) => {
  const services = [];
  let allOperational = true;

  // Database
  try {
    const start = Date.now();
    const { supabase: sb } = await import('./config/supabase.js');
    const { error } = await sb.from('tenants').select('id').limit(1);
    const latency = Date.now() - start;
    services.push({ name: 'Base de données', status: error ? 'degraded' : 'operational', latency });
    if (error) allOperational = false;
  } catch {
    services.push({ name: 'Base de données', status: 'down' });
    allOperational = false;
  }

  // API
  services.push({ name: 'API', status: 'operational', latency: 0 });

  // Auth
  services.push({ name: 'Authentification', status: 'operational' });

  // Payments
  services.push({
    name: 'Paiements (Stripe)',
    status: process.env.STRIPE_SECRET_KEY ? 'operational' : 'not_configured'
  });

  // Messaging
  services.push({
    name: 'Messagerie (Twilio)',
    status: process.env.TWILIO_ACCOUNT_SID ? 'operational' : 'not_configured'
  });

  // Email
  services.push({
    name: 'Email (Resend)',
    status: process.env.RESEND_API_KEY ? 'operational' : 'not_configured'
  });

  res.json({
    status: allOperational ? 'operational' : 'degraded',
    updated_at: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    services,
  });
});

// ============= LANDING PAGE AGENT (Public, avant tenant resolution) =============
// Agent commercial IA pour le site vitrine - pas besoin de tenant
app.use('/api/landing', landingAgentRoutes);

// ============= PUBLIC PAYMENT (Widget reservation, tenant via header) =============
// Paiement public pour le widget de reservation client - gere sa propre resolution tenant
app.use('/api/public/payment', publicPaymentRoutes);

// ============= CGV (public, avant tenant shield) =============
app.use('/api/cgv', cgvRoutes);

// ============= FRONTEND ERROR REPORT (public, avant tenant shield) =============
app.use('/api', frontendReportRouter);

// ============= NEXUS SUPER-ADMIN (cross-tenant, avant tenant shield) =============
// Health check detaille — superadmin uniquement (revele DB, Redis, integrations)
app.get('/api/nexus/health', async (req, res) => {
  const checks = { db: 'unknown', redis: 'unknown' };
  let healthy = true;

  try {
    const start = Date.now();
    const { supabase: sb } = await import('./config/supabase.js');
    const { error } = await sb.from('tenants').select('id').limit(1);
    checks.db = error ? 'error' : 'ok';
    checks.db_latency = Date.now() - start;
    if (error) healthy = false;
  } catch { checks.db = 'error'; healthy = false; }

  try {
    const { isAvailable } = await import('./config/redis.js');
    checks.redis = isAvailable() ? 'ok' : 'not_configured';
  } catch { checks.redis = 'not_configured'; }

  checks.stripe = !!process.env.STRIPE_SECRET_KEY;
  checks.twilio = !!process.env.TWILIO_ACCOUNT_SID;
  checks.resend = !!process.env.RESEND_API_KEY;
  checks.error_tracking = 'sentinel';
  checks.sentinel = sentinel.getStatus().status;

  const status = healthy ? 'ok' : 'degraded';
  res.status(healthy ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: Math.round(process.memoryUsage().rss / 1024 / 1024),
    checks
  });
});

// Panel opérateur NEXUS — auth via JWT super_admin, pas besoin de tenant resolution
app.use('/api/nexus/auth', nexusAuthRoutes);
app.use('/api/nexus', errorRoutes);
app.use('/api/nexus', nexusAdminRoutes);
app.use('/api/nexus/prospection', nexusProspectionRoutes);
app.use('/api/prospection', prospectionPublicRouter);
app.use('/api/webhooks', prospectionWebhookRouter);
app.use('/api/admin/sentinel-intelligence', sentinelIntelligenceRouter);
app.use('/api/sentinel/autopilot', sentinelAutopilotRouter);
app.use('/api/sentinel/live', sentinelLiveRouter);
app.use('/api/optimization', optimizationRouter);

// 👤 EMPLOYEE PORTAL (auth propre, avant tenant resolution)
app.use('/api/employee/auth', employeeAuthRoutes);
app.use('/api/employee', employeePortalRoutes);

// 🔑 SSO public routes (avant tenant resolution — pas d'auth/tenant requise)
app.use('/api/sso', adminSSORoutes);

// 🔒 TENANT RESOLUTION: Appliqué globalement pour toutes les routes /api
// Résout le tenant via X-Tenant-ID header, domaine custom, ou sous-domaine
app.use('/api', resolveTenantByDomain);

// 🛡️ TENANT SHIELD: Protection multi-tenant activée
// - Bloque requêtes sans tenant_id (sauf routes système définies dans tenantShield.js)
// - Valide que body.tenant_id match le tenant de la session
// - Log les tentatives cross-tenant
app.use('/api', tenantShield({ strict: true, logViolations: true }));
app.use('/api', validateBodyTenant());

// ============= ROUTES PUBLIQUES (sans auth, rate limited) =============
// Services, Chat, Rendez-vous pour les clients
app.use('/api/public', apiLimiter);
app.use('/api', publicRoutes);

// Reviews/Avis clients (public GET + admin routes)
app.use('/api/reviews', reviewsRoutes);

// Twilio Webhooks (Voice IA + SMS)
app.use('/api/twilio', twilioWebhooksRoutes);

// Voice TTS routes
app.use('/api/voice', voiceRoutes);

// Routes de paiement (avec rate limiting strict)
app.use('/api/payment', paymentLimiter, paymentRoutes);

// Routes WhatsApp (Webhook Twilio)
app.use('/api/whatsapp', whatsappRoutes);

// 📋 AUDIT LOG: Log automatique des mutations admin (POST/PUT/PATCH/DELETE)
app.use('/api/admin', auditLogMiddleware());

// 🔐 RBAC: Contrôle d'accès granulaire par rôle (admin/manager/viewer)
app.use('/api/admin', rbacMiddleware());

// Routes Admin Auth (login, logout, etc.)
app.use('/api/admin/auth', adminAuthRoutes);

// Routes Admin Chat (streaming)
app.use('/api/admin/chat', adminChatRoutes);

// Routes Admin Modules (activation/désactivation)
app.use('/api/admin/modules', adminModulesRoutes);

// Routes Admin Segments CRM (Pro/Business)
app.use('/api/admin/segments', segmentsRoutes);
app.use('/api/admin/rfm', rfmRoutes);

// Routes Admin Workflows Marketing Automation (Pro/Business)
app.use('/api/admin/workflows', workflowsRoutes);

// Routes Admin Pipeline Commercial (Pro/Business)
app.use('/api/admin/pipeline', pipelineRoutes);

// Routes Admin Signatures Yousign (Pro/Business)
app.use('/api/admin/signatures', adminSignaturesRoutes);

// Routes Admin Instagram Setter (Pro/Business)
app.use('/api/admin/ig-setter', adminIGSetterRoutes);

// Routes OAuth Réseaux Sociaux (Facebook/Instagram)
app.use('/api/social/auth', socialAuthRoutes);

// Routes Questionnaires Qualification (public + admin)
app.use('/api/questionnaires', questionnairesRoutes);

// Routes Qualiopi Dashboard (admin)
app.use('/api/admin/qualiopi', qualiopiRoutes);

// Routes Satisfaction Surveys (public + admin)
app.use('/api/satisfaction', satisfactionRoutes);

// Routes Admin Devis & Prestations (Pro/Business)
app.use('/api/admin/devis', devisRoutes);
app.use('/api/admin/prestations', prestationsRoutes);
app.use('/api/admin/ressources', ressourcesRoutes);

// Routes Admin Comptabilité P&L (Pro/Business)
app.use('/api/admin/compta', comptaRoutes);

// Routes Admin SEO (Business)
app.use('/api/admin/seo', adminSEORoutes);

// Routes Admin Analytics Prédictifs (Business)
app.use('/api/admin/analytics', adminAnalyticsRoutes);

// Routes Admin RH Equipe (Business)
app.use('/api/admin/rh', adminRHRoutes);

// Routes Admin Fidélité (Programme de points)
app.use('/api/admin/loyalty', adminLoyaltyRoutes);

// Routes Admin Waitlist (Liste d'attente)
app.use('/api/admin/waitlist', adminWaitlistRoutes);

// Routes Admin Profile (Business Profiles)
app.use('/api/admin/profile', adminProfileRoutes);

// Routes Relances factures
app.use('/api/relances', relancesRoutes);

// Routes Queue notifications (stats)
app.use('/api/queue', queueRoutes);

// Routes Social (génération posts IA)
app.use('/api/social', socialRoutes);

// Routes CRM (segmentation clients)
app.use('/api/crm', crmRoutes);

// Routes Marketing (workflows automation)
app.use('/api/marketing', marketingRoutes);

// Routes Comptabilité (transactions, rapports P&L)
app.use('/api/comptabilite', comptabiliteRoutes);

// Routes Commercial (clients inactifs, scoring, campagnes relance)
app.use('/api/commercial', commercialRoutes);

// Routes Dépenses (charges, TVA, compte résultat)
app.use('/api/depenses', depensesRoutes);

// Routes Journaux comptables (écritures, balance, grand livre)
app.use('/api/journaux', journauxRoutes);

// Routes Exercices comptables (clôture, périodes, verrouillage)
app.use('/api/exercices', exercicesRoutes);

// Routes Import comptable (FEC, CSV, soldes ouverture)
app.use('/api/import-compta', comptaImportRoutes);

// Routes Factures (génération, envoi, gestion)
app.use('/api/factures', facturesRoutes);

// Routes Stock (produits, mouvements, inventaires)
app.use('/api/stock', stockRoutes);

// Routes SEO & Visibilité (articles, mots-clés, Google My Business)
app.use('/api/seo', seoRoutes);

// Routes RH Multi-employés (employés, planning, congés, heures)
app.use('/api/rh', rhRoutes);

// Routes API REST Publique v1 (pour intégrations tierces)
// API Versioning: header API-Version + réponse avec X-API-Version
app.use('/api/v1', (req, res, next) => {
  const requestedVersion = req.headers['api-version'];
  const currentVersion = '2026-03-03';
  res.set('X-API-Version', currentVersion);
  res.set('X-API-Supported-Versions', '2026-03-03');
  if (requestedVersion && requestedVersion !== currentVersion) {
    res.set('X-API-Version-Warning', `Requested version ${requestedVersion} not found, using ${currentVersion}`);
  }
  req.apiVersion = currentVersion;
  next();
}, apiPublicRoutes);

// Routes Branding & White-Label
app.use('/api/branding', brandingRoutes);

// Routes SENTINEL Analytics (Business plan)
app.use('/api/sentinel', sentinelRoutes);

// Routes Quotas (usage par plan Starter/Pro/Business)
app.use('/api/quotas', quotasRoutes);
app.use('/api/admin/quotas', quotasRoutes); // Alias pour admin-ui

// Routes Tenants (configuration multi-tenant)
app.use('/api/tenants', tenantsRoutes);

// Routes Admin Core (clients, reservations, services, etc.)
app.use('/api/admin/clients', adminClientsRoutes);
app.use('/api/admin/reservations', adminReservationsRoutes);
app.use('/api/admin/services', adminServicesRoutes);
app.use('/api/admin/stats', adminStatsRoutes);
app.use('/api/admin/orders', adminOrdersRoutes);
app.use('/api/orders', ordersRoutes);  // Routes publiques checkout panier
app.use('/api/admin/disponibilites', adminDisponibilitesRoutes);
app.use('/api/admin/parametres', adminParametresRoutes);
app.use('/api/admin/audit-logs', adminAuditLogRoutes);
app.use('/api/admin/invitations', adminInvitationsRoutes);
app.use('/api/admin/team', adminTeamRoutes);
app.use('/api/admin/agents', adminAgentsRoutes);
app.use('/api/admin/stock', adminStockRoutes);
app.use('/api/admin/notifications', adminNotificationsRoutes);
app.use('/api/admin/documents', adminDocumentsRoutes);
app.use('/api/admin/referrals', adminReferralsRoutes);
app.use('/api/admin/sso', adminSSORoutes);
app.use('/api/admin/onboarding', onboardingRoutes);
app.use('/api/admin/onboarding-sequences', onboardingSequencesRoutes);

// Routes Admin IA Config (Telephone & WhatsApp)
app.use('/api/admin/ia', adminIARoutes);
app.use('/api/admin/menu', adminMenuRoutes);
app.use('/api/admin/hotel', adminHotelRoutes);
app.use('/api/admin/commerce/orders', adminCommerceOrdersRoutes);

// ⚠️ adminApiKeysRoutes monté à /api/admin (broad) avec router.use(authenticateAdmin)
// DOIT être APRÈS toutes les routes /api/admin/* spécifiques pour ne pas les bloquer
app.use('/api/admin', adminApiKeysRoutes);
app.use('/api/orders', orderTrackingRoutes);

// Routes Billing (Stripe subscriptions)
app.use('/api/billing', billingRoutes);

// Routes Modules dynamiques (nouveau système modulaire)
app.use('/api/modules', modulesRoutes);

// Routes Provisioning (numéros Twilio automatiques)
app.use('/api/provisioning', provisioningRoutes);

// Routes Usage Tracking
app.use('/api/usage', usageRoutes);

// Routes Signup (inscription nouveaux tenants)
app.use('/api/signup', signupRoutes);

// Routes Trial (gestion période d'essai)
app.use('/api/trial', trialRoutes);

// Routes RGPD (export/suppression données personnelles)
app.use('/api/rgpd', rgpdRoutes);

// Agenda - RDV business entrepreneur
app.use('/api/agenda', agendaRoutes);

// Route 404 pour les API
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    path: req.path,
  });
});

// Gestion des erreurs globale + SENTINEL error tracking
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });

  // Track errors with status >= 500 (or no status) via SENTINEL
  if (!err.status || err.status >= 500) {
    captureException(err, { req });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Erreur serveur interne',
  });
});

// ============= INITIALISATION TENANT CACHE =============
import { loadAllTenants, startPeriodicRefresh } from './config/tenants/tenantCache.js';

// Charger le cache des tenants au démarrage (async)
loadAllTenants()
  .then(() => {
    startPeriodicRefresh();
  })
  .catch(err => logger.error('TenantCache Erreur init', { error: err.message }));

// ============= DÉMARRAGE SERVEUR =============

const PORT = process.env.BACKEND_PORT || process.env.PORT || 3001;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log(`🚀 Backend API démarré sur le port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`💳 Payment API: http://localhost:${PORT}/api/payment`);
  console.log(`📱 WhatsApp API: http://localhost:${PORT}/api/whatsapp`);
  console.log('='.repeat(50));
  console.log('');
  console.log('Endpoints disponibles:');
  console.log('');
  console.log('💳 Payment:');
  console.log('  POST /api/payment/create-intent');
  console.log('  POST /api/payment/create-paypal-order');
  console.log('  POST /api/payment/confirm-stripe');
  console.log('  POST /api/payment/capture-paypal');
  console.log('  POST /api/payment/refund');
  console.log('  GET  /api/payment/status/:rdv_id');
  console.log('');
  console.log('📱 WhatsApp:');
  console.log('  POST /api/whatsapp/webhook      - Webhook Twilio');
  console.log('  POST /api/whatsapp/status       - Status delivery');
  console.log('  POST /api/whatsapp/test         - Test simulation');
  console.log('  GET  /api/whatsapp/health       - Health check');
  console.log('');
  console.log('💬 Admin Chat (streaming):');
  console.log('  GET  /api/admin/chat/conversations');
  console.log('  POST /api/admin/chat/conversations');
  console.log('  GET  /api/admin/chat/conversations/:id/messages');
  console.log('  POST /api/admin/chat/conversations/:id/messages/stream');
  console.log('');
  console.log('📊 Queue Notifications:');
  console.log('  GET  /api/queue/stats             - Statistiques');
  console.log('  GET  /api/queue/health            - Health check');
  console.log('  POST /api/queue/clean             - Nettoyage (admin)');
  console.log('');
  console.log('📱 Social Media:');
  console.log('  POST /api/social/generate-post    - Génère post IA');
  console.log('  POST /api/social/generate-ideas   - Génère idées');
  console.log('  GET  /api/social/posts            - Liste posts');
  console.log('  POST /api/social/posts            - Sauvegarde post');
  console.log('  DELETE /api/social/posts/:id      - Supprime post');
  console.log('  GET  /api/social/stats            - Statistiques');
  console.log('');
  console.log('👥 CRM Segmentation:');
  console.log('  GET  /api/crm/segments             - Liste segments');
  console.log('  POST /api/crm/segments             - Créer segment');
  console.log('  GET  /api/crm/segments/:id/clients - Clients segment');
  console.log('  GET  /api/crm/tags                 - Liste tags');
  console.log('  POST /api/crm/tags                 - Créer tag');
  console.log('  GET  /api/crm/analytics            - Stats CRM');
  console.log('');
  console.log('⚡ Marketing Automation:');
  console.log('  POST /api/marketing/workflows           - Créer workflow');
  console.log('  GET  /api/marketing/workflows           - Liste workflows');
  console.log('  POST /api/marketing/workflows/:id/toggle - Toggle actif');
  console.log('  POST /api/marketing/workflows/:id/test  - Test manuel');
  console.log('');
  console.log('📊 Campagnes A/B Testing:');
  console.log('  POST /api/marketing/campagnes           - Créer campagne');
  console.log('  GET  /api/marketing/campagnes           - Liste campagnes');
  console.log('  GET  /api/marketing/campagnes/:id       - Détail + analytics');
  console.log('  POST /api/marketing/campagnes/:id/start - Démarrer');
  console.log('  POST /api/marketing/campagnes/:id/stop  - Arrêter');
  console.log('  POST /api/marketing/campagnes/:id/declare-winner');
  console.log('');
  console.log('📈 Tracking & Analytics:');
  console.log('  POST /api/marketing/tracking/event      - Événement');
  console.log('  POST /api/marketing/tracking/create-link - Lien tracké');
  console.log('  GET  /api/marketing/track/:token        - Redirection (public)');
  console.log('  GET  /api/marketing/analytics/overview  - Stats globales');
  console.log('  GET  /api/marketing/analytics/evolution - Évolution');
  console.log('');
  console.log('💰 Comptabilité:');
  console.log('  POST /api/comptabilite/transactions      - Créer transaction');
  console.log('  GET  /api/comptabilite/transactions      - Liste transactions');
  console.log('  GET  /api/comptabilite/categories        - Liste catégories');
  console.log('  GET  /api/comptabilite/rapports/mensuel  - P&L mensuel');
  console.log('  GET  /api/comptabilite/rapports/annuel   - P&L annuel');
  console.log('  GET  /api/comptabilite/dashboard         - Dashboard');
  console.log('');
  console.log('🎯 Commercial:');
  console.log('  GET  /api/commercial/clients/inactifs    - Clients inactifs');
  console.log('  GET  /api/commercial/clients/scoring     - Scoring clients');
  console.log('  GET  /api/commercial/campagnes           - Liste campagnes');
  console.log('  POST /api/commercial/campagnes           - Créer campagne');
  console.log('  GET  /api/commercial/stats               - Stats commerciales');
  console.log('');
  console.log('📝 Dépenses:');
  console.log('  GET  /api/depenses                       - Liste dépenses');
  console.log('  POST /api/depenses                       - Créer dépense');
  console.log('  PUT  /api/depenses/:id                   - Modifier dépense');
  console.log('  DELETE /api/depenses/:id                 - Supprimer dépense');
  console.log('  GET  /api/depenses/resume                - Résumé par catégorie');
  console.log('  GET  /api/depenses/compte-resultat       - Compte de résultat');
  console.log('  GET  /api/depenses/tva                   - Données TVA');
  console.log('');
  console.log('🧾 Factures:');
  console.log('  GET  /api/factures                       - Liste factures');
  console.log('  GET  /api/factures/:id                   - Détail facture');
  console.log('  POST /api/factures/:id/envoyer           - Envoyer facture');
  console.log('  POST /api/factures/envoyer-toutes        - Envoyer toutes');
  console.log('  POST /api/factures/generer-manquantes    - Générer manquantes');
  console.log('  PATCH /api/factures/:id/statut           - Changer statut');
  console.log('');
  console.log('📦 Stock & Inventaire:');
  console.log('  POST /api/stock/produits                 - Créer produit');
  console.log('  GET  /api/stock/produits                 - Liste produits');
  console.log('  POST /api/stock/mouvements               - Créer mouvement');
  console.log('  GET  /api/stock/mouvements               - Historique');
  console.log('  POST /api/stock/inventaires              - Créer inventaire');
  console.log('  POST /api/stock/inventaires/:id/valider  - Valider inventaire');
  console.log('  GET  /api/stock/dashboard                - Dashboard stock');
  console.log('  GET  /api/stock/valorisation             - Valorisation');
  console.log('  GET  /api/stock/alertes                  - Alertes stock');
  console.log('');
  console.log('🔍 SEO & Visibilité:');
  console.log('  POST /api/seo/articles/generer           - Générer article IA');
  console.log('  GET  /api/seo/articles                   - Liste articles');
  console.log('  POST /api/seo/articles                   - Créer article');
  console.log('  POST /api/seo/articles/:id/publier       - Publier article');
  console.log('  GET  /api/seo/mots-cles                  - Mots-clés suivis');
  console.log('  POST /api/seo/mots-cles                  - Ajouter mot-clé');
  console.log('  GET  /api/seo/meta                       - Meta SEO pages');
  console.log('  GET  /api/seo/gmb                        - Fiche GMB');
  console.log('  POST /api/seo/gmb/posts                  - Posts GMB');
  console.log('  GET  /api/seo/dashboard                  - Dashboard SEO');
  console.log('');
  console.log('👥 RH Multi-employés:');
  console.log('  POST /api/rh/employes                    - Créer employé');
  console.log('  GET  /api/rh/employes                    - Liste employés');
  console.log('  PATCH /api/rh/employes/:id               - Modifier employé');
  console.log('  POST /api/rh/planning                    - Créer planning');
  console.log('  GET  /api/rh/planning                    - Planning équipe');
  console.log('  POST /api/rh/conges                      - Demande congé');
  console.log('  PATCH /api/rh/conges/:id/approuver       - Approuver congé');
  console.log('  GET  /api/rh/compteurs/:employeId        - Compteurs congés');
  console.log('  POST /api/rh/heures                      - Pointage');
  console.log('  GET  /api/rh/dashboard                   - Dashboard RH');
  console.log('');
  console.log('🔌 API REST Publique v1:');
  console.log('  POST /api/v1/auth/token                  - Valider API key');
  console.log('  GET  /api/v1/clients                     - Liste clients');
  console.log('  POST /api/v1/clients                     - Créer client');
  console.log('  GET  /api/v1/reservations                - Liste réservations');
  console.log('  POST /api/v1/reservations                - Créer réservation');
  console.log('  GET  /api/v1/services                    - Liste services');
  console.log('  GET  /api/v1/webhooks                    - Liste webhooks');
  console.log('  POST /api/v1/webhooks                    - Créer webhook');
  console.log('  GET  /api/v1/api-keys                    - Liste API keys');
  console.log('  POST /api/v1/api-keys                    - Créer API key');
  console.log('');
  console.log('🎨 Branding & White-Label:');
  console.log('  GET  /api/branding                       - Config branding');
  console.log('  PUT  /api/branding                       - Modifier branding');
  console.log('  GET  /api/branding/themes                - Thèmes disponibles');
  console.log('  POST /api/branding/apply-theme           - Appliquer thème');
  console.log('  POST /api/branding/domain                - Config domaine custom');
  console.log('  POST /api/branding/domain/verify         - Vérifier domaine');
  console.log('  GET  /api/branding/theme.css             - CSS dynamique');
  console.log('  GET  /api/branding/pages                 - Pages custom');
  console.log('  POST /api/branding/pages                 - Créer page');
  console.log('');
  console.log('📊 SENTINEL Analytics (Business):');
  console.log('  GET  /api/sentinel/dashboard             - Dashboard principal');
  console.log('  POST /api/sentinel/refresh               - Rafraîchir données');
  console.log('  GET  /api/sentinel/activity/:period      - Activité détaillée');
  console.log('  GET  /api/sentinel/costs/:period         - Coûts détaillés');
  console.log('  GET  /api/sentinel/insights              - Insights actifs');
  console.log('  POST /api/sentinel/insights/generate     - Générer insights IA');
  console.log('  POST /api/sentinel/insights/ask          - Demander conseil IA');
  console.log('  GET  /api/sentinel/goals                 - Objectifs');
  console.log('  PUT  /api/sentinel/goals                 - Modifier objectifs');
  console.log('');
  console.log('🎯 Pipeline Commercial (Pro/Business):');
  console.log('  GET  /api/admin/pipeline                 - Pipeline Kanban');
  console.log('  POST /api/admin/pipeline                 - Créer opportunité');
  console.log('  PATCH /api/admin/pipeline/:id/etape      - Déplacer (drag&drop)');
  console.log('  GET  /api/admin/pipeline/stats/summary   - Stats résumé');
  console.log('  GET  /api/admin/pipeline/stats/historique - Historique gagné/perdu');
  console.log('');
  console.log('📈 Comptabilité P&L (Pro/Business):');
  console.log('  GET  /api/admin/compta/pnl               - P&L mensuel');
  console.log('  GET  /api/admin/compta/pnl/periode       - P&L période');
  console.log('  GET  /api/admin/compta/pnl/annee         - P&L annuel');
  console.log('  GET  /api/admin/compta/pnl/compare       - Comparaison');
  console.log('  GET  /api/admin/compta/pnl/export-pdf    - Export PDF');
  console.log('  GET  /api/admin/compta/dashboard         - Dashboard compta');
  console.log('');

  // V3 - Realtime Voice WebSocket Server (Twilio Media Streams)
  const wss = new WebSocketServer({ server, path: '/media-stream' });
  wss.on('connection', (ws, req) => {
    console.log(`[REALTIME] WebSocket connection on /media-stream from ${req.socket.remoteAddress}`);
    handleMediaStream(ws);
  });
  wss.on('error', (err) => {
    console.error(`[REALTIME] WebSocketServer error: ${err.message}`);
  });
  console.log(`[REALTIME] WebSocket server ready on /media-stream`);

  // Démarrer le scheduler de jobs
  startScheduler();

  // Seed superadmin si les variables d'env sont définies
  if (process.env.NEXUS_SUPERADMIN_EMAIL && process.env.NEXUS_SUPERADMIN_PASSWORD) {
    import('../scripts/seed-superadmin.js').then(m => m.seedSuperAdmin()).catch(err =>
      console.error('[seed-superadmin] Boot seed error:', err.message)
    );
  }

  // Démarrer le worker de notifications (BullMQ)
  startNotificationWorker();

  // Initialiser SENTINEL guardian system
  sentinel.init().then(async result => {
    if (result.success) {
      console.log('[SENTINEL] Guardian system initialized successfully');
      // Démarrer le monitoring uptime (scan services toutes les 60s)
      const { startMonitoring } = await import('./sentinel/monitoring/index.js');
      startMonitoring(60);
      // Démarrer les backups automatiques (toutes les 24h)
      const { startBackupScheduler } = await import('./sentinel/backup/index.js');
      startBackupScheduler(24);
    } else {
      console.error('[SENTINEL] Initialization failed:', result.error);
    }
  }).catch(err => console.error('[SENTINEL] Init error:', err.message));
});

// ============= GRACEFUL SHUTDOWN =============

let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`[SHUTDOWN] ${signal} recu, arret en cours...`);

  // 1. Arreter d'accepter de nouvelles connexions
  server.close(() => {
    logger.info('[SHUTDOWN] Serveur HTTP ferme');
  });

  // 2. Fermer les sessions Realtime Voice actives
  closeRealtimeSessions();

  // 3. Arreter tous les setInterval enregistres
  shutdownAllIntervals();

  // 4. Arreter le worker BullMQ
  try {
    await stopNotificationWorker();
    logger.info('[SHUTDOWN] Worker notifications arrete');
  } catch (err) {
    logger.error('[SHUTDOWN] Erreur arret worker:', { error: err.message });
  }

  // 5. Forcer la sortie apres 10s si le cleanup prend trop longtemps
  setTimeout(() => {
    logger.warn('[SHUTDOWN] Force exit apres timeout 10s');
    process.exit(1);
  }, 10000).unref();

  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============= UNCAUGHT ERRORS =============

process.on('uncaughtException', (err) => {
  logger.error('[FATAL] uncaughtException:', { error: err.message, stack: err.stack });
  captureException(err, { context: 'uncaughtException' });
  // Laisser le temps au logger de flush puis exit
  setTimeout(() => process.exit(1), 1000).unref();
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error('[FATAL] unhandledRejection:', { error: err.message, stack: err.stack });
  captureException(err, { context: 'unhandledRejection' });
});

export default app;
