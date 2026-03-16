# NEXUS - SYSTEME COMPLET

> **Derniere mise a jour:** 2026-03-16
> **Version:** 3.24.0
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
│   │   ├── services/          # 78 services metier
│   │   ├── utils/             # Utilitaires (response.js, whatsappTemplates, etc.)
│   │   └── workers/           # Background workers (BullMQ)
│   ├── scripts/               # Scripts utilitaires
│   ├── migrations/            # 88 migrations SQL (+ archive/)
│   └── tests/                 # 21 suites, 370 tests
│
├── admin-ui/                  # Dashboard admin officiel (React/Vite/TS)
│   ├── src/__tests__/         # 9 suites Vitest, 56 tests
│   ├── src/test/              # Helpers test (utils.tsx, setup.ts)
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
| `fatshairafro` | Fat's Hair-Afro | service_domicile | Business | Production |
| `nexus-test` | Salon Elegance Paris | salon | Business | Test |
| `test-security` | Atlas Securite | security | Business | Test |
| `test-consulting` | Clara Conseil | salon | Business | Test |
| `test-events` | Emma Events | salon | Business | Test |
| `test-hospitality` | Quick Burger Express | commerce | Business | Test |

### Business Types (6)
| # | ID | Label | Exemples |
|---|-----|-------|----------|
| 1 | `service_domicile` | Service a domicile | Coiffeur a domicile, plombier, coach |
| 2 | `salon` | Salon / Institut | Coiffure, barbier, spa, onglerie |
| 3 | `restaurant` | Restaurant / Bar | Restaurant, brasserie, pizzeria |
| 4 | `hotel` | Hotel / Hebergement | Hotel, gite, chambre d'hotes |
| 5 | `commerce` | Commerce / Restauration rapide | Fast-food, boulangerie, epicerie, food truck |
| 6 | `security` | Securite / Mise a disposition | Securite privee, interim, gardiennage |

### UI par Business Type (admin-ui)
- **ProfileContext.tsx** utilise `api.request('/admin/profile')` pour charger le profil metier
- `isBusinessType('commerce')` / `isBusinessType('security')` conditionnent les modals
- **Services.tsx**: Commerce = Prix+TVA+Categorie | Security = PricingFields+TVA+CNAPS | Salon = Duree+Prix+CNAPS
- **Activites.tsx**: Commerce → redirige vers /commandes | Security → "Nouvelle mission" | Autres → "Nouveau rdv"
- Config backend: `backend/src/config/businessTypes.js` + `backend/src/services/tenantBusinessService.js`
- **Terminologie dynamique** (v3.24.0): TOUS les modules admin-ui utilisent `t()` de ProfileContext — Waitlist, Workflows, CRMSegments, Equipe, Clients, Dashboard adaptent labels par business type
- **`api.getPaginated<T>()`** (v3.24.0): normalise reponses backend `paginated()` en `{ items: T[], pagination }` — evite mismatch de noms de champs

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
| Rate limiting | 6 limiteurs (api, login, payment, notification, signup, check) | Actif |
| Trial enforcement | `enforceTrialLimit` sur routes critiques (reservations, clients, chat, emails, sms) | Actif |
| Anti-fraude signup | Unicite email + telephone + SIRET, signupLimiter 3/h/IP | Actif |
| Plan isolation | `config/planFeatures.js` source unique de verite, `requireModule()` sur toutes les routes | Actif |
| Module protection | 7 routes admin securisees (compta, stock, devis, pipeline, RH, SEO, analytics) | Actif |
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
| `/api/admin/commerce/orders/*` | Gestion commandes commerce (CRUD, statuts) |
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

## CHAT ADMIN IA — OUTILS PAR PLAN ET METIER

| Plan | Outils | Categories |
|------|--------|------------|
| **Starter** (99€) | 64 | Client, Gestion, Marketing, Commercial, Compta, Contenu, Memoire, Planification, Agenda |
| **Pro** (249€) | 76 | Tout Starter + SEO (3), Social (4), RH base (4), Analytics KPI (1) |
| **Business** (499€) | 105 | Tout Pro + Strategie (4), Analytics avance (5), RH complet (+6), Agent IA (6), Recherche web (4), Pro Tools (4) |

**Filtrage par metier** (v3.21.0) : les outils specifiques a un metier ne sont envoyes qu'aux tenants concernes.

| Metier | Outils exclusifs | Exclus de |
|--------|-----------------|-----------|
| Restaurant | get_restaurant_info, get_menu, get_menu_du_jour, check_allergenes, check_table_availability | Salon, Hotel, Domicile |
| Hotel | get_hotel_info, get_chambres_disponibles, check_room_availability | Salon, Restaurant, Domicile |
| Domicile | calculate_travel_fee | Salon, Restaurant, Hotel |
| Salon | aucun exclusif | — |

### IA Client (Reservation) — Architecture 2 Couches (v3.23.0)

