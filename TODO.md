# NEXUS — TODO UNIQUE CONSOLIDÉ

> **Dernière mise à jour :** 18 mars 2026
> **Source :** Audit complet codebase (ROADMAP.md, ROADMAP_SENTINEL.md, AUDIT-REPORT.md, AUDIT-V2-REPORT.md, memory)
> **Objectif :** Un seul endroit pour TOUT ce qui reste à faire

---

## ÉTAT RÉEL DU PROJET — CE QUI EST FAIT ✅

### Infrastructure & Déploiement
- [x] Domaine `nexus-ai-saas.com` acheté et configuré (OVH)
- [x] `app.nexus-ai-saas.com` → admin-ui (Render: nexus-admin)
- [x] `nexus-ai-saas.com` → landing (Render: nexus-vitrine)
- [x] Backend déployé sur Render (nexus-backend-dev)
- [x] SSL automatique sur tous les sous-domaines
- [x] Proxy API dans admin-ui/server.js et landing/server.js
- [x] render.yaml avec 4 services configurés
- [x] Emails vérifiés sur Resend (`noreply@nexus-ai-saas.com`)

### Landing Page
- [x] Page complète : Hero, Features, Pricing, FAQ, Témoignages, Contact, Chatbot IA
- [x] 10 composants (ContactForm, DemosSection, FAQSection, GallerySlideshow, NexusChat, PricingSection, etc.)
- [x] robots.txt + sitemap.xml
- [x] Déployée sur Render

### SENTINEL & Super-Admin
- [x] sentinel.init() appelé au démarrage (index.js:792)
- [x] Uptime monitoring (scan 60s) + backup scheduler (24h)
- [x] Jobs SENTINEL planifiés : snapshot quotidien 00h30 + insights hebdo lundi 9h
- [x] Email alerting implémenté via Resend (URGENT) + SMS via Twilio (CRITICAL)
- [x] Cooldown anti-spam 30min entre alertes identiques
- [x] nexusAdmin.js : 16+ endpoints super-admin (dashboard, tenants, sentinel, billing, backups)
- [x] sentinelIntelligenceRouter, sentinelAutopilotRouter, sentinelLiveRouter, optimizationRouter
- [x] 6 pages Super-Admin UI (Login, Dashboard, Tenants, Billing, Settings, Sentinel 7 tabs)
- [x] requireSuperAdmin + requireAdminPlan middleware sur toutes les routes

### Conformité Légale
- [x] CGV rédigées (backend /api/cgv, version 1.0, 9 articles)
- [x] CGU rédigées (TermsOfService.tsx, 12 sections, SIREN/SIRET inclus)
- [x] Politique de confidentialité (PrivacyPolicy.tsx, 13 sections RGPD)
- [x] SIRET 947 570 362 00022 intégré dans les documents légaux
- [x] RGPD Export (GET /api/rgpd/export) — Article 20
- [x] RGPD Droit à l'oubli (DELETE /api/rgpd/delete-request + job 30j grâce)
- [x] RGPD Anonymisation client (/api/rgpd/anonymize-client/:id) — Article 17
- [x] RGPD Consentement (POST/GET/DELETE /api/rgpd/consent) — 4 canaux (sms, whatsapp, email, marketing)
- [x] Migration 082 client_consents + Migration 044 rgpd_requests
- [x] RGPD Deletion Job automatisé (cascade 13 tables)
- [x] Factures PDF (pdfService.js avec PDFKit, branding tenant, footer légal SIRET/TVA)
- [x] Numérotation factures séquentielle
- [x] CGV acceptance tracking (migration 070)

### Billing & Stripe
- [x] Trial 14 jours complet (trialService.js, 5 limites : IA 50, réservations 10, SMS 20, emails 100, clients 50)
- [x] TrialBanner.tsx (jours restants, usage, CTA upgrade)
- [x] Stripe Checkout (createCheckoutSession + createOneTimeCheckout)
- [x] Stripe Webhooks (6 events : subscription created/updated/deleted, invoice paid/failed, trial_will_end)
- [x] Idempotence webhooks (stripe_processed_events table)
- [x] Dunning complet (3 échecs → suspension, emails escalation)
- [x] Customer Portal (createPortalSession)
- [x] Billing routes : 11 endpoints (subscription CRUD, invoices, payment methods, portal)
- [x] Trial routes : 5 endpoints (status, limits, check, extend, convert)
- [x] Anti-fraude signup (unicité email/phone/SIRET, rate limit 3/h par IP)
- [x] Prévention double trial (hasHadTrial check)

