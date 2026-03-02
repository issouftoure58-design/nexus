# NEXUS/SENTINEL - Base de Connaissance Persistante

> **FICHIER CRITIQUE** - Ce document est la mémoire persistante du projet.
> Il doit être lu au début de chaque session et mis à jour après chaque modification significative.
> C'est le SEUL fichier de documentation chronique - aucun autre ne sera créé.

**Derniere mise a jour:** 2026-03-02
**Version:** 3.4.0 (WhatsApp dedie par tenant + Stabilisation prod)

---

## TABLE DES MATIERES

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Modules fonctionnels](#3-modules-fonctionnels)
4. [SENTINEL - Systeme de monitoring](#4-sentinel---systeme-de-monitoring)
5. [Base de donnees](#5-base-de-donnees)
6. [API Routes](#6-api-routes)
7. [Integrations externes](#7-integrations-externes)
8. [Strategie Tarifaire](#8-strategie-tarifaire)
9. [Configuration Stripe](#9-configuration-stripe)
10. [Notifications Email](#10-notifications-email)
11. [Optimisations Couts](#11-optimisations-couts)
12. [Securite](#12-securite)
13. [Performance](#13-performance)
14. [Deploiement](#14-deploiement)
15. [Nouvelles fonctionnalites (v3.0)](#15-nouvelles-fonctionnalites-v30)
16. [Travaux en cours](#16-travaux-en-cours)
17. [Historique des modifications](#17-historique-des-modifications)
18. [Problemes connus](#18-problemes-connus)
19. [Regles de developpement](#19-regles-de-developpement)

---

## 1. VUE D'ENSEMBLE

### Qu'est-ce que NEXUS?

**NEXUS** est une plateforme SaaS multi-tenant universelle permettant aux PME de:
- **Automatiser** leur gestion (reservations, factures, stock, RH)
- **Vendre** en ligne (site vitrine, e-commerce)
- **Communiquer** 24/7 (chatbot IA "Halimah", WhatsApp, telephone avec voix naturelle)
- **Analyser** leurs donnees (CRM, RFM, previsions, segments)
- **Monetiser** (paiements Stripe integres)

### Qu'est-ce que SENTINEL?

**SENTINEL** est le gardien de la plateforme:
- Monitoring 24/7 (sante, couts, securite)
- Detection anomalies + auto-repair
- Protection contre injections prompt, DDoS, brute force
- Isolation tenant absolue (TENANT SHIELD)
- Alertes temps reel (Slack, Email, SMS)

### Chiffres cles

| Metrique | Valeur |
|----------|--------|
| Routes API | 53 (10 orphelines supprimees) |
| Services metier | 68 |
| Modules disponibles | 21 |
| Plans tarifaires | 3 (Starter/Pro/Business) |
| Tenants actifs | 3 |
| Migrations SQL | 52 (+ archive) |
| Tests | 19 suites, 310 tests |
| Score qualite | 100/100 |
| **Types de business** | **4** |

### Types de Business Supportes

| Type | Description | Features Specifiques |
|------|-------------|---------------------|
| `service_domicile` | Services a domicile (coiffure, menage, etc.) | travelFees, clientAddress |
| `salon` | Etablissement avec lieu fixe | multiStaff, pas de frais deplacement |
| `restaurant` | Restauration | tableManagement, couverts |
| `hotel` | Hotellerie | roomManagement, checkInOut, extras |

### Tenants en production

| ID | Nom | Type Business | Plan |
|----|-----|---------------|------|
| `fatshairafro` | Fat's Hair-Afro | service_domicile | Pro |
| `decoevent` | DecoEvent | service_domicile | Starter |
| `nexus-test` | Nexus Test | service_domicile | Test |

> **Note historique:** Fat's Hair-Afro est le PREMIER tenant. Les noms internes (halimahAI.js, halimahWorker.js) sont historiques - chaque tenant peut nommer son IA.

### Informations Legales Editeur (Source: Guichet Unique - Document officiel)

| Champ | Valeur |
|-------|--------|
| **Nom commercial** | Nexus.AI |
| **Dirigeant** | Issouf Toure |
| **Forme juridique** | Entrepreneur individuel (Micro-entreprise) |
| **SIREN** | 947 570 362 |
| **SIRET** | 947 570 362 00022 |
| **Code APE** | 5829C — Edition de logiciels applicatifs |
| **Adresse** | 8 rue des Monts Rouges, 95130 Franconville, France |
| **Telephone** | +33 7 60 53 76 94 |
| **Email** | issouftoure58@gmail.com |
| **Regime fiscal** | Micro-BIC |
| **TVA** | Franchise en base (art. 293 B CGI) — TVA non applicable |
| **Versement microsocial** | Mensuel |
| **Date debut activite** | 01/01/2026 |
| **Date immatriculation RNE** | 20/02/2026 |
| **Activite** | Edition et commercialisation de logiciels de gestion d'entreprise en mode SaaS |
| **Mediateur** | CM2C — 14 rue Saint Jean, 75017 Paris — www.cm2c.net |
| **Hebergeur** | Render Services, Inc. — 525 Brannan Street, Suite 300, San Francisco, CA 94107, USA |
| **Base de donnees** | Supabase, Inc. — https://supabase.com |
| **WhatsApp Business** | WABA approuve — BU ID: `BU8ba014fffcd728c583a66eb0d64f75cd` (France Mobile Business) |
| **Bundle FR National** | `BUfa2683ddd0dd5e4717f43601862148c1` — APPROUVE (numeros 09) |
| **Bundle FR Mobile** | `BUcf845ba9e91257dda88a4d493ea91966` — APPROUVE (numeros 06/07) |

### Pages legales (vitrine)

| Page | Route | Fichier |
|------|-------|---------|
| Mentions Legales | `/mentions-legales` | `nexus-vitrine/src/pages/MentionsLegales.tsx` |
| CGV | `/cgv` | `nexus-vitrine/src/pages/CGV.tsx` |
| Politique de Confidentialite | `/confidentialite` | `nexus-vitrine/src/pages/Confidentialite.tsx` |

### Mentions legales sur les documents PDF

Le `pdfService.js` genere automatiquement les mentions legales dans le footer de chaque document PDF :
- **SIRET** : lu depuis `tenant.settings.siret`
- **TVA** : si `tenant.settings.tax_status === 'franchise_base'` → "TVA non applicable, article 293 B du CGI"
- **TVA intra** : si `tenant.settings.numero_tva` → affiche le numero TVA intracommunautaire
- **Adresse** : lu depuis `tenant.adresse`

> Pour configurer un tenant : mettre `siret`, `tax_status` (valeurs: `franchise_base`, `assujetti`) et optionnellement `numero_tva` dans le champ `settings` JSONB de la table `tenants`.

---

## 2. ARCHITECTURE TECHNIQUE

### Stack technologique

```
BACKEND
├── Node.js + Express
├── TypeScript (migrations recentes)
├── Supabase (PostgreSQL 15)
├── Redis + Bull MQ (job queues)
└── Drizzle ORM + Zod

FRONTEND
├── React 18 + Vite
├── Tailwind CSS
├── TypeScript
└── TanStack Query

IA & EXTERNAL
├── Anthropic Claude (IA principale)
├── ElevenLabs (Text-to-Speech)
├── Twilio (SMS, WhatsApp, Voice)
├── Stripe (Paiements)
└── Google Maps API
```

### Structure des dossiers

```
nexus/
├── backend/
│   └── src/
│       ├── routes/        # 70+ routes API
│       ├── services/      # 63 services metier
│       │   └── tenantBusinessService.js  # ✨ Service central multi-business
│       ├── middleware/    # Auth, rate limiting, tenant shield
│       ├── sentinel/      # Monitoring, securite, alertes
│       ├── modules/       # Modules metier (commerce, CRM, RH...)
│       ├── jobs/          # Taches planifiees
│       ├── workers/       # Background workers
│       ├── config/        # Configurations
│       │   ├── businessTypes.js           # ✨ Config 4 types de business
│       │   └── tenants/fatshairafro.js   # Config tenant specifique
│       ├── templates/     # ✨ Templates par type de business
│       │   ├── service_domicile.template.js
│       │   ├── salon.template.js
│       │   ├── restaurant.template.js
│       │   └── hotel.template.js
│       ├── prompts/       # Prompts IA dynamiques
│       │   ├── systemPrompt.js   # ✨ Generateur multi-business
│       │   └── voicePrompt.js    # Prompts vocaux
│       ├── core/          # Logique metier centrale
│       ├── ai/            # Intelligence artificielle
│       ├── sql/           # Migrations et schemas
│       └── migrations/    # SQL migrations
├── frontend/
│   └── nexus-app/         # App admin + public (66 pages, 168 composants)
├── landing/               # Page vitrine marketing (JSX + Spline 3D)
├── _archive_admin-ui/     # Ancien dashboard (archive, ne plus utiliser)
├── CLAUDE.md              # Regles de dev (LIRE EN PREMIER)
├── PROGRESS.md            # Suivi avancement (source de verite)
└── NEXUS_KNOWLEDGE.md     # CE FICHIER
```

### Base de donnees

**URL Supabase:** `https://mmivralzwcmriciprfbc.supabase.co`

**Tables principales (avec tenant_id):**
- `tenants` - Configuration des tenants
- `clients` - Clients du tenant
- `reservations` - Rendez-vous
- `services` - Services/prestations
- `admin_users` - Utilisateurs administrateurs
- `conversations` - Historique chat IA
- `halimah_memory` - Memoire/contexte IA
- `factures` - Factures
- `segments_clients` - Segmentation CRM

**Tables systeme (sans tenant_id):**
- `plans` - Plans tarifaires
- `tenant_phone_numbers` - Mapping telephone -> tenant

---

## 3. MODULES FONCTIONNELS

### Modules disponibles

```
SOCLE (obligatoire - 49EUR/mois)
├── Dashboard admin
├── Gestion clients
├── Notifications SMS
└── Support email

CANAUX CLIENTS
├── agent_ia_web (25EUR) - Chatbot 24/7
├── whatsapp (35EUR) - WhatsApp Business IA
└── telephone (45EUR) - Appels avec voix IA

OUTILS BUSINESS
├── reservations (20EUR) - Agenda & RDV
├── site_vitrine (15EUR) - Site web
├── paiements (29EUR) - Stripe integre
└── ecommerce (39EUR) - Boutique en ligne

MODULES METIER
├── module_metier_salon (15EUR)
├── module_metier_resto (15EUR)
└── module_metier_medical (25EUR)

MODULES AVANCES
├── rh_avance (35EUR)
├── comptabilite (25EUR)
├── marketing (29EUR)
├── seo (40EUR)
└── sentinel_pro (20EUR)
```

### Services principaux (63 fichiers)

**Multi-Tenant Multi-Business:** ✨ NOUVEAU
- `tenantBusinessService.js` - **Service central** (getBusinessInfo, hasFeature, getTerminology)
- `config/businessTypes.js` - Configuration des 4 types de business
- `templates/*.template.js` - Templates par type (service_domicile, salon, restaurant, hotel)
- `prompts/systemPrompt.js` - Generateur prompts IA dynamiques

**IA et Automation:**
- `adminChatService.js` - Chat admin avec Claude
- `halimahProService.js` - Service IA Halimah (18 fonctions)
- `voiceAIService.js` - IA vocale (messages dynamiques via tenantBusinessService)
- `halimahMemory.js` - Memoire persistante IA

**Metier:**
- `bookingService.js` - Reservations (utilise tenantBusinessService)
- `crmService.js` - CRM avance
- `comptaService.js` - Comptabilite
- `rfmService.js` - Analyse RFM

**Commerce:**
- `orderService.js` - Commandes
- `productService.js` - Catalogue
- `stockService.js` - Stock

**Notifications:**
- `notificationService.js`
- `emailService.js`
- `whatsappService.js` (URLs dynamiques via tenantBusinessService)
- `voiceService.js` (phrases TTS multi-tenant)

**Paiements:**
- `paymentService.js` - Multi-provider (Stripe, PayPal)
- `stripeBillingService.js` - Facturation

---

## 4. SENTINEL - SYSTEME DE MONITORING

### Architecture SENTINEL

```
SENTINEL = 5 modules principaux

1. HEALTH MONITOR
   ├── Uptime serveur
   ├── Memoire (heapUsed, rss)
   ├── CPU usage
   ├── Connexions DB (latency check)
   └── APIs externes (Claude, Twilio, Stripe)

2. COSTS MONITOR (Multi-tenant)
   ├── Claude tokens
   ├── ElevenLabs caracteres
   ├── Twilio SMS/Voice
   ├── Stripe fees
   └── Google Maps requests

3. SECURITY SHIELD
   ├── Detection prompt injection
   ├── Rate limiting (20/min, 200/h, 1000/day)
   ├── IP blacklist/whitelist
   ├── DDoS pattern detection
   └── Blocage brute force

4. BACKUP & PERSISTENCE
   ├── Sauvegardes automatiques par tenant
   ├── Persistence usage
   └── Archivage logs

5. MONITORING & REPORTING
   ├── Collecte metriques 30sec
   ├── Anomaly detection
   ├── Auto-repair attempts
   └── Alertes Slack/Email/SMS
```

### Seuils d'alerte (thresholds.js)

| Metrique | Warning | Critical | Shutdown |
|----------|---------|----------|----------|
| Couts/jour | 30EUR | 50EUR | 100EUR |
| Couts/mois | 500EUR | 800EUR | 1000EUR |
| Memoire | 75% | 90% | - |
| DB Latency | 1000ms | 2000ms | - |

### Fichiers SENTINEL cles

| Fichier | Role |
|---------|------|
| `sentinel/core/sentinel.js` | Moteur principal |
| `monitors/healthMonitor.js` | Sante serveur |
| `monitors/costMonitor.js` | Couts par tenant |
| `monitors/tenantCostTracker.js` | Usage API par tenant |
| `security/securityShield.js` | Protection securite |
| `security/accountService.js` | Gestion comptes |
| `backup/backupService.js` | Sauvegardes |
| `persistence.js` | Stockage alertes |

---

## 5. BASE DE DONNEES

### Index critiques (performance)

```sql
idx_reservations_tenant (tenant_id)
idx_reservations_tenant_date (tenant_id, date)
idx_reservations_tenant_statut (tenant_id, statut)
idx_memory_tenant (tenant_id)
idx_clients_ca_total (tenant_id, ca_total)
idx_clients_score (tenant_id, score_engagement)
idx_segments_tenant (tenant_id)
```

### Migrations recentes

| # | Fichier | Description |
|---|---------|-------------|
| 037 | `factures_reference_paiement.sql` | Ref paiement factures |
| 036 | `devis_lignes_heures.sql` | Heures sur lignes devis |
| 035 | `reservation_lignes_heures.sql` | Heures reservations |
| 034 | `clients_adresse.sql` | Adresse clients |
| 033 | `fix_devis_reservation_id.sql` | Fix FK devis |
| 032 | `business_profiles.sql` | Profils business |

### RLS (Row Level Security)

- **33 policies** sur **30 tables**
- Chaque table avec tenant_id a une policy RLS
- Double protection: code + database

---

## 6. API ROUTES

### Routes publiques (sans auth)

| Route | Methode | Description |
|-------|---------|-------------|
| `/api/services` | GET | Liste services |
| `/api/disponibilites` | GET | Creneaux libres |
| `/api/chat` | POST | Chat avec IA |
| `/api/chat/stream` | POST | Chat streaming |
| `/api/rendez-vous` | POST | Creer RDV |
| `/api/reviews` | GET | Avis clients |

### Routes systeme

| Route | Methode | Description |
|-------|---------|-------------|
| `/health` | GET | Health check |
| `/api/whatsapp/webhook` | POST | Webhook Twilio |
| `/api/twilio/voice` | POST | Webhook voice |
| `/api/signup` | POST | Creer tenant |
| `/api/payment/webhook` | POST | Webhook Stripe |

### Routes admin (JWT requis)

**Prefixe:** `/api/admin/`

- `auth/` - Login, logout, change password
- `clients/` - CRUD clients + notes + stats
- `reservations/` - CRUD RDV
- `services/` - CRUD services
- `stats/` - Dashboard, revenue, forecast
- `chat/` - Conversations admin
- `modules/` - Gestion modules
- `crm/` - CRM avance
- `stock/` - Gestion stock
- `seo/` - SEO tools
- `rh/` - Ressources humaines
- `marketing/` - Campaigns
- `comptabilite/` - Compta
- `factures/` - Facturation
- `sentinel/` - Monitoring

---

## 7. INTEGRATIONS EXTERNES

### Anthropic Claude

```
Usage: IA conversationnelle (Halimah)
Modele: claude-sonnet-4-20250514
Couts: Input $3/1M, Output $15/1M tokens

Fichiers:
- adminChatService.js
- voiceAIService.js
- halimahProService.js
- sentinelInsights.js
```

### Twilio / WhatsApp Business

```
Usage: SMS, WhatsApp, Voice
Numeros:
- Voice FR: +33939240269

WhatsApp Business API:
- WABA approuve: NEXUS.AI (France Mobile - Business)
- Business Unit ID: BU8ba014fffcd728c583a66eb0d64f75cd
- Statut: Approved ✅

Couts:
- SMS outbound: $0.05
- SMS inbound: $0.01
- Voice: $0.02/min
```

### Stripe

```
Usage: Paiements et facturation
Webhooks:
- payment_intent.succeeded
- customer.subscription.updated
- invoice.payment_succeeded

Couts: 2.9% + $0.30/transaction
```

### ElevenLabs

```
Usage: Text-to-Speech
Couts: ~$30 par 1M caracteres
```

### Autres

- **Google Maps** - Geolocalisation ($5/1000 requests)
- **Resend** - Emails transactionnels
- **OpenAI** - Alternative TTS

---

## 8. STRATEGIE TARIFAIRE

**Statut:** Validee | **Date:** 2026-03-02 (migration 041 + 051)

### 8.1 Plans Fixes Mensuels

| Plan | Prix/mois | Cible |
|------|-----------|-------|
| **Starter** | 99€ | Independants, TPE |
| **Pro** | 249€ | PME, equipes 2-10 |
| **Business** | 499€ | ETI, multi-sites |

### 8.2 Engagement Annuel (-20%)

| Plan | Prix/mois | Prix/an |
|------|-----------|---------|
| Starter | ~79€ | 950€ |
| Pro | ~199€ | 2 390€ |
| Business | ~399€ | 4 790€ |

> Note: prix annuels = prix mensuel x 10 mois (2 mois offerts, -17%)

### 8.3 Plan Starter (99€/mois)

**Cible:** Salon solo, petit restaurant, service a domicile debutant

| Module | Inclus | Limites |
|--------|--------|---------|
| CRM | ✅ | 1 000 clients max |
| Reservations | ✅ | Illimite |
| Agenda | ✅ | 1 utilisateur |
| Facturation | ✅ | Illimite |
| SMS | ✅ | 200 SMS/mois inclus |
| Email | ✅ | Illimite |
| Site Vitrine | ✅ | - |
| IA Assistant Web | ✅ | Inclus |
| IA Voix | ❌ | - |
| WhatsApp | ❌ | - |
| Marketing | ❌ | - |
| Rapports | ✅ | Basiques |
| API | ❌ | - |
| Support | Email 48h | - |

### 8.4 Plan Pro (249€/mois)

**Cible:** Salon avec equipe, restaurant etabli, entreprise de services

| Module | Inclus | Limites |
|--------|--------|---------|
| CRM | ✅ | 5 000 clients max |
| Reservations | ✅ | Illimite |
| Agenda | ✅ | 5 utilisateurs |
| Facturation | ✅ | Illimite |
| SMS | ✅ | 500 SMS/mois inclus |
| Email | ✅ | Illimite |
| Site Vitrine | ✅ | - |
| IA Assistant Web | ✅ | Inclus |
| IA Voix | ✅ | 60 min/mois inclus |
| WhatsApp | ✅ | Inclus |
| Telephone IA | ✅ | Inclus |
| Comptabilite | ✅ | - |
| CRM Avance | ✅ | Pipeline + Campagnes |
| Marketing | ✅ | Pipeline + Campagnes |
| Stock | ✅ | - |
| Analytics | ✅ | Avances |
| Devis | ✅ | - |
| API | ✅ | 10 000 appels/mois |
| Support | Chat 24h | - |

### 8.5 Plan Business (499€/mois)

**Cible:** Chaines, franchises, multi-sites

| Module | Inclus | Limites |
|--------|--------|---------|
| Tout Pro | ✅ | Illimite |
| Utilisateurs | ✅ | 20 utilisateurs |
| SMS | ✅ | 2 000 SMS/mois inclus |
| IA Voix | ✅ | 300 min/mois inclus |
| RH | ✅ | Complet |
| SEO | ✅ | Dashboard + Articles |
| Sentinel | ✅ | Business Intelligence |
| API | ✅ | Illimite |
| Multi-sites | ✅ | Jusqu'a 10 sites |
| Marque blanche | ✅ | Logo + couleurs |
| Support | Prioritaire 4h, tel | - |

### 8.6 Add-ons

**Packs SMS:**
| Pack | Prix | Prix/SMS |
|------|------|----------|
| 100 SMS | 15€ | 0.15€ |
| 500 SMS | 65€ | 0.13€ |
| 1 000 SMS | 110€ | 0.11€ |
| 5 000 SMS | 450€ | 0.09€ |

**Packs IA Voix:**
| Pack | Prix | Prix/min |
|------|------|----------|
| 30 min | 15€ | 0.50€ |
| 60 min | 25€ | 0.42€ |
| 120 min | 45€ | 0.38€ |
| 300 min | 99€ | 0.33€ |

**Modules Specialises:**
| Module | Prix/mois |
|--------|-----------|
| Restaurant Pro | +39€ |
| Hotel Pro | +69€ |
| Domicile Pro | +29€ |

**Utilisateurs Supplementaires:**
| Plan | Inclus | Extra |
|------|--------|-------|
| Starter | 1 | +19€/user |
| Pro | 5 | +15€/user |
| Business | 20 | +12€/user |

### 8.7 Periode d'Essai

| Parametre | Valeur |
|-----------|--------|
| Duree | 14 jours |
| Plan essai | Pro (complet) |
| Carte bancaire | Non requise |
| Alertes trial | J-7, J-3, J-1, J0 |
| Nurturing | J+3, J+7, J+10 |
| Apres expiration | Lecture seule 30j |

### 8.8 Quotas par Plan (table plan_quotas)

| Quota | Starter | Pro | Business |
|-------|---------|-----|----------|
| Utilisateurs | 1 | 5 | 20 |
| Clients max | 1 000 | 5 000 | Illimite |
| SMS/mois | 200 | 500 | 2 000 |
| Voix IA/mois | 0 min | 60 min | 300 min |

### 8.8 Rate Limits

```
Par IP:
├── 20 requetes/minute
├── 200 requetes/heure
└── 1000 requetes/jour

Violations:
├── 3-10 → Warning
├── >10 → IP blacklist
└── Lockout 15 minutes
```

---

## 9. CONFIGURATION STRIPE

### 9.1 Produits Stripe (migration 039 + 041)

**Statut:** ✅ Implementes | **Source de verite:** migration 041_update_pricing.sql

**Abonnements Mensuels:**
```
nexus_starter_monthly    → 99€/mois   → EUR 9900
nexus_pro_monthly        → 249€/mois  → EUR 24900
nexus_business_monthly   → 499€/mois  → EUR 49900
```

**Abonnements Annuels (-20%):**
```
nexus_starter_yearly     → 950€/an    → EUR 95000
nexus_pro_yearly         → 2390€/an   → EUR 239000
nexus_business_yearly    → 4790€/an   → EUR 479000
```

**Modules Specialises (recurring):**
```
nexus_module_restaurant  → 39€/mois   → EUR 3900
nexus_module_hotel       → 69€/mois   → EUR 6900
nexus_module_domicile    → 29€/mois   → EUR 2900
```

**Packs SMS (one-time):**
```
nexus_sms_100            → 15€        → EUR 1500
nexus_sms_500            → 65€        → EUR 6500
nexus_sms_1000           → 110€       → EUR 11000
nexus_sms_5000           → 450€       → EUR 45000
```

**Packs IA Voix (one-time):**
```
nexus_voice_30           → 15€        → EUR 1500
nexus_voice_60           → 25€        → EUR 2500
nexus_voice_120          → 45€        → EUR 4500
nexus_voice_300          → 99€        → EUR 9900
```

**Utilisateurs Extras (metered):**
```
nexus_user_starter       → 19€/user/mois
nexus_user_pro           → 15€/user/mois
nexus_user_business      → 12€/user/mois
```

### 9.2 Table stripe_products

```sql
CREATE TABLE IF NOT EXISTS stripe_products (
  id SERIAL PRIMARY KEY,
  product_code VARCHAR(100) NOT NULL UNIQUE,
  stripe_product_id VARCHAR(100),
  stripe_price_id VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'plan', 'module', 'addon', 'pack'
  billing_type VARCHAR(50) NOT NULL, -- 'recurring', 'one_time', 'metered'
  amount INTEGER NOT NULL, -- centimes
  currency VARCHAR(3) DEFAULT 'eur',
  interval VARCHAR(20), -- 'month', 'year', null
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX idx_stripe_products_code ON stripe_products(product_code);
CREATE INDEX idx_stripe_products_type ON stripe_products(type);
```

### 9.3 Migrations Stripe Products

**Migration 039:** Creation initiale de la table `stripe_products` + INSERT des produits
**Migration 041:** Mise a jour des prix (49/129/299 → 99/249/499) + creation table `plan_quotas`

```sql
-- Table plan_quotas (creee par migration 041)
CREATE TABLE IF NOT EXISTS plan_quotas (
  id SERIAL PRIMARY KEY,
  plan_id VARCHAR(50) NOT NULL UNIQUE,
  max_users INTEGER NOT NULL DEFAULT 1,
  max_clients INTEGER NOT NULL DEFAULT 1000,
  sms_monthly INTEGER NOT NULL DEFAULT 200,
  voice_minutes_monthly INTEGER NOT NULL DEFAULT 0,
  features JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Features par plan (JSONB)
-- starter: dashboard, clients, reservations, facturation, site_vitrine, agent_ia_web
-- pro: tout starter + whatsapp, telephone, comptabilite, crm_avance, marketing, pipeline, stock, analytics, devis
-- business: tout pro + rh, seo, api, sentinel, whitelabel
```

### 9.4 Webhooks Stripe

**Endpoint:** `/api/payment/webhook`

**Events geres:**
| Event | Action |
|-------|--------|
| `customer.subscription.created` | Activer tenant, envoyer email bienvenue |
| `customer.subscription.updated` | Mettre a jour plan/modules |
| `customer.subscription.deleted` | Desactiver tenant |
| `invoice.payment_succeeded` | Envoyer email facture |
| `invoice.payment_failed` | Envoyer email echec + alerte |
| `customer.subscription.trial_will_end` | Envoyer email J-3 |

### 9.5 Flux de Souscription

```
1. Signup (gratuit)
   └── Cree tenant + essai 14 jours

2. Pendant Essai
   ├── J+1: Email bienvenue
   ├── J-7: Email rappel
   ├── J-3: Email urgence
   ├── J-1: Email dernier jour
   └── J0:  Email expire + blocage

3. Conversion Payant
   ├── Choix plan + modules
   ├── Stripe Checkout
   ├── Webhook: subscription.created
   └── Activation immediate

4. Vie de l'Abonnement
   ├── Facturation mensuelle/annuelle
   ├── Email facture automatique
   ├── Gestion echecs paiement
   └── Upgrade/Downgrade a la demande
```

---

## 10. NOTIFICATIONS EMAIL

### 10.1 Service tenantEmailService.js

**Fichier:** `backend/src/services/tenantEmailService.js`

**Fonctions disponibles:**
```javascript
sendWelcomeEmail(tenantId)           // Email de bienvenue
sendTrialAlert(tenantId, days)       // Alertes J-7, J-3, J-1, J0
sendInvoicePaidEmail(tenantId, data) // Facture payee
sendPaymentFailedEmail(tenantId)     // Echec paiement
sendSubscriptionCancelledEmail(t)    // Abonnement annule
```

### 10.2 Templates HTML

| Template | Declencheur | Contenu |
|----------|-------------|---------|
| Bienvenue | Inscription | Guide demarrage, lien dashboard |
| Essai J-7 | Cron 9h15 | Rappel, features utilisees |
| Essai J-3 | Cron 9h15 | Urgence, tarifs |
| Essai J-1 | Cron 9h15 | Dernier jour, CTA |
| Essai Expire | Cron 9h15 | Acces bloque, reactivation |
| Facture OK | Webhook Stripe | Montant, lien facture |
| Echec Paiement | Webhook Stripe | Probleme carte, action |
| Annulation | Webhook Stripe | Confirmation, feedback |

### 10.3 Integration Points

**Signup (signup.js):**
```javascript
// Apres creation tenant
sendWelcomeEmail(tenant_id).catch(err => {
  console.error('[SIGNUP] Erreur email bienvenue:', err);
});
```

**Stripe Billing (stripeBillingService.js):**
```javascript
// handleInvoicePaid()
sendInvoicePaidEmail(tenant.id, { number, amount, planName, url });

// handlePaymentFailed()
sendPaymentFailedEmail(tenant.id);

// handleTrialWillEnd()
sendTrialAlert(tenantId, 3);

// handleSubscriptionDeleted()
sendSubscriptionCancelledEmail(tenantId);
```

**Scheduler (scheduler.js):**
```javascript
// Job: sendTrialAlertsJob - 9h15 quotidien
// Scan tenants avec essai_fin proche
// Envoie J-7, J-3, J-1, J0
// Met statut 'expire' si trial termine
```

---

## 11. OPTIMISATIONS COUTS

### 11.1 Strategie Globale

| Domaine | Avant | Apres | Economie |
|---------|-------|-------|----------|
| IA Chat | Sonnet partout | Haiku + cache | -70% |
| IA Voix | Illimite | Limits + detection | -40% |
| SMS | Direct | Cascade Email→WA→SMS | -44% |
| Infra | Requetes naives | Cache + CDN | -50% |

### 11.2 Routing IA Intelligent

```
Requete entrante
     │
     ▼
┌─────────────────┐
│ Cache Redis?    │──▶ HIT → Reponse immediate (0€)
└─────────────────┘
     │ MISS
     ▼
┌─────────────────┐
│ Haiku suffit?   │──▶ OUI → Claude Haiku (0.0003€)
│ (FAQ, simple)   │
└─────────────────┘
     │ NON
     ▼
┌─────────────────┐
│ Claude Sonnet   │──▶ Reponse complexe (0.002€)
└─────────────────┘
```

**Criteres Haiku:**
- Questions frequentes (horaires, adresse, services)
- Confirmations simples
- Salutations/clotures
- Requetes < 50 mots

**Criteres Sonnet:**
- Reservations complexes
- Problemes/reclamations
- Conseils personnalises
- Multi-turn conversations

### 11.3 Cascade Notifications

```
Priorite 1: Email (gratuit Resend inclus)
     │
     ▼ Si non lu 2h
Priorite 2: WhatsApp (0.01€/msg)
     │
     ▼ Si echec ou urgent
Priorite 3: SMS (0.04€/msg)
```

**Economie calculee:**
- Email seul: 60% des notifications
- +WhatsApp: 30% supplementaires
- SMS final: 10% restants
- Economie: 60% x 0€ + 30% x 0.01€ + 10% x 0.04€ = 0.007€/notif vs 0.04€

### 11.4 Limites IA Voix

| Mesure | Implementation |
|--------|----------------|
| Duree max appel | 5 minutes hard limit |
| Detection intent | Fin appel apres resolution |
| Heures creuses | Tarif reduit Vapi 20h-8h |
| Callback prompt | Propose rappel vs attente |

### 11.5 Infrastructure

| Optimisation | Implementation | Gain |
|--------------|----------------|------|
| Compression GZIP | `index.js` middleware | -60% bande passante |
| Cache dashboard | Redis TTL 5min | -80% requetes DB |
| CDN assets | Cloudflare/Vercel | -90% latence |
| Connection pooling | Supabase pgbouncer | -50% connexions |

### 11.6 Couts Estimes par Plan

**Starter 99€ (apres optimisations):**
```
Infrastructure: ~3€
SMS cascade (200): ~3€
IA routing (inclus): ~0.15€
Support: 2€
Stripe (2.9%): 2.87€
──────────────
Total: ~11€
Marge: ~89%
```

**Pro 249€ (apres optimisations):**
```
Infrastructure: ~8€
SMS cascade (500): ~5€
IA routing (inclus): ~0.30€
IA Voix (60 min): 6€
Support: 4€
Stripe (2.9%): 7.22€
──────────────
Total: ~31€
Marge: ~88%
```

**Business 499€ (apres optimisations):**
```
Infrastructure: ~15€
SMS cascade (2000): ~14€
IA routing (inclus): ~0.60€
IA Voix (300 min): 30€
Support: 10€
Stripe (2.9%): 14.47€
──────────────
Total: ~84€
Marge: ~83%
```

---

## 12. SECURITE

### TENANT SHIELD - LOI FONDAMENTALE

```javascript
// INTERDIT - Requete sans filtre tenant
const { data } = await supabase.from('clients').select('*');

// OBLIGATOIRE - Toujours filtrer par tenant
const { data } = await supabase
  .from('clients')
  .select('*')
  .eq('tenant_id', tenantId);

// INTERDIT - Fallback tenant
const tenant = tenantId || 'default';

// OBLIGATOIRE - Erreur si pas de tenant
if (!tenantId) throw new Error('tenant_id requis');
```

### Couches de protection

1. **Pre-commit Hook** - Bloque violations
2. **Linter statique** - `npm run lint:tenant`
3. **CI/CD GitHub** - Workflow automatise
4. **Middleware runtime** - Validation requetes
5. **RLS Supabase** - 33 policies

### Password Policy

- Minimum 12 caracteres
- Au moins 1 majuscule
- Au moins 1 chiffre
- Au moins 1 symbole
- Pas de reutilisation des 5 derniers

### Commandes securite

```bash
npm run lint:tenant   # Verifier isolation
npm run test:tenant   # Tests tenant
npm run shield        # Health check complet
```

---

## 13. PERFORMANCE

### Score actuel: 9.0/10 (ameliore le 2026-02-28)

### Forces

- Tenant isolation bien concue
- Pagination implementee (40+ routes)
- Cost tracking complet
- Caching en place (file, memory, redis optionnel)
- **Compression GZIP active** (reduit reponses de 60-70%)
- **N+1 queries corriges** (adminClients, adminStats, analyticsService)

### Optimisations effectuees (2026-02-27)

| Fichier | Avant | Apres | Gain |
|---------|-------|-------|------|
| `index.js` | Pas de compression | GZIP active | -60% taille |
| `adminClients.js` | 41 requetes/20 clients | 2 requetes total | 95% moins de requetes |
| `adminStats.js` | 7 requetes sequentielles | 1 requete range | 85% plus rapide |
| `analyticsService.js` | N requetes par client | 1 requete groupee | 90% moins de requetes |

### Details techniques des corrections

**1. Compression GZIP (index.js)**
```javascript
import compression from 'compression';
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['accept'] === 'text/event-stream') return false;
    return compression.filter(req, res);
  }
}));
```

**2. Fix N+1 adminClients.js**
- Avant: `Promise.all` avec 2 requetes par client
- Apres: 1 requete pour tous les RDV, groupage cote JS

**3. Fix adminStats.js (7 jours)**
- Avant: Boucle avec 1 requete par jour
- Apres: 1 requete avec `gte/lte` sur range de dates

**4. Fix analyticsService.js (nouveaux clients)**
- Avant: 1 requete par client pour trouver premier RDV
- Apres: 1 requete pour tous, groupage par client_id cote JS

### Ameliorations restantes (P2)

| Priorite | Action | Impact |
|----------|--------|--------|
| P2 | Cache dashboard stats (5min TTL) | -80% charge DB |
| P3 | Redis obligatoire en prod | Cache distribue |

---

## 14. DEPLOIEMENT

### Services Render

- `nexus-api` (Web Service) - Backend API
- `fatshairafro-web` (Static Site) - Site public
- `nexus-admin` (Static Site) - Admin dashboard

### Variables d'environnement requises

```bash
# Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# IA
ANTHROPIC_API_KEY=sk-ant-...

# Auth
JWT_SECRET=your-secret-key

# Notifications
RESEND_API_KEY=re_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...

# Paiements
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# CORS
CORS_ORIGINS=https://domain1.com,https://domain2.com

# Serveur
PORT=5000
NODE_ENV=production
```

---

## 15. NOUVELLES FONCTIONNALITES (v3.0)

### 15.1 Etat Global (mis a jour 2026-03-01)

| Composant | Statut | Notes |
|-----------|--------|-------|
| Pricing Strategy | ✅ Valide | 3 plans: 99€/249€/499€ (migrations 041 + 051) |
| Email Notifications | ✅ Fait | 7 templates, cron J-7/J-3/J-1/J0 |
| Trial Nurturing | ✅ Fait | Emails J+3, J+7, J+10 |
| UI Restaurant | ✅ Base | Tables, couverts, zones, Menu, Plan de salle |
| UI Hotel | ✅ Base | Chambres, sejours, extras, Calendrier, Tarifs saisonniers |
| Stripe Integration | ✅ Fait | Checkout, webhooks, billing, portal |
| AI Routing | ✅ Fait | aiRoutingService.js (Haiku/Sonnet) |
| Cascade Notifications | ✅ Fait | notificationCascadeService.js + migration 040 |
| RGPD | ✅ Fait | Export, suppression, anonymisation (migration 044) |
| Onboarding | ✅ Fait | Wizard multi-etapes (migration 045) |
| Voice Recordings | ✅ Fait | Stockage Twilio (migration 042) |
| IA Conversations | ✅ Fait | Persistance historique (migration 043) |
| Reservation Conflicts | ✅ Fait | Detection chevauchements |
| Email Log | ✅ Fait | Anti-doublon quotidien (migration 046) |
| Tenant IA Config | ✅ Fait | Config par canal (migration 042) |
| Public Payment | ✅ Beta | Widget paiement sans auth |
| CI/CD | ✅ Fait | 4 workflows GitHub Actions |

### 15.2 Stripe Integration — COMPLETE ✅

**Backend:**
- `stripeBillingService.js` (980 lignes) — Gestion complete abonnements
- `billing.js` (398 lignes) — Routes API billing
- `stripeWebhook.js` (72 lignes) — Handler webhooks
- `payment.js` (1075 lignes) — Stripe + PayPal
- `publicPayment.js` — Widget paiement public (sans auth admin)
- Script `npm run stripe:sync` — Synchronisation produits

**Frontend:**
- `Subscription.tsx` — Page plans, upgrade/downgrade, portail Stripe
- `Pricing.tsx` (nexus-app) — Page pricing publique

**Migrations:**
- `039_stripe_products.sql` — Table et produits
- `041_update_pricing.sql` — Mise a jour prix + table plan_quotas

### 15.3 AI Routing — COMPLETE ✅

**Fichier:** `aiRoutingService.js` (465 lignes)

```
Requete → Cache Redis? → HIT → Reponse (0€)
                       → MISS → Haiku suffit? → OUI → Haiku (0.0003€)
                                              → NON → Sonnet (0.002€)
```

### 15.4 Cascade Notifications — COMPLETE ✅

**Fichier:** `notificationCascadeService.js` (492 lignes)
**Migration:** `040_notification_cascade.sql`

- Table `notification_deliveries` avec tracking statut
- Vue `notification_cascade_stats` pour analytics
- Fonction SQL `get_best_channel_for_client()` (historique 90j)

### 15.5 RGPD — IMPLEMENTEE ✅

**Route:** `rgpd.js` — 4 endpoints derriere authenticateAdmin

| Endpoint | Description |
|----------|-------------|
| `GET /api/rgpd/export` | Export donnees tenant (Article 20) |
| `POST /api/rgpd/delete-request` | Demande suppression |
| `GET /api/rgpd/delete-status` | Statut demande |
| `POST /api/rgpd/anonymize-client` | Anonymiser un client |

**Migration:** `044_rgpd_requests.sql` — Table rgpd_requests + colonnes is_anonymized/anonymized_at sur clients

### 15.6 Onboarding Wizard — IMPLEMENTE ✅

**Route:** `onboarding.js` — 3 endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/admin/onboarding/status` | Etat onboarding |
| `POST /api/admin/onboarding/save` | Sauvegarder etape |
| `POST /api/admin/onboarding/complete` | Finaliser |

**Migration:** `045_onboarding_fields.sql` — 9 colonnes ajoutees a tenants:
`onboarding_completed`, `couleur_primaire`, `logo_url`, `description`, `adresse`, `site_web`, `instagram`, `facebook`

**Frontend:** `Onboarding.tsx` (33KB)

### 15.7 IA Conversations — IMPLEMENTEE ✅

**Migration:** `043_ia_conversations.sql` — 3 tables:

| Table | Description |
|-------|-------------|
| `ia_conversations` | Sessions (channel, status, phone, external_id) |
| `ia_messages` | Messages (role, content_type, media_url, tokens, latency) |
| `ia_intents` | Intentions detectees (confidence, entities, action) |

**Vue:** `ia_conversation_stats` — Stats quotidiennes par tenant/canal

### 15.8 Voice Recordings — IMPLEMENTEE ✅

**Service:** `voiceRecordingService.js`
**Migration:** `042_voice_recordings.sql`

Table `voice_recordings`: recording_sid, call_sid, caller_phone, duration, transcription, storage_path

### 15.9 Reservation Conflicts — IMPLEMENTE ✅

**Service:** `reservationConflictService.js`
**Fonction:** `checkAvailability({ tenantId, dateRdv, heureDebut, heureFin, membreId })`
**Retour:** `{ available: boolean, conflicts: Array, message: string }`

### 15.10 CI/CD Workflows — ACTIFS ✅

| Workflow | Declencheur | Description |
|----------|-------------|-------------|
| `ci.yml` | push main/develop, PR | Lint tenant + syntax, tests (Node 18/20) |
| `deploy-staging.yml` | push develop | Deploy staging |
| `deploy-production.yml` | push main (gate) | Deploy prod avec confirmation |
| `security.yml` | - | SAST, vulnerabilites, secrets |
| `tenant-shield.yml` | - | Lint isolation multi-tenant |

### 15.11 Migrations 040-046

| Migration | Date | Description |
|-----------|------|-------------|
| `040_notification_cascade.sql` | 2026-02-27 | Table notification_deliveries + vue stats + fonction best_channel |
| `041_update_pricing.sql` | 2026-02-28 | Mise a jour prix 99/249/499 + table plan_quotas |
| `042_tenant_ia_config.sql` | 2026-02-28 | Config IA par tenant/canal (JSONB) |
| `042_voice_recordings.sql` | 2026-02-28 | Stockage enregistrements vocaux Twilio |
| `043_ia_conversations.sql` | 2026-02-28 | Conversations + messages + intents IA |
| `044_rgpd_requests.sql` | 2026-02-28 | Demandes RGPD + anonymisation clients |
| `045_onboarding_fields.sql` | 2026-02-28 | Colonnes onboarding sur tenants |
| `046_tenant_email_log.sql` | 2026-02-28 | Log emails avec anti-doublon quotidien |

## 16. TRAVAUX EN COURS

### 16.1 PRIORITES RESTANTES

| Priorite | Tache | Impact | Statut |
|----------|-------|--------|--------|
| ~~**P0**~~ | ~~Commit 116 fichiers non sauves~~ | Securite code | ✅ FAIT |
| ~~**P0**~~ | ~~Push vers remote~~ | Securite code | ✅ FAIT |
| ~~**P0**~~ | ~~Signup CASSE (404 /api/auth/signup)~~ | Inscription bloquee | ✅ FAIT (2026-03-01) |
| ~~**P0**~~ | ~~useTenant.ts fallback nexus-test en prod~~ | Securite tenant | ✅ FAIT (2026-03-01) |
| ~~**P1**~~ | ~~Corriger pricing obsolete~~ | Coherence | ✅ FAIT (2026-03-01) |
| ~~**P1**~~ | ~~APP_URL + FRONTEND_URL manquants Render~~ | Stripe/emails casses | ✅ FAIT (2026-03-01) |
| ~~**P1**~~ | ~~CORS mal configure (admin URL incorrecte)~~ | Auth cross-origin | ✅ FAIT (2026-03-02) — callback(null,false) |
| ~~**P1**~~ | ~~WhatsApp dedie par tenant~~ | Multi-tenant | ✅ FAIT (2026-03-02) — plan 8/8 etapes |
| ~~**P1**~~ | ~~notificationWorker Bull→BullMQ~~ | Crash backend | ✅ FAIT (2026-03-02) |
| ~~**P1**~~ | ~~Redis eviction policy~~ | BullMQ jobs | ✅ FAIT (2026-03-02) — noeviction |
| **P1** | Configurer STRIPE_WEBHOOK_SECRET sur Render | Monetisation | 🔶 A faire (manuel) |
| **P1** | Tester webhooks Stripe en staging | Monetisation | 🔶 A faire |
| **P2** | Tests E2E restaurant/hotel | Qualite | 🔶 A faire |
| **P2** | UI avancee resto (plan salle, menu) | Features | 🔶 En cours |
| **P2** | UI avancee hotel (calendrier, tarifs) | Features | 🔶 En cours |
| ~~**P3**~~ | ~~Redis en prod~~ | Performance | ✅ FAIT (nexus-redis free, noeviction) |
| **P3** | Load testing cascade notifications | Performance | A faire |

### 16.2 Pricing - CORRIGE ✅ (2026-03-01)

Tous les fichiers sont maintenant alignes sur la grille officielle 99/249/499.
Correction effectuee dans: nexus-vitrine (App.jsx, Features.tsx, Pricing.tsx),
backend (landingAgent.js system prompt), admin-ui (Signup.tsx restaure),
landing (App.jsx monorepo).

### 16.3 Deploiement Production - CORRIGE ✅ (2026-03-01)

**Problemes resolus:**
- OpenAI TTS SDK crashait au demarrage si OPENAI_API_KEY absent → lazy-init
- bcrypt natif incompatible Render → bcryptjs
- Dossier logs/ manquant sur Render → mkdirSync dans logger.js
- start.js wrapper diagnostique pour debug Render
- ANTHROPIC_API_KEY invalide sur Render → remplacee par cle valide
- SUPABASE_SERVICE_ROLE_KEY incorrecte → corrigee
- VITE_API_URL vitrine pointait vers ancien backend mort → corrigee
- Tous liens localhost remplaces par URLs production

**Services Render actifs:**
| Service | Type | URL |
|---------|------|-----|
| nexus-api | web_service | https://nexus-backend-dev.onrender.com |
| nexus-admin | web_service | https://nexus-admin-yedu.onrender.com |
| nexus-vitrine | static_site | https://nexus-vitrine.onrender.com |
| fatshairafro-web | web_service | https://fatshairafro-web.onrender.com |
| nexus-redis | redis | redis://red-d6i3mjc50q8c73au4g10:6379 |

**Env vars Render backend (24):**
NODE_ENV, PORT, DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY,
JWT_SECRET, ADMIN_PASSWORD, ANTHROPIC_API_KEY, OPENAI_API_KEY,
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WABA_BU_SID, TWILIO_MESSAGING_SERVICE_SID,
TWILIO_FR_BUNDLE_SID, TWILIO_FR_MOBILE_BUNDLE_SID, TWILIO_FR_ADDRESS_SID,
RESEND_API_KEY, STRIPE_SECRET_KEY, STRIPE_PUBLIC_KEY,
CORS_ORIGIN, SENTRY_DSN, REDIS_URL, WEBHOOK_BASE_URL

**CORS_ORIGIN** (singulier, callback-based):
`https://fatshairafro-web.onrender.com,https://nexus-landing.onrender.com`
Verifie: origines non autorisees bloquees (pas de header Access-Control-Allow-Origin)

**Redis:** nexus-redis (Frankfurt, free) — eviction policy: `noeviction` (requis par BullMQ)

### 16.4 Audit Global Production - CORRIGE ✅ (2026-03-01)

**Score avant audit: 6/10 → Score apres audit: 8.5/10**

Audit complet realise avec 4 agents paralleles: Signup flow, Backend API, Admin-UI config, Frontend-backend consistency.

**Bugs critiques corriges:**

| # | Gravite | Bug | Fix | Commit |
|---|---------|-----|-----|--------|
| 1 | CRITIQUE | Signup appelle `/api/auth/signup` (404) | Change en `/api/admin/auth/signup` | 317be9e |
| 2 | CRITIQUE | Champs signup incompatibles | Faux positif: adminAuth.js accepte deja les bons champs | 317be9e |
| 3 | CRITIQUE | Onboarding endpoints manquants | Faux positif: 4 endpoints existent dans tenants.js | N/A |
| 4 | SECURITE | useTenant.ts fallback `nexus-test` en prod | Retourne '' en prod, JWT tenant_id utilise directement | 317be9e |
| 5 | HAUT | APP_URL manquant sur Render | Ajoute sur Render (Stripe redirects fonctionnels) | Env var |
| 6 | HAUT | FRONTEND_URL manquant sur Render | Ajoute sur Render (emails, WhatsApp links) | Env var |
| 7 | HAUT | CORS manquait admin-yedu et vitrine | CORS_ORIGINS mis a jour avec toutes origines prod | Env var |

**Fichiers modifies:**
- `admin-ui/src/pages/Signup.tsx` — endpoint `/api/auth/signup` → `/api/admin/auth/signup`
- `admin-ui/src/hooks/useTenant.ts` — suppression hardcoded idToSlug map, fallback '' en prod

**Resultats audit backend:**
- 64 routes correctement importees et montees
- Middleware order correct (CORS → rate limit → body parser → tenant resolution → shield)
- Security headers OK, rate limiting configure, JWT auth solide
- 147+ endpoints frontend-backend correctement alignes

**Resultats audit signup flow:**
- Route backend: `POST /api/admin/auth/signup` (adminAuth.js:248)
- Accepte: `{entreprise, nom, email, telephone, password, plan}`
- Cree tenant + admin user + trial 14 jours
- Route complete: `POST /api/signup` (signup.js) pour future V2 avec secteur/template

**Resultats audit onboarding:**
- `GET /api/tenants/business-templates` (tenants.js:306) ✅
- `GET /api/tenants/template-preview/:type` (tenants.js:639) ✅
- `POST /api/tenants/setup-from-template` (tenants.js:365) ✅
- `PATCH /api/tenants/me/complete-onboarding` (tenants.js:682) ✅
- `POST /api/admin/onboarding/complete` (onboarding.js:222) ✅

**Tenant Shield exemptions (tenantShield.js SYSTEM_ROUTES):**
- `/api/admin/auth` — Auth routes (login, signup, password)
- `/api/signup` — Tunnel inscription complet
- `/api/landing` — Agent commercial vitrine
- `/api/webhooks`, `/api/twilio`, `/api/voice` — Webhooks externes
- `/api/public`, `/api/services`, `/api/reviews`, `/api/orders` — Routes publiques

**CI apres corrections: 10/10 jobs PASS**

---

## 15.12 SYSTEME MULTI-TENANT MULTI-BUSINESS (2026-02-27)

### Score Global: 9.0/10 ✅ (Infrastructure + UI + RGPD + Onboarding)

L'**infrastructure** est complete et l'**implementation UI** couvre maintenant les 4 types de business.

### Etat par Type de Business

| Type | Config Backend | ProfileContext | UI Pages | Score |
|------|----------------|----------------|----------|-------|
| `service_domicile` | ✅ | ✅ | ✅ | **100%** |
| `salon` | ✅ | ✅ | ✅ | **100%** |
| `restaurant` | ✅ | ✅ | ✅ Base | **80%** |
| `hotel` | ✅ | ✅ | ✅ Base | **80%** |

### Features par Type

| Type | Description | Features Configurees | UI Implementee |
|------|-------------|---------------------|----------------|
| `service_domicile` | Services a domicile | travelFees, clientAddress | ✅ Complet |
| `salon` | Etablissement fixe | multiStaff, stations | ✅ Complet |
| `restaurant` | Restauration | tableManagement, covers | ✅ Base (tables, couverts) |
| `hotel` | Hotellerie | roomInventory, checkinCheckout, extras | ✅ Base (chambres, sejours) |

### Architecture Multi-Business

```
config/businessTypes.js           # Configuration des 4 types
templates/
├── service_domicile.template.js  # Template services a domicile
├── salon.template.js             # Template salon
├── restaurant.template.js        # Template restaurant
├── hotel.template.js             # Template hotel
└── index.js                      # Factory de templates

services/tenantBusinessService.js # Service central ✨
├── getBusinessInfo(tenantId)     # Infos du tenant (async)
├── getBusinessInfoSync(tenantId) # Infos du tenant (sync/cache)
├── hasFeature(tenantId, feature) # Verification feature
├── getTerminology(tenantId)      # Terminologie dynamique
└── getAIContext(tenantId)        # Contexte pour prompts IA

prompts/
├── systemPrompt.js               # Generateur prompts dynamiques
└── voicePrompt.js                # Prompts vocaux multi-tenant

admin-ui/
├── contexts/ProfileContext.tsx   # Context enrichi V2
└── components/forms/             # Composants adaptatifs
    ├── FeatureField.tsx          # Champs conditionnels par feature
    ├── BusinessTypeField.tsx     # Champs conditionnels par type
    ├── DynamicLabel.tsx          # Labels avec terminologie
    └── PricingFields.tsx         # Tarification adaptative
```

### Terminologie Dynamique

| Terme | service_domicile | salon | restaurant | hotel |
|-------|------------------|-------|------------|-------|
| reservation | RDV | RDV | Reservation | Sejour |
| service | Service | Prestation | Service | Chambre |
| client | Client | Client | Client | Hote |
| employee | Prestataire | Collaborateur | Serveur | Receptionniste |

### Hooks Frontend (ProfileContext)

```typescript
// Hooks disponibles
const { t, hasFeature, businessType, businessInfo } = useProfile();

// Composants conditionnels
<FeatureField feature="travelFees">...</FeatureField>
<BusinessTypeField types={['service_domicile']}>...</BusinessTypeField>
<DynamicLabel term="service" plural />
<PricingFields allowModeSwitch />
```

### Infrastructure Complete ✅

| Composant | Status | Notes |
|-----------|--------|-------|
| `config/businessTypes.js` | ✅ | 4 types configures |
| `services/tenantBusinessService.js` | ✅ | Service central avec cache |
| `contexts/ProfileContext.tsx` | ✅ | Hooks V2 complets |
| `components/forms/FeatureField.tsx` | ✅ | Affichage conditionnel par feature |
| `components/forms/BusinessTypeField.tsx` | ✅ | Affichage conditionnel par type |
| `components/forms/DynamicLabel.tsx` | ✅ | Labels avec terminologie |
| `components/forms/PricingFields.tsx` | ✅ | Modes fixed/hourly/daily/package |

### UI Pages - Etat Reel

| Page | service_domicile | salon | restaurant | hotel |
|------|------------------|-------|------------|-------|
| Services.tsx | ✅ | ✅ | ✅ Tables (capacite, zone) | ✅ Chambres (etage, prix/nuit) |
| Activites.tsx | ✅ | ✅ | ✅ Couverts, table | ✅ Sejours, checkin/out |
| Clients.tsx | ✅ | ✅ | ✅ | ✅ |
| Devis.tsx | ✅ | ✅ | ✅ Sans affectation | ✅ Sans affectation |
| Pipeline.tsx | ✅ | ✅ | ✅ | ✅ |

### Restaurant - Implementation UI ✅

```
Services.tsx (Tables):
✅ Champ "capacite" (nombre places par table)
✅ Champ "zone" (terrasse, interieur, prive, bar)
✅ Icone UtensilsCrossed
✅ Filtres par zone

Activites.tsx (Reservations):
✅ Selection de table (liste des tables actives)
✅ Champ "nb_couverts" (nombre de personnes)
✅ Interface dediee avec icone et couleur
```

### Hotel - Implementation UI ✅

```
Services.tsx (Chambres):
✅ Champ "etage"
✅ Champ "capacite" (personnes)
✅ Champ "equipements" (wifi, minibar, etc.)
✅ Prix par nuit
✅ Icone Bed

Activites.tsx (Sejours):
✅ Date arrivee (date_rdv)
✅ Date depart (date_checkout)
✅ Heure checkin / checkout
✅ Selection extras (petit-dejeuner, parking, etc.)
✅ Selection chambre
✅ Nombre de personnes
```

### Ameliorations Futures (P2)

```
Restaurant:
- Menu du jour integre
- Services midi/soir
- Plan de salle visuel

Hotel:
- Calendrier de disponibilite des chambres
- Tarifs saisonniers
- Integration channel manager
```

### Backend - Hardcoding Corrige ✅

| Fichier | Probleme | Correction |
|---------|----------|------------|
| `adminReservations.js` | `lieu: 'salon'` hardcode | ✅ `getDefaultLocation(tenantId)` |
| `orders.js` | `lieu: 'salon'` hardcode | ✅ `getDefaultLocation(tenantId)` |
| `adminPipeline.js` | `lieu: 'salon'` hardcode | ✅ `getDefaultLocation(tenantId)` |
| `public.js` | `lieu_type: 'salon'` hardcode | ✅ `getDefaultLocation(tenantId)` |

**Fonction getDefaultLocation() retourne:**
- `service_domicile` → 'domicile'
- `salon` → 'salon'
- `restaurant` → 'restaurant'
- `hotel` → 'hotel'

### Fichiers Backend Corriges ✅

| Fichier | Probleme | Statut |
|---------|----------|--------|
| `services/bookingService.js` | `SALON_INFO` hardcode | ✅ Corrige |
| `services/voiceAIService.js` | Messages vocaux hardcodes | ✅ Corrige |
| `services/voiceService.js` | `PREGENERATED_PHRASES` | ✅ Corrige |
| `services/whatsappService.js` | `ADRESSE_DEPART`, `FRONTEND_URL` | ✅ Corrige |
| `prompts/voicePrompt.js` | Prompts systeme hardcodes | ✅ Corrige |
| `utils/whatsappTemplates.js` | URLs, signature | ✅ Corrige |
| `routes/twilioWebhooks.js` | TODO tenant resolution | ✅ Corrige |

### Service Central tenantBusinessService.js ✅

```javascript
// Fonctions disponibles
getBusinessInfo(tenantId)       // Infos completes du tenant (async)
getBusinessInfoSync(tenantId)   // Version synchrone avec cache
hasFeature(tenantId, feature)   // Verification feature flag
getTerminology(tenantId, key)   // Terminologie dynamique
getAllTerminology(tenantId)     // Tous les termes
getBusinessRule(tenantId, rule) // Regles metier
isFieldRequired(tenantId, f)    // Validation champ requis
isFieldForbidden(tenantId, f)   // Validation champ interdit
calculatePrice(tenantId, ...)   // Calcul prix adapte
getAIContext(tenantId)          // Contexte pour prompts IA
```

### Terminologie par Type

| Cle | service_domicile | salon | restaurant | hotel |
|-----|------------------|-------|------------|-------|
| reservation | RDV | RDV | Reservation | Reservation |
| service | Prestation | Prestation | Table | Chambre |
| client | Client | Client | Client | Hote |
| employee | Intervenant | Coiffeur | Serveur | Receptionniste |
| duration | Duree | Duree | Creneau | Sejour |
| quantity | Quantite | Quantite | Couverts | Personnes |

### Features par Type

| Feature | service_domicile | salon | restaurant | hotel |
|---------|------------------|-------|------------|-------|
| travelFees | ✅ | ❌ | ❌ | ❌ |
| clientAddress | ✅ | ❌ | ❌ | ❌ |
| multiStaff | ❌ | ✅ | ✅ | ✅ |
| tableManagement | ❌ | ❌ | ✅ | ❌ |
| roomInventory | ❌ | ❌ | ❌ | ✅ |
| checkinCheckout | ❌ | ❌ | ❌ | ✅ |
| extras | ❌ | ❌ | ❌ | ✅ |
| deposits | ✅ | ✅ | ❌ | ✅ |

### Scores par Composant

| Composant | Score | Notes |
|-----------|-------|-------|
| Backend Config | 10/10 | ✅ Complet |
| tenantBusinessService | 10/10 | ✅ Complet + getDefaultLocation() |
| ProfileContext | 10/10 | ✅ Complet |
| Composants Forms | 10/10 | ✅ Complet |
| UI service_domicile | 10/10 | ✅ Complet |
| UI salon | 10/10 | ✅ Complet |
| UI restaurant | 8/10 | ✅ Base (tables, couverts, zones) |
| UI hotel | 8/10 | ✅ Base (chambres, sejours, extras) |
| Backend routes | 9/10 | ✅ Hardcoding corrige |
| Devis conditionnels | 10/10 | ✅ Affectation membre cachee resto/hotel |

---

## 17. HISTORIQUE DES MODIFICATIONS

### 2026-03-02 (Session 9) — WhatsApp Dedie + Stabilisation Prod

**WhatsApp dedie par tenant (plan complete 8/8 etapes):**
- tenantId propage a tous les appels sendWhatsAppMessage (whatsappService.js)
- Bundle mobile FR approuve (BUcf845ba9e91257dda88a4d493ea91966)
- Dual-bundle dans twilioProvisioningService.js (national vs mobile auto-select)
- 4 env vars Twilio ajoutees sur Render via API
- Migration 050 (whatsapp_dedicated) deja en DB

**Stabilisation production:**
- notificationWorker.js: migre Bull → BullMQ Worker (fix crash `queue.process is not a function`)
- CORS: `callback(null, false)` au lieu de `callback(new Error(...))` — header correctement omis
- Redis: eviction policy `allkeys-lru` → `noeviction` via API Render
- Migration 052: colonnes `relance_24h_envoyee` + `relance_24h_date` sur reservations
- PostgREST schema cache reloaded (`NOTIFY pgrst`)
- Health check enrichi: DB ok (150ms), Redis ok, Stripe/Twilio/Sentry true

**Fichiers modifies:**
- `backend/src/queues/notificationWorker.js` — rewrite complet Bull → BullMQ
- `backend/src/services/twilioProvisioningService.js` — dual-bundle + mobile support
- `backend/src/services/whatsappService.js` — tenantId sur tous les sendWhatsAppMessage
- `backend/src/index.js` — CORS callback(null, false)
- `backend/migrations/052_reservations_relance_24h.sql` — NOUVEAU

---

### 2026-03-01 (Session 6) — Legal Compliance

**Mise en conformite legale complete (Mentions, CGV, Confidentialite, Factures)**

**Phase 1 — Pages legales vitrine (`nexus-vitrine`):**
- Cree `MentionsLegales.tsx` — toutes infos officielles du Guichet Unique (SIREN, SIRET, APE, regime fiscal)
- Cree `CGV.tsx` — 8 articles (Objet, Services, Tarifs 99/249/499, Essai 14j, Paiement Stripe, Responsabilite, Donnees, Litiges)
- Cree `Confidentialite.tsx` — 10 sections RGPD (Responsable, Donnees, Finalites, Base legale, Conservation, Destinataires, Transferts hors UE, Cookies, Securite, Droits)
- App.jsx: routing wouter + footer mis a jour (SIRET, copyright, liens legaux)

**Phase 2 — Factures PDF (`pdfService.js`):**
- `getTenantConfig()` etendu: fetche `adresse, telephone` en plus
- Nouvelle fonction `buildLegalFooter()`: genere SIRET + TVA mention depuis `tenant.settings`
- 6 generateurs PDF mis a jour (generateFacture, generateDevis, generateRapport, generateInvoicePDF, generateQuotePDF, generatePayslipPDF)
- Config tenant: `settings.siret`, `settings.tax_status` (`franchise_base` | `assujetti`), `settings.numero_tva`

**Phase 3 — NEXUS_KNOWLEDGE.md:**
- Ajout section "Informations Legales Editeur" avec toutes les donnees officielles
- Ajout section "Pages legales" avec routes et fichiers
- Ajout section "Mentions legales sur les documents PDF"
- Version 3.1.0 → 3.2.0

**Fichiers crees (vitrine):**
- `src/pages/MentionsLegales.tsx`
- `src/pages/CGV.tsx`
- `src/pages/Confidentialite.tsx`

**Fichiers modifies (monorepo):**
- `backend/src/services/pdfService.js` — legal footer sur tous les PDFs

---

### 2026-03-01 (Session 5) — Production Readiness

**Deploiement Production + Audit Global + Corrections critiques**

**Phase 1 — Deploiement (CI + Render):**
- Fix 48 tests CI casses → 10/10 jobs PASS
- Fix OpenAI/Replicate lazy-init (startup crash sur Render)
- Fix bcrypt natif → bcryptjs, logs/ mkdirSync, start.js wrapper
- ANTHROPIC_API_KEY + SUPABASE_SERVICE_ROLE_KEY corrigees sur Render
- Landing bot repare (cle API invalide)
- 3 services Render deployes et fonctionnels

**Phase 2 — Site vitrine + URLs:**
- Tous localhost:3001/3000 remplaces par URLs production (2 repos)
- VITE_API_URL corrigee sur Render vitrine
- Boutons "Retour au site" corriges (Login, Signup, Onboarding)
- Pricing aligne 99/249/499 partout (vitrine, admin, backend, landing)

**Phase 3 — Audit Global (4 agents paralleles):**
- Signup flow: endpoint 404 corrige → /api/admin/auth/signup
- useTenant.ts: fallback nexus-test supprime en production
- useTenant.ts: hardcoded idToSlug map supprime → tenant_id direct
- APP_URL + FRONTEND_URL ajoutes sur Render
- CORS_ORIGINS mis a jour avec toutes les origines production
- Onboarding endpoints verifies: 4/4 existent dans tenants.js

**Commits monorepo:** bfa09fc, b569bc9, 317be9e
**Commits vitrine:** 90e2451, 6ac89ba, bbd5a97

**Fichiers modifies (monorepo):**
- `admin-ui/src/pages/Signup.tsx` — endpoint + retour site
- `admin-ui/src/pages/Login.tsx` — retour site
- `admin-ui/src/pages/Onboarding.tsx` — retour site
- `admin-ui/src/hooks/useTenant.ts` — securite tenant
- `admin-ui/src/components/rh/*.tsx` (5 fichiers) — API fallback
- `backend/src/routes/landingAgent.js` — pricing system prompt
- `landing/src/App.jsx` — URLs + pricing

**Fichiers modifies (vitrine):**
- `src/App.jsx` — URLs + pricing + bot messages
- `src/lib/api-config.ts` — API URL fallback
- `src/pages/Features.tsx` — pricing
- `src/pages/Pricing.tsx` — pricing

---

### 2026-02-28 (Session 4) — v3.0.0

**🎉 MASSIVE UPDATE — Stripe + AI Routing + RGPD + Onboarding + Voice + Conversations**

**Stripe Integration Complete:**
- `stripeBillingService.js` (980 lignes) — Checkout sessions, product sync, subscription lifecycle
- `billing.js` (398 lignes) — Routes API completes
- `stripeWebhook.js` — Handler webhooks
- `publicPayment.js` — Widget paiement public sans auth
- Script `npm run stripe:sync`

**Pricing mis a jour (migration 041):**
- Plans: 49/129/299 → **99/249/499**
- Modules: Restaurant 39€, Hotel 69€, Domicile 29€
- Packs SMS et Voix revalorisés
- Table `plan_quotas` avec features JSONB par plan

**AI Routing implemente:**
- `aiRoutingService.js` (465 lignes) — Cache → Haiku → Sonnet

**Cascade Notifications implemente:**
- `notificationCascadeService.js` (492 lignes) — Email → WA → SMS
- Migration 040 — Table notification_deliveries + vue stats

**Nouvelles fonctionnalites:**
| Feature | Fichiers | Migration |
|---------|----------|-----------|
| RGPD compliance | rgpd.js | 044 |
| Onboarding wizard | onboarding.js + Onboarding.tsx | 045 |
| Voice recordings | voiceRecordingService.js | 042 |
| IA conversations | conversationPersistenceService.js | 043 |
| Reservation conflicts | reservationConflictService.js | - |
| Trial nurturing | trialNurtureJob.js (J3/J7/J10) | - |
| Email log anti-doublon | - | 046 |
| Tenant IA config | - | 042 |

**CI/CD mis en place:**
- 4 workflows GitHub Actions (ci, staging, production, security)
- tenant-shield.yml pour lint isolation

**Scheduler enrichi:** 13 jobs actifs (vs 8 avant)

**Fichiers crees:** ~40 nouveaux fichiers
**Fichiers modifies:** ~76 fichiers
**Migrations:** 039 → 046 (8 nouvelles)

---

### 2026-02-27 (Session 3)

**🎉 PRICING + EMAIL NOTIFICATIONS + STRIPE CONFIG - Version 2.2.0**

**Strategie Tarifaire Initiale (mise a jour en session 4 → 99/249/499):**
- Plans initiaux: Starter 49€, Pro 129€, Business 299€
- Engagement annuel: -20%
- Add-ons: SMS, Voix IA, Modules specialises

**Email Notifications (tenantEmailService.js):**
- 7 templates HTML (bienvenue, trial J-7/J-3/J-1/J0, facture, echec, annulation)
- Integration signup.js (email bienvenue)
- Integration stripeBillingService.js (emails facturation)
- Job scheduler sendTrialAlertsJob (quotidien 9h15)

**Configuration Stripe Documentee:**
- 6 produits plans (mensuel + annuel)
- 3 modules specialises
- 4 packs SMS + 4 packs Voix
- Table stripe_products avec migration
- Webhooks et flux souscription

**Optimisations Couts Planifiees:**
- Routing IA intelligent (Cache → Haiku → Sonnet): -70% couts
- Cascade notifications (Email → WA → SMS): -44% couts
- Limites IA Voix: 5 min max, detection fin
- Infrastructure: GZIP, Redis cache, CDN

**Fichiers crees/modifies:**
| Fichier | Type | Description |
|---------|------|-------------|
| `tenantEmailService.js` | Cree | Service emails avec 7 templates |
| `signup.js` | Modifie | Email bienvenue |
| `stripeBillingService.js` | Modifie | Emails facturation |
| `scheduler.js` | Modifie | Job alertes trial |
| `NEXUS_KNOWLEDGE.md` | Modifie | Sections 8-11 ajoutees |

**Roadmap ajoutee:**
- Phase Stripe: Produits → Migration → Backend → Frontend
- Phase Optimisations: Routing IA → Cascade → Voix limits

---

### 2026-02-27 (Session 2)

**🎉 UI RESTAURANT/HOTEL + BACKEND HARDCODING - Score: 6.0/10 → 8.0/10**

**UI Services.tsx - Restaurant:**
- Ajout champ "capacite" (places par table)
- Ajout champ "zone" (terrasse, interieur, prive, bar)
- Affichage conditionnel avec `isBusinessType('restaurant')`
- Icone UtensilsCrossed

**UI Services.tsx - Hotel:**
- Ajout champ "etage"
- Ajout champ "capacite" (personnes)
- Ajout champ "equipements" (multiselect)
- Prix par nuit avec label dynamique
- Icone Bed

**UI Activites.tsx - Restaurant:**
- Selection de table (dropdown des tables actives)
- Champ "nb_couverts" (nombre de personnes)
- Section dediee avec fond ambre et icone

**UI Activites.tsx - Hotel:**
- Date arrivee / date depart (range)
- Heures checkin / checkout
- Selection chambre
- Nombre de personnes
- Selection extras (petit-dejeuner, parking, spa, etc.)
- Section dediee avec fond violet et icone

**Backend - Hardcoding 'salon' corrige:**

| Fichier | Lignes | Correction |
|---------|--------|------------|
| `adminReservations.js` | 4 lignes | `getDefaultLocation(tenantId)` |
| `orders.js` | 1 ligne | `getDefaultLocation(tenantId)` |
| `public.js` | 1 ligne | `getDefaultLocation(tenantId)` |
| `adminPipeline.js` | 1 ligne | `getDefaultLocation(tenantId)` |

**Devis.tsx - Affectation membre conditionnelle:**
- `DevisFormModal`: affectation cachee pour restaurant/hotel
- `ExecuteDevisModal`: affectation ressources cachee pour restaurant/hotel
- Logique: `showMemberAssignment = !isBusinessType('restaurant') && !isBusinessType('hotel')`

---

### 2026-02-27 (Session 1)

**🎉 GENERALISATION MULTI-TENANT MULTI-BUSINESS - Score: 5.1/10 → 9.0/10**

La plateforme supporte maintenant 4 types de business avec configuration dynamique complete.

**Fichiers crees:**

| Fichier | Description |
|---------|-------------|
| `config/businessTypes.js` | Configuration des 4 types de business |
| `templates/*.template.js` | 4 templates pour chaque type |
| `services/tenantBusinessService.js` | Service central multi-tenant |
| `prompts/systemPrompt.js` | Generateur prompts dynamiques |
| `admin-ui/components/forms/*` | 4 composants adaptatifs |

**Fichiers modifies:**

| Fichier | Modification |
|---------|--------------|
| `voiceAIService.js` | Messages vocaux dynamiques |
| `whatsappService.js` | URLs et signatures dynamiques |
| `voiceService.js` | Phrases TTS multi-tenant |
| `voicePrompt.js` | getVoiceSystemPrompt(tenantId) |
| `whatsappTemplates.js` | Toutes fonctions avec tenantId |
| `twilioWebhooks.js` | getVoiceMessages(), getTransferPhone() |
| `public.js` | getGreetingMessage() dynamique |
| `adminProfile.js` | Profil enrichi V2 |
| `ProfileContext.tsx` | Hooks V2 (hasFeature, businessType) |
| `Services.tsx` | Terminologie dynamique, PricingFields |
| `Activites.tsx` | FeatureField pour clientAddress/travelFees |
| `Devis.tsx`, `Pipeline.tsx` | Imports profile hooks |
| `Clients.tsx`, `Sidebar.tsx` | useProfile integre |

**Ancien audit multi-tenant (reference):**

| Constat | Details |
|---------|---------|
| Valeurs hardcodees | 36+ fichiers avec "Fat's Hair-Afro" |
| Routage OK | WhatsApp/Twilio identifient le tenant |
| Prompts hardcodes | voicePrompt.js, bookingService.js |
| URLs hardcodees | fatshairafro.fr dans whatsappTemplates |
| TTS hardcode | 40+ phrases pre-generees |

**Fichiers critiques identifies:** bookingService.js, voiceAIService.js, voiceService.js, whatsappService.js, voicePrompt.js

**Optimisations performance - Score passe de 6.5/10 a 8.5/10:**

| Fichier | Modification | Impact |
|---------|--------------|--------|
| `index.js` | Ajout compression GZIP middleware | -60% taille reponses |
| `adminClients.js` | Fix N+1: 1 requete au lieu de 41 | 95% moins de requetes DB |
| `adminStats.js` | Fix 7 requetes -> 1 requete range | 85% plus rapide |
| `analyticsService.js` | Fix boucle sequentielle -> 1 requete | 90% moins de requetes |

**Package installe:** `compression`

### 2026-02-26

**Audit securite SENTINEL complet - 7 vulnerabilites corrigees:**

| Fichier | Probleme | Correction |
|---------|----------|------------|
| `sentinelInsights.js` | markAsImplemented/dismissInsight sans tenant | tenantId obligatoire |
| `backupService.js` | Export TOUTES donnees avant filtrage | Filtre AVANT chargement |
| `accountService.js` | changePassword tenantId optionnel | tenantId obligatoire |
| `tenantCostTracker.js` | getAllTenantUsage expose tous tenants | Nouvelle version securisee |
| `persistence.js` | loadRecentAlerts tenantId optionnel | tenantId obligatoire |
| `sentinel.js routes` | Routes insight sans tenantId | Ajout req.admin.tenant_id |
| `costMonitor.js` | Couts globaux melanges | Refactoring multi-tenant |

**Audit securite Business Logic - Corrige precedemment:**
- `halimahProService.js` - 18 fonctions securisees
- `paymentService.js` - 6 fonctions avec tenant verification
- `agentIA.js` - 16 appels mis a jour

### 2026-02-21

- Creation CLAUDE.md (regles de dev)
- Activation Tenant Shield middleware

---

## 18. PROBLEMES CONNUS

### Performance (RESOLUS le 2026-02-27)

| Probleme | Statut | Fichier | Resolution |
|----------|--------|---------|------------|
| ~~N+1 Queries~~ | RESOLU | adminClients.js | Groupage cote JS |
| ~~7 requetes sequentielles~~ | RESOLU | adminStats.js | 1 requete range |
| ~~Pas de compression~~ | RESOLU | index.js | Middleware compression |
| ~~Boucle sequentielle~~ | RESOLU | analyticsService.js | 1 requete groupee |

### ~~Pricing desynchronise (P1)~~ — RESOLU ✅ (2026-03-01)

Tous les fichiers alignes sur la grille officielle **99€/249€/499€**.
Voir section 16.2 pour details.

### Signup CASSE — RESOLU ✅ (2026-03-01)

Frontend appelait `/api/auth/signup` (route inexistante). Corrige vers `/api/admin/auth/signup`.
Voir section 16.4 pour details.

### A surveiller

- Redis optionnel en production (P3 - non bloquant)
- Cache hit rate a mesurer
- Memory usage Node.js
- ~~116 fichiers non commites (risque perte)~~ RESOLU — tout est commit et push
- STRIPE_WEBHOOK_SECRET non configure sur Render (action manuelle requise)

---

## 19. REGLES DE DEVELOPPEMENT

### AVANT chaque modification

```
[ ] J'ai lu CLAUDE.md
[ ] J'ai lu NEXUS_KNOWLEDGE.md (ce fichier)
[ ] Je comprends le contexte complet
[ ] Mon code respecte TENANT SHIELD
```

### PENDANT le developpement

```
[ ] Chaque requete DB filtre par tenant_id
[ ] tenantId est le PREMIER parametre des fonctions
[ ] Aucun secret en dur
[ ] Gestion d'erreurs exhaustive
[ ] Types/validation sur toutes entrees
```

### APRES chaque modification

```
[ ] npm run lint:tenant passe
[ ] Tests passent
[ ] NEXUS_KNOWLEDGE.md mis a jour si necessaire
[ ] Pas de regression
```

### Pattern de fonction securisee

```javascript
async function maFonction(tenantId, autresParams) {
  // TENANT SHIELD: Validation obligatoire
  if (!tenantId) {
    throw new Error('tenant_id requis pour maFonction');
  }

  const { data, error } = await supabase
    .from('ma_table')
    .select('*')
    .eq('tenant_id', tenantId); // TOUJOURS filtrer

  if (error) throw error;
  return data;
}
```

### Pattern de route securisee

```javascript
router.get('/endpoint', authenticateAdmin, async (req, res) => {
  const tenantId = req.admin.tenant_id;

  if (!tenantId) {
    return res.status(403).json({ error: 'TENANT_REQUIRED' });
  }

  try {
    const result = await monService.maFonction(tenantId, ...);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

---

## NOTES IMPORTANTES

1. **Ce fichier doit etre mis a jour** apres chaque modification significative
2. **Toujours lire CLAUDE.md en premier** - c'est la directive absolue
3. **TENANT SHIELD est non-negociable** - aucune exception
4. **Les audits securite** doivent etre documentes dans l'historique
5. **Les problemes de performance** doivent etre tracked et resolus

---

> "La connaissance partagee est la connaissance preservee."

**Mainteneur:** Claude Code
**Projet:** NEXUS/SENTINEL
**Entreprise:** Nexus SaaS Platform
