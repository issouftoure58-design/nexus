# 🏗️ NEXUS - SYSTÈME COMPLET

> **Dernière mise à jour:** 2026-02-21
> **Version:** 1.0.0
> **Status:** Production

---

## 📋 VUE D'ENSEMBLE RAPIDE

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEXUS PLATFORM                           │
├─────────────────────────────────────────────────────────────────┤
│  Type: SaaS Multi-Tenant                                        │
│  Stack: Node.js + Express + Supabase + React                   │
│  Deploy: Render.com                                             │
│  AI: Claude (Anthropic) + ElevenLabs (TTS)                     │
│  Téléphonie: Twilio (WhatsApp + Voice + SMS)                   │
│  Paiements: Stripe                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏛️ ARCHITECTURE

### Structure des dossiers

```
nexus/
├── backend/                    # API Node.js/Express
│   ├── src/
│   │   ├── ai/                # Intelligence artificielle
│   │   ├── automation/        # Workflows automatisés
│   │   ├── config/            # Configuration (supabase, env)
│   │   ├── core/              # Logique métier centrale (Halimah)
│   │   ├── jobs/              # Tâches planifiées (cron)
│   │   ├── middleware/        # Auth, tenant, rate limit
│   │   ├── modules/           # Modules métier (commerce, crm, hr...)
│   │   ├── routes/            # Endpoints API
│   │   ├── sentinel/          # Monitoring & sécurité
│   │   ├── services/          # Services partagés
│   │   ├── utils/             # Utilitaires
│   │   └── workers/           # Background workers
│   ├── scripts/               # Scripts utilitaires
│   ├── migrations/            # Migrations DB
│   └── tests/                 # Tests
│
├── frontend/
│   └── nexus-app/             # React + Vite + Tailwind
│       ├── src/
│       │   ├── components/    # Composants UI
│       │   ├── hooks/         # Hooks React
│       │   ├── lib/           # Utilitaires
│       │   └── pages/         # Pages
│
├── CLAUDE.md                  # Directives développeur (MOI)
├── SYSTEM.md                  # Ce fichier
└── TENANT_SHIELD.md           # Documentation sécurité tenant
```

---

## 🎯 TENANTS ACTIFS

| Tenant ID | Nom | Secteur | Plan | Status |
|-----------|-----|---------|------|--------|
| `fatshairafro` | Fat's Hair-Afro | Salon coiffure | Pro | ✅ Production |
| `decoevent` | DecoEvent | Événementiel | Starter | ✅ Production |
| `nexus-test` | Nexus Test | Test | Test | 🧪 Test |

---

## 🔐 SÉCURITÉ - TENANT SHIELD

### Couches de protection

| Couche | Fichier | Status |
|--------|---------|--------|
| Pre-commit Hook | `.husky/pre-commit` | ✅ Actif |
| Linter statique | `scripts/tenant-shield-lint.js` | ✅ Actif |
| CI/CD GitHub | `.github/workflows/tenant-shield.yml` | ✅ Actif |
| Middleware runtime | `middleware/tenantShield.js` | ✅ Actif |
| RLS Supabase | 33 policies sur 30 tables | ✅ Actif |

### Commandes

```bash
npm run lint:tenant    # Vérifier violations
npm run test:tenant    # Tests isolation
npm run shield         # Les deux
```

---

## 📡 API ENDPOINTS

### Public (avec X-Tenant-ID)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/services` | GET | Liste services tenant |
| `/api/reviews` | GET | Avis clients |
| `/api/disponibilites` | GET | Créneaux disponibles |
| `/api/chat` | POST | Chat Halimah |
| `/api/chat/stream` | POST | Chat streaming SSE |