### Signup & Onboarding
- [x] Signup self-service (POST /api/signup, 786 lignes, validation complète)
- [x] Auto-onboarding : services, horaires, agent_config, ia_config depuis templates
- [x] 5 endpoints signup (plans, secteurs, business-types, check-email, check-company)
- [x] Onboarding.tsx 5 étapes (type activité, infos, services, horaires, canaux IA)
- [x] Subscription.tsx (comparaison plans, toggle mensuel/annuel, historique factures)

### Auto-Config Métier
- [x] businessTemplates.js : 10 templates (salon, beauté, restaurant, medical, garage, commerce, artisan, hotel, security, autre)
- [x] POST /api/tenants/setup-from-template fonctionnel
- [x] Mapping secteur → template dans signup.js
- [x] 6 business types (service_domicile, salon, restaurant, hotel, commerce, security)

### Tests & CI/CD
- [x] 28 tests backend (Jest, Node ESM)
- [x] 2 tests admin-ui (Vitest)
- [x] 4 tests E2E (Playwright, 5 browsers)
- [x] vitest.config.ts configuré
- [x] playwright.config.ts configuré (5 navigateurs dont mobile)
- [x] 5 GitHub Actions workflows (ci, deploy-production, deploy-staging, security, tenant-shield)
- [x] Tenant Shield lint dans CI
- [x] Coverage backend activée

### Modules & Features
- [x] 37+ pages admin UI
- [x] 72+ routes API
- [x] Auth JWT + 2FA TOTP + RBAC + sessions
- [x] Twilio Voice/WhatsApp/SMS
- [x] Chat IA Admin (105 outils, streaming SSE)
- [x] Système modules activables par plan
- [x] API publique REST v1
- [x] API keys + Webhooks sortants
- [x] Programme parrainage
- [x] SSO OIDC (Google)
- [x] Theme dynamique par tenant
- [x] Comptabilité avancée
- [x] SENTINEL Error Tracker (remplace Sentry)
- [x] Workflows (10 triggers, 9 actions)
- [x] Pipeline CRM (6 étapes)
- [x] RFM Segmentation (11 segments)

---

## CE QUI RESTE À FAIRE ❌

### A. LANCEMENT COMMERCIAL (Pré-requis)

#### A1. Corrections Landing Page [FAIT ✅ — 18 mars 2026]
- [x] **Liens login/signup corrigés** — 7 URLs `nexus-admin-yedu.onrender.com` → `app.nexus-ai-saas.com` (App.jsx + PricingSection.jsx)
- [x] **Footer liens légaux** — CGV, Confidentialité, Mentions légales ouvrent des modales avec contenu complet

#### A2. Mentions Légales [FAIT ✅ — 18 mars 2026]
- [x] **Page Mentions Légales créée** — `landing/src/components/MentionsLegales.jsx` (SIRET, adresse, hébergeur, directeur publication)
- [x] **Politique de Confidentialité créée** — `landing/src/components/Confidentialite.jsx` (8 sections RGPD)
- [x] **CGV landing créées** — `landing/src/components/LandingCGV.jsx` (fetch `/api/cgv`)
- [x] **Footer landing mis à jour** — liens ouvrent modales plein écran

#### A3. Bannière Cookies [FAIT ✅ — 18 mars 2026]
- [x] **CookieBanner créé** — `landing/src/components/CookieBanner.jsx`
- [x] **3 boutons CNIL** : Accepter tout / Refuser tout / Personnaliser
- [x] **Préférences localStorage** — persistance + expiration 365j
- [x] **Intégré dans admin-ui** — `admin-ui/src/components/CookieBanner.tsx`

#### A4. Cohérence structure juridique [FAIT ✅ — 18 mars 2026]
- [x] **Backend cgv.js** — "NEXUS SAS" → "NEXUS AI, SASU au capital de 1€, SIRET 947 570 362 00022"
- [x] **Admin-ui CGV.tsx** — "NEXUS SAS" → "NEXUS AI — SASU — SIRET 947 570 362 00022"

#### A5. Logo Upload [FAIT ✅ — 18 mars 2026]
- [x] **Bouton upload logo activé** — admin-ui/src/pages/Parametres.tsx (upload vers Supabase Storage + PUT /api/branding)

---

### B. PATWINSSERIE — BETA TESTER PRIORITAIRE

