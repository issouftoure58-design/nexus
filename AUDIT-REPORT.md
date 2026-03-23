# AUDIT COMPLET NEXUS — 14 mars 2026

## Score Global: 7.8/10 — Blocages critiques avant lancement

3 audits paralleles: Backend (74 routes, 81 services), Frontend (58 pages, 2 menus), Onboarding & Plans.

---

## BUGS CRITIQUES (bloquants pour un nouveau client)

### BUG #1 — Quotas clients desynchronises frontend/backend
**Severite: CRITIQUE**
- Frontend `useTenant.ts:198-222`: `starter.clients_max = 1000`, `pro = 3000`
- Backend `planFeatures.js:113-116`: `starter.clients_max = 200`, `pro = 2000`
- **Impact**: Un Starter cree 500 clients pensant etre dans la limite de 1000, le backend bloque a 200
- **Fichiers**: `admin-ui/src/hooks/useTenant.ts` + `backend/src/config/planFeatures.js`

### BUG #2 — checkUsageLimit middleware jamais monte sur les routes
**Severite: CRITIQUE**
- Le middleware `checkPlan.js:149-297` definit `checkUsageLimit()` mais AUCUNE route ne l'utilise
- `grep -r "checkUsageLimit" backend/src/routes/` → 0 resultats
- **Impact**: Les quotas ne sont JAMAIS appliques — un Starter peut creer des clients illimites
- **Fichier**: `backend/src/middleware/checkPlan.js` (defini mais non utilise)

### BUG #3 — GlobalMenu ne filtre PAS par plan
**Severite: HAUTE**
- `GlobalMenu.tsx:102-105`: filtre uniquement `businessType` et `hideFor`, ignore `plan`
- Un Starter voit Analytics, Comptabilite, Stock, RH, CRM, Pipeline, SEO, Sentinel dans le menu
- Clic → `ModuleRoute` affiche upgrade modal, mais UX confuse
- **Fichier**: `admin-ui/src/components/layout/GlobalMenu.tsx`

### BUG #4 — Mapping plan incorrect dans Sidebar MODULE_TO_PLAN
**Severite: HAUTE**
- `Sidebar.tsx:104`: `marketing: 'pro'` → devrait etre `'business'` (planFeatures = business)
- `Sidebar.tsx:106`: `analytics: 'pro'` → devrait etre `'business'`
- `Sidebar.tsx:107`: `ecommerce: 'pro'` → devrait etre `'starter'`
- **Impact**: Pro voit marketing/analytics comme deverrouilles, mais backend bloque (403)
- **Fichier**: `admin-ui/src/components/layout/Sidebar.tsx:94-118`

