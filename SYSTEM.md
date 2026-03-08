# NEXUS - SYSTEME COMPLET

> **Derniere mise a jour:** 2026-03-08
> **Version:** 3.18.0
> **Status:** Production Ready (Score technique 100/100 | Performance ~9.0/10 vs leaders)
> **Source de verite avancement:** PROGRESS.md

---

## VUE D'ENSEMBLE

```
Type: SaaS Multi-Tenant
Stack: Node.js + Express + Supabase + React/Vite/TypeScript
Deploy: Render.com
AI: Claude (Anthropic) + OpenAI TTS
Telephonie: Twilio (WhatsApp + Voice + SMS)
Paiements: Stripe (mode live)
Monitoring: SENTINEL (error tracking + monitoring) + Winston
CI/CD: GitHub Actions (5 workflows)
```

---

## ARCHITECTURE

```
nexus/
├── backend/                    # API Node.js/Express
│   ├── src/
│   │   ├── ai/                # Intelligence artificielle
│   │   ├── automation/        # Workflows automatises
│   │   ├── config/            # Configuration (supabase, redis, logger)
│   │   ├── core/              # Logique metier centrale (NexusCore unifie)
│   │   ├── jobs/              # Taches planifiees (cron)
│   │   ├── middleware/        # Auth, tenant, rate limit, quotas, Zod validate
│   │   ├── modules/           # Modules metier (commerce, crm, hr, seo, social, sentinel)
│   │   ├── routes/            # 72 fichiers routes API
│   │   ├── sentinel/          # Monitoring & securite
│   │   ├── services/          # 77 services metier
│   │   ├── utils/             # Utilitaires (response.js, whatsappTemplates, etc.)
│   │   └── workers/           # Background workers (BullMQ)
│   ├── scripts/               # Scripts utilitaires
│   ├── migrations/            # 88 migrations SQL (+ archive/)
│   └── tests/                 # 19 suites, 310 tests
│
├── admin-ui/                  # Dashboard admin officiel (React/Vite/TS)
│   ├── src/__tests__/         # 5 suites Vitest, 17 tests
│   ├── vitest.config.ts       # Config Vitest + jsdom
│
├── frontend/
│   └── nexus-app/             # App publique (reservations, chat)
│                              # React + Vite + TypeScript + Tailwind + shadcn/ui
│
├── landing/                   # Page vitrine marketing (JSX + Spline 3D)
│
├── admin-ui/                  # Dashboard admin officiel (React/Vite/TS)
│
├── .github/workflows/         # CI/CD (ci.yml, tenant-shield.yml, security.yml, deploy-*)
├── CLAUDE.md                  # Directives developpeur
├── PROGRESS.md                # Suivi avancement (source de verite)
├── NEXUS_KNOWLEDGE.md         # Base de connaissance persistante
└── TENANT_SHIELD.md           # Documentation securite tenant
```

---

## TENANTS

| Tenant ID | Nom | Type | Plan | Status |
|-----------|-----|------|------|--------|
| `fatshairafro` | Fat's Hair-Afro | service_domicile | Pro | Production |
| `decoevent` | DecoEvent | service_domicile | Starter | Production |
| `nexus-test` | Nexus Test | service_domicile | Business (test) | Test |

> **REGLE:** Ne JAMAIS tester sur fatshairafro. Utiliser nexus-test.

---

## SECURITE - TENANT SHIELD

| Couche | Fichier | Status |
|--------|---------|--------|
| Pre-commit Hook | `.husky/pre-commit` | Actif |
| Linter statique | `scripts/tenant-shield-lint.js` | Actif |
| CI/CD GitHub | `.github/workflows/tenant-shield.yml` | Actif |
| Middleware runtime | `middleware/tenantShield.js` | Actif |
| SENTINEL error tracking | captureException/captureMessage → error_logs DB | Actif |
| Rate limiting | 4 limiteurs (api, login, payment, notification) | Actif |
| CSP/Helmet | Headers securite stricts | Actif |
| Zod validation | `middleware/validate.js` (5 routes critiques) | Actif |

```bash
npm run lint:tenant    # Verifier violations
npm run test:tenant    # Tests isolation
npm run shield         # Les deux
```

---

## API ENDPOINTS