#### B1. Module Closing Automatisé [FAIT ✅ — 18 mars 2026]
- [x] **Trigger `payment_received`** ajouté (+ `facture_payee` désormais câblé)
- [x] **Triggers déclenchés** depuis factures.js (PATCH statut + POST paiement)
- [x] **3 templates closing** : `closing_contrat`, `closing_acces`, `closing_communaute`
- [x] **Séquence avec délais** : Mail 1 (immédiat), Mail 2 (24h), Mail 3 (48h)
- [x] **Action `move_pipeline`** ajoutée (déplace automatiquement vers "gagné")
- [x] **Template workflow "Séquence closing"** prédéfini dans adminWorkflows.js

#### B2. Signature Électronique Yousign [FAIT ✅ — 18 mars 2026]
- [x] **`yousignService.js`** — API v3 Yousign (création, upload, signataire, activation, statut)
- [x] **`yousignWebhook.js`** — webhook signature_request.done/declined/expired + signer.done
- [x] **`adminSignatures.js`** — 3 endpoints admin (GET list, POST create, GET status)
- [x] **Trigger `contract_signed`** — déclenché automatiquement quand Yousign confirme la signature
- [x] **Migration 084** — table `signature_requests` avec RLS + indexes
- [x] **Routes enregistrées** dans index.js (webhook + admin)
- [x] **UI admin Signatures** — `admin-ui/src/pages/Signatures.tsx`
- [x] **YOUSIGN_API_KEY** configurée (sandbox)
- [ ] **Env vars restantes** : YOUSIGN_WEBHOOK_SECRET (à configurer sur dashboard Yousign)

#### B3. Setter IA Instagram [FAIT ✅ — 18 mars 2026]
- [x] **`instagramSetterService.js`** — service complet (qualification, scoring, relances, création prospect CRM)
- [x] **`instagramWebhook.js`** — webhook Meta (GET verification + POST messages)
- [x] **Délai intelligent** — 45min configurable avant premier message
- [x] **Flow 4 questions** — domaine, objectif, timeline, budget (scoring par mots-clés)
- [x] **Scoring** — seuil 60 pts, calcul par champ + longueur réponse
- [x] **Relance auto** — J+1 + J+3, max 2 relances
- [x] **Création prospect CRM** — client + opportunité pipeline automatiques si qualifié
- [x] **Envoi Calendly** si qualifié (URL configurable dans tenant.config)
- [x] **Migration 085** — tables `ig_setter_conversations` + `ig_setter_messages` avec RLS
- [x] **Intégration scheduler** — actions ig_setter dans processScheduledActions
- [x] **Instagram Pro account** — compte Business activé (issouftoure582026)
- [ ] **Meta Business verification** — Page Facebook créée, en attente API Meta (compte FB trop récent)
- [ ] **Env vars à configurer** : INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_PAGE_ID, INSTAGRAM_APP_SECRET
- [x] **UI admin** — `admin-ui/src/pages/InstagramSetter.tsx`

#### B4. Questionnaire Qualification [FAIT ✅ — 18 mars 2026]
- [x] **Routes backend** — `questionnaires.js` (public CRUD + admin CRUD + scoring engine)
- [x] **Scoring multi-types** — select, radio, number, range, text, checkbox avec seuils configurables
- [x] **Routing CRM** — qualifié → client + opportunité pipeline / disqualifié → prospect nurture
- [x] **Workflow trigger** — déclenche workflows automatiques sur soumission
- [x] **Page admin UI** — `Questionnaires.tsx` (liste, création, toggle actif, soumissions, lien public)
- [x] **Migration 086** — tables `questionnaires` + `questionnaire_submissions` avec RLS

#### B5. Dashboard Qualiopi [FAIT ✅ — 18 mars 2026]
- [x] **Routes backend** — `qualiopi.js` (12 types documents, conformité par apprenant, alertes)
- [x] **Checklist documents** — contrat, programme, CGV, émargement, évaluations, satisfaction, attestation, certificat
- [x] **Alertes severity** — critical (6+ manquants), warning (3+), info
- [x] **Versioning documents** — historique versions par document
- [x] **Page admin UI** — `Qualiopi.tsx` (apprenants, barres conformité, checklist, validation)
- [x] **Migration 087** — table `qualiopi_documents` avec RLS

#### B6. Enquêtes Satisfaction [FAIT ✅ — 18 mars 2026]
- [x] **Routes backend** — `satisfaction.js` (templates chaud/froid, envoi email/SMS, résultats)
- [x] **Templates** — 8 questions à chaud (rating + textarea + radio) + 6 questions à froid
- [x] **Distribution** — envoi par email (Resend) ou SMS (Twilio) avec token unique
- [x] **Reporting** — moyennes par question, distribution, moyenne globale
- [x] **Page admin UI** — `Satisfaction.tsx` (création, stats, résultats par enquête)
- [x] **Migration 088** — tables `satisfaction_enquetes` + `satisfaction_envois` + `satisfaction_reponses` avec RLS

