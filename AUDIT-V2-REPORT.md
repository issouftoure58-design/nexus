# AUDIT V2 APPROFONDI NEXUS — 14 mars 2026

## Score Global: 6.8/10 — Problèmes significatifs découverts

5 audits parallèles: Routes & Middleware, Contrats Frontend/Backend, Plans/Modules/Navigation, Business Types, Sécurité & Edge Cases.

---

## CRITIQUE — Bugs bloquants à corriger immédiatement

### BUG V2-1 — Stock.tsx : Prix multipliés par 100 deux fois
**Sévérité: CRITIQUE**
- Frontend `Stock.tsx:471-473` : `prix_achat: Math.round(formData.prix_achat * 100)` (envoie centimes)
- Backend `adminStock.js:89,133` : `prix_achat_unitaire: Math.round(parseFloat(prix_achat) * 100)` (multiplie encore)
- **Impact** : Un produit à 10€ est stocké à 100000 centimes (1000€). Toute création/modification de stock produit des prix 100× trop élevés.
- **Fix** : Backend ne doit PAS faire `*100` si frontend envoie déjà en centimes.

### BUG V2-2 — adminOrders.js & adminDisponibilites.js : Routes TOUJOURS en 401
**Sévérité: CRITIQUE**
- `adminOrders.js:9` : `router.use(requireModule('ecommerce'))` AVANT `authenticateAdmin`
- `adminDisponibilites.js:9` : `router.use(requireModule('reservations'))` AVANT `authenticateAdmin`
- `requireModule` cherche `req.admin.tenant_id` qui est null → retourne 401 systématiquement
- **Impact** : TOUTES les routes `/api/admin/orders/*` et `/api/admin/disponibilites/*` sont inaccessibles. Les pages Commandes et Disponibilités ne fonctionnent pas.
- **Fix** : `router.use(authenticateAdmin, requireModule(...))` — auth d'abord.

### BUG V2-3 — Stripe Payment Method : Suppression sans vérification tenant
**Sévérité: CRITIQUE (sécurité)**
- `billing.js:248-261` : `deletePaymentMethod(id)` sans passer `tenantId`
- `stripeBillingService.js:510` : `stripe.paymentMethods.detach(paymentMethodId)` sans vérifier le propriétaire
- **Impact** : Un admin authentifié peut supprimer le moyen de paiement Stripe de N'IMPORTE QUEL tenant s'il connaît le `pm_xxx` ID.
- **Fix** : Vérifier que le PM appartient au customer Stripe du tenant avant detach.