### Système (sans tenant)

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/health` | GET | Health check |
| `/api/whatsapp/webhook` | POST | Webhook Twilio WhatsApp |
| `/api/twilio/voice` | POST | Webhook Twilio Voice |
| `/api/signup/plans` | GET | Plans disponibles |
| `/api/signup` | POST | Créer nouveau tenant |

### Admin (avec JWT)

| Préfixe | Description |
|---------|-------------|
| `/api/admin/auth/*` | Authentification admin |
| `/api/admin/clients/*` | Gestion clients |
| `/api/admin/reservations/*` | Gestion RDV |
| `/api/admin/services/*` | Gestion services |
| `/api/admin/stats/*` | Statistiques |
| `/api/sentinel/*` | Monitoring |

---

## 🗄️ BASE DE DONNÉES

### Tables principales

| Table | Description | RLS |
|-------|-------------|-----|
| `tenants` | Configuration tenants | ❌ Système |
| `services` | Services/prestations | ✅ |
| `clients` | Clients | ✅ |
| `reservations` | Rendez-vous | ✅ |
| `admin_users` | Utilisateurs admin | ✅ |
| `conversations` | Historique chat | ✅ |
| `halimah_memory` | Mémoire IA | ✅ |
| `factures` | Factures | ✅ |
| `plans` | Plans tarifaires | ❌ Système |

### Connexion

```
URL: https://mmivralzwcmriciprfbc.supabase.co
Database: PostgreSQL 15
```

---

## 🚀 DÉPLOIEMENT

### Services Render

| Service | Type | URL |
|---------|------|-----|
| `nexus-api` | Web Service | nexus-backend-dev.onrender.com |
| `fatshairafro-web` | Static Site | fatshairafro-web.onrender.com |
| `nexus-admin` | Static Site | nexus-admin.onrender.com |

### Variables d'environnement clés

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
STRIPE_SECRET_KEY
ELEVENLABS_API_KEY
```

### Déployer

```bash
# Via API Render
curl -X POST https://api.render.com/v1/services/{SERVICE_ID}/deploys \
  -H "Authorization: Bearer {RENDER_API_KEY}"
```

---

## 🤖 INTELLIGENCE ARTIFICIELLE

### Halimah (Assistant principal)

- **Modèle:** Claude (Anthropic)
- **Fichier:** `src/core/halimahAI.js`
- **Capacités:**
  - Réservation RDV
  - Réponse questions
  - Mémoire contextuelle
  - Streaming SSE

### Voix (TTS)

- **Provider:** ElevenLabs
- **Fichier:** `src/services/voiceService.js`
- **Usage:** Réponses téléphoniques

---

## 📞 TÉLÉPHONIE (Twilio)

### Numéros

| Numéro | Type | Tenant |
|--------|------|--------|
| +14155238886 | WhatsApp Sandbox | fatshairafro |
| +33939240269 | Voice FR | fatshairafro |

### Fichiers clés

| Fichier | Rôle |
|---------|------|
| `routes/whatsapp.js` | Webhook WhatsApp |
| `routes/twilioWebhooks.js` | Webhooks généraux |
| `services/whatsappService.js` | Logique WhatsApp |
| `services/voiceService.js` | Logique Voice |

---

## 💳 PAIEMENTS (Stripe)

### Fichiers

| Fichier | Rôle |
|---------|------|
| `routes/billing.js` | API facturation |
| `routes/payment.js` | Webhooks Stripe |
| `services/stripeBillingService.js` | Logique Stripe |

### Plans

| Plan | Prix/mois | Stripe Price ID |
|------|-----------|-----------------|
| Starter | 199€ | price_xxx |
| Pro | 399€ | price_xxx |
| Business | 799€ | price_xxx |

---

## 📊 MODULES MÉTIER

| Module | Dossier | Status |
|--------|---------|--------|
| Commerce | `modules/commerce/` | ✅ Actif |
| CRM | `modules/crm/` | ✅ Actif |
| Comptabilité | `modules/accounting/` | ✅ Actif |
| RH | `modules/hr/` | ✅ Actif |
| Marketing | `modules/marketing/` | ✅ Actif |
| SEO | `modules/seo/` | ✅ Actif |
| Social Media | `modules/social/` | ✅ Actif |
| Sentinel | `modules/sentinel-intelligence/` | ✅ Actif |

---

## 🔄 JOBS PLANIFIÉS

| Job | Fichier | Schedule |
|-----|---------|----------|
| Publish posts | `jobs/publishScheduledPosts.js` | Every 5 min |
| Relances factures | `jobs/relancesFacturesJob.js` | Daily |
| SEO tracking | `jobs/seoTracking.js` | Daily |
| Stock alertes | `jobs/stockAlertes.js` | Daily |

---

## ✅ CHECKLIST AVANT DÉPLOIEMENT

```
□ npm run lint:tenant (0 violations)
□ npm run test:tenant (tous les tests passent)
□ git status (pas de fichiers oubliés)
□ Variables d'environnement vérifiées
□ Pas de secrets en dur
□ Pas de console.log de debug
```

---

## 🐛 PROBLÈMES CONNUS

| Problème | Status | Solution |
|----------|--------|----------|
| - | - | - |

*(Aucun problème connu actuellement)*

---

## 📈 MÉTRIQUES

### Performance

| Endpoint | Temps moyen |
|----------|-------------|
| `/api/services` | < 100ms |
| `/api/chat` | < 2s |
| `/api/chat/stream` | < 500ms (TTFB) |

### Uptime

- Backend: 99.9%
- Frontend: 99.9%

---

## 📝 CHANGELOG RÉCENT

| Date | Changement |
|------|------------|
| 2026-02-21 | TENANT SHIELD v1.0 déployé |
| 2026-02-21 | RLS activé (33 policies) |
| 2026-02-21 | Fix signup route |
| 2026-02-21 | Fix chat widget X-Tenant-ID |

---

## 🔗 LIENS UTILES

- **Supabase Dashboard:** https://supabase.com/dashboard/project/mmivralzwcmriciprfbc
- **Render Dashboard:** https://dashboard.render.com
- **GitHub Repo:** https://github.com/issouftoure58-design/nexus
- **Twilio Console:** https://console.twilio.com
- **Stripe Dashboard:** https://dashboard.stripe.com

---

## 📞 CONTACTS

- **Projet:** NEXUS SaaS Platform
- **Owner:** issouftoure58-design

---

*Ce fichier est la source de vérité pour comprendre le système NEXUS.*
*À lire en premier à chaque nouvelle session.*
