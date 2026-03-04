# NEXUS - SYSTEME COMPLET

> **Derniere mise a jour:** 2026-03-04
> **Version:** 3.10.0
> **Status:** Production Ready (Score 100/100)
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
Monitoring: Sentry + Winston + SENTINEL
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
│   │   ├── config/            # Configuration (supabase, redis, sentry, logger)
│   │   ├── core/              # Logique metier centrale (NexusCore unifie)
│   │   ├── jobs/              # Taches planifiees (cron)
│   │   ├── middleware/        # Auth, tenant, rate limit, quotas
│   │   ├── modules/           # Modules metier (commerce, crm, hr, seo, social, sentinel)
│   │   ├── routes/            # 54 fichiers routes API
│   │   ├── sentinel/          # Monitoring & securite
│   │   ├── services/          # 69 services metier
│   │   ├── utils/             # Utilitaires
│   │   └── workers/           # Background workers (BullMQ)
│   ├── scripts/               # Scripts utilitaires
│   ├── migrations/            # 64 migrations SQL (+ archive/)
│   └── tests/                 # 19 suites, 310 tests
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
| Sentry monitoring | 12 points critiques (Stripe, Twilio, quotas) | Actif |
| Rate limiting | 4 limiteurs (api, login, payment, notification) | Actif |
| CSP/Helmet | Headers securite stricts | Actif |

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
Registry: `src/tools/toolsRegistry.js` (105 outils declares, 0 non implemente)

---

## DEPLOIEMENT

### Services Render

| Service | Type | URL |
|---------|------|-----|
| `nexus-backend-dev` | Web Service | nexus-backend-dev.onrender.com |
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
| Errors | Sentry (12 points critiques) | Actif |
| Logs | Winston (fichiers + console JSON en prod) | Actif |
| Health | `/health` enrichi (DB, Redis, Stripe, Twilio, memory) | Actif |
| Uptime | SENTINEL (6 services, checks toutes les 5 min) | Actif |
| Couts | SENTINEL cost tracker (multi-tenant) | Actif |
| Quotas | Middleware quotas + alertes Sentry | Actif |

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

- **GitHub:** https://github.com/issouftoure58-design/nexus
- **Supabase:** https://supabase.com/dashboard/project/mmivralzwcmriciprfbc
- **Render:** https://dashboard.render.com
- **Stripe:** https://dashboard.stripe.com
- **Twilio:** https://console.twilio.com
- **Sentry:** https://sentry.io

---

---

## ROADMAP COMMERCIALISATION

Audit SaaS B2B (2026-03-03) — 4 sprints identifies. Voir PROGRESS.md pour le detail.

| Sprint | Focus | Items | Effort estime |
|--------|-------|-------|---------------|
| **1** | Securite & Equipe | 2FA, audit log, invitations, RBAC, dunning, sessions | ~8j |
| **2** | Communication & Ops | Status page, i18n, notifications in-app, email auth | ~6j |
| **3** | Data & Developer XP | Import CSV, webhook retry, rate limit headers, proration, upload, revenue analytics | ~10j |
| **4** | Croissance | SSO, API versioning, parrainage, usage billing | post-launch |

Migration DB 055 requise : `audit_logs`, `user_sessions`, `invitations`, `notifications_inbox`, `totp_secrets`

---

*Ce fichier est synchronise avec PROGRESS.md et NEXUS_KNOWLEDGE.md.*
*Derniere synchronisation: 2026-03-03 (v3.9.0 — audit SaaS B2B)*