### BUG #5 — GlobalMenu plan values incorrects
**Severite: HAUTE** (dormant car plan non filtre, mais deviendra bug quand #3 sera fixe)
- `GlobalMenu.tsx:37`: `analytics: plan 'pro'` → doit etre `'business'`
- `GlobalMenu.tsx:40`: `rh: plan 'pro'` → doit etre `'business'`
- `GlobalMenu.tsx:44`: `pipeline: plan 'pro'` → doit etre `'business'`
- **Fichier**: `admin-ui/src/components/layout/GlobalMenu.tsx:22-55`

---

## BUGS MOYENS (fonctionnement degrade)

### BUG #6 — getBaseAddress() default tenant hardcode
**Severite: MOYENNE**
- `bookingService.js:80`: `getBaseAddress(tenantId = 'fatshairafro')`
- Si appele sans argument → calcul de distance avec adresse de Franconville pour TOUS les tenants
- Fallback `FATOU_ADDRESS` utilise dans catch (ligne 84-86)
- **Fichier**: `backend/src/services/bookingService.js:73-88`

### BUG #7 — Echecs silencieux pendant auto-onboarding
**Severite: MOYENNE**
- `signup.js:507-635`: Si creation services/heures/IA echoue, signup continue quand meme
- User peut arriver sur un dashboard vide sans comprendre pourquoi
- Pas de tracking de l'etat d'onboarding (quelles etapes reussies/echouees)
- **Fichier**: `backend/src/routes/signup.js`

### BUG #8 — tenantCache fallback limite a fatshairafro
**Severite: MOYENNE**
- `tenantCache.js:19`: `STATIC_FALLBACK = { fatshairafro: fatshairafroStatic }`
- Si DB down → seul fatshairafro charge, tous les autres tenants → null
- **Fichier**: `backend/src/config/tenants/tenantCache.js`

### BUG #9 — phoneBookingService hardcode pour fatshairafro
**Severite: MOYENNE**
- Utilise `SALON_INFO.adresse` au lieu de lookup dynamique par tenant
- Ne fonctionne correctement que pour fatshairafro
- **Fichier**: `backend/src/services/phoneBookingService.js`

---

## BUGS MINEURS (cosmetique / dette technique)

### BUG #10 — 42 fichiers referencent "fatshairafro"
- Dont: bookingService, tenantCache, tenantBusinessRules, businessRules, templates
- La plupart sont legacy/intentionnels, mais creent de la confusion
- **Action**: Auditer chaque reference, documenter lesquelles sont intentionnelles

### BUG #11 — Comment hardcode dans index.js
- `backend/src/index.js:2`: `/** Backend API - Fat's Hair-Afro`
- Devrait etre `/** Backend API - NEXUS Multi-tenant Platform`

### BUG #12 — localStorage direct dans App.tsx/AppLayout.tsx
- `App.tsx:84-86` et `AppLayout.tsx:49-51`: acces direct localStorage au lieu de `api.getToken()`
- Pattern de migration acceptable, mais incoherent avec le reste

### BUG #13 — Prix launch offer hardcodes dans Onboarding.tsx
- `Onboarding.tsx:106-128`: prix 79/199/399€ (launch) hardcodes
- Ne correspond pas a `pricing.js` (99/249/499€)
- Onboarding.tsx est marque comme legacy/unused mais le code est toujours la

---

## COHERENCE BUSINESS TYPES — VALIDE ✅

| Business Type | Config | Templates | Frontend Adapt | IA Tools | Navigation | Status |
|--------------|--------|-----------|---------------|----------|------------|--------|
| service_domicile | ✅ | ✅ | ✅ | ✅ 12 gen | ✅ | OK |
| salon | ✅ | ✅ | ✅ | ✅ 12 gen | ✅ | OK |
| restaurant | ✅ | ✅ | ✅ Menu/Salle | ✅ 12+4 | ✅ | OK |
| hotel | ✅ | ✅ | ✅ Chambres/Tarifs | ✅ 12+3 | ✅ | OK |
| commerce | ✅ | ✅ | ✅ Commandes | ✅ 12+commerce | ✅ | OK |
| security | ✅ | ✅ | ⚠️ Partiel (Services) | ✅ 12+security | ✅ | OK |

- `businessTypes.js`: 6 types complets (491 lignes), 15 helpers
- `businessTemplates.js`: templates pour les 6 types
- `ProfileContext.tsx`: union type + hooks pour les 6 types
- `BusinessTypeField.tsx`: composants wrapper reutilisables
- Navigation: `businessType`, `hideFor`, `hideForBusinessTypes` fonctionnent correctement
- **Pas de conflit cross-business type** — isolation propre

---

## ARCHITECTURE BACKEND — SOLIDE ✅

| Composant | Score | Detail |
|-----------|-------|--------|
| Tenant Shield | 9.5/10 | Middleware global, validation body, cross-tenant blocker |
| Auth & RBAC | 9/10 | JWT sans fallback prod, TOTP 2FA, rate limiting, lockout |
| Route Registration | 9/10 | 85 routes montees, middleware ordonne correctement |
| Services | 7/10 | Bonnes pratiques mais defaults hardcodes (fatshairafro) |
| Plans/Modules | 9/10 | Gating propre, 403 descriptifs, route-to-module mapping |
| Error Tracking | 10/10 | Sentinel = drop-in Sentry, SHA-256 fingerprint, redaction |
| Business Config | 10/10 | Source de verite unique, exhaustif |

---

## ARCHITECTURE FRONTEND — SOLIDE ✅

| Composant | Score | Detail |
|-----------|-------|--------|
| Routes | 10/10 | 58 pages, 0 orphelines, 0 imports casses |
| Sidebar (desktop) | 8/10 | Bon gating modules mais 3 mappings plan incorrects |
| GlobalMenu (mobile) | 5/10 | Plan property jamais verifie → tout visible |
| API Client | 10/10 | Centralise, auto-inject JWT+tenant, 401 handling |
| Business Type UI | 9/10 | 6 types adaptes, composants reutilisables |
| ModuleGate | 9/10 | Upgrade modal propre quand module non dispo |

---

## MATRICE PLAN x MODULE — ETAT REEL

| Module | Plan requis (backend) | Sidebar dit | GlobalMenu dit | Route protegee |
|--------|----------------------|-------------|----------------|----------------|
| Dashboard | Starter | ✅ alwaysShow | ✅ visible | N/A |
| Reservations | Starter | ✅ starter | ✅ visible | ✅ |
| Facturation | Starter | ✅ starter | ✅ visible | ✅ |
| Agent IA Web | Starter | ✅ starter | ✅ visible | ✅ |
| E-commerce | Starter | ❌ dit 'pro' | ✅ visible | ✅ |
| WhatsApp | Pro | ✅ pro | N/A | ✅ |
| Telephone | Pro | ✅ pro | N/A | ✅ |
| Comptabilite | Pro | ✅ pro | pro ✅ | ✅ |
| Stock | Pro | ✅ pro | pro ✅ | ✅ |
| Devis | Pro | marketing ❌ | pro ⚠️ | ✅ |
| Analytics | **Business** | ❌ dit 'pro' | ❌ dit 'pro' | ✅ |
| Marketing/CRM | **Business** | ❌ dit 'pro' | ❌ dit 'pro' | ✅ |
| Pipeline | **Business** | marketing ❌ | ❌ dit 'pro' | ✅ |
| RH | **Business** | ✅ business | ❌ dit 'pro' | ✅ |
| SEO | Business | ✅ business | ✅ business | ✅ |
| Sentinel | Business | ✅ business | ✅ business | ✅ |

**Legende**: ❌ = mauvais mapping, ⚠️ = correct mais plan jamais verifie

---

## PLAN D'ACTION PRIORITAIRE

### Sprint 1 — Blockers (avant tout lancement)
1. **Synchroniser quotas** frontend/backend (BUG #1)
2. **Monter checkUsageLimit** sur routes clients/reservations (BUG #2)
3. **Ajouter filtre plan** dans GlobalMenu (BUG #3)
4. **Corriger MODULE_TO_PLAN** dans Sidebar (BUG #4)
5. **Corriger plan values** dans GlobalMenu (BUG #5)

### Sprint 2 — Qualite (semaine suivante)
6. Supprimer default tenant dans getBaseAddress (BUG #6)
7. Tracker etapes onboarding (BUG #7)
8. Enrichir tenantCache fallback (BUG #8)
9. Refactorer phoneBookingService (BUG #9)

### Sprint 3 — Nettoyage
10-13. Dette technique, comments, localStorage, prix legacy