**Moteur dynamique** : `templates/promptEngine.js` genere le system prompt pour TOUS les tenants (plus de prompt hardcode).

| Couche | Fichier(s) | Contenu |
|--------|-----------|---------|
| **Noyau general** | `promptEngine.js` (builders) | 5 regles universelles (anti-hallucination, dates, booking process, annulation, canal) |
| **Adaptateur metier** | `templates/businessTypePrompts/*.js` (6 fichiers) | Regles specifiques par business type (terminologie, outils, processus) |
| **Reconnaissance client** | `services/clientRecognition.js` | Lookup telephone → client existant + historique RDV → accueil personnalise |

**Regles noyau** (presentes dans TOUS les prompts) :
- REGLE #0 : JAMAIS confirmer sans create_booking + success=true
- REGLE #1 : Anti-placeholder (jamais de donnees fictives)
- REGLE #2 : Collecter TOUTES les infos avant reservation
- REGLE #3 : Garder le contexte (service demande)
- REGLE #4 : Gestion confirmations (oui/non)

**Filtrage outils IA client** (v3.23.0) : `getToolsForPlanAndBusiness(plan, businessType)` filtre les outils par metier dans nexusCore.js (plus de tools irrelevants envoyes a l'API).

| Metier | Outils exclusifs client |
|--------|------------------------|
| Restaurant | check_table_availability, get_restaurant_info, get_menu, get_menu_du_jour, check_allergenes |
| Hotel | get_hotel_info, get_chambres_disponibles, check_room_availability |
| Domicile | calculate_travel_fee |
| Salon / Commerce / Security | outils generiques uniquement |

**Validation** : `scripts/validate-ia-prompts.mjs` — 142 assertions (6 business types, tool filtering, client recognition, regression fatshairafro, canaux phone/whatsapp).

**System prompt admin adapte** : terminologie metier (`BUSINESS_TYPES`), actions principales (`BUSINESS_CONTEXTS` dans `businessTypePrompts/index.js`), instructions comportementales specifiques, fonctionnalites du plan (incluses/verouillees).

## PLAN D'ESSAI (TRIAL)

| Parametre | Valeur |
|-----------|--------|
| Duree | 14 jours (calcule serveur, non modifiable client) |
| Plan | Starter (64 outils IA admin) |
| Canal IA client | Web Chat uniquement (WhatsApp/Tel bloques par quota=0) |

**Limites trial** (enforceTrialLimit middleware) :

| Ressource | Limite | Route protegee |
|-----------|--------|----------------|
| Interactions IA (admin chat) | 50 | /api/admin/chat/conversations/*/messages |
| Reservations | 10 | /api/admin/reservations |
| Clients | 50 | /api/admin/clients |
| SMS | 20 | /api/admin/rfm/segments/*/campaign |
| Emails marketing | 100 | /api/marketing/campagnes/*/start |

**Anti-fraude trial** :
- `signupLimiter` : 3 inscriptions/heure par IP
- `checkLimiter` : 10 verifications/min par IP (check-email, check-company)
- Unicite telephone et SIRET a l'inscription
- Pas de double trial Stripe (verifie `essai_fin` en DB avant d'accorder trial_period_days)

Architecture: `src/tools/handlers/` (20 handlers + dispatcher O(1) dans index.js)
Registry: `src/tools/toolsRegistry.js` (105 outils declares, 0 stub restant)
Client tools: 20 outils (12 generiques + 1 check_table_availability + 4 restaurant info/menu + 3 hotel chambres/dispo)
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
  2. Tests backend (Node 18 + 20) avec coverage
  3. Tests admin-ui (Vitest)
  4. Build frontend (admin-ui + landing)
  5. Boot test (syntax check)
  6. Shield verification
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

### Sprint 6 — Multi-Business Restaurant/Hotel [TERMINE]
- Terminologie dynamique dans tous les formulaires/modales (useProfile)
- Migration 076: colonnes restaurant/hotel sur services + business_hours multi-periodes + waitlist
- Profil business: fallback BUSINESS_TYPES quand pas en DB
- Restaurant: capacite/table management IA (restaurantAvailability.js)
- Hotel: colonnes chambre (capacite_max, etage, vue, type_chambre, equipements)
- Comptabilite: Facturation (Starter) separee, onglets consolides (Rapprochement, Auxiliaires, Expert)

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
4. Multi-metier (6 types: salon/restaurant/hotel/commerce/security/domicile) — une plateforme
5. Prix agressif (99/249/499€) — vs 200-1000€+ concurrents

### Risque critique a corriger
- **backend/.env traque dans git** avec secrets reels (Supabase, Stripe, Twilio, Anthropic)
- Action: `git rm --cached backend/.env` + revoquer + regenerer tous les secrets

---

*Ce fichier est synchronise avec PROGRESS.md et NEXUS_KNOWLEDGE.md.*
*Derniere synchronisation: 2026-03-16 (v3.24.0 — Business type adaptation globale, getPaginated API, audit hardening 3 sprints)*