#### B7. Discord Automation [FAIT ✅ — 18 mars 2026]
- [x] **`discordService.js`** — API Discord v10 (createInvite, sendDM, sendInviteByEmail)
- [x] **Action workflow `send_discord_invite`** — intégré dans workflowEngine.js

---

### C. AMÉLIORATIONS TECHNIQUES

#### C1. Tests [PRIORITÉ MOYENNE]
- [ ] **Tests charge k6** — 100 users simultanés (aucune config k6 existante)
- [ ] **Augmenter tests frontend** — seulement 2 tests admin-ui actuellement
- [ ] **Tests E2E parcours critiques** — inscription complète, paiement, réservation

#### C2. Landing Page [PRIORITÉ BASSE]
- [ ] **Blog tenant** — blog hébergé par NEXUS sur sous-domaine tenant (SSR pour SEO Google)
- [ ] **Guide SEO tenant** — pas-à-pas Google Search Console + Google Business Profile

#### C3. Internationalisation [PRIORITÉ BASSE]
- [ ] **i18n FR + EN** — react-i18next (~90 fichiers, faire incrémentalement)

---

### D. FINANCEMENT (Initiactive 95 — Dossier déposé)

#### D1. En attente [DOSSIER DÉPOSÉ]
- [x] Business plan complet
- [x] Prévisionnel financier
- [x] CV fondateur
- [x] SIRET obtenu (947 570 362 00022)
- [x] Dossier déposé Initiactive 95
- [ ] **Passage en comité** — présentation 15-20 min + questions
- [ ] **Transformation micro → SASU** (si décidé, ~220€, 1-2 semaines)
- [ ] **Demande ACRE** (45 jours max après création SASU)
- [ ] **Demande NACRE** (prêt 0%, 10 000€ max)

#### D2. Étapes suivantes financement
- [ ] **WILCO** — candidature accélérateur (prêt d'honneur 30 000€)
- [ ] **Prêt bancaire** — après prêts d'honneur (30 000€ + garantie BPI 60%)
- [ ] **BPI Bourse French Tech** — subvention jusqu'à 50 000€
- [ ] **Région IDF TP'UP** — subvention jusqu'à 55 000€

---

## ORDRE DE PRIORITÉ GLOBAL

```
IMMÉDIAT (cette semaine) — ✅ FAIT
├── A1. Corriger liens landing page ✅
├── A2. Page mentions légales + confidentialité + CGV landing ✅
├── A3. Bannière cookies landing ✅ (admin-ui restant)
└── A4. Cohérence structure juridique dans CGV ✅

COURT TERME — Beta Patwinsserie ✅ TOUT FAIT
├── B1. Module closing automatisé ✅
├── B2. Intégration Yousign ✅ (backend + UI + clé sandbox)
├── B3. Setter IA Instagram ✅ (backend + UI, en attente config Meta API)
├── B4. Questionnaire qualification ✅ (backend + UI + migration)
├── B5. Dashboard Qualiopi ✅ (backend + UI + migration)
├── B6. Enquêtes satisfaction ✅ (backend + UI + migration)
└── B7. Discord automation ✅ (service + action workflow)

MOYEN TERME (1-2 mois)
├── C1. Tests charge + tests frontend
├── D1. Suivi financement (comité, SASU, ACRE, NACRE)
└── Meta Business API (quand compte FB mature)

LONG TERME (3+ mois)
├── C2. Blog tenant + Guide SEO
├── C3. i18n FR + EN
└── D2. WILCO + prêt bancaire + BPI + Région IDF
```

---

## FICHIERS DE RÉFÉRENCE (ne plus consulter les anciens)

| Ancien fichier | Statut | Remplacé par |
|----------------|--------|--------------|
| ROADMAP.md | OBSOLÈTE | **TODO.md** (ce fichier) |
| ROADMAP_SENTINEL.md | OBSOLÈTE (tout fait) | **TODO.md** |
| ROADMAP_100.md | TERMINÉ 100/100 | Archive |
| AUDIT-REPORT.md | Bugs corrigés | Archive |
| AUDIT-V2-REPORT.md | Bugs corrigés | Archive |

---

*Généré par audit complet du 18 mars 2026*
*Version codebase: 3.24.0*