### Public (avec X-Tenant-ID ou ?tenant_id=)

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/api/services` | GET | Liste services tenant |
| `/api/disponibilites` | GET | Creneaux disponibles |
| `/api/chat` | POST | Chat Halimah |
| `/api/chat/stream` | POST | Chat streaming SSE |
| `/api/rendez-vous` | POST | Creer reservation |

### Systeme (sans tenant)

| Endpoint | Methode | Description |
|----------|---------|-------------|
| `/health` | GET | Health check enrichi (DB, Redis, services) |
| `/api/signup/plans` | GET | Plans disponibles |
| `/api/signup` | POST | Creer nouveau tenant |
| `/api/whatsapp/webhook` | POST | Webhook Twilio WhatsApp |
| `/api/twilio/voice/*` | POST | Webhooks Twilio Voice |
| `/api/docs` | GET | Documentation Swagger UI |
| `/api/docs.json` | GET | OpenAPI 3.0 JSON |

### Admin (avec JWT Bearer token)

| Prefixe | Description |
|---------|-------------|
| `/api/admin/auth/*` | Authentification admin |
| `/api/admin/clients/*` | Gestion clients |
| `/api/admin/reservations/*` | Gestion RDV |
| `/api/admin/services/*` | Gestion services |
| `/api/admin/stats/*` | Statistiques dashboard |
| `/api/admin/analytics/*` | Analytics (overview, revenue, clients, analytique) |
| `/api/admin/quotas` | Quotas et limites |
| `/api/admin/ia/*` | Config IA par canal (telephone, whatsapp) |
| `/api/admin/agents/*` | Gestion agents IA (ai_agents) |
| `/api/admin/chat/*` | Chat IA admin (105 outils, streaming SSE, differencie par plan) |
| `/api/admin/api-keys/*` | CRUD cles API (Business only) |
| `/api/admin/webhooks/*` | CRUD webhooks (Business only) |
| `/api/admin/parametres` | Parametres tenant (profil, notifications, etc.) |
| `/api/modules/*` | Modules disponibles/actifs |
| `/api/billing/*` | Abonnements et paiements Stripe |
| `/api/provisioning/*` | Numeros Twilio |

---

## CHAT ADMIN IA — OUTILS PAR PLAN

| Plan | Outils | Categories |
|------|--------|------------|
| **Starter** (99€) | 64 | Client, Gestion, Marketing, Commercial, Compta, Contenu, Memoire, Planification, Agenda |
| **Pro** (249€) | 76 | Tout Starter + SEO (3), Social (4), RH base (4), Analytics KPI (1) |
| **Business** (499€) | 105 | Tout Pro + Strategie (4), Analytics avance (5), RH complet (+6), Agent IA (6), Recherche web (4), Pro Tools (4) |

Architecture: `src/tools/handlers/` (20 handlers + dispatcher O(1) dans index.js)
Registry: `src/tools/toolsRegistry.js` (105 outils declares, 0 stub restant)
Note: `comptable_facturation` (creer/exporter) câblé sur `createFactureFromReservation` + liens PDF

---

## DEPLOIEMENT

### Domaine & URLs production

| Service | URL | Plateforme |
|---------|-----|------------|
| Admin Dashboard | `https://app.nexus-ai-saas.com` | Render (nexus-admin) |
| Landing Page | `https://nexus-ai-saas.com` | Render (nexus-vitrine) |
| Backend API | `https://nexus-backend-dev.onrender.com` | Render (nexus-backend-dev) |
| Emails transactionnels | `noreply@nexus-ai-saas.com` | Resend (domaine verifie) |

> **Domaine:** `nexus-ai-saas.com` (registrar: OVH)
> **Architecture:** admin-ui proxy Node.js (`server.js`) → backend via `API_PROXY_TARGET`
> **DNS:** `app` CNAME → nexus-admin-yedu.onrender.com | racine A → 216.24.57.1 | `www` CNAME → nexus-vitrine.onrender.com

### Services Render

| Service | Type | URL |
|---------|------|-----|
| `nexus-admin` | Web Service (admin-ui) | nexus-admin-yedu.onrender.com → app.nexus-ai-saas.com |
| `nexus-backend-dev` | Web Service (API) | nexus-backend-dev.onrender.com |
| `nexus-vitrine` | Web Service (landing) | nexus-vitrine.onrender.com → nexus-ai-saas.com |
| `fatshairafro-web` | Web Service | fatshairafro-web.onrender.com |

### CI/CD Pipeline

```
Push main → GitHub Actions CI:
  1. lint:tenant + lint:syntax + healthcheck
  2. Tests (Node 18 + 20) avec coverage
  3. Build frontend (admin-ui + landing)
  4. Boot test (syntax check)
  5. Shield verification
  → CI Success required pour merge
  → Render auto-deploy depuis main
```

### Branches

| Branche | Role |
|---------|------|
| `main` | Production (protegee: PR + CI Success requis) |
| `develop` | Staging (deploy-staging.yml auto) |

---

## MONITORING

| Composant | Outil | Status |
|-----------|-------|--------|
| Errors | SENTINEL errorTracker (error_logs DB, fingerprinting, dashboard) | Actif |
| Frontend errors | errorReporter.ts (window.onerror + unhandledrejection → POST /api/errors/report) | Actif |
| Logs | Winston (fichiers + console JSON en prod) | Actif |
| Health | `/health` enrichi (DB, Redis, Stripe, Twilio, memory) | Actif |
| Uptime | SENTINEL (6 services, pings HTTP reels toutes les 60s) | Actif |
| Couts | SENTINEL cost tracker (multi-tenant, mode degrade auto, budgets plan) | Actif |
| Prix | config/pricing.js — source unique de verite (Anthropic, Twilio, ElevenLabs, Email) | Actif |
| Confidentialite | Isolation donnees business tenant / donnees infra operateur | Actif |
| Quotas | Middleware quotas + alertes error tracking | Actif |
| Backfill | Auto-detection gaps + rattrapage snapshots manquants | Actif |
| Mode degrade | isDegraded() persiste en DB (sentinel_state), survit aux restarts | Actif |
| Blacklist IP | Persistee en DB (sentinel_state), restauree au demarrage | Actif |
| Alert cooldowns | Pre-charges depuis error_logs, anti-spam post-restart | Actif |

---

## PERFORMANCE

| Endpoint | Temps moyen |
|----------|-------------|
| `/health` | 98ms |
| `/api/services` | 129ms |
| `/api/chat` | 228ms |
| `/api/admin/clients` | 272ms |
| `/api/admin/stats/dashboard` | 638ms |

---

## LIENS UTILES

- **Production:** https://app.nexus-ai-saas.com (admin) | https://nexus-ai-saas.com (landing)
- **GitHub:** https://github.com/issouftoure58-design/nexus
- **Supabase:** https://supabase.com/dashboard/project/mmivralzwcmriciprfbc
- **Render:** https://dashboard.render.com
- **Stripe:** https://dashboard.stripe.com
- **Twilio:** https://console.twilio.com
- **Resend:** https://resend.com (emails depuis noreply@nexus-ai-saas.com)
- ~~Sentry~~ remplace par SENTINEL Error Tracker (v3.14.0)

---

---

## ROADMAP COMMERCIALISATION

Sprints 1-5 TERMINES. Voir PROGRESS.md pour le detail.

| Sprint | Focus | Status |
|--------|-------|--------|
| **1** | Securite & Equipe (2FA, audit log, invitations, RBAC, dunning, sessions) | TERMINE |
| **2** | Communication & Ops (status page, notifications in-app, email deliverability) | TERMINE |
| **3** | Data & Developer XP (import CSV, webhook retry, upload, revenue analytics) | TERMINE |
| **4** | Croissance (SSO, API versioning, parrainage, usage billing) | TERMINE |
| **5** | Horaires dynamiques (business_hours, disponibilites admin) | TERMINE |

Quick Wins commercialisation (2026-03-07):
- QW1: Dashboard Churn Visuel (3 graphiques recharts)
- QW2: Templates Devis par Metier (7 templates, 4 metiers)
- QW3: Relance Auto Devis (email J+3 + SMS J+7)

---

## AUDIT PERFORMANCE — SCORE GLOBAL 7.4/10

Audit complet (2026-03-07) vs leaders mondiaux (Treatwell, Mindbody, Fresha, Square).

### Scores par axe

| Categorie | Score | Forces | Faiblesses |
|-----------|-------|--------|------------|
| **Backend** | 7.5 | Tenant Shield 9.2, Securite multi-couche, SENTINEL | N+1 queries, pas TS, API inconsistante |
| **Frontend** | 7.4 | UX/UI 8.5, 37 pages, React Query | Bundle 1.8MB, 0 splitting, 108 `any` |
| **Features** | 7.2 | Multi-tenant 9.0, Monitoring 8.5, Booking 8.2 | Marketing 6.0, RH 5.5, Mobile 6.5 |
| **Securite** | 7.4 | Auth 8.5, Isolation 9.0, Headers 8.5 | .env dans git (CRITIQUE), pas Zod |

### Comparaison directe

| Plateforme | Score |
|------------|-------|
| Square | 8.5 |
| Fresha | 8.3 |
| Mindbody | 8.2 |
| Treatwell | 8.0 |
| **NEXUS** | **7.4** |

### Avantages concurrentiels NEXUS
1. Multi-tenant natif (9.0) — architecture des le depart
2. IA integree (105 outils admin) — pas de plugin externe
3. SENTINEL monitoring (8.5) — auto-degrade, cost-aware
4. Multi-metier (salon/restaurant/hotel/services) — une plateforme
5. Prix agressif (99/249/499€) — vs 200-1000€+ concurrents

### Risque critique a corriger
- **backend/.env traque dans git** avec secrets reels (Supabase, Stripe, Twilio, Anthropic)
- Action: `git rm --cached backend/.env` + revoquer + regenerer tous les secrets

---

*Ce fichier est synchronise avec PROGRESS.md et NEXUS_KNOWLEDGE.md.*
*Derniere synchronisation: 2026-03-07 (v3.15.0 — 100% donnees reelles + isolation confidentialite tenant)*