### BUG V2-4 — rhApi routes 404 dans api.ts
**Sévérité: CRITIQUE**
- `api.ts:904-912` : `rhApi.getTeam()` → `/admin/rh/team` (n'existe PAS)
- Backend `adminRH.js` expose `/admin/rh/membres` (pas `/team`)
- 4 méthodes concernées : `getTeam`, `createMember`, `updateMember`, `deleteMember`
- **Impact** : Tout composant utilisant `rhApi` est silencieusement cassé.
- **Fix** : Renommer les URLs vers `/admin/rh/membres`.

### BUG V2-5 — RH.tsx : membre.id undefined après POST
**Sévérité: CRITIQUE**
- Backend retourne `{ membre: {...} }` (objet wrappé)
- Frontend attend un objet flat : `const membre = await api.post<Membre>(endpoint, membreData)`
- `membre.id` est undefined → `POST /admin/rh/membres/undefined/diplomes`
- **Impact** : L'ajout de diplômes/documents après création d'un membre échoue systématiquement.

### BUG V2-6 — Tenant Shield : compteurs_conges sans tenant_id
**Sévérité: CRITIQUE (sécurité)**
- `rh.js:77-82,508-513,663-667,695-700` : Queries sur `compteurs_conges` avec `.eq('employe_id', id)` SANS `.eq('tenant_id', tenantId)`
- **Impact** : Un admin de Tenant A peut lire les compteurs de congés d'un employé de Tenant B.
- **Fix** : Ajouter `.eq('tenant_id', tenantId)` à toutes les queries `compteurs_conges`.

---

## HAUTE — Bugs importants

### BUG V2-7 — GlobalMenu `/ia-admin` plan incorrect
**Sévérité: HAUTE**
- GlobalMenu : `plan: 'pro'` pour IA Admin
- Backend `planFeatures.js` : `agent_ia_web` est **Starter**
- **Impact** : Un Starter ne voit pas IA Admin dans le menu mobile alors qu'il y a droit.
- **Fix** : Supprimer `plan: 'pro'` de l'item `/ia-admin` dans GlobalMenu.

### BUG V2-8 — `/devis` gardé par mauvais module frontend
**Sévérité: HAUTE**
- Backend `adminDevis.js` : `requireModule('devis')` → **Pro**
- Sidebar + App.tsx : `requiredModule: 'marketing'` → **Business**
- **Impact** : Un Pro avec `devis` activé ne peut pas accéder à `/devis` car le frontend exige `marketing` (Business).
- **Fix** : Changer Sidebar/App.tsx pour utiliser `module="devis"`.

### BUG V2-9 — 2FA validate sans rate limiting
**Sévérité: HAUTE (sécurité)**
- `POST /api/admin/auth/2fa/validate` n'a pas de `loginLimiter`
- `temp_token` valide 5 minutes → 1M combinaisons TOTP possibles
- **Fix** : Appliquer `loginLimiter` au endpoint 2FA.

### BUG V2-10 — SVG upload autorisé (vecteur XSS)
**Sévérité: HAUTE (sécurité)**
- `adminDocuments.js:25` : `image/svg+xml` dans `ALLOWED_TYPES`
- SVG peut contenir du JavaScript → XSS via Supabase Storage
- **Fix** : Retirer `image/svg+xml` des types autorisés.

### BUG V2-11 — POST /api/landing-agent/chat sans rate limiting
**Sévérité: HAUTE**
- Endpoint public, appelle l'API Anthropic (Claude)
- Aucune authentification, aucun rate limiting
- **Impact** : Spam gratuit → coûts Anthropic incontrôlés.
- **Fix** : Ajouter un rate limiter.

### BUG V2-12 — Missing security template dans businessTemplates.js
**Sévérité: HAUTE**
- `BUSINESS_TEMPLATES` n'a pas de clé `security`
- Fallback silencieux vers `autre` → services génériques au lieu de gardiennage/agent
- **Impact** : Tout tenant security onboardé reçoit de mauvais défauts.

### BUG V2-13 — Logout ne révoque pas la session serveur
**Sévérité: HAUTE (sécurité)**
- `POST /logout` ne fait rien côté serveur
- JWT volé reste valide 24h même après logout
- `revokeSession()` existe mais n'est pas appelé.

### BUG V2-14 — reservation_lignes sans tenant_id filter
**Sévérité: HAUTE (sécurité)**
- `adminReservations.js:1086-1091` : `SELECT * FROM reservation_lignes WHERE id = ? AND reservation_id = ?`
- MISSING : `.eq('tenant_id', tenantId)`
- Service role key bypass RLS.

---

## MOYENNE — Bugs fonctionnels non-bloquants

### BUG V2-15 — GlobalMenu manque routes hotel/restaurant mobile
- `/salle` (Plan de salle restaurant) absent
- `/chambres` (Calendrier Chambres hotel) absent
- `/tarifs` (Tarifs Saisonniers hotel) absent
- **Impact** : Tenants hotel/restaurant ne peuvent pas y accéder sur mobile.

### BUG V2-16 — 7 modules fantômes dans Sidebar MODULE_TO_PLAN
- `standard_ia`, `ia_reservation`, `rh_avance`, `paie`, `sentinel_pro`, `social_media`, `assistant_ia`
- N'existent pas dans `planFeatures.js` → toujours verrouillés, jamais débloquables.

### BUG V2-17 — Quotas désynchronisés backend/frontend
| Quota | quotas.js (appliqué) | useTenant (affiché) |
|-------|---------------------|---------------------|
| Business storage | -1 (illimité) | **50 GB** |
| Business posts/mois | 1000 | **2000** |
| Business images/mois | 1000 | **2000** |
| Starter posts/mois | 0 (bloqué) | **100** |
| Pro posts/mois | 0 (bloqué) | **500** |

### BUG V2-18 — CSV import clients bypass quota
- `POST /api/admin/clients/import` n'a pas `requireClientsQuota`
- Import CSV de centaines de clients → contourne les limites.

### BUG V2-19 — Pas de gating business type au niveau route
- `/menu`, `/salle`, `/chambres`, `/tarifs`, `/commandes` protégés par module mais pas par business type
- Un salon peut naviguer à `/chambres` via URL directe (page vide mais confuse).

### BUG V2-20 — Devis.tsx accepterMutation sans body
- `accepterMutation` envoie `api.post('/admin/devis/${id}/accepter')` sans body
- Backend attend `{ date_rdv, heure_rdv }` pour créer la réservation
- **Impact** : Accepter un devis change le statut mais ne crée pas la réservation.

### BUG V2-21 — QuickAnalyticsWidget mauvaise clé localStorage
- `QuickAnalyticsWidget.tsx:30` : `localStorage.getItem('admin_token')` au lieu de `nexus_admin_token`
- Le token est toujours `null` → 401 silencieux.

### BUG V2-22 — CRM routes sans requireModule
- `crm.js` : `router.use(authenticateAdmin)` seulement, pas de `requireModule('crm_avance')`
- Tout admin peut accéder au CRM quel que soit son plan.

### BUG V2-23 — API Keys routes sans requireModule
- `adminApiKeys.js` : Pas de `requireModule('api')`
- Tout plan peut créer des API keys (devrait être Business).

### BUG V2-24 — adminWorkflows/Segments : requireProPlan au lieu de requireModule
- `adminWorkflows.js` et `adminSegments.js` utilisent `requireProPlan`
- Devrait être `requireModule('marketing')` (Business, pas Pro)
- **Impact** : Pro peut accéder aux workflows, devrait être Business.

---

## FAIBLE — Dette technique / cosmétique

### BUG V2-25 — get_salon_info tool donné à tous les business types
- Pas dans `ALL_BUSINESS_SPECIFIC` → exposé aux restaurants, hotels, commerce, security
- Nom sémantiquement incorrect dans un contexte non-salon.

### BUG V2-26 — NEXUS_PLANS prix starter=79€ dans businessTemplates.js
- Devrait être 99€ (conf. pricing.js source de vérité).

### BUG V2-27 — rh.js expose error.message brut (289 occurrences)
- Fuite de schéma DB dans les réponses d'erreur.

### BUG V2-28 — Fichiers pages orphelins
- `Onboarding.tsx`, `Rapprochement.tsx`, `ComptesAuxiliaires.tsx`, `ExpertComptable.tsx`
- Routes redirigées, pages jamais rendues.

### BUG V2-29 — PLAN_LIMITS : 3 sources séparées avec noms de champs différents
- `planFeatures.js` : `clients_max`, `reservations_mois`
- `quotas.js` : `clients`, `reservations_per_month`
- `useTenant.ts` : `clients_max`, `reservations_month`
- Pas de source de vérité unique pour les quotas.

### BUG V2-30 — checkUsageLimit() référence des champs undefined
- `commandes_mois`, `tickets_mois`, `projets_actifs`, `posts_sociaux_mois`, `quota_dalle`
- Pas définis dans PLAN_LIMITS → limites toujours `undefined` → checks passent silencieusement.

---

## VALIDATION AUDIT V1

| Bug V1 | Statut V2 | Notes |
|--------|-----------|-------|
| #1 Quotas désync | ✅ FIXÉ | Starter 200, Pro 2000/5000 — OK |
| #2 checkUsageLimit non monté | ✅ FIXÉ | requireReservationsQuota ajouté — OK |
| #3 GlobalMenu no plan filter | ✅ FIXÉ | `hasPlan()` ajouté — OK |
| #4 Sidebar MODULE_TO_PLAN | ✅ FIXÉ | marketing→business, analytics→business, ecommerce→starter — OK |
| #5 GlobalMenu plan values | ⚠️ PARTIELLEMENT | analytics/rh/pipeline OK, mais `/ia-admin` encore à 'pro' au lieu de starter |
| #6 getBaseAddress default | ✅ FIXÉ | tenantId requis, FATOU_ADDRESS supprimé — OK |
| #7 Onboarding silencieux | ✅ FIXÉ | onboardingSteps tracker ajouté — OK |
| #8 tenantCache fallback | ✅ FIXÉ | Template dégradé pour tenants inconnus — OK |
| #9 phoneBookingService | ✅ FIXÉ | Marqué @deprecated (dead code) — OK |
| #10-13 Nettoyage | ✅ FIXÉ | Comments, localStorage, prix, fatshairafro refs — OK |

---

## PLAN D'ACTION PRIORITAIRE V2

### Sprint Immédiat — Critiques (avant tout)
1. Fix double `*100` dans Stock (V2-1)
2. Fix middleware order adminOrders + adminDisponibilites (V2-2)
3. Fix Stripe PM deletion tenant check (V2-3)
4. Fix rhApi URLs dans api.ts (V2-4)
5. Fix RH.tsx parsing `{ membre: {...} }` (V2-5)
6. Fix compteurs_conges tenant_id (V2-6)

### Sprint Sécurité — Haute priorité
7. Fix GlobalMenu `/ia-admin` plan (V2-7)
8. Fix `/devis` module guard (V2-8)
9. Rate limit 2FA validate (V2-9)
10. Retirer SVG des uploads (V2-10)
11. Rate limit landing-agent/chat (V2-11)
12. Créer template security (V2-12)
13. Fix logout session revocation (V2-13)
14. Fix reservation_lignes tenant_id (V2-14)

### Sprint Cohérence — Moyenne priorité
15-24. GlobalMenu routes manquantes, modules fantômes, quotas, CSV import, etc.

### Sprint Nettoyage — Faible priorité
25-30. IA tools, prix, error messages, fichiers orphelins, PLAN_LIMITS unification.
