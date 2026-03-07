# NEXUS Platform - Roadmap Commercialisation v3.0

> **Note (2 mars 2026):** La roadmap technique (ROADMAP_100.md) est terminee a 100/100.
> Ce document reste la reference pour la roadmap **commercialisation** (domaine, legal, marketing, beta).
> Les phases techniques sont couvertes par PROGRESS.md et SYSTEM.md.

> **Dernière mise à jour :** 7 mars 2026
> **Objectif :** Lancement commercial SaaS en France
> **Structure juridique :** Micro-entreprise (SIRET en cours de validation)
> **Vision :** Plateforme qui s'adapte automatiquement au métier du client

---

## SOMMAIRE

1. [Architecture Client NEXUS](#1-architecture-client-nexus)
2. [Parcours Client Type](#2-parcours-client-type)
3. [État des Lieux Actuel](#3-état-des-lieux-actuel)
4. [Phase 0 - Attente SIRET](#4-phase-0---attente-siret-en-cours)
5. [Phase 1 - Infrastructure Landing](#5-phase-1---infrastructure-landing)
6. [Phase 2 - Auto-Configuration Métier](#6-phase-2---auto-configuration-métier)
7. [Phase 3 - Conformité Légale](#7-phase-3---conformité-légale)
8. [Phase 4 - Billing & Onboarding](#8-phase-4---billing--onboarding)
9. [Phase 5 - Tests & Stabilisation](#9-phase-5---tests--stabilisation)
10. [Phase 6 - Pré-lancement](#10-phase-6---pré-lancement)
11. [Phase 7 - Lancement](#11-phase-7---lancement)
12. [Checklist Pré-Lancement](#12-checklist-pré-lancement)
13. [Ressources](#13-ressources)

---

## 1. Architecture Client NEXUS

### Comment les autres SaaS fonctionnent

| SaaS | Modèle | Accès Client | Prix |
|------|--------|--------------|------|
| **Doctolib** | Sales-driven | Démo commerciale + onboarding assisté | 89-406€/mois |
| **Calendly** | Self-service | Trial gratuit 14j + upgrade | 0-16€/mois |
| **Shopify** | Self-service | Trial 3j gratuit + assistant setup | 27-289€/mois |
| **Stripe** | Self-service | Création compte immédiate + docs | % transaction |

### Modèle NEXUS Recommandé : **Hybride Self-Service + Assistant IA**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PARCOURS CLIENT NEXUS                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. LANDING PAGE (nexus-saas.fr)                                    │
│     └─► Présentation modules + pricing + témoignages                │
│     └─► CTA: "Essai gratuit 14 jours" ou "Demander une démo"        │
│                                                                      │
│  2. INSCRIPTION (app.nexus-saas.fr/signup)                          │
│     └─► Email + mot de passe                                        │
│     └─► Choix du métier (salon, resto, médecin, commerce, autre)    │
│     └─► NEXUS configure automatiquement selon le métier             │
│                                                                      │
│  3. ONBOARDING GUIDÉ (app.nexus-saas.fr/onboarding)                 │
│     └─► Assistant IA pose 3-5 questions                             │
│     └─► Configuration auto: services, horaires, ton IA              │
│     └─► Activation numéro WhatsApp/Téléphone (1 clic)               │
│     └─► Plan recommandé basé sur besoins                            │
│                                                                      │
│  4. TRIAL 14 JOURS                                                   │
│     └─► Accès complet à tous les modules sélectionnés               │
│     └─► Limites: 50 interactions IA, 10 réservations                │
│     └─► Rappels J7 et J12 pour upgrade                              │
│                                                                      │
│  5. CONVERSION PAYANTE                                               │
│     └─► Stripe Checkout intégré                                     │
│     └─► Facturation automatique                                     │
│     └─► Portail client self-service                                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Structure des URLs

| URL | Usage |
|-----|-------|
| `nexus-saas.fr` | Landing page / site vitrine |
| `app.nexus-saas.fr` | Application admin (React) |
| `api.nexus-saas.fr` | Backend API |
| `docs.nexus-saas.fr` | Documentation (optionnel) |

---

## 2. Parcours Client Type

### Exemple: Marie, coiffeuse à Lyon

```
JOUR 1 - Découverte
├─► Marie cherche "logiciel réservation salon coiffure" sur Google
├─► Elle tombe sur nexus-saas.fr (SEO/Ads)
├─► Elle lit la page, voit les témoignages d'autres salons
└─► Elle clique "Essai gratuit 14 jours"

JOUR 1 - Inscription (2 minutes)
├─► Email: marie@salon-lyon.fr
├─► Mot de passe: ********
├─► "Quel est votre métier?" → Salon de coiffure
└─► NEXUS crée automatiquement:
    ├─► Services: Coupe homme, Coupe femme, Coloration, Brushing...
    ├─► Horaires: Mar-Sam 9h-19h (défaut salon)
    ├─► Message d'accueil IA: "Bienvenue au salon de Marie..."
    └─► Ton IA: Professionnel et chaleureux

JOUR 1 - Onboarding (5 minutes)
├─► "Comment s'appelle votre salon?" → "L'Atelier de Marie"
├─► "Quelle est votre adresse?" → "12 rue de la République, Lyon"
├─► "Quels services proposez-vous?" → [Cases pré-cochées, elle ajuste]
├─► "Voulez-vous activer WhatsApp?" → Oui
└─► NEXUS provisionne automatiquement un numéro WhatsApp

JOUR 2-14 - Utilisation Trial
├─► Marie reçoit ses premiers RDV via WhatsApp
├─► L'IA répond automatiquement aux demandes de prix
├─► Elle voit le dashboard avec ses stats
└─► Rappel J7: "Vous avez reçu 23 messages, 8 RDV. Passez en illimité!"

JOUR 14 - Conversion
├─► Marie clique "Continuer avec NEXUS"
├─► Plan suggéré: Réservations (20€) + WhatsApp IA (35€) = 55€/mois
├─► Paiement Stripe
└─► Marie est cliente payante!
```

---

## 3. État des Lieux Actuel

### Score Global: 95% technique — Commercialisation quasi prête

| Domaine | Avancement | Détail |
|---------|------------|--------|
| **Backend API** | 98% | 72 routes, 77 services, 85 migrations, Zod validation |
| **Frontend Admin** | 98% | 37 pages, 38 composants, theme dynamique, code splitting |
| **Multi-tenant** | 99% | Tenant Shield (98.1%), phoneMap, quotas, RBAC, sessions |
| **Twilio Voice/WA** | 95% | Webhooks, provisioning auto, SMS production OK |
| **Stripe Billing** | 85% | Produits créés, webhooks OK, dunning, portail client |
| **IA Admin** | 95% | 105 outils, streaming SSE, 3 tiers plan |
| **Monitoring** | 100% | SENTINEL complet (error tracking integre, remplace Sentry), mode degrade |
| **CI/CD** | 90% | 5 workflows GitHub Actions, branch protection |
| **Tests** | 70% | 310 tests backend, 17 tests frontend, Vitest + Jest |
| **Auto-config métier** | 95% | businessTemplates.js (8+ templates) |
| **Landing Page** | 90% | Construite, pas encore sur domaine final |
| **Conformité RGPD** | 90% | CGV + CGU + Privacy Policy + SIRET — bannière cookies manquante |
| **Domaine production** | 20% | Acheté, DNS à configurer |

### Ce qui est FAIT

- [x] 37 pages admin UI fonctionnelles (+ 3 extractions comptabilité)
- [x] 72 routes API backend + API publique REST v1
- [x] Authentification JWT + 2FA TOTP + RBAC + sessions
- [x] Provisioning automatique numéros Twilio (FR national + mobile)
- [x] Agent IA Voice (appels entrants) + WhatsApp + Web Chat
- [x] Chat IA Admin (105 outils, streaming SSE)
- [x] Système de modules activables + demande activation
- [x] Tracking usage par tenant + quotas + dépassement
- [x] Stripe Billing complet (checkout, portail, dunning, webhooks)
- [x] SENTINEL monitoring (snapshots, prédictions, alertes, backfill)
- [x] CI/CD (5 workflows, tests, lint tenant, build)
- [x] Theme dynamique par tenant (couleur primaire)
- [x] API keys + Webhooks sortants
- [x] Programme parrainage + SSO OIDC
- [x] Code splitting frontend (44 chunks, 0 any TypeScript)
- [x] Documents (upload Supabase Storage)
- [x] Comptabilité avancée (rapprochement, auxiliaires, expert-comptable)
- [x] Inscription self-service (signup 6 endpoints + Stripe checkout)
- [x] Auto-configuration par métier (8+ templates business)
- [x] Onboarding guidé (5 étapes)
- [x] Trial 14 jours (trialService.js + TrialBanner.tsx)
- [x] Documents légaux (CGV, CGU, RGPD, mentions légales avec SIRET)
- [x] SIRET obtenu (947 570 362 00022)

### Ce qui RESTE pour le lancement commercial

- [ ] **Domaine production** (nexus-saas.fr) — acheté, DNS à configurer
- [ ] **Bannière cookies** — composant CookieBanner à créer
- [ ] **Logo upload frontend** — backend prêt (adminDocuments.js), bouton UI à activer
- [ ] **Déploiement landing** sur domaine final
- [ ] **Beta testers** (3-5 professionnels)

### Modules futurs documentés (post-lancement)

- [ ] **Immobilisations auto** — détection à l'upload, amortissement, tableau (docs/ROADMAP_COMPTA_V2.md)
- [ ] **Clôture annuelle auto** — CCA, PCA, FNP, FAE, variation stock (docs/ROADMAP_COMPTA_V2.md)
- [ ] **Gestion email pro par IA** — lecture, tri, réponse auto, actions CRM/compta (docs/ROADMAP_COMPTA_V2.md)

---

## 4. Phase 0 - Attente SIRET (EN COURS)

### Status: SIRET en validation URSSAF

**Pendant l'attente, on peut avancer sur :**

| Tâche | Bloquée par SIRET? |
|-------|-------------------|
| Développement technique | Non |
| Landing page | Non |
| Auto-config métier | Non |
| Tests | Non |
| Configuration Stripe | **OUI** (validation finale) |
| Achat domaine | **OUI** (besoin SIRET pour WHOIS pro) |
| Documents légaux | **OUI** (mentions légales) |

### Actions à faire DÈS réception SIRET

1. Finaliser validation Stripe avec SIRET
2. Acheter domaine nexus-saas.fr
3. Ouvrir compte bancaire pro (si pas fait)
4. Rédiger mentions légales avec SIRET

---

## 5. Phase 1 - Infrastructure Landing

### Objectif
Créer le point d'entrée client: landing page + inscription

### 5.1 Achat et Configuration Domaine

```bash
# Domaines à acheter
nexus-saas.fr          # Landing + vitrine
# OU
nexus-platform.fr
getnexus.fr
```

**Registrars recommandés:**
- OVH (français, ~10€/an)
- Gandi (français, ~15€/an)
- Cloudflare (moins cher, ~8€/an)

### 5.2 Structure Hébergement

```
nexus-saas.fr (Landing - Static)
├─► Hébergement: Vercel / Netlify / Cloudflare Pages (gratuit)
├─► Framework: Next.js ou Astro (SSG)
└─► Certificat SSL: Automatique

app.nexus-saas.fr (Admin UI - React)
├─► Hébergement: Vercel / Netlify
├─► Build: Vite
└─► Certificat SSL: Automatique

api.nexus-saas.fr (Backend - Node.js)
├─► Hébergement: Render / Railway / Fly.io
├─► Port: 5000
└─► Certificat SSL: Automatique
```

### 5.3 Landing Page - Structure

```
nexus-saas.fr/
├── index.html (ou pages/)
│   ├── Hero Section
│   │   ├── Headline: "Automatisez votre business avec l'IA"
│   │   ├── Sous-titre: "Réservations, WhatsApp, appels - tout en autopilote"
│   │   └── CTA: "Essai gratuit 14 jours" + "Voir la démo"
│   │
│   ├── Section Métiers
│   │   ├── "Pour les salons de coiffure/beauté"
│   │   ├── "Pour les restaurants"
│   │   ├── "Pour les professionnels de santé"
│   │   └── "Pour les commerces"
│   │
│   ├── Section Fonctionnalités
│   │   ├── Réservations en ligne
│   │   ├── Agent IA WhatsApp
│   │   ├── Agent IA Téléphone
│   │   └── Dashboard & Analytics
│   │
│   ├── Section Pricing
│   │   ├── Plan Starter (99€)
│   │   ├── Plan Pro (249€)
│   │   └── Plan Business (499€)
│   │
│   ├── Section Témoignages
│   │   └── (À ajouter après beta)
│   │
│   ├── Section FAQ
│   │
│   └── Footer
│       ├── Liens légaux (CGV, CGU, Confidentialité)
│       ├── Contact
│       └── Réseaux sociaux
│
├── /pricing (page dédiée tarifs)
├── /features (fonctionnalités détaillées)
├── /about (à propos)
└── /contact (formulaire contact)
```

### 5.4 Tâches Phase 1

- [ ] 1.1 Acheter domaine (après SIRET)
- [ ] 1.2 Configurer DNS (Cloudflare recommandé)
- [ ] 1.3 Créer projet landing (Next.js ou Astro)
- [ ] 1.4 Développer landing page (Hero, Features, Pricing)
- [ ] 1.5 Configurer sous-domaine app.nexus-saas.fr
- [ ] 1.6 Configurer sous-domaine api.nexus-saas.fr
- [ ] 1.7 Déployer backend sur Render avec nouveau domaine
- [ ] 1.8 Mettre à jour WEBHOOK_BASE_URL Twilio

---

## 6. Phase 2 - Auto-Configuration Métier

### Objectif
Quand un client choisit son métier, NEXUS configure TOUT automatiquement.

### 6.1 Templates par Métier

```javascript
// backend/src/data/businessTemplates.js

export const BUSINESS_TEMPLATES = {
  salon_coiffure: {
    name: "Salon de coiffure",
    icon: "✂️",
    defaultServices: [
      { name: "Coupe homme", duration: 30, price: 25 },
      { name: "Coupe femme", duration: 45, price: 35 },
      { name: "Coloration", duration: 90, price: 65 },
      { name: "Brushing", duration: 30, price: 25 },
      { name: "Coupe + Brushing", duration: 60, price: 55 },
      { name: "Mèches", duration: 120, price: 85 },
    ],
    defaultHours: {
      monday: null, // Fermé
      tuesday: { open: "09:00", close: "19:00" },
      wednesday: { open: "09:00", close: "19:00" },
      thursday: { open: "09:00", close: "19:00" },
      friday: { open: "09:00", close: "19:00" },
      saturday: { open: "09:00", close: "18:00" },
      sunday: null,
    },
    iaConfig: {
      greeting: "Bonjour ! Bienvenue chez {business_name}. Comment puis-je vous aider ?",
      tone: "friendly_professional",
      canBook: true,
      canQuote: true,
      quickReplies: ["Prendre RDV", "Voir les tarifs", "Horaires"],
    },
    recommendedModules: ["reservations", "whatsapp", "seo"],
    suggestedPlan: "business", // 99€/mois
  },

  restaurant: {
    name: "Restaurant",
    icon: "🍽️",
    defaultServices: [
      { name: "Réservation 2 personnes", duration: 90, price: 0 },
      { name: "Réservation 4 personnes", duration: 90, price: 0 },
      { name: "Réservation groupe (6+)", duration: 120, price: 0 },
    ],
    defaultHours: {
      monday: null,
      tuesday: { open: "12:00", close: "14:30", evening: { open: "19:00", close: "22:30" } },
      // ... etc
    },
    iaConfig: {
      greeting: "Bienvenue chez {business_name} ! Souhaitez-vous réserver une table ?",
      tone: "warm_welcoming",
      canBook: true,
      canQuote: false,
      quickReplies: ["Réserver", "Voir le menu", "Horaires"],
    },
    recommendedModules: ["reservations", "telephone", "marketing"],
    suggestedPlan: "business",
  },

  medical: {
    name: "Cabinet médical",
    icon: "🏥",
    defaultServices: [
      { name: "Consultation générale", duration: 20, price: 25 },
      { name: "Consultation spécialisée", duration: 30, price: 50 },
      { name: "Suivi", duration: 15, price: 25 },
    ],
    defaultHours: {
      monday: { open: "08:00", close: "12:00", afternoon: { open: "14:00", close: "18:00" } },
      // ... etc
    },
    iaConfig: {
      greeting: "Cabinet du Dr {owner_name}. Comment puis-je vous aider ?",
      tone: "professional_caring",
      canBook: true,
      canQuote: false,
      quickReplies: ["Prendre RDV", "Urgence", "Renouvellement ordonnance"],
    },
    recommendedModules: ["reservations", "telephone"],
    suggestedPlan: "essential",
  },

  commerce: {
    name: "Commerce / Boutique",
    icon: "🏪",
    // ... configuration
  },

  beaute: {
    name: "Institut de beauté",
    icon: "💅",
    // ... configuration
  },

  autre: {
    name: "Autre activité",
    icon: "🏢",
    defaultServices: [],
    defaultHours: {
      monday: { open: "09:00", close: "18:00" },
      // ... etc
    },
    iaConfig: {
      greeting: "Bonjour ! Comment puis-je vous aider ?",
      tone: "professional",
      canBook: true,
      canQuote: true,
      quickReplies: ["Contact", "Informations", "Horaires"],
    },
    recommendedModules: ["whatsapp"],
    suggestedPlan: "essential",
  },
};
```

### 6.2 API Auto-Configuration

```javascript
// POST /api/tenants/setup-from-template
{
  "businessType": "salon_coiffure",
  "businessName": "L'Atelier de Marie",
  "ownerName": "Marie Dupont",
  "address": "12 rue de la République, Lyon",
  "phone": "+33612345678",
  "email": "marie@salon-lyon.fr"
}

// Response: Tenant créé avec services, horaires, config IA pré-remplis
```

### 6.3 Tâches Phase 2

- [ ] 2.1 Créer fichier `businessTemplates.js` avec 5 métiers
- [ ] 2.2 Créer API `POST /api/tenants/setup-from-template`
- [ ] 2.3 Modifier page Onboarding pour sélection métier
- [ ] 2.4 Auto-créer services selon template
- [ ] 2.5 Auto-configurer IA selon template
- [ ] 2.6 Suggérer plan adapté au métier
- [ ] 2.7 Tests unitaires templates

---

## 7. Phase 3 - Conformité Légale

### Objectif
**OBLIGATOIRE** avant tout lancement commercial

### 7.1 Documents Requis

| Document | Obligatoire | Contenu |
|----------|-------------|---------|
| **Mentions légales** | OUI | SIRET, adresse, contact, hébergeur |
| **CGV** | OUI | Prix, paiement, résiliation, litiges |
| **CGU** | OUI | Règles utilisation plateforme |
| **Politique confidentialité** | OUI | RGPD, données collectées, droits |
| **Politique cookies** | OUI | Types cookies, consentement |
| **DPA** (Data Processing Agreement) | Pour B2B | Traitement données clients |

### 7.2 RGPD - APIs à Créer

```javascript
// Routes RGPD obligatoires
GET  /api/rgpd/export/:tenantId     // Exporter toutes les données (droit d'accès)
DELETE /api/rgpd/delete/:tenantId   // Supprimer toutes les données (droit à l'oubli)
GET  /api/rgpd/consents/:tenantId   // Historique consentements
POST /api/rgpd/consent              // Enregistrer un consentement
```

### 7.3 Bannière Cookies

```jsx
// Composant CookieBanner.tsx
// Doit permettre:
// - Accepter tous
// - Refuser tous
// - Personnaliser (analytics, marketing, etc.)
// - Sauvegarder préférences
```

### 7.4 Factures Légales

Format obligatoire micro-entreprise:
- Numéro de facture séquentiel
- Date
- SIRET vendeur
- Nom et adresse client
- Description prestation
- Prix HT (TVA non applicable, art. 293B CGI)
- Conditions de paiement

### 7.5 Tâches Phase 3

- [ ] 3.1 Rédiger Mentions Légales (avec SIRET)
- [ ] 3.2 Rédiger CGV
- [ ] 3.3 Rédiger CGU
- [ ] 3.4 Rédiger Politique de confidentialité
- [ ] 3.5 Rédiger Politique cookies
- [ ] 3.6 Créer pages légales dans landing (`/legal/*`)
- [ ] 3.7 Créer composant CookieBanner
- [ ] 3.8 Implémenter API RGPD export
- [ ] 3.9 Implémenter API RGPD delete
- [ ] 3.10 Créer template facture légale PDF
- [ ] 3.11 Système numérotation factures

---

## 8. Phase 4 - Billing & Onboarding

### Objectif
Parcours inscription → trial → paiement fluide

### 8.1 Système de Trial

```javascript
// Logique trial 14 jours
const TRIAL_CONFIG = {
  duration_days: 14,
  limits: {
    ia_interactions: 50,      // 50 messages IA max
    reservations: 10,         // 10 réservations max
    sms_sent: 20,             // 20 SMS max
    voice_minutes: 30,        // 30 min appels max
  },
  reminders: [
    { day: 7, email: "trial_halfway" },
    { day: 12, email: "trial_ending_soon" },
    { day: 14, email: "trial_ended" },
  ],
};
```

### 8.2 Plans Tarifaires

| Plan | Prix | Inclus |
|------|------|--------|
| **Starter** | 99€/mois | 1 utilisateur, 1000 clients, 200 SMS/mois, CRM basique |
| **Pro** | 249€/mois | 5 utilisateurs, 5000 clients, 500 SMS/mois, 60min voix IA, CRM avancé |
| **Business** | 499€/mois | 20 utilisateurs, illimité, 2000 SMS/mois, 300min voix IA, SEO, RH, API |

### 8.3 Onboarding Guidé

```
Étape 1/5: Votre activité
├─► Choix du métier (avec icônes)
└─► NEXUS pré-configure automatiquement

Étape 2/5: Votre établissement
├─► Nom du business
├─► Adresse (autocomplete Google)
└─► Téléphone

Étape 3/5: Vos services
├─► Liste pré-remplie selon métier
├─► Possibilité d'ajouter/modifier
└─► Prix et durées

Étape 4/5: Vos horaires
├─► Grille semaine pré-remplie
└─► Ajustement facile

Étape 5/5: Activez vos canaux
├─► WhatsApp IA → [Activer] (provisioning auto)
├─► Téléphone IA → [Activer]
└─► Chatbot Web → [Activer]

✅ C'est prêt ! Votre assistant IA est configuré.
[Voir mon dashboard] [Tester mon WhatsApp]
```

### 8.4 Tâches Phase 4

- [ ] 4.1 Implémenter système trial (dates, limites)
- [ ] 4.2 Créer page signup self-service
- [ ] 4.3 Refaire page Onboarding (5 étapes guidées)
- [ ] 4.4 Intégrer Stripe Checkout
- [ ] 4.5 Créer emails trial (J7, J12, J14)
- [ ] 4.6 Page upgrade/pricing dans app
- [ ] 4.7 Portail client Stripe (gestion CB, factures)
- [ ] 4.8 Dunning (relances impayés)

---

## 9. Phase 5 - Tests & Stabilisation

### Objectif
Garantir la qualité avant ouverture

### 9.1 Tests à Implémenter

| Type | Outil | Couverture cible |
|------|-------|------------------|
| Unit Backend | Jest | 80% |
| Unit Frontend | Vitest | 60% |
| E2E | Playwright | Parcours critiques |
| Charge | k6 | 100 users simultanés |

### 9.2 Scénarios E2E Critiques

1. **Inscription complète**
   - Landing → Signup → Onboarding → Dashboard
2. **Activation module**
   - Dashboard → Module → Activation → Provisioning
3. **Réception message WhatsApp**
   - Client envoie message → IA répond → Notif admin
4. **Réservation**
   - Client demande RDV → IA propose créneaux → Confirmation
5. **Paiement**
   - Trial expire → Upgrade → Stripe → Accès maintenu

### 9.3 Tâches Phase 5

- [ ] 5.1 Configurer Vitest frontend
- [ ] 5.2 Écrire tests composants critiques
- [ ] 5.3 Configurer Playwright
- [ ] 5.4 Écrire 5 scénarios E2E
- [ ] 5.5 Test de charge k6
- [ ] 5.6 Audit sécurité (npm audit, headers)
- [ ] 5.7 Corriger bugs identifiés

---

## 10. Phase 6 - Pré-lancement

### Objectif
Préparer le go-to-market

### 10.1 Beta Testers

- Recruter 3-5 vrais professionnels (salons, restos...)
- Offrir 3 mois gratuits en échange de feedback
- Collecter témoignages pour landing page

### 10.2 Support Client

- [ ] Email support: support@nexus-saas.fr
- [ ] WhatsApp support (avec notre propre IA!)
- [ ] Base de connaissances (FAQ)
- [ ] SLA: Réponse < 24h

### 10.3 Documentation

- [ ] Guide démarrage rapide (PDF)
- [ ] FAQ sur landing page
- [ ] Vidéos tutoriels (optionnel, phase 2)

### 10.4 Tâches Phase 6

- [ ] 6.1 Recruter 3-5 beta testers
- [ ] 6.2 Onboarder beta testers manuellement
- [ ] 6.3 Collecter feedback (2-3 semaines)
- [ ] 6.4 Corriger bugs remontés
- [ ] 6.5 Obtenir témoignages écrits
- [ ] 6.6 Préparer email support
- [ ] 6.7 Rédiger FAQ
- [ ] 6.8 Créer guide démarrage PDF

---

## 11. Phase 7 - Lancement

### 11.1 Soft Launch (Semaine 1)

- Ouvrir inscriptions (invitation only)
- Monitoring intensif
- Support très réactif
- Objectif: 10 clients

### 11.2 Public Launch (Semaine 2-4)

- Ouvrir inscriptions publiques
- Campagne Google Ads (budget: 200€)
- Posts réseaux sociaux
- Objectif: 50 clients

### 11.3 Métriques à Suivre

| Métrique | Objectif M1 | Objectif M3 |
|----------|-------------|-------------|
| Inscriptions | 50 | 200 |
| Conversions payantes | 10 | 50 |
| MRR | 500€ | 3000€ |
| Churn | < 10% | < 5% |

### 11.4 Tâches Phase 7

- [ ] 7.1 Activer inscriptions sur landing
- [ ] 7.2 Configurer Google Analytics
- [ ] 7.3 Lancer campagne Google Ads
- [ ] 7.4 Posts LinkedIn/Instagram
- [ ] 7.5 Monitoring quotidien
- [ ] 7.6 Répondre support < 24h
- [ ] 7.7 Itérer selon feedback

---

## 12. Checklist Pré-Lancement

### Administratif
- [ ] SIRET reçu
- [ ] Compte bancaire pro ouvert
- [ ] Stripe vérifié avec SIRET
- [ ] Domaine acheté

### Technique
- [ ] Landing page live
- [ ] App accessible (app.nexus-saas.fr)
- [ ] API accessible (api.nexus-saas.fr)
- [ ] Webhooks Twilio configurés
- [ ] SSL sur tous les domaines
- [ ] Monitoring actif

### Légal
- [ ] Mentions légales publiées
- [ ] CGV/CGU publiées
- [ ] Politique confidentialité
- [ ] Bannière cookies
- [ ] Template facture légal

### Produit
- [ ] Inscription self-service fonctionne
- [ ] Onboarding guidé fonctionne
- [ ] Trial 14 jours actif
- [ ] Paiement Stripe fonctionne
- [ ] Au moins 3 métiers configurés
- [ ] Tests E2E passent

### Marketing
- [ ] 3+ témoignages
- [ ] FAQ complète
- [ ] Guide démarrage
- [ ] Compte Google Ads
- [ ] Analytics configuré

---

## 13. Ressources

### Documentation
- [Stripe Docs](https://stripe.com/docs)
- [Twilio Docs](https://www.twilio.com/docs)
- [CNIL - RGPD](https://www.cnil.fr/fr/rgpd-par-ou-commencer)

### Outils Recommandés
- **Domaine**: OVH, Gandi, Cloudflare
- **Hébergement Landing**: Vercel, Netlify
- **Hébergement API**: Render, Railway
- **Monitoring**: UptimeRobot (gratuit), Better Uptime
- **Analytics**: Plausible (RGPD-friendly) ou GA4
- **Support**: Crisp (gratuit), ou notre propre WhatsApp

### Recherches Effectuées

Sources consultées pour ce roadmap:
- [SaaS Landing Page Trends 2026](https://www.saasframe.io/blog/10-saas-landing-page-trends-for-2026-with-real-examples)
- [SaaS Onboarding Best Practices 2025](https://productled.com/blog/5-best-practices-for-better-saas-user-onboarding)
- [B2B SaaS Onboarding Guide](https://encharge.io/effective-b2b-saas-onboarding/)
- [Micro-entreprise France Guide](https://en.sedomicilier.fr/articles/microentreprise-guide-complet)
- [SaaS Compliance 2025](https://www.scrut.io/post/saas-compliance)
- [Doctolib Business Model](https://alexandre.substack.com/p/doctolib-the-all-in-one-solution)
- [SaaS Conversion Benchmarks](https://firstpagesage.com/seo-blog/saas-free-trial-conversion-rate-benchmarks/)

---

## Timeline Résumée

```
MAINTENANT    │ Phase 0: Attente SIRET (continuer dev technique)
              │
Semaine 1-2   │ Phase 1: Landing + Domaine
Semaine 2-3   │ Phase 2: Auto-config métier
Semaine 3-4   │ Phase 3: Conformité légale ⚠️
Semaine 4-5   │ Phase 4: Billing & Onboarding
Semaine 5-6   │ Phase 5: Tests & Stabilisation
Semaine 6-7   │ Phase 6: Beta testers
Semaine 7-8   │ Phase 7: Lancement
              │
              ▼
          🚀 GO LIVE
```

**Estimation: 6-8 semaines après réception SIRET**

---

*Document maintenu par l'équipe NEXUS*
*Version 3.0 - Roadmap Complète avec Recherches*
